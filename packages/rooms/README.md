# @metanet-games/rooms

Client-side chat with **dynamic channels** and **presence**, over any transport. Depends only on
[passport](../passport) for identity.

You bring a transport and a player identity; rooms handles join/leave, who's-here presence,
message ordering, and de-duplication. Channels are dynamic — name one and it exists.

```js
import { createRooms, loopback } from "@metanet-games/rooms";
import { anon } from "@metanet-games/passport";

// transport is anything with { send(env), subscribe(handler) } — WebSocket, an HTTP relay,
// WebRTC, or the built-in loopback() for tests/local play.
const rooms = createRooms({ transport: myTransport, identity: anon(localStorage) });

const lobby = rooms.channel("lobby");     // dynamic — no registration
lobby.on("message",  (m) => render(m));   // { id, channel, author:{id,name,avatar}, text, ts }
lobby.on("presence", (who) => showWhosHere(who));
lobby.on("join",  (p) => toast(`${p.name} joined`));
lobby.on("leave", (p) => toast(`${p.name} left`));
lobby.join();
lobby.send("gm");

rooms.channel("block:" + height).join();  // a channel per block, per match, per region…
setInterval(() => rooms.heartbeat(), 10000); // keep presence fresh + prune stale peers
```

## Transport contract

```
{ send(envelope), subscribe(handler) }
```

`send` broadcasts an envelope to the other peers; `subscribe(handler)` calls `handler(envelope)`
for each inbound one. rooms is broadcast-gossip: every client announces itself, so **presence
needs no server**. `loopback()` is an in-memory hub for tests and local multiplayer.

## Honest boundaries

- **All peers on a transport receive all envelopes; channels route them.** "Joining" a channel is
  about *presence* (announcing yourself), not access control. Private/paid channels are the
  transport's or relay's job (a gated WebSocket, a token-checked relay) — rooms won't pretend a
  client-side channel name keeps anyone out.
- Presence is peer-observed and eventually-consistent: members appear on their first envelope and
  are pruned `ttl` ms after their last, so `heartbeat()` must run on an interval in production.
- No history: rooms shows messages from when you connected. Durable logs are a relay concern.

See [SPEC.md](./SPEC.md) for the envelope format and the presence model.

MIT © metanet.games
