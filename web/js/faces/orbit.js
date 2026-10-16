// ORBIT — a solar system as a clock: hour gas giant on the outer orbit, minute
// earth (with a moon in its real phase) on the middle orbit, a seconds comet on
// the inner orbit, steps as an asteroid belt. Styles: 1 Kosmos, 2 Blueprint,
// 3 Eclipse. Mirrors watch/source/faces/Orbit.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const CX = 227;
const RH = 186; // hour orbit
const RM = 136; // minute orbit
const RS = 70; // seconds orbit
const RB = 214; // asteroid belt
const TY = 331; // time centre
const DY = 130; // date top
const RAD = Math.PI / 180;

const face = {
  fps: 20,

  // filled lens/phase polygon: limb on the `dir` side (clock degrees),
  // terminator at c * r * cos (c = 1 nothing, 0 half, -1 full disc).
  lens(dc, x, y, r, dir, c) {
    const ux = Math.sin(dir * RAD), uy = -Math.cos(dir * RAD);
    const vx = -uy, vy = ux;
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = (-90 + i * 22.5) * RAD;
      const a = r * Math.cos(t), b = r * Math.sin(t);
      pts.push([x + ux * a + vx * b, y + uy * a + vy * b]);
    }
    for (let i = 8; i >= 0; i--) {
      const t = (-90 + i * 22.5) * RAD;
      const a = r * Math.cos(t) * c, b = r * Math.sin(t);
      pts.push([x + ux * a + vx * b, y + uy * a + vy * b]);
    }
    dc.fillPolygon(pts);
  },

  // upper (top=true) or lower half of an axis-aligned ellipse as a polyline
  halfEll(dc, x, y, a, b, top) {
    let px = x - a, py = y;
    for (let i = 1; i <= 10; i++) {
      const t = i * 18 * RAD;
      const nx = x - a * Math.cos(t);
      const ny = top ? y - b * Math.sin(t) : y + b * Math.sin(t);
      dc.drawLine(px, py, nx, ny);
      px = nx; py = ny;
    }
  },

  // moon disc in its real phase (waxing lit on the right)
  moonDisc(dc, x, y, r, ph, lit, dark) {
    if (dark !== -1) { dc.setColor(dark, -1); dc.fillCircle(x, y, r); }
    const il = (1 - Math.cos(ph * 2 * Math.PI)) / 2;
    if (il < 0.03) {
      if (dark === -1) { dc.setColor(G.dim(lit, 0.5), -1); dc.setPenWidth(1); dc.drawCircle(x, y, r); }
      return;
    }
    dc.setColor(lit, -1);
    face.lens(dc, x, y, r, ph < 0.5 ? 90 : 270, Math.cos(ph * 2 * Math.PI));
  },

  // dotted orbit, drawn clockwise from 12 o'clock up to `frac`
  orbit(dc, r, frac, step) {
    const n = 4 * Math.round((2 * Math.PI * r) / step / 4);
    if (frac >= 1) {
      // full circle: one quadrant of trig, mirrored 4x
      for (let i = 0; i < n / 4; i++) {
        const t = (i * 360) / n;
        const sx = r * Math.sin(t * RAD) - 1, cy = r * Math.cos(t * RAD);
        dc.fillRectangle(CX + sx, CX - cy - 1, 2, 2);
        dc.fillRectangle(CX + cy - 1, CX + sx, 2, 2);
        dc.fillRectangle(CX - sx - 2, CX + cy - 1, 2, 2);
        dc.fillRectangle(CX - cy - 1, CX - sx - 2, 2, 2);
      }
      return;
    }
    const m = Math.floor(n * frac);
    for (let i = 0; i < m; i++) {
      const t = (i * 360) / n;
      dc.fillRectangle(G.ptX(CX, r, t) - 1, G.ptY(CX, r, t) - 1, 2, 2);
    }
  },

  // time moves to the top while the minute planet passes below it
  flip(d) {
    const ma = d.m * 6 + d.s * 0.1;
    return ma > 128 && ma < 232;
  },

  stars(dc, a, col) {
    let sd = 4242;
    for (let i = 0; i < 40; i++) {
      sd = G.rnd(sd); const x = 14 + G.rf(sd) * 426;
      sd = G.rnd(sd); const y = 14 + G.rf(sd) * 426;
      sd = G.rnd(sd); const b = 0.3 + G.rf(sd) * 0.7;
      const dx = x - CX, dy = y - CX;
      const rr = dx * dx + dy * dy;
      if (rr > 218 * 218 || rr < 48 * 48) continue;
      if (Math.abs(dx) < 98 && (Math.abs(y - TY) < 36 || Math.abs(y - (454 - TY)) < 36)) continue;
      if (Math.abs(dx) < 72 && (Math.abs(y - DY - 7) < 15 || Math.abs(y - (447 - DY)) < 15)) continue;
      let k = b;
      if (a.live) k = b * (0.5 + 0.5 * Math.sin(a.t * 0.0027 + i * 2.1));
      dc.setColor(G.dim(col, k), -1);
      if (b > 0.88) dc.fillCircle(x, y, 1.5);
      else dc.fillRectangle(x, y, 2, 2);
    }
  },

  sun(dc, a, st, acc, p) {
    const pu = a.live ? Math.sin(a.t * 0.003) : 0;
    const s = G.ease(p * 2);
    if (st === 2) {
      dc.setColor(acc, -1);
      dc.setPenWidth(2);
      dc.drawCircle(CX, CX, 22 * s);
      dc.setPenWidth(1);
      dc.drawCircle(CX, CX, (30 + pu) * s);
      dc.fillCircle(CX, CX, 3);
      dc.setColor(G.dim(acc, 0.5), -1);
      for (let k = 0; k < 4; k++) G.tick(dc, CX, CX, 36, 56, k * 90);
      return;
    }
    if (st === 3) {
      dc.setColor(0x141414, -1); dc.fillCircle(CX, CX, (44 + pu * 2) * s);
      dc.setColor(0x2c2c2c, -1); dc.fillCircle(CX, CX, (36 + pu) * s);
      dc.setColor(0x6a6a6a, -1); dc.fillCircle(CX, CX, 30 * s);
      dc.setColor(0x5a5a5a, -1);
      dc.setPenWidth(2);
      const rot = a.live ? a.t * 0.004 : 0;
      for (let k = 0; k < 12; k++) G.tick(dc, CX, CX, 30 * s, (k % 2 === 0 ? 50 : 41) * s, rot + k * 30);
      dc.setColor(0xffffff, -1);
      dc.fillCircle(CX, CX, 27 * s);
      dc.setColor(0, -1);
      dc.fillCircle(CX, CX, 24.5 * s);
      // diamond ring bead
      dc.setColor(0xffffff, -1);
      dc.fillCircle(G.ptX(CX, 26 * s, 128), G.ptY(CX, 26 * s, 128), 3.5 * s);
      return;
    }
    dc.setColor(0x2a1000, -1); dc.fillCircle(CX, CX, (42 + pu * 2.5) * s);
    dc.setColor(0x5c2405, -1); dc.fillCircle(CX, CX, (35 + pu * 1.5) * s);
    dc.setColor(0xb4480c, -1); dc.fillCircle(CX, CX, 29 * s);
    dc.setColor(0xff7a1a, -1); dc.fillCircle(CX, CX, 24 * s);
    dc.setColor(0xffae40, -1); dc.fillCircle(CX, CX, 17 * s);
    dc.setColor(0xffe6a8, -1); dc.fillCircle(CX, CX, 9 * s);
  },

  // ringed gas giant; sd = direction to the sun (clock degrees)
  giant(dc, x, y, st, acc, sd) {
    const r = 19;
    let ring, body, band, shade;
    if (st === 1) { ring = 0xb89a6a; body = 0xe4c896; band = 0xb88a54; shade = 0x2a2014; }
    else if (st === 3) { ring = 0x8a8a8a; body = 0xd8d8d8; band = 0xa8a8a8; shade = 0x1a1a1a; }
    else { ring = acc; body = 0; band = G.dim(acc, 0.5); shade = G.dim(acc, 0.22); }
    dc.setColor(ring, -1);
    dc.setPenWidth(3);
    if (st === 2) dc.setPenWidth(1);
    face.halfEll(dc, x, y, 36, 10, true);
    dc.setColor(body, -1);
    dc.fillCircle(x, y, r);
    if (st !== 2) {
      dc.setColor(band, -1);
      dc.setPenWidth(3);
      dc.drawLine(x - 17, y - 7, x + 17, y - 7);
      dc.setPenWidth(2);
      dc.drawLine(x - 18, y + 5, x + 18, y + 5);
    }
    dc.setColor(shade, -1);
    face.lens(dc, x, y, r, sd + 180, 0.3);
    if (st === 2) {
      dc.setColor(acc, -1);
      dc.setPenWidth(2);
      dc.drawCircle(x, y, r);
    }
    dc.setColor(ring, -1);
    dc.setPenWidth(st === 2 ? 1 : 3);
    face.halfEll(dc, x, y, 36, 10, false);
  },

  earth(dc, x, y, st, acc, sd) {
    const r = 14;
    if (st === 2) {
      dc.setColor(0, -1); dc.fillCircle(x, y, r);
      dc.setColor(G.dim(acc, 0.22), -1); face.lens(dc, x, y, r, sd + 180, 0.3);
      dc.setColor(acc, -1); dc.setPenWidth(2); dc.drawCircle(x, y, r);
      return;
    }
    const ocean = st === 1 ? 0x2d8ee0 : 0xb4b4b4;
    const land = st === 1 ? 0x46c08a : 0x7c7c7c;
    const atmo = st === 1 ? 0x2a5f9a : 0x444444;
    dc.setColor(atmo, -1); dc.fillCircle(x, y, r + 2);
    dc.setColor(ocean, -1); dc.fillCircle(x, y, r);
    dc.setColor(land, -1);
    dc.fillEllipse(x - 4, y - 5, 6, 5);
    dc.fillEllipse(x + 6, y + 5, 4, 5);
    dc.setColor(st === 1 ? 0x081626 : 0x141414, -1);
    face.lens(dc, x, y, r + 0.5, sd + 180, 0.3);
  },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;

    // ---- stars
    if (st !== 2) face.stars(dc, a, st === 1 ? 0xd8e0ff : 0xbbbbbb);

    // ---- asteroid belt = steps
    const frac = d.stepGoal > 0 && d.steps > 0 ? G.clamp(d.steps / d.stepGoal, 0, 1) : 0;
    const bp = G.ease(p * 1.3);
    const lit = Math.floor(frac * 100 * bp);
    let sd = 977;
    const bcol = st === 3 ? 0xd8d8d8 : acc;
    for (let i = 0; i < 100; i++) {
      sd = G.rnd(sd);
      const rr = RB + (G.rf(sd) - 0.5) * 7;
      sd = G.rnd(sd);
      const sz = 1 + G.rf(sd) * 1.6;
      const t = i * 3.6 + 1.8;
      dc.setColor(i < lit ? bcol : (st === 2 ? G.dim(acc, 0.18) : 0x262626), -1);
      dc.fillCircle(G.ptX(CX, rr, t), G.ptY(CX, rr, t), i < lit ? sz : 1);
    }

    // ---- orbits
    const oc = st === 1 ? 0x3c4a66 : st === 2 ? G.dim(acc, 0.45) : 0x383838;
    const o1 = G.ease(G.stag(p, 0, 0.1, 0.6));
    const o2 = G.ease(G.stag(p, 1, 0.1, 0.6));
    const o3 = G.ease(G.stag(p, 2, 0.1, 0.6));
    dc.setColor(oc, -1);
    if (st === 2) {
      dc.setPenWidth(1);
      G.arcC(dc, CX, CX, RH, 0, 360 * o1);
      G.arcC(dc, CX, CX, RM, 0, 360 * o2);
      G.arcC(dc, CX, CX, RS, 0, 360 * o3);
      dc.setColor(acc, -1);
      dc.setPenWidth(2);
      for (let k = 0; k < 12; k++) {
        const big = k % 3 === 0;
        if (k * 30 <= 360 * o1) G.tick(dc, CX, CX, RH - (big ? 7 : 4), RH + (big ? 7 : 4), k * 30);
        if (k * 30 <= 360 * o2) G.tick(dc, CX, CX, RM - (big ? 5 : 3), RM + (big ? 5 : 3), k * 30);
        if (big && k * 30 <= 360 * o3) G.tick(dc, CX, CX, RS - 4, RS + 4, k * 30);
      }
    } else {
      face.orbit(dc, RH, o1, 10);
      face.orbit(dc, RM, o2, 10);
      face.orbit(dc, RS, o3, 10);
    }

    // ---- sun
    face.sun(dc, a, st, acc, p);

    // ---- planets (spiral out from the sun)
    const s = d.s;
    const ha = (d.h % 12) * 30 + d.m * 0.5;
    const ma = d.m * 6 + s * 0.1;
    const e1 = G.easeInOut(G.stag(p, 0, 0.12, 0.7));
    const e2 = G.easeInOut(G.stag(p, 1, 0.12, 0.7));
    const e3 = G.easeInOut(G.stag(p, 2, 0.12, 0.7));

    // hour giant
    if (e1 > 0) {
      const ang = ha - (1 - e1) * 270, r = RH * e1;
      const x = G.ptX(CX, r, ang), y = G.ptY(CX, r, ang);
      face.giant(dc, x, y, st, acc, ang + 180);
      if (st === 2) { dc.setColor(acc, -1); F.px(dc, "H", G.ptX(CX, r, ang - 17), G.ptY(CX, r, ang - 17) - 7, 2, 1, 0); }
    }

    // minute earth + moon
    if (e2 > 0) {
      const ang = ma - (1 - e2) * 270, r = RM * e2;
      const x = G.ptX(CX, r, ang), y = G.ptY(CX, r, ang);
      const mo = ang + 180 - d.moon * 360 - (a.live ? a.t * 0.003 : 0);
      const mx = G.ptX(x, 27 * e2, mo), my = G.ptY(y, 27 * e2, mo);
      dc.setColor(st === 1 ? 0x1c2638 : st === 2 ? G.dim(acc, 0.3) : 0x2a2a2a, -1);
      dc.setPenWidth(1);
      dc.drawCircle(x, y, 27 * e2);
      face.earth(dc, x, y, st, acc, ang + 180);
      if (st === 2) {
        face.moonDisc(dc, mx, my, 7, d.moon, acc, -1);
        dc.setColor(acc, -1);
        F.px(dc, "M", G.ptX(CX, r, ang - 21), G.ptY(CX, r, ang - 21) - 7, 2, 1, 0);
      } else {
        face.moonDisc(dc, mx, my, 7, d.moon, st === 1 ? 0xf0ead6 : 0xffffff, st === 1 ? 0x2c3040 : 0x262626);
      }
    }

    // seconds comet
    if (e3 > 0) {
      const sec = s + (a.live ? (a.t % 1000) / 1000 : 0);
      const ang = sec * 6 - (1 - e3) * 270, r = RS * e3;
      const cc = st === 3 ? 0xffffff : acc;
      if (a.live) {
        for (let i = 9; i >= 1; i--) {
          const ta = ang - i * 3.2;
          const tr = r + i * 1.3 * e3;
          dc.setColor(G.dim(cc, (1 - i / 10) * 0.8), -1);
          dc.fillCircle(G.ptX(CX, tr, ta), G.ptY(CX, tr, ta), 3.4 - i * 0.28);
        }
        dc.setColor(G.dim(cc, 0.35), -1);
        dc.fillCircle(G.ptX(CX, r, ang), G.ptY(CX, r, ang), 7);
        dc.setColor(G.mix(cc, 0xffffff, 0.6), -1);
        dc.fillCircle(G.ptX(CX, r, ang), G.ptY(CX, r, ang), 4);
      } else {
        dc.setColor(cc, -1);
        dc.fillCircle(G.ptX(CX, r, ang), G.ptY(CX, r, ang), 3);
      }
      if (st === 2) { dc.setColor(acc, -1); F.px(dc, "S", G.ptX(CX, r, ang + 19), G.ptY(CX, r, ang + 19) - 7, 2, 1, 0); }
    }

    // ---- date + time (black halo keeps them readable over the orbits)
    const top = face.flip(d);
    const ty = top ? 454 - TY : TY;
    const dy = top ? 440 - DY : DY;
    const dp = G.ease(G.stag(p, 1, 0.2, 0.6));
    const ds = d.dowStr + " " + d.day + ". " + d.monStr;
    if (dp > 0) {
      const w = F.pxW(ds, 2);
      dc.setColor(0, -1);
      dc.fillRoundedRectangle(CX - w / 2 - 6, dy - 4, w + 12, 22, 6);
      dc.setColor(G.dim(st === 2 ? acc : 0xa8a8a8, dp), -1);
      F.px(dc, ds, CX, dy, 2, 1, 0);
    }
    const tp = G.easeInOut(p * 1.2 - 0.1);
    const ts = G.timeStr(d);
    dc.setColor(0, -1);
    F.st(dc, ts, CX, ty, 52, 13, 1, tp, 0);
    dc.setColor(st === 2 ? acc : 0xffffff, -1);
    F.st(dc, ts, CX, ty, 52, st === 2 ? 3 : 5, 1, tp, 0);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const x0 = CX + o[0], y0 = CX + o[1];
    dc.setPenWidth(1);
    dc.setColor(0x262626, -1);
    dc.drawCircle(x0, y0, RH);
    dc.drawCircle(x0, y0, RM);
    dc.setColor(0x5a5a5a, -1);
    dc.drawCircle(x0, y0, 14);
    const ha = (d.h % 12) * 30 + d.m * 0.5;
    const ma = d.m * 6;
    dc.setColor(0, -1);
    dc.fillCircle(G.ptX(x0, RH, ha), G.ptY(y0, RH, ha), 10);
    dc.fillCircle(G.ptX(x0, RM, ma), G.ptY(y0, RM, ma), 8);
    dc.setColor(G.dim(d.accent, 0.6), -1);
    dc.setPenWidth(2);
    dc.drawCircle(G.ptX(x0, RH, ha), G.ptY(y0, RH, ha), 7);
    dc.setColor(0x6a6a6a, -1);
    dc.fillCircle(G.ptX(x0, RM, ma), G.ptY(y0, RM, ma), 4);
    dc.setColor(0x9a9a9a, -1);
    F.st(dc, G.timeStr(d), x0, (face.flip(d) ? 454 - TY : TY) + o[1], 52, 3, 1, 1.0, 0);
  },
};

export default face;
