// GLITCH — the time glitches with your stress level: calm = clean and crisp,
// stressed = RGB split, displaced slices, block artifacts and scanlines.
// Bursts come more often the higher the stress. Styles: 1 RGB, 2 Vaporwave,
// 3 Mono. Mirrors watch/source/faces/Glitch.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const TY = 194;   // time centre
const TH = 104;   // time cap height

// glitch colours [left ghost, right ghost, core] per style
function gcol(st, acc, k) {
  if (st === 2) return k === 0 ? 0xff4fd8 : k === 1 ? 0x00f0ff : 0xfff0fb;
  if (st === 3) return k === 0 ? acc : k === 1 ? G.dim(acc, 0.45) : 0xffffff;
  return k === 0 ? 0xff2a4a : k === 1 ? 0x00e5ff : 0xffffff;
}

export default {
  fps: 15,

  // static layer: header, brackets, slots and the calm time; the glitch itself moves
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const p = a.intro;
    const t = a.t;
    const cx = 227;
    const acc = d.accent;
    const g = d.stress < 0 ? 0.3 : G.clamp((d.stress - 20) / 60.0, 0, 1);

    // ---- glitch intensity: steady part + bursts + intro shock
    const slot = a.live ? Math.floor(t / 120) : 3;
    let seed = G.rnd(slot * 977 + 31);
    let burst = 0;
    if (a.live && G.rf(seed) < 0.03 + 0.3 * g) {
      seed = G.rnd(seed);
      burst = 0.35 + 0.65 * G.rf(seed);
    }
    const ib = Math.pow(1 - p, 1.4);
    const k = G.clamp(Math.max(0, g - 0.12) * 0.6 + burst * (0.3 + 0.7 * g) + ib, 0, 1);

    const c0 = gcol(st, acc, 0), c1 = gcol(st, acc, 1), c2 = gcol(st, acc, 2);

    // ---- vaporwave horizon grid
    if (st === 2) {
      const hz = 372;
      dc.setPenWidth(1);
      dc.setColor(0x6a1fb0, -1);
      for (let j = -7; j <= 7 && S; j++) dc.drawLine(cx + j * 14, hz, cx + j * 70, 454);
      const ph = a.live ? (t / 1400.0) % 1 : 0.4;
      for (let i = 0; i < 5 && M; i++) {
        const f = (i + ph) / 5.0;
        const y = hz + 82 * f * f;
        dc.setColor(G.dim(0x8a2be2, 0.4 + 0.6 * f), -1);
        dc.drawLine(0, y, 454, y);
      }
      dc.setPenWidth(2);
      dc.setColor(0xff4fd8, -1);
      dc.drawLine(30, hz, 424, hz); // also over the moving grid lines
    }

    // ---- date header
    const tp = G.ease(p * 1.5 - 0.3);
    if (S) {
    dc.setColor(G.dim(0x9a9a9a, tp), -1);
    F.px(dc, d.dowStr + " " + d.day + " " + d.monStr + " // KW " + d.wk, cx, 86, 2, 1, 0);
    dc.setColor(G.dim(c0, 0.8 * tp), -1);
    dc.fillRectangle(cx - 60, 108, 120 * tp, 2);

    // ---- time with RGB split + slice displacement
    // HUD corner brackets
    dc.setPenWidth(2);
    dc.setColor(G.dim(0x4a4a4a, tp), -1);
    for (let i = 0; i < 4; i++) {
      const bx = i % 2 === 0 ? 46 : 408, by = i < 2 ? 130 : 258;
      const sx = i % 2 === 0 ? 1 : -1, sy = i < 2 ? 1 : -1;
      dc.drawLine(bx, by, bx + 14 * sx, by);
      dc.drawLine(bx, by, bx, by + 14 * sy);
    }
    }

    const ts = G.timeStr(d);
    const o = k > 0.04 ? 1 + 12 * k : 0;
    const ytop = TY - TH / 2 - 12;
    if (o > 0 && M) {
      dc.setColor(c0, -1);
      F.st(dc, ts, cx - o, TY, TH, 9, 1, 1.0, 0);
      dc.setColor(c1, -1);
      F.st(dc, ts, cx + o, TY + (k > 0.5 ? 2 : 0), TH, 9, 1, 1.0, 0);
      // scanlines through the colour ghosts
      if (k > 0.15) {
        dc.setPenWidth(1);
        dc.setColor(0x000000, -1);
        const sp = k > 0.75 ? 3 : 4;
        for (let y = ytop; y < ytop + TH + 24; y += sp) dc.drawLine(30, y, 424, y);
      }
    }
    // the calm time lives in the static layer, a glitching one is redrawn every frame
    if (o > 0 ? M : S) {
      dc.setColor(c2, -1);
      F.st(dc, ts, cx, TY, TH, 9, 1, 1.0, 0);
    }

    if (k > 0.08 && M) {
      const bh = (TH + 24) / 6.0;
      let s2 = G.rnd(seed + 7);
      let shifted = 0;
      const maxs = ib > 0.1 ? 3 : 2;
      for (let b = 0; b < 6 && shifted < maxs; b++) {
        s2 = G.rnd(s2);
        if (G.rf(s2) > k * 0.85) continue;
        s2 = G.rnd(s2);
        const dx = Math.round((G.rf(s2) - 0.5) * 2 * (6 + 30 * k));
        if (dx > -2 && dx < 2) continue;
        shifted++;
        const y0 = Math.floor(ytop + b * bh);
        dc.setClip(0, y0, 454, Math.ceil(bh));
        dc.setColor(0x000000, -1);
        dc.fillRectangle(0, y0, 454, Math.ceil(bh));
        dc.setColor(dx < 0 ? c0 : c1, -1);
        F.st(dc, ts, cx + dx * 1.4, TY, TH, 9, 1, 1.0, 0);
        dc.setColor(c2, -1);
        F.st(dc, ts, cx + dx, TY, TH, 9, 1, 1.0, 0);
        dc.clearClip();
      }

      // block artifacts + noise rows
      const nb = Math.floor(k * 9);
      for (let i = 0; i < nb; i++) {
        s2 = G.rnd(s2);
        const bx = 60 + G.rf(s2) * 300;
        s2 = G.rnd(s2);
        const by = 120 + G.rf(s2) * 170;
        s2 = G.rnd(s2);
        const bw = 6 + G.rf(s2) * 46;
        const bhh = 3 + (s2 % 9);
        dc.setColor(i % 4 === 3 ? c2 : i % 2 === 1 ? c0 : c1, -1);
        dc.fillRectangle(bx, by, bw, bhh);
      }
      if (k > 0.3) {
        s2 = G.rnd(s2);
        dc.setColor(G.dim(c1, 0.5), -1);
        dc.fillRectangle(40, 130 + G.rf(s2) * 150, 374, 1);
      }
    }

    // ---- status line
    const msg = g < 0.34 ? "SYS STABIL" : g < 0.67 ? "SYS UNRUHIG" : "SYS ÜBERLASTET";
    const scol = g < 0.34 ? (st === 3 ? acc : 0x3cff9a) : g < 0.67 ? 0xffc02e : 0xff3355;
    const nch = Math.floor(msg.length * G.clamp(p * 1.6 - 0.4, 0, 1));
    if (nch > 0 && M) {
      let s3 = G.rnd(seed + 99);
      let out = "";
      for (let i = 0; i < nch; i++) {
        s3 = G.rnd(s3);
        out += (k > 0.25 && G.rf(s3) < k * 0.3) ? "\u007f" : msg.substring(i, i + 1);
      }
      const jx = burst > 0 ? Math.round((G.rf(s3) - 0.5) * 10) : 0;
      dc.setColor(scol, -1);
      const wq = F.px(dc, out, cx + jx, 270, 3, 1, 0);
      // blinking cursor
      if (!a.live || Math.floor(t / 500) % 2 === 0) {
        dc.fillRectangle(cx + jx + wq / 2 + 6, 270, 12, 21);
      }
    }

    // ---- data readout (3 slots)
    for (let i = 0; i < 3 && S; i++) {
      const sp = G.stag(p, i, 0.1, 0.45);
      if (sp <= 0) continue;
      const sl = d.slots[i];
      if (!sl.lbl) continue;
      const y = 312 + i * 21;
      const x = cx - 100;
      dc.setColor(G.dim(c0, sp), -1);
      F.px(dc, ">", x, y, 2, 0, 0);
      dc.setColor(G.dim(0x8a8a8a, sp), -1);
      F.px(dc, sl.lbl, x + 18, y, 2, 0, 0);
      dc.setColor(G.dim(d.dcol, sp), -1);
      F.px(dc, sl.val, cx + 100, y, 2, 2, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const ts = G.timeStr(d);
    dc.setColor(G.dim(gcol(d.cfg.style, d.accent, 0), 0.45), -1);
    F.st(dc, ts, 223 + o[0], TY + o[1], TH, 2, 1, 1.0, 0);
    dc.setColor(0x9a9a9a, -1);
    F.st(dc, ts, 227 + o[0], TY + o[1], TH, 3, 1, 1.0, 0);
  },
};
