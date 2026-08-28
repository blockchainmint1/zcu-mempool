// Zero Chill Units (ZCU) mainnet constants.
//
// ZCU is an EVM chain — a go-ethereum v1.10.26 fork running Scrypt PoW with
// AuxPoW merged mining and a node-auth certificate layer. It is NOT a
// Bitcoin-style UTXO chain and has no relationship to Omni layer assets.
//
// Every value here is taken from a live mainnet node and matches
// zerochill.com/build.

export const ZCU_NETWORK = {
  ticker: "ZCU",
  name: "Zero Chill Units",
  networkName: "Zero Chill Units Mainnet",
  chainId: 90031273,
  chainIdHex: "0x55d4529",
  genesisHash:
    "0x5955f084185288486e2917322958294b47e4a94156f4d02bbb918dfdadcd515a",
  client: "Geth v1.10.26-stable",
  consensus: "Scrypt PoW + AuxPoW merged mining",
  decimals: 18,
  /** Target seconds between blocks — refined from observed history at runtime. */
  blockTimeSec: 60,
  p2pPort: 31347,
  requiredCoinbase: "0xe3Aa1b921b0865E4092EB2CE2672Fcac3990Bdfe",
  sourceRepo: "https://github.com/blockchainmint1/zcu-geth",
  buildDocs: "https://zerochill.com/build",
  ecosystem: "https://honest.money",
} as const;

/**
 * Upstream geth JSON-RPC. Public, CORS-open, read-only namespaces
 * eth/net/web3/debug/txpool/admin/scrypt.
 *
 * Overridable via ZCU_RPC_URL so we can point at a private node behind our
 * own proxy without a code change.
 */
export const ZCU_RPC_FALLBACK = "https://node-zcu.honest.money";

/** Our own public API surface, served by this app's /api/v1/* routes. */
export const ZCU_API_BASE = "/api/v1";

export const WEI_PER_ZCU = 10n ** 18n;
export const WEI_PER_GWEI = 10n ** 9n;
