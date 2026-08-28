import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getToken, getTokenHolders, getTokenTransfers, indexerConfigured } from "@/lib/zcu/indexer";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export const Route = createFileRoute("/api/v1/token/$addr")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ request, params }) => {
        if (!ADDRESS_RE.test(params.addr)) return errorResponse("Invalid token address", 400);
        if (!indexerConfigured()) return errorResponse("Tokens require the indexer", 503);

        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
        const pageSize = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get("pageSize") ?? 25) || 25),
        );
        const holderLimit = Math.min(
          200,
          Math.max(1, Number(url.searchParams.get("holders") ?? 25) || 25),
        );

        const [summary, holders, transfers] = await Promise.all([
          getToken(params.addr),
          getTokenHolders(params.addr, holderLimit, 0),
          getTokenTransfers(params.addr, page, pageSize),
        ]);

        if (!summary) return errorResponse("Unknown token", 404);
        return jsonResponse({ token: summary, holders, transfers });
      },
    },
  },
});
