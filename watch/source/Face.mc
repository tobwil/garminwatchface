import Toybox.Application;
import Toybox.Graphics;
import Toybox.Lang;

// Animation state handed to faces. Mirrors the `a` object of the web engine.
class A {
    var t = 0;          // ms since the watch woke up (wrist raise / face shown)
    var intro = 1.0;    // 0..1 linear progress of the intro animation (INTRO_MS)
    var live = false;   // true while in high-power mode and animations are on
    var ms = 0;         // ms since the clock second last changed (0..999), for sweeping hands
    var tap = 999999;   // ms since the last screen tap the face accepted (999999 = none yet)
    var bg = false;     // true when the engine already drew the cached static layer (see Face.bgKey)
    var so = false;     // true while the engine renders the static layer only (Face.bg -> draw)

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

    // Antialiasing for this design. Pixel designs turn it off: crisper edges and much cheaper.
    function aa() as Boolean {
        return true;
    }

    // Static layer cache. A design that returns a key >= 0 draws its static layer (sky,
    // landscape, room, time ...) in bg() in its final state; the engine renders it into a
    // bitmap whenever the key changes and blits it before draw() (a.bg = true) from the very
    // first frame: during the intro it reveals the layer itself, draw() only paints and
    // animates what moves. -1 = no cache, draw() paints everything every frame.
    function bgKey(d as D) as Number {
        return -1;
    }

    // false when the design reveals itself during the intro (e.g. its own wipe), so the engine
    // shows the cached layer at once instead of opening its CRT band
    function reveal() as Boolean {
        return true;
    }

    // Default static layer: draw() with a.so = true. Designs wrap their static blocks in
    // `if (!a.bg)` and their moving blocks in `if (!a.so)`.
    function bg(dc as Dc, d as D) as Void {
        var s = new A();
        s.so = true;
        draw(dc, d, s);
    }

    // Key helper: the static layer changes once a minute (all data refresh once a minute).
    function minuteKey(d as D) as Number {
        return d.doy * 1440 + d.mins;
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
