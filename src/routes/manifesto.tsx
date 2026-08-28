import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Manifesto — Zero Chill Units";
const DESC =
  "Why Zero Chill Units exists: verifiable work, open source, no premine games, and public infrastructure anyone can run.";

export const Route = createFileRoute("/manifesto")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: ManifestoPage,
});

const POINTS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Proof of work, not proof of promises",
    body: "ZCU is secured by Scrypt proof of work with AuxPoW merged mining. Blocks cost real energy and real hardware. Nobody votes coins into existence.",
  },
  {
    n: "02",
    title: "Run your own node",
    body: "A chain you cannot verify is a database with extra steps. The node software, genesis file, and chain parameters are public — you can be a first-class peer on a laptop.",
  },
  {
    n: "03",
    title: "Open infrastructure",
    body: "Explorers, RPC endpoints, and tooling should be replaceable. This explorer is a thin layer over standard JSON-RPC, so if it disappears tomorrow, nothing on-chain is lost.",
  },
  {
    n: "04",
    title: "Boring standards",
    body: "ZCU speaks plain Ethereum JSON-RPC and standard EVM semantics. Existing wallets, libraries, and contracts work without bespoke integrations.",
  },
  {
    n: "05",
    title: "Honest money",
    body: "Sound issuance, transparent rules, no privileged actors. ZCU is part of the honest.money ecosystem and holds itself to that standard.",
  },
];

function ManifestoPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Zero Chill Units
        </div>
        <h1 className="font-display text-4xl md:text-5xl">Manifesto</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          A short statement of what this chain is for, and what it refuses to
          become.
        </p>
      </header>

      <div className="space-y-5">
        {POINTS.map((p) => (
          <div key={p.n} className="surface-2 border border-border rounded-md p-4 flex gap-4">
            <div className="font-mono text-xs text-primary pt-1">{p.n}</div>
            <div className="space-y-1">
              <h2 className="font-display text-lg">{p.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Ready to participate? Node setup, genesis, and mining details are at{" "}
        <a href="https://zerochill.com/build" target="_blank" rel="noreferrer" className="text-primary hover:underline">
          zerochill.com/build
        </a>
        .
      </p>
    </div>
  );
}
