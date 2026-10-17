// KANALOG — "Kiesel Analog": the Pebble Time's Simple Analog. Twelve bold bars, minute dots, plain
// tapered hands, a red seconds hand while the watch is awake, weekday and date in a little box, the
// steps under the twelve and the crossed-out Bluetooth icon when the phone is out of reach. Drawn
// without anti-aliasing like the original. On every wrist raise the hands sweep in from twelve.
// Styles: 1 Weiß, 2 Schwarz, 3 Farbe (Pebble Time palette). Mirrors watch/source/faces/Kanalog.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/kiesel.js";

const SP = encodeAll(S);
const CX = 227, CY = 227, RAD = Math.PI / 180;
const DOW = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];

function q64(c) {
  const q = (v) => Math.round(v / 85) * 85;
  return (q((c >> 16) & 255) << 16) | (q((c >> 8) & 255) << 8) | q(c & 255);
}

// [background, ink, dim, seconds]
function pal(st, acc) {
  if (st === 2) return [0x000000, 0xffffff, 0x555555, 0xff0055];
  if (st === 3) {
    const bg = q64(acc);
    const lum = ((bg >> 16) & 255) * 0.3 + ((bg >> 8) & 255) * 0.59 + (bg & 255) * 0.11;
    const ink = lum > 140 ? 0x000000 : 0xffffff;
    return [bg, ink, ink, ink];
  }
  return [0xffffff, 0x000000, 0xaaaaaa, 0xff0055];
}

// tapered hand: width w at the centre, length len, tail back
function hand(dc, deg, len, back, w) {
  const s = Math.sin(deg * RAD), c = Math.cos(deg * RAD);
  const px = c * w / 2, py = s * w / 2;
  dc.fillPolygon([
    [CX - s * back - px, CY + c * back - py], [CX - s * back + px, CY + c * back + py],
    [CX + s * len + px * 0.4, CY - c * len + py * 0.4], [CX + s * len - px * 0.4, CY - c * len - py * 0.4],
  ]);
}

export default {
  fps: 1,
  aa() { return false; },

  // static layer: dial, date, steps, Bluetooth; the hands move (they sweep in on the raise)
  bgKey(d) { return d.doy * 1440 + d.mins; },
  reveal() { return false; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const P = pal(d.cfg.style, d.accent);
    const p = a.intro;
    const live = a.live;

    if (S) {
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 0, 454, 454);
      dc.setColor(P[1], -1);
      for (let i = 0; i < 60; i++) {
        const s = Math.sin(i * 6 * RAD), c = Math.cos(i * 6 * RAD);
        if (i % 5 === 0) {
          const w = 5;
          dc.fillPolygon([[CX + s * 172 - c * w, CY - c * 172 - s * w], [CX + s * 172 + c * w, CY - c * 172 + s * w],
            [CX + s * 208 + c * w, CY - c * 208 + s * w], [CX + s * 208 - c * w, CY - c * 208 - s * w]]);
        } else {
          dc.fillRectangle(Math.round(CX + s * 202) - 2, Math.round(CY - c * 202) - 2, 4, 4);
        }
      }
      // weekday and date box
      F.px(dc, DOW[d.dow], 206, 308, 2, 2, 0);
      dc.drawRectangle(214, 300, 44, 30);
      dc.drawRectangle(215, 301, 42, 28);
      F.px(dc, "" + d.day, 236, 308, 2, 1, 0);
      // steps under the twelve, Bluetooth when the phone is gone
      dc.setColor(P[2], -1);
      SPR.draw(dc, SP.SHOE, 182, 132, 2, [-1, P[2]], false);
      F.px(dc, G.num(Math.max(0, d.steps)), 206, 130, 2, 0, 0);
      if (!d.phone) {
        dc.setColor(P[1], -1);
        SPR.draw(dc, SP.BT, 220, 96, 2, [-1, P[1]], false);
        for (let i = 0; i < 7; i++) dc.fillRectangle(216 + i * 3, 94 + i * 3, 3, 3);
      }
    }

    if (!M) return;
    // ---- hands sweep in from twelve on every raise
    const e = G.easeInOut(G.clamp(p / 0.8, 0, 1));
    const hd = ((G.hour(d) % 12) + d.m / 60) * 30 * e, md = d.m * 6 * e;
    dc.setColor(P[1], -1);
    hand(dc, hd, 112, 18, 16);
    hand(dc, md, 178, 22, 11);
    if (live) {
      const sd = d.s * 6 * (p < 1 ? e : 1);
      const s = Math.sin(sd * RAD), c = Math.cos(sd * RAD);
      dc.setColor(P[3], -1);
      dc.setPenWidth(3);
      dc.drawLine(CX - s * 34, CY + c * 34, CX + s * 196, CY - c * 196);
    }
    dc.setColor(P[1], -1);
    dc.fillCircle(CX, CY, 9);
    dc.setColor(live ? P[3] : P[0], -1);
    dc.fillCircle(CX, CY, 4);
  },

  aod(dc, d) {
    const o = St.shift(d);
    dc.setColor(0x6a6a6a, -1);
    for (let h = 0; h < 12; h++) {
      const s = Math.sin(h * 30 * RAD), c = Math.cos(h * 30 * RAD);
      dc.fillRectangle(Math.round(CX + s * 196) - 2 + o[0], Math.round(CY - c * 196) - 2 + o[1], 4, 4);
    }
    dc.setColor(0x9a9a9a, -1);
    dc.setPenWidth(4);
    const hd = ((G.hour(d) % 12) + d.m / 60) * 30 * RAD, md = d.m * 6 * RAD;
    dc.drawLine(CX + o[0], CY + o[1], CX + Math.sin(hd) * 110 + o[0], CY - Math.cos(hd) * 110 + o[1]);
    dc.setPenWidth(3);
    dc.drawLine(CX + o[0], CY + o[1], CX + Math.sin(md) * 176 + o[0], CY - Math.cos(md) * 176 + o[1]);
  },
};
