import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// PLASMA — "Plasmakugel": a plasma ball on true black, made for AMOLED. The time sits dark in the
// glowing electrode, lightning tendrils crackle from it to the glass and light up where they touch.
// The more stress, the more tendrils; the higher the pulse, the faster they wander. On every wrist
// raise the lightning shoots out of the core. The base shows pulse, stress and Body Battery.
// Styles: 1 Violett, 2 Eis, 3 Akzent. Mirrors web/js/faces/plasma.js.
class FacePlasma extends Face {
    const CX = 227;
    const CY = 200;
    const RG = 168;
    const RC = 70;
    const SEG = 10;
    const RR = [96, 84, 70, 60, 48];
    const RK = [0.0, 0.35, 1.0, 1.6, 2.2];

    hidden var _pts as Array<Float>;

    function initialize() {
        Face.initialize();
        _pts = new [2 * (SEG + 1)] as Array<Float>;
    }

    function fps() as Number {
        return 12;
    }

    // [glow dark, glow mid, tendril, tendril core, core inner, glass, time ink, base, base text]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x061A3A, 0x1A6AD8, 0x6AD8FF, 0xFFFFFF, 0xE8FBFF, 0x1A3A6A, 0x05203A, 0x16181E, 0x6AD8FF] as Array<Number>;
        }
        if (st == 3) {
            return [G.mix(acc, 0, 0.82), G.mix(acc, 0, 0.35), acc, 0xFFFFFF, G.mix(acc, 0xFFFFFF, 0.8), G.mix(acc, 0, 0.7),
                G.mix(acc, 0, 0.85), 0x16181E, acc] as Array<Number>;
        }
        return [0x2A0640, 0x9A1AD8, 0xFF5AE0, 0xFFFFFF, 0xFFE8FB, 0x3A1A5A, 0x2A0636, 0x16181E, 0xFF7AE8] as Array<Number>;
    }

    hidden function tendrils(d as D) as Number {
        var s = d.stress >= 0 ? d.stress : 25;
        return 4 + Math.round(G.clamp(s, 0, 100) / 20.0).toNumber();
    }

    // static layer: glass, electrode with the time, base with the data; the lightning moves
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

        if (S) {
            dc.setColor(0x000000, -1);
            dc.fillRectangle(0, 0, 454, 454);
            // ---- glass with a highlight
            dc.setColor(P[5], -1);
            dc.setPenWidth(2);
            dc.drawCircle(CX, CY, RG);
            dc.setColor(G.mix(P[5], 0xFFFFFF, 0.35), -1);
            for (var i = 0; i < 20; i++) {
                var an = (196 + i * 3) * Math.PI / 180;
                var w = i < 3 || i > 16 ? 2 : 4;
                dc.fillRectangle(Math.round(CX + Math.cos(an) * (RG - 14)).toNumber() - w / 2, Math.round(CY + Math.sin(an) * (RG - 14)).toNumber() - w / 2, w, w);
            }
            // ---- the electrode: halo to white-hot centre
            for (var i = 0; i < RR.size(); i++) {
                var k = RK[i];
                dc.setColor(k <= 1 ? G.mix(P[0], P[1], k) : G.mix(P[2], P[4], (k - 1) / 1.2), -1);
                dc.fillCircle(CX, CY, RR[i]);
            }
            // ---- time in the core, date below
            dc.setColor(P[6], -1);
            F.st(dc, G.timeStr(d), CX, CY, 36, 6, 1, 1.0, 0);
            dc.setColor(G.mix(P[2], 0, 0.3), -1);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX, 300, 2, 1, 0);
            // ---- the base with the data
            dc.setColor(P[7], -1);
            dc.fillPolygon([[150, 372], [304, 372], [350, 454], [104, 454]]);
            dc.setColor(G.mix(P[7], 0xFFFFFF, 0.15), -1);
            dc.fillRectangle(150, 372, 154, 4);
            dc.setColor(P[8], -1);
            F.px(dc, (d.hr > 0 ? "" + d.hr : "--") + " BPM  STRESS " + (d.stress >= 0 ? "" + d.stress : "--"), CX, 388, 2, 1, 0);
            F.px(dc, "BODY BATTERY " + (d.bb >= 0 ? d.bb + "%" : "--"), CX, 410, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        // ---- lightning: wandering tendrils, flickering every frame
        var n = tendrils(d);
        var grow = G.ease(G.clamp(p / 0.7, 0, 1));
        var spd = 1 + (d.hr > 0 ? G.clamp((d.hr - 50) / 50.0, 0, 2) : 0);
        var fr = a.t / 70;
        var len = RC + (RG - RC) * grow;
        for (var i = 0; i < n; i++) {
            var ang = i * 2 * Math.PI / n + 0.4 + Math.sin(tt * spd / (1700.0 + i * 310) + i) * 0.7;
            var ca = Math.cos(ang);
            var sa = Math.sin(ang);
            // a random walk sideways, pinned to the core and to the glass
            _pts[0] = (CX + ca * RC).toFloat();
            _pts[1] = (CY + sa * RC).toFloat();
            var w = 0;
            for (var j = 1; j <= SEG; j++) {
                var r = RC + (len - RC) * j / SEG;
                w += (G.rnd(fr * 31 + i * 7 + j) % 15) - 7;
                var jit = w * Math.sin(Math.PI * j / SEG);
                _pts[j * 2] = (CX + ca * r - sa * jit).toFloat();
                _pts[j * 2 + 1] = (CY + sa * r + ca * jit).toFloat();
            }
            // glow pass, then the bright core of the bolt
            dc.setColor(P[1], -1);
            dc.setPenWidth(5);
            for (var j = 2; j < _pts.size(); j += 2) {
                dc.drawLine(_pts[j - 2], _pts[j - 1], _pts[j], _pts[j + 1]);
            }
            dc.setColor(G.rnd(fr * 3 + i) % 4 == 0 ? P[3] : P[2], -1);
            dc.setPenWidth(2);
            for (var j = 2; j < _pts.size(); j += 2) {
                dc.drawLine(_pts[j - 2], _pts[j - 1], _pts[j], _pts[j + 1]);
            }
            // every second bolt forks half way
            if (i % 2 == 0 && grow >= 1) {
                var m = SEG / 2;
                var fa = ang + ((G.rnd(fr * 5 + i) % 2) * 2 - 1) * 0.35;
                var fx = _pts[m * 2];
                var fy = _pts[m * 2 + 1];
                dc.setColor(P[1], -1);
                dc.setPenWidth(2);
                for (var j = 1; j <= 3; j++) {
                    var nx = fx + Math.cos(fa) * 16 + ((G.rnd(fr * 17 + i + j) % 9) - 4);
                    var ny = fy + Math.sin(fa) * 16 + ((G.rnd(fr * 19 + i + j) % 9) - 4);
                    dc.drawLine(fx, fy, nx, ny);
                    fx = nx;
                    fy = ny;
                }
            }
            // where it touches the glass
            if (grow >= 1) {
                var ex = _pts[SEG * 2];
                var ey = _pts[SEG * 2 + 1];
                dc.setColor(P[2], -1);
                dc.fillCircle(ex, ey, 6);
                dc.setColor(P[3], -1);
                dc.fillCircle(ex, ey, 2);
            }
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var P = pal(d.cfg.style, d.accent);
        dc.setColor(G.mix(P[5], 0, 0.3), -1);
        dc.setPenWidth(1);
        dc.drawCircle(CX + o[0], CY + o[1], RC);
        dc.setColor(G.mix(P[2], 0, 0.45), -1);
        F.st(dc, G.timeStr(d), CX + o[0], CY + o[1], 36, 3, 1, 1.0, 0);
    }
}
