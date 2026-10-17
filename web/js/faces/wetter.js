// WETTER — "Wetterfenster": the real weather outside as pixel art (4 px grid). Condition, temperature,
// wind, rain chance, high/low and day/night (sun elevation) drive the scene: clouds drift with the wind,
// rain streaks + drops running down the glass, snow falling and piling up, fog banks, thunder flashes,
// a tree bending in the wind, sun / moon (real phase) / stars. Every wrist raise brings a new detail
// (the cat looks back at you, new rain drops on the glass, another lightning pattern).
// Styles: 1 Fenster (a room window with curtains, cat and geranium on the sill), 2 Postkarte (a vintage
// postcard with stamp and postmark), 3 Diorama (a voxel cottage on a floating island).
// Mirrors watch/source/faces/Wetter.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import S from "../sprites/wetter.js";
import { SPR, encodeAll } from "../engine/spr.js";

const SP = encodeAll(S);
const P = 4;
const CX = 227;
// style 1 window: glass x 128..328, y 112..312 (50 x 50 cells), cross bars at x 224..232 / y 176..184
const GX = 128, GY = 112, GW = 200, GH = 200;
// weather state (per frame, cheap): cloud 0..3, rain 0..3, snow 0..3, storm, fog, wind 0..3, sun elevation
let CLD = 1, RN = 0, SNW = 0, STM = false, FOG = false, WND = 1, EL = 20, NIGHT = false, DUSK = 0;
let FPS = 6;

// Garmin Weather.CONDITION_* -> cloud / rain / snow / storm / fog / wind
function weather(d) {
  const c = d.cond;
  CLD = 1; RN = 0; SNW = 0; STM = false; FOG = false;
  let w = 0;
  if (c === 0 || c === 23 || c === 39) CLD = 0;
  else if (c === 22 || c === 1 || c === 51) CLD = 1;
  else if (c === 2) CLD = 2;
  else if (c === 20) CLD = 3;
  else if (c === 5) { CLD = 1; w = 2; }
  else if (c === 14 || c === 26 || c === 30 || c === 44 || c === 11 || c === 13) { CLD = 2; RN = 1; }
  else if (c === 3 || c === 24 || c === 48 || c === 49) { CLD = 3; RN = 2; }
  else if (c === 15 || c === 25) { CLD = 3; RN = 3; }
  else if (c === 16 || c === 42 || c === 45 || c === 47 || c === 33) { CLD = 2; SNW = 1; }
  else if (c === 4 || c === 7 || c === 18 || c === 21 || c === 43 || c === 46 || c === 50 || c === 10) { CLD = 3; SNW = 2; }
  else if (c === 17 || c === 19) { CLD = 3; SNW = 3; }
  else if (c === 6 || c === 12 || c === 27 || c === 31 || c === 35 || c === 40 || c === 41) { CLD = 3; RN = 2; STM = true; }
  else if (c === 8 || c === 9 || c === 28 || c === 38 || c === 29 || c === 32 || c === 34 || c === 36 || c === 37) { CLD = 2; FOG = true; }
  // wind: m/s -> 0 calm, 1 breeze, 2 windy, 3 gale
  const ws = d.wind;
  let wl = ws < 0 ? 1 : ws < 3 ? 0 : ws < 7 ? 1 : ws < 12 ? 2 : 3;
  if (STM && wl < 2) wl = 2;
  WND = wl > w ? wl : w;
  const lat = d.locOk ? d.lat : 52.52, lon = d.locOk ? d.lon : 13.4;
  EL = AST.elev(d.doy, d.mins, lat, lon, d.tz);
  NIGHT = EL < -6;
  DUSK = EL >= -6 && EL < 6 ? 1 - Math.abs(EL) / 6.0 : 0;
  // fraction of the day (sun) or night (moon) passed, for the arc position
  const sr = d.sunrise, ss = d.sunset;
  if (sr < 0 || ss < 0) SUNF = 0.5;
  else if (!NIGHT) SUNF = G.clamp((d.mins - sr + 30) / (ss - sr + 60), 0, 1);
  else {
    const nl = 1440 - (ss - sr);
    SUNF = G.clamp(fm(d.mins - ss, 1440) / nl, 0, 1);
  }
}

