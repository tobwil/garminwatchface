import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.WatchUi;

// MANU — "Manufaktur": a photo-real luxury automatic for the AMOLED screen, built from pre-rendered
// images (tools/render/manu.py): a brushed sunburst dial with a bow-tie reflection, faceted applied
// indices with lume, snailed sub-dials, dauphine hands with soft shadows on the dial. The watch turns
// the images with bilinear filtering; the seconds hand beats 8 times a second like a 28,800 vph
// movement. Power reserve = the watch battery, left sub-dial = Body Battery, right = steps towards the
// goal, the date wheel in the window at 6. After sunset the lume glows (drawn additively); on every
// wrist raise a reflex glides over the crystal.
// Styles: 1 Mitternacht, 2 Fumé, 3 Racing. Mirrors web/js/faces/manu.js.
class FaceManu extends Face {
    const C = 227;
    const LUME = 0x7AFFB0;

    hidden var _sw0 = 0; // the clock's ms at the raise, for the sweeping seconds hand
    hidden var _swT = -1;
    hidden var _nt = false; // after sunset (set with every static redraw)
    // images needed in every frame stay loaded; the others are loaded per static redraw
    hidden var _sec = null;
    hidden var _secS = null;
    hidden var _cap = null;
    hidden var _glow = null;

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

    // draw image b turned by deg around its pivot (w / 2, pv), pivot placed at (x, y)
    hidden function turn(dc as Dc, b as BitmapResource, x as Number, y as Number, pv as Number, deg, tint as Number) as Void {
        var t = new Graphics.AffineTransform();
        t.rotate((deg * Math.PI / 180.0).toFloat());
        t.translate(-b.getWidth() / 2.0, -pv.toFloat());
        if (tint == -1) {
            dc.drawBitmap2(x, y, b, {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR});
        } else {
            dc.drawBitmap2(x, y, b, {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR, :tintColor => tint});
        }
    }

    // a hand with its soft shadow (offset away from the light, the higher the hand the further)
    hidden function hand(dc as Dc, b as BitmapResource, s as BitmapResource, x as Number, y as Number, pv as Number, deg, sh as Number, tint as Number) as Void {
        turn(dc, s, x + sh, y + Math.round(sh * 1.6).toNumber(), pv, deg, -1);
        turn(dc, b, x, y, pv, deg, tint);
    }

    hidden function tinted(dc as Dc, x as Number, y as Number, b as BitmapResource, tint as Number) as Void {
        if (tint == -1) {
            dc.drawBitmap(x, y, b);
        } else {
            dc.drawBitmap2(x, y, b, {:tintColor => tint});
        }
    }

    // static layer: dial, date, sub-dial hands, power reserve, hour and minute hands, at night the lume;
    // the seconds hand and the crystal reflex move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var st = G.clamp(d.cfg.style, 1, 3);
        if (_cap == null) {
            _sec = img(Rez.Drawables.second);
            _secS = img(Rez.Drawables.second_s);
            _cap = img(Rez.Drawables.cap);
            _glow = img(Rez.Drawables.glow);
        }

