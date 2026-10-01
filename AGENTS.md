# Architecture Rules

- Historical ZCU analytics must read from the dedicated indexer API and degrade to bounded live-node samples, so explorer pages remain useful during indexer outages.