// sky bands (top -> bottom), 4 colours
const SKY_DAY = [0x3f86d8, 0x5c9ce2, 0x7cb4ec, 0xa6d0f4];
const SKY_GREY = [0x7a8696, 0x8a95a4, 0x9ba5b2, 0xaeb6c0];
const SKY_DUSK = [0x2c3472, 0x66498c, 0xc86c88, 0xf2a46c];
const SKY_NIGHT = [0x060a1c, 0x0a122c, 0x101c40, 0x18284e];
const SKY_NGREY = [0x0e1016, 0x14161e, 0x1a1d27, 0x212530];
const FOGC = 0xb8bec4;
// ---- colours, recomputed only when the minute / condition / style changes
let CK = -1, CK2 = -1;
let SKYC = [0, 0, 0, 0], SKYB = [0, 0, 0, 0], CLC = [0, 0, 0], TREEC = [0, 0, 0, 0, 0], TC = [0, 0, 0, 0, 0];
let HILL = [0, 0, 0, 0, 0], HP = [0, 0, 0, 0, 0, 0, 0, 0, 0], DIOP = [], DIOT = [];
function skyCol(k) { return SKYC[k]; }
function cloudCols() { return CLC; }
function treeCols(d) { return TREEC; }
function prep(st, d) {
  for (let k = 0; k < 4; k++) SKYC[k] = skyColRaw(k);
  for (let k = 0; k < 4; k++) SKYB[k] = G.mix(SKYC[k], SKYC[k < 3 ? k + 1 : 3], 0.5);
  CLC = cloudColsRaw();
  TREEC = treeColsRaw(d);
  const night = NIGHT, snow = SNW >= 2;
  if (st === 1) {
    TC = [shade(night ? 0x2a2230 : 0x8a4a3a), shade(night ? 0x2e3040 : 0xc8b8a0), night ? 0xffd36a : shade(0x5a6a7c), shade(0x4a3c38), snow ? shade(0xf4f8ff) : shade(night ? 0x342a3a : 0x9a5a48)];
  } else if (st === 2) {
    HILL = [shade(snow ? 0xc8d4e0 : 0x7a96a8), shade(snow ? 0xf0f4fa : 0x5a9a3a), shade(snow ? 0xd8e2ee : 0x4a8a30), shade(0x8a6a44), shade(snow ? 0xd8e0ea : 0xd8c08a)];
    HP = [shade(snow ? 0xf4f8ff : 0xc0483a), shade(0x5a2a1e), shade(0xf2ece0), shade(0x5a3a24), night ? 0xffd36a : shade(0x7ab0d8), shade(0x6a4428), shade(0x7a7a7a), 0, shade(0xe8404a)];
  } else {
    DIOP = [
      shade(snow ? 0xf4f8ff : 0x6cbf4a), shade(snow ? 0xe0e8f2 : 0x86d45a), shade(0x8a5a34), shade(0x5e3a22),
      shade(snow ? 0xf4f8ff : 0xc8503a), shade(snow ? 0xc8d0dc : 0x8a3226), shade(0xefe2c4), shade(0xbfae8e),
      night ? 0xffd36a : shade(0x9ad0f0), shade(0x5a3a22), shade(0x8a8a8a), shade(0x3a2a22), shade(snow ? 0xdce4ee : 0xa43c2c),
      shade(snow ? 0xe8eef6 : 0xd8c08a), shade(snow ? 0xe8f0f8 : 0x5aa83a), shade(0x3a7a2a), shade(0x6a4a2a), shade(0x6e5a4a),
      shade(snow ? 0xf4f8ff : 0xf08ab0), shade(RN > 0 ? 0x6a9ad8 : 0x4a8ad8)];
    DIOT = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, DIOP[14], DIOP[15], DIOP[16]];
    if (d.mon >= 9 && d.mon <= 11 && !snow) { DIOT[14] = shade(0xd0782a); DIOT[15] = shade(0x9a4a1e); }
  }
}
function skyColRaw(k) {
  const g = CLD >= 3 ? 1 : CLD === 2 ? 0.55 : 0;
  let c;
  if (NIGHT) c = G.mix(SKY_NIGHT[k], SKY_NGREY[k], g);
  else {
    c = G.mix(SKY_DAY[k], SKY_GREY[k], g);
    if (DUSK > 0) c = G.mix(c, G.mix(SKY_DUSK[k], SKY_NGREY[k], g * 0.6), DUSK);
    if (EL < 0) c = G.mix(c, SKY_NIGHT[k], -EL / 6.0);
  }
  if (STM) c = G.mix(c, 0x20232c, 0.35);
  if (FOG) c = G.mix(c, NIGHT ? 0x3a3e46 : FOGC, 0.55);
  return c;
}
// fade a scene colour into fog / night
function shade(c) {
  if (NIGHT) c = G.mix(c, 0x05070e, 0.62);
  else if (EL < 4) c = G.mix(c, 0x1a1830, G.clamp((4 - EL) / 10.0, 0, 0.55));
  if (FOG) c = G.mix(c, NIGHT ? 0x3a3e46 : FOGC, 0.5);
  return c;
}

function q4(v) { return Math.floor(v / P) * P; }
// integer division truncating toward zero (like Monkey C) and a tiny LCG for per-drop randomness
function tdiv(a, b) { return Math.trunc(a / b); }
function lcg(s) { return (s * 75 + 74) % 65537; }
// float modulo (positive)
function fm(v, m) { return v - m * Math.floor(v / m); }

// ---- outside: sky, stars, sun/moon, clouds inside the rect (x, y, w, h); horizon at y + h
function outside(dc, x, y, w, h, t, seed) {
  // bands (8 on the full-screen sky: every second one a blend)
  const nb = h > 300 ? 8 : 4;
  const bh = q4(h / nb);
  for (let k = 0; k < nb; k++) {
    let c;
    if (nb === 4) c = skyCol(k);
    else c = k % 2 === 0 ? SKYC[k >> 1] : SKYB[k >> 1];
    dc.setColor(c, -1);
    dc.fillRectangle(x, y + k * bh, w, k === nb - 1 ? h - (nb - 1) * bh : bh);
  }
  // stars (clear night)
  if (NIGHT && CLD < 2 && !FOG) {
    let s = 777;
    const ns = h > 300 ? 40 : 22;
    for (let i = 0; i < ns; i++) {
      s = G.rnd(s);
      const sx = x + q4((s % 1000) * w / 1000);
      s = G.rnd(s);
      const sy = y + q4((s % 1000) * h * 0.6 / 1000);
      const tw = (i * 7 + Math.floor(t / 400)) % 9 === 0;
      dc.setColor(tw ? 0x6a7090 : i % 3 === 0 ? 0xfff4d0 : 0xc8d0e8, -1);
      dc.fillRectangle(sx, sy, P, P);
    }
  }
  // sun / moon on an arc across the rect
  const pos = sunPos(x, y, w, h);
  if (pos[2] > 0 && !FOG && CLD < 3) {
    if (!NIGHT) {
      const ph = Math.floor(t / 500) % 2;
      SPR.draw(dc, SP.SUN, pos[0] - 18, pos[1] - 18, P, [0xfff6c8, 0xffd23f, ph === 0 ? 0xffe27a : -1], false);
    } else {
      const m = SP.MOON_F;
      const ph = MOON_PH;
      const spr = ph < 0.06 || ph > 0.94 ? null : ph < 0.19 || ph > 0.81 ? SP.MOON_C : ph < 0.31 || ph > 0.69 ? SP.MOON_H : ph < 0.44 || ph > 0.56 ? SP.MOON_G : m;
      if (spr !== null) SPR.draw(dc, spr, pos[0] - 14, pos[1] - 14, P, [CLD >= 2 ? 0x9aa0a8 : 0xf4f0d8, 0xc8c4a8], ph > 0.5);
    }
  }
  // two birds crossing the sky (fair weather, daytime)
  if (!NIGHT && RN === 0 && SNW === 0 && !FOG && EL > 3) {
    dc.setColor(0x2a2a36, -1);
    for (let i = 0; i < 2; i++) {
      const bx = x - 12 + q4(fm(seed * (i + 3) + t * (0.028 + i * 0.006), w + 24));
      const by = y + q4(h * (0.22 + i * 0.12) + 6 * Math.sin(t * 0.002 + i * 2));
      const up = Math.floor(t / 260 + i) % 2 === 0;
      dc.fillRectangle(bx, by, P, P);
      dc.fillRectangle(bx - P, by - (up ? P : 0), P, P);
      dc.fillRectangle(bx + P, by - (up ? P : 0), P, P);
    }
  }
  // clouds drifting with the wind
  const n = CLD === 0 ? 1 : CLD === 1 ? 2 : 3;
  const spd = (0.004 + WND * 0.006) * (a_live ? 1 : 0);
  const cc = cloudCols();
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = G.rnd(s);
    const big = i % 2 === 0;
    const spr = big ? SP.CLOUD_A : SP.CLOUD_B;
    const cw = spr[0] * P;
    const span = w + cw;
    const cx = x - cw + fm(((s % 1000) * span) / 1000 + t * spd * (big ? 1 : 1.4), span);
    const cy = y + q4(((i * 37 + (s % 13)) % Math.max(4, Math.floor(h * 0.45 / P))) * P);
    if (CLD === 0 && i === 0 && NIGHT) continue;
    SPR.draw(dc, spr, q4(cx), cy, P, cc, false);
  }
}

