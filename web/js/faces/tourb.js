// TOURB — "Tourbillon": a skeletonised, hand-finished movement from pre-rendered images
// (tools/render/tourbillon.py): ruthenium plate with perlage, rhodium bridges with Côtes de Genève
// and polished bevels, rubies, blued screws, black openings (the AMOLED is really off there). The
// gilded wheels turn under the bridges, the tourbillon cage at 6 turns once a minute (the seconds),
// the balance swings inside it and comes to life on every wrist raise. Power reserve on the barrel
// bridge = the watch battery. Openworked hands.
// Styles: 1 Rhodium, 2 Gold (warm tint), 3 Schwarz (dark DLC look). Mirrors watch/source/faces/Tourb.mc.
import { G } from "../engine/gfx.js";
import { St } from "../engine/st.js";
import { Bmp, AffineTransform, FILTER_MODE_BILINEAR } from "../engine/bmp.js";
import IMG, { M as IM } from "../img/tourb.js";

const C = 227;
const TINT = [-1, 0xffe0b0, 0x8a8e98];

let sw = null; // [clock ms at the raise, last t]

// image b turned by deg around the point (px, py) of the image, placed at (x, y)
function turn(dc, b, x, y, px, py, deg, tint) {
  const t = new AffineTransform();
  t.rotate((deg * Math.PI) / 180);
  t.translate(-px, -py);
  dc.drawBitmap2(x, y, b, { transform: t, filterMode: FILTER_MODE_BILINEAR, tintColor: tint });
}

// a centred part (wheel, cage, balance) turned around its middle
function spin(dc, n, x, y, deg, tint) {
  const b = Bmp.load(IMG[n]);
  turn(dc, b, x, y, b.getWidth() / 2, b.getHeight() / 2, deg, tint);
}

function hand(dc, n, pv, deg, sh, tint) {
  const s = Bmp.load(IMG[n + "_s"]), b = Bmp.load(IMG[n]);
  turn(dc, s, C + sh, C + Math.round(sh * 1.6), s.getWidth() / 2, pv, deg, -1);
  turn(dc, b, C, C, b.getWidth() / 2, pv, deg, tint);
}

export default {
  fps: 10,
  reveal() { return false; },

  // static layer: the movement with its bridges and the power reserve; wheels, tourbillon, balance and
  // the hands (above the wheels) move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const tint = TINT[G.clamp(d.cfg.style, 1, 3) - 1];

    if (S) {
      dc.drawBitmap2(0, 0, Bmp.load(IMG.tplate), { tintColor: tint });
      // power reserve (watch battery) on the barrel bridge
      const rs = Bmp.load(IMG.res);
      turn(dc, rs, IM.BARREL[0], IM.BARREL[1], rs.getWidth() / 2, IM.RES_PV, 40 + G.clamp(d.batt, 0, 100) * 0.9, -1);
    }

    if (!M) return;
    // ---- the clock's milliseconds, continuous from the raise
    if (sw === null || a.t < sw[1] || Math.abs((((sw[0] + a.t) / 1000) % 60) - d.s) > 1.5 && Math.abs((((sw[0] + a.t) / 1000) % 60) - d.s) < 58.5) sw = [d.s * 1000 - a.t, a.t];
    sw[1] = a.t;
    const ms = sw[0] + a.t;
    // ---- the gear train under its bridges
    const w1 = (ms / 60000) * 360 % 360, w2 = -(ms / 12000) * 360 % 360;
    spin(dc, "wheel1_s", IM.W1[0] + 2, IM.W1[1] + 3, w1, -1);
    spin(dc, "wheel1", IM.W1[0], IM.W1[1], w1, tint);
    dc.drawBitmap2(IM.OV1[0], IM.OV1[1], Bmp.load(IMG.ov1), { tintColor: tint });
    spin(dc, "wheel2_s", IM.W2[0] + 2, IM.W2[1] + 3, w2, -1);
    spin(dc, "wheel2", IM.W2[0], IM.W2[1], w2, tint);
    dc.drawBitmap2(IM.OV2[0], IM.OV2[1], Bmp.load(IMG.ov2), { tintColor: tint });
    // ---- the tourbillon: the balance swings (and starts on the raise), the cage turns once a minute
    const amp = 230 * (a.live ? G.ease(Math.min(1, a.intro * 1.4)) : 1);
    spin(dc, "balance", IM.TB[0], IM.TB[1], amp * Math.sin((ms / 400) * 2 * Math.PI), tint);
    spin(dc, "cage", IM.TB[0], IM.TB[1], ((ms % 60000) / 60000) * 360, tint);
    dc.drawBitmap2(IM.OVT[0], IM.OVT[1], Bmp.load(IMG.ovt), { tintColor: tint });
    // ---- hands
    hand(dc, "hour", IM.HOUR_PV, ((d.h % 12) + d.m / 60) * 30, 3, tint);
    hand(dc, "minute", IM.MINUTE_PV, (d.m + d.s / 60) * 6, 4, tint);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const h = Bmp.load(IMG.hour), m = Bmp.load(IMG.minute);
    turn(dc, h, C + o[0], C + o[1], h.getWidth() / 2, IM.HOUR_PV, ((d.h % 12) + d.m / 60) * 30, 0x404040);
    turn(dc, m, C + o[0], C + o[1], m.getWidth() / 2, IM.MINUTE_PV, d.m * 6, 0x404040);
  },
};
