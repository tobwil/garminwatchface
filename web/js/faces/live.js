// LIVE — "Live-Coach": what is going on in your body right now. The "now" lib combines heart rate,
// resting heart rate, movement and the stress / Body Battery trends into one state ("Anspannung im
// Sitzen", "Lädt gerade auf", "Nachbrenner" ...), says why with the real numbers and gives a short,
// warm tip that changes with every raise. While you look, the pulse ticks live and the heart beats in
// your real rhythm.
// Styles 1 Kiesel (black) and 2 Kiesel Weiß (white): Pebble Text Watch spirit in the bitmap font, the
// lines slide in from the right one after the other on every raise; below the live pulse with a
// beating heart and the three trend arrows (pulse, stress, Body Battery).
// Style 3 Aura: a meditating figure in a glow of the state colour (opaque stepped rings), the heart
// beats in its chest; for tense states the aura becomes a breathing guide (4 s in, 6 s out).
// Mirrors watch/source/faces/Live.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { NW, NS } from "../engine/now.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/kiesel.js";

const SP = encodeAll(S);
const DOW = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const X0 = 62; // left edge of the Kiesel text
const HEART = [0x36, 0x7f, 0x7f, 0x3e, 0x1c, 0x08]; // 7 x 6 pixel heart
const ARW = [
  [0x04, 0x0e, 0x15, 0x04, 0x04, 0x04, 0x04], // up
  [0x00, 0x04, 0x02, 0x1f, 0x02, 0x04, 0x00], // steady
  [0x04, 0x04, 0x04, 0x04, 0x15, 0x0e, 0x04], // down
];
const TL = ["Puls", "Stress", "Akku"];
const ACX = 227, ACY = 212, AR = 92; // aura centre and outer radius (at rest)

// text lines of the Kiesel styles, built once per static layer: text, y, scale, bold, kind (0 head 1 reason 2 tip)
let lk = -1, lD = null;
let LT = [], LY = [], LS = [], LB = [];

// dot bitmap: rows of w bits (msb = left)
function bits(dc, rows, w, x, y, sc) {
  for (let r = 0; r < rows.length; r++) {
    let c = 0;
    while (c < w) {
      if (rows[r] & (1 << (w - 1 - c))) {
        let e = c + 1;
        while (e < w && (rows[r] & (1 << (w - 1 - e)))) e++;
        dc.fillRectangle(x + c * sc, y + r * sc, (e - c) * sc, sc);
        c = e;
      } else c++;
    }
  }
}

// longest word of s
function longest(s) {
  let m = 0, n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charAt(i) === " ") n = 0;
    else { n++; if (n > m) m = n; }
  }
  return m;
}

// heart size factor from the beat: 1 on the beat, 0.5 on the second (smaller) knock, else 0
function beat(t, bpm) {
  const per = Math.floor(60000 / (bpm > 30 ? bpm : 60));
  const ph = (t % per) / per;
  return ph < 0.14 ? 1 : ph >= 0.2 && ph < 0.3 ? 0.5 : 0;
}

// lines for the Kiesel styles (head / reason / tip), vertically centred between y 80 and 334
function layout(d, R) {
  const k = (d.doy * 1440 + d.mins) * 4 + (d.wakeN % 4);
  if (k === lk && d === lD) return; // (web: d is rebuilt whenever the simulation changes)
  lk = k;
  lD = d;
  LT = []; LY = []; LS = []; LB = [];
  const head = NW.head(R);
  const hs = longest(head) > 11 ? 4 : 5;
  const H = NW.wrap(head, hs === 5 ? 11 : 14);
  const Rs = NW.wrap(NW.reason(d, R), 20);
  const T = NW.wrap(NW.tip(d, R, d.wakeN), 20);
  const tot = H.length * (hs * 7 + 7) + 10 + Rs.length * 25 + 12 + T.length * 25 - 4;
  let y = 80 + Math.floor((254 - tot) / 2);
  for (let i = 0; i < H.length; i++) { LT.push(H[i]); LY.push(y); LS.push(hs); LB.push(0); y += hs * 7 + 7; }
  y += 10;
  for (let i = 0; i < Rs.length; i++) { LT.push(Rs[i]); LY.push(y); LS.push(3); LB.push(1); y += 25; }
  y += 12;
  for (let i = 0; i < T.length; i++) { LT.push(T[i]); LY.push(y); LS.push(3); LB.push(2); y += 25; }
}