let MOON_PH = 0;
let a_live = false;

function cloudColsRaw() {
  if (STM) return [0x8a8f9a, 0x5e6470, 0x40444e];
  if (NIGHT) return CLD >= 2 ? [0x3a4050, 0x2c3240, 0x1e232e] : [0x5a6274, 0x3a4254, 0x262c3a];
  if (DUSK > 0.4) return [0xffe0d0, 0xe8a8a0, 0x9a6a80];
  if (CLD >= 2 || RN > 0) return [0xd4dae0, 0xb0b8c2, 0x848e9a];
  return [0xffffff, 0xe8eef4, 0xbcc8d4];
}

// sun (day) or moon (night) position on an arc across the rect: [x, y, visible]
let SUNF = 0.5;
function sunPos(x, y, w, h) {
  // full-screen sky (diorama): an arc behind the island, highest just above the roof
  if (h > 300) {
    const an = (SUNF - 0.5) * 150 * Math.PI / 180;
    return [q4(227 + 194 * Math.sin(an)), q4(320 - 194 * Math.cos(an)), 1];
  }
  return [q4(x + w * (0.3 + 0.58 * SUNF)), q4(y + h * 0.5 - h * 0.36 * Math.sin(SUNF * Math.PI)), 1];
}

// ---- precipitation within the rect: rain streaks / snow flakes
function precip(dc, x, y, w, h, t, seed) {
  if (RN === 0 && SNW === 0) return;
  const n = RN > 0 ? 8 + RN * 8 : 8 + SNW * 8;
  const slant = WND >= 2 ? 2 : WND === 1 ? 1 : 0;
  let s = seed;
  if (RN > 0) dc.setColor(NIGHT ? 0x6a7a94 : STM ? 0xaab4c4 : 0xd0dcec, -1);
  else dc.setColor(NIGHT ? 0xb8c0d0 : 0xffffff, -1);
  if (SNW > 0 && !NIGHT && CLD < 3) dc.setColor(0xf8fcff, -1);
  s = s % 65537;
  const tr = tdiv(t * 8, 25), ts = tdiv(t * 45, 1000);
  for (let i = 0; i < n; i++) {
    s = lcg(s);
    const x0 = s % 1000;
    s = lcg(s);
    const y0 = s % 1000;
    if (RN > 0) {
      const yy = (tdiv(y0 * h, 1000) + tr) % h;
      const xx = (tdiv(x0 * w, 1000) + tdiv(yy * slant, 4)) % w;
      // streak, leaning with the wind
      const rx = x + tdiv(xx, 4) * 4, ry = y + tdiv(yy, 4) * 4;
      if (slant === 0) dc.fillRectangle(rx, ry, P, P * 3);
      else {
        dc.fillRectangle(rx, ry, P, P * 2);
        dc.fillRectangle(rx + P, ry + P * 2, P, P * slant);
      }
    } else {
      const yy = (tdiv(y0 * h, 1000) + ts) % h;
      const xx = (tdiv(x0 * w, 1000) + tdiv(yy * slant * 3, 10) + Math.trunc(6 * Math.sin(t * 0.002 + i)) + w) % w;
      const fx = x + tdiv(xx, 4) * 4, fy = y + tdiv(yy, 4) * 4;
      if (i % 3 === 0) {
        // big flake in front: a little plus
        dc.fillRectangle(fx - P, fy, 3 * P, P);
        dc.fillRectangle(fx, fy - P, P, 3 * P);
      } else dc.fillRectangle(fx, fy, P, P);
    }
  }
}

// ---- fog banks drifting through the lower part of the rect
function fogBands(dc, x, y, w, h, t) {
  if (!FOG) return;
  const fc = NIGHT ? 0x4a4e58 : 0xd2d6da;
  for (let k = 0; k < 3; k++) {
    const by = y + h - 24 - k * 28;
    const off = q4(fm(t * (0.01 + k * 0.004) + k * 60, 64));
    dc.setColor(G.mix(skyCol(3), fc, 0.75 - k * 0.15), -1);
    dc.fillRectangle(x, by, w, 12);
    // dithered fringe
    for (let c = 0; c < w / 8; c++) dc.fillRectangle(x + ((c * 8 + off) % w), by - 4, P, P);
  }
}

// lightning: one strike pattern per wrist raise; returns flash strength 0..1
function flash(t, wake) {
  if (!STM || !a_live) return 0;
  let s = G.rnd(wake * 31 + 7);
  for (let i = 0; i < 3; i++) {
    s = G.rnd(s);
    const t0 = 1200 + i * 2600 + (s % 1800);
    const u = t - t0;
    if (u >= 0 && u < 160) return u < 60 ? 1 : 0.5;
  }
  return 0;
}

