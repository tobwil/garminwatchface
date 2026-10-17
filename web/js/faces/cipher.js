// CIPHER — "Geheimcode": the time is shown ENCRYPTED. After every wrist raise a
// decryption runs (~3 s: progress bar, scrambling digits that lock one by one), then the
// plain time stays below the code until the watch sleeps. AOD shows the code only.
// Styles: 1 Binär (BCD LED clock), 2 Morse, 3 Römisch (engraved stone tablet).
// Mirrors watch/source/faces/Cipher.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

// morse digits as 5-bit masks, bit (16 >> k) set = dash at position k
const MB = [31, 15, 7, 3, 1, 0, 16, 24, 28, 30];
const MORSE = ["-----", ".----", "..---", "...--", "....-", ".....", "-....", "--...", "---..", "----."];
const RV = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
const RS = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
const SCR = "0123456789ABCDEF#%&*?$";
// Binär: LED columns (H tens, H ones, M tens, M ones), rows (8 4 2 1), bits per column
const BX = [127, 185, 269, 327];
const BY = [124, 168, 212, 256];
const BN = [2, 4, 3, 4];
// Morse: rows (H tens, H ones, M tens, M ones), first symbol cell
const MY = [112, 156, 236, 280];
const MX = 64;
const DEC0 = 900; // decryption starts (ms after the raise) ...
const DECL = 2600; // ... and takes this long
const LOCK = [0.2, 0.42, 0.64, 0.86]; // progress at which digit i locks
const GOLD = 0xe9c46a;
const UNIT = 150; // morse lamp time unit (ms)

let busy = true;
let lamp = false;
let cKey = -1;
let cDat = null; // [enc date, dec date, h roman, m roman]

function digs(d) {
  const h = G.hour(d);
  return [Math.floor(h / 10), h % 10, Math.floor(d.m / 10), d.m % 10];
}

function roman(n) {
  if (n <= 0) return "N"; // nulla
  let s = "";
  for (let i = 0; i < 13; i++) {
    while (n >= RV[i]) { s += RS[i]; n -= RV[i]; }
  }
  return s;
}

function bin(n, bits) {
  let s = "";
  for (let b = bits - 1; b >= 0; b--) s += (n >> b) & 1 ? "1" : "0";
  return s;
}

// decryption progress 0..1 with five little "computing" stalls (monotonic)
function prog(ms) {
  const p = G.clamp((ms - DEC0) / DECL, 0, 1);
  if (p >= 1) return 1;
  return p - Math.sin(p * 31.415927) / 31.415927;
}

function strs(d) {
  if (cKey !== d.unix || cDat === null) {
    cKey = d.unix;
    const st = d.cfg.style;
    let enc;
    if (st === 1) enc = bin(d.day, 5) + "." + bin(d.mon, 4);
    else if (st === 2) enc = MORSE[Math.floor(d.day / 10)] + " " + MORSE[d.day % 10] + "/" + MORSE[Math.floor(d.mon / 10)] + " " + MORSE[d.mon % 10];
    else enc = roman(d.day) + "." + roman(d.mon) + "." + roman(d.year);
    cDat = [enc, d.dowStr + " " + d.day + ". " + d.monStr, roman(G.hour(d)), roman(d.m)];
  }
  return cDat;
}

// glowing round LED
function led(dc, x, y, r, on, acc, hl) {
  if (on) {
    const c = hl > 0 ? G.mix(acc, 0xffffff, hl * 0.6) : acc;
    dc.setColor(G.dim(c, 0.13), -1);
    dc.fillCircle(x, y, r + 8);
    dc.setColor(G.dim(c, 0.3), -1);
    dc.fillCircle(x, y, r + 3);
    dc.setColor(G.mix(c, 0x000000, 0.25), -1);
    dc.fillCircle(x, y, r);
    dc.setColor(c, -1);
    dc.fillCircle(x, y, r - 3);
    dc.setColor(G.mix(c, 0xffffff, 0.45), -1);
    dc.fillCircle(x - 1, y - 2, r - 9);
    dc.setColor(G.mix(c, 0xffffff, 0.85), -1);
    dc.fillCircle(x - 5, y - 6, 3);
  } else {
    dc.setColor(hl > 0 ? G.dim(acc, 0.1 + hl * 0.25) : 0x0c0c0c, -1);
    dc.fillCircle(x, y, r);
    dc.setColor(G.mix(0x262626, acc, 0.12 + hl * 0.4), -1);
    dc.setPenWidth(2);
    dc.drawCircle(x, y, r);
    dc.setColor(0x1c1c1c, -1);
    dc.fillCircle(x - 5, y - 6, 2);
  }
}

