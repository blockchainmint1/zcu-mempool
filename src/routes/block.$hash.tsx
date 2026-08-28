import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { zcu } from "@/lib/zcu/api";
import {
  formatNumber,
  formatGwei,
  formatGas,
  formatZcu,
  formatDifficulty,
  formatBytes,
  shortAddr,
  timeAgo,
  formatDateTime,
} from "@/lib/zcu/format";
import { TxListRow } from "@/components/explorer/TxListRow";

export const Route = createFileRoute("/block/$hash")({
  head: ({ params }) => {
    const title = `Block ${params.hash.slice(0, 12)} — ZCU Explorer`;
    const desc = `Zero Chill Units block ${params.hash}: miner, gas usage, base fee, difficulty and full transaction list.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: BlockPage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground break-all sm:text-right">{value}</span>
    </div>
  );
}

function BlockPage() {
  const { hash } = Route.useParams();
  const q = useQuery({
    queryKey: ["zcu", "block", hash],
    queryFn: () => zcu.blockTxs(hash),
    staleTime: 60_000,
    retry: 1,
  });

  if (q.isLoading) {
    return <div className="max-w-5xl mx-auto px-4 py-16 text-sm text-muted-foreground">Loading block…</div>;
  }
  if (q.isError || !q.data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 space-y-3">
        <h1 className="font-display text-xl">Block not found</h1>
        <p className="text-sm text-muted-foreground font-mono break-all">{hash}</p>
        <Link to="/blocks" className="text-primary text-sm hover:underline">← All blocks</Link>
      </div>
    );
  }

  const { block: b, txs } = q.data;
  const util = b.gasLimit > 0 ? (b.gasUsed / b.gasLimit) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Block</div>
        <h1 className="font-display text-3xl tracking-wide">{formatNumber(b.number)}</h1>
        <div className="font-mono text-xs text-muted-foreground break-all">{b.hash}</div>
        <div className="flex gap-3 text-xs font-mono pt-1">
          {b.number > 0 && (
            <Link to="/block/$hash" params={{ hash: String(b.number - 1) }} className="text-primary hover:underline">
              ← prev
            </Link>
          )}
          <Link to="/block/$hash" params={{ hash: String(b.number + 1) }} className="text-primary hover:underline">
            next →
          </Link>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-md surface-2 border border-border divide-y divide-border font-mono text-xs">
          <Row label="Timestamp" value={`${formatDateTime(b.timestamp)} (${timeAgo(b.timestamp)})`} />
          <Row
            label="Miner"
            value={
              <Link to="/address/$addr" params={{ addr: b.miner }} className="text-primary hover:underline">
                {b.miner}
              </Link>
            }
          />
          <Row label="Transactions" value={formatNumber(b.txCount)} />
          <Row label="Size" value={formatBytes(b.size)} />
          <Row label="Difficulty" value={formatDifficulty(b.difficulty)} />
          <Row label="Total difficulty" value={formatDifficulty(b.totalDifficulty)} />
        </div>
        <div className="rounded-md surface-2 border border-border divide-y divide-border font-mono text-xs">
          <Row label="Gas used" value={`${formatGas(b.gasUsed)} (${util.toFixed(1)}%)`} />
          <Row label="Gas limit" value={formatGas(b.gasLimit)} />
          <Row label="Base fee" value={b.baseFeePerGas ? formatGwei(b.baseFeePerGas) : "—"} />
          <Row label="Fees collected" value={b.feesWei ? formatZcu(b.feesWei) : "—"} />
          <Row label="Nonce" value={b.nonce} />
          <Row
            label="Parent"
            value={
              <Link to="/block/$hash" params={{ hash: b.parentHash }} className="text-primary hover:underline">
                {shortAddr(b.parentHash)}
              </Link>
            }
          />
        </div>
      </div>

      <div className="rounded-md surface-2 border border-border px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">
        <span className="uppercase tracking-widest mr-2">extraData</span>
        {b.extraData}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Transactions ({txs.length})
        </h2>
        {txs.length === 0 ? (
          <div className="rounded-md surface-2 border border-border px-4 py-8 text-sm text-muted-foreground text-center">
            This block is empty.
          </div>
        ) : (
          <div className="space-y-2">
            {txs.map((t) => <TxListRow key={t.hash} tx={t} />)}
          </div>
        )}
      </section>
    </div>
  );
}
