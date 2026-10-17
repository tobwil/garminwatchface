import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// RACE — "Rennfahrer": a race that lasts the week, seen from the start-finish straight. The intensity
// minutes are the laps (goal = 15 laps); the circuit map and the timing screen with the three data
// slots hang above the grandstand. The story has four chapters: racing (every wrist raise he
// overtakes a rival), a pit stop when the Body Battery runs low (the car rolls into the box and the
// crew changes tyres), the chequered flag at the weekly goal, and parc fermé at night with the car
// under its cover. Styles: 1 Grand Prix, 2 Rallye, 3 Gameboy. Mirrors web/js/faces/race.js.
class FaceRace extends Face {
    const LAPS = 15;
    const GROUND = 352;
    const CX = 140;
    const TRK = [76, 150, 78, 118, 104, 106, 144, 114, 172, 104, 186, 124, 162, 138, 182, 162, 128, 168, 96, 162];
    const CROWD = [0xFF5A5A, 0xFFD23A, 0x5AB4FF, 0xFFFFFF, 0x5AE08A, 0xFF9A3A];

    hidden var _cum as Array<Float>;
    hidden var _len as Float;

    function initialize() {
        Face.initialize();
        _cum = [0.0] as Array<Float>;
        for (var i = 0; i < TRK.size(); i += 2) {
            var j = (i + 2) % TRK.size();
            var dx = TRK[j] - TRK[i];
            var dy = TRK[j + 1] - TRK[i + 1];
            _cum.add(_cum[_cum.size() - 1] + Math.sqrt(dx * dx + dy * dy).toFloat());
        }
        _len = _cum[_cum.size() - 1];
    }

    function fps() as Number {
        return 10;
    }

    // point on the circuit at fraction f: [x, y]
    hidden function onTrack(f) as Array {
        var L = (f - Math.floor(f)) * _len;
        var i = 1;
        while (i < _cum.size() - 1 && _cum[i] < L) {
            i++;
        }
        var dl = _cum[i] - _cum[i - 1];
        var t = (L - _cum[i - 1]) / (dl > 1 ? dl : 1.0);
        var a = (i - 1) * 2;
        var b = (i * 2) % TRK.size();
        return [TRK[a] + (TRK[b] - TRK[a]) * t, TRK[a + 1] + (TRK[b + 1] - TRK[a + 1]) * t];
    }

    // chapter: 0 racing, 1 pit stop, 2 chequered flag, 3 parc fermé
    hidden function chapter(d as D) as Number {
        if (d.mins < 360 || d.mins >= 1320) {
            return 3;
        }
        if (d.imGoal > 0 && d.imWeek >= d.imGoal) {
            return 2;
        }
        if (d.bb >= 0 && d.bb < 25) {
            return 1;
        }
        return 0;
    }

