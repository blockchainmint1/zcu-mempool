// Turns a range of raw RPC blocks into rows in postgres.

import type { Client } from "./db.js";
import { withTransaction, setIndexState } from "./db.js";
import {
  getBlocks,
  getReceipts,
  getCodes,
  hexToNumber,
  hexToDecimalString,
  type RawBlock,
  type RawReceipt,
  type RawTx,
} from "./rpc.js";

/** Addresses touched in a batch, with the block range they appeared in. */
interface AddressTouch {
  firstBlock: number;
  lastBlock: number;
  txCount: number;
}

function methodIdOf(input: string | null | undefined): string | null {
  if (!input || input.length < 10) return null;
  return input.slice(0, 10);
}

function lower(a: string | null | undefined): string | null {
  return a ? a.toLowerCase() : null;
}

function touch(
  map: Map<string, AddressTouch>,
  addr: string | null,
  block: number,
  countsAsTx: boolean,
): void {
  if (!addr) return;
  const key = addr.toLowerCase();
  const cur = map.get(key);
  if (cur) {
    cur.firstBlock = Math.min(cur.firstBlock, block);
    cur.lastBlock = Math.max(cur.lastBlock, block);
    if (countsAsTx) cur.txCount += 1;
  } else {
    map.set(key, { firstBlock: block, lastBlock: block, txCount: countsAsTx ? 1 : 0 });
  }
}

async function insertBlock(c: Client, b: RawBlock, feesWei: bigint): Promise<void> {
  await c.query(
    `INSERT INTO blocks (
       number, hash, parent_hash, timestamp, miner, difficulty, total_difficulty,
       gas_used, gas_limit, base_fee_per_gas, size, tx_count, fees_wei,
       extra_data, nonce, state_root
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (number) DO UPDATE SET
       hash = EXCLUDED.hash,
       parent_hash = EXCLUDED.parent_hash,
       timestamp = EXCLUDED.timestamp,
       miner = EXCLUDED.miner,
       difficulty = EXCLUDED.difficulty,
       total_difficulty = EXCLUDED.total_difficulty,
       gas_used = EXCLUDED.gas_used,
       gas_limit = EXCLUDED.gas_limit,
       base_fee_per_gas = EXCLUDED.base_fee_per_gas,
       size = EXCLUDED.size,
       tx_count = EXCLUDED.tx_count,
       fees_wei = EXCLUDED.fees_wei,
       extra_data = EXCLUDED.extra_data,
       nonce = EXCLUDED.nonce,
       state_root = EXCLUDED.state_root`,
    [
      hexToNumber(b.number),
      b.hash,
      b.parentHash,
      hexToNumber(b.timestamp),
      lower(b.miner),
      hexToDecimalString(b.difficulty),
      hexToDecimalString(b.totalDifficulty),
      hexToNumber(b.gasUsed),
      hexToNumber(b.gasLimit),
      b.baseFeePerGas ? hexToDecimalString(b.baseFeePerGas) : null,
      hexToNumber(b.size),
      b.transactions.length,
      feesWei.toString(),
      b.extraData,
      b.nonce,
      b.stateRoot,
    ],
  );
}

async function insertTx(
  c: Client,
  t: RawTx,
  r: RawReceipt | null,
  timestamp: number,
): Promise<bigint> {
  const gasUsed = r ? hexToNumber(r.gasUsed) : null;
  const effPrice = r?.effectiveGasPrice
    ? BigInt(r.effectiveGasPrice)
    : BigInt(t.gasPrice || "0x0");
  const fee = gasUsed != null ? BigInt(gasUsed) * effPrice : null;

  await c.query(
    `INSERT INTO transactions (
       hash, block_number, block_hash, tx_index, from_addr, to_addr, value,
       gas, gas_used, gas_price, max_fee_per_gas, max_priority_fee_per_gas,
       fee_wei, status, nonce, input, method_id, contract_address, timestamp
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     ON CONFLICT (hash) DO UPDATE SET
       block_number = EXCLUDED.block_number,
       block_hash = EXCLUDED.block_hash,
       tx_index = EXCLUDED.tx_index,
       gas_used = EXCLUDED.gas_used,
       fee_wei = EXCLUDED.fee_wei,
       status = EXCLUDED.status,
       contract_address = EXCLUDED.contract_address,
       timestamp = EXCLUDED.timestamp`,
    [
      t.hash,
      hexToNumber(t.blockNumber),
      t.blockHash,
      hexToNumber(t.transactionIndex),
      lower(t.from),
      lower(t.to),
      hexToDecimalString(t.value),
      hexToNumber(t.gas),
      gasUsed,
      hexToDecimalString(t.gasPrice),
      t.maxFeePerGas ? hexToDecimalString(t.maxFeePerGas) : null,
      t.maxPriorityFeePerGas ? hexToDecimalString(t.maxPriorityFeePerGas) : null,
      fee != null ? fee.toString() : null,
      r?.status != null ? hexToNumber(r.status) : null,
      hexToNumber(t.nonce),
      t.input,
      methodIdOf(t.input),
      lower(r?.contractAddress ?? null),
      timestamp,
    ],
  );

  return fee ?? 0n;
}

