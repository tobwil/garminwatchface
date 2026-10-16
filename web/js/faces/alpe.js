// ALPE 21 — weekly climbing challenge. Floors this week (x 3 m) carry a rider up
// Alpe d'Huez, Mont Ventoux, Stelvio or (cumulative) Everest.
// Styles: 1 Serpentinen, 2 Nacht, 3 Profil. Mirrors watch/source/faces/Alpe.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const CX = 227;
const HM = [1071, 1610, 1808, 8848];
const TURNS = [21, 0, 48, 0];
const LEGS = [9, 4, 13, 6];
const QG = [0.87, 0.74, 0.93, 0.84];
const PEN0 = [15, 18, 11, 14];
const PEN1 = [7, 9, 5, 7];
const KM = [13.8, 21.5, 24.3, 0];
const NAME = ["ALPE D'HUEZ", "MONT VENTOUX", "STELVIO", "EVEREST"];
const GRAD = [
  [10.4, 9.8, 7.9, 8.3, 9.4, 8.1, 7.6, 8.5, 7.4, 6.2, 5.7, 10.6, 4.8, 2.4],
  [4.5, 3.8, 4.5, 4.3, 5.4, 6.5, 9.4, 9.0, 9.2, 10.4, 9.0, 9.4, 8.7, 7.3, 9.1, 7.7, 6.0, 8.0, 7.0, 7.5, 10.1],
  [5.0, 5.8, 6.5, 6.3, 7.4, 7.0, 7.5, 7.0, 8.3, 7.4, 8.6, 9.3, 8.0, 7.6, 8.4, 7.8, 8.3, 8.6, 7.4, 9.0, 7.9, 8.9, 7.2, 7.0],
  [4.0, 5.0, 6.0, 7.5, 9.0, 11.0, 12.5, 14.0, 16.0, 18.0, 21.0, 25.0],
];
// mountain silhouettes (x,y flat): alpine (Alpe/Stelvio), cone (Ventoux), jagged (Everest)
const MT = [
  [0, 420, 50, 372, 92, 340, 128, 292, 160, 262, 186, 222, 206, 196, 227, 168, 246, 186, 262, 204, 288, 238, 318, 262, 348, 300, 384, 330, 420, 372, 454, 410, 454, 454, 0, 454],
  [0, 410, 60, 362, 112, 300, 150, 246, 180, 206, 204, 180, 227, 170, 250, 180, 274, 206, 304, 246, 342, 300, 394, 362, 454, 410, 454, 454, 0, 454],
  [0, 410, 54, 360, 96, 318, 124, 280, 150, 262, 172, 228, 194, 214, 210, 186, 227, 160, 240, 182, 254, 196, 270, 186, 286, 214, 312, 240, 344, 288, 386, 322, 420, 360, 454, 400, 454, 454, 0, 454],
];
const FAR = [
  [0, 330, 40, 290, 78, 262, 104, 244, 130, 266, 160, 300, 190, 330, 270, 330, 300, 282, 330, 250, 356, 232, 386, 256, 420, 288, 454, 320, 454, 454, 0, 454],
  [0, 360, 60, 320, 110, 300, 150, 318, 300, 318, 344, 296, 400, 312, 454, 340, 454, 454, 0, 454],
  [0, 320, 36, 282, 70, 250, 96, 226, 118, 244, 140, 270, 170, 300, 290, 300, 318, 262, 342, 236, 366, 214, 390, 240, 420, 270, 454, 306, 454, 454, 0, 454],
];
const SNOW = [
  [227, 168, 246, 186, 240, 190, 233, 184, 226, 192, 218, 186, 208, 194, 206, 196],
  [204, 180, 227, 170, 250, 180, 262, 194, 248, 198, 236, 192, 222, 198, 206, 194, 194, 194],
  [227, 160, 240, 182, 234, 186, 228, 180, 220, 190, 212, 184, 204, 196, 194, 214, 210, 186],
];
const YB = 404, YT = 214;
let OX = 0, OY = 0; // AOD burn-in offset applied to path drawing

function mtIdx(c) { return c === 1 ? 1 : (c === 3 ? 2 : 0); }

function hw(y) { return G.lerp(112, 34, (YB - y) / (YB - YT)); }

