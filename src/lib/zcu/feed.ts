// Live feed for the explorer.
//
// The upstream geth node exposes WebSockets on :8748, but only the HTTPS RPC
// is published, so this polls. Poll cadence is tied to the chain's observed
// block time rather than a fixed 10s: ZCU blocks are frequent and cheap to
// fetch, and a batched RPC round-trip covers tip + blocks + mempool.

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { zcu } from "./api";
import { updateFeed, type ZcuFeedSnapshot } from "./feed-state";
export type { FeedStatus, ZcuFeedSnapshot } from "./feed-state";

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
    let inFlight = false;

    async function poll() {
      if (inFlight) return;
      inFlight = true;
      const results = await Promise.allSettled([
        zcu.chainInfo(),
        zcu.recentBlocks(15),
        zcu.mempool(),
      ]);
      inFlight = false;
      if (cancelled) return;

      setSnap((prev) => updateFeed(prev, results, Date.now()));
      // Failed polling must not reset chart retries every ten seconds.
      if (results.every((result) => result.status === "fulfilled")) {
        void qc.invalidateQueries({ queryKey: ["zcu"], exact: false });
      }
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
