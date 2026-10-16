// SUN — "Daylight": the sun's real day path over a horizon, sky colour from the
// true solar elevation, golden/blue hour, remaining daylight, moon with real phase.
// Styles: 1 Himmel, 2 Linie, 3 24h. Mirrors watch/source/faces/Sun.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";

const HY = 302; // horizon
const XL = 72; // sunrise foot
const XR = 382; // sunset foot
const ND = 25; // dots on the day arc
const CX = 227;

// sky keyframes: elevation -> zenith / horizon colour
const SKY_E = [-12, -6, -2, 3, 10, 25];
const SKY_Z = [0x03061a, 0x0a1438, 0x1a2a5e, 0x24427e, 0x1d5296, 0x1b58a2];
const SKY_H = [0x0a1030, 0x1f3a7a, 0x74466c, 0xe88c3a, 0x4a8bd0, 0x4f93d8];

const face = {
  fps: 10,

  // per-day cache (pure function of doy/lat/lon/tz)
  _kd: -999, _kla: -999, _klo: -999, _ktz: -9999,
  _rise: -1, _set: -1, _c6r: -1, _c6s: -1, _g6r: -1, _g6s: -1, _noonE: 0, _H: 100,
  _dy: null, _de: null,

  calc(d) {
    if (face._kd === d.doy && face._kla === d.lat && face._klo === d.lon && face._ktz === d.tz) return;
    face._kd = d.doy; face._kla = d.lat; face._klo = d.lon; face._ktz = d.tz;
    face._rise = AST.cross(d.doy, d.lat, d.lon, d.tz, -0.833, true);
    face._set = AST.cross(d.doy, d.lat, d.lon, d.tz, -0.833, false);
    face._c6r = AST.cross(d.doy, d.lat, d.lon, d.tz, -6, true);
    face._c6s = AST.cross(d.doy, d.lat, d.lon, d.tz, -6, false);
    face._g6r = AST.cross(d.doy, d.lat, d.lon, d.tz, 6, true);
    face._g6s = AST.cross(d.doy, d.lat, d.lon, d.tz, 6, false);
    face._noonE = AST.elev(d.doy, AST.noon(d.doy, d.lon, d.tz), d.lat, d.lon, d.tz);
    face._H = G.clamp(82 + face._noonE, 92, 126);
    const r0 = face.r0(), len = face.dayLen();
    face._dy = [];
    face._de = [];
    for (let i = 0; i < ND; i++) {
      const e = AST.elev(d.doy, r0 + (len * i) / (ND - 1), d.lat, d.lon, d.tz);
      face._de.push(e);
      face._dy.push(HY - (face._H * G.clamp(e, 0, 90)) / Math.max(face._noonE, 1));
    }
  },

  // day window start / length (polar day: whole day)
  r0() { return face._rise >= 0 && face._set >= 0 ? face._rise : 0; },
  dayLen() {
    if (face._rise < 0 || face._set < 0) return 1440;
    let l = face._set - face._rise;
    if (l <= 0) l += 1440;
    return l;
  },
  isPolar() { return face._rise < 0 || face._set < 0; },

  // minute-of-day m is between sunrise and sunset?
  isDay(d, m) {
    if (face.isPolar()) return face._noonE > 0;
    let u = m - face._rise;
    if (u < 0) u += 1440;
    return u <= face.dayLen();
  },

  // arc position for minute m (day) -> [x, y]
  arcPos(d, m) {
    let u = m - face.r0();
    if (u < 0) u += 1440;
    const f = G.clamp(u / face.dayLen(), 0, 1);
    const e = AST.elev(d.doy, m, d.lat, d.lon, d.tz);
    return [G.lerp(XL, XR, f), HY - (face._H * G.clamp(e, 0, 90)) / Math.max(face._noonE, 1)];
  },

  // moon position on a softer night dome
  nightPos(m) {
    let f = 0.5;
    if (!face.isPolar()) {
      let u = m - face._set;
      if (u < 0) u += 1440;
      f = G.clamp(u / (1440 - face.dayLen()), 0, 1);
    } else {
      f = m / 1440;
    }
    return [G.lerp(XL, XR, f), HY - face._H * 0.82 * Math.sin(f * Math.PI)];
  },

  sky(e) {
    let i = 0;
    if (e <= SKY_E[0]) return [SKY_Z[0], SKY_H[0]];
    if (e >= SKY_E[5]) return [SKY_Z[5], SKY_H[5]];
    while (i < 4 && e > SKY_E[i + 1]) i++;
    const t = (e - SKY_E[i]) / (SKY_E[i + 1] - SKY_E[i]);
    return [G.mix(SKY_Z[i], SKY_Z[i + 1], t), G.mix(SKY_H[i], SKY_H[i + 1], t)];
  },

  clk(d, m) {
    const r = Math.round(m) % 1440;
    let h = Math.floor(r / 60);
    if (!d.is24) h = h % 12 === 0 ? 12 : h % 12;
    return (d.is24 ? G.pad2(h) : "" + h) + ":" + G.pad2(r % 60);
  },

  // [main line, sub line]
  status(d, e) {
    const m = d.mins;
    if (face.isPolar()) {
      if (face._noonE > 0) return ["MITTERNACHTSSONNE", "SONNE " + Math.round(e) + "°"];
      return ["POLARNACHT", "MOND " + Math.round(AST.illum(d.moon) * 100) + "%"];
    }
    if (face.isDay(d, m)) {
      let left = face._set - m;
      if (left < 0) left += 1440;
      const light = "NOCH " + G.hm(left) + " H LICHT";
      if (e < 6) return ["GOLDENE STUNDE", light];
      return [light, face._g6s >= 0 ? "GOLDENE STUNDE " + face.clk(d, face._g6s) : ""];
    }
    let until = face._rise - m;
    if (until < 0) until += 1440;
    const lightIn = "LICHT IN " + G.hm(until);
    if (e >= -6) {
      const main = e < -4 ? "BLAUE STUNDE" : "DÄMMERUNG";
      if (until < 180) return [main, lightIn];
      let dk = face._c6s - m;
      if (dk < 0) dk += 1440;
      return [main, "DUNKEL IN " + G.hm(dk)];
    }
    return [lightIn, "MOND " + Math.round(AST.illum(d.moon) * 100) + "%"];
  },

  // moon disc with real phase. dark = -1 -> outline only.
  moonDisc(dc, d, x, y, r, phase, lit, dark) {
    if (dark !== -1) { dc.setColor(dark, -1); dc.fillCircle(x, y, r); }
    else { dc.setColor(G.dim(lit, 0.6), -1); dc.setPenWidth(2); dc.drawCircle(x, y, r); }
    if (AST.illum(phase) < 0.03) return;
    let s = phase < 0.5 ? 1 : -1;
    if (d.lat < 0) s = -s;
    const c = Math.cos(phase * 2 * Math.PI);
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const a = (-90 + i * 22.5) * (Math.PI / 180);
      pts.push([x + s * r * Math.cos(a), y + r * Math.sin(a)]);
    }
    for (let i = 8; i >= 0; i--) {
      const a = (-90 + i * 22.5) * (Math.PI / 180);
      pts.push([x + s * r * Math.cos(a) * c, y + r * Math.sin(a)]);
    }
    dc.setColor(lit, -1);
    dc.fillPolygon(pts);
  },

  // small drawn arrow, up or down, centred on (x, y)
  arrow(dc, x, y, up, col) {
    dc.setColor(col, -1);
    dc.setPenWidth(2);
    const k = up ? -1 : 1;
    dc.drawLine(x, y - 7 * k, x, y + 7 * k);
    dc.drawLine(x, y + 7 * k, x - 5, y + 2 * k);
    dc.drawLine(x, y + 7 * k, x + 5, y + 2 * k);
  },

  // "↑ 07:52" style label centred on x
  riseSet(dc, d, x, y, m, up, col, sp) {
    if (m < 0 || sp <= 0) return;
    const txt = face.clk(d, m);
    const w = F.stW(txt, 16) + 16;
    const x0 = x - w / 2;
    const c = G.dim(col, sp);
    face.arrow(dc, x0 + 5, y, up, c);
    dc.setColor(c, -1);
    F.st(dc, txt, x0 + 16, y, 16, 2, 0, 1.0, 0);
  },

  stars(dc, d, a, vis, n, rMax, yMax) {
    if (vis <= 0.02) return;
    let sd = 7919 + d.doy;
    for (let i = 0; i < n; i++) {
      sd = G.rnd(sd); const x = 227 + (G.rf(sd) * 2 - 1) * rMax;
      sd = G.rnd(sd); const y = 30 + G.rf(sd) * (yMax - 30);
      sd = G.rnd(sd); const b = 0.35 + G.rf(sd) * 0.65;
      if (Math.abs(x - 227) < 150 && y > 40 && y < 162) continue;
      const dx = x - 227, dy = y - 227;
      if (dx * dx + dy * dy > rMax * rMax) continue;
      let tw = b;
      if (a.live) tw = b * (0.55 + 0.45 * Math.sin(a.t * 0.0031 + i * 1.73));
      dc.setColor(G.dim(0xdfe6ff, tw * vis), -1);
      if (b > 0.85) dc.fillCircle(x, y, 1.6);
      else dc.fillRectangle(x, y, 2, 2);
    }
  },

  // sun disc with glow / rays
  sunDisc(dc, a, x, y, e, st, bg, acc) {
    const pulse = a.live ? Math.sin(a.t * 0.004) : 0;
    if (st === 2) {
      dc.setColor(acc, -1);
      dc.setPenWidth(2);
      dc.drawCircle(x, y, 11);
      dc.fillCircle(x, y, 4);
      const rot = a.live ? a.t * 0.012 : 0;
      dc.setPenWidth(2);
      for (let k = 0; k < 10; k++) G.tick(dc, x, y, 16 + pulse, 21 + pulse, rot + k * 36);
      return;
    }
    const core = e < 6 ? G.mix(0xff9a3c, 0xffe08a, G.clamp((e + 1) / 7, 0, 1)) : 0xfff0c0;
    dc.setColor(G.mix(bg, core, 0.16), -1); dc.fillCircle(x, y, 24 + pulse * 2);
    dc.setColor(G.mix(bg, core, 0.32), -1); dc.fillCircle(x, y, 18 + pulse);
    dc.setColor(G.mix(bg, core, 0.6), -1); dc.fillCircle(x, y, 14);
    dc.setColor(core, -1); dc.fillCircle(x, y, 11);
    dc.setColor(G.mix(core, 0xffffff, 0.6), -1); dc.fillCircle(x, y, 6);
  },

  draw(dc, d, a) {
    face.calc(d);
    const st = d.cfg.style;
    if (st === 3) { face.dial(dc, d, a); return; }
    const acc = d.accent;
    const p = a.intro;
    const sp = G.ease(p * 1.4);
    const e = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const day = face.isDay(d, d.mins);
    const sk = face.sky(e);

    // ---- sky (style 1)
    if (st === 1) {
      const nb = 24;
      for (let i = 0; i < nb; i++) {
        const t = (i + 0.5) / nb;
        const y0 = Math.floor((i * HY) / nb);
        const y1 = Math.floor(((i + 1) * HY) / nb);
        dc.setColor(G.dim(G.mix(sk[0], sk[1], t * t), sp), -1);
        dc.fillRectangle(0, y0, 454, y1 - y0);
      }
      // twilight glow where the sun hides below the horizon
      if (!day && e > -9) {
        let until = face._rise - d.mins;
        if (until < 0) until += 1440;
        const gx = face.isPolar() ? CX : until < 720 ? XL : XR;
        const gk = G.clamp((e + 9) / 9, 0, 1) * sp;
        dc.setColor(G.mix(sk[1], 0xff9a5a, 0.12 * gk), -1);
        dc.fillEllipse(gx, HY, 140, 54);
        dc.setColor(G.mix(sk[1], 0xff9a5a, 0.24 * gk), -1);
        dc.fillEllipse(gx, HY, 96, 34);
        dc.setColor(G.mix(sk[1], 0xffb070, 0.4 * gk), -1);
        dc.fillEllipse(gx, HY, 54, 17);
      }
      dc.setColor(G.dim(G.mix(0, sk[1], 0.12), sp), -1);
      dc.fillRectangle(0, HY, 454, 454 - HY);
    }

    // ---- stars
    const sv = G.clamp((-3 - e) / 7, 0, 1) * sp;
    face.stars(dc, d, a, sv, 34, 205, HY - 14);

    // ---- horizon
    const hc = st === 1 ? G.mix(sk[1], 0xffffff, 0.45) : acc;
    dc.setPenWidth(2);
    dc.setColor(G.dim(hc, sp * 0.35), -1);
    dc.drawLine(22, HY, 432, HY);
    dc.setColor(G.dim(hc, sp), -1);
    const hw = 205 * G.ease(p * 1.2);
    dc.drawLine(CX - hw * 0.8, HY, CX + hw * 0.8, HY);

    // ---- sun / moon time along the path (intro: travels from sunrise)
    const wp = G.easeInOut(p);
    let sm = d.mins;
    if (day) {
      let u = d.mins - face.r0();
      if (u < 0) u += 1440;
      sm = face.r0() + u * wp;
    }
    let pos;
    if (day) pos = face.arcPos(d, sm);
    else {
      pos = face.nightPos(d.mins);
      const n0 = face.nightPos(face._set >= 0 ? face._set : 0);
      pos = [G.lerp(n0[0], pos[0], wp), G.lerp(n0[1], pos[1], wp)];
    }

    // ---- day arc dots
    if (face._noonE > -0.833) {
      const len = face.dayLen();
      let cur = sm - face.r0();
      if (cur < 0) cur += 1440;
      for (let i = 0; i < ND; i++) {
        const f = i / (ND - 1);
        const x = G.lerp(XL, XR, f);
        const y = face._dy[i];
        const gold = face._de[i] < 6;
        const done = day && f * len <= cur;
        let c;
        if (st === 1) c = gold ? 0xffb560 : 0xffffff;
        else c = acc;
        let k = done ? 0.95 : 0.4;
        if (!day) k = 0.28;
        if (st === 1) {
          const bgc = G.mix(sk[0], sk[1], (y / HY) * (y / HY));
          dc.setColor(G.dim(G.mix(bgc, c, k), sp), -1);
        } else dc.setColor(G.dim(c, k * sp), -1);
        dc.fillCircle(x, y, done ? 2.6 : 2);
      }
    }

    // ---- sun or moon
    if (day) {
      const bgc = st === 1 ? G.mix(sk[0], sk[1], (pos[1] / HY) * (pos[1] / HY)) : 0;
      face.sunDisc(dc, a, pos[0], pos[1], e, st, G.dim(bgc, sp), acc);
    } else if (sp > 0.05) {
      const mr = 13;
      if (st === 1) {
        const bgc = G.mix(sk[0], sk[1], (pos[1] / HY) * (pos[1] / HY));
        dc.setColor(G.mix(bgc, 0xe8e4d0, 0.12 * sp), -1);
        dc.fillCircle(pos[0], pos[1], mr + 7);
        face.moonDisc(dc, d, pos[0], pos[1], mr, d.moon, G.dim(0xf2ecd8, sp), G.mix(bgc, 0x2a3350, sp));
      } else {
        face.moonDisc(dc, d, pos[0], pos[1], mr, d.moon, G.dim(acc, sp), -1);
      }
    }

    // ---- date + time
    const dp = G.ease(p * 1.6);
    dc.setColor(G.dim(st === 1 ? 0xd8e0f0 : 0x9a9a9a, dp), -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX, 50, 2, 1, 0);
    dc.setColor(0xffffff, -1);
    F.st(dc, G.timeStr(d), CX, 116, 72, st === 1 ? 6 : 3, 1, G.easeInOut(p * 1.15 - 0.05), 0);

    // ---- ground: rise / slot / set
    const gp = G.stag(p, 1, 0.25, 0.5);
    const gc = st === 1 ? 0xc8ccd6 : 0x9a9a9a;
    face.riseSet(dc, d, 80, 326, face._rise, true, gc, gp);
    face.riseSet(dc, d, 374, 326, face._set, false, gc, gp);
    const sl = d.slots[0];
    if (gp > 0) {
      dc.setColor(G.mix(0, d.dcol, gp), -1);
      F.st(dc, sl.val, CX, 326, 18, 3, 1, 1.0, 0);
      dc.setColor(G.dim(0x808080, gp), -1);
      F.px(dc, sl.lbl, CX, 341, 2, 1, 0);
    }

    // ---- status
    const tp = G.stag(p, 2, 0.2, 0.5);
    if (tp > 0) {
      const s2 = face.status(d, e);
      dc.setColor(G.dim(acc, tp), -1);
      F.st(dc, s2[0], CX, 380, 20, 3, 1, tp, 0);
      if (s2[1].length > 0) {
        dc.setColor(G.dim(st === 1 ? 0xaab0c0 : 0x8a8a8a, tp), -1);
        F.px(dc, s2[1], CX, 400, 2, 1, 0);
      }
    }
  },

  // ---------------------------------------------------------------- style 3: 24h dial
  ang(m) { return m / 4 + 180; },

  layer(dc, rs, ss, el, lim) {
    if (rs >= 0 && ss >= 0) {
      const a0 = face.ang(rs);
      let a1 = face.ang(ss);
      if (a1 < a0) a1 += 360;
      if (a1 > lim) a1 = lim;
      if (a1 > a0) G.arcC(dc, CX, CX, 204, a0, a1);
    } else if (face._noonE > el) {
      G.arcC(dc, CX, CX, 204, 180, lim);
    }
  },

  dial(dc, d, a) {
    const acc = d.accent;
    const p = a.intro;
    const e = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const day = face.isDay(d, d.mins);
    const lim = 180 + 360 * G.ease(p * 1.3);

    // sectors (layered: night < twilight < golden < day)
    dc.setPenWidth(18);
    dc.setColor(0x161c36, -1);
    G.arcC(dc, CX, CX, 204, 180, lim);
    dc.setColor(0x2f4f9e, -1);
    face.layer(dc, face._c6r, face._c6s, -6, lim);
    dc.setColor(0xe8892f, -1);
    face.layer(dc, face._rise, face._set, -0.833, lim);
    dc.setColor(0xf6e4b0, -1);
    face.layer(dc, face._g6r, face._g6s, 6, lim);

    // hour ticks + labels
    const tp = G.ease(p * 1.5);
    dc.setPenWidth(2);
    for (let h = 0; h < 24; h++) {
      dc.setColor(G.dim(h % 6 === 0 ? 0xbbbbbb : 0x555555, tp), -1);
      G.tick(dc, CX, CX, h % 6 === 0 ? 184 : 188, 193, face.ang(h * 60));
    }
    dc.setColor(G.dim(0xaaaaaa, tp), -1);
    F.st(dc, "12", CX, 54, 16, 2, 1, 1.0, 0);
    F.st(dc, "0", CX, 400, 16, 2, 1, 1.0, 0);
    F.st(dc, "6", 56, CX, 16, 2, 1, 1.0, 0);
    F.st(dc, "18", 398, CX, 16, 2, 1, 1.0, 0);

    // marker: travels from sunrise (day) / sunset (night)
    const wp = G.easeInOut(p);
    let m0 = day ? face._rise : face._set;
    if (m0 < 0) m0 = d.mins;
    let u = d.mins - m0;
    if (u < 0) u += 1440;
    const deg = face.ang(m0 + u * wp);
    const mx = G.ptX(CX, 204, deg), my = G.ptY(CX, 204, deg);
    dc.setColor(0, -1);
    dc.fillCircle(mx, my, 17);
    if (day) {
      const pulse = a.live ? Math.sin(a.t * 0.004) : 0;
      dc.setColor(0x3a2a10, -1);
      dc.fillCircle(mx, my, 15 + pulse);
      dc.setColor(0xffd27a, -1);
      dc.fillCircle(mx, my, 11);
      dc.setColor(0xfff4d6, -1);
      dc.fillCircle(mx, my, 6);
    } else {
      face.moonDisc(dc, d, mx, my, 12, d.moon, 0xf2ecd8, 0x2a3350);
    }

    // centre text
    const dp = G.ease(p * 1.6);
    dc.setColor(G.dim(0x9a9a9a, dp), -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX, 124, 2, 1, 0);
    dc.setColor(0xffffff, -1);
    F.st(dc, G.timeStr(d), CX, 202, 78, 6, 1, G.easeInOut(p * 1.15 - 0.05), 0);

    const sp = G.stag(p, 2, 0.2, 0.5);
    if (sp > 0) {
      const s2 = face.status(d, e);
      dc.setColor(G.dim(acc, sp), -1);
      F.st(dc, s2[0], CX, 270, 20, 3, 1, sp, 0);
      face.riseSet(dc, d, CX - 52, 304, face._rise, true, 0xb0b0b0, sp);
      face.riseSet(dc, d, CX + 52, 304, face._set, false, 0xb0b0b0, sp);
      const sl = d.slots[0];
      const lw = F.pxW(sl.lbl, 2), vw = F.stW(sl.val, 18);
      const x0 = CX - (lw + 10 + vw) / 2;
      dc.setColor(G.dim(0x808080, sp), -1);
      F.px(dc, sl.lbl, x0, 331, 2, 0, 0);
      dc.setColor(G.mix(0, d.dcol, sp), -1);
      F.st(dc, sl.val, x0 + lw + 10, 338, 18, 3, 0, 1.0, 0);
    }
  },

  // ---------------------------------------------------------------- always-on
  aod(dc, d) {
    face.calc(d);
    const o = St.shift(d);
    const ox = o[0], oy = o[1];
    const acc = G.dim(d.accent, 0.55);
    const day = face.isDay(d, d.mins);
    if (d.cfg.style === 3) {
      dc.setPenWidth(2);
      dc.setColor(0x262a3a, -1);
      dc.drawCircle(CX + ox, CX + oy, 204);
      dc.setColor(acc, -1);
      if (face._rise >= 0 && face._set >= 0) {
        const a0 = face.ang(face._rise);
        let a1 = face.ang(face._set);
        if (a1 < a0) a1 += 360;
        G.arcC(dc, CX + ox, CX + oy, 204, a0, a1);
      }
      const deg = face.ang(d.mins);
      const mx = G.ptX(CX + ox, 204, deg), my = G.ptY(CX + oy, 204, deg);
      dc.setColor(0, -1);
      dc.fillCircle(mx, my, 13);
      if (day) { dc.setColor(acc, -1); dc.drawCircle(mx, my, 9); }
      else face.moonDisc(dc, d, mx, my, 9, d.moon, G.dim(0xf2ecd8, 0.5), -1);
      dc.setColor(0x9a9a9a, -1);
      F.st(dc, G.timeStr(d), CX + ox, 202 + oy, 78, 3, 1, 1.0, 0);
      return;
    }
    dc.setPenWidth(1);
    dc.setColor(0x4a4a4a, -1);
    dc.drawLine(40 + ox, HY + oy, 414 + ox, HY + oy);
    if (face._noonE > -0.833) {
      dc.setColor(0x3a3a3a, -1);
      for (let i = 0; i < ND; i += 2) dc.fillCircle(G.lerp(XL, XR, i / (ND - 1)) + ox, face._dy[i] + oy, 1.5);
    }
    let pos;
    if (day) pos = face.arcPos(d, d.mins);
    else pos = face.nightPos(d.mins);
    if (day) {
      dc.setColor(acc, -1);
      dc.setPenWidth(2);
      dc.drawCircle(pos[0] + ox, pos[1] + oy, 10);
    } else {
      face.moonDisc(dc, d, pos[0] + ox, pos[1] + oy, 11, d.moon, G.dim(0xf2ecd8, 0.5), -1);
    }
    dc.setColor(0x9a9a9a, -1);
    F.st(dc, G.timeStr(d), CX + ox, 116 + oy, 72, 3, 1, 1.0, 0);
  },
};

export default face;
