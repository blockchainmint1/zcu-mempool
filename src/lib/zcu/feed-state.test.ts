import { describe, expect, test } from "bun:test";
import { updateFeed, type ZcuFeedSnapshot } from "./feed-state";

const initial: ZcuFeedSnapshot = {
  chain: null, tipHeight: null, blocks: [], mempool: null, status: "connecting", lastTick: 0,
};
const failed = { status: "rejected", reason: new Error("Host unreachable") } as const;

describe("chain outage handling", () => {
  test("an unreachable host marks the initial feed offline without inventing data", () => {
    expect(updateFeed(initial, [failed, failed, failed], 100)).toEqual({ ...initial, status: "offline" });
  });
  test("an outage preserves previously loaded blocks and their freshness timestamp", () => {
    const previous = { ...initial, tipHeight: 42, lastTick: 10, status: "live" as const };
    const next = updateFeed(previous, [failed, failed, failed], 100);
    expect(next.tipHeight).toBe(42);
    expect(next.lastTick).toBe(10);
    expect(next.blocks).toBe(previous.blocks);
    expect(next.status).toBe("offline");
  });
  test("partial success is not presented as a healthy live connection", () => {
    expect(updateFeed(initial, [failed, { status: "fulfilled", value: [] }, failed], 100).status).toBe("offline");
  });
});