// Proof for chainweather: `node test.mjs`. Exits non-zero on any failure.
import { weatherAt, createWeather, CONDITIONS } from "./index.mjs";
import { createClock } from "@metanet-games/chainclock";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); fails++; } else console.log("ok  ", m); };
const H = (n) => "0".repeat(60) + String(n).padStart(4, "0"); // stand-in block hashes

// 1. deterministic: same inputs -> identical weather (this is the whole point)
{
  const a = weatherAt({ hash: H(1), height: 500, region: "north" });
  const b = weatherAt({ hash: H(1), height: 500, region: "north" });
  ok(JSON.stringify(a) === JSON.stringify(b), "same hash+height+region -> identical weather");
}

// 2. region variation: different regions diverge under the same block
{
  const n = weatherAt({ hash: H(2), height: 500, region: "north" });
  const s = weatherAt({ hash: H(2), height: 500, region: "south" });
  ok(JSON.stringify(n) !== JSON.stringify(s), "different regions get different weather from the same block");
}

// 3. seasonal structure: with daily variation off, winter is colder than summer
{
  const cfg = { dailyAmpC: 0, yearBlocks: 4 };            // 4-block year: h0=winter .. h2=summer
  const winter = weatherAt({ hash: H(3), height: 0, region: "x" }, cfg);
  const summer = weatherAt({ hash: H(3), height: 2, region: "x" }, cfg);
  ok(winter.temperatureC < summer.temperatureC, `winter (${winter.temperatureC}) colder than summer (${summer.temperatureC})`);
  ok(winter.season === "winter" && summer.season === "summer", "season names track the year cycle");
}

// 4. well-formed fields across many blocks
{
  let allValid = true;
  for (let i = 0; i < 200; i++) {
    const w = weatherAt({ hash: H(i), height: i * 37, region: "r" });
    if (!CONDITIONS.includes(w.condition)) allValid = false;
    if (!(w.humidity >= 0 && w.humidity <= 1 && w.wind >= 0 && w.wind <= 1 && w.intensity >= 0 && w.intensity <= 1)) allValid = false;
    if (!(w.windDir >= 0 && w.windDir < 360)) allValid = false;
  }
  ok(allValid, "over 200 blocks: condition in set, humidity/wind/intensity in [0,1], windDir in [0,360)");
  ok(weatherAt({ hash: H(0) }).height === 0, "height defaults to 0");
  let threw = false; try { weatherAt({}); } catch { threw = true; }
  ok(threw, "weatherAt without a hash throws");
}

// 5. reactive wrapper tracks the clock
{
  const clock = createClock();
  const wx = createWeather(clock);
  ok(wx.current() === null, "no weather before the clock has a tip");
  let changes = 0;
  wx.on("change", () => changes++);
  clock.update({ height: 100, hash: H(11), time: 0 });
  const first = wx.current("town");
  ok(first && first.height === 100, "current() reflects the clock's tip");
  clock.update({ height: 101, hash: H(12), time: 0 });
  ok(changes === 2 && wx.current("town").height === 101, "current() updates and change fires on each tick");
  ok(JSON.stringify(wx.current("town")) === JSON.stringify(weatherAt({ hash: H(12), height: 101, region: "town" })), "wrapper matches the pure function");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