// crown lean (cells) for the wind level and time
function treeLean(t) {
  if (WND === 0 || !a_live) return WND >= 2 ? 1 : 0;
  const f = Math.floor(t / (WND === 1 ? 700 : WND === 2 ? 350 : 220)) % 4;
  if (WND === 1) return f === 3 ? 1 : 0;
  if (WND === 2) return f % 2 === 0 ? 1 : 2;
  return f === 1 ? 1 : 2;
}
// the big tree at (x, y): trunk + leaning crown, bare in winter
function tree(dc, d, t, x, y) {
  const c = treeCols(d);
  if (d.mon === 12 || d.mon <= 2) { SPR.draw(dc, SP.TREE_BARE, x, y, P, c, false); return; }
  dc.setColor(c[0], -1);
  dc.fillRectangle(x + 13 * P, y + 16 * P, 3 * P, 16 * P);
  dc.fillRectangle(x + 11 * P, y + 31 * P, 6 * P, P);
  dc.setColor(c[1], -1);
  dc.fillRectangle(x + 14 * P, y + 16 * P, P, 15 * P);
  SPR.draw(dc, SP.TREE_CROWN, x + treeLean(t) * P, y, P, c, false);
}
function treeColsRaw(d) {
  let lv;
  if (d.mon >= 3 && d.mon <= 5) lv = [0x3c7a2a, 0x5aa83a, 0x8ad05a];
  else if (d.mon >= 6 && d.mon <= 8) lv = [0x2c5e22, 0x3f8030, 0x62a844];
  else lv = [0x9a4a1e, 0xd0782a, 0xf0b040];
  if (SNW >= 2) lv = [lv[0], 0xd8e0e8, 0xffffff];
  return [shade(0x4a3020), shade(0x6a4a30), shade(lv[0]), shade(lv[1]), shade(lv[2])];
}

// ---- texts shared by the styles
function tempStr(d) {
  if (d.temp === -99) return "--°";
  return Math.round(d.metric ? d.temp : d.temp * 1.8 + 32) + "°";
}
function tStr(v, d) {
  if (v === -99) return "--";
  return Math.round(d.metric ? v : v * 1.8 + 32) + "°";
}
function rainStr(d) { return d.rain < 0 ? "--" : d.rain + "%"; }

// ---- style 1: the window
function styleWindow(dc, d, a, t, p) {
  const acc = d.accent;
  const wake = d.wakeN;
  const night = NIGHT;
  // wall: striped wallpaper, warmer and darker at night (lamp light)
  const wall = night ? 0x2a2a33 : 0x34514e;
  const wall2 = night ? 0x24242c : 0x2d4744;
  dc.setColor(wall, -1);
  dc.fillRectangle(0, 0, 454, 454);
  dc.setColor(wall2, -1);
  for (let x = 8; x < 454; x += 24) dc.fillRectangle(x, 0, 8, 454);
  // lamp glow at night: warm circle behind the window top-left
  // outside
  const fl = flash(t, wake);
  dc.setClip(GX, GY, GW, GH);
  outside(dc, GX, GY, GW, GH, t, wake * 13 + 5);
  if (fl > 0) { dc.setColor(G.mix(skyCol(1), 0xeef2ff, fl * 0.8), -1); dc.fillRectangle(GX, GY, GW, GH); }
  if (fl >= 1) {
    let s = G.rnd(wake * 17 + Math.floor(t / 2600));
    SPR.draw(dc, SP.BOLT, GX + 40 + q4(s % 100), GY + 8, P, [0xffffff, 0xc8d4ff], s % 2 === 0);
  }
  // town skyline
  SPR.draw(dc, SP.TOWN, GX, GY + GH - 44, P, TC, false);
  // tree
  tree(dc, d, t, GX + 76, GY + GH - 128);
  // thermometer outside on the frame
  thermo(dc, d, GX + 6, GY + 4);
  precip(dc, GX, GY, GW, GH, t, wake * 7 + 3);
  fogBands(dc, GX, GY, GW, GH, t);
  // snow pile on the outer sill
  if (SNW > 0) {
    const ph = SNW + (a.live ? Math.min(2, Math.floor(t / 3000)) : 1);
    dc.setColor(night ? 0xa8b0c0 : 0xf4f8ff, -1);
    for (let c = 0; c < 50; c++) {
      const hh = ph + ((c * 7) % 5 === 0 ? 1 : 0) - ((c * 3) % 7 === 0 ? 1 : 0);
      dc.fillRectangle(GX + c * P, GY + GH - hh * P, P, hh * P);
    }
  }
  // drops running down the glass (rain)
  if (RN > 0) {
    let s = (wake * 101 + 9) % 65537;
    const nd = 4 + RN * 3;
    for (let i = 0; i < nd; i++) {
      s = lcg(s);
      const dx = GX + 4 + tdiv(tdiv((s % 1000) * (GW - 8), 1000), 4) * 4;
      s = lcg(s);
      const dy = GY + tdiv((tdiv(((s >> 3) % 1000) * GH, 1000) + tdiv(t * (48 + (s % 100)), 4000)) % GH, 4) * 4;
      dc.setColor(night ? 0x34405a : 0xe4eef8, -1);
      dc.fillRectangle(dx, dy - 3 * P, P, 3 * P);
      dc.setColor(night ? 0x8a9ab8 : 0xffffff, -1);
      dc.fillRectangle(dx, dy, P, P + 4);
    }
  }
  // frost in the pane corners
  if (d.temp !== -99 && d.temp <= 0) {
    const fc = [night ? 0x8a9ab0 : 0xd8ecff, 0xffffff];
    SPR.draw(dc, SP.FROST, GX, GY, P, fc, false);
    SPR.draw(dc, SP.FROST, GX + GW - 40, GY, P, fc, true);
    SPR.draw(dc, SP.FROST, GX, GY + 72, P, fc, false);
    SPR.draw(dc, SP.FROST, GX + GW - 40, GY + 72, P, fc, true);
  }
  // glass sheen
  dc.setColor(G.mix(skyCol(1), 0xffffff, 0.16), -1);
  for (let k = 0; k < 5; k++) dc.fillRectangle(GX + 20 + k * P, GY + 132 - k * 2 * P, P, 2 * P);
  dc.clearClip();

  // window frame (painted wood) + cross bars
  const fw = 0xeee8da, fs = 0xc6bca8, fd = 0x8c826e;
  const fwN = night ? G.mix(fw, 0x2a2018, 0.35) : fw, fsN = night ? G.mix(fs, 0x2a2018, 0.35) : fs;
  dc.setColor(fsN, -1);
  dc.fillRectangle(GX - 12, GY - 12, GW + 24, 12);
  dc.fillRectangle(GX - 12, GY, 12, GH);
  dc.fillRectangle(GX + GW, GY, 12, GH);
  dc.setColor(fwN, -1);
  dc.fillRectangle(GX - 12, GY - 12, GW + 24, 8);
  dc.fillRectangle(GX - 12, GY - 4, 8, GH + 4);
  dc.fillRectangle(GX + GW + 4, GY - 4, 8, GH + 4);
  dc.fillRectangle(GX + 96, GY, 8, GH);
  dc.fillRectangle(GX, GY + 64, GW, 8);
  dc.setColor(fd, -1);
  dc.fillRectangle(GX + 104, GY, 4, GH);
  dc.fillRectangle(GX, GY + 72, GW, 4);
  dc.fillRectangle(GX - 4, GY - 4, 4, GH + 4);

  // curtains: closed during the intro, then drawn aside
  const op = G.easeInOut(G.clamp((p - 0.1) / 0.75, 0, 1));
  curtain(dc, acc, op, false, night);
  curtain(dc, acc, op, true, night);
  // rod
  dc.setColor(0x5a3a22, -1);
  dc.fillRectangle(76, 84, 302, 8);
  dc.setColor(0x8a5a32, -1);
  dc.fillRectangle(68, 80, 12, 16);
  dc.fillRectangle(374, 80, 12, 16);

  // sill (inside)
  dc.setColor(night ? 0x6a4a2a : 0xa8743e, -1);
  dc.fillRectangle(100, GY + GH + 12, 256, 12);
  dc.setColor(night ? 0x4a321c : 0x7a4e26, -1);
  dc.fillRectangle(100, GY + GH + 24, 256, 8);

  // cat (sleeps at night), plant, mug when cold
  const sy = GY + GH + 12;
  const cp = lampPal([0x3a2416, 0xe0873a, 0xf6b26b, 0xb05a26, 0x8adc58, 0x5a2a1a], night);
  if (night) {
    SPR.draw(dc, SP.CAT_SLEEP, 148, sy - 32, P, cp, false);
    if (a.live) {
      const z = Math.floor(t / 700) % 3;
      dc.setColor(0xd8d0e8, -1);
      F.px(dc, "z", 206 + z * 6, sy - 44 - z * 12, 2, 0, 0);
    }
  } else {
    const mode = wake % 4;
    SPR.draw(dc, SP.CAT, 140, sy - 72, P, cp, false);
    // on some raises the cat looks back over its shoulder at you
    if (mode === 0 && a.live && t > 600 && t < 3600) {
      dc.setColor(cp[4], -1);
      dc.fillRectangle(152, sy - 52, P, 2 * P);
      dc.fillRectangle(172, sy - 52, P, 2 * P);
      dc.setColor(cp[0], -1);
      dc.fillRectangle(156, sy - 52, P, 2 * P);
      dc.fillRectangle(176, sy - 52, P, 2 * P);
      dc.setColor(cp[5], -1);
      dc.fillRectangle(164, sy - 44, P, P);
    }
    const tf = a.live ? Math.floor(t / 420) % 4 : 0;
    SPR.draw(dc, tf === 1 ? SP.TAIL_B : tf === 3 ? SP.TAIL_C : SP.TAIL_A, 188, sy + 8, P, cp, false);
  }
  const pp = lampPal([0x24301a, 0x3c7a2a, 0x62a844, 0xd8302a, 0xff7a6a, 0xc0603a, 0x8a3e24], night);
  SPR.draw(dc, SP.PLANT, 274, sy - 64, P, pp, false);
  if (d.temp !== -99 && d.temp < 8) {
    SPR.draw(dc, SP.MUG, 244, sy - 28, P, [0x2a2a2a, night ? 0x9a3a3a : 0xd84a3a, 0x7a4a2a], false);
    if (a.live) {
      dc.setColor(night ? 0x8a8a9a : 0xe8eef4, -1);
      for (let k = 0; k < 3; k++) {
        const ph = fm(t / 600.0 + k * 0.33, 1);
        dc.fillRectangle(252 + q4(4 * Math.sin(ph * 6 + k)), sy - 32 - q4(ph * 24), P, P);
      }
    }
  }

  // wall calendar (date) left
  calendar(dc, d, 24, 148, night);
  // weather note right: high / low / rain chance
  note(dc, d, 372, 152, night);

  // time on the wall above the window
  const ts = G.timeStr(d);
  const ty = 30 - q4((1 - G.ease(p * 1.4)) * 60);
  dc.setColor(night ? 0x14141a : 0x22322f, -1);
  F.px(dc, ts, CX + 4, ty + 4, 7, 1, 0);
  dc.setColor(night ? 0xffe2a8 : 0xfff4dc, -1);
  F.px(dc, ts, CX, ty, 7, 1, 0);

  // slots under the sill
  slots(dc, d, p, 356, night ? 0x9a90a8 : 0x9ec0b8, night ? 0xffe2a8 : 0xffffff);
}

