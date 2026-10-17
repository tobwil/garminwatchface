// CLIMB — "Bergsteiger": an expedition from base camp (5,364 m) to the summit (8,848 m), told in two
// planes. Far away the massif with the route, the camps and a blinking "you are here" mark that the
// floors climbed today carry upwards; close up the climber on a rock ledge, swinging the ice axe.
// At night he sleeps in the tent (head torch on), at the floors goal he stands on the summit ridge
// with the flag. The sky follows the real sun. Every wrist raise he climbs up onto the ledge.
// Styles: 1 Fels, 2 Eis, 3 Gameboy. Mirrors watch/source/faces/Climb.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/climb.js";

const SP = encodeAll(S);
// peaks of the massif: x, y, slope left, slope right (the main summit first)
const PK = [318, 108, 1.05, 1.25, 190, 176, 1.1, 1.2, 410, 168, 1.3, 0.9, 70, 214, 1.0, 1.1];
const BASE = 340; // foot of the massif (hidden by the valley)
const SNOWY = 196; // snow line
// route on the main face (waypoints) and the camps along it
const WP = [266, 330, 346, 300, 278, 268, 338, 236, 292, 204, 330, 172, 304, 140, 318, 112];
const CAMPF = [0, 0.3, 0.55, 0.8];
const SEG = ["BASISLAGER", "GLETSCHER", "LAGER 1", "STEILWAND", "LAGER 2", "TODESZONE", "LAGER 3", "GIPFELSTURM"];
const NAMES = ["BASISLAGER", "LAGER 1", "LAGER 2", "LAGER 3"];
const LEDGE = [0, 360, 60, 350, 130, 354, 190, 364, 222, 380, 232, 454, 0, 454];
const CREST = [0, 352, 70, 330, 120, 316, 170, 330, 240, 372, 250, 454, 0, 454];

const CUM = [0];
for (let i = 2; i < WP.length; i += 2) {
  const dx = WP[i] - WP[i - 2], dy = WP[i + 1] - WP[i - 1];
  CUM.push(CUM[CUM.length - 1] + Math.sqrt(dx * dx + dy * dy));
}
const TOT = CUM[CUM.length - 1];

// point on the route at fraction f: [x, y]
function at(f) {
  const L = G.clamp(f, 0, 1) * TOT;
  let i = 1;
  while (i < CUM.length - 1 && CUM[i] < L) i++;
  const t = (L - CUM[i - 1]) / Math.max(1, CUM[i] - CUM[i - 1]);
  return [WP[(i - 1) * 2] + (WP[i * 2] - WP[(i - 1) * 2]) * t, WP[(i - 1) * 2 + 1] + (WP[i * 2 + 1] - WP[(i - 1) * 2 + 1]) * t];
}

// top of the massif at column x and the index of the peak that forms it
function ridge(x) {
  let best = 999, bi = 0;
  for (let k = 0; k < PK.length; k += 4) {
    const dx = x - PK[k];
    const y = PK[k + 1] + (dx < 0 ? -dx * PK[k + 2] : dx * PK[k + 3]);
    if (y < best) { best = y; bi = k; }
  }
  return [best, bi];
}

function poly(dc, a) {
  const pts = [];
  for (let i = 0; i < a.length; i += 2) pts.push([a[i], a[i + 1]]);
  dc.fillPolygon(pts);
}

// [rock lit, rock shade, snow lit, snow shade, valley, ledge, ledge top, route, sky top day, sky low day,
//  sky top dusk, sky low dusk, sky top night, sky low night, text, cloud, tent, tent dark, glow,
//  jacket, skin, pack, trousers, boots, hat, goggles, flag, star]
function pal(st, acc) {
  if (st === 2) return [0x7a9ab8, 0x46688a, 0xffffff, 0xb4d4ee, 0x16283a, 0x223a52, 0x8ab4d8, 0xffffff, 0x2a72c8, 0x9ad4ff,
    0x46388a, 0xff8ac0, 0x040a1e, 0x10204a, 0xffffff, 0xeaf6ff, acc, G.mix(acc, 0, 0.4), 0xffe08a, acc, 0xf2c08a, 0x2a3a5a,
    0x2a2a3a, 0x141414, 0xffffff, 0x3ac8ff, 0xff3a3a, 0xdce8ff];
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [b, a, e, c, a, a, b, e, c, e, b, c, a, a, e, e, a, a, e, a, e, b, a, a, e, c, a, e];
  }
  return [0x8a7a6a, 0x564a40, 0xf4f4f8, 0xb8c4d8, 0x2a2622, 0x3a332c, 0x6a5e50, 0xffd870, 0x3a8ad8, 0x8ac8ff,
    0x6a4a9a, 0xff9a6a, 0x0a1030, 0x1a2450, 0xffffff, 0xffffff, acc, G.mix(acc, 0, 0.4), 0xffe08a, acc, 0xf2c08a, 0x3a4a6a,
    0x2a2a3a, 0x1a1a1a, 0xffd23a, 0x3ac8ff, 0xff3a3a, 0xffffff];
}

