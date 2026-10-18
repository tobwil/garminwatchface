import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// WERK — "Tageskunstwerk": every day paints its own picture, a generative bloom on the black AMOLED
// screen. The steps decide the number of petals (5 to 12), the sleep score the colour (an indigo night
// for poor sleep, through dusk and dawn to a golden sun), the day's stress how wild the petal tips
// are, the Body Battery how brightly it glows; the date turns it. The picture grows with the day and
// gets a title ("RUHIGE MORGENRÖTE"). At midnight it goes into the week gallery below: the last six
// days as small pictures, kept in the watch's storage.
// Styles: 1 Schwarz, 2 Leinwand, 3 Akzent (all in the accent colour). Mirrors web/js/faces/werk.js.
class FaceWerk extends Face {
    const CY = 198;
    const R = 100;
    const DL = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
    const ADJ = ["STILLE", "RUHIGE", "BEWEGTE", "WILDE"];
    const NOUN = ["NACHT", "DÄMMERUNG", "MORGENRÖTE", "SONNE"];

    hidden var _wk = null; // [today's picture, the six days before], read with every static redraw

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    hidden function leap(y) as Boolean {
        return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    }

    hidden function dayKey(d as D) as Number {
        return d.year * 1000 + d.doy;
    }

    hidden function yKey(d as D) as Number {
        return d.doy > 1 ? d.year * 1000 + d.doy - 1 : (d.year - 1) * 1000 + (leap(d.year - 1) ? 366 : 365);
    }

    // the day's mean stress (the last 12 hours), else the current value
    hidden function stressAvg(d as D) as Float {
        var s = 0;
        var n = 0;
        var h = d.stressHist;
        for (var i = h.size() > 24 ? h.size() - 24 : 0; i < h.size(); i++) {
            if (h[i] >= 0) {
                s += h[i];
                n++;
            }
        }
        return n > 0 ? s.toFloat() / n : d.stress >= 0 ? d.stress.toFloat() : 30.0;
    }

    // today's picture packed into one number (0 = no picture): petals, colour, glow, wildness, turn
    hidden function params(d as D) as Number {
        var g = d.stepGoal > 0 ? d.stepGoal : 10000;
        var np = G.clamp(Math.floor((d.steps.toFloat() / g) * 7).toNumber(), 0, 7);
        var hue = d.sleep > 0 ? G.clamp(Math.round(d.sleep * 0.15).toNumber(), 0, 15) : 8;
        var br = d.bb >= 0 ? G.clamp(Math.round(d.bb * 0.15).toNumber(), 0, 15) : 10;
        var jag = G.clamp(Math.round(stressAvg(d) * 0.15).toNumber(), 0, 15);
        return 1 + np + 8 * hue + 128 * br + 2048 * jag + 32768 * (d.doy % 256);
    }

    hidden function sync(d as D) as Array {
        var today = dayKey(d);
        var v = params(d);
        var day = St.get("arD", -1);
        if (day != today) {
            var H = (St.get("arH", [0, 0, 0, 0, 0, 0]) as Array<Number>).slice(0, null);
            if (day != -1) {
                // yesterday's picture goes into the gallery (after a gap: empty frames for the missed days)
                if (day != yKey(d)) {
                    H.add(0);
                }
                H.add(St.get("arT", 0) as Number);
                H = H.slice(H.size() - 6, null);
            }
            St.set("arH", H);
            St.set("arD", today);
            St.set("arT", v);
        } else if (St.get("arT", 0) != v) {
            St.set("arT", v);
        }
        return [v, St.get("arH", [0, 0, 0, 0, 0, 0])];
    }

