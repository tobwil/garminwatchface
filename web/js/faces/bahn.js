// BAHN — "Bahnhofsuhr": a railway station clock. 60 bar markers, plain bar hands
// and the red seconds hand with its round disc ("Kelle"). The seconds hand sweeps
// a full turn in 58.5 s, rests at 12 for ~1.5 s, then the minute hand jumps to
// the next minute with a tiny overshoot bounce.
// Styles: 1 Klassisch (white dial), 2 Nacht (black dial), 3 Kelle (black, accent markers, large).
// Mirrors watch/source/faces/Bahn.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const CX = 227, CY = 227, RAD = Math.PI / 180;

// sub-second phase lock: d.s only has whole seconds, a.t is ms since wake
let lastS = -1;
let lockT = -1;

// rectangle along clock angle deg from radius r1 to r2, width w (r1 < 0 = behind centre)
function bar(dc, x, y, deg, r1, r2, w) {
  const s = Math.sin(deg * RAD), c = Math.cos(deg * RAD);
  const hx = (c * w) / 2, hy = (s * w) / 2;
  const x1 = x + s * r1, y1 = y - c * r1;
  const x2 = x + s * r2, y2 = y - c * r2;
  dc.fillPolygon([[x1 - hx, y1 - hy], [x2 - hx, y2 - hy], [x2 + hx, y2 + hy], [x1 + hx, y1 + hy]]);
}

// outline of the same rectangle (always-on)
function barLine(dc, x, y, deg, r1, r2, w) {
  const s = Math.sin(deg * RAD), c = Math.cos(deg * RAD);
  const hx = (c * w) / 2, hy = (s * w) / 2;
  const x1 = x + s * r1, y1 = y - c * r1;
  const x2 = x + s * r2, y2 = y - c * r2;
  dc.drawLine(x1 - hx, y1 - hy, x2 - hx, y2 - hy);
  dc.drawLine(x2 - hx, y2 - hy, x2 + hx, y2 + hy);
  dc.drawLine(x2 + hx, y2 + hy, x1 + hx, y1 + hy);
  dc.drawLine(x1 + hx, y1 + hy, x1 - hx, y1 - hy);
}

// minute-hand release: snap past the mark, then a short damped bounce (k: seconds since the jump)
function jump(k) {
  if (k < 0.07) return (1.22 * k) / 0.07;
  const u = (k - 0.07) / 0.5;
  if (u >= 1) return 1;
  return 1 + 0.22 * Math.cos(u * Math.PI * 2.5) * (1 - u) * (1 - u);
}

// the seconds hand with its disc
function kelle(dc, x, y, deg, len, back, w, dr, dR, col) {
  dc.setColor(col, -1);
  bar(dc, x, y, deg, -back, len, w);
  dc.fillCircle(G.ptX(x, dR, deg), G.ptY(y, dR, deg), dr);
  dc.fillCircle(x, y, w + 2.5);
}

