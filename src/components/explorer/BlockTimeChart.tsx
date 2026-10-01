import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { zcu } from "@/lib/zcu/api";
import { Button } from "@/components/ui/button";

type Window = "blocks" | "1d" | "7d" | "30d";

const WINDOWS: { value: Window; label: string }[] = [
  { value: "blocks", label: "Per block" },
  { value: "1d", label: "1D" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
];

const WINDOW_LABEL: Record<Window, string> = {
  blocks: "recent blocks",
  "1d": "24h",
  "7d": "7d",
  "30d": "30d",
};

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total >= 3600) {
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return `${hours}:${String(minutes).padStart(2, "0")}h`;
  }
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function BlockTimeChart() {
  const [window, setWindow] = useState<Window>("7d");
  const query = useQuery({
    queryKey: ["zcu", "block-times", window],
    queryFn: () => zcu.blockTimes(window),
    refetchInterval: 5 * 60_000,
    staleTime: 5 * 60_000,
    retry: 2,
  });
  const target = query.data?.targetBlockTimeSec ?? 60;
  const slowThreshold = target * 2.5;
  const formatTick = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return window === "blocks" || window === "1d"
      ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <section className="rounded-md surface-2 border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-5 bg-primary" />
          <h2 className="font-display text-sm uppercase tracking-widest text-foreground">
            Block time
          </h2>
        </div>
        <div className="inline-flex rounded-sm border border-border bg-surface p-0.5">
          {WINDOWS.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={window === item.value ? "default" : "ghost"}
              onClick={() => setWindow(item.value)}
              className="h-7 rounded-sm px-3 font-mono text-[11px] uppercase"
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border">
        <Metric label="Avg block time" value={query.data ? formatDuration(query.data.avgBlockTimeSec) : "—"} accent />
        <Metric label="Target time" value={formatDuration(target)} />
        <Metric label={`Slowest (${WINDOW_LABEL[window]})`} value={query.data ? formatDuration(query.data.slowestSec) : "—"} warning />
        <Metric label={`Fastest (${WINDOW_LABEL[window]})`} value={query.data ? formatDuration(query.data.fastestSec) : "—"} accent />
      </div>

      {query.isLoading && (
        <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
          Measuring block intervals…
        </div>
      )}
      {query.isError && (
        <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">
          Couldn&apos;t compute block times right now.
        </div>
      )}
      {query.data && query.data.series.length > 0 && (
        <div className="h-56 px-2 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={query.data.series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={formatTick} stroke="var(--color-muted-foreground)" fontSize={10} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={10} tickFormatter={formatDuration} width={48} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
                labelFormatter={(label) => new Date(Number(label) * 1000).toLocaleString()}
                formatter={(value: number) => [formatDuration(value), "avg block time"]}
              />
              <ReferenceLine
                y={target}
                stroke="var(--color-muted-foreground)"
                strokeDasharray="4 4"
                label={{
                  value: `target ${formatDuration(target)}`,
                  position: "insideTopRight",
                  fill: "var(--color-muted-foreground)",
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                }}
              />
              <Bar dataKey="avg" radius={[2, 2, 0, 0]}>
                {query.data.series.map((point, index) => (
                  <Cell
                    key={`${point.timestamp}-${index}`}
                    fill={point.avg > slowThreshold ? "var(--color-primary)" : "var(--color-accent)"}
                    fillOpacity={point.avg > slowThreshold ? 0.85 : 0.55}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="px-4 py-2 text-[10px] font-mono text-muted-foreground/70 border-t border-border">
        {query.data
          ? `${query.data.sampledIntervals} intervals sampled · red bars = slower than ${formatDuration(slowThreshold)} · cached 5 min`
          : "computed from ZCU block timestamps"}
      </p>
    </section>
  );
}

function Metric({
  label,
  value,
  accent = false,
  warning = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warning?: boolean;
}) {
  const valueClass = warning ? "text-primary" : accent ? "text-accent" : "text-foreground";
  return (
    <div className="p-4 border-r border-border [&:nth-child(even)]:border-r-0 md:[&:nth-child(even)]:border-r md:last:border-r-0">
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className={`text-xl font-mono font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}