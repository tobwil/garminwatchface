import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// MAP — "Schatzkarte": a sea chart on old parchment. The weekly goal (climbed metres, bike km or
// training days, see d.src) sails the ship from the harbour past Möwenriff, Nebelinsel and
// Schildkrötenbucht to the red X on Treasure Island; the route already sailed is inked in red. On
// every wrist raise the ship covers the last stretch of its voyage; at the goal it lies at anchor and
// the chest opens. A sea serpent lurks on the chart, the three data slots fill the log book.
// Styles: 1 Pergament, 2 Nacht, 3 Gameboy. Mirrors web/js/faces/map.js.
class FaceMap extends Face {
    const WP = [100, 316, 156, 300, 200, 262, 168, 222, 212, 186, 268, 200, 318, 178, 350, 152];
    const ISL = [236, 262, 22, 12, 1, 130, 214, 18, 10, 0, 292, 226, 24, 12, 1];
    const NAMES = ["MÖWENRIFF", "NEBELINSEL", "SCHILDKRÖTE"];
    const XX = 360;
    const XY = 140;

    hidden var _cum as Array<Float>;
    hidden var _tot as Float;

    function initialize() {
        Face.initialize();
        _cum = [0.0] as Array<Float>;
        for (var i = 2; i < WP.size(); i += 2) {
            var dx = WP[i] - WP[i - 2];
            var dy = WP[i + 1] - WP[i - 1];
            _cum.add(_cum[_cum.size() - 1] + Math.sqrt(dx * dx + dy * dy).toFloat());
        }
        _tot = _cum[_cum.size() - 1];
    }

    function fps() as Number {
        return 8;
    }

    hidden function at(f) as Array {
        var L = G.clamp(f, 0, 1) * _tot;
        var i = 1;
        while (i < _cum.size() - 1 && _cum[i] < L) {
            i++;
        }
        var dl = _cum[i] - _cum[i - 1];
        var t = (L - _cum[i - 1]) / (dl > 1 ? dl : 1.0);
        return [WP[(i - 1) * 2] + (WP[i * 2] - WP[(i - 1) * 2]) * t, WP[(i - 1) * 2 + 1] + (WP[i * 2 + 1] - WP[(i - 1) * 2 + 1]) * t];
    }

    // weekly progress: [value, goal, label]
    hidden function stage(d as D) as Array {
        if (d.src == 0) {
            var v = d.floorsWeek > 0 ? d.floorsWeek * 3 : 0;
            return [v, 1071, "HM " + v + "/1071"];
        }
        if (d.src == 2) {
            var v = d.trainDays > 0 ? d.trainDays : 0;
            var g = d.dayGoal > 0 ? d.dayGoal : 4;
            return [v, g, "TAGE " + v + "/" + g];
        }
        var km = d.wkBike > 0 ? (d.wkBike / 1000).toNumber() : 0;
        var g = d.cfg.bikeGoal > 0 ? d.cfg.bikeGoal : 150;
        return [km, g, "KM " + km + "/" + g];
    }

    hidden function frac(sg as Array) as Float {
        var g = sg[1] as Number;
        return g > 0 ? G.clamp((sg[0] as Number) / g.toFloat(), 0, 1).toFloat() : 0.0;
    }

    hidden function caption(f) as String {
        if (f >= 1) {
            return "SCHATZ GEFUNDEN!";
        }
        if (f < 0.04) {
            return "LEINEN LOS!";
        }
        if (f < 0.3) {
            return "KURS " + NAMES[0];
        }
        if (f < 0.55) {
            return "KURS " + NAMES[1];
        }
        if (f < 0.8) {
            return "KURS " + NAMES[2];
        }
        return "LAND IN SICHT!";
    }

