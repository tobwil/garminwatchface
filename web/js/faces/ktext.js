// KTEXT — "Kiesel Text": the Pebble's famous Text Watch in German. The time as words on up to three
// lines, the hour in bold ("zehn / zweiund / vierzig", "zehn / null / sieben", "zehn / uhr"), set in
// the bitmap font. On every wrist raise the lines slide in from the right one after the other, like
// the minute change on the Pebble. Above a data field of your choice (steps by default) and the
// battery, below the date (with a crossed-out Bluetooth icon when the phone is gone); otherwise as still
// as e-paper. Styles: 1 Weiß, 2 Schwarz, 3 Farbe (Pebble Time palette).
// Mirrors watch/source/faces/Ktext.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/kiesel.js";

const SP = encodeAll(S);
const HW = ["zwölf", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf"];
const ONES = ["", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
const PRE = ["", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
const TEEN = ["zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
const TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig"];
const DOW = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const X0 = 78;

// the time as lines of words: the hour first
function words(h, m) {
  const L = [HW[h % 12]];
  if (m === 0) L.push("uhr");
  else if (m < 10) L.push("null", ONES[m]);
  else if (m < 20) L.push(TEEN[m - 10]);
  else if (m % 10 === 0) L.push(TENS[Math.floor(m / 10)]);
  else L.push(PRE[m % 10] + "und", TENS[Math.floor(m / 10)]);
  return L;
}

function q64(c) {
  const q = (v) => Math.round(v / 85) * 85;
  return (q((c >> 16) & 255) << 16) | (q((c >> 8) & 255) << 8) | q(c & 255);
}

// [background, ink, dim ink]
function pal(st, acc) {
  if (st === 2) return [0x000000, 0xffffff, 0xaaaaaa];
  if (st === 3) {
    const bg = q64(acc);
    const lum = ((bg >> 16) & 255) * 0.3 + ((bg >> 8) & 255) * 0.59 + (bg & 255) * 0.11;
    const ink = lum > 140 ? 0x000000 : 0xffffff;
    return [bg, ink, ink];
  }
  return [0xffffff, 0x000000, 0x555555];
}

export default {
  fps: 0,

  // static layer: background, data field, battery, date, Bluetooth; the words slide in
  bgKey(d) { return d.doy * 1440 + d.mins; },
  reveal() { return false; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const P = pal(d.cfg.style, d.accent);
    const p = a.intro;

    if (S) {
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 0, 454, 454);
      dc.setColor(P[2], -1);
      dc.fillRectangle(187, 60, Math.round(80 * G.clamp(d.batt / 100, 0, 1)), 4);
      const s0 = d.slots[0];
      if (s0.lbl) F.px(dc, s0.val + " " + s0.lbl.toLowerCase(), 227, 74, 2, 1, 0);
      F.px(dc, DOW[d.dow] + " " + d.day + "." + d.mon + ".", 227, 380, 2, 1, 0);
      if (!d.phone) {
        SPR.draw(dc, SP.BT, 220, 402, 2, [-1, P[2]], false);
        for (let i = 0; i < 7; i++) dc.fillRectangle(216 + i * 3, 400 + i * 3, 3, 3);
      }
    }

    if (!M) return;
    // ---- the words, sliding in line by line
    const L = words(d.h, d.m);
    const y0 = 227 - (L.length * 72 - 16) / 2;
    dc.setColor(P[1], -1);
    for (let i = 0; i < L.length; i++) {
      const x = X0 + Math.round((1 - G.easeInOut(G.stag(p, i, 0.14, 0.5))) * 420);
      const y = y0 + i * 72;
      if (i === 0) {
        F.px(dc, L[i], x, y, 8, 0, 0);
        F.px(dc, L[i], x + 3, y, 8, 0, 0);
      } else {
        F.px(dc, L[i], x, y + 8, 6, 0, 0);
      }
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const L = words(d.h, d.m);
    const y0 = 227 - (L.length * 72 - 16) / 2;
    dc.setColor(0x6a6a6a, -1);
    for (let i = 0; i < L.length; i++) F.px(dc, L[i], X0 + o[0], y0 + i * 72 + (i === 0 ? 0 : 8) + o[1], i === 0 ? 8 : 6, 0, 1);
  },
};
