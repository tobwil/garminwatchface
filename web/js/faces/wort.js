// WORT — German word clock ("ES IST VIERTEL NACH ZEHN") on an 11x10 letter
// grid, 0-4 minute dots below. Styles: 1 Klassisch, 2 Akzent, 3 Neon.
// Mirrors watch/source/faces/Wort.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { FONTDATA as FD } from "../engine/fontdata.js";

const GRID = [
  "ESKISTAFÜNF",
  "ZEHNZWANZIG",
  "DREIVIERTEL",
  "VORFUNKNACH",
  "HALBAELFÜNF",
  "EINSXAMZWEI",
  "DREIPMJVIER",
  "SECHSNLACHT",
  "SIEBENZWÖLF",
  "ZEHNEUNKUHR",
];
const CW = 28, RH = 27; // cell width / row height
const X0 = 227 - 5 * CW, Y0 = 90;
const LH = 16; // letter cap height
// words: row, col, len (flat triples)
// 0 ES 1 IST 2 FÜNF 3 ZEHN 4 ZWANZIG 5 VIERTEL 6 VOR 7 NACH 8 HALB 9 UHR
// 10..21 hours EINS..ZWÖLF (index 9 + h), 22 EIN
const W = [
  0, 0, 2, 0, 3, 3, 0, 7, 4, 1, 0, 4, 1, 4, 7, 2, 4, 7, 3, 0, 3, 3, 7, 4, 4, 0, 4, 9, 8, 3,
  5, 0, 4, 5, 7, 4, 6, 0, 4, 6, 7, 4, 4, 7, 4, 7, 0, 5, 8, 0, 6, 7, 7, 4, 9, 3, 4, 9, 0, 4, 4, 5, 3, 8, 6, 5,
  5, 0, 3,
];
// sentence per 5-minute step: minute words; -1 = hour (current), -2 = hour (next)
const SENT = [
  [-1, 9], [2, 7, -1], [3, 7, -1], [5, 7, -1], [4, 7, -1], [2, 6, 8, -2],
  [8, -2], [2, 7, 8, -2], [4, 6, -2], [5, 6, -2], [3, 6, -2], [2, 6, -2],
];

// word indices of the current sentence (ES IST first)
function sentence(d) {
  const m5 = Math.floor(d.m / 5);
  const out = [0, 1];
  const sw = SENT[m5];
  for (let i = 0; i < sw.length; i++) {
    let w = sw[i];
    if (w < 0) {
      let hh = (d.h + (w === -2 ? 1 : 0)) % 12;
      if (hh === 0) hh = 12;
      w = m5 === 0 && hh === 1 ? 22 : 9 + hh;
    }
    out.push(w);
  }
  return out;
}

// per-cell order value (letter position in the sentence incl. word pauses), -1 = unlit
function litMap(d) {
  const lit = new Array(110).fill(-1);
  const ws = sentence(d);
  let k = 0;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    const r = W[w * 3], c = W[w * 3 + 1], n = W[w * 3 + 2];
    for (let j = 0; j < n; j++) { lit[r * 11 + c + j] = k; k += 1; }
    k += 1.5; // pause between words
  }
  lit.push(k); // total length at the end
  return lit;
}

// stroke-font glyph index per cell (precomputed)
const GI = [];
for (let i = 0; i < 110; i++) GI.push(FD.strokeMap[GRID[Math.floor(i / 11)].charCodeAt(i % 11)] - 1);

// Fast path for the dim letters: one centred glyph at pen 2, pixel-identical to
// F.st(dc, ch, x, y, LH, 2, 1, 1.0, 0) but without its per-call string work.
function glyph2(dc, gi, x, y) {
  const s = LH / 80;
  const ox = x - (FD.strokeW[gi] * s) / 2, oy = y - LH / 2 - 24 * s;
  const b = FD.strokeOffs[gi + 1];
  let hasP = false, single = true, px = 0, py = 0;
  let i = FD.strokeOffs[gi];
  while (i < b) {
    const xb = FD.strokeData[i];
    if (xb === 255) {
      if (single && hasP) dc.fillCircle(px, py, 1.44);
      hasP = false; single = true; i += 1; continue;
    }
    const nx = ox + (xb & 127) * s, ny = oy + FD.strokeData[i + 1] * s;
    if (hasP) { single = false; dc.drawLine(px, py, nx, ny); }
    px = nx; py = ny; hasP = true; i += 2;
  }
  if (single && hasP) dc.fillCircle(px, py, 1.44);
}

