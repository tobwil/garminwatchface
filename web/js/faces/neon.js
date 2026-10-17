// NEON — "Neon": the time as glowing neon tubes on true black, made for AMOLED (every unlit pixel is
// off). Each tube is drawn in four passes from a wide dim halo to a white-hot core. On every wrist
// raise the tubes ignite letter by letter with the typical flicker; while awake one tube now and then
// stutters like a tired sign. Below a neon heart beats with your real heart rate, the steps glow as
// a small sign and the Body Battery is a row of tube segments.
// Styles: 1 Miami (pink / cyan), 2 Motel (red / amber), 3 Akzent. Mirrors watch/source/faces/Neon.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const TH = 96; // height of the time tubes
const TY = 182; // centre line of the time
// passes: pen (in sevenths of the tube pen), darken (negative: lighten). The big time gets halo, tube
// and hot core; the small signs only a halo and a thin core (pens under 3 need no round joints)
const HALO = [[18, 0.82], [7, 0.0], [2, -0.65]];
const SMALL = [[16, 0.8], [5, -0.3]];

// [time tube, sign tube, heart tube, battery tube, battery off]
function pal(st, acc) {
  if (st === 2) return [0xff3a2a, 0xffb02a, 0xff3a2a, 0xffb02a, 0x1a0c06];
  if (st === 3) return [acc, G.mix(acc, 0xffffff, 0.35), acc, acc, G.mix(acc, 0, 0.88)];
  return [0xff2a8a, 0x2af0ff, 0xff2a8a, 0x2af0ff, 0x061416];
}

function shade(c, k) {
  return k >= 0 ? G.mix(c, 0x000000, k) : G.mix(c, 0xffffff, -k);
}

// neon text: halo passes from wide and dark to a thin bright core
function tube(dc, txt, x, y, h, pen, c) {
  for (const [w, k] of pen >= 6 ? HALO : SMALL) {
    dc.setColor(shade(c, k), -1);
    F.st(dc, txt, x, y, h, Math.max(1, Math.round((pen * w) / 7)), 1, 1, 0);
  }
}

// horizontal extent of every character of the time string: [x0, x1] pairs (stroke glyphs are
// separated by a gap of 22/80 of the height)
function boxes(txt) {
  const x0 = 227 - F.stW(txt, TH) / 2, gap = (22 * TH) / 80;
  const out = [];
  for (let i = 0; i < txt.length; i++) {
    const x = x0 + (i > 0 ? F.stW(txt.substring(0, i), TH) + gap : 0);
    out.push(x, x + F.stW(txt[i], TH));
  }
  return out;
}

// heart shape around (cx, cy), size s
function heart(dc, cx, cy, s) {
  const r = s * 0.3;
  dc.fillCircle(cx - r, cy - r * 0.6, r);
  dc.fillCircle(cx + r, cy - r * 0.6, r);
  dc.fillPolygon([[cx - 2 * r, cy - r * 0.3], [cx + 2 * r, cy - r * 0.3], [cx, cy + s * 0.62]]);
}

export default {
  fps: 10,

  // static layer: all tubes lit; the ignition, the stutter and the heart beat are drawn over it
  bgKey(d) { return d.doy * 1440 + d.mins; },
  reveal() { return false; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const P = pal(d.cfg.style, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const ts = G.timeStr(d);

    if (S) {
      dc.setColor(0x000000, -1);
      dc.fillRectangle(0, 0, 454, 454);
      // ---- date sign, the time, the steps sign
      tube(dc, d.dowStr + " " + d.day + " " + d.monStr, 227, 72, 26, 3, P[1]);
      // a full (uncached) frame at the very start of the ignition shows the time tubes dark anyway:
      // skip the costly halo passes there
      if (a.so || p >= 0.05) tube(dc, ts, 227, TY, TH, 10, P[0]);
      tube(dc, G.num(Math.max(0, d.steps)) + " SCHRITTE", 227, 288, 24, 3, P[1]);
      tube(dc, d.hr > 0 ? "" + d.hr : "--", 256, 334, 30, 3, P[2]);
      // ---- Body Battery as tube segments
      const n = d.bb >= 0 ? Math.round(G.clamp(d.bb / 100, 0, 1) * 10) : 0;
      for (let i = 0; i < 10; i++) {
        const x = 132 + i * 20;
        const on = i < n;
        if (on) {
          dc.setColor(shade(P[3], 0.75), -1);
          dc.fillRectangle(x - 3, 371, 18, 18);
        }
        dc.setColor(on ? P[3] : P[4], -1);
        dc.fillRectangle(x, 374, 12, 12);
        if (on) {
          dc.setColor(shade(P[3], -0.6), -1);
          dc.fillRectangle(x + 4, 378, 4, 4);
        }
      }
    }

    if (!M) return;
    // ---- ignition on the raise: each tube flickers on in turn; awake, one tube now and then stutters
    const B = boxes(ts);
    const fr = Math.floor(a.t / 60);
    for (let i = 0; i < ts.length; i++) {
      const on0 = 0.17 + i * 0.13;
      let off = false;
      if (p < 1) {
        if (p < on0 - 0.12) off = true;
        else if (p < on0) off = G.rnd(fr * 7 + i * 13) % 3 !== 0;
      } else if (live) {
        const k = Math.floor(tt / 90);
        off = G.rnd(k) % 41 === 0 && G.rnd(k + 5) % ts.length === i;
      }
      if (off) {
        // the dark tube covers its slice of the sign, up to half way to its neighbours
        const x0 = i === 0 ? B[0] - 30 : (B[i * 2 - 1] + B[i * 2]) / 2;
        const x1 = i === ts.length - 1 ? B[i * 2 + 1] + 30 : (B[i * 2 + 1] + B[i * 2 + 2]) / 2;
        dc.setColor(0x000000, -1);
        dc.fillRectangle(Math.floor(x0), TY - TH / 2 - 18, Math.ceil(x1 - x0), TH + 36);
      }
    }
    // ---- the heart beats with the heart rate
    const beat = d.hr > 0 ? 60000 / d.hr : 1000;
    const ph = live ? (tt % beat) / beat : 0.5;
    const s = 30 + (ph < 0.15 ? Math.round((1 - ph / 0.15) * 6) : 0);
    const on = p >= 0.75;
    dc.setColor(on ? shade(P[2], 0.75) : 0x000000, -1);
    heart(dc, 196, 336, s + 10);
    dc.setColor(on ? P[2] : shade(P[2], 0.8), -1);
    heart(dc, 196, 336, s);
    dc.setColor(on ? shade(P[2], -0.6) : 0x000000, -1);
    heart(dc, 196, 336, Math.round(s * 0.4));
  },

  aod(dc, d) {
    const o = St.shift(d);
    const P = pal(d.cfg.style, d.accent);
    dc.setColor(shade(P[0], 0.55), -1);
    F.st(dc, G.timeStr(d), 227 + o[0], TY + o[1], TH, 3, 1, 1, 0);
  },
};
