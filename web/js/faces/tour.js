// TOUR — "Tour de Woche": the ISO week as a 7-stage race. The route runs around the dial from
// START (Monday) over the top to the ZIEL (Sunday); training days are won stages. Three jerseys
// (Wertungen): yellow = weekly bike km, green = training days, polka dot = climbed metres.
// Styles: 1 Maillot, 2 Klassik (paper), 3 Nacht (neon). Mirrors watch/source/faces/Tour.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const CX = 227, CY = 227;
const NS = 113; // route samples (16 per stage)
const SEG = 16;
const DAYS = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];
const DAYN = ["MONTAG", "DIENSTAG", "MITTWOCH", "DONNERSTAG", "FREITAG", "SAMSTAG", "SONNTAG"];
const TYP = [0, 1, 2, 0, 3, 2, 0];
const TYPN = ["FLACH", "HÜGELIG", "BERGANKUNFT", "ZEITFAHREN"];
const JY = 336; // jersey row centre
const JX = [131, 227, 323];
const JCOL = [0xffd400, 0x1fb24a, 0xf4f4f4];
const RED = 0xe0242b;
// jersey geometry (unit = px at scale 1): torso, right sleeve, outline, polka dots
const JT = [-21, -23, -8, -27, 8, -27, 21, -23, 19, 27, -19, 27];
const JS = [21, -23, 33, -8, 25, -1, 18, -6];
const JO = [-8, -27, 0, -21, 8, -27, 21, -23, 33, -8, 25, -1, 20, -6, 19, 27, -19, 27, -20, -6, -25, -1, -33, -8, -21, -23];
const PD = [-11, -13, 11, -13, 0, -5, -12, 4, 12, 4, 0, 13, -10, 21, 10, 21, 27, -10, -27, -10];

let RX = null, RY = null;

// route samples: a hand-drawn looking loop from 250° clockwise over the top to 110°
function geo() {
  if (RX !== null) return;
  RX = [];
  RY = [];
  for (let i = 0; i < NS; i++) {
    const u = i / (NS - 1);
    const r = 183 + 7 * Math.sin(u * 17.0 + 0.4) + 3 * Math.sin(u * 41.0);
    const deg = 250 + u * 220 + 3 * Math.sin(u * 23.0);
    RX.push(G.ptX(CX, r, deg));
    RY.push(G.ptY(CY, r, deg));
  }
}

// polygon from a flat coordinate list, scaled, optionally mirrored
function poly(dc, arr, x, y, s, mir) {
  const pts = [];
  for (let i = 0; i < arr.length; i += 2) pts.push([x + arr[i] * s * mir, y + arr[i + 1] * s]);
  dc.fillPolygon(pts);
}

