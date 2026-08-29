# chaintag — spec (v0.1)

Portable, wallet-optional player identity for BSV games. Reference impl `index.mjs`, proof
`test.mjs`. Zero dependencies (node/browser crypto only).

## Identity model

An identity is `{ kind, id, … }`:

- **anon** — `id` is a locally-generated random 32-byte hex string, persisted via a
  `{getItem,setItem}` store (e.g. `localStorage`). Stable across sessions on that device; not
  portable and not provable (there's no key to prove). This is the *fun-before-wallet* identity.
- **wallet** — `id` is the player's wallet public key (lowercased hex), the cryptographic anchor.
  Portable across games and **provable** (see Challenge). Optional `handle` / `avatar` / `paymail`
  the wallet may supply (e.g. HandCash).

Equality is by `id` (`sameAccount`). Never infer that two identities are the same person because
they share a device or a name — only the id is meaningful.

## The account-vs-user rule (non-negotiable)

A wallet connection identifies a **selected account**, not a user, and the first key your app
receives is **not consent**. chaintag deliberately does none of the following for you: treating a
connected key as sign-in, merging an anon identity into a wallet identity, or authorizing an
action. It hands you the identity and `challenge()`; your app decides what a key is allowed to
mean and when the player has actually agreed. This mirrors the same rule bsv.cx pay flows follow.

## Deterministic display

`profile(p)` returns `{ name, avatar }`:

- If the identity carries a `handle` / `avatar`, those win.
- Otherwise both are derived deterministically from `sha256(id)`: a name `"<Adjective> <Noun>"`
  from two 24-word lists (bytes 0,1), and a **5×5 left-right-symmetric identicon** rendered as an
  SVG `data:` URI — hue from byte 2, the 15 half-cells from bytes 3–17.

Same id ⇒ same name and identicon on any machine; different ids ⇒ different identicons. So every
player, even anonymous, has a stable face with zero setup.

## Migration (anon → wallet)

`link(from, to)` returns `{ fromId, toId, fromKind, toKind, at }`. chaintag stores no game data;
this record is the signal for *your* app to move the anon player's saves/progress onto their
wallet identity when they connect. One-way by intent: you carry an anon into a wallet, not back.

## Challenge / verify (provable identity, no server)

`challenge(p, { purpose, nonce })` → `{ message, nonce, purpose, id }`. The `message` binds the
identity id, a purpose, and a fresh nonce into a canonical string. Flow:

1. Your app calls `challenge()` and asks the player's wallet to **sign `message`**.
2. Verify the signature against `p.pubkey`. chaintag doesn't bundle secp256k1; use `@bsv/sdk`:

```js
import { PublicKey, Signature, BSM } from "@bsv/sdk";
const valid = BSM.verify(Buffer.from(c.message, "utf8"),
                         Signature.fromCompact(sigFromWallet),
                         PublicKey.fromString(account.pubkey));
```

A valid signature proves the player controls the identity key — a login with no account database,
verifiable by anyone. Use a fresh `nonce` per challenge and reject reuse to stop replay.

## Storage adapter

`anon(store)` accepts any `{ getItem(key), setItem(key,value) }`. Pass `window.localStorage` in a
browser; the default is an in-memory shim (fine for tests/SSR, not persistent).

## Non-goals

Not an auth server, not custody, not a profile database, and it does not store game state. It is
the identity layer; persistence, sessions, and authorization are the app's.

## License & implementation

This specification is free for anyone to implement, in any language, royalty-free — writing it
down is the point. The reference implementation is licensed under Apache-2.0; the specification
itself places no restriction on independent, clean-room implementations.
