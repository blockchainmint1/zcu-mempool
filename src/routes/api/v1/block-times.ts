import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getBlockTimes } from "@/lib/zcu/indexer";
import { getRecentBlocks } from "@/lib/zcu/chain";
import type { ZcuBlockTimes } from "@/lib/zcu/types";

const WINDOWS = ["blocks", "1d", "7d", "30d"] as const;
type Window = (typeof WINDOWS)[number];

async function recentFallback(window: Window): Promise<ZcuBlockTimes> {
  // Keep the fallback intentionally small: the live node has no historical
  // aggregation endpoint and giant RPC batches can outlive a browser request.
  const blocks = (await getRecentBlocks(120)).reverse();
  const series = blocks.slice(1).flatMap((block, i) => {
    const interval = block.timestamp - blocks[i]!.timestamp;
    return interval >= 0 && interval < 86400
      ? [{ timestamp: block.timestamp, height: block.number, avg: interval }]
      : [];
  });
  const values = series.map((point) => point.avg);
  if (values.length === 0) throw new Error("No block intervals available");
  return {
    window,
    targetBlockTimeSec: 60,
    avgBlockTimeSec: values.reduce((sum, value) => sum + value, 0) / values.length,
    fastestSec: Math.min(...values),
    slowestSec: Math.max(...values),
    sampledIntervals: values.length,
    series,
  };
}

export const Route = createFileRoute("/api/v1/block-times")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const requested = url.searchParams.get("mode") === "blocks"
          ? "blocks"
          : (url.searchParams.get("window") ?? "7d");
        if (!WINDOWS.includes(requested as Window)) {
          return errorResponse("Invalid window — use blocks, 1d, 7d, or 30d", 400);
        }
        const window = requested as Window;

        try {
          const indexed = await getBlockTimes(window);
          const data = indexed ?? (await recentFallback(window));
          const cache = window === "blocks" ? 60 : window === "1d" ? 120 : 600;
          return jsonResponse(data, {
            headers: { "Cache-Control": `public, max-age=${cache}, s-maxage=${cache}` },
          });
        } catch (e) {
          return errorResponse((e as Error).message, 502);
        }
      },
    },
  },
});