// one jersey. kind 0 yellow, 1 green, 2 polka. frac 0..1 fill level, worn = goal reached
function jersey(dc, x, y, s, kind, frac, worn, st, bg, sp) {
  let base = JCOL[kind];
  if (st === 2) base = G.mix(base, 0x8b5a2b, 0.12);
  const dark = G.mix(base, kind === 2 ? 0x8a8a8a : 0x000000, kind === 2 ? 0.6 : 0.32);
  if (worn) {
    const gc = st === 2 ? 0xf1e6cc : bg;
    dc.setColor(G.mix(gc, base, 0.14), -1);
    dc.fillCircle(x, y, 38 * s);
    dc.setColor(G.mix(gc, base, 0.26), -1);
    dc.fillCircle(x, y, 31 * s);
  }
  const fy = y + 27 * s - 54 * s * frac;
  const clip = !worn && frac < 0.999;
  if (frac > 0.005) {
    if (clip) dc.setClip(x - 36 * s, fy, 72 * s, y + 30 * s - fy);
    dc.setColor(worn ? base : G.mix(bg, base, 0.8), -1);
    poly(dc, JT, x, y, s, 1);
    poly(dc, JS, x, y, s, 1);
    poly(dc, JS, x, y, s, -1);
    // collar (inside of the back) + zip
    dc.setColor(dark, -1);
    dc.fillPolygon([[x - 8 * s, y - 27 * s], [x + 8 * s, y - 27 * s], [x, y - 21 * s]]);
    if (kind === 2) {
      dc.setColor(st === 2 ? G.mix(RED, 0x8b5a2b, 0.2) : RED, -1);
      for (let i = 0; i < PD.length; i += 2) dc.fillCircle(x + PD[i] * s, y + PD[i + 1] * s, 3.4 * s);
    } else {
      dc.setPenWidth(Math.max(1, 2 * s));
      dc.drawLine(x, y - 21 * s, x, y + 25 * s);
      // cuffs + hem
      dc.setPenWidth(Math.max(1, 3 * s));
      dc.drawLine(x + 32 * s, y - 7 * s, x + 25 * s, y);
      dc.drawLine(x - 32 * s, y - 7 * s, x - 25 * s, y);
      dc.fillRectangle(x - 19 * s, y + 23 * s, 38 * s, 4 * s);
    }
    if (clip) dc.clearClip();
  }
  // outline
  let oc;
  if (worn) oc = st === 2 ? 0x3a2817 : dark;
  else oc = st === 2 ? G.mix(0xf1e6cc, 0x3a2817, 0.7) : G.mix(bg, base, 0.6);
  dc.setColor(oc, -1);
  dc.setPenWidth(2);
  let px = x + JO[JO.length - 2] * s, py = y + JO[JO.length - 1] * s;
  for (let i = 0; i < JO.length; i += 2) {
    const nx = x + JO[i] * s, ny = y + JO[i + 1] * s;
    dc.drawLine(px, py, nx, ny);
    px = nx;
    py = ny;
  }
  // sparkles on a worn jersey
  if (worn && sp >= 0) {
    for (let k = 0; k < 3; k++) {
      let ph = sp + k * 0.33;
      if (ph >= 1) ph -= 1;
      const r = (1.0 - Math.abs(ph * 2 - 1)) * 6 * s;
      if (r < 1) continue;
      const ang = kind * 70 + k * 125 + 30;
      const sx = G.ptX(x, 34 * s, ang), sy = G.ptY(y, 32 * s, ang);
      dc.setColor(st === 2 ? 0x8b5a2b : 0xffffff, -1);
      dc.fillPolygon([[sx, sy - r * 1.6], [sx + r * 0.35, sy - r * 0.35], [sx + r * 1.6, sy], [sx + r * 0.35, sy + r * 0.35],
        [sx, sy + r * 1.6], [sx - r * 0.35, sy + r * 0.35], [sx - r * 1.6, sy], [sx - r * 0.35, sy - r * 0.35]]);
    }
  }
}

// tiny side-view cyclist, wheels on (x, y), facing right (f = 1) or left (-1)
function rider(dc, x, y, f, col, ink, crank) {
  dc.setColor(ink, -1);
  dc.setPenWidth(2);
  dc.drawCircle(x - 6 * f, y - 4, 4);
  dc.drawCircle(x + 6 * f, y - 4, 4);
  dc.setColor(col, -1);
  dc.drawLine(x - 6 * f, y - 4, x, y - 4);
  dc.drawLine(x, y - 4, x + 4 * f, y - 10);
  dc.drawLine(x - 3 * f, y - 10, x + 4 * f, y - 10);
  dc.drawLine(x + 4 * f, y - 10, x + 6 * f, y - 4);
  // rider: back, arm, head, leg
  dc.setPenWidth(3);
  dc.drawLine(x - 2 * f, y - 12, x + 4 * f, y - 16);
  dc.drawLine(x + 4 * f, y - 16, x + 6 * f, y - 11);
  dc.drawLine(x - 2 * f, y - 12, x + G.ptX(0, 3, crank) * f, y - 4 + G.ptY(0, 3, crank));
  dc.fillCircle(x + 6 * f, y - 19, 3);
}

