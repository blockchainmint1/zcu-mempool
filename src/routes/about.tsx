import { createFileRoute, Link } from "@tanstack/react-router";
import { ZCU_NETWORK } from "@/lib/zcu/network";

const TITLE = "About — ZCU Explorer";
const DESC =
  "What the Zero Chill Units explorer is, which node it reads from, and how the chain works: Scrypt PoW with AuxPoW merged mining on an EVM.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="font-display text-4xl mb-4">About this explorer</h1>
      <p className="text-muted-foreground leading-relaxed">
        A real-time block explorer for{" "}
        <a href="https://zerochill.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">
          Zero Chill Units
        </a>{" "}
        — an EVM chain secured by Scrypt proof-of-work with AuxPoW merged
        mining. Everything you see is read live from a Zero Chill node; nothing
        is cached longer than a few seconds.
      </p>

      <h2 className="font-display text-2xl mt-8 mb-3">Chain parameters</h2>
      <div className="rounded-md surface-2 border border-border divide-y divide-border font-mono text-xs">
        {[
          ["Network", ZCU_NETWORK.networkName],
          ["Ticker", ZCU_NETWORK.ticker],
          ["Chain ID", `${ZCU_NETWORK.chainId} (${ZCU_NETWORK.chainIdHex})`],
          ["Decimals", String(ZCU_NETWORK.decimals)],
          ["Consensus", ZCU_NETWORK.consensus],
          ["Client", ZCU_NETWORK.client],
          ["Genesis", ZCU_NETWORK.genesisHash],
          ["P2P port", String(ZCU_NETWORK.p2pPort)],
          ["Public RPC", "https://node-zcu.honest.money"],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col sm:flex-row sm:justify-between gap-1 px-3 py-2">
            <span className="text-muted-foreground">{k}</span>
            <span className="text-foreground break-all sm:text-right">{v}</span>
          </div>
        ))}
      </div>

      <h2 className="font-display text-2xl mt-8 mb-3">Where the data comes from</h2>
      <p className="text-muted-foreground leading-relaxed">
        This site talks to a go-ethereum node over JSON-RPC and re-serves the
        results through its own{" "}
        <Link to="/docs" className="text-primary hover:underline">public API</Link>.
        Blocks, transactions, receipts, balances, the txpool and mining stats
        are all live reads — there is no third party in the path.
      </p>

      <h2 className="font-display text-2xl mt-8 mb-3">What is not here yet</h2>
      <p className="text-muted-foreground leading-relaxed">
        Per-address transaction history, token transfers and a richlist all
        require indexing every block's logs into a database. Live state
        (balances, nonces, contract code) is exact today; historical queries
        arrive with the indexer.
      </p>

      <h2 className="font-display text-2xl mt-8 mb-3">Run a node</h2>
      <p className="text-muted-foreground leading-relaxed">
        Full setup instructions, genesis file and peer list live at{" "}
        <a href={ZCU_NETWORK.buildDocs} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          zerochill.com/build
        </a>
        . Source for the node client is at{" "}
        <a href={ZCU_NETWORK.sourceRepo} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          the zcu-geth repository
        </a>
        .
      </p>
    </div>
  );
}
