// CITY — "Pixel City": a pixel skyline that grows with you. Every floor climbed today lights
// one window; reaching the floors goal lights the TV tower ("Fernsehturm") sphere and hangs
// a "ZIEL!" banner. Sky by real sun elevation, rain/snow, an S-Bahn on the viaduct, a plane
// at night, slot values on rooftop billboards. Styles: 1 Neon-Nacht, 2 Retro, 3 Winter.
// Mirrors watch/source/faces/City.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import S from "../sprites/city.js";
import { SPR, encodeAll } from "../engine/spr.js";

const SP = encodeAll(S);
const P = 4;
const GY = 388; // street level of the buildings (viaduct deck)
const TX = 360; // TV tower axis
const BAND = [0, 100, 150, 200, 260, 388];
// buildings: x, w, top, facade (0 brick, 1 concrete, 2 beige, 3 glass), extra (1 antenna, 2 crown, 3 water tank)
const BLD = [8, 92, 284, 0, 0, 100, 44, 196, 1, 1, 176, 88, 292, 2, 0, 264, 48, 208, 3, 2, 312, 40, 256, 0, 3, 352, 88, 296, 1, 0];
const NB = 6;
const ORD = [2, 0, 4, 1, 5, 3]; // rise order of the buildings
const BOARD_B = [0, 2, 5]; // buildings carrying the slot billboards
const BOARD_X = [58, 224, 392];
const SPH = [2, 3, 4, 4, 4, 4, 3, 2]; // tower sphere half widths (cells), rows from y 168
const PK = [0x000000, 0x1d2b53, 0x7e2553, 0x008751, 0xab5236, 0x5f574f, 0xc2c3c7, 0xfff1e8, 0xff004d, 0xffa300, 0xffec27, 0x00e436, 0x29adff, 0x83769c, 0xff77a8, 0xffccaa];
const MAG = 0xff2bd6;
const CYA = 0x18e0ff;
// palette slots: 0-4 sky, 5-8 facades, 9 window off, 10-12 window lit, 13 tower, 14 sphere,
// 15 viaduct, 16 arch, 17 street, 18 roof highlight / snow, 19 board, 20 copper roof
const NEON = [0x05030f, 0x0a0620, 0x120a30, 0x1c0e3e, 0x28124a, 0x1e1230, 0x121c30, 0x201c2c, 0x0e1a32, 0x0a0a16, 0xffd27a, 0xff9e4a, 0x7ae8ff, 0x1c1830, 0x2c2848, 0x2a1420, 0x07040a, 0x050408, 0x342c4c, 0x050308, 0x1a4a48];
const R_DAY = [12, 12, 12, 12, 6, 4, 5, 15, 13, 12, 7, 7, 6, 6, 7, 4, 0, 5, 7, 7, 3];
const R_DUSK = [1, 2, 2, 14, 9, 4, 5, 2, 1, 1, 10, 9, 7, 5, 13, 2, 0, 1, 13, 0, 3];
const R_NIGHT = [0, 0, 1, 1, 1, 2, 5, 5, 0, 1, 10, 9, 7, 5, 13, 2, 0, 0, 13, 0, 3];
const W_DAY = [0x6c9cd0, 0x82aed8, 0x98c0e2, 0xb0d2ec, 0xcadff2, 0x8a6a72, 0x7e8a9c, 0xa49c94, 0x5e7e9e, 0x8ab8dc, 0xeaf6ff, 0xd8ecfa, 0xffffff, 0x9aa4b2, 0xc6ceda, 0x7a5a54, 0x34303a, 0xd6e2ee, 0xffffff, 0xe8eef6, 0x5a9a8a];
const W_DUSK = [0x1c2250, 0x3a3474, 0x6a4a8c, 0xa8688e, 0xd89a9a, 0x4a3a52, 0x3e4660, 0x56505e, 0x34465e, 0x2a3048, 0xffd27a, 0xffb14a, 0xfff0d0, 0x4a5068, 0x6a7088, 0x4a3240, 0x141018, 0x8a90b0, 0xe8e8f8, 0xd8dcea, 0x3a6a64];
const W_NIGHT = [0x050a1a, 0x0a1228, 0x0f1a34, 0x162440, 0x1e2e4c, 0x2a2232, 0x222a3a, 0x2e2c36, 0x1a2a40, 0x121828, 0xffd27a, 0xffb14a, 0xfff0d0, 0x262c3c, 0x363e50, 0x2a1c24, 0x0c0a0e, 0x4a5468, 0xc8d4e8, 0xb8c4d8, 0x24443e];

