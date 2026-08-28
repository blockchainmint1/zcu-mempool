// Minimal batching JSON-RPC client for the ZCU geth node.
//
// Deliberately dependency-free: node 22 has global fetch. Everything the
// indexer needs is plain eth_* calls, so there is no reason to pull in a
// full web3 stack.

const RPC_URL = process.env["ZCU_RPC_URL"] ?? "https://node-zcu.honest.money";
const TIMEOUT_MS = Number(process.env["ZCU_RPC_TIMEOUT_MS"] ?? 30_000);

export class RpcError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

interface RpcRequest {
  method: string;
  params?: unknown[];
}

async function post(body: unknown): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new RpcError(`RPC HTTP ${res.status}`, res.status);
    return await res.json();
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new RpcError(`RPC timeout after ${TIMEOUT_MS}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const out = (await post({ jsonrpc: "2.0", id: 1, method, params })) as {
    result?: T;
    error?: { code: number; message: string };
  };
  if (out.error) throw new RpcError(out.error.message, out.error.code);
  return out.result as T;
}

/**
 * Batched call. Results come back in request order — geth may reorder the
 * response array, so we re-sort by id rather than trusting position.
 */
export async function rpcBatch<T>(reqs: RpcRequest[]): Promise<(T | null)[]> {
  if (reqs.length === 0) return [];

  const payload = reqs.map((r, i) => ({
    jsonrpc: "2.0",
    id: i,
    method: r.method,
    params: r.params ?? [],
  }));

  const out = (await post(payload)) as Array<{
    id: number;
    result?: T;
    error?: { code: number; message: string };
  }>;

  if (!Array.isArray(out)) throw new RpcError("Batch response was not an array");

  const byId = new Map<number, T | null>();
  for (const entry of out) {
    byId.set(entry.id, entry.error ? null : (entry.result ?? null));
  }
  return reqs.map((_, i) => byId.get(i) ?? null);
}

// ---------- hex helpers ----------

export function hexToNumber(hex: string | null | undefined): number {
  if (!hex) return 0;
  return Number.parseInt(hex, 16);
}

/** Wei-scale values must not go through Number. */
export function hexToDecimalString(hex: string | null | undefined): string {
  if (!hex) return "0";
  return BigInt(hex).toString();
}

export function toHexQuantity(n: number): string {
  return "0x" + n.toString(16);
}

// ---------- raw shapes ----------

export interface RawTx {
  hash: string;
  blockNumber: string | null;
  blockHash: string | null;
  transactionIndex: string | null;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gas: string;
  nonce: string;
  input: string;
}

export interface RawBlock {
  number: string;
  hash: string;
  parentHash: string;
  timestamp: string;
  miner: string;
  difficulty: string;
  totalDifficulty: string;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  size: string;
  nonce: string;
  extraData: string;
  stateRoot: string;
  transactions: RawTx[];
}

export interface RawReceipt {
  transactionHash: string;
  status?: string;
  gasUsed: string;
  effectiveGasPrice?: string;
  contractAddress: string | null;
  logs: Array<{
    address: string;
    topics: string[];
    data: string;
    logIndex: string;
  }>;
}

export async function getTipHeight(): Promise<number> {
  return hexToNumber(await rpc<string>("eth_blockNumber"));
}

export async function getBlocks(heights: number[]): Promise<(RawBlock | null)[]> {
  return rpcBatch<RawBlock>(
    heights.map((h) => ({
      method: "eth_getBlockByNumber",
      params: [toHexQuantity(h), true],
    })),
  );
}

export async function getReceipts(hashes: string[]): Promise<(RawReceipt | null)[]> {
  return rpcBatch<RawReceipt>(
    hashes.map((h) => ({ method: "eth_getTransactionReceipt", params: [h] })),
  );
}

export async function getBalances(addresses: string[]): Promise<(string | null)[]> {
  return rpcBatch<string>(
    addresses.map((a) => ({ method: "eth_getBalance", params: [a, "latest"] })),
  );
}

export async function getCodes(addresses: string[]): Promise<(string | null)[]> {
  return rpcBatch<string>(
    addresses.map((a) => ({ method: "eth_getCode", params: [a, "latest"] })),
  );
}

export { RPC_URL };
