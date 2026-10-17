// Minimal MTP (PTP over USB) client for WebUSB — just enough to copy one
// .prg into GARMIN/APPS on a Garmin watch, straight from the browser.
// Works in Chromium browsers (Chrome, Edge, Brave), also from a file:// page.

const GARMIN_VID = 0x091e;
const OP = { OPEN: 0x1002, CLOSE: 0x1003, STORAGES: 0x1004, HANDLES: 0x1007, INFO: 0x1008, DELETE: 0x100b, SEND_INFO: 0x100c, SEND: 0x100d };
const RC_OK = 0x2001, RC_SESSION_OPEN = 0x201e;
const FMT_UNDEFINED = 0x3000, FMT_ASSOC = 0x3001;
const T_COMMAND = 1, T_DATA = 2, T_RESPONSE = 3;

export const usbSupported = () => typeof navigator !== "undefined" && !!navigator.usb;

class MtpError extends Error {
  constructor(msg, code) { super(msg); this.code = code; }
}

function container(type, code, tid, params = [], payload = null) {
  const plen = payload ? payload.length : 0;
  const len = 12 + params.length * 4 + plen;
  const buf = new Uint8Array(len);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, len, true);
  dv.setUint16(4, type, true);
  dv.setUint16(6, code, true);
  dv.setUint32(8, tid, true);
  params.forEach((p, i) => dv.setUint32(12 + i * 4, p >>> 0, true));
  if (payload) buf.set(payload, 12 + params.length * 4);
  return buf;
}

// PTP string: u8 char count (incl. terminator), UTF-16LE, 0x0000
function ptpString(s) {
  if (!s) return new Uint8Array([0]);
  const n = s.length + 1;
  const out = new Uint8Array(1 + n * 2);
  out[0] = n;
  for (let i = 0; i < s.length; i++) { out[1 + i * 2] = s.charCodeAt(i) & 255; out[2 + i * 2] = s.charCodeAt(i) >> 8; }
  return out;
}

function readPtpString(dv, off) {
  const n = dv.getUint8(off);
  let s = "";
  for (let i = 0; i < n - 1; i++) s += String.fromCharCode(dv.getUint16(off + 1 + i * 2, true));
  return s;
}

class Mtp {
  constructor(dev) { this.dev = dev; this.tid = 0; }

  async open() {
    const dev = this.dev;
    await dev.open();
    if (!dev.configuration) await dev.selectConfiguration(1);
    // the MTP interface: still-image class, or vendor-specific with bulk in/out
    let pick = null;
    for (const itf of dev.configuration.interfaces) {
      const alt = itf.alternates[0];
      const bin = alt.endpoints.find((e) => e.type === "bulk" && e.direction === "in");
      const bout = alt.endpoints.find((e) => e.type === "bulk" && e.direction === "out");
      if (!bin || !bout) continue;
      if (!pick || alt.interfaceClass === 6) pick = { itf, bin, bout };
    }
    if (!pick) throw new MtpError("Die Uhr bietet keine MTP-Schnittstelle an.", "no_mtp");
    try {
      await dev.claimInterface(pick.itf.interfaceNumber);
    } catch (e) {
      throw new MtpError("Die Uhr ist gerade von einem anderen Programm belegt.", "busy");
    }
    this.itf = pick.itf.interfaceNumber;
    this.epIn = pick.bin.endpointNumber;
    this.epOut = pick.bout.endpointNumber;
    this.packet = pick.bout.packetSize || 512;
    const r = await this.op(OP.OPEN, [1]);
    if (r.code !== RC_OK && r.code !== RC_SESSION_OPEN) throw new MtpError("Sitzung mit der Uhr fehlgeschlagen (0x" + r.code.toString(16) + ").", "session");
  }

  async close() {
    try { await this.op(OP.CLOSE); } catch (e) { /* ignore */ }
    try { await this.dev.releaseInterface(this.itf); } catch (e) { /* ignore */ }
    try { await this.dev.close(); } catch (e) { /* ignore */ }
  }

  async write(buf) {
    await this.dev.transferOut(this.epOut, buf);
    if (buf.length % this.packet === 0) await this.dev.transferOut(this.epOut, new Uint8Array(0));
  }