// ---- window grid per building: [x0, rows, cols] (y0 = top + 12, pitch 12, window 8x8)
const WG = [];
for (let b = 0; b < NB; b++) {
  const x = BLD[b * 5], w = BLD[b * 5 + 1], top = BLD[b * 5 + 2];
  const n = Math.floor((w - 4) / 12);
  const x0 = x + Math.floor((w - (n * 12 - 4)) / 8) * 4;
  const nr = Math.floor((GY - 32 - top - 12 + 4) / 12);
  WG.push(x0, nr, n);
}
// all windows inside the dial, shuffled into the order in which they light up (b*10000 + r*100 + c)
const WIN = [];
for (let b = 0; b < NB; b++) {
  for (let r = 0; r < WG[b * 3 + 1]; r++) {
    for (let c = 0; c < WG[b * 3 + 2]; c++) {
      const cx = WG[b * 3] + c * 12 + 4 - 227, cy = BLD[b * 5 + 2] + 12 + r * 12 + 4 - 227;
      if (cx * cx + cy * cy < 216 * 216) WIN.push(b * 10000 + r * 100 + c);
    }
  }
}
{
  let s = 4242;
  for (let i = WIN.length - 1; i > 0; i--) {
    s = G.rnd(s);
    const j = s % (i + 1);
    const t = WIN[i]; WIN[i] = WIN[j]; WIN[j] = t;
  }
}

function q4(v) { return Math.floor(v / P) * P; }

function palette(st, el, rain) {
  const out = [];
  if (st === 1) {
    for (let i = 0; i < 21; i++) out.push(NEON[i]);
  } else if (st === 2) {
    const m = el >= 4 ? R_DAY : el >= -4 ? R_DUSK : R_NIGHT;
    for (let i = 0; i < 21; i++) out.push(PK[m[i]]);
  } else {
    let a = W_NIGHT, b = W_NIGHT, f = 0;
    if (el >= 6) { a = W_DAY; b = W_DAY; }
    else if (el >= -2) { a = W_DUSK; b = W_DAY; f = (el + 2) / 8.0; }
    else if (el >= -8) { a = W_NIGHT; b = W_DUSK; f = (el + 8) / 6.0; }
    for (let i = 0; i < 21; i++) out.push(G.mix(a[i], b[i], f));
  }
  if (rain && st !== 2) for (let i = 0; i < 5; i++) out[i] = G.mix(out[i], 0x3a4250, 0.35);
  return out;
}

// is the scene in "day" mode (glassy windows, sun)?
function isDay(st, el) { return st !== 1 && el >= (st === 2 ? 4 : 2); }

function signCols(st, acc) {
  if (st === 1) return [acc, MAG, CYA];
  if (st === 2) return [PK[8], PK[12], PK[11]];
  return [acc, 0x3a8ad0, 0xd04a4a];
}

// rooftop billboard: two lines (label, value), on legs above roof y `roof`
function board(dc, cx, roof, lbl, val, col, st, pal, day) {
  const tw = Math.max(F.pxW(lbl, 2), F.pxW(val, 2));
  const bw = q4(tw + 15);
  const bx = q4(cx - bw / 2);
  const by = roof - 48;
  // legs
  dc.setColor(st === 1 ? 0x2a2438 : G.mix(pal[13], 0x000000, 0.3), -1);
  dc.fillRectangle(bx + 8, by + 40, P, 8);
  dc.fillRectangle(bx + bw - 12, by + 40, P, 8);
  // frame + fill
  dc.setColor(col, -1);
  dc.fillRectangle(bx, by, bw, 40);
  const lite = st === 3 || (st === 2 && day);
  dc.setColor(st === 1 ? pal[19] : lite ? pal[19] : PK[0], -1);
  dc.fillRectangle(bx + 2, by + 2, bw - 4, 36);
  if (st === 3) {
    dc.setColor(pal[18], -1);
    dc.fillRectangle(bx - 2, by - 4, bw + 4, P);
  }
  let lc, vc;
  if (st === 1) { lc = G.dim(col, 0.62); vc = G.mix(col, 0xffffff, 0.45); }
  else if (lite) { lc = st === 2 ? PK[5] : 0x5a6478; vc = st === 2 ? PK[0] : 0x1a2030; }
  else { lc = PK[6]; vc = col; }
  dc.setColor(lc, -1);
  F.px(dc, lbl, bx + bw / 2, by + 6, 2, 1, 0);
  dc.setColor(vc, -1);
  F.px(dc, val, bx + bw / 2, by + 22, 2, 1, 0);
}

