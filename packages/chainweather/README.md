# @metanet-games/chainweather

Deterministic, shared weather from the chain — the same storm for every player, un-riggable, with
no weather server. `chainseed` × `chainclock`.

Weather is a pure function of the **block hash** (the un-riggable daily variation) and the **block
height** (slow seasonal structure), optionally per **region**. Two players with the same chain
compute identical weather; nobody can rig it and nobody desyncs.

```js
import { weatherAt, createWeather } from "@metanet-games/chainweather";

// verifiable core — pure function of the chain
weatherAt({ hash, height, region: "north" });
// -> { region:"north", height, season:"autumn", temperatureC:9.4, humidity:0.7,
//      wind:0.3, windDir:212, condition:"overcast", intensity:0.7 }

// reactive over a chainclock
import { createClock } from "@metanet-games/chainclock";
const clock = createClock();
const wx = createWeather(clock);
wx.on("change", () => render(wx.current("north")));
clock.update({ height, hash, time });   // feed blocks; weather follows
wx.blended("north");                     // smooth advisory blend between blocks (rendering only)
```

## Model

- **Daily variation** — temperature offset, humidity, precip, wind, wind direction are `chainseed`
  draws off the block hash (region-salted). Un-riggable and identical for everyone.
- **Seasons** — a cosine over a configurable `yearBlocks` cycle: coldest at the year's start,
  warmest at the midpoint. `season` name tracks the quarter.
- **Condition** — classified from temperature + humidity + precip + wind into
  `clear / cloudy / overcast / fog / rain / storm / snow`.

Config (all optional): `{ midC=12, seasonAmpC=15, dailyAmpC=6, yearBlocks=144*360 }`.

## Verifiable vs advisory

`weatherAt(...)` and `current()` are verifiable — recomputable by anyone from the chain. `blended()`
lerps between the previous and current block using `clock.progress()` for smooth rendering; it's
advisory (local wall-clock) — never gate a game outcome on it, gate on `current()`.

See [SPEC.md](./SPEC.md).

MIT © metanet.games
