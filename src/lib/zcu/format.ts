import { ZCU_NETWORK } from "./network";

const WEI_PER_ZCU = 10n ** 18n;
const WEI_PER_GWEI = 10n ** 9n;

function toBig(v: string | bigint | number): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  if (!v) return 0n;
  return v.startsWith("0x") ? BigInt(v) : BigInt(v);
}

/**
 * Wei → ZCU string. Trims trailing zeros and caps the fraction at
 * `maxFrac` digits so a table cell never shows all 18 decimals.
 */
export function weiToZcu(wei: string | bigint, maxFrac = 6): string {
  const v = toBig(wei);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / WEI_PER_ZCU;
  const frac = abs % WEI_PER_ZCU;
  const sign = neg ? "-" : "";
  if (frac === 0n) return `${sign}${whole.toLocaleString()}`;

  let fracStr = frac.toString().padStart(18, "0").slice(0, maxFrac).replace(/0+$/, "");
  // A tiny non-zero amount would round to "0" — show that it is dust instead.
  if (fracStr === "") return `${sign}0.${"0".repeat(maxFrac - 1)}1`.replace(/1$/, "…");
  return `${sign}${whole.toLocaleString()}.${fracStr}`;
}

export function formatZcu(wei: string | bigint, suffix = " ZCU", maxFrac = 6): string {
  return `${weiToZcu(wei, maxFrac)}${suffix}`;
}

/** Wei-per-gas → gwei, the unit every EVM user reads gas prices in. */
export function weiToGwei(wei: string | bigint): number {
  const v = toBig(wei);
  // Gwei values are small enough for a float; keep 4 decimals of precision.
  return Number((v * 10_000n) / WEI_PER_GWEI) / 10_000;
}

export function formatGwei(wei: string | bigint, digits = 2): string {
  const g = weiToGwei(wei);
  if (g === 0) return "0 gwei";
  if (g < 0.01) return `${g.toFixed(4)} gwei`;
  return `${g.toFixed(digits)} gwei`;
}

export function formatGas(n: number): string {
  if (n < 1_000) return n.toLocaleString();
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function formatDifficulty(d: string | number): string {
  const n = typeof d === "string" ? Number(d) : d;
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n < 1_000_000) return n.toLocaleString();
  return n.toExponential(3);
}

/** H/s → human hashrate. Scrypt networks sit in the MH/s–GH/s range. */
export function formatHashrate(hs: number): string {
  if (!Number.isFinite(hs) || hs <= 0) return "—";
  const units = ["H/s", "kH/s", "MH/s", "GH/s", "TH/s", "PH/s"];
  let i = 0;
  let v = hs;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toFixed(2)} ${units[i]}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function shortHash(h: string, head = 8, tail = 8): string {
  if (!h) return "";
  if (h.length <= head + tail + 3) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

/** 0x-address short form, the convention every EVM explorer uses. */
export function shortAddr(a: string): string {
  if (!a) return "";
  if (a.length <= 13) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function timeAgo(unixSec: number | undefined | null): string {
  if (!unixSec) return "—";
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - unixSec));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatDateTime(unixSec: number | undefined | null): string {
  if (!unixSec) return "—";
  return new Date(unixSec * 1000).toLocaleString();
}

/**
 * Gas-price buckets, reusing the six fee colours already defined in the
 * design system so the mempool visualisation keeps its existing look.
 */
export function gasBucket(gwei: number): 1 | 2 | 3 | 4 | 5 | 6 {
  if (gwei < 1) return 1;
  if (gwei < 5) return 2;
  if (gwei < 15) return 3;
  if (gwei < 40) return 4;
  if (gwei < 100) return 5;
  return 6;
}

export function gasColorVar(gwei: number): string {
  return `var(--color-fee-${gasBucket(gwei)})`;
}

// ---------- search ----------

export type SearchKind = "height" | "hash" | "address" | "unknown";

/**
 * Classify explorer search input. On an EVM chain a 32-byte hash is
 * ambiguous between a block hash and a tx hash, so "hash" means "try tx
 * first, then block" — the caller resolves it.
 */
export function classifySearch(raw: string): SearchKind {
  const s = raw.trim();
  if (!s) return "unknown";
  if (/^\d+$/.test(s)) return "height";
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return "hash";
  if (/^[0-9a-fA-F]{64}$/.test(s)) return "hash";
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return "address";
  return "unknown";
}

/** Normalize user-typed hashes/addresses to the 0x-prefixed lowercase form. */
export function normalizeHex(raw: string): string {
  const s = raw.trim().toLowerCase();
  return s.startsWith("0x") ? s : `0x${s}`;
}

export const NETWORK = ZCU_NETWORK;

/**
 * Token amount → human string, honouring the token's own decimals. Unknown
 * decimals means we cannot scale it, so the raw integer is shown as-is.
 */
export function formatTokenAmount(
  raw: string | bigint,
  decimals: number | null,
  maxFrac = 6,
): string {
  const v = toBig(raw);
  if (decimals == null) return v.toLocaleString();
  if (decimals === 0) return v.toLocaleString();

  const base = 10n ** BigInt(decimals);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / base;
  const frac = abs % base;
  const sign = neg ? "-" : "";
  if (frac === 0n) return `${sign}${whole.toLocaleString()}`;

  const fracStr = frac
    .toString()
    .padStart(decimals, "0")
    .slice(0, maxFrac)
    .replace(/0+$/, "");
  return fracStr ? `${sign}${whole.toLocaleString()}.${fracStr}` : `${sign}${whole.toLocaleString()}`;
}
