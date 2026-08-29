// SPDX-License-Identifier: Apache-2.0
// coinslot — a drop-in micropayment paywall + tip rail for games. The chain as the coin slot.
//
// Define priced products (a continue, a day pass, an unlock, a tip), then `buy()` / `require()`
// them. coinslot tracks entitlements (durable / N-uses / timed) per player and keeps receipts.
// It does NOT execute payments itself — you plug in a payment adapter (HandCash Connect, Yours,
// a test stub), so coinslot never hard-depends on one wallet.
//
// TWO rules are baked in because this spends real money:
//   1. NEVER auto-charge. Payment happens only on an explicit buy()/require() your app called in
//      response to a user action. A connected wallet is an account, not standing permission.
//   2. Once paid, ALWAYS grant. The worst failure is taking money and withholding what was bought,
//      so the entitlement + receipt are recorded the moment the adapter reports success.
//
// Zero dependencies. Pairs with passport (pass a passport identity so entitlements follow the
// player across sessions/devices).

const now0 = () => Date.now();

function emitter() {
  const map = new Map();
  return {
    on(ev, cb) { (map.get(ev) || map.set(ev, new Set()).get(ev)).add(cb); return () => map.get(ev)?.delete(cb); },
    emit(ev, arg) { for (const cb of map.get(ev) || []) cb(arg); },
  };
}

const memStore = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; })();

export function createCoinslot({ pay, identity, store = memStore, now = now0 } = {}) {
  if (typeof pay !== "function") throw new Error("coinslot: a `pay` adapter function is required");
  if (!identity || !identity.id) throw new Error("coinslot: an identity with an id is required (pair with @metanet-games/passport)");

  const KEY = "coinslot:" + identity.id;
  const products = new Map();
  const ev = emitter();
  let state = { entitlements: {}, receipts: [] };
  try { const raw = store.getItem(KEY); if (raw) state = JSON.parse(raw); } catch { /* fresh */ }

  const persist = () => { try { store.setItem(KEY, JSON.stringify(state)); } catch { /* best effort */ } };

  function define(name, { sats = null, fiat = null, currency = fiat != null ? "USD" : "SATS", uses = null, ttl = null, description = "" } = {}) {
    products.set(name, { name, sats, fiat, currency, uses, ttl, description, durable: uses == null && ttl == null });
    return api;
  }

  function entitled(name) {
    const e = state.entitlements[name];
    if (!e) return false;
    if (e.durable) return true;
    if (e.until != null && now() > e.until) return false;
    if (e.uses != null && e.uses <= 0) return false;
    return true;
  }

  function grant(p) {
    const e = state.entitlements[p.name] || {};
    if (p.durable) e.durable = true;
    else {
      if (p.uses != null) e.uses = (e.uses || 0) + p.uses;
      if (p.ttl != null) e.until = Math.max(e.until || 0, now()) + p.ttl;
    }
    state.entitlements[p.name] = e;
  }

  // Consume one use of a consumable entitlement. Returns true if the player was entitled (and, for
  // an N-uses product, decrements). Durable / timed passes return true without spending a use.
  function use(name) {
    if (!entitled(name)) return false;
    const e = state.entitlements[name];
    if (e.uses != null) { e.uses -= 1; persist(); ev.emit("use", { product: name, remaining: e.uses }); }
    return true;
  }

  // Explicit purchase: runs the payment adapter, and on success records the receipt + grants the
  // entitlement (in that order, always). Returns { ok, receipt } or { ok:false, reason }.
  async function buy(name, extra = {}) {
    const p = products.get(name);
    if (!p) throw new Error(`coinslot: unknown product "${name}"`);
    let res;
    try {
      res = await pay({ product: name, amountSats: p.sats, amountFiat: p.fiat, currency: p.currency, description: p.description || name, ...extra });
    } catch (err) {
      return { ok: false, reason: "payment error: " + (err && err.message || err) };
    }
    if (!res || res.ok !== true) return { ok: false, reason: (res && res.reason) || "payment declined" };
    const receipt = { product: name, payer: identity.id, amountSats: res.amountSats ?? p.sats ?? null, currency: p.currency, txid: res.txid ?? null, ts: now() };
    grant(p);                 // paid => granted, always
    state.receipts.push(receipt);
    persist();
    ev.emit("purchase", receipt);
    return { ok: true, receipt };
  }

  // Gate an action: if already entitled, return immediately without charging; otherwise buy.
  async function require(name) {
    if (entitled(name)) return { ok: true, already: true };
    return buy(name);
  }

  const api = {
    define, buy, require, entitled, use,
    on: ev.on,
    receipts: () => state.receipts.slice(),
    entitlements: () => JSON.parse(JSON.stringify(state.entitlements)),
    price: (name) => { const p = products.get(name); return p ? { sats: p.sats, fiat: p.fiat, currency: p.currency } : null; },
  };
  return api;
}

export default { createCoinslot };
