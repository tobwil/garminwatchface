import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// G — shared drawing & math helpers. Mirrors web/js/engine/gfx.js 1:1.
// Clock angles: 0 = 12 o'clock, clockwise, in degrees.
module G {
    const RAD = 0.017453292519943295;

    function clamp(v, lo, hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function ease(t) {
        t = clamp(t, 0.0, 1.0);
        var u = 1.0 - t;
        return 1.0 - u * u * u;
    }

    function easeInOut(t) {
        t = clamp(t, 0.0, 1.0);
        if (t < 0.5) {
            return 4.0 * t * t * t;
        }
        var v = -2.0 * t + 2.0;
        return 1.0 - v * v * v / 2.0;
    }

    function spring(t) {
        t = clamp(t, 0.0, 1.0);
        var c1 = 1.70158;
        var c3 = c1 + 1.0;
        var u = t - 1.0;
        return 1.0 + c3 * u * u * u + c1 * u * u;
    }

    function stag(p, i, step, dur) {
        return clamp((p - i * step) / dur, 0.0, 1.0);
    }

    function ptX(cx, r, deg) {
        return cx + r * Math.sin(deg * RAD);
    }

    function ptY(cy, r, deg) {
        return cy - r * Math.cos(deg * RAD);
    }

    function arcC(dc as Dc, cx, cy, r, a0, a1) as Void {
        if (a1 - a0 >= 359.9) {
            dc.drawCircle(cx, cy, r);
            return;
        }
        if (a1 - a0 < 0.4) {
            return;
        }
        dc.drawArc(cx, cy, r, Graphics.ARC_CLOCKWISE, 90 - a0, 90 - a1);
    }

    function ring(dc as Dc, cx, cy, r, w, frac, col, track) as Void {
        frac = clamp(frac, 0.0, 1.0);
        dc.setPenWidth(w);
        if (track != -1) {
            dc.setColor(track, -1);
            dc.drawCircle(cx, cy, r);
        }
        if (frac <= 0.001) {
            return;
        }
        dc.setColor(col, -1);
        arcC(dc, cx, cy, r, 0, frac * 360.0);
        if (frac < 0.999) {
            dc.fillCircle(cx, cy - r, w / 2.0);
            dc.fillCircle(ptX(cx, r, frac * 360.0), ptY(cy, r, frac * 360.0), w / 2.0);
        }
    }

    function capArc(dc as Dc, cx, cy, r, w, a0, a1) as Void {
        if (a1 - a0 < 0.4) {
            return;
        }
        dc.setPenWidth(w);
        arcC(dc, cx, cy, r, a0, a1);
        dc.fillCircle(ptX(cx, r, a0), ptY(cy, r, a0), w / 2.0);
        dc.fillCircle(ptX(cx, r, a1), ptY(cy, r, a1), w / 2.0);
    }

    function tick(dc as Dc, cx, cy, r1, r2, deg) as Void {
        dc.drawLine(ptX(cx, r1, deg), ptY(cy, r1, deg), ptX(cx, r2, deg), ptY(cy, r2, deg));
    }

    function hand(dc as Dc, cx, cy, deg, len, back, w, tw) as Void {
        var s = Math.sin(deg * RAD);
        var c = Math.cos(deg * RAD);
        var tx = cx + s * len;
        var ty = cy - c * len;
        var bx = cx - s * back;
        var by = cy + c * back;
        dc.fillPolygon([
            [bx - c * w / 2.0, by - s * w / 2.0],
            [tx - c * tw / 2.0, ty - s * tw / 2.0],
            [tx + c * tw / 2.0, ty + s * tw / 2.0],
            [bx + c * w / 2.0, by + s * w / 2.0]
        ]);
    }

    // ---- colour
    function rgb(r, g, b) as Number {
        return ((clamp(r.toNumber(), 0, 255) << 16) | (clamp(g.toNumber(), 0, 255) << 8) | clamp(b.toNumber(), 0, 255));
    }

    function mix(c1, c2, t) as Number {
        t = clamp(t, 0.0, 1.0);
        var r = ((c1 >> 16) & 255) + ((((c2 >> 16) & 255) - ((c1 >> 16) & 255)) * t);
        var g = ((c1 >> 8) & 255) + ((((c2 >> 8) & 255) - ((c1 >> 8) & 255)) * t);
        var b = (c1 & 255) + (((c2 & 255) - (c1 & 255)) * t);
        return rgb(r, g, b);
    }

    function dim(c, f) as Number {
        return mix(0, c, f);
    }

    function argb(a, c) as Number {
        return (clamp(a.toNumber(), 0, 254) << 24) | (c & 0xFFFFFF);
    }

    function hsv(h, s, v) as Number {
        h = h.toFloat();
        while (h < 0) { h += 360.0; }
        while (h >= 360.0) { h -= 360.0; }
        var c = v * s;
        var hh = h / 60.0;
        var m2 = hh - 2.0 * Math.floor(hh / 2.0);
        var x = c * (1.0 - (m2 - 1.0).abs());
        var m = v - c;
        var r = 0.0;
        var g = 0.0;
        var b = 0.0;
        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }
        return rgb((r + m) * 255, (g + m) * 255, (b + m) * 255);
    }

    // ---- deterministic randomness (Park-Miller)
    function rnd(seed) as Number {
        var s = (seed.toLong() % 2147483647l).abs();
        if (s == 0) { s = 1l; }
        return ((s * 16807l) % 2147483647l).toNumber();
    }

    function rf(seed) as Float {
        return seed.toFloat() / 2147483647.0;
    }

    function noise(x) as Float {
        return ((Math.sin(x * 1.7) + Math.sin(x * 3.1 + 1.3) * 0.5 + Math.sin(x * 5.3 + 4.1) * 0.25) / 1.75).toFloat();
    }

    // ---- formatting
    function pad2(n) as String {
        n = n.toNumber();
        return n < 10 ? "0" + n : "" + n;
    }

    function num(n) as String {
        n = Math.round(n).toNumber();
        var neg = n < 0;
        if (neg) { n = -n; }
        var s = n.toString();
        var out = "";
        while (s.length() > 3) {
            out = "." + s.substring(s.length() - 3, s.length()) + out;
            s = s.substring(0, s.length() - 3);
        }
        return (neg ? "-" : "") + s + out;
    }

    function hm(min) as String {
        min = Math.round(min).toNumber();
        if (min < 0) { min = 0; }
        return (min / 60) + ":" + pad2(min % 60);
    }

    function race(sec) as String {
        sec = Math.round(sec).toNumber();
        var h = sec / 3600;
        var m = (sec % 3600) / 60;
        var s = sec % 60;
        return h > 0 ? h + ":" + pad2(m) + ":" + pad2(s) : m + ":" + pad2(s);
    }

    function hour(d) as Number {
        if (d.is24) { return d.h; }
        return d.h % 12 == 0 ? 12 : d.h % 12;
    }

    function timeStr(d) as String {
        return (d.is24 ? pad2(d.h) : "" + hour(d)) + ":" + pad2(d.m);
    }

    // Round a float to n decimals as string (n = 0 or 1)
    function fix1(v) as String {
        return v.format("%.1f");
    }
}
