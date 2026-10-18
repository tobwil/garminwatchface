import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// GARDEN — "Pixel-Garten": a raised bed that grows with you over weeks. Every day is judged at
// midnight from what the watch knows about it (sleep score, steps against the goal, stress, Body
// Battery): a good day makes the youngest plant grow (a great day twice), sows a new seed once all
// have taken root and brings in the harvest when everything is ripe; bad days make the garden wilt.
// The state lives in the watch's storage, so the garden remembers. Six plants: tulips (in the
// accent colour), sunflowers, a strawberry and a tomato on its stake, from seed to fruit. Today's
// "water" on the board shows how the day is going and what is still missing; a watering can pours on
// every wrist raise, butterflies visit the blossoms, fireflies glow on summer nights, and after three
// good days in a row a hedgehog moves in. Lives with the year and the real weather (Season.mc).
// Styles: 1 Garten, 2 Nacht, 3 Gameboy. Mirrors web/js/faces/garden.js.
class FaceGarden extends Face {
    const BED = 304;
    const XS = [72, 134, 196, 258, 320, 382];
    const KIND = [1, 0, 3, 2, 0, 1];
    const KC = [0xFFD23A, 0x6A3A1A, 0x3A2410, -1, 0xFFE05A, -1, 0xFFE05A, 0xFFE05A, 0xE8302A, 0xFFFFFF, 0xFFE05A, 0xE8304A];

    hidden var _gs = null; // the garden, read from the storage with every static redraw
    hidden var _nf = 0.0;
    hidden var _wf = 0.0;

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

    // the parts of today's score without the steps: 0.3 sleep + 0.15 calm + 0.15 energy
    hidden function base(d as D) as Float {
        var sl = d.sleep > 0 ? d.sleep : 60;
        var ca = d.stress >= 0 ? 100 - d.stress : 60;
        var en = d.bb >= 0 ? d.bb : 60;
        return 0.3 * sl + 0.15 * ca + 0.15 * en;
    }

    hidden function goalOf(d as D) as Number {
        return d.stepGoal > 0 ? d.stepGoal : 10000;
    }

    // today's score 0..100 (60 = the garden grows)
    hidden function score(d as D) as Number {
        return Math.round(base(d) + 40 * G.clamp(d.steps.toFloat() / goalOf(d), 0, 1)).toNumber();
    }

    // one growth step: the youngest plant grows; a seed once all have taken root; harvest when all are ripe
    hidden function grow(P as Array<Number>) as Number {
        var b = -1;
        for (var i = 0; i < 6; i++) {
            if (P[i] > 0 && P[i] < 6 && (b < 0 || P[i] < P[b])) {
                b = i;
            }
        }
        var e = -1;
        for (var i = 0; i < 6; i++) {
            if (P[i] == 0 && e < 0) {
                e = i;
            }
        }
        if (e >= 0 && (b < 0 || P[b] >= 3)) {
            P[e] = 1;
            return 0;
        }
        if (b >= 0) {
            P[b] += 1;
            return 0;
        }
        for (var i = 0; i < 6; i++) {
            if (P[i] == 6) {
                P[i] = 1;
                return 1;
            }
        }
        return 0;
    }

