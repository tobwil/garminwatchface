// MUNCH — "Muncher": an arcade maze homage. The dots are your step goal: the share
// steps/stepGoal of the dots along a fixed path is already eaten and the chomper sits at that
// point; stress spawns ghosts (1 + stress/25), reaching the goal turns them blue and the
// chomper hunts them. Score = steps, HI = best day this week, lives = training days.
// Styles: 1 Arcade, 2 Gameboy, 3 Neon. Mirrors watch/source/faces/Munch.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/munch.js";

const SP = encodeAll(S);
const CHR = [SP.CH_R0, SP.CH_R1, SP.CH_R2];
const CHU = [SP.CH_U0, SP.CH_U1, SP.CH_U2];
const CHD = [SP.CH_D0, SP.CH_D1, SP.CH_D2];
const MF = [0, 1, 2, 1]; // chomp cycle
const C = 21, X0 = 70, Y0 = 96; // 15 x 13 tiles of 21 px
// walk through the maze (waypoints col,row): the order in which the dots get eaten
const WALK_WP = [7, 9, 4, 9, 4, 11, 1, 11, 1, 9, 3, 9, 1, 9, 1, 3, 13, 3, 13, 11, 5, 11, 7, 11, 7, 9, 10, 9, 10, 10, 10, 9,
  13, 9, 13, 1, 10, 1, 10, 2, 10, 1, 7, 1, 7, 2, 7, 1, 4, 1, 4, 2, 4, 1, 1, 1, 1, 2];
// ghost loops (closed)
const LOOP_WP = [[1, 3, 13, 3, 13, 9, 1, 9], [1, 1, 1, 11, 13, 11, 13, 1], [4, 1, 10, 1, 10, 3, 4, 3], [4, 11, 10, 11, 10, 9, 4, 9]];
const GSPD = [2600, 2200, 3000, 2400]; // milli-tiles per second
// wall outlines [x, y, w, h]: frame outer, frame inner, ghost house, 8 blocks
const BOX = [73, 99, 309, 267, 85, 111, 285, 243, 115, 183, 225, 99,
  115, 141, 36, 15, 178, 141, 36, 15, 241, 141, 36, 15, 304, 141, 36, 15,
  115, 309, 36, 15, 178, 309, 36, 15, 241, 309, 36, 15, 304, 309, 36, 15];

// expand waypoints into tile codes (c + r * 15)
function expand(wp, closed) {
  const out = [];
  const n = wp.length / 2;
  let c = wp[0], r = wp[1];
  out.push(c + r * 15);
  for (let i = 1; i <= (closed ? n : n - 1); i++) {
    const tc = wp[(i % n) * 2], tr = wp[(i % n) * 2 + 1];
    while (c !== tc || r !== tr) {
      c += Math.sign(tc - c);
      r += Math.sign(tr - r);
      out.push(c + r * 15);
    }
  }
  if (closed) out.pop();
  return out;
}

const WALK = expand(WALK_WP, false);
const CUM = []; // distinct tiles eaten up to walk index i
const DOTS = []; // dot tiles in eating order
const FIRST = []; // walk index of the j-th dot
{
  const seen = {};
  seen[WALK[0]] = 1; // start tile: no dot
  for (let i = 0; i < WALK.length; i++) {
    if (!seen[WALK[i]]) { seen[WALK[i]] = 1; DOTS.push(WALK[i]); FIRST.push(i); }
    CUM.push(DOTS.length);
  }
}
const LOOPS = LOOP_WP.map((w) => expand(w, true));
const ND = DOTS.length;

