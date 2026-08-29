# rooms — spec (v0.1)

Client-side chat with dynamic channels and presence, over any transport. Reference impl
`index.mjs`, proof `test.mjs`. Depends on `@metanet-games/chaintag` (zero-dep) for display.

## Envelope

Every message on the wire is one envelope:

```json
{ "v": 1, "t": "chat|join|leave|ping", "ch": "lobby",
  "from": { "id": "...", "name": "...", "avatar": "..." },
  "ts": 1724900000000, "mid": "abc123-...", "text": "hi (chat only)" }
```

- `v` — format version (1). Unknown versions are ignored.
- `t` — `chat` (a message), `join`/`leave` (presence transitions), `ping` (presence heartbeat).
- `ch` — channel name. Any string; channels are created implicitly by being referenced.
- `from` — the author's resolved identity (id + display name + avatar, via chaintag).
- `ts` — sender clock (ms). Used for ordering and presence TTL; treated as advisory.
- `mid` — unique message id, used for de-duplication (see below).

## Dynamic channels

A channel exists the moment it's named — `rooms.channel("match:42")`. No registration, no schema.
Messages and presence are scoped per channel by the `ch` field. Because the transport is a
broadcast bus, **all connected peers receive all envelopes**; the channel field routes them to the
right listeners. Joining a channel does not gate delivery — it announces presence. Keeping peers
*out* of a channel (private/paid rooms) is a transport/relay responsibility, not this module's.

## Presence

Peer-observed and server-less: any envelope from a peer marks them present in that channel with
`lastSeen = ts`. A member is "present" while `lastSeen > now - ttl`. Your own identity is present
in a channel while you're joined. `heartbeat()` (run on an interval, e.g. every 10 s for a 30 s
ttl) re-announces you with a `ping` and prunes peers past ttl, emitting `presence` on change.

Events: `message` (chat only), `presence` (the full member list, on any change), `join`, `leave`.

## De-duplication & ordering

Each channel keeps a bounded set of recently-seen `mid`s (last 500); a repeat is dropped. This
makes rooms safe on transports that echo to the sender or deliver duplicates. A sender processes
its own envelope locally on `send()`, so messages appear immediately and any echo is de-duped.
Ordering is best-effort by arrival; use `ts` if you need to sort. There is no global total order —
it's chat, not consensus.

## Identity

`identity` is a chaintag identity (`{ id, … }`) or any `{ id, name?, avatar? }`. If name/avatar
are absent, rooms derives them via `chaintag.profile(identity)`, so anonymous players still get a
stable name + identicon. Equality and presence key on `id`.

## BSV-native extensions (out of scope for v0.1 core, natural to layer)

- **Wallet identity** — pass a wallet-backed chaintag so authorship is a real key, not a nickname.
- **Notarized messages** — anchor a message hash (e.g. via bsv.cx) for a tamper-evident log.
- **Token/paid channels** — enforce at the transport/relay: a relay that admits only holders of a
  token or payers of a fee. rooms consumes whatever the transport delivers.

## Non-goals

Not a transport, not a message store/history, not moderation, not access control. It's the
channel + presence + de-dup layer between a transport and your UI.

## License & implementation

This specification is free for anyone to implement, in any language, royalty-free — writing it
down is the point. The reference implementation is licensed under Apache-2.0; the specification
itself places no restriction on independent, clean-room implementations.