function routePt(u) {
  const fi = G.clamp(u, 0, 1) * (NS - 1);
  const i = Math.min(NS - 2, Math.floor(fi));
  const t = fi - i;
  return [G.lerp(RX[i], RX[i + 1], t), G.lerp(RY[i], RY[i + 1], t), RX[i + 1] >= RX[i] ? 1 : -1];
}

// stage profile bars of today's stage type
function profile(dc, x0, yb, typ, k, col, col2, pr) {
  let seed = G.rnd(k * 977 + 13);
  for (let i = 0; i < 28; i++) {
    const u = i / 27;
    let h;
    seed = G.rnd(seed);
    const n = G.rf(seed);
    if (typ === 0) h = 4 + 3 * G.noise(u * 9 + k) + n * 2;
    else if (typ === 1) h = 8 + 8 * Math.abs(G.noise(u * 7 + k * 1.7)) + 4 * Math.sin(u * 9.4) + n * 2;
    else if (typ === 2) h = 5 + 26 * Math.pow(u, 1.8) + 5 * Math.abs(G.noise(u * 6 + k)) + n * 2;
    else h = 5 + 2 * Math.sin(u * 6.3) + n;
    h = Math.max(2, h) * pr;
    dc.setColor(i === 27 ? col2 : col, -1);
    dc.fillRectangle(x0 + i * 5, yb - h, 4, h);
  }
}

function fmtKm(v) { return "" + Math.floor(v); }

