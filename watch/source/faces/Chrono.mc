import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// CHRONO — classic analog chronograph: railroad minute track, applied hour
// indices, three sub-dials (9 / 3 / 6) carrying the data slots, date window
// at 4:30 and a sweeping seconds hand. Styles: 1 Noir, 2 Panda, 3 Racing.
// Mirrors web/js/faces/chrono.js.
class FaceChrono extends Face {
    const CX = 227;
    const CY = 227;
    const RAD = 0.017453292519943295;
    const SUBR = 42;
    hidden var _subX = [-95, 95, 0];
    hidden var _subY = [0, 0, 95];
    hidden var _tach = [500, 400, 300, 250, 200, 150, 120, 100, 90, 80, 70, 60];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 15;
    }

    // slot types whose raw value is naturally 0..100 -> drawn as a gauge
    hidden function isGauge(t) as Boolean {
        return t == 23 || t == 22 || t == 1 || t == 42 || t == 35;
    }

    // radial bar from r1 to r2, width w, shifted sideways by off (px)
    hidden function bar(dc as Dc, deg, r1, r2, w, off) as Void {
        var s = Math.sin(deg * RAD);
        var c = Math.cos(deg * RAD);
        var ox = c * off;
        var oy = s * off;
        var hx = c * w / 2.0;
        var hy = s * w / 2.0;
        var x1 = CX + s * r1 + ox;
        var y1 = CY - c * r1 + oy;
        var x2 = CX + s * r2 + ox;
        var y2 = CY - c * r2 + oy;
        dc.fillPolygon([[x1 - hx, y1 - hy], [x2 - hx, y2 - hy], [x2 + hx, y2 + hy], [x1 + hx, y1 + hy]]);
    }

    // faceted (two-tone) hand: base width w at -back, shoulder width tw at len-tip, point at len
    hidden function blade(dc as Dc, deg, len, back, w, tw, tip, cL, cR) as Void {
        var s = Math.sin(deg * RAD);
        var c = Math.cos(deg * RAD);
        var bx = CX - s * back;
        var by = CY + c * back;
        var mx = CX + s * (len - tip);
        var my = CY - c * (len - tip);
        var tx = CX + s * len;
        var ty = CY - c * len;
        dc.setColor(cL, -1);
        dc.fillPolygon([[bx, by], [bx - c * w / 2.0, by - s * w / 2.0], [mx - c * tw / 2.0, my - s * tw / 2.0], [tx, ty]]);
        dc.setColor(cR, -1);
        dc.fillPolygon([[bx, by], [tx, ty], [mx + c * tw / 2.0, my + s * tw / 2.0], [bx + c * w / 2.0, by + s * w / 2.0]]);
    }

    // outline of the same hand shape (always-on)
    hidden function outline(dc as Dc, deg, len, back, w, tw, tip, ox, oy) as Void {
        var s = Math.sin(deg * RAD);
        var c = Math.cos(deg * RAD);
        var bx = CX + ox - s * back;
        var by = CY + oy + c * back;
        var mx = CX + ox + s * (len - tip);
        var my = CY + oy - c * (len - tip);
        var tx = CX + ox + s * len;
        var ty = CY + oy - c * len;
        var ax = bx - c * w / 2.0;
        var ay = by - s * w / 2.0;
        var ex = bx + c * w / 2.0;
        var ey = by + s * w / 2.0;
        var lx = mx - c * tw / 2.0;
        var ly = my - s * tw / 2.0;
        var rx = mx + c * tw / 2.0;
        var ry = my + s * tw / 2.0;
        dc.drawLine(ax, ay, lx, ly);
        dc.drawLine(lx, ly, tx, ty);
        dc.drawLine(tx, ty, rx, ry);
        dc.drawLine(rx, ry, ex, ey);
        dc.drawLine(ex, ey, ax, ay);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var panda = st == 2;
        var racing = st == 3;
        var R = racing ? 194 : 214; // outer edge of the minute track

        // ------------------------------------------------------------ dial
        if (panda) {
            dc.setColor(0x1B1C1E, -1);
            dc.fillCircle(CX, CY, 227);
            dc.setColor(0x2A2B2E, -1);
            dc.setPenWidth(2);
            dc.drawCircle(CX, CY, R + 6);
        }

        // tachymeter bezel
        if (racing) {
            var tp = G.ease(p * 1.3);
            dc.setColor(0x121212, -1);
            dc.fillCircle(CX, CY, 227);
            dc.setColor(0x000000, -1);
            dc.fillCircle(CX, CY, 199);
            dc.setColor(0x3A3A3A, -1);
            dc.setPenWidth(1);
            dc.drawCircle(CX, CY, 199);
            var n = _tach.size();
            for (var i = 0; i < n; i++) {
                var deg = 21600.0 / _tach[i];
                var q = G.stag(tp, i, 0.05, 0.4);
                if (q <= 0) {
                    continue;
                }
                dc.setColor(0xFFFFFF, -1);
                dc.setPenWidth(2);
                G.tick(dc, CX, CY, 199, 204, deg);
                dc.setColor(G.dim(acc, q), -1);
                if (i == n - 1) {
                    continue; // 60 sits under the 12 mark
                }
                F.st(dc, "" + _tach[i], G.ptX(CX, 214, deg), G.ptY(CY, 214, deg), 12, 2, 1, 1.0, 0);
            }
            dc.setColor(acc, -1);
            dc.fillPolygon([[CX, 203], [CX - 6, 214], [CX + 6, 214]]);
        }

        // railroad minute track
        var shown = (G.ease(p * 1.4) * 60).toNumber();
        dc.setPenWidth(1);
        dc.setColor(panda ? 0x55575C : 0x3C3C3C, -1);
        if (shown >= 60) {
            dc.drawCircle(CX, CY, R);
            dc.drawCircle(CX, CY, R - 8);
        }
        dc.setColor(panda ? 0xA6A8AD : 0x8A8A8A, -1);
        dc.setPenWidth(2);
        for (var i = 0; i < shown; i++) {
            if (i % 5 == 0) {
                continue;
            }
            G.tick(dc, CX, CY, R - 8, R, i * 6);
        }

        // applied hour indices
        var iOut = R - 12;
        var iIn = R - 42;
        var body = 0xD2D2D2;
        var hi = 0xFFFFFF;
        var sh = 0x7C7C7C;
        for (var i = 0; i < 12; i++) {
            var q = G.stag(p, i, 0.035, 0.35);
            if (q <= 0 || i == 6) {
                continue; // the 6 o'clock sub-dial replaces it
            }
            var deg = i * 30;
            var r1 = iOut - (iOut - iIn) * G.ease(q);
            if (i == 0) {
                for (var k = -1; k <= 1; k += 2) {
                    dc.setColor(G.dim(body, q), -1);
                    bar(dc, deg, r1, iOut, 7, k * 6);
                    dc.setColor(G.dim(hi, q), -1);
                    bar(dc, deg, r1, iOut, 2, k * 6 - 2.5);
                }
            } else {
                dc.setColor(G.dim(racing ? 0xF2F2F2 : body, q), -1);
                bar(dc, deg, r1, iOut, 10, 0);
                if (!racing) {
                    dc.setColor(G.dim(hi, q), -1);
                    bar(dc, deg, r1, iOut, 2, -4);
                    dc.setColor(G.dim(sh, q), -1);
                    bar(dc, deg, r1, iOut, 2, 4);
                }
                // lume plot at the inner end
                dc.setColor(G.dim(acc, q * 0.9), -1);
                dc.fillCircle(G.ptX(CX, r1 + 5, deg), G.ptY(CY, r1 + 5, deg), 2);
            }
        }

        // signature under 12
        var bp = G.ease(p * 1.5 - 0.3);
        dc.setColor(panda ? 0xE8E8E8 : 0xDEDEDE, -1);
        F.st(dc, "FACELAB", CX, 106, 15, 2, 1, bp, 0);
        dc.setColor(G.dim(acc, bp), -1);
        F.st(dc, racing ? "RACING" : "CHRONOGRAPH", CX, 126, 10, 1, 1, bp, 0);

        // ------------------------------------------------------------ sub-dials
        for (var k = 0; k < 3; k++) {
            var x = CX + _subX[k];
            var y = CY + _subY[k];
            var q = G.stag(p, k, 0.1, 0.45);
            if (q <= 0) {
                continue;
            }
            var sl = d.slots[k];
            var t = d.cfg.slots[k];
            var gauge = isGauge(t);
            var rv = sl[:raw];
            var raw = (rv instanceof Number || rv instanceof Float || rv instanceof Long || rv instanceof Double) ? rv.toFloat() : -1.0;
            var val = sl[:val] as String;
            var discCol = panda ? 0xE6E1D3 : (racing ? 0x000000 : 0x0E0E0E);
            var ringCol = panda ? 0xB3AC98 : (racing ? 0xD8D8D8 : 0x4A4A4A);
            var tickCol = panda ? 0x5B574D : 0x8A8A8A;
            var txtCol = panda ? 0x161616 : d.dcol;
            var rr = SUBR * (0.6 + 0.4 * G.ease(q));
            dc.setColor(discCol, -1);
            dc.fillCircle(x, y, rr);
            if (!panda) {
                dc.setColor(0x1C1C1C, -1);
                dc.setPenWidth(1);
                dc.drawCircle(x, y, rr - 9);
                dc.drawCircle(x, y, rr - 15);
            }
            dc.setColor(G.mix(discCol, ringCol, q), -1);
            dc.setPenWidth(racing ? 2 : 1);
            dc.drawCircle(x, y, rr);
            var vq = G.ease(G.stag(p, k, 0.1, 0.6) * 1.0);
            dc.setColor(G.mix(discCol, tickCol, q), -1);
            if (gauge) {
                // 240 deg scale, gap at the bottom
                dc.setPenWidth(1);
                for (var j = 0; j <= 12; j++) {
                    var deg = -120 + j * 20;
                    dc.setPenWidth(j % 3 == 0 ? 2 : 1);
                    G.tick(dc, x, y, j % 3 == 0 ? SUBR - 9 : SUBR - 6, SUBR - 2, deg);
                }
                var f = raw >= 0 ? G.clamp(raw / 100.0, 0.0, 1.0) : 0.0;
                var ang = -120 + 240 * f * vq;
                if (raw >= 0 && f * vq > 0.005) {
                    dc.setColor(panda ? G.mix(acc, 0x000000, 0.35) : acc, -1);
                    dc.setPenWidth(3);
                    G.arcC(dc, x, y, SUBR - 12, -120, ang);
                }
                // value in the bottom gap
                dc.setColor(G.mix(discCol, txtCol, q), -1);
                F.st(dc, val, x, y + 25, 13, 2, 1, 1.0, 0);
                // hand
                if (raw >= 0) {
                    dc.setColor(panda ? 0x1A1A1A : (racing ? acc : 0xF0F0F0), -1);
                    var s = Math.sin(ang * RAD);
                    var c = Math.cos(ang * RAD);
                    dc.fillPolygon([
                        [x - c * 2.2 - s * 7, y - s * 2.2 + c * 7],
                        [x + s * (SUBR - 7), y - c * (SUBR - 7)],
                        [x + c * 2.2 - s * 7, y + s * 2.2 + c * 7]
                    ]);
                }
                dc.setColor(panda ? 0x1A1A1A : 0xF0F0F0, -1);
                dc.fillCircle(x, y, 4);
                dc.setColor(acc, -1);
                dc.fillCircle(x, y, 1.6);
            } else {
                dc.setPenWidth(1);
                for (var j = 0; j < 12; j++) {
                    dc.setPenWidth(j % 3 == 0 ? 2 : 1);
                    G.tick(dc, x, y, j % 3 == 0 ? SUBR - 8 : SUBR - 5, SUBR - 2, j * 30);
                }
                var h = 20.0;
                var w = F.stW(val, h);
                if (w > 54) {
                    h = h * 54 / w;
                }
                dc.setColor(G.mix(discCol, txtCol, q), -1);
                F.st(dc, val, x, y, h, 3, 1, G.ease(q * 1.3), 0);
            }
            // label under the sub-dial
            dc.setColor(G.mix(0x000000, panda ? 0xBDBDBD : 0x9A9A9A, q), -1);
            F.px(dc, sl[:lbl] as String, x, y + SUBR + 7, 2, 1, 0);
        }

        // ------------------------------------------------------------ date window (4:30)
        var dq = G.stag(p, 1, 0.45, 0.35);
        if (dq > 0) {
            var wx = G.ptX(CX, 156, 135);
            var wy = G.ptY(CY, 156, 135);
            dc.setColor(G.dim(panda ? 0xC8C8C8 : 0xA0A0A0, dq), -1);
            dc.fillRoundedRectangle(wx - 19, wy - 15, 38, 30, 4);
            dc.setColor(G.dim(panda ? 0x111111 : 0xF2EFE6, dq), -1);
            dc.fillRoundedRectangle(wx - 16, wy - 12, 32, 24, 2);
            dc.setColor(panda ? 0xF2EFE6 : 0x111111, -1);
            F.st(dc, G.pad2(d.day), wx, wy, 14, 3, 1, dq, 0);
        }

        // ------------------------------------------------------------ hands
        var hDeg = (d.h % 12) * 30 + d.m * 0.5 + d.s / 120.0;
        var mDeg = d.m * 6 + d.s * 0.1;
        var sec = a.live ? d.s + (a.t % 1000) / 1000.0 : d.s.toFloat();
        var hp = G.spring(G.stag(p, 1, 0.08, 0.82));
        var mp = G.spring(G.stag(p, 1, 0.14, 0.8));
        var sp = G.spring(G.stag(p, 1, 0.22, 0.78));
        var hA = hDeg * hp;
        var mA = mDeg * mp;
        var sA = sec * 6 * sp;
        var silverL = panda ? 0xF4F4F4 : 0xF0F0F0;
        var silverR = panda ? 0xA9ABB0 : 0x9C9C9C;

        blade(dc, hA, 118, 20, 15, 11, 14, silverL, silverR);
        dc.setColor(acc, -1);
        G.hand(dc, CX, CY, hA, 100, -34, 5, 4);

        blade(dc, mA, R - 16, 22, 13, 8, 16, silverL, silverR);
        dc.setColor(acc, -1);
        G.hand(dc, CX, CY, mA, R - 34, -36, 4, 3);

        var sc = racing ? 0xFF3B2F : acc;
        dc.setColor(sc, -1);
        G.hand(dc, CX, CY, sA, R - 4, 52, 3.4, 1.6);
        dc.fillCircle(G.ptX(CX, -38, sA), G.ptY(CY, -38, sA), 6);
        dc.setColor(0x000000, -1);
        dc.fillCircle(G.ptX(CX, -38, sA), G.ptY(CY, -38, sA), 2.2);
        if (racing) {
            dc.setColor(0xFFFFFF, -1);
            G.hand(dc, CX, CY, sA, R - 4, -(R - 22), 2.2, 1.6);
        }
        // layered centre caps
        dc.setColor(silverR, -1);
        dc.fillCircle(CX, CY, 10);
        dc.setColor(silverL, -1);
        dc.fillCircle(CX, CY, 8);
        dc.setColor(racing ? 0xFF3B2F : acc, -1);
        dc.fillCircle(CX, CY, 5);
        dc.setColor(0x000000, -1);
        dc.fillCircle(CX, CY, 1.8);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var R = d.cfg.style == 3 ? 194 : 214;
        dc.setColor(0x5A5A5A, -1);
        for (var i = 0; i < 12; i++) {
            var r = R - 14;
            dc.fillCircle(G.ptX(CX + o[0], r, i * 30), G.ptY(CY + o[1], r, i * 30), i == 0 ? 4 : 2.5);
        }
        var hDeg = (d.h % 12) * 30 + d.m * 0.5;
        var mDeg = d.m * 6;
        dc.setPenWidth(2);
        dc.setColor(0x9A9A9A, -1);
        outline(dc, hDeg, 118, 20, 15, 11, 14, o[0], o[1]);
        outline(dc, mDeg, R - 16, 22, 13, 8, 16, o[0], o[1]);
        dc.setColor(G.dim(d.accent, 0.6), -1);
        dc.drawCircle(CX + o[0], CY + o[1], 6);
    }
}
