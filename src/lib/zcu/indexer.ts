// Server-side client for the ZCU indexer box.
//
// The explorer reads live state (tip, balances, mempool) straight from the
// node. Anything that needs *history* — address transactions, token
// transfers, the richlist — has to come from the indexer, because geth cannot
// answer "what has this address done" and the node exposes no trace API.
//
// Every call degrades gracefully: if the indexer is unreachable or not yet
// configured, callers get null and the UI shows live data without history
// rather than erroring out.

const DEFAULT_TIMEOUT_MS = 8000;

export interface IndexerTx {
  hash: string;
  blockNumber: number;
  transactionIndex: number;
  from: string;
  to: string | null;
  value: string;
  gas: number;
  gasUsed: number | null;
  gasPrice: string;
  fee: string | null;
  status: number | null;
  nonce: number;
  methodId: string | null;
  contractAddress: string | null;
  timestamp: number;
  direction: "in" | "out";
}

export interface IndexerTxPage {
  address: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  transactions: IndexerTx[];
}

export interface IndexerTokenTransfer {
  txHash: string;
  blockNumber: number;
  logIndex: number;
  token: string;
  from: string | null;
  to: string | null;
  value: string | null;
  tokenId: string | null;
  type: "erc20" | "erc721";
  timestamp: number;
  direction: "in" | "out";
}

export interface IndexerTokenPage {
  address: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  transfers: IndexerTokenTransfer[];
}

export interface IndexerHolder {
  rank: number;
  address: string;
  balance: string;
  shareBps: number;
  txCount: number;
  isContract: boolean;
  firstSeenBlock: number;
}

export interface IndexerRichlist {
  indexedSupply: string;
  holders: IndexerHolder[];
}

export interface IndexerStats {
  lastIndexedBlock: number;
  blockCount: number;
  txCount: number;
  addressCount: number;
  logCount: number;
  latestBlockTimestamp: number | null;
}

/** Whether an indexer is configured at all. */
export function indexerConfigured(): boolean {
  return !!process.env["ZCU_INDEXER_URL"];
}

async function call<T>(path: string): Promise<T | null> {
  const base = process.env["ZCU_INDEXER_URL"];
  const token = process.env["ZCU_INDEXER_TOKEN"];
  if (!base) return null;

  const url = base.replace(/\/+$/, "") + path;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error(`[indexer] ${path} -> HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error(`[indexer] ${path} failed: ${(e as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function getAddressTxs(
  address: string,
  page = 1,
  pageSize = 25,
): Promise<IndexerTxPage | null> {
  return call<IndexerTxPage>(
    `/address/${address.toLowerCase()}/txs${qs({ page, pageSize })}`,
  );
}

export function getAddressTokenTransfers(
  address: string,
  page = 1,
  pageSize = 25,
): Promise<IndexerTokenPage | null> {
  return call<IndexerTokenPage>(
    `/address/${address.toLowerCase()}/tokens${qs({ page, pageSize })}`,
  );
}

export function getRichlist(limit = 100, offset = 0): Promise<IndexerRichlist | null> {
  return call<IndexerRichlist>(`/richlist${qs({ limit, offset })}`);
}

export function getIndexerStats(): Promise<IndexerStats | null> {
  return call<IndexerStats>("/stats");
}

// ---------- tokens ----------

export interface IndexerTokenMeta {
  address: string;
  type: "erc20" | "erc721" | "unknown";
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: string | null;
  firstSeenBlock: number | null;
}

export interface IndexerTokenListItem extends IndexerTokenMeta {
  transferCount: number;
  firstBlock: number;
  lastBlock: number;
  lastTransferAt: number;
}

export interface IndexerTokenList {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  tokens: IndexerTokenListItem[];
}

export interface IndexerTokenSummary extends IndexerTokenMeta {
  transferCount: number;
  holderCount: number;
  firstBlock: number | null;
  lastBlock: number | null;
  lastTransferAt: number | null;
  holdersTruncated: boolean;
}

export interface IndexerTokenHolders extends IndexerTokenMeta {
  holderCount: number;
  circulating: string;
  truncated: boolean;
  holders: { rank: number; address: string; balance: string; shareBps: number }[];
}

export interface IndexerTokenTransferRow {
  txHash: string;
  blockNumber: number;
  logIndex: number;
  from: string | null;
  to: string | null;
  value: string | null;
  tokenId: string | null;
  type: "erc20" | "erc721";
  timestamp: number;
}

export interface IndexerTokenTransferList {
  token: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  transfers: IndexerTokenTransferRow[];
}

export interface IndexerTokenPosition extends IndexerTokenMeta {
  balance: string;
}

export type IndexerContract =
  | { address: string; verified: false }
  | {
      address: string;
      verified: true;
      name: string;
      compilerVersion: string;
      evmVersion: string | null;
      optimization: boolean;
      optimizationRuns: number | null;
      license: string | null;
      sourceCode: string;
      abi: unknown[];
      constructorArguments: string | null;
      verifiedAt: string;
    };

export function getTokens(page = 1, pageSize = 50): Promise<IndexerTokenList | null> {
  return call<IndexerTokenList>(`/tokens${qs({ page, pageSize })}`);
}

export function getToken(address: string): Promise<IndexerTokenSummary | null> {
  return call<IndexerTokenSummary>(`/token/${address.toLowerCase()}`);
}

export function getTokenHolders(
  address: string,
  limit = 50,
  offset = 0,
): Promise<IndexerTokenHolders | null> {
  return call<IndexerTokenHolders>(`/token/${address.toLowerCase()}/holders${qs({ limit, offset })}`);
}

export function getTokenTransfers(
  address: string,
  page = 1,
  pageSize = 25,
): Promise<IndexerTokenTransferList | null> {
  return call<IndexerTokenTransferList>(
    `/token/${address.toLowerCase()}/transfers${qs({ page, pageSize })}`,
  );
}

export function getAddressTokenBalances(
  address: string,
): Promise<{ address: string; positions: IndexerTokenPosition[] } | null> {
  return call<{ address: string; positions: IndexerTokenPosition[] }>(
    `/address/${address.toLowerCase()}/balances`,
  );
}

// ---------- contract verification ----------

export function getContract(address: string): Promise<IndexerContract | null> {
  return call<IndexerContract>(`/contract/${address.toLowerCase()}`);
}

export function getCompilerVersions(): Promise<{ versions: string[] } | null> {
  return call<{ versions: string[] }>("/verify/compilers");
}

export interface VerifySubmission {
  address: string;
  name: string;
  compilerVersion: string;
  source: string;
  optimization: boolean;
  optimizationRuns: number;
  evmVersion?: string | null;
  license?: string | null;
  constructorArguments?: string | null;
}

/**
 * Submit source for verification. Unlike the read helpers this surfaces the
 * indexer's error message, because the submitter needs to know *why* their
 * bytecode did not match.
 */
export async function submitVerification(
  body: VerifySubmission,
): Promise<{ ok: boolean; status: number; message?: string }> {
  const base = process.env["ZCU_INDEXER_URL"];
  const token = process.env["ZCU_INDEXER_TOKEN"];
  if (!base) return { ok: false, status: 503, message: "Verification requires the indexer" };

  const ctrl = new AbortController();
  // Loading a solc release the box has not seen before takes a while.
  const timer = setTimeout(() => ctrl.abort(), 180_000);

  try {
    const res = await fetch(base.replace(/\/+$/, "") + "/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, status: res.status, message: data.error ?? "Verification failed" };
    return { ok: true, status: 200 };
  } catch (e) {
    return { ok: false, status: 502, message: (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
