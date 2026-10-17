import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// OFFICE — "Büro": a working day in a pixel office, told by the real clock. Morning coffee at the
// machine, focused typing until lunch ("BIN ESSEN" on the screen), a video call after lunch, the
// final sprint, closing time at five, an empty dark office in the evening and the cleaning crew
// late at night; at weekends the office stays empty. The paper stack grows with the stress level,
// empty coffee cups pile up as the Body Battery drains, the three data slots are written on the
// whiteboard. Every wrist raise plays a short episode of the current scene.
// Styles: 1 Großraum, 2 Homeoffice, 3 Gameboy. Mirrors web/js/faces/office.js.
class FaceOffice extends Face {
    const FLOOR = 355;
    const CAP = ["NACHTRUHE", "ERSTER KAFFEE", "KONZENTRIERT", "MITTAGSPAUSE", "VIDEOCALL", "ENDSPURT", "FEIERABEND!", "FEIERABEND", "PUTZKOLONNE", "WOCHENENDE"];
    const BLD = [66, 170, 22, 52, 90, 150, 26, 72, 118, 182, 18, 40, 138, 160, 30, 62, 170, 176, 24, 46];
    const MEET = [0x3A5A8A, 0x5A3A6A, 0x3A6A5A, 0x6A5A3A];
    const CODE = [0x7AC0FF, 0xFFD870, 0x9AE07A, 0xFF9AC0];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    // scenes: 0 night, 1 coffee, 2 focus, 3 lunch, 4 meeting, 5 sprint, 6 leaving, 7 evening, 8 cleaning, 9 weekend
    hidden function scene(d as D) as Number {
        if (d.dow == 0 || d.dow == 6) {
            return 9;
        }
        var m = d.mins;
        if (m < 450) {
            return 0;
        }
        if (m < 540) {
            return 1;
        }
        if (m < 720) {
            return 2;
        }
        if (m < 780) {
            return 3;
        }
        if (m < 900) {
            return 4;
        }
        if (m < 1020) {
            return 5;
        }
        if (m < 1080) {
            return 6;
        }
        if (m < 1320) {
            return 7;
        }
        return 8;
    }

    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x3A5A4A, 0x8A6040, 0x2A3A30, 0xD8B080, 0x9A7048, 0x2A2A30, 0x1E2A3A, 0x5A3A2A, 0x8A3A6A, 0x8A3A6A, 0x2A1A10, 0xE8B080,
                0x3A4A6A, 0x1A1A1A, 0xF4F0E6, 0x9A8A70, 0x2A2A3A, 0x2A5AD8, 0xD83A2E, 0x2A9A48, 0x101010, acc, 0xF0E6D0, 0x3A6AB8, 0x4AB84A, 0x2A7A3A, 0xC86A3A, 0xF0F0F0] as Array<Number>;
        }
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [c, b, a, b, a, a, a, a, e, a, a, e, a, a, e, a, a, a, a, a, a, e, e, b, b, a, a, e] as Array<Number>;
        }
        return [0xD9D4C7, 0x6B7A8A, 0x4A5560, 0xB07A4A, 0x7A5030, 0x2A2A30, 0x1E3A5A, 0x3A3A48, 0xFFFFFF, acc, 0x4A3020, 0xF2C08A,
            0x3A3A50, 0x1A1A1A, 0xF8F8F8, 0xA0A0A8, 0x2A2A3A, 0x2A5AD8, 0xD83A2E, 0x2A9A48, 0x101010, 0xFF3A2A, 0xE8EEF4, 0x3A6AB8, 0x4AB84A, 0x2A7A3A, 0xC86A3A, 0xFFFFFF] as Array<Number>;
    }

    hidden function person(P as Array<Number>, cleaner as Boolean) as Array<Number> {
        return [-1, P[11], P[10], cleaner ? P[23] : P[8], cleaner ? P[23] : P[12], P[13], cleaner ? P[23] : P[9], P[7]] as Array<Number>;
    }

    // static layer: room, window, clock, whiteboard, furniture; screen, steam and people move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var st = d.cfg.style;
        var P0 = pal(st, d.accent);
        var p = a.intro;
        var live = a.live;
        var tt = live ? a.t : 0;
        var sc = scene(d);
        var lit = (sc >= 1 && sc <= 6) || sc == 8;
        // lights off: dim the room (Gameboy keeps its four shades)
        var n0 = P0.size();
        var P = new [n0] as Array<Number>;
        for (var i = 0; i < n0; i++) {
            P[i] = lit || st == 3 || i >= 20 ? P0[i] : G.mix(P0[i], 0x080A14, 0.55);
        }

        if (S) {
            // ---- room
            dc.setColor(P[0], -1);
            dc.fillRectangle(0, 0, 454, FLOOR);
            dc.setColor(P[1], -1);
            dc.fillRectangle(0, FLOOR, 454, 454 - FLOOR);
            dc.setColor(P[2], -1);
            dc.fillRectangle(0, FLOOR - 6, 454, 6);

            // ---- window with the real sky
            var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
            var sky = st == 3 ? (el > 6 ? 0x9BBC0F : (el > -4 ? 0x8BAC0F : 0x306230)) : (el > 6 ? 0x7AC0FF : (el > -4 ? 0xFFA070 : 0x101838));
            dc.setColor(P[15], -1);
            dc.fillRectangle(60, 102, 140, 126);
            dc.setColor(sky, -1);
            dc.fillRectangle(66, 108, 128, 114);
            if (el > -4) {
                dc.setColor(st == 3 ? 0x9BBC0F : 0xFFF2A0, -1);
                var sy = 196 - Math.round(G.clamp(el, -4, 40) * 2).toNumber();
                dc.fillRectangle(160, sy, 12, 12);
            } else {
                dc.setColor(st == 3 ? 0x8BAC0F : 0xE8E8FF, -1);
                for (var i = 0; i < 6; i++) {
                    dc.fillRectangle(74 + ((i * 37) % 110), 114 + ((i * 23) % 40), 2, 2);
                }
            }
            // skyline
            var sl = st == 3 ? 0x0F380F : (el > 6 ? 0x5A7A9A : 0x1A2038);
            for (var i = 0; i < BLD.size(); i += 4) {
                dc.setColor(sl, -1);
                dc.fillRectangle(BLD[i], BLD[i + 1], BLD[i + 2], 222 - BLD[i + 1]);
                if (el <= 6) {
                    dc.setColor(st == 3 ? 0x9BBC0F : 0xFFD870, -1);
                    for (var k = 0; k < 4; k++) {
                        if (G.rnd(i * 13 + k * 7 + d.day) % 3 == 0) {
                            dc.fillRectangle(BLD[i] + 4 + (k % 2) * 10, BLD[i + 1] + 6 + (k / 2) * 14, 4, 6);
                        }
                    }
                }
            }
            dc.setColor(P[15], -1);
            dc.fillRectangle(128, 108, 4, 114);
            dc.fillRectangle(66, 162, 128, 4);

            // ---- LED wall clock
            dc.setColor(P[20], -1);
            dc.fillRectangle(134, 24, 186, 64);
            dc.setColor(P[2], -1);
            dc.drawRectangle(134, 24, 186, 64);
            dc.setColor(P[21], -1);
            F.px(dc, G.timeStr(d), 227, 35, 6, 1, 1);

            // ---- whiteboard with the data slots
            dc.setColor(P[15], -1);
            dc.fillRectangle(236, 102, 156, 100);
            dc.setColor(P[14], -1);
            dc.fillRectangle(240, 106, 148, 92);
            for (var k = 0; k < 3; k++) {
                var s = d.slots[k];
                var lb = s[:lbl] as String;
                if (lb.length() == 0) {
                    continue;
                }
                var sp = G.stag(p, k, 0.1, 0.4);
                if (sp <= 0) {
                    continue;
                }
                var val = s[:val] as String;
                // shorten the label until it fits next to the value
                while (lb.length() > 2 && F.pxW(lb, 2) > 124 - F.pxW(val, 2)) {
                    lb = lb.substring(0, lb.length() - 1);
                }
                dc.setColor(P[17 + k], -1);
                F.px(dc, lb, 248, 116 + k * 26, 2, 0, 0);
                dc.setColor(P[16], -1);
                F.px(dc, val, 380, 116 + k * 26, 2, 2, 0);
            }
            dc.setColor(P[15], -1);
            dc.fillRectangle(300, 202, 40, 4);
        }

        if (S) {
            // ---- coffee corner: cabinet + machine
            dc.setColor(P[4], -1);
            dc.fillRectangle(36, 298, 96, 57);
            dc.setColor(P[3], -1);
            dc.fillRectangle(32, 292, 104, 8);
            dc.setColor(P[5], -1);
            dc.fillRectangle(48, 240, 48, 52);
            dc.setColor(P[13], -1);
            dc.fillRectangle(60, 262, 24, 6);
            dc.setColor(lit ? P[21] : P[2], -1);
            dc.fillRectangle(54, 248, 6, 6);
        }

        if (sc == 1) {
            dc.setColor(P[27], -1);
            if (S) {
                dc.fillRectangle(64, 274, 16, 18);
            }
            // steam (moves)
            if (M) {
                var sp = live ? (tt / 160) % 3 : 1;
                dc.setColor(G.mix(P[0], 0xFFFFFF, 0.6), -1);
                for (var i = 0; i < 3; i++) {
                    dc.fillRectangle(70 + ((i + sp) % 2) * 4, 266 - i * 8 - sp * 2, 4, 4);
                }
            }
        }

        if (S) {
            // ---- desk, monitor, paper stack, cups
            dc.setColor(P[4], -1);
            dc.fillRectangle(152, 304, 10, 51);
            dc.fillRectangle(372, 304, 10, 51);
            dc.setColor(P[3], -1);
            dc.fillRectangle(140, 296, 254, 10);
            dc.setColor(P[5], -1);
            dc.fillRectangle(212, 226, 96, 66);
            dc.fillRectangle(252, 292, 16, 4);
        }

        var on = lit && sc != 6;
        var scr = on ? P[6] : 0x000000;
        dc.setColor(st == 3 ? (on ? P0[6] : 0x0F380F) : scr, -1);
        dc.fillRectangle(216, 230, 88, 58);
        if (M && on && sc != 1 && sc != 8) {
            if (sc == 3) {
                dc.setColor(st == 3 ? 0x9BBC0F : 0xFFFFFF, -1);
                if (!live || (tt / 600) % 2 == 0) {
                    F.px(dc, "BIN", 260, 242, 2, 1, 0);
                    F.px(dc, "ESSEN", 260, 262, 2, 1, 0);
                }
            } else if (sc == 4) {
                var n = p < 1 ? Math.floor(G.clamp(p / 0.6, 0, 1) * 4).toNumber() : 4;
                for (var i = 0; i < n; i++) {
                    var x = 220 + (i % 2) * 42;
                    var y = 234 + (i / 2) * 26;
                    dc.setColor(st == 3 ? 0x306230 : MEET[i], -1);
                    dc.fillRectangle(x, y, 38, 24);
                    dc.setColor(st == 3 ? 0x9BBC0F : 0xF2C08A, -1);
                    dc.fillRectangle(x + 15, y + 5, 8, 8);
                    dc.fillRectangle(x + 12, y + 15, 14, 9);
                }
            } else {
                // code scrolling; faster in the final sprint and during the episode
                var spd = sc == 5 ? 140 : 260;
                var off = live ? tt / (p < 1 ? 60 : spd) : 0;
                var nl = p < 1 ? Math.floor(G.clamp(p / 0.7, 0, 1) * 7).toNumber() : 7;
                for (var i = 0; i < nl; i++) {
                    var k = i + off;
                    var ind = (G.rnd(k * 31 + 7) % 3) * 6;
                    var w = 12 + (G.rnd(k * 17 + 3) % 44);
                    dc.setColor(st == 3 ? 0x8BAC0F : CODE[G.rnd(k * 7 + 1) % 4], -1);
                    dc.fillRectangle(222 + ind, 236 + i * 7, w < 76 - ind ? w : 76 - ind, 4);
                }
            }
        } else if (S && !on) {
            dc.setColor(st == 3 ? 0x306230 : 0x3AFF6A, -1);
            dc.fillRectangle(300, 288, 2, 2);
        }
        if (S) {
            // paper stack = stress
            var sh = d.stress > 0 ? G.clamp(d.stress / 12, 0, 8) : 0;
            for (var i = 0; i < sh; i++) {
                dc.setColor(i % 2 == 0 ? P[14] : G.mix(P[14], P[15], 0.5), -1);
                dc.fillRectangle(320 + (i % 3) * 2, 292 - i * 5, 44, 5);
            }
            // empty cups = drained Body Battery
            var nc = d.bb >= 0 ? G.clamp((100 - d.bb) / 20, 0, 4) : 1;
            for (var i = 0; i < nc; i++) {
                var x = 150 + (i % 2) * 24;
                var y = 278 - (i / 2) * 20;
                dc.setColor(P[27], -1);
                dc.fillRectangle(x, y, 14, 18);
                dc.fillRectangle(x + 14, y + 4, 4, 8);
                dc.setColor(P[4], -1);
                dc.fillRectangle(x + 2, y + 2, 10, 3);
            }

            // ---- plant
            Spr.draw(dc, SprOffice.PLANT, 100, 250, 3, [-1, P[24], P[25], P[26]], false);
        }

        if (M) {
            // ---- people
            var fr = live && (tt / 200) % 2 == 1;
            if (sc == 2 || sc == 4 || sc == 5) {
                var typing = live && (sc != 4 || p < 1) && (tt / (sc == 5 ? 120 : 220)) % 2 == 1;
                Spr.draw(dc, typing ? SprOffice.SIT_B : SprOffice.SIT_A, 168, 275, 5, person(P, false), false);
            } else if (sc == 1) {
                // arrives during the episode and stops at the machine
                var x = p < 1 ? Math.round(G.lerp(-70, 120, G.ease(p))).toNumber() : 120;
                Spr.draw(dc, p < 1 && (a.t / 150) % 2 == 1 ? SprOffice.STAND_B : SprOffice.STAND_A, x, 265, 5, person(P, false), true);
            } else if (sc == 6 && p < 1) {
                // closing time: walks out of the picture
                var x = Math.round(G.lerp(180, -80, G.easeInOut(p))).toNumber();
                Spr.draw(dc, (a.t / 150) % 2 == 1 ? SprOffice.STAND_B : SprOffice.STAND_A, x, 265, 5, person(P, false), true);
            } else if (sc == 8) {
                // cleaning crew mopping the floor
                var mx = Math.round(200 + 50 * Math.sin((live ? tt : 0) / 700.0)).toNumber();
                dc.setColor(P[23], -1);
                dc.fillRectangle(mx - 46, 322, 30, 33);
                Spr.draw(dc, fr ? SprOffice.STAND_B : SprOffice.STAND_A, mx, 265, 5, person(P, true), false);
                dc.setColor(P[4], -1);
                dc.fillRectangle(mx + 60, 300, 5, 52);
                dc.setColor(P[22], -1);
                dc.fillRectangle(mx + 46, 350, 34, 6);
            }
        }

        if (!S) {
            return;
        }
        // ---- caption + date
        dc.setColor(P[22], -1);
        F.px(dc, CAP[sc], 227, 372, 2, 1, 0);
        dc.setColor(G.mix(P[22], P[1], 0.45), -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 394, 2, 1, 0);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        dc.setColor(st == 3 ? 0x306230 : 0x3A3A40, -1);
        dc.drawRectangle(134 + o[0], 24 + o[1], 186, 64);
        dc.setColor(st == 3 ? 0x8BAC0F : G.dim(0xFF3A2A, 0.6), -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 35 + o[1], 6, 1, 2);
        dc.setColor(st == 3 ? 0x306230 : 0x4A4A52, -1);
        dc.drawRectangle(212 + o[0], 226 + o[1], 96, 66);
        dc.drawRectangle(140 + o[0], 296 + o[1], 254, 4);
        dc.setColor(st == 3 ? 0x306230 : 0x6A6A72, -1);
        F.px(dc, CAP[scene(d)], 227 + o[0], 372 + o[1], 2, 1, 0);
    }
}
