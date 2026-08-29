# chainseed — derivation spec (v0.1)

Verifiable deterministic randomness from a Bitcoin (BSV) block hash. One page, no
dependencies, reimplementable in any language. The JS reference is `chainseed.mjs`.

## Why

A block hash is a **public, un-riggable random beacon**. Nobody picks it, everybody can
read it, and it is fixed forever once the block is mined. If a game derives its randomness
from a block hash by a fixed rule, then:

- every player computes the **same** world / drop / outcome with no server, and
- any third party can **re-derive** the value and confirm nobody cheated.

The randomness is trustless because it is *reproducible*, not because you trust the source.
This is the one thing a chain gives a game dev that a normal RNG cannot.

## Inputs

- `beacon` — a block hash as block explorers report it: **lowercase big-endian hex**, e.g.
  `0000000000000000... `. Fed to HMAC as a **UTF-8 string** (the hex text, *not* decoded to
  raw bytes). This choice is arbitrary but load-bearing: every implementation must match it
  or produce different numbers.
- `path` — a UTF-8 string that names this particular draw ("elev:3:7", "loot:sword",
  "seam:12,4|13,4"). It is a **domain separator**: independent uses of the same beacon must
  use different paths so they don't correlate.

## Core

```
draw(beacon, path) = HMAC-SHA256(key = utf8(beacon), message = utf8(path))   // 32 bytes
```

That's the whole primitive. Everything below is a typed *view* of those 32 bytes.

## Typed draws

Given `d = draw(beacon, path)` (a 32-byte big-endian buffer):

| draw      | definition                              | range        |
|-----------|-----------------------------------------|--------------|
| `bytes`   | `d`                                     | 32 bytes     |
| `byte`    | `d[0]`                                  | `0..255`     |
| `unit8`   | `d[0] / 255`                            | `[0,1]`, 256 steps |
| `unit`    | `uint32_be(d[0..4]) / 2^32`             | `[0,1)` full |
| `int(n)`  | `uint32_be(d[0..4]) mod n`              | `0..n-1`     |
| `pick(a)` | `a[ int(len(a)) ]`                       | element of `a` |
| `chance(p)`| `unit < p`                             | bool         |

`uint32_be(d[0..4])` = `(d[0]<<24) | (d[1]<<16) | (d[2]<<8) | d[3]`.

Notes:
- `unit8` is the low-resolution 1-byte form; it exists only so callers that were baked with
  it (blockland's noise lattice) reproduce exactly. **New code should use `unit`.**
- `int`/`pick` carry a negligible modulo bias for game-sized `n` (n ≪ 2^32). If you need
  exact uniformity, rejection-sample on `unit`.

## Test vectors

Beacon = the BSV genesis block hash:
`000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f`

| path         | `byte` | `unit8`  | `unit`   | `int(6)` |
|--------------|--------|----------|----------|----------|
| `elevlo:0:0` | 106    | 0.415686 | 0.416570 | 1        |
| `loot:sword` | 41     | 0.160784 | 0.161421 | 5        |

> These are the conformance anchor: a port in another language must reproduce them exactly
> (floats to 6 dp) before it can claim to implement chainseed.

## Beacon selection (the part games must get right)

Which block? The rule must be fixed **in advance** and public, or the "un-riggable" claim
is a lie:

- **World gen:** a fixed historical height (e.g. genesis, or block 0 of a season). Static,
  everyone agrees.
- **Fair future outcome (loot, dice):** commit to "the hash of the *next* block after height
  H", chosen before block H+1 exists. Neither party can grind it. Publish the commitment,
  reveal when the block lands. (This is the `fairdrop` primitive, built on chainseed.)

Never seed a "fair" outcome from a block that already exists at decision time — the party
who picks the height controls the result.

## Non-goals

Not a CSPRNG for keys/secrets — the beacon is public, so outputs are public and predictable
to anyone who knows the (beacon, path). It's a *shared, auditable* RNG, which is the opposite
of a secret one. Don't derive wallet material from it.

## License & implementation

This specification is free for anyone to implement, in any language, royalty-free — writing it
down is the point. The reference implementation is licensed under Apache-2.0; the specification
itself places no restriction on independent, clean-room implementations.
