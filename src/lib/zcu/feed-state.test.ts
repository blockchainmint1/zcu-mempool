import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { updateFeed, type ZcuFeedSnapshot } from "./feed-state";

const initial: ZcuFeedSnapshot = {
  chain: null, tipHeight: null, blocks: [], mempool: null, status: "connecting", lastTick: 0,
};
const failed = { status: "rejected", reason: new Error("Host unreachable") } as const;

describe("chain outage handling", () => {
  test("an unreachable host marks the initial feed offline without inventing data", () => {
    assert.deepEqual(updateFeed(initial, [failed, failed, failed], 100), { ...initial, status: "offline" });
  });
  test("an outage preserves previously loaded blocks and their freshness timestamp", () => {
    const previous = { ...initial, tipHeight: 42, lastTick: 10, status: "live" as const };
    const next = updateFeed(previous, [failed, failed, failed], 100);
    assert.equal(next.tipHeight, 42);
    assert.equal(next.lastTick, 10);
    assert.equal(next.blocks, previous.blocks);
    assert.equal(next.status, "offline");
  });
  test("partial success is not presented as a healthy live connection", () => {
    assert.equal(updateFeed(initial, [failed, { status: "fulfilled", value: [] }, failed], 100).status, "offline");
  });
});