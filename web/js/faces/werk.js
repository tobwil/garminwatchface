// WERK — "Tageskunstwerk": every day paints its own picture, a generative bloom on the black AMOLED
// screen. The steps decide the number of petals (5 to 12), the sleep score the colour (an indigo night
// for poor sleep, through dusk and dawn to a golden sun), the day's stress how wild the petal tips
// are, the Body Battery how brightly it glows; the date turns it. The picture grows with the day and
// gets a title ("RUHIGE MORGENRÖTE"). At midnight it goes into the week gallery below: the last six
// days as small pictures, kept in the watch's storage.
// Styles: 1 Schwarz, 2 Leinwand, 3 Akzent (all in the accent colour). Mirrors watch/source/faces/Werk.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const CY = 198; // centre of today's picture
const R = 100;
const DL = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
const ADJ = ["STILLE", "RUHIGE", "BEWEGTE", "WILDE"];
const NOUN = ["NACHT", "DÄMMERUNG", "MORGENRÖTE", "SONNE"];

let wk = null; // [today's picture, the six days before], read with every static redraw

function leap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function dayKey(d) { return d.year * 1000 + d.doy; }
function yKey(d) { return d.doy > 1 ? d.year * 1000 + d.doy - 1 : (d.year - 1) * 1000 + (leap(d.year - 1) ? 366 : 365); }

// the day's mean stress (the last 12 hours), else the current value
function stressAvg(d) {
  let s = 0, n = 0;
  const h = d.stressHist;
  for (let i = Math.max(0, h.length - 24); i < h.length; i++) if (h[i] >= 0) { s += h[i]; n++; }
  return n > 0 ? s / n : d.stress >= 0 ? d.stress : 30;
}

// today's picture packed into one number (0 = no picture): petals, colour, glow, wildness, turn
function params(d) {
  const g = d.stepGoal > 0 ? d.stepGoal : 10000;
  const np = G.clamp(Math.floor((d.steps / g) * 7), 0, 7);
  const hue = d.sleep > 0 ? G.clamp(Math.round(d.sleep * 0.15), 0, 15) : 8;
  const br = d.bb >= 0 ? G.clamp(Math.round(d.bb * 0.15), 0, 15) : 10;
  const jag = G.clamp(Math.round(stressAvg(d) * 0.15), 0, 15);
  return 1 + np + 8 * hue + 128 * br + 2048 * jag + 32768 * (d.doy % 256);
}

function sync(d) {
  // web preview only: hang six pictures into the gallery once
  if (St.get("arDemo", 0) === 0) {
    St.set("arDemo", 1);
    const H = [];
    for (let i = 0; i < 6; i++) {
      const r = G.rnd(i * 977 + 13);
      H.push(1 + (r % 8) + 8 * ((r >> 3) % 16) + 128 * (6 + ((r >> 7) % 10)) + 2048 * ((r >> 11) % 16) + 32768 * ((d.doy + 250 + i) % 256));
    }
    St.set("arH", H);
    St.set("arD", yKey(d));
    St.set("arT", H[5]);
  }
  const today = dayKey(d);
  const v = params(d);
  const day = St.get("arD", -1);
  if (day !== today) {
    let H = St.get("arH", [0, 0, 0, 0, 0, 0]).slice();
    if (day !== -1) {
      // yesterday's picture goes into the gallery (after a gap: empty frames for the missed days)
      if (day !== yKey(d)) H = H.concat([0]);
      H = H.concat([St.get("arT", 0)]);
      H = H.slice(H.length - 6);
    }
    St.set("arH", H);
    St.set("arD", today);
    St.set("arT", v);
  } else if (St.get("arT", 0) !== v) St.set("arT", v);
  return [v, St.get("arH", [0, 0, 0, 0, 0, 0])];
}

