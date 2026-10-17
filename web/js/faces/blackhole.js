// HOLE — "Schwarzes Loch": a black hole in the style of Gargantua, made for AMOLED. A flat accretion
// disk circles the hole; behind it the light of the far side is bent over and under the hole, a thin
// photon ring hugs the event horizon. Particles orbit at Keplerian speed (fast inside, slow outside,
// quicker with a higher pulse) and the side flying towards you glows brighter (Doppler beaming). On
// every wrist raise the matter spirals in. Below: the steps to the event horizon (the step goal).
// Styles: 1 Gargantua, 2 Quasar, 3 Akzent. Mirrors watch/source/faces/Blackhole.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const CX = 227, CY = 230; // the hole
const RH = 52; // event horizon
const FL = 0.2; // disk flattening
const NP = 70; // orbiting particles

// [hot, warm, cool, ring, text, text dim, star]
function pal(st, acc) {
  if (st === 2) return [0xe8f4ff, 0x6a9aff, 0x6a2ad8, 0xffffff, 0xd8e4ff, 0x6a7aa8, 0xb8c8ff];
  if (st === 3) return [G.mix(acc, 0xffffff, 0.75), acc, G.mix(acc, 0, 0.55), 0xffffff, G.mix(acc, 0xffffff, 0.6), G.mix(acc, 0, 0.4), 0xd8d8e8];
  return [0xfff6e0, 0xffa83a, 0xc8401a, 0xffffff, 0xffe8c8, 0xa87a5a, 0xd8d8e8];
}

// colour of disk matter at radius r (hot inside), brightened on the approaching side
function heat(P, r, bright) {
  const t = G.clamp((r - RH) / 150, 0, 1);
  const c = t < 0.4 ? G.mix(P[0], P[1], t / 0.4) : G.mix(P[1], P[2], (t - 0.4) / 0.6);
  return bright >= 0 ? G.mix(c, 0xffffff, bright * 0.35) : G.mix(c, 0x000000, -bright * 0.55);
}

// one sector of a disk band: the ring between radii r1 and r2 from angle a0 over 30 degrees,
// flattened into the disk plane
function sector(dc, r1, r2, a0) {
  const pts = [];
  for (let k = 0; k <= 2; k++) {
    const an = ((a0 + k * 15) * Math.PI) / 180;
    pts.push([CX + Math.cos(an) * r2, CY + Math.sin(an) * r2 * FL]);
  }
  for (let k = 2; k >= 0; k--) {
    const an = ((a0 + k * 15) * Math.PI) / 180;
    pts.push([CX + Math.cos(an) * r1, CY + Math.sin(an) * r1 * FL]);
  }
  dc.fillPolygon(pts);
}

// one half of the disk (back: 180..360, front: 0..180) in bands and sectors, the side flying
// towards you (left) brighter
function half(dc, P, from, dim) {
  for (let r = 66; r < 206; r += 20) {
    for (let a0 = from; a0 < from + 180; a0 += 30) {
      const mid = ((a0 + 15) * Math.PI) / 180;
      dc.setColor(heat(P, r + 6, -Math.cos(mid) * 0.6 - dim), -1);
      sector(dc, r, r + 21, a0);
    }
  }
}

