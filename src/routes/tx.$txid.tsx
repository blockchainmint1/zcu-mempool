import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { zcu } from "@/lib/zcu/api";
import {
  formatNumber,
  formatGwei,
  formatGas,
  formatZcu,
  timeAgo,
  formatDateTime,
} from "@/lib/zcu/format";

export const Route = createFileRoute("/tx/$txid")({
  head: ({ params }) => {
    const title = `Transaction ${params.txid.slice(0, 12)} — ZCU Explorer`;
    const desc = `Zero Chill Units transaction ${params.txid}: sender, recipient, value, gas, status and event logs.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: TxPage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground break-all sm:text-right">{value}</span>
    </div>
  );
}

function TxPage() {
  const { txid } = Route.useParams();
  const q = useQuery({
    queryKey: ["zcu", "tx", txid],
    queryFn: () => zcu.tx(txid),
    // A pending tx flips to mined; poll until it settles.
    refetchInterval: (query) => (query.state.data?.status == null ? 5_000 : false),
    retry: 1,
  });

  if (q.isLoading) {
    return <div className="max-w-5xl mx-auto px-4 py-16 text-sm text-muted-foreground">Loading transaction…</div>;
  }
  if (q.isError || !q.data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 space-y-3">
        <h1 className="font-display text-xl">Transaction not found</h1>
        <p className="text-sm text-muted-foreground font-mono break-all">{txid}</p>
        <p className="text-xs text-muted-foreground">
          It may not have reached this node yet, or it was dropped from the txpool.
        </p>
        <Link to="/" className="text-primary text-sm hover:underline">← Dashboard</Link>
      </div>
    );
  }

  const t = q.data;
  const pending = t.status == null;
  const failed = t.status === 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Transaction
          </span>
          <span
            className={`px-2 py-0.5 rounded-sm text-[10px] uppercase font-semibold ${
              pending
                ? "bg-warning/20 text-warning"
                : failed
                  ? "bg-destructive/20 text-destructive"
                  : "bg-success/20 text-success"
            }`}
          >
            {pending ? "Pending" : failed ? "Failed" : "Success"}
          </span>
        </div>
        <h1 className="font-mono text-sm break-all">{t.hash}</h1>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-md surface-2 border border-border divide-y divide-border font-mono text-xs">
          <Row
            label="From"
            value={
              <Link to="/address/$addr" params={{ addr: t.from }} className="text-primary hover:underline">
                {t.from}
              </Link>
            }
          />
          <Row
            label="To"
            value={
              t.to ? (
                <Link to="/address/$addr" params={{ addr: t.to }} className="text-primary hover:underline">
                  {t.to}
                </Link>
              ) : t.contractAddress ? (
                <span>
                  contract created:{" "}
                  <Link
                    to="/address/$addr"
                    params={{ addr: t.contractAddress }}
                    className="text-primary hover:underline"
                  >
                    {t.contractAddress}
                  </Link>
                </span>
              ) : (
                "contract creation"
              )
            }
          />
          <Row label="Value" value={formatZcu(t.value)} />
          <Row label="Nonce" value={t.nonce} />
          <Row
            label="Block"
            value={
              t.blockNumber != null ? (
                <Link
                  to="/block/$hash"
                  params={{ hash: String(t.blockNumber) }}
                  className="text-primary hover:underline"
                >
                  {formatNumber(t.blockNumber)}
                </Link>
              ) : (
                "pending"
              )
            }
          />
          <Row
            label="Timestamp"
            value={t.timestamp ? `${formatDateTime(t.timestamp)} (${timeAgo(t.timestamp)})` : "—"}
          />
        </div>

        <div className="rounded-md surface-2 border border-border divide-y divide-border font-mono text-xs">
          <Row label="Gas price" value={formatGwei(t.gasPrice)} />
          <Row label="Max fee" value={t.maxFeePerGas ? formatGwei(t.maxFeePerGas) : "—"} />
          <Row
            label="Priority fee"
            value={t.maxPriorityFeePerGas ? formatGwei(t.maxPriorityFeePerGas) : "—"}
          />
          <Row label="Gas limit" value={formatGas(t.gas)} />
          <Row
            label="Gas used"
            value={
              t.gasUsed != null
                ? `${formatGas(t.gasUsed)} (${((t.gasUsed / t.gas) * 100).toFixed(1)}%)`
                : "—"
            }
          />
          <Row label="Fee paid" value={t.feeWei ? formatZcu(t.feeWei) : "—"} />
          <Row label="Method" value={t.methodId ?? "plain transfer"} />
        </div>
      </div>

      {t.input && t.input !== "0x" && (
        <section className="space-y-2">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Input data
          </h2>
          <pre className="rounded-md surface-2 border border-border p-3 font-mono text-[11px] break-all whitespace-pre-wrap max-h-64 overflow-auto">
            {t.input}
          </pre>
        </section>
      )}

      {t.logs.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Event logs ({t.logs.length})
          </h2>
          <div className="space-y-2">
            {t.logs.map((l) => (
              <div key={l.logIndex} className="rounded-md surface-2 border border-border p-3 font-mono text-[11px] space-y-1">
                <div>
                  <span className="text-muted-foreground">address </span>
                  <Link to="/address/$addr" params={{ addr: l.address }} className="text-primary hover:underline">
                    {l.address}
                  </Link>
                </div>
                {l.topics.map((tp, i) => (
                  <div key={i} className="break-all">
                    <span className="text-muted-foreground">topic{i} </span>
                    {tp}
                  </div>
                ))}
                {l.data && l.data !== "0x" && (
                  <div className="break-all">
                    <span className="text-muted-foreground">data </span>
                    {l.data}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
