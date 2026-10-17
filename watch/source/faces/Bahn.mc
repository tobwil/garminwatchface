import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// BAHN — "Bahnhofsuhr": a railway station clock. 60 bar markers, plain bar hands
// and the red seconds hand with its round disc ("Kelle"). The seconds hand sweeps
// a full turn in 58.5 s, rests at 12 for ~1.5 s, then the minute hand jumps to
// the next minute with a tiny overshoot bounce.
// Styles: 1 Klassisch (white dial), 2 Nacht (black dial), 3 Kelle (black, accent markers, large).
// Mirrors web/js/faces/bahn.js.
class FaceBahn extends Face {
    const CX = 227;
    const CY = 227;
    const RAD = 0.017453292519943295;

    // sub-second phase lock: d.s only has whole seconds, a.t is ms since wake
    hidden var _lastS = -1;
    hidden var _lockT = -1;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 20;
    }

    // rectangle along clock angle deg from radius r1 to r2, width w (r1 < 0 = behind centre)
    hidden function bar(dc as Dc, x, y, deg, r1, r2, w) as Void {
        var s = Math.sin(deg * RAD);
        var c = Math.cos(deg * RAD);
        var hx = c * w / 2.0;
        var hy = s * w / 2.0;
        var x1 = x + s * r1;
        var y1 = y - c * r1;
        var x2 = x + s * r2;
        var y2 = y - c * r2;
        dc.fillPolygon([[x1 - hx, y1 - hy], [x2 - hx, y2 - hy], [x2 + hx, y2 + hy], [x1 + hx, y1 + hy]]);
    }

    // outline of the same rectangle (always-on)
    hidden function barLine(dc as Dc, x, y, deg, r1, r2, w) as Void {
        var s = Math.sin(deg * RAD);
        var c = Math.cos(deg * RAD);
        var hx = c * w / 2.0;
        var hy = s * w / 2.0;
        var x1 = x + s * r1;
        var y1 = y - c * r1;
        var x2 = x + s * r2;
        var y2 = y - c * r2;
        dc.drawLine(x1 - hx, y1 - hy, x2 - hx, y2 - hy);
        dc.drawLine(x2 - hx, y2 - hy, x2 + hx, y2 + hy);
        dc.drawLine(x2 + hx, y2 + hy, x1 + hx, y1 + hy);
        dc.drawLine(x1 + hx, y1 + hy, x1 - hx, y1 - hy);
    }

    // minute-hand release: snap past the mark, then a short damped bounce (k: seconds since the jump)
    hidden function jump(k) {
        if (k < 0.07) {
            return 1.22 * k / 0.07;
        }
        var u = (k - 0.07) / 0.5;
        if (u >= 1) {
            return 1.0;
        }
        return 1.0 + 0.22 * Math.cos(u * Math.PI * 2.5) * (1 - u) * (1 - u);
    }

    // the seconds hand with its disc
    hidden function kelle(dc as Dc, x, y, deg, len, back, w, dr, dR, col) as Void {
        dc.setColor(col, -1);
        bar(dc, x, y, deg, -back, len, w);
        dc.fillCircle(G.ptX(x, dR, deg), G.ptY(y, dR, deg), dr);
        dc.fillCircle(x, y, w + 2.5);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var white = st == 1;
        var big = st == 3;

        // ------------------------------------------------------------ dial
        var dialCol = white ? 0xF3F3EF : 0x000000;
        var markCol = white ? 0x141414 : 0xEFEFEF;
        var handCol = white ? 0x141414 : 0xF2F2F2;
        var dq = G.ease(p * 4);
        if (white) {
            // brushed steel case ring, then the white dial
            dc.setColor(G.dim(0x8D9095, dq), -1);
            dc.fillCircle(CX, CY, 227);
            dc.setColor(G.dim(0xC9CBCE, dq), -1);
            dc.fillCircle(CX, CY, 222);
            dc.setColor(G.dim(0x5E6166, dq), -1);
            dc.fillCircle(CX, CY, 220);
            dc.setColor(G.dim(dialCol, dq), -1);
            dc.fillCircle(CX, CY, 218);
        } else if (!big) {
            dc.setColor(0x1C1C1C, -1);
            dc.setPenWidth(2);
            dc.drawCircle(CX, CY, 223);
        }

        // ------------------------------------------------------------ markers (fade in clockwise)
        var rOut = white ? 208 : 216;
        for (var i = 0; i < 60; i++) {
            var q = G.stag(p, i, 0.0075, 0.12);
            if (q <= 0) {
                break;
            }
            var hour = i % 5 == 0;
            if (big) {
                if (hour) {
                    dc.setColor(G.mix(dialCol, acc, q), -1);
                    bar(dc, CX, CY, i * 6, rOut - 34 - 10 * G.ease(q), rOut, 15);
                } else {
                    dc.setColor(G.mix(dialCol, 0x5A5A5A, q), -1);
                    dc.fillCircle(G.ptX(CX, rOut - 5, i * 6), G.ptY(CY, rOut - 5, i * 6), 2.6);
                }
            } else {
                dc.setColor(G.mix(dialCol, markCol, q), -1);
                if (hour) {
                    bar(dc, CX, CY, i * 6, rOut - 34 - 12 * G.ease(q), rOut, 12);
                } else {
                    bar(dc, CX, CY, i * 6, rOut - 14, rOut, 4.4);
                }
            }
        }

        // ------------------------------------------------------------ data
        var lblCol = white ? 0x9A9A95 : 0x707070;
        var valCol = white ? 0x2E2E2E : G.mix(0x000000, d.dcol, 0.85);
        for (var k = 0; k < 3; k++) {
            var qq = G.stag(p - 0.45, k, 0.06, 0.3);
            if (qq <= 0) {
                continue;
            }
            var sl = d.slots[k];
            var x = k == 0 ? CX : CX + (k == 1 ? -96 : 96);
            var y = k == 0 ? 128 : 214;
            dc.setColor(G.mix(dialCol, lblCol, qq), -1);
            F.px(dc, sl[:lbl] as String, x, y, 2, 1, 0);
            dc.setColor(G.mix(dialCol, valCol, qq), -1);
            F.st(dc, sl[:val] as String, x, y + 33, 20, 3, 1, 1.0, 0);
        }
        // date window at 6
        var wq = G.clamp((p - 0.6) / 0.3, 0.0, 1.0);
        if (wq > 0) {
            var ds = d.dowStr + " " + d.day;
            var ww = F.stW(ds, 15) + 22;
            var wy = big ? 312 : 306;
            dc.setColor(G.mix(dialCol, white ? 0xB4B4AE : 0x3A3A3A, wq), -1);
            dc.fillRoundedRectangle(CX - ww / 2 - 2, wy - 16, ww + 4, 32, 5);
            dc.setColor(G.mix(dialCol, white ? 0xFFFFFF : 0x0D0D0D, wq), -1);
            dc.fillRoundedRectangle(CX - ww / 2, wy - 14, ww, 28, 4);
            dc.setColor(G.mix(dialCol, white ? 0x1A1A1A : valCol, wq), -1);
            F.st(dc, ds, CX, wy, 15, 2.6, 1, 1.0, 0);
        }

        // ------------------------------------------------------------ time
        // seconds since the minute began, sub-second phase locked to the second tick
        if (a.t < _lockT) {
            _lockT = -1;
            _lastS = -1;
        }
        if (d.s != _lastS) {
            if (_lastS >= 0) {
                _lockT = a.t;
            }
            _lastS = d.s;
        }
        var frac = _lockT >= 0 ? G.clamp((a.t - _lockT) / 1000.0, 0.0, 0.999) : (a.t % 1000) / 1000.0;
        var ts = a.live ? d.s + frac : d.s.toFloat();
        var mDeg = d.m * 6.0;
        if (a.live && p >= 1 && ts < 0.6) {
            mDeg = (d.m - 1) * 6 + 6 * jump(ts);
        }
        var hDeg = (d.h % 12) * 30 + mDeg / 12.0;
        var sDeg = ts / 58.5 * 360;
        if (sDeg > 360) {
            sDeg = 360.0;
        }

        // intro: hour hand swings from 12, minute hand last with a bounce, then the Kelle
        var hA = hDeg * G.easeInOut(G.clamp((p - 0.18) / 0.45, 0.0, 1.0));
        var mA = mDeg * G.spring(G.clamp((p - 0.38) / 0.45, 0.0, 1.0));
        var sq = G.clamp((p - 0.62) / 0.38, 0.0, 1.0);
        var sA = sDeg * G.ease(sq);

        var hLen = big ? 136 : 132;
        var hW = big ? 24 : 19;
        var mLen = big ? 206 : 200;
        var mW = big ? 17 : 14;
        var sLen = big ? 150 : 148;
        var sW = big ? 5 : 4.4;
        var dR = big ? 150 : 146;
        var dr = big ? 20 : 16;
        var sCol = acc;

        if (white) {
            // soft drop shadow on the white dial
            dc.setColor(0xC8C8C2, -1);
            bar(dc, CX + 3, CY + 4, hA, -38, hLen, hW);
            bar(dc, CX + 4, CY + 5, mA, -40, mLen, mW);
            if (sq > 0) {
                bar(dc, CX + 5, CY + 6, sA, -60, sLen, sW);
                dc.fillCircle(G.ptX(CX + 5, dR, sA), G.ptY(CY + 6, dR, sA), dr);
            }
        }
        dc.setColor(handCol, -1);
        bar(dc, CX, CY, hA, -38, hLen, hW);
        bar(dc, CX, CY, mA, -40, mLen, mW);
        dc.fillCircle(CX, CY, big ? 12 : 10);
        if (sq > 0) {
            kelle(dc, CX, CY, sA, sLen, 60, sW, dr, dR, G.mix(dialCol, sCol, G.ease(sq * 2)));
            dc.setColor(white ? 0x8C120C : G.dim(sCol, 0.55), -1);
            dc.fillCircle(CX, CY, 2.2);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var x = CX + o[0];
        var y = CY + o[1];
        dc.setColor(0x5A5A5A, -1);
        for (var i = 0; i < 12; i++) {
            dc.fillCircle(G.ptX(x, 200, i * 30), G.ptY(y, 200, i * 30), i == 0 ? 4 : 2.5);
        }
        var mDeg = d.m * 6;
        var hDeg = (d.h % 12) * 30 + d.m * 0.5;
        dc.setPenWidth(2);
        dc.setColor(0x9A9A9A, -1);
        barLine(dc, x, y, hDeg, -30, 128, 17);
        barLine(dc, x, y, mDeg, -32, 192, 13);
        dc.setColor(G.dim(d.accent, 0.7), -1);
        dc.drawCircle(x, y, 7);
    }
}
