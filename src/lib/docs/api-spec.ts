export interface Endpoint {
  method: "GET" | "RPC";
  path: string;
  summary: string;
  example?: string; // example JSON response (string, may be truncated)
}

export interface EndpointGroup {
  id: string;
  title: string;
  description: string;
  endpoints: Endpoint[];
}

export const REST_GROUPS: EndpointGroup[] = [
  {
    id: "chain",
    title: "Chain & blocks",
    description: "Chain tip, block summaries and block transaction lists.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/chain",
        summary: "Chain tip, suggested gas price, peer count and sync state.",
        example: `{\n  "chainId": 90031273,\n  "tipHeight": 26347,\n  "tipHash": "0x…",\n  "tipTimestamp": 1782205885,\n  "gasPriceWei": "1000000000",\n  "peerCount": 6,\n  "syncing": false\n}`,
      },
      {
        method: "GET",
        path: "/api/v1/blocks/tip/height",
        summary: "Latest block height (plain text).",
        example: `26347`,
      },
      {
        method: "GET",
        path: "/api/v1/blocks?count=25&before=26000",
        summary:
          "Block summaries, newest first. `count` max 100. `before` walks backwards from a height for pagination.",
      },
      {
        method: "GET",
        path: "/api/v1/block/:id",
        summary: "Block by decimal height or 0x block hash. `latest` also works.",
        example: `{\n  "number": 26347,\n  "hash": "0x…",\n  "miner": "0x…",\n  "difficulty": "1032144",\n  "gasUsed": 21000,\n  "gasLimit": 8000000,\n  "baseFeePerGas": null,\n  "txCount": 1\n}`,
      },
      {
        method: "GET",
        path: "/api/v1/block/:id/txs",
        summary:
          "Block plus every transaction in it, with receipts already merged in (status, gasUsed, feeWei, logs).",
      },
    ],
  },
  {
    id: "tx",
    title: "Transactions",
    description: "Transaction lookup with receipt and event logs merged.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/tx/:hash",
        summary:
          "Full transaction: from, to, value, gas, effective fee, status, methodId, contractAddress and logs. Pending transactions return with `status: null`.",
        example: `{\n  "hash": "0x…",\n  "blockNumber": 26340,\n  "from": "0x…",\n  "to": "0x…",\n  "value": "1000000000000000000",\n  "gasPrice": "1000000000",\n  "gasUsed": 21000,\n  "feeWei": "21000000000000",\n  "status": 1,\n  "logs": []\n}`,
      },
    ],
  },
  {
    id: "address",
    title: "Accounts",
    description: "Live account state read straight from the node.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/address/:addr",
        summary:
          "Balance in wei, outbound transaction count (nonce), and whether the address holds contract code.",
        example: `{\n  "address": "0x…",\n  "balance": "412500000000000000000",\n  "nonce": 17,\n  "isContract": false,\n  "codeSize": 0\n}`,
      },
    ],
  },
  {
    id: "mempool",
    title: "Txpool",
    description: "Pending and queued transactions waiting to be mined.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/mempool",
        summary:
          "Txpool counts, a capped list of pending transactions, and a gas-price histogram.",
        example: `{\n  "pending": 3,\n  "queued": 0,\n  "txs": [ { "hash": "0x…", "gasPrice": "1000000000", "state": "pending" } ],\n  "buckets": [ { "minGwei": 1, "maxGwei": 1, "count": 3, "gasTotal": 63000 } ]\n}`,
      },
    ],
  },
  {
    id: "mining",
    title: "Mining",
    description: "Scrypt difficulty, estimated hashrate and coinbase distribution.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/mining/hashrate?sample=120",
        summary:
          "Estimated hashrate (difficulty ÷ mean block time) plus a per-block difficulty and block-time series over the sampled window.",
        example: `{\n  "hashrate": 17203,\n  "difficulty": "1032144",\n  "avgBlockTimeSec": 60.0,\n  "sampleBlocks": 120,\n  "series": [ { "timestamp": 1782205885, "height": 26347, "difficulty": 1032144, "blockTimeSec": 59 } ]\n}`,
      },
      {
        method: "GET",
        path: "/api/v1/mining/miners?window=200",
        summary:
          "Blocks per coinbase address over the last N blocks, with each miner's share of the window.",
      },
    ],
  },
];

export const WS_GROUPS: EndpointGroup[] = [
  {
    id: "rpc-connect",
    title: "Direct JSON-RPC",
    description:
      "This explorer is a thin layer over a go-ethereum node. Anything not exposed above can be read straight from the public RPC endpoint at https://node-zcu.honest.money using standard Ethereum JSON-RPC. Add the chain to any EVM wallet with chain ID 90031273.",
    endpoints: [
      {
        method: "RPC",
        path: `{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}`,
        summary: "Current block height as a hex quantity.",
      },
      {
        method: "RPC",
        path: `{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["0x…","latest"]}`,
        summary: "Account balance in wei.",
      },
      {
        method: "RPC",
        path: `{"jsonrpc":"2.0","id":1,"method":"eth_getLogs","params":[{"fromBlock":"0x0","toBlock":"latest","address":"0x…"}]}`,
        summary: "Contract event logs — the basis for token indexing.",
      },
      {
        method: "RPC",
        path: `{"jsonrpc":"2.0","id":1,"method":"eth_sendRawTransaction","params":["0x…"]}`,
        summary: "Broadcast a signed transaction.",
      },
    ],
  },
  {
    id: "rpc-namespaces",
    title: "Available namespaces",
    description:
      "The public node exposes eth, net, web3, debug, txpool and scrypt. `scrypt_*` covers the AuxPoW merged-mining surface used by miners.",
    endpoints: [
      {
        method: "RPC",
        path: `{"jsonrpc":"2.0","id":1,"method":"txpool_status","params":[]}`,
        summary: "Pending / queued counts straight from the node.",
      },
      {
        method: "RPC",
        path: `{"jsonrpc":"2.0","id":1,"method":"net_peerCount","params":[]}`,
        summary: "Connected peer count.",
      },
    ],
  },
];
