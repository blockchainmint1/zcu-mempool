import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getHashrate } from "@/lib/zcu/chain";

export const Route = createFileRoute("/api/v1/mining/hashrate")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const sample = Math.min(500, Math.max(10, Number(url.searchParams.get("sample") ?? 120)));
          return jsonResponse(await getHashrate(sample), {
            headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
          });
        } catch (e) {
          return errorResponse((e as Error).message, 502);
        }
      },
    },
  },
});
