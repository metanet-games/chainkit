# highscore — spec (v0.1)

Ranked, best-per-player leaderboards with a verifier seam. Reference impl `index.mjs`, proof
`test.mjs`. Depends on `@metanet-games/passport` (zero-dep) for display names.

## Setup

`createHighscore({ store?, order?, verify?, verifiedOnly?, now? })`:

- `store` — optional `{ getItem, setItem }` (e.g. `localStorage`) for persistence per board.
- `order` — `"desc"` (default, higher score wins) or `"asc"` (lower wins, e.g. speedrun times).
- `verify(entry) → bool` — optional predicate run on every ingest (see Trust).
- `verifiedOnly` — if true, entries failing `verify` are rejected rather than flagged.

## Boards & entries

`board(name)` returns a handle for a dynamic board (created on first reference). An **entry** is
`{ id, board, player: { id, name }, score, meta, ts, verified }`. `player` is a passport identity
(or any `{ id, name? }`); a missing name is derived via `passport.profile`.

- `submit({ player, score, meta? })` — record a score. Only a player's **best** (per `order`) is
  kept; a worse score is ignored. Returns the stored entry (or the existing better one).
- `merge(entries)` — ingest entries from elsewhere (a relay/server) under the same best-per-player
  rule; idempotent enough for repeated syncs.
- `top(n=10)`, `all()` — ranked lists, each element carrying a 1-based `rank`.
- `rank(playerId)` — a player's current position, or `null`.
- `on("update", cb)` — fires with the new top-10 whenever the board changes.

## Trust

`verify` is the seam that makes a leaderboard un-forgeable. Pass a predicate that checks the
entry's proof — for example a **replayproof** verification that `meta.proof` is a genuine,
untampered run bound to the claimed score. With `verifiedOnly`, unprovable entries never land; the
`verified` flag lets a UI distinguish proven from unproven scores otherwise. highscore itself is
transport/proof-agnostic: it ranks and dedupes; what counts as "proven" is your predicate.

## Non-goals

Not a server or transport (bring your own backend / relay), not authentication (that's passport),
not the proof system itself (that's replayproof, plugged in via `verify`). It's the ranking +
best-per-player + trust-gating layer.

## License & implementation

This specification is free for anyone to implement, in any language, royalty-free — writing it
down is the point. The reference implementation is licensed under Apache-2.0; the specification
itself places no restriction on independent, clean-room implementations.