// [background, ink, dim ink, state colour]
function pal(st, c) {
  if (st === 2) return [0xffffff, 0x000000, 0x555555, G.mix(c, 0x000000, 0.3)];
  return [0x000000, 0xffffff, 0xaaaaaa, c];
}

function kLine(dc, i, x) {
  const sc = LS[i];
  F.px(dc, LT[i], x, LY[i], sc, 0, 0);
  if (LB[i] === 0) F.px(dc, LT[i], x + 2, LY[i], sc, 0, 0);
}

// the Kiesel styles
function kiesel(dc, d, a, R, S, M) {
  const P = pal(d.cfg.style, NW.COL[R[0]]);
  const p = a.intro;
  layout(d, R);
  const n = LT.length;
  const step = n > 1 ? Math.min(0.1, 0.58 / (n - 1)) : 0;
  if (S) {
    dc.setColor(P[0], -1);
    dc.fillRectangle(0, 0, 454, 454);
    // small time + date
    const ts = G.timeStr(d), ds = DOW[d.dow] + " " + d.day + "." + d.mon + ".";
    const w = F.pxW(ts, 3) + 14 + F.pxW(ds, 2);
    const x = Math.round(227 - w / 2);
    dc.setColor(P[1], -1);
    F.px(dc, ts, x, 46, 3, 0, 0);
    dc.setColor(P[2], -1);
    F.px(dc, ds, x + F.pxW(ts, 3) + 14, 53, 2, 0, 0);
    if (!d.phone) {
      SPR.draw(dc, SP.BT, 223, 18, 2, [-1, P[2]], false);
      for (let i = 0; i < 7; i++) dc.fillRectangle(219 + i * 3, 16 + i * 3, 3, 3);
    }
    // state marker beside the headline
    let hn = 0;
    for (let i = 0; i < n; i++) if (LB[i] === 0) hn++;
    dc.setColor(P[3], -1);
    dc.fillRectangle(X0 - 16, LY[0], 6, hn * (LS[0] * 7 + 7) - 7);
    // the lines (in a full frame during the intro the sliding ones are drawn below only)
    for (let i = 0; i < n; i++) {
      if (M && G.stag(p, i, step, 0.42) < 1) continue;
      dc.setColor(LB[i] === 1 ? P[2] : P[1], -1);
      kLine(dc, i, X0);
    }
    // trend arrows
    let tw = 0;
    for (let k = 0; k < 3; k++) tw += F.pxW(TL[k], 2) + 16 + (k < 2 ? 20 : 0);
    let tx = Math.round(227 - tw / 2);
    for (let k = 0; k < 3; k++) {
      dc.setColor(P[2], -1);
      tx += F.pxW(TL[k], 2) + 6;
      F.px(dc, TL[k], tx - F.pxW(TL[k], 2) - 6, 398, 2, 0, 0);
      dc.setColor(P[1], -1);
      bits(dc, ARW[1 - NW.trend(R, k)], 5, tx, 398, 2);
      tx += 10 + 20;
    }
  }

  if (!M) return;
  // ---- intro: the lines slide in from the right one after the other
  if (p < 1) {
    for (let i = 0; i < n; i++) {
      const q = G.stag(p, i, step, 0.42);
      if (q >= 1) continue;
      if (!S) {
        // hide the line of the cached static layer
        dc.setColor(P[0], -1);
        dc.fillRectangle(X0 - 2, LY[i] - 2, 454 - X0, LS[i] * 7 + 4);
      }
      const x = X0 + Math.round((1 - G.easeInOut(q)) * 420);
      if (x >= 454) continue;
      dc.setColor(LB[i] === 1 ? P[2] : P[1], -1);
      kLine(dc, i, x);
    }
  }
  // ---- live pulse: beating heart and the ticking number
  const hr = d.hrNow();
  const b = a.live ? beat(a.t, R[1]) : 0;
  const hs = b >= 1 ? 6 : b > 0 ? 5 : 4;
  const num = hr > 0 ? "" + hr : "--";
  const nw = F.pxW(num, 5) + 2;
  const gx = Math.round(227 - (28 + 14 + nw + 10 + F.pxW("bpm", 2)) / 2);
  dc.setColor(P[3], -1);
  bits(dc, HEART, 7, gx + 14 - Math.round(3.5 * hs), 360 - 3 * hs, hs);
  dc.setColor(P[1], -1);
  F.px(dc, num, gx + 42, 343, 5, 0, 0);
  F.px(dc, num, gx + 44, 343, 5, 0, 0);
  dc.setColor(P[2], -1);
  F.px(dc, "bpm", gx + 42 + nw + 10, 364, 2, 0, 0);
}

