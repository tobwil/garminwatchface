import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// TOUR — "Tour de Woche": the ISO week as a 7-stage race. The route runs around the dial from
// START (Monday) over the top to the ZIEL (Sunday); training days are won stages. Three jerseys
// (Wertungen): yellow = weekly bike km, green = training days, polka dot = climbed metres.
// Styles: 1 Maillot, 2 Klassik (paper), 3 Nacht (neon). Mirrors web/js/faces/tour.js.
class FaceTour extends Face {
    const CX = 227;
    const CY = 227;
    const NS = 113;
    const SEG = 16;
    const DAYS = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];
    const DAYN = ["MONTAG", "DIENSTAG", "MITTWOCH", "DONNERSTAG", "FREITAG", "SAMSTAG", "SONNTAG"];
    const TYP = [0, 1, 2, 0, 3, 2, 0];
    const TYPN = ["FLACH", "HÜGELIG", "BERGANKUNFT", "ZEITFAHREN"];
    const JY = 336;
    const JX = [131, 227, 323];
    const JCOL = [0xFFD400, 0x1FB24A, 0xF4F4F4];
    const RED = 0xE0242B;
    const JT = [-21, -23, -8, -27, 8, -27, 21, -23, 19, 27, -19, 27];
    const JS = [21, -23, 33, -8, 25, -1, 18, -6];
    const JO = [-8, -27, 0, -21, 8, -27, 21, -23, 33, -8, 25, -1, 20, -6, 19, 27, -19, 27, -20, -6, -25, -1, -33, -8, -21, -23];
    const PD = [-11, -13, 11, -13, 0, -5, -12, 4, 12, 4, 0, 13, -10, 21, 10, 21, 27, -10, -27, -10];

    hidden var _rx = null;
    hidden var _ry = null;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    // route samples: a hand-drawn looking loop from 250° clockwise over the top to 110°
    hidden function geo() as Void {
        if (_rx != null) {
            return;
        }
        var rx = new [NS];
        var ry = new [NS];
        for (var i = 0; i < NS; i++) {
            var u = i / (NS - 1.0);
            var r = 183 + 7 * Math.sin(u * 17.0 + 0.4) + 3 * Math.sin(u * 41.0);
            var deg = 250 + u * 220 + 3 * Math.sin(u * 23.0);
            rx[i] = G.ptX(CX, r, deg);
            ry[i] = G.ptY(CY, r, deg);
        }
        _rx = rx;
        _ry = ry;
    }

    // polygon from a flat coordinate list, scaled, optionally mirrored
    hidden function poly(dc as Dc, arr, x, y, s, mir) as Void {
        var n = arr.size() / 2;
        var pts = new [n];
        for (var i = 0; i < n; i++) {
            pts[i] = [x + arr[i * 2] * s * mir, y + arr[i * 2 + 1] * s];
        }
        dc.fillPolygon(pts);
    }

    // one jersey. kind 0 yellow, 1 green, 2 polka. frac 0..1 fill level, worn = goal reached
    hidden function jersey(dc as Dc, x, y, s, kind, frac, worn, st, bg, sp) as Void {
        var base = JCOL[kind];
        if (st == 2) {
            base = G.mix(base, 0x8B5A2B, 0.12);
        }
        var dark = G.mix(base, kind == 2 ? 0x8A8A8A : 0x000000, kind == 2 ? 0.6 : 0.32);
        if (worn) {
            var gc = st == 2 ? 0xF1E6CC : bg;
            dc.setColor(G.mix(gc, base, 0.14), -1);
            dc.fillCircle(x, y, 38 * s);
            dc.setColor(G.mix(gc, base, 0.26), -1);
            dc.fillCircle(x, y, 31 * s);
        }
        var fy = y + 27 * s - 54 * s * frac;
        var clip = !worn && frac < 0.999;
        if (frac > 0.005) {
            if (clip) {
                dc.setClip((x - 36 * s).toNumber(), fy.toNumber(), (72 * s).toNumber() + 1, (y + 30 * s - fy).toNumber() + 1);
            }
            dc.setColor(worn ? base : G.mix(bg, base, 0.8), -1);
            poly(dc, JT, x, y, s, 1);
            poly(dc, JS, x, y, s, 1);
            poly(dc, JS, x, y, s, -1);
            // collar (inside of the back) + zip
            dc.setColor(dark, -1);
            dc.fillPolygon([[x - 8 * s, y - 27 * s], [x + 8 * s, y - 27 * s], [x, y - 21 * s]]);
            if (kind == 2) {
                dc.setColor(st == 2 ? G.mix(RED, 0x8B5A2B, 0.2) : RED, -1);
                for (var i = 0; i < PD.size(); i += 2) {
                    dc.fillCircle(x + PD[i] * s, y + PD[i + 1] * s, 3.4 * s);
                }
            } else {
                dc.setPenWidth(2 * s < 1 ? 1 : 2 * s);
                dc.drawLine(x, y - 21 * s, x, y + 25 * s);
                // cuffs + hem
                dc.setPenWidth(3 * s < 1 ? 1 : 3 * s);
                dc.drawLine(x + 32 * s, y - 7 * s, x + 25 * s, y);
                dc.drawLine(x - 32 * s, y - 7 * s, x - 25 * s, y);
                dc.fillRectangle(x - 19 * s, y + 23 * s, 38 * s, 4 * s);
            }
            if (clip) {
                dc.clearClip();
            }
        }
        // outline
        var oc;
        if (worn) {
            oc = st == 2 ? 0x3A2817 : dark;
        } else {
            oc = st == 2 ? G.mix(0xF1E6CC, 0x3A2817, 0.7) : G.mix(bg, base, 0.6);
        }
        dc.setColor(oc, -1);
        dc.setPenWidth(2);
        var n = JO.size();
        var px = x + JO[n - 2] * s;
        var py = y + JO[n - 1] * s;
        for (var i = 0; i < n; i += 2) {
            var nx = x + JO[i] * s;
            var ny = y + JO[i + 1] * s;
            dc.drawLine(px, py, nx, ny);
            px = nx;
            py = ny;
        }
        // sparkles on a worn jersey
        if (worn && sp >= 0) {
            for (var k = 0; k < 3; k++) {
                var ph = sp + k * 0.33;
                if (ph >= 1) {
                    ph -= 1;
                }
                var r = (1.0 - (ph * 2 - 1).abs()) * 6 * s;
                if (r < 1) {
                    continue;
                }
                var ang = kind * 70 + k * 125 + 30;
                var sx = G.ptX(x, 34 * s, ang);
                var sy = G.ptY(y, 32 * s, ang);
                dc.setColor(st == 2 ? 0x8B5A2B : 0xFFFFFF, -1);
                dc.fillPolygon([[sx, sy - r * 1.6], [sx + r * 0.35, sy - r * 0.35], [sx + r * 1.6, sy], [sx + r * 0.35, sy + r * 0.35],
                    [sx, sy + r * 1.6], [sx - r * 0.35, sy + r * 0.35], [sx - r * 1.6, sy], [sx - r * 0.35, sy - r * 0.35]]);
            }
        }
    }

    // tiny side-view cyclist, wheels on (x, y), facing right (f = 1) or left (-1)
    hidden function rider(dc as Dc, x, y, f, col, ink, crank) as Void {
        dc.setColor(ink, -1);
        dc.setPenWidth(2);
        dc.drawCircle(x - 6 * f, y - 4, 4);
        dc.drawCircle(x + 6 * f, y - 4, 4);
        dc.setColor(col, -1);
        dc.drawLine(x - 6 * f, y - 4, x, y - 4);
        dc.drawLine(x, y - 4, x + 4 * f, y - 10);
        dc.drawLine(x - 3 * f, y - 10, x + 4 * f, y - 10);
        dc.drawLine(x + 4 * f, y - 10, x + 6 * f, y - 4);
        // rider: back, arm, head, leg
        dc.setPenWidth(3);
        dc.drawLine(x - 2 * f, y - 12, x + 4 * f, y - 16);
        dc.drawLine(x + 4 * f, y - 16, x + 6 * f, y - 11);
        dc.drawLine(x - 2 * f, y - 12, x + G.ptX(0, 3, crank) * f, y - 4 + G.ptY(0, 3, crank));
        dc.fillCircle(x + 6 * f, y - 19, 3);
    }

    hidden function routePt(u) {
        var fi = G.clamp(u, 0.0, 1.0) * (NS - 1);
        var i = Math.floor(fi).toNumber();
        if (i > NS - 2) {
            i = NS - 2;
        }
        var t = fi - i;
        return [G.lerp(_rx[i], _rx[i + 1], t), G.lerp(_ry[i], _ry[i + 1], t), _rx[i + 1] >= _rx[i] ? 1 : -1];
    }

    // stage profile bars of today's stage type
    hidden function profile(dc as Dc, x0, yb, typ, k, col, col2, pr) as Void {
        var seed = G.rnd(k * 977 + 13);
        for (var i = 0; i < 28; i++) {
            var u = i / 27.0;
            var h;
            seed = G.rnd(seed);
            var n = G.rf(seed);
            if (typ == 0) {
                h = 4 + 3 * G.noise(u * 9 + k) + n * 2;
            } else if (typ == 1) {
                h = 8 + 8 * G.noise(u * 7 + k * 1.7).abs() + 4 * Math.sin(u * 9.4) + n * 2;
            } else if (typ == 2) {
                h = 5 + 26 * Math.pow(u, 1.8) + 5 * G.noise(u * 6 + k).abs() + n * 2;
            } else {
                h = 5 + 2 * Math.sin(u * 6.3) + n;
            }
            h = (h < 2 ? 2 : h) * pr;
            dc.setColor(i == 27 ? col2 : col, -1);
            dc.fillRectangle(x0 + i * 5, yb - h, 4, h);
        }
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        geo();
        var RX = _rx;
        var RY = _ry;
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var t = a.t;
        var live = a.live && p >= 1;
        var di = G.clamp(d.dayIdx, 0, 6);

        // ---- palette
        var bg = 0x000000;
        var ink = 0xFFFFFF;
        var sub = 0x9A9A9A;
        var done = acc;
        var fut = 0x4A4A4A;
        var tod = 0xD8D8D8;
        var rest = 0x5C5C5C;
        var glow = -1;
        if (st == 2) {
            bg = 0xF1E6CC; ink = 0x3A2817; sub = 0x7A5A3A; done = 0x8B5A2B; fut = 0xC2AB84; tod = 0x5A3A1F; rest = 0xA8916C;
        } else if (st == 3) {
            bg = 0x07102A; ink = 0xE8F0FF; sub = 0x7F93C4; done = 0x27E3FF; fut = 0x2A3F75; tod = 0x9FDCFF; rest = 0x34497F; glow = 0x0B3D63;
        }
        var won = st == 2 ? G.mix(acc, 0x8B5A2B, 0.1) : acc;

        // ---- background
        if (st == 2) {
            dc.setColor(0xE6D6B2, -1);
            dc.fillCircle(CX, CY, 227);
            dc.setColor(bg, -1);
            dc.fillCircle(CX, CY, 214);
            dc.setColor(0xD8C49C, -1);
            dc.setPenWidth(2);
            dc.drawCircle(CX, CY, 220);
            var s = 4711;
            dc.setColor(0xE0CFA9, -1);
            for (var i = 0; i < 46; i++) {
                s = G.rnd(s);
                var ang = G.rf(s) * 360;
                s = G.rnd(s);
                var r = Math.sqrt(G.rf(s)) * 205;
                dc.fillRectangle(G.ptX(CX, r, ang), G.ptY(CY, r, ang), 2, 2);
            }
        } else if (st == 3) {
            dc.setColor(bg, -1);
            dc.fillCircle(CX, CY, 227);
            var s = 1234;
            for (var i = 0; i < 28; i++) {
                s = G.rnd(s);
                var ang = G.rf(s) * 360;
                s = G.rnd(s);
                var r = 30 + G.rf(s) * 190;
                dc.setColor(i % 3 == 0 ? 0x4A5F9A : 0x26386A, -1);
                dc.fillRectangle(G.ptX(CX, r, ang), G.ptY(CY, r, ang), 2, 2);
            }
        }

        // ---- route
        var rp = G.easeInOut(G.clamp(p / 0.7, 0.0, 1.0));
        var shown = Math.floor(rp * (NS - 1) + 0.001).toNumber();
        var solidEnd = di * SEG;
        if (shown > 0 && solidEnd > 0) {
            var e = shown < solidEnd ? shown : solidEnd;
            if (glow != -1) {
                dc.setColor(glow, -1);
                dc.setPenWidth(10);
                for (var i = 0; i < e; i++) {
                    dc.drawLine(RX[i], RY[i], RX[i + 1], RY[i + 1]);
                }
            }
            dc.setColor(done, -1);
            dc.setPenWidth(4);
            for (var i = 0; i < e; i++) {
                dc.drawLine(RX[i], RY[i], RX[i + 1], RY[i + 1]);
                dc.fillCircle(RX[i + 1], RY[i + 1], 1.8);
            }
        }
        for (var i = solidEnd; i <= shown; i++) {
            var tday = i < solidEnd + SEG;
            dc.setColor(tday ? tod : fut, -1);
            dc.fillCircle(RX[i], RY[i], tday ? 2.2 : 1.9);
        }

        // ---- START / ZIEL
        dc.setColor(ink, -1);
        dc.setPenWidth(4);
        dc.drawLine(RX[0] - 9, RY[0] + 3, RX[0] + 9, RY[0] - 3);
        dc.setColor(sub, -1);
        F.px(dc, "START", RX[0] + 14, RY[0] - 2, 2, 0, 0);
        if (shown >= NS - 1) {
            F.px(dc, "ZIEL", RX[NS - 1] - 14, RY[NS - 1] + 5, 2, 2, 0);
        }

        // ---- stage dots
        for (var k = 0; k < 7; k++) {
            var i = (k + 1) * SEG;
            var pk = G.clamp((rp * (NS - 1) - i) / 10.0 + 1.0, 0.0, 1.0);
            if (pk <= 0) {
                continue;
            }
            var sc = G.spring(pk);
            var x = RX[i];
            var y = RY[i];
            var isW = ((d.trainMask >> k) & 1) == 1 && k <= di;
            var wt = G.clamp((rp * (NS - 1) - i) / 12.0, 0.0, 1.0);
            // today's pulse
            if (k == di && live) {
                var ph = (t % 1400) / 1400.0;
                dc.setColor(G.mix(bg, isW ? won : tod, 1 - ph), -1);
                dc.setPenWidth(2);
                dc.drawCircle(x, y, 9 + ph * 12);
            }
            if (isW) {
                var r = 8 * sc;
                if (glow != -1) {
                    dc.setColor(G.dim(won, 0.3), -1);
                    dc.fillCircle(x, y, r + 5);
                }
                if (st == 2) {
                    dc.setColor(ink, -1);
                    dc.fillCircle(x, y, r + 2);
                }
                dc.setColor(G.mix(st == 2 ? bg : 0xFFFFFF, won, wt), -1);
                dc.fillCircle(x, y, r);
                // pennant on a pole (springs up)
                var fs = G.spring(G.clamp(wt * 1.4 - 0.2, 0.0, 1.0));
                if (fs > 0.02 && k < 6) {
                    dc.setColor(ink, -1);
                    dc.setPenWidth(2);
                    dc.drawLine(x + 5, y - 3, x + 5, y - 3 - 16 * fs);
                    dc.setColor(won, -1);
                    dc.fillPolygon([[x + 6, y - 3 - 16 * fs], [x + 6 + 10 * fs, y - 3 - 13 * fs], [x + 6, y - 3 - 10 * fs]]);
                }
                dc.setColor(st == 2 ? ink : 0x000000, -1);
                dc.fillCircle(x, y, 2.5 * sc);
            } else if (k < di) {
                dc.setColor(rest, -1);
                dc.fillCircle(x, y, 5 * sc);
            } else if (k == di) {
                dc.setColor(tod, -1);
                dc.fillCircle(x, y, 7 * sc);
                dc.setColor(bg, -1);
                dc.fillCircle(x, y, 3 * sc);
            } else {
                dc.setColor(bg, -1);
                dc.fillCircle(x, y, 6 * sc);
                dc.setColor(fut == 0x4A4A4A ? 0x777777 : fut, -1);
                dc.setPenWidth(2);
                dc.drawCircle(x, y, 6 * sc);
            }
            // finish flag (checkered) at the ZIEL
            if (k == 6) {
                var fx = x + 8;
                var fy = y - 18;
                dc.setColor(ink, -1);
                dc.setPenWidth(2);
                dc.drawLine(fx, y + 4, fx, fy);
                for (var rr = 0; rr < 3; rr++) {
                    for (var c = 0; c < 4; c++) {
                        dc.setColor((rr + c) % 2 == 0 ? ink : (st == 2 ? bg : 0x000000), -1);
                        dc.fillRectangle(fx + 1 + c * 4, fy + rr * 4, 4, 4);
                    }
                }
                dc.setColor(ink, -1);
                dc.setPenWidth(1);
                dc.drawRectangle(fx + 1, fy, 16, 12);
            }
            // weekday label, inside the loop
            var dx = CX - x;
            var dy = CY - y;
            var ln = Math.sqrt(dx * dx + dy * dy);
            var lx = x + dx / ln * 24;
            var ly = y + dy / ln * 24;
            dc.setColor(k == di ? (st == 1 ? acc : ink) : sub, -1);
            F.px(dc, DAYS[k], lx, ly - 7, 2, 1, 0);
        }

        // ---- rider on today's stage
        if (p > 0.75) {
            var f;
            if (live) {
                f = (t % 5200) / 5200.0;
            } else {
                f = G.clamp(d.mins / 1440.0, 0.08, 0.92);
            }
            var u = (di * SEG + f * SEG) / (NS - 1.0);
            var rp2 = routePt(u);
            rider(dc, rp2[0], rp2[1] - 2, rp2[2], st == 1 ? acc : (st == 2 ? 0x8B2A1B : 0xFF5AD1), ink, live ? (t % 600) * 0.6 : 40);
        }

        // ---- time
        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        var ts = hh + ":" + G.pad2(d.m);
        var tp = G.ease(G.clamp(p * 1.5, 0.0, 1.0));
        if (st == 1) {
            dc.setColor(ink, -1);
            F.st(dc, ts, CX, 167, 66, 8, 1, tp, 0.12);
        } else if (st == 2) {
            dc.setColor(ink, -1);
            F.st(dc, ts, CX, 167, 66, 5, 1, tp, 0);
        } else {
            dc.setColor(0x123A73, -1);
            F.st(dc, ts, CX, 167, 66, 13, 1, tp, 0);
            dc.setColor(ink, -1);
            F.st(dc, ts, CX, 167, 66, 5, 1, tp, 0);
        }
        dc.setColor(G.mix(bg, sub, tp), -1);
        F.px(dc, "KW " + d.wk, CX, 100, 2, 1, 0);

        // ---- stage line: "ETAPPE 5 · FREITAG"
        var lp = G.ease(G.stag(p, 3, 0.1, 0.4));
        if (lp > 0) {
            var s1 = "ETAPPE " + (di + 1);
            var s2 = DAYN[di];
            var w1 = F.stW(s1, 15);
            var w2 = F.stW(s2, 15);
            var x0 = CX - (w1 + 20 + w2) / 2;
            var ly = 226;
            if (st == 2) {
                // vintage ribbon
                var rw = w1 + w2 + 56;
                dc.setColor(0x6E4423, -1);
                dc.fillPolygon([[CX - rw / 2 - 14, ly - 10], [CX - rw / 2 + 4, ly - 10], [CX - rw / 2 + 4, ly + 14], [CX - rw / 2 - 14, ly + 14], [CX - rw / 2 - 7, ly + 2]]);
                dc.fillPolygon([[CX + rw / 2 + 14, ly - 10], [CX + rw / 2 - 4, ly - 10], [CX + rw / 2 - 4, ly + 14], [CX + rw / 2 + 14, ly + 14], [CX + rw / 2 + 7, ly + 2]]);
                dc.setColor(0x8B5A2B, -1);
                dc.fillRectangle(CX - rw / 2, ly - 14, rw, 26);
            }
            var c1 = st == 2 ? 0xF1E6CC : (st == 1 ? acc : done);
            var c2 = st == 2 ? 0xF1E6CC : ink;
            dc.setColor(G.mix(bg, c1, lp), -1);
            F.st(dc, s1, x0, ly - 1, 15, 3, 0, 1.0, 0);
            dc.fillCircle(x0 + w1 + 10, ly - 1, 2.5);
            dc.setColor(G.mix(bg, c2, lp), -1);
            F.st(dc, s2, x0 + w1 + 20, ly - 1, 15, 3, 0, 1.0, 0);
        }

        // ---- stage profile of today
        var pp = G.ease(G.stag(p, 4, 0.1, 0.4));
        if (pp > 0) {
            var trained = ((d.trainMask >> di) & 1) == 1;
            var pc;
            if (st == 2) {
                pc = trained ? 0x8B5A2B : 0xC9B48E;
            } else if (st == 3) {
                pc = trained ? 0x27A6C9 : 0x24386C;
            } else {
                pc = trained ? G.dim(acc, 0.75) : 0x3A3A3A;
            }
            profile(dc, CX - 70, 282, TYP[di], di, pc, st == 2 ? ink : (trained ? acc : sub), pp);
            dc.setColor(sub, -1);
            F.px(dc, TYPN[TYP[di]], CX, 288, 2, 1, 0);
        }

        // ---- jerseys
        var km = d.wkBike > 0 ? d.wkBike / 1000.0 : 0.0;
        var kg = d.cfg.bikeGoal > 0 ? d.cfg.bikeGoal : 1;
        var hmv = d.floorsWeek > 0 ? d.floorsWeek * 3 : 0;
        var fr = [km / kg, d.dayGoal > 0 ? d.trainDays.toFloat() / d.dayGoal : 0.0, hmv / 1500.0];
        var vals = [Math.floor(km).toNumber() + "/" + kg, d.trainDays + "/" + d.dayGoal, G.num(hmv) + "/" + G.num(1500)];
        var units = ["KM", "TAGE", "HM"];
        for (var k = 0; k < 3; k++) {
            var jp = G.stag(p, k, 0.1, 0.45);
            var js = G.spring(jp);
            if (jp <= 0) {
                continue;
            }
            var fill = G.clamp(fr[k], 0.0, 1.0) * G.ease(G.stag(p - 0.35, k, 0.1, 0.45));
            var worn = fr[k] >= 1 && p >= 1;
            var sp = worn && live ? ((t + k * 400) % 2400) / 2400.0 : (worn ? 0.15 + k * 0.1 : -1);
            jersey(dc, JX[k], JY, 0.82 * js, k, fill, worn, st, bg, sp);
            var vc = worn ? (st == 2 ? ink : (k == 2 ? 0xFFFFFF : G.mix(JCOL[k], 0xFFFFFF, 0.2))) : ink;
            dc.setColor(G.mix(bg, vc, jp), -1);
            F.px(dc, vals[k], JX[k], JY + 30, 2, 1, 0);
            dc.setColor(G.mix(bg, sub, jp), -1);
            F.px(dc, units[k], JX[k], JY + 48, 2, 1, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        geo();
        var RX = _rx;
        var RY = _ry;
        var o = St.shift(d);
        var ox = o[0];
        var oy = o[1];
        var di = G.clamp(d.dayIdx, 0, 6);
        dc.setColor(0x3A3A3A, -1);
        for (var i = 0; i < NS; i += 2) {
            dc.fillRectangle(RX[i] + ox - 1, RY[i] + oy - 1, 2, 2);
        }
        for (var k = 0; k < 7; k++) {
            var i = (k + 1) * SEG;
            var isW = ((d.trainMask >> k) & 1) == 1 && k <= di;
            dc.setColor(isW ? G.dim(d.accent, 0.6) : (k == di ? 0x8A8A8A : 0x4A4A4A), -1);
            if (isW) {
                dc.fillCircle(RX[i] + ox, RY[i] + oy, 5);
            } else {
                dc.setPenWidth(2);
                dc.drawCircle(RX[i] + ox, RY[i] + oy, 5);
            }
        }
        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        dc.setColor(0x9A9A9A, -1);
        F.st(dc, hh + ":" + G.pad2(d.m), CX + ox, 167 + oy, 66, 3, 1, 1.0, 0.12);
        dc.setColor(G.dim(d.accent, 0.55), -1);
        F.st(dc, "ETAPPE " + (di + 1), CX + ox, 226 + oy, 15, 2, 1, 1.0, 0);
    }
}
