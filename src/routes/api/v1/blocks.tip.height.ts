import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, textResponse, errorResponse } from "@/lib/api/cors";
import { getTipHeight } from "@/lib/zcu/chain";

export const Route = createFileRoute("/api/v1/blocks/tip/height")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async () => {
        try {
          // Plain-text integer, matching the convention explorer APIs use.
          return textResponse(String(await getTipHeight()), {
            headers: { "Cache-Control": "public, max-age=5, s-maxage=5" },
          });
        } catch (e) {
          return errorResponse((e as Error).message, 502);
        }
      },
    },
  },
});