// silhouette of a sitting, meditating figure (centre x 227): head, torso, arms resting on the knees
// (with a gap to the waist so the glow shows through), crossed legs
function figure(dc, col) {
  dc.setColor(col, -1);
  dc.fillCircle(227, 146, 16);
  dc.fillRectangle(221, 158, 12, 14);
  dc.fillPolygon([[204, 170], [250, 170], [260, 182], [250, 242], [204, 242], [194, 182]]);
  dc.fillCircle(205, 183, 12);
  dc.fillCircle(249, 183, 12);
  for (let k = 0; k < 2; k++) {
    const sx = k === 0 ? 1 : -1, o = k === 0 ? 0 : 454;
    dc.fillPolygon([[o + sx * 195, 176], [o + sx * 207, 188], [o + sx * 193, 232], [o + sx * 179, 226]]);
    dc.fillPolygon([[o + sx * 179, 224], [o + sx * 193, 232], [o + sx * 168, 258], [o + sx * 156, 250]]);
    dc.fillCircle(o + sx * 160, 254, 7);
  }
  dc.fillEllipse(227, 260, 78, 16);
}

// the glow: opaque stepped rings, b = breath 0..1 (grows the rings), g = intro growth 0..1
function aura(dc, C, b, g) {
  for (let i = 0; i < 7; i++) {
    const r = Math.round((AR - i * 9 + b * (14 - i)) * g);
    if (r <= 0) continue;
    dc.setColor(G.mix(0x000000, C, 0.13 + i * 0.08), -1);
    dc.fillCircle(ACX, ACY, r);
  }
  figure(dc, G.mix(0x000000, C, 0.04));
}

function upc(s) { return s.toUpperCase(); }

// the Aura style
function auraStyle(dc, d, a, R, S, M) {
  const C = NW.COL[R[0]];
  const p = a.intro;
  const dyn = NW.breathe(R[0]); // the aura is a breathing guide: drawn every frame
  if (S) {
    const head = upc(NW.head(R));
    const tip = NW.tip(d, R, d.wakeN);
    let T = NW.wrap(tip, tip.length <= 24 ? 24 : Math.floor((tip.length + 1) / 2) + 3); // one line or two balanced ones
    if (T.length > 2) T = NW.wrap(tip, 25);
    dc.setColor(0xffffff, -1);
    F.st(dc, G.timeStr(d), 227, 56, 38, 4, 1, 1.0, 0);
    dc.setColor(0x8a8a96, -1);
    F.px(dc, upc(d.dowStr + " " + d.day + ". " + d.monStr), 227, 84, 2, 1, 0);
    if (!dyn) aura(dc, C, 0.35, 1);
    // side readouts: stress and Body Battery (right), the pulse label (left; the number ticks)
    dc.setColor(0x8a8a96, -1);
    F.px(dc, "PULS", 64, 232, 2, 1, 0);
    F.px(dc, "STRESS", 390, 196, 2, 1, 0);
    F.px(dc, "AKKU", 390, 262, 2, 1, 0);
    dc.setColor(0xffffff, -1);
    F.st(dc, R[5] >= 0 ? "" + R[5] : "--", 380, 176, 24, 3, 1, 1.0, 0);
    F.st(dc, R[7] >= 0 ? R[7] + "%" : "--", 380, 242, 24, 3, 1, 1.0, 0);
    dc.setColor(G.mix(C, 0xffffff, 0.3), -1);
    bits(dc, ARW[1 - NW.trend(R, 1)], 5, 382 + Math.round(F.stW(R[5] >= 0 ? "" + R[5] : "--", 24) / 2), 167, 2);
    bits(dc, ARW[1 - NW.trend(R, 2)], 5, 382 + Math.round(F.stW(R[7] >= 0 ? R[7] + "%" : "--", 24) / 2), 233, 2);
    bits(dc, ARW[1 - NW.trend(R, 0)], 5, 59, 246, 2);
    // headline and tip
    dc.setColor(G.mix(C, 0xffffff, 0.25), -1);
    if (F.stW(head, 20) <= 330) F.st(dc, head, 227, 338, 20, 3, 1, 1.0, 0);
    else {
      const H = NW.wrap(head, Math.floor((head.length + 1) / 2) + 2);
      F.st(dc, H[0], 227, 330, 18, 3, 1, 1.0, 0);
      if (H.length > 1) F.st(dc, H[1], 227, 354, 18, 3, 1, 1.0, 0);
    }
    dc.setColor(0xd0d0d8, -1);
    for (let i = 0; i < T.length && i < 2; i++) F.px(dc, T[i], 227, 360 + i * 20, 2, 1, 0);
  }

  if (!M) return;
  // ---- the aura: grows on the raise; breathes (4 s in, 6 s out) for tense states
  let b = 0.35;
  let lbl = "";
  if (dyn && a.live && a.t >= 1400) {
    const ph = (a.t - 1400) % 10000;
    if (ph < 4000) { b = G.easeInOut(ph / 4000); lbl = "ein"; }
    else { b = 1 - G.easeInOut((ph - 4000) / 6000); lbl = "aus"; }
  } else if (dyn && a.live) b = 0;
  if (dyn || p < 1) {
    if (!dyn) {
      dc.setColor(0x000000, -1);
      dc.fillCircle(ACX, ACY, AR + 12);
    }
    aura(dc, C, b, G.ease(p));
    if (dyn) {
      dc.setColor(G.mix(C, 0xffffff, 0.35), -1);
      dc.setPenWidth(2);
      dc.drawCircle(ACX, ACY, Math.round((AR + b * 14) * G.ease(p)) + 3);
    }
    if (lbl !== "") {
      dc.setColor(0xffffff, -1);
      F.px(dc, lbl, 227, 290, 3, 1, 0);
    }
  }
  // ---- the heart in the chest, the live pulse number
  const hr = d.hrNow();
  const bt = a.live ? beat(a.t, R[1]) : 0;
  const hr2 = 7 + Math.round(bt * 3);
  const hh = Math.floor(hr2 / 2);
  dc.setColor(G.mix(C, 0xff3a4a, 0.6), -1);
  dc.fillCircle(240 - hh, 200, hh + 1);
  dc.fillCircle(240 + hh, 200, hh + 1);
  dc.fillPolygon([[240 - hr2 - 1, 201], [240 + hr2 + 1, 201], [240, 202 + hr2 + 2]]);
  dc.setColor(0xffffff, -1);
  F.st(dc, hr > 0 ? "" + hr : "--", 64, 206, 30, 4, 1, 1.0, 0);
}