    // [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, roof, stand, banner,
    //  banner text, wall, wall top, track, streak, kerb a, kerb b, grass, grass dark, text, text dim, board,
    //  map line, map dot, body, body dark, number, black, helmet, visor, rim, overall, skin, crew helmet,
    //  cover, cover fold, star]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x4A8AD0, 0xB8DCF0, 0x5A4A8A, 0xFF9A6A, 0x0A1030, 0x1A2450, 0x5A3A24, 0x7A5A3A, acc, 0xFFFFFF,
                0x8A7A62, 0xB0A084, 0x8A6A48, 0xA88A62, 0xD8B04A, 0xA8803A, 0x2A5A2A, 0x1E421E, 0xFFFFFF, 0xC8D8B8, 0x101010,
                0xFFFFFF, acc, acc, G.mix(acc, 0, 0.4), 0xFFFFFF, 0x1A1A1A, 0xFFFFFF, 0x3AC8FF, 0xB0B0B8, 0x2A4A8A, 0xF2C08A, 0xFFFFFF,
                0x6A7A5A, 0x4A5A3A, 0xFFFFFF] as Array<Number>;
        }
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [c, e, b, c, a, a, a, b, a, e, c, e, b, c, a, e, c, b, a, b, a, a, e, a, a, e, a, e, c, c, a, e, e, b, a, e] as Array<Number>;
        }
        return [0x2A72C8, 0x9AD4FF, 0x46388A, 0xFF8A6A, 0x040A1E, 0x10204A, 0x2A2A34, 0x4A4A5A, acc, 0xFFFFFF,
            0xC8C8D0, 0xF0F0F4, 0x3A3A42, 0x56565E, 0xE03A2A, 0xFFFFFF, 0x3A9A3A, 0x2A7A2A, 0xFFFFFF, 0xD8E8D8, 0x101014,
            0xFFFFFF, acc, acc, G.mix(acc, 0, 0.4), 0xFFFFFF, 0x141414, 0xFFD23A, 0x3AC8FF, 0xB0B0B8, acc, 0xF2C08A, 0xFFFFFF,
            0x8A8A96, 0x5A5A66, 0xFFFFFF] as Array<Number>;
    }

    // the car (with its two wheels) at x; ground = where the wheels touch
    hidden function car(dc as Dc, P as Array<Number>, x as Number, ground as Number, wf as Boolean) as Void {
        var y = ground - 48;
        Spr.draw(dc, SprRace.CAR, x, y, 4, [-1, P[23], P[24], P[25], P[26], P[27], P[28]], false);
        var w = wf ? SprRace.WHEEL_B : SprRace.WHEEL_A;
        var wp = [-1, -1, -1, -1, P[26], -1, -1, P[29]];
        Spr.draw(dc, w, x + 8, y + 12, 4, wp, false);
        Spr.draw(dc, w, x + 116, y + 12, 4, wp, false);
    }

    hidden function laps(d as D) as Float {
        var g = d.imGoal > 0 ? d.imGoal : 150;
        return G.clamp((d.imWeek > 0 ? d.imWeek : 0) / g.toFloat() * LAPS, 0, LAPS).toFloat();
    }

    // static layer: sky, grandstand, wall, track, map, timing screen, texts (and the parked car);
    // the cars, the crew, the kerbs, the map dot, the flag and the confetti move
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
        var ch = chapter(d);
        var L = laps(d);
        var lap = Math.floor(L).toNumber() + 1;
        if (lap > LAPS) {
            lap = LAPS;
        }
        var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);

        if (S) {
            // ---- sky follows the sun
            var k = el > 6 ? 0 : el > -6 ? 1 : 2;
            for (var i = 0; i < 6; i++) {
                dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 5.0), -1);
                dc.fillRectangle(0, i * 32, 454, 32);
            }
            if (k == 2) {
                dc.setColor(P[35], -1);
                for (var i = 0; i < 18; i++) {
                    dc.fillRectangle(40 + ((i * 89 + 31) % 374), 14 + ((i * 41 + 9) % 150), 2, 2);
                }
            }

            // ---- grandstand with the crowd (empty at night), floodlights after dark
            dc.setColor(P[7], -1);
            dc.fillRectangle(0, 192, 454, 56);
            for (var r = 0; r < 6; r++) {
                for (var x = (r % 2) * 4; x < 454; x += 8) {
                    var s = G.rnd(r * 977 + x * 13);
                    if (ch == 3 || s % 4 == 0) {
                        dc.setColor(G.mix(P[7], P[6], 0.5), -1);
                        dc.fillRectangle(x, 200 + r * 8, 6, 3);
                    } else {
                        dc.setColor(st == 3 ? (s % 2 == 0 ? P[9] : P[10]) : G.mix(CROWD[s % 6], P[7], 0.25), -1);
                        dc.fillRectangle(x + 1, 197 + r * 8, 4, 5);
                    }
                }
            }
            dc.setColor(P[6], -1);
            dc.fillRectangle(0, 184, 454, 8);
            for (var x = 40; x < 454; x += 110) {
                dc.fillRectangle(x, 192, 6, 56);
            }
            if (k == 2 && ch != 3) {
                for (var x = 92; x < 454; x += 220) {
                    dc.fillRectangle(x, 150, 4, 34);
                    dc.setColor(0xFFF6D0, -1);
                    dc.fillRectangle(x - 12, 142, 28, 8);
                    dc.setColor(P[6], -1);
                }
            }
            dc.setColor(P[8], -1);
            dc.fillRectangle(0, 246, 454, 18);
            dc.setColor(P[9], -1);
            F.px(dc, "GRAND PRIX", 227, 249, 2, 1, 0);

            // ---- pit wall, track, grass
            dc.setColor(P[10], -1);
            dc.fillRectangle(0, 264, 454, 14);
            dc.setColor(P[11], -1);
            dc.fillRectangle(0, 264, 454, 3);
            dc.setColor(P[12], -1);
            dc.fillRectangle(0, 278, 454, 94);
            dc.setColor(P[13], -1);
            dc.fillRectangle(0, 322, 454, 2);
            dc.setColor(P[16], -1);
            dc.fillRectangle(0, 384, 454, 70);
            dc.setColor(P[17], -1);
            for (var x = 0; x < 454; x += 16) {
                dc.fillRectangle(x + ((x / 16) % 2) * 6, 392 + ((x * 7) % 40), 4, 4);
            }

            // ---- circuit map
            dc.setColor(P[21], -1);
            for (var i = 0; i < 60; i++) {
                var q = onTrack(i / 60.0);
                dc.fillRectangle(Math.floor((q[0] as Float) / 2).toNumber() * 2, Math.floor((q[1] as Float) / 2).toNumber() * 2, 3, 3);
            }
            dc.setColor(P[22], -1);
            dc.fillRectangle(74, 136, 8, 3);

            // ---- timing screen with the data slots
            dc.setColor(P[20], -1);
            dc.fillRectangle(246, 100, 152, 74);
            dc.setColor(P[8], -1);
            dc.fillRectangle(246, 100, 4, 74);
            for (var i = 0; i < 3; i++) {
                var s = d.slots[i];
                var lb = s[:lbl] as String;
                if (lb.length() == 0) {
                    continue;
                }
                if (G.stag(p, i, 0.1, 0.4) <= 0) {
                    continue;
                }
                var val = s[:val] as String;
                while (lb.length() > 2 && F.pxW(lb, 2) > 124 - F.pxW(val, 2)) {
                    lb = lb.substring(0, lb.length() - 1);
                }
                dc.setColor(P[22], -1);
                F.px(dc, lb, 258, 108 + i * 22, 2, 0, 0);
                dc.setColor(0xFFFFFF, -1);
                F.px(dc, val, 390, 108 + i * 22, 2, 2, 0);
            }

            // ---- time, date, chapter
            dc.setColor(0x000000, -1);
            F.px(dc, G.timeStr(d), 229, 32, 5, 1, 0);
            dc.setColor(P[18], -1);
            F.px(dc, G.timeStr(d), 227, 30, 5, 1, 0);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 74, 2, 1, 0);
            var cap = ["RUNDE " + lap + "/" + LAPS, "BOXENSTOPP", "ZIELFLAGGE!", "PARC FERME"][ch];
            var sub = ch == 1 ? "BODY BATTERY " + d.bb + "%" : ch == 3 ? "RUNDE " + lap + " MORGEN"
                : (d.imWeek > 0 ? d.imWeek : 0) + "/" + (d.imGoal > 0 ? d.imGoal : 150) + " MIN";
            F.px(dc, cap, 227, 392, 2, 1, 0);
            dc.setColor(P[19], -1);
            F.px(dc, sub, 227, 414, 2, 1, 0);

            // ---- parc fermé: the car rests under its cover
            if (ch == 3) {
                car(dc, P, CX, GROUND, false);
                Spr.draw(dc, SprRace.COVER, CX, GROUND - 48, 4, [-1, P[33], P[34]], false);
            }
        }

        if (!M) {
            return;
        }
        // ---- kerbs and asphalt streaks run past (fast in the race, slow on the lap of honour)
        var v = ch == 0 ? 0.2 : ch == 2 ? 0.06 : ch == 1 && p < 0.5 ? 0.12 * (1 - p * 2) : 0.0;
        var off = (tt * v).toNumber() % 64;
        for (var x = -off; x < 454; x += 64) {
            dc.setColor(P[14], -1);
            dc.fillRectangle(x, 372, 32, 12);
            dc.setColor(P[15], -1);
            dc.fillRectangle(x + 32, 372, 32, 12);
        }
        if (v > 0) {
            dc.setColor(P[13], -1);
            for (var i = 0; i < 5; i++) {
                var sx = ((i * 173 + 1000) - (tt * v * 1.5).toNumber() % 520 + 520) % 520 - 40;
                dc.fillRectangle(sx, 286 + ((i * 37) % 80), 36, 2);
            }
        }
        // ---- the dot on the circuit map
        var mq = onTrack(ch == 0 ? (live ? tt / 7000.0 : L) : 0.0);
        dc.setColor(P[23], -1);
        dc.fillRectangle(Math.round(mq[0]).toNumber() - 3, Math.round(mq[1]).toNumber() - 3, 7, 7);

        var wf = live && (tt / (ch == 2 ? 180 : 60)) % 2 == 1;
        if (ch == 0) {
            // overtakes a rival on every wrist raise
            if (p < 1) {
                var rx = Math.round(G.lerp(250, -200, G.easeInOut(p))).toNumber();
                var R = P.slice(0, null);
                R[23] = st == 3 ? P[24] : 0x2A5AD8;
                R[24] = st == 3 ? P[26] : 0x1A3A8A;
                R[27] = st == 3 ? P[25] : 0xFFFFFF;
                car(dc, R, rx, 318, (a.t / 60) % 2 == 1);
            }
            car(dc, P, CX, GROUND, wf);
            if (p > 0.6 && p < 1) {
                dc.setColor(P[18], -1);
                F.px(dc, "ÜBERHOLT!", 330, 288, 2, 1, 0);
            }
        } else if (ch == 1) {
            // rolls into the box, then the crew gets to work
            var x = Math.round(G.lerp(-180, CX, G.ease(G.clamp(p * 2, 0, 1)))).toNumber();
            car(dc, P, x, GROUND, p < 0.5 && (a.t / 90) % 2 == 1);
            if (p >= 0.5) {
                var crew = [-1, P[30], P[31], P[32], P[26], P[28]];
                Spr.draw(dc, SprRace.KNEEL, CX - 20, GROUND - 56, 4, crew, false);
                Spr.draw(dc, SprRace.KNEEL, CX + 150, GROUND - 56, 4, crew, true);
                Spr.draw(dc, SprRace.STAND, CX + 200, GROUND - 60, 4, crew, true);
                dc.setColor(P[26], -1);
                dc.fillRectangle(CX + 196, GROUND - 92, 4, 40);
                dc.setColor(0xE03A2A, -1);
                dc.fillCircle(CX + 198, GROUND - 100, 12);
                if (!live || (tt / 120) % 2 == 0) {
                    dc.setColor(0xFFD23A, -1);
                    dc.fillRectangle(CX + 22, GROUND - 22, 4, 4);
                    dc.fillRectangle(CX + 140, GROUND - 26, 4, 4);
                }
            }
        } else if (ch == 2) {
            // lap of honour under the chequered flag, confetti
            car(dc, P, CX, GROUND, wf);
            Spr.draw(dc, SprRace.WAVE, 330, 208, 4, [-1, 0xFFFFFF, P[31], P[32], P[26], P[28]], false);
            var wv = live ? (tt / 160) % 2 : 0;
            for (var r = 0; r < 3; r++) {
                for (var c = 0; c < 4; c++) {
                    dc.setColor((r + c) % 2 == 0 ? 0xFFFFFF : 0x141414, -1);
                    dc.fillRectangle(370 + c * 8, 190 + r * 8 + (c % 2 == wv ? 2 : 0), 8, 8);
                }
            }
            dc.setColor(P[26], -1);
            dc.fillRectangle(368, 186, 2, 34);
            if (live || p < 1) {
                for (var i = 0; i < 22; i++) {
                    var s = G.rnd(i * 71 + 5);
                    var cy = (s % 300 + (tt * (0.05 + (s % 5) * 0.01)).toNumber()) % 320 + 100;
                    dc.setColor(st == 3 ? P[9] : CROWD[s % 6], -1);
                    dc.fillRectangle((s >> 3) % 420 + 16, cy, 6, 4);
                }
            }
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var c = st == 3 ? 0x306230 : 0x4A4A52;
        Spr.draw(dc, SprRace.CAR, CX + o[0], GROUND - 48 + o[1], 4, [-1, c, c, -1, c, -1, -1], false);
        dc.setColor(c, -1);
        dc.fillRectangle(o[0], 372 + o[1], 454, 2);
        dc.setColor(st == 3 ? 0x8BAC0F : 0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 30 + o[1], 5, 1, 1);
        dc.setColor(st == 3 ? 0x306230 : 0x6A6A72, -1);
        var lap = Math.floor(laps(d)).toNumber() + 1;
        F.px(dc, "RUNDE " + (lap > LAPS ? LAPS : lap) + "/" + LAPS, 227 + o[0], 392 + o[1], 2, 1, 0);
    }
}
