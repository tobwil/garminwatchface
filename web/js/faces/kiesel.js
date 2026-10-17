// KIESEL — "Kiesel": a love letter to the Pebble's TicToc face. Weekday and date in a bitmap font,
// a hairline, the time in big rounded bold digits, another hairline, steps with a dithered progress
// bar and the weather; on top the classic battery and Bluetooth icons (crossed out when the phone is
// gone). Static like the e-paper original: no ambient animation, only on every wrist raise the time
// slides in from the right like a Pebble window transition.
// Styles: 1 Weiß, 2 Schwarz, 3 Farbe (the accent snapped to the Pebble Time 64-colour palette).
// Mirrors watch/source/faces/Kiesel.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/kiesel.js";

const SP = encodeAll(S);
const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

// nearest colour of the Pebble Time palette (2 bits per channel)
function q64(c) {
  const q = (v) => Math.round(v / 85) * 85;
  return (q((c >> 16) & 255) << 16) | (q((c >> 8) & 255) << 8) | q(c & 255);
}

// [background, ink, dither ink]
function pal(st, acc) {
  if (st === 2) return [0x000000, 0xffffff, 0xffffff];
  if (st === 3) {
    const bg = q64(acc);
    const lum = ((bg >> 16) & 255) * 0.3 + ((bg >> 8) & 255) * 0.59 + (bg & 255) * 0.11;
    const ink = lum > 140 ? 0x000000 : 0xffffff;
    return [bg, ink, ink];
  }
  return [0xffffff, 0x000000, 0x000000];
}

// 50 % grey the Pebble way: a checkerboard of 2 px dots
function dither(dc, x, y, w, h) {
  for (let yy = 0; yy < h; yy += 2) {
    for (let xx = (yy / 2) % 2 === 0 ? 0 : 2; xx < w; xx += 4) dc.fillRectangle(x + xx, y + yy, 2, 2);
  }
}

export default {
  fps: 0,

  // static layer: everything but the time; the time slides in on the raise
  bgKey(d) { return d.doy * 1440 + d.mins; },
  reveal() { return false; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;

    if (S) {
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 0, 454, 454);
      dc.setColor(P[1], -1);
      // ---- status: battery and Bluetooth
      dc.drawRectangle(160, 48, 44, 22);
      dc.drawRectangle(161, 49, 42, 20);
      dc.fillRectangle(204, 54, 4, 10);
      dc.fillRectangle(164, 52, Math.round(36 * G.clamp(d.batt / 100, 0, 1)), 14);
      SPR.draw(dc, SP.BT, 260, 46, 3, [-1, P[1]], false);
      if (!d.phone) {
        for (let i = 0; i < 10; i++) dc.fillRectangle(254 + i * 3, 44 + i * 3, 4, 4);
      }
      // ---- date
      F.px(dc, DAYS[d.dow] + ", " + d.day + ". " + MONS[d.mon - 1], 227, 100, 2, 1, 0);
      dc.fillRectangle(70, 132, 314, 3);
      dc.fillRectangle(70, 270, 314, 3);
      // ---- steps with a dithered bar, weather
      const sg = d.stepGoal > 0 ? d.stepGoal : 10000;
      const f = G.clamp(Math.max(0, d.steps) / sg, 0, 1);
      SPR.draw(dc, SP.SHOE, 132, 290, 3, [-1, P[1]], false);
      F.px(dc, G.num(Math.max(0, d.steps)) + " Schritte", 170, 292, 2, 0, 0);
      dc.setColor(P[2], -1);
      dither(dc, 132, 322, 190, 10);
      dc.setColor(P[1], -1);
      dc.fillRectangle(132, 322, Math.round(190 * f), 10);
      if (d.temp > -99) F.px(dc, d.temp + "°" + (d.rain >= 0 ? "  Regen " + d.rain + "%" : ""), 227, 352, 2, 1, 0);
    }

    if (!M) return;
    // ---- the time slides in from the right on every raise
    const x = 227 + Math.round((1 - G.easeInOut(G.clamp(p / 0.6, 0, 1))) * 454);
    dc.setColor(P[1], -1);
    F.st(dc, G.timeStr(d), x, 202, 84, 15, 1, 1, 0);
  },

  aod(dc, d) {
    const o = St.shift(d);
    dc.setColor(0x8a8a8a, -1);
    F.st(dc, G.timeStr(d), 227 + o[0], 202 + o[1], 84, 3, 1, 1, 0);
    dc.setColor(0x5a5a5a, -1);
    F.px(dc, DAYS[d.dow] + ", " + d.day + ".", 227 + o[0], 100 + o[1], 2, 1, 0);
  },
};
