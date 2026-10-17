import Toybox.Application;
import Toybox.Graphics;
import Toybox.Lang;

// Animation state handed to faces. Mirrors the `a` object of the web engine.
class A {
    var t = 0;          // ms since the watch woke up (wrist raise / face shown)
    var intro = 1.0;    // 0..1 linear progress of the intro animation (INTRO_MS)
    var live = false;   // true while in high-power mode and animations are on
    var ms = 0;         // ms since the clock second last changed (0..999), for sweeping hands

    function initialize() {
    }
}

// Base class of every watch face design. Mirrors the face objects in web/js/faces.
class Face {
    function initialize() {
    }

    // Full-colour, animated rendering while the watch is awake.
    function draw(dc as Dc, d as D, a as A) as Void {
    }

    // Always-on (AMOLED low power): keep < 10 % of pixels lit, no animation.
    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        dc.setColor(G.dim(d.accent, 0.55), -1);
        F.st(dc, G.timeStr(d), 227 + o[0], 227 + o[1], 64, 3, 1, 1.0, 0);
    }

    // Ambient animation frame rate while awake (0 = only the intro animates).
    function fps() as Number {
        return 0;
    }

    // Screen tap (API 5.1+). Return true to redraw.
    function tap(x as Number, y as Number, d as D) as Boolean {
        return false;
    }
}

// St — tiny persistence + misc helpers for faces.
module St {
    function get(k as String, def) {
        try {
            var v = Application.Storage.getValue(k);
            return v == null ? def : v;
        } catch (e) {
            return def;
        }
    }

    function set(k as String, v) as Void {
        try {
            Application.Storage.setValue(k, v as Application.PropertyValueType);
        } catch (e) {
        }
    }

    // Burn-in protection: shift the AOD layout a few pixels each minute.
    function shift(d as D) as Array<Number> {
        var k = d.m % 9;
        return [(k % 3 - 1) * 4, (k / 3 - 1) * 4];
    }
}
