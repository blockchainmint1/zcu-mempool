import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getChainInfo } from "@/lib/zcu/chain";

export const Route = createFileRoute("/api/v1/chain")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async () => {
        try {
          return jsonResponse(await getChainInfo(), {
            headers: { "Cache-Control": "public, max-age=5, s-maxage=5" },
          });
        } catch (e) {
          return errorResponse((e as Error).message, 502);
        }
      },
    },
  },
});
