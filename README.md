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

MIT © metanet.games
