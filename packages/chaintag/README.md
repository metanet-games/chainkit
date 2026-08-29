# @metanet-games/chaintag

Portable, wallet-optional player identity for BSV games. Zero dependencies.

A player's identity is a **key, not an account on your server**. Anonymous by default — a
locally-persisted key so a wallet-less player still has a stable identity across sessions (fun
before wallet) — and upgradeable to their real wallet key (BRC-100 / HandCash) when they choose.
The same wallet identity works across every game: portability a per-game login can't give you.

```js
import { anon, fromWallet, profile, link, challenge } from "@metanet-games/chaintag";

// wallet-less player — stable across sessions, with a name + identicon out of the box
const me = anon(window.localStorage);
profile(me);            // { name: "Swift Otter", avatar: "data:image/svg+xml;base64,…" }

// they connect a wallet (your app gets the pubkey via BRC-100 / HandCash)
const account = fromWallet({ pubkey, handle, avatar });   // handle/avatar optional
const migration = link(me, account);                       // carry their progress over

// prove they control the identity key — no login server
const c = challenge(account, { purpose: "login" });        // have the wallet sign c.message,
// then verify the signature against account.pubkey with @bsv/sdk (see SPEC.md)
```

**The rule this module is built around:** a wallet connection identifies a selected **account**,
not a user, and the first key you see is **not consent**. chaintag gives you the identity and the
tools to prove control of it — it never decides for you that a connected key means the player
agreed to anything. That stays your call.

Not an auth server, not custody, and it stores no game data — it hands you identities and a
migration record; where the saves live is up to you.

See [SPEC.md](./SPEC.md) for the identity model, deterministic display derivation, and the
challenge/verify format.

Apache-2.0 © metanet.games
