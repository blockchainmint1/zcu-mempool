import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Terms of Use — ZCU Explorer";
const DESC =
  "Terms of use for the Zero Chill Units block explorer: informational data, no warranty, no financial advice, fair use of the public API.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <h1 className="font-display text-4xl">Terms of Use</h1>
      <p className="text-xs font-mono text-muted-foreground">Last updated: 2026</p>

      <Section title="What this service is">
        This site is a read-only block explorer for the Zero Chill Units
        blockchain. It displays public data that already exists on a public
        ledger. It does not custody funds, hold balances, or transact on your
        behalf.
      </Section>

      <Section title="No warranty">
        The data is provided "as is", without warranty of any kind. Blockchain
        nodes can lag, reorganise, or return incomplete results. Always verify
        anything important against your own node before relying on it.
      </Section>

      <Section title="Not financial advice">
        Nothing here is investment, tax, or legal advice. Balances, values, and
        mining statistics are informational only.
      </Section>

      <Section title="Fair use of the API">
        The public API is free and requires no key. Cache responses, avoid
        hammering endpoints in tight loops, and run your own node if you need
        sustained high-volume access — instructions are at{" "}
        <a href="https://zerochill.com/build" target="_blank" rel="noreferrer" className="text-primary hover:underline">
          zerochill.com/build
        </a>
        . Abusive traffic may be rate-limited or blocked.
      </Section>

      <Section title="Changes">
        These terms may be updated as the explorer evolves. Continued use
        constitutes acceptance of the current version.
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
    </section>
  );
}