// the picture v around (cx, cy) with radius r: layers 1..3; acc >= 0 paints it in that colour only
function bloom(dc, cx, cy, r, v, layers, canvas, acc) {
  const w = v - 1;
  const n = 5 + (w % 8), hue = 250 + Math.floor(w / 8) % 16 * 10, br = Math.floor(w / 128) % 16;
  const jag = Math.floor(w / 2048) % 16, a0 = (Math.floor(w / 32768) * 37) % 360;
  const val = canvas ? 0.75 : 0.45 + (br / 15) * 0.55;
  const sect = 360 / n;
  // layer -1 is a dim, wider halo behind the petals (only on the big picture)
  for (let j = layers > 1 ? -1 : 0; j < layers; j++) {
    const rr = j < 0 ? r * 1.12 : r * (1 - j * 0.3);
    if (acc >= 0) dc.setColor(G.mix(0, acc, j < 0 ? 0.2 : Math.min(1, val * (0.55 + j * 0.25))), -1);
    else dc.setColor(j < 0 ? (canvas ? G.hsv(hue, 0.25, 0.92) : G.hsv(hue, 0.9, 0.2)) : G.hsv(hue + j * 22, 0.85 - j * 0.15, Math.min(1, val * (0.8 + j * 0.15))), -1);
    for (let i = 0; i < n; i++) {
      const an = a0 + (i + (j === 1 ? 0.5 : 0)) * sect;
      const pts = [[cx, cy], [G.ptX(cx, rr * 0.5, an - sect * 0.42), G.ptY(cy, rr * 0.5, an - sect * 0.42)]];
      if (jag >= 8) {
        // wild days split the tips
        const nd = rr * (1 - jag / 40);
        pts.push([G.ptX(cx, rr, an - sect * 0.14), G.ptY(cy, rr, an - sect * 0.14)], [G.ptX(cx, nd, an), G.ptY(cy, nd, an)],
          [G.ptX(cx, rr, an + sect * 0.14), G.ptY(cy, rr, an + sect * 0.14)]);
      } else pts.push([G.ptX(cx, rr, an), G.ptY(cy, rr, an)]);
      pts.push([G.ptX(cx, rr * 0.5, an + sect * 0.42), G.ptY(cy, rr * 0.5, an + sect * 0.42)]);
      dc.fillPolygon(pts.map((q) => [Math.round(q[0]), Math.round(q[1])]));
    }
  }
  dc.setColor(acc >= 0 ? G.mix(acc, 0xffffff, 0.6) : G.hsv(hue + 60, 0.35, 1), -1);
  dc.fillCircle(cx, cy, Math.max(3, Math.round(r * 0.12)));
}

export default {
  fps: 10,

  // static layer: today's picture, its title, the gallery, the time; two sparks circle the bloom
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const cv = d.cfg.style === 2, ac = d.cfg.style === 3 ? d.accent : -1;
    const tx = cv ? 0x2a2420 : 0xffffff, dim = cv ? 0x8a7a68 : 0x8a8a96;
    if (S || wk === null) wk = sync(d);
    const v = wk[0], H = wk[1];
    const w = v - 1;

    if (S) {
      dc.setColor(cv ? 0xf0ead8 : 0x000000, -1);
      dc.fillRectangle(0, 0, 454, 454);
      // ---- today's picture with a faint frame
      dc.setColor(cv ? 0xd8ceb8 : 0x16161c, -1);
      dc.drawCircle(227, CY, R + 10);
      bloom(dc, 227, CY, R, v, 3, cv, ac);

      // ---- its title
      const hi = Math.floor(w / 8) % 16, jg = Math.floor(w / 2048) % 16;
      dc.setColor(tx, -1);
      F.px(dc, ADJ[jg <= 4 ? 0 : jg <= 8 ? 1 : jg <= 11 ? 2 : 3] + " " + NOUN[Math.floor(hi / 4)], 227, 318, 2, 1, 0);
      dc.setColor(dim, -1);
      F.px(dc, "WERK NR. " + d.doy, 227, 340, 2, 1, 0);

      // ---- the week gallery
      for (let i = 0; i < 6; i++) {
        const x = Math.round(227 + (i - 2.5) * 52);
        if (H[i] > 0) bloom(dc, x, 376, 20, H[i], 1, cv, ac);
        else {
          dc.setColor(cv ? 0xd8ceb8 : 0x26262e, -1);
          dc.drawCircle(x, 376, 20);
        }
        dc.setColor(dim, -1);
        F.px(dc, DL[(d.dow + 1 + i) % 7], x, 402, 1, 1, 0);
      }

      // ---- time and date
      dc.setColor(tx, -1);
      F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
      dc.setColor(dim, -1);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 64, 2, 1, 0);
    }

    if (!M) return;
    // ---- two sparks circle the bloom
    const hue = 250 + (Math.floor(w / 8) % 16) * 10;
    for (let i = 0; i < 2; i++) {
      const an = (a.t / 40 + i * 180) % 360;
      dc.setColor(ac >= 0 ? G.mix(ac, 0xffffff, 0.5) : G.hsv(hue + 60, 0.3, 1), -1);
      dc.fillCircle(Math.round(G.ptX(227, R + 10, an)), Math.round(G.ptY(CY, R + 10, an)), 3);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const v = wk === null ? 1 : wk[0];
    const w = v - 1, n = 5 + (w % 8), a0 = (Math.floor(w / 32768) * 37) % 360;
    dc.setColor(G.hsv(250 + (Math.floor(w / 8) % 16) * 10, 0.6, 0.45), -1);
    for (let i = 0; i < n; i++) {
      const an = a0 + (i * 360) / n;
      dc.drawLine(227 + o[0], CY + o[1], Math.round(G.ptX(227, R * 0.8, an)) + o[0], Math.round(G.ptY(CY, R * 0.8, an)) + o[1]);
    }
    dc.setColor(0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
  },
};
