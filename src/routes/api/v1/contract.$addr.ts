import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getContract, indexerConfigured } from "@/lib/zcu/indexer";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export const Route = createFileRoute("/api/v1/contract/$addr")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,
      GET: async ({ params }) => {
        if (!ADDRESS_RE.test(params.addr)) return errorResponse("Invalid address", 400);
        if (!indexerConfigured()) {
          return errorResponse("Contract verification requires the indexer", 503);
        }

        const data = await getContract(params.addr);
        if (!data) return errorResponse("Indexer unavailable", 503);
        return jsonResponse(data);
      },
    },
  },
});
