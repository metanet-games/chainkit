# coinslot — spec (v0.1)

A micropayment paywall + tip rail for games. Reference impl `index.mjs`, proof `test.mjs`. Zero
dependencies. Pairs with `@metanet-games/chaintag` (entitlements key on `identity.id`).

## Setup

`createCoinslot({ pay, identity, store?, now? })`:

- `pay(request)` — **required** payment adapter. Called with
  `{ product, amountSats, amountFiat, currency, description }` and must resolve to
  `{ ok: true, txid?, amountSats? }` on success or `{ ok: false, reason? }` on decline. This is
  where HandCash Connect / Yours / a test stub lives. coinslot never talks to a wallet directly.
- `identity` — a chaintag identity (or any `{ id }`). Entitlements + receipts are keyed to it.
- `store` — optional `{ getItem, setItem }` (e.g. `localStorage`) for persistence across sessions.
- `now` — optional clock, for testing timed passes.

## Products

`define(name, { sats?, fiat?, currency?, uses?, ttl?, description? })`:

- `sats` / `fiat` — price (fiat defaults `currency` to `"USD"`; the adapter converts fiat→sats).
- `uses` — consumable count; `ttl` — validity window in ms. Neither ⇒ **durable** (buy once).

## Entitlements

- `entitled(name)` → bool: durable ⇒ always; timed ⇒ until `now > until`; N-uses ⇒ while `uses > 0`.
  With both `uses` and `ttl`, entitled requires *not expired* **and** *uses remain*.
- `use(name)` → bool: returns whether the player was entitled; decrements an N-uses product by one
  (durable/timed passes return true without spending). Emits `use { product, remaining }`.
- Buying a consumable again stacks uses; buying a timed pass extends from `max(now, until)`.

## Purchase

- `buy(name, extra?)` → `{ ok, receipt }` or `{ ok: false, reason }`. Calls `pay`, and on success
  records the receipt **and** grants the entitlement, in that order, always. A thrown adapter is
  caught and returned as a failure; nothing is granted unless `pay` reports `ok:true`.
- `require(name)` → if already entitled, returns `{ ok:true, already:true }` **without charging**;
  otherwise `buy()`. Use it to gate an action safely.
- Receipt: `{ product, payer, amountSats, currency, txid, ts }`. `receipts()` returns them all.

## The two invariants

1. **No implicit charges.** Nothing calls `pay` except an explicit `buy()`/`require()`. Constructing
   a coinslot, connecting a wallet, or reading `entitled()` never moves money. A connected wallet is
   an account, not consent to charge.
2. **Paid ⇒ granted.** The moment the adapter reports success, the entitlement and receipt are
   persisted. Taking money and withholding the purchase is the one failure this module refuses to
   allow.

## Non-goals

Not a wallet or payment processor (that's the adapter), not on-chain settlement or escrow, not a
refund system, not a server-authoritative ledger. It's the client-side paywall state machine; for
tamper-evident sales, anchor `receipt.txid` yourself (e.g. via bsv.cx).

## License & implementation

This specification is free for anyone to implement, in any language, royalty-free — writing it
down is the point. The reference implementation is licensed under Apache-2.0; the specification
itself places no restriction on independent, clean-room implementations.