function cols(d) {
  const st = d.cfg.style;
  const acc = d.accent;
  return {
    on: st === 1 ? 0xffffff : acc,
    off: st === 3 ? G.mix(0x1c1c1c, acc, 0.12) : 0x262626,
    glow: st === 3,
  };
}

export default {
  fps: 0,

  // static layer: the whole design (nothing moves once it is revealed)
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    if (a.bg) return;
    const p = a.intro;
    const c = cols(d);
    const lit = litMap(d);
    const total = lit[110];
    const step = 0.6 / total;

    // unlit letters (flicker in)
    dc.setColor(c.off, -1);
    dc.setPenWidth(2);
    for (let i = 0; i < 110; i++) {
      if (lit[i] >= 0) continue;
      const t0 = 0.04 + G.rf(G.rnd(i * 7919 + 13)) * 0.5;
      if (p < t0) continue;
      if (p < t0 + 0.12 && (Math.floor(a.t / 40) + i) % 3 === 0) continue;
      const r = Math.floor(i / 11), cc = i % 11;
      glyph2(dc, GI[i], X0 + cc * CW, Y0 + r * RH);
    }

    // lit letters (typewriter, word by word)
    for (let i = 0; i < 110; i++) {
      if (lit[i] < 0) continue;
      const lp = G.stag(p, lit[i], step, 0.16);
      const r = Math.floor(i / 11), cc = i % 11;
      const x = X0 + cc * CW, y = Y0 + r * RH;
      const ch = GRID[r][cc];
      if (lp <= 0) {
        if (p > 0.04) { dc.setColor(c.off, -1); dc.setPenWidth(2); glyph2(dc, GI[i], x, y); }
        continue;
      }
      if (c.glow) {
        // cheap radial halo (stacked discs) instead of extra stroke passes
        dc.setColor(G.dim(c.on, 0.09 * lp), -1);
        dc.fillCircle(x, y, 14);
        dc.setColor(G.dim(c.on, 0.19 * lp), -1);
        dc.fillCircle(x, y, 9.5);
      }
      // flash white, settle to the lit colour
      const col = lp < 0.5 ? G.mix(c.off, 0xffffff, lp * 2) : G.mix(0xffffff, c.on, (lp - 0.5) * 2);
      dc.setColor(col, -1);
      F.st(dc, ch, x, y, LH, 3, 1, 1.0, 0);
    }

    // date line + minute dots
    const ep = G.ease((p - 0.55) / 0.45);
    dc.setColor(G.dim(0x8a8a8a, ep), -1);
    F.st(dc, d.dowStr + " " + d.day, 227, Y0 + 9 * RH + 38, 15, 2, 1, ep, 0);
    const md = d.m % 5;
    for (let k = 0; k < 4; k++) {
      const q = G.stag(p, k, 0.05, 0.2) * (p > 0.7 ? 1 : 0);
      const deg = 180 - (k - 1.5) * 9;
      const x = G.ptX(227, 196, deg), y = G.ptY(227, 196, deg);
      const on = k < md;
      if (on && c.glow) { dc.setColor(G.dim(c.on, 0.3 * q), -1); dc.fillCircle(x, y, 7); }
      dc.setColor(on ? G.mix(c.off, c.on, q) : c.off, -1);
      dc.fillCircle(x, y, on ? 4 : 3);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const c = cols(d);
    const lit = litMap(d);
    dc.setColor(d.cfg.style === 1 ? 0x8a8a8a : G.dim(c.on, 0.6), -1);
    for (let i = 0; i < 110; i++) {
      if (lit[i] < 0) continue;
      const r = Math.floor(i / 11), cc = i % 11;
      F.st(dc, GRID[r][cc], X0 + cc * CW + o[0], Y0 + r * RH + o[1], LH, 2, 1, 1.0, 0);
    }
    const md = d.m % 5;
    for (let k = 0; k < md; k++) {
      const deg = 180 - (k - 1.5) * 9;
      dc.fillCircle(G.ptX(227 + o[0], 196, deg), G.ptY(227 + o[1], 196, deg), 3);
    }
  },
};