function timeStr(d) {
  return (d.is24 ? G.pad2(d.h) : "" + G.hour(d)) + ":" + G.pad2(d.m);
}

export default {
  fps: 10,

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const tt = a.live ? a.t : 3000;
    const el = st === 1 ? -30 : AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const rain = d.rain >= 50;
    const pal = palette(st, el, rain);
    const day = isDay(st, el);
    const night = st === 1 || el < -4;
    const goal = d.floorsGoal > 0 && d.floors >= d.floorsGoal;
    const blinkA = Math.floor(tt / 500) % 2 === 0;

    // ---------------- sky
    for (let i = 0; i < 5; i++) {
      dc.setColor(pal[i], -1);
      dc.fillRectangle(0, BAND[i], 454, BAND[i + 1] - BAND[i]);
    }
    if (night && !rain) {
      let s = 3;
      for (let i = 0; i < 22; i++) {
        s = G.rnd(s);
        const x = 20 + (s % 104) * P;
        s = G.rnd(s);
        const y = 8 + (s % 50) * P;
        const tw = a.live && (Math.floor(tt / 350) + i * 3) % 11 === 0 ? 0.3 : 1;
        dc.setColor(G.mix(pal[1], 0xffffff, (0.3 + (i % 3) * 0.3) * tw), -1);
        dc.fillRectangle(x, y, P, P);
      }
    }
    // sun / moon
    const rise = d.sunrise, set = d.sunset;
    if (st !== 1 && el > -1 && !rain) {
      let f = 0.5;
      if (rise >= 0 && set > rise) f = G.clamp((d.mins - rise) / (set - rise), 0, 1);
      const sx = q4(40 + f * 300) - 16;
      const sy = q4(G.clamp(300 - el * 5, 156, 330)) - 16;
      const gf = G.clamp((10 - el) / 12.0, 0, 1);
      const sp = st === 2 ? [PK[9], PK[10], PK[7]] : [G.mix(0xffe07a, 0xff6a3a, gf), G.mix(0xfff6c8, 0xffa060, gf), 0xffffff];
      SPR.draw(dc, SP.SUN, sx, sy, P, sp, false);
    } else if (night && d.moon > 0.05 && d.moon < 0.95) {
      let f = 0.3;
      if (st !== 1 && rise >= 0 && set >= 0) {
        let m = d.mins - set;
        if (m < 0) m += 1440;
        f = G.clamp(m / (rise + 1440 - set), 0, 1);
      }
      const mx = q4(40 + f * 300) - 14;
      const my = q4(170 + (1 - Math.sin(f * Math.PI)) * 60) - 14;
      SPR.draw(dc, SP.MOON, mx, my, P, [st === 2 ? PK[7] : 0xf4f1d0, st === 2 ? PK[6] : 0xc8c3a0], false);
      if (d.moon < 0.35 || d.moon > 0.65) SPR.draw(dc, SP.MOON_C, mx, my, P, [pal[2]], d.moon > 0.5);
    }
    // plane (night)
    if (night) {
      const ph = (tt % 11000) / 11000.0;
      const px = q4(480 - ph * 560);
      const py = 148 + q4(ph * 24);
      SPR.draw(dc, SP.PLANE, px, py, P, [st === 2 ? PK[5] : 0x3a3a50, st === 2 ? PK[10] : 0xffe08a], true);
      dc.setColor(blinkA ? 0xff3030 : 0x501010, -1);
      dc.fillRectangle(px + 32, py, P, P);
      if (Math.floor(tt / 250) % 4 === 1) {
        dc.setColor(0xffffff, -1);
        dc.fillRectangle(px + 16, py + 8, P, P);
      }
    }

    // ---------------- skyline (rising during the intro, clipped at street level)
    dc.setClip(0, 0, 454, GY);
    // TV tower (behind)
    const to = q4((1 - G.ease(G.stag(p, 0, 0, 0.5))) * 280);
    dc.setColor(pal[13], -1);
    dc.fillRectangle(TX - 8, 300 + to, 16, 88);
    dc.fillRectangle(TX - 4, 200 + to, 8, 100);
    dc.fillRectangle(TX - 4, 156 + to, 8, 12);
    dc.setColor(st === 2 ? PK[7] : G.mix(pal[13], 0xffffff, 0.45), -1);
    dc.fillRectangle(TX - 2, 128 + to, P, 28);
    dc.setColor(st === 2 ? PK[8] : 0xd04040, -1);
    dc.fillRectangle(TX - 2, 136 + to, P, 4);
    dc.fillRectangle(TX - 2, 148 + to, P, 4);
    if (blinkA || !a.live) {
      dc.setColor(0xff3030, -1);
      dc.fillRectangle(TX - 2, 124 + to, P, P);
    }
    const sc0 = goal ? acc : pal[14];
    if (goal) {
      dc.setColor(G.dim(acc, 0.35), -1);
      dc.fillRectangle(TX - 20, 168 + to, 40, 32);
      dc.fillRectangle(TX - 12, 164 + to, 24, 40);
    }
    for (let r = 0; r < 8; r++) {
      const hw = SPH[r] * P;
      dc.setColor(r < 3 && !goal ? G.mix(sc0, 0xffffff, 0.25) : r < 2 ? G.mix(acc, 0xffffff, 0.45) : sc0, -1);
      dc.fillRectangle(TX - hw, 168 + r * P + to, hw * 2, P);
    }
    // sphere windows (restaurant)
    dc.setColor(goal ? 0xffffff : night ? pal[10] : G.mix(pal[14], 0x000000, 0.35), -1);
    for (let k = -2; k < 2; k++) dc.fillRectangle(TX + k * 8 + 2, 184 + to, P, P);

    // church
    const co = q4((1 - G.ease(G.stag(p, 3, 0.07, 0.45))) * 200);
    const stone = G.mix(pal[7], 0x000000, 0.18);
    dc.setColor(stone, -1);
    dc.fillRectangle(144, 320 + co, 32, 68);
    dc.fillRectangle(152, 256 + co, 20, 64);
    dc.setColor(pal[20], -1);
    dc.fillRectangle(144, 316 + co, 32, P);
    dc.fillRectangle(152, 248 + co, 20, 8);
    dc.fillRectangle(156, 232 + co, 12, 16);
    dc.fillRectangle(160, 208 + co, P, 24);
    dc.setColor(0xe0b040, -1);
    dc.fillRectangle(160, 192 + co, P, 16);
    dc.fillRectangle(156, 196 + co, 12, P);
    dc.setColor(st === 2 ? PK[7] : G.mix(stone, 0xffffff, 0.6), -1);
    dc.fillRectangle(156, 264 + co, 12, 12);
    dc.setColor(G.mix(stone, 0x000000, 0.6), -1);
    dc.fillRectangle(160, 264 + co, P, 8);
    dc.fillRectangle(160, 268 + co, 8, P);
    dc.setColor(night ? pal[11] : pal[9], -1);
    dc.fillRectangle(160, 288 + co, P, 16);
    dc.fillRectangle(148, 336 + co, P, 20);
    dc.fillRectangle(168, 336 + co, P, 20);

    // buildings
    const cols = signCols(st, acc);
    const up = [0, 0, 0, 0, 0, 0];
    for (let k = 0; k < NB; k++) {
      const b = ORD[k];
      const top = BLD[b * 5 + 2];
      up[b] = q4((1 - G.ease(G.stag(p, k, 0.07, 0.45))) * (GY - top + 60));
    }
    for (let b = 0; b < NB; b++) {
      const x = BLD[b * 5], w = BLD[b * 5 + 1], top = BLD[b * 5 + 2] + up[b], ex = BLD[b * 5 + 4];
      const fac = pal[5 + BLD[b * 5 + 3]];
      // roof extras
      if (ex === 1) {
        const tc = G.mix(fac, 0x000000, 0.35);
        SPR.draw(dc, SP.TANK, x + 4, top - 36, P, [tc, G.mix(fac, 0x8a5a3a, 0.5), tc], false);
        dc.setColor(tc, -1);
        dc.fillRectangle(x + 36, top - 40, P, 40);
        if (blinkA || !a.live) {
          dc.setColor(0xff3030, -1);
          dc.fillRectangle(x + 36, top - 44, P, P);
        }
      } else if (ex === 2) {
        dc.setColor(G.mix(fac, 0xffffff, 0.12), -1);
        dc.fillRectangle(x + 8, top - 12, w - 16, 12);
        dc.fillRectangle(x + 16, top - 24, w - 32, 12);
        dc.fillRectangle(x + w / 2 - 2, top - 44, P, 20);
        if (!blinkA || !a.live) {
          dc.setColor(0xff3030, -1);
          dc.fillRectangle(x + w / 2 - 2, top - 48, P, P);
        }
      } else if (ex === 3) {
        dc.setColor(G.mix(fac, 0x000000, 0.3), -1);
        dc.fillRectangle(x + 4, top - 8, 12, 8);
      }
      dc.setColor(fac, -1);
      dc.fillRectangle(x, top, w, GY - top);
      dc.setColor(st === 1 ? G.dim(cols[b % 3], 0.75) : G.mix(fac, 0xffffff, 0.18), -1);
      dc.fillRectangle(x, top, w, P);
      dc.setColor(G.mix(fac, 0x000000, 0.25), -1);
      dc.fillRectangle(x + w - P, top + P, P, GY - top - P);
      // window grid: one block in the "off" colour, then facade bars between
      const x0 = WG[b * 3], nr = WG[b * 3 + 1], n = WG[b * 3 + 2];
      const y0 = top + 12;
      dc.setColor(pal[9], -1);
      dc.fillRectangle(x0, y0, n * 12 - 4, nr * 12 - 4);
      dc.setColor(fac, -1);
      for (let r = 1; r < nr; r++) dc.fillRectangle(x0, y0 + r * 12 - 4, n * 12 - 4, P);
      for (let c = 1; c < n; c++) dc.fillRectangle(x0 + c * 12 - 4, y0, P, nr * 12 - 4);
      // door
      dc.setColor(G.mix(fac, 0x000000, 0.55), -1);
      dc.fillRectangle(x + q4(w / 2) - 4, GY - 20, 12, 20);
      // snow on the roof
      if (st === 3) {
        dc.setColor(pal[18], -1);
        dc.fillRectangle(x, top - P, w, P);
        dc.fillRectangle(x + 4, top - 8, 12, P);
        dc.fillRectangle(x + w - 20, top - 8, 8, P);
      }
    }
    // lit windows (count up during the intro)
    const fl = d.floors > 0 ? d.floors : 0;
    const nl = Math.min(WIN.length, Math.floor(fl * G.clamp((p - 0.45) / 0.4, 0, 1) + 0.0001));
    for (let i = 0; i < nl; i++) {
      const id = WIN[i];
      const b = Math.floor(id / 10000), r = Math.floor(id / 100) % 100, c = id % 100;
      const k = (id * 7 + i) % 10;
      dc.setColor(k < 6 ? pal[10] : k < 8 ? pal[11] : pal[12], -1);
      dc.fillRectangle(WG[b * 3] + c * 12, BLD[b * 5 + 2] + up[b] + 12 + r * 12, 8, 8);
    }
    dc.clearClip();

    // ---------------- signs
    let tempSlot = false;
    for (let k = 0; k < 3; k++) if (d.slots[k].lbl === "TEMP") tempSlot = true;
    for (let k = 0; k < 4; k++) {
      const p0 = 0.72 + k * 0.06;
      if (p < p0) continue;
      if (p < p0 + 0.12 && Math.floor(a.t / 60) % 2 === 1) continue;
      // occasional flicker of one neon sign
      if (st === 1 && k === 1 && a.live && p >= 1 && tt % 5200 > 4900 && Math.floor(tt / 70) % 2 === 0) continue;
      if (k < 3) {
        const b = BOARD_B[k];
        board(dc, BOARD_X[k], BLD[b * 5 + 2], d.slots[k].lbl, d.slots[k].val, cols[k], st, pal, day);
      } else if (!tempSlot) {
        // temperature billboard on the brick building next to the tower
        let ts = "--°";
        if (d.temp !== -99) ts = Math.round(d.metric ? d.temp : d.temp * 1.8 + 32) + "°";
        const bw = q4(F.pxW(ts, 2) + 15);
        const bx = q4(324 - bw / 2);
        const lite = st === 3 || (st === 2 && day);
        dc.setColor(st === 1 ? 0x2a2438 : G.mix(pal[13], 0x000000, 0.3), -1);
        dc.fillRectangle(bx + 4, 248, P, 8);
        dc.fillRectangle(bx + bw - 8, 248, P, 8);
        dc.setColor(cols[2], -1);
        dc.fillRectangle(bx, 226, bw, 22);
        dc.setColor(st === 1 || lite ? pal[19] : PK[0], -1);
        dc.fillRectangle(bx + 2, 228, bw - 4, 18);
        dc.setColor(st === 1 ? G.mix(cols[2], 0xffffff, 0.45) : lite ? (st === 2 ? PK[0] : 0x1a2030) : cols[2], -1);
        F.px(dc, ts, bx + bw / 2, 230, 2, 1, 0);
        if (st === 3) {
          dc.setColor(pal[18], -1);
          dc.fillRectangle(bx - 2, 222, bw + 4, P);
        }
      }
    }
    // goal banner on the tower
    if (goal && p >= 0.8) {
      const gp = G.spring(G.stag(p, 0, 0.8, 0.2));
      const gw = q4(68 * gp);
      if (gw > 8) {
        dc.setColor(0xffffff, -1);
        dc.fillRectangle(TX + 4, 204, gw, 24);
        dc.setColor(acc, -1);
        dc.fillRectangle(TX + 6, 206, gw - 4, 20);
        if (gw >= 64) {
          dc.setColor(0x000000, -1);
          F.px(dc, "ZIEL!", TX + 6 + 32, 209, 2, 1, 0);
        }
      }
    }

    // ---------------- viaduct, street, S-Bahn
    dc.setColor(pal[15], -1);
    dc.fillRectangle(0, GY, 454, 36);
    dc.setColor(st === 2 ? PK[6] : G.mix(pal[13], 0xffffff, 0.3), -1);
    dc.fillRectangle(0, GY, 454, P);
    dc.setColor(G.mix(pal[15], 0x000000, 0.3), -1);
    dc.fillRectangle(0, GY + 8, 454, P);
    for (let k = 0; k < 8; k++) {
      const ax = 12 + k * 56;
      dc.setColor(night && k % 3 === 1 ? pal[11] : pal[16], -1);
      dc.fillRectangle(ax + 8, GY + 16, 16, P);
      dc.fillRectangle(ax + 4, GY + 20, 24, P);
      dc.fillRectangle(ax, GY + 24, 32, 12);
    }
    dc.setColor(pal[17], -1);
    dc.fillRectangle(0, GY + 36, 454, 30);
    if (st === 3) {
      dc.setColor(pal[18], -1);
      dc.fillRectangle(0, GY - P, 454, P);
    }
    // train every 7 s
    const ph = (tt % 7000) / 7000.0;
    const tx = q4(-200 + ph * 860);
    const tp = st === 2
      ? [PK[5], PK[9], PK[8], night ? PK[10] : PK[1], PK[2], PK[7]]
      : st === 1
        ? [0x18181e, 0x8a6420, 0x6a1a20, 0xffe08a, 0x3a0e12, 0xfff6c0]
        : [st === 3 ? pal[18] : 0x3a3a44, 0xe0a030, 0xa8282a, night ? 0xffe08a : 0x2a3040, 0x6a1a1a, 0xfff6c0];
    SPR.draw(dc, SP.TRAIN_CAR, tx, GY - 28, P, tp, false);
    SPR.draw(dc, SP.TRAIN_HEAD, tx + 100, GY - 28, P, tp, false);

    // ---------------- weather
    if (st === 3) {
      let s = 17;
      const nf = rain ? 64 : 40;
      for (let i = 0; i < nf; i++) {
        s = G.rnd(s);
        const x0 = s % 454;
        s = G.rnd(s);
        const y = q4(((s % 420) + Math.floor((tt * (5 + (i % 3))) / 100)) % 420 + 16);
        const x = q4(x0 + Math.sin(tt / 700.0 + i) * 8);
        dc.setColor(i % 4 === 0 ? 0xffffff : G.mix(pal[2], 0xffffff, 0.75), -1);
        dc.fillRectangle(x, y, i % 3 === 0 ? P : 2, i % 3 === 0 ? P : 2);
      }
    } else if (rain) {
      let s = 23;
      dc.setColor(st === 2 ? PK[6] : G.mix(pal[3], 0xffffff, 0.4), -1);
      for (let i = 0; i < 40; i++) {
        s = G.rnd(s);
        const x0 = s % 520;
        s = G.rnd(s);
        const y = ((s % 420) + Math.floor((tt * 45) / 100)) % 420 + 20;
        dc.fillRectangle(x0 - Math.floor(y / 5), y, 2, 10);
      }
    }

    // ---------------- time + date
    const tq = G.stag(p, 1, 0.12, 0.55);
    const ty = 56 - q4((1 - G.spring(tq)) * 130);
    const ts = timeStr(d);
    const shc = st === 1 ? 0x4a1458 : st === 2 ? PK[day ? 1 : 2] : G.mix(pal[0], 0x000000, 0.55);
    if (tq > 0) {
      dc.setColor(shc, -1);
      F.px(dc, ts, 227 + P, ty + P, 8, 1, 0);
      dc.setColor(st === 2 ? PK[7] : 0xffffff, -1);
      F.px(dc, ts, 227, ty, 8, 1, 0);
    }
    const dp = G.stag(p, 3, 0.12, 0.4);
    dc.setColor(G.mix(pal[0], st === 1 ? CYA : st === 2 ? PK[7] : 0xffffff, dp * 0.9), -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 124, 2, 1, 0);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const ox = o[0], oy = o[1];
    // rooftop outline
    dc.setColor(0x34344a, -1);
    dc.setPenWidth(1);
    let px = -1, py = -1;
    for (let b = 0; b < NB; b++) {
      const x = BLD[b * 5] + ox, w = BLD[b * 5 + 1], top = BLD[b * 5 + 2] + oy;
      if (px >= 0) dc.drawLine(px, py, x, top);
      dc.drawLine(x, top, x + w, top);
      px = x + w; py = top;
      if (b === 1) {
        // church tower + spire between building 1 and 2
        dc.drawLine(px, py, px, 320 + oy);
        dc.drawLine(px, 320 + oy, 152 + ox, 320 + oy);
        dc.drawLine(152 + ox, 320 + oy, 152 + ox, 248 + oy);
        dc.drawLine(152 + ox, 248 + oy, 162 + ox, 196 + oy);
        dc.drawLine(162 + ox, 196 + oy, 172 + ox, 248 + oy);
        dc.drawLine(172 + ox, 248 + oy, 172 + ox, 320 + oy);
        dc.drawLine(172 + ox, 320 + oy, 176 + ox, 320 + oy);
        px = 176 + ox; py = 320 + oy;
      }
    }
    // TV tower
    const goal = d.floorsGoal > 0 && d.floors >= d.floorsGoal;
    dc.drawLine(TX - 4 + ox, 256 + oy, TX - 4 + ox, 200 + oy);
    dc.drawLine(TX + 3 + ox, 256 + oy, TX + 3 + ox, 200 + oy);
    dc.drawLine(TX + ox, 168 + oy, TX + ox, 128 + oy);
    dc.setColor(goal ? G.dim(d.accent, 0.5) : 0x34344a, -1);
    dc.drawCircle(TX + ox, 184 + oy, 16);
    // a few lit windows (floors / 3)
    const fl = d.floors > 0 ? d.floors : 0;
    const nl = Math.min(WIN.length, Math.floor(fl / 3));
    dc.setColor(0x5a4a26, -1);
    for (let i = 0; i < nl; i++) {
      const id = WIN[i];
      const b = Math.floor(id / 10000), r = Math.floor(id / 100) % 100, c = id % 100;
      dc.fillRectangle(WG[b * 3] + c * 12 + ox, BLD[b * 5 + 2] + 12 + r * 12 + oy, 8, 8);
    }
    dc.setColor(0x8a8a8a, -1);
    F.px(dc, timeStr(d), 227 + ox, 56 + oy, 8, 1, 2);
  },
};