    // persistent state -> [plants (6 stages 0..6), age in days, harvests, good-day streak, wilt 0..3]
    hidden function sync(d as D) as Array {
        var today = dayKey(d);
        var day = St.get("gaD", -1);
        var sc = score(d);
        if (day == -1) {
            // first start: a sprout and two seeds
            St.set("gaP", [2, 1, 0, 1, 0, 0]);
            St.set("gaA", 1);
            St.set("gaH", 0);
            St.set("gaS", 0);
            St.set("gaW", 0);
            St.set("gaD", today);
            St.set("gaT", sc);
        } else if (day != today) {
            var P = (St.get("gaP", [2, 1, 0, 1, 0, 0]) as Array<Number>).slice(0, 6);
            var H = St.get("gaH", 0);
            var sk = St.get("gaS", 0);
            var w = St.get("gaW", 0);
            if (day == yKey(d)) {
                // judge yesterday (after a gap the garden simply waited for you)
                var y = St.get("gaT", 0);
                if (y >= 60) {
                    H += grow(P);
                    if (y >= 80) {
                        H += grow(P);
                    }
                    sk += 1;
                    w = w > 0 ? w - 1 : 0;
                } else if (y < 35) {
                    sk = 0;
                    if (w >= 3) {
                        var t = 0;
                        for (var i = 1; i < 6; i++) {
                            if (P[i] > P[t]) {
                                t = i;
                            }
                        }
                        if (P[t] > 1) {
                            P[t] -= 1;
                        }
                    }
                    w = w < 3 ? w + 1 : 3;
                }
            } else {
                sk = 0;
            }
            St.set("gaP", P);
            St.set("gaA", St.get("gaA", 1) + 1);
            St.set("gaH", H);
            St.set("gaS", sk);
            St.set("gaW", w);
            St.set("gaD", today);
            St.set("gaT", sc);
        } else if ((sc - St.get("gaT", 0)).abs() >= 2) {
            St.set("gaT", sc);
        }
        return [St.get("gaP", [2, 1, 0, 1, 0, 0]), St.get("gaA", 1), St.get("gaH", 0), St.get("gaS", 0), St.get("gaW", 0)];
    }

