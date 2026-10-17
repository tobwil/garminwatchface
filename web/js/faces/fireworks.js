// FIREWORK — "Feuerwerk": the time written in sparks over a dark skyline, made for AMOLED. On every
// wrist raise one rocket per digit climbs from the rooftops, bursts, and its sparks fly out and then
// fall into place as the dots of the digit. While awake the dots twinkle and small fireworks go off
// in the sky; once the step goal is reached it is the grand finale (more and bigger bursts).
// Styles: 1 Silvester (every digit its own colour), 2 Gold, 3 Akzent.
// Mirrors watch/source/faces/Fireworks.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

// 5 x 7 digits, one row per entry, bit 4 = left column
const DIG = [[14, 17, 19, 21, 25, 17, 14], [4, 12, 4, 4, 4, 4, 14], [14, 17, 1, 2, 4, 8, 31], [31, 2, 4, 2, 1, 17, 14],
  [2, 6, 10, 18, 31, 2, 2], [31, 16, 30, 1, 1, 17, 14], [6, 8, 16, 30, 17, 17, 14], [31, 1, 2, 4, 8, 8, 8],
  [14, 17, 17, 14, 17, 17, 14], [14, 17, 17, 15, 1, 2, 12]];
const C = 14; // dot cell
const GLOW = 0.72; // halo darkness
const Y0 = 108; // top of the digits
const SKY = 330; // roof line
const BLD = [0, 360, 34, 340, 70, 372, 96, 326, 128, 350, 160, 332, 196, 364, 226, 318, 262, 346, 296, 336, 330, 358, 368, 330, 404, 352, 440, 344];

// dots of the time: [x, y, digit index] per lit cell, and the burst point of every digit
function layout(ts) {
  let W = 0;
  for (const ch of ts) W += ch === ":" ? 2 * C : 6 * C;
  let x = 227 - (W - C) / 2;
  const dots = [], bursts = [];
  let k = 0;
  for (const ch of ts) {
    if (ch === ":") {
      dots.push([x, Y0 + 2 * C, -1], [x, Y0 + 4 * C, -1]);
      x += 2 * C;
      continue;
    }
    const g = DIG[ch.charCodeAt(0) - 48];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r] & (16 >> c)) dots.push([x + c * C, Y0 + r * C, k]);
    bursts.push(x + 2 * C + 6, Y0 + 3 * C + 6);
    x += 6 * C;
    k++;
  }
  return [dots, bursts];
}

// [spark colours per digit (4), colon, (unused), skyline, window, star, text]
function pal(st, acc) {
  if (st === 2) return [0xffd25a, 0xfff2b0, 0xffb02a, 0xffe08a, 0xffffff, 0, 0x0a0a10, 0xffb84a, 0x8a8a9a, 0xffd25a];
  if (st === 3) return [acc, G.mix(acc, 0xffffff, 0.3), acc, G.mix(acc, 0xffffff, 0.3), 0xffffff, 0, 0x0a0a10, G.mix(acc, 0xffd25a, 0.5), 0x8a8a9a, acc];
  return [0xffd25a, 0xff3a8a, 0x3ae0ff, 0x7aff5a, 0xffffff, 0, 0x0a0a10, 0xffb84a, 0x8a8a9a, 0xffd25a];
}

