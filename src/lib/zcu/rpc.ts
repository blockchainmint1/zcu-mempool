// JSON-RPC client for the ZCU geth node.
//
// Server-side only in practice (imported by /api/v1/* route handlers), but it
// holds no secrets — the upstream RPC is public — so it stays a plain module
// rather than a *.server.ts that route files are forbidden from importing.
//
// Defensive body handling mirrors the old texitcoind client: geth can answer
// with plain text ("upstream connect error", proxy 502 HTML) under load, and
// that must surface as a retryable RpcError rather than a JSON parse crash.

import { ZCU_RPC_FALLBACK } from "./network";

export class RpcError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

/** Read at call time — env binds per-request on the Worker runtime. */
function rpcUrl(): string {
  return process.env["ZCU_RPC_URL"] || ZCU_RPC_FALLBACK;
}

function timeoutMs(): number {
  return Number(process.env["ZCU_RPC_TIMEOUT_MS"] ?? 12_000);
}

interface RpcEnvelope<T> {
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

async function post(body: string): Promise<unknown> {
  const res = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(timeoutMs()),
  });

  const raw = await res.text();
  const trimmed = raw.trimStart();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    const snippet = raw.slice(0, 160).replace(/\s+/g, " ").trim() || res.statusText;
    throw new RpcError(res.status || 502, `Non-JSON RPC response (${res.status}): ${snippet}`);
  }
  if (!res.ok && res.status !== 500) {
    throw new RpcError(res.status, `HTTP ${res.status} from ZCU RPC`);
  }
  return JSON.parse(raw);
}

/** Single JSON-RPC call. */
export async function rpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const parsed = (await post(body)) as RpcEnvelope<T>;
  if (parsed.error) throw new RpcError(parsed.error.code, parsed.error.message);
  return parsed.result as T;
}

/**
 * Batched JSON-RPC. geth accepts an array of calls in one HTTP round-trip,
 * which is what makes rendering a 25-block list or a full block's receipts
 * fast enough to do on demand without an indexer.
 *
 * Results come back in request order. A per-call error becomes `null` rather
 * than failing the whole batch — one bad tx should not blank a whole page.
 */
export async function rpcBatch<T = unknown>(
  calls: Array<{ method: string; params?: unknown[] }>,
): Promise<Array<T | null>> {
  if (calls.length === 0) return [];
  const body = JSON.stringify(
    calls.map((c, i) => ({
      jsonrpc: "2.0",
      id: i,
      method: c.method,
      params: c.params ?? [],
    })),
  );
  const parsed = (await post(body)) as RpcEnvelope<T>[] | RpcEnvelope<T>;

  // A batch that fails wholesale (auth, bad gateway JSON) comes back as a
  // single envelope rather than an array.
  if (!Array.isArray(parsed)) {
    if (parsed.error) throw new RpcError(parsed.error.code, parsed.error.message);
    throw new RpcError(502, "Expected a batch response from ZCU RPC");
  }

  const out: Array<T | null> = new Array(calls.length).fill(null);
  for (const env of parsed) {
    if (typeof env.id === "number" && env.id >= 0 && env.id < calls.length) {
      out[env.id] = env.error ? null : ((env.result ?? null) as T | null);
    }
  }
  return out;
}

// ---------- hex helpers ----------

export function toHexQuantity(n: number | bigint): string {
  return "0x" + BigInt(n).toString(16);
}

/** Parse a 0x quantity to a JS number. Only for values known to be small. */
export function hexToNumber(h: string | undefined | null): number {
  if (!h) return 0;
  return Number(BigInt(h));
}

export function hexToBigInt(h: string | undefined | null): bigint {
  if (!h) return 0n;
  return BigInt(h);
}
