import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { zcu } from "@/lib/zcu/api";
import {
  formatNumber,
  formatGwei,
  formatGas,
  shortAddr,
  shortHash,
  timeAgo,
  formatZcu,
} from "@/lib/zcu/format";

const TITLE = "Blocks — ZCU Explorer";
const DESC =
  "Browse every block on the Zero Chill Units chain: height, miner, gas used, base fee, transaction count and timestamp.";

export const Route = createFileRoute("/blocks")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: BlocksPage,
});

const PAGE = 25;

function BlocksPage() {
  const [before, setBefore] = useState<number | undefined>(undefined);

  const q = useQuery({
    queryKey: ["zcu", "blocks", before ?? "tip"],
    queryFn: () => zcu.recentBlocks(PAGE, before),
    refetchInterval: before == null ? 15_000 : false,
    staleTime: 10_000,
  });

  const blocks = q.data ?? [];
  const oldest = blocks[blocks.length - 1];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl tracking-wide">Blocks</h1>
        <p className="text-sm text-muted-foreground">
          Newest first. Each row links to the full block with its transaction list.
        </p>
      </header>

      {q.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
          Could not reach the node.
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-border surface-2">
        <table className="w-full text-xs font-mono">
          <thead className="text-muted-foreground border-b border-border">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Height</th>
              <th className="px-3 py-2 font-medium">Age</th>
              <th className="px-3 py-2 font-medium">Txs</th>
              <th className="px-3 py-2 font-medium">Miner</th>
              <th className="px-3 py-2 font-medium">Gas used</th>
              <th className="px-3 py-2 font-medium">Base fee</th>
              <th className="px-3 py-2 font-medium">Rewardable fees</th>
              <th className="px-3 py-2 font-medium">Size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8} className="px-3 py-3 text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ))}
            {blocks.map((b) => {
              const util = b.gasLimit > 0 ? (b.gasUsed / b.gasLimit) * 100 : 0;
              return (
                <tr key={b.hash} className="hover:bg-surface-1/60">
                  <td className="px-3 py-2">
                    <Link
                      to="/block/$hash"
                      params={{ hash: b.hash }}
                      className="text-primary hover:underline"
                    >
                      {formatNumber(b.number)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground" title={new Date(b.timestamp * 1000).toLocaleString()}>
                    {timeAgo(b.timestamp)}
                  </td>
                  <td className="px-3 py-2">{b.txCount}</td>
                  <td className="px-3 py-2">
                    <Link
                      to="/address/$addr"
                      params={{ addr: b.miner }}
                      className="text-foreground hover:text-primary"
                      title={b.miner}
                    >
                      {shortAddr(b.miner)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {formatGas(b.gasUsed)}{" "}
                    <span className="text-muted-foreground">({util.toFixed(0)}%)</span>
                  </td>
                  <td className="px-3 py-2">{b.baseFeePerGas ? formatGwei(b.baseFeePerGas) : "—"}</td>
                  <td className="px-3 py-2">{b.feesWei ? formatZcu(b.feesWei, " ZCU", 5) : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{(b.size / 1024).toFixed(1)} kB</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setBefore(undefined)}
          disabled={before == null}
          className="px-3 py-1.5 rounded-sm border border-border text-xs font-mono disabled:opacity-40 hover:border-primary"
        >
          ← Newest
        </button>
        <div className="text-[11px] font-mono text-muted-foreground">
          {blocks.length > 0 && oldest
            ? `${formatNumber(oldest.number)} – ${formatNumber(blocks[0]!.number)}`
            : ""}
        </div>
        <button
          onClick={() => oldest && setBefore(oldest.number - 1)}
          disabled={!oldest || oldest.number === 0}
          className="px-3 py-1.5 rounded-sm border border-border text-xs font-mono disabled:opacity-40 hover:border-primary"
        >
          Older →
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground font-mono">
        Hashes shown short; hover a miner to see the full address.{" "}
        <span className="text-foreground">{shortHash("0x", 2, 0)}</span>
      </p>
    </div>
  );
}