async function insertLogs(
  c: Client,
  r: RawReceipt,
  blockNumber: number,
  timestamp: number,
): Promise<void> {
  for (const l of r.logs ?? []) {
    await c.query(
      `INSERT INTO logs (
         tx_hash, block_number, log_index, address,
         topic0, topic1, topic2, topic3, data, timestamp
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (tx_hash, log_index) DO NOTHING`,
      [
        r.transactionHash,
        blockNumber,
        hexToNumber(l.logIndex),
        lower(l.address),
        l.topics[0] ?? null,
        l.topics[1] ?? null,
        l.topics[2] ?? null,
        l.topics[3] ?? null,
        l.data,
        timestamp,
      ],
    );
  }
}

async function upsertAddresses(c: Client, touched: Map<string, AddressTouch>): Promise<void> {
  if (touched.size === 0) return;

  const entries = [...touched.entries()];

  // Detect contracts for addresses we have not classified yet. eth_getCode is
  // cheap and this only runs for genuinely new addresses.
  const { rows: known } = await c.query(
    "SELECT address FROM addresses WHERE address = ANY($1::text[])",
    [entries.map(([a]) => a)],
  );
  const knownSet = new Set(known.map((r: { address: string }) => r.address));
  const fresh = entries.filter(([a]) => !knownSet.has(a)).map(([a]) => a);

  const contractFlags = new Map<string, boolean>();
  if (fresh.length > 0) {
    const codes = await getCodes(fresh);
    fresh.forEach((a, i) => {
      const code = codes[i];
      contractFlags.set(a, !!code && code.length > 2);
    });
  }

  for (const [address, t] of entries) {
    await c.query(
      `INSERT INTO addresses (address, first_seen_block, last_seen_block, tx_count, is_contract)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (address) DO UPDATE SET
         first_seen_block = LEAST(addresses.first_seen_block, EXCLUDED.first_seen_block),
         last_seen_block  = GREATEST(addresses.last_seen_block, EXCLUDED.last_seen_block),
         tx_count         = addresses.tx_count + EXCLUDED.tx_count`,
      [address, t.firstBlock, t.lastBlock, t.txCount, contractFlags.get(address) ?? false],
    );
  }
}

export interface BatchResult {
  indexedTo: number;
  indexedHash: string;
  blockCount: number;
  txCount: number;
  logCount: number;
}

/**
 * Index a contiguous range of heights. Everything lands in one transaction so
 * the checkpoint can never move ahead of the data it describes.
 */
export async function indexRange(from: number, to: number): Promise<BatchResult | null> {
  const heights: number[] = [];
  for (let h = from; h <= to; h++) heights.push(h);

  const raw = await getBlocks(heights);
  const blocks = raw.filter((b): b is RawBlock => b != null);
  if (blocks.length === 0) return null;

  // One batched receipt fetch for the whole range rather than per block.
  const allTxHashes = blocks.flatMap((b) => b.transactions.map((t) => t.hash));
  const receipts = allTxHashes.length > 0 ? await getReceipts(allTxHashes) : [];
  const receiptByHash = new Map<string, RawReceipt>();
  receipts.forEach((r) => {
    if (r?.transactionHash) receiptByHash.set(r.transactionHash, r);
  });

  const touched = new Map<string, AddressTouch>();
  let txCount = 0;
  let logCount = 0;

  // Ordering matters: transactions FK to blocks, and logs FK to blocks, so the
  // block row goes in before its children. All of it in one transaction.
  const result = await withTransaction(async (c) => {
    for (const b of blocks) {
      const height = hexToNumber(b.number);
      const timestamp = hexToNumber(b.timestamp);

      // Total fees for the block are only knowable from the receipts.
      let fees = 0n;
      for (const t of b.transactions) {
        const r = receiptByHash.get(t.hash);
        if (r) {
          const eff = r.effectiveGasPrice
            ? BigInt(r.effectiveGasPrice)
            : BigInt(t.gasPrice || "0x0");
          fees += BigInt(hexToNumber(r.gasUsed)) * eff;
        }
      }

      await insertBlock(c, b, fees);
      touch(touched, b.miner, height, false);

      for (const t of b.transactions) {
        const r = receiptByHash.get(t.hash) ?? null;
        await insertTx(c, t, r, timestamp);
        touch(touched, t.from, height, true);
        touch(touched, t.to, height, true);
        if (r?.contractAddress) touch(touched, r.contractAddress, height, false);
        txCount++;
        if (r) {
          await insertLogs(c, r, height, timestamp);
          logCount += r.logs?.length ?? 0;
        }
      }
    }


    await upsertAddresses(c, touched);

    const last = blocks[blocks.length - 1]!;
    const lastHeight = hexToNumber(last.number);
    await setIndexState(c, lastHeight, last.hash);

    return {
      indexedTo: lastHeight,
      indexedHash: last.hash,
      blockCount: blocks.length,
      txCount,
      logCount,
    };
  });

  return result;
}
