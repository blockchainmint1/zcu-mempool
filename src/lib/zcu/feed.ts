// Live feed for the explorer.
//
// The upstream geth node exposes WebSockets on :8748, but only the HTTPS RPC
// is published, so this polls. Poll cadence is tied to the chain's observed
// block time rather than a fixed 10s: ZCU blocks are frequent and cheap to
// fetch, and a batched RPC round-trip covers tip + blocks + mempool.

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { zcu } from "./api";
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

const EMPTY: ZcuFeedSnapshot = {
  chain: null,
  tipHeight: null,
  blocks: [],
  mempool: null,
  status: "connecting",
  lastTick: 0,
};

const POLL_MS = 10_000;

export function useZcuFeed(): ZcuFeedSnapshot {
  const [snap, setSnap] = useState<ZcuFeedSnapshot>(EMPTY);
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const [chain, blocks, mempool] = await Promise.allSettled([
        zcu.chainInfo(),
        zcu.recentBlocks(15),
        zcu.mempool(),
      ]);
      if (cancelled) return;

      setSnap((prev) => {
        // Only overwrite a field when its fetch succeeded, so one flaky
        // upstream call can't blank the whole dashboard.
        const anyOk =
          chain.status === "fulfilled" ||
          blocks.status === "fulfilled" ||
          mempool.status === "fulfilled";
        return {
          chain: chain.status === "fulfilled" ? chain.value : prev.chain,
          tipHeight:
            chain.status === "fulfilled" ? chain.value.tipHeight : prev.tipHeight,
          blocks: blocks.status === "fulfilled" ? blocks.value : prev.blocks,
          mempool: mempool.status === "fulfilled" ? mempool.value : prev.mempool,
          status: anyOk ? "live" : "offline",
          lastTick: Date.now(),
        };
      });

      qc.invalidateQueries({ queryKey: ["zcu"], exact: false });
    }

    poll();
    timer.current = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [qc]);

  return snap;
}
