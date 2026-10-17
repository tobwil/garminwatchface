import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// KANALOG — "Kiesel Analog": the Pebble Time's Simple Analog. Twelve bold bars, minute dots, plain
// tapered hands, a red seconds hand while the watch is awake, weekday and date in a little box, the
// steps under the twelve and the crossed-out Bluetooth icon when the phone is out of reach. Drawn
// without anti-aliasing like the original. On every wrist raise the hands sweep in from twelve.
// Styles: 1 Weiß, 2 Schwarz, 3 Farbe (Pebble Time palette). Mirrors web/js/faces/kanalog.js.
class FaceKanalog extends Face {
    const CX = 227;
    const CY = 227;
    const DOW = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 1;
    }

    function aa() as Boolean {
        return false;
    }

    function reveal() as Boolean {
        return false;
    }

    hidden function q(v as Number) as Number {
        return Math.round(v / 85.0).toNumber() * 85;
    }

    // [background, ink, dim, seconds]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x000000, 0xFFFFFF, 0x555555, 0xFF0055] as Array<Number>;
        }
        if (st == 3) {
            var r = q((acc >> 16) & 255);
            var g = q((acc >> 8) & 255);
            var b = q(acc & 255);
            var ink = r * 0.3 + g * 0.59 + b * 0.11 > 140 ? 0x000000 : 0xFFFFFF;
            return [(r << 16) | (g << 8) | b, ink, ink, ink] as Array<Number>;
        }
        return [0xFFFFFF, 0x000000, 0xAAAAAA, 0xFF0055] as Array<Number>;
    }

    // tapered hand: width w at the centre, length len, tail back
    hidden function hand(dc as Dc, deg, len as Number, back as Number, w as Number) as Void {
        var rd = deg * Math.PI / 180;
        var s = Math.sin(rd);
        var c = Math.cos(rd);
        var px = c * w / 2;
        var py = s * w / 2;
        dc.fillPolygon([
            [CX - s * back - px, CY + c * back - py], [CX - s * back + px, CY + c * back + py],
            [CX + s * len + px * 0.4, CY - c * len + py * 0.4], [CX + s * len - px * 0.4, CY - c * len - py * 0.4]
        ]);
    }

    // static layer: dial, date, steps, Bluetooth; the hands move (they sweep in on the raise)
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var P = pal(d.cfg.style, d.accent);
        var p = a.intro;
        var live = a.live;

        if (S) {
            dc.setColor(P[0], -1);
            dc.fillRectangle(0, 0, 454, 454);
            dc.setColor(P[1], -1);
            for (var i = 0; i < 60; i++) {
                var rd = i * 6 * Math.PI / 180;
                var s = Math.sin(rd);
                var c = Math.cos(rd);
                if (i % 5 == 0) {
                    var w = 5;
                    dc.fillPolygon([[CX + s * 172 - c * w, CY - c * 172 - s * w], [CX + s * 172 + c * w, CY - c * 172 + s * w],
                        [CX + s * 208 + c * w, CY - c * 208 + s * w], [CX + s * 208 - c * w, CY - c * 208 - s * w]]);
                } else {
                    dc.fillRectangle(Math.round(CX + s * 202).toNumber() - 2, Math.round(CY - c * 202).toNumber() - 2, 4, 4);
                }
            }
            // weekday and date box
            F.px(dc, DOW[d.dow], 206, 308, 2, 2, 0);
            dc.drawRectangle(214, 300, 44, 30);
            dc.drawRectangle(215, 301, 42, 28);
            F.px(dc, "" + d.day, 236, 308, 2, 1, 0);
            // steps under the twelve, Bluetooth when the phone is gone
            dc.setColor(P[2], -1);
            Spr.draw(dc, SprKiesel.SHOE, 182, 132, 2, [-1, P[2]], false);
            F.px(dc, G.num(d.steps > 0 ? d.steps : 0), 206, 130, 2, 0, 0);
            if (!d.phone) {
                dc.setColor(P[1], -1);
                Spr.draw(dc, SprKiesel.BT, 220, 96, 2, [-1, P[1]], false);
                for (var i = 0; i < 7; i++) {
                    dc.fillRectangle(216 + i * 3, 94 + i * 3, 3, 3);
                }
            }
        }

        if (!M) {
            return;
        }
        // ---- hands sweep in from twelve on every raise
        var e = G.easeInOut(G.clamp(p / 0.8, 0, 1));
        var hd = ((G.hour(d) % 12) + d.m / 60.0) * 30 * e;
        var md = d.m * 6 * e;
        dc.setColor(P[1], -1);
        hand(dc, hd, 112, 18, 16);
        hand(dc, md, 178, 22, 11);
        if (live) {
            var sd = d.s * 6 * (p < 1 ? e : 1.0) * Math.PI / 180;
            var s = Math.sin(sd);
            var c = Math.cos(sd);
            dc.setColor(P[3], -1);
            dc.setPenWidth(3);
            dc.drawLine(CX - s * 34, CY + c * 34, CX + s * 196, CY - c * 196);
        }
        dc.setColor(P[1], -1);
        dc.fillCircle(CX, CY, 9);
        dc.setColor(live ? P[3] : P[0], -1);
        dc.fillCircle(CX, CY, 4);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        dc.setColor(0x6A6A6A, -1);
        for (var h = 0; h < 12; h++) {
            var rd = h * 30 * Math.PI / 180;
            dc.fillRectangle(Math.round(CX + Math.sin(rd) * 196).toNumber() - 2 + o[0], Math.round(CY - Math.cos(rd) * 196).toNumber() - 2 + o[1], 4, 4);
        }
        dc.setColor(0x9A9A9A, -1);
        dc.setPenWidth(4);
        var hd = ((G.hour(d) % 12) + d.m / 60.0) * 30 * Math.PI / 180;
        var md = d.m * 6 * Math.PI / 180;
        dc.drawLine(CX + o[0], CY + o[1], CX + Math.sin(hd) * 110 + o[0], CY - Math.cos(hd) * 110 + o[1]);
        dc.setPenWidth(3);
        dc.drawLine(CX + o[0], CY + o[1], CX + Math.sin(md) * 176 + o[0], CY - Math.cos(md) * 176 + o[1]);
    }
}
