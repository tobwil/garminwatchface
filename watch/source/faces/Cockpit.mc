import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.WatchUi;

// COCKPIT — "Cockpit": a backlit sports-car instrument cluster from pre-rendered images
// (tools/render/cockpit.py). The rev counter is your heart rate (x10 BPM, redline from 170), the fuel
// bar is the Body Battery, the temperature bar the stress. The TFT in the middle shows the time, the
// date, the steps and the pulse; telltales light up like in a car: battery (watch battery low),
// message (notifications), Bluetooth (phone connected), engine check (high stress), heart (pulse
// above 120). On every wrist raise the needle sweeps to the stop and back, like at ignition.
// Styles: 1 Rot, 2 Eisblau, 3 Amber (the backlight). Mirrors web/js/faces/cockpit.js.
class FaceCockpit extends Face {
    const C = 227;
    const BACK = [0xFF3A24, 0x6AD0FF, 0xFFA82A];
    const ICOL = [0xFF3A2A, 0xFFB020, 0x3A8AFF, 0xFFB020, 0xFF3A5A];

    // the needle images are needed in every frame
    hidden var _nd = null;
    hidden var _ng = null;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    function reveal() as Boolean {
        return false;
    }

    hidden function img(id) as BitmapResource {
        return WatchUi.loadResource(id) as BitmapResource;
    }

    // text from a glyph strip, one clipped glyph at a time; just 0 left, 1 centre, 2 right
    hidden function txt(dc as Dc, big as Boolean, s as String, x as Number, y as Number, just as Number, tint as Number) as Void {
        var chars = big ? ImgCockpit.BIG : ImgCockpit.SMALL;
        var adv = big ? ImgCockpit.BIG_ADV : ImgCockpit.SMALL_ADV;
        var cw = big ? ImgCockpit.BIG_CW : ImgCockpit.SMALL_CW;
        var h = big ? ImgCockpit.BIG_H : ImgCockpit.SMALL_H;
        var b = img(big ? Rez.Drawables.big : Rez.Drawables.small);
        var cs = s.toCharArray();
        var ix = new [cs.size()];
        var w = 0;
        for (var k = 0; k < cs.size(); k++) {
            var i = chars.find(cs[k].toString());
            ix[k] = i == null ? 0 : i;
            w += adv[ix[k]];
        }
        var cx = just == 1 ? x - w / 2 : just == 2 ? x - w : x;
        for (var k = 0; k < cs.size(); k++) {
            var i = ix[k] as Number;
            if (cs[k] != ' ') {
                dc.setClip(cx - 2, y, adv[i] + 4, h);
                if (tint == -1) {
                    dc.drawBitmap(cx - i * cw - 2, y, b);
                } else {
                    dc.drawBitmap2(cx - i * cw - 2, y, b, {:tintColor => tint});
                }
                dc.clearClip();
            }
            cx += adv[i];
        }
    }

    // a part turned around the dial centre: image b (pointing to 12), its top at radius pv
    hidden function turn(dc as Dc, b as BitmapResource, deg, pv as Number, tint as Number) as Void {
        var t = new Graphics.AffineTransform();
        t.rotate((deg * Math.PI / 180.0).toFloat());
        t.translate(-b.getWidth() / 2.0, -pv.toFloat());
        dc.drawBitmap2(C, C, b, {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR, :tintColor => tint});
    }

    // static layer: dial, backlit scale, fuel and temperature bars, TFT texts, telltales; the needle moves
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var bl = BACK[G.clamp(d.cfg.style, 1, 3) - 1];
        if (_nd == null) {
            _nd = img(Rez.Drawables.needle);
            _ng = img(Rez.Drawables.nglow);
        }

        if (S) {
            dc.drawBitmap(0, 0, img(Rez.Drawables.cbase));
            // ---- the backlight
            dc.setBlendMode(Graphics.BLEND_MODE_ADDITIVE);
            dc.drawBitmap2(0, 0, img(Rez.Drawables.clight), {:tintColor => bl});
            dc.drawBitmap(ImgCockpit.RED_X, ImgCockpit.RED_Y, img(Rez.Drawables.cred));
            dc.setBlendMode(Graphics.BLEND_MODE_DEFAULT);
            // ---- fuel = Body Battery, temperature = stress (10 LED segments each)
            var sg = img(Rez.Drawables.seg);
            for (var i = 0; i < 10; i++) {
                var fl = d.bb >= (i + 0.5) * 10;
                turn(dc, sg, 188 + i * 3.5, 196, fl ? (d.bb < 20 ? 0xFFB020 : bl) : 0x1C1C1C);
                var tl = d.stress >= (i + 0.5) * 10;
                turn(dc, sg, 172 - i * 3.5, 196, tl ? G.mix(0x3AB4FF, 0xFF3A2A, i / 9.0) : 0x1C1C1C);
            }
            // ---- the TFT: date, time, steps, pulse
            txt(dc, false, d.dowStr + " " + d.day + ". " + d.monStr, C, 130, 1, 0x9AA0A8);
            txt(dc, true, G.timeStr(d), C, 160, 1, -1);
            txt(dc, false, G.num(d.steps) + " SCHRITTE", C, 240, 1, 0xD8DCE0);
            txt(dc, false, (d.hr > 0 ? d.hr.toString() : "--") + " BPM", C, 262, 1, bl);
            // ---- telltales: only the lit ones, centred
            var on = [d.batt <= 20, d.notif > 0, d.phone, d.stress >= 70, d.hr >= 120];
            var n = 0;
            for (var i = 0; i < 5; i++) {
                if (on[i]) {
                    n++;
                }
            }
            var x = C - (n * ImgCockpit.ICON_W) / 2;
            var ic = img(Rez.Drawables.icons);
            for (var i = 0; i < 5; i++) {
                if (!on[i]) {
                    continue;
                }
                dc.setClip(x, 290, ImgCockpit.ICON_W, ImgCockpit.ICON_H);
                dc.drawBitmap2(x - i * ImgCockpit.ICON_W, 290, ic, {:tintColor => ICOL[i]});
                dc.clearClip();
                x += ImgCockpit.ICON_W;
            }
        }

        if (!M) {
            return;
        }
        // ---- the needle: sweeps to the stop and back on every raise, then shows the pulse
        var hr = G.clamp(d.hr > 0 ? d.hr : 0, 0, 200);
        var v = hr;
        if (a.live && a.intro < 1) {
            var p = a.intro;
            v = p < 0.45 ? 200 * G.easeInOut(p / 0.45) : G.lerp(200, hr, G.easeInOut((p - 0.45) / 0.55));
        }
        var deg = -135 + (v / 200.0) * 270;
        dc.setBlendMode(Graphics.BLEND_MODE_ADDITIVE);
        turn(dc, _ng, deg, ImgCockpit.NEEDLE_PV, d.accent);
        dc.setBlendMode(Graphics.BLEND_MODE_DEFAULT);
        turn(dc, _nd, deg, ImgCockpit.NEEDLE_PV, G.mix(d.accent, 0xFFFFFF, 0.25));
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        txt(dc, true, G.timeStr(d), C + o[0], 160 + o[1], 1, 0x4A4A4A);
    }
}
