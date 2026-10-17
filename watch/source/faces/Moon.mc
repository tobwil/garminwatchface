import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// MOON — "Mondflug": every week is a mission to the moon. On Monday the rocket stands on the pad,
// the weekly goal (climbed metres, bike km or training days, see d.src) carries it along the
// transfer orbit; at 100 % it has landed and planted the flag. Every wrist raise is a short
// episode: countdown, ignition, and the rocket covers the last stretch of its journey. A caption
// names the mission phase. The moon shows its real phase. Styles: 1 Retro, 2 Blaupause, 3 Gameboy.
// Mirrors web/js/faces/moon.js.
class FaceMoon extends Face {
    const MX = 316;
    const MY = 132;
    const MR = 48;
    const EY = 652;
    const ER = 300;
    const P0X = 150;
    const P0Y = 340;
    const P1X = 60;
    const P1Y = 140;
    const P2X = 300;
    const P2Y = 92;
    // continents on the earth: x, y, w, h
    const LAND = [96, 372, 48, 12, 84, 384, 72, 16, 112, 400, 40, 24, 236, 364, 56, 12, 228, 376, 88, 20, 260, 396, 64, 28, 336, 380, 36, 16];
    const PHASES = ["STARTRAMPE", "AUFSTIEG", "ERDUMLAUFBAHN", "TRANSFER", "ANFLUG", "LANDUNG", "AUF DEM MOND!"];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 12;
    }

    // [bg, star, ocean, land, atmo, moon, moon shade, hull, window, fins, hull shade, fl1, fl2, fl3, text, dim, path, tower]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x103A7A, 0x6A8AC8, 0x1D4F9A, 0x2F68B8, 0x5A8AD0, 0xC8D8F0, 0x183A70, 0xFFFFFF, 0x103A7A, 0xD8E4FF, 0xA8C0E8,
                0xFFFFFF, 0xC8D8FF, 0x8AA8E0, 0xFFFFFF, 0xA8C0E8, 0x8AA8E0, 0xC8D8F0] as Array<Number>;
        }
        if (st == 3) {
            return [0x0F380F, 0x8BAC0F, 0x306230, 0x8BAC0F, 0x8BAC0F, 0x9BBC0F, 0x306230, 0x9BBC0F, 0x0F380F, 0x8BAC0F, 0x8BAC0F,
                0x9BBC0F, 0x8BAC0F, 0x306230, 0x9BBC0F, 0x8BAC0F, 0x306230, 0x8BAC0F] as Array<Number>;
        }
        return [-1, 0xFFFFFF, 0x1F5FBF, 0x3AA848, 0x6AB8FF, 0xD8D4C8, 0x3A3A40, 0xF0F0F0, 0x3AC8FF, acc, 0xB0B0B8,
            0xFFF2A0, 0xFFB02A, 0xFF4A2A, 0xFFFFFF, 0x8A8A9A, 0x5A5A6A, 0x8A8A8A] as Array<Number>;
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

    hidden function bx(t) as Float {
        return ((1 - t) * (1 - t) * P0X + 2 * t * (1 - t) * P1X + t * t * P2X).toFloat();
    }

    hidden function by(t) as Float {
        return ((1 - t) * (1 - t) * P0Y + 2 * t * (1 - t) * P1Y + t * t * P2Y).toFloat();
    }

    hidden function fl4(v) as Number {
        return Math.floor(v / 4.0).toNumber() * 4;
    }

    // filled pixel disc (4 px rows) centred at cx, cy
    hidden function disc(dc as Dc, cx, cy, r as Number) as Void {
        for (var y = -r; y < r; y += 4) {
            var yy = y + 2;
            var hw = fl4(Math.sqrt(r * r - yy * yy));
            if (hw > 0) {
                dc.fillRectangle(cx - hw, cy + y, 2 * hw, 4);
            }
        }
    }

    // lit part of the moon for phase k (0 new, .5 full)
    hidden function moonLit(dc as Dc, k, r as Number, ox as Number, oy as Number) as Void {
        for (var y = -r; y < r; y += 4) {
            var yy = y + 2;
            var hw = fl4(Math.sqrt(r * r - yy * yy));
            if (hw <= 0) {
                continue;
            }
            var x0;
            var x1;
            if (k < 0.5) {
                x0 = Math.round(hw * Math.cos(k * 2 * Math.PI) / 4).toNumber() * 4;
                x1 = hw;
            } else {
                x0 = -hw;
                x1 = Math.round(hw * Math.cos((k - 0.5) * 2 * Math.PI) / 4).toNumber() * 4;
            }
            if (x1 > x0) {
                dc.fillRectangle(MX + x0 + ox, MY + y + oy, x1 - x0, 4);
            }
        }
    }

    hidden function phaseIdx(f) as Number {
        if (f >= 1) {
            return 6;
        }
        if (f < 0.02) {
            return 0;
        }
        if (f < 0.15) {
            return 1;
        }
        if (f < 0.35) {
            return 2;
        }
        if (f < 0.7) {
            return 3;
        }
        if (f < 0.93) {
            return 4;
        }
        return 5;
    }

    hidden function frac(sg as Array) as Float {
        var g = sg[1] as Number;
        return g > 0 ? G.clamp((sg[0] as Number) / g.toFloat(), 0, 1).toFloat() : 0.0;
    }

    // static layer: stars, moon, earth, tower, orbit, captions; the rocket's episode moves
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
        if (P[0] != -1 && S) {
            dc.setColor(P[0], -1);
            dc.fillRectangle(0, 0, 454, 454);
        }
        var sg = stage(d);
        var f = frac(sg);

        if (S) {
            // ---- stars (twinkle while live)
            var seed = 4242;
            for (var i = 0; i < 34; i++) {
                seed = G.rnd(seed);
                var sx = 40 + (seed % 374);
                seed = G.rnd(seed);
                var sy = 30 + (seed % 300);
                if (live && (tt / 260 + i * 5) % 17 == 0) {
                    continue;
                }
                dc.setColor(i % 4 == 0 ? P[1] : G.mix(P[0] == -1 ? 0 : P[0], P[1], 0.55), -1);
                var ss = i % 6 == 0 ? 4 : 2;
                dc.fillRectangle(sx / 4 * 4, sy / 4 * 4, ss, ss);
            }

            // ---- moon (real phase)
            dc.setColor(P[6], -1);
            disc(dc, MX, MY, MR);
            dc.setColor(P[5], -1);
            moonLit(dc, d.moon >= 0 ? d.moon : 0.5, MR, 0, 0);

            // ---- earth with atmosphere and continents
            dc.setColor(P[4], -1);
            for (var y = EY - ER - 6; y < 454; y += 4) {
                var hw = fl4(Math.sqrt((ER + 6) * (ER + 6) - (y + 2 - EY) * (y + 2 - EY)));
                dc.fillRectangle(227 - hw, y, 2 * hw, 4);
            }
            dc.setColor(P[2], -1);
            for (var y = EY - ER; y < 454; y += 4) {
                var hw = fl4(Math.sqrt(ER * ER - (y + 2 - EY) * (y + 2 - EY)));
                dc.fillRectangle(227 - hw, y, 2 * hw, 4);
            }
            dc.setColor(P[3], -1);
            for (var i = 0; i < LAND.size(); i += 4) {
                dc.fillRectangle(LAND[i], LAND[i + 1], LAND[i + 2], LAND[i + 3]);
            }

            // ---- launch tower
            dc.setColor(P[17], -1);
            Spr.draw(dc, SprMoon.TOWER, 168, 292, 3, [-1, P[17]], false);
            dc.fillRectangle(128, 358, 64, 4);

            // ---- transfer orbit: flown part solid, rest faint
            for (var i = 1; i < 30; i++) {
                var t = i / 30.0;
                dc.setColor(t <= f ? P[15] : P[16], -1);
                if (t <= f || i % 2 == 0) {
                    dc.fillRectangle(fl4(bx(t)), fl4(by(t)), 4, 4);
                }
            }
        }

        if (M) {
            // ---- episode: countdown, ignition, the last stretch
            var f0 = f >= 1 ? 1.0 : (f - 0.12 > 0 ? f - 0.12 : 0.0);
            var mv = G.easeInOut(G.clamp((p - 0.35) / 0.65, 0, 1));
            var fr = f >= 1 ? 1.0 : G.lerp(f0, f, mv);
            var rx;
            var ry;
            if (fr >= 1) {
                rx = MX - 13;
                ry = MY - MR - 51;
            } else if (fr <= 0) {
                rx = P0X - 13;
                ry = 307;
            } else {
                rx = Math.round(bx(fr)).toNumber() - 13;
                ry = Math.round(by(fr)).toNumber() - 45;
            }
            if (f >= 1 && p < 1) {
                ry -= Math.round((1 - mv) * 60).toNumber(); // landing approach
            }
            var burn = (p > 0.3 && p < 1) || (live && f > 0 && f < 1);
            var shake = p > 0.25 && p < 0.4 ? ((a.t / 40) % 2) * 2 : 0;
            if (burn) {
                Spr.draw(dc, (a.t / 90) % 2 == 0 ? SprMoon.FLAME_A : SprMoon.FLAME_B, rx + 6, ry + 51, 3, [-1, P[11], P[12], P[13]], false);
            }
            // smoke at the pad on liftoff
            if (f < 0.05 && p > 0.3 && p < 1) {
                dc.setColor(P[15], -1);
                var sp = (p - 0.3) / 0.7;
                for (var i = 0; i < 5; i++) {
                    var r = Math.round(6 + sp * 14 + i * 2).toNumber();
                    disc(dc, P0X - 30 + i * 15, 352 - (i % 2) * 6, r / 4 * 4 + 4);
                }
            }
            Spr.draw(dc, SprMoon.ROCKET, rx + shake, ry, 3, [-1, P[7], P[8], P[9], P[10]], false);
            if (f >= 1) {
                Spr.draw(dc, SprMoon.FLAG, MX + 18, MY - MR - 26, 3, [-1, P[17], P[9]], false);
            }

            // ---- countdown at the start of every episode
            if (p > 0.02 && p < 0.33 && f < 1) {
                var n = 3 - Math.floor((p - 0.02) / 0.1).toNumber();
                dc.setColor(P[14], -1);
                F.px(dc, "T-" + (n > 1 ? n : 1), rx + 40, ry + 10, 3, 0, 0);
            }
        }

        if (!S) {
            return;
        }
        // ---- time, date, mission caption
        dc.setColor(P[14], -1);
        F.px(dc, G.timeStr(d), 150, 46, 5, 1, 0);
        dc.setColor(P[15], -1);
        F.px(dc, "MISSION KW " + d.wk, 150, 90, 2, 1, 0);
        dc.setColor(P[14], -1);
        F.px(dc, PHASES[phaseIdx(f)], 300, 244, 2, 1, 0);
        dc.setColor(P[15], -1);
        F.px(dc, sg[2] as String, 300, 264, 2, 1, 0);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var c = st == 3 ? 0x306230 : 0x5A5A6A;
        var f = frac(stage(d));
        dc.setColor(G.dim(0xD8D4C8, 0.4), -1);
        moonLit(dc, d.moon >= 0 ? d.moon : 0.5, MR, o[0], o[1]);
        dc.setColor(c, -1);
        for (var i = 1; i < 30; i += 2) {
            var t = i / 30.0;
            dc.fillRectangle(fl4(bx(t)) + o[0], fl4(by(t)) + o[1], 2, 2);
        }
        var rx = Math.round(bx(f)).toNumber() - 13;
        var ry = Math.round(by(f)).toNumber() - 45;
        if (f >= 1) {
            rx = MX - 13;
            ry = MY - MR - 51;
        }
        if (f <= 0) {
            rx = P0X - 13;
            ry = 307;
        }
        var rc = G.dim(0xF0F0F0, 0.5);
        Spr.draw(dc, SprMoon.ROCKET, rx + o[0], ry + o[1], 3, [-1, rc, -1, rc, -1], false);
        dc.setColor(0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 150 + o[0], 46 + o[1], 5, 1, 1);
    }
}
