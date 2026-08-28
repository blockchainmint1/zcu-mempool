import { createFileRoute } from "@tanstack/react-router";

const TITLE = "Privacy — ZCU Explorer";
const DESC =
  "Privacy policy for the Zero Chill Units block explorer: no accounts, no tracking cookies, minimal logs, and what your searches reveal.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <h1 className="font-display text-4xl">Privacy</h1>
      <p className="text-xs font-mono text-muted-foreground">Last updated: 2026</p>

      <Section title="No accounts">
        There is no sign-up, no login, and no user profile. We do not ask for
        your name, email, or wallet.
      </Section>

      <Section title="What is logged">
        Standard web server request logs (IP address, timestamp, requested
        path, user agent) are retained briefly for abuse prevention and
        capacity planning. We do not sell or share them.
      </Section>

      <Section title="No tracking cookies">
        The explorer sets no advertising or cross-site tracking cookies and
        embeds no third-party trackers.
      </Section>

      <Section title="What your searches reveal">
        Looking up an address on any hosted explorer links that address to your
        IP in the server's request log. If that matters for your threat model,
        run your own node and point a local explorer at it — see{" "}
        <a href="https://zerochill.com/build" target="_blank" rel="noreferrer" className="text-primary hover:underline">
          zerochill.com/build
        </a>
        .
      </Section>

      <Section title="On-chain data is public">
        Everything displayed here is already public on the Zero Chill Units
        blockchain. We cannot delete, edit, or hide on-chain records.
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
