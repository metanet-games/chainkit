# chainkit

A directory of small, **verifiable, chain-native building blocks** for game developers.
Each module does one thing, leans on the one property a blockchain uniquely gives a game — a
cheap, public, un-riggable source of shared randomness and timestamped commitment — and is
small enough to either `npm install` or just copy into your project.

Pick and choose. You don't take the kit; you take the pieces you need.

## Modules

| Module | What it gives you | Depends on |
|--------|-------------------|------------|
| [`@metanet-games/chainseed`](packages/chainseed) | Deterministic, reproducible randomness from a Bitcoin (BSV) block hash. The base primitive. Zero dependencies. | — |
| [`@metanet-games/chainscape`](packages/chainscape) | Turn placed BSV blocks into a contiguous, deterministic 2-D biome map (procedural terrain that's the same for everyone, with no server). | chainseed |
| [`@metanet-games/fairdrop`](packages/fairdrop) | Provably-fair loot / dice / crates bound to a *future* block — an outcome nobody can rig and anyone can verify. | chainseed |
| [`@metanet-games/passport`](packages/passport) | Portable, wallet-optional player identity — anonymous by default, upgradeable to a real wallet key, with a deterministic name + identicon. Zero dependencies. | — |
| [`@metanet-games/rooms`](packages/rooms) | Client-side chat with dynamic channels and presence, over any transport (WebSocket / HTTP relay / WebRTC / built-in loopback). | passport |
| [`@metanet-games/chainclock`](packages/chainclock) | A block-driven world tick — one shared, verifiable clock nobody controls; derive day/night, seasons and rounds from block height. | — |
| [`@metanet-games/chainweather`](packages/chainweather) | Deterministic, shared weather from the chain — the same storm for every player, un-riggable, no weather server. | chainseed, chainclock |
| [`@metanet-games/coinslot`](packages/coinslot) | Drop-in micropayment paywall + tip rail — priced products, entitlements (durable / N-uses / timed) and receipts, over a pluggable wallet adapter. | — |
| [`@metanet-games/highscore`](packages/highscore) | Leaderboards you can trust — ranked, best-per-player boards over any backend, with a verifier seam for un-forgeable scores. | passport |
| [`@metanet-games/satchel`](packages/satchel) | Inventory — local for a wallet-less player, real on-chain items (1Sat Ordinals) when they connect, in one merged bag. | — |

## Design rules

- **Verifiable, not trusted.** Every module's value is that a third party can re-derive its
  output from public data. If a claim can't be independently checked, it doesn't ship.
- **Small and vendorable.** `chainseed` is one dependency-free file. Modules stay dependency-light
  on purpose, so copy-paste is a first-class install path, not a fallback.
- **Fun before wallet.** These add verifiability to a game; none of them require a player to hold
  a wallet to play. The chain shows up where it earns its keep, not at the front door.

## Install

```sh
npm install @metanet-games/fairdrop      # pulls chainseed automatically
```

Or open the module folder and copy its `index.mjs` into your project.

## Develop

This is an npm-workspaces monorepo.

```sh
npm install     # links the packages together locally
npm test        # runs the fairdrop proof suite
```

## License

Code is licensed under **Apache-2.0** (see [LICENSE](./LICENSE) and [NOTICE](./NOTICE)) — permissive,
with an explicit patent grant.

The **specifications** (each package's `SPEC.md`) are published **free for anyone to implement, in
any language, royalty-free**. Apache-2.0 covers the reference implementations here; it places no
restriction on independent, clean-room implementations of the specs themselves. The whole point is
that these become primitives anyone can reimplement and verify against.

Apache-2.0 © 2026 metanet.games
