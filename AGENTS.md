# Architecture Rules

- Historical ZCU analytics must read from the dedicated indexer API and degrade to bounded live-node samples, so explorer pages remain useful during indexer outages.
- Treat client-disconnected HTTP requests as cancellations rather than application failures, so navigation and refreshes cannot trigger the global error page.
- Keep feed outage transitions in a tested browser-safe state module, retain last-known values as stale, bound browser requests, and never invalidate other queries after failed polls; an unavailable node must not appear as an empty healthy chain.