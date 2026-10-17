// NIXIE — glowing Nixie tubes. Four big glass tubes with stacked wire cathodes (all ten
// digits visible as a faint wire tangle), the lit digit glows with a warm halo behind the
// anode mesh. Every wrist raise runs the "cathode check": the tubes warm up and cycle
// through all digits until the time locks in, tube by tube. Two INS-1 neon lamps blink the
// seconds, small tubes show the date, three neon windows the data slots. Occasional flicker.
// Styles: 1 Klassisch (accent glow), 2 Eisblau (IN-18 domes, ice blue + LED underglow),
// 3 Dekatron (the dial is a counting tube: a glow dot runs round the 60 cathodes = seconds).
// Mirrors watch/source/faces/Nixie.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

// Nixie digit wires in a 10 x 18 unit box. Ops of 6 numbers:
// [0, x1, y1, x2, y2, 0] line, [1, cx, cy, r, a0, a1] arc (clock degrees, clockwise), [2, cx, cy, r, 0, 0] circle
const GL = [
  [1, 5, 5, 5, -90, 90, 1, 5, 13, 5, 90, 270, 0, 0, 5, 0, 13, 0, 0, 10, 5, 10, 13, 0],
  [0, 5.5, 0, 5.5, 18, 0, 0, 5.5, 0, 2.5, 3, 0],
  [1, 5, 5, 5, -80, 125, 0, 9.1, 7.9, 0, 18, 0, 0, 0, 18, 10, 18, 0],
  [0, 0.5, 0, 10, 0, 0, 0, 10, 0, 3.6, 7.2, 0, 1, 5, 12.5, 5.5, -15, 240],
  [0, 7, 18, 7, 0, 0, 0, 7, 0, 0, 12.5, 0, 0, 0, 12.5, 10, 12.5, 0],
  [0, 9.5, 0, 1, 0, 0, 0, 1, 0, 1.5, 8.3, 0, 1, 5, 12.5, 5.5, -40, 240],
  [2, 5, 12.5, 5.5, 0, 0, 1, 13, 13, 13, -90, -30],
  [0, 0, 0, 10, 0, 0, 0, 10, 0, 3, 18, 0],
  [2, 5, 4.3, 4.3, 0, 0, 2, 5, 12.8, 5.2, 0, 0],
  [2, 5, 5.5, 5.5, 0, 0, 1, -3, 5, 13, 90, 150],
];
// round caps for thick passes (corners / free ends), x,y pairs
const CP = [
  [],
  [5.5, 18, 5.5, 0, 2.5, 3],
  [0.1, 4.1, 0, 18, 10, 18],
  [0.5, 0, 10, 0, 3.6, 7.2, 0.2, 15.2],
  [7, 18, 7, 0, 0, 12.5, 10, 12.5],
  [9.5, 0, 1, 0, 0.2, 15.2],
  [6.5, 1.7],
  [0, 0, 10, 0, 3, 18],
  [],
  [3.5, 16.3],
];
const WD = ["SONNTAG", "MONTAG", "DIENSTAG", "MITTWOCH", "DONNERSTAG", "FREITAG", "SAMSTAG"];
// layout per style: tube w, h, top, pair gap, colon gap, glyph h, date tube top, weekday y, slot y
const LAY = [
  [78, 156, 140, 10, 34, 104, 70, 50, 336],
  [84, 176, 126, 10, 34, 118, 64, 44, 340],
  [64, 128, 154, 8, 30, 84, 86, 66, 316],
];

let fx = 0; // ambient frame rate (set in draw)
let PIN = null; // dekatron pin coordinates, computed on first use

// one digit wire set; s = px per unit, caps = round ends for thick pens
function glyph(dc, dg, cx, cy, s, pen, caps) {
  const g = GL[dg];
  const ox = cx - 5 * s, oy = cy - 9 * s;
  for (let i = 0; i < g.length; i += 6) {
    const t = g[i];
    if (t === 0) dc.drawLine(ox + g[i + 1] * s, oy + g[i + 2] * s, ox + g[i + 3] * s, oy + g[i + 4] * s);
    else if (t === 1) G.arcC(dc, ox + g[i + 1] * s, oy + g[i + 2] * s, g[i + 3] * s, g[i + 4], g[i + 5]);
    else dc.drawCircle(ox + g[i + 1] * s, oy + g[i + 2] * s, g[i + 3] * s);
  }
  if (caps) {
    const c = CP[dg];
    for (let i = 0; i < c.length; i += 2) dc.fillCircle(ox + c[i] * s, oy + c[i + 1] * s, pen / 2);
  }
}

