// CHRONO — classic analog chronograph: railroad minute track, applied hour
// indices, three sub-dials (9 / 3 / 6) carrying the data slots, date window
// at 4:30 and a sweeping seconds hand. Styles: 1 Noir, 2 Panda, 3 Racing.
// Mirrors watch/source/faces/Chrono.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const CX = 227, CY = 227, RAD = Math.PI / 180;
const SUBR = 42;
const SUBX = [-95, 95, 0];
const SUBY = [0, 0, 95];
const TACH = [500, 400, 300, 250, 200, 150, 120, 100, 90, 80, 70, 60];

// slot types whose raw value is naturally 0..100 -> drawn as a gauge
function isGauge(t) { return t === 23 || t === 22 || t === 1 || t === 42 || t === 35; }

// radial bar from r1 to r2, width w, shifted sideways by off (px)
function bar(dc, deg, r1, r2, w, off) {
  const s = Math.sin(deg * RAD), c = Math.cos(deg * RAD);
  const ox = c * off, oy = s * off, hx = (c * w) / 2, hy = (s * w) / 2;
  const x1 = CX + s * r1 + ox, y1 = CY - c * r1 + oy;
  const x2 = CX + s * r2 + ox, y2 = CY - c * r2 + oy;
  dc.fillPolygon([[x1 - hx, y1 - hy], [x2 - hx, y2 - hy], [x2 + hx, y2 + hy], [x1 + hx, y1 + hy]]);
}

// faceted (two-tone) hand: base width w at -back, shoulder width tw at len-tip, point at len
function blade(dc, deg, len, back, w, tw, tip, cL, cR) {
  const s = Math.sin(deg * RAD), c = Math.cos(deg * RAD);
  const bx = CX - s * back, by = CY + c * back;
  const mx = CX + s * (len - tip), my = CY - c * (len - tip);
  const tx = CX + s * len, ty = CY - c * len;
  dc.setColor(cL, -1);
  dc.fillPolygon([[bx, by], [bx - (c * w) / 2, by - (s * w) / 2], [mx - (c * tw) / 2, my - (s * tw) / 2], [tx, ty]]);
  dc.setColor(cR, -1);
  dc.fillPolygon([[bx, by], [tx, ty], [mx + (c * tw) / 2, my + (s * tw) / 2], [bx + (c * w) / 2, by + (s * w) / 2]]);
}

// outline of the same hand shape (always-on)
function outline(dc, deg, len, back, w, tw, tip, ox, oy) {
  const s = Math.sin(deg * RAD), c = Math.cos(deg * RAD);
  const bx = CX + ox - s * back, by = CY + oy + c * back;
  const mx = CX + ox + s * (len - tip), my = CY + oy - c * (len - tip);
  const tx = CX + ox + s * len, ty = CY + oy - c * len;
  const ax = bx - (c * w) / 2, ay = by - (s * w) / 2, ex = bx + (c * w) / 2, ey = by + (s * w) / 2;
  const lx = mx - (c * tw) / 2, ly = my - (s * tw) / 2, rx = mx + (c * tw) / 2, ry = my + (s * tw) / 2;
  dc.drawLine(ax, ay, lx, ly);
  dc.drawLine(lx, ly, tx, ty);
  dc.drawLine(tx, ty, rx, ry);
  dc.drawLine(rx, ry, ex, ey);
  dc.drawLine(ex, ey, ax, ay);
}

