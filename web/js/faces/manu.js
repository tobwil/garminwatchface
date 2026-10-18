// MANU — "Manufaktur": a photo-real luxury automatic for the AMOLED screen, built from pre-rendered
// images (tools/render/manu.py): a brushed sunburst dial with a bow-tie reflection, faceted applied
// indices with lume, snailed sub-dials, dauphine hands with soft shadows on the dial. The watch turns
// the images with bilinear filtering; the seconds hand beats 8 times a second like a 28,800 vph
// movement. Power reserve = the watch battery, left sub-dial = Body Battery, right = steps towards the
// goal, the date wheel in the window at 6. After sunset the lume glows (drawn additively); on every
// wrist raise a reflex glides over the crystal.
// Styles: 1 Mitternacht, 2 Fumé, 3 Racing. Mirrors watch/source/faces/Manu.mc.
import { G } from "../engine/gfx.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import { Bmp, AffineTransform, BLEND_MODE_ADDITIVE, BLEND_MODE_DEFAULT, FILTER_MODE_BILINEAR } from "../engine/bmp.js";
import IMG from "../img/manu.js";

const C = 227;
const SUBS = [[135, 227], [319, 227]];
const PRX = 227, PRY = 146; // power reserve pivot
const LUME = 0x7affb0;
// hand images point to 12; pivot = (w / 2, PV)
const PV = { hour: 124, minute: 198, second: 210, sub: 46, res: 40 };

let sw = null; // [wake start (ms of the clock), last t] for the sweeping seconds hand
let nt = false; // after sunset (set with every static redraw)

// draw image b turned by deg around its pivot (w / 2, pv), pivot placed at (x, y)
function turn(dc, b, x, y, pv, deg, tint) {
  const t = new AffineTransform();
  t.rotate((deg * Math.PI) / 180);
  t.translate(-b.getWidth() / 2, -pv);
  dc.drawBitmap2(x, y, b, { transform: t, filterMode: FILTER_MODE_BILINEAR, tintColor: tint });
}

// a hand with its soft shadow (offset away from the light, the higher the hand the further)
function hand(dc, n, x, y, deg, sh, tint) {
  turn(dc, Bmp.load(IMG[n + "_s"]), x + sh, y + Math.round(sh * 1.6), PV[n], deg, -1);
  turn(dc, Bmp.load(IMG[n]), x, y, PV[n], deg, tint);
}