// glowing digit: 4 passes (wide halo, halo, body, hot core)
function glow(dc, dg, cx, cy, s, cols, big) {
  if (cols[2] === 0 || dg < 0) return;
  const pens = [s * 2.7, s * 1.6, s * 0.78, Math.max(2, s * 0.3)];
  for (let k = big ? 0 : 1; k < 4; k++) {
    dc.setColor(cols[k], -1);
    const pw = Math.round(pens[k]);
    dc.setPenWidth(pw);
    glyph(dc, dg, cx, cy, s, pw, big && k < 2);
  }
}

// glow palette scaled by brightness b (0..1.6; > 1 = lock flash towards white)
function pal(st, acc, b) {
  let c;
  if (st === 2) c = [0x06182a, 0x114c78, 0x44bff5, 0xe0f8ff];
  else c = [G.dim(acc, 0.17), G.dim(acc, 0.45), acc, G.mix(acc, 0xffffff, 0.62)];
  if (b > 1) {
    const w = G.clamp(b - 1, 0, 1);
    return [G.mix(c[0], c[1], w), G.mix(c[1], c[2], w), G.mix(c[2], c[3], w), G.mix(c[3], 0xffffff, w)];
  }
  return [G.dim(c[0], b), G.dim(c[1], b), G.dim(c[2], b), G.dim(c[3], b)];
}

// width of a nixie-style string (digits as wires, everything else stroke font)
function nsW(s, h) {
  const u = h / 18;
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    w += (c >= 48 && c <= 57 ? 10 * u : F.stW(s.substring(i, i + 1), h * 0.86)) + 4 * u;
  }
  return w - 4 * u;
}

// glowing nixie-style string centred on (cx, cy), cap height h
function nStr(dc, s, cx, cy, h, w, cols) {
  const u = h / 18;
  const x0 = cx - w / 2;
  const pens = [Math.round(u * 1.5), Math.max(2, Math.round(u * 0.42))];
  for (let k = 0; k < 2; k++) {
    dc.setColor(cols[k * 2 + 1], -1);
    dc.setPenWidth(pens[k]);
    let x = x0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 48 && c <= 57) {
        glyph(dc, c - 48, x + 5 * u, cy, u, pens[k], false);
        x += 14 * u;
      } else {
        const ch = s.substring(i, i + 1);
        x += F.st(dc, ch, x, cy, h * 0.86, pens[k], 0, 1.0, 0) + 4 * u;
      }
    }
  }
}

// anode mesh in front of the digits: diamond grid, lines clipped analytically to the box
function mesh(dc, x1, y1, x2, y2, col) {
  dc.setColor(col, -1);
  dc.setPenWidth(1);
  for (let m = Math.floor(x1 - y2) + 5; m < x2 - y1; m += 11) {
    const a = Math.max(y1, x1 - m), b = Math.min(y2, x2 - m);
    dc.drawLine(a + m, a, b + m, b);
  }
  for (let n = Math.floor(x1 + y1) + 5; n < x2 + y2; n += 11) {
    const a = Math.max(y1, n - x2), b = Math.min(y2, n - x1);
    dc.drawLine(n - a, a, n - b, b);
  }
}

// glass envelope of a tube (outline, highlights, tip); dome = IN-18 rounded top
function glass(dc, x, y, w, h, st, cg, ch) {
  const r = st === 2 ? w / 2 : w * 0.3;
  dc.setColor(cg, -1);
  dc.setPenWidth(2);
  dc.drawRoundedRectangle(x, y, w, h, r);
  dc.fillRoundedRectangle(x + w / 2 - 4, y - 6, 8, 9, 3);
  dc.setColor(ch, -1);
  dc.drawLine(x + 7, y + r + 4, x + 7, y + h - 26);
  dc.setPenWidth(1);
  dc.drawLine(x + w - 7, y + r + 10, x + w - 7, y + h * 0.55);
  G.arcC(dc, x + w / 2, y + r + 2, r - 7, 300, 340);
}

function hm12(d) { return d.is24 ? d.h : (d.h % 12 === 0 ? 12 : d.h % 12); }