export default {
  fps: 15,

  // static layer: cached, redrawn when the minute changes
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const panda = st === 2, racing = st === 3;
    const R = racing ? 194 : 214; // outer edge of the minute track

    if (!a.bg) {
      // ---------------------------------------------------------------- dial
      if (panda) {
        dc.setColor(0x1b1c1e, -1);
        dc.fillCircle(CX, CY, 227);
        dc.setColor(0x2a2b2e, -1);
        dc.setPenWidth(2);
        dc.drawCircle(CX, CY, R + 6);
      }

      // tachymeter bezel
      if (racing) {
        const tp = G.ease(p * 1.3);
        dc.setColor(0x121212, -1);
        dc.fillCircle(CX, CY, 227);
        dc.setColor(0x000000, -1);
        dc.fillCircle(CX, CY, 199);
        dc.setColor(0x3a3a3a, -1);
        dc.setPenWidth(1);
        dc.drawCircle(CX, CY, 199);
        for (let i = 0; i < TACH.length; i++) {
          const deg = 21600 / TACH[i];
          const q = G.stag(tp, i, 0.05, 0.4);
          if (q <= 0) continue;
          dc.setColor(0xffffff, -1);
          dc.setPenWidth(2);
          G.tick(dc, CX, CY, 199, 204, deg);
          dc.setColor(G.dim(acc, q), -1);
          if (i === TACH.length - 1) continue; // 60 sits under the 12 mark
          F.st(dc, "" + TACH[i], G.ptX(CX, 214, deg), G.ptY(CY, 214, deg), 12, 2, 1, 1.0, 0);
        }
        dc.setColor(acc, -1);
        dc.fillPolygon([[CX, 203], [CX - 6, 214], [CX + 6, 214]]);
      }

      // railroad minute track
      const shown = Math.floor(G.ease(p * 1.4) * 60);
      dc.setPenWidth(1);
      dc.setColor(panda ? 0x55575c : 0x3c3c3c, -1);
      if (shown >= 60) { dc.drawCircle(CX, CY, R); dc.drawCircle(CX, CY, R - 8); }
      dc.setColor(panda ? 0xa6a8ad : 0x8a8a8a, -1);
      dc.setPenWidth(2);
      for (let i = 0; i < shown; i++) {
        if (i % 5 === 0) continue;
        G.tick(dc, CX, CY, R - 8, R, i * 6);
      }

      // applied hour indices
      const iOut = R - 12, iIn = R - 42;
      const body = 0xd2d2d2, hi = 0xffffff, sh = 0x7c7c7c;
      for (let i = 0; i < 12; i++) {
        const q = G.stag(p, i, 0.035, 0.35);
        if (q <= 0 || i === 6) continue; // the 6 o'clock sub-dial replaces it
        const deg = i * 30;
        const r1 = iOut - (iOut - iIn) * G.ease(q);
        if (i === 0) {
          for (let k = -1; k <= 1; k += 2) {
            dc.setColor(G.dim(body, q), -1);
            bar(dc, deg, r1, iOut, 7, k * 6);
            dc.setColor(G.dim(hi, q), -1);
            bar(dc, deg, r1, iOut, 2, k * 6 - 2.5);
          }
        } else {
          dc.setColor(G.dim(racing ? 0xf2f2f2 : body, q), -1);
          bar(dc, deg, r1, iOut, 10, 0);
          if (!racing) {
            dc.setColor(G.dim(hi, q), -1);
            bar(dc, deg, r1, iOut, 2, -4);
            dc.setColor(G.dim(sh, q), -1);
            bar(dc, deg, r1, iOut, 2, 4);
          }
          // lume plot at the inner end
          dc.setColor(G.dim(acc, q * 0.9), -1);
          dc.fillCircle(G.ptX(CX, r1 + 5, deg), G.ptY(CY, r1 + 5, deg), 2);
        }
      }

      // signature under 12
      const bp = G.ease(p * 1.5 - 0.3);
      dc.setColor(panda ? 0xe8e8e8 : 0xdedede, -1);
      F.st(dc, "FACELAB", CX, 106, 15, 2, 1, bp, 0);
      dc.setColor(G.dim(acc, bp), -1);
      F.st(dc, racing ? "RACING" : "CHRONOGRAPH", CX, 126, 10, 1, 1, bp, 0);

      // ---------------------------------------------------------------- sub-dials
      for (let k = 0; k < 3; k++) {
        const x = CX + SUBX[k], y = CY + SUBY[k];
        const q = G.stag(p, k, 0.1, 0.45);
        if (q <= 0) continue;
        const sl = d.slots[k];
        const t = d.cfg.slots[k];
        const gauge = isGauge(t);
        const raw = sl.raw;
        const discCol = panda ? 0xe6e1d3 : racing ? 0x000000 : 0x0e0e0e;
        const ringCol = panda ? 0xb3ac98 : racing ? 0xd8d8d8 : 0x4a4a4a;
        const tickCol = panda ? 0x5b574d : 0x8a8a8a;
        const txtCol = panda ? 0x161616 : d.dcol;
        const rr = SUBR * (0.6 + 0.4 * G.ease(q));
        dc.setColor(discCol, -1);
        dc.fillCircle(x, y, rr);
        if (!panda) {
          dc.setColor(0x1c1c1c, -1);
          dc.setPenWidth(1);
          dc.drawCircle(x, y, rr - 9);
          dc.drawCircle(x, y, rr - 15);
        }
        dc.setColor(G.mix(discCol, ringCol, q), -1);
        dc.setPenWidth(racing ? 2 : 1);
        dc.drawCircle(x, y, rr);
        const vq = G.ease(G.stag(p, k, 0.1, 0.6) * 1.0);
        dc.setColor(G.mix(discCol, tickCol, q), -1);
        if (gauge) {
          // 240° scale, gap at the bottom
          dc.setPenWidth(1);
          for (let j = 0; j <= 12; j++) {
            const deg = -120 + j * 20;
            dc.setPenWidth(j % 3 === 0 ? 2 : 1);
            G.tick(dc, x, y, j % 3 === 0 ? SUBR - 9 : SUBR - 6, SUBR - 2, deg);
          }
          const f = raw >= 0 ? G.clamp(raw / 100, 0, 1) : 0;
          const ang = -120 + 240 * f * vq;
          if (raw >= 0 && f * vq > 0.005) {
            dc.setColor(panda ? G.mix(acc, 0x000000, 0.35) : acc, -1);
            dc.setPenWidth(3);
            G.arcC(dc, x, y, SUBR - 12, -120, ang);
          }
          // value in the bottom gap
          dc.setColor(G.mix(discCol, txtCol, q), -1);
          F.st(dc, sl.val, x, y + 25, 13, 2, 1, 1.0, 0);
          // hand
          if (raw >= 0) {
            dc.setColor(panda ? 0x1a1a1a : racing ? acc : 0xf0f0f0, -1);
            const s = Math.sin(ang * RAD), c = Math.cos(ang * RAD);
            dc.fillPolygon([
              [x - c * 2.2 - s * 7, y - s * 2.2 + c * 7],
              [x + s * (SUBR - 7), y - c * (SUBR - 7)],
              [x + c * 2.2 - s * 7, y + s * 2.2 + c * 7],
            ]);
          }
          dc.setColor(panda ? 0x1a1a1a : 0xf0f0f0, -1);
          dc.fillCircle(x, y, 4);
          dc.setColor(acc, -1);
          dc.fillCircle(x, y, 1.6);
        } else {
          dc.setPenWidth(1);
          for (let j = 0; j < 12; j++) {
            dc.setPenWidth(j % 3 === 0 ? 2 : 1);
            G.tick(dc, x, y, j % 3 === 0 ? SUBR - 8 : SUBR - 5, SUBR - 2, j * 30);
          }
          let h = 20;
          const w = F.stW(sl.val, h);
          if (w > 54) h = (h * 54) / w;
          dc.setColor(G.mix(discCol, txtCol, q), -1);
          F.st(dc, sl.val, x, y, h, 3, 1, G.ease(q * 1.3), 0);
        }
        // label under the sub-dial
        dc.setColor(G.mix(0x000000, panda ? 0xbdbdbd : 0x9a9a9a, q), -1);
        F.px(dc, sl.lbl, x, y + SUBR + 7, 2, 1, 0);
      }

      // ---------------------------------------------------------------- date window (4:30)
      const dq = G.stag(p, 1, 0.45, 0.35);
      if (dq > 0) {
        const wx = G.ptX(CX, 156, 135), wy = G.ptY(CY, 156, 135);
        dc.setColor(G.dim(panda ? 0xc8c8c8 : 0xa0a0a0, dq), -1);
        dc.fillRoundedRectangle(wx - 19, wy - 15, 38, 30, 4);
        dc.setColor(G.dim(panda ? 0x111111 : 0xf2efe6, dq), -1);
        dc.fillRoundedRectangle(wx - 16, wy - 12, 32, 24, 2);
        dc.setColor(panda ? 0xf2efe6 : 0x111111, -1);
        F.st(dc, G.pad2(d.day), wx, wy, 14, 3, 1, dq, 0);
      }

    }
    if (a.so) return;
    // ---------------------------------------------------------------- hands
    const hDeg = (d.h % 12) * 30 + d.m * 0.5 + d.s / 120;
    const mDeg = d.m * 6 + d.s * 0.1;
    const sec = a.live ? d.s + a.ms / 1000 : d.s;
    const hp = G.spring(G.stag(p, 1, 0.08, 0.82));
    const mp = G.spring(G.stag(p, 1, 0.14, 0.8));
    const sp = G.spring(G.stag(p, 1, 0.22, 0.78));
    const hA = hDeg * hp, mA = mDeg * mp, sA = sec * 6 * sp;
    const silverL = panda ? 0xf4f4f4 : 0xf0f0f0, silverR = panda ? 0xa9abb0 : 0x9c9c9c;

    {
      blade(dc, hA, 118, 20, 15, 11, 14, silverL, silverR);
      dc.setColor(acc, -1);
      G.hand(dc, CX, CY, hA, 100, -34, 5, 4);
    }
    {
      blade(dc, mA, R - 16, 22, 13, 8, 16, silverL, silverR);
      dc.setColor(acc, -1);
      G.hand(dc, CX, CY, mA, R - 34, -36, 4, 3);
    }
    {
      const sc = racing ? 0xff3b2f : acc;
      dc.setColor(sc, -1);
      G.hand(dc, CX, CY, sA, R - 4, 52, 3.4, 1.6);
      dc.fillCircle(G.ptX(CX, -38, sA), G.ptY(CY, -38, sA), 6);
      dc.setColor(0x000000, -1);
      dc.fillCircle(G.ptX(CX, -38, sA), G.ptY(CY, -38, sA), 2.2);
      if (racing) {
        dc.setColor(0xffffff, -1);
        G.hand(dc, CX, CY, sA, R - 4, -(R - 22), 2.2, 1.6);
      }
    }
    // layered centre caps
    dc.setColor(silverR, -1);
    dc.fillCircle(CX, CY, 10);
    dc.setColor(silverL, -1);
    dc.fillCircle(CX, CY, 8);
    dc.setColor(racing ? 0xff3b2f : acc, -1);
    dc.fillCircle(CX, CY, 5);
    dc.setColor(0x000000, -1);
    dc.fillCircle(CX, CY, 1.8);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const R = d.cfg.style === 3 ? 194 : 214;
    dc.setColor(0x5a5a5a, -1);
    for (let i = 0; i < 12; i++) {
      const r = R - 14;
      dc.fillCircle(G.ptX(CX + o[0], r, i * 30), G.ptY(CY + o[1], r, i * 30), i === 0 ? 4 : 2.5);
    }
    const hDeg = (d.h % 12) * 30 + d.m * 0.5;
    const mDeg = d.m * 6;
    dc.setPenWidth(2);
    dc.setColor(0x9a9a9a, -1);
    outline(dc, hDeg, 118, 20, 15, 11, 14, o[0], o[1]);
    outline(dc, mDeg, R - 16, 22, 13, 8, 16, o[0], o[1]);
    dc.setColor(G.dim(d.accent, 0.6), -1);
    dc.drawCircle(CX + o[0], CY + o[1], 6);
  },
};
