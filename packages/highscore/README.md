# @metanet-games/highscore

Leaderboards you can trust. Ranked, best-per-player boards over any backend, with a verifier seam
for un-forgeable scores. Depends only on [passport](../passport) for display names.

```js
import { createHighscore } from "@metanet-games/highscore";

const hs = createHighscore({ store: localStorage });     // order:"desc" (higher wins) by default
const board = hs.board("arcade");                         // dynamic — name one, it exists

board.on("update", (top10) => render(top10));
board.submit({ player: myPassport, score: 4200 });        // keeps each player's best
board.top(10);        // [{ rank, player:{id,name}, score, verified, ts }, …]
board.rank(myId);     // this player's position

// multiplayer: fold in entries from a relay/server
board.merge(entriesFromServer);
```

- **Ranking** — `order: "desc"` (points) or `"asc"` (speedrun times, lower is better). Only each
  player's best entry is kept.
- **Backend-agnostic** — submit locally (single-player/hotseat) and/or `merge()` entries pushed
  from a relay. highscore maintains the ranked, deduped board either way.

## The trust seam

Pass a `verify(entry)` predicate — anti-cheat, or a **replayproof** check that the run is genuine:

```js
createHighscore({ verify: (e) => replayproof.check(e.meta.proof), verifiedOnly: true });
```

- `verifiedOnly: true` — entries that fail `verify` are **rejected**; the cheat never lands.
- default — suspect entries are stored but flagged `verified: false`, so your UI can mark them.

This is what turns a plain leaderboard into one nobody can forge: today it ranks; wired to
`replayproof`, it only ranks runs that proved themselves.

See [SPEC.md](./SPEC.md).

Apache-2.0 © metanet.games