        if (S) {
            _nt = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz) < -4;
            var night = _nt;
            // ---- the dial (darker at night, as in a dim room)
            var dl = img([Rez.Drawables.dial1, Rez.Drawables.dial2, Rez.Drawables.dial3][st - 1]);
            tinted(dc, 0, 0, dl, night ? 0x5C5C5C : -1);
            dl = null;
            // ---- the date wheel
            dc.setClip(209, 310, 36, 24);
            dc.drawBitmap(209, 310 - (d.day - 1) * 24, img(Rez.Drawables.date));
            dc.clearClip();
            // ---- Body Battery, steps, power reserve (= watch battery)
            var g = d.stepGoal > 0 ? d.stepGoal : 10000;
            var dim = night ? 0x5C5C5C : -1;
            var sb = img(Rez.Drawables.sub);
            var ss = img(Rez.Drawables.sub_s);
            hand(dc, sb, ss, 135, 227, 46, -150 + (d.bb >= 0 ? d.bb : 0) * 3, 2, dim);
            hand(dc, sb, ss, 319, 227, 46, -150 + G.clamp(d.steps * 100.0 / g, 0, 100) * 3, 2, dim);
            hand(dc, img(Rez.Drawables.res), img(Rez.Drawables.res_s), 227, 146, 40, -60 + G.clamp(d.batt, 0, 100) * 1.2, 2, dim);
            // ---- hour and minute hands
            var hd = ((d.h % 12) + d.m / 60.0) * 30;
            var md = (d.m + d.s / 60.0) * 6;
            hand(dc, img(Rez.Drawables.hour), img(Rez.Drawables.hour_s), C, C, 124, hd, 3, dim);
            hand(dc, img(Rez.Drawables.minute), img(Rez.Drawables.minute_s), C, C, 198, md, 4, dim);
            // ---- the lume glows after sunset
            if (night) {
                dc.setBlendMode(Graphics.BLEND_MODE_ADDITIVE);
                for (var h = 0; h < 12; h++) {
                    var n = h == 0 ? 2 : 1;
                    for (var k = 0; k < n; k++) {
                        var t = new Graphics.AffineTransform();
                        t.rotate((h * 30 * Math.PI / 180.0).toFloat());
                        t.translate(n == 2 ? (k == 0 ? -5.5 : 5.5) : 0.0, -184.0);
                        t.scale(0.45, 1.0);
                        t.translate(-20.0, -20.0);
                        dc.drawBitmap2(C, C, _glow, {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR, :tintColor => LUME});
                    }
                }
                turn(dc, img(Rez.Drawables.hour_l), C, C, 124, hd, LUME);
                turn(dc, img(Rez.Drawables.minute_l), C, C, 198, md, LUME);
                dc.setBlendMode(Graphics.BLEND_MODE_DEFAULT);
            }
            tinted(dc, C - 11, C - 11, _cap, dim);
        }

        if (!M) {
            return;
        }
        // ---- the seconds hand: 8 beats a second, continuous from the moment of the raise
        var e = (((_sw0 + a.t) / 1000) % 60 - d.s).abs();
        if (_swT < 0 || a.t < _swT || (e > 1 && e < 59)) {
            _sw0 = d.s * 1000 - a.t;
        }
        _swT = a.t;
        var sd = (((_sw0 + a.t) / 125) % 480) * 0.75;
        hand(dc, _sec, _secS, C, C, 210, sd, 5, _nt ? G.dim(d.accent, 0.45) : d.accent);
        tinted(dc, C - 11, C - 11, _cap, _nt ? 0x5C5C5C : -1);
        // ---- a reflex glides over the crystal on every raise
        if (a.live && a.intro < 1) {
            var p = G.ease(a.intro);
            var t = new Graphics.AffineTransform();
            t.rotate((-35 * Math.PI / 180.0).toFloat());
            t.scale(9.0, 0.9);
            t.translate(-20.0, -20.0);
            dc.setBlendMode(Graphics.BLEND_MODE_ADDITIVE);
            dc.drawBitmap2(Math.round(G.lerp(-60, 520, p)).toNumber(), Math.round(G.lerp(-40, 420, p)).toNumber(), _glow,
                {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR, :tintColor => 0x2A2A2A});
            dc.setBlendMode(Graphics.BLEND_MODE_DEFAULT);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        // only the lume, very dim, shifted against burn-in
        var o = St.shift(d);
        var dim = G.dim(LUME, 0.35);
        if (_glow == null) {
            _glow = img(Rez.Drawables.glow);
        }
        dc.setBlendMode(Graphics.BLEND_MODE_ADDITIVE);
        for (var h = 0; h < 12; h++) {
            var t = new Graphics.AffineTransform();
            t.rotate((h * 30 * Math.PI / 180.0).toFloat());
            t.translate(0.0, -184.0);
            t.scale(0.35, 0.8);
            t.translate(-20.0, -20.0);
            dc.drawBitmap2(C + o[0], C + o[1], _glow, {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR, :tintColor => dim});
        }
        turn(dc, img(Rez.Drawables.hour_l), C + o[0], C + o[1], 124, ((d.h % 12) + d.m / 60.0) * 30, dim);
        turn(dc, img(Rez.Drawables.minute_l), C + o[0], C + o[1], 198, d.m * 6, dim);
        dc.setBlendMode(Graphics.BLEND_MODE_DEFAULT);
    }
}
