import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// NEON — "Neon": the time as glowing neon tubes on true black, made for AMOLED (every unlit pixel is
// off). Each tube is drawn in four passes from a wide dim halo to a white-hot core. On every wrist
// raise the tubes ignite letter by letter with the typical flicker; while awake one tube now and then
// stutters like a tired sign. Below a neon heart beats with your real heart rate, the steps glow as
// a small sign and the Body Battery is a row of tube segments.
// Styles: 1 Miami (pink / cyan), 2 Motel (red / amber), 3 Akzent. Mirrors web/js/faces/neon.js.
class FaceNeon extends Face {
    const TH = 96;
    const TY = 182;
    // passes: pen (in sevenths of the tube pen), darken (negative: lighten). The big time gets halo, tube
    // and hot core; the small signs only a halo and a thin core (pens under 3 need no round joints)
    const HW = [18, 7, 2];
    const HK = [0.82, 0.0, -0.65];
    const SW = [16, 5];
    const SK = [0.8, -0.3];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    function reveal() as Boolean {
        return false;
    }

    // [time tube, sign tube, heart tube, battery tube, battery off]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0xFF3A2A, 0xFFB02A, 0xFF3A2A, 0xFFB02A, 0x1A0C06] as Array<Number>;
        }
        if (st == 3) {
            return [acc, G.mix(acc, 0xFFFFFF, 0.35), acc, acc, G.mix(acc, 0, 0.88)] as Array<Number>;
        }
        return [0xFF2A8A, 0x2AF0FF, 0xFF2A8A, 0x2AF0FF, 0x061416] as Array<Number>;
    }

    hidden function shade(c as Number, k) as Number {
        return k >= 0 ? G.mix(c, 0x000000, k) : G.mix(c, 0xFFFFFF, -k);
    }

    // neon text: halo passes from wide and dark to a thin bright core
    hidden function tube(dc as Dc, txt as String, x, y, h, pen, c as Number) as Void {
        var big = pen >= 6;
        var n = big ? HW.size() : SW.size();
        for (var i = 0; i < n; i++) {
            dc.setColor(shade(c, big ? HK[i] : SK[i]), -1);
            var w = Math.round(pen * (big ? HW[i] : SW[i]) / 7.0).toNumber();
            F.st(dc, txt, x, y, h, w < 1 ? 1 : w, 1, 1.0, 0);
        }
    }

    // horizontal extent of every character of the time string: [x0, x1] pairs (stroke glyphs are
    // separated by a gap of 22/80 of the height)
    hidden function boxes(txt as String) as Array<Float> {
        var x0 = 227 - F.stW(txt, TH) / 2;
        var gap = 22.0 * TH / 80;
        var out = [] as Array<Float>;
        for (var i = 0; i < txt.length(); i++) {
            var x = x0 + (i > 0 ? F.stW(txt.substring(0, i), TH) + gap : 0);
            out.add(x.toFloat());
            out.add((x + F.stW(txt.substring(i, i + 1), TH)).toFloat());
        }
        return out;
    }

    // heart shape around (cx, cy), size s
    hidden function heart(dc as Dc, cx as Number, cy as Number, s as Number) as Void {
        var r = s * 0.3;
        dc.fillCircle(cx - r, cy - r * 0.6, r);
        dc.fillCircle(cx + r, cy - r * 0.6, r);
        dc.fillPolygon([[cx - 2 * r, cy - r * 0.3], [cx + 2 * r, cy - r * 0.3], [cx, cy + s * 0.62]]);
    }

    // static layer: all tubes lit; the ignition, the stutter and the heart beat are drawn over it
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var P = pal(d.cfg.style, d.accent);
        var p = a.intro;
        var live = a.live;
        var tt = live ? a.t : 0;
        var ts = G.timeStr(d);

        if (S) {
            dc.setColor(0x000000, -1);
            dc.fillRectangle(0, 0, 454, 454);
            // ---- date sign, the time, the steps sign
            tube(dc, d.dowStr + " " + d.day + " " + d.monStr, 227, 72, 26, 3, P[1]);
            // a full (uncached) frame at the very start of the ignition shows the time tubes dark anyway:
            // skip the costly halo passes there
            if (a.so || p >= 0.05) {
                tube(dc, ts, 227, TY, TH, 10, P[0]);
            }
            tube(dc, G.num(d.steps > 0 ? d.steps : 0) + " SCHRITTE", 227, 288, 24, 3, P[1]);
            tube(dc, d.hr > 0 ? "" + d.hr : "--", 256, 334, 30, 3, P[2]);
            // ---- Body Battery as tube segments
            var n = d.bb >= 0 ? Math.round(G.clamp(d.bb / 100.0, 0, 1) * 10).toNumber() : 0;
            for (var i = 0; i < 10; i++) {
                var x = 132 + i * 20;
                var on = i < n;
                if (on) {
                    dc.setColor(shade(P[3], 0.75), -1);
                    dc.fillRectangle(x - 3, 371, 18, 18);
                }
                dc.setColor(on ? P[3] : P[4], -1);
                dc.fillRectangle(x, 374, 12, 12);
                if (on) {
                    dc.setColor(shade(P[3], -0.6), -1);
                    dc.fillRectangle(x + 4, 378, 4, 4);
                }
            }
        }

        if (!M) {
            return;
        }
        // ---- ignition on the raise: each tube flickers on in turn; awake, one tube now and then stutters
        var B = boxes(ts);
        var fr = a.t / 60;
        var nl = ts.length();
        for (var i = 0; i < nl; i++) {
            var on0 = 0.17 + i * 0.13;
            var off = false;
            if (p < 1) {
                if (p < on0 - 0.12) {
                    off = true;
                } else if (p < on0) {
                    off = G.rnd(fr * 7 + i * 13) % 3 != 0;
                }
            } else if (live) {
                var k = tt / 90;
                off = G.rnd(k) % 41 == 0 && G.rnd(k + 5) % nl == i;
            }
            if (off) {
                // the dark tube covers its slice of the sign, up to half way to its neighbours
                var x0 = i == 0 ? B[0] - 30 : (B[i * 2 - 1] + B[i * 2]) / 2;
                var x1 = i == nl - 1 ? B[i * 2 + 1] + 30 : (B[i * 2 + 1] + B[i * 2 + 2]) / 2;
                dc.setColor(0x000000, -1);
                dc.fillRectangle(Math.floor(x0).toNumber(), TY - TH / 2 - 18, Math.ceil(x1 - x0).toNumber(), TH + 36);
            }
        }
        // ---- the heart beats with the heart rate
        var beat = d.hr > 0 ? 60000 / d.hr : 1000;
        var ph = live ? (tt % beat) / beat.toFloat() : 0.5;
        var s = 30 + (ph < 0.15 ? Math.round((1 - ph / 0.15) * 6).toNumber() : 0);
        var on = p >= 0.75;
        dc.setColor(on ? shade(P[2], 0.75) : 0x000000, -1);
        heart(dc, 196, 336, s + 10);
        dc.setColor(on ? P[2] : shade(P[2], 0.8), -1);
        heart(dc, 196, 336, s);
        dc.setColor(on ? shade(P[2], -0.6) : 0x000000, -1);
        heart(dc, 196, 336, Math.round(s * 0.4).toNumber());
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var P = pal(d.cfg.style, d.accent);
        dc.setColor(shade(P[0], 0.55), -1);
        F.st(dc, G.timeStr(d), 227 + o[0], TY + o[1], TH, 3, 1, 1.0, 0);
    }
}
