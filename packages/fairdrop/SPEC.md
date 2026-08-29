# fairdrop — spec (v0.1)

Provably-fair random outcomes bound to a **future** Bitcoin (BSV) block. Built on
[chainseed](./CHAINSEED-SPEC.md); reference impl `fairdrop.mjs`, proof `fairdrop.test.mjs`.

## What it's for

Loot, crates, dice, gacha, matchmaking seeds — any outcome a player must be able to prove,
afterward, that nobody rigged. The result is a pure function of a block hash that did not
exist when the drop was committed, so it can be recomputed by anyone from public data.

## Protocol

**Commit (before block `H` is mined):** publish
`{ dropId, height: H, table, seedCommitments }` and — importantly — **timestamp/anchor its
digest** (e.g. via bsv.cx notary) so there is public proof the table and block were fixed in
advance. `table` = `[{item, weight}, …]`, weights any positive numbers.

**Resolve (after block `H` is mined):** fetch `H`'s canonical hash, then
```
beacon  = reveals.length ? SHA256(blockHash + "|" + reveals.join("|")) : blockHash
outcome = weightedPick(table, chainseed.unit(beacon, "<dropId>:<nonce>"))
```
`weightedPick` walks the table subtracting weights from `unit×total` until it goes negative.
`nonce` (0,1,2,…) draws independent outcomes from the same commitment+block.

**Verify (anyone):** recompute the digest (detects a tampered commitment) and re-run resolve;
compare to the claimed item. No secrets needed unless the drop used seeds.

## Threat model (read this — it's the honest part)

| Attacker | Can they bias it? |
|----------|-------------------|
| **Player** picking after the fact | No — table, block, and paths are locked at commit and the block hash is unknown until mined. |
| **House** rigging post-hoc | No — the anchored digest proves the table; any edit fails `verify`. |
| **Miner of block H** grinding candidate blocks | **Partially, in principle.** A miner can try alternative blocks to nudge outcomes. |

The miner attack is the only real one, and it's defused two ways:

1. **Economics.** Grinding even one block hash costs vastly more than any game drop is worth.
   For ordinary loot, plain future-block mode (no seeds) is enough.
2. **Committed seeds.** For high-stakes drops, each party publishes `hash(seed)` at commit and
   reveals `seed` at resolve. The outcome mixes the revealed seeds into the beacon, so a miner
   grinding block H is working **blind** — they can't compute (let alone target) an outcome
   that depends on seeds they don't yet hold. `resolve` rejects any reveal whose hash doesn't
   match its commitment, so a party can't swap seeds after seeing the block either.

Note what this does *not* do: it doesn't stop a miner from *censoring* block H to deny a drop
entirely (they can withhold, but not silently alter the result). Liveness ≠ fairness; a
resolve simply waits for H to be mined by someone.

## Guarantee boundary

Fairness rests on **the commitment being provably older than block H**. Anchor the digest
before H is mined; without that timestamp, a cheater could claim they "committed" a table they
actually chose after seeing the block. This is exactly the job bsv.cx's notary/anchor does —
fairdrop supplies the digest, the chain supplies the "before".

## API

- `commit({ dropId, height, table, seeds? })` → commitment (with `.digest` to anchor)
- `resolve(commitment, { blockHash, reveals?, nonce? })` → `{ item, index, roll, beacon, nonce }`
- `verify(commitment, ctx, expected?)` → boolean

## Relationship to chainseed

fairdrop adds only *commitment* and *weighting*; every random bit comes from chainseed. It
pre-mixes multi-source entropy into a single beacon string (SHA256 of blockHash + reveals) and
hands that to `chainseed.seed()`, which is why chainseed keeps a single-string beacon and only
uniform draws — weighting and entropy-mixing are the consumer's job, not the primitive's.

## License & implementation

This specification is free for anyone to implement, in any language, royalty-free — writing it
down is the point. The reference implementation is licensed under Apache-2.0; the specification
itself places no restriction on independent, clean-room implementations.
