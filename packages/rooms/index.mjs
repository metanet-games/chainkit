// SPDX-License-Identifier: Apache-2.0
// rooms — client-side chat with DYNAMIC channels + presence, over any transport.
//
// You bring a transport (WebSocket, the REORG-style append-only HTTP relay, WebRTC, or the
// built-in `loopback()` for tests/local) and a player identity (from @metanet-games/chaintag).
// rooms handles the rest: join/leave, who's-here presence, message ordering, and de-duplication.
//
// "Dynamic channels" means channels aren't registered anywhere — you just name one and it exists:
// `rooms.channel("lobby")`, `rooms.channel("block:900123")`, `rooms.channel("match:" + id)`.
// Presence and messages are scoped per channel.
//
// Transport contract (tiny): `{ send(envelope), subscribe(handler) }`. `send` broadcasts an
// envelope to the other peers; `subscribe(handler)` calls `handler(envelope)` for each inbound
// one. rooms is broadcast-gossip: every client announces itself, so presence needs no server.
//
// Depends only on @metanet-games/chaintag (for display derivation), which is itself zero-dep.
import { profile as deriveProfile } from "@metanet-games/chaintag";

const now0 = () => Date.now();
let seq = 0;
const mid = (id) => `${String(id).slice(0, 6)}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function display(identity) {
  if (identity && identity.name && identity.avatar) return { id: identity.id, name: identity.name, avatar: identity.avatar };
  const p = deriveProfile(identity);
  return { id: identity.id, name: p.name, avatar: p.avatar };
}

function emitter() {
  const map = new Map();
  return {
    on(ev, cb) { (map.get(ev) || map.set(ev, new Set()).get(ev)).add(cb); return () => map.get(ev)?.delete(cb); },
    emit(ev, arg) { for (const cb of map.get(ev) || []) cb(arg); },
  };
}

// An in-memory transport hub: `const hub = loopback(); rooms({ transport: hub.connect(), … })`.
// `send` reaches every OTHER connected transport (senders handle their own envelopes locally).
export function loopback() {
  const peers = new Set();
  return {
    connect() {
      let handler = () => {};
      const t = {
        send: (env) => { for (const p of peers) if (p !== t) p._deliver(env); },
        subscribe: (h) => { handler = h; },
        _deliver: (env) => handler(env),
        _drop: () => peers.delete(t),
      };
      peers.add(t);
      return t;
    },
  };
}

export function createRooms({ transport, identity, ttl = 30000, now = now0 } = {}) {
  if (!transport || typeof transport.send !== "function") throw new Error("rooms: a transport with send/subscribe is required");
  if (!identity || !identity.id) throw new Error("rooms: an identity with an id is required (see @metanet-games/chaintag)");
  const me = display(identity);
  const channels = new Map(); // name -> channel state

  function chanState(name) {
    let c = channels.get(name);
    if (!c) {
      c = { name, joined: false, ev: emitter(), members: new Map(), seen: new Set(), seenQ: [] };
      channels.set(name, c);
    }
    return c;
  }

  function present(c) {
    const cutoff = now() - ttl;
    const out = [];
    if (c.joined) out.push(me);
    for (const m of c.members.values()) if (m.id !== me.id && m.lastSeen > cutoff) out.push({ id: m.id, name: m.name, avatar: m.avatar });
    return out;
  }

  function touch(c, from, ts) {
    const existing = c.members.get(from.id);
    if (existing) { existing.lastSeen = Math.max(existing.lastSeen, ts); return false; }
    c.members.set(from.id, { ...from, lastSeen: ts });
    return true; // newly seen
  }

  function handle(env) {
    if (!env || env.v !== 1 || !env.ch) return;
    const c = chanState(env.ch);
    if (env.mid) { // de-dup
      if (c.seen.has(env.mid)) return;
      c.seen.add(env.mid); c.seenQ.push(env.mid);
      if (c.seenQ.length > 500) c.seen.delete(c.seenQ.shift());
    }
    const from = env.from, ts = env.ts || now();
    let changed = false;
    if (env.t === "leave") {
      if (c.members.delete(from.id)) { changed = true; c.ev.emit("leave", from); }
    } else {
      if (from.id !== me.id && touch(c, from, ts)) { changed = true; c.ev.emit("join", from); }
    }
    if (env.t === "chat") c.ev.emit("message", { id: env.mid, channel: c.name, author: from, text: env.text, ts });
    if (changed) c.ev.emit("presence", present(c));
  }

  transport.subscribe(handle);

  function out(c, t, extra) {
    const env = { v: 1, t, ch: c.name, from: me, ts: now(), mid: mid(me.id), ...extra };
    transport.send(env);
    handle(env); // process our own locally (dedup guards against echo transports)
    return env;
  }

  function channel(name) {
    const c = chanState(name);
    return {
      name,
      join() { if (!c.joined) { c.joined = true; out(c, "join"); c.ev.emit("presence", present(c)); } return this; },
      leave() { if (c.joined) { c.joined = false; out(c, "leave"); c.members.clear(); c.ev.emit("presence", present(c)); } return this; },
      send(text) { if (!c.joined) this.join(); return out(c, "chat", { text: String(text) }); },
      members() { return present(c); },
      on(ev, cb) { return c.ev.on(ev, cb); },
    };
  }

  return {
    channel,
    channels: () => [...channels.values()].filter((c) => c.joined).map((c) => c.name),
    identity: me,
    // call on an interval in production: re-announces presence + prunes stale members
    heartbeat() {
      for (const c of channels.values()) {
        if (!c.joined) continue;
        out(c, "ping");
        const cutoff = now() - ttl;
        let changed = false;
        for (const [id, m] of c.members) if (m.lastSeen <= cutoff) { c.members.delete(id); changed = true; }
        if (changed) c.ev.emit("presence", present(c));
      }
    },
  };
}

export default { createRooms, loopback };
