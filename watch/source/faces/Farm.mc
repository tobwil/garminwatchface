import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// FARM — "Pixel-Hof": a day on a small farm, told by the real sun. At dawn the rooster crows on the
// fence post and the farmer steps out of the barn, during the day he waters the field, which grows
// with the steps (seed, sprout, plant, wheat), and at the step goal it is harvest time: golden wheat
// and the farmer cheering with a sheaf. In the evening he rests on the bench, at night the farm
// sleeps under the real stars and moon. The three data slots are chalked on the farm shop board.
// The farm lives with the year and the real weather (Season.mc): snow in a freezing winter, flowers in
// spring, golden hills in autumn, rain and snowfall, fairy lights and a tree at Christmas, eggs at
// Easter, a pumpkin at Halloween, balloons on your birthday, fireworks on New Year's Eve.
// Styles: 1 Sommer, 2 Herbst, 3 Gameboy. Mirrors web/js/faces/farm.js.
class FaceFarm extends Face {
    const GY = 338;
    const ROWS = [314, 330, 346, 362];
    const CAP = ["NACHTRUHE", "KIKERIKI!", "FELDARBEIT", "FEIERABEND", "ERNTEZEIT!"];
    const STGH = [0, 0, 6, 10, 16];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 8;
    }

    // scene: 0 night, 1 dawn, 2 field work, 3 evening, 4 harvest (step goal reached by day)
    hidden function scene(d as D) as Number {
        var sr = d.sunrise > 0 ? Math.round(d.sunrise).toNumber() : 390;
        var ss = d.sunset > 0 ? Math.round(d.sunset).toNumber() : 1140;
        if (d.mins >= 1320 || d.mins < sr - 30) {
            return 0;
        }
        if (d.mins < sr + 60) {
            return 1;
        }
        if (d.mins < ss - 60) {
            return d.steps >= d.stepGoal && d.stepGoal > 0 ? 4 : 2;
        }
        return 3;
    }

    hidden function growth(d as D) as Float {
        var g = d.stepGoal > 0 ? d.stepGoal : 10000;
        return G.clamp(d.steps / g.toFloat(), 0, 1).toFloat();
    }

    // [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, hill, grass, grass dark,
    //  barn, barn dark, roof, trim, window, soil, soil dark, leaf, leaf dark, wheat, board, chalk, text, text dim,
    //  shirt, skin, eye, overalls, boots, hat, can, hen, comb, beak, hen dark, rooster, star, moon, moon dark,
    //  water, wood]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x6A8AB8, 0xF0D8B0, 0x5A4A8A, 0xFF8A5A, 0x060A20, 0x161C40, 0x9A7A3A, 0x8A8A3A, 0x6A6A2A,
                0x9A3A24, 0x6A2418, 0x3A2A24, 0xF0E6D0, 0xFFC85A, 0x6A4424, 0x4A2E18, 0xC89A3A, 0x9A6A2A, 0xE8B84A, 0x2A2A26,
                0xF4F0E6, 0xFFFFFF, 0xFFF0D8, acc, 0xF2C08A, 0x1A1A1A, 0x3A4A7A, 0x3A2A1A, 0xE8C070, 0x8A9AA8, 0xF4F0E6, 0xE03A2A,
                0xF0A830, 0x3A2A1A, 0xA85A2A, 0xFFFFFF, 0xF4F0D8, 0x3A3A48, 0x6AB4FF, 0x8A6038] as Array<Number>;
        }
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [c, e, b, c, a, a, b, c, b, b, a, a, e, e, b, a, a, a, e, a, e, a, b, e, e, a, a, a, e, b, e, a, a, a, b, e, e, b, e, a] as Array<Number>;
        }
        return [0x3A8AD8, 0xA8D8FF, 0x5A4A9A, 0xFF9A6A, 0x060A20, 0x141C44, 0x5AA83A, 0x4A9A32, 0x3A7A28,
            0xC0392B, 0x8A2A1E, 0x4A3A34, 0xF4F0E6, 0xFFC85A, 0x7A5030, 0x5A3A20, 0x5AC83A, 0x3A8A2A, 0xF0C840, 0x2A2A26,
            0xF4F0E6, 0xFFFFFF, 0xE8F4E0, acc, 0xF2C08A, 0x1A1A1A, 0x3A5A9A, 0x3A2A1A, 0xF0D070, 0x8A9AA8, 0xF4F0E6, 0xE03A2A,
            0xF0A830, 0x3A2A1A, 0xA85A2A, 0xFFFFFF, 0xF4F0D8, 0x3A3A48, 0x6AB4FF, 0x8A6038] as Array<Number>;
    }

    hidden function moon(dc as Dc, P as Array<Number>, cx as Number, cy as Number, r as Number, k) as Void {
        for (var y = -r; y < r; y += 4) {
            var yy = y + 2;
            var hw = (Math.sqrt(r * r - yy * yy) / 4).toNumber() * 4;
            if (hw <= 0) {
                continue;
            }
            dc.setColor(P[37], -1);
            dc.fillRectangle(cx - hw, cy + y, 2 * hw, 4);
            var x0 = k < 0.5 ? Math.round(hw * Math.cos(k * 2 * Math.PI) / 4).toNumber() * 4 : -hw;
            var x1 = k < 0.5 ? hw : Math.round(hw * Math.cos((k - 0.5) * 2 * Math.PI) / 4).toNumber() * 4;
            if (x1 > x0) {
                dc.setColor(P[36], -1);
                dc.fillRectangle(cx + x0, cy + y, x1 - x0, 4);
            }
        }
    }

    // static layer: sky, hills, barn, board, field with its crops, fence, texts; farmer, chickens,
    // water drops and the Zzz move
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
        var sc = scene(d);
        var g = growth(d);
        var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var k = el > 6 ? 0 : el > -6 ? 1 : 2;
        // the farm darkens with the sun (window light, chalk, text, moon and stars keep their colours)
        var nf = st == 3 ? 0.0 : [0.0, 0.3, 0.65][k];
        for (var i = 6; i < 40; i++) {
            if (i == 13 || (i >= 20 && i <= 22) || (i >= 35 && i <= 37)) {
                continue;
            }
            P[i] = G.mix(P[i], 0x050814, i >= 23 && i <= 34 ? (nf < 0.35 ? nf : 0.35) : nf);
        }
        // the year and the weather: snow-covered or golden land
        var ev = Season.event(d);
        var sn = Season.snowy(d);
        var ssn = Season.season(d);
        if (st != 3 && sn) {
            P[6] = G.mix(0xE8F0F8, 0x050814, nf);
            P[7] = G.mix(0xF0F4FA, 0x050814, nf);
            P[8] = G.mix(0xC8D4E8, 0x050814, nf);
        } else if (st != 3 && ssn == 3) {
            P[6] = G.mix(0xC8962A, 0x050814, nf);
        }

        if (S) {
            // ---- sky with sun / moon / stars
            for (var i = 0; i < 6; i++) {
                dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 5.0), -1);
                dc.fillRectangle(0, i * 50, 454, 50);
            }
            if (k == 2) {
                dc.setColor(P[35], -1);
                for (var i = 0; i < 28; i++) {
                    var ss = i % 6 == 0 ? 4 : 2;
                    dc.fillRectangle(30 + ((i * 101 + 17) % 394), 96 + ((i * 47 + 11) % 140), ss, ss);
                }
            }
            if (el < 0) {
                moon(dc, P, 372, 128, 20, d.moon >= 0 ? d.moon : 0.5);
            }
            if (el > -4) {
                dc.setColor(0xFFF6D0, -1);
                dc.fillCircle(330, 236 - Math.round(G.clamp(el, -4, 40) * 3.5).toNumber(), 14);
            }

            // ---- rolling hills, meadow
            dc.setColor(P[6], -1);
            for (var x = 0; x < 454; x += 4) {
                var h = 24 + Math.round(18 * Math.sin(x / 70.0) + 10 * Math.sin(x / 31.0 + 1)).toNumber();
                dc.fillRectangle(x, 300 - h, 4, h);
            }
            dc.setColor(P[7], -1);
            dc.fillRectangle(0, 300, 454, 154);
            dc.setColor(P[8], -1);
            for (var x = 0; x < 454; x += 14) {
                dc.fillRectangle(x + ((x / 14) % 3) * 4, 372 + ((x * 13) % 60), 4, 2);
            }
            if (ssn == 1 && !sn && st != 3) {
                // spring flowers in the meadow
                var FL = [0xFF7AA8, 0xFFE05A, 0xFFFFFF, 0xB48AFF];
                for (var i = 0; i < 18; i++) {
                    dc.setColor(G.mix(FL[i % 4], 0x050814, nf), -1);
                    dc.fillRectangle(20 + ((i * 97) % 414), 376 + ((i * 31) % 56), 4, 4);
                }
            }

            // ---- barn: walls, roof, door with the white cross, hayloft and window
            dc.setColor(P[11], -1);
            dc.fillPolygon([[12, 200], [100, 146], [188, 200]]);
            dc.setColor(P[9], -1);
            dc.fillRectangle(24, 198, 152, GY - 198);
            dc.setColor(P[10], -1);
            for (var x = 32; x < 176; x += 16) {
                dc.fillRectangle(x, 204, 2, GY - 204);
            }
            dc.setColor(P[12], -1);
            dc.fillRectangle(24, 198, 152, 4);
            dc.fillRectangle(74, 240, 52, GY - 240);
            dc.setColor(P[10], -1);
            dc.fillRectangle(78, 244, 44, GY - 244);
            dc.setColor(P[12], -1);
            for (var i = 0; i < 22; i++) {
                var yy = 244 + Math.round(i * 4.2).toNumber();
                dc.fillRectangle(78 + i * 2, yy, 4, 4);
                dc.fillRectangle(118 - i * 2, yy, 4, 4);
            }
            var lit = sc == 3 || (sc == 0 && d.mins >= 1320 && d.mins < 1380) || (sc == 1 && k > 0);
            dc.setColor(P[12], -1);
            dc.fillRectangle(86, 160, 28, 26);
            dc.fillRectangle(136, 214, 28, 26);
            dc.setColor(lit ? P[13] : P[10], -1);
            dc.fillRectangle(90, 164, 20, 18);
            dc.fillRectangle(140, 218, 20, 18);
            if (sn) {
                Season.snowCap(dc, 24, 200, 152);
            }

            // ---- farm shop board with the data slots
            dc.setColor(P[39], -1);
            dc.fillRectangle(266, 252, 6, 54);
            dc.fillRectangle(394, 252, 6, 54);
            dc.setColor(P[19], -1);
            dc.fillRectangle(252, 190, 162, 76);
            dc.setColor(P[39], -1);
            dc.drawRectangle(252, 190, 162, 76);
            dc.drawRectangle(253, 191, 160, 74);
            if (sn) {
                Season.snowCap(dc, 252, 190, 162);
            }
            dc.setColor(P[20], -1);
            F.px(dc, "HOFLADEN", 333, 196, 2, 1, 0);
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
                dc.setColor(G.mix(P[20], P[19], 0.3), -1);
                F.px(dc, lb, 262, 218 + i * 16, 2, 0, 0);
                dc.setColor(P[20], -1);
                F.px(dc, val, 406, 218 + i * 16, 2, 2, 0);
            }

            // ---- the field: furrows and crops by today's steps (seed, sprout, plant, wheat)
            var stg = Math.floor(g * 5).toNumber() + (g > 0 ? 1 : 0);
            if (stg > 5) {
                stg = 5;
            }
            for (var r = 0; r < ROWS.size(); r++) {
                var by = ROWS[r];
                dc.setColor(P[14], -1);
                dc.fillRectangle(206, by - 6, 210 - r * 4, 8);
                dc.setColor(P[15], -1);
                dc.fillRectangle(206, by, 210 - r * 4, 2);
                for (var x = 214 + (r % 2) * 8; x < 406 - r * 4; x += 18) {
                    if (stg == 1) {
                        dc.setColor(P[17], -1);
                        dc.fillRectangle(x, by - 4, 2, 2);
                    } else if (stg >= 2 && stg <= 4) {
                        var h = STGH[stg];
                        dc.setColor(P[17], -1);
                        dc.fillRectangle(x, by - 4 - h, 2, h);
                        dc.setColor(P[16], -1);
                        dc.fillRectangle(x - 4, by - 4 - h + 2, 4, 2);
                        if (stg >= 3) {
                            dc.fillRectangle(x + 2, by - 4 - h + 6, 4, 2);
                        }
                        if (stg == 4) {
                            dc.fillRectangle(x - 4, by - 4 - h + 10, 4, 2);
                        }
                    } else if (stg == 5) {
                        dc.setColor(G.mix(P[18], P[17], 0.3), -1);
                        dc.fillRectangle(x, by - 20, 2, 16);
                        dc.setColor(P[18], -1);
                        dc.fillRectangle(x - 2, by - 26, 6, 8);
                    }
                }
            }

            // ---- fence post for the rooster, bench
            dc.setColor(P[39], -1);
            dc.fillRectangle(186, 326, 8, 46);
            dc.fillRectangle(176, 338, 30, 4);
            dc.fillRectangle(176, 354, 30, 4);
            dc.fillRectangle(130, 312, 46, 6);
            dc.fillRectangle(134, 318, 4, 20);
            dc.fillRectangle(168, 318, 4, 20);
            // ---- decorations for the special days
            if (ev == Season.ADVENT || ev == Season.XMAS) {
                Season.tree(dc, 60, 372, 1);
            } else if (ev == Season.EASTER) {
                Season.eggs(dc, 44, 388);
            } else if (ev == Season.HALLOWEEN) {
                Season.pumpkin(dc, 190, 330, 1);
            } else if (ev == Season.VALENTINE) {
                Season.heart(dc, 100, 172, 2);
            }

            // ---- time, date, caption
            dc.setColor(0x000000, -1);
            F.px(dc, G.timeStr(d), 229, 34, 5, 1, 0);
            dc.setColor(P[21], -1);
            F.px(dc, G.timeStr(d), 227, 32, 5, 1, 0);
            F.px(dc, ev != Season.NONE ? Season.greeting(ev) : d.dowStr + " " + d.day + ". " + d.monStr, 227, 76, 2, 1, 0);
            // dark captions on snow by day
            var dark = sn && k < 2 && st != 3;
            if (dark) {
                dc.setColor(0x1A2A4A, -1);
            }
            F.px(dc, CAP[sc], 227, 394, 2, 1, 0);
            var sub = sc == 0 ? "SONNE UM " + G.hm(d.sunrise > 0 ? d.sunrise : 390) : G.num(d.steps > 0 ? d.steps : 0) + " SCHRITTE";
            dc.setColor(dark ? 0x4A5A7A : P[22], -1);
            F.px(dc, sub, 227, 414, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        var fp = [-1, P[23], P[24], P[25], P[26], P[27], P[28], P[29], P[18]];
        var hen = [-1, P[30], P[31], P[32], P[33]];
        var fr = live ? (tt / 300) % 2 : 0;
        // chickens peck in the yard from dawn to evening
        if (sc >= 1 && sc != 3) {
            Spr.draw(dc, fr == 0 ? SprFarm.HEN_A : SprFarm.HEN_B, 128, 352, 3, hen, false);
            Spr.draw(dc, fr == 1 ? SprFarm.HEN_A : SprFarm.HEN_B, 40, 360, 3, hen, true);
        }
        if (sc == 0) {
            // the farm sleeps: Zzz from the hayloft
            dc.setColor(P[21], -1);
            for (var i = 0; i < 3; i++) {
                if (!live && i > 0) {
                    break;
                }
                var ph = ((tt + i * 500) % 1500) / 1500.0;
                F.px(dc, "Z", 116 + Math.round(ph * 24).toNumber() + i * 4, 150 - Math.round(ph * 60).toNumber(), ph > 0.5 ? 3 : 2, 1, 0);
            }
        } else if (sc == 1) {
            // the rooster crows on the post, the farmer steps out of the barn door
            var crow = p < 1 ? p > 0.2 && p < 0.8 : live && (tt / 1500) % 3 == 0;
            Spr.draw(dc, crow ? SprFarm.CROW : SprFarm.HEN_A, 178, 305, 3, [-1, P[34], P[31], P[32], P[33]], false);
            if (crow) {
                dc.setColor(P[21], -1);
                F.px(dc, "KIKERIKI!", 214, 282, 2, 0, 0);
            }
            var dy = p < 1 ? Math.round((1 - G.ease(p)) * 6).toNumber() : 0;
            Spr.draw(dc, SprFarm.STAND, 70, GY - 90 + dy, 5, fp, false);
        } else if (sc == 2) {
            // waters the rows, walking up and down the field; on every raise he comes out of the barn
            var x = p < 1 ? Math.round(G.lerp(80, 220, G.easeInOut(p))).toNumber() : 260 + Math.round(70 * Math.sin(tt / 2600.0)).toNumber();
            var right = p < 1 || Math.cos(tt / 2600.0) >= 0;
            var step = live && (tt / 220) % 2 == 1;
            Spr.draw(dc, step ? SprFarm.WALK_B : SprFarm.WALK_A, x, 378 - 90, 5, fp, !right);
            if (p >= 1) {
                dc.setColor(P[38], -1);
                var sx = right ? x + 60 : x - 4;
                for (var i = 0; i < 3; i++) {
                    dc.fillRectangle(sx + ((i + fr) % 2) * 4, 348 + i * 8 + ((tt / 120) % 3) * 2, 2, 4);
                }
            }
        } else if (sc == 4) {
            // harvest: cheering with a sheaf of wheat
            var jump = live ? Math.round(Math.sin(tt / 260.0) * 10).toNumber().abs() : 0;
            Spr.draw(dc, SprFarm.CHEER, 222, 378 - 90 - jump, 5, fp, false);
            dc.setColor(P[18], -1);
            dc.fillRectangle(226, 266 - jump, 16, 24);
            dc.fillRectangle(222, 260 - jump, 24, 8);
            dc.setColor(G.mix(P[18], 0x6A4A1A, 0.4), -1);
            dc.fillRectangle(226, 276 - jump, 16, 3);
        } else {
            // evening on the bench in front of the barn
            Spr.draw(dc, SprFarm.SIT, 120, GY - 80 + 6, 5, fp, false);
        }
        // ---- the year and the weather: lights, balloons, fireworks, rain and snow
        if (ev == Season.ADVENT || ev == Season.XMAS) {
            Season.lights(dc, 24, 200, 176, 200, tt);
        } else if (ev == Season.BIRTHDAY) {
            Season.balloons(dc, 232, 300, tt);
        } else if (ev == Season.NYE) {
            Season.fireworks(dc, 70, 96, 300, 70, tt);
        }
        Season.precip(dc, d, 0, 90, 454, 300, tt);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        dc.setColor(st == 3 ? 0x306230 : 0x3A3A42, -1);
        dc.drawRectangle(24 + o[0], 198 + o[1], 152, GY - 198);
        dc.fillPolygon([[12 + o[0], 200 + o[1]], [100 + o[0], 146 + o[1]], [188 + o[0], 200 + o[1]]]);
        dc.fillRectangle(o[0], 300 + o[1], 454, 2);
        dc.setColor(st == 3 ? 0x8BAC0F : 0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 32 + o[1], 5, 1, 1);
    }
}
