import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getAddress } from "@/lib/zcu/chain";

export const Route = createFileRoute("/api/v1/address/$addr")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ params }) => {
        if (!/^0x[0-9a-fA-F]{40}$/.test(params.addr)) {
          return errorResponse("Invalid address", 400);
        }
        try {
          return jsonResponse(await getAddress(params.addr), {
            headers: { "Cache-Control": "public, max-age=10, s-maxage=10" },
          });
        } catch (e) {
          return errorResponse((e as Error).message, 502);
        }
      },
    },
  },
});
