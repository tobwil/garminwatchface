// In-browser .prg generator.
// Every face .prg is built with three patchable placeholders:
//   - the Face-Code string resource  "FLCODE:" + code, padded with '#' to 120 bytes
//   - the app name resource          name + NBSP padding, exactly 48 UTF-8 bytes
//   - the 16-byte app id in the header section
// After patching, the two RSA signatures (PKCS#1 v1.5 with SHA-1 and SHA-256 over all
// bytes before the signature section 0xE1C0DE12) are recomputed with the FaceLab
// sideload key, exactly like the Connect IQ compiler does, and the signer's public key
// is written next to them (so any base .prg can be re-signed with any RSA-4096 key).

const CODE_LEN = 120;
const NAME_BYTES = 48;
const SIG_TAG = 0xe1c0de12;
const enc = new TextEncoder();

function find(hay, needle, from = 0) {
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

function sections(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out = [];
  let i = 0;
  while (i + 8 <= b.length) {
    const tag = dv.getUint32(i), len = dv.getUint32(i + 4);
    out.push({ tag, off: i, len });
    if (tag === 0) break;
    i += 8 + len;
  }
  return out;
}

export function padName(name) {
  let bytes = enc.encode(name);
  while (bytes.length > NAME_BYTES) { name = name.slice(0, -1); bytes = enc.encode(name); }
  const rest = NAME_BYTES - bytes.length;
  return name + (rest % 2 ? " " : "") + " ".repeat(Math.floor(rest / 2));
}

async function md5ish(str) {
  // 16 bytes derived from SHA-256 (WebCrypto has no MD5) — only needs to be unique & stable
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(str)));
  return h.slice(0, 16);
}

const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

let keyCache = null;
async function keys(pkcs8) {
  if (keyCache) return keyCache;
  const imp = (hash, ext) => crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSASSA-PKCS1-v1_5", hash }, ext, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", await imp("SHA-1", true));
  // public key as stored in the .prg: 512-byte modulus + 4-byte exponent (big endian)
  const n = b64url(jwk.n), e = b64url(jwk.e);
  const pub = new Uint8Array(516);
  pub.set(n, 512 - n.length);
  pub.set(e, 516 - e.length);
  keyCache = { s1: await imp("SHA-1", false), s256: await imp("SHA-256", false), pub };
  return keyCache;
}

/**
 * @param {Uint8Array} base     original .prg built by tools/build.py
 * @param {object} o            { code, name, baseName, baseKeyId (16 bytes) , uniqueSeed }
 * @param {ArrayBuffer} pkcs8   private key (PKCS#8 DER)
 */
export async function patchPrg(base, o, pkcs8) {
  const b = new Uint8Array(base); // copy
  // 1. Face-Code
  const ci = find(b, enc.encode("FLCODE:FL1."));
  if (ci < 0) throw new Error("Face-Code placeholder not found");
  const code = ("FLCODE:" + o.code).padEnd(CODE_LEN, "#");
  if (code.length !== CODE_LEN) throw new Error("Face-Code too long");
  b.set(enc.encode(code), ci);
  // 2. Name
  if (o.name && o.baseName) {
    const old = enc.encode(padName(o.baseName));
    const ni = find(b, old);
    if (ni < 0) throw new Error("app name placeholder not found");
    b.set(enc.encode(padName(o.name)), ni);
  }
  // 3. App id (unique per configuration so several variants can live on the watch)
  if (o.baseAppId && o.uniqueSeed) {
    const ai = find(b.subarray(0, 128), o.baseAppId);
    if (ai < 0) throw new Error("app id not found");
    b.set(await md5ish(o.uniqueSeed), ai);
  }
  // 4. Re-sign
  const sig = sections(b).find((s) => s.tag === SIG_TAG);
  if (!sig || sig.len !== 1540) throw new Error("signature section not found");
  const data = b.subarray(0, sig.off);
  const k = await keys(pkcs8);
  if (k.pub.length !== 516) throw new Error("unsupported key size (RSA-4096 required)");
  const s1 = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", k.s1, data));
  const s2 = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", k.s256, data));
  // layout: [sha1 sig 512][modulus 512][exponent 4][sha256 sig 512]
  b.set(s1, sig.off + 8);
  b.set(k.pub, sig.off + 8 + 512);
  b.set(s2, sig.off + 8 + 1028);
  return b;
}