function prog(d) {
  const g = d.floorsGoal > 0 ? d.floorsGoal : 10;
  const v = d.floors > 0 ? d.floors : 0;
  return G.clamp(v / g, 0, 1);
}

export default {
  fps: 8,

  // static layer: sky, massif, route, camps, foreground rock / tent, texts; the climber, the
  // position mark, the head torch, the flag and the clouds move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const f = prog(d);
    const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const night = el < -6;
    const top = f >= 1;
    let last = 0;
    for (let c = 0; c < 4; c++) if (f >= CAMPF[c]) last = c;

    if (S) {
      // ---- sky: day / dusk / night, sun or stars
      const k = el > 6 ? 0 : el > -6 ? 1 : 2;
      const st0 = P[8 + k * 2], sl = P[9 + k * 2];
      for (let i = 0; i < 6; i++) {
        dc.setColor(G.mix(st0, sl, i / 5), -1);
        dc.fillRectangle(0, i * 60, 454, 60);
      }
      if (night) {
        dc.setColor(P[27], -1);
        for (let i = 0; i < 26; i++) dc.fillRectangle(30 + ((i * 97 + 13) % 394), 20 + ((i * 53 + 7) % 170), 2, 2);
      } else if (el > -6) {
        const sy = 200 - Math.round(G.clamp(el, -6, 40) * 3);
        dc.setColor(G.mix(sl, 0xfff2b0, 0.5), -1);
        dc.fillCircle(96, sy, 16);
        dc.setColor(0xfff6d0, -1);
        dc.fillCircle(96, sy, 11);
      }

      // ---- the massif: 4 px columns, lit left of each summit, snow caps above the snow line,
      // the foot fading into the valley haze
      for (let x = 0; x < 454; x += 4) {
        const r = ridge(x + 2);
        const y0 = Math.floor(r[0] / 4) * 4;
        if (y0 >= BASE) continue;
        const lit = x + 2 <= PK[r[1]];
        let sn = y0;
        if (y0 < SNOWY - 8) {
          sn = SNOWY + [0, 4, 8, 4, 0, -4, -8, -4][(x / 4) % 8];
          dc.setColor(P[lit ? 2 : 3], -1);
          dc.fillRectangle(x, y0, 4, sn - y0);
        }
        dc.setColor(P[lit ? 0 : 1], -1);
        dc.fillRectangle(x, sn, 4, 290 - sn);
        dc.setColor(G.mix(P[lit ? 0 : 1], P[4], 0.45), -1);
        dc.fillRectangle(x, 290, 4, BASE - 290);
      }
      dc.setColor(P[4], -1);
      dc.fillRectangle(0, BASE - 12, 454, 454 - BASE + 12);

      // ---- route (done part solid) and camps
      for (let i = 0; i <= 50; i++) {
        const t = i / 50;
        if (t > f && i % 2 === 1) continue;
        const q = at(t);
        dc.setColor(t <= f ? P[7] : G.mix(P[1], P[7], 0.35), -1);
        dc.fillRectangle(Math.floor(q[0] / 2) * 2, Math.floor(q[1] / 2) * 2, 2, 2);
      }
      for (let c = 0; c < 4; c++) {
        const q = at(CAMPF[c]);
        SPR.draw(dc, SP.TENT, Math.round(q[0]) + 6, Math.round(q[1]) - 18, 2, [-1, P[16], P[17], night && c === last ? P[18] : P[17], P[1]], false);
      }
      if (top) {
        dc.setColor(P[14], -1);
        dc.fillRectangle(PK[0] - 1, PK[1] - 22, 2, 22);
        dc.setColor(P[26], -1);
        dc.fillRectangle(PK[0] + 1, PK[1] - 22, 10, 6);
      }

      // ---- foreground: rock ledge, or the summit ridge at the goal; the tent at night
      dc.setColor(top ? P[3] : P[5], -1);
      poly(dc, top ? CREST : LEDGE);
      dc.setColor(top ? P[2] : P[6], -1);
      const fg = top ? CREST : LEDGE;
      for (let i = 0; i < 8; i += 2) dc.fillRectangle(fg[i], fg[i + 1] - 2, fg[i + 2] - fg[i], 4);
      if (night && !top) SPR.draw(dc, SP.TENT, 50, 310, 5, [-1, P[16], P[17], P[18], P[1]], false);

      // ---- time, date, story caption
      dc.setColor(0x000000, -1);
      F.px(dc, G.timeStr(d), 229, 34, 5, 1, 0);
      dc.setColor(P[14], -1);
      F.px(dc, G.timeStr(d), 227, 32, 5, 1, 0);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 78, 2, 1, 0);
      const cap = top ? "GIPFEL!" : night ? NAMES[last] : SEG[Math.min(7, Math.floor(f * 8))];
      F.px(dc, cap, 300, 344, 2, 1, 0);
      F.px(dc, G.num(Math.round(5364 + f * 3484)) + " M", 300, 362, 3, 1, 0);
      dc.setColor(G.mix(P[14], P[4], 0.4), -1);
      F.px(dc, Math.max(0, d.floors) + "/" + (d.floorsGoal > 0 ? d.floorsGoal : 10) + " ETAGEN", 300, 390, 2, 1, 0);
    }

    if (!M) return;
    // ---- clouds drift past the massif
    dc.setColor(night ? G.mix(P[15], P[12], 0.75) : P[15], -1);
    for (let i = 0; i < 2; i++) {
      const cx = Math.floor(((i * 211 + tt / (45 + i * 30)) % 560) - 80);
      const cy = 150 + i * 64;
      dc.fillRectangle(cx, cy, 56, 8);
      dc.fillRectangle(cx + 12, cy - 8, 28, 8);
    }
    // ---- "you are here" on the route
    const q = top ? [PK[0], PK[1]] : at(f);
    if (!live || Math.floor(tt / 400) % 2 === 0) {
      dc.setColor(P[26], -1);
      dc.fillRectangle(Math.round(q[0]) - 3, Math.round(q[1]) - 3, 6, 6);
    }
    // ---- the climber close up
    const ppal = [-1, P[19], P[20], P[21], P[22], P[23], P[24], P[25]];
    if (top) {
      const fy = Math.round((1 - G.spring(G.clamp((p - 0.3) / 0.6, 0, 1))) * 60);
      SPR.draw(dc, SP.FLAG, 150, 316 - 48 + fy, 4, [-1, P[14], P[26]], live && Math.floor(tt / 300) % 2 === 1);
      SPR.draw(dc, SP.CHEER, 84, 316 - 80, 5, ppal, false);
    } else if (night) {
      // asleep in the tent: Zzz rising from the door
      dc.setColor(P[14], -1);
      for (let k = 0; k < 3; k++) {
        const ph = (Math.floor(tt + k * 400) % 1200) / 1200;
        if (!live && k > 0) break;
        F.px(dc, "Z", 128 + Math.round(ph * 30) + k * 4, 300 - Math.round(ph * 60), 2 + (ph > 0.5 ? 1 : 0), 1, 0);
      }
    } else {
      // climbs up onto the ledge on every raise, then works with the ice axe
      const cy = 272 + Math.round((1 - G.ease(G.clamp(p / 0.8, 0, 1))) * 190);
      const fr = p < 1 ? Math.floor(a.t / 140) % 2 : Math.floor(tt / 500) % 2;
      SPR.draw(dc, fr === 1 ? SP.UP_B : SP.UP_A, 96, cy, 5, ppal, false);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const c = st === 3 ? 0x306230 : 0x4a4a52;
    dc.setColor(c, -1);
    for (let x = 24; x < 432; x += 8) {
      const r = ridge(x + 2);
      if (r[0] < BASE) dc.fillRectangle(x + o[0], Math.floor(r[0]) + o[1], 3, 3);
    }
    const f = prog(d);
    const q = f >= 1 ? [PK[0], PK[1]] : at(f);
    dc.setColor(G.dim(d.accent, 0.6), -1);
    dc.fillRectangle(Math.round(q[0]) - 3 + o[0], Math.round(q[1]) - 3 + o[1], 6, 6);
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 32 + o[1], 5, 1, 1);
  },
};
