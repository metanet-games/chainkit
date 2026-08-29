# @metanet-games/chainseed

Verifiable deterministic randomness from a Bitcoin (BSV) block hash. Zero dependencies.

A block hash is a public, un-riggable random beacon: nobody picks it, everybody can read it,
and it's fixed forever once mined. chainseed turns it into an unlimited stream of independent,
reproducible draws — each selected by a `path` string — so two parties derive the same value
and a third can audit it. Trustless because it's *reproducible*, not because you trust anyone.

```js
import { seed } from "@metanet-games/chainseed";

const s = seed(blockHash);          // blockHash: lowercase big-endian hex, as explorers show it
s.unit("loot:sword");               // float in [0,1)
s.int("spawn:3", 6);                // integer 0..5
s.pick("event", ["rain","fog"]);    // uniform pick
s.chance("crit", 0.1);              // true 10% of the time
```

Every draw is `HMAC-SHA256(key = blockHash, message = path)` under the hood. Same block + same
path ⇒ same value, anywhere.

**Not** a secret RNG — outputs are public and predictable to anyone who knows (beacon, path).
Don't derive keys or secrets from it.

See [SPEC.md](./SPEC.md) for the language-agnostic derivation and conformance test vectors.

Apache-2.0 © metanet.games