  // one whole container (skips zero-length packets between containers)
  async readContainer() {
    let chunks = [], got = 0, want = 0;
    for (;;) {
      const r = await this.dev.transferIn(this.epIn, Math.max(16384, want - got));
      const b = new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength);
      if (!b.length) continue;
      if (!want) want = new DataView(b.buffer, b.byteOffset).getUint32(0, true);
      chunks.push(b);
      got += b.length;
      if (got >= want) break;
    }
    const all = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { all.set(c, o); o += c.length; }
    const dv = new DataView(all.buffer);
    return { type: dv.getUint16(4, true), code: dv.getUint16(6, true), body: all.subarray(12, want), dv };
  }

  // command [+ outgoing data] → [incoming data] + response
  async op(code, params = [], dataOut = null) {
    const tid = ++this.tid;
    await this.write(container(T_COMMAND, code, tid, params));
    if (dataOut) {
      // Garmin only accepts the data phase with the 12-byte header in its own transfer (as libmtp sends it)
      const head = container(T_DATA, code, tid);
      new DataView(head.buffer).setUint32(0, 12 + dataOut.length, true);
      await this.dev.transferOut(this.epOut, head);
      await this.write(dataOut);
    }
    let data = null;
    for (;;) {
      const c = await this.readContainer();
      if (c.type === T_DATA) { data = c.body; continue; }
      if (c.type === T_RESPONSE) {
        const p = [];
        for (let i = 0; 12 + i * 4 + 4 <= c.dv.getUint32(0, true); i++) p.push(c.dv.getUint32(12 + i * 4, true));
        return { code: c.code, params: p, data };
      }
    }
  }

  async check(code, params, dataOut, what) {
    const r = await this.op(code, params, dataOut);
    if (r.code !== RC_OK) throw new MtpError(what + " fehlgeschlagen (0x" + r.code.toString(16) + ").", "op");
    return r;
  }

  async storages() {
    const r = await this.check(OP.STORAGES, [], null, "Speicher lesen");
    return u32Array(r.data);
  }

  async children(storage, parent) {
    const r = await this.check(OP.HANDLES, [storage, 0, parent], null, "Ordner lesen");
    const out = [];
    for (const h of u32Array(r.data)) {
      const info = await this.check(OP.INFO, [h], null, "Datei-Info lesen");
      const dv = new DataView(info.data.buffer, info.data.byteOffset, info.data.byteLength);
      out.push({ handle: h, format: dv.getUint16(4, true), parent: dv.getUint32(38, true), name: readPtpString(dv, 52) });
    }
    return out;
  }

  async sendFile(storage, parent, name, bytes) {
    const strs = [ptpString(name), ptpString(""), ptpString(""), ptpString("")];
    const info = new Uint8Array(52 + strs.reduce((a, s) => a + s.length, 0));
    const dv = new DataView(info.buffer);
    dv.setUint32(0, storage, true);
    dv.setUint16(4, FMT_UNDEFINED, true);
    dv.setUint32(8, bytes.length, true);
    dv.setUint32(38, parent, true);
    let o = 52;
    for (const s of strs) { info.set(s, o); o += s.length; }
    await this.check(OP.SEND_INFO, [storage, parent], info, "Datei anmelden");
    await this.check(OP.SEND, [], bytes, "Datei senden");
  }
}

function u32Array(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const n = dv.getUint32(0, true);
  return Array.from({ length: n }, (_, i) => dv.getUint32(4 + i * 4, true));
}

const findDir = (list, name) => list.find((x) => x.format === FMT_ASSOC && x.name.toUpperCase() === name);

/**
 * Asks the user to pick the watch, then copies `bytes` to GARMIN/APPS/<name>
 * (an existing file of the same name is replaced).
 * @param {string} name
 * @param {Uint8Array} bytes
 * @param {(msg: string) => void} [status]
 */
export async function sendToWatch(name, bytes, status = () => {}) {
  if (!usbSupported()) throw new MtpError("Dieser Browser kann nicht per USB mit der Uhr sprechen.", "no_webusb");
  let dev;
  try {
    dev = await navigator.usb.requestDevice({ filters: [{ vendorId: GARMIN_VID }] });
  } catch (e) {
    throw new MtpError("Keine Uhr ausgewählt.", "declined");
  }
  const mtp = new Mtp(dev);
  try {
    status("Verbinde mit der Uhr …");
    await mtp.open();
    status("Suche GARMIN/APPS …");
    let target = null;
    for (const s of await mtp.storages()) {
      const garmin = findDir(await mtp.children(s, 0xffffffff), "GARMIN");
      if (!garmin) continue;
      const apps = findDir(await mtp.children(s, garmin.handle), "APPS");
      if (apps) { target = { storage: s, apps: apps.handle }; break; }
    }
    if (!target) throw new MtpError("Ordner GARMIN/APPS nicht gefunden.", "no_apps");
    for (const f of await mtp.children(target.storage, target.apps)) {
      if (f.format !== FMT_ASSOC && f.name.toUpperCase() === name.toUpperCase()) {
        status("Ersetze vorhandenes Watchface …");
        await mtp.check(OP.DELETE, [f.handle], null, "Alte Datei löschen");
      }
    }
    status("Übertrage " + name + " …");
    await mtp.sendFile(target.storage, target.apps, name, bytes);
  } finally {
    await mtp.close();
  }
}
