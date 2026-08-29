// Proof for highscore: `node test.mjs`. Exits non-zero on any failure.
import { createHighscore } from "./index.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); fails++; } else console.log("ok  ", m); };
const mkStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const P = (id) => ({ id });

// 1. ranking + best-per-player (desc = higher better)
{
  const hs = createHighscore({ store: mkStore() });
  const b = hs.board("arcade");
  b.submit({ player: P("a"), score: 100 });
  b.submit({ player: P("b"), score: 250 });
  b.submit({ player: P("a"), score: 300 }); // a improves
  b.submit({ player: P("a"), score: 50 });  // ignored (worse)
  const top = b.top();
  ok(top.length === 2 && top[0].player.id === "a" && top[0].score === 300, "top sorted desc, a's best (300) leads");
  ok(top[1].player.id === "b" && top[0].rank === 1 && top[1].rank === 2, "best-per-player + ranks");
  ok(b.rank("b").rank === 2, "rank(player) returns position");
  ok(/^\S+ \S+$/.test(top[0].player.name), `player name derived via passport (${top[0].player.name})`);
}

// 2. ascending order (speedrun times — lower is better)
{
  const hs = createHighscore({ store: mkStore(), order: "asc" });
  const b = hs.board("speedrun");
  b.submit({ player: P("a"), score: 90 });
  b.submit({ player: P("a"), score: 75 }); // faster, improves
  b.submit({ player: P("b"), score: 80 });
  const top = b.top();
  ok(top[0].player.id === "a" && top[0].score === 75, "asc: fastest time ranks first, kept as best");
}

// 3. merge external entries (from a relay)
{
  const hs = createHighscore({ store: mkStore() });
  const b = hs.board("global");
  b.merge([{ player: P("x"), score: 10, ts: 1 }, { player: P("y"), score: 40, ts: 2 }, { player: P("x"), score: 55, ts: 3 }]);
  ok(b.top()[0].player.id === "x" && b.top()[0].score === 55, "merge ingests external entries, best kept");
}

// 4. verifier gates cheats
{
  const antiCheat = (e) => e.score <= 1000;                 // scores over 1000 are impossible
  const hs = createHighscore({ store: mkStore(), verify: antiCheat, verifiedOnly: true });
  const b = hs.board("arcade");
  ok(b.submit({ player: P("a"), score: 999 }) && b.top().length === 1, "a legit score is accepted");
  ok(b.submit({ player: P("cheater"), score: 999999 }) === null, "an unverifiable score is rejected");
  ok(!b.rank("cheater"), "the cheat never lands on the board");
}
{
  const hs = createHighscore({ store: mkStore(), verify: (e) => e.score <= 1000 });  // flag, don't reject
  const b = hs.board("arcade");
  b.submit({ player: P("a"), score: 999999 });
  ok(b.top()[0].verified === false, "without verifiedOnly, a suspect entry is stored but flagged unverified");
}

// 5. persistence across sessions
{
  const store = mkStore();
  createHighscore({ store }).board("arcade").submit({ player: P("a"), score: 500 });
  const b2 = createHighscore({ store }).board("arcade");
  ok(b2.top()[0].score === 500, "a new session restores the board from the store");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
