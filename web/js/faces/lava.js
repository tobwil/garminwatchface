// LAVA — "Lavalampe": a tall lava lamp fills the round display. Wax blobs rise from the
// heated pool, stretch, pinch off, merge and sink again (metaball look from filled
// ellipses + curved "neck" polygons). Blob speed follows the outside temperature.
// The time floats inside the glass (hours over minutes), date left, three slots right.
// Styles: 1 Retro (red/orange on purple, brass), 2 Ozean (teal, chrome), 3 Plasma (neon).
// Mirrors watch/source/faces/Lava.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const CX = 227;
// glass profile: y, half width (top under the cap -> waist above the base)
const PY = [64, 110, 170, 230, 280, 306, 326, 342];
const PW = [44, 56, 74, 92, 106, 110, 106, 96];
// free blobs: radius, x offset (fraction of the free half width), period factor, phase
const BR = [34, 23, 38, 19, 28];
const BX = [-0.42, 0.38, 0.06, -0.12, 0.5];
const BP = [1.0, 1.27, 0.86, 1.43, 1.12];
const BO = [0.0, 0.33, 0.58, 0.13, 0.8];
const POOL_Y = 346;
const Y_BOT = 324;
const Y_TOP = 92;

// palettes per style:
// 0 bg top, 1 bg bottom, 2 glow, 3 liquid top, 4 liquid bottom, 5 wax rim, 6 wax core, 7 wax hot,
// 8 glass edge, 9 time, 10 time outline, 11 text, 12..17 metal ramp (left .. right)
const PAL = [
  [0x12041c, 0x3a0c46, 0xff4f6a, 0x2a0834, 0x8a1f58, 0xc8201e, 0xff6a1a, 0xffc04a, 0xd77aa8, 0xfff0d8, 0x1e0526, 0xe9c9dc,
    0x4a2a0c, 0x8e5c1c, 0xe0b24e, 0xfff0b8, 0xb47a2a, 0x5e3a10],
  [0x010914, 0x05223a, 0x2fd2d0, 0x02203c, 0x0a5a86, 0x0a8f8a, 0x27d8bf, 0xb8fff0, 0x7cc8e0, 0xeefcff, 0x011628, 0xbfe2ee,
    0x26303a, 0x5e6e7c, 0xbac8d2, 0xffffff, 0x7f909e, 0x2c3640],
  [0x000000, 0x0c0018, 0xff2bd6, 0x0a0018, 0x2e0858, 0xd4157a, 0xff4fd0, 0xf4f0ff, 0x2ef2ff, 0xffffff, 0x07000f, 0xc9b6ff,
    0x0e0b16, 0x221c30, 0x463c62, 0x7a6aa6, 0x2a2240, 0x0c0912],
];

function frac(x) { return x - Math.floor(x); }

// glass half width at y (clamped to the profile)
function hwAt(y) {
  if (y <= PY[0]) return PW[0];
  for (let i = 1; i < 8; i++) {
    if (y <= PY[i]) return PW[i - 1] + ((PW[i] - PW[i - 1]) * (y - PY[i - 1])) / (PY[i] - PY[i - 1]);
  }
  return PW[7];
}

// metaball neck between two circles: a curved waist polygon, pinches off with distance
function neck(dc, x1, y1, r1, x2, y2, r2, k) {
  const dx = x2 - x1, dy = y2 - y1;
  const dd = Math.sqrt(dx * dx + dy * dy);
  if (dd < 1) return;
  const rm = r1 < r2 ? r1 : r2;
  const g = dd - r1 - r2;
  const gm = rm * 0.95;
  if (g >= gm) return;
  const s = G.clamp((gm - g) / (gm + rm * 0.9), 0, 1);
  const wm = rm * (0.08 + 0.72 * s) * k;
  const w1 = r1 * 0.86 * k, w2 = r2 * 0.86 * k;
  const nx = -dy / dd, ny = dx / dd;
  const pts = [];
  for (let i = 0; i < 10; i++) pts.push(null);
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    let w = w1 * (1 - t) * (1 - 2 * t) + 4 * wm * t * (1 - t) + w2 * t * (2 * t - 1);
    if (w < wm * 0.7) w = wm * 0.7;
    pts[i] = [x1 + dx * t + nx * w, y1 + dy * t + ny * w];
    pts[9 - i] = [x1 + dx * t - nx * w, y1 + dy * t - ny * w];
  }
  dc.fillPolygon(pts);
}

