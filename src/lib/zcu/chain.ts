// RPC → DTO mapping layer. Everything the /api/v1/* handlers serve is
// assembled here so the HTTP routes stay thin and the shapes stay in one
// place.

import { rpc, rpcBatch, hexToNumber, hexToBigInt, toHexQuantity, RpcError } from "./rpc";
import type {
  ZcuAddress,
  ZcuBlock,
  ZcuChainInfo,
  ZcuHashrate,
  ZcuLog,
  ZcuMempool,
  ZcuMiner,
  ZcuPendingTx,
  ZcuTx,
} from "./types";

// ---------- raw geth shapes ----------

interface RawBlock {
  number: string;
  hash: string;
  parentHash: string;
  timestamp: string;
  miner: string;
  difficulty: string;
  totalDifficulty: string;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  size: string;
  nonce: string;
  extraData: string;
  stateRoot: string;
  transactions: string[] | RawTx[];
}

interface RawTx {
  hash: string;
  blockNumber: string | null;
  blockHash: string | null;
  transactionIndex: string | null;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gas: string;
  nonce: string;
  input: string;
}

interface RawReceipt {
  status?: string;
  gasUsed: string;
  effectiveGasPrice?: string;
  contractAddress: string | null;
  logs: Array<{ address: string; topics: string[]; data: string; logIndex: string }>;
}

const ZERO = "0";

// ---------- mappers ----------

function mapBlock(b: RawBlock): ZcuBlock {
  return {
    number: hexToNumber(b.number),
    hash: b.hash,
    parentHash: b.parentHash,
    timestamp: hexToNumber(b.timestamp),
    miner: b.miner,
    difficulty: hexToBigInt(b.difficulty).toString(),
    totalDifficulty: hexToBigInt(b.totalDifficulty).toString(),
    gasUsed: hexToNumber(b.gasUsed),
    gasLimit: hexToNumber(b.gasLimit),
    baseFeePerGas: b.baseFeePerGas ? hexToBigInt(b.baseFeePerGas).toString() : null,
    size: hexToNumber(b.size),
    txCount: b.transactions.length,
    nonce: b.nonce,
    extraData: b.extraData,
    stateRoot: b.stateRoot,
  };
}

function methodIdOf(input: string): string | null {
  // Anything longer than a bare "0x" with at least a 4-byte selector is a
  // contract call rather than a plain value transfer.
  if (!input || input.length < 10) return null;
  return input.slice(0, 10);
}

function mapLogs(r: RawReceipt | null): ZcuLog[] {
  if (!r?.logs) return [];
  return r.logs.map((l) => ({
    address: l.address,
    topics: l.topics,
    data: l.data,
    logIndex: hexToNumber(l.logIndex),
  }));
}

function mapTx(t: RawTx, receipt: RawReceipt | null, timestamp: number | null): ZcuTx {
  const gasUsed = receipt ? hexToNumber(receipt.gasUsed) : null;
  const effPrice = receipt?.effectiveGasPrice
    ? hexToBigInt(receipt.effectiveGasPrice)
    : hexToBigInt(t.gasPrice);
  return {
    hash: t.hash,
    blockNumber: t.blockNumber ? hexToNumber(t.blockNumber) : null,
    blockHash: t.blockHash,
    txIndex: t.transactionIndex ? hexToNumber(t.transactionIndex) : null,
    from: t.from,
    to: t.to,
    value: hexToBigInt(t.value).toString(),
    gasPrice: hexToBigInt(t.gasPrice).toString(),
    maxFeePerGas: t.maxFeePerGas ? hexToBigInt(t.maxFeePerGas).toString() : null,
    maxPriorityFeePerGas: t.maxPriorityFeePerGas
      ? hexToBigInt(t.maxPriorityFeePerGas).toString()
      : null,
    gas: hexToNumber(t.gas),
    gasUsed,
    feeWei: gasUsed != null ? (BigInt(gasUsed) * effPrice).toString() : null,
    status: receipt?.status != null ? hexToNumber(receipt.status) : null,
    nonce: hexToNumber(t.nonce),
    input: t.input,
    methodId: methodIdOf(t.input),
    contractAddress: receipt?.contractAddress ?? null,
    timestamp,
    logs: mapLogs(receipt),
  };
}

// ---------- chain tip ----------

export async function getTipHeight(): Promise<number> {
  return hexToNumber(await rpc<string>("eth_blockNumber"));
}

