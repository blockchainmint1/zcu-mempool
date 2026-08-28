import { createFileRoute } from "@tanstack/react-router";
import { optionsHandler, jsonResponse, errorResponse } from "@/lib/api/cors";
import { getCompilerVersions, submitVerification, indexerConfigured } from "@/lib/zcu/indexer";

export const Route = createFileRoute("/api/v1/verify")({
  server: {
    handlers: {
      OPTIONS: optionsHandler,

      // Compiler list, so the form can offer real solc releases.
      GET: async () => {
        if (!indexerConfigured()) return errorResponse("Verification requires the indexer", 503);
        const data = await getCompilerVersions();
        if (!data) return errorResponse("Compiler list unavailable", 503);
        return jsonResponse(data, { headers: { "Cache-Control": "public, max-age=3600" } });
      },

      POST: async ({ request }) => {
        if (!indexerConfigured()) return errorResponse("Verification requires the indexer", 503);

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return errorResponse("Invalid JSON body", 400);
        }

        const address = String(body["address"] ?? "").trim();
        const name = String(body["name"] ?? "").trim();
        const compilerVersion = String(body["compilerVersion"] ?? "").trim();
        const source = String(body["source"] ?? "");

        if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return errorResponse("Invalid address", 400);
        if (!name) return errorResponse("Contract name is required", 400);
        if (!compilerVersion) return errorResponse("Compiler version is required", 400);
        if (source.trim().length < 20) return errorResponse("Source code is required", 400);

        const result = await submitVerification({
          address,
          name,
          compilerVersion,
          source,
          optimization: !!body["optimization"],
          optimizationRuns: Math.min(
            1_000_000,
            Math.max(1, Number(body["optimizationRuns"] ?? 200) || 200),
          ),
          evmVersion: body["evmVersion"] ? String(body["evmVersion"]) : null,
          license: body["license"] ? String(body["license"]) : null,
          constructorArguments: body["constructorArguments"]
            ? String(body["constructorArguments"])
            : null,
        });

        if (!result.ok) {
          return errorResponse(result.message ?? "Verification failed", result.status);
        }
        return jsonResponse({ verified: true, address, name });
      },
    },
  },
});
