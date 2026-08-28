import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { zcu } from "@/lib/zcu/api";
import { formatZcu, formatNumber, shortAddr } from "@/lib/zcu/format";
import { StatTile } from "@/components/explorer/StatTile";

export const Route = createFileRoute("/richlist")({
  head: () => {
    const title = "ZCU Richlist — Largest Zero Chill Units Holders";
    const desc =
      "Ranked list of the largest Zero Chill Units addresses by ZCU balance, with each holder's share of indexed supply and transaction count.";
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
  component: RichlistPage,
});

const PAGE_SIZE = 50;

function RichlistPage() {
  const [page, setPage] = useState(1);

  const q = useQuery({
    queryKey: ["zcu", "richlist", page],
    queryFn: () => zcu.richlist(PAGE_SIZE, (page - 1) * PAGE_SIZE),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const data = q.data;
  const holders = data?.holders ?? [];
  const contracts = holders.filter((h) => h.isContract).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Distribution
        </span>
        <h1 className="font-display text-2xl">Richlist</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Every address the indexer has seen, ranked by ZCU balance. Shares are
          measured against indexed supply — the sum of balances across known
          addresses — not a fixed max supply.
        </p>
      </header>

      {q.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
          The indexer is not responding. Rankings will return once it catches up.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatTile
          label="Indexed supply"
          value={data ? formatZcu(data.indexedSupply, " ZCU", 4) : "—"}
          hint="sum of known balances"
        />
        <StatTile label="Holders shown" value={formatNumber(holders.length)} />
        <StatTile label="Contracts in page" value={formatNumber(contracts)} />
      </div>

      <section className="rounded-md surface-2 border border-border p-4 md:p-6">
        {q.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : holders.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No holders indexed yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-right py-2 pr-4 font-normal">#</th>
                  <th className="text-left py-2 pr-3 font-normal">Address</th>
                  <th className="text-right py-2 pr-3 font-normal">Balance</th>
                  <th className="text-right py-2 pr-3 font-normal">Share</th>
                  <th className="text-right py-2 font-normal">Txs</th>
                </tr>
              </thead>
              <tbody>
                {holders.map((h) => (
                  <tr key={h.address} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2 pr-4 text-right text-muted-foreground">{h.rank}</td>
                    <td className="py-2 pr-3">
                      <Link
                        to="/address/$addr"
                        params={{ addr: h.address }}
                        className="text-primary hover:underline"
                      >
                        {shortAddr(h.address)}
                      </Link>
                      {h.isContract && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                          contract
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">{formatZcu(h.balance, "", 6)}</td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">
                      {(h.shareBps / 100).toFixed(2)}%
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {formatNumber(h.txCount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between pt-3 text-xs font-mono text-muted-foreground">
              <span>Ranks {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + holders.length}</span>
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
                  disabled={holders.length < PAGE_SIZE}
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
