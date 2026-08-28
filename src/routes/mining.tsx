import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { zcu } from "@/lib/zcu/api";
import { StatTile } from "@/components/explorer/StatTile";
import { NetworkDifficultyChart } from "@/components/explorer/NetworkDifficultyChart";
import {
  formatNumber,
  formatHashrate,
  formatDifficulty,
  shortAddr,
  timeAgo,
} from "@/lib/zcu/format";
import { ZCU_NETWORK } from "@/lib/zcu/network";

const COLORS = [
  "var(--color-fee-6)", "var(--color-fee-5)", "var(--color-fee-4)",
  "var(--color-fee-3)", "var(--color-fee-2)", "var(--color-fee-1)",
  "var(--color-accent)", "var(--color-success)",
];

const TITLE = "Mining — ZCU Explorer";
const DESC =
  "Zero Chill Units mining: estimated network hashrate, Scrypt difficulty, block times and the distribution of blocks across coinbase addresses.";

export const Route = createFileRoute("/mining")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: MiningPage,
});

function MiningPage() {
  const hashQ = useQuery({
    queryKey: ["zcu", "hashrate", 200],
    queryFn: () => zcu.hashrate(200),
    refetchInterval: 60_000,
  });
  const minersQ = useQuery({
    queryKey: ["zcu", "miners", 200],
    queryFn: () => zcu.miners(200),
    refetchInterval: 120_000,
  });
  const blocksQ = useQuery({
    queryKey: ["zcu", "blocks", "mining"],
    queryFn: () => zcu.recentBlocks(10),
    refetchInterval: 20_000,
  });

  const h = hashQ.data;
  const miners = minersQ.data?.miners ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl tracking-wide">Mining</h1>
        <p className="text-sm text-muted-foreground">
          {ZCU_NETWORK.consensus}. Hashrate is estimated from difficulty and
          observed block spacing — there is no pool API to defer to.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Hashrate (est)" value={h ? formatHashrate(h.hashrate) : "—"} />
        <StatTile label="Difficulty" value={h ? formatDifficulty(h.difficulty) : "—"} />
        <StatTile
          label="Avg block time"
          value={h ? `${h.avgBlockTimeSec.toFixed(1)}s` : "—"}
          hint={`target ~${ZCU_NETWORK.blockTimeSec}s`}
        />
        <StatTile
          label="Distinct miners"
          value={miners.length ? formatNumber(miners.length) : "—"}
          hint={minersQ.data ? `last ${minersQ.data.blockCount} blocks` : undefined}
        />
      </div>

      <NetworkDifficultyChart />

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-md surface-2 border border-border p-4 space-y-3">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Block distribution
          </h2>
          {miners.length === 0 ? (
            <div className="h-64 grid place-items-center text-xs text-muted-foreground">
              {minersQ.isLoading ? "Reading coinbase addresses…" : "No data."}
            </div>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={miners.slice(0, 8)}
                      dataKey="blockCount"
                      nameKey="address"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {miners.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface-2)",
                        border: "1px solid var(--color-border)",
                        fontSize: 12,
                      }}
                      formatter={(v: number, n: string) => [`${v} blocks`, shortAddr(n)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1 font-mono text-[11px]">
                {miners.slice(0, 8).map((m, i) => (
                  <li key={m.address} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="inline-block size-2 rounded-sm flex-shrink-0"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <Link
                        to="/address/$addr"
                        params={{ addr: m.address }}
                        className="hover:text-primary truncate"
                        title={m.address}
                      >
                        {shortAddr(m.address)}
                      </Link>
                    </span>
                    <span className="text-muted-foreground flex-shrink-0">
                      {m.blockCount} · {(m.share * 100).toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-md surface-2 border border-border p-4 space-y-3">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Recent blocks
          </h2>
          <ul className="divide-y divide-border font-mono text-[11px]">
            {(blocksQ.data ?? []).map((b) => (
              <li key={b.hash} className="flex items-center justify-between gap-3 py-1.5">
                <Link
                  to="/block/$hash"
                  params={{ hash: b.hash }}
                  className="text-primary hover:underline flex-shrink-0"
                >
                  {formatNumber(b.number)}
                </Link>
                <Link
                  to="/address/$addr"
                  params={{ addr: b.miner }}
                  className="truncate hover:text-primary"
                  title={b.miner}
                >
                  {shortAddr(b.miner)}
                </Link>
                <span className="text-muted-foreground flex-shrink-0">{timeAgo(b.timestamp)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
