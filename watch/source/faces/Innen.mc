import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// INNEN — "Innenwetter": your state as the weather over a little landscape, with you standing in it.
// Top fit is sunshine (you cheer), solid is fair weather, tired is cloudy, a short night is fog,
// exhausted is rain (you hold an umbrella), stress is a thunderstorm, and while the Body Battery is
// clearly charging a rainbow appears. Day and night follow the real sun. The caption says why, and
// compares with the real weather outside. Styles: 1 Wiese, 2 Pastell, 3 Gameboy.
// Mirrors web/js/faces/innen.js.
class FaceInnen extends Face {
    const GND = 300;
    const WN = ["SONNIG", "HEITER", "BEWÖLKT", "NEBEL", "REGEN", "GEWITTER", "REGENBOGEN"];
    const CL = [96, 120, 300, 92, 200, 150, 360, 168];
    const RB = [0xFF3A3A, 0xFFA02A, 0xFFE03A, 0x3AE07A, 0x3A8AFF, 0x8A5AFF];
    const NC = [0, 2, 3, 3, 4, 4, 1];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    // inner weather: 0 sunny, 1 fair, 2 cloudy, 3 fog, 4 rain, 5 storm, 6 rainbow
    hidden function weather(d as D) as Number {
        var r = Insight.ready(d);
        var st = Insight.state(d, r[0]);
        if (st == 4) {
            return 5;
        }
        if (Insight.bbRate(d) >= 6) {
            return 6;
        }
        if (st == 3) {
            return 4;
        }
        if (d.sleep >= 0 && d.sleep < 50) {
            return 3;
        }
        if (st == 2) {
            return 2;
        }
        return st == 1 ? 1 : 0;
    }

    hidden function why(d as D, w as Number) as String {
        var r = Insight.ready(d);
        if (w == 0) {
            return "AKKU " + d.bb + "%, AUSGERUHT";
        }
        if (w == 1) {
            return "SOLIDE FORM (" + r[0] + ")";
        }
        if (w == 3) {
            return "SCHLAF NUR " + d.sleep;
        }
        if (w == 5) {
            return "STRESS " + Insight.stress2h(d) + " SEIT 2 STD";
        }
        if (w == 6) {
            return "AKKU LÄDT +" + Insight.bbRate(d) + "/STD";
        }
        var k = Insight.worst(r);
        return k >= 0 ? Insight.reason(d, k) : "ETWAS MÜDE";
    }

