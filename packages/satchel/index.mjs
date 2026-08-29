// SPDX-License-Identifier: Apache-2.0
// satchel — inventory: local for a wallet-less player, real on-chain items when they connect.
//
// Fun before wallet: a player collects items locally (persisted per identity) with no wallet at
// all. When they connect one, `sync()` pulls their on-chain items (e.g. 1Sat Ordinals) through a
// pluggable chain adapter and merges them into the same bag — each item tagged with its origin
// ("local" vs "chain") so your UI can show what's truly owned on-chain.
//
// satchel doesn't talk to any indexer itself; you provide `chain.list(pubkey)`. Zero dependencies.
// Pairs with passport (pass a passport identity so the bag follows the player).

function emitter() {
  const map = new Map();
  return {
    on(ev, cb) { (map.get(ev) || map.set(ev, new Set()).get(ev)).add(cb); return () => map.get(ev)?.delete(cb); },
    emit(ev, arg) { for (const cb of map.get(ev) || []) cb(arg); },
  };
}

const memStore = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; })();

export function createSatchel({ identity, store = memStore, chain = null, now = () => Date.now() } = {}) {
  if (!identity || !identity.id) throw new Error("satchel: an identity with an id is required (pair with @metanet-games/passport)");
  const KEY = "satchel:" + identity.id;
  const ev = emitter();
  let local = { items: {} };
  try { const raw = store.getItem(KEY); if (raw) local = JSON.parse(raw); } catch { /* fresh */ }
  let chainItems = [];

  const persist = () => { try { store.setItem(KEY, JSON.stringify(local)); } catch { /* best effort */ } };
  const items = () => [...Object.values(local.items), ...chainItems];
  const emit = () => ev.emit("change", items());

  // Add a LOCAL item. `stackable` items merge by type (consumables); otherwise each is distinct.
  function add(item) {
    if (!item || !item.type) throw new Error("satchel.add needs an item with a `type`");
    const qty = item.qty ?? 1;
    if (!item.id && item.stackable) {
      const stack = Object.values(local.items).find((i) => i.type === item.type && i.stackable);
      if (stack) { stack.qty += qty; persist(); emit(); return stack; }
    }
    const id = item.id || `${item.type}:${now()}:${Math.random().toString(36).slice(2, 8)}`;
    const it = { id, type: item.type, qty, meta: item.meta ?? null, origin: "local", stackable: !!item.stackable, owned: true };
    local.items[id] = it; persist(); emit(); return it;
  }

  // Remove/decrement a LOCAL item by id. On-chain items aren't removable here (spending needs a tx).
  function remove(id, qty) {
    const it = local.items[id];
    if (!it) return false;
    if (qty != null && it.qty > qty) { it.qty -= qty; persist(); emit(); return true; }
    delete local.items[id]; persist(); emit(); return true;
  }

  // Pull on-chain items for the connected wallet and merge them in (origin:"chain").
  async function sync() {
    if (!chain || typeof chain.list !== "function") return items();
    const pub = identity.pubkey || identity.id;
    const list = await chain.list(pub);
    chainItems = (list || []).map((x) => ({
      id: x.id || x.outpoint || x.txid,
      type: x.type || "ordinal",
      qty: 1,
      meta: x.meta ?? x,
      origin: "chain",
      owned: true,
      ref: x.outpoint || x.txid || null,
    }));
    emit();
    return items();
  }

  return {
    add, remove, sync, items,
    get: (id) => items().find((i) => i.id === id) || null,
    has: (type) => items().some((i) => i.type === type),
    count: (type) => items().filter((i) => i.type === type).reduce((n, i) => n + (i.qty || 1), 0),
    on: ev.on,
    identity,
  };
}

export default { createSatchel };
