// VELO — "Velodrom": a 250 m track seen from above. Weekly bike km become laps (1 km = 4 laps);
// your rider sits at the position of the current lap, the outer rail fills towards the weekly
// goal, the lap board counts the laps still to go and the bell rings once the goal is reached.
// A ghost rider rides at the minute-hand angle, so the track doubles as a clock.
// Styles: 1 Holz, 2 Nacht, 3 Neon. Mirrors watch/source/faces/Velo.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const CX = 227, CY = 227;
const A = 40;      // half straight
const R_RAIL = 182, R_OUT = 178, R_STAY = 160, R_SPR = 146, R_MEAS = 139, R_IN = 136, R_COTE = 124;
const PI = Math.PI;

let CRX = null, CRY = null, CRH = null;
let BC = null, BCS = -1;
const NB = 8;

// spectators on the two stand tiers (visible part only), relative to the centre at zoom 1
function crowd() {
  if (CRX !== null) return;
  CRX = [];
  CRY = [];
  CRH = [];
  for (let row = 0; row < 2; row++) {
    const r = 195 + row * 11;
    let s = 77 + row * 31;
    for (let k = 0; k < 96; k++) {
      s = G.rnd(s);
      const q = stadPt(A, r, (k + row * 0.5) / 96.0);
      const dx = q[0] - CX, dy = q[1] - CY;
      if (dx * dx + dy * dy > 221 * 221) continue;
      CRX.push(dx);
      CRY.push(dy);
      CRH.push(s % 7 > 4 ? 4 : s % 7);
    }
  }
}

// ---------- stadium helpers (all radii/half straight already scaled)
function stadFill(dc, a, r) {
  dc.fillCircle(CX - a, CY, r);
  dc.fillCircle(CX + a, CY, r);
  dc.fillRectangle(CX - a, CY - r, 2 * a, 2 * r);
}

// outline from the finish line (bottom centre) counter-clockwise, fraction f of the lap
function stadLine(dc, a, r, f) {
  if (f <= 0) return;
  const P = 4 * a + 2 * PI * r;
  let l = f * P;
  // bottom right half
  let s = Math.min(l, a);
  if (s > 0.3) dc.drawLine(CX, CY + r, CX + s, CY + r);
  l -= a;
  if (l <= 0) return;
  s = Math.min(l, PI * r);
  G.arcC(dc, CX + a, CY, r, 180 - s / r * 180 / PI, 180);
  l -= PI * r;
  if (l <= 0) return;
  s = Math.min(l, 2 * a);
  dc.drawLine(CX + a, CY - r, CX + a - s, CY - r);
  l -= 2 * a;
  if (l <= 0) return;
  s = Math.min(l, PI * r);
  G.arcC(dc, CX - a, CY, r, 360 - s / r * 180 / PI, 360);
  l -= PI * r;
  if (l <= 0) return;
  s = Math.min(l, a);
  dc.drawLine(CX - a, CY + r, CX - a + s, CY + r);
}

// point + CCW tangent at lap fraction u (0 = finish line, bottom centre)
function stadPt(a, r, u) {
  u = u - Math.floor(u);
  const P = 4 * a + 2 * PI * r;
  let l = u * P;
  if (l < a) return [CX + l, CY + r, 1, 0];
  l -= a;
  if (l < PI * r) {
    const c = 180 - l / r * 180 / PI;
    return bendPt(CX + a, r, c);
  }
  l -= PI * r;
  if (l < 2 * a) return [CX + a - l, CY - r, -1, 0];
  l -= 2 * a;
  if (l < PI * r) {
    const c = 360 - l / r * 180 / PI;
    return bendPt(CX - a, r, c);
  }
  l -= PI * r;
  return [CX - a + l, CY + r, 1, 0];
}

function bendPt(bx, r, c) {
  const x = G.ptX(bx, r, c), y = G.ptY(CY, r, c);
  const ux = (x - bx) / r, uy = (y - CY) / r;
  return [x, y, uy, -ux];
}

