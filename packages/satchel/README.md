# @metanet-games/satchel

Inventory for BSV games — **local for a wallet-less player, real on-chain items when they connect**,
in one merged bag. Zero dependencies.

Fun before wallet: a player collects items locally (persisted per identity) with no wallet at all.
When they connect one, `sync()` pulls their on-chain items (e.g. 1Sat Ordinals) through a pluggable
chain adapter and merges them into the same bag — each tagged with its origin.

```js
import { createSatchel } from "@metanet-games/satchel";
import { anon } from "@metanet-games/chaintag";

const bag = createSatchel({
  identity: anon(localStorage),
  store: localStorage,
  chain: { list: async (pubkey) => fetchOrdinals(pubkey) },   // your indexer
});

bag.add({ type: "potion", stackable: true, qty: 3 });   // local, consumable
bag.add({ type: "sword", meta: { atk: 5 } });           // local, unique
bag.has("sword");           // true
bag.count("potion");        // 3
bag.remove(swordId);        // drop a local item

await bag.sync();           // pull the player's on-chain items in
bag.items();                // merged: each { …, origin: "local" | "chain", owned, ref? }
```

- **Local items** persist per identity and can be added/removed freely (great for a wallet-less
  player). `stackable` items merge by type (consumables); others stay distinct.
- **On-chain items** come from your `chain.list(pubkey)` adapter, tagged `origin: "chain"` with the
  outpoint/txid in `ref`. They're shown as owned but not removable here — spending an ordinal is a
  transaction your app makes, not a local delete.

satchel never talks to an indexer itself; you own that adapter. It's the merge + persistence layer.

See [SPEC.md](./SPEC.md).

Apache-2.0 © metanet.games
