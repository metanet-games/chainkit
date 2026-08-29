// SPDX-License-Identifier: Apache-2.0
// fairdrop — provably-fair random outcomes bound to a FUTURE Bitcoin (BSV) block.
//
// Use it for loot, dice, crates, matchmaking seeds — any outcome where a player must be able
// to prove afterward that nobody (not them, not the house) rigged it.
//
// The mechanism, in one line:
//     outcome = weighted_pick( table, chainseed( beacon, "<dropId>:<nonce>" ) )
// where `beacon` is the hash of a block that DID NOT EXIST when the drop was committed.
//
// Why that's fair:
//   1. You publish (and ideally anchor/timestamp) a commitment BEFORE block H is mined:
//      {dropId, height H, table}. The table and the resolving block are now locked.
//   2. Nobody can know block H's hash in advance, so nobody can pick a table or a moment that
//      steers the result. When H is mined, the outcome is forced and anyone can recompute it
//      from public data alone — no trusted server, no secret seed required.
//
// The one real residual attacker is a MINER of block H, who could grind candidate blocks to
// nudge outcomes. For game-sized stakes that's economically absurd (grinding a block costs far
// more than any drop is worth). For higher stakes, add committed `seeds`: each party publishes
// hash(seed) at commit time and reveals seed at resolve time; the outcome mixes them in, so a
// grinding miner is working blind — they can't target an outcome they can't yet compute. Belt,
// then suspenders. See FAIRDROP-SPEC.md.
//
// Randomness comes entirely from ./chainseed.mjs; fairdrop only adds commitment + weighting.

import { createHash } from "node:crypto";
import { seed } from "@metanet-games/chainseed";

const sha256hex = (s) => createHash("sha256").update(String(s)).digest("hex");

// Canonical serialization of the committed facts — this is what you publish and anchor.
function commitmentDigest({ dropId, height, table, seedCommitments }) {
  return sha256hex(JSON.stringify({ dropId, height, table, seedCommitments }));
}

// The beacon fed to chainseed: the block hash alone, or mixed with revealed seeds.
function mixBeacon(blockHash, reveals) {
  return reveals.length ? sha256hex(blockHash + "|" + reveals.join("|")) : String(blockHash);
}

function assertTable(table) {
  if (!Array.isArray(table) || table.length === 0) throw new Error("fairdrop: empty table");
  for (const row of table) {
    if (!(Number(row.weight) > 0)) throw new Error("fairdrop: weights must be > 0");
  }
}

// Weighted pick over `table` using one chainseed draw in [0,1).
function weightedPick(s, path, table) {
  const total = table.reduce((a, r) => a + r.weight, 0);
  let r = s.unit(path) * total;
  for (let i = 0; i < table.length; i++) {
    if ((r -= table[i].weight) < 0) return { index: i, item: table[i].item, roll: r + table[i].weight };
  }
  const last = table.length - 1; // floating-point fall-through
  return { index: last, item: table[last].item, roll: total };
}

// ---- commit (before block `height` exists) ----
// table: [{ item, weight }, ...]  ·  seeds: optional secret strings you'll reveal at resolve.
// Returns the commitment; publish/anchor `commitment.digest` before the block is mined.
export function commit({ dropId, height, table, seeds = [] }) {
  assertTable(table);
  if (!(Number.isInteger(height) && height >= 0)) throw new Error("fairdrop: height must be a block height");
  const seedCommitments = seeds.map(sha256hex);
  const c = { dropId: String(dropId), height, table, seedCommitments };
  return { ...c, digest: commitmentDigest(c) };
}

// ---- resolve (after block `height` is mined) ----
// ctx: { blockHash, reveals?: string[], nonce?: number }
// `reveals` must match, in order, the `seeds` given at commit time (verified here).
// `nonce` draws independent additional outcomes from the same commitment+block (0,1,2,…).
export function resolve(commitment, { blockHash, reveals = [], nonce = 0 }) {
  if (!blockHash) throw new Error("fairdrop: blockHash required to resolve");
  const expect = commitment.seedCommitments || [];
  if (reveals.length !== expect.length) throw new Error("fairdrop: reveal count != commitment count");
  reveals.forEach((r, i) => {
    if (sha256hex(r) !== expect[i]) throw new Error(`fairdrop: reveal ${i} does not match its commitment`);
  });
  const beacon = mixBeacon(blockHash, reveals);
  const s = seed(beacon);
  const pick = weightedPick(s, `${commitment.dropId}:${nonce}`, commitment.table);
  return { ...pick, nonce, beacon, blockHash };
}

// ---- verify (anyone, from published data) ----
// Recomputes the outcome and checks it equals what was claimed. Returns true/false; never throws
// on a plain mismatch of expectations — only on structurally invalid input.
export function verify(commitment, ctx, expected) {
  if (commitmentDigest(commitment) !== commitment.digest) return false; // commitment was altered
  const got = resolve(commitment, ctx);
  if (expected == null) return true;
  if (typeof expected === "object") return got.index === expected.index && got.item === expected.item;
  return got.item === expected;
}

export { sha256hex };
export default { commit, resolve, verify };
