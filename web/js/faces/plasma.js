// PLASMA — "Plasmakugel": a plasma ball on true black, made for AMOLED. The time sits dark in the
// glowing electrode, lightning tendrils crackle from it to the glass and light up where they touch.
// The more stress, the more tendrils; the higher the pulse, the faster they wander. On every wrist
// raise the lightning shoots out of the core. The base shows pulse, stress and Body Battery.
// Styles: 1 Violett, 2 Eis, 3 Akzent. Mirrors watch/source/faces/Plasma.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const CX = 227, CY = 200; // centre of the ball
const RG = 168; // glass radius
const RC = 70; // core radius
const SEG = 10; // segments per tendril

// [glow dark, glow mid, tendril, tendril core, core inner, glass, time ink, base, base text]
function pal(st, acc) {
  if (st === 2) return [0x061a3a, 0x1a6ad8, 0x6ad8ff, 0xffffff, 0xe8fbff, 0x1a3a6a, 0x05203a, 0x16181e, 0x6ad8ff];
  if (st === 3) return [G.mix(acc, 0, 0.82), G.mix(acc, 0, 0.35), acc, 0xffffff, G.mix(acc, 0xffffff, 0.8), G.mix(acc, 0, 0.7), G.mix(acc, 0, 0.85), 0x16181e, acc];
  return [0x2a0640, 0x9a1ad8, 0xff5ae0, 0xffffff, 0xffe8fb, 0x3a1a5a, 0x2a0636, 0x16181e, 0xff7ae8];
}

function tendrils(d) {
  return 4 + Math.round(G.clamp(d.stress >= 0 ? d.stress : 25, 0, 100) / 20);
}

export default {
  fps: 12,

  // static layer: glass, electrode with the time, base with the data; the lightning moves
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const P = pal(d.cfg.style, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;

    if (S) {
      dc.setColor(0x000000, -1);
      dc.fillRectangle(0, 0, 454, 454);
      // ---- glass with a highlight
      dc.setColor(P[5], -1);
      dc.setPenWidth(2);
      dc.drawCircle(CX, CY, RG);
      dc.setColor(G.mix(P[5], 0xffffff, 0.35), -1);
      for (let i = 0; i < 20; i++) {
        const an = (196 + i * 3) * Math.PI / 180;
        const w = i < 3 || i > 16 ? 2 : 4;
        dc.fillRectangle(Math.round(CX + Math.cos(an) * (RG - 14)) - w / 2, Math.round(CY + Math.sin(an) * (RG - 14)) - w / 2, w, w);
      }
      // ---- the electrode: halo to white-hot centre
      const RINGS = [[96, 0], [84, 0.35], [70, 1], [60, 1.6], [48, 2.2]];
      for (const [r, k] of RINGS) {
        const c = k <= 1 ? G.mix(P[0], P[1], k) : G.mix(P[2], P[4], (k - 1) / 1.2);
        dc.setColor(c, -1);
        dc.fillCircle(CX, CY, r);
      }
      // ---- time in the core, date below
      dc.setColor(P[6], -1);
      F.st(dc, G.timeStr(d), CX, CY, 36, 6, 1, 1, 0);
      dc.setColor(G.mix(P[2], 0, 0.3), -1);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX, 300, 2, 1, 0);
      // ---- the base with the data
      dc.setColor(P[7], -1);
      dc.fillPolygon([[150, 372], [304, 372], [350, 454], [104, 454]]);
      dc.setColor(G.mix(P[7], 0xffffff, 0.15), -1);
      dc.fillRectangle(150, 372, 154, 4);
      dc.setColor(P[8], -1);
      F.px(dc, (d.hr > 0 ? d.hr : "--") + " BPM  STRESS " + (d.stress >= 0 ? d.stress : "--"), CX, 388, 2, 1, 0);
      F.px(dc, "BODY BATTERY " + (d.bb >= 0 ? d.bb + "%" : "--"), CX, 410, 2, 1, 0);
    }

    if (!M) return;
    // ---- lightning: wandering tendrils, flickering every frame
    const n = tendrils(d);
    const grow = G.ease(G.clamp(p / 0.7, 0, 1));
    const spd = 1 + (d.hr > 0 ? G.clamp((d.hr - 50) / 50, 0, 2) : 0);
    const fr = Math.floor(a.t / 70);
    for (let i = 0; i < n; i++) {
      const base = (i * 2 * Math.PI) / n + 0.4;
      const ang = base + Math.sin((tt * spd) / (1700 + i * 310) + i) * 0.7;
      const len = (RC + (RG - RC) * grow);
      let px = CX + Math.cos(ang) * RC, py = CY + Math.sin(ang) * RC;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      // a random walk sideways, pinned to the core and to the glass
      const pts = [px, py];
      let w = 0;
      for (let j = 1; j <= SEG; j++) {
        const r = RC + ((len - RC) * j) / SEG;
        w += (G.rnd(fr * 31 + i * 7 + j) % 15) - 7;
        const jit = w * Math.sin((Math.PI * j) / SEG);
        pts.push(CX + ca * r - sa * jit, CY + sa * r + ca * jit);
      }
      // glow pass, then the bright core of the bolt
      dc.setColor(P[1], -1);
      dc.setPenWidth(5);
      for (let j = 2; j < pts.length; j += 2) dc.drawLine(pts[j - 2], pts[j - 1], pts[j], pts[j + 1]);
      dc.setColor(G.rnd(fr * 3 + i) % 4 === 0 ? P[3] : P[2], -1);
      dc.setPenWidth(2);
      for (let j = 2; j < pts.length; j += 2) dc.drawLine(pts[j - 2], pts[j - 1], pts[j], pts[j + 1]);
      // every second bolt forks half way
      if (i % 2 === 0 && grow >= 1) {
        const m = SEG / 2;
        const fa = ang + ((G.rnd(fr * 5 + i) % 2) * 2 - 1) * 0.35;
        let fx = pts[m * 2], fy = pts[m * 2 + 1];
        dc.setColor(P[1], -1);
        dc.setPenWidth(2);
        for (let j = 1; j <= 3; j++) {
          const nx = fx + Math.cos(fa) * 16 + ((G.rnd(fr * 17 + i + j) % 9) - 4);
          const ny = fy + Math.sin(fa) * 16 + ((G.rnd(fr * 19 + i + j) % 9) - 4);
          dc.drawLine(fx, fy, nx, ny);
          fx = nx;
          fy = ny;
        }
      }
      // where it touches the glass
      if (grow >= 1) {
        dc.setColor(P[2], -1);
        dc.fillCircle(pts[pts.length - 2], pts[pts.length - 1], 6);
        dc.setColor(P[3], -1);
        dc.fillCircle(pts[pts.length - 2], pts[pts.length - 1], 2);
      }
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const P = pal(d.cfg.style, d.accent);
    dc.setColor(G.mix(P[5], 0, 0.3), -1);
    dc.setPenWidth(1);
    dc.drawCircle(CX + o[0], CY + o[1], RC);
    dc.setColor(G.mix(P[2], 0, 0.45), -1);
    F.st(dc, G.timeStr(d), CX + o[0], CY + o[1], 36, 3, 1, 1, 0);
  },
};

