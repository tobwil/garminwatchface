import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.WatchUi;

// TOURB — "Tourbillon": a skeletonised, hand-finished movement from pre-rendered images
// (tools/render/tourbillon.py): ruthenium plate with perlage, rhodium bridges with Côtes de Genève
// and polished bevels, rubies, blued screws, black openings (the AMOLED is really off there). The
// gilded wheels turn under the bridges, the tourbillon cage at 6 turns once a minute (the seconds),
// the balance swings inside it and comes to life on every wrist raise. Power reserve on the barrel
// bridge = the watch battery. Openworked hands.
// Styles: 1 Rhodium, 2 Gold (warm tint), 3 Schwarz (dark DLC look). Mirrors web/js/faces/tourb.js.
class FaceTourb extends Face {
    const C = 227;
    const TINT = [-1, 0xFFE0B0, 0x8A8E98];

    hidden var _sw0 = 0; // the clock's ms at the raise
    hidden var _swT = -1;
    // the moving parts are drawn in every frame: keep them loaded
    hidden var _b = null;

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

    // image b turned by deg around the point (px, py) of the image, placed at (x, y)
    hidden function turn(dc as Dc, b as BitmapResource, x as Number, y as Number, px, py, deg, tint as Number) as Void {
        var t = new Graphics.AffineTransform();
        t.rotate((deg * Math.PI / 180.0).toFloat());
        t.translate(-px.toFloat(), -py.toFloat());
        if (tint == -1) {
            dc.drawBitmap2(x, y, b, {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR});
        } else {
            dc.drawBitmap2(x, y, b, {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR, :tintColor => tint});
        }
    }

    // a centred part (wheel, cage, balance) turned around its middle
    hidden function spin(dc as Dc, b as BitmapResource, x as Number, y as Number, deg, tint as Number) as Void {
        turn(dc, b, x, y, b.getWidth() / 2.0, b.getHeight() / 2.0, deg, tint);
    }

    hidden function over(dc as Dc, x as Number, y as Number, b as BitmapResource, tint as Number) as Void {
        if (tint == -1) {
            dc.drawBitmap(x, y, b);
        } else {
            dc.drawBitmap2(x, y, b, {:tintColor => tint});
        }
    }

    hidden function hand(dc as Dc, b as BitmapResource, s as BitmapResource, pv as Number, deg, sh as Number, tint as Number) as Void {
        turn(dc, s, C + sh, C + Math.round(sh * 1.6).toNumber(), s.getWidth() / 2.0, pv, deg, -1);
        turn(dc, b, C, C, b.getWidth() / 2.0, pv, deg, tint);
    }

    // static layer: the movement with its bridges and the power reserve; wheels, tourbillon, balance and
    // the hands (above the wheels) move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var tint = TINT[G.clamp(d.cfg.style, 1, 3) - 1];
        if (_b == null) {
            _b = [img(Rez.Drawables.wheel1), img(Rez.Drawables.wheel1_s), img(Rez.Drawables.ov1),
                img(Rez.Drawables.wheel2), img(Rez.Drawables.wheel2_s), img(Rez.Drawables.ov2),
                img(Rez.Drawables.balance), img(Rez.Drawables.cage), img(Rez.Drawables.ovt),
                img(Rez.Drawables.hour), img(Rez.Drawables.hour_s), img(Rez.Drawables.minute), img(Rez.Drawables.minute_s)];
        }
        var B = _b as Array<BitmapResource>;

        if (S) {
            over(dc, 0, 0, img(Rez.Drawables.tplate), tint);
            // power reserve (watch battery) by the barrel
            var rs = img(Rez.Drawables.res);
            turn(dc, rs, ImgTourb.BARREL[0], ImgTourb.BARREL[1], rs.getWidth() / 2.0, ImgTourb.RES_PV, 40 + G.clamp(d.batt, 0, 100) * 0.9, -1);
        }

        if (!M) {
            return;
        }
        // ---- the clock's milliseconds, continuous from the raise
        var e = (((_sw0 + a.t) / 1000) % 60 - d.s).abs();
        if (_swT < 0 || a.t < _swT || (e > 1 && e < 59)) {
            _sw0 = d.s * 1000 - a.t;
        }
        _swT = a.t;
        var ms = _sw0 + a.t;
        // ---- the gear train under its bridges
        var w1 = (ms % 60000) / 60000.0 * 360;
        var w2 = -(ms % 12000) / 12000.0 * 360;
        spin(dc, B[1], ImgTourb.W1[0] + 2, ImgTourb.W1[1] + 3, w1, -1);
        spin(dc, B[0], ImgTourb.W1[0], ImgTourb.W1[1], w1, tint);
        over(dc, ImgTourb.OV1[0], ImgTourb.OV1[1], B[2], tint);
        spin(dc, B[4], ImgTourb.W2[0] + 2, ImgTourb.W2[1] + 3, w2, -1);
        spin(dc, B[3], ImgTourb.W2[0], ImgTourb.W2[1], w2, tint);
        over(dc, ImgTourb.OV2[0], ImgTourb.OV2[1], B[5], tint);
        // ---- the tourbillon: the balance swings (and starts on the raise), the cage turns once a minute
        var amp = 230 * (a.live ? G.ease(a.intro * 1.4 > 1 ? 1.0 : a.intro * 1.4) : 1.0);
        spin(dc, B[6], ImgTourb.TB[0], ImgTourb.TB[1], amp * Math.sin((ms % 400) / 400.0 * 2 * Math.PI), tint);
        spin(dc, B[7], ImgTourb.TB[0], ImgTourb.TB[1], (ms % 60000) / 60000.0 * 360, tint);
        over(dc, ImgTourb.OVT[0], ImgTourb.OVT[1], B[8], tint);
        // ---- hands
        hand(dc, B[9], B[10], ImgTourb.HOUR_PV, ((d.h % 12) + d.m / 60.0) * 30, 3, tint);
        hand(dc, B[11], B[12], ImgTourb.MINUTE_PV, (d.m + d.s / 60.0) * 6, 4, tint);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var h = img(Rez.Drawables.hour);
        var m = img(Rez.Drawables.minute);
        turn(dc, h, C + o[0], C + o[1], h.getWidth() / 2.0, ImgTourb.HOUR_PV, ((d.h % 12) + d.m / 60.0) * 30, 0x404040);
        turn(dc, m, C + o[0], C + o[1], m.getWidth() / 2.0, ImgTourb.MINUTE_PV, d.m * 6, 0x404040);
    }
}