export default {
  get fps() { return fx; },

  // static layer: tubes, rail, date tubes, neon windows; flicker, colon and dekatron glow move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const L = LAY[st - 1];
    const tw = L[0], th = L[1], ty = L[2], gp = L[3], cgp = L[4], gh = L[5];
    const p = a.intro;
    const live = a.live;
    const t = a.t;
    const acc = d.accent;
    const seed = d.wakeN * 7 + 3;
    fx = live ? (p < 1 ? 20 : st === 3 ? 15 : 10) : 0;

    // palette
    const cGlass = st === 2 ? 0x2b3a46 : 0x2e3133;
    const cHi = st === 2 ? 0x6c8798 : 0x5d6266;
    const cGhost = st === 2 ? 0x2f3a42 : 0x352f2a;
    const cMesh = st === 2 ? 0x121b22 : 0x1c1815;
    const cLbl = st === 2 ? 0x6f8696 : 0x8c7a68;

    const P1 = pal(st, acc, 1);
    // warm-up (first 30 % of the intro)
    const warm = G.ease(G.clamp((p - 0.04) / 0.3, 0, 1));

    // ---- dekatron ring (style 3): 60 cathode pins, a glow dot runs round = seconds
    if (st === 3) {
      if (S) {
        // glass rim: reflections only (full circles are expensive on the watch)
        dc.setColor(0x34383b, -1);
        dc.setPenWidth(1);
        G.arcC(dc, 227, 227, 219, 290, 350);
        G.arcC(dc, 227, 227, 219, 110, 170);
        G.arcC(dc, 227, 227, 193, 300, 340);
        // seconds index 0..50 outside the time area
        dc.setColor(0x4a4440, -1);
        for (let i = 0; i < 6; i++) {
          const lb = "" + i * 10;
          F.px(dc, lb, G.ptX(227, 180, i * 60), G.ptY(227, 180, i * 60) - 7, 2, 1, 0);
        }
        if (PIN === null) {
          PIN = [];
          for (let i = 0; i < 60; i++) {
            const r1 = i % 5 === 0 ? 199 : 202;
            PIN.push(G.ptX(227, r1, i * 6), G.ptY(227, r1, i * 6), G.ptX(227, 210, i * 6), G.ptY(227, 210, i * 6));
          }
        }
        dc.setPenWidth(3);
        for (let i = 0; i < 60; i++) {
          dc.setColor(i % 5 === 0 ? 0x5a5550 : 0x3a3633, -1);
          dc.drawLine(PIN[i * 4], PIN[i * 4 + 1], PIN[i * 4 + 2], PIN[i * 4 + 3]);
        }
      }
      // glow position: jumps pin to pin, gliding over the guide cathodes in the first 160 ms
      if (M) {
      const sec = d.s;
      let pos = sec;
      if (live && p >= 1) pos = sec - 1 + G.easeInOut(G.clamp(a.ms / 160, 0, 1));
      if (p < 1) pos = sec - 40 * (1 - G.ease(p)); // intro: the glow spins in
      const cd = pal(3, acc, warm);
      for (let k = 3; k >= 1; k--) {
        const ang = (pos - k * 0.7) * 6;
        dc.setColor(G.dim(cd[1], 0.9 - k * 0.22), -1);
        dc.fillCircle(G.ptX(227, 205, ang), G.ptY(227, 205, ang), 6 - k);
      }
      const ang = pos * 6;
      const gx = G.ptX(227, 205, ang), gy = G.ptY(227, 205, ang);
      dc.setColor(cd[0], -1);
      dc.fillCircle(gx, gy, 14);
      dc.setColor(cd[1], -1);
      dc.fillCircle(gx, gy, 9);
      dc.setColor(cd[2], -1);
      dc.fillCircle(gx, gy, 5);
      dc.setColor(cd[3], -1);
      dc.fillCircle(gx, gy, 2.5);
      }
    }

    // ---- base rail behind the sockets
    const by = ty + th - 12;
    const tot = 4 * tw + 2 * gp + cgp;
    const x0 = 227 - tot / 2;
    if (S) {
      dc.setColor(st === 2 ? 0x15191d : 0x15110e, -1);
      dc.fillRoundedRectangle(x0 - 10, by + 4, tot + 20, 16, 6);
      dc.setColor(st === 2 ? 0x46525c : 0x4a3a2c, -1);
      dc.setPenWidth(1);
      dc.drawLine(x0 - 4, by + 5, x0 + tot + 4, by + 5);
      if (st === 2) {
        // blue LED underglow
        for (let i = 0; i < 4; i++) {
          const tx = x0 + i * tw + (i > 0 ? gp : 0) + (i > 1 ? cgp : 0) + (i > 2 ? gp : 0);
          dc.setColor(G.dim(0x0f3a60, warm), -1);
          dc.fillEllipse(tx + tw / 2, by - 5, tw * 0.4, 13);
        }
      }
    }
    // ---- big tubes: HH MM
    const hh = hm12(d);
    // 12 h mode: the first tube stays dark before 10 o'clock (no leading zero)
    const dig = [!d.is24 && hh < 10 ? -1 : Math.floor(hh / 10), hh % 10, Math.floor(d.m / 10), d.m % 10];
    const s = gh / 18;
    const gcx = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const tx = x0 + i * tw + (i > 0 ? gp : 0) + (i > 1 ? cgp : 0) + (i > 2 ? gp : 0);
      const cx = tx + tw / 2;
      gcx[i] = cx;
      const cy = ty + th / 2 - 4;
      // brightness: warm-up, lock flash, ambient flicker
      const lockAt = 0.4 + 0.13 * i;
      let b = warm;
      let dg = dig[i];
      if (p < lockAt) {
        dg = (Math.floor(t / 55) + i * 3 + seed) % 10;
        // ignition: uneven, flickering strike
        b = warm * (0.55 + 0.3 * G.rf(G.rnd(Math.floor(t / 40) * 3 + i + seed)));
      } else if (p < lockAt + 0.16) b = 1 + 0.6 * (1 - (p - lockAt) / 0.16);
      if (live && p >= 1) {
        const k = Math.floor(t / 2300 + i * 0.41);
        const r = G.rf(G.rnd(k * 31 + i * 7 + seed));
        const ph = t - (k - i * 0.41) * 2300;
        if (r < 0.3 && ph < 200) b = 0.55 + 0.45 * G.rf(G.rnd(Math.floor(t / 45) + i));
        else b = 1;
      }
      // over the cached tubes only an ambient flicker redraws a tube
      if (!S && (!(live && p >= 1) || b === 1)) continue;
      const cols = b === 1 ? P1 : pal(st, acc, b);
      // glass glow fill
      if (dg >= 0) {
        dc.setColor(G.dim(cols[0], 0.7), -1);
        dc.fillEllipse(cx, cy, tw * 0.4, th * 0.36);
      }
      // the unlit cathode stack (wire tangle)
      dc.setPenWidth(1);
      for (let q = 0; q < 4; q++) {
        const z = (q * 7 + 3) % 10;
        if (z === dg) continue;
        dc.setColor(q % 2 === 0 ? cGhost : G.dim(cGhost, 0.72), -1);
        glyph(dc, z, cx + (q % 3 - 1) * 0.6, cy, s, 1, false);
      }
      glow(dc, dg, cx, cy, s, cols, true);
      // anode mesh in front (diamond grid, clipped to the tube)
      mesh(dc, tx + 5, ty + (st === 2 ? 20 : 10), tx + tw - 5, by - 12, cMesh);
      // supports + mica
      dc.setColor(0x3c3a38, -1);
      dc.drawLine(tx + 10, by - 12, tx + tw - 10, by - 12);
      glass(dc, tx, ty, tw, th, st, cGlass, cHi);
      // socket
      dc.setColor(st === 2 ? 0x2a2f34 : 0x1b1714, -1);
      dc.fillRoundedRectangle(tx - 3, by - 6, tw + 6, 16, 4);
      dc.setColor(st === 2 ? 0x8a96a0 : 0x6b5440, -1);
      dc.drawLine(tx, by - 5, tx + tw, by - 5);
    }

    // ---- INS-1 colon lamps: blink with the seconds
    const on = !live || p < 1 ? p > 0.5 : a.ms < 500;
    const cc = on ? P1 : pal(st, acc, 0.18);
    for (let k = 0; k < 2; k++) {
      const ly = ty + th * (k === 0 ? 0.36 : 0.62);
      dc.setColor(cGlass, -1);
      dc.setPenWidth(1);
      dc.drawRoundedRectangle(222, ly - 10, 10, 20, 5);
      dc.setColor(cc[0], -1);
      dc.fillCircle(227, ly, 9);
      dc.setColor(cc[1], -1);
      dc.fillCircle(227, ly, 5);
      dc.setColor(cc[3], -1);
      dc.fillCircle(227, ly, 2.5);
    }

    if (!S) return;
    // ---- weekday + small date tubes (DD.MM)
    const dp = G.ease(G.clamp((p - 0.25) / 0.5, 0, 1));
    dc.setColor(G.dim(cLbl, dp), -1);
    F.px(dc, WD[d.dow], 227, L[7], 2, 1, 0);
    const sw = 30, sh = 50, sy = L[6];
    const dd = [Math.floor(d.day / 10), d.day % 10, Math.floor(d.mon / 10), d.mon % 10];
    const ss = 30 / 18;
    for (let i = 0; i < 4; i++) {
      const tx = 227 - 2 * sw - 9 - 3 + i * (sw + 6) + (i > 1 ? 12 : 0);
      const cx = tx + sw / 2, cy = sy + sh / 2 - 1;
      const lockAt = 0.5 + 0.08 * i;
      let dg = dd[i];
      let b = dp;
      if (p < lockAt) { dg = (Math.floor(t / 60) + i * 5 + seed) % 10; b = dp * 0.8; }
      const cols = b === 1 ? P1 : pal(st, acc, b);
      dc.setColor(G.dim(cols[0], 0.8), -1);
      dc.fillEllipse(cx, cy, sw * 0.4, sh * 0.36);
      glow(dc, dg, cx, cy, ss, cols, false);
      if (i === 1) {
        // decimal point cathode
        dc.setColor(cols[1], -1);
        dc.fillCircle(tx + sw + 3, cy + 15, 4);
        dc.setColor(cols[3], -1);
        dc.fillCircle(tx + sw + 3, cy + 15, 1.5);
      }
      dc.setColor(cGlass, -1);
      dc.setPenWidth(1);
      dc.drawRoundedRectangle(tx, sy, sw, sh, st === 2 ? 15 : 9);
      dc.setColor(cHi, -1);
      dc.drawLine(tx + 4, sy + 10, tx + 4, sy + sh - 10);
    }

    // ---- data slots: neon windows
    const y0 = L[8];
    for (let k = 0; k < 3; k++) {
      const sl = d.slots[k];
      if (!sl.lbl) continue;
      const sp = G.stag(p, k, 0.1, 0.4);
      if (sp <= 0) continue;
      const cx = 227 + (k - 1) * (st === 3 ? 92 : 104);
      const ww = st === 3 ? 80 : 88;
      const cols = sp === 1 ? P1 : pal(st, acc, sp);
      dc.setColor(G.dim(cols[0], 0.9), -1);
      dc.fillRoundedRectangle(cx - ww / 2 + 3, y0 + 3, ww - 6, 28, 12);
      dc.setColor(cGlass, -1);
      dc.setPenWidth(1);
      dc.drawRoundedRectangle(cx - ww / 2, y0, ww, 34, 14);
      let hgt = 18;
      let w = nsW(sl.val, hgt);
      if (w > ww - 16) { hgt = (hgt * (ww - 16)) / w; w = ww - 16; }
      nStr(dc, sl.val, cx, y0 + 17, hgt, w, cols);
      dc.setColor(G.dim(cLbl, sp), -1);
      F.px(dc, sl.lbl, cx, y0 + 42, 2, 1, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const L = LAY[st - 1];
    const tw = L[0], th = L[1], ty = L[2] + o[1], gp = L[3], cgp = L[4];
    const s = L[5] / 18;
    const tot = 4 * tw + 2 * gp + cgp;
    const x0 = 227 - tot / 2 + o[0];
    const core = st === 2 ? 0x2f86b8 : G.dim(d.accent, 0.62);
    const halo = st === 2 ? 0x082236 : G.dim(d.accent, 0.16);
    const hh = hm12(d);
    const dig = [!d.is24 && hh < 10 ? -1 : Math.floor(hh / 10), hh % 10, Math.floor(d.m / 10), d.m % 10];
    for (let i = 0; i < 4; i++) {
      const tx = x0 + i * tw + (i > 0 ? gp : 0) + (i > 1 ? cgp : 0) + (i > 2 ? gp : 0);
      const cx = tx + tw / 2, cy = ty + th / 2 - 4;
      dc.setColor(0x1c1e20, -1);
      dc.setPenWidth(1);
      dc.drawRoundedRectangle(tx, ty, tw, th, st === 2 ? tw / 2 : tw * 0.3);
      if (dig[i] < 0) continue;
      dc.setColor(halo, -1);
      dc.setPenWidth(Math.round(s * 1.1));
      glyph(dc, dig[i], cx, cy, s, 0, false);
      dc.setColor(core, -1);
      dc.setPenWidth(2);
      glyph(dc, dig[i], cx, cy, s, 0, false);
    }
    dc.setColor(G.dim(core, 0.7), -1);
    dc.fillCircle(227 + o[0], ty + th * 0.36, 2);
    dc.fillCircle(227 + o[0], ty + th * 0.62, 2);
    dc.setColor(0x5a5048, -1);
    F.px(dc, d.dowStr + " " + d.day + "." + d.mon + ".", 227 + o[0], L[6] + 18 + o[1], 2, 1, 0);
  },
};
