# satchel — spec (v0.1)

Local-first inventory that merges in on-chain items. Reference impl `index.mjs`, proof `test.mjs`.
Zero dependencies. Pairs with `@metanet-games/chaintag` (the bag keys on `identity.id`).

## Setup

`createSatchel({ identity, store?, chain?, now? })`:

- `identity` — a chaintag identity (or any `{ id, pubkey? }`). Required. Items key on `id`;
  `pubkey` (if present) is passed to the chain adapter.
- `store` — optional `{ getItem, setItem }` (e.g. `localStorage`) for persisting **local** items.
- `chain` — optional `{ list(pubkey) → item[] }` adapter that returns the player's on-chain items.

## Items

The merged view (`items()`) is `[ ...localItems, ...chainItems ]`, each item:
`{ id, type, qty, meta, origin, owned, stackable?, ref? }`.

- **Local** (`origin:"local"`) — added via `add()`, persisted, removable. `stackable` items merge
  by `type` into one entry with a summed `qty` (consumables); non-stackable items stay distinct.
- **Chain** (`origin:"chain"`) — produced by `sync()` from the adapter; `qty` 1, `ref` holds the
  outpoint/txid. Shown as owned; **not** removable via `remove()` (spending is a transaction).

## API

- `add(item)` — add a local item (`{ type, qty?, meta?, stackable?, id? }`). Returns the stored (or
  merged) item.
- `remove(id, qty?)` — decrement or delete a **local** item; returns `false` if not found.
- `sync()` — `await` it to pull on-chain items via `chain.list(pubkey)` and merge them in. Replaces
  the prior chain set (idempotent). Returns the merged view.
- `items()`, `get(id)`, `has(type)`, `count(type)` — read the merged bag (`count` sums quantities).
- `on("change", cb)` — fires with the merged view on any add/remove/sync.

## Persistence model

Only local items are persisted (in `store`, per identity). Chain items are **not** persisted — they
live on-chain and are re-fetched by `sync()` each session, so the bag can't drift from truth. A new
session restores local items immediately and shows on-chain ones after a `sync()`.

## Non-goals

Not an indexer or wallet (you provide `chain.list`), not minting/transfer/spending (those are
transactions your app makes), not a marketplace. It's the local+on-chain merge, persistence, and
querying layer.

## License & implementation

This specification is free for anyone to implement, in any language, royalty-free — writing it
down is the point. The reference implementation is licensed under Apache-2.0; the specification
itself places no restriction on independent, clean-room implementations.
