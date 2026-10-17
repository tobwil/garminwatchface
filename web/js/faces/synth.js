// SYNTH — "Synthwave": an 80s outrun scene. A striped retro sun whose height follows
// the real solar elevation (a ringed magenta planet and stars at night), gradient sky,
// low-poly mountains and a perspective neon grid floor with a road that scrolls towards
// the viewer at a speed set by the heart rate. Chrome-neon time (3 stroke passes).
// Styles: 1 Outrun, 2 Sunset, 3 Vapor (checkerboard floor, palms).
// Mirrors watch/source/faces/Synth.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";

const CX = 227;
const HZ = 262; // horizon
const FD = 192; // floor depth in px (HZ..454)
const PC = 1000; // perspective constant: y = HZ + PC / z
const SR = 84; // sun radius
const CW = 58; // grid column width at the bottom edge
const TY = 134; // time centre

// palettes: skyTop skyMid skyHor sun0 sun1 sun2 floor grid edge mtnLight mtnDark ridge tUnder tMid tTop panel
const PAL = [
  [0x0a0326, 0x3a0c5e, 0xc2257d, 0xffe45c, 0xff8a3d, 0xff2e88, 0x0c0220, -1, 0x3ef2ff, 0x3b1661, 0x200b3c, 0x3ef2ff, -1, 0x2ee6ff, 0xffffff, 0x07000f],
  [0x12031f, 0x4a0e40, 0xe0482f, 0xffe7a0, 0xff9a3c, 0xe8243a, 0x120310, 0xff5a2e, 0xffc24a, 0x2c0a2c, 0x170518, 0xff7a3a, 0x6a0f2a, 0xff9a3c, 0xfff1c9, 0x0b0208],
  [0x1a1747, 0x5e4a9e, 0xf6a6cb, 0xfff2f8, 0xffb3da, 0x7fe6e0, 0x241a4e, 0xe58fc4, 0xffffff, 0x3a2d6e, 0x2a1f55, 0xffb3da, 0x4b2a86, 0xff9fd6, 0xffffff, 0x150f33],
];
// mountains (back to front): peak x, height, left half-width, right half-width
const MT = [118, 100, 74, 64, 352, 92, 70, 80, 56, 70, 86, 66, 412, 66, 70, 72];

