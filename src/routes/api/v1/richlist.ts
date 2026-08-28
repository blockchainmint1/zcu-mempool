import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getRichlist, indexerConfigured } from "@/lib/zcu/indexer";

export const Route = createFileRoute("/api/v1/richlist")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ request }) => {
        if (!indexerConfigured()) {
          return errorResponse("Richlist requires the indexer", 503);
        }

        const url = new URL(request.url);
        const limit = Math.min(
          500,
          Math.max(1, Number(url.searchParams.get("limit") ?? 100) || 100),
        );
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

        const data = await getRichlist(limit, offset);
        if (!data) return errorResponse("Indexer unavailable", 503);

        return jsonResponse(data, {
          headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
        });
      },
    },
  },
});