export async function getChainInfo(): Promise<ZcuChainInfo> {
  const [chainId, tipRaw, gasPrice, peers, syncing] = await rpcBatch<unknown>([
    { method: "eth_chainId" },
    { method: "eth_getBlockByNumber", params: ["latest", false] },
    { method: "eth_gasPrice" },
    { method: "net_peerCount" },
    { method: "eth_syncing" },
  ]);

  const tip = tipRaw as RawBlock | null;
  if (!tip) throw new RpcError(502, "Node returned no latest block");

  return {
    chainId: hexToNumber(chainId as string),
    tipHeight: hexToNumber(tip.number),
    tipHash: tip.hash,
    tipTimestamp: hexToNumber(tip.timestamp),
    gasPriceWei: hexToBigInt(gasPrice as string).toString(),
    peerCount: hexToNumber(peers as string),
    syncing: syncing !== false && syncing != null,
  };
}

// ---------- blocks ----------

/** Accepts a decimal height, a 0x block hash, or "latest". */
export async function getBlock(id: string, withTxs = false): Promise<ZcuBlock | null> {
  const isHash = /^0x[0-9a-fA-F]{64}$/.test(id);
  const method = isHash ? "eth_getBlockByHash" : "eth_getBlockByNumber";
  const key = isHash
    ? id
    : id === "latest"
      ? "latest"
      : toHexQuantity(Number(id));
  const raw = await rpc<RawBlock | null>(method, [key, withTxs]);
  return raw ? mapBlock(raw) : null;
}

/**
 * The most recent `count` blocks, newest first, optionally ending at
 * `startHeight`. One batched round-trip regardless of count.
 */
export async function getRecentBlocks(count = 15, startHeight?: number): Promise<ZcuBlock[]> {
  const tip = startHeight ?? (await getTipHeight());
  const heights: number[] = [];
  for (let h = tip; h > tip - count && h >= 0; h--) heights.push(h);

  const raws = await rpcBatch<RawBlock>(
    heights.map((h) => ({
      method: "eth_getBlockByNumber",
      params: [toHexQuantity(h), false],
    })),
  );
  return raws.filter((b): b is RawBlock => b != null).map(mapBlock);
}

/** Full transaction list for a block, with receipts resolved. */
export async function getBlockTxs(id: string): Promise<{ block: ZcuBlock; txs: ZcuTx[] } | null> {
  const isHash = /^0x[0-9a-fA-F]{64}$/.test(id);
  const method = isHash ? "eth_getBlockByHash" : "eth_getBlockByNumber";
  const key = isHash ? id : id === "latest" ? "latest" : toHexQuantity(Number(id));

  const raw = await rpc<RawBlock | null>(method, [key, true]);
  if (!raw) return null;

  const block = mapBlock(raw);
  const rawTxs = (raw.transactions as RawTx[]).filter((t) => typeof t === "object");
  if (rawTxs.length === 0) return { block: { ...block, feesWei: ZERO }, txs: [] };

  const receipts = await rpcBatch<RawReceipt>(
    rawTxs.map((t) => ({ method: "eth_getTransactionReceipt", params: [t.hash] })),
  );

  let fees = 0n;
  const txs = rawTxs.map((t, i) => {
    const tx = mapTx(t, receipts[i] ?? null, block.timestamp);
    if (tx.feeWei) fees += BigInt(tx.feeWei);
    return tx;
  });

  return { block: { ...block, feesWei: fees.toString() }, txs };
}

// ---------- transactions ----------

export async function getTx(hash: string): Promise<ZcuTx | null> {
  const [txRaw, receiptRaw] = await rpcBatch<unknown>([
    { method: "eth_getTransactionByHash", params: [hash] },
    { method: "eth_getTransactionReceipt", params: [hash] },
  ]);

  const t = txRaw as RawTx | null;
  if (!t) return null;
  const receipt = receiptRaw as RawReceipt | null;

  // A mined tx needs its block timestamp; a pending one has none yet.
  let timestamp: number | null = null;
  if (t.blockNumber) {
    const blk = await rpc<RawBlock | null>("eth_getBlockByNumber", [t.blockNumber, false]);
    timestamp = blk ? hexToNumber(blk.timestamp) : null;
  }

  return mapTx(t, receipt, timestamp);
}

// ---------- addresses ----------

export async function getAddress(addr: string): Promise<ZcuAddress> {
  const [balance, nonce, code] = await rpcBatch<string>([
    { method: "eth_getBalance", params: [addr, "latest"] },
    { method: "eth_getTransactionCount", params: [addr, "latest"] },
    { method: "eth_getCode", params: [addr, "latest"] },
  ]);

  const codeHex = code ?? "0x";
  const isContract = codeHex.length > 2;
  return {
    address: addr,
    balance: hexToBigInt(balance).toString(),
    nonce: hexToNumber(nonce),
    isContract,
    codeSize: isContract ? (codeHex.length - 2) / 2 : 0,
  };
}

