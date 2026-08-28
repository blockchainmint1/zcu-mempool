import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { zcu } from "@/lib/zcu/api";
import {
  formatZcu,
  formatNumber,
  formatBytes,
  shortHash,
  shortAddr,
  timeAgo,
} from "@/lib/zcu/format";
import { StatTile } from "@/components/explorer/StatTile";
import type { ZcuAddressTx, ZcuTokenTransfer } from "@/lib/zcu/types";

export const Route = createFileRoute("/address/$addr")({
  head: ({ params }) => {
    const title = `Address ${params.addr.slice(0, 12)} — ZCU Explorer`;
    const desc = `Zero Chill Units account ${params.addr}: ZCU balance, transaction history, token transfers and contract details.`;
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

const PAGE_SIZE = 25;

function Direction({ d }: { d: "in" | "out" }) {
  return (
    <span
      className={
        "inline-block rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-mono " +
        (d === "in"
          ? "bg-primary/15 text-primary"
          : "bg-muted text-muted-foreground")
      }
    >
      {d}
    </span>
  );
}

function Pager({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 text-xs font-mono text-muted-foreground">
      <span>
        Page {formatNumber(page)} of {formatNumber(totalPages)} · {formatNumber(total)} total
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="px-2 py-1 rounded-sm border border-border disabled:opacity-30 hover:text-primary"
        >
          ← Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="px-2 py-1 rounded-sm border border-border disabled:opacity-30 hover:text-primary"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function TxHistoryTable({ txs, self }: { txs: ZcuAddressTx[]; self: string }) {
  if (txs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No transactions for this address yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
            <th className="text-left py-2 pr-3 font-normal">Tx</th>
            <th className="text-left py-2 pr-3 font-normal">Block</th>
            <th className="text-left py-2 pr-3 font-normal">Age</th>
            <th className="text-left py-2 pr-3 font-normal"></th>
            <th className="text-left py-2 pr-3 font-normal">Counterparty</th>
            <th className="text-right py-2 pr-3 font-normal">Value</th>
            <th className="text-right py-2 font-normal">Fee</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((t) => {
            const counterparty = t.direction === "out" ? t.to : t.from;
            return (
              <tr key={t.hash} className="border-b border-border/40 hover:bg-muted/30">
                <td className="py-2 pr-3">
                  <Link
                    to="/tx/$txid"
                    params={{ txid: t.hash }}
                    className="text-primary hover:underline"
                  >
                    {shortHash(t.hash, 10, 6)}
                  </Link>
                  {t.status === 0 && (
                    <span className="ml-2 text-destructive text-[10px]">failed</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <Link
                    to="/block/$hash"
                    params={{ hash: String(t.blockNumber) }}
                    className="hover:text-primary"
                  >
                    {formatNumber(t.blockNumber)}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-muted-foreground">{timeAgo(t.timestamp)}</td>
                <td className="py-2 pr-3">
                  <Direction d={t.direction} />
                </td>
                <td className="py-2 pr-3">
                  {counterparty ? (
                    <Link
                      to="/address/$addr"
                      params={{ addr: counterparty }}
                      className="hover:text-primary"
                    >
                      {shortAddr(counterparty)}
                    </Link>
                  ) : t.contractAddress ? (
                    <span className="text-muted-foreground">contract created</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right">{formatZcu(t.value, "", 6)}</td>
                <td className="py-2 text-right text-muted-foreground">
                  {t.fee ? formatZcu(t.fee, "", 8) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="sr-only">{self}</p>
    </div>
  );
}

function TokenTable({ transfers }: { transfers: ZcuTokenTransfer[] }) {
  if (transfers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No token transfers for this address.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
            <th className="text-left py-2 pr-3 font-normal">Tx</th>
            <th className="text-left py-2 pr-3 font-normal">Age</th>
            <th className="text-left py-2 pr-3 font-normal"></th>
            <th className="text-left py-2 pr-3 font-normal">Token</th>
            <th className="text-left py-2 pr-3 font-normal">Counterparty</th>
            <th className="text-right py-2 font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t) => {
            const counterparty = t.direction === "out" ? t.to : t.from;
            return (
              <tr
                key={`${t.txHash}-${t.logIndex}`}
                className="border-b border-border/40 hover:bg-muted/30"
              >
                <td className="py-2 pr-3">
                  <Link
                    to="/tx/$txid"
                    params={{ txid: t.txHash }}
                    className="text-primary hover:underline"
                  >
                    {shortHash(t.txHash, 10, 6)}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-muted-foreground">{timeAgo(t.timestamp)}</td>
                <td className="py-2 pr-3">
                  <Direction d={t.direction} />
                </td>
                <td className="py-2 pr-3">
                  <Link
                    to="/address/$addr"
                    params={{ addr: t.token }}
                    className="hover:text-primary"
                  >
                    {shortAddr(t.token)}
                  </Link>
                </td>
                <td className="py-2 pr-3">
                  {counterparty ? (
                    <Link
                      to="/address/$addr"
                      params={{ addr: counterparty }}
                      className="hover:text-primary"
                    >
                      {shortAddr(counterparty)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 text-right">
                  {t.type === "erc721" ? `#${t.tokenId}` : formatNumber(Number(t.value ?? 0))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Verified-source panel. Only rendered for contracts, so the request is never
 * made for plain accounts.
 */
function ContractPanel({ addr }: { addr: string }) {
  const [showSource, setShowSource] = useState(false);

  const q = useQuery({
    queryKey: ["zcu", "contract", addr],
    queryFn: () => zcu.contract(addr),
    retry: 1,
  });

  const c = q.data;

  return (
    <section className="rounded-md surface-2 border border-border p-4 md:p-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg">Contract source</h2>
        <Link
          to="/verify"
          search={{ address: addr }}
          className="px-3 py-1 rounded-sm border border-border text-xs font-mono hover:text-primary"
        >
          {c?.verified ? "Re-verify" : "Verify source"}
        </Link>
      </div>

      {!c ? (
        <p className="text-xs font-mono text-muted-foreground">Checking verification status…</p>
      ) : !c.verified ? (
        <p className="text-xs font-mono text-muted-foreground">
          Source code has not been verified for this contract.
        </p>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Name</dt>
              <dd>{c.name}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Compiler</dt>
              <dd className="break-all">{c.compilerVersion}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Optimizer</dt>
              <dd>{c.optimization ? `On (${c.optimizationRuns})` : "Off"}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">License</dt>
              <dd>{c.license ?? "—"}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => setShowSource((v) => !v)}
            className="text-xs font-mono text-primary hover:underline"
          >
            {showSource ? "Hide source" : "Show source & ABI"}
          </button>

          {showSource && (
            <div className="space-y-3">
              <pre className="max-h-96 overflow-auto rounded-sm border border-border bg-background p-3 text-[11px] font-mono whitespace-pre">
                {c.sourceCode}
              </pre>
              <pre className="max-h-64 overflow-auto rounded-sm border border-border bg-background p-3 text-[11px] font-mono whitespace-pre">
                {JSON.stringify(c.abi, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AddressPage() {
  const { addr } = Route.useParams();
  const [tab, setTab] = useState<"txs" | "tokens">("txs");
  const [txPage, setTxPage] = useState(1);
  const [tokenPage, setTokenPage] = useState(1);

  const valid = /^0x[0-9a-fA-F]{40}$/.test(addr);

  const q = useQuery({
    queryKey: ["zcu", "address", addr, txPage],
    queryFn: () => zcu.address(addr, txPage, PAGE_SIZE),
    enabled: valid,
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const historyAvailable = q.data?.history.available ?? false;

  const tokensQ = useQuery({
    queryKey: ["zcu", "address-tokens", addr, tokenPage],
    queryFn: () => zcu.addressTokens(addr, tokenPage, PAGE_SIZE),
    // Only worth asking once we know the indexer is answering.
    enabled: valid && tab === "tokens" && historyAvailable,
    placeholderData: keepPreviousData,
    retry: 1,
  });

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
  const history = a?.history;

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Balance" value={a ? formatZcu(a.balance, " ZCU", 8) : "—"} />
        <StatTile
          label="Transactions sent"
          value={a ? formatNumber(a.nonce) : "—"}
          hint="account nonce"
        />
        <StatTile
          label="Total transactions"
          value={history?.available ? formatNumber(history.total) : "—"}
          hint={history?.available ? "sent + received" : "needs indexer"}
        />
        <StatTile
          label="Type"
          value={a ? (a.isContract ? "Contract" : "EOA") : "—"}
          hint={a?.isContract ? `${formatBytes(a.codeSize)} of code` : "externally owned"}
        />
      </div>

      {a?.isContract && <ContractPanel addr={addr} />}

      <section className="rounded-md surface-2 border border-border p-4 md:p-6 space-y-3">
        <div className="flex items-center gap-4 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setTab("txs")}
            className={
              "text-xs uppercase tracking-widest font-display " +
              (tab === "txs" ? "text-primary" : "text-muted-foreground hover:text-foreground")
            }
          >
            Transactions
          </button>
          <button
            type="button"
            onClick={() => setTab("tokens")}
            className={
              "text-xs uppercase tracking-widest font-display " +
              (tab === "tokens" ? "text-primary" : "text-muted-foreground hover:text-foreground")
            }
          >
            Token transfers
          </button>
        </div>

        {!q.isLoading && history && !history.available ? (
          <div className="py-6 space-y-2 text-sm text-muted-foreground">
            <p>
              Transaction history is temporarily unavailable — the indexer is
              not responding. Balance and nonce above are read live from the
              node and remain exact.
            </p>
            <div className="flex gap-3 pt-1 text-xs font-mono">
              <Link to="/blocks" className="text-primary hover:underline">Browse blocks →</Link>
              <Link to="/mempool" className="text-primary hover:underline">View txpool →</Link>
            </div>
          </div>
        ) : tab === "txs" ? (
          <>
            {q.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : (
              <TxHistoryTable txs={history?.transactions ?? []} self={addr} />
            )}
            {history && (
              <Pager
                page={history.page}
                totalPages={history.totalPages}
                total={history.total}
                onChange={setTxPage}
              />
            )}
          </>
        ) : (
          <>
            {tokensQ.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : (
              <TokenTable transfers={tokensQ.data?.transfers ?? []} />
            )}
            {tokensQ.data && (
              <Pager
                page={tokensQ.data.page}
                totalPages={tokensQ.data.totalPages}
                total={tokensQ.data.total}
                onChange={setTokenPage}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
