// SPDX-License-Identifier: Apache-2.0
// chainweather — deterministic, shared weather from the chain. No weather server.
//
// Every player sees the same storm roll in, because weather is a pure function of the block hash
// (the un-riggable daily variation, via chainseed) and the block height (slow seasonal structure).
// Two players with the same chain compute identical weather; nobody can rig it or desync.
//
// `weatherAt({hash,height,region})` is the verifiable core. `createWeather(clock)` is a thin
// reactive wrapper over chainclock that recomputes on each block and can smoothly blend between
// blocks for rendering (advisory only).
//
// Composes chainseed (un-riggable draws) + chainclock (height/season + block feed).
import { seed } from "@metanet-games/chainseed";
import { BLOCKS_PER_DAY } from "@metanet-games/chainclock";

const DEFAULTS = { midC: 12, seasonAmpC: 15, dailyAmpC: 6, yearBlocks: BLOCKS_PER_DAY * 360 };
const SEASONS = ["winter", "spring", "summer", "autumn"];
export const CONDITIONS = ["clear", "cloudy", "overcast", "fog", "rain", "storm", "snow"];
const r1 = (x) => Math.round(x * 10) / 10;

function emitter() {
  const map = new Map();
  return {
    on(ev, cb) { (map.get(ev) || map.set(ev, new Set()).get(ev)).add(cb); return () => map.get(ev)?.delete(cb); },
    emit(ev, arg) { for (const cb of map.get(ev) || []) cb(arg); },
  };
}

// The verifiable core: deterministic weather for a block hash + height + region.
export function weatherAt({ hash, height = 0, region = "" } = {}, cfg = {}) {
  if (!hash) throw new Error("chainweather.weatherAt needs a block hash");
  const { midC, seasonAmpC, dailyAmpC, yearBlocks } = { ...DEFAULTS, ...cfg };
  const s = seed(hash);
  const pos = (((height % yearBlocks) + yearBlocks) % yearBlocks) / yearBlocks; // 0..1 through the year
  const seasonal = midC - seasonAmpC * Math.cos(2 * Math.PI * pos);             // coldest at pos 0, warmest at 0.5
  const temperatureC = seasonal + (s.unit(`${region}:temp`) - 0.5) * 2 * dailyAmpC;
  const humidity = s.unit(`${region}:humidity`);
  const precip = s.unit(`${region}:precip`);
  const wind = s.unit(`${region}:wind`);
  const windDir = s.int(`${region}:winddir`, 360);

  let condition, intensity;
  if (temperatureC < 0 && precip > 0.5) { condition = "snow"; intensity = precip; }
  else if (precip > 0.8 && wind > 0.6) { condition = "storm"; intensity = precip; }
  else if (precip > 0.6) { condition = "rain"; intensity = precip; }
  else if (humidity > 0.8 && wind < 0.3) { condition = "fog"; intensity = humidity; }
  else if (humidity > 0.6) { condition = "overcast"; intensity = humidity; }
  else if (humidity > 0.4) { condition = "cloudy"; intensity = humidity; }
  else { condition = "clear"; intensity = 1 - humidity; }

  return {
    region, height, season: SEASONS[Math.min(3, Math.floor(pos * 4))],
    temperatureC: r1(temperatureC), humidity: r1(humidity), wind: r1(wind), windDir,
    condition, intensity: r1(intensity),
  };
}

// Reactive wrapper over a chainclock: current weather + smooth (advisory) blend between blocks.
export function createWeather(clock, cfg = {}) {
  const ev = emitter();
  const off = clock.on("tick", (t) => ev.emit("change", { height: t.height, hash: t.hash }));
  return {
    on: ev.on,
    current(region = "") {
      return clock.hash == null ? null : weatherAt({ hash: clock.hash, height: clock.height, region }, cfg);
    },
    // ADVISORY: lerp the previous block's weather toward the current one by clock.progress(), for
    // smooth rendering between blocks. The canonical weather is `current()`; don't gate on this.
    blended(region = "") {
      const cur = this.current(region);
      if (!cur) return null;
      const ph = clock.hashAt(clock.height - 1);
      if (!ph) return cur;
      const prev = weatherAt({ hash: ph, height: clock.height - 1, region }, cfg);
      const k = clock.progress();
      const lerp = (a, b) => r1(a + (b - a) * k);
      return { ...cur, temperatureC: lerp(prev.temperatureC, cur.temperatureC), humidity: lerp(prev.humidity, cur.humidity), wind: lerp(prev.wind, cur.wind), condition: k < 0.5 ? prev.condition : cur.condition, blended: true };
    },
    stop() { off && off(); },
  };
}

export default { weatherAt, createWeather, CONDITIONS };