export default {
  fps: 10,
  reveal() { return false; },

  // static layer: dial, date, sub-dial hands, power reserve, hour and minute hands, at night the lume;
  // the seconds hand and the crystal reflex move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = G.clamp(d.cfg.style, 1, 3);
    if (S) {
      nt = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz) < -4;
      const night = nt;
      // ---- the dial (darker at night, as in a dim room)
      dc.drawBitmap2(0, 0, Bmp.load(IMG["dial" + st]), { tintColor: night ? 0x5c5c5c : -1 });
      // ---- the date wheel
      dc.setClip(209, 310, 36, 24);
      dc.drawBitmap(209, 310 - (d.day - 1) * 24, Bmp.load(IMG.date));
      dc.clearClip();
      // ---- Body Battery, steps, power reserve (= watch battery)
      const g = d.stepGoal > 0 ? d.stepGoal : 10000;
      const vs = [d.bb >= 0 ? d.bb : 0, G.clamp((d.steps / g) * 100, 0, 100)];
      const dim = night ? 0x5c5c5c : -1;
      for (let i = 0; i < 2; i++) hand(dc, "sub", SUBS[i][0], SUBS[i][1], -150 + vs[i] * 3, 2, dim);
      hand(dc, "res", PRX, PRY, -60 + G.clamp(d.batt, 0, 100) * 1.2, 2, dim);
      // ---- hour and minute hands
      const hd = ((d.h % 12) + d.m / 60) * 30, md = (d.m + d.s / 60) * 6;
      hand(dc, "hour", C, C, hd, 3, dim);
      hand(dc, "minute", C, C, md, 4, dim);
      // ---- the lume glows after sunset
      if (night) {
        dc.setBlendMode(BLEND_MODE_ADDITIVE);
        const gw = Bmp.load(IMG.glow);
        for (let h = 0; h < 12; h++) {
          const n = h === 0 ? 2 : 1;
          for (let k = 0; k < n; k++) {
            const t = new AffineTransform();
            t.rotate((h * 30 * Math.PI) / 180);
            t.translate(n === 2 ? (k === 0 ? -5.5 : 5.5) : 0, -184);
            t.scale(0.45, 1.0);
            t.translate(-20, -20);
            dc.drawBitmap2(C, C, gw, { transform: t, filterMode: FILTER_MODE_BILINEAR, tintColor: LUME });
          }
        }
        turn(dc, Bmp.load(IMG.hour_l), C, C, PV.hour, hd, LUME);
        turn(dc, Bmp.load(IMG.minute_l), C, C, PV.minute, md, LUME);
        dc.setBlendMode(BLEND_MODE_DEFAULT);
      }
      dc.drawBitmap2(C - 11, C - 11, Bmp.load(IMG.cap), { tintColor: dim });
    }

    if (!M) return;
    // ---- the seconds hand: 8 beats a second, continuous from the moment of the raise
    if (sw === null || a.t < sw[1] || Math.abs((((sw[0] + a.t) / 1000) % 60) - d.s) > 1.5 && Math.abs((((sw[0] + a.t) / 1000) % 60) - d.s) < 58.5) sw = [d.s * 1000 - a.t, a.t];
    sw[1] = a.t;
    const ms = sw[0] + a.t;
    const sd = (Math.floor(ms / 125) % 480) * 0.75;
    const night = nt;
    hand(dc, "second", C, C, sd, 5, night ? G.dim(d.accent, 0.45) : d.accent);
    dc.drawBitmap2(C - 11, C - 11, Bmp.load(IMG.cap), { tintColor: night ? 0x5c5c5c : -1 });
    // ---- a reflex glides over the crystal on every raise
    if (a.live && a.intro < 1) {
      const p = G.ease(a.intro);
      const t = new AffineTransform();
      t.rotate((-35 * Math.PI) / 180);
      t.scale(9, 0.9);
      t.translate(-20, -20);
      dc.setBlendMode(BLEND_MODE_ADDITIVE);
      dc.drawBitmap2(Math.round(G.lerp(-60, 520, p)), Math.round(G.lerp(-40, 420, p)), Bmp.load(IMG.glow),
        { transform: t, filterMode: FILTER_MODE_BILINEAR, tintColor: 0x2a2a2a });
      dc.setBlendMode(BLEND_MODE_DEFAULT);
    }
  },

  aod(dc, d) {
    // only the lume, very dim, shifted against burn-in
    const o = St.shift(d);
    const dim = G.dim(LUME, 0.35);
    const gw = Bmp.load(IMG.glow);
    dc.setBlendMode(BLEND_MODE_ADDITIVE);
    for (let h = 0; h < 12; h++) {
      const t = new AffineTransform();
      t.rotate((h * 30 * Math.PI) / 180);
      t.translate(0, -184);
      t.scale(0.35, 0.8);
      t.translate(-20, -20);
      dc.drawBitmap2(C + o[0], C + o[1], gw, { transform: t, filterMode: FILTER_MODE_BILINEAR, tintColor: dim });
    }
    turn(dc, Bmp.load(IMG.hour_l), C + o[0], C + o[1], PV.hour, ((d.h % 12) + d.m / 60) * 30, dim);
    turn(dc, Bmp.load(IMG.minute_l), C + o[0], C + o[1], PV.minute, d.m * 6, dim);
    dc.setBlendMode(BLEND_MODE_DEFAULT);
  },
};
