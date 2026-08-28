import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getRecentBlocks } from "@/lib/zcu/chain";

export const Route = createFileRoute("/api/v1/blocks/")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const count = Math.min(100, Math.max(1, Number(url.searchParams.get("count") ?? 15)));
          const beforeRaw = url.searchParams.get("before");
          const before = beforeRaw != null && /^\d+$/.test(beforeRaw) ? Number(beforeRaw) : undefined;

          const blocks = await getRecentBlocks(count, before);
          // Historic pages are immutable; the live tip is not.
          const cache = before != null ? 300 : 5;
          return jsonResponse(blocks, {
            headers: { "Cache-Control": `public, max-age=${cache}, s-maxage=${cache}` },
          });
        } catch (e) {
          return errorResponse((e as Error).message, 502);
        }
      },
    },
  },
});
