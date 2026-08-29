# chainkit — roadmap & design law

chainkit is a set of small, verifiable building blocks for BSV games. This document records what's
shipped, what's next, the one module worth aiming the whole effort at — and, just as importantly,
the things we deliberately **won't** build.

## Design law: when to reach for the chain (and when not to)

Reach for the chain **only** when a feature genuinely needs one of its four unique properties:

1. **Un-riggable randomness** — a public value nobody chose (block hash).
2. **Public timestamp / ordering** — a clock you don't control.
3. **Tamper-evident commitment / proof** — a hash anyone can re-derive and check.
4. **Trustless value transfer / ownership** — settlement without a middleman.

If a feature needs none of those, the chain is dead weight or actively harmful (latency, cost,
privacy leakage). **The chain proves and settles; it does not compute or render.**

### Non-goals — do NOT put these on-chain
- **Collision detection, physics, pathfinding, rendering, AI** — real-time local compute, zero
  trust dimension. Adding the chain adds only lag and cost.
- **High-frequency position/state sync** — L1 is ~10-minute blocks; per-frame authoritative state
  on-chain is a category error. That belongs off-chain (see `statechannel`).
- **"Whole game state on-chain" anti-cheat** — wrong shape. The right shape is *commit a hash /
  verify a replay*, never *run the game on the chain*.
- **Bulk storage / player blobs / saves** — anchor the **hash**, never the blob (cost, and a public
  ledger is forever).
- **Private data** — a public chain can hold a *commitment* to a secret, never the secret itself.

Half the value of this kit is the modules we refused to build.

## Shipped (v0.1)

`chainseed` · `chainscape` · `fairdrop` · `chaintag` · `rooms` · `chainclock` · `chainweather` ·
`coinslot` · `highscore` · `satchel` — ten modules, each proven and documented. See the READMEs.

## Candidate modules, ranked by complexity (highest first)

Every one earns its place against the four levers above.

| # | Module | What it does | Complexity |
|---|--------|--------------|------------|
| 1 | **`statechannel`** ⭐ | Open a channel on-chain, play fast off-chain via signed state, settle-or-dispute on-chain with fraud proofs. **The milestone.** | Very high |
| 2 | `worldstate` | Shared authoritative world with conflict resolution (CRDT) + periodic on-chain checkpoints. The MMO backbone. | Very high |
| 3 | `spvsync` | Light clients validate each other's moves against anchored Merkle proofs, no server. | High |
| 4 | `tradepost` | Atomic player-to-player swaps (ordinal↔ordinal, item↔sats), no trusted middleman. | High |
| 5 | `wager` | Trustless PvP stakes: escrow in, provably-fair settle out (composes `fairdrop` + `statechannel`). | High |
| 6 | `turnproof` | Full turn-based match integrity + dispute for chess/cards (the bigger sibling of `fogproof`). | Med-high |
| 7 | `fogproof` | Trustless hidden information — battleship, poker, fog-of-war — via on-chain commit-reveal. | Medium |
| 8 | `replayproof` | Un-forgeable input replays / anti-cheat; the verifier that makes `highscore` un-riggable. | Medium |
| 9 | `provenance` | Verifiable item lineage & crafting history (extends `satchel`). | Medium |
| 10 | `matchmaker` | Provably-fair matchmaking via verifiable RNG — nobody rigs who they're paired against. | Med-low |
| — | `replaytheater` | Deterministic spectate/replay from a seed + tiny input log (free once worlds are deterministic). | Low |

Near-term (already surfaced on metanet.games/dev): **`replayproof`, `fogproof`, `spvsync`.**

## The milestone: `statechannel`

Everything else is a warm-up for this. It's the hard, category-defining one — Lightning-for-games:
two players open a channel, then play as fast as they like **off** the chain, each signing every
state update. The chain is touched only to **open**, to **cash out**, or — the hard part — to
**dispute**: submit the latest signed state, and a fraud-proof window resolves it.

Land it and you've solved the thing nobody has solved well: **real-time PvP that is trustless and
serverless, where cheating is provable and a losing bettor can't rug the pot.** It composes the
whole stack — `chaintag` signs state, `fairdrop` supplies fair RNG, `coinslot`/escrow holds stakes.
It is genuinely hard (optimistic dispute resolution, exit games, griefing vectors), which is exactly
why shipping it would be the credibility moment for the entire "verifiable games" thesis.

The roadmap points here.
