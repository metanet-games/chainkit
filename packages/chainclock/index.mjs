// SPDX-License-Identifier: Apache-2.0
// chainclock — a block-driven world tick: one shared clock nobody controls.
//
// The BSV chain is a monotonic heartbeat — a new block roughly every ten minutes, each with a
// height, a hash, and a timestamp. chainclock turns that into a game clock: every block is a
// tick, and named cycles (day/night, seasons, rounds) are derived deterministically from the
// height, so every player's world is on the exact same schedule with no time server.
//
// You feed it blocks (from your node, WoC, or a headers service); it emits ticks and gives you
// phase/epoch helpers. The VERIFIABLE part is the height and hash — anyone with the chain agrees.
// The optional `progress()` interpolation (smooth time until the next block) is LOCAL and
// advisory, for animation only; never gate anything meaningful on it.
//
// Zero dependencies. Pairs with chainseed (seed per-tick randomness off the block hash) to build
// things like deterministic shared weather.

const now0 = () => Date.now();

function emitter() {
  const map = new Map();
  return {
    on(ev, cb) { (map.get(ev) || map.set(ev, new Set()).get(ev)).add(cb); return () => map.get(ev)?.delete(cb); },
    emit(ev, arg) { for (const cb of map.get(ev) || []) cb(arg); },
  };
}

// ~144 blocks (10-min target) ≈ one real day — a handy default cycle length.
export const BLOCKS_PER_DAY = 144;

export function createClock({ genesis = 0, history = 128, expectedBlockMs = 600000, now = now0 } = {}) {
  let tip = null;                 // { height, hash, time }
  let localAt = now();            // wall-clock time we received the current tip
  const hashes = new Map();       // height -> hash (bounded ring)
  const ev = emitter();

  const remember = (h, hash) => {
    hashes.set(h, hash);
    if (hashes.size > history) hashes.delete(hashes.keys().next().value);
  };
  const tickOf = (h) => h - genesis;
  const mod = (a, n) => ((a % n) + n) % n;

  const api = {
    on: ev.on,
    get height() { return tip ? tip.height : null; },
    get hash() { return tip ? tip.hash : null; },
    get time() { return tip ? tip.time : null; },   // the block's own unix timestamp — "chain time"
    get tick() { return tip ? tickOf(tip.height) : null; },
    hashAt(h) { return hashes.get(h) ?? null; },

    // Feed a chain tip. Monotonic: advances on a higher block, signals a tip-height reorg, ignores
    // stale/duplicate blocks. `time` is the block's unix timestamp (seconds), optional.
    update({ height, hash, time } = {}) {
      if (typeof height !== "number" || !hash) throw new Error("chainclock.update needs { height, hash, time? }");
      if (!tip) {
        tip = { height, hash, time }; remember(height, hash); localAt = now();
        ev.emit("tick", { tick: tickOf(height), height, hash, time, advanced: 0, first: true });
        return "start";
      }
      if (height > tip.height) {
        const advanced = height - tip.height;
        tip = { height, hash, time }; remember(height, hash); localAt = now();
        ev.emit("tick", { tick: tickOf(height), height, hash, time, advanced });
        return "tick";
      }
      if (height === tip.height && hash !== tip.hash) {
        const prevHash = tip.hash;
        tip = { height, hash, time }; remember(height, hash); localAt = now();
        ev.emit("reorg", { height, hash, prevHash });
        return "reorg";
      }
      return "stale"; // older or duplicate — ignored
    },

    // Position within a `period`-block cycle, in [0,1). e.g. cyclePos(BLOCKS_PER_DAY).
    cyclePos(period) { return tip ? mod(tickOf(tip.height), period) / period : 0 },
    // Which cycle we're in (season number, day number…): floor(tick / period).
    epoch(period) { return tip ? Math.floor(tickOf(tip.height) / period) : 0 },
    // Current named phase of a cycle, splitting it into equal parts.
    // e.g. phase(BLOCKS_PER_DAY, ["dawn","day","dusk","night"]).
    phase(period, names) {
      if (!Array.isArray(names) || !names.length) throw new Error("chainclock.phase needs a non-empty names[]");
      return names[Math.min(names.length - 1, Math.floor(api.cyclePos(period) * names.length))];
    },
    // ADVISORY ONLY: fraction toward the next expected block from wall-clock. For smooth animation;
    // not verifiable, not consensus. Clamped to [0,1].
    progress(nowMs = now()) { return Math.max(0, Math.min(1, (nowMs - localAt) / expectedBlockMs)) },
  };
  return api;
}

export default { createClock, BLOCKS_PER_DAY };
