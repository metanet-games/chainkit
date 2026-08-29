# chainclock — spec (v0.1)

A block-driven world tick. Reference impl `index.mjs`, proof `test.mjs`. Zero dependencies.

## Model

The clock tracks a single chain **tip** `{ height, hash, time }` that you feed via `update()`.

- **tick** = `height - genesis` (genesis defaults to 0). Every new block is one tick.
- **time** = the block's own unix timestamp — "chain time", as opposed to local wall-clock.

`update({ height, hash, time })` is monotonic and idempotent:

| incoming | action | returns |
|----------|--------|---------|
| first ever | set tip, emit `tick` with `first:true`, `advanced:0` | `"start"` |
| `height > tip.height` | advance tip, emit `tick` (`advanced` = blocks jumped) | `"tick"` |
| `height === tip.height`, different hash | tip-height **reorg**: update hash, emit `reorg` | `"reorg"` |
| `height < tip.height`, or duplicate | ignored | `"stale"` |

Events: `tick { tick, height, hash, time, advanced, first? }`, `reorg { height, hash, prevHash }`.

A bounded history of `height -> hash` (default 128) is kept; `hashAt(height)` reads it.

## Derived cycles (deterministic, shared)

All pure functions of `tick`, so every player agrees:

- `cyclePos(period)` — position within a `period`-block cycle, `[0,1)`.
- `epoch(period)` — `floor(tick / period)`: which cycle (day number, season number…).
- `phase(period, names)` — splits a cycle into `names.length` equal parts and returns the current
  one, e.g. `phase(144, ["dawn","day","dusk","night"])`.

`BLOCKS_PER_DAY = 144` (≈ one real day at the 10-minute block target) is exported as a default.

## Verifiable vs advisory — the important line

Everything above is **verifiable**: computed from block height/hash, reproducible by anyone with
the chain. `progress(nowMs)` is **advisory**: it interpolates `[0,1]` toward the next expected
block using local wall-clock (`(now - localReceiptTime) / expectedBlockMs`, clamped). It exists so
animations can move between blocks; it is not verifiable and not consensus. Gate meaningful
outcomes (payouts, spawns, drops) on `tick`/`hash`, never on `progress()`.

## Reorgs

Only tip-height reorgs are surfaced (same height, new hash) via the `reorg` event — resync your
view and, if you seeded anything off the old hash, recompute it. Deeper reorgs arrive as normal
higher-height `tick`s. chainclock does not itself decide the canonical chain; that's your block
source's job.

## Non-goals

Not a block source (you feed it), not a scheduler/timer, not wall-clock time. It converts a stream
of chain tips into a shared game clock and leaves fetching, animation loops, and persistence to you.
