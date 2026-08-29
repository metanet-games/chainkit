// chainseed — verifiable deterministic randomness from a Bitcoin (BSV) block hash.
//
// The block hash is a PUBLIC, un-riggable random beacon: nobody chooses it, everybody can
// read it, and it's fixed forever once the block is mined. chainseed turns that beacon into
// an unlimited stream of independent, reproducible draws, each selected by a "path" string.
//
// Two parties with the same block hash + the same path always derive the same value, and a
// third party can re-derive it to audit that neither cheated. That's the whole point: the
// randomness is trustless because it's reproducible, not because you trust the source.
//
// Core construction (see CHAINSEED-SPEC.md for the language-agnostic version):
//     draw = HMAC-SHA256( key = blockHash, message = path )
// The block hash keys the HMAC; the path is a domain-separator so independent uses of the
// same beacon (elevation vs. moisture, seam A vs. seam B, loot vs. spawn) never collide.
//
// `beacon` is the block hash exactly as block explorers report it: lowercase big-endian hex.
// It is fed to HMAC as a UTF-8 string (not decoded to bytes) — reimplementations MUST match.

import { createHmac } from "node:crypto";

// The raw 32-byte HMAC digest for (beacon, path). Everything else is a view onto this.
export function digest(beacon, path) {
  return createHmac("sha256", String(beacon)).update(String(path)).digest();
}

// Bind a beacon once, then draw many independent values by path.
// `seed(blockHash)` returns a small object of typed draws.
export function seed(beacon) {
  return {
    beacon,
    // raw 32-byte Buffer
    bytes: (path) => digest(beacon, path),
    // single byte, 0..255
    byte: (path) => digest(beacon, path)[0],
    // float in [0,1] from the first byte — LOW resolution (256 steps).
    // Kept for callers that need this exact quantisation (e.g. blockland's noise lattice).
    unit8: (path) => digest(beacon, path)[0] / 255,
    // float in [0,1) from the first 4 bytes — full resolution; prefer this for new code.
    unit: (path) => digest(beacon, path).readUInt32BE(0) / 0x1_0000_0000,
    // integer in 0..n-1 (n <= 2^32). Uses a modulo of the first 4 bytes; the tiny modulo
    // bias is irrelevant for game-sized n. Use `unit` + your own mapping if you need exactness.
    int: (path, n) => digest(beacon, path).readUInt32BE(0) % n,
    // uniform pick from a non-empty array
    pick: (path, arr) => arr[digest(beacon, path).readUInt32BE(0) % arr.length],
    // biased coin: true with probability p (default 0.5)
    chance: (path, p = 0.5) => digest(beacon, path).readUInt32BE(0) / 0x1_0000_0000 < p,
  };
}

export default seed;
