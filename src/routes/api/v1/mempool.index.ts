import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getMempool } from "@/lib/zcu/chain";

export const Route = createFileRoute("/api/v1/mempool/")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async () => {
        try {
          return jsonResponse(await getMempool(), {
            headers: { "Cache-Control": "public, max-age=3, s-maxage=3" },
          });
        } catch (e) {
          return errorResponse((e as Error).message, 502);
        }
      },
    },
  },
});
