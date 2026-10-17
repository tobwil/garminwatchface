// AQUA — "Aquarium": a living pixel tank (4 px grid). Fish swim smooth paths with a 2-frame
// tail flap, bubbles rise, plants sway. Which fish (and how many) changes with every wrist raise
// and with the time of day (night: dark water, glowing fish). Right after a raise the curious
// fish swim up to the glass. The time sits on the glass in big pixel digits.
// Styles: 1 Riff (coral reef), 2 Teich (koi pond from above), 3 Tiefsee (anglerfish lantern).
// Mirrors watch/source/faces/Aqua.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import S from "../sprites/aqua.js";
import { SPR, encodeAll } from "../engine/spr.js";

const SP = encodeAll(S);
const SURF = 48; // water surface (reef)
const SAND = 376; // floor top
// reef fish palettes (7 each): outline, body, light, dark, fins, stripe, eye
const FPAL = [
  0x1b1622, 0xff7f1e, 0xffa04a, 0xe0601a, 0xff9a3a, 0xffffff, 0xffffff,
  0x0b1030, 0x2a5cff, 0x5a8cff, 0x0b1030, 0xffd23a, 0xffffff, 0xffffff,
  0x5a4000, 0xffd820, 0xfff070, 0xe0b000, 0xffe040, 0xffffff, 0xffffff,
  0x111111, 0xf4f0e0, 0xffffff, 0xffd030, 0x222222, 0x151515, 0xffffff,
  0x2a2010, 0xe8d090, 0xfff4d0, 0x8a6a30, 0xd0b070, 0xffffff, 0xffffff,
  0x0a2040, 0x40c8ff, 0x9ff0ff, 0x2080c0, 0x40c8ff, 0xffffff, 0xffffff,
];
// koi varieties (6 each): outline, body, patch, fins, -, eye
const KPAL = [
  0x3a1a10, 0xf8f4ec, 0xff4a1a, 0xe8ddd4, 0, 0x101010,
  0x4a3000, 0xf0b030, 0xffe080, 0xf8d890, 0, 0x201000,
  0x0a0a0a, 0x262626, 0xff5a1a, 0xc8c8c8, 0, 0xffffff,
  0x1a2a3a, 0x8aa8c0, 0xe8742a, 0xc8d8e4, 0, 0x101010,
  0x3a4048, 0xe4e8ee, 0xffffff, 0xd8e0e8, 0, 0x101010,
];
const FA = [SP.CLOWN_A, SP.TANG_A, SP.YTANG_A, SP.IDOL_A, SP.PUFF_A, SP.MINI_A];
const FB = [SP.CLOWN_B, SP.TANG_B, SP.YTANG_B, SP.IDOL_B, SP.PUFF_B, SP.MINI_B];
const KA = [SP.KOI_0A, SP.KOI_1A, SP.KOI_2A, SP.KOI_3A, SP.KOI_4A, SP.KOI_5A, SP.KOI_6A, SP.KOI_7A];
const KB = [SP.KOI_0B, SP.KOI_1B, SP.KOI_2B, SP.KOI_3B, SP.KOI_4B, SP.KOI_5B, SP.KOI_6B, SP.KOI_7B];
// school formation (dx, dy) behind the leader
const SCH = [0, 0, -16, 10, -14, -12, -30, 2, -32, -16, -44, 12, -46, -6, -58, 4];
const MOON = [10, 20, 25, 25, 20, 15, 15, 10]; // moon reflection half widths
const PENX = [48, 228, 392]; // sea pens
const PENN = [9, 6, 8];
// marine snow seeds
const SNOW = [31, 7, 112, 41, 197, 88, 263, 15, 338, 60, 402, 99, 76, 133, 151, 170, 229, 201, 300, 236, 371, 270, 58, 302, 140, 333, 215, 47, 287, 120, 352, 181, 98, 222, 186, 260, 251, 296, 326, 330];

// per-raise setup: kinds + path parameters, cached by key
let cKey = -1;
let NF = 0; // big fish
let NS = 0; // school / small fish
const FK = [0, 0, 0, 0, 0, 0];
const FP = new Array(48).fill(0); // 6 fish x 8 params

