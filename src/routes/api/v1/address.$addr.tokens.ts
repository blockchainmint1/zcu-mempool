import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getAddressTokenTransfers, indexerConfigured } from "@/lib/zcu/indexer";

export const Route = createFileRoute("/api/v1/address/$addr/tokens")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ params, request }) => {
        if (!/^0x[0-9a-fA-F]{40}$/.test(params.addr)) {
          return errorResponse("Invalid address", 400);
        }
        if (!indexerConfigured()) {
          return errorResponse("Token transfer history requires the indexer", 503);
        }

        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
        const pageSize = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get("pageSize") ?? 25) || 25),
        );

        const data = await getAddressTokenTransfers(params.addr, page, pageSize);
        if (!data) return errorResponse("Indexer unavailable", 503);

        return jsonResponse(data, {
          headers: { "Cache-Control": "public, max-age=15, s-maxage=15" },
        });
      },
    },
  },
});
