// LATENT — "Latent": like an image-diffusion model, every wrist raise generates the time
// from pure noise in 50 denoising steps. The seed is the raise counter, so every look gives
// new noise, a new palette accent and a new background (mountains, stars, sun).
// Styles: 1 Diffusion (ML paper figure), 2 Pixel (chunky retro), 3 Aquarell (watercolour dabs
// that converge onto the digits, finished with an ink line). Mirrors watch/source/faces/Latent.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { FONTDATA as FD } from "../engine/fontdata.js";

// 7x11 digits for the Diffusion latent grid, one row bitmask per line (bit 6 = left)
const D7 = [62,127,99,99,99,99,99,99,99,127,62, 28,60,108,12,12,12,12,12,12,63,63, 62,127,99,3,7,14,28,56,112,127,127,
  62,127,99,3,30,30,3,3,99,127,62, 6,14,30,54,102,102,127,127,6,6,6, 127,127,96,96,126,127,3,3,99,127,62,
  62,127,96,96,126,127,99,99,99,127,62, 127,127,3,6,12,12,24,24,24,24,24, 62,127,99,99,62,62,99,99,99,127,62,
  62,127,99,99,99,127,63,3,3,127,62];
const NS = 50; // denoising steps
const SMS = 50; // ms per step (2.5 s)
const DOWS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
// second hue per seed (background tint of the Diffusion image)
const HUE = [0x5468ff, 0x8a5cff, 0xff4f8b, 0x2fb4ff, 0x39d98a];
// retro palettes, levels 1..5
const PIX = [0x1d2b53, 0x7e2553, 0xff004d, 0xffa300, 0xffec27, 0x0f380f, 0x306230, 0x8bac0f, 0x9bbc0f, 0xd8f0a0,
  0x352879, 0x6c5eb5, 0x70a4b2, 0x9ad284, 0xffffff];
const PIXN = ["SUNSET", "GAMEBOY", "C64", "AKZENT"];
// watercolour pigment pairs
const AQ = [0xe58f9e, 0xf2b26b, 0x7fb3e0, 0xa48ad4, 0x7dbf8e, 0x5fa8b0];
const PAPER = 0xf1e9da;
const INK = 0x3e3229;
const AY = 206; // aquarell time centre
const AH = 104; // aquarell time height
const SP = 15; // aquarell dab spacing along the stroke
// custom 5x7 glyphs: guillemets and a check mark
const GL = [0, 20, 10, 5, 10, 20, 0, 0, 5, 10, 20, 10, 5, 0, 0, 0, 1, 2, 20, 8, 0];

let busy = true;
let nKey = -1; // noise built for (raise, style)
let tKey = ""; // target built for (style, time, raise)
let tg = null; // target image, 0..255 per cell
let nz = null; // seeded noise, 0..255 per cell
let gc = 0, gr = 0, cs = 0, gx0 = 0, gy0 = 0, nm = 0;
let pmt = "";
let bn = 0; // aquarell: number of brush dabs
let bd = null; // per dab: tx, ty, sx, sy, r0, col, r1, edge col
let bq = null; // per dab per frame: x, y, r, e
let wn = 0;

function wake(d) { return Math.abs(d.wakeN) % 100000; }
function seedNo(w) { return ((w % 9000) * 7919 + 1013) % 9000 + 1000; }

// one of the custom glyphs (0 », 1 «, 2 check) at x, y (top) with dot size sc
function glyph(dc, g, x, y, sc) {
  for (let r = 0; r < 7; r++) {
    const b = GL[g * 7 + r];
    for (let c = 0; c < 5; c++) if (b & (16 >> c)) dc.fillRectangle(x + c * sc, y + r * sc, sc, sc);
  }
}

