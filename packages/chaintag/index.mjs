// SPDX-License-Identifier: Apache-2.0
// chaintag — portable, wallet-optional player identity for BSV games.
//
// The idea: a player's identity is a KEY, not an account on our server. Anonymous by default
// (a locally-persisted random key, so a wallet-less player still has a stable identity across
// sessions — fun before wallet), and upgradeable to their real wallet key (BRC-100 / HandCash)
// when they choose to connect. The same wallet identity works across every game — that's the
// portability a chain gives you that a per-game login never will.
//
// HARD RULE, baked in from experience: a wallet connection identifies a selected ACCOUNT, not a
// user, and the first key you see is NOT consent. chaintag gives you the identity and the tools
// to prove control of it; it never decides on your behalf that a connected key means the player
// agreed to anything. That's the app's call. See SPEC.md.
//
// Zero external dependencies (node:crypto only). Signature verification of the wallet challenge
// is delegated to @bsv/sdk — see `challenge()` and SPEC.md — to keep this a single small file.
import { createHash, randomBytes } from "node:crypto";

const ADJ = ["Swift","Brave","Silent","Golden","Crimson","Lunar","Cosmic","Iron","Shadow","Bright",
  "Wild","Frost","Ember","Rapid","Noble","Sly","Vivid","Zephyr","Onyx","Solar","Astral","Quiet","Rogue","Dawn"];
const NOUN = ["Otter","Falcon","Comet","Cipher","Warden","Sprite","Golem","Nomad","Raven","Lynx",
  "Drake","Badger","Phoenix","Wisp","Marten","Koi","Fox","Heron","Mantis","Yak","Bison","Crane","Moth","Stag"];

const sha = (s) => createHash("sha256").update(String(s)).digest();

// in-memory fallback store (browser apps pass window.localStorage instead)
const memStore = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; })();

// A left-right symmetric 5x5 identicon as an SVG data URI, deterministic from an identity hash.
function identicon(h) {
  const hue = h[2] % 360, fg = `hsl(${hue} 62% 56%)`, bg = "#0b1020";
  const cell = 12, pad = 6, size = 5 * cell + pad * 2;
  let rects = "";
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
    if (h[3 + y * 3 + x] & 1) for (const cx of new Set([x, 4 - x]))
      rects += `<rect x="${pad + cx * cell}" y="${pad + y * cell}" width="${cell}" height="${cell}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="100%" height="100%" fill="${bg}"/><g fill="${fg}">${rects}</g></svg>`;
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

// Get-or-create a stable anonymous identity. `store` is any {getItem,setItem} (e.g. localStorage).
export function anon(store = memStore) {
  const KEY = "chaintag:anon";
  let id = store.getItem(KEY);
  if (!id) { id = randomBytes(32).toString("hex"); store.setItem(KEY, id); }
  return { kind: "anon", id };
}

// Build an identity from wallet-provided fields. `pubkey` is the cryptographic anchor (required);
// handle/avatar/paymail are optional display overrides the wallet may supply (e.g. HandCash).
export function fromWallet({ pubkey, handle, avatar, paymail } = {}) {
  if (!pubkey || typeof pubkey !== "string") throw new Error("chaintag.fromWallet: pubkey required");
  const id = pubkey.trim().toLowerCase();
  const p = { kind: "wallet", id, pubkey: id };
  if (handle) p.handle = handle;
  if (avatar) p.avatar = avatar;
  if (paymail) p.paymail = paymail;
  return p;
}

// Display profile: uses wallet-supplied handle/avatar when present, else a DETERMINISTIC name +
// identicon derived from the identity — so every player, even anonymous, has a stable face.
export function profile(p) {
  const h = sha(p.id);
  return {
    name: p.handle || `${ADJ[h[0] % ADJ.length]} ${NOUN[h[1] % NOUN.length]}`,
    avatar: p.avatar || identicon(h),
  };
}

// A short, human-friendly form of the id for UI (not for equality — use the full id for that).
export function shortId(p) {
  return p.kind === "wallet" ? p.id.slice(0, 6) + "…" + p.id.slice(-4) : p.id.slice(0, 10);
}

export function sameAccount(a, b) { return !!a && !!b && a.id === b.id; }

// Migration record to carry an anonymous player's progress onto their wallet identity once they
// connect. chaintag stores no game data — it hands you {fromId,toId} so the app moves the saves.
export function link(from, to) {
  return { fromId: from.id, fromKind: from.kind, toId: to.id, toKind: to.kind, at: new Date().toISOString() };
}

// Canonical string a wallet signs to PROVE control of its identity key (verifiable login without
// a server). The app has the wallet sign this, then verifies the signature against p.pubkey with
// @bsv/sdk (see SPEC.md). `nonce` should be a fresh random/opaque value per challenge.
export function challenge(p, { purpose = "login", nonce = randomBytes(12).toString("hex") } = {}) {
  return { message: `metanet.games chaintag\npurpose:${purpose}\nid:${p.id}\nnonce:${nonce}`, nonce, purpose, id: p.id };
}

export default { anon, fromWallet, profile, shortId, sameAccount, link, challenge };
