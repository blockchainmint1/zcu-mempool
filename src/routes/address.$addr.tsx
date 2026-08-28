import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { zcu } from "@/lib/zcu/api";
import { formatZcu, formatNumber, formatBytes } from "@/lib/zcu/format";
import { StatTile } from "@/components/explorer/StatTile";

export const Route = createFileRoute("/address/$addr")({
  head: ({ params }) => {
    const title = `Address ${params.addr.slice(0, 12)} — ZCU Explorer`;
    const desc = `Zero Chill Units account ${params.addr}: ZCU balance, outbound transaction count and contract details.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: AddressPage,
});

function AddressPage() {
  const { addr } = Route.useParams();
  const q = useQuery({
    queryKey: ["zcu", "address", addr],
    queryFn: () => zcu.address(addr),
    refetchInterval: 15_000,
    retry: 1,
  });

  const valid = /^0x[0-9a-fA-F]{40}$/.test(addr);

  if (!valid) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 space-y-3">
        <h1 className="font-display text-xl">Not a valid address</h1>
        <p className="text-sm text-muted-foreground font-mono break-all">{addr}</p>
        <Link to="/" className="text-primary text-sm hover:underline">← Dashboard</Link>
      </div>
    );
  }

  const a = q.data;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {a?.isContract ? "Contract" : "Account"}
          </span>
        </div>
        <h1 className="font-mono text-sm break-all">{addr}</h1>
      </header>

      {q.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
          Could not reach the node.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatTile label="Balance" value={a ? formatZcu(a.balance, " ZCU", 8) : "—"} />
        <StatTile
          label="Transactions sent"
          value={a ? formatNumber(a.nonce) : "—"}
          hint="account nonce"
        />
        <StatTile
          label="Type"
          value={a ? (a.isContract ? "Contract" : "EOA") : "—"}
          hint={a?.isContract ? `${formatBytes(a.codeSize)} of code` : "externally owned"}
        />
      </div>

      <section className="rounded-md surface-2 border border-border p-6 text-sm text-muted-foreground space-y-2">
        <h2 className="font-display text-sm uppercase tracking-widest text-foreground">
          Transaction history
        </h2>
        <p>
          Full per-address history needs a log index over the whole chain. The
          explorer currently reads live state directly from the node, so
          balances and nonces are exact while history is not yet available
          here. Search a transaction hash or browse recent blocks in the
          meantime.
        </p>
        <div className="flex gap-3 pt-1 text-xs font-mono">
          <Link to="/blocks" className="text-primary hover:underline">Browse blocks →</Link>
          <Link to="/mempool" className="text-primary hover:underline">View txpool →</Link>
        </div>
      </section>
    </div>
  );
}