// room colours under the lamp at night
function lampPal(c, night) {
  if (night) for (let i = 0; i < c.length; i++) c[i] = G.mix(c[i], 0x1a1008, 0.3);
  return c;
}

function curtain(dc, acc, op, right, night) {
  const base = night ? G.mix(acc, 0x1a1008, 0.4) : acc;
  const dk = G.mix(base, 0x000000, 0.3), lt = G.mix(base, 0xffffff, 0.25);
  // width at the top, the tie (row 33) and the bottom, closed -> open
  const wTop = Math.floor(G.lerp(28, 10, op)) * P;
  const wTie = Math.floor(G.lerp(28, 5, op)) * P;
  const wBot = Math.floor(G.lerp(28, 8, op)) * P;
  // rows of equal width are drawn as one block
  let r0 = 0, wp = -1;
  for (let r = 0; r <= 60; r++) {
    let w = -1;
    if (r < 60) w = tdiv(r < 33 ? wTop + tdiv((wTie - wTop) * r, 33) : wTie + tdiv((wBot - wTie) * (r - 33), 27), 4) * 4;
    if (w === wp) continue;
    if (wp > 0) {
      const x0 = right ? 380 - wp : 76, y = 88 + r0 * P, hh = (r - r0) * P;
      dc.setColor(base, -1);
      dc.fillRectangle(x0, y, wp, hh);
      // folds: two darker stripes and a highlight
      dc.setColor(dk, -1);
      dc.fillRectangle(x0 + tdiv(tdiv(wp * 3, 10), 4) * 4, y, P, hh);
      dc.fillRectangle(x0 + tdiv(tdiv(wp * 7, 10), 4) * 4, y, P, hh);
      dc.setColor(lt, -1);
      dc.fillRectangle(x0 + tdiv(tdiv(wp, 2), 4) * 4, y, P, hh);
    }
    r0 = r;
    wp = w;
  }
  // tie band
  if (op > 0.3) {
    dc.setColor(G.mix(base, 0x000000, 0.45), -1);
    dc.fillRectangle(right ? 380 - wTie - 4 : 76, 88 + 33 * P, wTie + 4, 8);
  }
}

