// MOON — "Mondflug": every week is a mission to the moon. On Monday the rocket stands on the pad,
// the weekly goal (climbed metres, bike km or training days, see d.src) carries it along the
// transfer orbit; at 100 % it has landed and planted the flag. Every wrist raise is a short
// episode: countdown, ignition, and the rocket covers the last stretch of its journey. A caption
// names the mission phase. The moon shows its real phase. Styles: 1 Retro, 2 Blaupause, 3 Gameboy.
// Mirrors watch/source/faces/Moon.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/moon.js";

const SP = encodeAll(S);
const MX = 316, MY = 132, MR = 48;           // moon
const EY = 652, ER = 300;                    // earth (centre below the screen)
const P0X = 150, P0Y = 340, P1X = 60, P1Y = 140, P2X = 300, P2Y = 92; // transfer orbit (bezier)
// continents on the earth: x, y, w, h
const LAND = [96, 372, 48, 12, 84, 384, 72, 16, 112, 400, 40, 24, 236, 364, 56, 12, 228, 376, 88, 20, 260, 396, 64, 28, 336, 380, 36, 16];
const PHASES = ["STARTRAMPE", "AUFSTIEG", "ERDUMLAUFBAHN", "TRANSFER", "ANFLUG", "LANDUNG", "AUF DEM MOND!"];

// [bg, star, ocean, land, atmo, moon, moon shade, hull, window, fins, hull shade, fl1, fl2, fl3, text, dim, path, tower]
function pal(st, acc) {
  if (st === 2) return [0x103a7a, 0x6a8ac8, 0x1d4f9a, 0x2f68b8, 0x5a8ad0, 0xc8d8f0, 0x183a70, 0xffffff, 0x103a7a, 0xd8e4ff, 0xa8c0e8,
    0xffffff, 0xc8d8ff, 0x8aa8e0, 0xffffff, 0xa8c0e8, 0x8aa8e0, 0xc8d8f0];
  if (st === 3) return [0x0f380f, 0x8bac0f, 0x306230, 0x8bac0f, 0x8bac0f, 0x9bbc0f, 0x306230, 0x9bbc0f, 0x0f380f, 0x8bac0f, 0x8bac0f,
    0x9bbc0f, 0x8bac0f, 0x306230, 0x9bbc0f, 0x8bac0f, 0x306230, 0x8bac0f];
  return [-1, 0xffffff, 0x1f5fbf, 0x3aa848, 0x6ab8ff, 0xd8d4c8, 0x3a3a40, 0xf0f0f0, 0x3ac8ff, acc, 0xb0b0b8,
    0xfff2a0, 0xffb02a, 0xff4a2a, 0xffffff, 0x8a8a9a, 0x5a5a6a, 0x8a8a8a];
}

// weekly progress: [value, goal, label]
function stage(d) {
  if (d.src === 0) {
    const v = d.floorsWeek > 0 ? d.floorsWeek * 3 : 0;
    return [v, 1071, "HM " + v + "/1071"];
  }
  if (d.src === 2) {
    const v = d.trainDays > 0 ? d.trainDays : 0;
    const g = d.dayGoal > 0 ? d.dayGoal : 4;
    return [v, g, "TAGE " + v + "/" + g];
  }
  const km = d.wkBike > 0 ? Math.floor(d.wkBike / 1000) : 0;
  const g = d.cfg.bikeGoal > 0 ? d.cfg.bikeGoal : 150;
  return [km, g, "KM " + km + "/" + g];
}

function bx(t) { return (1 - t) * (1 - t) * P0X + 2 * t * (1 - t) * P1X + t * t * P2X; }
function by(t) { return (1 - t) * (1 - t) * P0Y + 2 * t * (1 - t) * P1Y + t * t * P2Y; }

// filled pixel disc (4 px rows) centred at cx, cy
function disc(dc, cx, cy, r) {
  for (let y = -r; y < r; y += 4) {
    const yy = y + 2;
    const hw = Math.floor(Math.sqrt(r * r - yy * yy) / 4) * 4;
    if (hw > 0) dc.fillRectangle(cx - hw, cy + y, 2 * hw, 4);
  }
}

