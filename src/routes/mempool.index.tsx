import { createFileRoute } from "@tanstack/react-router";
import { useZcuFeed } from "@/lib/zcu/feed";
import { MempoolBlocksViz } from "@/components/explorer/MempoolBlocksViz";
import { StatTile } from "@/components/explorer/StatTile";
import { TxListRow } from "@/components/explorer/TxListRow";
import { formatNumber, formatGwei, formatGas, weiToGwei } from "@/lib/zcu/format";
import type { ZcuPendingTx } from "@/lib/zcu/types";

const TITLE = "Txpool — Live pending ZCU transactions";
const DESC =
  "What is currently waiting in the Zero Chill Units txpool: pending and queued transactions, gas-price distribution and total gas demand.";

export const Route = createFileRoute("/mempool/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: MempoolPage,
});

function toTx(p: ZcuPendingTx) {
  return {
    hash: p.hash,
    blockNumber: null,
    blockHash: null,
    txIndex: null,
    from: p.from,
    to: p.to,
    value: p.value,
    gasPrice: p.gasPrice,
    maxFeePerGas: null,
    maxPriorityFeePerGas: null,
    gas: p.gas,
    gasUsed: null,
    feeWei: null,
    status: null,
    nonce: p.nonce,
    input: "0x",
    methodId: null,
    contractAddress: null,
    timestamp: null,
    logs: [],
  };
}

function MempoolPage() {
  const { mempool, chain } = useZcuFeed();

  const txs = mempool?.txs ?? [];
  const totalGas = txs.reduce((s, t) => s + t.gas, 0);
  const prices = txs.map((t) => weiToGwei(t.gasPrice)).sort((a, b) => a - b);
  const median = prices.length ? prices[Math.floor(prices.length / 2)]! : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-2xl tracking-wide">Txpool</h1>
        <p className="text-sm text-muted-foreground">
          Transactions the node has accepted but not yet mined. "Queued" means a
          nonce gap is holding the transaction back.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Pending" value={mempool ? formatNumber(mempool.pending) : "—"} hint="ready to mine" />
        <StatTile label="Queued" value={mempool ? formatNumber(mempool.queued) : "—"} hint="waiting on nonce" />
        <StatTile
          label="Median gas price"
          value={median ? `${median.toFixed(median < 1 ? 3 : 2)} gwei` : "—"}
          hint={chain ? `node suggests ${formatGwei(chain.gasPriceWei)}` : undefined}
        />
        <StatTile label="Gas demand" value={totalGas ? formatGas(totalGas) : "—"} hint="sum of gas limits" />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Gas-price distribution
        </h2>
        <MempoolBlocksViz mempool={mempool} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Pending transactions {txs.length > 0 && `(${txs.length})`}
        </h2>
        {txs.length === 0 ? (
          <div className="rounded-md surface-2 border border-border px-4 py-8 text-sm text-muted-foreground text-center">
            Nothing waiting — the chain is caught up.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-2">
            {txs.map((t) => <TxListRow key={t.hash} tx={toTx(t)} />)}
          </div>
        )}
      </section>
    </div>
  );
}