function thermo(dc, d, x, y) {
  SPR.draw(dc, SP.THERMO, x, y, P, [0xe8e8e8, 0x3a4250, 0xd8302a, 0x9aa4b0], false);
  if (d.temp !== -99) {
    const f = G.clamp((d.temp + 20) / 60.0, 0, 1);
    const hh = Math.floor(f * 11) * P;
    dc.setColor(0xd8302a, -1);
    dc.fillRectangle(x + P * 2, y + 48 - hh, P, hh);
  }
  dc.setColor(NIGHT ? 0xc8d0e0 : 0x1a2430, -1);
  F.px(dc, tempStr(d), x + 26, y + 24, 2, 0, 0);
}

function calendar(dc, d, x, y, night) {
  const pap = night ? 0xa8a090 : 0xf2ead8, red = night ? 0x8a3024 : 0xc8402e;
  dc.setColor(0x1a1a1a, -1);
  dc.fillRectangle(x + 30, y - 12, 4, 12);
  dc.setColor(pap, -1);
  dc.fillRectangle(x, y, 64, 72);
  dc.setColor(G.mix(pap, 0x000000, 0.2), -1);
  dc.fillRectangle(x + 4, y + 72, 64, 4);
  dc.fillRectangle(x + 64, y + 4, 4, 68);
  dc.setColor(red, -1);
  dc.fillRectangle(x, y, 64, 18);
  dc.setColor(0xffffff, -1);
  F.px(dc, d.dowStr, x + 32, y + 3, 2, 1, 0);
  dc.setColor(0x2a2a2a, -1);
  F.px(dc, "" + d.day, x + 32, y + 24, 4, 1, 0);
  dc.setColor(red, -1);
  F.px(dc, d.monStr, x + 32, y + 56, 2, 1, 0);
}

function note(dc, d, x, y, night) {
  const pap = night ? 0x9a9688 : 0xfaf4e0;
  dc.setColor(pap, -1);
  dc.fillRectangle(x, y, 64, 64);
  dc.setColor(G.mix(pap, 0x000000, 0.2), -1);
  dc.fillRectangle(x + 4, y + 64, 64, 4);
  dc.fillRectangle(x + 64, y + 4, 4, 64);
  dc.setColor(0xd8302a, -1);
  dc.fillRectangle(x + 28, y - 4, 8, 8);
  const ic = night ? 0x5a5a5a : 0x3a3a3a;
  SPR.draw(dc, SP.ARROW_UP, x + 6, y + 8, 2, [0xd8402e], false);
  SPR.draw(dc, SP.ARROW_DN, x + 6, y + 28, 2, [0x2e6ad8], false);
  SPR.draw(dc, SP.UMBRELLA, x + 5, y + 46, 2, [0x2e6ad8, ic], false);
  dc.setColor(ic, -1);
  F.px(dc, tStr(d.hiT, d), x + 40, y + 8, 2, 1, 0);
  F.px(dc, tStr(d.loT, d), x + 40, y + 28, 2, 1, 0);
  F.px(dc, rainStr(d), x + 40, y + 48, 2, 1, 0);
}

function slots(dc, d, p, y, lc, vc) {
  for (let k = 0; k < 3; k++) {
    const sl = d.slots[k];
    const x = CX + (k - 1) * 96;
    const sp = G.stag(p, k, 0.12, 0.5);
    if (sp <= 0) continue;
    dc.setColor(lc, -1);
    F.px(dc, sl.lbl, x, y, 2, 1, 0);
    dc.setColor(vc, -1);
    F.px(dc, sl.val, x, y + 20 + q4((1 - G.ease(sp)) * 16), 3, 1, 0);
  }
}

// ---- caption for the postcard
function greeting(d) {
  if (STM) return "Stürmische Grüße!";
  if (SNW > 0) return "Verschneite Grüße!";
  if (RN > 0) return "Regnerische Grüße!";
  if (FOG) return "Neblige Grüße!";
  if (WND >= 2) return "Windige Grüße!";
  if (NIGHT) return CLD < 2 ? "Sternklare Grüße!" : "Gute Nacht!";
  if (CLD >= 2) return "Wolkige Grüße!";
  return "Sonnige Grüße!";
}

// stamp icon for the current weather
function icon() {
  if (STM) return SP.ICON_STORM;
  if (SNW > 0) return SP.ICON_SNOW;
  if (RN > 0) return SP.ICON_RAIN;
  if (FOG) return SP.ICON_FOG;
  if (CLD >= 2) return SP.ICON_CLOUD;
  return NIGHT ? SP.ICON_MOON : SP.ICON_SUN;
}

// pixel text with a 1-dot shadow
function ptext(dc, txt, x, y, sc, col, sh) {
  dc.setColor(sh, -1);
  F.px(dc, txt, x + sc, y + sc, sc, 1, 0);
  dc.setColor(col, -1);
  F.px(dc, txt, x, y, sc, 1, 0);
}

