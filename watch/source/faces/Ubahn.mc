import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// UBAHN — "U-Bahn-Netz": your day as a metro map. Six lines leave the central station (midnight)
// and run out to their terminus (the goal): U1 steps, U2 floors, U3 intensity minutes, U4 Body
// Battery, U5 sleep score, U6 calories. Each train stands as far out as you have got; the part of a
// line already travelled is drawn in full colour, a line that reached its goal flashes its terminus.
// On every wrist raise the trains pull out of the central station. A departure board shows the time,
// the status line reports the service (disruption when stressed, a weak line when the Body Battery
// is low, night service), and the announcement ticker runs through everything else the watch knows:
// messages, phone link, weather, sun, pulse, SpO2, breathing, battery, altitude, pressure, VO2max.
// Styles: 1 Netzplan, 2 Nacht, 3 Gameboy. Mirrors web/js/faces/ubahn.js.
class FaceUbahn extends Face {
    const HX = 227;
    const HY = 232;
    const LW = 10;
    const PATHS = [
        [227, 232, 60, 232],
        [227, 232, 394, 232],
        [227, 232, 167, 172, 90, 172],
        [227, 232, 287, 172, 364, 172],
        [227, 232, 167, 292, 90, 292],
        [227, 232, 287, 292, 364, 292]
    ];
    // label per line: x, y of the name, y of the value, alignment (0 left, 2 right)
    const LBL = [40, 206, 248, 0, 414, 206, 248, 2, 76, 132, 142, 0, 378, 132, 142, 2, 76, 326, 306, 0, 378, 326, 306, 2];
    const NAMES = ["SCHRITTE", "ETAGEN", "AKTIV-MIN", "BATTERY", "SCHLAF", "KCAL"];

    hidden var _tk = "";
    hidden var _tkKey = -1;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    hidden function sgn(v) as Number {
        return v > 0 ? 1 : v < 0 ? -1 : 0;
    }

    hidden function plen(pts as Array<Number>) as Number {
        var L = 0;
        for (var i = 2; i < pts.size(); i += 2) {
            var ax = (pts[i] - pts[i - 2]).abs();
            var ay = (pts[i + 1] - pts[i - 1]).abs();
            L += ax > ay ? ax : ay;
        }
        return L;
    }

    // point at distance s (in steps along the path; diagonals count their x extent)
    hidden function pointAt(pts as Array<Number>, s) as Array {
        for (var i = 2; i < pts.size(); i += 2) {
            var dx = pts[i] - pts[i - 2];
            var dy = pts[i + 1] - pts[i - 1];
            var l = dx.abs() > dy.abs() ? dx.abs() : dy.abs();
            if (s <= l || i == pts.size() - 2) {
                var t = l > 0 ? (s / l.toFloat() < 1 ? s / l.toFloat() : 1.0) : 0.0;
                return [pts[i - 2] + dx * t, pts[i - 1] + dy * t];
            }
            s -= l;
        }
        return [pts[0], pts[1]];
    }

    // draws the path from distance a to b with width LW: straight runs as one rectangle, diagonals stepped
    hidden function path(dc as Dc, pts as Array<Number>, a, b) as Void {
        var s0 = 0;
        for (var i = 2; i < pts.size(); i += 2) {
            var x0 = pts[i - 2];
            var y0 = pts[i - 1];
            var dx = pts[i] - x0;
            var dy = pts[i + 1] - y0;
            var l = dx.abs() > dy.abs() ? dx.abs() : dy.abs();
            var u0 = (a > s0 ? a : s0) - s0;
            var u1 = (b < s0 + l ? b : s0 + l) - s0;
            if (u1 > u0) {
                var sx = sgn(dx);
                var sy = sgn(dy);
                if (dx == 0 || dy == 0) {
                    var xa = (x0 + sx * u0).toNumber();
                    var xb = (x0 + sx * u1).toNumber();
                    var ya = (y0 + sy * u0).toNumber();
                    var yb = (y0 + sy * u1).toNumber();
                    dc.fillRectangle((xa < xb ? xa : xb) - LW / 2, (ya < yb ? ya : yb) - LW / 2, (xb - xa).abs() + LW, (yb - ya).abs() + LW);
                } else {
                    for (var u = (u0 / 2).toNumber() * 2; u <= u1; u += 2) {
                        dc.fillRectangle(x0 + sx * u - LW / 2, y0 + sy * u - LW / 2, LW, LW);
                    }
                }
            }
            s0 += l;
        }
    }

    hidden function r(v, g) as Float {
        return v >= 0 && g > 0 ? G.clamp(v / g.toFloat(), 0, 1).toFloat() : 0.0;
    }