    // [sky top day, sky low day, sky top grey, sky low grey, sky top night, sky low night, hill far, hill near,
    //  cloud, cloud dark, rain, sun, text, text dim, shirt, skin, eye, trousers, shoes, hair, umbrella, star]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x8AC8F0, 0xF0E0F0, 0xA8A8C0, 0xD8D0E0, 0x1A1A3A, 0x3A2A5A, 0x9AD8B0, 0x7AC89A, 0xFFFFFF,
                0xC8C0D8, 0x8AB8FF, 0xFFE08A, 0x2A2A4A, 0x5A5A7A, acc, 0xF2C08A, 0x1A1A1A, 0x5A6A9A, 0x3A2A2A, 0x5A3A2A, 0xFF7AA8, 0xFFFFFF] as Array<Number>;
        }
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [c, e, b, c, a, b, b, a, e, c, a, e, a, b, a, e, a, a, a, a, b, e] as Array<Number>;
        }
        return [0x2A7AD8, 0x9AD4FF, 0x5A6878, 0x9AA4B0, 0x060A20, 0x18204A, 0x3A8A3A, 0x2A6A2A, 0xFFFFFF, 0xB0B8C4,
            0x8AC8FF, 0xFFF2A0, 0xFFFFFF, 0xE8F0E8, acc, 0xF2C08A, 0x1A1A1A, 0x3A4A6A, 0x2A2A2A, 0x5A3A1A, 0xFF4A6A, 0xFFFFFF] as Array<Number>;
    }

    // static layer: sky, rainbow, hills, texts; sun, clouds, rain, fog, lightning and you move
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
        var w = weather(d);
        var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var night = el < -6;
        var grey = w >= 2 && w <= 5;
        var dim = night && st != 3 ? 0.55 : 0.0;

        if (S) {
            // ---- sky: day / grey / night
            var top = night ? P[4] : grey ? P[2] : P[0];
            var low = night ? P[5] : grey ? P[3] : P[1];
            for (var i = 0; i < 10; i++) {
                dc.setColor(G.mix(top, low, i / 9.0), -1);
                dc.fillRectangle(0, i * 30, 454, 30);
            }
            if (night && w <= 1) {
                dc.setColor(P[21], -1);
                for (var i = 0; i < 26; i++) {
                    var r = G.rnd(i * 7919 + 13);
                    dc.fillRectangle(30 + (r % 394), 90 + ((r >> 9) % 170), 2, 2);
                }
            }
            // ---- rainbow while the battery charges
            if (w == 6) {
                dc.setPenWidth(8);
                for (var i = 0; i < 6; i++) {
                    dc.setColor(night ? G.mix(RB[i], 0, 0.5) : RB[i], -1);
                    G.arcC(dc, 227, GND + 20, 190 - i * 8, -78, 78);
                }
            }
            // ---- hills
            dc.setColor(G.mix(P[6], 0x050814, dim), -1);
            for (var x = 0; x < 454; x += 4) {
                var h = 40 + Math.round(22 * Math.sin(x / 70.0 + 1) + 10 * Math.sin(x / 27.0)).toNumber();
                dc.fillRectangle(x, GND - h + 20, 4, h);
            }
            dc.setColor(G.mix(P[7], 0x050814, dim), -1);
            dc.fillRectangle(0, GND, 454, 154);
            // ---- time, inner weather, the reason, the weather outside
            if (st != 2) {
                dc.setColor(0x000000, -1);
                F.st(dc, G.timeStr(d), 229, 40, 44, 6, 1, 1.0, 0);
            }
            dc.setColor(P[12], -1);
            F.st(dc, G.timeStr(d), 227, 38, 44, 6, 1, 1.0, 0);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 70, 2, 1, 0);
            F.px(dc, "INNEN: " + (night && w <= 1 ? "STERNKLAR" : WN[w]), 227, 362, 2, 1, 0);
            dc.setColor(P[13], -1);
            F.px(dc, why(d, w), 227, 384, 2, 1, 0);
            var cn = Insight.condName(d.cond);
            if (d.temp > -99) {
                F.px(dc, "DRAUSSEN: " + d.temp + "°" + (cn.length() > 0 ? " " + cn : ""), 227, 406, 2, 1, 0);
            }
        }

        if (!M) {
            return;
        }
        // ---- sun (rays turn slowly), clouds drifting in, fog, rain and lightning
        if ((w <= 1 || w == 6) && !night) {
            var sx = 120;
            var sy = 140;
            dc.setColor(P[11], -1);
            dc.fillCircle(sx, sy, 26);
            for (var i = 0; i < 8; i++) {
                var an = (i * 45 + tt / 60.0) * Math.PI / 180;
                dc.fillRectangle(Math.round(sx + Math.cos(an) * 40).toNumber() - 3, Math.round(sy + Math.sin(an) * 40).toNumber() - 3, 6, 6);
            }
        }
        var cin = G.ease(G.clamp(p / 0.7, 0, 1));
        var dark = w >= 4 && w <= 5 ? 0.45 : night ? 0.6 : 0.0;
        for (var i = 0; i < NC[w]; i++) {
            var x = Math.round(CL[i * 2] + (1 - cin) * (i % 2 == 0 ? -260 : 260) + Math.sin(tt / 3000.0 + i) * 12).toNumber();
            var y = CL[i * 2 + 1];
            dc.setColor(G.mix(P[8], 0x303848, dark), -1);
            dc.fillRectangle(x - 44, y, 88, 20);
            dc.fillRectangle(x - 26, y - 16, 50, 16);
            dc.setColor(G.mix(P[9], 0x202838, dark), -1);
            dc.fillRectangle(x - 44, y + 14, 88, 6);
        }
        if (w == 3) {
            dc.setColor(G.mix(P[3], 0xFFFFFF, 0.35), -1);
            for (var i = 0; i < 5; i++) {
                dc.fillRectangle(((tt / 40 + i * 97) % 560) - 100, 200 + i * 22, 220, 8);
            }
        }
        if ((w == 4 || w == 5) && p > 0.3) {
            dc.setColor(G.mix(P[10], 0, night ? 0.4 : 0.0), -1);
            for (var i = 0; i < 34; i++) {
                dc.fillRectangle((i * 83 + tt / 14) % 440 + 6, (i * 47 + tt / 5) % (GND - 140) + 150, 2, 10);
            }
        }
        if (w == 5 && live && (tt / 90) % 29 == 0) {
            dc.setColor(0xFFFFFF, -1);
            for (var i = 0; i < 7; i++) {
                dc.fillRectangle(330 - (i % 2) * 12 - i * 3, 136 + i * 18, 6, 18);
            }
        }
        // ---- you: cheering in the sun, under an umbrella in the rain
        var pp = [-1, P[14], P[15], P[16], P[17], P[18], P[19]];
        var hop = w == 0 && live ? Math.round(Math.sin(tt / 240.0) * 8).toNumber().abs() : 0;
        Spr.draw(dc, w == 0 || w == 6 ? SprInnen.CHEER : SprInnen.STAND, 300, GND - 56 - hop, 4, pp, false);
        if (w == 4 || w == 5) {
            dc.setColor(P[20], -1);
            dc.fillRectangle(296, GND - 82, 56, 8);
            dc.fillRectangle(306, GND - 90, 36, 8);
            dc.fillRectangle(322, GND - 74, 4, 22);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        dc.setColor(st == 3 ? 0x306230 : 0x3A3A42, -1);
        dc.fillRectangle(o[0], GND + o[1], 454, 2);
        dc.setColor(st == 3 ? 0x8BAC0F : 0x8A8A8A, -1);
        F.st(dc, G.timeStr(d), 227 + o[0], 38 + o[1], 44, 3, 1, 1.0, 0);
        F.px(dc, "INNEN: " + WN[weather(d)], 227 + o[0], 362 + o[1], 2, 1, 0);
    }
}
