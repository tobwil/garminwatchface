// RACE — "Rennfahrer": a race that lasts the week, seen from the start-finish straight. The intensity
// minutes are the laps (goal = 15 laps); the circuit map and the timing screen with the three data
// slots hang above the grandstand. The story has four chapters: racing (every wrist raise he
// overtakes a rival), a pit stop when the Body Battery runs low (the car rolls into the box and the
// crew changes tyres), the chequered flag at the weekly goal, and parc fermé at night with the car
// under its cover. Styles: 1 Grand Prix, 2 Rallye, 3 Gameboy. Mirrors watch/source/faces/Race.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/race.js";

const SP = encodeAll(S);
const LAPS = 15;
const GROUND = 352; // where our car's wheels touch the track
const CX = 140; // our car's x
// circuit map (closed loop) for the minimap
const TRK = [76, 150, 78, 118, 104, 106, 144, 114, 172, 104, 186, 124, 162, 138, 182, 162, 128, 168, 96, 162];
const TCUM = [0];
for (let i = 0; i < TRK.length; i += 2) {
  const j = (i + 2) % TRK.length;
  const dx = TRK[j] - TRK[i], dy = TRK[j + 1] - TRK[i + 1];
  TCUM.push(TCUM[TCUM.length - 1] + Math.sqrt(dx * dx + dy * dy));
}
const TLEN = TCUM[TCUM.length - 1];
const CROWD = [0xff5a5a, 0xffd23a, 0x5ab4ff, 0xffffff, 0x5ae08a, 0xff9a3a];

// point on the circuit at fraction f: [x, y]
function onTrack(f) {
  const L = (f - Math.floor(f)) * TLEN;
  let i = 1;
  while (i < TCUM.length - 1 && TCUM[i] < L) i++;
  const t = (L - TCUM[i - 1]) / Math.max(1, TCUM[i] - TCUM[i - 1]);
  const a = (i - 1) * 2, b = (i * 2) % TRK.length;
  return [TRK[a] + (TRK[b] - TRK[a]) * t, TRK[a + 1] + (TRK[b + 1] - TRK[a + 1]) * t];
}

// chapter: 0 racing, 1 pit stop, 2 chequered flag, 3 parc fermé
function chapter(d) {
  if (d.mins < 360 || d.mins >= 1320) return 3;
  if (d.imGoal > 0 && d.imWeek >= d.imGoal) return 2;
  if (d.bb >= 0 && d.bb < 25) return 1;
  return 0;
}

// [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, roof, stand, banner,
//  banner text, wall, wall top, track, streak, kerb a, kerb b, grass, grass dark, text, text dim, board,
//  map line, map dot, body, body dark, number, black, helmet, visor, rim, overall, skin, crew helmet,
//  cover, cover fold, star]
function pal(st, acc) {
  if (st === 2) return [0x4a8ad0, 0xb8dcf0, 0x5a4a8a, 0xff9a6a, 0x0a1030, 0x1a2450, 0x5a3a24, 0x7a5a3a, acc, 0xffffff,
    0x8a7a62, 0xb0a084, 0x8a6a48, 0xa88a62, 0xd8b04a, 0xa8803a, 0x2a5a2a, 0x1e421e, 0xffffff, 0xc8d8b8, 0x101010,
    0xffffff, acc, acc, G.mix(acc, 0, 0.4), 0xffffff, 0x1a1a1a, 0xffffff, 0x3ac8ff, 0xb0b0b8, 0x2a4a8a, 0xf2c08a, 0xffffff,
    0x6a7a5a, 0x4a5a3a, 0xffffff];
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [c, e, b, c, a, a, a, b, a, e, c, e, b, c, a, e, c, b, a, b, a, a, e, a, a, e, a, e, c, c, a, e, e, b, a, e];
  }
  return [0x2a72c8, 0x9ad4ff, 0x46388a, 0xff8a6a, 0x040a1e, 0x10204a, 0x2a2a34, 0x4a4a5a, acc, 0xffffff,
    0xc8c8d0, 0xf0f0f4, 0x3a3a42, 0x56565e, 0xe03a2a, 0xffffff, 0x3a9a3a, 0x2a7a2a, 0xffffff, 0xd8e8d8, 0x101014,
    0xffffff, acc, acc, G.mix(acc, 0, 0.4), 0xffffff, 0x141414, 0xffd23a, 0x3ac8ff, 0xb0b0b8, acc, 0xf2c08a, 0xffffff,
    0x8a8a96, 0x5a5a66, 0xffffff];
}

