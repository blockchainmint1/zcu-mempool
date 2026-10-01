# ZCU historical block-time chart

## Build
- Add a ZCU block-time data endpoint with per-block, 1-day, 7-day, and 30-day windows.
- Use the ZCU indexer’s stored block timestamps for historical windows, with recent chain data as a graceful fallback.
- Add the TXC-style chart to the ZCU dashboard, adapted to ZCU’s 60-second target and existing visual system.
- Show average, target, fastest, slowest, sampled intervals, and clearly mark unusually slow blocks.

## Technical details
- Extend the private indexer API with a bounded block-time aggregation query so historical charts remain fast.
- Proxy that data through the explorer’s existing `/api/v1` API and add matching shared types/client helpers.
- Keep authentication between the explorer and indexer unchanged.
- Verify the endpoint, desktop/mobile rendering, loading/error states, and the existing dashboard flow.