function setup(d, st, night) {
  const key = d.wakeN * 8 + st * 2 + (night ? 1 : 0);
  if (key === cKey) return;
  cKey = key;
  let s = G.rnd(G.rnd(G.rnd(d.wakeN * 7919 + st * 101 + (night ? 7 : 0) + 3)));
  s = G.rnd(s);
  if (st === 3) {
    // angler + 1-2 jellies + 2-4 lanternfish
    NF = 2 + (Math.floor(s / 4096) % 2);
    s = G.rnd(s);
    NS = 2 + (Math.floor(s / 4096) % 3);
  } else if (st === 2) {
    NF = (night ? 2 : 4) + (Math.floor(s / 4096) % 3);
    NS = 0;
  } else {
    NF = (night ? 2 : 3) + (Math.floor(s / 4096) % (night ? 2 : 3));
    s = G.rnd(s);
    NS = night ? 0 : 5 + (Math.floor(s / 4096) % 4);
  }
  // kinds: shuffled so the same kind rarely repeats
  const bag = [0, 1, 2, 3, 4];
  for (let j = 4; j > 0; j--) {
    s = G.rnd(s);
    const r = Math.floor(s / 65536) % (j + 1);
    const x = bag[j];
    bag[j] = bag[r];
    bag[r] = x;
  }
  for (let i = 0; i < 6; i++) {
    FK[i] = st === 3 ? (i === 0 ? 0 : 1) : bag[i % 5];
    for (let k = 0; k < 8; k++) {
      s = G.rnd(s);
      FP[i * 8 + k] = G.rf(s);
    }
  }
}

function sn(v) { return Math.floor(v / 4) * 4; }
function s5(v) { return Math.floor(v / 5) * 5; }

// colour scaled by the tank light (intro flicker)
function lit(c, l) { return l >= 1 ? c : G.dim(c, l); }

// palette from table tb at offset o (n entries), l = light.
// nm 1 = night glow (glowing outline + dark body), 2 = moonlit (dimmed)
function fpal(tb, o, n, nm, l) {
  const p = [];
  for (let i = 0; i < n; i++) {
    let c = tb[o + i];
    if (nm === 1) {
      if (i === 0) c = G.mix(tb[o + 1], 0xffffff, 0.45);
      else if (i < n - 1) c = G.dim(c, 0.22);
    } else if (nm === 2) c = G.dim(c, 0.5);
    p.push(lit(c, l));
  }
  return p;
}

// fish i position on its path at time tau (s): [x, y, facingRight]
function path(i, tau, st) {
  const o = i * 8;
  if (st === 2) {
    // koi: wobbly orbits around the pond centre
    const R = 50 + FP[o] * 120;
    const w = (0.12 + FP[o + 2] * 0.12) * (FP[o + 3] < 0.5 ? 1 : -1);
    const th = FP[o + 1] * 6.283 + w * tau;
    const rr = R + 22 * Math.sin(tau * 0.11 + FP[o + 4] * 6.283);
    const ry = 0.72 + FP[o + 5] * 0.25;
    return [227 + rr * Math.cos(th), 236 + rr * ry * Math.sin(th), -w * Math.sin(th), w * ry * Math.cos(th)];
  }
  const A = (st === 3 && i === 0 ? 70 : 100) + FP[o] * 70;
  const cx = 227 + (FP[o + 1] - 0.5) * 40;
  const w = (st === 3 && i === 0 ? 0.07 : 0.13) + FP[o + 2] * 0.12;
  const ph = i * 2.4 + FP[o + 3] * 1.2;
  const y0 = st === 3 && i === 0 ? 210 + FP[o + 4] * 50 : 196 + ((i * 47 + FP[o + 4] * 30) % 124);
  const B = 8 + FP[o + 5] * 22;
  const w2 = 0.2 + FP[o + 6] * 0.3;
  const ps = FP[o + 7] * 6.283;
  return [cx + A * Math.sin(w * tau + ph), y0 + B * Math.sin(w2 * tau + ps) + 3 * Math.sin(tau * 1.7 + ph), Math.cos(w * tau + ph), 0];
}

// curiosity after a raise: 0 -> 1 (at the glass) -> 0
function curious(a) {
  if (!a.live) return 0;
  const t = a.t;
  if (t < 1500) return 0;
  if (t < 2500) return G.ease((t - 1500) / 1000);
  if (t < 4400) return 1;
  if (t < 5600) return 1 - G.easeInOut((t - 4400) / 1200);
  return 0;
}

// stepped (pixel) disc
function disc(dc, cx, cy, r, step) {
  for (let y = -r; y < r; y += step) {
    const yy = y + step / 2;
    const hw = s5(Math.sqrt(Math.max(0, r * r - yy * yy)));
    if (hw > 0) dc.fillRectangle(cx - hw, cy + y, 2 * hw, step);
  }
}

// rising bubble: small dot low, ring higher up
function bubble(dc, x, y, big, col) {
  dc.setColor(col, -1);
  if (!big) { dc.fillRectangle(x, y, 4, 4); return; }
  dc.fillRectangle(x + 4, y, 4, 4);
  dc.fillRectangle(x, y + 4, 4, 4);
  dc.fillRectangle(x + 8, y + 4, 4, 4);
  dc.fillRectangle(x + 4, y + 8, 4, 4);
}