// ---------- mempool ----------

interface RawPool {
  pending: Record<string, Record<string, RawTx>>;
  queued: Record<string, Record<string, RawTx>>;
}

function flattenPool(pool: RawPool | null): ZcuPendingTx[] {
  if (!pool) return [];
  const out: ZcuPendingTx[] = [];
  for (const state of ["pending", "queued"] as const) {
    const byAccount = pool[state] ?? {};
    for (const nonces of Object.values(byAccount)) {
      for (const t of Object.values(nonces)) {
        out.push({
          hash: t.hash,
          from: t.from,
          to: t.to,
          value: hexToBigInt(t.value).toString(),
          gasPrice: hexToBigInt(t.gasPrice).toString(),
          gas: hexToNumber(t.gas),
          nonce: hexToNumber(t.nonce),
          state,
        });
      }
    }
  }
  // Highest gas price first — same ordering logic the fee-bucket view wants.
  return out.sort((a, b) => (BigInt(b.gasPrice) > BigInt(a.gasPrice) ? 1 : -1));
}

const BUCKET_EDGES = [0, 1, 5, 15, 40, 100, Infinity];

export async function getMempool(): Promise<ZcuMempool> {
  const [statusRaw, contentRaw] = await rpcBatch<unknown>([
    { method: "txpool_status" },
    { method: "txpool_content" },
  ]);

  const status = statusRaw as { pending?: string; queued?: string } | null;
  const txs = flattenPool(contentRaw as RawPool | null);

  const buckets = BUCKET_EDGES.slice(0, -1).map((min, i) => ({
    minGwei: min,
    maxGwei: BUCKET_EDGES[i + 1],
    count: 0,
    gasTotal: 0,
  }));

  for (const t of txs) {
    const gwei = Number(BigInt(t.gasPrice) / 1_000_000n) / 1000;
    const idx = BUCKET_EDGES.findIndex((e, i) => gwei >= e && gwei < BUCKET_EDGES[i + 1]);
    const b = buckets[idx === -1 ? buckets.length - 1 : idx];
    b.count++;
    b.gasTotal += t.gas;
  }

  return {
    pending: status?.pending != null ? hexToNumber(status.pending) : txs.filter((t) => t.state === "pending").length,
    queued: status?.queued != null ? hexToNumber(status.queued) : txs.filter((t) => t.state === "queued").length,
    txs: txs.slice(0, 200),
    buckets,
  };
}

// ---------- mining ----------

/**
 * Hashrate estimate. On a PoW chain: work per block ≈ difficulty, so
 * hashrate ≈ difficulty ÷ mean seconds per block over the sample window.
 */
export async function getHashrate(sample = 120): Promise<ZcuHashrate> {
  const blocks = await getRecentBlocks(sample + 1);
  if (blocks.length < 2) {
    return { hashrate: 0, difficulty: ZERO, avgBlockTimeSec: 0, sampleBlocks: 0, series: [] };
  }

  // blocks[] is newest-first; walk pairs to get per-block intervals.
  const series: ZcuHashrate["series"] = [];
  for (let i = 0; i < blocks.length - 1; i++) {
    const cur = blocks[i];
    const prev = blocks[i + 1];
    series.push({
      timestamp: cur.timestamp,
      height: cur.number,
      difficulty: Number(cur.difficulty),
      blockTimeSec: Math.max(0, cur.timestamp - prev.timestamp),
    });
  }
  series.reverse();

  const span = blocks[0].timestamp - blocks[blocks.length - 1].timestamp;
  const avg = span > 0 ? span / (blocks.length - 1) : 0;
  const diff = Number(blocks[0].difficulty);

  return {
    hashrate: avg > 0 ? diff / avg : 0,
    difficulty: blocks[0].difficulty,
    avgBlockTimeSec: avg,
    sampleBlocks: blocks.length - 1,
    series,
  };
}

/** Blocks-mined distribution by coinbase address over a recent window. */
export async function getMiners(window = 200): Promise<{ miners: ZcuMiner[]; blockCount: number }> {
  const blocks = await getRecentBlocks(window);
  const tally = new Map<string, number>();
  for (const b of blocks) {
    const k = b.miner.toLowerCase();
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  const miners = [...tally.entries()]
    .map(([address, blockCount]) => ({
      address,
      blockCount,
      share: blocks.length ? blockCount / blocks.length : 0,
    }))
    .sort((a, b) => b.blockCount - a.blockCount);

  return { miners, blockCount: blocks.length };
}

export { RpcError };
