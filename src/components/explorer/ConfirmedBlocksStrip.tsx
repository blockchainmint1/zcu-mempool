import { Link } from "@tanstack/react-router";
import { timeAgo, formatGwei, gasColorVar, weiToGwei, formatZcu } from "@/lib/zcu/format";
import type { ZcuBlock } from "@/lib/zcu/types";

interface Props {
  blocks: ZcuBlock[];
  emptyLabel?: string;
}

/**
 * Confirmed (mined) blocks — flat rectangular tiles, newest on the left.
 * Tile colour tracks the block's base fee (or, absent one, its gas
 * utilisation) so a congested chain visibly warms up.
 */
export function ConfirmedBlocksStrip({ blocks, emptyLabel = "Waiting for blocks…" }: Props) {
  if (!blocks.length) {
    return (
      <div className="rounded-md surface-2 border border-border px-4 py-8 text-sm text-muted-foreground text-center">
        {emptyLabel}
      </div>
    );
  }
  const items = [...blocks].sort((a, b) => b.number - a.number).slice(0, 6);
  return (
    <div className="flex items-end gap-3 overflow-x-auto pb-2">
      {items.map((b) => {
        const util = b.gasLimit > 0 ? (b.gasUsed / b.gasLimit) * 100 : 0;
        const gwei = b.baseFeePerGas ? weiToGwei(b.baseFeePerGas) : util / 10;
        const color = gasColorVar(gwei);
        return (
          <Link
            key={b.hash}
            to="/block/$hash"
            params={{ hash: b.hash }}
            className="group flex flex-col items-center flex-shrink-0"
          >
            <div
              className="relative w-32 h-32 rounded-md border border-border overflow-hidden transition-transform group-hover:-translate-y-1 group-hover:shadow-lg"
              style={{
                background: `linear-gradient(180deg, color-mix(in oklab, ${color} 85%, transparent), color-mix(in oklab, ${color} 55%, transparent))`,
                boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 60%, transparent), 0 8px 20px -10px ${color}`,
              }}
            >
              <div className="relative h-full flex flex-col items-center justify-center text-center px-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                <div className="font-display text-xl font-bold leading-none">
                  {b.number.toLocaleString()}
                </div>
                <div className="text-[9px] uppercase tracking-widest opacity-80 mt-1">height</div>
                <div className="text-[10px] font-semibold mt-2 opacity-95">
                  {b.baseFeePerGas ? formatGwei(b.baseFeePerGas) : `${util.toFixed(0)}% gas`}
                </div>
                {b.feesWei && b.feesWei !== "0" && (
                  <div className="text-[10px] mt-2 opacity-90">{formatZcu(b.feesWei, " ZCU", 4)}</div>
                )}
                <div className="text-[9px] mt-1 opacity-75">
                  {b.txCount} tx · {Math.round(b.size / 1024)} kB
                </div>
              </div>
            </div>
            <div
              className="mt-2 text-[10px] font-mono text-muted-foreground group-hover:text-primary transition-colors truncate max-w-[140px]"
              title={new Date(b.timestamp * 1000).toLocaleString()}
            >
              {timeAgo(b.timestamp)}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
