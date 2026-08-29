// Proof for satchel: `node test.mjs`. Exits non-zero on any failure.
import { createSatchel } from "./index.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); fails++; } else console.log("ok  ", m); };
const mkStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

// 1. local add / has / count
{
  const bag = createSatchel({ identity: { id: "a" }, store: mkStore() });
  const sword = bag.add({ type: "sword", meta: { atk: 5 } });
  ok(bag.has("sword") && bag.count("sword") === 1, "add a local item; has/count reflect it");
  ok(sword.origin === "local" && sword.owned, "local item is tagged origin:local");
}

// 2. stackable consumables merge by type; non-stackable stay distinct
{
  const bag = createSatchel({ identity: { id: "b" }, store: mkStore() });
  bag.add({ type: "potion", stackable: true });
  bag.add({ type: "potion", stackable: true, qty: 2 });
  ok(bag.count("potion") === 3 && bag.items().filter((i) => i.type === "potion").length === 1, "stackable potions merge into qty 3");
  bag.add({ type: "gem" }); bag.add({ type: "gem" });
  ok(bag.items().filter((i) => i.type === "gem").length === 2, "non-stackable gems stay distinct");
}

// 3. remove / decrement
{
  const bag = createSatchel({ identity: { id: "c" }, store: mkStore() });
  const p = bag.add({ type: "arrow", stackable: true, qty: 5 });
  ok(bag.remove(p.id, 2) && bag.count("arrow") === 3, "decrement a stack");
  ok(bag.remove(p.id) && bag.count("arrow") === 0, "full remove clears the item");
  ok(bag.remove("nope") === false, "removing a missing id returns false");
}

// 4. sync merges on-chain items via the chain adapter
{
  const chain = { list: async (pub) => [{ outpoint: "tx1_0", type: "ordinal", meta: { name: "Cyber ID #404", pub } }] };
  const bag = createSatchel({ identity: { id: "d", pubkey: "02abc" }, store: mkStore(), chain });
  bag.add({ type: "potion", stackable: true, qty: 2 });
  await bag.sync();
  ok(bag.has("ordinal") && bag.count("ordinal") === 1, "on-chain ordinal appears after sync");
  const ord = bag.items().find((i) => i.type === "ordinal");
  ok(ord.origin === "chain" && ord.ref === "tx1_0", "on-chain item tagged origin:chain with its ref");
  ok(bag.items().length === 2, "merged view holds both local and chain items");
}

// 5. local persists across sessions; chain items are re-synced (not persisted)
{
  const store = mkStore();
  const chain = { list: async () => [{ outpoint: "tx9_0", type: "ordinal" }] };
  const s1 = createSatchel({ identity: { id: "e" }, store, chain });
  s1.add({ type: "key" });
  await s1.sync();
  const s2 = createSatchel({ identity: { id: "e" }, store, chain });
  ok(s2.has("key") && !s2.has("ordinal"), "new session restores LOCAL items; chain items need a re-sync");
  await s2.sync();
  ok(s2.has("ordinal"), "re-sync brings the on-chain items back");
}

// 6. requires an identity
{
  let threw = false; try { createSatchel({ store: mkStore() }); } catch { threw = true; }
  ok(threw, "satchel requires an identity with an id");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
