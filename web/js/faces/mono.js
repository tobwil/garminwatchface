// MONO — big monoline digits, a 60-tick step ring and three data slots.
// Styles: 1 Outline, 2 Bold, 3 Stack. Mirrors watch/source/faces/Mono.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

export default {
  fps: 10,

  // everything but the second marker is static for a minute
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const cx = 227, cy = 227;

    // tick ring: steps progress, live second marker
    const frac = d.stepGoal > 0 ? d.steps / d.stepGoal : 0;
    const lit = Math.floor(G.clamp(frac, 0, 1) * 60);
    const shown = Math.floor(G.ease(p) * 60);
    dc.setPenWidth(3);
    for (let i = 0; i < shown && !a.bg; i++) {
      const deg = i * 6;
      const big = i % 5 === 0;
      dc.setColor(i < lit ? acc : 0x333333, -1);
      G.tick(dc, cx, cy, big ? 200 : 207, 219, deg);
    }
    if (a.live) {
      const sd = d.s * 6 + a.ms * 0.006;
      dc.setColor(0xffffff, -1);
      dc.setPenWidth(5);
      G.tick(dc, cx, cy, 196, 222, sd);
    }
    if (a.bg) return;

    // date
    dc.setColor(0xbbbbbb, -1);
    F.st(dc, d.dowStr + " " + d.day + " " + d.monStr, cx, 96, 22, 3, 1, G.ease(p * 1.6), 0);

    // time
    const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
    const mm = G.pad2(d.m);
    const wp = G.easeInOut(p);
    if (st === 3) {
      dc.setColor(0xffffff, -1);
      F.st(dc, hh, cx, 162, 92, 12, 1, wp, 0);
      dc.setColor(acc, -1);
      F.st(dc, mm, cx, 274, 92, 12, 1, G.easeInOut(p * 1.2 - 0.2), 0);
    } else {
      const pen = st === 2 ? 16 : 7;
      const h = 112;
      const wH = F.stW(hh, h);
      const wAll = F.stW(hh + ":" + mm, h);
      const x0 = cx - wAll / 2;
      dc.setColor(0xffffff, -1);
      F.st(dc, hh, x0, 222, h, pen, 0, wp, 0);
      dc.setColor(acc, -1);
      F.st(dc, ":" + mm, x0 + wH + (22.0 * h) / 80.0, 222, h, pen, 0, G.easeInOut(p * 1.2 - 0.2), 0);
    }

    // slots
    const y0 = st === 3 ? 340 : 318;
    for (let k = 0; k < 3; k++) {
      const sl = d.slots[k];
      const x = cx + (k - 1) * 104;
      const sp = G.stag(p, k, 0.12, 0.5);
      if (sp <= 0) continue;
      dc.setColor(G.dim(0x888888, sp), -1);
      F.px(dc, sl.lbl, x, y0, 2, 1, 0);
      dc.setColor(G.mix(0x000000, d.dcol, sp), -1);
      F.st(dc, sl.val, x, y0 + 36, 26, 4, 1, 1.0, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
    dc.setColor(0x9a9a9a, -1);
    F.st(dc, hh + ":" + G.pad2(d.m), 227 + o[0], 222 + o[1], 112, 3, 1, 1.0, 0);
    dc.setColor(G.dim(d.accent, 0.6), -1);
    F.st(dc, d.dowStr + " " + d.day, 227 + o[0], 96 + o[1], 22, 2, 1, 1.0, 0);
  },
};