export default {
  fps: 10,

  draw(dc, d, a) {
    geo();
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const t = a.t;
    const live = a.live && p >= 1;
    const di = G.clamp(d.dayIdx, 0, 6);

    // ---- palette
    let bg = 0x000000, ink = 0xffffff, sub = 0x9a9a9a, done = acc, fut = 0x4a4a4a, tod = 0xd8d8d8, rest = 0x5c5c5c, glow = -1;
    if (st === 2) {
      bg = 0xf1e6cc; ink = 0x3a2817; sub = 0x7a5a3a; done = 0x8b5a2b; fut = 0xc2ab84; tod = 0x5a3a1f; rest = 0xa8916c;
    } else if (st === 3) {
      bg = 0x07102a; ink = 0xe8f0ff; sub = 0x7f93c4; done = 0x27e3ff; fut = 0x2a3f75; tod = 0x9fdcff; rest = 0x34497f; glow = 0x0b3d63;
    }
    const won = st === 2 ? G.mix(acc, 0x8b5a2b, 0.1) : acc;

    // ---- background
    if (st === 2) {
      dc.setColor(bg, -1);
      dc.fillCircle(CX, CY, 215);
      dc.setColor(0xe6d6b2, -1);
      dc.setPenWidth(14);
      dc.drawCircle(CX, CY, 221);
      dc.setColor(0xd8c49c, -1);
      dc.setPenWidth(2);
      dc.drawCircle(CX, CY, 220);
      let s = 4711;
      dc.setColor(0xe0cfa9, -1);
      for (let i = 0; i < 46; i++) {
        s = G.rnd(s);
        const ang = G.rf(s) * 360;
        s = G.rnd(s);
        const r = Math.sqrt(G.rf(s)) * 205;
        dc.fillRectangle(G.ptX(CX, r, ang), G.ptY(CY, r, ang), 2, 2);
      }
    } else if (st === 3) {
      dc.setColor(bg, -1);
      dc.fillCircle(CX, CY, 227);
      let s = 1234;
      for (let i = 0; i < 28; i++) {
        s = G.rnd(s);
        const ang = G.rf(s) * 360;
        s = G.rnd(s);
        const r = 30 + G.rf(s) * 190;
        dc.setColor(i % 3 === 0 ? 0x4a5f9a : 0x26386a, -1);
        dc.fillRectangle(G.ptX(CX, r, ang), G.ptY(CY, r, ang), 2, 2);
      }
    }

    // ---- route
    const rp = G.easeInOut(G.clamp(p / 0.7, 0, 1));
    const shown = Math.floor(rp * (NS - 1) + 0.001);
    const solidEnd = di * SEG;
    if (shown > 0 && solidEnd > 0) {
      const e = Math.min(shown, solidEnd);
      if (glow !== -1) {
        dc.setColor(glow, -1);
        dc.setPenWidth(10);
        for (let i = 0; i < e; i += 4) dc.drawLine(RX[i], RY[i], RX[i + 4], RY[i + 4]);
      }
      dc.setColor(done, -1);
      dc.setPenWidth(4);
      for (let i = 0; i < e; i += 2) dc.drawLine(RX[i], RY[i], RX[i + 2], RY[i + 2]);
    }
    for (let i = solidEnd; i <= shown; i++) {
      const tday = i < solidEnd + SEG;
      dc.setColor(tday ? tod : fut, -1);
      dc.fillCircle(RX[i], RY[i], tday ? 2.2 : 1.9);
    }

    // ---- START / ZIEL
    dc.setColor(ink, -1);
    dc.setPenWidth(4);
    dc.drawLine(RX[0] - 9, RY[0] + 3, RX[0] + 9, RY[0] - 3);
    dc.setColor(sub, -1);
    F.px(dc, "START", RX[0] + 14, RY[0] - 2, 2, 0, 0);
    if (shown >= NS - 1) {
      F.px(dc, "ZIEL", RX[NS - 1] - 14, RY[NS - 1] + 5, 2, 2, 0);
    }

    // ---- stage dots
    for (let k = 0; k < 7; k++) {
      const i = (k + 1) * SEG;
      const pk = G.clamp((rp * (NS - 1) - i) / 10.0 + 1.0, 0, 1);
      if (pk <= 0) continue;
      const sc = G.spring(pk);
      const x = RX[i], y = RY[i];
      const isW = ((d.trainMask >> k) & 1) === 1 && k <= di;
      const wt = G.clamp((rp * (NS - 1) - i) / 12.0, 0, 1);
      // today's pulse
      if (k === di && live) {
        const ph = (t % 1400) / 1400.0;
        dc.setColor(G.mix(bg, isW ? won : tod, 1 - ph), -1);
        dc.setPenWidth(2);
        dc.drawCircle(x, y, 9 + ph * 12);
      }
      if (isW) {
        const r = 8 * sc;
        if (glow !== -1) { dc.setColor(G.dim(won, 0.3), -1); dc.fillCircle(x, y, r + 5); }
        if (st === 2) { dc.setColor(ink, -1); dc.fillCircle(x, y, r + 2); }
        dc.setColor(G.mix(st === 2 ? bg : 0xffffff, won, wt), -1);
        dc.fillCircle(x, y, r);
        // pennant on a pole (springs up)
        const fs = G.spring(G.clamp(wt * 1.4 - 0.2, 0, 1));
        if (fs > 0.02 && k < 6) {
          dc.setColor(ink, -1);
          dc.setPenWidth(2);
          dc.drawLine(x + 5, y - 3, x + 5, y - 3 - 16 * fs);
          dc.setColor(won, -1);
          dc.fillPolygon([[x + 6, y - 3 - 16 * fs], [x + 6 + 10 * fs, y - 3 - 13 * fs], [x + 6, y - 3 - 10 * fs]]);
        }
        dc.setColor(st === 2 ? ink : 0x000000, -1);
        dc.fillCircle(x, y, 2.5 * sc);
      } else if (k < di) {
        dc.setColor(rest, -1);
        dc.fillCircle(x, y, 5 * sc);
      } else if (k === di) {
        dc.setColor(tod, -1);
        dc.fillCircle(x, y, 7 * sc);
        dc.setColor(bg, -1);
        dc.fillCircle(x, y, 3 * sc);
      } else {
        dc.setColor(bg, -1);
        dc.fillCircle(x, y, 6 * sc);
        dc.setColor(fut === 0x4a4a4a ? 0x777777 : fut, -1);
        dc.setPenWidth(2);
        dc.drawCircle(x, y, 6 * sc);
      }
      // finish flag (checkered) at the ZIEL
      if (k === 6) {
        const fx = x + 8, fy = y - 18;
        dc.setColor(ink, -1);
        dc.setPenWidth(2);
        dc.drawLine(fx, y + 4, fx, fy);
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 4; c++) {
            dc.setColor((r + c) % 2 === 0 ? ink : (st === 2 ? bg : 0x000000), -1);
            dc.fillRectangle(fx + 1 + c * 4, fy + r * 4, 4, 4);
          }
        }
        dc.setColor(ink, -1);
        dc.setPenWidth(1);
        dc.drawRectangle(fx + 1, fy, 16, 12);
      }
      // weekday label, inside the loop
      const dx = CX - x, dy = CY - y;
      const ln = Math.sqrt(dx * dx + dy * dy);
      const lx = x + dx / ln * 24, ly = y + dy / ln * 24;
      dc.setColor(k === di ? (st === 1 ? acc : ink) : sub, -1);
      F.px(dc, DAYS[k], lx, ly - 7, 2, 1, 0);
    }

    // ---- rider on today's stage
    if (p > 0.75) {
      let f;
      if (live) f = (t % 5200) / 5200.0;
      else f = G.clamp(d.mins / 1440.0, 0.08, 0.92);
      const u = (di * SEG + f * SEG) / (NS - 1);
      const rp2 = routePt(u);
      rider(dc, rp2[0], rp2[1] - 2, rp2[2], st === 1 ? acc : (st === 2 ? 0x8b2a1b : 0xff5ad1), ink, live ? (t % 600) * 0.6 : 40);
    }

    // ---- time
    const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
    const ts = hh + ":" + G.pad2(d.m);
    const tp = G.ease(G.clamp(p * 1.5, 0, 1));
    if (st === 1) {
      dc.setColor(ink, -1);
      F.st(dc, ts, CX, 167, 66, 8, 1, tp, 0.12);
    } else if (st === 2) {
      dc.setColor(ink, -1);
      F.st(dc, ts, CX, 167, 66, 5, 1, tp, 0);
    } else {
      dc.setColor(ink, -1);
      F.st(dc, ts, CX, 167, 66, 6, 1, tp, 0);
    }
    dc.setColor(G.mix(bg, sub, tp), -1);
    F.px(dc, "KW " + d.wk, CX, 100, 2, 1, 0);

    // ---- stage line: "ETAPPE 5 · FREITAG"
    const lp = G.ease(G.stag(p, 3, 0.1, 0.4));
    if (lp > 0) {
      const s1 = "ETAPPE " + (di + 1);
      const s2 = DAYN[di];
      const w1 = F.stW(s1, 15), w2 = F.stW(s2, 15);
      const x0 = CX - (w1 + 20 + w2) / 2;
      const ly = 226;
      if (st === 2) {
        // vintage ribbon
        const rw = w1 + w2 + 56;
        dc.setColor(0x6e4423, -1);
        dc.fillPolygon([[CX - rw / 2 - 14, ly - 10], [CX - rw / 2 + 4, ly - 10], [CX - rw / 2 + 4, ly + 14], [CX - rw / 2 - 14, ly + 14], [CX - rw / 2 - 7, ly + 2]]);
        dc.fillPolygon([[CX + rw / 2 + 14, ly - 10], [CX + rw / 2 - 4, ly - 10], [CX + rw / 2 - 4, ly + 14], [CX + rw / 2 + 14, ly + 14], [CX + rw / 2 + 7, ly + 2]]);
        dc.setColor(0x8b5a2b, -1);
        dc.fillRectangle(CX - rw / 2, ly - 14, rw, 26);
      }
      const c1 = st === 2 ? 0xf1e6cc : (st === 1 ? acc : done);
      const c2 = st === 2 ? 0xf1e6cc : ink;
      dc.setColor(G.mix(bg, c1, lp), -1);
      F.st(dc, s1, x0, ly - 1, 15, 2, 0, 1.0, 0);
      dc.fillCircle(x0 + w1 + 10, ly - 1, 2.5);
      dc.setColor(G.mix(bg, c2, lp), -1);
      F.st(dc, s2, x0 + w1 + 20, ly - 1, 15, 2, 0, 1.0, 0);
    }

    // ---- stage profile of today
    const pp = G.ease(G.stag(p, 4, 0.1, 0.4));
    if (pp > 0) {
      const trained = ((d.trainMask >> di) & 1) === 1;
      const pc = st === 2 ? (trained ? 0x8b5a2b : 0xc9b48e) : st === 3 ? (trained ? 0x27a6c9 : 0x24386c) : (trained ? G.dim(acc, 0.75) : 0x3a3a3a);
      profile(dc, CX - 70, 282, TYP[di], di, pc, st === 2 ? ink : (trained ? acc : sub), pp);
      dc.setColor(sub, -1);
      F.px(dc, TYPN[TYP[di]], CX, 288, 2, 1, 0);
    }

    // ---- jerseys
    const km = d.wkBike > 0 ? d.wkBike / 1000.0 : 0;
    const kg = d.cfg.bikeGoal > 0 ? d.cfg.bikeGoal : 1;
    const hmv = d.floorsWeek > 0 ? d.floorsWeek * 3 : 0;
    const fr = [km / kg, d.dayGoal > 0 ? d.trainDays / d.dayGoal : 0, hmv / 1500.0];
    const vals = [fmtKm(km) + "/" + kg, d.trainDays + "/" + d.dayGoal, G.num(hmv) + "/" + G.num(1500)];
    const units = ["KM", "TAGE", "HM"];
    for (let k = 0; k < 3; k++) {
      const jp = G.stag(p, k, 0.1, 0.45);
      const js = G.spring(jp);
      if (jp <= 0) continue;
      const fill = G.clamp(fr[k], 0, 1) * G.ease(G.stag(p - 0.35, k, 0.1, 0.45));
      const worn = fr[k] >= 1 && p >= 1;
      const sp = worn && live ? ((t + k * 400) % 2400) / 2400.0 : (worn ? 0.15 + k * 0.1 : -1);
      jersey(dc, JX[k], JY, 0.82 * js, k, fill, worn, st, bg, sp);
      const vc = worn ? (st === 2 ? ink : (k === 2 ? 0xffffff : G.mix(JCOL[k], 0xffffff, 0.2))) : ink;
      dc.setColor(G.mix(bg, vc, jp), -1);
      F.px(dc, vals[k], JX[k], JY + 30, 2, 1, 0);
      dc.setColor(G.mix(bg, sub, jp), -1);
      F.px(dc, units[k], JX[k], JY + 48, 2, 1, 0);
    }
  },

  aod(dc, d) {
    geo();
    const o = St.shift(d);
    const ox = o[0], oy = o[1];
    const di = G.clamp(d.dayIdx, 0, 6);
    dc.setColor(0x3a3a3a, -1);
    for (let i = 0; i < NS; i += 2) dc.fillRectangle(RX[i] + ox - 1, RY[i] + oy - 1, 2, 2);
    for (let k = 0; k < 7; k++) {
      const i = (k + 1) * SEG;
      const isW = ((d.trainMask >> k) & 1) === 1 && k <= di;
      dc.setColor(isW ? G.dim(d.accent, 0.6) : (k === di ? 0x8a8a8a : 0x4a4a4a), -1);
      if (isW) dc.fillCircle(RX[i] + ox, RY[i] + oy, 5);
      else { dc.setPenWidth(2); dc.drawCircle(RX[i] + ox, RY[i] + oy, 5); }
    }
    const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
    dc.setColor(0x9a9a9a, -1);
    F.st(dc, hh + ":" + G.pad2(d.m), CX + ox, 167 + oy, 66, 3, 1, 1.0, 0.12);
    dc.setColor(G.dim(d.accent, 0.55), -1);
    F.st(dc, "ETAPPE " + (di + 1), CX + ox, 226 + oy, 15, 2, 1, 1.0, 0);
  },
};
