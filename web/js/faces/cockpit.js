// COCKPIT — "Cockpit": a backlit sports-car instrument cluster from pre-rendered images
// (tools/render/cockpit.py). The rev counter is your heart rate (x10 BPM, redline from 170), the fuel
// bar is the Body Battery, the temperature bar the stress. The TFT in the middle shows the time, the
// date, the steps and the pulse; telltales light up like in a car: battery (watch battery low),
// message (notifications), Bluetooth (phone connected), engine check (high stress), heart (pulse
// above 120). On every wrist raise the needle sweeps to the stop and back, like at ignition.
// Styles: 1 Rot, 2 Eisblau, 3 Amber (the backlight). Mirrors watch/source/faces/Cockpit.mc.
import { G } from "../engine/gfx.js";
import { St } from "../engine/st.js";
import { Bmp, AffineTransform, BLEND_MODE_ADDITIVE, BLEND_MODE_DEFAULT, FILTER_MODE_BILINEAR } from "../engine/bmp.js";
import IMG, { M as IM } from "../img/cockpit.js";

const C = 227;
const BACK = [0xff3a24, 0x6ad0ff, 0xffa82a];
const ICOL = [0xff3a2a, 0xffb020, 0x3a8aff, 0xffb020, 0xff3a5a];

// text from a glyph strip, one clipped glyph at a time; just 0 left, 1 centre, 2 right
function txt(dc, big, s, x, y, just, tint) {
  const chars = big ? IM.BIG : IM.SMALL, adv = big ? IM.BIG_ADV : IM.SMALL_ADV;
  const cw = big ? IM.BIG_CW : IM.SMALL_CW, h = big ? IM.BIG_H : IM.SMALL_H;
  const b = Bmp.load(big ? IMG.big : IMG.small);
  let w = 0;
  for (let k = 0; k < s.length; k++) { const i = chars.indexOf(s[k]); w += adv[i < 0 ? 0 : i]; }
  let cx = Math.round(just === 1 ? x - w / 2 : just === 2 ? x - w : x);
  for (let k = 0; k < s.length; k++) {
    const i = Math.max(0, chars.indexOf(s[k]));
    if (s[k] !== " ") {
      dc.setClip(cx - 2, y, adv[i] + 4, h);
      dc.drawBitmap2(cx - i * cw - 2, y, b, { tintColor: tint });
      dc.clearClip();
    }
    cx += adv[i];
  }
}

// a part turned around the dial centre: image b (pointing to 12), its top at radius pv
function turn(dc, b, deg, pv, tint) {
  const t = new AffineTransform();
  t.rotate((deg * Math.PI) / 180);
  t.translate(-b.getWidth() / 2, -pv);
  dc.drawBitmap2(C, C, b, { transform: t, filterMode: FILTER_MODE_BILINEAR, tintColor: tint });
}

export default {
  fps: 10,
  reveal() { return false; },

  // static layer: dial, backlit scale, fuel and temperature bars, TFT texts, telltales; the needle moves
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const bl = BACK[G.clamp(d.cfg.style, 1, 3) - 1];

    if (S) {
      dc.drawBitmap(0, 0, Bmp.load(IMG.cbase));
      // ---- the backlight
      dc.setBlendMode(BLEND_MODE_ADDITIVE);
      dc.drawBitmap2(0, 0, Bmp.load(IMG.clight), { tintColor: bl });
      dc.drawBitmap(IM.RED_X, IM.RED_Y, Bmp.load(IMG.cred));
      dc.setBlendMode(BLEND_MODE_DEFAULT);
      // ---- fuel = Body Battery, temperature = stress (10 LED segments each)
      const sg = Bmp.load(IMG.seg);
      for (let i = 0; i < 10; i++) {
        const fl = d.bb >= (i + 0.5) * 10;
        turn(dc, sg, 188 + i * 3.5, 196, fl ? (d.bb < 20 ? 0xffb020 : bl) : 0x1c1c1c);
        const tl = d.stress >= (i + 0.5) * 10;
        turn(dc, sg, 172 - i * 3.5, 196, tl ? G.mix(0x3ab4ff, 0xff3a2a, i / 9) : 0x1c1c1c);
      }
      // ---- the TFT: date, time, steps, pulse
      txt(dc, false, d.dowStr + " " + d.day + ". " + d.monStr, C, 130, 1, 0x9aa0a8);
      txt(dc, true, G.timeStr(d), C, 160, 1, -1);
      txt(dc, false, G.num(d.steps) + " SCHRITTE", C, 240, 1, 0xd8dce0);
      txt(dc, false, (d.hr > 0 ? d.hr : "--") + " BPM", C, 262, 1, bl);
      // ---- telltales: only the lit ones, centred
      const on = [d.batt <= 20, d.notif > 0, d.phone, d.stress >= 70, d.hr >= 120];
      let n = 0;
      for (let i = 0; i < 5; i++) if (on[i]) n++;
      let x = C - (n * IM.ICON_W) / 2;
      const ic = Bmp.load(IMG.icons);
      for (let i = 0; i < 5; i++) {
        if (!on[i]) continue;
        dc.setClip(x, 290, IM.ICON_W, IM.ICON_H);
        dc.drawBitmap2(x - i * IM.ICON_W, 290, ic, { tintColor: ICOL[i] });
        dc.clearClip();
        x += IM.ICON_W;
      }
    }

    if (!M) return;
    // ---- the needle: sweeps to the stop and back on every raise, then shows the pulse
    const hr = G.clamp(d.hr > 0 ? d.hr : 0, 0, 200);
    let v = hr;
    if (a.live && a.intro < 1) {
      const p = a.intro;
      v = p < 0.45 ? 200 * G.easeInOut(p / 0.45) : G.lerp(200, hr, G.easeInOut((p - 0.45) / 0.55));
    }
    const deg = -135 + (v / 200) * 270;
    dc.setBlendMode(BLEND_MODE_ADDITIVE);
    turn(dc, Bmp.load(IMG.nglow), deg, IM.NEEDLE_PV, d.accent);
    dc.setBlendMode(BLEND_MODE_DEFAULT);
    turn(dc, Bmp.load(IMG.needle), deg, IM.NEEDLE_PV, G.mix(d.accent, 0xffffff, 0.25));
  },

  aod(dc, d) {
    const o = St.shift(d);
    txt(dc, true, G.timeStr(d), C + o[0], 160 + o[1], 1, 0x4a4a4a);
  },
};
