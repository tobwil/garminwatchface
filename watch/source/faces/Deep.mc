import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.WatchUi;

// DEEP — "Tiefer Raum": a space-telescope view on the AMOLED screen from pre-rendered images
// (tools/render/deep.py): nebulae with glowing filaments and dark dust lanes, thousands of stars in
// their colour temperatures, bright stars with six-pointed diffraction spikes. The nebula glows as
// bright as your Body Battery; bright stars twinkle, and on every wrist raise a shooting star crosses
// the sky. Thin, glowing time; date, Body Battery and steps below.
// Styles: 1 Hubble, 2 Webb, 3 Orion. Mirrors web/js/faces/deep.js.
class FaceDeep extends Face {
    const C = 227;

    // needed in every frame
    hidden var _star = null;
    hidden var _streak = null;

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

    hidden function grey(v as Number) as Number {
        return (v << 16) | (v << 8) | v;
    }

    // text from a glyph strip, one clipped glyph at a time, centred on x
    hidden function txt(dc as Dc, big as Boolean, s as String, x as Number, y as Number, tint as Number) as Void {
        var chars = big ? ImgDeep.BIG : ImgDeep.SMALL;
        var adv = big ? ImgDeep.BIG_ADV : ImgDeep.SMALL_ADV;
        var cw = big ? ImgDeep.BIG_CW : ImgDeep.SMALL_CW;
        var h = big ? ImgDeep.BIG_H : ImgDeep.SMALL_H;
        var b = img(big ? Rez.Drawables.big : Rez.Drawables.small);
        var cs = s.toCharArray();
        var ix = new [cs.size()];
        var w = 0;
        for (var k = 0; k < cs.size(); k++) {
            var i = chars.find(cs[k].toString());
            ix[k] = i == null ? 0 : i;
            w += adv[ix[k]];
        }
        var cx = x - w / 2;
        for (var k = 0; k < cs.size(); k++) {
            var i = ix[k] as Number;
            if (cs[k] != ' ') {
                dc.setClip(cx - 4, y, adv[i] + 8, h);
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

    // static layer: the sky and the texts; twinkling stars and the shooting star move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var st = G.clamp(d.cfg.style, 1, 3);
        if (_star == null) {
            _star = img(Rez.Drawables.star);
            _streak = img(Rez.Drawables.streak);
        }

        if (S) {
            // ---- the nebula glows with the Body Battery
            var bb = d.bb >= 0 ? d.bb : 70;
            var sky = img([Rez.Drawables.sky1, Rez.Drawables.sky2, Rez.Drawables.sky3][st - 1]);
            dc.drawBitmap2(0, 0, sky, {:tintColor => grey(Math.round(255 * (0.45 + 0.55 * bb / 100.0)).toNumber())});
            sky = null;
            // ---- time, date, data
            txt(dc, false, d.dowStr + " " + d.day + ". " + d.monStr, C, 128, 0xC8CCD8);
            txt(dc, true, G.timeStr(d), C, 146, -1);
            txt(dc, false, bb + "% ENERGIE   " + G.num(d.steps) + " SCHRITTE", C, 252, 0xA8AEC0);
        }

        if (!M) {
            return;
        }
        // ---- bright stars twinkle
        dc.setBlendMode(Graphics.BLEND_MODE_ADDITIVE);
        for (var i = 0; i < 6; i++) {
            var k = 0.5 + 0.5 * Math.sin(a.t / 650.0 + i * 1.7);
            var t = new Graphics.AffineTransform();
            t.scale((0.55 + 0.35 * k).toFloat(), (0.55 + 0.35 * k).toFloat());
            t.translate(-24.0, -24.0);
            dc.drawBitmap2(ImgDeep.TW[i * 2], ImgDeep.TW[i * 2 + 1], _star,
                {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR, :tintColor => grey(Math.round(255 * (0.25 + 0.75 * k)).toNumber())});
        }
        // ---- a shooting star on every raise
        if (a.live && a.intro > 0.08 && a.intro < 0.85) {
            var p = (a.intro - 0.08) / 0.77;
            var t = new Graphics.AffineTransform();
            t.rotate((24 * Math.PI / 180.0).toFloat());
            t.translate(-120.0, -4.5);
            dc.drawBitmap2(Math.round(G.lerp(110, 400, p)).toNumber(), Math.round(G.lerp(60, 190, p)).toNumber(), _streak,
                {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR, :tintColor => grey(Math.round(255 * Math.sin(p * Math.PI)).toNumber())});
        }
        dc.setBlendMode(Graphics.BLEND_MODE_DEFAULT);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        txt(dc, true, G.timeStr(d), C + o[0], 146 + o[1], 0x3A3A3A);
    }
}
