import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getTx } from "@/lib/zcu/chain";

export const Route = createFileRoute("/api/v1/tx/$hash")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ params }) => {
        if (!/^0x[0-9a-fA-F]{64}$/.test(params.hash)) {
          return errorResponse("Invalid transaction hash", 400);
        }
        try {
          const tx = await getTx(params.hash);
          if (!tx) return errorResponse("Transaction not found", 404);
          // A pending tx changes; a mined one does not.
          const cache = tx.blockNumber == null ? 3 : 60;
          return jsonResponse(tx, {
            headers: { "Cache-Control": `public, max-age=${cache}, s-maxage=${cache}` },
          });
        } catch (e) {
          return errorResponse((e as Error).message, 502);
        }
      },
    },
  },
});