// the "prompt": time + a modifier chosen by the raise counter from what the data says
function prompt(d, w) {
  const m = ["minimalistisch", "gestochen scharf", "im bauhaus-stil", "ohne zeiger"];
  if (d.h >= 5 && d.h < 10) m.push("mit kaffee");
  if (d.h >= 17 && d.h < 22) m.push("feierabend");
  if (d.h >= 22 || d.h < 5) m.push("bei mondlicht");
  if (d.bb >= 70) m.push("voller energie");
  else if (d.bb >= 0 && d.bb < 30) m.push("etwas müde");
  if (d.stress > 60) m.push("tief durchatmen");
  if (d.trainDays >= d.dayGoal) m.push("wochenziel erfüllt");
  else if (d.trainDays >= 0) m.push(d.dayGoal - d.trainDays === 1 ? "noch 1 training" : "noch " + (d.dayGoal - d.trainDays) + " trainings");
  if (d.wkBike > 0) m.push("mit rückenwind");
  if (d.stepGoal > 0 && d.steps >= d.stepGoal) m.push(G.num(d.stepGoal) + " schritte");
  return m[w % m.length];
}

// per raise: grid geometry, prompt and the seeded noise (cheap 16-bit LCG, identical on the watch)
function prep(d, st) {
  wn = wake(d);
  if (st === 1) { cs = 9; gc = 42; gr = 19; gy0 = 118; } else { cs = 14; gc = 29; gr = 11; gy0 = 126; }
  gx0 = 227 - (gc * cs) / 2;
  nm = gc * gr;
  const key = wn * 4 + st;
  if (key === nKey) return;
  nKey = key;
  pmt = prompt(d, wn);
  nz = null;
  if (st === 3) return;
  nz = new Uint8Array(nm);
  let sd = (wn * 7 + st * 131 + 17) % 65537;
  for (let k = 0; k < nm; k++) { sd = (sd * 75 + 74) % 65537; nz[k] = sd & 255; }
}

// the target image (time + scenery), or the brush dabs for Aquarell; once per raise/minute.
// Grid styles only need it from step ~5 on, so the first frame after a raise stays light.
function target(d, st) {
  const ts = G.timeStr(d);
  const key = st + ts + "/" + wn;
  if (key === tKey) return;
  tKey = key;
  if (st === 3) { buildAq(ts, G.rnd(wn * 31 + 11)); return; }
  tg = new Uint8Array(nm);
  const hz = new Uint8Array(nm); // digit level (3..5), 1 = glow halo
  // scenery: mountain ridge (Diffusion), horizon with a pixel sun and stars (Pixel)
  const ph = (wn % 97) * 1.0;
  const mx = 5 + ((wn * 7) % (gc - 10));
  for (let c = 0; c < gc; c++) {
    const top = gr - 3 - Math.floor(2.2 * (1 + G.noise(c * 0.45 + ph)));
    for (let r = 0; r < gr; r++) {
      const k = r * gc + c;
      if (st === 1) tg[k] = r >= top ? 1 : 0;
      else tg[k] = r === 9 ? (c >= mx - 1 && c <= mx + 1 ? 4 : 2) : r === 10 ? 1 : r < 2 && (k * 7 + wn) % 9 === 0 ? 1 : 0;
    }
  }
  // glyphs (+ halo around them for Diffusion)
  const dw = st === 1 ? 7 : 5;
  const cw = st === 1 ? 2 : 1;
  const r0 = st === 1 ? 4 : 2;
  const rows = st === 1 ? 11 : 7;
  let W = 0;
  for (let i = 0; i < ts.length; i++) {
    const col = ts[i] === ":";
    W += col ? cw : dw;
    if (i > 0) W += st === 1 && (col || ts[i - 1] === ":") ? 2 : 1;
  }
  let x = Math.floor((gc - W) / 2);
  for (let i = 0; i < ts.length; i++) {
    const col = ts[i] === ":";
    if (i > 0) x += st === 1 && (col || ts[i - 1] === ":") ? 2 : 1;
    const n = ts.charCodeAt(i) - 48;
    for (let rr = 0; rr < rows; rr++) {
      let bits;
      if (col) bits = st === 1 ? (rr === 3 || rr === 4 || rr === 7 || rr === 8 ? 3 : 0) : rr === 2 || rr === 4 ? 1 : 0;
      else bits = st === 1 ? D7[n * 11 + rr] : FD.pxData[(FD.pxMap[48 + n] - 1) * 7 + rr];
      if (bits === 0) continue;
      const w = col ? cw : dw;
      const lv = st === 1 ? (rr >= 8 ? 4 : 5) : rr < 4 ? 5 : 4;
      for (let c = 0; c < w; c++) {
        if (bits & (1 << (w - 1 - c))) {
          const k = (r0 + rr) * gc + x + c;
          hz[k] = lv;
          if (st === 1) {
            for (let q = k - gc - 1; q <= k + gc - 1; q += gc) {
              if (hz[q] === 0) hz[q] = 1;
              if (hz[q + 1] === 0) hz[q + 1] = 1;
              if (hz[q + 2] === 0) hz[q + 2] = 1;
            }
          }
        }
      }
    }
    x += col ? cw : dw;
  }
  for (let k = 0; k < nm; k++) {
    const lv = hz[k] >= 3 ? hz[k] : hz[k] === 1 ? 3 : tg[k];
    tg[k] = lv > 0 ? lv * 43 + 21 : 0;
  }
}

