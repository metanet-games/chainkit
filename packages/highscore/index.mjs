// SPDX-License-Identifier: Apache-2.0
// highscore — leaderboards you can trust. Basic today; un-forgeable when you wire in a verifier.
//
// Maintains ranked, best-per-player boards over whatever backend you have: a local store for
// single-player/hotseat, or entries merged in from a relay/server for multiplayer. Dynamic boards
// (name one, it exists). The trust seam is `verify`: pass a predicate (e.g. a replayproof check)
// and highscore will flag — or with `verifiedOnly`, reject — any entry that can't prove itself.
//
// Depends only on @metanet-games/chaintag (for display names), which is itself zero-dep.
import { profile as deriveProfile } from "@metanet-games/chaintag";

function emitter() {
  const map = new Map();
  return {
    on(ev, cb) { (map.get(ev) || map.set(ev, new Set()).get(ev)).add(cb); return () => map.get(ev)?.delete(cb); },
    emit(ev, arg) { for (const cb of map.get(ev) || []) cb(arg); },
  };
}

const memStore = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; })();

function display(player) {
  if (player && player.name) return { id: player.id, name: player.name };
  const p = deriveProfile(player);
  return { id: player.id, name: p.name };
}

export function createHighscore({ store = memStore, order = "desc", verify = null, verifiedOnly = false, now = () => Date.now() } = {}) {
  const boards = new Map();
  const better = (a, b) => (order === "asc" ? a < b : a > b);          // asc = lower is better (times)
  const cmp = (a, b) => (order === "asc" ? a.score - b.score : b.score - a.score);

  function boardState(name) {
    let b = boards.get(name);
    if (!b) {
      let state = { entries: {} };
      try { const raw = store.getItem("highscore:" + name); if (raw) state = JSON.parse(raw); } catch { /* fresh */ }
      b = { name, ev: emitter(), state };
      boards.set(name, b);
    }
    return b;
  }
  const persist = (b) => { try { store.setItem("highscore:" + b.name, JSON.stringify(b.state)); } catch { /* best effort */ } };
  const ranked = (b) => Object.values(b.state.entries).sort(cmp);

  function ingest(b, entry) {
    const verified = verify ? !!verify(entry) : true;
    if (verifiedOnly && !verified) return null;                        // reject unprovable entries
    const e = { ...entry, verified };
    const cur = b.state.entries[e.player.id];
    if (!cur || better(e.score, cur.score)) {
      b.state.entries[e.player.id] = e;                               // keep each player's best
      persist(b);
      b.ev.emit("update", ranked(b).slice(0, 10).map((x, i) => ({ rank: i + 1, ...x })));
      return e;
    }
    return cur;
  }

  function board(name) {
    const b = boardState(name);
    const withRank = (list) => list.map((e, i) => ({ rank: i + 1, ...e }));
    return {
      name,
      submit({ player, score, meta } = {}) {
        if (!player || !player.id) throw new Error("highscore: a player with an id is required");
        if (typeof score !== "number") throw new Error("highscore: a numeric score is required");
        const pl = display(player), ts = now();
        return ingest(b, { id: `${name}:${pl.id}:${score}:${ts}`, board: name, player: pl, score, meta: meta ?? null, ts });
      },
      // Ingest entries from elsewhere (a relay/server). Idempotent on best-per-player.
      merge(entries) {
        for (const e of entries || []) {
          if (!e || !e.player || !e.player.id || typeof e.score !== "number") continue;
          const ts = e.ts ?? now(), pl = display(e.player);
          ingest(b, { id: e.id ?? `${name}:${pl.id}:${e.score}:${ts}`, board: name, player: pl, score: e.score, meta: e.meta ?? null, ts });
        }
        return this;
      },
      top(n = 10) { return withRank(ranked(b).slice(0, n)); },
      all() { return withRank(ranked(b)); },
      rank(playerId) { const list = ranked(b); const i = list.findIndex((e) => e.player.id === playerId); return i < 0 ? null : { rank: i + 1, ...list[i] }; },
      on(ev, cb) { return b.ev.on(ev, cb); },
    };
  }

  return { board, order };
}

export default { createHighscore };
