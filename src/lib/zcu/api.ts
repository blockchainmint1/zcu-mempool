// Browser-side client for this app's own /api/v1/* surface.
//
// The frontend never talks to the geth node directly: every read goes
// through our routes so the public API, the edge cache, and the UI all see
// exactly the same data, and so we can swap the upstream node without
// touching the client.

import { ZCU_API_BASE } from "./network";
import type {
  ZcuAddressDetail,
  ZcuRichlist,
  ZcuTokenTransferPage,
  ZcuBlock,
  ZcuChainInfo,
  ZcuHashrate,
  ZcuMempool,
  ZcuMiner,
  ZcuTx,
  ZcuTokenList,
  ZcuTokenDetail,
  ZcuContract,
} from "./types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${ZCU_API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${path} → ${res.status}${body ? `: ${body.slice(0, 160)}` : ""}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  const text = await res.text();
  const n = Number(text);
  if (text.trim() !== "" && !Number.isNaN(n)) return n as unknown as T;
  return text as unknown as T;
}

export const zcu = {
  // chain
  chainInfo: () => get<ZcuChainInfo>("/chain"),
  tipHeight: () => get<number>("/blocks/tip/height"),

  // blocks
  recentBlocks: (count = 15, before?: number) =>
    get<ZcuBlock[]>(`/blocks?count=${count}${before != null ? `&before=${before}` : ""}`),
  block: (id: string) => get<ZcuBlock>(`/block/${id}`),
  blockTxs: (id: string) => get<{ block: ZcuBlock; txs: ZcuTx[] }>(`/block/${id}/txs`),

  // transactions
  tx: (hash: string) => get<ZcuTx>(`/tx/${hash}`),

  // addresses
  address: (addr: string, page = 1, pageSize = 25) =>
    get<ZcuAddressDetail>(`/address/${addr}?page=${page}&pageSize=${pageSize}`),
  addressTokens: (addr: string, page = 1, pageSize = 25) =>
    get<ZcuTokenTransferPage>(`/address/${addr}/tokens?page=${page}&pageSize=${pageSize}`),

  // richlist (indexer-backed)
  richlist: (limit = 100, offset = 0) =>
    get<ZcuRichlist>(`/richlist?limit=${limit}&offset=${offset}`),


  // tokens + contracts (indexer-backed)
  tokens: (page = 1, pageSize = 50) =>
    get<ZcuTokenList>(`/tokens?page=${page}&pageSize=${pageSize}`),
  token: (addr: string, page = 1, pageSize = 25) =>
    get<ZcuTokenDetail>(`/token/${addr}?page=${page}&pageSize=${pageSize}`),
  contract: (addr: string) => get<ZcuContract>(`/contract/${addr}`),
  compilers: () => get<{ versions: string[] }>("/verify"),

  // mempool
  mempool: () => get<ZcuMempool>("/mempool"),

  // mining
  hashrate: (sample = 120) => get<ZcuHashrate>(`/mining/hashrate?sample=${sample}`),
  miners: (window = 200) =>
    get<{ miners: ZcuMiner[]; blockCount: number }>(`/mining/miners?window=${window}`),
};