    // the picture v around (cx, cy) with radius r: layers 1..3; acc >= 0 paints it in that colour only
    hidden function bloom(dc as Dc, cx as Number, cy as Number, r as Number, v as Number, layers as Number, canvas as Boolean, acc as Number) as Void {
        var w = v - 1;
        var n = 5 + (w % 8);
        var hue = 250 + ((w / 8) % 16) * 10;
        var br = (w / 128) % 16;
        var jag = (w / 2048) % 16;
        var a0 = ((w / 32768) * 37) % 360;
        var val = canvas ? 0.75 : 0.45 + (br / 15.0) * 0.55;
        var sect = 360.0 / n;
        // layer -1 is a dim, wider halo behind the petals (only on the big picture)
        for (var j = layers > 1 ? -1 : 0; j < layers; j++) {
            var rr = j < 0 ? r * 1.12 : r * (1 - j * 0.3);
            var vv = val * (0.8 + j * 0.15);
            if (acc >= 0) {
                var va = val * (0.55 + j * 0.25);
                dc.setColor(G.mix(0, acc, j < 0 ? 0.2 : va > 1 ? 1.0 : va), -1);
            } else {
                dc.setColor(j < 0 ? (canvas ? G.hsv(hue, 0.25, 0.92) : G.hsv(hue, 0.9, 0.2)) : G.hsv(hue + j * 22, 0.85 - j * 0.15, vv > 1 ? 1.0 : vv), -1);
            }
            for (var i = 0; i < n; i++) {
                var an = a0 + (i + (j == 1 ? 0.5 : 0.0)) * sect;
                var pts = [[cx, cy], pt(cx, cy, rr * 0.5, an - sect * 0.42)] as Array<Array<Numeric>>;
                if (jag >= 8) {
                    // wild days split the tips
                    pts.add(pt(cx, cy, rr, an - sect * 0.14));
                    pts.add(pt(cx, cy, rr * (1 - jag / 40.0), an));
                    pts.add(pt(cx, cy, rr, an + sect * 0.14));
                } else {
                    pts.add(pt(cx, cy, rr, an));
                }
                pts.add(pt(cx, cy, rr * 0.5, an + sect * 0.42));
                dc.fillPolygon(pts as Array<[Numeric, Numeric]>);
            }
        }
        dc.setColor(acc >= 0 ? G.mix(acc, 0xFFFFFF, 0.6) : G.hsv(hue + 60, 0.35, 1.0), -1);
        var cr = Math.round(r * 0.12).toNumber();
        dc.fillCircle(cx, cy, cr < 3 ? 3 : cr);
    }

    hidden function pt(cx as Number, cy as Number, r, deg) as [Numeric, Numeric] {
        return [Math.round(G.ptX(cx, r, deg)).toNumber(), Math.round(G.ptY(cy, r, deg)).toNumber()] as [Numeric, Numeric];
    }

    // static layer: today's picture, its title, the gallery, the time; two sparks circle the bloom
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var cv = d.cfg.style == 2;
        var ac = d.cfg.style == 3 ? d.accent : -1;
        var tx = cv ? 0x2A2420 : 0xFFFFFF;
        var dim = cv ? 0x8A7A68 : 0x8A8A96;
        if (S || _wk == null) {
            _wk = sync(d);
        }
        var wk = _wk as Array;
        var v = wk[0] as Number;
        var H = wk[1] as Array<Number>;
        var w = v - 1;

        if (S) {
            dc.setColor(cv ? 0xF0EAD8 : 0x000000, -1);
            dc.fillRectangle(0, 0, 454, 454);
            // ---- today's picture with a faint frame
            dc.setColor(cv ? 0xD8CEB8 : 0x16161C, -1);
            dc.drawCircle(227, CY, R + 10);
            bloom(dc, 227, CY, R, v, 3, cv, ac);

            // ---- its title
            var hi = (w / 8) % 16;
            var jg = (w / 2048) % 16;
            dc.setColor(tx, -1);
            F.px(dc, ADJ[jg <= 4 ? 0 : jg <= 8 ? 1 : jg <= 11 ? 2 : 3] + " " + NOUN[hi / 4], 227, 318, 2, 1, 0);
            dc.setColor(dim, -1);
            F.px(dc, "WERK NR. " + d.doy, 227, 340, 2, 1, 0);

            // ---- the week gallery
            for (var i = 0; i < 6; i++) {
                var x = Math.round(227 + (i - 2.5) * 52).toNumber();
                if (H[i] > 0) {
                    bloom(dc, x, 376, 20, H[i], 1, cv, ac);
                } else {
                    dc.setColor(cv ? 0xD8CEB8 : 0x26262E, -1);
                    dc.drawCircle(x, 376, 20);
                }
                dc.setColor(dim, -1);
                F.px(dc, DL[(d.dow + 1 + i) % 7], x, 402, 1, 1, 0);
            }

            // ---- time and date
            dc.setColor(tx, -1);
            F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
            dc.setColor(dim, -1);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 64, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        // ---- two sparks circle the bloom
        var hue = 250 + ((w / 8) % 16) * 10;
        dc.setColor(ac >= 0 ? G.mix(ac, 0xFFFFFF, 0.5) : G.hsv(hue + 60, 0.3, 1.0), -1);
        for (var i = 0; i < 2; i++) {
            var an = (a.t / 40 + i * 180) % 360;
            var q = pt(227, CY, R + 10, an);
            dc.fillCircle(q[0], q[1], 3);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var v = _wk == null ? 1 : (_wk as Array)[0] as Number;
        var w = v - 1;
        var n = 5 + (w % 8);
        var a0 = ((w / 32768) * 37) % 360;
        dc.setColor(G.hsv(250 + ((w / 8) % 16) * 10, 0.6, 0.45), -1);
        for (var i = 0; i < n; i++) {
            var q = pt(227, CY, R * 0.8, a0 + (i * 360.0) / n);
            dc.drawLine(227 + o[0], CY + o[1], q[0] + o[0], q[1] + o[1]);
        }
        dc.setColor(0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
    }
}
