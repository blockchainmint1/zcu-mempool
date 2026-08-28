// Normalized DTOs served by this app's /api/v1/* surface.
//
// Deliberately NOT raw geth shapes: hex quantities are decoded to numbers
// where they are known to be small (heights, gas, counts, timestamps) and
// kept as decimal strings where they can exceed Number.MAX_SAFE_INTEGER
// (wei values, difficulty). The client never has to touch BigInt parsing of
// 0x strings, and JSON round-trips losslessly.

export interface ZcuBlock {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  miner: string;
  /** Decimal string — Scrypt difficulty can exceed 2^53. */
  difficulty: string;
  totalDifficulty: string;
  gasUsed: number;
  gasLimit: number;
  /** Wei, decimal string. Null on a pre-London-style block with no base fee. */
  baseFeePerGas: string | null;
  size: number;
  txCount: number;
  nonce: string;
  extraData: string;
  stateRoot: string;
  /** Sum of gasUsed × effectiveGasPrice across the block, in wei. */
  feesWei?: string;
}

export interface ZcuLog {
  address: string;
  topics: string[];
  data: string;
  logIndex: number;
}

export interface ZcuTx {
  hash: string;
  blockNumber: number | null;
  blockHash: string | null;
  /** Position in the block; null while pending. */
  txIndex: number | null;
  from: string;
  /** Null for a contract-creation transaction. */
  to: string | null;
  /** Wei, decimal string. */
  value: string;
  /** Wei per gas, decimal string. */
  gasPrice: string;
  maxFeePerGas: string | null;
  maxPriorityFeePerGas: string | null;
  gas: number;
  gasUsed: number | null;
  /** Wei, decimal string — gasUsed × effectiveGasPrice. */
  feeWei: string | null;
  /** 1 = success, 0 = reverted, null = pending. */
  status: number | null;
  nonce: number;
  input: string;
  /** First 4 bytes of input, when it looks like a contract call. */
  methodId: string | null;
  /** Set when this tx deployed a contract. */
  contractAddress: string | null;
  /** Block timestamp; null while pending. */
  timestamp: number | null;
  logs: ZcuLog[];
}

export interface ZcuAddress {
  address: string;
  /** Wei, decimal string. */
  balance: string;
  /** Outbound transaction count (account nonce). */
  nonce: number;
  isContract: boolean;
  codeSize: number;
}

export interface ZcuPendingTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gas: number;
  nonce: number;
  /** "pending" = ready to mine, "queued" = nonce gap, waiting. */
  state: "pending" | "queued";
}

export interface ZcuMempool {
  pending: number;
  queued: number;
  txs: ZcuPendingTx[];
  /** Gas-price histogram buckets, cheapest first. */
  buckets: Array<{ minGwei: number; maxGwei: number; count: number; gasTotal: number }>;
}

export interface ZcuChainInfo {
  chainId: number;
  tipHeight: number;
  tipHash: string;
  tipTimestamp: number;
  gasPriceWei: string;
  peerCount: number;
  syncing: boolean;
}

export interface ZcuHashrate {
  /** Estimated network hashrate in H/s, from difficulty ÷ mean block time. */
  hashrate: number;
  difficulty: string;
  avgBlockTimeSec: number;
  sampleBlocks: number;
  series: Array<{ timestamp: number; height: number; difficulty: number; blockTimeSec: number }>;
}

export interface ZcuMiner {
  address: string;
  blockCount: number;
  share: number;
}
