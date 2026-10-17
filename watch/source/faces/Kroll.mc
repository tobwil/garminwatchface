import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// KROLL — "Kiesel Rolle": four digit reels behind windows, in the spirit of the Pebble's rolling and
// sliding digit faces. On every wrist raise the reels spin like a slot machine and stop one after the
// other from left to right with a little spring; the neighbouring digits peek in at the window edges.
// The resting digits are part of the static layer, only spinning reels are drawn per frame.
// Date above, steps, battery and Bluetooth below; still as e-paper after that.
// Styles: 1 Weiß, 2 Schwarz, 3 Farbe (Pebble Time palette). Mirrors web/js/faces/kroll.js.
class FaceKroll extends Face {
    const WX = [51, 137, 237, 323];
    const WY = 162;
    const WW = 80;
    const WH = 130;
    const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    const MONS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 0;
    }

    function reveal() as Boolean {
        return false;
    }

    hidden function q(v as Number) as Number {
        return Math.round(v / 85.0).toNumber() * 85;
    }

    // [background, ink, window, digit]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x000000, 0xFFFFFF, 0x000000, 0xFFFFFF] as Array<Number>;
        }
        if (st == 3) {
            var r = q((acc >> 16) & 255);
            var g = q((acc >> 8) & 255);
            var b = q(acc & 255);
            var bg = (r << 16) | (g << 8) | b;
            var ink = r * 0.3 + g * 0.59 + b * 0.11 > 140 ? 0x000000 : 0xFFFFFF;
            return [bg, ink, ink, bg] as Array<Number>;
        }
        return [0xFFFFFF, 0x000000, 0xFFFFFF, 0x000000] as Array<Number>;
    }

    hidden function digits(d as D) as Array<Number> {
        var h = d.is24 ? d.h : G.hour(d);
        return [h / 10, h % 10, d.m / 10, d.m % 10] as Array<Number>;
    }

    // static layer: windows, colon, date, steps, battery, Bluetooth; the reels move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var P = pal(d.cfg.style, d.accent);
        var p = a.intro;

        if (S) {
            dc.setColor(P[0], -1);
            dc.fillRectangle(0, 0, 454, 454);
            dc.setColor(P[1], -1);
            F.px(dc, DAYS[d.dow] + ", " + d.day + ". " + MONS[d.mon - 1], 227, 118, 2, 1, 0);
            for (var k = 0; k < 4; k++) {
                dc.fillRectangle(WX[k] - 4, WY - 4, WW + 8, WH + 8);
                dc.setColor(P[2], -1);
                dc.fillRectangle(WX[k], WY, WW, WH);
                dc.setColor(P[1], -1);
            }
            dc.fillRectangle(222, 204, 10, 10);
            dc.fillRectangle(222, 240, 10, 10);
            // the resting digits (a spinning reel paints over its window)
            var R0 = digits(d);
            dc.setColor(P[3], -1);
            for (var k = 0; k < 4; k++) {
                F.px(dc, "" + R0[k], WX[k] + WW / 2, WY + WH / 2 - 42, 12, 1, 0);
            }
            dc.setColor(P[1], -1);
            // steps, battery, Bluetooth
            Spr.draw(dc, SprKiesel.SHOE, 150, 320, 2, [-1, P[1]], false);
            F.px(dc, G.num(d.steps > 0 ? d.steps : 0) + " Schritte", 176, 318, 2, 0, 0);
            dc.drawRectangle(186, 352, 36, 18);
            dc.fillRectangle(222, 356, 3, 10);
            dc.fillRectangle(189, 355, Math.round(30 * G.clamp(d.batt / 100.0, 0, 1)).toNumber(), 12);
            Spr.draw(dc, SprKiesel.BT, 242, 350, 2, [-1, P[1]], false);
            if (!d.phone) {
                for (var i = 0; i < 7; i++) {
                    dc.fillRectangle(238 + i * 3, 348 + i * 3, 3, 3);
                }
            }
        }

        if (!M) {
            return;
        }
        // ---- reels: spin on the raise, stop left to right with a spring; only the spinning reels and
        // their visible digits are drawn
        var T = digits(d);
        for (var k = 0; k < 4; k++) {
            var qk = G.stag(p, k, 0.13, 0.55);
            if (p >= 1 || qk >= 1) {
                continue;
            }
            var e = G.spring(qk);
            var s = T[k] - (1 - e) * (10 + k * 5);
            var base = Math.floor(s).toNumber();
            var fr = s - base;
            var cx = WX[k] + WW / 2;
            var cy = WY + WH / 2;
            dc.setClip(WX[k], WY, WW, WH);
            dc.setColor(P[2], -1);
            dc.fillRectangle(WX[k], WY, WW, WH);
            dc.setColor(P[3], -1);
            for (var j = -1; j <= 1; j++) {
                if ((j == -1 && fr > 0.83) || (j == 1 && fr < 0.17)) {
                    continue;
                }
                var v = (((base + j) % 10) + 10) % 10;
                F.px(dc, "" + v, cx, Math.round(cy + (j - fr) * WH).toNumber() - 42, 12, 1, 0);
            }
            dc.clearClip();
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var T = digits(d);
        dc.setColor(0x4A4A4A, -1);
        for (var k = 0; k < 4; k++) {
            dc.drawRectangle(WX[k] + o[0], WY + o[1], WW, WH);
        }
        dc.setColor(0x9A9A9A, -1);
        for (var k = 0; k < 4; k++) {
            F.px(dc, "" + T[k], WX[k] + WW / 2 + o[0], WY + WH / 2 - 42 + o[1], 12, 1, 1);
        }
    }
}
