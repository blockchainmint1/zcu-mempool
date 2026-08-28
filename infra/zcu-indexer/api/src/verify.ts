// Solidity source verification.
//
// The submitter sends source + exact compiler settings; we compile with the
// matching solc release and compare the produced runtime bytecode against the
// code actually deployed on chain. Only an exact match (after stripping the
// trailing CBOR metadata, which encodes source paths and is allowed to differ)
// is accepted, so a verified contract really is the code that runs.

import type pg from "pg";
import solc from "solc";

const RPC_URL = process.env["ZCU_RPC_URL"] ?? "https://node-zcu.honest.money";
const COMPILER_LIST_URL = "https://binaries.soliditylang.org/bin/list.json";
const MAX_SOURCE_BYTES = 500_000;

type Pool = pg.Pool;

export interface VerifyInput {
  address: string;
  name: string;
  compilerVersion: string; // e.g. v0.8.24+commit.e11b9ed9
  source: string;
  optimization?: boolean;
  optimizationRuns?: number;
  evmVersion?: string | null;
  license?: string | null;
  constructorArguments?: string | null;
}

export class VerifyError extends Error {}

const compilerCache = new Map<string, unknown>();

function loadCompiler(version: string): Promise<unknown> {
  const cached = compilerCache.get(version);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    // solc-js fetches the release from binaries.soliditylang.org and evaluates
    // it; the box needs outbound HTTPS for the first use of each version.
    (solc as unknown as {
      loadRemoteVersion: (v: string, cb: (err: Error | null, c?: unknown) => void) => void;
    }).loadRemoteVersion(version, (err, compiler) => {
      if (err || !compiler) return reject(new VerifyError(`Could not load solc ${version}`));
      compilerCache.set(version, compiler);
      resolve(compiler);
    });
  });
}

/**
 * Solidity appends a CBOR metadata blob whose last two bytes give its length.
 * It hashes the source *path* among other things, so two byte-identical
 * contracts can differ there. Strip it before comparing.
 */
function stripMetadata(code: string): string {
  const hex = code.replace(/^0x/, "").toLowerCase();
  if (hex.length < 8) return hex;
  const len = parseInt(hex.slice(-4), 16);
  if (!Number.isFinite(len) || len <= 0) return hex;
  const cut = hex.length - (len + 2) * 2;
  return cut > 0 ? hex.slice(0, cut) : hex;
}

async function getDeployedCode(address: string): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getCode",
      params: [address, "latest"],
    }),
  });
  if (!res.ok) throw new VerifyError(`Node returned HTTP ${res.status}`);
  const out = (await res.json()) as { result?: string; error?: { message: string } };
  if (out.error) throw new VerifyError(out.error.message);
  return out.result ?? "0x";
}

export async function listCompilers(): Promise<{ versions: string[] }> {
  const res = await fetch(COMPILER_LIST_URL);
  if (!res.ok) throw new VerifyError("Could not fetch the compiler list");
  const list = (await res.json()) as { builds?: { longVersion: string; prerelease?: string }[] };
  const versions = (list.builds ?? [])
    .filter((b) => !b.prerelease)
    .map((b) => "v" + b.longVersion)
    .reverse();
  return { versions };
}

export async function getContract(pool: Pool, address: string) {
  const { rows } = await pool.query(
    `SELECT address, name, compiler_version, evm_version, optimization,
            optimization_runs, license, source_code, abi, constructor_arguments,
            compiler_settings, verified_at
       FROM contracts WHERE address = $1`,
    [address],
  );
  const r = rows[0];
  if (!r) return { address, verified: false as const };
  return {
    address: r.address,
    verified: true as const,
    name: r.name,
    compilerVersion: r.compiler_version,
    evmVersion: r.evm_version,
    optimization: r.optimization,
    optimizationRuns: r.optimization_runs,
    license: r.license,
    sourceCode: r.source_code,
    abi: r.abi,
    constructorArguments: r.constructor_arguments,
    verifiedAt: r.verified_at,
  };
}

export async function verifyContract(pool: Pool, input: VerifyInput) {
  const address = input.address.toLowerCase();

  if (!/^0x[0-9a-f]{40}$/.test(address)) throw new VerifyError("Invalid address");
  if (!input.source || Buffer.byteLength(input.source) > MAX_SOURCE_BYTES) {
    throw new VerifyError("Source is empty or too large");
  }
  if (!/^v\d+\.\d+\.\d+\+commit\.[0-9a-f]+$/.test(input.compilerVersion)) {
    throw new VerifyError("Compiler version must look like v0.8.24+commit.e11b9ed9");
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(input.name)) throw new VerifyError("Invalid contract name");

  const existing = await getContract(pool, address);
  if (existing.verified) throw new VerifyError("This contract is already verified");

  const deployed = await getDeployedCode(address);
  if (!deployed || deployed === "0x") throw new VerifyError("No contract code at that address");

  const settings = {
    optimizer: { enabled: !!input.optimization, runs: input.optimizationRuns ?? 200 },
    ...(input.evmVersion ? { evmVersion: input.evmVersion } : {}),
    outputSelection: { "*": { "*": ["abi", "evm.deployedBytecode.object"] } },
  };

  const compiler = (await loadCompiler(input.compilerVersion)) as {
    compile: (input: string) => string;
  };

  const out = JSON.parse(
    compiler.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "contract.sol": { content: input.source } },
        settings,
      }),
    ),
  ) as {
    errors?: { severity: string; formattedMessage: string }[];
    contracts?: Record<string, Record<string, { abi: unknown; evm: { deployedBytecode: { object: string } } }>>;
  };

  const fatal = (out.errors ?? []).filter((e) => e.severity === "error");
  if (fatal.length > 0) {
    throw new VerifyError("Compilation failed: " + fatal.map((e) => e.formattedMessage).join("\n"));
  }

  const compiled = out.contracts?.["contract.sol"]?.[input.name];
  if (!compiled) {
    const found = Object.keys(out.contracts?.["contract.sol"] ?? {}).join(", ") || "none";
    throw new VerifyError(`Contract "${input.name}" not found in source (found: ${found})`);
  }

  const want = stripMetadata(compiled.evm.deployedBytecode.object);
  const got = stripMetadata(deployed);
  if (!want || want !== got) {
    throw new VerifyError(
      "Bytecode does not match the deployed contract. Check the compiler version, optimizer setting and runs.",
    );
  }

  await pool.query(
    `INSERT INTO contracts (address, name, compiler_version, evm_version, optimization,
                            optimization_runs, license, source_code, abi,
                            constructor_arguments, compiler_settings)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (address) DO NOTHING`,
    [
      address,
      input.name,
      input.compilerVersion,
      input.evmVersion ?? null,
      !!input.optimization,
      input.optimizationRuns ?? null,
      input.license ?? null,
      input.source,
      JSON.stringify(compiled.abi),
      input.constructorArguments ?? null,
      JSON.stringify(settings),
    ],
  );

  return { address, verified: true, name: input.name };
}
