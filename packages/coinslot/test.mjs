// Proof for coinslot: `node test.mjs`. Exits non-zero on any failure.
import { createCoinslot } from "./index.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); fails++; } else console.log("ok  ", m); };

let clock = 1000;
const now = () => clock;
const mkStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
// a payment adapter that always succeeds and records calls
const spy = () => { const calls = []; const pay = async (req) => { calls.push(req); return { ok: true, txid: "tx" + calls.length, amountSats: req.amountSats ?? 999 }; }; return { pay, calls }; };

// 1. never auto-charges; durable unlock; receipt
{
  const { pay, calls } = spy();
  const slot = createCoinslot({ pay, identity: { id: "alice" }, store: mkStore(), now });
  slot.define("nolimit", { sats: 5000 });
  ok(calls.length === 0, "creating a coinslot charges nothing");
  ok(!slot.entitled("nolimit"), "not entitled before buying");
  const r = await slot.buy("nolimit");
  ok(r.ok && r.receipt.txid === "tx1" && r.receipt.amountSats === 5000 && r.receipt.payer === "alice", "buy returns a receipt with txid/amount/payer");
  ok(slot.entitled("nolimit"), "durable unlock entitles after payment");
  ok(slot.receipts().length === 1, "receipt recorded");
}

// 2. consumable N-uses
{
  const { pay } = spy();
  const slot = createCoinslot({ pay, identity: { id: "b" }, store: mkStore(), now });
  slot.define("continue", { sats: 100, uses: 2 });
  await slot.buy("continue");
  ok(slot.entitled("continue"), "entitled after buying a 2-use pack");
  ok(slot.use("continue") && slot.use("continue"), "can consume two uses");
  ok(!slot.use("continue") && !slot.entitled("continue"), "third use fails; no longer entitled");
}

// 3. timed pass (ttl)
{
  clock = 1000;
  const { pay } = spy();
  const slot = createCoinslot({ pay, identity: { id: "c" }, store: mkStore(), now });
  slot.define("daypass", { fiat: 0.10, ttl: 86400000 });
  const r = await slot.buy("daypass");
  ok(r.receipt.currency === "USD", "fiat product records USD currency");
  ok(slot.entitled("daypass"), "day pass entitles immediately");
  ok(slot.use("daypass") === true, "timed pass allows use without spending a use");
  clock += 86400001;
  ok(!slot.entitled("daypass"), "day pass expires after ttl");
}

// 4. payment failure grants nothing
{
  const pay = async () => ({ ok: false, reason: "user cancelled" });
  const slot = createCoinslot({ pay, identity: { id: "d" }, store: mkStore(), now });
  slot.define("x", { sats: 50 });
  const r = await slot.buy("x");
  ok(!r.ok && r.reason === "user cancelled", "declined payment returns the reason");
  ok(!slot.entitled("x") && slot.receipts().length === 0, "nothing granted and no receipt on failure");
}

// 5. require() gates without double-charging
{
  const { pay, calls } = spy();
  const slot = createCoinslot({ pay, identity: { id: "e" }, store: mkStore(), now });
  slot.define("unlock", { sats: 200 });
  const a = await slot.require("unlock");
  ok(a.ok && !a.already && calls.length === 1, "require() buys when not entitled");
  const b = await slot.require("unlock");
  ok(b.ok && b.already && calls.length === 1, "require() is free when already entitled (no second charge)");
}

// 6. entitlements persist across sessions (same store + identity)
{
  const store = mkStore();
  const { pay } = spy();
  const s1 = createCoinslot({ pay, identity: { id: "f" }, store, now });
  s1.define("nolimit", { sats: 5000 });
  await s1.buy("nolimit");
  const s2 = createCoinslot({ pay, identity: { id: "f" }, store, now });
  s2.define("nolimit", { sats: 5000 });
  ok(s2.entitled("nolimit"), "a new session restores entitlements from the store");
  ok(s2.receipts().length === 1, "receipts persist too");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
