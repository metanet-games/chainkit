# @metanet-games/fairdrop

Provably-fair random outcomes bound to a **future** Bitcoin (BSV) block.

Loot, dice, crates, gacha — any outcome a player must be able to prove nobody rigged. You commit
to a table and a future block height; when that block is mined, its hash forces the outcome, and
anyone can recompute it from public data. Built on [chainseed](../chainseed).

```js
import { commit, resolve, verify } from "@metanet-games/fairdrop";

// 1. before block H exists — publish (and anchor) this commitment
const c = commit({
  dropId: "chest-42",
  height: 900123,                      // the block whose hash resolves the drop
  table: [
    { item: "common",    weight: 80 },
    { item: "rare",      weight: 15 },
    { item: "legendary", weight: 5  },
  ],
});

// 2. after block 900123 is mined
const result = resolve(c, { blockHash });   // -> { item, index, roll, ... }

// 3. anyone can check it
verify(c, { blockHash }, result);           // -> true
```

For high-stakes drops, pass committed `seeds` to harden against a grinding miner — each party
publishes `hash(seed)` at commit and reveals it at resolve.

**Read the threat model** in [SPEC.md](./SPEC.md): the only real attacker is a miner of the
resolving block, defused by economics + committed seeds, and fairness depends on the commitment
being provably older than the block (anchor its digest — e.g. via bsv.cx's notary).

Apache-2.0 © metanet.games
