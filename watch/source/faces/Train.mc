import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// TRAIN — "Pixel-Zug": a steam train crossing the week. Every training day hooks on another loaded
// wagon (logs, coal, crates, barrels, hay, parcels, a passenger coach), the weekly day goal is the
// station. On every wrist raise the train rolls in and stops with a hiss of brake steam; at the goal
// it stands at the station platform. After dark it runs as the night train with its lamp lit, under
// the real sky. The three data slots are on the timetable board.
// The line lives with the year and the real weather (Season.mc): snowy hills and a snowed-in station,
// autumn-golden hills, rain or snow falling, fairy lights on the station in Advent and a tree by the
// track, fireworks on New Year's Eve, eggs, a pumpkin, a heart or birthday balloons by the line.
// Styles: 1 Dampf, 2 Nacht, 3 Gameboy. Mirrors web/js/faces/train.js.
class FaceTrain extends Face {
    const RAIL = 328;
    const LX = 268;
    const WW = 52;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    hidden function goal(d as D) as Number {
        return d.dayGoal > 0 ? d.dayGoal : 4;
    }

    hidden function wagons(d as D) as Number {
        var n = d.trainDays > 0 ? d.trainDays : 0;
        return n < 7 ? n : 7;
    }

    // [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, hill far, hill near,
    //  grass, gravel, sleeper, rail, text, text dim, loco, black, band, cab glass, buffer, spokes, lamp, wagon,
    //  wagon dark, logs, coal, crate, barrel, hay, parcel, coach, station wall, station roof, platform, board,
    //  board text, smoke, star, signal post]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [c, e, b, c, a, a, b, b, c, b, a, a, a, b, a, a, e, e, a, c, e, b, a, b, a, b, a, c, e, b, e, a, b, a, e, e, e, a] as Array<Number>;
        }
        return [0x3A8AD8, 0xA8D8FF, 0x5A4A9A, 0xFF9A6A, 0x060A20, 0x141C44, 0x6A9A7A, 0x4A8A4A, 0x3A7A32, 0x8A8478,
            0x5A3A24, 0xC8C8D0, 0xFFFFFF, 0xE8F0E0, 0x2A2A30, 0x141414, acc, 0xFFE08A, 0xD8302A, 0xB0B0B8, 0xFFF2A0, 0x8A3A24,
            0x5A2418, 0xA8743A, 0x2A2A2E, 0xD88A3A, 0x7A4A2A, 0xE8C858, 0xF4F0E6, 0x2A5A8A, 0xE8D8B8, 0x8A3A2A, 0xB8B0A0,
            0x1E2A4A, 0xFFFFFF, 0xE8E8EE, 0xFFFFFF, 0x3A3A40] as Array<Number>;
    }

    // one wagon with its cargo kind k at x (wheels on the rail)
    hidden function wagon(dc as Dc, P as Array<Number>, x as Number, k as Number, wf as Boolean) as Void {
        var y = RAIL - 58;
        dc.setColor(P[22], -1);
        dc.fillRectangle(x, y + 22, 48, 14);
        dc.setColor(k == 6 ? P[29] : P[21], -1);
        dc.fillRectangle(x, y + (k == 6 ? 0 : 10), 48, k == 6 ? 32 : 22);
        dc.setColor(P[22], -1);
        dc.fillRectangle(x - 4, y + 30, 4, 4);
        if (k == 0) {
            dc.setColor(P[23], -1);
            for (var i = 0; i < 3; i++) {
                dc.fillRectangle(x + 2, y - 2 + i * 6, 44, 5);
            }
            dc.setColor(G.mix(P[23], 0xFFFFFF, 0.3), -1);
            for (var i = 0; i < 3; i++) {
                dc.fillRectangle(x + 2, y - 2 + i * 6, 4, 5);
            }
        } else if (k == 1) {
            dc.setColor(P[24], -1);
            dc.fillRectangle(x + 4, y + 2, 40, 8);
            dc.fillRectangle(x + 12, y - 4, 24, 6);
        } else if (k == 2) {
            dc.setColor(P[25], -1);
            dc.fillRectangle(x + 4, y - 4, 18, 14);
            dc.fillRectangle(x + 26, y, 18, 10);
            dc.setColor(G.mix(P[25], 0, 0.35), -1);
            dc.fillRectangle(x + 4, y + 2, 18, 2);
        } else if (k == 3) {
            dc.setColor(P[26], -1);
            for (var i = 0; i < 3; i++) {
                dc.fillRectangle(x + 4 + i * 14, y - 6, 12, 16);
            }
            dc.setColor(G.mix(P[26], 0, 0.4), -1);
            for (var i = 0; i < 3; i++) {
                dc.fillRectangle(x + 4 + i * 14, y, 12, 2);
            }
        } else if (k == 4) {
            dc.setColor(P[27], -1);
            dc.fillRectangle(x + 2, y - 2, 44, 12);
            dc.fillRectangle(x + 8, y - 8, 32, 6);
        } else if (k == 5) {
            dc.setColor(P[28], -1);
            dc.fillRectangle(x + 4, y - 2, 16, 12);
            dc.fillRectangle(x + 24, y - 6, 20, 16);
            dc.setColor(P[16], -1);
            dc.fillRectangle(x + 11, y - 2, 2, 12);
            dc.fillRectangle(x + 33, y - 6, 2, 16);
        } else {
            dc.setColor(P[17], -1);
            for (var i = 0; i < 3; i++) {
                dc.fillRectangle(x + 4 + i * 15, y + 6, 10, 10);
            }
            dc.setColor(G.mix(P[29], 0, 0.4), -1);
            dc.fillRectangle(x - 2, y - 2, 52, 4);
        }
        var w = wf ? SprTrain.WHEEL_B : SprTrain.WHEEL_A;
        var wp = [-1, -1, P[15], -1, -1, -1, P[19]];
        Spr.draw(dc, w, x + 2, RAIL - 24, 3, wp, false);
        Spr.draw(dc, w, x + 22, RAIL - 24, 3, wp, false);
    }

    // static layer: sky, hills, track, station or signal, timetable board, texts; the train, its
    // smoke, the brake steam and the lamp beam move
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
        var n = wagons(d);
        var gl = goal(d);
        var done = n >= gl;
        var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var k = st == 2 ? 2 : el > 6 ? 0 : el > -6 ? 1 : 2;
        var night = k == 2;
        var ev = Season.event(d);
        var xmas = ev == Season.ADVENT || ev == Season.XMAS;
        var sn = st != 3 && Season.snowy(d);

        if (S) {
            // ---- sky, sun / stars
            for (var i = 0; i < 6; i++) {
                dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 5.0), -1);
                dc.fillRectangle(0, i * 50, 454, 50);
            }
            if (night) {
                dc.setColor(P[36], -1);
                for (var i = 0; i < 26; i++) {
                    var ss = i % 6 == 0 ? 4 : 2;
                    dc.fillRectangle(30 + ((i * 101 + 17) % 394), 96 + ((i * 47 + 11) % 130), ss, ss);
                }
            } else if (el > -4) {
                dc.setColor(st == 3 ? 0x9BBC0F : 0xFFF6D0, -1);
                dc.fillCircle(100, 230 - Math.round(G.clamp(el, -4, 40) * 3.5).toNumber(), 14);
            }

            // ---- hills, meadow
            var dim = night && st != 3 ? 0.55 : 0.0;
            var gold = st != 3 && !sn && Season.season(d) == 3;
            dc.setColor(G.mix(sn ? 0xC8D4E2 : gold ? 0xB89A4A : P[6], 0x050814, dim), -1);
            for (var x = 0; x < 454; x += 4) {
                var h = 50 + Math.round(26 * Math.sin(x / 60.0 + 2) + 14 * Math.sin(x / 23.0)).toNumber();
                dc.fillRectangle(x, 300 - h, 4, h);
            }
            dc.setColor(G.mix(sn ? 0xDCE6F0 : gold ? 0x9A7A3A : P[7], 0x050814, dim), -1);
            for (var x = 0; x < 454; x += 4) {
                var h = 22 + Math.round(14 * Math.sin(x / 45.0) + 8 * Math.sin(x / 17.0 + 1)).toNumber();
                dc.fillRectangle(x, 304 - h, 4, h);
            }
            dc.setColor(G.mix(sn ? 0xEEF4FA : P[8], 0x050814, dim), -1);
            dc.fillRectangle(0, 300, 454, 154);

            // ---- station at the goal, a signal on the way
            if (done) {
                dc.setColor(G.mix(P[31], 0x050814, dim), -1);
                dc.fillRectangle(236, 168, 196, 16);
                dc.setColor(G.mix(P[30], 0x050814, dim), -1);
                dc.fillRectangle(246, 184, 176, 118);
                dc.setColor(night ? P[17] : G.mix(P[33], 0x050814, dim), -1);
                for (var i = 0; i < 4; i++) {
                    dc.fillRectangle(258 + i * 42, 228, 26, 34);
                }
                dc.setColor(P[33], -1);
                dc.fillRectangle(282, 190, 104, 22);
                dc.setColor(P[34], -1);
                F.px(dc, "BAHNHOF", 334, 194, 2, 1, 0);
                dc.setColor(G.mix(P[32], 0x050814, dim), -1);
                dc.fillRectangle(200, 302, 254, 14);
                if (sn) {
                    Season.snowCap(dc, 236, 168, 196);
                }
            } else {
                dc.setColor(P[37], -1);
                dc.fillRectangle(414, 218, 6, RAIL - 218);
                dc.fillRectangle(406, 206, 22, 30);
                dc.setColor(0x3AFF6A, -1);
                dc.fillRectangle(412, 212, 10, 8);
                dc.setColor(0x3A1010, -1);
                dc.fillRectangle(412, 224, 10, 8);
            }

            // ---- track on its gravel bed
            dc.setColor(G.mix(P[9], 0x050814, dim), -1);
            dc.fillRectangle(0, RAIL + 2, 454, 22);
            dc.setColor(G.mix(P[10], 0x050814, dim), -1);
            for (var x = 0; x < 454; x += 18) {
                dc.fillRectangle(x, RAIL + 4, 10, 6);
            }
            dc.setColor(P[11], -1);
            dc.fillRectangle(0, RAIL, 454, 4);
            // ---- decorations for the special days by the line
            if (xmas) {
                Season.tree(dc, 96, 374, 1);
            } else if (ev == Season.EASTER) {
                Season.eggs(dc, 330, 372);
            } else if (ev == Season.HALLOWEEN) {
                Season.pumpkin(dc, 360, 372, 1);
            } else if (ev == Season.VALENTINE) {
                Season.heart(dc, 380, 130, 2);
            }

            // ---- timetable board with the data slots
            dc.setColor(P[37], -1);
            dc.fillRectangle(150, 168, 6, 22);
            dc.fillRectangle(298, 168, 6, 22);
            dc.setColor(P[33], -1);
            dc.fillRectangle(130, 96, 194, 74);
            dc.setColor(P[34], -1);
            F.px(dc, "FAHRPLAN", 227, 100, 1, 1, 0);
            for (var i = 0; i < 3; i++) {
                var s = d.slots[i];
                var lb = s[:lbl] as String;
                if (lb.length() == 0 || G.stag(p, i, 0.1, 0.4) <= 0) {
                    continue;
                }
                var val = s[:val] as String;
                while (lb.length() > 2 && F.pxW(lb, 2) > 172 - F.pxW(val, 2)) {
                    lb = lb.substring(0, lb.length() - 1);
                }
                dc.setColor(G.mix(P[34], P[33], 0.35), -1);
                F.px(dc, lb, 140, 114 + i * 18, 2, 0, 0);
                dc.setColor(P[16], -1);
                F.px(dc, val, 314, 114 + i * 18, 2, 2, 0);
            }

            // ---- time, date, caption
            dc.setColor(0x000000, -1);
            F.px(dc, G.timeStr(d), 229, 26, 5, 1, 0);
            dc.setColor(st == 3 ? 0x0F380F : P[12], -1);
            F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
            F.px(dc, ev != Season.NONE ? Season.greeting(ev) : d.dowStr + " " + d.day + ". " + d.monStr, 227, 68, 2, 1, 0);
            var cap = (night && d.mins >= 1260) || d.mins < 300 ? "NACHTZUG" : done ? "ANKUNFT!" : n == 0 ? "LEERFAHRT" : "UNTERWEGS";
            dc.setColor(sn && !night ? 0x1E2A4A : P[12], -1);
            F.px(dc, cap, 227, 374, 2, 1, 0);
            dc.setColor(sn && !night ? 0x4A5A7A : P[13], -1);
            F.px(dc, done ? n + " WAGGONS GELADEN" : n + " VON " + gl + " WAGGONS", 227, 394, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        // ---- the train rolls in on every raise and stops
        var run = p < 1 ? G.ease(G.clamp(p / 0.85, 0, 1)) : 1.0;
        var lx = LX + Math.round((1 - run) * -520).toNumber();
        var moving = run < 1;
        var wf = moving && (a.t / 70) % 2 == 1;
        // lamp beam at night
        if (night) {
            dc.setColor(G.mix(P[8], P[20], 0.5), -1);
            for (var i = 0; i < 4; i++) {
                dc.fillRectangle(lx + 112 + i * 18, RAIL - 46 - i * 2, 18, 8 + i * 4);
            }
        }
        for (var i = 0; i < n; i++) {
            var x = lx - WW * (i + 1);
            if (x + 48 < 0 || x > 454) {
                continue;
            }
            wagon(dc, P, x, i, wf);
        }
        Spr.draw(dc, SprTrain.LOCO, lx, RAIL - 76, 4, [-1, P[14], P[15], P[16], P[17], P[18], -1, P[20]], false);
        var w = wf ? SprTrain.WHEEL_B : SprTrain.WHEEL_A;
        var wp = [-1, -1, P[15], -1, -1, -1, P[19]];
        Spr.draw(dc, w, lx + 4, RAIL - 32, 4, wp, false);
        Spr.draw(dc, w, lx + 40, RAIL - 32, 4, wp, false);
        Spr.draw(dc, w, lx + 72, RAIL - 32, 4, wp, false);
        // smoke puffs from the chimney
        dc.setColor(G.mix(P[35], P[1], night ? 0.6 : 0.2), -1);
        for (var i = 0; i < 4; i++) {
            var ph = ((tt + i * 300) % 1200) / 1200.0;
            var r = 6 + Math.round(ph * 8).toNumber();
            dc.fillRectangle(lx + 84 - Math.round(ph * (moving ? 80 : 20)).toNumber() - r, RAIL - 84 - Math.round(ph * 70).toNumber() - r, r * 2, r * 2);
        }
        // brake steam when it stops
        if (p > 0.7 && p < 1) {
            dc.setColor(P[35], -1);
            var s = (p - 0.7) / 0.3;
            for (var i = 0; i < 4; i++) {
                dc.fillRectangle(lx + 8 + i * 24 - Math.round(s * 10).toNumber(), RAIL - 14 - Math.round(s * 12).toNumber(), 14, 10);
            }
        }
        // ---- real weather, lights, fireworks, balloons
        Season.precip(dc, d, 0, 90, 454, 240, tt);
        if (xmas) {
            if (done) {
                Season.lights(dc, 246, 186, 422, 186, tt);
            } else {
                Season.lights(dc, 130, 96, 324, 96, tt);
            }
        } else if (ev == Season.NYE) {
            Season.fireworks(dc, 330, 96, 90, 50, tt);
        } else if (ev == Season.BIRTHDAY) {
            Season.balloons(dc, 96, 374, tt);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var c = st == 3 ? 0x306230 : 0x3A3A42;
        Spr.draw(dc, SprTrain.LOCO, LX + o[0], RAIL - 76 + o[1], 4, [-1, c, c, -1, -1, -1, -1, G.dim(0xFFF2A0, 0.5)], false);
        dc.setColor(c, -1);
        dc.fillRectangle(o[0], RAIL + o[1], 454, 2);
        dc.setColor(st == 3 ? 0x8BAC0F : 0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
    }
}
