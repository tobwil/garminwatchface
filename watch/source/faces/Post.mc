import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// POST — "Postbote": the postman walks his round down a street of 24 houses. Today's steps decide
// which house he has reached (the house numbers on the doors count up), every wrist raise he walks
// up to the next letter box, drops a letter and the flag pops up; the notifications are the letters
// still in his bag. At the step goal the round is done and he waves goodbye. In the evening the
// windows and the street lamp light up and a cat strolls along the pavement; late at night most
// windows go dark. The three data slots are posted on the advertising column.
// Styles: 1 Stadt, 2 Dorf, 3 Gameboy. Mirrors web/js/faces/post.js.
class FacePost extends Face {
    const HOUSES = 24;
    const GY = 352;
    const HX = [-10, 110, 230];
    const HW = [120, 120, 110];
    const PX = 128;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 8;
    }

    // scene: 0 night, 1 on his round, 2 round done, 3 evening
    hidden function scene(d as D) as Number {
        var ss = d.sunset > 0 ? Math.round(d.sunset).toNumber() : 1140;
        if (d.mins < 360 || d.mins >= 1320) {
            return 0;
        }
        if (d.steps >= d.stepGoal && d.stepGoal > 0) {
            return d.mins < ss ? 2 : 3;
        }
        return d.mins < ss ? 1 : 3;
    }

    // house the postman has reached (1..24)
    hidden function house(d as D) as Number {
        var g = d.stepGoal > 0 ? d.stepGoal : 10000;
        var h = 1 + ((d.steps > 0 ? d.steps : 0) * HOUSES / g.toFloat()).toNumber();
        return h < HOUSES ? h : HOUSES;
    }

    // [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, wall a, wall b, wall c,
    //  trim, glass, window lit, roof, door a, door b, door c, letter box, flag, pavement, pavement line, kerb, road,
    //  text, text dim, column, column cap, poster, poster text, uniform, skin, eye, trousers, shoes, cap, bag, letter,
    //  lamp post, lamp light, cat, star]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x4A90D8, 0xB8E0FF, 0x5A4A9A, 0xFF9A6A, 0x060A20, 0x141C44, 0xF4EAD4, 0xF0E2C4, 0xF6EEDC,
                0x5A3A24, 0x2A3A4A, 0xFFD27A, 0xB0402A, 0x6A3A1E, 0x2A5A3A, 0x7A2A24, 0xD8302A, 0xFFD23A, 0xB8B0A0, 0x9A9282,
                0x8A8478, 0x4A4A4E, 0xFFFFFF, 0xE0E0E8, 0x3A6A4A, 0x2A4A34, 0xF4F0E0, 0x2A2A2A, 0x2A4A8A, 0xF2C08A, 0x1A1A1A,
                0x1E2A4A, 0x141414, 0x1E2A4A, acc, 0xFFFFFF, 0x2A2A30, 0xFFE08A, 0x4A3A30, 0xFFFFFF] as Array<Number>;
        }
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [c, e, b, c, a, a, c, e, c, a, b, e, a, a, b, a, a, e, c, b, b, a, e, c, b, a, e, a, a, e, a, a, a, a, b, e, a, e, a, e] as Array<Number>;
        }
        return [0x3A8AD8, 0xA8D8FF, 0x5A4A9A, 0xFF9A6A, 0x060A20, 0x141C44, 0xD88A5A, 0xE8D0A0, 0x8AB0C8,
            0xF4F0E6, 0x2A3A4A, 0xFFD27A, 0x5A4A48, 0x4A2A1A, 0x2A4A7A, 0x8A2A2A, 0xD8302A, 0xFFD23A, 0xA8A8B0, 0x8A8A92,
            0x7A7A82, 0x3A3A40, 0xFFFFFF, 0xE0E0E8, 0x2A5A3A, 0x1E3A28, 0xF4F0E0, 0x2A2A2A, 0x2A4A8A, 0xF2C08A, 0x1A1A1A,
            0x1E2A4A, 0x141414, 0x1E2A4A, acc, 0xFFFFFF, 0x2A2A30, 0xFFE08A, 0x3A3A40, 0xFFFFFF] as Array<Number>;
    }

    hidden function flag(dc as Dc, P as Array<Number>, x as Number) as Void {
        dc.setColor(P[17], -1);
        dc.fillRectangle(x + 96, 258, 4, 16);
        dc.fillRectangle(x + 96, 258, 10, 6);
    }

    // static layer: sky, facades with their numbers, delivered flags, column, lamp, pavement, texts;
    // the postman, the middle letter box flag, the cat and the lamp glow move
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
        var hn = house(d);
        var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var k = el > 6 ? 0 : el > -6 ? 1 : 2;
        // the street darkens with the sun (lit windows, lamp, texts and the poster keep their colours)
        var nf = st == 3 ? 0.0 : [0.0, 0.3, 0.6][k];
        for (var i = 6; i <= 38; i++) {
            if ((i <= 21 && i != 11) || i == 24 || i == 25 || i == 36 || i == 38) {
                P[i] = G.mix(P[i], 0x050814, nf);
            } else if (i >= 28 && i <= 35) {
                P[i] = G.mix(P[i], 0x050814, nf < 0.3 ? nf : 0.3);
            }
        }
        var evening = sc == 0 || sc == 3;
        var lampOn = k > 0 || evening;

        if (S) {
            // ---- sky and stars
            for (var i = 0; i < 4; i++) {
                dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 3.0), -1);
                dc.fillRectangle(0, i * 30, 454, 30);
            }
            if (k == 2) {
                dc.setColor(P[39], -1);
                for (var i = 0; i < 14; i++) {
                    dc.fillRectangle(70 + ((i * 101 + 17) % 314), 14 + ((i * 47 + 11) % 90), 2, 2);
                }
            }

            // ---- three facades: roof, upper windows, door with the house number, letter box
            for (var h = 0; h < 3; h++) {
                var x = HX[h];
                var w = HW[h];
                dc.setColor(P[12], -1);
                dc.fillRectangle(x, 96, w, 22);
                dc.setColor(G.mix(P[12], 0, 0.3), -1);
                dc.fillRectangle(x, 116, w, 4);
                dc.setColor(P[6 + h], -1);
                dc.fillRectangle(x, 120, w, GY - 120);
                if (st == 2) {
                    // half-timbering
                    dc.setColor(P[9], -1);
                    dc.fillRectangle(x, 206, w, 6);
                    for (var bx = x + 4; bx < x + w; bx += 38) {
                        dc.fillRectangle(bx, 120, 6, 86);
                    }
                    dc.fillRectangle(x, 120, w, 4);
                }
                // upper windows; at night only some stay lit
                for (var wi = 0; wi < 2; wi++) {
                    var wx = x + 16 + wi * 54;
                    var on = evening && (sc == 3 || G.rnd(h * 7 + wi * 3 + d.day) % 3 == 0);
                    dc.setColor(P[9], -1);
                    dc.fillRectangle(wx - 4, 140, 36, 52);
                    dc.setColor(on ? P[11] : P[10], -1);
                    dc.fillRectangle(wx, 144, 28, 44);
                    dc.setColor(P[9], -1);
                    dc.fillRectangle(wx + 12, 144, 4, 44);
                    dc.fillRectangle(wx, 162, 28, 4);
                }
                // door and number plate
                dc.setColor(P[9], -1);
                dc.fillRectangle(x + 12, 238, 54, GY - 238);
                dc.setColor(P[13 + h], -1);
                dc.fillRectangle(x + 16, 242, 46, GY - 242);
                dc.setColor(G.mix(P[13 + h], 0xFFFFFF, 0.25), -1);
                dc.fillRectangle(x + 22, 250, 34, 30);
                dc.fillRectangle(x + 22, 290, 34, 50);
                dc.setColor(P[9], -1);
                dc.fillRectangle(x + 52, 296, 4, 4);
                var num = hn - 1 + h;
                if (num >= 1 && num <= HOUSES) {
                    dc.setColor(0xF4F4F4, -1);
                    dc.fillRectangle(x + 25, 218, 28, 16);
                    dc.setColor(0x1A3A6A, -1);
                    F.px(dc, "" + num, x + 39, 220, 2, 1, 0);
                }
                // letter box: houses passed have their flag up
                dc.setColor(P[16], -1);
                dc.fillRectangle(x + 72, 268, 24, 30);
                dc.setColor(G.mix(P[16], 0, 0.5), -1);
                dc.fillRectangle(x + 76, 274, 16, 3);
                if (h == 0 || (h == 1 && (evening || sc == 2))) {
                    flag(dc, P, x);
                }
            }

            // ---- advertising column with the data slots
            dc.setColor(P[24], -1);
            dc.fillRectangle(344, 176, 92, GY - 176);
            dc.setColor(P[25], -1);
            dc.fillRectangle(338, 162, 104, 16);
            dc.fillRectangle(350, 150, 80, 12);
            dc.fillRectangle(338, GY - 10, 104, 10);
            dc.setColor(P[26], -1);
            dc.fillRectangle(352, 186, 76, 148);
            for (var i = 0; i < 3; i++) {
                var s = d.slots[i];
                var lb = s[:lbl] as String;
                if (lb.length() == 0 || G.stag(p, i, 0.1, 0.4) <= 0) {
                    continue;
                }
                while (lb.length() > 2 && F.pxW(lb, 2) > 70) {
                    lb = lb.substring(0, lb.length() - 1);
                }
                dc.setColor(G.mix(P[27], P[26], 0.4), -1);
                F.px(dc, lb, 390, 194 + i * 48, 2, 1, 0);
                dc.setColor(P[27], -1);
                F.px(dc, s[:val] as String, 390, 212 + i * 48, 2, 1, 0);
            }

            // ---- street lamp, pavement, kerb, road
            dc.setColor(P[36], -1);
            dc.fillRectangle(226, 176, 6, GY - 176);
            dc.fillRectangle(214, 168, 30, 8);
            dc.setColor(lampOn ? P[37] : G.mix(P[36], 0xFFFFFF, 0.3), -1);
            dc.fillRectangle(218, 176, 22, 8);
            dc.setColor(P[18], -1);
            dc.fillRectangle(0, GY, 454, 22);
            dc.setColor(P[19], -1);
            for (var x = 0; x < 454; x += 40) {
                dc.fillRectangle(x, GY, 2, 22);
            }
            dc.setColor(P[20], -1);
            dc.fillRectangle(0, GY + 22, 454, 6);
            dc.setColor(P[21], -1);
            dc.fillRectangle(0, GY + 28, 454, 454 - GY - 28);

            // ---- time, date, caption
            dc.setColor(0x000000, -1);
            F.px(dc, G.timeStr(d), 229, 26, 5, 1, 0);
            dc.setColor(st == 3 ? 0x0F380F : P[22], -1);
            F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 68, 2, 1, 0);
            var cap = sc == 0 ? "NACHTRUHE" : sc == 1 ? "HAUS " + hn + " VON " + HOUSES : sc == 2 ? "RUNDE GESCHAFFT!" : "FEIERABEND";
            var nl = d.notif > 0 ? d.notif : 0;
            var sub = sc == 1 ? nl + (nl == 1 ? " BRIEF DABEI" : " BRIEFE DABEI") : G.num(d.steps > 0 ? d.steps : 0) + " SCHRITTE";
            dc.setColor(P[22], -1);
            F.px(dc, cap, 227, 392, 2, 1, 0);
            dc.setColor(P[23], -1);
            F.px(dc, sub, 227, 412, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        var pp = [-1, P[28], P[29], P[30], P[31], P[32], P[33], P[34], P[35]];
        // lamp light on the pavement
        if (lampOn) {
            dc.setColor(G.mix(P[18], P[37], live && (tt / 1700) % 7 == 0 ? 0.2 : 0.35), -1);
            dc.fillRectangle(196, GY, 66, 6);
        }
        if (sc == 1) {
            // walks up to the letter box, posts a letter, the flag pops up
            var walk = G.clamp(p / 0.6, 0, 1);
            var x = p < 1 ? Math.round(G.lerp(-70, PX, G.ease(walk))).toNumber() : PX;
            var spr = SprPost.STAND;
            if (p < 0.6) {
                spr = (a.t / 140) % 2 == 1 ? SprPost.WALK_B : SprPost.WALK_A;
            } else if (p < 0.85) {
                spr = SprPost.DELIVER;
            }
            Spr.draw(dc, spr, x, GY - 90, 5, pp, false);
            if (p >= 0.8) {
                flag(dc, P, HX[1]);
            }
        } else if (sc == 2) {
            // round done: waves goodbye
            var wv = !live || (tt / 400) % 2 == 0;
            Spr.draw(dc, wv ? SprPost.WAVE : SprPost.STAND, 250, GY - 90, 5, pp, false);
        } else {
            // a cat strolls along the pavement, sits down under the lamp
            var cx = p < 1 ? Math.round(G.lerp(470, 250, G.ease(p))).toNumber() : 250;
            var cp = [-1, P[38], k > 0 ? 0x8AFF6A : 0xFFD23A];
            Spr.draw(dc, p < 1 && (a.t / 160) % 2 == 1 ? SprPost.CAT_B : SprPost.CAT_A, cx, GY - 24, 4, cp, true);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        dc.setColor(st == 3 ? 0x306230 : 0x3A3A42, -1);
        for (var h = 0; h < 3; h++) {
            dc.drawRectangle(HX[h] + 16 + o[0], 242 + o[1], 46, GY - 242);
        }
        dc.fillRectangle(o[0], GY + o[1], 454, 2);
        dc.setColor(st == 3 ? 0x8BAC0F : 0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
        dc.setColor(st == 3 ? 0x306230 : 0x6A6A72, -1);
        F.px(dc, "HAUS " + house(d), 227 + o[0], 392 + o[1], 2, 1, 0);
    }
}
