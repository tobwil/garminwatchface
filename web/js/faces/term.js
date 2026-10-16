// TERM — "Terminal": a green phosphor CRT shell session. Big glowing pixel time,
// below a typed session (date, body, hr, slots) and a blinking block cursor.
// Styles: 1 Phosphor (accent), 2 Amber, 3 Matrix (code rain). Mirrors watch/source/faces/Term.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const DOWS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
// code-rain glyphs: 10 katakana-like signs, 4 rects each [x, y, w, h] in a 10x14 cell
// (much cheaper than the dot-matrix font, which would trip the watchdog)
const RG = [0,0,10,2, 7,2,2,5, 3,7,2,7, 0,0,0,0,  0,3,10,2, 4,0,2,14, 0,0,0,0, 0,0,0,0,  0,0,10,2, 1,6,8,2, 0,12,10,2, 0,0,0,0,  2,0,2,14, 6,0,2,9, 8,9,2,5, 0,0,0,0,  0,0,2,8, 0,6,10,2, 8,0,2,14, 0,0,0,0,  0,1,10,2, 8,3,2,6, 4,9,2,5, 0,0,0,0,  4,0,2,14, 0,5,10,2, 0,10,3,2, 7,10,3,2,  0,0,10,2, 0,0,2,14, 0,12,10,2, 0,0,0,0,  0,2,2,3, 4,3,2,3, 8,3,2,7, 3,12,6,2,  2,0,6,2, 2,0,2,8, 2,6,6,2, 6,6,2,8];
// rain trail colours (head, then fading)
const RC = [0x2A9A4C, 0x145D2A, 0x125325, 0x104820, 0x0D3E1C, 0x0B3417, 0x092912, 0x061F0E, 0x041409, 0x020A04];
const PROMPT = "fr970:~$ ";
const NCH = 22; // session width in characters
const LY = 152; // first session line (top)
const LP = 21; // line pitch

let busy = true;
let rainOn = false;

// lower-case incl. umlauts (identical on the watch)
function lc(s) {
  let o = "";
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if ((c >= 65 && c <= 90) || c === 196 || c === 214 || c === 220) c += 32;
    o += String.fromCharCode(c);
  }
  return o;
}

// half chord of the display circle (minus a margin) for a text row y..y+h
function chord(y, h) {
  const r = 213;
  const dy = Math.max(Math.abs(y - 227), Math.abs(y + h - 227));
  return dy >= r ? 0 : Math.sqrt(r * r - dy * dy);
}

function nv(v, suf) { return v < 0 ? "--" : v + suf; }