// Aquarell: brush dabs sampled along the stroke-font digits (the later ink line follows them)
function buildAq(ts, sd) {
  const s = AH / 80;
  const w = F.stW(ts, AH);
  let ox = 227 - w / 2;
  const oy = AY - AH / 2 - 24 * s;
  const p = [];
  for (let k = 0; k < ts.length; k++) {
    const gi = FD.strokeMap[ts.charCodeAt(k)] - 1;
    if (gi < 0) { ox += (20 + 22) * s; continue; }
    const a = FD.strokeOffs[gi], b = FD.strokeOffs[gi + 1];
    let px = -1, py = 0, rem = 0;
    for (let i = a; i < b; i += 2) {
      if (FD.strokeData[i] === 255) { px = -1; i -= 1; continue; }
      const nx = ox + (FD.strokeData[i] & 127) * s, ny = oy + FD.strokeData[i + 1] * s;
      if (px < 0) { p.push(nx, ny); rem = SP; }
      else {
        // one dab every SP px of stroke length
        const L = Math.sqrt((nx - px) * (nx - px) + (ny - py) * (ny - py));
        let pos = 0;
        while (L - pos >= rem) {
          pos += rem;
          p.push(px + ((nx - px) * pos) / L, py + ((ny - py) * pos) / L);
          rem = SP;
        }
        rem -= L - pos;
      }
      px = nx; py = ny;
    }
    ox += (FD.strokeW[gi] + 22) * s;
  }
  bn = p.length / 2;
  bd = new Array(bn * 8);
  bq = new Array(bn * 4);
  const pa = AQ[(wn % 3) * 2], pb = AQ[(wn % 3) * 2 + 1];
  const x0 = 227 - w / 2;
  for (let i = 0; i < bn; i++) {
    sd = G.rnd(sd);
    const ang = G.rf(sd) * 6.2832;
    sd = G.rnd(sd);
    const rad = Math.sqrt(G.rf(sd)) * 165;
    sd = G.rnd(sd);
    const o = i * 8;
    bd[o] = p[i * 2];
    bd[o + 1] = p[i * 2 + 1];
    bd[o + 2] = 227 + Math.sin(ang) * rad;
    bd[o + 3] = 215 + Math.cos(ang) * rad;
    bd[o + 4] = 11 + G.rf(sd) * 13;
    bd[o + 5] = G.mix(pa, pb, (p[i * 2] - x0) / w);
    sd = G.rnd(sd);
    bd[o + 6] = 9.5 + G.rf(sd) * 3; // brush pressure
    bd[o + 7] = G.mix(bd[o + 5], INK, 0.25);
  }
}

function dateStr(d) { return DOWS[d.dow] + ", " + d.day + ". " + MONS[d.mon - 1]; }

// »prompt« centred, top y
function promptLine(dc, d, y, col) {
  const txt = G.timeStr(d) + ", " + pmt;
  const w = F.pxW(txt, 2);
  const x = 227 - (w + 24) / 2;
  dc.setColor(col, -1);
  glyph(dc, 0, x, y, 2);
  F.px(dc, txt, x + 12, y, 2, 0, 0);
  glyph(dc, 1, x + w + 14, y, 2);
}