// the car (with its two wheels) at x; ground = where the wheels touch
function car(dc, P, x, ground, wf) {
  const y = ground - 48;
  SPR.draw(dc, SP.CAR, x, y, 4, [-1, P[23], P[24], P[25], P[26], P[27], P[28]], false);
  const w = wf ? SP.WHEEL_B : SP.WHEEL_A;
  const wp = [-1, -1, -1, -1, P[26], -1, -1, P[29]];
  SPR.draw(dc, w, x + 8, y + 12, 4, wp, false);
  SPR.draw(dc, w, x + 116, y + 12, 4, wp, false);
}

function laps(d) {
  const g = d.imGoal > 0 ? d.imGoal : 150;
  return G.clamp((d.imWeek > 0 ? d.imWeek : 0) / g * LAPS, 0, LAPS);
}

export default {
  fps: 10,

  // static layer: sky, grandstand, wall, track, map, timing screen, texts (and the parked car);
  // the cars, the crew, the kerbs, the map dot, the flag and the confetti move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const ch = chapter(d);
    const L = laps(d);
    const lap = Math.min(LAPS, Math.floor(L) + 1);
    const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);

    if (S) {
      // ---- sky follows the sun
      const k = el > 6 ? 0 : el > -6 ? 1 : 2;
      for (let i = 0; i < 6; i++) {
        dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 5), -1);
        dc.fillRectangle(0, i * 32, 454, 32);
      }
      if (k === 2) {
        dc.setColor(P[35], -1);
        for (let i = 0; i < 18; i++) dc.fillRectangle(40 + ((i * 89 + 31) % 374), 14 + ((i * 41 + 9) % 150), 2, 2);
      }

      // ---- grandstand with the crowd (empty at night), floodlights after dark
      dc.setColor(P[7], -1);
      dc.fillRectangle(0, 192, 454, 56);
      for (let r = 0; r < 6; r++) {
        for (let x = (r % 2) * 4; x < 454; x += 8) {
          const s = G.rnd(r * 977 + x * 13);
          if (ch === 3 || s % 4 === 0) {
            dc.setColor(G.mix(P[7], P[6], 0.5), -1);
            dc.fillRectangle(x, 200 + r * 8, 6, 3);
          } else {
            dc.setColor(st === 3 ? (s % 2 === 0 ? P[9] : P[10]) : G.mix(CROWD[s % 6], P[7], 0.25), -1);
            dc.fillRectangle(x + 1, 197 + r * 8, 4, 5);
          }
        }
      }
      dc.setColor(P[6], -1);
      dc.fillRectangle(0, 184, 454, 8);
      for (let x = 40; x < 454; x += 110) dc.fillRectangle(x, 192, 6, 56);
      if (k === 2 && ch !== 3) {
        for (let x = 92; x < 454; x += 220) {
          dc.fillRectangle(x, 150, 4, 34);
          dc.setColor(0xfff6d0, -1);
          dc.fillRectangle(x - 12, 142, 28, 8);
          dc.setColor(P[6], -1);
        }
      }
      dc.setColor(P[8], -1);
      dc.fillRectangle(0, 246, 454, 18);
      dc.setColor(P[9], -1);
      F.px(dc, "GRAND PRIX", 227, 249, 2, 1, 0);

      // ---- pit wall, track, grass
      dc.setColor(P[10], -1);
      dc.fillRectangle(0, 264, 454, 14);
      dc.setColor(P[11], -1);
      dc.fillRectangle(0, 264, 454, 3);
      dc.setColor(P[12], -1);
      dc.fillRectangle(0, 278, 454, 94);
      dc.setColor(P[13], -1);
      dc.fillRectangle(0, 322, 454, 2); // the racing line between the lanes
      dc.setColor(P[16], -1);
      dc.fillRectangle(0, 384, 454, 70);
      dc.setColor(P[17], -1);
      for (let x = 0; x < 454; x += 16) dc.fillRectangle(x + ((x / 16) % 2) * 6, 392 + ((x * 7) % 40), 4, 4);

      // ---- circuit map
      for (let i = 0; i < 60; i++) {
        const q = onTrack(i / 60);
        dc.setColor(P[21], -1);
        dc.fillRectangle(Math.floor(q[0] / 2) * 2, Math.floor(q[1] / 2) * 2, 3, 3);
      }
      dc.setColor(P[22], -1);
      dc.fillRectangle(74, 136, 8, 3); // start / finish

      // ---- timing screen with the data slots
      dc.setColor(P[20], -1);
      dc.fillRectangle(246, 100, 152, 74);
      dc.setColor(P[8], -1);
      dc.fillRectangle(246, 100, 4, 74);
      for (let i = 0; i < 3; i++) {
        const s = d.slots[i];
        if (!s.lbl) continue;
        const sp = G.stag(p, i, 0.1, 0.4);
        if (sp <= 0) continue;
        let lb = s.lbl;
        while (lb.length > 2 && F.pxW(lb, 2) > 124 - F.pxW(s.val, 2)) lb = lb.substring(0, lb.length - 1);
        dc.setColor(P[22], -1);
        F.px(dc, lb, 258, 108 + i * 22, 2, 0, 0);
        dc.setColor(0xffffff, -1);
        F.px(dc, s.val, 390, 108 + i * 22, 2, 2, 0);
      }

      // ---- time, date, chapter
      dc.setColor(0x000000, -1);
      F.px(dc, G.timeStr(d), 229, 32, 5, 1, 0);
      dc.setColor(P[18], -1);
      F.px(dc, G.timeStr(d), 227, 30, 5, 1, 0);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 74, 2, 1, 0);
      const cap = ["RUNDE " + lap + "/" + LAPS, "BOXENSTOPP", "ZIELFLAGGE!", "PARC FERME"][ch];
      const sub = ch === 1 ? "BODY BATTERY " + d.bb + "%" : ch === 3 ? "RUNDE " + lap + " MORGEN" : Math.max(0, d.imWeek) + "/" + (d.imGoal > 0 ? d.imGoal : 150) + " MIN";
      F.px(dc, cap, 227, 392, 2, 1, 0);
      dc.setColor(P[19], -1);
      F.px(dc, sub, 227, 414, 2, 1, 0);

      // ---- parc fermé: the car rests under its cover
      if (ch === 3) {
        car(dc, P, CX, GROUND, false);
        SPR.draw(dc, SP.COVER, CX, GROUND - 48, 4, [-1, P[33], P[34]], false);
      }
    }

    if (!M) return;
    // ---- kerbs and asphalt streaks run past (fast in the race, slow on the lap of honour)
    const v = ch === 0 ? 0.2 : ch === 2 ? 0.06 : ch === 1 && p < 0.5 ? 0.12 * (1 - p * 2) : 0;
    const off = Math.floor(tt * v) % 64;
    for (let x = -off; x < 454; x += 64) {
      dc.setColor(P[14], -1);
      dc.fillRectangle(x, 372, 32, 12);
      dc.setColor(P[15], -1);
      dc.fillRectangle(x + 32, 372, 32, 12);
    }
    if (v > 0) {
      dc.setColor(P[13], -1);
      for (let i = 0; i < 5; i++) {
        const sx = ((i * 173 + 1000) - Math.floor(tt * v * 1.5) % 520 + 520) % 520 - 40;
        dc.fillRectangle(sx, 286 + ((i * 37) % 80), 36, 2);
      }
    }
    // ---- the dot on the circuit map
    const mq = onTrack(ch === 0 ? (live ? tt / 7000 : L) : 0);
    dc.setColor(P[23], -1);
    dc.fillRectangle(Math.round(mq[0]) - 3, Math.round(mq[1]) - 3, 7, 7);

    const wf = live && Math.floor(tt / (ch === 2 ? 180 : 60)) % 2 === 1;
    if (ch === 0) {
      // overtakes a rival on every wrist raise
      if (p < 1) {
        const rx = Math.round(G.lerp(250, -200, G.easeInOut(p)));
        const R = P.slice();
        R[23] = st === 3 ? P[24] : 0x2a5ad8;
        R[24] = st === 3 ? P[26] : 0x1a3a8a;
        R[27] = st === 3 ? P[25] : 0xffffff;
        car(dc, R, rx, 318, Math.floor(a.t / 60) % 2 === 1);
      }
      car(dc, P, CX, GROUND, wf);
      if (p > 0.6 && p < 1) {
        dc.setColor(P[18], -1);
        F.px(dc, "ÜBERHOLT!", 330, 288, 2, 1, 0);
      }
    } else if (ch === 1) {
      // rolls into the box, then the crew gets to work
      const x = Math.round(G.lerp(-180, CX, G.ease(G.clamp(p * 2, 0, 1))));
      car(dc, P, x, GROUND, p < 0.5 && Math.floor(a.t / 90) % 2 === 1);
      if (p >= 0.5) {
        const crew = [-1, P[30], P[31], P[32], P[26], P[28]];
        SPR.draw(dc, SP.KNEEL, CX - 20, GROUND - 56, 4, crew, false);
        SPR.draw(dc, SP.KNEEL, CX + 150, GROUND - 56, 4, crew, true);
        SPR.draw(dc, SP.STAND, CX + 200, GROUND - 60, 4, crew, true);
        // lollipop
        dc.setColor(P[26], -1);
        dc.fillRectangle(CX + 196, GROUND - 92, 4, 40);
        dc.setColor(0xe03a2a, -1);
        dc.fillCircle(CX + 198, GROUND - 100, 12);
        // sparks from the wheel guns
        if (!live || Math.floor(tt / 120) % 2 === 0) {
          dc.setColor(0xffd23a, -1);
          dc.fillRectangle(CX + 22, GROUND - 22, 4, 4);
          dc.fillRectangle(CX + 140, GROUND - 26, 4, 4);
        }
      }
    } else if (ch === 2) {
      // lap of honour under the chequered flag, confetti
      car(dc, P, CX, GROUND, wf);
      SPR.draw(dc, SP.WAVE, 330, 208, 4, [-1, 0xffffff, P[31], P[32], P[26], P[28]], false);
      const wv = live ? Math.floor(tt / 160) % 2 : 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          dc.setColor((r + c) % 2 === 0 ? 0xffffff : 0x141414, -1);
          dc.fillRectangle(370 + c * 8, 190 + r * 8 + (c % 2 === wv ? 2 : 0), 8, 8);
        }
      }
      dc.setColor(P[26], -1);
      dc.fillRectangle(368, 186, 2, 34);
      if (live || p < 1) {
        for (let i = 0; i < 22; i++) {
          const s = G.rnd(i * 71 + 5);
          const cy = (s % 300 + Math.floor(tt * (0.05 + (s % 5) * 0.01))) % 320 + 100;
          dc.setColor(st === 3 ? P[9] : CROWD[s % 6], -1);
          dc.fillRectangle((s >> 3) % 420 + 16, cy, 6, 4);
        }
      }
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const c = st === 3 ? 0x306230 : 0x4a4a52;
    SPR.draw(dc, SP.CAR, CX + o[0], GROUND - 48 + o[1], 4, [-1, c, c, -1, c, -1, -1], false);
    dc.setColor(c, -1);
    dc.fillRectangle(o[0], 372 + o[1], 454, 2);
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 30 + o[1], 5, 1, 1);
    dc.setColor(st === 3 ? 0x306230 : 0x6a6a72, -1);
    F.px(dc, "RUNDE " + Math.min(LAPS, Math.floor(laps(d)) + 1) + "/" + LAPS, 227 + o[0], 392 + o[1], 2, 1, 0);
  },
};