const face = {
  fps: 15,
  _ek: -1, _ela: -999, _elev: 0, // per-minute cache of the solar elevation

  sky(c, y, n) {
    const t = y / HZ;
    let col = t < 0.55 ? G.mix(c[0], c[1], t / 0.55) : G.mix(c[1], c[2], (t - 0.55) / 0.45);
    if (n > 0) col = G.mix(col, G.mix(0x02010a, c[1], t * t * 0.7), n * 0.75);
    return col;
  },

  // rows of a disc between y0 and the horizon, three-colour vertical gradient, with
  // drifting slits in its lower part (gaps widen towards the bottom)
  disc(dc, cx, cy, r, c0, c1, c2, drift, slits) {
    const top = Math.max(Math.floor(cy - r), 0);
    const bot = Math.min(cy + r, HZ);
    const s0 = cy - r * 0.2;
    for (let y = top; y < bot; y += 2) {
      const dy = y + 1 - cy;
      const hw = Math.sqrt(Math.max(0, r * r - dy * dy));
      if (hw < 1) continue;
      if (slits && y > s0) {
        const rel = (y - s0) / (cy + r - s0);
        const v = y - s0 - drift;
        const ph = v - 14 * Math.floor(v / 14);
        if (ph < 1.5 + rel * 8) continue;
      }
      const t = (y - (cy - r)) / (2 * r);
      dc.setColor(t < 0.5 ? G.mix(c0, c1, t * 2) : G.mix(c1, c2, t * 2 - 1), -1);
      dc.fillRectangle(cx - hw, y, hw * 2, 2);
    }
  },

  palm(dc, bx, by, hg, lean, col) {
    dc.setColor(col, -1);
    let px = bx, py = by, pw = 7;
    for (let i = 1; i <= 5; i++) {
      const t = i / 5;
      const x = bx + lean * hg * t * t, y = by - hg * t, w = 7 - 3.5 * t;
      dc.fillPolygon([[px - pw, py], [x - w, y], [x + w, y], [px + pw, py]]);
      px = x; py = y; pw = w;
    }
    // fronds: [angle from up (deg, clockwise), length]
    const FR = [-112, 0.5, -70, 0.62, -30, 0.5, 18, 0.55, 62, 0.62, 104, 0.5];
    for (let k = 0; k < 12; k += 2) {
      const a = FR[k], L = FR[k + 1] * hg * 0.62;
      const a2 = a + (a < 0 ? -48 : 48);
      const mx = G.ptX(px, L * 0.55, a), my = G.ptY(py, L * 0.55, a);
      const ex = G.ptX(mx, L * 0.55, a2), ey = G.ptY(my, L * 0.55, a2);
      const nx = G.ptX(0, 6, a + 90), ny = G.ptY(0, 6, a + 90);
      dc.fillPolygon([[px, py], [mx + nx, my + ny], [ex, ey], [mx - nx, my - ny]]);
    }
    dc.fillCircle(px, py, 5);
  },

  // one pass of the time (centred on x): hours, slanted square colon, minutes
  time(dc, hh, mm, x, y, pen, col) {
    dc.setColor(col, -1);
    const wh = F.stW(hh, 76);
    x = x + (wh - F.stW(mm, 76)) / 2;
    F.st(dc, hh, x - 15, y, 76, pen, 2, 1.0, 0.15);
    F.st(dc, mm, x + 15, y, 76, pen, 0, 1.0, 0.15);
    const r = pen * 0.5 + 3;
    for (let k = 0; k < 2; k++) {
      const cy = y + (k === 0 ? -17 : 17);
      const sx = x + (y - cy) * 0.15;
      dc.fillPolygon([[sx - r + r * 0.3, cy - r], [sx + r + r * 0.3, cy - r], [sx + r - r * 0.3, cy + r], [sx - r - r * 0.3, cy + r]]);
    }
  },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const c = PAL[st - 1];
    const acc = d.accent;
    const grid = c[7] === -1 ? acc : c[7];
    const tUnder = c[12] === -1 ? G.mix(0x000000, acc, 0.5) : c[12];
    const p = a.intro;
    const live = a.live;
    const sec = live ? a.t / 1000 : 0;
    const vapor = st === 3;

    // ---- sun elevation (real) -> day / night
    const ek = d.doy * 1440 + d.mins;
    if (ek !== face._ek || d.lat !== face._ela) {
      face._ek = ek;
      face._ela = d.lat;
      face._elev = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    }
    const elev = face._elev;
    const night = G.clamp((2 - elev) / 10, 0, 1);

    // ---- sky bands
    for (let y = 0; y < HZ; y += 8) {
      const dy = y + 8 < 227 ? 227 - y - 8 : 0;
      const hw = Math.sqrt(227 * 227 - dy * dy) + 1;
      dc.setColor(face.sky(c, y + 4, night), -1);
      dc.fillRectangle(CX - hw, y, hw * 2, 8);
    }

    // ---- stars (always a few up high; many at night)
    const sv = 0.3 + 0.7 * night;
    let seed = 7;
    for (let i = 0; i < 30; i++) {
      seed = G.rnd(seed);
      const x = 60 + (seed % 335);
      seed = G.rnd(seed);
      const y = 22 + (seed % 170);
      const lim = 0.25 + 0.75 * night;
      if (y > 22 + 170 * lim) continue;
      const tw = live ? 0.6 + 0.4 * Math.sin(sec * 2.3 + i * 1.7) : 0.8;
      const b = sv * tw * (1 - y / 260) * G.ease(p * 2);
      dc.setColor(G.mix(face.sky(c, y, night), 0xffffff, b), -1);
      if (i % 7 === 0) {
        dc.fillRectangle(x - 1, y - 3, 2, 8);
        dc.fillRectangle(x - 4, y, 8, 2);
      } else dc.fillRectangle(x, y, 2, 2);
    }

    // ---- sun (rises during the intro) or ringed planet at night
    const rise = G.ease(G.clamp(p / 0.6, 0, 1));
    const drift = live ? sec * 4 : 0;
    if (elev >= -6) {
      const ty = HZ + 18 - G.clamp(elev, -12, 50) * 2.0;
      const cy = G.lerp(HZ + SR + 4, ty, rise);
      dc.setColor(G.mix(c[2], c[5], 0.35), -1);
      dc.fillCircle(CX, cy, SR + 7);
      face.disc(dc, CX, cy, SR, c[3], c[4], c[5], drift, true);
    } else {
      const pr = 54;
      const cy = G.lerp(HZ + pr + 30, HZ - 36, rise);
      const p0 = vapor ? 0x9fe9ff : 0xff6ad5, p1 = vapor ? 0xc79bff : 0xc02a9e, p2 = vapor ? 0x6a4fc0 : 0x4d1478;
      dc.setColor(G.mix(p1, 0xffffff, 0.15), -1);
      dc.setPenWidth(3);
      dc.drawEllipse(CX, cy, pr * 1.75, pr * 0.3);
      face.disc(dc, CX, cy, pr, p0, p1, p2, drift, false);
      // front half of the ring
      dc.setColor(G.mix(p1, 0xffffff, 0.35), -1);
      let lx = CX + pr * 1.75, ly = cy;
      for (let k = 1; k <= 12; k++) {
        const an = (k * Math.PI) / 12;
        const x = CX + pr * 1.75 * Math.cos(an), y = cy + pr * 0.3 * Math.sin(an);
        dc.drawLine(lx, ly, x, y);
        lx = x; ly = y;
      }
    }

    // ---- low-poly mountains
    const mL = night > 0.5 ? G.dim(c[9], 0.7) : c[9], mD = night > 0.5 ? G.dim(c[10], 0.7) : c[10];
    dc.setPenWidth(2);
    for (let i = 0; i < MT.length; i += 4) {
      const x = MT[i], h = MT[i + 1] * (vapor ? 0.7 : 1), wl = MT[i + 2], wr = MT[i + 3];
      const yb = HZ + 1, yp = HZ - h, xm = x + wr * 0.22;
      dc.setColor(mL, -1);
      dc.fillPolygon([[x - wl, yb], [x, yp], [xm, yb]]);
      dc.setColor(mD, -1);
      dc.fillPolygon([[xm, yb], [x, yp], [x + wr, yb]]);
      dc.setColor(G.mix(mD, c[11], 0.75), -1);
      dc.drawLine(x - wl, yb, x, yp);
      dc.drawLine(x, yp, x + wr, yb);
    }

    // ---- floor
    dc.setColor(c[6], -1);
    dc.fillRectangle(0, HZ, 454, 454 - HZ);
    dc.setColor(G.mix(c[6], c[2], 0.3), -1);
    dc.fillRectangle(0, HZ, 454, 10);

    // scroll: heart rate -> speed (rows per second); the intro flies rows in from the horizon
    const hr = d.hr > 0 ? d.hr : 70;
    const spd = G.clamp(0.4 + ((hr - 60) * 2.1) / 90, 0.4, 2.5);
    const sc = live ? sec * spd : 0.35;
    const ph = sc - Math.floor(sc);
    const gq = G.ease(G.clamp((p - 0.15) / 0.6, 0, 1));
    const fly = 1 + (1 - gq) * 7;
    const rw = CW * 1.5; // road half-width at the bottom edge

    if (vapor) {
      // checkerboard
      const base = Math.floor(sc);
      let y2 = 454;
      for (let k = 0; k < 12; k++) {
        const z = (4 + (k + 1 - ph) * 2.4) * fly;
        let y1 = HZ + PC / z;
        if (y1 >= 454) continue;
        if (y1 - HZ < 9) break;
        const f1 = (y1 - HZ) / FD, f2 = (y2 - HZ) / FD;
        dc.setColor(G.mix(c[6], grid, G.clamp((y1 - HZ) / 70, 0.2, 1) * 0.55), -1);
        for (let j = -8; j < 8; j++) {
          if (((k + j + base) & 1) === 0 || j === -1 || j === 0) continue;
          const xa = j * CW, xb = (j + 1) * CW;
          if (xa * f2 > 230 || xb * f2 < -230) continue;
          dc.fillPolygon([[CX + xa * f1, y1], [CX + xb * f1, y1], [CX + xb * f2, y2], [CX + xa * f2, y2]]);
        }
        y2 = y1;
      }
    } else {
      // horizontal grid lines (split at the road)
      dc.setPenWidth(2);
      for (let k = 0; k < 22; k++) {
        const z = (4 + (k + 1 - ph) * 2.2) * fly;
        const y = HZ + PC / z;
        if (y >= 454) continue;
        if (y - HZ < 3) break;
        const f = (y - HZ) / FD;
        dc.setColor(G.mix(c[6], grid, G.clamp((y - HZ) / 90, 0.15, 1)), -1);
        dc.drawLine(0, y, CX - rw * f, y);
        dc.drawLine(CX + rw * f, y, 454, y);
      }
      // converging verticals
      for (let j = -9; j <= 9; j++) {
        if (j >= -1 && j <= 1) continue;
        const yb = HZ + FD * gq;
        dc.setColor(G.mix(c[6], grid, 0.85), -1);
        dc.drawLine(CX + j * CW * 0.02, HZ + 4, CX + j * CW * (yb - HZ) / FD, yb);
      }
    }

    // road + dashed centre line
    dc.setColor(G.mix(c[6], 0x000000, 0.45), -1);
    dc.fillPolygon([[CX - 3, HZ], [CX + 3, HZ], [CX + rw, 454], [CX - rw, 454]]);
    dc.setColor(c[8], -1);
    dc.setPenWidth(2);
    dc.drawLine(CX - 3, HZ + 1, CX - rw * gq - 3 * (1 - gq), HZ + FD * gq);
    dc.drawLine(CX + 3, HZ + 1, CX + rw * gq + 3 * (1 - gq), HZ + FD * gq);
    dc.setColor(G.mix(c[8], 0xffffff, 0.3), -1);
    for (let k = 0; k < 10; k++) {
      const z1 = (4 + (k + 1 - ph) * 2.2) * fly;
      const z2 = z1 + 1.1 * fly;
      const y1 = HZ + PC / z1, y2 = HZ + PC / z2;
      if (y2 >= 454) continue;
      if (y1 - HZ < 4) break;
      const w1 = 4 * (y1 - HZ) / FD, w2 = 4 * (y2 - HZ) / FD;
      dc.fillPolygon([[CX - w2, y2], [CX + w2, y2], [CX + w1, Math.min(y1, 454)], [CX - w1, Math.min(y1, 454)]]);
    }

    if (vapor) {
      face.palm(dc, 70, HZ + 70, 150, 0.22, 0x120a26);
      face.palm(dc, 392, HZ + 60, 128, -0.26, 0x120a26);
    }
    // horizon glow line
    dc.setColor(G.mix(c[2], 0xffffff, 0.45), -1);
    dc.fillRectangle(0, HZ - 1, 454, 2);

    // ---- date (pixel font)
    const dq = G.ease(G.clamp((p - 0.35) / 0.4, 0, 1));
    if (dq > 0) {
      dc.setColor(G.mix(face.sky(c, 50, night), G.mix(c[13], 0xffffff, 0.35), dq), -1);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX, 50, 3, 1, 0);
    }

    // ---- time: chrome-neon, powers on with a flicker
    const tq = G.clamp((p - 0.45) / 0.45, 0, 1);
    let on = tq >= 1;
    if (!on && tq > 0.05) {
      const fl = G.rnd(Math.floor(a.t / 45) + 11) % 10;
      on = fl < 3 + tq * 7;
    }
    if (on) {
      const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
      const mm = G.pad2(d.m);
      face.time(dc, hh, mm, CX + 3, TY + 4, 13, tUnder);
      face.time(dc, hh, mm, CX, TY, 7, tq < 1 ? G.dim(c[13], 0.6) : c[13]);
      if (tq > 0.5) face.time(dc, hh, mm, CX - 1, TY - 1, 2.5, c[14]);
    }

    // ---- slots: three neon readouts
    for (let k = 0; k < 3; k++) {
      const q = G.stag(p - 0.55, k, 0.08, 0.3);
      if (q <= 0) continue;
      const sl = d.slots[k];
      if (!sl.lbl) continue;
      const x = CX + (k - 1) * 106;
      dc.setColor(c[15], -1);
      dc.fillRoundedRectangle(x - 50, 340, 100, 48, 7);
      dc.setColor(G.mix(c[15], grid, q * 0.8), -1);
      dc.setPenWidth(2);
      dc.drawRoundedRectangle(x - 50, 340, 100, 48, 7);
      dc.setColor(G.mix(c[15], G.mix(grid, 0xffffff, 0.35), q), -1);
      F.px(dc, sl.lbl, x, 347, 2, 1, 0);
      dc.setColor(G.mix(c[15], G.mix(c[13], 0xffffff, 0.25), q), -1);
      const vs = F.pxW(sl.val, 3) > 92 ? 2 : 3;
      F.px(dc, sl.val, x, vs === 3 ? 362 : 365, vs, 1, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const c = PAL[st - 1];
    const acc = d.accent;
    const grid = c[7] === -1 ? acc : c[7];
    const x = CX + o[0], hz = HZ + o[1];
    // horizon + sun outline with three slits
    dc.setPenWidth(1);
    dc.setColor(G.dim(grid, 0.6), -1);
    dc.drawLine(x - 150, hz, x + 150, hz);
    dc.setColor(G.dim(c[4], 0.6), -1);
    dc.setPenWidth(2);
    G.arcC(dc, x, hz, 62, -90, 90);
    dc.setPenWidth(1);
    for (let k = 0; k < 3; k++) {
      const y = hz - 10 - k * 12;
      const hw = Math.sqrt(62 * 62 - (hz - y) * (hz - y));
      dc.drawLine(x - hw, y, x + hw, y);
    }
    // thin time
    face.time(dc, d.is24 ? G.pad2(d.h) : "" + G.hour(d), G.pad2(d.m), x, TY + o[1], 3, G.dim(c[13], 0.75));
    dc.setColor(G.dim(c[13], 0.45), -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, x, 50 + o[1], 2, 1, 0);
  },
};

export default face;