// glass silhouette grown by e px (for the glow halo)
function glassPoly(e, y0) {
  const pts = [];
  for (let i = 0; i < 8; i++) pts.push([CX - PW[i] - (i === 0 ? e * 0.3 : e), PY[i] + (i === 0 ? y0 : 0)]);
  for (let i = 7; i >= 0; i--) pts.push([CX + PW[i] + (i === 0 ? e * 0.3 : e), PY[i] + (i === 0 ? y0 : 0)]);
  return pts;
}

// metal part: trapezoid from (y0, hw0) to (y1, hw1) in 6 vertical shading slices
const MF = [0, 0.1, 0.3, 0.46, 0.6, 0.86, 1];
function metal(dc, c, y0, w0, y1, w1, L) {
  for (let k = 0; k < 6; k++) {
    dc.setColor(G.dim(c[12 + k], L), -1);
    const a = MF[k], b = MF[k + 1];
    if (w0 === w1) {
      const xa = Math.round(CX - w0 + 2 * w0 * a);
      dc.fillRectangle(xa, y0, Math.round(CX - w0 + 2 * w0 * b) - xa + 1, y1 - y0);
      continue;
    }
    dc.fillPolygon([
      [CX - w0 + 2 * w0 * a, y0], [CX - w0 + 2 * w0 * b + 1, y0],
      [CX - w1 + 2 * w1 * b + 1, y1], [CX - w1 + 2 * w1 * a, y1],
    ]);
  }
}

// cap height that fits txt into maxW
function fitH(txt, h, maxW) {
  const w = F.stW(txt, h);
  return w > maxW ? (h * maxW) / w : h;
}

let fpsV = 10; // slower wax (cold outside) needs fewer frames

