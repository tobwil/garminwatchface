// PXCHRONO — "Pixel-Chronograph": a classic chronograph set entirely in pixels. Tachymeter scale on the
// rim, railroad minute track, block indices, three sub-dials (9 / 3 / 6) carrying the data slots
// (0–100 values as a pixel arc), a date window at 4:30 and hands built from stepped blocks. On
// every wrist raise the chronograph hand runs one full lap and lands on the current second.
// Styles: 1 Panda, 2 Racing, 3 Gameboy. Mirrors watch/source/faces/PxChrono.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const CX = 227, CY = 227, RAD = Math.PI / 180;
const SUBR = 44;
const SUBX = [-95, 95, 0];
const SUBY = [0, 0, 95];
const TACH = [500, 300, 200, 150, 120, 100, 80, 70, 60];

// slot types whose raw value is naturally 0..100 -> drawn as a gauge
function isGauge(t) { return t === 23 || t === 22 || t === 1 || t === 42 || t === 35; }

// [dial, dial ring, rim, rim text, track, index, sub disc, sub ring, sub text, sub dim, brand, hand, hand edge (dial),
//  seconds, date bg, date text]
function pal(st, acc) {
  if (st === 2) return [0x101012, 0x2a2a2e, 0x000000, 0xd8d8d8, 0x8a8a8a, 0xf4f4f4, 0x000000, acc, 0xffffff, 0x8a8a8a,
    0xf4f4f4, 0xf4f4f4, 0x101012, acc, 0xf4f4f4, 0x101012];
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [c, b, a, e, b, a, b, a, e, c, a, a, c, a, e, a];
  }
  return [0xe8e2d0, 0xc8c0aa, 0x141414, 0xe8e2d0, 0x5a564c, 0x1a1a1a, 0x141414, 0x5a564c, 0xf4f0e4, 0xa8a090,
    0x1a1a1a, 0x1a1a1a, 0xe8e2d0, acc, 0xf8f6f0, 0x1a1a1a];
}

// one block of size b at the polar point (deg, r) around (cx, cy), snapped to the b grid
function blk(dc, cx, cy, deg, r, b) {
  const x = cx + Math.floor((Math.sin(deg * RAD) * r) / b) * b;
  const y = cy + Math.floor((-Math.cos(deg * RAD) * r) / b) * b;
  dc.fillRectangle(x, y, b, b);
}

// stepped hand: blocks of size b from -back to len along deg
function hand(dc, cx, cy, deg, len, back, b) {
  for (let t = -back; t <= len; t += b * 0.7) blk(dc, cx, cy, deg, t, b);
}

// pixel ring of blocks
function ring(dc, cx, cy, r, b) {
  const n = Math.max(24, Math.round((2 * Math.PI * r) / (b * 0.8)));
  for (let i = 0; i < n; i++) blk(dc, cx, cy, (i * 360) / n, r, b);
}

