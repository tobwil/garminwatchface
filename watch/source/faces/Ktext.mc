import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// KTEXT — "Kiesel Text": the Pebble's famous Text Watch in German. The time as words on up to three
// lines, the hour in bold ("zehn / zweiund / vierzig", "zehn / null / sieben", "zehn / uhr"), set in
// the bitmap font. On every wrist raise the lines slide in from the right one after the other, like
// the minute change on the Pebble. Date, battery and Bluetooth at the edge; otherwise as still as
// e-paper. Styles: 1 Weiß, 2 Schwarz, 3 Farbe (Pebble Time palette).
// Mirrors web/js/faces/ktext.js.
class FaceKtext extends Face {
    const HW = ["zwölf", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf"];
    const ONES = ["", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
    const PRE = ["", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
    const TEEN = ["zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
    const TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig"];
    const DOW = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const X0 = 78;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 0;
    }

    function reveal() as Boolean {
        return false;
    }

    // the time as lines of words: the hour first
    hidden function words(h as Number, m as Number) as Array<String> {
        var L = [HW[h % 12]] as Array<String>;
        if (m == 0) {
            L.add("uhr");
        } else if (m < 10) {
            L.add("null");
            L.add(ONES[m]);
        } else if (m < 20) {
            L.add(TEEN[m - 10]);
        } else if (m % 10 == 0) {
            L.add(TENS[m / 10]);
        } else {
            L.add(PRE[m % 10] + "und");
            L.add(TENS[m / 10]);
        }
        return L;
    }

    hidden function q(v as Number) as Number {
        return Math.round(v / 85.0).toNumber() * 85;
    }

    // [background, ink, dim ink]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x000000, 0xFFFFFF, 0xAAAAAA] as Array<Number>;
        }
        if (st == 3) {
            var r = q((acc >> 16) & 255);
            var g = q((acc >> 8) & 255);
            var b = q(acc & 255);
            var ink = r * 0.3 + g * 0.59 + b * 0.11 > 140 ? 0x000000 : 0xFFFFFF;
            return [(r << 16) | (g << 8) | b, ink, ink] as Array<Number>;
        }
        return [0xFFFFFF, 0x000000, 0x555555] as Array<Number>;
    }

    // static layer: background, date, battery, Bluetooth; the words slide in
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
            dc.setColor(P[2], -1);
            dc.fillRectangle(187, 60, Math.round(80 * G.clamp(d.batt / 100.0, 0, 1)).toNumber(), 4);
            Spr.draw(dc, SprKiesel.BT, 216, 76, 2, [-1, P[2]], false);
            if (!d.phone) {
                for (var i = 0; i < 7; i++) {
                    dc.fillRectangle(212 + i * 3, 74 + i * 3, 3, 3);
                }
            }
            F.px(dc, DOW[d.dow] + " " + d.day + "." + d.mon + ".", 227, 380, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        // ---- the words, sliding in line by line
        var L = words(d.h, d.m);
        var y0 = 227 - (L.size() * 72 - 16) / 2;
        dc.setColor(P[1], -1);
        for (var i = 0; i < L.size(); i++) {
            var x = X0 + Math.round((1 - G.easeInOut(G.stag(p, i, 0.14, 0.5))) * 420).toNumber();
            var y = y0 + i * 72;
            if (i == 0) {
                F.px(dc, L[i], x, y, 8, 0, 0);
                F.px(dc, L[i], x + 3, y, 8, 0, 0);
            } else {
                F.px(dc, L[i], x, y + 8, 6, 0, 0);
            }
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var L = words(d.h, d.m);
        var y0 = 227 - (L.size() * 72 - 16) / 2;
        dc.setColor(0x6A6A6A, -1);
        for (var i = 0; i < L.size(); i++) {
            F.px(dc, L[i], X0 + o[0], y0 + i * 72 + (i == 0 ? 0 : 8) + o[1], i == 0 ? 8 : 6, 0, 1);
        }
    }
}
