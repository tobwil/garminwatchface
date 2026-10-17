import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// CLIMB — "Bergsteiger": an expedition from base camp (5,364 m) to the summit (8,848 m), told in two
// planes. Far away the massif with the route, the camps and a blinking "you are here" mark that the
// floors climbed today carry upwards; close up the climber on a rock ledge, swinging the ice axe.
// At night he sleeps in the tent, at the floors goal he stands on the summit ridge with the flag.
// The sky follows the real sun. Every wrist raise he climbs up onto the ledge.
// Styles: 1 Fels, 2 Eis, 3 Gameboy. Mirrors web/js/faces/climb.js.
class FaceClimb extends Face {
    // peaks of the massif: x, y, slope left, slope right (the main summit first)
    const PK = [318, 108, 1.05, 1.25, 190, 176, 1.1, 1.2, 410, 168, 1.3, 0.9, 70, 214, 1.0, 1.1];
    const BASE = 340;
    const SNOWY = 196;
    const JIT = [0, 4, 8, 4, 0, -4, -8, -4];
    // route on the main face (waypoints) and the camps along it
    const WP = [266, 330, 346, 300, 278, 268, 338, 236, 292, 204, 330, 172, 304, 140, 318, 112];
    const CAMPF = [0, 0.3, 0.55, 0.8];
    const SEG = ["BASISLAGER", "GLETSCHER", "LAGER 1", "STEILWAND", "LAGER 2", "TODESZONE", "LAGER 3", "GIPFELSTURM"];
    const NAMES = ["BASISLAGER", "LAGER 1", "LAGER 2", "LAGER 3"];
    const LEDGE = [0, 360, 60, 350, 130, 354, 190, 364, 222, 380, 232, 454, 0, 454];
    const CREST = [0, 352, 70, 330, 120, 316, 170, 330, 240, 372, 250, 454, 0, 454];

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

    // point on the route at fraction f: [x, y]
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

    // top of the massif at column x and the index of the peak that forms it
    hidden function ridge(x as Number) as Array {
        var best = 999.0;
        var bi = 0;
        for (var k = 0; k < PK.size(); k += 4) {
            var dx = x - PK[k];
            var y = PK[k + 1] + (dx < 0 ? -dx * PK[k + 2] : dx * PK[k + 3]);
            if (y < best) {
                best = y;
                bi = k;
            }
        }
        return [best, bi];
    }

    hidden function poly(dc as Dc, a as Array<Number>) as Void {
        var pts = [];
        for (var i = 0; i < a.size(); i += 2) {
            pts.add([a[i], a[i + 1]]);
        }
        dc.fillPolygon(pts);
    }

