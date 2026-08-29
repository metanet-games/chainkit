// Proof for fairdrop: run `node fairdrop.test.mjs`. Exits non-zero on any failure.
import { createHash } from "node:crypto";
import { commit, resolve, verify } from "@metanet-games/fairdrop";

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); fails++; } else console.log("ok  ", msg); };
const fakeBlockHash = (h) => createHash("sha256").update("block:" + h).digest("hex"); // stand-in for a real block hash

const table = [
  { item: "common",    weight: 80 },
  { item: "rare",      weight: 15 },
  { item: "legendary", weight: 5 },
];

// 1. round-trip: a third party recomputes the same outcome from public data
{
  const c = commit({ dropId: "chest-1", height: 900001, table });
  const bh = fakeBlockHash(900001);
  const r = resolve(c, { blockHash: bh });
  ok(verify(c, { blockHash: bh }, r), "independent verify reproduces the resolved item");
  ok(resolve(c, { blockHash: bh }).item === r.item, "resolve is deterministic (same block -> same item)");
}

// 2. seed-hardened mode: reveals must match commitments, and a bad reveal is rejected
{
  const playerSeed = "player-secret-abc", houseSeed = "house-secret-xyz";
  const c = commit({ dropId: "chest-2", height: 900002, table, seeds: [playerSeed, houseSeed] });
  const bh = fakeBlockHash(900002);
  const r = resolve(c, { blockHash: bh, reveals: [playerSeed, houseSeed] });
  ok(verify(c, { blockHash: bh, reveals: [playerSeed, houseSeed] }, r), "seed-hardened round-trip verifies");
  let threw = false;
  try { resolve(c, { blockHash: bh, reveals: [playerSeed, "wrong"] }); } catch { threw = true; }
  ok(threw, "a reveal that doesn't match its commitment is rejected");
}

// 3. tamper detection: editing the table after commit breaks verification
{
  const c = commit({ dropId: "chest-3", height: 900003, table });
  const bh = fakeBlockHash(900003);
  const r = resolve(c, { blockHash: bh });
  const tampered = { ...c, table: [{ item: "legendary", weight: 100 }] }; // house tries to rig post-hoc
  ok(verify(tampered, { blockHash: bh }, r) === false, "post-hoc table edit fails verification (digest mismatch)");
}

// 4. nonce draws independent outcomes from one commitment+block
{
  const c = commit({ dropId: "burst", height: 900004, table });
  const bh = fakeBlockHash(900004);
  const a = resolve(c, { blockHash: bh, nonce: 0 }).roll;
  const b = resolve(c, { blockHash: bh, nonce: 1 }).roll;
  ok(a !== b, "different nonces give independent rolls");
}

// 5. distribution: over many DISTINCT block hashes the weights are respected (~80/15/5)
{
  const c = commit({ dropId: "dist", height: 0, table });
  const N = 60000, counts = { common: 0, rare: 0, legendary: 0 };
  for (let i = 0; i < N; i++) counts[resolve(c, { blockHash: fakeBlockHash("d" + i) }).item]++;
  const pct = (k) => (100 * counts[k] / N);
  const near = (got, want, tol) => Math.abs(got - want) < tol;
  console.log(`    dist: common ${pct("common").toFixed(2)}%  rare ${pct("rare").toFixed(2)}%  legendary ${pct("legendary").toFixed(2)}%`);
  ok(near(pct("common"), 80, 1.0), "common ~80%");
  ok(near(pct("rare"), 15, 1.0), "rare ~15%");
  ok(near(pct("legendary"), 5, 0.7), "legendary ~5%");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
