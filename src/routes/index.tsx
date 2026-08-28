import { createFileRoute, Link } from "@tanstack/react-router";
import { useZcuFeed } from "@/lib/zcu/feed";
import { ZCU_NETWORK } from "@/lib/zcu/network";
import {
  formatGwei,
  formatNumber,
  formatHashrate,
  formatDifficulty,
  timeAgo,
  formatGas,
} from "@/lib/zcu/format";
import { SearchBar } from "@/components/explorer/SearchBar";
import { StatTile } from "@/components/explorer/StatTile";
import { ConfirmedBlocksStrip } from "@/components/explorer/ConfirmedBlocksStrip";
import { MempoolBlocksViz } from "@/components/explorer/MempoolBlocksViz";
import { TxListRow } from "@/components/explorer/TxListRow";

const TITLE = "ZCU Explorer — Zero Chill Units Block Explorer";
const DESC =
  "Live Zero Chill Units (ZCU) block explorer: blocks, transactions, txpool, gas prices, Scrypt merged-mining stats and accounts on chain 90031273.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const feed = useZcuFeed();
  const { chain, blocks, mempool } = feed;

  const latest = blocks[0];
  const avgBlockTime =
    blocks.length > 1
      ? (blocks[0]!.timestamp - blocks[blocks.length - 1]!.timestamp) / (blocks.length - 1)
      : null;
  const hashrate =
    latest && avgBlockTime && avgBlockTime > 0
      ? Number(latest.difficulty) / avgBlockTime
      : null;

  const pendingTxs = (mempool?.txs ?? []).slice(0, 8);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      <section className="text-center space-y-4">
        <h1 className="font-display text-3xl sm:text-4xl tracking-wide">
          ZERO CHILL UNITS<span className="text-primary">.</span>EXPLORER
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Real-time view of the {ZCU_NETWORK.networkName} — chain ID{" "}
          <span className="font-mono text-foreground">{ZCU_NETWORK.chainId}</span>,{" "}
          {ZCU_NETWORK.consensus}.
        </p>
        <SearchBar variant="hero" />
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Block height"
          value={chain ? formatNumber(chain.tipHeight) : "—"}
          hint={latest ? timeAgo(latest.timestamp) : undefined}
        />
        <StatTile
          label="Gas price"
          value={chain ? formatGwei(chain.gasPriceWei) : "—"}
          hint="node suggestion"
        />
        <StatTile
          label="Txpool"
          value={mempool ? formatNumber(mempool.pending) : "—"}
          hint={mempool ? `${formatNumber(mempool.queued)} queued` : undefined}
        />
        <StatTile
          label="Hashrate"
          value={hashrate ? formatHashrate(hashrate) : "—"}
          hint={avgBlockTime ? `${avgBlockTime.toFixed(1)}s block time` : undefined}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Txpool by gas price
          </h2>
          <Link to="/mempool" className="text-xs text-primary hover:underline">
            View txpool →
          </Link>
        </div>
        <MempoolBlocksViz mempool={mempool} />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Latest blocks
          </h2>
          <Link to="/blocks" className="text-xs text-primary hover:underline">
            All blocks →
          </Link>
        </div>
        <ConfirmedBlocksStrip blocks={blocks} />
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Pending transactions
          </h2>
          {pendingTxs.length === 0 ? (
            <div className="rounded-md surface-2 border border-border px-4 py-8 text-sm text-muted-foreground text-center">
              Nothing pending right now.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingTxs.map((t) => (
                <TxListRow
                  key={t.hash}
                  tx={{
                    hash: t.hash,
                    blockNumber: null,
                    blockHash: null,
                    txIndex: null,
                    from: t.from,
                    to: t.to,
                    value: t.value,
                    gasPrice: t.gasPrice,
                    maxFeePerGas: null,
                    maxPriorityFeePerGas: null,
                    gas: t.gas,
                    gasUsed: null,
                    feeWei: null,
                    status: null,
                    nonce: t.nonce,
                    input: "0x",
                    methodId: null,
                    contractAddress: null,
                    timestamp: null,
                    logs: [],
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Chain at a glance
          </h2>
          <div className="rounded-md surface-2 border border-border divide-y divide-border font-mono text-xs">
            {[
              ["Network", ZCU_NETWORK.networkName],
              ["Chain ID", `${ZCU_NETWORK.chainId} (${ZCU_NETWORK.chainIdHex})`],
              ["Client", ZCU_NETWORK.client],
              ["Consensus", ZCU_NETWORK.consensus],
              ["Difficulty", latest ? formatDifficulty(latest.difficulty) : "—"],
              ["Gas limit", latest ? formatGas(latest.gasLimit) : "—"],
              ["Peers", chain ? String(chain.peerCount) : "—"],
              ["Syncing", chain ? (chain.syncing ? "yes" : "no") : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-3 py-2">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-foreground text-right break-all">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