    // [rock lit, rock shade, snow lit, snow shade, valley, ledge, ledge top, route, sky top day, sky low day,
    //  sky top dusk, sky low dusk, sky top night, sky low night, text, cloud, tent, tent dark, glow,
    //  jacket, skin, pack, trousers, boots, hat, goggles, flag, star]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x7A9AB8, 0x46688A, 0xFFFFFF, 0xB4D4EE, 0x16283A, 0x223A52, 0x8AB4D8, 0xFFFFFF, 0x2A72C8, 0x9AD4FF,
                0x46388A, 0xFF8AC0, 0x040A1E, 0x10204A, 0xFFFFFF, 0xEAF6FF, acc, G.mix(acc, 0, 0.4), 0xFFE08A, acc, 0xF2C08A, 0x2A3A5A,
                0x2A2A3A, 0x141414, 0xFFFFFF, 0x3AC8FF, 0xFF3A3A, 0xDCE8FF] as Array<Number>;
        }
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [b, a, e, c, a, a, b, e, c, e, b, c, a, a, e, e, a, a, e, a, e, b, a, a, e, c, a, e] as Array<Number>;
        }
        return [0x8A7A6A, 0x564A40, 0xF4F4F8, 0xB8C4D8, 0x2A2622, 0x3A332C, 0x6A5E50, 0xFFD870, 0x3A8AD8, 0x8AC8FF,
            0x6A4A9A, 0xFF9A6A, 0x0A1030, 0x1A2450, 0xFFFFFF, 0xFFFFFF, acc, G.mix(acc, 0, 0.4), 0xFFE08A, acc, 0xF2C08A, 0x3A4A6A,
            0x2A2A3A, 0x1A1A1A, 0xFFD23A, 0x3AC8FF, 0xFF3A3A, 0xFFFFFF] as Array<Number>;
    }

    hidden function prog(d as D) as Float {
        var g = d.floorsGoal > 0 ? d.floorsGoal : 10;
        var v = d.floors > 0 ? d.floors : 0;
        return G.clamp(v / g.toFloat(), 0, 1).toFloat();
    }

    // static layer: sky, massif, route, camps, foreground rock / tent, texts; the climber, the
    // position mark, the Zzz, the flag and the clouds move
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
        var f = prog(d);
        var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var night = el < -6;
        var top = f >= 1;
        var last = 0;
        for (var c = 0; c < 4; c++) {
            if (f >= CAMPF[c]) {
                last = c;
            }
        }

        if (S) {
            // ---- sky: day / dusk / night, sun or stars
            var k = el > 6 ? 0 : el > -6 ? 1 : 2;
            var st0 = P[8 + k * 2];
            var sl = P[9 + k * 2];
            for (var i = 0; i < 6; i++) {
                dc.setColor(G.mix(st0, sl, i / 5.0), -1);
                dc.fillRectangle(0, i * 60, 454, 60);
            }
            if (night) {
                dc.setColor(P[27], -1);
                for (var i = 0; i < 26; i++) {
                    dc.fillRectangle(30 + ((i * 97 + 13) % 394), 20 + ((i * 53 + 7) % 170), 2, 2);
                }
            } else if (el > -6) {
                var sy = 200 - Math.round(G.clamp(el, -6, 40) * 3).toNumber();
                dc.setColor(G.mix(sl, 0xFFF2B0, 0.5), -1);
                dc.fillCircle(96, sy, 16);
                dc.setColor(0xFFF6D0, -1);
                dc.fillCircle(96, sy, 11);
            }

            // ---- the massif: 4 px columns, lit left of each summit, snow caps above the snow line,
            // the foot fading into the valley haze
            for (var x = 0; x < 454; x += 4) {
                var r = ridge(x + 2);
                var y0 = Math.floor((r[0] as Float) / 4).toNumber() * 4;
                if (y0 >= BASE) {
                    continue;
                }
                var lit = x + 2 <= PK[r[1] as Number];
                var sn = y0;
                if (y0 < SNOWY - 8) {
                    sn = SNOWY + JIT[(x / 4) % 8];
                    dc.setColor(P[lit ? 2 : 3], -1);
                    dc.fillRectangle(x, y0, 4, sn - y0);
                }
                dc.setColor(P[lit ? 0 : 1], -1);
                dc.fillRectangle(x, sn, 4, 290 - sn);
                dc.setColor(G.mix(P[lit ? 0 : 1], P[4], 0.45), -1);
                dc.fillRectangle(x, 290, 4, BASE - 290);
            }
            dc.setColor(P[4], -1);
            dc.fillRectangle(0, BASE - 12, 454, 454 - BASE + 12);

            // ---- route (done part solid) and camps
            for (var i = 0; i <= 50; i++) {
                var t = i / 50.0;
                if (t > f && i % 2 == 1) {
                    continue;
                }
                var q = at(t);
                dc.setColor(t <= f ? P[7] : G.mix(P[1], P[7], 0.35), -1);
                dc.fillRectangle(Math.floor((q[0] as Float) / 2).toNumber() * 2, Math.floor((q[1] as Float) / 2).toNumber() * 2, 2, 2);
            }
            for (var c = 0; c < 4; c++) {
                var q = at(CAMPF[c]);
                Spr.draw(dc, SprClimb.TENT, Math.round(q[0]).toNumber() + 6, Math.round(q[1]).toNumber() - 18, 2,
                    [-1, P[16], P[17], night && c == last ? P[18] : P[17], P[1]], false);
            }
            if (top) {
                dc.setColor(P[14], -1);
                dc.fillRectangle(PK[0] - 1, PK[1] - 22, 2, 22);
                dc.setColor(P[26], -1);
                dc.fillRectangle(PK[0] + 1, PK[1] - 22, 10, 6);
            }

            // ---- foreground: rock ledge, or the summit ridge at the goal; the tent at night
            var fg = top ? CREST : LEDGE;
            dc.setColor(top ? P[3] : P[5], -1);
            poly(dc, fg);
            dc.setColor(top ? P[2] : P[6], -1);
            for (var i = 0; i < 8; i += 2) {
                dc.fillRectangle(fg[i], fg[i + 1] - 2, fg[i + 2] - fg[i], 4);
            }
            if (night && !top) {
                Spr.draw(dc, SprClimb.TENT, 50, 310, 5, [-1, P[16], P[17], P[18], P[1]], false);
            }

            // ---- time, date, story caption
            dc.setColor(0x000000, -1);
            F.px(dc, G.timeStr(d), 229, 34, 5, 1, 0);
            dc.setColor(P[14], -1);
            F.px(dc, G.timeStr(d), 227, 32, 5, 1, 0);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 78, 2, 1, 0);
            var si = Math.floor(f * 8).toNumber();
            var cap = top ? "GIPFEL!" : night ? NAMES[last] : SEG[si < 7 ? si : 7];
            F.px(dc, cap, 300, 344, 2, 1, 0);
            F.px(dc, G.num(5364 + f * 3484) + " M", 300, 362, 3, 1, 0);
            dc.setColor(G.mix(P[14], P[4], 0.4), -1);
            F.px(dc, (d.floors > 0 ? d.floors : 0) + "/" + (d.floorsGoal > 0 ? d.floorsGoal : 10) + " ETAGEN", 300, 390, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        // ---- clouds drift past the massif
        dc.setColor(night ? G.mix(P[15], P[12], 0.75) : P[15], -1);
        for (var i = 0; i < 2; i++) {
            var cx = ((i * 211 + tt / (45 + i * 30)) % 560) - 80;
            var cy = 150 + i * 64;
            dc.fillRectangle(cx, cy, 56, 8);
            dc.fillRectangle(cx + 12, cy - 8, 28, 8);
        }
        // ---- "you are here" on the route
        var q = top ? [PK[0], PK[1]] : at(f);
        if (!live || (tt / 400) % 2 == 0) {
            dc.setColor(P[26], -1);
            dc.fillRectangle(Math.round(q[0]).toNumber() - 3, Math.round(q[1]).toNumber() - 3, 6, 6);
        }
        // ---- the climber close up
        var ppal = [-1, P[19], P[20], P[21], P[22], P[23], P[24], P[25]];
        if (top) {
            var fy = Math.round((1 - G.spring(G.clamp((p - 0.3) / 0.6, 0, 1))) * 60).toNumber();
            Spr.draw(dc, SprClimb.FLAG, 150, 316 - 48 + fy, 4, [-1, P[14], P[26]], live && (tt / 300) % 2 == 1);
            Spr.draw(dc, SprClimb.CHEER, 84, 316 - 80, 5, ppal, false);
        } else if (night) {
            // asleep in the tent: Zzz rising from the door
            dc.setColor(P[14], -1);
            for (var k = 0; k < 3; k++) {
                if (!live && k > 0) {
                    break;
                }
                var ph = ((tt + k * 400) % 1200) / 1200.0;
                F.px(dc, "Z", 128 + Math.round(ph * 30).toNumber() + k * 4, 300 - Math.round(ph * 60).toNumber(), 2 + (ph > 0.5 ? 1 : 0), 1, 0);
            }
        } else {
            // climbs up onto the ledge on every raise, then works with the ice axe
            var cy = 272 + Math.round((1 - G.ease(G.clamp(p / 0.8, 0, 1))) * 190).toNumber();
            var fr = p < 1 ? (a.t / 140) % 2 : (tt / 500) % 2;
            Spr.draw(dc, fr == 1 ? SprClimb.UP_B : SprClimb.UP_A, 96, cy, 5, ppal, false);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        dc.setColor(st == 3 ? 0x306230 : 0x4A4A52, -1);
        for (var x = 24; x < 432; x += 8) {
            var r = ridge(x + 2);
            if ((r[0] as Float) < BASE) {
                dc.fillRectangle(x + o[0], Math.floor(r[0] as Float).toNumber() + o[1], 3, 3);
            }
        }
        var f = prog(d);
        var q = f >= 1 ? [PK[0], PK[1]] : at(f);
        dc.setColor(G.dim(d.accent, 0.6), -1);
        dc.fillRectangle(Math.round(q[0]).toNumber() - 3 + o[0], Math.round(q[1]).toNumber() - 3 + o[1], 6, 6);
        dc.setColor(st == 3 ? 0x8BAC0F : 0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 32 + o[1], 5, 1, 1);
    }
}
