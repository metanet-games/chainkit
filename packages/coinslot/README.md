# @metanet-games/coinslot

A drop-in micropayment paywall + tip rail for games — the chain as the coin slot. Zero deps.

Define priced products (a continue, a day pass, an unlock, a tip); `buy()` / `require()` them.
coinslot tracks entitlements per player and keeps receipts. It doesn't move money itself — you
plug in a **payment adapter** (HandCash Connect, Yours, or a test stub), so it's not welded to one
wallet.

```js
import { createCoinslot } from "@metanet-games/coinslot";
import { anon } from "@metanet-games/passport";

const slot = createCoinslot({
  identity: anon(localStorage),          // entitlements follow the player
  store: localStorage,                    // persist across sessions
  pay: async ({ amountSats, amountFiat, description }) => {
    // call HandCash Connect / Yours here; return the result
    const { transactionId } = await handcash.pay({ sats: amountSats, note: description });
    return { ok: true, txid: transactionId, amountSats };
  },
});

slot.define("continue", { sats: 100, uses: 1 });        // consumable
slot.define("daypass",  { fiat: 0.10, ttl: 86400000 }); // timed
slot.define("nolimit",  { sats: 5000 });                // durable unlock

// gate an action — charges only if not already entitled
if ((await slot.require("continue")).ok) { slot.use("continue"); respawn(); }

slot.entitled("nolimit");   // bool
slot.receipts();            // [{ product, payer, amountSats, txid, ts }]
```

## Entitlement kinds

- **durable** — `{ sats }` only: bought once, entitled forever.
- **N-uses** — `{ sats, uses: N }`: `use()` decrements; entitled while uses remain.
- **timed** — `{ fiat, ttl: ms }`: a pass valid until it expires; `use()` doesn't spend it.
- combine `uses` + `ttl` for "N plays valid 24h".

## Two rules it enforces (because it spends real money)

1. **Never auto-charges.** Payment happens only on an explicit `buy()`/`require()` your app calls
   from a user action. A connected wallet is an *account*, not standing permission to charge.
2. **Paid ⇒ granted, always.** On adapter success the receipt and entitlement are recorded before
   returning — the worst failure is taking money and withholding what was bought.

The payment adapter converts fiat→sats and settles; coinslot records `res.txid` in the receipt, so
you can anchor/verify it on-chain (e.g. via bsv.cx) if you want tamper-evident sales.

See [SPEC.md](./SPEC.md).

MIT © metanet.games