export default {
  fps: 20,

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const white = st === 1, big = st === 3;

    // ---------------------------------------------------------------- dial
    const dialCol = white ? 0xf3f3ef : 0x000000;
    const markCol = white ? 0x141414 : 0xefefef;
    const handCol = white ? 0x141414 : 0xf2f2f2;
    const dq = G.ease(p * 4);
    if (white) {
      // brushed steel case ring, then the white dial
      dc.setColor(G.dim(0x8d9095, dq), -1);
      dc.fillCircle(CX, CY, 227);
      dc.setColor(G.dim(0xc9cbce, dq), -1);
      dc.fillCircle(CX, CY, 222);
      dc.setColor(G.dim(0x5e6166, dq), -1);
      dc.fillCircle(CX, CY, 220);
      dc.setColor(G.dim(dialCol, dq), -1);
      dc.fillCircle(CX, CY, 218);
    } else if (!big) {
      dc.setColor(0x1c1c1c, -1);
      dc.setPenWidth(2);
      dc.drawCircle(CX, CY, 223);
    }

    // ---------------------------------------------------------------- markers (fade in clockwise)
    const rOut = white ? 208 : 216;
    for (let i = 0; i < 60; i++) {
      const q = G.stag(p, i, 0.0075, 0.12);
      if (q <= 0) break;
      const hour = i % 5 === 0;
      if (big) {
        if (hour) {
          dc.setColor(G.mix(dialCol, acc, q), -1);
          bar(dc, CX, CY, i * 6, rOut - 34 - 10 * G.ease(q), rOut, 15);
        } else {
          dc.setColor(G.mix(dialCol, 0x5a5a5a, q), -1);
          dc.fillCircle(G.ptX(CX, rOut - 5, i * 6), G.ptY(CY, rOut - 5, i * 6), 2.6);
        }
      } else {
        dc.setColor(G.mix(dialCol, markCol, q), -1);
        if (hour) bar(dc, CX, CY, i * 6, rOut - 34 - 12 * G.ease(q), rOut, 12);
        else bar(dc, CX, CY, i * 6, rOut - 14, rOut, 4.4);
      }
    }

    // ---------------------------------------------------------------- data
    const lblCol = white ? 0x9a9a95 : 0x707070;
    const valCol = white ? 0x2e2e2e : G.mix(0x000000, d.dcol, 0.85);
    for (let k = 0; k < 3; k++) {
      const qq = G.stag(p - 0.45, k, 0.06, 0.3);
      if (qq <= 0) continue;
      const sl = d.slots[k];
      const x = k === 0 ? CX : CX + (k === 1 ? -96 : 96);
      const y = k === 0 ? 128 : 214;
      dc.setColor(G.mix(dialCol, lblCol, qq), -1);
      F.px(dc, sl.lbl, x, y, 2, 1, 0);
      dc.setColor(G.mix(dialCol, valCol, qq), -1);
      F.st(dc, sl.val, x, y + 33, 20, 3, 1, 1.0, 0);
    }
    // date window at 6
    const wq = G.clamp((p - 0.6) / 0.3, 0, 1);
    if (wq > 0) {
      const ds = d.dowStr + " " + d.day;
      const ww = F.stW(ds, 15) + 22;
      const wy = big ? 312 : 306;
      dc.setColor(G.mix(dialCol, white ? 0xb4b4ae : 0x3a3a3a, wq), -1);
      dc.fillRoundedRectangle(CX - ww / 2 - 2, wy - 16, ww + 4, 32, 5);
      dc.setColor(G.mix(dialCol, white ? 0xffffff : 0x0d0d0d, wq), -1);
      dc.fillRoundedRectangle(CX - ww / 2, wy - 14, ww, 28, 4);
      dc.setColor(G.mix(dialCol, white ? 0x1a1a1a : valCol, wq), -1);
      F.st(dc, ds, CX, wy, 15, 2.6, 1, 1.0, 0);
    }

    // ---------------------------------------------------------------- time
    // seconds since the minute began, sub-second phase locked to the second tick
    if (a.t < lockT) { lockT = -1; lastS = -1; }
    if (d.s !== lastS) { if (lastS >= 0) lockT = a.t; lastS = d.s; }
    const frac = lockT >= 0 ? G.clamp((a.t - lockT) / 1000, 0, 0.999) : (a.t % 1000) / 1000;
    const ts = a.live ? d.s + frac : d.s;
    let mDeg = d.m * 6;
    if (a.live && p >= 1 && ts < 0.6) mDeg = (d.m - 1) * 6 + 6 * jump(ts);
    const hDeg = (d.h % 12) * 30 + mDeg / 12;
    const sDeg = Math.min(360, (ts / 58.5) * 360);

    // intro: hour hand swings from 12, minute hand last with a bounce, then the Kelle
    const hA = hDeg * G.easeInOut(G.clamp((p - 0.18) / 0.45, 0, 1));
    const mA = mDeg * G.spring(G.clamp((p - 0.38) / 0.45, 0, 1));
    const sq = G.clamp((p - 0.62) / 0.38, 0, 1);
    const sA = sDeg * G.ease(sq);

    const hLen = big ? 136 : 132, hW = big ? 24 : 19;
    const mLen = big ? 206 : 200, mW = big ? 17 : 14;
    const sLen = big ? 150 : 148, sW = big ? 5 : 4.4, dR = big ? 150 : 146, dr = big ? 20 : 16;
    const sCol = acc;

    if (white) {
      // soft drop shadow on the white dial
      const sh = 0xc8c8c2;
      dc.setColor(sh, -1);
      bar(dc, CX + 3, CY + 4, hA, -38, hLen, hW);
      bar(dc, CX + 4, CY + 5, mA, -40, mLen, mW);
      if (sq > 0) {
        bar(dc, CX + 5, CY + 6, sA, -60, sLen, sW);
        dc.fillCircle(G.ptX(CX + 5, dR, sA), G.ptY(CY + 6, dR, sA), dr);
      }
    }
    dc.setColor(handCol, -1);
    bar(dc, CX, CY, hA, -38, hLen, hW);
    bar(dc, CX, CY, mA, -40, mLen, mW);
    dc.fillCircle(CX, CY, big ? 12 : 10);
    if (sq > 0) {
      kelle(dc, CX, CY, sA, sLen, 60, sW, dr, dR, G.mix(dialCol, sCol, G.ease(sq * 2)));
      dc.setColor(white ? 0x8c120c : G.dim(sCol, 0.55), -1);
      dc.fillCircle(CX, CY, 2.2);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const x = CX + o[0], y = CY + o[1];
    dc.setColor(0x5a5a5a, -1);
    for (let i = 0; i < 12; i++) {
      dc.fillCircle(G.ptX(x, 200, i * 30), G.ptY(y, 200, i * 30), i === 0 ? 4 : 2.5);
    }
    const mDeg = d.m * 6;
    const hDeg = (d.h % 12) * 30 + d.m * 0.5;
    dc.setPenWidth(2);
    dc.setColor(0x9a9a9a, -1);
    barLine(dc, x, y, hDeg, -30, 128, 17);
    barLine(dc, x, y, mDeg, -32, 192, 13);
    dc.setColor(G.dim(d.accent, 0.7), -1);
    dc.drawCircle(x, y, 7);
  },
};