// ---- Everest: running total of floors over all days (St)
function evMetres(d) {
  const key = d.year * 1000 + d.doy;
  const cur = Math.max(d.floors, 0);
  let tot = St.get("evTotal", 0);
  let fl = St.get("evFl", 0);
  const day = St.get("evDay", -1);
  if (day !== key) {
    if (day < 0) tot = Math.max(d.floorsWeek - cur, 0); else tot += fl;
    St.set("evDay", key);
    St.set("evTotal", tot);
    fl = -1;
  }
  if (cur !== fl) St.set("evFl", cur);
  return (tot + cur) * 3;
}

// ---- serpentine geometry: flat segments [type, a, b, c, d, pen, len]
// type 0 line (a,b)->(c,d); 1 right turn (centre a,b radius c, travel 180->0); 2 left turn (180->360)
function geo(c) {
  const L = LEGS[c], q = QG[c];
  const g0 = ((YB - YT) * (1 - q)) / (1 - Math.pow(q, L - 1));
  const g = [];
  let x = CX - hw(YB) + 8, y = YB, tot = 0, xe = x;
  for (let j = 0; j < L; j++) {
    const pn = G.lerp(PEN0[c], PEN1[c], (YB - y) / (YB - YT));
    const ny = y - g0 * Math.pow(q, j);
    const s = j % 2 === 0 ? 1 : -1;
    xe = j < L - 1 ? CX + s * hw((y + ny) / 2) : CX - s * 14;
    g.push(0, x, y, xe, y, pn, Math.abs(xe - x));
    tot += Math.abs(xe - x);
    if (j < L - 1) {
      const r = (y - ny) / 2;
      g.push(s > 0 ? 1 : 2, xe, y - r, r, 0, G.lerp(PEN0[c], PEN1[c], (YB - y + r) / (YB - YT)), Math.PI * r);
      tot += Math.PI * r;
      x = xe;
      y = ny;
    }
  }
  const sy = y - 24;
  const ln = Math.sqrt((CX - xe) * (CX - xe) + 24 * 24);
  g.push(0, xe, y, CX, sy, PEN1[c], ln);
  tot += ln;
  return { g, n: g.length / 7, tot };
}

function segPt(g, k, t) {
  const i = k * 7, ty = g[i];
  if (ty === 0) return [G.lerp(g[i + 1], g[i + 3], t) + OX, G.lerp(g[i + 2], g[i + 4], t) + OY];
  const ang = ty === 1 ? 180 - 180 * t : 180 + 180 * t;
  return [G.ptX(g[i + 1] + OX, g[i + 3], ang), G.ptY(g[i + 2] + OY, g[i + 3], ang)];
}

function segPart(dc, g, k, t0, t1) {
  const i = k * 7, ty = g[i];
  if (ty === 0) {
    dc.drawLine(G.lerp(g[i + 1], g[i + 3], t0) + OX, G.lerp(g[i + 2], g[i + 4], t0) + OY, G.lerp(g[i + 1], g[i + 3], t1) + OX, G.lerp(g[i + 2], g[i + 4], t1) + OY);
  } else if (ty === 1) {
    G.arcC(dc, g[i + 1] + OX, g[i + 2] + OY, g[i + 3], 180 - 180 * t1, 180 - 180 * t0);
  } else {
    G.arcC(dc, g[i + 1] + OX, g[i + 2] + OY, g[i + 3], 180 + 180 * t0, 180 + 180 * t1);
  }
}

// draw path range [s0,s1] (length units); pen = seg pen * mul + add
function path(dc, gm, s0, s1, mul, add) {
  const g = gm.g;
  let acc = 0;
  for (let k = 0; k < gm.n; k++) {
    const ln = g[k * 7 + 6];
    const a = acc, b = acc + ln;
    acc = b;
    if (b <= s0 || a >= s1 || ln <= 0) continue;
    dc.setPenWidth(Math.max(1, g[k * 7 + 5] * mul + add));
    segPart(dc, g, k, (Math.max(s0, a) - a) / ln, (Math.min(s1, b) - a) / ln);
    if (g[k * 7] === 0 && k > 0 && mul > 0.3) {
      // round the joint at the start of straights (smooth turn/leg seams)
      if (s0 <= a) dc.fillCircle(g[k * 7 + 1] + OX, g[k * 7 + 2] + OY, (g[k * 7 + 5] * mul + add) / 2 - 0.5);
    }
  }
}

