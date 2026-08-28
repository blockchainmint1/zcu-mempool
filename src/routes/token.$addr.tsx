import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { zcu } from "@/lib/zcu/api";
import {
  formatNumber,
  shortAddr,
  shortHash,
  timeAgo,
  formatTokenAmount,
} from "@/lib/zcu/format";
import { StatTile } from "@/components/explorer/StatTile";

export const Route = createFileRoute("/token/$addr")({
  head: ({ params }) => {
    const title = `Token ${shortAddr(params.addr)} — ZCU Explorer`;
    const desc = `Holders, supply and transfer history for token contract ${params.addr} on the Zero Chill Units chain.`;
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
  component: TokenPage,
});

function TokenPage() {
  const { addr } = Route.useParams();
  const [page, setPage] = useState(1);

  const q = useQuery({
    queryKey: ["zcu", "token", addr, page],
    queryFn: () => zcu.token(addr, page, 25),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const contract = useQuery({
    queryKey: ["zcu", "contract", addr],
    queryFn: () => zcu.contract(addr),
    retry: 1,
  });

  const t = q.data?.token;
  const decimals = t?.decimals ?? null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {t?.type === "erc721" ? "ERC-721 collection" : "ERC-20 token"}
        </span>
        <h1 className="font-display text-2xl">
          {t?.name || t?.symbol || "Token"}{" "}
          {t?.symbol && t?.name && (
            <span className="text-muted-foreground text-lg">({t.symbol})</span>
          )}
        </h1>
        <p className="font-mono text-xs break-all text-muted-foreground">
          <Link to="/address/$addr" params={{ addr }} className="hover:text-primary">
            {addr}
          </Link>
        </p>
      </header>

      {q.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
          Token data unavailable — the indexer is not responding.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Total supply"
          value={t?.totalSupply ? formatTokenAmount(t.totalSupply, decimals, 4) : "—"}
        />
        <StatTile label="Holders" value={formatNumber(t?.holderCount ?? 0)} />
        <StatTile label="Transfers" value={formatNumber(t?.transferCount ?? 0)} />
        <StatTile label="Decimals" value={decimals == null ? "—" : String(decimals)} />
      </div>

      {/* Verification banner: this is the Blockscout feature people miss most. */}
      <section className="rounded-md surface-2 border border-border p-4 text-xs font-mono flex flex-wrap items-center gap-3 justify-between">
        {contract.data?.verified ? (
          <span className="text-primary">
            ✓ Source verified — {contract.data.name} ({contract.data.compilerVersion})
          </span>
        ) : (
          <span className="text-muted-foreground">Source code not verified.</span>
        )}
        <Link
          to="/verify"
          search={{ address: addr }}
          className="px-3 py-1 rounded-sm border border-border hover:text-primary"
        >
          {contract.data?.verified ? "View / re-verify" : "Verify source"}
        </Link>
      </section>

      <section className="rounded-md surface-2 border border-border p-4 md:p-6 space-y-3">
        <h2 className="font-display text-lg">Top holders</h2>
        {!q.data?.holders || q.data.holders.holders.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No holders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-3 font-normal">#</th>
                  <th className="text-left py-2 pr-3 font-normal">Address</th>
                  <th className="text-right py-2 pr-3 font-normal">Balance</th>
                  <th className="text-right py-2 font-normal">Share</th>
                </tr>
              </thead>
              <tbody>
                {q.data.holders.holders.map((h) => (
                  <tr key={h.address} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2 pr-3 text-muted-foreground">{h.rank}</td>
                    <td className="py-2 pr-3">
                      <Link
                        to="/address/$addr"
                        params={{ addr: h.address }}
                        className="text-primary hover:underline"
                      >
                        {shortAddr(h.address)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {formatTokenAmount(h.balance, decimals, 6)}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {(h.shareBps / 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {q.data.holders.truncated && (
              <p className="pt-2 text-[10px] text-muted-foreground">
                Holder set computed from the most recent transfers and may be partial.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-md surface-2 border border-border p-4 md:p-6 space-y-3">
        <h2 className="font-display text-lg">Transfers</h2>
        {!q.data?.transfers || q.data.transfers.transfers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No transfers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-3 font-normal">Tx</th>
                  <th className="text-left py-2 pr-3 font-normal">From</th>
                  <th className="text-left py-2 pr-3 font-normal">To</th>
                  <th className="text-right py-2 pr-3 font-normal">
                    {t?.type === "erc721" ? "Token ID" : "Amount"}
                  </th>
                  <th className="text-right py-2 font-normal">Age</th>
                </tr>
              </thead>
              <tbody>
                {q.data.transfers.transfers.map((x) => (
                  <tr
                    key={`${x.txHash}-${x.logIndex}`}
                    className="border-b border-border/40 hover:bg-muted/30"
                  >
                    <td className="py-2 pr-3">
                      <Link
                        to="/tx/$hash"
                        params={{ hash: x.txHash }}
                        className="text-primary hover:underline"
                      >
                        {shortHash(x.txHash, 6, 6)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{x.from ? shortAddr(x.from) : "—"}</td>
                    <td className="py-2 pr-3">{x.to ? shortAddr(x.to) : "—"}</td>
                    <td className="py-2 pr-3 text-right">
                      {x.tokenId
                        ? `#${x.tokenId}`
                        : x.value
                          ? formatTokenAmount(x.value, decimals, 6)
                          : "—"}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {timeAgo(x.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between pt-3 text-xs font-mono text-muted-foreground">
              <span>
                Page {page} of {q.data.transfers.totalPages}
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
                  disabled={page >= q.data.transfers.totalPages}
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
