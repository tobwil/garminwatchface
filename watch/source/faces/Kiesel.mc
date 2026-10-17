import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// KIESEL — "Kiesel": a love letter to the Pebble's TicToc face. Weekday and date in a bitmap font,
// a hairline, the time in big rounded bold digits, another hairline, steps with a dithered progress
// bar and the weather; on top the classic battery and Bluetooth icons (crossed out when the phone is
// gone). Static like the e-paper original: no ambient animation, only on every wrist raise the time
// slides in from the right like a Pebble window transition.
// Styles: 1 Weiß, 2 Schwarz, 3 Farbe (the accent snapped to the Pebble Time 64-colour palette).
// Mirrors web/js/faces/kiesel.js.
class FaceKiesel extends Face {
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

    // nearest colour of the Pebble Time palette (2 bits per channel)
    hidden function q(v as Number) as Number {
        return Math.round(v / 85.0).toNumber() * 85;
    }

    // [background, ink, dither ink]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x000000, 0xFFFFFF, 0xFFFFFF] as Array<Number>;
        }
        if (st == 3) {
            var r = q((acc >> 16) & 255);
            var g = q((acc >> 8) & 255);
            var b = q(acc & 255);
            var ink = r * 0.3 + g * 0.59 + b * 0.11 > 140 ? 0x000000 : 0xFFFFFF;
            return [(r << 16) | (g << 8) | b, ink, ink] as Array<Number>;
        }
        return [0xFFFFFF, 0x000000, 0x000000] as Array<Number>;
    }

    // 50 % grey the Pebble way: a checkerboard of 2 px dots
    hidden function dither(dc as Dc, x as Number, y as Number, w as Number, h as Number) as Void {
        for (var yy = 0; yy < h; yy += 2) {
            for (var xx = (yy / 2) % 2 == 0 ? 0 : 2; xx < w; xx += 4) {
                dc.fillRectangle(x + xx, y + yy, 2, 2);
            }
        }
    }

    // static layer: everything but the time; the time slides in on the raise
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
            // ---- status: battery and Bluetooth
            dc.drawRectangle(160, 48, 44, 22);
            dc.drawRectangle(161, 49, 42, 20);
            dc.fillRectangle(204, 54, 4, 10);
            dc.fillRectangle(164, 52, Math.round(36 * G.clamp(d.batt / 100.0, 0, 1)).toNumber(), 14);
            Spr.draw(dc, SprKiesel.BT, 260, 46, 3, [-1, P[1]], false);
            if (!d.phone) {
                for (var i = 0; i < 10; i++) {
                    dc.fillRectangle(254 + i * 3, 44 + i * 3, 4, 4);
                }
            }
            // ---- date
            F.px(dc, DAYS[d.dow] + ", " + d.day + ". " + MONS[d.mon - 1], 227, 100, 2, 1, 0);
            dc.fillRectangle(70, 132, 314, 3);
            dc.fillRectangle(70, 270, 314, 3);
            // ---- steps with a dithered bar, weather
            var sg = d.stepGoal > 0 ? d.stepGoal : 10000;
            var st = d.steps > 0 ? d.steps : 0;
            var f = G.clamp(st / sg.toFloat(), 0, 1);
            Spr.draw(dc, SprKiesel.SHOE, 132, 290, 3, [-1, P[1]], false);
            F.px(dc, G.num(st) + " Schritte", 170, 292, 2, 0, 0);
            dc.setColor(P[2], -1);
            dither(dc, 132, 322, 190, 10);
            dc.setColor(P[1], -1);
            dc.fillRectangle(132, 322, Math.round(190 * f).toNumber(), 10);
            if (d.temp > -99) {
                F.px(dc, d.temp + "°" + (d.rain >= 0 ? "  Regen " + d.rain + "%" : ""), 227, 352, 2, 1, 0);
            }
        }

        if (!M) {
            return;
        }
        // ---- the time slides in from the right on every raise
        var x = 227 + Math.round((1 - G.easeInOut(G.clamp(p / 0.6, 0, 1))) * 454).toNumber();
        dc.setColor(P[1], -1);
        F.st(dc, G.timeStr(d), x, 202, 84, 15, 1, 1.0, 0);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        dc.setColor(0x8A8A8A, -1);
        F.st(dc, G.timeStr(d), 227 + o[0], 202 + o[1], 84, 3, 1, 1.0, 0);
        dc.setColor(0x5A5A5A, -1);
        F.px(dc, DAYS[d.dow] + ", " + d.day + ".", 227 + o[0], 100 + o[1], 2, 1, 0);
    }
}
