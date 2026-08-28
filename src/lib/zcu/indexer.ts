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