// ---- style 2: the postcard. Picture x 68..386, y 100..296 on a cream card with airmail border
const PX0 = 68, PY0 = 108, PW = 320, PH = 188;
function stylePostcard(dc, d, a, t, p) {
  const wake = d.wakeN;
  const night = NIGHT;
  const card = 0xf3ead6, ink = 0x2c3448;
  dc.setColor(card, -1);
  dc.fillRectangle(0, 0, 454, 454);
  // airmail border
  dc.setPenWidth(10);
  for (let k = 0; k < 40; k++) {
    dc.setColor(k % 2 === 0 ? 0xc8302a : 0x2a4aa8, -1);
    G.arcC(dc, CX, CX, 220, k * 9 + 1, k * 9 + 6);
  }
  // picture frame (white deckle) + shadow
  dc.setColor(0xd8ccb0, -1);
  dc.fillRectangle(PX0 - 4, PY0 - 4, PW + 12, PH + 12);
  dc.setColor(0xffffff, -1);
  dc.fillRectangle(PX0 - 8, PY0 - 8, PW + 16, PH + 16);
  // the picture is printed top -> bottom during the intro
  const rv = Math.max(4, q4(G.ease(p * 1.3) * PH));
  dc.setClip(PX0, PY0, PW, rv);
  outside(dc, PX0, PY0, PW, PH - 56, t, wake * 13 + 5);
  const fl = flash(t, wake);
  if (fl > 0) { dc.setColor(G.mix(skyCol(1), 0xeef2ff, fl * 0.8), -1); dc.fillRectangle(PX0, PY0, PW, PH); }
  const hz = PY0 + PH - 56;
  // far hills (hazy), near meadow: stepped columns
  dc.setColor(HILL[0], -1);
  for (let c = 0; c < 40; c++) {
    const hh = q4(24 + 14 * Math.sin(c * 0.3 + 1.2) + 8 * Math.sin(c * 0.71));
    dc.fillRectangle(PX0 + c * 8, hz - hh, 8, hh + 8);
  }
  dc.setColor(HILL[1], -1);
  for (let c = 0; c < 40; c++) {
    const hh = q4(6 + 8 * Math.sin(c * 0.17 + 0.4));
    dc.fillRectangle(PX0 + c * 8, hz - hh + 8, 8, 60 + hh);
  }
  dc.setColor(HILL[2], -1);
  for (let c = 0; c < 40; c++) dc.fillRectangle(PX0 + c * 8, hz + 36 + q4(4 * Math.sin(c * 0.4)), 8, 24);
  // tree, house, path, fence
  tree(dc, d, t, PX0 + 4, hz - 112);
  SPR.draw(dc, SP.HOUSE2, PX0 + 168, hz - 72, P, HP, false);
  // chimney smoke
  if (a.live && !STM) {
    dc.setColor(night ? 0x5a5a66 : 0xe8e8ec, -1);
    for (let k = 0; k < 4; k++) {
      const ph = fm(t / 900.0 + k * 0.25, 1);
      dc.fillRectangle(q4(PX0 + 232 + ph * 10 * (WND + 1) + 2 * Math.sin(k + t * 0.003)), q4(hz - 72 - ph * 40), P, P);
    }
  }
  dc.setColor(HILL[3], -1);
  for (let k = 0; k < 7; k++) dc.fillRectangle(PX0 + 112 + k * 12, hz + 4, P, 16);
  dc.fillRectangle(PX0 + 112, hz + 8, 76, P);
  dc.setColor(HILL[4], -1);
  for (let k = 0; k < 6; k++) dc.fillRectangle(PX0 + 208 + k * 8, hz + 12 + k * 8, 24, 8);
  precip(dc, PX0, PY0, PW, PH, t, wake * 7 + 3);
  fogBands(dc, PX0, PY0 + 60, PW, PH - 60, t);
  dc.clearClip();

  // stamp (weather icon + temperature) and postmark (date) over the picture's corner
  const sp = G.spring(G.stag(p, 0, 0.55, 0.4));
  if (sp > 0) {
    const sx = 330, sy = 84 - q4((1 - sp) * 20);
    dc.setColor(0xfdfbf4, -1);
    dc.fillRectangle(sx, sy, 64, 76);
    dc.setColor(card, -1);
    for (let k = 0; k < 8; k++) { dc.fillRectangle(sx + 4 + k * 8, sy - 2, 4, 4); dc.fillRectangle(sx + 4 + k * 8, sy + 74, 4, 4); }
    for (let k = 0; k < 9; k++) { dc.fillRectangle(sx - 2, sy + 4 + k * 8, 4, 4); dc.fillRectangle(sx + 62, sy + 4 + k * 8, 4, 4); }
    dc.setColor(night ? 0x2a3050 : 0xa6d0f4, -1);
    dc.fillRectangle(sx + 6, sy + 6, 52, 44);
    SPR.draw(dc, icon(), sx + 12, sy + 8, P, [NIGHT ? 0xf4f0d0 : 0xffd23f, 0xffffff, 0xb8c4d0, NIGHT ? 0xfff4c0 : 0x4a7ad8, 0xffd23f], false);
    dc.setColor(0x8a2a22, -1);
    F.px(dc, tempStr(d), sx + 32, sy + 56, 2, 1, 0);
    // postmark ring with the date + wavy cancel lines
    dc.setColor(ink, -1);
    dc.setPenWidth(2);
    dc.drawCircle(sx - 6, sy + 82, 32);
    F.px(dc, d.day + "." + d.mon, sx - 6, sy + 68, 2, 1, 0);
    F.px(dc, "" + d.year, sx - 6, sy + 84, 2, 1, 0);
    for (let k = 0; k < 3; k++) {
      for (let c = 0; c < 12; c++) dc.fillRectangle(sx - 36 - c * 6, sy + 70 + k * 9 + q4(3 * Math.sin(c * 0.9)), 4, 2);
    }
  }

  // time printed on the card, greeting + high / low / rain handwritten below the picture
  dc.setColor(ink, -1);
  F.px(dc, G.timeStr(d), CX, 48, 6, 1, 0);
  F.px(dc, greeting(d), CX, 314, 2, 1, 0);
  const hl = tStr(d.hiT, d) + " / " + tStr(d.loT, d);
  F.px(dc, hl, CX - 30, 334, 2, 1, 0);
  SPR.draw(dc, SP.UMBRELLA, CX + 26, 333, 2, [0x2a4aa8, ink], false);
  F.px(dc, rainStr(d), CX + 66, 334, 2, 1, 0);
  // slots
  slots(dc, d, p, 358, 0x8a7a60, ink);
}