// one morse symbol (dot / dash), centred in its 44 px cell
function sym(dc, dash, cx, y, g, col, glow) {
  if (!dash) {
    if (glow >= 0) { dc.setColor(glow, -1); dc.fillCircle(cx, y, 8 * g + 4); }
    dc.setColor(col, -1);
    dc.fillCircle(cx, y, 8 * g);
  } else {
    const w = Math.round(22 * g) * 2;
    if (glow >= 0) { dc.setColor(glow, -1); dc.fillRoundedRectangle(cx - w / 2 - 4, y - 12, w + 8, 24, 12); }
    dc.setColor(col, -1);
    dc.fillRoundedRectangle(cx - w / 2, y - 8, w, 16, 8);
  }
}

// morse lamp: which symbol (0..9 over the two minute digits) is lit at time u (ms), or -1
function lampSym(dg, u) {
  let tot = 0;
  for (let i = 2; i < 4; i++) {
    for (let k = 0; k < 5; k++) tot += ((MB[dg[i]] & (16 >> k)) === 0 ? 1 : 3) + (k < 4 ? 1 : 3);
  }
  tot += 4; // word gap (3 + 4 = 7 units)
  let t = Math.floor(u / UNIT) % tot;
  for (let i = 2; i < 4; i++) {
    for (let k = 0; k < 5; k++) {
      const on = (MB[dg[i]] & (16 >> k)) === 0 ? 1 : 3;
      if (t < on) return (i - 2) * 5 + k;
      t -= on + (k < 4 ? 1 : 3);
      if (t < 0) return -1;
    }
  }
  return -1;
}

// stone tablet (Römisch)
function tablet(dc, sweep) {
  dc.setColor(0x15120f, -1);
  dc.fillRoundedRectangle(80, 102, 300, 190, 16);
  dc.setColor(0x2b2620, -1);
  dc.fillRoundedRectangle(76, 98, 300, 190, 16);
  if (sweep > 0) {
    // torch light sweeping over the stone while it is "read"
    const x = Math.round(76 + sweep * 300);
    dc.setColor(0x332d26, -1);
    dc.fillRectangle(G.clamp(x - 34, 84, 368), 104, G.clamp(x + 34, 84, 368) - G.clamp(x - 34, 84, 368), 178);
    dc.setColor(0x3b342c, -1);
    dc.fillRectangle(G.clamp(x - 14, 84, 368), 104, G.clamp(x + 14, 84, 368) - G.clamp(x - 14, 84, 368), 178);
  }
  // speckles
  let s = 7331;
  for (let i = 0; i < 46; i++) {
    s = G.rnd(s);
    const x = 90 + (s % 272);
    s = G.rnd(s);
    const y = 110 + (s % 168);
    dc.setColor(i % 3 === 0 ? 0x39332b : 0x201c18, -1);
    dc.fillRectangle(x, y, 2 + (i % 2), 2);
  }
  // chiselled inner frame: dark groove + light lower edge
  dc.setPenWidth(2);
  dc.setColor(0x16130f, -1);
  dc.drawRoundedRectangle(86, 108, 280, 170, 9);
  dc.setColor(0x413a31, -1);
  dc.drawRoundedRectangle(88, 110, 280, 170, 9);
  // crack from the top right corner
  dc.setColor(0x14110e, -1);
  dc.drawLine(348, 98, 341, 112);
  dc.drawLine(341, 112, 346, 123);
  dc.drawLine(346, 123, 337, 139);
  dc.setPenWidth(1);
  dc.drawLine(346, 123, 356, 131);
}