function pathPt(gm, s) {
  const g = gm.g;
  let acc = 0;
  for (let k = 0; k < gm.n; k++) {
    const ln = g[k * 7 + 6];
    if (s <= acc + ln || k === gm.n - 1) return segPt(g, k, ln > 0 ? G.clamp((s - acc) / ln, 0, 1) : 0);
    acc += ln;
  }
  return [CX, YT];
}

// centre-line dashes between s0 and s1
function dashes(dc, gm, s0, s1, off, pen) {
  const P = 14, D = 6;
  let s = s0 - ((s0 + off) % P);
  dc.setPenWidth(pen);
  const g = gm.g;
  let k = 0, acc = 0;
  for (; s < s1; s += P) {
    const a = Math.max(s, s0), b = Math.min(s + D, s1);
    if (b <= a) continue;
    while (k < gm.n - 1 && acc + g[k * 7 + 6] <= a) { acc += g[k * 7 + 6]; k++; }
    const ln = g[k * 7 + 6];
    segPart(dc, g, k, (a - acc) / ln, G.clamp((b - acc) / ln, 0, 1));
  }
}

function poly(dc, a) {
  const pts = [];
  for (let i = 0; i < a.length; i += 2) pts.push([a[i], a[i + 1]]);
  dc.fillPolygon(pts);
}

// marker label for visual turn at fraction f
function turnLbl(c, f, idx) {
  if (c === 0 || c === 2) {
    const T = TURNS[c];
    return "" + (T + 1 - G.clamp(Math.round(f * (T + 1)), 1, T));
  }
  if (c === 1) return "" + Math.round(f * KM[1]);
  return idx === 0 ? "BC" : "C" + idx;
}

function flag(dc, x, y, h, col, wave) {
  dc.setColor(0xdddddd, -1);
  dc.setPenWidth(2);
  dc.drawLine(x, y, x, y - h);
  dc.setColor(col, -1);
  const w = h * 0.62;
  dc.fillPolygon([[x + 1, y - h], [x + w, y - h + h * 0.2 + wave], [x + 1, y - h + h * 0.42]]);
}

function tower(dc, x, y) {
  dc.setColor(0xcfcfc8, -1);
  dc.fillRectangle(x - 4, y - 24, 8, 24);
  dc.fillRoundedRectangle(x - 7, y - 32, 14, 9, 3);
  dc.setPenWidth(2);
  dc.drawLine(x, y - 32, x, y - 46);
  dc.setColor(0xe0383a, -1);
  dc.fillRectangle(x - 2, y - 44, 4, 4);
  dc.fillRectangle(x - 4, y - 16, 8, 3);
}

function burst(dc, x, y, col, sp, a) {
  const rot = a.live ? (a.t * 0.01) % 30 : 0;
  dc.setColor(G.dim(col, 0.55), -1);
  dc.setPenWidth(2);
  for (let i = 0; i < 12; i++) G.tick(dc, x, y, 17 * sp, 25 * sp, i * 30 + rot);
}

function confetti(dc, x, y, p) {
  if (p >= 1) return;
  let sd = 4711;
  for (let i = 0; i < 28; i++) {
    sd = G.rnd(sd); const ang = G.rf(sd) * 360;
    sd = G.rnd(sd); const sp = 30 + G.rf(sd) * 90;
    const t = p;
    const px = x + Math.sin(ang * 0.0174533) * sp * t;
    const py = y - Math.cos(ang * 0.0174533) * sp * t * 0.8 - 40 * t + 120 * t * t;
    dc.setColor(G.dim(G.hsv(i * 47, 0.8, 1), 1 - t * 0.6), -1);
    dc.fillRectangle(px - 2, py - 2, 4, 4);
  }
}

function progress(d) {
  const c = G.clamp(d.cfg.climb, 0, 3);
  const H = HM[c];
  const m = c === 3 ? evMetres(d) : Math.max(d.floorsWeek, 0) * 3;
  if (c === 3) return { m, H, f: (m % H) / H, sum: Math.floor(m / H), done: false };
  return { m, H, f: G.clamp(m / H, 0, 1), sum: m >= H ? 1 : 0, done: m >= H };
}

// "KEHRE 14" / "KM 12" / "LAGER 2"
function stageStr(c, f, pr, prof) {
  if (pr.done) return "GIPFEL!";
  if (prof && c !== 3) return "KM " + G.fix1(f * KM[c]);
  if (c === 0 || c === 2) {
    const T = TURNS[c];
    const k = T - Math.floor(f * (T + 1));
    return k < 1 ? "ZIEL" : "KEHRE " + k;
  }
  if (c === 1) return "KM " + G.fix1(f * KM[1]);
  const camp = Math.floor(f * 5);
  return camp === 0 ? "BASISLAGER" : "LAGER " + camp;
}