export default {
  get fps() { return busy ? 20 : rainOn ? 12 : 4; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const fg = st === 2 ? 0xffb000 : st === 3 ? 0x3bff6a : d.accent;
    const live = a.live;
    const ms = live ? a.t : 99999;
    rainOn = st === 3;

    // ---- matrix rain (behind everything)
    if (st === 3) {
      for (let c = 0; c < 30; c++) {
        let sd = G.rnd(c * 7919 + 13);
        const x = 24 + (c % 15) * 28 + (sd % 9);
        sd = G.rnd(sd);
        const v = 70 + (sd % 90); // px/s
        sd = G.rnd(sd);
        const span = 454 + 10 * 16;
        const head = ((ms * v) / 1000 + (sd % span)) % span;
        const hy = Math.floor(head / 16) * 16;
        for (let j = 0; j < 10; j++) {
          const yy = hy - j * 16;
          // inside the circle, and never behind the session text (legibility + watchdog budget)
          const dx = x + 5 - 227, dy = yy + 7 - 227;
          if (dx * dx + dy * dy > 42000) continue;
          if (yy > LY - 16 && yy < LY + 11 * LP && x > 84 && x < 370) continue;
          const ci = ((c * 31 + Math.floor(yy / 16) * 7 + Math.floor(ms / 220) * (j === 0 ? 3 : 0)) % 10) * 16;
          dc.setColor(RC[j], -1);
          for (let q = ci; q < ci + 16; q += 4) if (RG[q + 2] > 0) dc.fillRectangle(x + RG[q], yy + RG[q + 1], RG[q + 2], RG[q + 3]);
        }
      }
    }

    // ---- big time with phosphor glow + scanlines
    const ts = G.timeStr(d);
    const tn = G.clamp(Math.floor(ms / 70), 0, ts.length);
    const tw = F.pxW(ts, 9);
    const tx = 227 - tw / 2;
    const ty = 66;
    if (tn > 0) {
      const sub = ts.substring(0, tn);
      dc.setColor(G.dim(fg, 0.2), -1);
      F.px(dc, sub, tx - 2, ty, 9, 0, 0);
      F.px(dc, sub, tx + 2, ty, 9, 0, 0);
      F.px(dc, sub, tx, ty - 2, 9, 0, 0);
      F.px(dc, sub, tx, ty + 2, 9, 0, 0);
      dc.setColor(fg, -1);
      F.px(dc, sub, tx, ty, 9, 0, 0);
    }
    if (tn < ts.length) {
      dc.setColor(fg, -1);
      dc.fillRectangle(tx + tn * 54, ty, 45, 63);
    }
    dc.setColor(0x000000, -1);
    for (let yy = ty + 2; yy < ty + 63; yy += 3) dc.fillRectangle(tx - 3, yy, tw + 6, 1);
    if (tn < ts.length) {
      busy = true;
      return;
    }

    // ---- session lines
    const body = "battery " + nv(d.bb, "%") + "  stress " + nv(d.stress, "");
    const hr = nv(d.hr, " bpm") + " (ruhe " + nv(d.rhr, "") + ")";
    const lines = [
      "date", DOWS[d.dow] + " " + d.day + ". " + MONS[d.mon - 1] + " " + d.year,
      "cat /body/*", body,
      "hr", hr,
      "./slots",
    ];
    for (let k = 0; k < 3; k++) {
      const sl = d.slots[k];
      const l = lc(sl.lbl), v = lc(sl.val);
      let dots = " ";
      for (let i = l.length + v.length + 2; i < NCH; i++) dots += ".";
      lines.push(l + dots + " " + v);
    }
    const isP = [true, false, true, false, true, false, true, false, false, false];
    const x0 = 227 - (NCH * 12 - 2) / 2;
    const pw = F.pxW(PROMPT, 2) + 2;
    const dim = G.dim(fg, 0.5);
    const out = G.dim(fg, 0.82);
    let tc = 420; // typing clock
    let cx = -1, cy = -1;
    for (let i = 0; i <= lines.length; i++) {
      const y = LY + i * LP;
      const hc = chord(y, 14);
      const lx = Math.max(x0, 227 - hc);
      const maxc = Math.floor((227 + hc - lx + 2) / 12);
      if (i === lines.length || isP[i]) {
        if (ms < tc) break;
        dc.setColor(dim, -1);
        F.px(dc, PROMPT, lx, y, 2, 0, 0);
        if (i === lines.length) { cx = lx + pw; cy = y; break; }
        let s = lines[i];
        const n = Math.floor((ms - tc) / 30);
        tc += s.length * 30 + 120;
        if (n < s.length) { s = s.substring(0, n); cx = lx + pw + n * 12; cy = y; }
        dc.setColor(fg, -1);
        F.px(dc, s, lx + pw, y, 2, 0, 0);
        if (cy >= 0) break;
      } else {
        if (ms < tc) break;
        tc += 50;
        let s = lines[i];
        if (s.length > maxc) s = s.substring(0, maxc);
        dc.setColor(out, -1);
        F.px(dc, s, lx, y, 2, 0, 0);
      }
    }
    busy = ms < tc + 60;
    // block cursor (blinks when idle)
    if (cy >= 0 && (busy || !live || Math.floor(a.t / 500) % 2 === 0)) {
      dc.setColor(fg, -1);
      dc.fillRectangle(cx, cy - 1, 10, 16);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const fg = st === 2 ? 0xffb000 : st === 3 ? 0x3bff6a : d.accent;
    const ts = G.timeStr(d);
    dc.setColor(G.dim(fg, 0.5), -1);
    F.px(dc, ts, 227 + o[0], 150 + o[1], 8, 1, 1);
    dc.setColor(G.dim(fg, 0.35), -1);
    const w = F.pxW(PROMPT, 2);
    const x = 227 - (w + 12) / 2 + o[0];
    F.px(dc, PROMPT, x, 240 + o[1], 2, 0, 0);
    dc.fillRectangle(x + w + 2, 239 + o[1], 10, 16);
  },
};
