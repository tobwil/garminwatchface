import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// BAKERY — "Bäckerei": a day in a small bakery, told by the clock. At night the dough rises in its
// bowl and the cat sleeps on the counter, from three o'clock the baker fires the oven and pulls tray
// after tray of rolls out of it, the shelves fill up, the shop opens and customers come in (the door
// bell rings on every wrist raise) until in the evening everything is sold and he sweeps the floor
// of the closed shop. The three data slots are chalked on the board as the day's offer.
// Styles: 1 Backstube, 2 Café, 3 Gameboy. Mirrors web/js/faces/bakery.js.
class FaceBakery extends Face {
    const CT = 296;
    const FL = 360;
    const FEET = 384;
    const MAXB = 18;
    const CAP = ["DER TEIG GEHT", "BACKSTUBE", "GEÖFFNET", "GESCHLOSSEN"];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 8;
    }

    // scene: 0 night (dough rises), 1 baking, 2 shop open, 3 closed
    hidden function scene(d as D) as Number {
        var m = d.mins;
        if (m >= 1320 || m < 180) {
            return 0;
        }
        if (m < 390) {
            return 1;
        }
        return m < 1110 ? 2 : 3;
    }

    // pieces of bread on the shelves now
    hidden function stock(d as D, sc as Number) as Number {
        if (sc == 1) {
            return Math.round(MAXB * G.clamp((d.mins - 180) / 210.0, 0, 1)).toNumber();
        }
        if (sc == 2) {
            return Math.round(MAXB * (1 - G.clamp((d.mins - 390) / 720.0, 0, 1))).toNumber();
        }
        return 0;
    }

    // [wall, wall line, floor, floor line, brick, brick dark, oven mouth, fire, fire bright, shelf, counter top,
    //  counter, counter dark, board, chalk, text, text dim, crust, crumb, crust dark, white, skin, eye, apron,
    //  trousers, shoes, peel, coat, hair, dough, cat, bowl]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0xE8DCC8, 0xD8C8B0, 0x5A4A42, 0x4A3C36, 0x7A8A8A, 0x5A6A6A, 0x1A1A1E, 0xFF7A2A, 0xFFD25A,
                0x6A4A3A, 0xF4F0EA, 0x3A6A6A, 0x2A4A4A, 0x2A3A34, 0xF4F0E6, 0xFFFFFF, 0xE0E8E4, 0xC8843A, 0xF0C070, 0x8A5428,
                0xFFFFFF, 0xF2C08A, 0x1A1A1A, acc, 0x2A2A34, 0x1A1A1A, 0x9A6A3A, 0x8A3A5A, 0x3A2A1A, 0xF4E8D0, 0x3A3A40, 0x6A8AB0] as Array<Number>;
        }
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [c, b, b, a, b, a, a, e, e, a, e, b, a, a, e, e, c, a, e, a, e, e, a, b, a, a, a, b, a, e, a, b] as Array<Number>;
        }
        return [0xF0DCB8, 0xE0C8A0, 0x8A5A3A, 0x6A4430, 0xB05A3A, 0x8A4028, 0x2A1A14, 0xFF7A2A, 0xFFD25A,
            0x7A4A2A, 0xE8D0A8, 0x8A5A34, 0x5A3A20, 0x2A2A26, 0xF4F0E6, 0xFFFFFF, 0xF0E4D0, 0xC8843A, 0xF0C070, 0x8A5428,
            0xFFFFFF, 0xF2C08A, 0x1A1A1A, acc, 0x3A3A48, 0x1A1A1A, 0x9A6A3A, 0x3A6A9A, 0x5A3A1A, 0xF4E8D0, 0x3A3A40, 0x8AA0C0] as Array<Number>;
    }

    // one piece of bread of kind k (0 loaf, 1 roll, 2 croissant) at x, resting on y
    hidden function bread(dc as Dc, P as Array<Number>, k as Number, x as Number, y as Number) as Void {
        if (k == 0) {
            dc.setColor(P[17], -1);
            dc.fillRectangle(x, y - 12, 26, 12);
            dc.fillRectangle(x + 2, y - 14, 22, 2);
            dc.setColor(P[18], -1);
            for (var i = 0; i < 3; i++) {
                dc.fillRectangle(x + 4 + i * 7, y - 12, 4, 2);
            }
        } else if (k == 1) {
            dc.setColor(P[17], -1);
            dc.fillRectangle(x + 2, y - 12, 16, 12);
            dc.fillRectangle(x, y - 10, 20, 8);
            dc.setColor(P[19], -1);
            dc.fillRectangle(x + 9, y - 12, 2, 8);
        } else {
            dc.setColor(P[18], -1);
            dc.fillRectangle(x + 6, y - 12, 10, 10);
            dc.setColor(P[17], -1);
            dc.fillRectangle(x, y - 8, 6, 6);
            dc.fillRectangle(x + 16, y - 8, 6, 6);
            dc.fillRectangle(x + 9, y - 12, 4, 10);
        }
    }

    // static layer: wall, oven, board, shelves with their stock, counter, floor, texts; the baker, the
    // customer, the fire, the tray, the bell, the dough, the cat and the broom move
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
        var n = stock(d, sc);

        if (S) {
            // ---- tiled wall, floor
            dc.setColor(P[0], -1);
            dc.fillRectangle(0, 0, 454, FL);
            dc.setColor(P[1], -1);
            for (var y = 20; y < FL; y += 24) {
                dc.fillRectangle(0, y, 454, 2);
                for (var x = (y / 24) % 2 == 0 ? 0 : 24; x < 454; x += 48) {
                    dc.fillRectangle(x, y, 2, 24);
                }
            }
            dc.setColor(P[2], -1);
            dc.fillRectangle(0, FL, 454, 454 - FL);
            dc.setColor(P[3], -1);
            for (var x = 0; x < 454; x += 36) {
                dc.fillRectangle(x, FL, 2, 94);
            }
            dc.fillRectangle(0, FL + 30, 454, 2);

            // ---- the oven: brick vault with its mouth
            dc.setColor(P[4], -1);
            dc.fillRectangle(20, 176, 150, CT - 176);
            dc.fillRectangle(32, 160, 126, 16);
            dc.fillRectangle(52, 148, 86, 12);
            dc.setColor(P[5], -1);
            for (var y = 182; y < CT; y += 14) {
                for (var x = 20 + ((y / 14) % 2) * 12; x < 170; x += 24) {
                    dc.fillRectangle(x, y, 2, 12);
                }
            }
            for (var y = 180; y < CT; y += 14) {
                dc.fillRectangle(20, y, 150, 2);
            }
            dc.setColor(P[6], -1);
            dc.fillRectangle(52, 214, 86, 52);
            dc.fillRectangle(64, 206, 62, 8);
            dc.setColor(P[5], -1);
            dc.fillRectangle(80, 120, 30, 28);

            // ---- chalk board with the day's offer (the data slots)
            dc.setColor(P[9], -1);
            dc.fillRectangle(150, 94, 154, 82);
            dc.setColor(P[13], -1);
            dc.fillRectangle(154, 98, 146, 74);
            dc.setColor(P[14], -1);
            F.px(dc, "ANGEBOT", 227, 102, 2, 1, 0);
            for (var i = 0; i < 3; i++) {
                var s = d.slots[i];
                var lb = s[:lbl] as String;
                if (lb.length() == 0 || G.stag(p, i, 0.1, 0.4) <= 0) {
                    continue;
                }
                var val = s[:val] as String;
                while (lb.length() > 2 && F.pxW(lb, 2) > 118 - F.pxW(val, 2)) {
                    lb = lb.substring(0, lb.length() - 1);
                }
                dc.setColor(G.mix(P[14], P[13], 0.3), -1);
                F.px(dc, lb, 162, 122 + i * 16, 2, 0, 0);
                dc.setColor(P[14], -1);
                F.px(dc, val, 292, 122 + i * 16, 2, 2, 0);
            }

            // ---- shelves with today's stock
            for (var r = 0; r < 3; r++) {
                var y = 212 + r * 30;
                dc.setColor(P[9], -1);
                dc.fillRectangle(290, y, 140, 6);
                for (var i = 0; i < 6; i++) {
                    if (r * 6 + i < n) {
                        bread(dc, P, r, 294 + i * 22, y);
                    }
                }
            }
            dc.setColor(P[9], -1);
            dc.fillRectangle(290, 186, 4, 92);
            dc.fillRectangle(426, 186, 4, 92);

            // ---- counter
            dc.setColor(P[10], -1);
            dc.fillRectangle(0, CT, 454, 10);
            dc.setColor(P[11], -1);
            dc.fillRectangle(0, CT + 10, 454, FL - CT - 10);
            dc.setColor(P[12], -1);
            for (var x = 30; x < 454; x += 60) {
                dc.fillRectangle(x, CT + 16, 44, FL - CT - 22);
            }
            dc.setColor(P[11], -1);
            for (var x = 30; x < 454; x += 60) {
                dc.fillRectangle(x + 4, CT + 20, 36, FL - CT - 30);
            }
            if (sc == 3 || sc == 0) {
                dc.setColor(0xF4F0E6, -1);
                dc.fillRectangle(306, CT - 30, 112, 26);
                dc.setColor(0xC0392B, -1);
                F.px(dc, "ZU", 362, CT - 24, 2, 1, 0);
            }

            // ---- time, date, caption
            dc.setColor(G.mix(P[0], 0, 0.6), -1);
            F.px(dc, G.timeStr(d), 229, 26, 5, 1, 0);
            dc.setColor(st == 3 ? 0x0F380F : 0x3A2414, -1);
            F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 68, 2, 1, 0);
            dc.setColor(P[15], -1);
            F.px(dc, CAP[sc], 227, 398, 2, 1, 0);
            var sub = sc == 0 ? "BACKSTART 3:00" : sc == 1 ? "OFEN 230°" : sc == 2 ? n + " STÜCK DA" : "ALLES VERKAUFT!";
            dc.setColor(P[16], -1);
            F.px(dc, sub, 227, 418, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        var bp = [-1, P[20], P[21], P[22], P[23], P[24], P[20], P[25]];
        // fire in the oven while baking
        if (sc == 1) {
            for (var i = 0; i < 8; i++) {
                var h = 8 + (G.rnd(i * 13 + tt / 110) % 22);
                dc.setColor(i % 2 == 0 ? P[7] : P[8], -1);
                dc.fillRectangle(58 + i * 10, 264 - h, 8, h);
            }
        }
        if (sc == 0) {
            // the dough rises in its bowl, the cat sleeps on the counter
            var rise = G.clamp(((d.mins + 120) % 1440) / 300.0, 0, 1);
            var w = 50 + Math.round(rise * 10).toNumber();
            var h = 8 + Math.round(rise * 16).toNumber() + (live ? Math.round(Math.sin(tt / 700.0) * 2).toNumber() : 0);
            dc.setColor(P[29], -1);
            dc.fillRectangle(212 - w / 2, CT - 18 - h, w, h + 4);
            dc.fillRectangle(212 - w / 2 + 6, CT - 22 - h, w - 12, 4);
            dc.setColor(P[31], -1);
            dc.fillRectangle(182, CT - 18, 60, 18);
            Spr.draw(dc, SprBakery.CAT, 60, CT - 20, 4, [-1, P[30], G.mix(P[30], 0xFFFFFF, 0.3)], false);
            dc.setColor(P[16], -1);
            var ph = (tt % 1500) / 1500.0;
            F.px(dc, "Z", 104 + Math.round(ph * 18).toNumber(), CT - 34 - Math.round(ph * 40).toNumber(), ph > 0.5 ? 3 : 2, 1, 0);
        } else if (sc == 1) {
            // pulls a tray of fresh rolls out of the oven on every raise
            var out = p < 1 ? G.ease(G.clamp((p - 0.3) / 0.6, 0, 1)) : 1.0;
            Spr.draw(dc, SprBakery.PEEL_UP, 180, CT - 60, 5, bp, false);
            var tx = Math.round(G.lerp(70, 238, out)).toNumber();
            var px = tx + 60 < 236 ? tx + 60 : 236;
            dc.setColor(P[26], -1);
            dc.fillRectangle(px, CT - 34, 238 - px, 4);
            dc.fillRectangle(tx, CT - 36, 64, 6);
            for (var i = 0; i < 3; i++) {
                bread(dc, P, 1, tx + 2 + i * 20, CT - 36);
            }
            if (out > 0.9) {
                dc.setColor(G.mix(P[0], 0xFFFFFF, 0.5), -1);
                for (var i = 0; i < 3; i++) {
                    dc.fillRectangle(tx + 10 + i * 20, CT - 56 - ((tt / 160 + i) % 3) * 6, 4, 4);
                }
            }
        } else if (sc == 2) {
            // the baker serves; on every raise a customer comes in (the bell rings), buys and leaves
            Spr.draw(dc, SprBakery.BAKER_UP, 200, CT - 60, 5, bp, false);
            if (p < 1) {
                var cp = [-1, P[27], P[21], P[22], P[24], P[25], P[28], P[17]];
                var cx;
                if (p < 0.4) {
                    cx = Math.round(G.lerp(-70, 150, G.ease(p / 0.4))).toNumber();
                } else if (p < 0.7) {
                    cx = 150;
                } else {
                    cx = Math.round(G.lerp(150, -80, G.easeInOut((p - 0.7) / 0.3))).toNumber();
                }
                var walking = p < 0.4 || p >= 0.7;
                Spr.draw(dc, walking && (a.t / 140) % 2 == 1 ? SprBakery.CUST_B : SprBakery.CUST_A, cx, FEET - 90, 5, cp, p >= 0.7);
                if (p < 0.25) {
                    dc.setColor(P[15], -1);
                    F.px(dc, "KLING!", 70, 196, 2, 1, 0);
                }
            }
        } else {
            // closed: sweeping in front of the counter
            var x = 150 + Math.round(60 * Math.sin(tt / 1400.0)).toNumber();
            Spr.draw(dc, SprBakery.BAKER, x, FEET - 90, 5, bp, false);
            var sw = live ? Math.round(Math.sin(tt / 180.0) * 8).toNumber() : 0;
            dc.setColor(P[26], -1);
            for (var i = 0; i < 8; i++) {
                dc.fillRectangle(x + 50 + Math.round(i * (sw + 8) / 8.0).toNumber(), FEET - 50 + i * 5, 3, 5);
            }
            dc.setColor(P[19], -1);
            dc.fillRectangle(x + 46 + sw + 8, FEET - 6, 20, 6);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        dc.setColor(st == 3 ? 0x306230 : 0x3A3A42, -1);
        dc.drawRectangle(20 + o[0], 176 + o[1], 150, CT - 176);
        dc.fillRectangle(o[0], CT + o[1], 454, 2);
        dc.setColor(G.dim(0xFF7A2A, 0.4), -1);
        if (scene(d) == 1) {
            dc.fillRectangle(60 + o[0], 250 + o[1], 70, 4);
        }
        dc.setColor(st == 3 ? 0x8BAC0F : 0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
    }
}
