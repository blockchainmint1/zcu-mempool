import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getTokens, indexerConfigured } from "@/lib/zcu/indexer";

export const Route = createFileRoute("/api/v1/tokens/")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ request }) => {
        if (!indexerConfigured()) return errorResponse("Tokens require the indexer", 503);

        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
        const pageSize = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get("pageSize") ?? 50) || 50),
        );

        const data = await getTokens(page, pageSize);
        if (!data) return errorResponse("Indexer unavailable", 503);
        return jsonResponse(data);
      },
    },
  },
});
