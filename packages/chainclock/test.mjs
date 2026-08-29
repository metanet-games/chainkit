// Proof for chainclock: `node test.mjs`. Exits non-zero on any failure.
import { createClock, BLOCKS_PER_DAY } from "./index.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); fails++; } else console.log("ok  ", m); };

let clock = 1000;
const now = () => clock;

// 1. ticks + genesis offset + advanced count
{
  const c = createClock({ genesis: 900000, now });
  const ticks = [];
  c.on("tick", (t) => ticks.push(t));
  c.update({ height: 900000, hash: "h0", time: 1000 });
  c.update({ height: 900001, hash: "h1", time: 1600 });
  c.update({ height: 900004, hash: "h4", time: 3400 }); // skipped 2
  ok(c.tick === 4 && c.height === 900004, "tick = height - genesis");
  ok(ticks[0].first === true && ticks[0].tick === 0, "first update starts the clock at tick 0");
  ok(ticks[2].advanced === 3, "advanced count reflects skipped blocks");
  ok(c.hash === "h4" && c.hashAt(900001) === "h1", "current hash + hashAt(history)");
}

// 2. phases + epochs
{
  const c = createClock({ now });
  const names = ["dawn", "day", "dusk", "night"]; // 4 equal parts of a 144-block day
  c.update({ height: 0, hash: "g", time: 0 });
  ok(c.phase(BLOCKS_PER_DAY, names) === "dawn", "height 0 -> dawn");
  c.update({ height: 72, hash: "a", time: 0 });   // halfway through the day
  ok(c.phase(BLOCKS_PER_DAY, names) === "dusk", "height 72 (half day) -> dusk");
  c.update({ height: 143, hash: "b", time: 0 });  // end of day
  ok(c.phase(BLOCKS_PER_DAY, names) === "night", "height 143 -> night");
  c.update({ height: 144, hash: "c", time: 0 });  // next day
  ok(c.phase(BLOCKS_PER_DAY, names) === "dawn" && c.epoch(BLOCKS_PER_DAY) === 1, "height 144 -> dawn of day/epoch 1");
  ok(Math.abs(c.cyclePos(144) - 0) < 1e-9, "cyclePos wraps to 0 at a full cycle");
}

// 3. reorg + stale handling
{
  const c = createClock({ now });
  let reorg = null, tickCount = 0;
  c.on("reorg", (r) => { reorg = r; });
  c.on("tick", () => tickCount++);
  c.update({ height: 10, hash: "A", time: 0 });
  c.update({ height: 10, hash: "B", time: 0 });   // same height, different hash = tip reorg
  ok(reorg && reorg.prevHash === "A" && c.hash === "B", "same-height different-hash emits reorg + updates hash");
  const before = tickCount;
  ok(c.update({ height: 9, hash: "old", time: 0 }) === "stale", "a lower height is stale");
  ok(tickCount === before && c.height === 10, "stale block does not tick or change tip");
}

// 4. advisory progress interpolation (local wall-clock)
{
  clock = 5000;
  const c = createClock({ expectedBlockMs: 600000, now });
  c.update({ height: 1, hash: "x", time: 0 });    // localAt = 5000
  ok(c.progress() === 0, "progress is 0 right after a block");
  clock = 5000 + 300000;                          // half an expected block later
  ok(Math.abs(c.progress() - 0.5) < 1e-9, "progress interpolates to ~0.5 halfway");
  clock = 5000 + 900000;                          // past a full interval
  ok(c.progress() === 1, "progress clamps to 1");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
