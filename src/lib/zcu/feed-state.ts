import type { ZcuBlock, ZcuChainInfo, ZcuMempool } from "./types";

export type FeedStatus = "connecting" | "live" | "polling" | "offline";

export interface ZcuFeedSnapshot {
  chain: ZcuChainInfo | null;
  tipHeight: number | null;
  blocks: ZcuBlock[];
  mempool: ZcuMempool | null;
  status: FeedStatus;
  lastTick: number;
}

export function updateFeed(
  previous: ZcuFeedSnapshot,
  results: [PromiseSettledResult<ZcuChainInfo>, PromiseSettledResult<ZcuBlock[]>, PromiseSettledResult<ZcuMempool>],
  now: number,
): ZcuFeedSnapshot {
  const [chain, blocks, mempool] = results;
  const allOk = results.every((result) => result.status === "fulfilled");
  return {
    chain: chain.status === "fulfilled" ? chain.value : previous.chain,
    tipHeight: chain.status === "fulfilled" ? chain.value.tipHeight : previous.tipHeight,
    blocks: blocks.status === "fulfilled" ? blocks.value : previous.blocks,
    mempool: mempool.status === "fulfilled" ? mempool.value : previous.mempool,
    status: allOk ? "live" : "offline",
    lastTick: allOk ? now : previous.lastTick,
  };
}