    // the six lines: [fraction 0..1, value text]
    hidden function lines(d as D) as Array {
        return [
            [r(d.steps, d.stepGoal), d.steps >= 0 ? G.num(d.steps) : "--"],
            [r(d.floors, d.floorsGoal), d.floors >= 0 ? "" + d.floors : "--"],
            [r(d.imWeek, d.imGoal), d.imWeek >= 0 ? "" + d.imWeek : "--"],
            [r(d.bb, 100), d.bb >= 0 ? d.bb + "%" : "--"],
            [r(d.sleep, 100), d.sleep >= 0 ? "" + d.sleep : "--"],
            [r(d.kcal, 2500), d.kcal >= 0 ? G.num(d.kcal) : "--"]
        ];
    }

    // service status line
    hidden function status(d as D, L as Array) as String {
        if (d.mins >= 60 && d.mins < 270) {
            return "BETRIEBSRUHE";
        }
        if (d.stress >= 60) {
            return "STÖRUNG: STRESS " + d.stress;
        }
        if (d.bb >= 0 && d.bb < 25) {
            return "U4 FÄHRT VERKÜRZT";
        }
        var n = 0;
        for (var k = 0; k < L.size(); k++) {
            if (((L[k] as Array)[0] as Float) >= 1) {
                n++;
            }
        }
        return n == 0 ? "NORMALBETRIEB" : n == 1 ? "1 LINIE AM ZIEL" : n + " LINIEN AM ZIEL";
    }

    // the announcement ticker: urgent announcements first (messages, lost phone link, stress, low Body
    // Battery, low watch battery), then the rest of the network report rotated by the raise counter, so
    // every look starts with something new. Watch faces only get the number of notifications, not their text.
    const FUN = ["ZURÜCKBLEIBEN BITTE!", "VORSICHT AN DER BAHNSTEIGKANTE", "BITTE LASSEN SIE ZUERST AUSSTEIGEN",
        "ROLLTREPPE DEFEKT - DIE TREPPE ZÄHLT ALS ETAGE", "BITTE HALTEN SIE SICH FEST", "NÄCHSTER HALT: DEIN ZIEL",
        "DIESER ZUG ENDET UM MITTERNACHT"];

    hidden function ticker(d as D) as String {
        var pri = "";
        var n = d.notif > 0 ? d.notif : 0;
        if (n > 0) {
            pri += "ACHTUNG: " + n + (n == 1 ? " NEUE NACHRICHT" : " NEUE NACHRICHTEN") + " - BITTE HANDY PRÜFEN +++ ";
        }
        if (!d.phone) {
            pri += "FUNKLOCH IM TUNNEL - HANDY NICHT ERREICHBAR +++ ";
        }
        if (d.stress >= 60) {
            pri += "STÖRUNG IM BETRIEBSABLAUF: STRESS " + d.stress + " - BITTE TIEF DURCHATMEN +++ ";
        }
        if (d.bb >= 0 && d.bb < 25) {
            pri += "U4 FÄHRT MIT RESERVESTROM (" + d.bb + "%) - BITTE PAUSE EINLEGEN +++ ";
        }
        if (d.batt < 20) {
            pri += "UHRAKKU " + d.batt + "% - BITTE BALD LADEN +++ ";
        }
        var sg = d.stepGoal > 0 ? d.stepGoal : 10000;
        var fg = d.floorsGoal > 0 ? d.floorsGoal : 10;
        var ig = d.imGoal > 0 ? d.imGoal : 150;
        var st = d.steps > 0 ? d.steps : 0;
        var fl = d.floors > 0 ? d.floors : 0;
        var im = d.imWeek > 0 ? d.imWeek : 0;
        var t = [] as Array<String>;
        t.add(st >= sg ? "U1 HAT DIE ENDSTATION ERREICHT - ALLE AUSSTEIGEN!" : "U1: NOCH " + G.num(sg - st) + " SCHRITTE BIS ZUR ENDSTATION");
        t.add(fl >= fg ? "U2 AM ZIEL - ALLE ETAGEN BEDIENT" : "U2: NOCH " + (fg - fl) + " ETAGEN - TREPPE STATT ROLLTREPPE!");
        t.add(im >= ig ? "U3: WOCHENZIEL GESCHAFFT" : "U3: NOCH " + (ig - im) + " AKTIVMINUTEN DIESE WOCHE");
        if (d.bb >= 70) {
            t.add("U4 VOLL GELADEN (" + d.bb + "%) - FREIE FAHRT");
        }
        if (d.sleep >= 0) {
            t.add(d.sleep < 60 ? "U5 HEUTE VERSPÄTET: SCHLAF NUR " + d.sleep : "U5 PÜNKTLICH: SCHLAF " + d.sleep);
        }
        if (d.hr > 0) {
            t.add(d.hr >= 100 ? "PULS " + d.hr + " - ACHTUNG, SCHNELLZUG!" : "PULS " + d.hr + " - DER ZUG ROLLT RUHIG");
        }
        if (d.glances > 0) {
            t.add("SIE HABEN HEUTE " + d.glances + " MAL AUF DIE UHR GESCHAUT");
        }
        if (d.temp > -99) {
            t.add("AUSSEN " + d.temp + "°" + (d.rain >= 50 ? " - REGEN " + d.rain + "%, SCHIRM MITNEHMEN!" : d.rain >= 0 ? ", REGEN " + d.rain + "%" : ""));
        }
        if (d.sunrise > 0) {
            t.add(d.mins < d.sunset ? "LETZTE SONNE UM " + G.hm(d.sunset) : "SONNENAUFGANG UM " + G.hm(d.sunrise));
        }
        if (d.spo2 > 0) {
            t.add("SAUERSTOFF " + d.spo2 + "%" + (d.resp > 0 ? ", " + d.resp + " ATEMZÜGE/MIN" : ""));
        }
        if (d.batt >= 20) {
            t.add("UHRAKKU " + d.batt + "%" + (d.battDays > 0 ? " - REICHT NOCH " + d.battDays + " TAGE" : ""));
        }
        if (d.alt >= 0 && d.pres > 0) {
            t.add("HÖHE " + Math.round(d.alt).toNumber() + " M, " + Math.round(d.pres / 100.0).toNumber() + " HPA");
        }
        t.add(FUN[d.wakeN.abs() % FUN.size()]);
        var r = d.wakeN.abs() % t.size();
        var out = "+++ " + pri;
        for (var i = 0; i < t.size(); i++) {
            out += t[(r + i) % t.size()] + " +++ ";
        }
        return out;
    }

