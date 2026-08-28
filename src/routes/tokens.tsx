import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { zcu } from "@/lib/zcu/api";
import { formatNumber, shortAddr, timeAgo, formatTokenAmount } from "@/lib/zcu/format";
import { StatTile } from "@/components/explorer/StatTile";

export const Route = createFileRoute("/tokens")({
  head: () => {
    const title = "ZCU Tokens — Zero Chill Units Token Explorer";
    const desc =
      "Every ERC-20 and ERC-721 contract that has moved value on the Zero Chill Units chain, with transfer counts, holders and supply.";
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
  component: TokensPage,
});

const PAGE_SIZE = 50;

function TokensPage() {
  const [page, setPage] = useState(1);

  const q = useQuery({
    queryKey: ["zcu", "tokens", page],
    queryFn: () => zcu.tokens(page, PAGE_SIZE),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const tokens = q.data?.tokens ?? [];
  const erc20 = tokens.filter((t) => t.type === "erc20").length;
  const erc721 = tokens.filter((t) => t.type === "erc721").length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Contracts
        </span>
        <h1 className="font-display text-2xl">Tokens</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Discovered from Transfer events on chain — no registry, no allowlist.
          Anything that emits a standard transfer shows up here automatically.
        </p>
      </header>

      {q.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
          The indexer is not responding. Token data will return once it does.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatTile label="Tokens indexed" value={formatNumber(q.data?.total ?? 0)} />
        <StatTile label="ERC-20 on page" value={formatNumber(erc20)} />
        <StatTile label="ERC-721 on page" value={formatNumber(erc721)} />
      </div>

      <section className="rounded-md surface-2 border border-border p-4 md:p-6">
        {q.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No token contracts have emitted a transfer yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-3 font-normal">Token</th>
                  <th className="text-left py-2 pr-3 font-normal">Type</th>
                  <th className="text-right py-2 pr-3 font-normal">Supply</th>
                  <th className="text-right py-2 pr-3 font-normal">Transfers</th>
                  <th className="text-right py-2 font-normal">Last active</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.address} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2 pr-3">
                      <Link
                        to="/token/$addr"
                        params={{ addr: t.address }}
                        className="text-primary hover:underline"
                      >
                        {t.symbol || t.name || shortAddr(t.address)}
                      </Link>
                      {t.name && t.symbol && (
                        <span className="ml-2 text-muted-foreground">{t.name}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground uppercase text-[10px] tracking-wider">
                      {t.type === "unknown" ? "—" : t.type}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {t.totalSupply ? formatTokenAmount(t.totalSupply, t.decimals, 4) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">{formatNumber(t.transferCount)}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      {timeAgo(t.lastTransferAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between pt-3 text-xs font-mono text-muted-foreground">
              <span>
                Page {page} of {q.data?.totalPages ?? 1}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-2 py-1 rounded-sm border border-border disabled:opacity-30 hover:text-primary"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  disabled={page >= (q.data?.totalPages ?? 1)}
                  onClick={() => setPage(page + 1)}
                  className="px-2 py-1 rounded-sm border border-border disabled:opacity-30 hover:text-primary"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
