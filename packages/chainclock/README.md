# @metanet-games/chainclock

A block-driven world tick — one shared clock nobody controls. Zero dependencies.

Every block is a tick; day/night, seasons and rounds are derived deterministically from block
height, so every player's world runs on the exact same schedule with **no time server**. You feed
it blocks (from your node, WoC, or a headers service); it emits ticks and gives you phase helpers.

```js
import { createClock, BLOCKS_PER_DAY } from "@metanet-games/chainclock";

const clock = createClock({ genesis: 900000 }); // treat height 900000 as tick 0

clock.on("tick",  ({ tick, height, hash }) => advanceWorld(tick));
clock.on("reorg", ({ height, hash })       => resyncTip(height, hash));

// feed it whenever you learn a new tip
clock.update({ height, hash, time });

clock.phase(BLOCKS_PER_DAY, ["dawn", "day", "dusk", "night"]); // -> current phase
clock.epoch(BLOCKS_PER_DAY);      // which day/season number
clock.cyclePos(BLOCKS_PER_DAY);   // 0..1 through the current cycle
clock.progress();                 // ADVISORY: smooth 0..1 to the next block (animation only)
```

`~144` blocks (10-minute target) ≈ one real day — a handy default cycle (`BLOCKS_PER_DAY`).

## Verifiable vs advisory

- **Verifiable:** `tick`, `height`, `hash`, `phase`, `epoch`, `cyclePos` — all pure functions of
  block height. Anyone with the chain computes the same values. This is the shared clock.
- **Advisory:** `progress()` interpolates smooth time between blocks from your local wall-clock.
  It's for animation only — not verifiable, not consensus. Never gate a payout, a spawn, or any
  outcome on it; gate those on `tick`/`hash`.

## Pairs with

`chainseed` — seed per-tick randomness off `clock.hash` for deterministic, shared events (weather,
spawns, drops) that every player sees identically. That combination is what `chainweather` is.

See [SPEC.md](./SPEC.md) for the tick/reorg model and helpers.

MIT © metanet.games