// lit part of the moon for phase k (0 new, .5 full)
function moonLit(dc, k, r, ox, oy) {
  for (let y = -r; y < r; y += 4) {
    const yy = y + 2;
    const hw = Math.floor(Math.sqrt(r * r - yy * yy) / 4) * 4;
    if (hw <= 0) continue;
    let x0, x1;
    if (k < 0.5) { x0 = Math.round((hw * Math.cos(k * 2 * Math.PI)) / 4) * 4; x1 = hw; }
    else { x0 = -hw; x1 = Math.round((hw * Math.cos((k - 0.5) * 2 * Math.PI)) / 4) * 4; }
    if (x1 > x0) dc.fillRectangle(MX + x0 + ox, MY + y + oy, x1 - x0, 4);
  }
}

function phaseIdx(f) {
  if (f >= 1) return 6;
  if (f < 0.02) return 0;
  if (f < 0.15) return 1;
  if (f < 0.35) return 2;
  if (f < 0.7) return 3;
  if (f < 0.93) return 4;
  return 5;
}

export default {
  fps: 12,

  // static layer: stars, moon, earth, tower, orbit, captions; the rocket's episode moves
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    if (P[0] !== -1 && S) {
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 0, 454, 454);
    }
    const sg = stage(d);
    const f = sg[1] > 0 ? G.clamp(sg[0] / sg[1], 0, 1) : 0;

    if (S) {
      // ---- stars (twinkle while live)
      let seed = 4242;
      for (let i = 0; i < 34; i++) {
        seed = G.rnd(seed);
        const sx = 40 + (seed % 374);
        seed = G.rnd(seed);
        const sy = 30 + (seed % 300);
        if (live && (Math.floor(tt / 260) + i * 5) % 17 === 0) continue;
        dc.setColor(i % 4 === 0 ? P[1] : G.mix(P[0] === -1 ? 0 : P[0], P[1], 0.55), -1);
        dc.fillRectangle(Math.floor(sx / 4) * 4, Math.floor(sy / 4) * 4, i % 6 === 0 ? 4 : 2, i % 6 === 0 ? 4 : 2);
      }

      // ---- moon (real phase)
      dc.setColor(P[6], -1);
      disc(dc, MX, MY, MR);
      dc.setColor(P[5], -1);
      moonLit(dc, d.moon >= 0 ? d.moon : 0.5, MR, 0, 0);

      // ---- earth with atmosphere and continents
      dc.setColor(P[4], -1);
      for (let y = EY - ER - 6; y < 454; y += 4) {
        const hw = Math.floor(Math.sqrt((ER + 6) * (ER + 6) - (y + 2 - EY) * (y + 2 - EY)) / 4) * 4;
        dc.fillRectangle(227 - hw, y, 2 * hw, 4);
      }
      dc.setColor(P[2], -1);
      for (let y = EY - ER; y < 454; y += 4) {
        const hw = Math.floor(Math.sqrt(ER * ER - (y + 2 - EY) * (y + 2 - EY)) / 4) * 4;
        dc.fillRectangle(227 - hw, y, 2 * hw, 4);
      }
      dc.setColor(P[3], -1);
      for (let i = 0; i < LAND.length; i += 4) dc.fillRectangle(LAND[i], LAND[i + 1], LAND[i + 2], LAND[i + 3]);

      // ---- launch tower
      dc.setColor(P[17], -1);
      SPR.draw(dc, SP.TOWER, 168, 292, 3, [-1, P[17]], false);
      dc.fillRectangle(128, 358, 64, 4);

      // ---- transfer orbit: flown part solid, rest faint
      for (let i = 1; i < 30; i++) {
        const t = i / 30;
        dc.setColor(t <= f ? P[15] : P[16], -1);
        if (t <= f || i % 2 === 0) dc.fillRectangle(Math.floor(bx(t) / 4) * 4, Math.floor(by(t) / 4) * 4, 4, 4);
      }
    }

    if (M) {
      // ---- episode: countdown, ignition, the last stretch
      const f0 = f >= 1 ? 1 : Math.max(0, f - 0.12);
      const mv = G.easeInOut(G.clamp((p - 0.35) / 0.65, 0, 1));
      const fr = f >= 1 ? 1 : G.lerp(f0, f, mv);
      let rx, ry;
      if (fr >= 1) { rx = MX - 13; ry = MY - MR - 51; }
      else if (fr <= 0) { rx = P0X - 13; ry = 307; }
      else { rx = Math.round(bx(fr)) - 13; ry = Math.round(by(fr)) - 45; }
      if (f >= 1 && p < 1) ry -= Math.round((1 - mv) * 60); // landing approach
      const burn = (p > 0.3 && p < 1) || (live && f > 0 && f < 1);
      const shake = p > 0.25 && p < 0.4 ? (Math.floor(a.t / 40) % 2) * 2 : 0;
      if (burn) {
        SPR.draw(dc, Math.floor(a.t / 90) % 2 === 0 ? SP.FLAME_A : SP.FLAME_B, rx + 6, ry + 51, 3, [-1, P[11], P[12], P[13]], false);
      }
      // smoke at the pad on liftoff
      if (f < 0.05 && p > 0.3 && p < 1) {
        dc.setColor(P[15], -1);
        const sp = (p - 0.3) / 0.7;
        for (let i = 0; i < 5; i++) {
          const r = Math.round(6 + sp * 14 + i * 2);
          disc(dc, P0X - 30 + i * 15, 352 - (i % 2) * 6, Math.floor(r / 4) * 4 + 4);
        }
      }
      SPR.draw(dc, SP.ROCKET, rx + shake, ry, 3, [-1, P[7], P[8], P[9], P[10]], false);
      if (f >= 1) SPR.draw(dc, SP.FLAG, MX + 18, MY - MR - 26, 3, [-1, P[17], P[9]], false);

      // ---- countdown at the start of every episode
      if (p > 0.02 && p < 0.33 && f < 1) {
        const n = 3 - Math.floor((p - 0.02) / 0.1);
        dc.setColor(P[14], -1);
        F.px(dc, "T-" + Math.max(1, n), rx + 40, ry + 10, 3, 0, 0);
      }
    }

    if (!S) return;
    // ---- time, date, mission caption
    dc.setColor(P[14], -1);
    F.px(dc, G.timeStr(d), 150, 46, 5, 1, st === 2 ? 0 : 0);
    dc.setColor(P[15], -1);
    F.px(dc, "MISSION KW " + d.wk, 150, 90, 2, 1, 0);
    dc.setColor(P[14], -1);
    F.px(dc, PHASES[phaseIdx(f)], 300, 244, 2, 1, 0);
    dc.setColor(P[15], -1);
    F.px(dc, sg[2], 300, 264, 2, 1, 0);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const c = st === 3 ? 0x306230 : 0x5a5a6a;
    const sg = stage(d);
    const f = sg[1] > 0 ? G.clamp(sg[0] / sg[1], 0, 1) : 0;
    dc.setColor(G.dim(0xd8d4c8, 0.4), -1);
    moonLit(dc, d.moon >= 0 ? d.moon : 0.5, MR, o[0], o[1]);
    dc.setColor(c, -1);
    for (let i = 1; i < 30; i += 2) {
      const t = i / 30;
      dc.fillRectangle(Math.floor(bx(t) / 4) * 4 + o[0], Math.floor(by(t) / 4) * 4 + o[1], 2, 2);
    }
    let rx = Math.round(bx(f)) - 13, ry = Math.round(by(f)) - 45;
    if (f >= 1) { rx = MX - 13; ry = MY - MR - 51; }
    if (f <= 0) { rx = P0X - 13; ry = 307; }
    const rc = G.dim(0xf0f0f0, 0.5);
    SPR.draw(dc, SP.ROCKET, rx + o[0], ry + o[1], 3, [-1, rc, -1, rc, -1], false);
    dc.setColor(0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 150 + o[0], 46 + o[1], 5, 1, 1);
  },
};