export default {
  fps: 12,

  // static layer: stars, the disk, the lensed arcs, the horizon and its photon ring, texts; the
  // orbiting particles move
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
      dc.setColor(G.mix(P[6], 0, 0.45), -1);
      for (let i = 0; i < 40; i++) dc.fillRectangle(20 + ((i * 101 + 17) % 414), 20 + ((i * 59 + 11) % 414), 2, 2);
      // ---- back half of the disk (the horizon is drawn over it)
      half(dc, P, 180, 0.3);
      // ---- light of the far side bent over and under the hole
      const LENS = [[92, 0.6, -0.55], [84, 0.35, -0.25], [76, 0.15, 0.2], [68, 0.0, 0.7]];
      for (const [r, t, b] of LENS) {
        dc.setColor(heat(P, RH + 150 * t, b), -1);
        const pts = [];
        for (let deg = 190; deg <= 350; deg += 20) {
          const an = (deg * Math.PI) / 180;
          pts.push([CX + Math.cos(an) * r, CY + Math.sin(an) * r * 0.9]);
        }
        for (let deg = 350; deg >= 190; deg -= 20) {
          const an = (deg * Math.PI) / 180;
          pts.push([CX + Math.cos(an) * (RH + 2), CY + Math.sin(an) * (RH + 2) * 0.9]);
        }
        dc.fillPolygon(pts);
      }
      dc.setColor(heat(P, 70, 0.2), -1);
      for (let deg = 20; deg <= 160; deg += 8) {
        const an = (deg * Math.PI) / 180;
        dc.fillRectangle(Math.round(CX + Math.cos(an) * (RH + 8)) - 1, Math.round(CY + Math.sin(an) * (RH + 8) * 0.9) - 1, 3, 3);
      }
      // ---- the horizon and its photon ring
      dc.setColor(P[3], -1);
      dc.fillCircle(CX, CY, RH + 3);
      dc.setColor(0x000000, -1);
      dc.fillCircle(CX, CY, RH);
      // ---- front half of the disk, over the hole
      half(dc, P, 0, 0);
      // ---- time, date, the way to the event horizon
      dc.setColor(P[4], -1);
      F.st(dc, G.timeStr(d), 227, 74, 54, 4, 1, 1, 0);
      dc.setColor(P[5], -1);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 112, 2, 1, 0);
      const sg = d.stepGoal > 0 ? d.stepGoal : 10000, st = Math.max(0, d.steps);
      dc.setColor(P[4], -1);
      F.px(dc, st >= sg ? "SINGULARITÄT ERREICHT" : "EREIGNISHORIZONT IN", 227, 324, 2, 1, 0);
      if (st < sg) F.px(dc, G.num(sg - st) + " SCHRITTEN", 227, 346, 2, 1, 0);
      dc.setColor(P[5], -1);
      F.px(dc, (d.hr > 0 ? d.hr : "--") + " BPM  STRESS " + (d.stress >= 0 ? d.stress : "--"), 227, 372, 2, 1, 0);
    }

    if (!M) return;
    // ---- matter orbiting at Keplerian speed; it spirals in on every raise
    const spd = 1 + (d.hr > 0 ? G.clamp((d.hr - 60) / 60, 0, 1.5) : 0);
    const e = G.ease(G.clamp(p / 0.9, 0, 1));
    for (let i = 0; i < NP; i++) {
      const r0 = 66 + (G.rnd(i * 7 + 1) % 136);
      const r = r0 * (1 + (1 - e) * 1.4);
      const w = 0.0011 * Math.pow(100 / r0, 1.5) * spd;
      const an = ((G.rnd(i * 13 + 5) % 360) * Math.PI) / 180 + tt * w + (1 - e) * 3;
      const x = CX + Math.cos(an) * r, y = CY + Math.sin(an) * r * FL;
      if (Math.sin(an) < 0 && (x - CX) * (x - CX) + (y - CY) * (y - CY) < (RH + 4) * (RH + 4)) continue;
      const b = -Math.cos(an);
      dc.setColor(G.mix(heat(P, r0, b > 0 ? b : b * 0.6), 0xffffff, 0.55), -1);
      const s = r0 < 110 ? 4 : 3;
      dc.fillRectangle(Math.round(x) - 1, Math.round(y) - 1, s, s);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const P = pal(d.cfg.style, d.accent);
    dc.setColor(G.mix(P[1], 0, 0.55), -1);
    dc.setPenWidth(2);
    dc.drawCircle(CX + o[0], CY + o[1], RH + 3);
    dc.setColor(0x8a8a8a, -1);
    F.st(dc, G.timeStr(d), 227 + o[0], 74 + o[1], 54, 3, 1, 1, 0);
  },
};