// engraved, gilded roman numerals (write-on with prog)
function engrave(dc, txt, y, maxW, hMax, pg) {
  let h = hMax;
  const w = F.stW(txt, h);
  if (w > maxW) h = (hMax * maxW) / w;
  const pen = Math.max(4, Math.round(h / 8.5));
  dc.setColor(0x4c453b, -1);
  F.st(dc, txt, 229, y + 2, h, pen, 1, pg, 0);
  dc.setColor(0x0d0b09, -1);
  F.st(dc, txt, 227, y, h, pen, 1, pg, 0);
  dc.setColor(GOLD, -1);
  F.st(dc, txt, 227, y, h, pen - 3, 1, pg, 0);
}

export default {
  get fps() { return busy ? 15 : lamp ? 10 : 2; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const live = a.live;
    const ms = live ? a.t : 99999;
    const q = prog(ms);
    const done = q >= 1;
    const dg = digs(d);
    const S = strs(d);
    const seed = d.wakeN * 977 + 13;
    const scr = Math.floor(ms / 70);
    busy = live && ms < DEC0 + DECL + 200;
    lamp = st === 2 && live;

    // ---- header (typed in)
    const key = 1000 + (G.rnd(d.wakeN * 7 + 3) % 9000);
    const h1 = "CHIFFRE " + st + "/3";
    const h2 = "SCHLÜSSEL #" + key;
    const nT = Math.floor(ms / 28);
    if (nT > 0) {
      dc.setColor(G.dim(acc, 0.75), -1);
      F.px(dc, h1.substring(0, G.clamp(nT, 0, h1.length)), 227 - F.pxW(h1, 2) / 2, 48, 2, 0, 0);
      dc.setColor(0x6a6a6a, -1);
      F.px(dc, h2.substring(0, G.clamp(nT - 6, 0, h2.length)), 227 - F.pxW(h2, 2) / 2, 68, 2, 0, 0);
    }

    // ---- the code
    const scanning = ms >= DEC0 && !done;
    if (st === 1) {
      // legend 8 4 2 1
      dc.setColor(0x4a4a4a, -1);
      for (let r = 0; r < 4; r++) F.px(dc, "" + (8 >> r), 82, BY[r] - 7, 2, 1, 0);
      // colon
      dc.setColor(G.dim(acc, 0.45), -1);
      dc.fillCircle(227, 190, 4);
      dc.fillCircle(227, 234, 4);
      const sx = 100 + q * 254;
      if (scanning) {
        dc.setColor(G.dim(acc, 0.35), -1);
        dc.setPenWidth(2);
        dc.drawLine(sx, 98, sx, 282);
      }
      for (let c = 0; c < 4; c++) {
        for (let r = 4 - BN[c]; r < 4; r++) {
          const t0 = 80 + c * 110 + r * 45;
          if (ms < t0) continue;
          let on = (dg[c] & (8 >> r)) !== 0;
          if (ms - t0 < 260) on = G.rnd(seed + c * 31 + r * 7 + Math.floor(ms / 55)) % 2 === 0;
          let hl = 0;
          if (scanning) {
            const dx = Math.abs(BX[c] - sx);
            if (dx < 34) hl = 1 - dx / 34;
          }
          led(dc, BX[c], BY[r], 17, on, acc, hl);
        }
      }
    } else if (st === 2) {
      // legend between hours and minutes
      dc.setColor(0x505050, -1);
      F.px(dc, "1=.----  6=-....", 227, 189, 2, 1, 0);
      const hiS = live && done ? lampSym(dg, ms - (DEC0 + DECL)) : -1;
      const glow = G.dim(acc, 0.2);
      for (let i = 0; i < 4; i++) {
        const code = MB[dg[i]];
        for (let k = 0; k < 5; k++) {
          const t0 = 120 + i * 170 + k * 55;
          if (ms < t0) continue;
          const g = G.ease((ms - t0) / 160);
          let col = acc;
          let gl = glow;
          if (scanning) {
            const w = Math.abs(q * 4 - (i + (k + 0.5) / 5));
            if (w < 0.12) col = G.mix(acc, 0xffffff, 0.7 * (1 - w / 0.12));
          }
          if (hiS >= 0 && i >= 2 && (i - 2) * 5 + k === hiS) { col = G.mix(acc, 0xffffff, 0.75); gl = G.dim(acc, 0.45); }
          sym(dc, (code & (16 >> k)) !== 0, MX + k * 54 + 22, MY[i], g, col, gl);
        }
      }
      // signal lamp: blinks the minutes in morse while awake
      if (done && live) {
        const on = hiS >= 0;
        dc.setColor(on ? G.dim(acc, 0.3) : 0x101010, -1);
        dc.fillCircle(227, 400, 15);
        dc.setColor(on ? acc : 0x2a2a2a, -1);
        dc.fillCircle(227, 400, 9);
        if (on) {
          dc.setColor(G.mix(acc, 0xffffff, 0.7), -1);
          dc.fillCircle(227, 400, 4);
        }
      }
    } else {
      tablet(dc, scanning ? q : 0);
      dc.setColor(0x5a5248, -1);
      F.px(dc, "I=1 V=5 X=10 L=50", 227, 258, 2, 1, 0);
      // interpunct groove between hours and minutes
      dc.setColor(0x16130f, -1);
      dc.fillRectangle(150, 183, 154, 2);
      dc.setColor(0x413a31, -1);
      dc.fillRectangle(150, 185, 154, 1);
      dc.setColor(0x16130f, -1);
      dc.fillPolygon([[227, 177], [234, 184], [227, 191], [220, 184]]);
      dc.setColor(G.dim(GOLD, 0.8), -1);
      dc.fillPolygon([[227, 180], [231, 184], [227, 188], [223, 184]]);
      engrave(dc, S[2], 145, 250, 60, G.easeInOut((ms - 150) / 700.0));
      engrave(dc, S[3], 222, 250, 48, G.easeInOut((ms - 550) / 700.0));
    }

    // ---- plain digits (scramble, then lock one by one)
    let xs, ys;
    if (st === 1) { xs = BX; ys = [312, 312, 312, 312]; }
    else if (st === 2) { xs = [388, 388, 388, 388]; ys = MY; }
    else { xs = [163, 199, 255, 291]; ys = [314, 314, 314, 314]; }
    const dh = st === 2 ? 30 : 38;
    for (let i = 0; i < 4; i++) {
      if (ms < 200 + i * 90) continue;
      let txt, col;
      if (ms < DEC0) { txt = "_"; col = 0x333333; }
      else if (q < LOCK[i]) { txt = "" + (G.rnd(seed + i * 101 + scr) % 10); col = G.dim(acc, 0.5); }
      else {
        txt = "" + dg[i];
        const f = G.clamp((q - LOCK[i]) / 0.1, 0, 1);
        col = G.mix(acc, d.dcol, f);
      }
      dc.setColor(col, -1);
      F.st(dc, txt, xs[i], ys[i], dh, st === 2 ? 4 : 5, 1, 1.0, 0);
    }
    if (st !== 2 && ms >= DEC0) {
      dc.setColor(q >= LOCK[1] ? d.dcol : 0x333333, -1);
      dc.fillRectangle(224, 302, 6, 6);
      dc.fillRectangle(224, 318, 6, 6);
    }

    // ---- date: encoded, then decrypted char by char
    const dq = G.clamp((q - 0.45) / 0.5, 0, 1);
    if (ms >= 300) {
      if (dq <= 0) {
        dc.setColor(G.dim(acc, 0.55), -1);
        F.px(dc, S[0], 227, 340, 2, 1, 0);
      } else {
        const dec = S[1];
        const n = Math.floor(dq * dec.length);
        const x0 = 227 - F.pxW(dec, 2) / 2;
        dc.setColor(0xbbbbbb, -1);
        F.px(dc, dec.substring(0, n), x0, 340, 2, 0, 0);
        if (n < dec.length) {
          let r = "";
          for (let k = n; k < dec.length; k++) r += dec.substring(k, k + 1) === " " ? " " : SCR.substring(G.rnd(seed + k * 13 + scr) % 22, G.rnd(seed + k * 13 + scr) % 22 + 1);
          dc.setColor(G.dim(acc, 0.55), -1);
          F.px(dc, r, x0 + n * 12, 340, 2, 0, 0);
        }
      }
    }

    // ---- status line + progress bar
    if (ms >= 200) {
      const pct = Math.floor(q * 100);
      const bx = 137;
      if (ms < DEC0) {
        dc.setColor(0x777777, -1);
        F.px(dc, "VERSCHLÜSSELT", 227, 362, 2, 1, 0);
      } else if (!done) {
        dc.setColor(acc, -1);
        F.px(dc, "ENTSCHLÜSSELE " + pct + "%", bx - 10, 362, 2, 0, 0);
      } else {
        const tw = F.pxW("KLARTEXT", 2);
        dc.setColor(G.dim(acc, 0.8), -1);
        F.px(dc, "KLARTEXT", 227 - (tw + 14) / 2, 362, 2, 0, 0);
        if (!live || Math.floor(a.t / 500) % 2 === 0) dc.fillRectangle(227 + (tw + 14) / 2 - 10, 361, 10, 16);
      }
      if (!(st === 2 && done && live)) {
        const lit = Math.floor(q * 18);
        for (let k = 0; k < 18; k++) {
          dc.setColor(k < lit ? (done ? G.dim(acc, 0.55) : acc) : 0x1e1e1e, -1);
          dc.fillRectangle(bx + k * 10, 386, 8, 8);
        }
      }
      // Binär: live seconds as six small LEDs under the bar
      if (st === 1 && done && live) {
        for (let k = 0; k < 6; k++) {
          const on = (d.s & (32 >> k)) !== 0;
          dc.setColor(on ? acc : 0x222222, -1);
          dc.fillCircle(227 - 50 + k * 20, 410, on ? 4 : 3);
        }
      }
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const acc = d.accent;
    const dg = digs(d);
    const ox = o[0], oy = o[1];
    if (st === 1) {
      dc.setPenWidth(2);
      dc.setColor(G.dim(acc, 0.45), -1);
      for (let c = 0; c < 4; c++) {
        for (let r = 4 - BN[c]; r < 4; r++) {
          if ((dg[c] & (8 >> r)) !== 0) dc.drawCircle(BX[c] + ox, BY[r] + oy + 30, 15);
          else {
            dc.setColor(0x262626, -1);
            dc.fillRectangle(BX[c] + ox - 1, BY[r] + oy + 29, 3, 3);
            dc.setColor(G.dim(acc, 0.45), -1);
          }
        }
      }
      dc.setColor(G.dim(acc, 0.3), -1);
      dc.fillCircle(227 + ox, 220 + oy, 2);
      dc.fillCircle(227 + ox, 264 + oy, 2);
    } else if (st === 2) {
      dc.setPenWidth(2);
      dc.setColor(G.dim(acc, 0.45), -1);
      for (let i = 0; i < 4; i++) {
        const code = MB[dg[i]];
        for (let k = 0; k < 5; k++) {
          const cx = MX + 32 + k * 54 + ox, y = MY[i] + oy + 20;
          if ((code & (16 >> k)) === 0) dc.drawCircle(cx, y, 7);
          else dc.drawRoundedRectangle(cx - 21, y - 7, 42, 14, 7);
        }
      }
    } else {
      dc.setColor(G.dim(GOLD, 0.5), -1);
      const hs = roman(G.hour(d)), mn = roman(d.m);
      let h = 64;
      if (F.stW(hs, h) > 250) h = (64 * 250) / F.stW(hs, 64);
      F.st(dc, hs, 227 + ox, 180 + oy, h, 2, 1, 1.0, 0);
      h = 54;
      if (F.stW(mn, h) > 250) h = (54 * 250) / F.stW(mn, 54);
      F.st(dc, mn, 227 + ox, 260 + oy, h, 2, 1, 1.0, 0);
    }
  },
};
