# chainweather — spec (v0.1)

Deterministic, shared weather from the chain. Reference impl `index.mjs`, proof `test.mjs`.
Composes `@metanet-games/chainseed` + `@metanet-games/chainclock`.

## Core: `weatherAt({ hash, height, region }, cfg?)`

A pure function → a weather state. Deterministic in all inputs, so every player with the same
chain gets the same weather. `hash` is required (the block hash beacon); `height` (default 0)
drives seasons; `region` (default "") lets different places differ under the same block.

Derivation:

- Draws off `chainseed.seed(hash)` with region-salted paths — `"<region>:temp"`, `":humidity"`,
  `":precip"`, `":wind"`, `":winddir"` — give the un-riggable daily variation.
- **Seasonal temperature** = `midC - seasonAmpC · cos(2π · pos)` where `pos = (height mod yearBlocks)
  / yearBlocks`. Coldest at `pos 0`, warmest at `pos 0.5`. Final temperature adds a daily offset of
  `±dailyAmpC` from the hash.
- **Condition** is classified from temperature/humidity/precip/wind (snow < 0 °C + precip; storm =
  heavy precip + wind; rain; fog = humid + calm; overcast; cloudy; else clear).

Returns `{ region, height, season, temperatureC, humidity, wind, windDir, condition, intensity }`
with `humidity/wind/intensity ∈ [0,1]`, `windDir ∈ [0,360)`, `condition ∈ CONDITIONS`.

Config: `{ midC=12, seasonAmpC=15, dailyAmpC=6, yearBlocks=BLOCKS_PER_DAY*360 }`.

## Reactive: `createWeather(clock, cfg?)`

Thin wrapper over a `chainclock`:

- `current(region)` — weather for the clock's current tip (`null` before the first block).
- `on("change", cb)` — fires on each clock `tick`.
- `blended(region)` — **advisory**: lerps the previous block's weather toward the current by
  `clock.progress()`, for smooth rendering between blocks. Condition switches at the midpoint.
- `stop()` — unsubscribe from the clock.

## Verifiable vs advisory

`weatherAt` and `current()` are verifiable (pure functions of the chain). `blended()` mixes in
local wall-clock via `progress()` and is for animation only — never gate a game outcome on it.

## Design notes

- Weather is intentionally a function of the block hash, not a hidden server RNG, so it inherits
  chainseed's property: anyone can recompute and audit today's weather.
- Per-block conditions can still change between adjacent blocks (each hash is independent); the
  seasonal term provides the slow through-line, and `blended()` smooths the visual transition.
- Deterministic real-number math: results assume IEEE-754 order as written (same caveat as
  chainscape for bit-exact cross-language ports).

## Non-goals

Not a physical weather simulation, not a forecast, not a map/region system — it emits a weather
state for a (hash, height, region) key and leaves geography and rendering to your game.

## License & implementation

This specification is free for anyone to implement, in any language, royalty-free — writing it
down is the point. The reference implementation is licensed under Apache-2.0; the specification
itself places no restriction on independent, clean-room implementations.
