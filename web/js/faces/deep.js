// DEEP — "Tiefer Raum": a space-telescope view on the AMOLED screen from pre-rendered images
// (tools/render/deep.py): nebulae with glowing filaments and dark dust lanes, thousands of stars in
// their colour temperatures, bright stars with six-pointed diffraction spikes. The nebula glows as
// bright as your Body Battery; bright stars twinkle, and on every wrist raise a shooting star crosses
// the sky. Thin, glowing time; date, Body Battery and steps below.
// Styles: 1 Hubble, 2 Webb, 3 Orion. Mirrors watch/source/faces/Deep.mc.
import { G } from "../engine/gfx.js";
import { St } from "../engine/st.js";
import { Bmp, AffineTransform, BLEND_MODE_ADDITIVE, BLEND_MODE_DEFAULT, FILTER_MODE_BILINEAR } from "../engine/bmp.js";
import IMG, { M as IM } from "../img/deep.js";

const C = 227;

// text from a glyph strip, one clipped glyph at a time, centred on x
function txt(dc, big, s, x, y, tint) {
  const chars = big ? IM.BIG : IM.SMALL, adv = big ? IM.BIG_ADV : IM.SMALL_ADV;
  const cw = big ? IM.BIG_CW : IM.SMALL_CW, h = big ? IM.BIG_H : IM.SMALL_H;
  const b = Bmp.load(big ? IMG.big : IMG.small);
  let w = 0;
  for (let k = 0; k < s.length; k++) w += adv[Math.max(0, chars.indexOf(s[k]))];
  let cx = Math.round(x - w / 2);
  for (let k = 0; k < s.length; k++) {
    const i = Math.max(0, chars.indexOf(s[k]));
    if (s[k] !== " ") {
      dc.setClip(cx - 4, y, adv[i] + 8, h);
      dc.drawBitmap2(cx - i * cw - 2, y, b, { tintColor: tint });
      dc.clearClip();
    }
    cx += adv[i];
  }
}

export default {
  fps: 10,
  reveal() { return false; },

  // static layer: the sky and the texts; twinkling stars and the shooting star move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = G.clamp(d.cfg.style, 1, 3);

    if (S) {
      // ---- the nebula glows with the Body Battery
      const bb = d.bb >= 0 ? d.bb : 70;
      const g = Math.round(255 * (0.45 + 0.55 * bb / 100));
      dc.drawBitmap2(0, 0, Bmp.load(IMG["sky" + st]), { tintColor: (g << 16) | (g << 8) | g });
      // ---- time, date, data
      txt(dc, false, d.dowStr + " " + d.day + ". " + d.monStr, C, 128, 0xc8ccd8);
      txt(dc, true, G.timeStr(d), C, 146, -1);
      txt(dc, false, bb + "% ENERGIE   " + G.num(d.steps) + " SCHRITTE", C, 252, 0xa8aec0);
    }

    if (!M) return;
    // ---- bright stars twinkle
    const sb = Bmp.load(IMG.star);
    dc.setBlendMode(BLEND_MODE_ADDITIVE);
    for (let i = 0; i < 6; i++) {
      const k = 0.5 + 0.5 * Math.sin(a.t / 650 + i * 1.7);
      const v = Math.round(255 * (0.25 + 0.75 * k));
      const t = new AffineTransform();
      t.scale(0.55 + 0.35 * k, 0.55 + 0.35 * k);
      t.translate(-24, -24);
      dc.drawBitmap2(IM.TW[i * 2], IM.TW[i * 2 + 1], sb, { transform: t, filterMode: FILTER_MODE_BILINEAR, tintColor: (v << 16) | (v << 8) | v });
    }
    // ---- a shooting star on every raise
    if (a.live && a.intro > 0.08 && a.intro < 0.85) {
      const p = (a.intro - 0.08) / 0.77;
      const v = Math.round(255 * Math.sin(p * Math.PI));
      const t = new AffineTransform();
      t.rotate((24 * Math.PI) / 180);
      t.translate(-120, -4.5);
      dc.drawBitmap2(Math.round(G.lerp(110, 400, p)), Math.round(G.lerp(60, 190, p)), Bmp.load(IMG.streak),
        { transform: t, filterMode: FILTER_MODE_BILINEAR, tintColor: (v << 16) | (v << 8) | v });
    }
    dc.setBlendMode(BLEND_MODE_DEFAULT);
  },

  aod(dc, d) {
    const o = St.shift(d);
    txt(dc, true, G.timeStr(d), C + o[0], 146 + o[1], 0x3a3a3a);
  },
};