    // [parchment, parchment dark, burn, ink, ink faint, red ink, sea mark, sand, green, house, roof, text,
    //  hull, sail, flag, wood, iron, gold, note, serpent]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x14223A, 0x0E1A2E, 0x060C18, 0xD8E4F4, 0x5A6E8A, acc, 0x3A5070, 0x8A8A6A, 0x4A7A5A, 0xC8B898,
                0x8A3A2A, 0xE8F0FF, 0x8A6A4A, 0xE8E4D8, acc, 0x8A5A2A, 0x5A5A6A, 0xFFD23A, 0x1E2E4A, 0x5A8A6A] as Array<Number>;
        }
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [e, c, b, a, b, a, b, c, b, c, a, a, a, e, a, b, a, e, c, b] as Array<Number>;
        }
        return [0xE8D4A4, 0xD8C08A, 0x8A5A2A, 0x3A2A1A, 0xA88A5A, acc, 0xB89A68, 0xF0DCA0, 0x6A8A3A, 0xF0E6D0,
            0x9A3A2A, 0x3A2A1A, 0x6A4024, 0xF8F0E0, acc, 0x8A5A2A, 0x4A4A52, 0xFFC83A, 0xF4E8C8, 0x4A7A5A] as Array<Number>;
    }

    // static layer: parchment, harbour, islands, X, route, compass, log book, texts; the ship, the chest,
    // the serpent and the sparkle move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var st = d.cfg.style;
        var P = pal(st, d.accent);
        var p = a.intro;
        var live = a.live;
        var tt = live ? a.t : 0;
        var sg = stage(d);
        var f = frac(sg);

        if (S) {
            // ---- parchment with burnt edge and wave marks
            dc.setColor(P[2], -1);
            dc.fillCircle(227, 227, 227);
            dc.setColor(P[1], -1);
            for (var y = -220; y < 220; y += 4) {
                var hw = (Math.sqrt(220 * 220 - (y + 2) * (y + 2)) / 4).toNumber() * 4 - ((y / 4) % 3 == 0 ? 4 : 0);
                dc.fillRectangle(227 - hw, 227 + y, 2 * hw, 4);
            }
            dc.setColor(P[0], -1);
            for (var y = -206; y < 206; y += 4) {
                var hw = (Math.sqrt(206 * 206 - (y + 2) * (y + 2)) / 4).toNumber() * 4 - ((y / 4) % 2 == 0 ? 4 : 0);
                dc.fillRectangle(227 - hw, 227 + y, 2 * hw, 4);
            }
            dc.setColor(P[6], -1);
            for (var i = 0; i < 22; i++) {
                var wx = 60 + ((i * 131 + 7) % 330);
                var wy = 110 + ((i * 71 + 13) % 250);
                dc.fillRectangle(wx, wy, 6, 2);
                dc.fillRectangle(wx + 6, wy - 2, 6, 2);
                dc.fillRectangle(wx + 12, wy, 6, 2);
            }

            // ---- harbour
            dc.setColor(P[7], -1);
            dc.fillRectangle(40, 318, 70, 40);
            dc.fillRectangle(52, 310, 50, 8);
            dc.setColor(P[15], -1);
            dc.fillRectangle(96, 324, 26, 4);
            for (var i = 0; i < 3; i++) {
                dc.setColor(P[9], -1);
                dc.fillRectangle(52 + i * 16, 324, 12, 12);
                dc.setColor(P[10], -1);
                dc.fillRectangle(50 + i * 16, 318, 16, 6);
            }

            // ---- islands, treasure island with the X
            for (var i = 0; i < ISL.size(); i += 5) {
                var x = ISL[i];
                var y = ISL[i + 1];
                var w = ISL[i + 2];
                var h = ISL[i + 3];
                dc.setColor(P[7], -1);
                dc.fillRectangle(x - w, y - h + 4, 2 * w, 2 * h - 8);
                dc.fillRectangle(x - w + 6, y - h, 2 * w - 12, 2 * h);
                dc.setColor(P[8], -1);
                dc.fillRectangle(x - w + 10, y - h + 4, 2 * w - 20, h);
                if (ISL[i + 4] == 1) {
                    Spr.draw(dc, SprMap.PALM, x - 6, y - h - 22, 3, [-1, P[8], P[12]], false);
                }
            }
            dc.setColor(P[7], -1);
            dc.fillRectangle(XX - 40, XY - 18, 80, 38);
            dc.fillRectangle(XX - 30, XY - 26, 60, 54);
            dc.setColor(P[8], -1);
            dc.fillRectangle(XX - 26, XY - 22, 20, 14);
            dc.fillRectangle(XX + 12, XY + 8, 18, 12);
            Spr.draw(dc, SprMap.PALM, XX + 14, XY - 50, 3, [-1, P[8], P[12]], false);
            dc.setColor(P[5], -1);
            for (var i = 0; i < 5; i++) {
                dc.fillRectangle(XX - 10 + i * 4, XY - 10 + i * 4, 4, 4);
                dc.fillRectangle(XX + 6 - i * 4, XY - 10 + i * 4, 4, 4);
            }

            // ---- route: sailed part in red ink, the rest dashed
            for (var i = 0; i <= 60; i++) {
                var t = i / 60.0;
                var done = t <= f;
                if (!done && i % 3 == 2) {
                    continue;
                }
                var q = at(t);
                dc.setColor(done ? P[5] : P[4], -1);
                var sz = done ? 4 : 2;
                dc.fillRectangle(Math.floor((q[0] as Float) / 2).toNumber() * 2, Math.floor((q[1] as Float) / 2).toNumber() * 2, sz, sz);
            }

            // ---- compass rose
            var cx = 372;
            var cy = 318;
            dc.setColor(P[4], -1);
            for (var i = -24; i <= 24; i += 4) {
                var w = 6 - Math.round(i.abs() / 6.0).toNumber();
                dc.fillRectangle(cx - w / 2, cy + i, w, 4);
                dc.fillRectangle(cx + i, cy - w / 2, 4, w);
            }
            dc.setColor(P[5], -1);
            dc.fillRectangle(cx - 2, cy - 24, 4, 16);
            dc.setColor(P[3], -1);
            F.px(dc, "N", cx, cy - 40, 2, 1, 0);

            // ---- log book with the data slots
            dc.setColor(P[18], -1);
            dc.fillRectangle(52, 96, 158, 74);
            dc.setColor(P[4], -1);
            dc.drawRectangle(52, 96, 158, 74);
            dc.setColor(P[3], -1);
            F.px(dc, "LOGBUCH", 131, 100, 1, 1, 0);
            for (var i = 0; i < 3; i++) {
                var s = d.slots[i];
                var lb = s[:lbl] as String;
                if (lb.length() == 0 || G.stag(p, i, 0.1, 0.4) <= 0) {
                    continue;
                }
                var val = s[:val] as String;
                while (lb.length() > 2 && F.pxW(lb, 2) > 128 - F.pxW(val, 2)) {
                    lb = lb.substring(0, lb.length() - 1);
                }
                dc.setColor(P[4], -1);
                F.px(dc, lb, 60, 114 + i * 18, 2, 0, 0);
                dc.setColor(P[3], -1);
                F.px(dc, val, 202, 114 + i * 18, 2, 2, 0);
            }

            // ---- time, date, voyage
            dc.setColor(P[3], -1);
            F.px(dc, G.timeStr(d), 227, 26, 5, 1, 0);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 70, 2, 1, 0);
            dc.setColor(P[5], -1);
            F.px(dc, caption(f), 227, 380, 2, 1, 0);
            dc.setColor(P[3], -1);
            F.px(dc, sg[2] as String, 227, 400, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        // ---- the sea serpent shows its humps
        var sb = live ? (tt / 500) % 2 : 0;
        dc.setColor(P[19], -1);
        for (var i = 0; i < 3; i++) {
            var hx = 268 + i * 18;
            var hy = 290 - (i == 1 ? 4 : 0) - sb * 2;
            dc.fillRectangle(hx, hy, 12, 6);
            dc.fillRectangle(hx + 2, hy - 4, 8, 4);
        }
        dc.fillRectangle(320, 278 - sb * 2, 8, 12);
        dc.fillRectangle(320, 278 - sb * 2, 14, 6);

        // ---- the ship sails the last stretch on every raise
        var f0 = f >= 1 ? 1.0 : (f - 0.12 > 0 ? f - 0.12 : 0.0);
        var fr = f >= 1 ? 1.0 : G.lerp(f0, f, G.easeInOut(G.clamp((p - 0.2) / 0.8, 0, 1)));
        var q = fr >= 1 ? [XX - 50, XY + 30] : at(fr);
        var bob = live ? ((tt / 400) % 2) * 2 : 0;
        Spr.draw(dc, SprMap.SHIP, Math.round(q[0]).toNumber() - 24, Math.round(q[1]).toNumber() - 36 + bob, 3, [-1, P[12], P[13], P[14]], false);

        // ---- at the goal the chest opens
        if (f >= 1) {
            var open = p > 0.6;
            Spr.draw(dc, open ? SprMap.CHEST_O : SprMap.CHEST_C, XX - 18, XY - 50, 3, [-1, P[15], P[16], P[17]], false);
            if (open && (!live || (tt / 250) % 2 == 0)) {
                dc.setColor(P[17], -1);
                dc.fillRectangle(XX - 26, XY - 60, 4, 4);
                dc.fillRectangle(XX + 20, XY - 56, 4, 4);
                dc.fillRectangle(XX - 2, XY - 70, 4, 4);
            }
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var f = frac(stage(d));
        dc.setColor(st == 3 ? 0x306230 : 0x4A4236, -1);
        for (var i = 0; i <= 30; i += 2) {
            var q = at(i / 30.0);
            dc.fillRectangle(Math.round(q[0]).toNumber() + o[0], Math.round(q[1]).toNumber() + o[1], 2, 2);
        }
        var q = at(f);
        dc.setColor(G.dim(d.accent, 0.6), -1);
        dc.fillRectangle(Math.round(q[0]).toNumber() - 4 + o[0], Math.round(q[1]).toNumber() - 4 + o[1], 8, 8);
        dc.fillRectangle(XX - 6 + o[0], XY - 6 + o[1], 4, 4);
        dc.fillRectangle(XX + 2 + o[0], XY + 2 + o[1], 4, 4);
        dc.setColor(st == 3 ? 0x8BAC0F : 0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 26 + o[1], 5, 1, 1);
    }
}