// swaying plant: n segments of 8 px from (x, base) up
function weed(dc, x, base, n, tau, ph, c1, c2) {
  for (let k = 0; k < n; k++) {
    const ox = sn(Math.sin(tau * 1.3 + ph - k * 0.3) * k * 0.9 + 2);
    dc.setColor(k % 2 === 0 ? c1 : c2, -1);
    dc.fillRectangle(x + ox, base - (k + 1) * 8, k < n / 2 ? 8 : 4, 8);
    if (k % 3 === 1) dc.fillRectangle(x + ox + (k % 2 === 0 ? 8 : -4), base - (k + 1) * 8 + 4, 4, 4);
  }
}

// glow halo (octagon of two rects) behind lights
function halo(dc, x, y, r, col) {
  dc.setColor(col, -1);
  dc.fillRectangle(sn(x - r), sn(y - r / 2), sn(2 * r), sn(r));
  dc.fillRectangle(sn(x - r / 2), sn(y - r), sn(r), sn(2 * r));
  dc.fillRectangle(sn(x - r * 0.8), sn(y - r * 0.8), sn(1.6 * r), sn(1.6 * r));
}

let fpsNow = 12;

export default {
  get fps() { return fpsNow; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const p = a.intro;
    const live = a.live;
    const tau = d.h * 3600 + d.m * 60 + d.s + (live ? a.ms / 1000.0 : 0);
    // night factor from sunrise / sunset (fallback 7:00 / 19:00)
    const sr = d.sunrise >= 0 ? d.sunrise : 420;
    const ss = d.sunset >= 0 ? d.sunset : 1140;
    const mn = d.mins;
    let nf = 0;
    if (mn < sr - 30 || mn > ss + 30) nf = 1;
    else if (mn < sr + 30) nf = (sr + 30 - mn) / 60.0;
    else if (mn > ss - 30) nf = (mn - ss + 30) / 60.0;
    const night = nf > 0.5;
    setup(d, st, night);
    // tank light switching on (fluorescent flicker), complete at p = 0.34
    const L = p < 0.1 ? 0 : p < 0.17 ? 0.75 : p < 0.23 ? 0.12 : p < 0.3 ? 0.9 : p < 0.34 ? 0.45 : 1;
    const cu = curious(a);
    fpsNow = 12;

    if (st === 1) {
      // ---------------- coral reef
      const wT = G.mix(0x38b4e0, 0x0c2a4c, nf), wB = G.mix(0x0a4a86, 0x02081a, nf);
      dc.setColor(lit(G.mix(0x0a1a28, 0x03070c, nf), L), -1);
      dc.fillRectangle(0, 0, 454, SURF);
      for (let i = 0; i < 11; i++) {
        dc.setColor(lit(G.mix(wT, wB, i / 10.0), L), -1);
        dc.fillRectangle(0, SURF + i * 30, 454, 30);
      }
      // light rays (moonlight at night)
      const rk = (1 - nf * 0.7) * 0.2;
      for (let r = 0; r < 3; r++) {
        const x0 = 96 + r * 112 + Math.sin(tau * 0.21 + r * 2.1) * 14;
        for (let j = 0; j < 20; j++) {
          const y = SURF + 4 + j * 15;
          const bnd = G.mix(wT, wB, Math.floor((y - SURF) / 30) / 10.0);
          dc.setColor(lit(G.mix(bnd, 0xe0f8ff, rk * (1 - j / 20.0)), L), -1);
          dc.fillRectangle(sn(x0 + j * 6), y, 16 + j * 2, 15);
        }
      }
      // surface
      const sc = lit(G.mix(0x9fe6ff, 0x34566e, nf), L);
      dc.setColor(sc, -1);
      dc.fillRectangle(0, SURF, 454, 4);
      const wv = Math.floor(tau * 3);
      for (let x = 0; x < 454; x += 24) if ((x / 24 + wv) % 3 === 0) dc.fillRectangle(x, SURF - 4, 12, 4);
      // sand
      const sa = lit(G.mix(0xe6c48a, 0x2a2a30, nf * 0.85), L);
      dc.setColor(sa, -1);
      dc.fillRectangle(0, SAND + 8, 454, 80);
      for (let x = 0; x < 454; x += 16) {
        const hh = 4 * Math.floor(2 + 1.5 * Math.sin(x * 0.031 + 1));
        dc.fillRectangle(x, SAND + 8 - hh, 16, hh);
      }
      dc.setColor(lit(G.mix(0xc9a46a, 0x1c1c22, nf * 0.85), L), -1);
      for (let i = 0; i < 20; i += 2) dc.fillRectangle(sn(60 + SNOW[i] * 0.85), SAND + 16 + (SNOW[i + 1] % 40), 8, 4);
      dc.setColor(lit(G.mix(0xf6dcaa, 0x3a3a42, nf * 0.85), L), -1);
      for (let i = 20; i < 40; i += 2) dc.fillRectangle(sn(70 + SNOW[i] * 0.85), SAND + 14 + (SNOW[i + 1] % 44), 4, 4);
      // plants + props
      const kd = L * (1 - 0.62 * nf);
      const g1 = lit(0x2f9a4a, kd), g2 = lit(0x1f7a3a, kd);
      weed(dc, 88, SAND + 8, 12, tau, 0, g1, g2);
      weed(dc, 180, SAND + 8, 8, tau, 1.7, g1, g2);
      weed(dc, 284, SAND + 8, 10, tau, 3.1, g1, g2);
      weed(dc, 384, SAND + 8, 12, tau, 4.4, g1, g2);
      SPR.draw(dc, SP.CORAL_C, 48, SAND - 44, 4, [lit(0x3a0a30, kd), lit(0xc040a0, kd), lit(0xff80d0, kd), lit(0x802070, kd)], false);
      const open = (tau % 9) < 2;
      SPR.draw(dc, open ? SP.CHEST_B : SP.CHEST_A, 112, SAND - (open ? 32 : 24), 4,
        [lit(0x2a160a, kd), lit(0x8a4d22, kd), lit(0xb06a32, kd), lit(0xf2c23a, kd), lit(0xfff09a, kd), lit(0x1a0d05, kd)], false);
      SPR.draw(dc, SP.CORAL_B, 188, SAND - 16, 4, [lit(0x3a2a10, kd), lit(0xd8b060, kd), lit(0xf0d890, kd), lit(0x9a7a40, kd)], false);
      SPR.draw(dc, SP.HELMET, 300, SAND - 44, 4, [lit(0x2a1a08, kd), lit(0xc8892a, kd), lit(0xf0c060, kd), lit(0x7a4a14, kd), lit(0x2a5470, kd), lit(0x9fd8f0, kd)], false);
      SPR.draw(dc, SP.CORAL_A, 348, SAND - 48, 4, [lit(0x4a1020, kd), lit(0xff6a8a, kd), lit(0xffa0b8, kd), lit(0xb03050, kd)], false);
      SPR.draw(dc, SP.STAR, 252, SAND - 20, 4, [lit(0x601010, kd), lit(0xff5030, kd), lit(0xff9070, kd)], false);
      // bubbles: helmet stream + chest burst
      const bc = lit(G.mix(0xd8f6ff, 0x6a9ab8, nf), L);
      for (let j = 0; j < 6; j++) {
        const ph = (tau * 0.23 + j / 6.0) % 1.0;
        const y = sn(SAND - 44 - ph * (SAND - 44 - SURF - 8));
        bubble(dc, sn(320 + Math.sin(tau * 2.3 + j * 1.9) * 6), y, ph > 0.3, bc);
      }
      if (open) {
        for (let j = 0; j < 3; j++) {
          const ph = (tau % 9) / 2.0;
          bubble(dc, sn(128 + j * 8 + Math.sin(tau * 3 + j) * 4), sn(SAND - 36 - ph * (110 + j * 30)), j !== 1, bc);
        }
      }
      // school of small fish
      if (NS > 0) {
        const lx = 227 + 160 * Math.sin(tau * 0.17 + 1.3), ly = 300 + 18 * Math.sin(tau * 0.41);
        const dir = Math.cos(tau * 0.17 + 1.3) >= 0;
        const pm = fpal(FPAL, 35, 7, night ? 1 : 0, L);
        for (let j = 0; j < NS; j++) {
          const x = lx + (dir ? SCH[j * 2] : -SCH[j * 2]) + 3 * Math.sin(tau * 2 + j);
          const y = ly + SCH[j * 2 + 1] + 2 * Math.sin(tau * 1.7 + j * 2);
          SPR.draw(dc, (Math.floor(tau * 6) + j) % 2 === 0 ? SP.MINI_A : SP.MINI_B, sn(x - 14), sn(y - 8), 4, pm, !dir);
        }
      }
      // fish (the first two are the curious ones)
      for (let i = NF - 1; i >= 0; i--) {
        const k = FK[i];
        const q = path(i, tau, 1);
        let x = q[0], y = q[1], right = q[2] >= 0, s = 4;
        if (i < 2 && cu > 0) {
          const tx = i === 0 ? 150 : 304, ty = i === 0 ? 240 : 256;
          x = G.lerp(x, tx, cu);
          y = G.lerp(y, ty, cu);
          if (cu > 0.5) right = i === 0;
          s = cu > 0.75 ? 8 : cu > 0.4 ? 6 : 4;
          if (cu >= 1) x += (i === 0 ? 4 : -4) * (Math.floor(a.t / 400) % 3 === 0 ? 1 : 0);
        }
        const spr = (Math.floor(tau * 4) + i) % 2 === 0 ? FA[k] : FB[k];
        if (night) halo(dc, x, y, spr[0] * s * 0.62, lit(G.mix(wB, FPAL[k * 7 + 1], 0.1), L));
        SPR.draw(dc, spr, sn(x - (spr[0] * s) / 2), sn(y - (spr[1] * s) / 2), s, fpal(FPAL, k * 7, 7, night ? 1 : 0, L), !right);
        if (i < 2 && cu >= 1) {
          // curious bubbles from the mouth
          const bph = ((a.t - 2500) % 900) / 900.0;
          bubble(dc, sn(x + (i === 0 ? 1 : -1) * spr[0] * 4 - 4), sn(y - 30 - bph * 40), bph > 0.4, bc);
        }
      }
    } else if (st === 2) {
      // ---------------- koi pond from above (5 px grid: the koi are the stars here)
      const w0 = G.mix(0x2a6450, 0x08201a, nf), w1 = G.mix(0x1f5242, 0x061914, nf), w2 = G.mix(0x16402f, 0x041210, nf);
      dc.setColor(lit(w0, L), -1);
      dc.fillRectangle(0, 0, 454, 454);
      dc.setColor(lit(w1, L), -1);
      disc(dc, 225, 235, 170, 10);
      dc.setColor(lit(w2, L), -1);
      disc(dc, 225, 240, 105, 10);
      // dappled light / moon reflection
      if (!night) {
        dc.setColor(lit(G.mix(w0, 0xb8e8a0, 0.16), L), -1);
        for (let j = 0; j < 5; j++) {
          const x = s5(80 + j * 70 + 18 * Math.sin(tau * 0.13 + j * 1.3)), y = s5(90 + ((j * 97) % 260) + 10 * Math.sin(tau * 0.17 + j));
          dc.fillRectangle(x, y, 20, 10);
          dc.fillRectangle(x + 5, y - 5, 10, 20);
        }
      } else {
        for (let j = 0; j < 8; j++) {
          dc.setColor(lit(j < 3 ? 0xe8e4c0 : j < 6 ? 0xa8a688 : 0x6a6a58, L), -1);
          const hw = MOON[j];
          const x = s5(290 - hw + 5 * Math.sin(tau * 1.3 + j * 1.7));
          const gp = 5 + s5(hw * 0.5 + 5 * Math.sin(tau * 2.1 + j));
          dc.fillRectangle(x, 210 + j * 10, gp, 5);
          dc.fillRectangle(x + gp + 5, 210 + j * 10, Math.max(5, 2 * hw - gp - 5), 5);
        }
      }
      // pebbles on the bottom
      dc.setColor(lit(G.mix(w1, 0x000000, 0.3), L), -1);
      for (let i = 0; i < 40; i += 2) dc.fillRectangle(s5(70 + SNOW[i] * 0.8), s5(100 + SNOW[i + 1] * 0.9 + (i % 3) * 30), 10, 5);
      // lily pads
      const kd = L * (1 - 0.6 * nf);
      const lp = [lit(0x0a2a10, kd), lit(0x2f8a3a, kd), lit(0x5ab84a, kd), lit(0x1a5a24, kd), lit(0xffc0d8, kd), lit(0xffe060, kd)];
      SPR.draw(dc, SP.LILY_B, s5(55 + 6 * Math.sin(tau * 0.05)), 105, 5, lp, false);
      SPR.draw(dc, SP.LILY_A, s5(335 + 6 * Math.sin(tau * 0.04 + 2)), 290, 5, lp, true);
      SPR.draw(dc, SP.LILY_A, 75, 300, 5, lp, false);
      // ripples (from rising bubbles / feeding)
      const rc = lit(G.mix(w0, 0xd8f0e0, 0.5), L);
      for (let j = 0; j < 3; j++) {
        const ph = (tau * 0.25 + j * 0.37) % 1.0;
        const cyc = Math.floor(tau * 0.25 + j * 0.37);
        let cx = 120 + ((j * 131 + cyc * 77) % 220), cy = 160 + ((j * 59 + cyc * 43) % 160);
        if (cu > 0 && j < 2) { cx = 227 + (j === 0 ? -20 : 24); cy = 262 + (j === 0 ? 8 : -10); }
        dc.setColor(G.mix(rc, w1, ph), -1);
        const r = 6 + ph * 36;
        for (let k = 0; k < 12; k++) {
          dc.fillRectangle(s5(cx + r * Math.cos(k * 0.5236)), s5(cy + r * 0.8 * Math.sin(k * 0.5236)), 5, 5);
        }
      }
      // koi (feeding after a raise)
      if (cu > 0) {
        dc.setColor(lit(0x8a5a2a, L), -1);
        for (let j = 0; j < 5; j++) if (cu < 0.9 || j % 2 === Math.floor(a.t / 500) % 2) dc.fillRectangle(s5(210 + j * 10), s5(250 + ((j * 7) % 3) * 10), 5, 5);
      }
      for (let i = 0; i < NF; i++) {
        const q = path(i, tau, 2);
        let x = q[0], y = q[1], vx = q[2], vy = q[3];
        if (cu > 0) {
          const tx = 227 + 52 * Math.cos(i * 2.4), ty = 262 + 40 * Math.sin(i * 2.4);
          x = G.lerp(x, tx, cu);
          y = G.lerp(y, ty, cu);
          if (cu > 0.3) { vx = 227 - tx; vy = 262 - ty; }
        }
        const dir = (Math.round(Math.atan2(vy, vx) / 0.7854) + 8) % 8;
        const spr = (Math.floor(tau * 3) + i) % 2 === 0 ? KA[dir] : KB[dir];
        const k = FK[i] % 5;
        SPR.draw(dc, spr, s5(x - 42), s5(y - 42), 5, fpal(KPAL, k * 6, 6, night ? 2 : 0, L), false);
      }
      // stone rim
      for (let k = 0; k < 18; k++) {
        const an = k * 0.349 + 0.1;
        const x = s5(227 + 214 * Math.cos(an)), y = s5(227 + 214 * Math.sin(an));
        const w = 30 + (k % 3) * 10, h = 20 + ((k * 5) % 3) * 5;
        dc.setColor(lit(G.mix(0x6a6a5e, 0x1c1c1a, nf), L), -1);
        dc.fillRectangle(x - w / 2, y - h / 2, w, h);
        dc.fillRectangle(x - w / 2 + 5, y - h / 2 - 5, w - 10, h + 10);
        dc.setColor(lit(G.mix(0x9a9a8a, 0x2a2a28, nf), L), -1);
        dc.fillRectangle(x - w / 2 + 5, y - h / 2 - 5, w - 15, 5);
        if (k % 4 === 1) {
          dc.setColor(lit(G.mix(0x4a7a3a, 0x16241a, nf), L), -1);
          dc.fillRectangle(x - w / 2, y + h / 2 - 5, 15, 5);
        }
      }
      // fireflies at night
      if (night) {
        for (let j = 0; j < 6; j++) {
          const b = Math.sin(tau * (1.1 + j * 0.23) + j * 2);
          if (b < 0.2) continue;
          const x = s5(90 + j * 54 + 20 * Math.sin(tau * 0.3 + j)), y = s5(200 + ((j * 71) % 150) + 16 * Math.sin(tau * 0.23 + j * 3));
          dc.setColor(lit(G.dim(0x9ab830, b), L), -1);
          dc.fillRectangle(x - 5, y, 15, 5);
          dc.fillRectangle(x, y - 5, 5, 15);
          dc.setColor(lit(0xe8ff8a, L), -1);
          dc.fillRectangle(x, y, 5, 5);
        }
      }
    } else {
      // ---------------- deep sea
      const dT = G.mix(0x08203a, 0x041222, nf), dB = G.mix(0x010409, 0x000000, nf);
      for (let i = 0; i < 13; i++) {
        dc.setColor(lit(G.mix(dT, dB, i / 12.0), L), -1);
        dc.fillRectangle(0, i * 32, 454, 32);
      }
      // marine snow
      for (let i = 0; i < 40; i += 2) {
        const y = sn(((SNOW[i + 1] * 1.3 + tau * 7) % 360) + 30);
        const x = sn(SNOW[i] + 8 * Math.sin(tau * 0.4 + i));
        dc.setColor(lit(i % 6 === 0 ? 0x5a7a90 : 0x2a3e4e, L), -1);
        dc.fillRectangle(x, y, 4, 4);
      }
      // sea floor rocks
      dc.setColor(lit(0x0c141c, L), -1);
      for (let x = 0; x < 454; x += 16) {
        const hh = 8 * Math.floor(2 + 1.6 * Math.sin(x * 0.023 + 0.6) + 0.8 * Math.sin(x * 0.07));
        dc.fillRectangle(x, SAND - hh, 16, 100);
      }
      dc.setColor(lit(0x18242e, L), -1);
      for (let x = 0; x < 454; x += 16) {
        const hh = 8 * Math.floor(2 + 1.6 * Math.sin(x * 0.023 + 0.6) + 0.8 * Math.sin(x * 0.07));
        dc.fillRectangle(x, SAND - hh, 16, 4);
      }
      // vent chimney with drifting smoke bubbles
      dc.setColor(lit(0x1a1e24, L), -1);
      dc.fillRectangle(84, SAND - 64, 20, 64);
      dc.fillRectangle(80, SAND - 40, 28, 40);
      dc.fillRectangle(76, SAND - 16, 36, 16);
      dc.setColor(lit(0xff6a2a, L * 0.7), -1);
      dc.fillRectangle(88, SAND - 64, 12, 4);
      const vb = lit(0x4a6a80, L);
      for (let j = 0; j < 5; j++) {
        const ph = (tau * 0.18 + j / 5.0) % 1.0;
        bubble(dc, sn(90 + Math.sin(tau * 1.6 + j * 2.3) * 8), sn(SAND - 72 - ph * 260), ph > 0.4, vb);
      }
      // sunken chest with a gold glint
      SPR.draw(dc, SP.CHEST_A, 160, SAND - 20, 4, [lit(0x050302, L), lit(0x2a1a10, L), lit(0x3a2614, L), lit(0x8a6a20, L), lit(0xffe080, L), 0], false);
      if (Math.sin(tau * 0.9) > 0.85) { dc.setColor(lit(0xfff4c0, L), -1); dc.fillRectangle(188, SAND - 12, 4, 4); }
      // tube worms (sway)
      for (let j = 0; j < 5; j++) {
        const x = 300 + j * 12, hgt = 16 + ((j * 13) % 5) * 6;
        const ox = sn(Math.sin(tau * 1.1 + j) * 4 + 2);
        dc.setColor(lit(0x8a8a80, L), -1);
        dc.fillRectangle(x, SAND - 8 - hgt, 4, hgt + 8);
        dc.setColor(lit(j % 2 === 0 ? 0xd8283a : 0x9a1a2a, L), -1);
        dc.fillRectangle(x - 4 + ox, SAND - 12 - hgt, 12, 4);
        dc.fillRectangle(x + ox, SAND - 16 - hgt, 4, 4);
      }
      // glowing sea pens
      for (let j = 0; j < 3; j++) {
        const bx = PENX[j], n = PENN[j];
        for (let k = 0; k < n; k++) {
          const ox = sn(Math.sin(tau * 0.9 + j * 2 - k * 0.35) * k * 0.8 + 2);
          dc.setColor(lit(k % 2 === 0 ? 0x2ad8c8 : 0x0e6a66, L * (0.5 + 0.5 * Math.abs(Math.sin(tau * 0.7 + k * 0.4 + j)))), -1);
          dc.fillRectangle(bx + ox, SAND - 8 - (k + 1) * 8, 4, 8);
          if (k > 1 && k % 2 === 0) dc.fillRectangle(bx + ox - 4, SAND - 4 - (k + 1) * 8, 12, 4);
        }
      }
      // lanternfish
      for (let j = 0; j < NS; j++) {
        const o = (j + 2) * 8;
        const w = 0.22 + FP[o] * 0.15;
        const x = 227 + 190 * Math.sin(w * tau + FP[o + 1] * 6.28);
        const y = 120 + FP[o + 2] * 220 + 10 * Math.sin(tau + j);
        const right = Math.cos(w * tau + FP[o + 1] * 6.28) >= 0;
        SPR.draw(dc, (Math.floor(tau * 6) + j) % 2 === 0 ? SP.LANT_A : SP.LANT_B, sn(x - 18), sn(y - 10), 4,
          [lit(0x14262e, L), lit(0x2a4a5a, L), lit(0x4a6a7a, L), lit(0x1a2a3a, L), 0, 0, lit(0x40fff0, L)], !right);
      }
      // jellyfish
      for (let j = 1; j < NF; j++) {
        const o = j * 8;
        const x = sn(110 + FP[o] * 230 + 16 * Math.sin(tau * 0.07 + j));
        const y = sn(120 + FP[o + 1] * 140 + 34 * Math.sin(tau * 0.19 + FP[o + 2] * 6));
        const pc = FP[o + 3] < 0.5 ? 0xff70d0 : 0x70b8ff;
        halo(dc, x + 18, y + 14, 30, lit(G.mix(dB, pc, 0.08), L));
        const pl = (Math.floor(tau / 0.7) + j) % 2;
        SPR.draw(dc, pl === 0 ? SP.JELLY_A : SP.JELLY_B, x, y, 4, [lit(pc, L), lit(G.dim(pc, 0.45), L), lit(G.dim(pc, 0.7), L), lit(G.mix(pc, 0xffffff, 0.3), L)], false);
      }
      // the anglerfish and its lantern
      {
        const q = path(0, tau, 3);
        let x = q[0], y = q[1], right = q[2] >= 0, s = 4;
        if (cu > 0) {
          x = G.lerp(x, 227, cu);
          y = G.lerp(y, 262, cu);
          s = cu > 0.75 ? 8 : cu > 0.4 ? 6 : 4;
          if (cu > 0.5) right = true;
        }
        const spr = Math.floor(tau * 2) % 2 === 0 ? SP.ANGLER_A : SP.ANGLER_B;
        const x0 = sn(x - (22 * s) / 2), y0 = sn(y - (16 * s) / 2);
        const lx = right ? x0 + 19.5 * s : x0 + 2.5 * s, ly = y0 + 3.5 * s;
        const pu = 1 + 0.12 * Math.sin(tau * 2.2);
        halo(dc, lx, ly, 52 * pu * s / 4, lit(G.mix(dB, 0x40fff0, 0.06), L));
        halo(dc, lx, ly, 34 * pu * s / 4, lit(G.mix(dB, 0x40fff0, 0.13), L));
        halo(dc, lx, ly, 18 * pu * s / 4, lit(G.mix(dB, 0x40fff0, 0.3), L));
        SPR.draw(dc, spr, x0, y0, s, [lit(0x050507, L), lit(0x3a2c3c, L), lit(0x56425a, L), lit(0x261c2a, L), lit(0x2e2434, L), lit(0xe8e0d0, L), lit(0xc0f0ff, L), lit(0x5a4a5e, L), lit(0xb8fff6, L)], !right);
      }
    }

    // ---------------- glass: time, date, slots
    const tp = G.clamp((p - 0.34) / 0.3, 0, 1);
    if (tp > 0) {
      const ts = G.timeStr(d);
      const shc = st === 1 ? G.mix(0x08304e, 0x000000, nf) : st === 2 ? 0x06140e : 0x000814;
      const tc = st === 3 ? 0xa8f8ff : 0xffffff;
      dc.setColor(shc, -1);
      F.px(dc, ts, 232, 92, 8, 1, 0);
      dc.setColor(G.mix(shc, tc, tp), -1);
      F.px(dc, ts, 228, 88, 8, 1, 0);
      const dtx = d.dowStr + " " + d.day + ". " + d.monStr;
      dc.setColor(G.dim(shc, tp), -1);
      F.px(dc, dtx, 230, 162, 2, 1, 0);
      dc.setColor(G.mix(0x000000, st === 3 ? 0x6ad8e8 : st === 2 ? 0xe8f0d8 : 0xe8f6ff, tp), -1);
      F.px(dc, dtx, 228, 160, 2, 1, 0);
      // slots on the sand / rim
      for (let k = 0; k < 3; k++) {
        const sl = d.slots[k];
        const x = 228 + (k - 1) * 76;
        if (st === 1) {
          dc.setColor(G.mix(0x000000, G.mix(0x8a6a3a, 0x7a8aa0, nf), tp * L), -1);
          F.px(dc, sl.lbl, x, 390, 2, 1, 0);
          dc.setColor(G.mix(0x000000, G.mix(0x4a2e12, 0xd8e4f4, nf), tp * L), -1);
          F.px(dc, sl.val, x, 406, 3, 1, 0);
        } else {
          dc.setColor(st === 2 ? 0x0a1a12 : 0x000000, -1);
          F.px(dc, sl.val, x + 2, 408, 3, 1, 0);
          dc.setColor(G.mix(0x000000, st === 2 ? 0xc8d8b8 : 0x3a8a98, tp), -1);
          F.px(dc, sl.lbl, x, 390, 2, 1, 0);
          dc.setColor(G.mix(0x000000, st === 2 ? 0xffffff : 0xa8f0ff, tp), -1);
          F.px(dc, sl.val, x, 406, 3, 1, 0);
        }
      }
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const ts = G.timeStr(d);
    const col = st === 3 ? 0x3a8a96 : st === 2 ? 0x7a8a70 : 0x6a96b0;
    dc.setColor(col, -1);
    F.px(dc, ts, 228 + o[0], 150 + o[1], 8, 1, 2);
    dc.setColor(G.dim(col, 0.8), -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 228 + o[0], 222 + o[1], 2, 1, 0);
    // one sleeping fish outline
    const spr = st === 3 ? SP.ANGLER_A : st === 2 ? SP.KOI_4A : SP.CLOWN_A;
    const w = spr[0] * 4;
    const ksc = st === 2 ? 5 : 4;
    const fc = G.dim(col, 0.7);
    SPR.draw(dc, spr, sn(227 - (spr[0] * ksc) / 2) + o[0], 282 + o[1] - (st === 2 ? 20 : 0), ksc, st === 3 ? [fc, -1, -1, -1, -1, -1, -1, fc, 0x40a8a0] : st === 2 ? [fc, -1, -1, G.dim(fc, 0.6), -1, -1] : [fc, -1, -1, -1, -1, -1, fc], st === 1);
    // bubbles
    dc.setColor(G.dim(col, 0.6), -1);
    dc.fillRectangle(sn(227 + w / 2) + o[0] - (st === 2 ? 60 : 0), 262 + o[1], 4, 4);
    dc.fillRectangle(sn(227 + w / 2) + o[0] + 8 - (st === 2 ? 60 : 0), 244 + o[1], 4, 4);
  },
};