function pal(st, acc) {
  if (st === 2) {
    const c0 = 0x0f380f, c1 = 0x306230, c2 = 0x8bac0f, c3 = 0x9bbc0f;
    // bg, wall, wallGlow, door, dot, pellet, txt, lbl, ready, chomp body/shade/eye/teeth/hi, eyeW, pupil, fright, frightFace, flash, flashFace, g0..g3, dim
    return [c3, c1, -1, c2, c1, c0, c0, c1, c0, c1, c0, c0, c3, c2, c3, c0, c2, c0, c3, c1, c0, c0, c0, c0, c2];
  }
  if (st === 3) {
    const cy = 0x00e5ff, mg = 0xff2bd6;
    return [-1, cy, G.dim(cy, 0.3), mg, G.mix(mg, 0xffffff, 0.3), mg, 0xffffff, G.mix(cy, 0xffffff, 0.3), acc,
      acc, G.mix(acc, 0, 0.35), 0x1a1a1a, 0xffffff, G.mix(acc, 0xffffff, 0.6), 0xffffff, 0x1a1aff, 0x5b4bff, 0xffc8f0, 0xe8e8ff, mg,
      mg, cy, 0x7cff4f, 0xff9a2b, G.dim(mg, 0.35)];
  }
  return [-1, 0x2d3cf0, -1, 0xffb8de, 0xffc8b0, 0xffc8b0, 0xffffff, 0xdedede, 0xffe135,
    acc, G.mix(acc, 0, 0.35), 0x1a1a1a, 0xffffff, G.mix(acc, 0xffffff, 0.6), 0xffffff, 0x2233cc, 0x2b3bff, 0xffc8b8, 0xe8e8ff, 0xff2a2a,
    0xff2a2a, 0xffa6e8, 0x2ae8ff, 0xffaa3a, 0x555555];
}

// rounded (cut-corner) rectangle outline, drawn up to fraction f of its perimeter
function boxP(dc, x, y, w, h, th, f) {
  const a = w - 2 * th, b = h - 2 * th;
  let rem = f * (2 * a + 2 * b);
  if (rem <= 0) return;
  let l = Math.min(rem, a);
  dc.fillRectangle(x + th, y, l, th);
  rem -= a;
  if (rem <= 0) return;
  l = Math.min(rem, b);
  dc.fillRectangle(x + w - th, y + th, th, l);
  rem -= b;
  if (rem <= 0) return;
  l = Math.min(rem, a);
  dc.fillRectangle(x + w - th - l, y + h - th, l, th);
  rem -= a;
  if (rem <= 0) return;
  l = Math.min(rem, b);
  dc.fillRectangle(x, y + h - th - l, th, l);
}

// pixel position (snapped to the 3 px grid) along a tile list at pos (milli-tiles); returns [x, y, dir]
// dir 0 right, 1 left, 2 up, 3 down
function at(arr, posM, loop, back) {
  const n = arr.length;
  let i = Math.floor(posM / 1000);
  let f = posM % 1000;
  if (!loop && i >= n - 1) { i = n - 1; f = 0; }
  const ta = arr[i % n];
  const tb = loop ? arr[(i + 1) % n] : arr[Math.min(i + 1, n - 1)];
  let ac = ta % 15, ar = Math.floor(ta / 15), bc = tb % 15, br = Math.floor(tb / 15);
  let dx = bc - ac, dy = br - ar;
  if (dx === 0 && dy === 0 && i > 0) { const tp = arr[i - 1]; dx = ac - (tp % 15); dy = ar - Math.floor(tp / 15); }
  if (back) { dx = -dx; dy = -dy; }
  const x = Math.floor(Math.floor((ac * C * 1000 + (bc - ac) * C * f) / 1000) / 3) * 3;
  const y = Math.floor(Math.floor((ar * C * 1000 + (br - ar) * C * f) / 1000) / 3) * 3;
  const dir = dx > 0 ? 0 : dx < 0 ? 1 : dy < 0 ? 2 : 3;
  return [X0 + x - 3, Y0 + y - 3, dir];
}

function pad5(n) {
  let s = "" + Math.max(0, Math.round(n));
  while (s.length < 5) s = "0" + s;
  return s;
}

function chomp(dc, P, x, y, dir, fr) {
  const pal = [P[11], P[9], P[10], P[12], P[13]];
  if (dir === 2) SPR.draw(dc, CHU[fr], x, y, 3, pal, false);
  else if (dir === 3) SPR.draw(dc, CHD[fr], x, y, 3, pal, false);
  else SPR.draw(dc, CHR[fr], x, y, 3, pal, dir === 1);
}