    // [map, band, LED, LED dim, map text, map text dim, station, station ring, U1..U6, hub]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x0A0C14, 0x000000, 0xFFB02A, 0x6A4A14, 0xE8E8F0, 0x8A8A9A, 0x0A0C14, 0xE8E8F0,
                0xFF3A4A, 0xFF9A2A, 0x3AE07A, 0xFFE03A, 0xB46AFF, 0x3AB4FF, acc] as Array<Number>;
        }
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var e = 0x9BBC0F;
            return [e, a, e, b, a, b, e, a, a, b, a, b, a, b, a] as Array<Number>;
        }
        return [0xF4F2EC, 0x14161C, 0xFFB02A, 0x5A4214, 0x1A1A22, 0x6A6A72, 0xFFFFFF, 0x1A1A22,
            0xE3242B, 0xF08A00, 0x00A650, 0xF2C500, 0x8C3FA0, 0x0078C8, acc] as Array<Number>;
    }

    // static layer: bands, board, map with lines, stations and labels, status; the trains, the
    // flashing termini and the ticker move
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
        var L = lines(d);

        if (S) {
            // ---- map and the two dark bands (departure board, announcements)
            dc.setColor(P[0], -1);
            dc.fillRectangle(0, 106, 454, 244);
            dc.setColor(P[1], -1);
            dc.fillRectangle(0, 0, 454, 106);
            dc.fillRectangle(0, 350, 454, 104);
            dc.setColor(P[14], -1);
            dc.fillRectangle(0, 104, 454, 2);
            dc.fillRectangle(0, 350, 454, 2);

            // ---- departure board
            dc.setColor(P[3], -1);
            F.px(dc, "U-BAHN  HBF", 227, 18, 1, 1, 0);
            dc.setColor(P[2], -1);
            F.px(dc, G.timeStr(d), 227, 32, 5, 1, 0);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr + (d.temp > -99 ? "  " + d.temp + "°" : ""), 227, 78, 2, 1, 0);

            // ---- lines: faded beyond the train, full colour where it has been
            for (var k = 0; k < 6; k++) {
                var pts = PATHS[k] as Array<Number>;
                var len = plen(pts);
                dc.setColor(G.mix(P[8 + k], P[0], 0.7), -1);
                path(dc, pts, 0, len);
                dc.setColor(P[8 + k], -1);
                path(dc, pts, 0, len * ((L[k] as Array)[0] as Float));
            }
            // ---- stations, termini with their line badge and the metric
            for (var k = 0; k < 6; k++) {
                var pts = PATHS[k] as Array<Number>;
                var len = plen(pts);
                for (var j = 1; j <= 3; j++) {
                    var q = pointAt(pts, len * j / 4.0);
                    var qx = Math.round(q[0]).toNumber();
                    var qy = Math.round(q[1]).toNumber();
                    dc.setColor(P[7], -1);
                    dc.fillRectangle(qx - 6, qy - 6, 12, 12);
                    dc.setColor(P[6], -1);
                    dc.fillRectangle(qx - 3, qy - 3, 6, 6);
                }
                var tx = pts[pts.size() - 2];
                var ty = pts[pts.size() - 1];
                dc.setColor(P[7], -1);
                dc.fillRectangle(tx - 17, ty - 11, 34, 22);
                dc.setColor(P[8 + k], -1);
                dc.fillRectangle(tx - 15, ty - 9, 30, 18);
                dc.setColor(st == 3 ? P[6] : 0xFFFFFF, -1);
                F.px(dc, "U" + (k + 1), tx, ty - 6, 2, 1, 0);
                var lx = LBL[k * 4];
                var al = LBL[k * 4 + 3];
                dc.setColor(P[5], -1);
                F.px(dc, NAMES[k], lx, LBL[k * 4 + 1], 1, al, 0);
                dc.setColor(P[4], -1);
                F.px(dc, (L[k] as Array)[1] as String, lx, LBL[k * 4 + 2], 2, al, 0);
            }
            // ---- central station
            dc.setColor(P[7], -1);
            dc.fillRectangle(HX - 16, HY - 16, 32, 32);
            dc.setColor(P[6], -1);
            dc.fillRectangle(HX - 12, HY - 12, 24, 24);
            dc.setColor(P[14], -1);
            dc.fillRectangle(HX - 6, HY - 6, 12, 12);

            // ---- service status
            dc.setColor(P[2], -1);
            F.px(dc, status(d, L), 227, 394, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        // ---- trains pull out of the central station on every raise
        for (var k = 0; k < 6; k++) {
            var pts = PATHS[k] as Array<Number>;
            var len = plen(pts);
            var fk = (L[k] as Array)[0] as Float;
            // a train at its goal waits just before the terminus badge
            var s = len * fk * G.ease(G.stag(p, k, 0.06, 0.6));
            var q = pointAt(pts, s < len - 26 ? s : len - 26);
            var x = Math.round(q[0]).toNumber();
            var y = Math.round(q[1]).toNumber();
            dc.setColor(P[7], -1);
            dc.fillRectangle(x - 9, y - 9, 18, 18);
            dc.setColor(P[8 + k], -1);
            dc.fillRectangle(x - 6, y - 6, 12, 12);
            dc.setColor(P[6], -1);
            dc.fillRectangle(x - 2, y - 4, 4, 4);
            // a line at its goal flashes its terminus
            if (fk >= 1 && p >= 1 && live && (tt / 500) % 2 == 0) {
                var tx = pts[pts.size() - 2];
                var ty = pts[pts.size() - 1];
                dc.setColor(P[14], -1);
                dc.fillRectangle(tx - 19, ty - 13, 38, 2);
                dc.fillRectangle(tx - 19, ty + 11, 38, 2);
            }
        }
        // ---- announcement ticker (only the visible characters are drawn)
        var tk = d.mins * 7919 + d.wakeN;
        if (_tkKey != tk) {
            _tkKey = tk;
            _tk = ticker(d);
        }
        var n = _tk.length();
        var cw = 12;
        var view = 21;
        var off = live ? (tt / 22) % (n * cw) : 0;
        var i0 = off / cw;
        var vis;
        if (i0 + view + 1 <= n) {
            vis = _tk.substring(i0, i0 + view + 1);
        } else {
            vis = _tk.substring(i0, n) + _tk.substring(0, i0 + view + 1 - n);
        }
        dc.setColor(P[2], -1);
        F.px(dc, vis, 227 - view * cw / 2 - off % cw, 366, 2, 0, 0);
        dc.setColor(P[1], -1);
        dc.fillRectangle(0, 362, 96, 22);
        dc.fillRectangle(358, 362, 96, 22);
        // a bell rings beside the ticker while messages are waiting
        if (d.notif > 0 && (!live || (tt / 400) % 2 == 0)) {
            dc.setColor(P[2], -1);
            dc.fillRectangle(78, 364, 8, 4);
            dc.fillRectangle(76, 368, 12, 8);
            dc.fillRectangle(74, 376, 16, 3);
            dc.fillRectangle(80, 380, 4, 3);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        dc.setColor(st == 3 ? 0x306230 : 0x3A3A42, -1);
        for (var k = 0; k < 6; k++) {
            var pts = PATHS[k] as Array<Number>;
            var len = plen(pts);
            for (var s = 0; s <= len; s += 12) {
                var q = pointAt(pts, s);
                dc.fillRectangle(Math.round(q[0]).toNumber() - 1 + o[0], Math.round(q[1]).toNumber() - 1 + o[1], 3, 3);
            }
        }
        dc.setColor(st == 3 ? 0x8BAC0F : G.dim(0xFFB02A, 0.6), -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 32 + o[1], 5, 1, 1);
    }
}
