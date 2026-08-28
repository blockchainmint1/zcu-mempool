import { Link } from "@tanstack/react-router";
import { shortHash, shortAddr, timeAgo, formatZcu, formatGwei } from "@/lib/zcu/format";
import type { ZcuTx } from "@/lib/zcu/types";

export function TxListRow({ tx }: { tx: ZcuTx }) {
  const isCreation = tx.to === null;
  const failed = tx.status === 0;
  return (
    <Link
      to="/tx/$txid"
      params={{ txid: tx.hash }}
      className="block surface-2 border border-border rounded-md px-3 py-2.5 hover:border-primary/60 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-xs truncate text-foreground">{shortHash(tx.hash, 14, 14)}</div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isCreation && (
            <span className="px-1.5 py-0.5 rounded-sm bg-accent/20 text-accent text-[10px] uppercase font-semibold">
              Deploy
            </span>
          )}
          {tx.methodId && !isCreation && (
            <span className="px-1.5 py-0.5 rounded-sm bg-accent/20 text-accent text-[10px] uppercase font-mono">
              {tx.methodId}
            </span>
          )}
          {failed && (
            <span className="px-1.5 py-0.5 rounded-sm bg-destructive/20 text-destructive text-[10px] uppercase font-semibold">
              Failed
            </span>
          )}
          <span className="font-mono text-xs text-foreground">{formatZcu(tx.value)}</span>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground font-mono gap-3">
        <span className="truncate">
          {shortAddr(tx.from)} → {isCreation ? "contract creation" : shortAddr(tx.to!)}
          {" · "}
          {formatGwei(tx.gasPrice)}
        </span>
        <span className="flex-shrink-0">
          {tx.timestamp ? timeAgo(tx.timestamp) : "pending"}
        </span>
      </div>
    </Link>
  );
}