export default {
  fps: 10,

  // static layer: texts, trends, the aura at rest; the slide-in, the live pulse, the heart and the
  // breathing aura move. The tip changes with every raise (d.wakeN) -> part of the key.
  bgKey(d) { return (d.doy * 1440 + d.mins) * 4 + (d.wakeN % 4); },
  reveal() { return false; },
  // the Aura style and the tips bring their own breathing guide
  breathes: true,

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    NW.tick(d);
    const R = NW.judge(d);
    if (d.cfg.style === 3) auraStyle(dc, d, a, R, S, M);
    else kiesel(dc, d, a, R, S, M);
  },

  aod(dc, d) {
    NW.tick(d);
    const R = NW.judge(d);
    const o = St.shift(d);
    const C = G.dim(NW.COL[R[0]], 0.6);
    const hr = d.hrNow();
    if (d.cfg.style === 3) {
      dc.setColor(G.dim(C, 0.8), -1);
      dc.setPenWidth(2);
      dc.drawCircle(227 + o[0], 200 + o[1], 92);
      dc.setColor(0x7a7a7a, -1);
      F.st(dc, G.timeStr(d), 227 + o[0], 196 + o[1], 44, 3, 1, 1.0, 0);
      dc.setColor(C, -1);
      F.px(dc, upc(NW.SHORT[R[0]]), 227 + o[0], 312 + o[1], 2, 1, 0);
    } else {
      dc.setColor(0x6a6a6a, -1);
      F.px(dc, G.timeStr(d), 227 + o[0], 170 + o[1], 7, 1, 1);
      dc.setColor(C, -1);
      F.px(dc, NW.SHORT[R[0]], 227 + o[0], 250 + o[1], 3, 1, 0);
    }
    dc.setColor(C, -1);
    const s = hr > 0 ? "" + hr : "--";
    const w = 14 + 8 + F.pxW(s, 2);
    bits(dc, HEART, 7, 227 - Math.round(w / 2) + o[0], 340 + o[1], 2);
    dc.setColor(0x6a6a6a, -1);
    F.px(dc, s, 227 - Math.round(w / 2) + 22 + o[0], 338 + o[1], 2, 0, 0);
  },
};