export default {
  fps: 12,

  // static layer: maze, dots, time, score; chomper, ghosts, pellets and 1UP move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const t = live ? a.t : 0;
    const goal = d.stepGoal > 0 ? d.stepGoal : 10000;
    const steps = d.steps > 0 ? d.steps : 0;
    const power = steps >= goal;
    const nEat = power ? ND : Math.floor((ND * steps) / goal);
    const wE = nEat > 0 ? FIRST[nEat - 1] : 0;

    if (st === 2 && S) {
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 0, 454, 454);
    }

    // ---------------- maze walls (draw themselves during the intro)
    for (let i = 0; i < 11 && S; i++) {
      const f = p >= 1 ? 1 : G.ease(G.stag(p, i < 3 ? i : 3 + (i - 3) * 0.4, 0.05, 0.25));
      if (f <= 0) continue;
      const x = BOX[i * 4], y = BOX[i * 4 + 1], w = BOX[i * 4 + 2], h = BOX[i * 4 + 3];
      if (st === 3) {
        dc.setColor(P[2], -1);
        boxP(dc, x - 2, y - 2, w + 4, h + 4, 7, f);
      }
      dc.setColor(P[1], -1);
      boxP(dc, x, y, w, h, 3, f);
    }
    if (p >= 0.3 && S) {
      dc.setColor(P[3], -1);
      dc.fillRectangle(212, 183, 30, 3);
    }

    // ---------------- chomper position along the walk
    let cpos = wE * 1000; // milli-tiles
    let back = false;
    if (p < 1) {
      const kI = Math.min(6, wE);
      cpos = Math.round((wE - kI * (1 - G.ease((p - 0.55) / 0.45))) * 1000);
    } else if (live && !power) {
      const D = Math.min(8, wE);
      if (D > 0) {
        const T = Math.floor((D * 1000) / 3);
        const tm = (t - 1400) % (2 * T);
        back = tm < T;
        cpos = wE * 1000 - 3 * (tm < T ? tm : 2 * T - tm);
      }
    }
    const eatW = Math.floor(cpos / 1000);

    // ---------------- dots + power pellets
    const n0 = power ? ND : CUM[Math.min(eatW, WALK.length - 1)];
    const reveal = p >= 1 ? ND : Math.floor(G.clamp((p - 0.3) / 0.25, 0, 1) * (ND - n0));
    const blink = live && Math.floor(t / 250) % 2 === 1;
    for (let j = n0; j < n0 + reveal && j < ND; j++) {
      const tc = DOTS[j];
      const x = X0 + (tc % 15) * C, y = Y0 + Math.floor(tc / 15) * C;
      if (tc === 16 || tc === 28 || tc === 166 || tc === 178) {
        // the power pellets blink over the cached maze
        if (blink || !M) continue;
        dc.setColor(P[5], -1);
        dc.fillRectangle(x + 6, y + 9, 9, 3);
        dc.fillRectangle(x + 9, y + 6, 3, 9);
        dc.fillRectangle(x + 7, y + 7, 7, 7);
      } else if (S) {
        dc.setColor(P[4], -1);
        dc.fillRectangle(x + 9, y + 9, 3, 3);
      }
    }

    // ---------------- time in the ghost house
    if (p >= 0.2 && S) {
      const ts = G.timeStr(d);
      if (st === 3) {
        dc.setColor(P[24], -1);
        F.px(dc, ts, 225, 196, 7, 1, -4);
      }
      dc.setColor(P[6], -1);
      F.px(dc, ts, 227, 198, 7, 1, 0);
      if (p < 1) {
        if (Math.floor(a.t / 180) % 2 === 0) {
          dc.setColor(P[8], -1);
          F.px(dc, "READY!", 227, 257, 2, 1, 0);
        }
      } else {
        dc.setColor(P[7], -1);
        F.px(dc, power ? "ZIEL! " + d.dowStr + " " + d.day + "." : d.dowStr + " " + d.day + ". " + d.monStr, 227, 257, 2, 1, 0);
      }
    }

    // ---------------- ghosts
    let ng = d.stress < 0 ? 1 : 1 + Math.floor(d.stress / 25);
    if (ng > 4) ng = 4;
    const gfr = live ? Math.floor(t / 150) % 2 : 0;
    const flash = live && t % 2000 > 1600;
    let cx = 0, cy = 0, cd = 0, gx = 0, gy = 0, gd = 0;
    let pop = -1;
    if (power) {
      // the chomper hunts ghost 0 around the house; caught every 4 s
      const L0 = LOOPS[0].length * 1000;
      const base = (((d.mins * 3) % LOOPS[0].length) * 1000 + Math.floor((t * 3500) / 1000)) % L0;
      const tc = live ? t % 4000 : 1700;
      const gap = tc < 3400 ? 6000 - Math.floor((tc * 6000) / 3400) : 0;
      let q = at(LOOPS[0], base, true, false);
      cx = q[0]; cy = q[1]; cd = q[2];
      if (tc >= 3400) pop = tc;
      q = at(LOOPS[0], (base + gap) % L0, true, false);
      gx = q[0]; gy = q[1]; gd = q[2];
    } else {
      const q = at(WALK, cpos, false, back);
      cx = q[0]; cy = q[1]; cd = q[2];
    }
    if (M && p >= 0.6 && (p >= 0.8 || Math.floor(a.t / 90) % 2 === 0)) {
      for (let i = 0; i < ng; i++) {
        let g;
        if (power && i === 0) {
          if (pop >= 0) continue;
          g = [gx, gy, gd];
        } else {
          const L = LOOPS[i].length;
          const spd = power ? (GSPD[i] * 6) / 10 : GSPD[i];
          g = at(LOOPS[i], ((((d.mins * 3 + i * 7) % L) * 1000 + Math.floor((t * spd) / 1000)) % (L * 1000)), true, false);
        }
        const body = gfr === 0 ? SP.GH_A : SP.GH_B;
        if (power) {
          SPR.draw(dc, body, g[0], g[1], 3, [-1, flash ? P[18] : P[16]], false);
          SPR.draw(dc, SP.FRIGHT, g[0], g[1], 3, [-1, flash ? P[19] : P[17]], false);
        } else {
          SPR.draw(dc, body, g[0], g[1], 3, [-1, P[20 + i]], false);
          const ey = g[2] === 2 ? SP.EY_U : g[2] === 3 ? SP.EY_D : SP.EY_L;
          SPR.draw(dc, ey, g[0], g[1], 3, [P[15], P[14]], g[2] === 0);
        }
      }
    }

    // ---------------- chomper
    if (M && p >= 0.55) {
      const fr = live ? MF[Math.floor(t / 83) % 4] : 1;
      chomp(dc, P, cx, cy, cd, fr);
      if (pop >= 0) {
        dc.setColor(P[st === 1 ? 22 : 6], -1);
        F.px(dc, "200", cx + 13, cy - 17, 2, 1, 0);
      }
    }

    // ---------------- top: 1UP / score, HI
    const blinkUp = live && p >= 1 && Math.floor(t / 400) % 2 === 1;
    let hi = steps;
    for (let i = 0; i < 7; i++) if (d.wkSteps[i] > hi) hi = d.wkSteps[i];
    dc.setColor(P[st === 1 ? 20 : 7], -1);
    if (!blinkUp && M) F.px(dc, "1UP", 160, 40, 2, 1, 0);
    if (!S) return;
    F.px(dc, "HI", 294, 40, 2, 1, 0);
    dc.setColor(P[6], -1);
    F.px(dc, pad5(steps * G.ease(p)), 160, 58, 3, 1, 0);
    F.px(dc, pad5(hi), 294, 58, 3, 1, 0);

    // ---------------- lives = training days
    const nl = G.clamp(Math.max(d.trainDays, d.dayGoal), 0, 7);
    const x0 = 227 - (nl * 20 - 6) / 2;
    for (let i = 0; i < nl; i++) {
      SPR.draw(dc, SP.LIFE, x0 + i * 20, 378, 2, [P[11], i < d.trainDays ? P[9] : P[24]], false);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const wall = st === 2 ? 0x306230 : G.dim(st === 3 ? 0x00e5ff : 0x2d3cf0, 0.55);
    dc.setColor(wall, -1);
    boxP(dc, 73 + o[0], 99 + o[1], 309, 267, 2, 1);
    dc.setColor(0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 202 + o[1], 6, 1, 1);
    const goal = d.stepGoal > 0 ? d.stepGoal : 10000;
    const steps = d.steps > 0 ? d.steps : 0;
    const nEat = steps >= goal ? ND : Math.floor((ND * steps) / goal);
    const c = at(WALK, (nEat > 0 ? FIRST[nEat - 1] : 0) * 1000, false, false);
    const col = st === 2 ? 0x306230 : G.dim(d.accent, 0.6);
    SPR.draw(dc, c[2] === 2 ? SP.CH_U1 : c[2] === 3 ? SP.CH_D1 : SP.CH_R1, c[0] + o[0], c[1] + o[1], 3, [-1, col, col, -1, col], c[2] === 1);
  },
};
