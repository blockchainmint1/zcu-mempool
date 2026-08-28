import { gasColorVar } from "@/lib/zcu/format";
import type { ZcuMempool } from "@/lib/zcu/types";

interface Props {
  mempool: ZcuMempool | null;
}

/**
 * Mempool gas-price histogram. An EVM txpool has no "projected blocks" the
 * way a vsize-limited UTXO mempool does, so instead of faking block
 * templates we show what actually determines inclusion order: the spread of
 * gas prices among pending transactions.
 */
export function MempoolBlocksViz({ mempool }: Props) {
  const buckets = mempool?.buckets ?? [];
  const total = buckets.reduce((s, b) => s + b.count, 0);

  if (!mempool || total === 0) {
    return (
      <div className="rounded-md surface-2 border border-border px-4 py-8 text-sm text-muted-foreground text-center">
        Txpool is empty — nothing is waiting to be mined.
      </div>
    );
  }

  const max = Math.max(...buckets.map((b) => b.count));
  return (
    <div className="flex items-end gap-3 overflow-x-auto pb-2">
      {buckets.map((b, i) => {
        const mid = (b.minGwei + b.maxGwei) / 2;
        const color = gasColorVar(mid);
        // Fill height encodes how many txs sit in this price band.
        const filledPct = Math.max(6, (b.count / max) * 100);
        return (
          <div key={i} className="group flex flex-col items-center flex-shrink-0">
            <div
              className="relative w-32 h-32 rounded-md border border-border overflow-hidden"
              style={{
                background: `linear-gradient(180deg, color-mix(in oklab, ${color} 85%, transparent), color-mix(in oklab, ${color} 55%, transparent))`,
                boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 60%, transparent), 0 8px 20px -10px ${color}`,
              }}
            >
              <div
                className="absolute inset-x-0 top-0 bg-black/30"
                style={{ height: `${100 - filledPct}%` }}
              />
              <div className="relative h-full flex flex-col items-center justify-center text-center px-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                <div className="font-display text-2xl font-bold leading-none">
                  {b.count.toLocaleString()}
                </div>
                <div className="text-[9px] uppercase tracking-widest opacity-80 mt-1">
                  transactions
                </div>
                <div className="text-[10px] font-semibold mt-3 opacity-95">
                  {b.minGwei.toFixed(b.minGwei < 1 ? 3 : 1)} – {b.maxGwei.toFixed(b.maxGwei < 1 ? 3 : 1)} gwei
                </div>
                <div className="text-[9px] opacity-70 mt-1">
                  {(b.gasTotal / 1e6).toFixed(2)}M gas
                </div>
              </div>
            </div>
            <div className="mt-2 text-[10px] font-mono text-muted-foreground">
              {((b.count / total) * 100).toFixed(0)}% of pool
            </div>
          </div>
        );
      })}
    </div>
  );
}