// paper -> pigment c by f/256 (cheap integer mix for the many brush dabs)
function pm(c, f) {
  return ((0xf1 + ((((c >> 16) & 255) - 0xf1) * f >> 8)) << 16) | ((0xe9 + ((((c >> 8) & 255) - 0xe9) * f >> 8)) << 8) | (0xda + (((c & 255) - 0xda) * f >> 8));
}

function drawAq(dc, d, a, s, t) {
  const g = s / NS;
  const dry = a.live && s >= NS ? G.clamp((t - NS * SMS) / 6000, 0, 1) * 0.14 : 0;
  dc.setColor(PAPER, -1);
  dc.fillRectangle(0, 0, 454, 454);
  // the scattered dabs converge onto the stroke (painted left to right), larger and more
  // watery while travelling; edge pass first so only the outer pooled edge stays visible
  for (let i = 0; i < bn; i++) {
    const o = i * 8, q = i * 4;
    let e = g * 1.5 - (0.5 * i) / bn;
    e = e <= 0 ? 0 : e >= 1 ? 1 : e * e * (3 - 2 * e);
    const sw = (i % 2 === 0 ? 18 : -18) * Math.sin(e * 3.1416);
    bq[q] = bd[o + 2] + (bd[o] - bd[o + 2]) * e + sw;
    bq[q + 1] = bd[o + 3] + (bd[o + 1] - bd[o + 3]) * e - sw * 0.5;
    bq[q + 2] = bd[o + 4] + (bd[o + 6] - bd[o + 4]) * e;
    bq[q + 3] = e;
    dc.setColor(pm(bd[o + 7], Math.floor((0.22 + 0.6 * e - dry) * 256)), -1);
    dc.fillCircle(bq[q], bq[q + 1], bq[q + 2] + 1.8);
  }
  for (let i = 0; i < bn; i++) {
    const q = i * 4;
    dc.setColor(pm(bd[i * 8 + 5], Math.floor((0.18 + 0.56 * bq[q + 3] - dry) * 256)), -1);
    dc.fillCircle(bq[q], bq[q + 1], bq[q + 2]);
  }
  // a few splatters land at the end
  if (s > 42) {
    let sd = G.rnd(wn + 77);
    for (let j = 0; j < 9; j++) {
      sd = G.rnd(sd);
      const x = 70 + (sd % 314);
      sd = G.rnd(sd);
      const y = AY - 80 + (sd % 160);
      sd = G.rnd(sd);
      dc.setColor(G.mix(PAPER, bd[((sd >> 4) % bn) * 8 + 5], 0.7 - dry), -1);
      dc.fillCircle(x, y, 1.5 + (sd % 4) * G.clamp((s - 42) / 5.0, 0, 1));
    }
  }
  // line and wash: the ink line writes itself over the last steps
  if (s > 34) {
    dc.setColor(INK, -1);
    F.st(dc, G.timeStr(d), 229, AY - 2, AH, 2, 1, (s - 34) / 16.0, 0);
  }
  // captions in ink
  dc.setColor(0x9a8a76, -1);
  F.px(dc, "studie nr. " + seedNo(wn), 227, 60, 2, 1, 0);
  promptLine(dc, d, 82, 0x5a4a3e);
  if (s < NS) {
    dc.setColor(0x8a7a66, -1);
    F.px(dc, "lasur " + s + "/" + NS, 227, 300, 2, 1, 0);
    dc.setColor(0xddd2bf, -1);
    dc.fillRoundedRectangle(147, 324, 160, 4, 2);
    dc.setColor(G.mix(PAPER, bn > 0 ? bd[5] : INK, 0.8), -1);
    dc.fillRoundedRectangle(147, 324, (160 * s) / NS, 4, 2);
  } else {
    dc.setColor(INK, -1);
    F.px(dc, dateStr(d), 227, 300, 2, 1, 0);
    dc.setColor(0x9a8a76, -1);
    F.px(dc, "aquarell, " + NS + " lasuren", 227, 326, 2, 1, 0);
  }
}