// ---- style 3: the voxel diorama
function styleDiorama(dc, d, a, t, p) {
  const wake = d.wakeN;
  const night = NIGHT;
  outside(dc, 0, 0, 454, 454, t, wake * 13 + 5);
  const fl = flash(t, wake);
  if (fl > 0) { dc.setColor(G.mix(skyCol(1), 0xeef2ff, fl * 0.7), -1); dc.fillRectangle(0, 0, 454, 454); }
  // island floats in during the intro, then bobs gently
  const bob = a.live && p >= 1 ? (Math.floor(t / 900) % 2) * P : 0;
  const ix = 131, iy = 156 + q4((1 - G.ease(p * 1.2)) * 300) + bob;
  const pal = DIOP;
  SPR.draw(dc, SP.DIO_A, ix + 14 * P, iy, P, pal, false);
  SPR.draw(dc, SP.DIO_B, ix + 12 * P, iy + 32, P, pal, false);
  SPR.draw(dc, SP.DIO_C, ix + 2 * P, iy + 64, P, pal, false);
  SPR.draw(dc, SP.DIO_D, ix, iy + 96, P, pal, false);
  SPR.draw(dc, SP.DIO_E, ix + 4 * P, iy + 128, P, pal, false);
  SPR.draw(dc, SP.DIO_F, ix + 13 * P, iy + 160, P, pal, false);
  // tree (sways with the wind)
  const sway = WND >= 1 && a.live && Math.floor(t / (WND >= 2 ? 300 : 700)) % 2 === 1;
  SPR.draw(dc, sway ? SP.DIO_TREE_B : SP.DIO_TREE_A, ix + 28 * P, iy + 17 * P, P, DIOT, false);
  // chimney smoke
  if (a.live && !STM && RN < 3) {
    dc.setColor(night ? 0x5a5a66 : 0xe8e8ec, -1);
    for (let k = 0; k < 4; k++) {
      const ph = fm(t / 900.0 + k * 0.25, 1);
      dc.fillRectangle(q4(ix + 94 + ph * 10 * (WND + 1) + 2 * Math.sin(k + t * 0.003)), q4(iy - 4 - ph * 44), P, P);
    }
  }
  // a rain / snow cloud parked over the island
  if (RN > 0 || SNW > 0 || STM) {
    const cy = iy - 60;
    precip(dc, ix + 20, cy + 24, 152, 100, t, wake * 7 + 3);
    const cc = cloudCols();
    SPR.draw(dc, SP.CLOUD_A, ix + 28, cy, P, cc, false);
    SPR.draw(dc, SP.CLOUD_B, ix + 96, cy + 8, P, cc, false);
    if (fl >= 1) SPR.draw(dc, SP.BOLT, ix + 116, cy + 28, P, [0xffffff, 0xc8d4ff], false);
  }
  fogBands(dc, 0, iy + 40, 454, 160, t);

  // time, date, temperature + high / low / rain, slots
  const shd = G.mix(skyCol(0), 0x000000, 0.5);
  ptext(dc, G.timeStr(d), CX, 30, 7, night ? 0xffe8b8 : 0xffffff, shd);
  ptext(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX, 86, 2, night ? 0xc8d0e8 : 0xffffff, shd);
  thermo(dc, d, 52, 214);
  const hx = 384;
  SPR.draw(dc, SP.ARROW_UP, hx - 28, 222, 2, [0xe8402e], false);
  SPR.draw(dc, SP.ARROW_DN, hx - 28, 244, 2, [0x2a5ad8], false);
  SPR.draw(dc, SP.UMBRELLA, hx - 29, 264, 2, [0x2a5ad8, 0x1a2030], false);
  ptext(dc, tStr(d.hiT, d), hx + 6, 222, 2, 0xffffff, 0x1a2030);
  ptext(dc, tStr(d.loT, d), hx + 6, 244, 2, 0xffffff, 0x1a2030);
  ptext(dc, rainStr(d), hx + 6, 266, 2, 0xffffff, 0x1a2030);
  slots(dc, d, p, 372, night ? 0xa8b0c8 : 0xe8f0ff, 0xffffff);
}

export default {
  get fps() { return FPS; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const p = a.intro;
    const t = a.live ? a.t : 0;
    a_live = a.live;
    const key = ((st * 64 + d.cond + 2) * 1440 + d.mins) * 16 + d.mon;
    const k2 = Math.round(d.wind) * 1000 + d.temp + 100;
    if (key !== CK || k2 !== CK2) { CK = key; CK2 = k2; weather(d); prep(st, d); }
    MOON_PH = d.moon;
    FPS = RN > 0 || SNW > 0 || STM ? 12 : 6;
    if (st === 2) stylePostcard(dc, d, a, t, p);
    else if (st === 3) styleDiorama(dc, d, a, t, p);
    else styleWindow(dc, d, a, t, p);
  },

  aod(dc, d) {
    const st = d.cfg.style;
    const o = St.shift(d);
    const ox = o[0], oy = o[1];
    weather(d);
    const dim = 0x3c3c3c;
    dc.setColor(dim, -1);
    if (st === 1) {
      // window frame + cross, outlined
      dc.fillRectangle(GX - 12 + ox, GY - 12 + oy, GW + 24, 4);
      dc.fillRectangle(GX - 12 + ox, GY + GH + 8 + oy, GW + 24, 4);
      dc.fillRectangle(GX - 12 + ox, GY - 12 + oy, 4, GH + 24);
      dc.fillRectangle(GX + GW + 8 + ox, GY - 12 + oy, 4, GH + 24);
      dc.fillRectangle(GX + 98 + ox, GY + oy, 4, GH);
      dc.fillRectangle(GX + ox, GY + 66 + oy, GW, 4);
    } else if (st === 2) {
      // stamp perforation
      for (let k = 0; k < 8; k++) { dc.fillRectangle(186 + k * 8 + ox, 140 + oy, 4, 4); dc.fillRectangle(186 + k * 8 + ox, 228 + oy, 4, 4); }
      for (let k = 0; k < 11; k++) { dc.fillRectangle(178 + ox, 140 + k * 8 + oy, 4, 4); dc.fillRectangle(246 + ox, 140 + k * 8 + oy, 4, 4); }
    } else {
      // island outline (diamond)
      for (let k = 0; k < 24; k++) {
        dc.fillRectangle(131 + k * 4 + ox, 228 - k * 2 + oy, 4, 2);
        dc.fillRectangle(227 + k * 4 + ox, 180 + k * 2 + oy, 4, 2);
        dc.fillRectangle(131 + k * 4 + ox, 228 + k * 2 + oy, 4, 2);
        dc.fillRectangle(227 + k * 4 + ox, 276 - k * 2 + oy, 4, 2);
      }
    }
    const ic = 0x6a6a6a;
    const ix = st === 1 ? GX + 28 : CX - 20, iy = st === 1 ? GY + 14 : st === 2 ? 150 : 202;
    SPR.draw(dc, icon(), ix + ox, iy + oy, P, [ic, 0x5a5a5a, 0x3a3a3a, 0x5a5a5a, ic], false);
    dc.setColor(0x9a9a9a, -1);
    F.px(dc, G.timeStr(d), CX + ox, 40 + oy, 7, 1, 1);
    dc.setColor(G.dim(d.accent, 0.6), -1);
    F.px(dc, tempStr(d), (st === 1 ? GX + 152 : CX) + ox, (st === 1 ? GY + 24 : st === 2 ? 196 : 290) + oy, 3, 1, 1);
  },
};
