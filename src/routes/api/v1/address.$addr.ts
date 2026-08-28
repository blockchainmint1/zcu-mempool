import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getAddress } from "@/lib/zcu/chain";
import { getAddressTxs, indexerConfigured } from "@/lib/zcu/indexer";

export const Route = createFileRoute("/api/v1/address/$addr")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ params, request }) => {
        if (!/^0x[0-9a-fA-F]{40}$/.test(params.addr)) {
          return errorResponse("Invalid address", 400);
        }

        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
        const pageSize = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get("pageSize") ?? 25) || 25),
        );

        try {
          // Live state always comes from the node. History is a best-effort
          // add-on so the page still renders if the indexer is down.
          const [account, history] = await Promise.all([
            getAddress(params.addr),
            indexerConfigured()
              ? getAddressTxs(params.addr, page, pageSize)
              : Promise.resolve(null),
          ]);

          return jsonResponse(
            {
              ...account,
              history: history
                ? {
                    available: true,
                    page: history.page,
                    pageSize: history.pageSize,
                    total: history.total,
                    totalPages: history.totalPages,
                    transactions: history.transactions,
                  }
                : {
                    available: false,
                    page: 1,
                    pageSize,
                    total: 0,
                    totalPages: 1,
                    transactions: [],
                  },
            },
            { headers: { "Cache-Control": "public, max-age=10, s-maxage=10" } },
          );
        } catch (e) {
          return errorResponse((e as Error).message, 502);
        }
      },
    },
  },
});