export default {
  fps: 12,

  // static layer: sky, stars, skyline, date, steps; the rockets, sparks, digit dots and bursts move
  bgKey(d) { return d.doy * 1440 + d.mins; },
  reveal() { return false; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const P = pal(d.cfg.style, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const finale = d.steps >= d.stepGoal && d.stepGoal > 0;

    if (S) {
      dc.setColor(0x000000, -1);
      dc.fillRectangle(0, 0, 454, 454);
      dc.setColor(G.mix(P[8], 0, 0.5), -1);
      for (let i = 0; i < 30; i++) dc.fillRectangle(30 + ((i * 101 + 17) % 394), 20 + ((i * 47 + 11) % 290), 2, 2);
      // skyline with a few lit windows
      dc.setColor(P[6], -1);
      for (let i = 0; i < BLD.length; i += 2) dc.fillRectangle(BLD[i], BLD[i + 1], 38, 454 - BLD[i + 1]);
      dc.setColor(P[7], -1);
      for (let i = 0; i < BLD.length; i += 2) {
        for (let w = 0; w < 6; w++) {
          if (G.rnd(i * 31 + w * 7 + d.day) % 4 !== 0) continue;
          dc.fillRectangle(BLD[i] + 6 + (w % 2) * 16, BLD[i + 1] + 10 + Math.floor(w / 2) * 18, 6, 8);
        }
      }
      dc.setColor(P[9], -1);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 70, 2, 1, 0);
      const sg = d.stepGoal > 0 ? d.stepGoal : 10000;
      F.px(dc, finale ? "FINALE! " + G.num(d.steps) + " SCHRITTE" : G.num(Math.max(0, d.steps)) + " / " + G.num(sg), 227, 230, 2, 1, 0);
    }

    if (!M) return;
    const L = layout(G.timeStr(d));
    const dots = L[0], bursts = L[1];
    // ---- rockets climb from the roofs, burst, the sparks fly out and settle into the digits
    const q = G.clamp((p - 0.3) / 0.5, 0, 1);
    if (p < 0.3) {
      for (let k = 0; k < bursts.length / 2; k++) {
        const bx = bursts[k * 2], by = bursts[k * 2 + 1];
        const y = Math.round(G.lerp(SKY, by, G.ease(G.clamp((p - k * 0.03) / 0.27, 0, 1))));
        dc.setColor(P[k % 4], -1);
        dc.fillRectangle(bx - 2, y, 4, 6);
        dc.setColor(G.mix(P[k % 4], 0, 0.6), -1);
        for (let i = 1; i < 5; i++) dc.fillRectangle(bx - 1 + ((i + Math.floor(a.t / 50)) % 2), y + i * 8, 2, 4);
      }
    }
    if (p < 0.3) return;
    const tw = live ? Math.floor(tt / 120) : 0;
    for (let i = 0; i < dots.length; i++) {
      const t = dots[i];
      const k = t[2];
      let x = t[0], y = t[1];
      const col = k < 0 ? P[4] : P[k % 4];
      if (q < 1) {
        const kb = k < 0 ? 1 : k;
        const bx = bursts[kb * 2], by = bursts[kb * 2 + 1];
        const e = G.easeInOut(q);
        const ang = (G.rnd(i * 17 + 3) % 360) * Math.PI / 180;
        const out = Math.sin(q * Math.PI) * (40 + (G.rnd(i * 5 + 1) % 50));
        x = Math.round(G.lerp(bx, t[0], e) + Math.cos(ang) * out);
        y = Math.round(G.lerp(by, t[1], e) + Math.sin(ang) * out);
      }
      const hot = q < 0.6 || (live && G.rnd(i * 13 + tw) % 23 === 0);
      dc.setColor(G.mix(col, 0x000000, GLOW), -1);
      dc.fillRectangle(x - 1, y - 1, 14, 14);
      dc.setColor(hot ? 0xffffff : col, -1);
      dc.fillRectangle(x + 2, y + 2, 8, 8);
    }
    // ---- small fireworks in the sky while awake (bigger and more at the finale)
    if (live && p >= 1) {
      const per = finale ? 1300 : 2400;
      const n = finale ? 2 : 1;
      for (let b = 0; b < n; b++) {
        const kk = Math.floor((tt + b * 650) / per);
        const age = ((tt + b * 650) % per) / per;
        const cx = 90 + (G.rnd(kk * 7 + b) % 274), cy = 276 + (G.rnd(kk * 5 + b) % 20);
        const col = P[G.rnd(kk * 13 + b) % 4];
        const R = (finale ? 56 : 38) * G.ease(age);
        dc.setColor(G.mix(col, 0x000000, age * 0.9), -1);
        for (let i = 0; i < 14; i++) {
          const an = (i * 2 * Math.PI) / 14;
          dc.fillRectangle(Math.round(cx + Math.cos(an) * R), Math.round(cy + Math.sin(an) * R + age * age * 26), 4, 4);
        }
      }
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const L = layout(G.timeStr(d));
    dc.setColor(0x6a5a2a, -1);
    for (const t of L[0]) dc.fillRectangle(t[0] + 4 + o[0], t[1] + 4 + o[1], 4, 4);
  },
};