// point where the ray at clock angle deg meets the stadium of radius r
function rayPt(a, r, deg) {
  const sx = Math.sin(deg * PI / 180), sy = -Math.cos(deg * PI / 180);
  const ay = Math.abs(sy);
  if (ay > 0.001) {
    const t = r / ay;
    if (Math.abs(t * sx) <= a) return [CX + t * sx, CY + t * sy, sy < 0 ? -1 : 1, 0];
  }
  const ax = Math.abs(sx);
  const t = a * ax + Math.sqrt(a * a * ax * ax - a * a + r * r);
  const bx = sx < 0 ? CX - a : CX + a;
  const x = CX + t * sx, y = CY + t * sy;
  const ux = (x - bx) / r, uy = (y - CY) / r;
  return [x, y, uy, -ux];
}

// top-down rider: bike along the tangent (tx, ty), jersey col, helmet hc
function rider(dc, x, y, tx, ty, col, hc, bike, s) {
  const nx = -ty, ny = tx;
  dc.setColor(bike, -1);
  dc.setPenWidth(3 * s);
  dc.drawLine(x - tx * 12 * s, y - ty * 12 * s, x + tx * 12 * s, y + ty * 12 * s);
  dc.setColor(col, -1);
  dc.setPenWidth(2 * s);
  dc.drawLine(x + (tx * 4 + nx * 5) * s, y + (ty * 4 + ny * 5) * s, x + (tx * 10 + nx * 3) * s, y + (ty * 10 + ny * 3) * s);
  dc.drawLine(x + (tx * 4 - nx * 5) * s, y + (ty * 4 - ny * 5) * s, x + (tx * 10 - nx * 3) * s, y + (ty * 10 - ny * 3) * s);
  dc.fillPolygon([
    [x - tx * 8 * s, y - ty * 8 * s],
    [x + (-tx * 3 + nx * 4) * s, y + (-ty * 3 + ny * 4) * s],
    [x + (tx * 4 + nx * 5.5) * s, y + (ty * 4 + ny * 5.5) * s],
    [x + tx * 7 * s, y + ty * 7 * s],
    [x + (tx * 4 - nx * 5.5) * s, y + (ty * 4 - ny * 5.5) * s],
    [x + (-tx * 3 - nx * 4) * s, y + (-ty * 3 - ny * 4) * s],
  ]);
  dc.setColor(hc, -1);
  dc.fillCircle(x + tx * 6 * s, y + ty * 6 * s, 3.6 * s);
}

// bell, hanging from (x, y), swing angle deg
function bell(dc, x, y, deg, col, dark) {
  const s = Math.sin(deg * PI / 180), c = Math.cos(deg * PI / 180);
  // local points (px, py) -> rotated around the hanger
  const P = [-3, 4, 3, 4, 7, 12, 9, 22, 13, 26, -13, 26, -9, 22, -7, 12];
  const pts = [];
  for (let i = 0; i < P.length; i += 2) pts.push([x + P[i] * c - P[i + 1] * s, y + P[i] * s + P[i + 1] * c]);
  dc.setColor(dark, -1);
  dc.setPenWidth(3);
  dc.drawLine(x, y, x - 4 * s, y + 4 * c);
  // clapper swings a little behind
  dc.fillCircle(x - 30 * s * 0.7, y + 30 * c, 3.5);
  dc.setColor(col, -1);
  dc.fillPolygon(pts);
  dc.fillCircle(x - 4 * s, y + 4 * c, 4);
}

function trackCols(st, acc) {
  // [bg, woodIn, woodOut, board, cote, infield, meas, red, blue, rail, ink, sub, crowd]
  if (st === 2) return [0x000000, 0x33251a, 0x1c130c, 0x291d13, 0x173e66, 0x05080e, 0x0a0a0a, 0xff3b3f, 0x3d8bff, 0x5a5a5a, 0xffffff, 0x8a93a6, 0x161a24];
  if (st === 3) return [0x000000, 0x000000, 0x000000, 0x000000, G.dim(acc, 0.22), 0x000000, G.dim(acc, 0.45), acc, G.dim(acc, 0.7), G.dim(acc, 0.35), 0xffffff, G.dim(acc, 0.75), G.dim(acc, 0.25)];
  return [0x0b0b0b, 0xdcac70, 0xb47c45, 0xc4904f, 0x4fa3e3, 0x1c3a2b, 0x1a1a1a, 0xd6262b, 0x2f6fd6, 0xdedede, 0xffffff, 0x9fb3c4, 0x3a3a3a];
}

