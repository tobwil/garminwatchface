import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// CAMP — "Lagerfeuer": a day at a camp in the wild, told by the real sun. At night the camper sleeps
// in the tent under the real stars and moon, at sunrise he stands at the fire with a coffee, during
// the day the camp is empty (he is out on a hike and back an hour before sunset), and in the evening
// he sits on the log roasting a marshmallow over the campfire, which burns as high as the Body
// Battery. The three data slots are written on the trail sign. Every wrist raise plays a short
// episode: a sleepy Zzz, crawling out to the fire, setting off on the hike, a log on the fire.
// Styles: 1 Wald, 2 Strand, 3 Winter. Mirrors web/js/faces/camp.js.
class FaceCamp extends Face {
    const GY = 338;
    const FX = 262;
    const TREES = [20, 70, 52, 96, 86, 58, 120, 84, 150, 64, 300, 70, 334, 100, 368, 62, 400, 88, 436, 66];
    const CAP = ["SCHLAFENSZEIT", "MORGENKAFFEE", "AUF TOUR", "LAGERFEUER"];
    const PROF = [0.35, 0.6, 0.85, 1.0, 0.8, 0.55, 0.3];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 8;
    }

    hidden function sunrise(d as D) as Number {
        return d.sunrise > 0 ? Math.round(d.sunrise).toNumber() : 390;
    }

    hidden function sunset(d as D) as Number {
        return d.sunset > 0 ? Math.round(d.sunset).toNumber() : 1140;
    }

    // scene: 0 asleep, 1 morning coffee, 2 out hiking, 3 campfire
    hidden function scene(d as D) as Number {
        if (d.mins < sunrise(d) - 30) {
            return 0;
        }
        if (d.mins < sunrise(d) + 150) {
            return 1;
        }
        if (d.mins < sunset(d) - 60) {
            return 2;
        }
        return 3;
    }

    // [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, ground, ground dark,
    //  tree, tree top, sea, text, text dim, tent, tent dark, tent door, log, log dark, stone, jacket, skin, beanie,
    //  trousers, boots, eye, cup, backpack, flame red, flame orange, flame yellow, sign, sign dark, star, moon, moon dark]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x3A8AD8, 0xA8D8FF, 0x5A4A9A, 0xFF9A6A, 0x060A20, 0x141C44,
                0xE8D098, 0xC8A870, 0x1E3A2A, 0x2A4A34, 0x2A7AC8, 0xFFFFFF, 0xFFF0D8, acc, G.mix(acc, 0, 0.4),
                0x1A1410, 0x8A5A34, 0x5A3A20, 0x9A9A9A, 0x2A8AC8, 0xF2C08A, 0xFF5A3A, 0x3A4A6A, 0x5A3A2A, 0x1A1A1A, 0xFFFFFF, 0x6A7A3A,
                0xD8302A, 0xFF8A2A, 0xFFE05A, 0xA87A4A, 0x6A4A2A, 0xFFFFFF, 0xF4F0D8, 0x3A3A48] as Array<Number>;
        }
        if (st == 3) {
            return [0x4A7AC0, 0xC8E0F4, 0x5A5A9A, 0xFFB08A, 0x060A20, 0x18204A, 0xF0F4FA, 0xC8D4E8, 0x1E3A3A, 0xFFFFFF,
                0x2A5A8A, 0xFFFFFF, 0x2A3A5A, acc, G.mix(acc, 0, 0.4), 0x1A1410, 0x7A5030, 0x4A3018, 0x8A8A96, 0xC83A3A, 0xF2C08A,
                0xFFFFFF, 0x2A3A5A, 0x3A2A1A, 0x1A1A1A, 0xFFFFFF, 0x3A5A8A, 0xD8302A, 0xFF8A2A, 0xFFE05A, 0x9A6A3A, 0x5A3A1A, 0xFFFFFF,
                0xF4F0D8, 0x3A3A48] as Array<Number>;
        }
        return [0x3A8AD8, 0xA8D8FF, 0x5A4A9A, 0xFF9A6A, 0x060A20, 0x141C44,
            0x3A6A2A, 0x2A5222, 0x163A22, 0x1E4A2A, 0x2A5A8A, 0xFFFFFF, 0xD8ECD0, acc, G.mix(acc, 0, 0.4),
            0x1A1410, 0x8A5A34, 0x5A3A20, 0x8A8A8A, 0x3A7A3A, 0xF2C08A, 0xD83A2A, 0x3A4A6A, 0x4A3020, 0x1A1A1A, 0xFFFFFF, 0x8A5A2A,
            0xD8302A, 0xFF8A2A, 0xFFE05A, 0xA87A4A, 0x6A4A2A, 0xFFFFFF, 0xF4F0D8, 0x3A3A48] as Array<Number>;
    }

    // pixel disc of the moon (4 px rows) with the lit part for phase k (0 new, .5 full)
    hidden function moon(dc as Dc, P as Array<Number>, cx as Number, cy as Number, r as Number, k) as Void {
        for (var y = -r; y < r; y += 4) {
            var yy = y + 2;
            var hw = (Math.sqrt(r * r - yy * yy) / 4).toNumber() * 4;
            if (hw <= 0) {
                continue;
            }
            dc.setColor(P[34], -1);
            dc.fillRectangle(cx - hw, cy + y, 2 * hw, 4);
            var x0 = k < 0.5 ? Math.round(hw * Math.cos(k * 2 * Math.PI) / 4).toNumber() * 4 : -hw;
            var x1 = k < 0.5 ? hw : Math.round(hw * Math.cos((k - 0.5) * 2 * Math.PI) / 4).toNumber() * 4;
            if (x1 > x0) {
                dc.setColor(P[33], -1);
                dc.fillRectangle(cx + x0, cy + y, x1 - x0, 4);
            }
        }
    }

    // flames: seven 8 px columns, h = height, f = flicker seed
    hidden function fire(dc as Dc, P as Array<Number>, h as Number, f as Number) as Void {
        for (var i = 0; i < 7; i++) {
            var hh = Math.round(h * PROF[i] * (0.8 + (G.rnd(f * 7 + i) % 5) / 10.0)).toNumber();
            var x = FX - 28 + i * 8;
            dc.setColor(P[27], -1);
            dc.fillRectangle(x, GY - 10 - hh, 8, hh);
            var h7 = Math.round(hh * 0.7).toNumber();
            dc.setColor(P[28], -1);
            dc.fillRectangle(x + 2, GY - 10 - h7, 4, h7);
            if (i > 1 && i < 5) {
                var h3 = Math.round(hh * 0.35).toNumber();
                dc.setColor(P[29], -1);
                dc.fillRectangle(x + 2, GY - 10 - h3, 4, h3);
            }
        }
    }

    // static layer: sky, moon, landscape, tent, fire place, log, sign, texts; camper, flames, sparks,
    // steam, smoke and the Zzz move
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
        var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var k = el > 6 ? 0 : el > -6 ? 1 : 2;
        // the landscape darkens with the sun (the camper only a little: he is in the firelight; fire,
        // sign, text and the moon keep their colours)
        var nf = [0.0, 0.35, 0.7][k];
        for (var i = 6; i <= 26; i++) {
            if (i <= 10 || (i >= 13 && i <= 18 && i != 15)) {
                P[i] = G.mix(P[i], 0x050814, nf);
            } else if (i >= 19) {
                P[i] = G.mix(P[i], 0x050814, nf < 0.3 ? nf : 0.3);
            }
        }
        P[15] = sc == 0 || sc == 3 ? 0xFFC85A : P[14];
        var bb = d.bb >= 0 ? d.bb : 50;
        var fh = sc == 3 ? 16 + Math.round(bb * 0.7).toNumber() : sc == 1 ? 16 : 0;

        if (S) {
            // ---- sky, sun / moon and stars
            for (var i = 0; i < 6; i++) {
                dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 5.0), -1);
                dc.fillRectangle(0, i * 50, 454, 50);
            }
            if (k == 2) {
                dc.setColor(P[32], -1);
                for (var i = 0; i < 30; i++) {
                    var ss = i % 5 == 0 ? 4 : 2;
                    dc.fillRectangle(30 + ((i * 101 + 17) % 394), 100 + ((i * 47 + 11) % 150), ss, ss);
                }
            }
            if (el < 0) {
                moon(dc, P, 340, 120, 20, d.moon >= 0 ? d.moon : 0.5);
            }
            if (el > -4) {
                var sy = 250 - Math.round(G.clamp(el, -4, 40) * 4).toNumber();
                dc.setColor(0xFFF6D0, -1);
                dc.fillCircle(110, sy, 14);
            }

            // ---- background: sea (beach) or a line of pines (snowy in winter)
            if (st == 2) {
                dc.setColor(P[10], -1);
                dc.fillRectangle(0, 262, 454, 40);
                dc.setColor(G.mix(P[10], 0xFFFFFF, 0.3), -1);
                for (var x = 10; x < 454; x += 46) {
                    dc.fillRectangle(x, 270 + (x % 3) * 8, 18, 2);
                }
            } else {
                for (var i = 0; i < TREES.size(); i += 2) {
                    var tx = TREES[i];
                    var th = TREES[i + 1];
                    var ty = 300 - th;
                    dc.setColor(P[8], -1);
                    for (var y = 0; y < th; y += 6) {
                        var w = 4 + (y * 0.55 / 2).toNumber() * 2 + (y % 12 == 6 ? 4 : 0);
                        dc.fillRectangle(tx - w / 2, ty + y, w, 6);
                    }
                    if (st == 3) {
                        dc.setColor(P[9], -1);
                        dc.fillRectangle(tx - 2, ty, 4, 6);
                        dc.fillRectangle(tx - 6, ty + 18, 12, 4);
                    }
                }
            }
            dc.setColor(P[6], -1);
            dc.fillRectangle(0, 300, 454, 154);
            dc.setColor(P[7], -1);
            for (var x = 0; x < 454; x += 14) {
                dc.fillRectangle(x + ((x / 14) % 3) * 4, 306 + ((x * 13) % 60), 4, 2);
            }
            if (fh > 0 && k > 0) {
                dc.setColor(G.mix(P[6], P[28], 0.3), -1);
                dc.fillRectangle(FX - 70, GY - 4, 140, 14);
                dc.fillRectangle(FX - 44, GY + 10, 88, 6);
            }

            // ---- tent, fire place, log seat
            Spr.draw(dc, SprCamp.TENT, 24, GY - 65, 5, [-1, P[13], P[14], P[15], P[17]], false);
            dc.setColor(P[18], -1);
            for (var i = 0; i < 5; i++) {
                dc.fillRectangle(FX - 40 + i * 18, GY - 6, 12, 8);
            }
            dc.setColor(P[16], -1);
            dc.fillRectangle(FX - 30, GY - 12, 60, 8);
            dc.setColor(P[17], -1);
            dc.fillRectangle(FX - 22, GY - 16, 44, 6);
            dc.setColor(P[16], -1);
            dc.fillRectangle(162, 318, 42, 20);
            dc.setColor(P[17], -1);
            dc.fillRectangle(162, 318, 6, 20);
            if (sc == 1) {
                dc.setColor(P[18], -1);
                dc.fillRectangle(FX - 12, GY - 50, 24, 22);
                dc.fillRectangle(FX + 12, GY - 46, 6, 4);
                dc.fillRectangle(FX - 6, GY - 56, 12, 6);
            }

            // ---- trail sign with the data slots
            dc.setColor(P[31], -1);
            dc.fillRectangle(388, 186, 6, GY - 186);
            for (var i = 0; i < 3; i++) {
                var s = d.slots[i];
                var y = 196 + i * 30;
                dc.setColor(P[30], -1);
                dc.fillRectangle(318, y, 112, 22);
                dc.fillRectangle(430, y + 4, 4, 14);
                dc.fillRectangle(434, y + 8, 4, 6);
                var lb = s[:lbl] as String;
                if (lb.length() == 0 || G.stag(p, i, 0.1, 0.4) <= 0) {
                    continue;
                }
                var val = s[:val] as String;
                while (lb.length() > 2 && F.pxW(lb, 2) > 98 - F.pxW(val, 2)) {
                    lb = lb.substring(0, lb.length() - 1);
                }
                dc.setColor(P[31], -1);
                F.px(dc, lb, 324, y + 4, 2, 0, 0);
                F.px(dc, val, 426, y + 4, 2, 2, 0);
            }

            // ---- time, date, story caption
            dc.setColor(0x000000, -1);
            F.px(dc, G.timeStr(d), 229, 34, 5, 1, 0);
            dc.setColor(P[11], -1);
            F.px(dc, G.timeStr(d), 227, 32, 5, 1, 0);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 76, 2, 1, 0);
            // dark captions on sand and snow by day
            var dark = st >= 2 && k < 2;
            dc.setColor(dark ? 0x1A2A4A : P[11], -1);
            F.px(dc, CAP[sc], 227, 370, 2, 1, 0);
            var sub = sc == 0 ? "SONNE UM " + G.hm(sunrise(d)) : sc == 1 ? "GUTEN MORGEN"
                : sc == 2 ? "ZURÜCK UM " + G.hm(sunset(d) - 60) : "FEUER " + bb + "%";
            dc.setColor(dark ? 0x4A5A7A : P[12], -1);
            F.px(dc, sub, 227, 392, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        var cp = [-1, P[19], P[20], P[21], P[22], P[23], P[24], P[25], P[26]];
        var fl = live ? tt / 120 : 3;
        if (sc == 0) {
            // embers and a sleepy Zzz from the tent
            dc.setColor(fl % 3 == 0 ? P[28] : P[27], -1);
            dc.fillRectangle(FX - 14, GY - 20, 8, 4);
            dc.fillRectangle(FX + 4, GY - 22, 8, 4);
            dc.setColor(P[11], -1);
            for (var i = 0; i < 3; i++) {
                if (!live && i > 0) {
                    break;
                }
                var ph = ((tt + i * 500) % 1500) / 1500.0;
                F.px(dc, "Z", 96 + Math.round(ph * 24).toNumber() + i * 4, 250 - Math.round(ph * 70).toNumber(), ph > 0.5 ? 3 : 2, 1, 0);
            }
        } else if (sc == 1) {
            fire(dc, P, fh, fl);
            // steam from the pot, and he crawls out of the tent to the fire on every raise
            dc.setColor(G.mix(P[1], 0xFFFFFF, 0.5), -1);
            for (var i = 0; i < 3; i++) {
                dc.fillRectangle(FX - 4 + ((i + fl) % 2) * 6, GY - 66 - i * 10 - (fl % 3) * 2, 4, 4);
            }
            var x = p < 1 ? Math.round(G.lerp(90, 190, G.ease(G.clamp((p - 0.2) / 0.8, 0, 1)))).toNumber() : 190;
            Spr.draw(dc, p < 1 && p > 0.2 && (a.t / 150) % 2 == 1 ? SprCamp.WALK_B : SprCamp.STAND, x, GY - 90, 5, cp, false);
        } else if (sc == 2) {
            // a wisp of smoke from the cold fire place; on every raise he sets off on his hike
            dc.setColor(G.mix(P[1], 0x8A8A8A, 0.4), -1);
            for (var i = 0; i < 4; i++) {
                dc.fillRectangle(FX - 2 + Math.round(4 * Math.sin(tt / 400.0 + i)).toNumber(), GY - 30 - i * 14 - (fl % 2) * 2, 6, 6);
            }
            if (p < 1) {
                var x = Math.round(G.lerp(180, 470, G.easeInOut(p))).toNumber();
                Spr.draw(dc, (a.t / 150) % 2 == 1 ? SprCamp.WALK_B : SprCamp.WALK_A, x, GY - 90, 5, cp, false);
            }
        } else {
            // the campfire: a fresh log flares it up on every raise, sparks rise
            var flare = p < 1 ? Math.round((1 - p) * 40).toNumber() : 0;
            fire(dc, P, fh + flare, fl);
            dc.setColor(P[29], -1);
            for (var i = 0; i < 6; i++) {
                var ph = ((tt + i * 330) % 2000) / 2000.0;
                dc.fillRectangle(FX - 20 + ((i * 17) % 40) + Math.round(6 * Math.sin(ph * 9 + i)).toNumber(),
                    GY - 20 - fh - Math.round(ph * 110).toNumber(), 4, 4);
            }
            var up = live && (tt / 900) % 2 == 1;
            Spr.draw(dc, up ? SprCamp.SIT_B : SprCamp.SIT_A, 160, GY - 80, 5, cp, false);
            // marshmallow stick into the flames
            var hx = up ? 212 : 207;
            var hy = up ? 280 : 290;
            dc.setColor(P[17], -1);
            for (var i = 0; i < 6; i++) {
                dc.fillRectangle(hx + i * 6, hy + i * 2, 6, 3);
            }
            dc.setColor(P[25], -1);
            dc.fillRectangle(hx + 34, hy + 8, 8, 8);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        Spr.draw(dc, SprCamp.TENT, 24 + o[0], GY - 65 + o[1], 5, [-1, 0x2A2A30, 0x1A1A20, 0x3A2A10, 0x2A2A30], false);
        dc.setColor(G.dim(0xFF8A2A, 0.45), -1);
        dc.fillRectangle(FX - 14 + o[0], GY - 20 + o[1], 8, 4);
        dc.fillRectangle(FX + 4 + o[0], GY - 22 + o[1], 8, 4);
        dc.setColor(0x3A3A42, -1);
        dc.fillRectangle(o[0], 300 + o[1], 454, 2);
        dc.setColor(st == 3 ? 0x9AA6B8 : 0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 32 + o[1], 5, 1, 1);
    }
}
