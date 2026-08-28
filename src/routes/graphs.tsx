import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { zcu } from "@/lib/zcu/api";
import { formatGas, weiToGwei, formatBytes } from "@/lib/zcu/format";

const WINDOWS: { value: number; label: string }[] = [
  { value: 100, label: "100 blocks" },
  { value: 250, label: "250 blocks" },
  { value: 500, label: "500 blocks" },
];

const TITLE = "Graphs — ZCU Explorer";
const DESC =
  "Charts of recent Zero Chill Units chain activity: transactions per block, gas usage, base fee and block size.";

export const Route = createFileRoute("/graphs")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: GraphsPage,
});

const AXIS = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 10,
};
const TOOLTIP = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  fontSize: 12,
};

function GraphsPage() {
  const [count, setCount] = useState(250);

  const q = useQuery({
    queryKey: ["zcu", "graphs", count],
    // /blocks caps at 100 per request, so walk backwards a page at a time.
    queryFn: async () => {
      const pages = Math.ceil(count / 100);
      let before: number | undefined;
      const all = [];
      for (let i = 0; i < pages; i++) {
        const page = await zcu.recentBlocks(Math.min(100, count - all.length), before);
        if (page.length === 0) break;
        all.push(...page);
        before = page[page.length - 1]!.number - 1;
        if (before < 0) break;
      }
      return all.reverse();
    },
    staleTime: 60_000,
  });

  const data = (q.data ?? []).map((b) => ({
    height: b.number,
    txCount: b.txCount,
    gasUsed: b.gasUsed,
    utilization: b.gasLimit > 0 ? (b.gasUsed / b.gasLimit) * 100 : 0,
    baseFeeGwei: b.baseFeePerGas ? weiToGwei(b.baseFeePerGas) : 0,
    size: b.size,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl tracking-wide">Graphs</h1>
        <p className="text-sm text-muted-foreground">
          Derived live from block headers. Windows are measured in blocks
          because ZCU has no archived time-series yet.
        </p>
      </header>

      <div className="inline-flex rounded-sm border border-border bg-surface-1 p-0.5 font-mono text-[11px]">
        {WINDOWS.map((w) => (
          <button
            key={w.value}
            onClick={() => setCount(w.value)}
            className={`px-2.5 py-1 rounded-sm transition-colors ${
              count === w.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {q.isLoading && (
        <div className="rounded-md surface-2 border border-border px-4 py-16 text-center text-sm text-muted-foreground">
          Reading {count} blocks from the node…
        </div>
      )}

      {q.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
          Could not reach the node.
        </div>
      )}

      {!q.isLoading && !q.isError && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Panel title="Transactions per block">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="height" {...AXIS} />
              <YAxis {...AXIS} width={40} />
              <Tooltip contentStyle={TOOLTIP} />
              <Bar dataKey="txCount" fill="var(--color-primary)" isAnimationActive={false} />
            </BarChart>
          </Panel>

          <Panel title="Gas used">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="height" {...AXIS} />
              <YAxis {...AXIS} width={55} tickFormatter={(v: number) => formatGas(v)} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v: number) => [formatGas(v), "gas"]} />
              <Area
                type="monotone"
                dataKey="gasUsed"
                stroke="var(--color-accent)"
                fill="var(--color-accent)"
                fillOpacity={0.2}
                isAnimationActive={false}
              />
            </AreaChart>
          </Panel>

          <Panel title="Block utilisation (%)">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="height" {...AXIS} />
              <YAxis {...AXIS} width={40} domain={[0, 100]} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v: number) => [`${v.toFixed(1)}%`, "used"]} />
              <Area
                type="monotone"
                dataKey="utilization"
                stroke="var(--color-success)"
                fill="var(--color-success)"
                fillOpacity={0.2}
                isAnimationActive={false}
              />
            </AreaChart>
          </Panel>

          <Panel title="Block size">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="height" {...AXIS} />
              <YAxis {...AXIS} width={60} tickFormatter={(v: number) => formatBytes(v)} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v: number) => [formatBytes(v), "size"]} />
              <Area
                type="monotone"
                dataKey="size"
                stroke="var(--color-fee-4)"
                fill="var(--color-fee-4)"
                fillOpacity={0.2}
                isAnimationActive={false}
              />
            </AreaChart>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="rounded-md surface-2 border border-border p-4">
      <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
