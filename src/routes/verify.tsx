import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { zcu } from "@/lib/zcu/api";
import { ZCU_API_BASE } from "@/lib/zcu/network";

export const Route = createFileRoute("/verify")({
  validateSearch: (search: Record<string, unknown>) => ({
    address: typeof search["address"] === "string" ? search["address"] : "",
  }),
  head: () => {
    const title = "Verify a Contract — ZCU Explorer";
    const desc =
      "Publish and verify Solidity source for a contract deployed on the Zero Chill Units chain. Compiled bytecode is matched against on-chain code.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: VerifyPage,
});

const LICENSES = [
  "None",
  "MIT",
  "GPL-3.0",
  "LGPL-3.0",
  "Apache-2.0",
  "BSD-3-Clause",
  "Unlicense",
];

function VerifyPage() {
  const { address: initialAddress } = Route.useSearch();

  const [address, setAddress] = useState(initialAddress);
  const [name, setName] = useState("");
  const [compilerVersion, setCompilerVersion] = useState("");
  const [source, setSource] = useState("");
  const [optimization, setOptimization] = useState(false);
  const [optimizationRuns, setOptimizationRuns] = useState(200);
  const [license, setLicense] = useState("MIT");
  const [constructorArguments, setConstructorArguments] = useState("");

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const compilers = useQuery({
    queryKey: ["zcu", "compilers"],
    queryFn: () => zcu.compilers(),
    staleTime: 3_600_000,
    retry: 1,
  });

  const existing = useQuery({
    queryKey: ["zcu", "contract", address],
    queryFn: () => zcu.contract(address),
    enabled: /^0x[0-9a-fA-F]{40}$/.test(address),
    retry: 1,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`${ZCU_API_BASE}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          name,
          compilerVersion,
          source,
          optimization,
          optimizationRuns,
          license: license === "None" ? null : license,
          constructorArguments: constructorArguments.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setResult({ ok: true, message: "Verified — source and ABI are now public." });
        void existing.refetch();
      } else {
        setResult({ ok: false, message: data.error ?? `Verification failed (${res.status})` });
      }
    } catch (err) {
      setResult({ ok: false, message: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-sm border border-border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary";
  const label = "block text-[10px] uppercase tracking-widest text-muted-foreground mb-1";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Contracts
        </span>
        <h1 className="font-display text-2xl">Verify contract source</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Paste the exact Solidity source that produced the deployed bytecode. We
          compile it here and compare the runtime code byte for byte — no trust
          required, and nothing is published unless it matches.
        </p>
      </header>

      {existing.data?.verified && (
        <div className="rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-xs font-mono space-y-1">
          <p className="text-primary">✓ Already verified as {existing.data.name}</p>
          <p className="text-muted-foreground">
            {existing.data.compilerVersion}
            {existing.data.optimization
              ? ` · optimizer on (${existing.data.optimizationRuns} runs)`
              : " · optimizer off"}
            {existing.data.license ? ` · ${existing.data.license}` : ""}
          </p>
        </div>
      )}

      <form onSubmit={submit} className="rounded-md surface-2 border border-border p-4 md:p-6 space-y-4">
        <div>
          <label className={label} htmlFor="v-address">Contract address</label>
          <input
            id="v-address"
            className={field}
            placeholder="0x…"
            value={address}
            onChange={(e) => setAddress(e.target.value.trim())}
            required
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={label} htmlFor="v-name">Contract name</label>
            <input
              id="v-name"
              className={field}
              placeholder="MyToken"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={label} htmlFor="v-compiler">Compiler version</label>
            <select
              id="v-compiler"
              className={field}
              value={compilerVersion}
              onChange={(e) => setCompilerVersion(e.target.value)}
              required
            >
              <option value="">
                {compilers.isLoading ? "Loading compilers…" : "Select a version"}
              </option>
              {(compilers.data?.versions ?? []).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 items-end">
          <label className="flex items-center gap-2 text-xs font-mono">
            <input
              type="checkbox"
              checked={optimization}
              onChange={(e) => setOptimization(e.target.checked)}
            />
            Optimization enabled
          </label>
          <div>
            <label className={label} htmlFor="v-runs">Optimizer runs</label>
            <input
              id="v-runs"
              type="number"
              min={1}
              className={field}
              value={optimizationRuns}
              disabled={!optimization}
              onChange={(e) => setOptimizationRuns(Number(e.target.value) || 200)}
            />
          </div>
          <div>
            <label className={label} htmlFor="v-license">License</label>
            <select
              id="v-license"
              className={field}
              value={license}
              onChange={(e) => setLicense(e.target.value)}
            >
              {LICENSES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={label} htmlFor="v-source">Solidity source</label>
          <textarea
            id="v-source"
            className={`${field} h-64 resize-y`}
            placeholder="// SPDX-License-Identifier: MIT&#10;pragma solidity ^0.8.20;&#10;…"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            required
          />
        </div>

        <div>
          <label className={label} htmlFor="v-args">
            Constructor arguments (ABI-encoded hex, optional)
          </label>
          <input
            id="v-args"
            className={field}
            placeholder="0x…"
            value={constructorArguments}
            onChange={(e) => setConstructorArguments(e.target.value.trim())}
          />
        </div>

        {result && (
          <p
            className={`text-xs font-mono ${result.ok ? "text-primary" : "text-destructive"}`}
          >
            {result.message}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-sm border border-primary text-primary text-xs font-mono hover:bg-primary/10 disabled:opacity-40"
          >
            {busy ? "Compiling…" : "Verify & publish"}
          </button>
          {address && /^0x[0-9a-fA-F]{40}$/.test(address) && (
            <Link
              to="/address/$addr"
              params={{ addr: address }}
              className="text-xs font-mono text-muted-foreground hover:text-primary"
            >
              View address →
            </Link>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground">
          First use of a compiler release can take a minute while it downloads.
        </p>
      </form>
    </div>
  );
}