let FPS = 15;

export default {
  get fps() { return FPS; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const t = a.t;
    const live = a.live && p >= 1;
    const C = trackCols(st, acc);
    const bg = C[0];
    FPS = st === 2 ? 12 : 15;

    // camera zoom
    const z = 0.6 + 0.4 * G.ease(G.clamp(p / 0.6, 0, 1));
    const za = A * z;
    const fade = G.clamp(p / 0.35, 0, 1);

    // ---- stands (outside the rail): two tiers with spectators
    if (st !== 3) {
      dc.setColor(G.mix(bg, C[12], fade), -1);
      dc.setPenWidth(9);
      for (let row = 0; row < 2; row++) {
        const r = (195 + row * 11) * z;
        // only the parts inside the round screen
        const v = row === 0 ? 52 : 30;
        dc.drawLine(CX - za, CY - r, CX + za, CY - r);
        dc.drawLine(CX - za, CY + r, CX + za, CY + r);
        G.arcC(dc, CX + za, CY, r, 0, v);
        G.arcC(dc, CX + za, CY, r, 180 - v, 180);
        G.arcC(dc, CX - za, CY, r, 180, 180 + v);
        G.arcC(dc, CX - za, CY, r, 360 - v, 360);
      }
      crowd();
      const HC = [acc, 0xf0f0f0, 0x4a78c8, 0xf2c14e, 0x8a8a8a];
      for (let h = 0; h < 5; h++) {
        dc.setColor(G.mix(bg, HC[h], (st === 2 ? 0.4 : 0.7) * fade), -1);
        for (let i = 0; i < CRX.length; i++) {
          if (CRH[i] === h) dc.fillRectangle(CX + CRX[i] * z - 1.5, CY + CRY[i] * z - 1.5, 3, 3);
        }
      }
    }

    // ---- track surface
    if (st !== 3) {
      dc.setColor(G.mix(bg, 0x2a2a2a, fade), -1);
      dc.setPenWidth(Math.ceil(8 * z));
      stadLine(dc, za, (R_RAIL - 0.5) * z, 1.0);
      // banked boards: concentric bands, darker towards the outside (colours cached per style)
      if (BCS !== st) {
        BC = [];
        for (let j = 0; j < NB; j++) {
          let c = G.mix(C[1], C[2], j / (NB - 1.0));
          if (j % 2 === 1) c = G.mix(c, C[3], 0.5);
          BC.push(c);
        }
        BCS = st;
      }
      const bw = 42.0 / NB;
      dc.setPenWidth(Math.ceil(bw * z) + 1);
      for (let j = 0; j < NB; j++) {
        dc.setColor(fade >= 1 ? BC[j] : G.mix(bg, BC[j], fade), -1);
        const r = (R_IN + bw / 2 + j * bw) * z;
        G.arcC(dc, CX + za, CY, r, 0, 180);
        G.arcC(dc, CX - za, CY, r, 180, 360);
        const r0 = (R_IN + j * bw) * z;
        dc.fillRectangle(CX - za, CY - r0 - bw * z, 2 * za, bw * z + 1);
        dc.fillRectangle(CX - za, CY + r0, 2 * za, bw * z + 1);
      }
      // spotlights (Nacht): warm pools on the boards, flickering
      if (st === 2) {
        const LU = [0.08, 0.3, 0.55, 0.8];
        for (let k = 0; k < 4; k++) {
          const q = stadPt(za, (R_IN + 21) * z, LU[k]);
          let fl = 1.0;
          if (live) fl = 0.85 + 0.15 * G.noise(t / 160.0 + k * 3.7);
          for (let j = 0; j < 3; j++) {
            dc.setColor(G.mix(C[1], 0xffd59a, (0.09 + j * 0.16) * fl * fade), -1);
            dc.fillCircle(q[0], q[1], (19 - j * 6) * z);
          }
        }
      }
      // côte d'azur + infield
      dc.setColor(G.mix(bg, C[4], fade), -1);
      dc.setPenWidth(Math.ceil(13 * z));
      stadLine(dc, za, (R_COTE + 6) * z, 1.0);
      dc.setColor(G.mix(bg, C[5], fade), -1);
      stadFill(dc, za, R_COTE * z);
    } else {
      // Neon: côte d'azur as a dim double line
      dc.setColor(C[4], -1);
      dc.setPenWidth(2);
      stadLine(dc, za, R_COTE * z, G.ease(G.stag(p, 0, 0, 0.6)));
    }

    // ---- lines draw themselves (measurement, sprinter, stayer, outer edge)
    const LR = [R_IN, R_MEAS, R_SPR, R_STAY, R_OUT];
    const LC = [st === 3 ? C[6] : C[6], C[6], C[7], C[8], st === 3 ? C[7] : C[3]];
    const LW = [st === 3 ? 2 : 0, st === 3 ? 0 : 2, 3, 3, st === 3 ? 3 : 0];
    for (let k = 0; k < 5; k++) {
      if (LW[k] === 0) continue;
      const f = G.easeInOut(G.stag(p, k, 0.07, 0.5));
      if (st === 2 && k >= 2) {
        dc.setColor(G.dim(LC[k], 0.3), -1);
        dc.setPenWidth(6);
        stadLine(dc, za, LR[k] * z, f);
      }
      dc.setColor(LC[k], -1);
      dc.setPenWidth(LW[k]);
      stadLine(dc, za, LR[k] * z, f);
    }

    // ---- finish line (bottom centre) + 200 m line + pursuit line (top centre)
    const lp = G.ease(G.stag(p, 2, 0.1, 0.4));
    if (lp > 0) {
      const y0 = CY + R_IN * z, y1 = CY + R_OUT * z;
      dc.setColor(st === 3 ? 0xffffff : 0xf4f4f4, -1);
      dc.fillRectangle(CX - 4, y0, 8, (y1 - y0) * lp);
      dc.setColor(st === 3 ? acc : 0x111111, -1);
      dc.fillRectangle(CX - 1, y0, 2, (y1 - y0) * lp);
      dc.setColor(C[7], -1);
      dc.fillRectangle(CX - 1, CY - R_OUT * z, 3, (R_OUT - R_IN) * z * lp);
      dc.setColor(st === 3 ? G.dim(0xffffff, 0.6) : 0xf4f4f4, -1);
      dc.setPenWidth(2);
      const q0 = stadPt(za, R_IN * z, 0.8), q1 = stadPt(za, R_OUT * z, 0.8);
      dc.drawLine(q0[0], q0[1], G.lerp(q0[0], q1[0], lp), G.lerp(q0[1], q1[1], lp));
    }

    // ---- rail + goal progress
    const km = d.wkBike > 0 ? d.wkBike / 1000.0 : 0;
    const goal = d.cfg.bikeGoal > 0 ? d.cfg.bikeGoal : 1;
    const laps4 = km * 4;
    const laps = Math.floor(laps4 + 0.0001);
    const gl = goal * 4;
    const rem = gl - laps;
    const gf = G.clamp(km / goal, 0, 1);
    const rf = G.easeInOut(G.stag(p, 4, 0.07, 0.5));
    dc.setColor(st === 3 ? G.dim(acc, 0.25) : C[9], -1);
    dc.setPenWidth(st === 3 ? 2 : 3);
    stadLine(dc, za, R_RAIL * z, rf);
    if (gf > 0) {
      const ef = gf * G.ease(G.stag(p, 0, 0.4, 0.6));
      if (st === 2) {
        dc.setColor(G.dim(acc, 0.35), -1);
        dc.setPenWidth(11);
        stadLine(dc, za, R_RAIL * z, ef);
      }
      dc.setColor(acc, -1);
      dc.setPenWidth(5);
      stadLine(dc, za, R_RAIL * z, ef);
      const q = stadPt(za, R_RAIL * z, ef);
      dc.fillCircle(q[0], q[1], 5);
    }

    // ---- riders: two training partners lapping, the ghost (minute) and you
    const bike = st === 1 ? 0x2a2a2a : 0x9a9a9a;
    const e = G.easeInOut(G.clamp((p - 0.3) / 0.7, 0, 1));
    {
      for (let k = 0; k < 2; k++) {
        const u = live ? ((t + 13400 + k * 260) % 6500) / 6500.0 : 0.66 + k * 0.04;
        const q = stadPt(za, (R_MEAS + 6) * z, u * e);
        const pc = st === 3 ? G.dim(acc, 0.45) : (k === 0 ? 0x3c6e9e : 0x5f8fbf);
        if (e > 0.02) rider(dc, q[0], q[1], q[2], q[3], pc, st === 3 ? G.dim(acc, 0.6) : 0xe8e8e8, bike, 0.8 * z);
      }
    }
    // ghost rider at the minute angle
    const mdeg = d.m * 6 + d.s * 0.1;
    let delta = 180 - mdeg;
    if (delta < 0) delta += 360;
    const gdeg = 180 - delta * e;
    const gq = rayPt(za, (R_STAY + 9) * z, gdeg);
    const gcol = st === 3 ? 0xbfc7d4 : (st === 2 ? 0x8fa3c4 : 0xe9eef5);
    if (e > 0.02) {
      // pursuit trail
      for (let k = 1; k <= 3; k++) {
        const tq = rayPt(za, (R_STAY + 9) * z, gdeg + k * 2.2);
        dc.setColor(G.mix(st === 1 ? C[2] : bg, gcol, 0.5 - k * 0.13), -1);
        dc.fillCircle(tq[0], tq[1], 4 - k * 0.8);
      }
      rider(dc, gq[0], gq[1], gq[2], gq[3], G.mix(st === 1 ? C[2] : bg, gcol, 0.75), gcol, G.mix(st === 1 ? C[2] : bg, bike, 0.6), z);
    }
    // you: fractional position of the current lap, oscillating a little while live
    let fu = laps4 - Math.floor(laps4);
    if (live) fu += 0.012 * Math.sin(t / 700.0);
    const yq = stadPt(za, (R_SPR + 7) * z, fu * e);
    if (e > 0.02) {
      if (st !== 1) {
        dc.setColor(G.dim(acc, 0.3), -1);
        dc.fillCircle(yq[0], yq[1], 13 * z);
      }
      rider(dc, yq[0], yq[1], yq[2], yq[3], acc, 0xffffff, bike, 1.1 * z);
    }

    // ---- infield content (fades in with the zoom)
    const ip = G.ease(G.clamp((p - 0.25) / 0.6, 0, 1));
    const ink = C[10], sub = C[11];
    const ib = C[5];
    // slots
    for (let k = 0; k < 2; k++) {
      const sp = G.ease(G.stag(p - 0.3, k, 0.08, 0.5));
      const sl = d.slots[k];
      const x = k === 0 ? 162 : 292;
      dc.setColor(G.mix(ib, sub, ip), -1);
      F.px(dc, sl.lbl, x, 124, 2, 1, 0);
      dc.setColor(G.mix(ib, d.dcol, ip * sp), -1);
      F.px(dc, sl.val, x, 142, 3, 1, 0);
    }
    // time
    const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
    const ts = hh + ":" + G.pad2(d.m);
    const tp = G.ease(G.clamp((p - 0.2) * 1.6, 0, 1));
    if (st === 3) {
      dc.setColor(G.dim(acc, 0.35), -1);
      F.st(dc, ts, CX, 212, 70, 12, 1, tp, 0);
    }
    dc.setColor(ink, -1);
    F.st(dc, ts, CX, 212, 70, st === 3 ? 4 : 8, 1, tp, 0);

    // lap board
    const bp = G.ease(G.clamp((p - 0.45) / 0.55, 0, 1));
    if (bp > 0) {
      const done = rem <= 0;
      const by = 264;
      if (!done) {
        const shownRem = Math.round(G.lerp(gl, rem, bp));
        const txt = "" + shownRem;
        const n = txt.length;
        const cw = 24, ch = 34;
        const bw = n * (cw + 4) + 62;
        const bx = CX - 16 - bw / 2;
        dc.setColor(st === 3 ? 0x000000 : 0x0d0d0d, -1);
        dc.fillRoundedRectangle(bx, by, bw, ch + 8, 5);
        dc.setColor(st === 3 ? acc : 0x6a6a6a, -1);
        dc.setPenWidth(2);
        dc.drawRoundedRectangle(bx, by, bw, ch + 8, 5);
        dc.setColor(sub, -1);
        F.px(dc, "NOCH", bx + 8, by + 14, 2, 0, 0);
        for (let i = 0; i < n; i++) {
          const cx0 = bx + 58 + i * (cw + 4);
          dc.setColor(st === 3 ? G.dim(acc, 0.18) : 0x2b2b2b, -1);
          dc.fillRoundedRectangle(cx0, by + 4, cw, ch, 3);
          dc.setColor(0xffffff, -1);
          F.st(dc, txt.substring(i, i + 1), cx0 + cw / 2, by + 4 + ch / 2, 22, 3, 1, 1.0, 0);
          dc.setColor(st === 3 ? 0x000000 : 0x0d0d0d, -1);
          dc.fillRectangle(cx0, by + 4 + ch / 2, cw, 1);
        }
        bell(dc, CX + bw / 2 + 12, by + 2, 0, st === 3 ? G.dim(acc, 0.5) : 0x6e6e6e, 0x3a3a3a);
      } else {
        const sw = live ? 28 * Math.sin(t / 110.0) : 18;
        dc.setColor(acc, -1);
        F.st(dc, "GLOCKE!", CX - 20, by + 21, 22, 4, 1, bp, 0);
        const bx = CX + 78;
        bell(dc, bx, by, sw, 0xf2c14e, 0x8a6a1a);
        // ringing waves
        dc.setColor(G.dim(0xf2c14e, 0.8), -1);
        dc.setPenWidth(2);
        const ph = live ? (t % 500) / 500.0 : 0.5;
        G.arcC(dc, bx, by + 16, 20 + ph * 6, 45, 105);
        G.arcC(dc, bx, by + 16, 20 + ph * 6, 255, 315);
      }
    }

    // laps + legend
    dc.setColor(G.mix(ib, ink, ip), -1);
    F.px(dc, laps + " RUNDEN", CX, 314, 2, 1, 0);
    dc.setColor(G.mix(ib, acc, ip), -1);
    dc.fillCircle(CX - 48, 341, 4);
    dc.setColor(G.mix(ib, sub, ip), -1);
    F.px(dc, "DU", CX - 40, 334, 2, 0, 0);
    dc.setColor(G.mix(ib, gcol, ip), -1);
    dc.setPenWidth(2);
    dc.drawCircle(CX + 4, 341, 4);
    dc.setColor(G.mix(ib, sub, ip), -1);
    F.px(dc, "MIN", CX + 12, 334, 2, 0, 0);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const ox = o[0], oy = o[1];
    dc.setColor(0x333333, -1);
    dc.setPenWidth(2);
    G.arcC(dc, CX + A + ox, CY + oy, R_OUT, 0, 180);
    G.arcC(dc, CX - A + ox, CY + oy, R_OUT, 180, 360);
    dc.drawLine(CX - A + ox, CY - R_OUT + oy, CX + A + ox, CY - R_OUT + oy);
    dc.drawLine(CX - A + ox, CY + R_OUT + oy, CX + A + ox, CY + R_OUT + oy);
    const km = d.wkBike > 0 ? d.wkBike / 1000.0 : 0;
    const l4 = km * 4;
    const yq = stadPt(A, R_SPR + 7, l4 - Math.floor(l4));
    dc.setColor(G.dim(d.accent, 0.7), -1);
    dc.fillCircle(yq[0] + ox, yq[1] + oy, 5);
    const gq = rayPt(A, R_STAY + 9, d.m * 6);
    dc.setColor(0x7a7a7a, -1);
    dc.drawCircle(gq[0] + ox, gq[1] + oy, 5);
    const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
    dc.setColor(0x9a9a9a, -1);
    F.st(dc, hh + ":" + G.pad2(d.m), CX + ox, 212 + oy, 70, 3, 1, 1.0, 0);
  },
};
