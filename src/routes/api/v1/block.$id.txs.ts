import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getBlockTxs } from "@/lib/zcu/chain";

function valid(id: string) {
  return /^\d+$/.test(id) || /^0x[0-9a-fA-F]{64}$/.test(id) || id === "latest";
}

export const Route = createFileRoute("/api/v1/block/$id/txs")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ params }) => {
        if (!valid(params.id)) return errorResponse("Invalid block id", 400);
        try {
          const result = await getBlockTxs(params.id);
          if (!result) return errorResponse("Block not found", 404);
          return jsonResponse(result, {
            headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
          });
        } catch (e) {
          return errorResponse((e as Error).message, 502);
        }
      },
    },
  },
});