const face = {
  get fps() { return fpsV; },

  // static layer: background, halo, liquid, date, slots; the wax, the glass over it and the time move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const c = PAL[st - 1];
    const acc = d.accent;
    const p = a.intro;
    // light level: the lamp switches on during the intro
    const L = 0.2 + 0.8 * G.easeInOut(p * 1.25);
    const lc = st === 1 ? acc : st === 2 ? 0x5fe6d2 : 0x2ef2ff; // label colour
    // outside temperature -> wax speed (cold = lazy, warm = lively)
    const tc = d.temp === -99 ? 16 : d.temp;
    const sp = G.clamp((tc + 5) / 35.0, 0, 1);
    const per = 34000 - 22000 * sp;
    fpsV = sp < 0.35 ? 7 : 10;
    const seed = (d.wakeN % 89) * 0.0731;
    const T = a.t + 5200 * G.ease(p);
    const br = 0.9 + 0.1 * Math.sin(a.t / 900.0);

    if (S) {
      // background: vertical gradient bands
      for (let i = 0; i < 12; i++) {
        dc.setColor(G.mix(c[0], c[1], i / 11.0), -1);
        dc.fillRectangle(0, i * 38, 454, 38);
      }
      // glow halo around the glass
      for (let i = 0; i < 3; i++) {
        dc.setColor(G.mix(c[1], c[2], (0.1 + i * 0.09) * L * br), -1);
        dc.fillPolygon(glassPoly(30 - i * 10, 0));
      }
      // liquid: 7 slices following the profile, darker at the top, lit from below
      for (let i = 0; i < 7; i++) {
        dc.setColor(G.dim(G.mix(c[3], c[4], i / 6.0), L), -1);
        dc.fillPolygon([[CX - PW[i], PY[i]], [CX + PW[i], PY[i]], [CX + PW[i + 1], PY[i + 1] + 1], [CX - PW[i + 1], PY[i + 1] + 1]]);
      }
      dc.setColor(G.dim(G.mix(c[4], c[2], 0.22 * br), L), -1);
      dc.fillEllipse(CX, 330, 92, 34);
    }

    if (M) {
      // ---- wax: blob centres
      const bx = [0, 0, 0, 0, 0], by = [0, 0, 0, 0, 0], ba = [0, 0, 0, 0, 0], bb = [0, 0, 0, 0, 0], bh = [0, 0, 0, 0, 0];
      for (let i = 0; i < 5; i++) {
        const ph = frac(T / (per * BP[i]) + BO[i] + seed * (i + 1));
        const u = 0.5 - 0.5 * Math.cos(ph * 2 * Math.PI);
        const v = Math.abs(Math.sin(ph * 2 * Math.PI));
        const y = Y_BOT - u * (Y_BOT - Y_TOP);
        const r = BR[i] * (1.0 - 0.12 * u);
        const ea = r * (1 - 0.1 * v), eb = r * (1 + 0.2 * v);
        let lim = hwAt(y - eb * 0.7) - ea - 5;
        if (lim < 0) lim = 0;
        let x = CX + BX[i] * (hwAt(y) - r) + 9 * G.noise(T / 5200.0 + i * 2.7);
        x = G.clamp(x, CX - lim, CX + lim);
        bx[i] = x; by[i] = y; ba[i] = ea; bb[i] = eb;
        bh[i] = 322 - 150 * u;
      }
      const bump = [0, 0, 0];
      for (let j = 0; j < 3; j++) bump[j] = 13 + 7 * Math.sin(T / 1700.0 + j * 2.1);
      // two passes: rim (full size) then core (shrunk, shifted down: lit from the bulb below)
      for (let pass = 0; pass < 2; pass++) {
        const k = pass === 0 ? 1.0 : 0.66;
        const oy = pass === 0 ? 0 : 3;
        const sat = pass === 0 ? 0.92 : 0.55;
        dc.setColor(G.dim(st === 3 ? G.hsv(186, sat, 1.0) : c[5 + pass], L), -1);
        dc.fillEllipse(CX, 66, 38 * k, 12 * k);
        if (st === 3) dc.setColor(G.dim(G.hsv(322, sat, 1.0), L), -1);
        dc.fillEllipse(CX, POOL_Y + oy, (hwAt(POOL_Y) + 2) * (pass === 0 ? 1 : 0.86), 32 * k);
        for (let j = 0; j < 3; j++) dc.fillCircle(CX - 54 + j * 54, 318 + oy + (1 - k) * 8, bump[j] * k);
        for (let i = 0; i < 5; i++) {
          if (st === 3) dc.setColor(G.dim(G.hsv(bh[i], sat, 1.0), L), -1);
          dc.fillEllipse(bx[i], by[i] + oy, ba[i] * k, bb[i] * k);
          // necks: to the pool, to the top, to other blobs
          neck(dc, bx[i], 326 + oy, 14, bx[i], by[i] + oy, ba[i], k);
          neck(dc, bx[i], 66, 10, bx[i], by[i] + oy, ba[i], k);
          for (let j = i + 1; j < 5; j++) neck(dc, bx[i], by[i] + oy, ba[i], bx[j], by[j] + oy, ba[j], k);
        }
      }
      // hot spots near the bottom of the blobs that are still warm (lower half of the lamp)
      for (let i = 0; i < 5; i++) {
        const u = (322 - bh[i]) / 150.0;
        if (ba[i] > 18 && u < 0.5) {
          dc.setColor(G.dim(G.mix(c[6], c[7], 1 - u * 2), L), -1);
          dc.fillEllipse(bx[i] - ba[i] * 0.15, by[i] + bb[i] * 0.42, ba[i] * 0.34, bb[i] * 0.18);
        }
      }
      dc.setColor(G.dim(c[7], L), -1);
      dc.fillEllipse(CX - 20, POOL_Y - 12, 44, 7);

      // ---- glass: edge lines + reflection stripes
      dc.setColor(G.dim(c[8], L * 0.8), -1);
      dc.setPenWidth(2);
      for (let i = 0; i < 7; i++) {
        dc.drawLine(CX - PW[i], PY[i], CX - PW[i + 1], PY[i + 1]);
        dc.drawLine(CX + PW[i], PY[i], CX + PW[i + 1], PY[i + 1]);
      }
      dc.setColor(G.dim(G.mix(c[4], 0xffffff, 0.38), L), -1);
      dc.fillPolygon([[CX - 34, 84], [CX - 26, 84], [CX - 66, 262], [CX - 80, 262]]);
      dc.setColor(G.dim(G.mix(c[4], 0xffffff, 0.22), L), -1);
      dc.fillPolygon([[CX - 80, 272], [CX - 68, 272], [CX - 72, 292], [CX - 86, 292]]);
      dc.fillPolygon([[CX + 66, 200], [CX + 72, 200], [CX + 92, 284], [CX + 86, 284]]);

      // ---- metal: cap, collar, base
      metal(dc, c, 26, 22, 58, 50, L);
      metal(dc, c, 58, 52, 68, 52, L * 0.8);
      metal(dc, c, 336, 104, 350, 104, L * 0.85);
      metal(dc, c, 350, 92, 454, 150, L);
      dc.setColor(G.dim(c[12], L * 0.7), -1);
      dc.fillRectangle(CX - 104, 349, 208, 3);
      if (st === 3) {
        // neon outline on the dark metal
        dc.setColor(G.dim(c[8], L), -1);
        dc.drawLine(CX - 92, 352, CX - 150, 454);
        dc.drawLine(CX + 92, 352, CX + 150, 454);
        dc.drawLine(CX - 22, 26, CX + 22, 26);
      }

      // ---- time inside the glass: hours over minutes, rising up like wax
      const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
      const mm = G.pad2(d.m);
      const p1 = G.spring(G.stag(p, 0, 0.12, 0.6));
      const p2 = G.spring(G.stag(p, 1, 0.12, 0.6));
      const ty1 = 168 + (1 - p1) * 70, ty2 = 258 + (1 - p2) * 70;
      if (p1 > 0) {
        dc.setColor(c[10], -1);
        F.st(dc, hh, CX + 3, ty1 + 4, 70, 12, 1, 1.0, 0);
        dc.setColor(G.mix(c[10], c[9], G.clamp(p1, 0, 1)), -1);
        F.st(dc, hh, CX, ty1, 70, 8, 1, 1.0, 0);
      }
      if (p2 > 0) {
        dc.setColor(c[10], -1);
        F.st(dc, mm, CX + 3, ty2 + 4, 70, 12, 1, 1.0, 0);
        dc.setColor(G.mix(c[10], c[9], G.clamp(p2, 0, 1)), -1);
        F.st(dc, mm, CX, ty2, 70, 8, 1, 1.0, 0);
      }
    }

    if (!S) return;
    // ---- date (left)
    const q1 = G.ease(G.stag(p, 2, 0.12, 0.5));
    if (q1 > 0) {
      dc.setColor(G.dim(lc, q1), -1);
      F.px(dc, d.dowStr, 80, 150, 3, 1, 0);
      dc.setColor(G.dim(c[9], q1), -1);
      F.st(dc, "" + d.day, 80, 202, 44, 6, 1, 1.0, 0);
      dc.setColor(G.dim(c[11], q1), -1);
      F.px(dc, d.monStr, 80, 236, 3, 1, 0);
    }
    // ---- slots (right)
    for (let k = 0; k < 3; k++) {
      const sl = d.slots[k];
      const q = G.ease(G.stag(p, 2 + k, 0.1, 0.5));
      if (q <= 0) continue;
      const y = 128 + k * 74;
      const x = 372 + k * 4;
      dc.setColor(G.dim(lc, q * 0.9), -1);
      F.px(dc, sl.lbl, x, y, 2, 1, 0);
      dc.setColor(G.dim(d.dcol, q), -1);
      F.st(dc, sl.val, x, y + 34, fitH(sl.val, 22, 104 - k * 6), 3, 1, 1.0, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const c = PAL[st - 1];
    const ox = o[0], oy = o[1];
    // thin glass + cap + base outline
    dc.setPenWidth(2);
    dc.setColor(G.dim(c[8], 0.45), -1);
    for (let i = 0; i < 7; i++) {
      dc.drawLine(CX - PW[i] + ox, PY[i] + oy, CX - PW[i + 1] + ox, PY[i + 1] + oy);
      dc.drawLine(CX + PW[i] + ox, PY[i] + oy, CX + PW[i + 1] + ox, PY[i + 1] + oy);
    }
    dc.setColor(G.dim(c[14], 0.4), -1);
    dc.drawLine(CX - 22 + ox, 26 + oy, CX + 22 + ox, 26 + oy);
    dc.drawLine(CX - 22 + ox, 26 + oy, CX - 50 + ox, 58 + oy);
    dc.drawLine(CX + 22 + ox, 26 + oy, CX + 50 + ox, 58 + oy);
    dc.drawLine(CX - 92 + ox, 350 + oy, CX - 140 + ox, 440 + oy);
    dc.drawLine(CX + 92 + ox, 350 + oy, CX + 140 + ox, 440 + oy);
    dc.drawLine(CX - 104 + ox, 343 + oy, CX + 104 + ox, 343 + oy);
    // resting wax: dim pool and two blobs
    dc.setColor(G.dim(c[5], 0.3), -1);
    dc.fillEllipse(CX + ox, 336 + oy, 80, 10);
    dc.fillEllipse(CX - 44 + ox, 296 + oy, 17, 19);
    dc.fillEllipse(CX + 30 + ox, 112 + oy, 11, 13);
    // time
    const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
    dc.setColor(G.dim(c[9], 0.6), -1);
    F.st(dc, hh, CX + ox, 168 + oy, 70, 3, 1, 1.0, 0);
    F.st(dc, G.pad2(d.m), CX + ox, 258 + oy, 70, 3, 1, 1.0, 0);
    dc.setColor(G.dim(c[11], 0.45), -1);
    F.px(dc, d.dowStr + " " + d.day, 80 + ox, 196 + oy, 2, 1, 0);
  },
};
export default face;