export default {
  fps: 12,

  draw(dc, d, a) {
    const st = d.cfg.style;
    const c = G.clamp(d.cfg.climb, 0, 3);
    const acc = d.accent;
    const p = a.intro;
    const pr = progress(d);
    const night = st === 2;

    // ---- night sky
    if (night) {
      let sd = 97;
      for (let i = 0; i < 46; i++) {
        sd = G.rnd(sd); const x = 30 + G.rf(sd) * 394;
        sd = G.rnd(sd); const y = 40 + G.rf(sd) * 230;
        sd = G.rnd(sd); const b = 0.3 + G.rf(sd) * 0.5;
        const tw = a.live ? 0.75 + 0.25 * Math.sin(a.t * 0.002 + i * 1.7) : 1;
        dc.setColor(G.dim(0xc8d6ff, b * tw * G.ease(p * 2 - i * 0.02)), -1);
        dc.fillRectangle(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
      }
      // moon
      dc.setColor(0xd8deea, -1);
      dc.fillCircle(352, 176, 11);
      dc.setColor(0x000000, -1);
      dc.fillCircle(357, 172, 10);
    }

    // ---- bike ring (weekly km vs goal)
    const goal = d.cfg.bikeGoal;
    const bk = d.wkBike >= 0 ? d.wkBike / 1000 : -1;
    const bf = bk >= 0 && goal > 0 ? G.clamp(bk / goal, 0, 1) : 0;
    G.ring(dc, CX, 227, 222, 3, bf * G.ease(p * 1.3), night ? 0x8fb4ff : G.mix(acc, 0xffffff, 0.45), night ? 0x0d1530 : 0x1a1a1a);

    // ---- header: climb name, time, stage
    const tcol = night ? 0xe4ebff : 0xffffff;
    dc.setColor(night ? 0x6f83b8 : 0x8a8a8a, -1);
    F.px(dc, NAME[c], CX, 26, 2, 1, 0);
    dc.setColor(tcol, -1);
    const prof = st === 3;
    F.st(dc, G.timeStr(d), CX, prof ? 82 : 78, prof ? 64 : 58, prof ? 7 : 6, 1, G.easeInOut(p * 1.25), 0);

    // info line: STAGE · m/H HM
    const s1 = stageStr(c, pr.f, pr, prof);
    const s2 = c === 3 ? G.num(pr.m % pr.H) + "/" + G.num(pr.H) + " M" : G.num(pr.m) + "/" + G.num(pr.H) + " HM";
    const ih = 16, iy = prof ? 140 : 132;
    const w1 = F.stW(s1, ih), w2 = F.stW(s2, ih);
    const ix = CX - (w1 + w2 + 22) / 2;
    const ip = G.ease(p * 1.6 - 0.3);
    dc.setColor(pr.done ? acc : G.mix(0x000000, acc, ip), -1);
    F.st(dc, s1, ix, iy, ih, pr.done ? 3 : 2, 0, ip, 0);
    dc.setColor(G.dim(night ? 0x9fb0d8 : 0xb4b4b4, ip), -1);
    dc.fillCircle(ix + w1 + 11, iy, 2);
    F.st(dc, s2, ix + w1 + 22, iy, ih, 2, 0, ip, 0);
    if (c === 3 && pr.sum > 0) {
      dc.setColor(acc, -1);
      F.px(dc, "^ " + pr.sum + "X GIPFEL", CX, iy + 16, 2, 1, 0);
    }

    if (prof) this.profile(dc, d, a, c, pr);
    else this.serp(dc, d, a, c, pr, night);

    // ---- side data: slot (left) + bike km (right) / bottom pair in profile
    const si = d.cfg.slots[0] === 20 ? 1 : 0;
    const sl = d.slots[si];
    const dp = G.ease(p * 1.5 - 0.4);
    const lx = prof ? 166 : 84, rx = prof ? 288 : 370, ly = prof ? 380 : 214;
    dc.setColor(G.dim(night ? 0x7d8fbf : 0x8a8a8a, dp), -1);
    F.px(dc, sl.lbl, lx, ly, 2, 1, 0);
    F.px(dc, "RAD KM", rx, ly, 2, 1, 0);
    dc.setColor(G.dim(d.dcol, dp), -1);
    F.st(dc, sl.val, lx, ly + 32, 20, 3, 1, 1.0, 0);
    const bs = bk >= 0 ? "" + Math.round(bk) : "--";
    const wb = F.stW(bs, 20), wg = F.stW("/" + goal, 14);
    F.st(dc, bs, rx - (wb + wg + 3) / 2, ly + 32, 20, 3, 0, 1.0, 0);
    dc.setColor(G.dim(night ? 0x7d8fbf : 0x8a8a8a, dp), -1);
    F.st(dc, "/" + goal, rx + (wb + wg + 3) / 2, ly + 35, 14, 2, 2, 1.0, 0);
  },

  serp(dc, d, a, c, pr, night) {
    const p = a.intro;
    const acc = d.accent;
    const mi = mtIdx(c);
    const mp = G.ease(p * 2);
    // mountains
    dc.setColor(G.dim(night ? 0x070c1c : 0x121417, mp), -1);
    poly(dc, FAR[mi]);
    dc.setColor(G.dim(night ? 0x0b1430 : 0x1d2024, mp), -1);
    poly(dc, MT[mi]);
    dc.setColor(G.dim(night ? 0x1f3266 : (c === 1 ? 0x77756e : (c === 3 ? 0x868c96 : 0x5c626b)), mp), -1);
    poly(dc, SNOW[mi]);
    if (night) {
      // moonlit ridge
      const m = MT[mi];
      dc.setColor(G.dim(0x2a427f, mp), -1);
      dc.setPenWidth(2);
      for (let i = 2; i < m.length - 6; i += 2) dc.drawLine(m[i - 2], m[i - 1], m[i], m[i + 1]);
    }

    const gm = geo(c);
    const L = gm.tot;
    const sRoad = L * G.ease(G.clamp(p / 0.55, 0, 1));
    const sRid = pr.f * L * G.easeInOut((p - 0.35) / 0.65);
    const off = a.live ? a.t * 0.012 : 0;

    // road band
    if (night) {
      dc.setColor(0x2c4f9a, -1);
      path(dc, gm, 0, sRoad, 1, 2);
      dc.setColor(0x000000, -1);
      path(dc, gm, 0, sRoad, 1, -2);
    } else {
      dc.setColor(0x5d6066, -1);
      path(dc, gm, 0, sRoad, 1, 2);
      dc.setColor(0x2f3135, -1);
      path(dc, gm, 0, sRoad, 1, -1);
    }
    // centre dashes on the road ahead
    dc.setColor(night ? 0x34548f : 0x9a9a9a, -1);
    dashes(dc, gm, sRid, sRoad, off, 1.5);

    // completed part
    if (sRid > 0.5) {
      if (night) {
        dc.setColor(G.dim(acc, 0.28), -1);
        path(dc, gm, 0, sRid, 1, 6);
        dc.setColor(G.dim(acc, 0.6), -1);
        path(dc, gm, 0, sRid, 1, 0);
        dc.setColor(G.mix(acc, 0xffffff, 0.45), -1);
        path(dc, gm, 0, sRid, 0.35, 0);
      } else {
        dc.setColor(acc, -1);
        path(dc, gm, 0, sRid, 1, -2);
        dc.setColor(G.dim(acc, 0.55), -1);
        dashes(dc, gm, 0, sRid, off, 1.5);
      }
    }

    // turn markers
    let acc0 = 0, ti = 0;
    const g = gm.g;
    const lsc = 2;
    for (let k = 0; k < gm.n; k++) {
      const ln = g[k * 7 + 6];
      if (g[k * 7] !== 0) {
        const mid = acc0 + ln / 2;
        const show = c !== 2 || ti % 2 === 0;
        if (mid < sRoad && show) {
          const side = g[k * 7] === 1 ? 1 : -1;
          const r = g[k * 7 + 3];
          const lbl = turnLbl(c, mid / L, ti);
          const mx = g[k * 7 + 1] + side * (r + g[k * 7 + 5] / 2 + 14);
          const my = g[k * 7 + 2];
          const w = F.pxW(lbl, lsc) + 6;
          const hit = mid <= sRid;
          dc.setColor(hit ? acc : (night ? 0x13224a : 0x3a3d42), -1);
          dc.fillRoundedRectangle(mx - w / 2, my - 4 - lsc * 3, w, lsc * 7 + 6, 3);
          dc.setColor(hit ? 0x000000 : (night ? 0x9fb4e8 : 0xdedede), -1);
          F.px(dc, lbl, mx, my - lsc * 3.5 + 0.5, lsc, 1, 0);
        }
        ti++;
      }
      acc0 += ln;
    }

    // start line
    const st0 = segPt(g, 0, 0);
    dc.setColor(0xffffff, -1);
    dc.fillRectangle(st0[0] - 1, st0[1] - PEN0[c] / 2, 3, PEN0[c]);

    // summit
    const sm = pathPt(gm, L);
    const sp = G.spring(G.clamp((p - 0.45) / 0.35, 0, 1));
    if (pr.done && sp > 0) burst(dc, sm[0], sm[1] - 12, acc, sp, a);
    if (sp > 0) {
      const wave = a.live ? Math.sin(a.t * 0.006) * 2 : 0;
      if (c === 1) tower(dc, sm[0] + 10, sm[1] + 2);
      flag(dc, sm[0] - (c === 1 ? 6 : 0), sm[1], (pr.done ? 30 : 22) * sp, pr.done ? acc : 0xffffff, wave);
    }
    if (pr.done) confetti(dc, sm[0], sm[1] - 20, p);

    // rider
    const rp = pathPt(gm, sRid);
    this.rider(dc, rp[0], rp[1], acc, a, night);
  },

  rider(dc, x, y, acc, a, night) {
    if (a.live) {
      const ph = 0.5 + 0.5 * Math.sin(a.t * 0.005);
      dc.setColor(G.argb(70 + 60 * (1 - ph), acc), -1);
      dc.fillCircle(x, y, 11 + 5 * ph);
    } else {
      dc.setColor(G.argb(110, acc), -1);
      dc.fillCircle(x, y, 13);
    }
    dc.setColor(0x000000, -1);
    dc.fillCircle(x, y, 8);
    dc.setColor(0xffffff, -1);
    dc.fillCircle(x, y, 6);
    dc.setColor(acc, -1);
    dc.fillCircle(x, y, 3);
  },

  profile(dc, d, a, c, pr) {
    const p = a.intro;
    const acc = d.accent;
    const gr = GRAD[c];
    const n = gr.length;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += gr[i];
    const x0 = 38, x1 = 416, yb = 326, yt = 196;
    const sw = (x1 - x0) / n;
    const y0 = yb - 14;
    // rider elevation -> x
    const ef = pr.f * G.easeInOut((p - 0.35) / 0.65);
    let e = 0, rx = x0, ri = 0;
    for (let i = 0; i < n; i++) {
      const ei = gr[i] / sum;
      if (ef <= e + ei || i === n - 1) { rx = x0 + (i + G.clamp((ef - e) / ei, 0, 1)) * sw; ri = i; break; }
      e += ei;
    }
    // grid
    dc.setColor(0x1a1a1a, -1);
    dc.setPenWidth(1);
    for (let k = 1; k <= 3; k++) {
      const gy = y0 - (y0 - yt) * k / 4;
      for (let x = x0; x < x1; x += 8) dc.drawLine(x, gy, x + 3, gy);
    }
    // bars
    e = 0;
    let lx = x0, ly = y0;
    dc.setPenWidth(2);
    for (let i = 0; i < n; i++) {
      e += gr[i] / sum;
      const bp = G.ease(G.stag(p, i, 0.45 / n, 0.3));
      const nx = x0 + (i + 1) * sw;
      const ny = y0 - (y0 - yt) * e;
      if (bp > 0) {
        const g = gr[i];
        const col = g < 5 ? 0x3ddc5a : g < 8 ? 0xffd22e : g <= 10 ? 0xff8a1e : 0xff3b30;
        const ty0 = G.lerp(yb, ly, bp), ty1 = G.lerp(yb, ny, bp);
        const xa = lx + 1, xb = nx - 1;
        const xm = G.clamp(rx, xa, xb);
        const tm = G.lerp(ty0, ty1, (xm - xa) / (xb - xa));
        if (xm > xa) {
          dc.setColor(col, -1);
          dc.fillPolygon([[xa, yb], [xa, ty0], [xm, tm], [xm, yb]]);
        }
        if (xm < xb) {
          dc.setColor(0x202020, -1);
          dc.fillPolygon([[xm, yb], [xm, tm], [xb, ty1], [xb, yb]]);
          dc.setColor(G.dim(col, 0.75), -1);
          dc.setPenWidth(3);
          dc.drawLine(xm, tm + 1, xb, ty1 + 1);
        }
        if (xm > xa) {
          dc.setColor(0xffffff, -1);
          dc.setPenWidth(2);
          dc.drawLine(xa - 1, ty0 - 1, xm, tm - 1);
        }
      }
      lx = nx; ly = ny;
    }
    // remaining height to the summit
    const rem = pr.done ? 0 : Math.round(pr.H * (1 - pr.f));
    const tp = G.ease(p * 1.5 - 0.4);
    dc.setColor(G.dim(0x8a8a8a, tp), -1);
    F.px(dc, "NOCH", 48, 184, 2, 0, 0);
    dc.setColor(G.dim(0xffffff, tp), -1);
    F.st(dc, G.num(rem) + " HM", 48, 214, 18, 3, 0, 1.0, 0);
    // base line
    dc.setColor(0x444444, -1);
    dc.fillRectangle(x0, yb + 2, (x1 - x0) * G.ease(p * 2), 2);
    // summit flag
    const sp = G.spring(G.clamp((p - 0.4) / 0.35, 0, 1));
    if (pr.done && sp > 0) burst(dc, x1 - 2, yt - 14, acc, sp, a);
    if (sp > 0) {
      if (c === 1) tower(dc, x1 - 4, yt - 2);
      else flag(dc, x1 - 2, yt - 2, (pr.done ? 30 : 22) * sp, pr.done ? acc : 0xffffff, a.live ? Math.sin(a.t * 0.006) * 2 : 0);
    }
    if (pr.done) confetti(dc, x1 - 10, yt - 20, p);
    // rider marker + gradient bubble
    let ry = y0;
    e = 0;
    for (let i = 0; i < ri; i++) e += gr[i] / sum;
    const ei = gr[ri] / sum;
    ry = y0 - (y0 - yt) * (e + ei * G.clamp((rx - x0 - ri * sw) / sw, 0, 1));
    const g = gr[ri];
    const col = g < 5 ? 0x3ddc5a : g < 8 ? 0xffd22e : g <= 10 ? 0xff8a1e : 0xff3b30;
    const lp = G.ease((p - 0.8) / 0.2);
    if (lp > 0 && !pr.done) {
      const lbl = G.fix1(g) + "%";
      const bw = F.stW(lbl, 16) + 16;
      const bx = G.clamp(rx, 40 + bw / 2, 414 - bw / 2);
      const by = ry - 36;
      dc.setColor(0x777777, -1);
      dc.setPenWidth(1);
      dc.drawLine(rx, by + 12, rx, ry - 8);
      dc.setColor(G.dim(col, lp), -1);
      dc.fillRoundedRectangle(bx - bw / 2, by - 12, bw, 24, 7);
      dc.setColor(0x000000, -1);
      F.st(dc, lbl, bx, by, 16, 2, 1, 1.0, 0);
    }
    this.rider(dc, rx, ry - 2, acc, a, false);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const c = G.clamp(d.cfg.climb, 0, 3);
    const pr = progress(d);
    dc.setColor(0x8a8a8a, -1);
    F.st(dc, G.timeStr(d), CX + o[0], 84 + o[1], 58, 3, 1, 1.0, 0);
    const gm = geo(c);
    OX = o[0]; OY = o[1];
    dc.setColor(0x3a3a3a, -1);
    path(dc, gm, 0, gm.tot, 0, 2);
    dc.setColor(G.dim(d.accent, 0.6), -1);
    path(dc, gm, 0, pr.f * gm.tot, 0, 3);
    const rp = pathPt(gm, pr.f * gm.tot);
    dc.setColor(0xbbbbbb, -1);
    dc.fillCircle(rp[0], rp[1], 5);
    dc.setColor(0x000000, -1);
    dc.fillCircle(rp[0], rp[1], 2);
    const sm = pathPt(gm, gm.tot);
    OX = 0; OY = 0;
    dc.setColor(0x777777, -1);
    dc.setPenWidth(1);
    dc.drawLine(sm[0], sm[1], sm[0], sm[1] - 18);
    dc.fillPolygon([[sm[0], sm[1] - 18], [sm[0] + 11, sm[1] - 14], [sm[0], sm[1] - 10]]);
  },
};
