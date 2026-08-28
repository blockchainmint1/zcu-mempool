import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getMiners } from "@/lib/zcu/chain";

export const Route = createFileRoute("/api/v1/mining/miners")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const window = Math.min(500, Math.max(10, Number(url.searchParams.get("window") ?? 200)));
          return jsonResponse(await getMiners(window), {
            headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
          });
        } catch (e) {
          return errorResponse((e as Error).message, 502);
        }
      },
    },
  },
});
