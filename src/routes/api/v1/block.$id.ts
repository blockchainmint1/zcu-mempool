import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getBlock } from "@/lib/zcu/chain";

/** Accepts a decimal height or a 0x-prefixed 32-byte block hash. */
function valid(id: string) {
  return /^\d+$/.test(id) || /^0x[0-9a-fA-F]{64}$/.test(id) || id === "latest";
}

export const Route = createFileRoute("/api/v1/block/$id")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ params }) => {
        if (!valid(params.id)) return errorResponse("Invalid block id", 400);
        try {
          const block = await getBlock(params.id);
          if (!block) return errorResponse("Block not found", 404);
          return jsonResponse(block, {
            headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
          });
        } catch (e) {
          return errorResponse((e as Error).message, 502);
        }
      },
    },
  },
});
