// KROLL — "Kiesel Rolle": four digit reels behind windows, in the spirit of the Pebble's rolling and
// sliding digit faces. On every wrist raise the reels spin like a slot machine and stop one after the
// other from left to right with a little spring; the neighbouring digits peek in at the window edges.
// The resting digits are part of the static layer, only spinning reels are drawn per frame.
// Date above, steps, battery and Bluetooth below; still as e-paper after that.
// Styles: 1 Weiß, 2 Schwarz, 3 Farbe (Pebble Time palette). Mirrors watch/source/faces/Kroll.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/kiesel.js";

const SP = encodeAll(S);
const WX = [51, 137, 237, 323]; // reel windows
const WY = 162, WW = 80, WH = 130;
const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function q64(c) {
  const q = (v) => Math.round(v / 85) * 85;
  return (q((c >> 16) & 255) << 16) | (q((c >> 8) & 255) << 8) | q(c & 255);
}

// [background, ink, window, digit]
function pal(st, acc) {
  if (st === 2) return [0x000000, 0xffffff, 0x000000, 0xffffff];
  if (st === 3) {
    const bg = q64(acc);
    const lum = ((bg >> 16) & 255) * 0.3 + ((bg >> 8) & 255) * 0.59 + (bg & 255) * 0.11;
    const ink = lum > 140 ? 0x000000 : 0xffffff;
    return [bg, ink, ink, bg];
  }
  return [0xffffff, 0x000000, 0xffffff, 0x000000];
}

function digits(d) {
  const h = d.is24 ? d.h : G.hour(d);
  return [Math.floor(h / 10), h % 10, Math.floor(d.m / 10), d.m % 10];
}

export default {
  fps: 0,

  // static layer: windows, colon, date, steps, battery, Bluetooth; the reels move
  bgKey(d) { return d.doy * 1440 + d.mins; },
  reveal() { return false; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const P = pal(d.cfg.style, d.accent);
    const p = a.intro;

    if (S) {
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 0, 454, 454);
      dc.setColor(P[1], -1);
      F.px(dc, DAYS[d.dow] + ", " + d.day + ". " + MONS[d.mon - 1], 227, 118, 2, 1, 0);
      for (let k = 0; k < 4; k++) {
        dc.fillRectangle(WX[k] - 4, WY - 4, WW + 8, WH + 8);
        dc.setColor(P[2], -1);
        dc.fillRectangle(WX[k], WY, WW, WH);
        dc.setColor(P[1], -1);
      }
      dc.fillRectangle(222, 204, 10, 10);
      dc.fillRectangle(222, 240, 10, 10);
      // the resting digits (a spinning reel paints over its window)
      const T = digits(d);
      dc.setColor(P[3], -1);
      for (let k = 0; k < 4; k++) F.px(dc, "" + T[k], WX[k] + WW / 2, WY + WH / 2 - 42, 12, 1, 0);
      dc.setColor(P[1], -1);
      // steps, battery, Bluetooth
      SPR.draw(dc, SP.SHOE, 150, 320, 2, [-1, P[1]], false);
      F.px(dc, G.num(Math.max(0, d.steps)) + " Schritte", 176, 318, 2, 0, 0);
      dc.drawRectangle(186, 352, 36, 18);
      dc.fillRectangle(222, 356, 3, 10);
      dc.fillRectangle(189, 355, Math.round(30 * G.clamp(d.batt / 100, 0, 1)), 12);
      SPR.draw(dc, SP.BT, 242, 350, 2, [-1, P[1]], false);
      if (!d.phone) {
        for (let i = 0; i < 7; i++) dc.fillRectangle(238 + i * 3, 348 + i * 3, 3, 3);
      }
    }

    if (!M) return;
    // ---- reels: spin on the raise, stop left to right with a spring; only the spinning reels and
    // their visible digits are drawn
    const T = digits(d);
    for (let k = 0; k < 4; k++) {
      const q = G.stag(p, k, 0.13, 0.55);
      if (p >= 1 || q >= 1) continue;
      const e = G.spring(q);
      const s = T[k] - (1 - e) * (10 + k * 5);
      const base = Math.floor(s), fr = s - base;
      const cx = WX[k] + WW / 2, cy = WY + WH / 2;
      dc.setClip(WX[k], WY, WW, WH);
      dc.setColor(P[2], -1);
      dc.fillRectangle(WX[k], WY, WW, WH);
      dc.setColor(P[3], -1);
      for (let j = -1; j <= 1; j++) {
        if ((j === -1 && fr > 0.83) || (j === 1 && fr < 0.17)) continue;
        const v = (((base + j) % 10) + 10) % 10;
        F.px(dc, "" + v, cx, Math.round(cy + (j - fr) * WH) - 42, 12, 1, 0);
      }
      dc.clearClip();
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const T = digits(d);
    dc.setColor(0x4a4a4a, -1);
    for (let k = 0; k < 4; k++) dc.drawRectangle(WX[k] + o[0], WY + o[1], WW, WH);
    dc.setColor(0x9a9a9a, -1);
    for (let k = 0; k < 4; k++) F.px(dc, "" + T[k], WX[k] + WW / 2 + o[0], WY + WH / 2 - 42 + o[1], 12, 1, 1);
  },
};
