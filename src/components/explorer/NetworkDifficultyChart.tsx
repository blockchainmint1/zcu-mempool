import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { zcu } from "@/lib/zcu/api";
import { formatHashrate, formatDifficulty } from "@/lib/zcu/format";

const SAMPLES: { value: number; label: string }[] = [
  { value: 60, label: "60 blocks" },
  { value: 120, label: "120 blocks" },
  { value: 250, label: "250 blocks" },
  { value: 500, label: "500 blocks" },
];

/**
 * Hashrate / difficulty over the recent chain tip. ZCU has no historical
 * difficulty archive yet, so the window is expressed in blocks and derived
 * live from headers rather than from a stored time series.
 */
export function NetworkDifficultyChart() {
  const [sample, setSample] = useState(120);
  const q = useQuery({
    queryKey: ["zcu", "hashrate", sample],
    queryFn: () => zcu.hashrate(sample),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 2,
  });

  const data = q.data?.series ?? [];
  const xTickFormat = (t: number) =>
    new Date(t * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-md surface-2 border border-border p-4">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Network hashrate
        </h3>
        <div className="flex items-baseline gap-4 font-mono text-xs">
          {q.data && (
            <>
              <span title="Estimated from difficulty ÷ mean block time">
                <span className="text-muted-foreground">now </span>
                <span className="text-foreground">{formatHashrate(q.data.hashrate)}</span>
                <span className="text-muted-foreground"> (est)</span>
              </span>
              <span>
                <span className="text-muted-foreground">diff </span>
                <span className="text-foreground">{formatDifficulty(q.data.difficulty)}</span>
              </span>
              <span>
                <span className="text-muted-foreground">block </span>
                <span className="text-foreground">{q.data.avgBlockTimeSec.toFixed(1)}s</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="mb-3 inline-flex rounded-sm border border-border bg-surface-1 p-0.5 font-mono text-[11px]">
        {SAMPLES.map((w) => (
          <button
            key={w.value}
            onClick={() => setSample(w.value)}
            className={`px-2.5 py-1 rounded-sm transition-colors ${
              sample === w.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="h-64">
        {q.isLoading ? (
          <div className="h-full grid place-items-center text-xs text-muted-foreground">
            Loading chain headers…
          </div>
        ) : q.isError ? (
          <div className="h-full grid place-items-center text-xs text-destructive font-mono">
            Could not reach the node.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="hashFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={xTickFormat}
                stroke="var(--color-muted-foreground)"
                fontSize={10}
              />
              <YAxis
                dataKey="difficulty"
                stroke="var(--color-muted-foreground)"
                fontSize={10}
                tickFormatter={(v: number) => formatDifficulty(v)}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  fontSize: 12,
                }}
                labelFormatter={(t) => new Date(Number(t) * 1000).toLocaleString()}
                formatter={(v: number) => [formatDifficulty(v), "difficulty"]}
              />
              <Area
                type="monotone"
                dataKey="difficulty"
                stroke="var(--color-primary)"
                fill="url(#hashFill)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
