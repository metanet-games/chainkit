// Proof for rooms: `node test.mjs`. Exits non-zero on any failure.
import { createRooms, loopback } from "./index.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); fails++; } else console.log("ok  ", m); };

let clock = 1000;
const now = () => clock;

// --- two clients on one hub ---
const hub = loopback();
const alice = createRooms({ transport: hub.connect(), identity: { id: "alice" }, now, ttl: 30000 });
const bob = createRooms({ transport: hub.connect(), identity: { id: "bob" }, now, ttl: 30000 });

const aL = alice.channel("lobby"), bL = bob.channel("lobby");
const bobMsgs = [], aliceMsgs = [];
let alicePresence = [], leaveSeen = null;
bL.on("message", (m) => bobMsgs.push(m));
aL.on("message", (m) => aliceMsgs.push(m));
aL.on("presence", (p) => { alicePresence = p; });
aL.on("leave", (f) => { leaveSeen = f; });

aL.join();
bL.join();

// 1. messaging + identity
aL.send("hi bob");
ok(bobMsgs.length === 1 && bobMsgs[0].text === "hi bob", "bob receives alice's message");
ok(bobMsgs[0].author.id === "alice" && /^\S+ \S+$/.test(bobMsgs[0].author.name), `message carries alice's derived identity (${bobMsgs[0].author.name})`);
ok(aliceMsgs.length === 1, "alice sees her own message exactly once (no echo dup)");

// 2. presence
ok(alicePresence.length === 2 && alicePresence.some((m) => m.id === "bob"), "alice's presence shows both members after joins");
ok(aL.members().length === 2, "members() lists both");

// 3. dynamic-channel routing — a message on another channel doesn't reach the lobby listener
const aBlock = alice.channel("block:1");
aBlock.join();
aBlock.send("only here");
ok(bobMsgs.length === 1, "a message on block:1 does not reach the lobby listener");
ok(alice.channels().sort().join(",") === "block:1,lobby", "channels() lists joined channels");

// 4. de-dup even on an echoing transport (delivers back to sender)
{
  const echo = (() => { const peers = new Set(); return { connect() { let h = () => {}; const t = { send: (e) => { for (const p of peers) p._deliver(e); }, subscribe: (x) => { h = x; }, _deliver: (e) => h(e) }; peers.add(t); return t; } }; })();
  const c = createRooms({ transport: echo.connect(), identity: { id: "c" }, now });
  const ch = c.channel("x"); let n = 0; ch.on("message", () => n++);
  ch.join(); ch.send("yo");
  ok(n === 1, "echoing transport still yields exactly one message (de-dup)");
}

// 5. leave
bL.leave();
ok(leaveSeen && leaveSeen.id === "bob", "alice gets a leave event for bob");
ok(aL.members().length === 1, "presence drops to just alice after bob leaves");

// 6. stale pruning after ttl (a peer that stops heartbeating)
{
  const h2 = loopback();
  const x = createRooms({ transport: h2.connect(), identity: { id: "x" }, now, ttl: 30000 });
  const y = createRooms({ transport: h2.connect(), identity: { id: "y" }, now, ttl: 30000 });
  const xc = x.channel("r"), yc = y.channel("r");
  xc.join(); yc.join();
  ok(xc.members().length === 2, "x sees 2 before ttl");
  clock += 30001;            // y never heartbeats
  x.heartbeat();
  ok(xc.members().length === 1, "x prunes the stale peer after ttl");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
