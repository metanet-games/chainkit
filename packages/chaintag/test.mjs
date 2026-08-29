// Proof for chaintag: `node test.mjs`. Exits non-zero on any failure.
import { anon, fromWallet, profile, shortId, sameAccount, link, challenge } from "./index.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL:", m); fails++; } else console.log("ok  ", m); };

// a throwaway {getItem,setItem} store
const mkStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

// 1. anonymous identity is stable within a store, and well-formed
{
  const s = mkStore();
  const a1 = anon(s), a2 = anon(s);
  ok(a1.id === a2.id, "anon() returns the same id on repeat (persisted)");
  ok(a1.kind === "anon" && /^[0-9a-f]{64}$/.test(a1.id), "anon id is 64 hex chars");
  const fresh = anon(mkStore());
  ok(fresh.id !== a1.id, "a fresh store yields a different anon id");
}

// 2. wallet identity canonicalizes the pubkey and honours overrides
{
  const pk = "02ABCDEF0000000000000000000000000000000000000000000000000000000000";
  const p = fromWallet({ pubkey: pk, handle: "satoshi", paymail: "s@handcash.io" });
  ok(p.kind === "wallet" && p.id === pk.toLowerCase(), "fromWallet lowercases pubkey into id");
  ok(profile(p).name === "satoshi", "wallet handle overrides the derived name");
  let threw = false; try { fromWallet({}); } catch { threw = true; }
  ok(threw, "fromWallet without a pubkey throws");
}

// 3. deterministic display: same id -> same name+avatar; and it's a real identicon data URI
{
  const p = { kind: "anon", id: "a".repeat(64) };
  const d1 = profile(p), d2 = profile(p);
  ok(d1.name === d2.name && d1.avatar === d2.avatar, "profile is deterministic for a given id");
  ok(/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(d1.name), `derived name looks like "Adjective Noun" (${d1.name})`);
  ok(d1.avatar.startsWith("data:image/svg+xml;base64,"), "avatar is an SVG data URI");
  const svg = Buffer.from(d1.avatar.split(",")[1], "base64").toString("utf8");
  ok(svg.includes("<svg") && svg.includes("<rect"), "avatar decodes to real SVG");
  const other = profile({ kind: "anon", id: "b".repeat(64) });
  ok(other.avatar !== d1.avatar, "different ids yield different identicons");
}

// 4. shortId + sameAccount
{
  const p = fromWallet({ pubkey: "02" + "cd".repeat(32) });
  ok(shortId(p).includes("…") && shortId(p).length < p.id.length, "shortId is a short display form");
  ok(sameAccount(p, { id: p.id }) && !sameAccount(p, { id: "x" }), "sameAccount compares by id");
}

// 5. link migration record + challenge shape
{
  const a = anon(mkStore()), w = fromWallet({ pubkey: "02" + "ef".repeat(32) });
  const rec = link(a, w);
  ok(rec.fromId === a.id && rec.toId === w.id && rec.fromKind === "anon" && rec.toKind === "wallet", "link() records the anon->wallet migration");
  const c = challenge(w, { purpose: "login" });
  ok(c.message.includes("id:" + w.id) && c.message.includes("nonce:" + c.nonce) && c.purpose === "login", "challenge() binds id + nonce into a signable message");
  ok(challenge(w).nonce !== challenge(w).nonce, "each challenge gets a fresh nonce");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