export default {
  fps: 10,

  // static layer: dial, scales, sub-dials with the data, date and the hour / minute hands; the
  // seconds / chronograph hand moves
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;

    if (S) {
      // ---- dial and tachymeter rim
      dc.setColor(P[2], -1);
      dc.fillCircle(CX, CY, 227);
      dc.setColor(P[0], -1);
      for (let y = -188; y < 188; y += 4) {
        const hw = Math.floor(Math.sqrt(188 * 188 - (y + 2) * (y + 2)) / 4) * 4;
        dc.fillRectangle(CX - hw, CY + y, 2 * hw, 4);
      }
      dc.setColor(P[3], -1);
      for (const v of TACH) {
        const deg = (3600 / v) * 6;
        const tx = CX + Math.sin(deg * RAD) * 206, ty = CY - Math.cos(deg * RAD) * 206;
        F.px(dc, "" + v, Math.round(tx), Math.round(ty) - 7, 2, 1, 0);
      }
      for (let i = 0; i < 60; i++) if (i % 5 !== 0) blk(dc, CX, CY, i * 6, 196, 2);

      // ---- railroad minute track and block indices (none behind the sub-dials)
      dc.setColor(P[4], -1);
      for (let i = 0; i < 60; i++) blk(dc, CX, CY, i * 6, 182, i % 5 === 0 ? 6 : 4);
      dc.setColor(P[5], -1);
      for (let h = 0; h < 12; h++) {
        if (h === 3 || h === 6 || h === 9) continue;
        for (let r = 146; r <= 170; r += 8) {
          blk(dc, CX, CY, h * 30, r, 8);
          if (h === 0) {
            blk(dc, CX, CY, -3.5, r, 8);
            blk(dc, CX, CY, 3.5, r, 8);
          }
        }
      }

      // ---- brand
      dc.setColor(P[10], -1);
      F.px(dc, "PIXEL", CX, 104, 2, 1, 0);
      dc.setColor(P[13], -1);
      F.px(dc, "CHRONOGRAPH", CX, 124, 1, 1, 0);

      // ---- sub-dials with the data slots
      for (let k = 0; k < 3; k++) {
        const x = CX + SUBX[k], y = CY + SUBY[k];
        const sl = d.slots[k];
        dc.setColor(P[6], -1);
        for (let yy = -SUBR; yy < SUBR; yy += 4) {
          const hw = Math.floor(Math.sqrt(SUBR * SUBR - (yy + 2) * (yy + 2)) / 4) * 4;
          dc.fillRectangle(x - hw, y + yy, 2 * hw, 4);
        }
        dc.setColor(P[7], -1);
        ring(dc, x, y, SUBR - 2, 2);
        if (!sl.lbl) continue;
        const t = d.cfg.slots[k];
        dc.setColor(P[9], -1);
        if (isGauge(t)) {
          for (let j = 0; j <= 12; j++) blk(dc, x, y, -120 + j * 20, SUBR - 8, j % 3 === 0 ? 4 : 2);
          if (sl.raw >= 0) {
            const f = G.clamp(sl.raw / 100, 0, 1);
            dc.setColor(P[13], -1);
            for (let deg = -120; deg <= -120 + 240 * f; deg += 8) blk(dc, x, y, deg, SUBR - 16, 4);
            dc.setColor(P[8], -1);
            hand(dc, x, y, -120 + 240 * f, SUBR - 14, 4, 2);
          }
        } else {
          for (let j = 0; j < 12; j++) blk(dc, x, y, j * 30, SUBR - 8, j % 3 === 0 ? 4 : 2);
        }
        let lb = sl.lbl;
        while (lb.length > 2 && F.pxW(lb, 1) > 56) lb = lb.substring(0, lb.length - 1);
        dc.setColor(P[9], -1);
        F.px(dc, lb, x, y - 18, 1, 1, 0);
        dc.setColor(P[8], -1);
        F.px(dc, sl.val, x, y + (isGauge(t) ? 14 : 2), 2, 1, 0);
      }

      // ---- date window at 4:30
      dc.setColor(P[4], -1);
      dc.fillRectangle(318, 320, 38, 26);
      dc.setColor(P[14], -1);
      dc.fillRectangle(320, 322, 34, 22);
      dc.setColor(P[15], -1);
      F.px(dc, "" + d.day, 337, 326, 2, 1, 0);

      // ---- hour and minute hands (they move once a minute: part of the static layer), edged in the
      // dial colour so they stay visible over the sub-dials
      const hd = ((G.hour(d) % 12) + d.m / 60) * 30;
      dc.setColor(P[12], -1);
      hand(dc, CX - 2, CY - 2, hd, 106, 18, 14);
      hand(dc, CX - 2, CY - 2, d.m * 6, 168, 22, 12);
      dc.setColor(P[11], -1);
      hand(dc, CX, CY, hd, 104, 16, 10);
      hand(dc, CX, CY, d.m * 6, 166, 20, 8);
    }

    if (!M) return;
    // ---- chronograph / seconds hand: one full lap on every raise, landing on the current second
    if (live || p < 1) {
      const sd = (d.s + (live ? a.ms / 1000 : 0)) * 6;
      const deg = p < 1 ? (360 + sd) * G.easeInOut(p) : sd;
      dc.setColor(P[13], -1);
      hand(dc, CX, CY, deg, 186, 40, 4);
      blk(dc, CX, CY, deg + 180, 40, 8);
    }
    dc.setColor(P[13], -1);
    dc.fillRectangle(CX - 8, CY - 8, 16, 16);
    dc.setColor(P[0], -1);
    dc.fillRectangle(CX - 2, CY - 2, 4, 4);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const cx = CX + o[0], cy = CY + o[1];
    dc.setColor(st === 3 ? 0x306230 : 0x4a4a4a, -1);
    for (let h = 0; h < 12; h++) blk(dc, cx, cy, h * 30, 160, 6);
    const hd = ((G.hour(d) % 12) + d.m / 60) * 30;
    dc.setColor(st === 3 ? 0x8bac0f : 0x9a9a9a, -1);
    hand(dc, cx, cy, hd, 104, 0, 6);
    hand(dc, cx, cy, d.m * 6, 166, 0, 4);
  },
};