    // [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, hedge, fence,
    //  fence shade, soil, soil dark, wood, wood dark, grass, grass dark, text, text dim, board, board text,
    //  stem, leaf, leaf dark, star, spines, face, can, water]
    hidden function pal(st as Number) as Array<Number> {
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [c, e, b, c, a, a, b, e, c, b, a, b, a, c, b, a, b, a, e, a, b, a, e, a, c, b, e] as Array<Number>;
        }
        var night = st == 2;
        return [0x3A8AD8, 0xA8D8FF, 0x5A4A9A, 0xFF9A6A, night ? 0x000000 : 0x060A20, night ? 0x060C1A : 0x141C44,
            0x2A5A2A, 0xF0ECE0, 0xB8B0A0, 0x5A3A24, 0x3A2414, 0x9A6A3A, 0x6A4422, 0x4A8A3A, 0x3A7030, 0xFFFFFF,
            0xE0F0D0, 0x2A3A2A, 0xFFFFFF, 0x3A8A2A, 0x5AC83A, 0x2A6A24, 0xFFFFFF, 0x6A5040, 0xE8C8A0, 0x7A9AB8, 0x8AD0FF] as Array<Number>;
    }

    hidden function dk(c as Number) as Number {
        return G.mix(c, 0x050814, _nf);
    }

    // wilting turns the plants brown
    hidden function wl(c as Number) as Number {
        return dk(G.mix(c, 0x8A6A3A, _wf));
    }

    // static layer: sky, hedge, fence, bed, plants, board, texts; the watering can, butterflies,
    // fireflies, the hedgehog, rain or snow and the fairy lights move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var st = d.cfg.style;
        var P = pal(st);
        var p = a.intro;
        var tt = a.live ? a.t : 0;
        var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var k = st == 2 || el < -6 ? 2 : el > 4 ? 0 : 1;
        _nf = st == 3 ? 0.0 : [0.0, 0.3, 0.6][k];
        var ev = Season.event(d);
        var sn = st != 3 && Season.snowy(d);
        if (S || _gs == null) {
            _gs = sync(d);
        }
        var gs = _gs as Array;
        var PL = gs[0] as Array<Number>;
        var sc = score(d);

        if (S) {
            // ---- sky, sun / moon, stars
            for (var i = 0; i < 5; i++) {
                dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 4.0), -1);
                dc.fillRectangle(0, i * 52, 454, 52);
            }
            if (k == 2) {
                dc.setColor(P[22], -1);
                for (var i = 0; i < 24; i++) {
                    var ss = i % 6 == 0 ? 4 : 2;
                    dc.fillRectangle(30 + ((i * 101 + 17) % 394), 92 + ((i * 47 + 11) % 130), ss, ss);
                }
            }
            if (el > -4 && st != 2) {
                dc.setColor(st == 3 ? 0x9BBC0F : 0xFFF6D0, -1);
                dc.fillCircle(100, 236 - Math.round(G.clamp(el, -4, 40) * 3.2).toNumber(), 14);
            } else if (k == 2) {
                dc.setColor(st == 3 ? 0x9BBC0F : 0xF4F0D8, -1);
                dc.fillCircle(100, 120, 12);
                dc.setColor(P[4], -1);
                dc.fillCircle(106, 116, 10);
            }

            // ---- hedge, fence
            dc.setColor(dk(sn ? 0xC8D4E2 : P[6]), -1);
            for (var x = 0; x < 454; x += 4) {
                var h = 26 + Math.round(6 * Math.sin(x / 19.0) + 4 * Math.sin(x / 7.0)).toNumber();
                dc.fillRectangle(x, 262 - h, 4, h);
            }
            dc.setColor(dk(P[8]), -1);
            dc.fillRectangle(0, 262, 454, 4);
            dc.fillRectangle(0, 288, 454, 4);
            dc.setColor(dk(P[7]), -1);
            for (var x = 6; x < 454; x += 22) {
                dc.fillRectangle(x, 252, 12, 52);
                dc.fillRectangle(x + 4, 248, 4, 4);
            }
            if (sn) {
                Season.snowCap(dc, 0, 254, 454);
            }

            // ---- the bed: soil (dry when the day lacks steps), frame, grass
            var dry = !sn && d.mins >= 720 && d.steps < goalOf(d) * 0.3;
            dc.setColor(dk(sn ? 0xE8EEF6 : dry ? G.mix(P[9], 0xC8A878, 0.4) : P[9]), -1);
            dc.fillRectangle(40, BED, 374, 30);
            dc.setColor(dk(sn ? 0xC8D4E2 : P[10]), -1);
            for (var i = 0; i < 14; i++) {
                dc.fillRectangle(48 + ((i * 53) % 356), BED + 6 + ((i * 19) % 20), dry ? 10 : 4, 2);
            }
            dc.setColor(dk(sn ? 0xEEF4FA : P[13]), -1);
            dc.fillRectangle(0, 348, 454, 106);
            dc.setColor(dk(sn ? 0xD8E2EC : P[14]), -1);
            for (var i = 0; i < 12; i++) {
                dc.fillRectangle(30 + ((i * 89) % 394), 352 + ((i * 37) % 60), 4, 6);
            }
            dc.setColor(dk(P[11]), -1);
            dc.fillRectangle(34, 334, 386, 14);
            dc.fillRectangle(34, 326, 8, 22);
            dc.fillRectangle(412, 326, 8, 22);
            dc.setColor(dk(P[12]), -1);
            dc.fillRectangle(34, 346, 386, 2);
            if (sn) {
                Season.snowCap(dc, 34, 334, 386);
            }

            // ---- the plants (wilting turns them brown)
            _wf = (gs[4] as Number) * 0.2;
            for (var i = 0; i < 6; i++) {
                var s = PL[i];
                var kd = KIND[i];
                var cx = XS[i];
                if (s == 0) {
                    continue;
                }
                if (s == 1) {
                    dc.setColor(dk(P[10]), -1);
                    dc.fillRectangle(cx - 10, BED - 4, 20, 4);
                    dc.setColor(dk(0xC8A060), -1);
                    dc.fillRectangle(cx - 2, BED - 8, 4, 4);
                    continue;
                }
                var pet = kd == 1 ? d.accent : KC[kd * 3];
                var sp = s == 2 ? SprGarden.SPROUT : s == 3 ? SprGarden.YOUNG : s == 4 ? grown(kd) : s == 5 ? bloom(kd) : fruit(kd);
                Spr.draw(dc, sp, cx - 22, BED - sp[1] * 4, 4,
                    [-1, wl(P[19]), wl(P[20]), wl(P[21]), wl(pet), wl(KC[kd * 3 + 1] < 0 ? pet : KC[kd * 3 + 1]),
                        wl(KC[kd * 3 + 2] < 0 ? pet : KC[kd * 3 + 2]), dk(0x8A6A3A)], false);
            }

            // ---- decorations for the special days
            if (ev == Season.EASTER) {
                Season.eggs(dc, 52, 358);
            } else if (ev == Season.HALLOWEEN) {
                Season.pumpkin(dc, 70, 362, 1);
            } else if (ev == Season.VALENTINE) {
                Season.heart(dc, 180, 140, 2);
            }

            // ---- the garden diary board: data slots and today's water
            dc.setColor(dk(P[12]), -1);
            dc.fillRectangle(262, 200, 6, 50);
            dc.fillRectangle(380, 200, 6, 50);
            dc.setColor(P[17], -1);
            dc.fillRectangle(232, 108, 180, 94);
            dc.setColor(P[20], -1);
            F.px(dc, "GARTEN-TAGEBUCH", 322, 112, 1, 1, 0);
            for (var i = 0; i < 3; i++) {
                var s = d.slots[i];
                var lb = s[:lbl] as String;
                if (lb.length() == 0 || G.stag(p, i, 0.1, 0.4) <= 0) {
                    continue;
                }
                var val = s[:val] as String;
                while (lb.length() > 2 && F.pxW(lb, 2) > 150 - F.pxW(val, 2)) {
                    lb = lb.substring(0, lb.length() - 1);
                }
                dc.setColor(G.mix(P[18], P[17], 0.35), -1);
                F.px(dc, lb, 242, 126 + i * 18, 2, 0, 0);
                dc.setColor(P[18], -1);
                F.px(dc, val, 402, 126 + i * 18, 2, 2, 0);
            }
            dc.setColor(G.mix(P[18], P[17], 0.35), -1);
            F.px(dc, "HEUTE", 242, 184, 1, 0, 0);
            dc.setColor(G.mix(P[17], 0x000000, 0.5), -1);
            dc.fillRectangle(280, 184, 122, 10);
            dc.setColor(sc >= 60 ? P[20] : P[26], -1);
            dc.fillRectangle(282, 186, Math.round(118 * G.clamp(sc / 100.0, 0, 1)).toNumber(), 6);
            dc.setColor(P[18], -1);
            dc.fillRectangle(282 + 71, 182, 2, 14);

            // ---- time, date or greeting, captions
            dc.setColor(0x000000, -1);
            F.px(dc, G.timeStr(d), 229, 26, 5, 1, 0);
            dc.setColor(st == 3 ? 0x0F380F : P[15], -1);
            F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
            F.px(dc, ev != Season.NONE ? Season.greeting(ev) : d.dowStr + " " + d.day + ". " + d.monStr, 227, 68, 2, 1, 0);
            var n = 0;
            for (var i = 0; i < 6; i++) {
                if (PL[i] > 0) {
                    n++;
                }
            }
            var dark = sn && k < 2;
            var H = gs[2] as Number;
            dc.setColor(dark ? 0x1E2A4A : P[15], -1);
            F.px(dc, "TAG " + gs[1] + "   " + (H > 0 ? "ERNTE " + H : n + " PFLANZEN"), 227, 362, 2, 1, 0);
            var need = Math.ceil(((60 - base(d)) / 40) * goalOf(d)).toNumber() - d.steps;
            var msg;
            if (d.mins < 300 || d.mins >= 1320) {
                msg = sc >= 60 ? "MORGEN WÄCHST WAS" : "DER GARTEN SCHLÄFT";
            } else if (sc >= 80) {
                msg = "PRÄCHTIGER TAG!";
            } else if (sc >= 60) {
                msg = "MORGEN WÄCHST WAS";
            } else if (need > 0 && d.steps + need <= goalOf(d)) {
                msg = "NOCH " + G.num(need) + " SCHRITTE";
            } else if ((gs[4] as Number) >= 2) {
                msg = "DER GARTEN WELKT";
            } else if (d.sleep > 0 && d.sleep < 60) {
                msg = "ZU WENIG SCHLAF";
            } else if (d.stress > 50) {
                msg = "ZU VIEL STRESS";
            } else {
                msg = "ENERGIE TANKEN";
            }
            dc.setColor(dark ? 0x4A5A7A : P[16], -1);
            F.px(dc, msg, 227, 384, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        // ---- real weather, fairy lights on the fence, fireworks, balloons
        Season.precip(dc, d, 0, 90, 454, 210, tt);
        if (ev == Season.ADVENT || ev == Season.XMAS) {
            Season.lights(dc, 10, 250, 444, 250, tt);
        } else if (ev == Season.NYE) {
            Season.fireworks(dc, 40, 96, 170, 60, tt);
        } else if (ev == Season.BIRTHDAY) {
            Season.balloons(dc, 52, 300, tt);
        }
        // ---- the watering can pours over the bed on every raise (by day)
        if (k < 2 && p < 1 && !sn) {
            var cx = Math.round(G.lerp(20, 400, G.ease(p))).toNumber();
            Spr.draw(dc, SprGarden.CAN, cx - 16, 210, 3, [-1, P[25], G.mix(P[25], 0, 0.4)], false);
            dc.setColor(P[26], -1);
            for (var i = 0; i < 4; i++) {
                dc.fillRectangle(cx + 18 + (i % 2) * 4, 236 + ((a.t / 4 + i * 17) % 64), 2, 6);
            }
        }
        var bl = false;
        for (var i = 0; i < 6; i++) {
            if (PL[i] >= 5) {
                bl = true;
            }
        }
        if (k < 2 && bl && !sn) {
            // butterflies visit the blossoms
            for (var i = 0; i < 2; i++) {
                var bx = 110 + i * 170 + Math.round(50 * Math.sin(tt / 1300.0 + i * 2)).toNumber();
                var by = 214 + Math.round(18 * Math.sin(tt / 500.0 + i * 3)).toNumber();
                Spr.draw(dc, (tt / 150 + i) % 2 == 0 ? SprGarden.BFLY_A : SprGarden.BFLY_B, bx, by, 3,
                    [-1, i == 0 ? 0xFFD23A : 0x8AD8FF, 0x2A2A2A], false);
            }
        } else if (k == 2 && !sn && Season.season(d) % 3 != 0) {
            // fireflies on spring and summer nights
            for (var i = 0; i < 6; i++) {
                if ((tt / 400 + i * 3) % 5 == 0) {
                    continue;
                }
                dc.setColor(i % 2 == 0 ? 0xD8FF6A : 0xFFE05A, -1);
                dc.fillRectangle(60 + i * 62 + Math.round(16 * Math.sin(tt / 900.0 + i)).toNumber(),
                    230 + ((i * 37) % 60) + Math.round(10 * Math.sin(tt / 700.0 + i * 2)).toNumber(), 4, 4);
            }
        }
        // ---- the hedgehog lives here after three good days in a row
        if ((gs[3] as Number) >= 3) {
            var run = G.clamp(p / 0.8, 0, 1);
            var hx = Math.round(G.lerp(-40, 360, G.ease(run))).toNumber();
            var step = run < 1 && (a.t / 120) % 2 == 1;
            Spr.draw(dc, step ? SprGarden.HEDGE_B : SprGarden.HEDGE_A, hx, 339, 3, [-1, dk(P[23]), dk(P[24]), 0x1A1A1A], false);
        }
    }

    hidden function grown(kd as Number) {
        return kd == 0 ? SprGarden.SUN_GROWN : kd == 1 ? SprGarden.TULIP_GROWN : kd == 2 ? SprGarden.TOM_GROWN : SprGarden.BERRY_GROWN;
    }

    hidden function bloom(kd as Number) {
        return kd == 0 ? SprGarden.SUN_BLOOM : kd == 1 ? SprGarden.TULIP_BLOOM : kd == 2 ? SprGarden.TOM_BLOOM : SprGarden.BERRY_BLOOM;
    }

    hidden function fruit(kd as Number) {
        return kd == 0 ? SprGarden.SUN_FRUIT : kd == 1 ? SprGarden.TULIP_FRUIT : kd == 2 ? SprGarden.TOM_FRUIT : SprGarden.BERRY_FRUIT;
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var PL = _gs == null ? [2, 1, 0, 1, 0, 0] : (_gs as Array)[0] as Array<Number>;
        dc.setColor(st == 3 ? 0x306230 : 0x2A4A2A, -1);
        for (var i = 0; i < 6; i++) {
            if (PL[i] > 0) {
                dc.fillRectangle(XS[i] - 2 + o[0], 330 - PL[i] * 14 + o[1], 4, PL[i] * 14);
            }
        }
        dc.setColor(st == 3 ? 0x306230 : 0x3A3A42, -1);
        dc.fillRectangle(40 + o[0], 330 + o[1], 374, 2);
        dc.setColor(st == 3 ? 0x8BAC0F : 0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
    }
}