export default {
  get fps() { return busy ? 20 : 6; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    prep(d, st);
    const t = a.live ? a.t : 99999;
    const s = Math.min(NS, Math.floor(t / SMS));
    busy = a.live && t < NS * SMS + 150;
    let ai = Math.round(G.easeInOut(s / NS) * 256);
    // pure noise needs no target yet; while animating, the frame that builds it only draws
    // noise (watchdog budget: building + mixing in one frame is too much on the watch)
    if (st === 3) { target(d, st); drawAq(dc, d, a, s, t); return; }
    if (ai > 0 && tKey !== st + G.timeStr(d) + "/" + wn) {
      target(d, st);
      if (a.live) ai = 0;
    }
    const acc = d.accent;
    const pi = wn % 4;
    // level colours: grey noise that takes on the palette while it denoises
    const cur = [0, 0, 0, 0, 0, 0];
    const bi = 256 - ai;
    const ae = ai / 256;
    if (st === 1) {
      const hu = HUE[wn % 5];
      const fin = [0, G.dim(hu, 0.28), G.dim(hu, 0.55), G.mix(G.dim(hu, 0.45), G.dim(acc, 0.5), 0.5), G.dim(acc, 0.8), G.mix(acc, 0xffffff, 0.35)];
      for (let l = 1; l < 6; l++) cur[l] = G.mix(G.rgb(l * 44, l * 44, l * 44), fin[l], ae);
    } else {
      for (let l = 1; l < 6; l++) cur[l] = pi < 3 ? PIX[pi * 5 + l - 1] : l === 5 ? G.mix(acc, 0xffffff, 0.5) : G.dim(acc, l * 0.2);
    }
    // x = alpha * image + (1 - alpha) * noise, quantised to 6 levels, drawn as merged runs
    const sx = (s * 151) & 255;
    for (let r = 0; r < gr; r++) {
      const y = gy0 + r * cs;
      const kb = r * gc;
      let c0 = 0, lv = -1;
      for (let c = 0; c <= gc; c++) {
        let q = -1;
        if (c < gc) {
          const k = kb + c;
          q = ai >= 256 ? (tg[k] * 6) >> 8 : ai <= 0 ? ((nz[k] ^ sx) * 6) >> 8 : ((tg[k] * ai + (nz[k] ^ sx) * bi) * 6) >> 16;
        }
        if (q !== lv) {
          if (lv > 0) {
            dc.setColor(cur[lv], -1);
            dc.fillRectangle(gx0 + c0 * cs, y, (c - c0) * cs, cs);
          }
          lv = q;
          c0 = c;
        }
      }
    }
    // finished: a few background cells keep twinkling (latent residue)
    if (s >= NS && a.live) {
      const tick = Math.floor(t / 170);
      for (let j = 0; j < 7; j++) {
        const k = (tick * 7919 + j * 2731 + wn * 13) % nm;
        if (tg[k] < 110) {
          const l = tg[k] > 0 ? Math.floor((tg[k] - 21) / 43) + 1 : 1;
          dc.setColor(cur[l], -1);
          dc.fillRectangle(gx0 + (k % gc) * cs, gy0 + Math.floor(k / gc) * cs, cs, cs);
        }
      }
    }
    const wd = gc * cs;
    if (st === 2) {
      // chunky pixel grid
      dc.setColor(0x000000, -1);
      for (let c = 1; c < gc; c++) dc.fillRectangle(gx0 + c * cs - 1, gy0, 2, gr * cs);
      for (let r = 1; r < gr; r++) dc.fillRectangle(gx0, gy0 + r * cs - 1, wd, 2);
      dc.setColor(cur[3], -1);
      F.px(dc, "PALETTE " + PIXN[pi], 227, 62, 2, 1, 0);
      promptLine(dc, d, 86, 0xdddddd);
      dc.setColor(cur[4], -1);
      F.px(dc, "STEP " + s + "/" + NS, 60, 294, 2, 0, 0);
      F.px(dc, "SEED " + seedNo(wn), 394, 294, 2, 2, 0);
      const nb = Math.floor((s * 20) / NS);
      for (let i = 0; i < 20; i++) {
        dc.setColor(i < nb ? cur[5] : 0x2a2a2a, -1);
        dc.fillRectangle(87 + i * 14, 316, 12, 10);
      }
      dc.setColor(cur[5], -1);
      if (s < NS) F.px(dc, "RENDERE" + "...".substring(0, Math.floor(t / 200) % 4), 167, 338, 2, 0, 0);
      else if (!a.live || Math.floor(t / 500) % 2 === 0) F.px(dc, "FERTIG!", 227, 338, 2, 1, 0);
      dc.setColor(cur[3], -1);
      F.px(dc, d.dowStr + " " + d.day + " " + d.monStr, 227, 362, 2, 1, 0);
      return;
    }
    // Diffusion: thin figure frame + paper captions
    dc.setColor(0x333333, -1);
    dc.setPenWidth(1);
    dc.drawRectangle(gx0 - 4, gy0 - 4, wd + 8, gr * cs + 8);
    dc.setColor(0x8a8a8a, -1);
    F.px(dc, "prompt", 227, 58, 2, 1, 0);
    promptLine(dc, d, 80, 0xdddddd);
    const yb = gy0 + gr * cs + 12;
    dc.setColor(0x9a9a9a, -1);
    F.px(dc, "step " + s + "/" + NS, 58, yb, 2, 0, 0);
    F.px(dc, "seed " + seedNo(wn), 396, yb, 2, 2, 0);
    dc.setColor(0x2e2e2e, -1);
    dc.fillRectangle(58, yb + 21, 338, 2);
    dc.setColor(acc, -1);
    dc.fillRectangle(58, yb + 21, Math.floor((338 * s) / NS), 2);
    if (s < NS) {
      dc.setColor(0x9a9a9a, -1);
      F.px(dc, "entrausche" + "...".substring(0, Math.floor(t / 200) % 4), 227 - 63, yb + 34, 2, 0, 0);
    } else {
      const txt = "fertig in 2,5 s";
      const w = F.pxW(txt, 2) + 16;
      dc.setColor(acc, -1);
      glyph(dc, 2, 227 - w / 2, yb + 34, 2);
      F.px(dc, txt, 227 - w / 2 + 16, yb + 34, 2, 0, 0);
    }
    dc.setColor(0x666666, -1);
    F.px(dc, "Abb. " + d.glances + ": " + dateStr(d), 227, yb + 58, 2, 1, 0);
  },

  // the time as dim, dithered latent blocks with a little residual noise
  aod(dc, d) {
    const o = St.shift(d);
    const ts = G.timeStr(d);
    const p = 13;
    const w = (ts.length * 6 - 1) * p;
    const x0 = Math.round(227 - w / 2) + o[0];
    const y0 = 182 + o[1];
    dc.setColor(G.dim(d.accent, 0.5), -1);
    for (let i = 0; i < ts.length; i++) {
      const gi = FD.pxMap[ts.charCodeAt(i)] - 1;
      for (let r = 0; r < 7; r++) {
        const bits = FD.pxData[gi * 7 + r];
        for (let c = 0; c < 5; c++) {
          if (bits & (16 >> c)) {
            const x = x0 + (i * 6 + c) * p, y = y0 + r * p;
            dc.fillRectangle(x, y, 6, 6);
            dc.fillRectangle(x + 6, y + 6, 6, 6);
          }
        }
      }
    }
    dc.setColor(0x2a2a2a, -1);
    let sd = G.rnd(d.mins + 7);
    for (let j = 0; j < 18; j++) {
      sd = G.rnd(sd);
      const c = sd % (ts.length * 6 + 4) - 2;
      sd = G.rnd(sd);
      const r = (sd % 11) - 2;
      dc.fillRectangle(x0 + c * p + 3, y0 + r * p + 3, 6, 6);
    }
    dc.setColor(0x5a5a5a, -1);
    F.px(dc, "latent", 227 + o[0], 300 + o[1], 2, 1, 0);
  },
};
