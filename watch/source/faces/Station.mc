import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// STATION — "Wetterstation": a pixel weather station in a meadow, and every instrument reads a real
// sensor. The cup anemometer spins at the real wind speed while the vane turns into the wind, the
// thermometer shows the temperature (today's low and high beside it), the rain gauge fills with the
// chance of rain, the barometer on the instrument hut points at the air pressure (altitude below).
// Over it all the sun travels its real arc from sunrise to sunset, at night the moon shows its phase;
// clouds, rain, snow and lightning follow the reported condition. On every wrist raise the cups spin
// up, the mercury climbs and the gauge fills. Styles: 1 Messgarten, 2 Polar, 3 Gameboy.
// Mirrors web/js/faces/station.js.
class FaceStation extends Face {
    const GND = 300;
    const AX = 84;
    const TX = 170;
    const RX = 250;
    const BX = 340;
    const DIRS = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
    const CL = [130, 112, 300, 96, 210, 130];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 12;
    }

    // Garmin condition -> [clouds 0..3, rain 0..3, snow 0..3, storm, fog, name]
    hidden function sky(c as Number) as Array {
        if (c == 0 || c == 23 || c == 39) {
            return [0, 0, 0, false, false, "KLAR"];
        }
        if (c == 22 || c == 1 || c == 51) {
            return [1, 0, 0, false, false, "HEITER"];
        }
        if (c == 2) {
            return [2, 0, 0, false, false, "BEWÖLKT"];
        }
        if (c == 20) {
            return [3, 0, 0, false, false, "BEDECKT"];
        }
        if (c == 5) {
            return [1, 0, 0, false, false, "WINDIG"];
        }
        if (c == 14 || c == 26 || c == 30 || c == 44 || c == 11 || c == 13) {
            return [2, 1, 0, false, false, "NIESELN"];
        }
        if (c == 3 || c == 24 || c == 48 || c == 49) {
            return [3, 2, 0, false, false, "REGEN"];
        }
        if (c == 15 || c == 25) {
            return [3, 3, 0, false, false, "STARKREGEN"];
        }
        if (c == 16 || c == 42 || c == 45 || c == 47 || c == 33) {
            return [2, 0, 1, false, false, "LEICHTER SCHNEE"];
        }
        if (c == 4 || c == 7 || c == 18 || c == 21 || c == 43 || c == 46 || c == 50 || c == 10) {
            return [3, 0, 2, false, false, "SCHNEE"];
        }
        if (c == 17 || c == 19) {
            return [3, 0, 3, false, false, "SCHNEESTURM"];
        }
        if (c == 6 || c == 12 || c == 27 || c == 31 || c == 35 || c == 40 || c == 41) {
            return [3, 2, 0, true, false, "GEWITTER"];
        }
        if (c == 8 || c == 9 || c == 28 || c == 38 || c == 29 || c == 32 || c == 34 || c == 36 || c == 37) {
            return [2, 0, 0, false, true, "NEBEL"];
        }
        return [1, 0, 0, false, false, "WETTER"];
    }

    hidden function moonName(k) as String {
        if (k < 0.03 || k > 0.97) {
            return "NEUMOND";
        }
        if ((k - 0.5).abs() < 0.03) {
            return "VOLLMOND";
        }
        return k < 0.5 ? "MOND ZUNEHMEND" : "MOND ABNEHMEND";
    }

    hidden function moon(dc as Dc, P as Array<Number>, cx as Number, cy as Number, r as Number, k) as Void {
        for (var y = -r; y < r; y += 4) {
            var yy = y + 2;
            var hw = (Math.sqrt(r * r - yy * yy) / 4).toNumber() * 4;
            if (hw <= 0) {
                continue;
            }
            dc.setColor(P[23], -1);
            dc.fillRectangle(cx - hw, cy + y, 2 * hw, 4);
            var x0 = k < 0.5 ? Math.round(hw * Math.cos(k * 2 * Math.PI) / 4).toNumber() * 4 : -hw;
            var x1 = k < 0.5 ? hw : Math.round(hw * Math.cos((k - 0.5) * 2 * Math.PI) / 4).toNumber() * 4;
            if (x1 > x0) {
                dc.setColor(P[22], -1);
                dc.fillRectangle(cx + x0, cy + y, x1 - x0, 4);
            }
        }
    }

    // [sky top day, low day, top dusk, low dusk, top night, low night, grey top, grey low, cloud, cloud shade,
    //  ground, ground dark, snow, metal, metal dark, white, glass, mercury, water, text, text dim, sun, moon lit,
    //  moon dark, drop, needle, star]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x5A8AC8, 0xD0E8F8, 0x4A4A8A, 0xF0A8A0, 0x040818, 0x101C3A, 0x7A8696, 0xB8C0C8, 0xFFFFFF,
                0xC8D0DC, 0xE8F0F8, 0xC0CCE0, 0xFFFFFF, 0x8A94A4, 0x4A5464, 0xF4F8FC, 0xD8ECFF, 0xE03A3A, 0x3A8AE8, 0x1A2A4A,
                0x4A5A7A, 0xFFF2B0, 0xF4F0D8, 0x3A3A48, 0x8AC8FF, acc, 0xFFFFFF] as Array<Number>;
        }
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [c, e, b, c, a, b, b, c, e, c, b, a, e, a, a, e, e, a, a, a, a, e, e, b, a, a, e] as Array<Number>;
        }
        return [0x3A8AD8, 0xA8D8FF, 0x5A4A9A, 0xFF9A6A, 0x060A20, 0x141C44, 0x7A8696, 0xAEB6C0, 0xFFFFFF, 0xD0D8E4,
            0x4A9A3A, 0x3A7A2A, 0xF4F8FC, 0x9AA4B4, 0x4A5464, 0xF4F4F0, 0xE8F4FF, 0xE03A3A, 0x3A8AE8, 0xFFFFFF, 0xD8E8D0,
            0xFFF2B0, 0xF4F0D8, 0x3A3A48, 0x8AC8FF, acc, 0xFFFFFF] as Array<Number>;
    }

    // static layer: sky, sun arc with sun / moon, clouds, meadow, masts, thermometer, gauge, hut,
    // barometer, labels; the cups, the vane, mercury and water during the raise, rain, snow and lightning move
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
        var W = sky(d.cond);
        var clouds = W[0] as Number;
        var rn = W[1] as Number;
        var sn = W[2] as Number;
        var storm = W[3] as Boolean;
        var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var k = el > 6 ? 0 : el > -6 ? 1 : 2;
        var grey = clouds >= 3 && k == 0;
        var snowy = st == 2 || sn > 0;
        var temp = d.temp > -99 ? d.temp : 0;
        var rain = d.rain >= 0 ? d.rain : 0;
        var grow = G.ease(G.clamp(p / 0.8, 0, 1));

        if (S) {
            // ---- sky
            var top = grey ? P[6] : P[k * 2];
            var low = grey ? P[7] : P[k * 2 + 1];
            for (var i = 0; i < 6; i++) {
                dc.setColor(G.mix(top, low, i / 5.0), -1);
                dc.fillRectangle(0, i * 50, 454, 50);
            }
            if (k == 2 && clouds < 3) {
                dc.setColor(P[26], -1);
                for (var i = 0; i < 24; i++) {
                    dc.fillRectangle(30 + ((i * 101 + 17) % 394), 90 + ((i * 47 + 11) % 150), 2, 2);
                }
            }
            // ---- sun arc from sunrise to sunset, the sun on it (or the moon at night)
            var sr = d.sunrise > 0 ? d.sunrise : 390.0;
            var ss = d.sunset > 0 ? d.sunset : 1140.0;
            dc.setColor(G.mix(low, 0xFFFFFF, 0.35), -1);
            for (var i = 0; i <= 40; i++) {
                var an = Math.PI * (1 - i / 40.0);
                dc.fillRectangle(Math.round(227 + Math.cos(an) * 170).toNumber() - 1, Math.round(GND - 10 - Math.sin(an) * 170).toNumber() - 1, 2, 2);
            }
            if (d.mins >= sr && d.mins <= ss) {
                var sp = ss - sr > 1 ? ss - sr : 1;
                var an = Math.PI * (1 - (d.mins - sr) / sp);
                dc.setColor(P[21], -1);
                dc.fillCircle(Math.round(227 + Math.cos(an) * 170).toNumber(), Math.round(GND - 10 - Math.sin(an) * 170).toNumber(), 12);
            } else {
                moon(dc, P, 360, 104, 18, d.moon >= 0 ? d.moon : 0.5);
            }
            dc.setColor(P[20], -1);
            F.px(dc, G.hm(sr), 50, GND - 22, 1, 1, 0);
            F.px(dc, G.hm(ss), 404, GND - 22, 1, 1, 0);
            // ---- clouds by condition
            var dark = rn > 1 || storm ? 0.45 : k == 2 ? 0.6 : 0.0;
            for (var i = 0; i < (clouds < 3 ? clouds : 3); i++) {
                var x = CL[i * 2];
                var y = CL[i * 2 + 1];
                dc.setColor(G.mix(P[8], 0x404858, dark), -1);
                dc.fillRectangle(x - 36, y, 72, 16);
                dc.fillRectangle(x - 22, y - 12, 40, 12);
                dc.setColor(G.mix(P[9], 0x303848, dark), -1);
                dc.fillRectangle(x - 36, y + 12, 72, 4);
            }
            if (W[4]) {
                dc.setColor(G.mix(low, 0xFFFFFF, 0.4), -1);
                for (var y = 200; y < GND; y += 14) {
                    dc.fillRectangle(0, y, 454, 6);
                }
            }

            // ---- meadow
            var gc = snowy ? P[12] : P[10];
            dc.setColor(k == 2 ? G.mix(gc, 0x050814, 0.6) : gc, -1);
            dc.fillRectangle(0, GND, 454, 154);
            dc.setColor(k == 2 ? G.mix(P[11], 0x050814, 0.6) : P[11], -1);
            for (var x = 0; x < 454; x += 14) {
                dc.fillRectangle(x + ((x / 14) % 3) * 4, GND + 6 + ((x * 13) % 40), 4, 2);
            }

            // ---- anemometer mast
            dc.setColor(P[14], -1);
            dc.fillRectangle(AX - 2, 162, 4, GND - 162);
            // ---- thermometer with scale -20..40
            dc.setColor(P[13], -1);
            dc.fillRectangle(TX - 22, 128, 44, GND - 128);
            dc.setColor(P[16], -1);
            dc.fillRectangle(TX - 6, 136, 12, 140);
            dc.fillCircle(TX, 284, 10);
            dc.setColor(P[14], -1);
            for (var t = -20; t <= 40; t += 10) {
                var y = 270 - Math.round((t + 20) / 60.0 * 130).toNumber();
                dc.fillRectangle(TX - 18, y, 8, 2);
                F.px(dc, "" + t, TX + 14, y - 3, 1, 0, 0);
            }
            // ---- rain gauge
            dc.setColor(P[13], -1);
            dc.fillRectangle(RX - 22, 214, 44, 8);
            dc.fillRectangle(RX - 16, 222, 32, 6);
            dc.setColor(P[16], -1);
            dc.fillRectangle(RX - 12, 228, 24, GND - 228);
            dc.setColor(P[14], -1);
            for (var i = 1; i < 5; i++) {
                dc.fillRectangle(RX + 6, GND - i * 14, 6, 2);
            }
            // ---- instrument hut with the barometer above
            dc.setColor(P[14], -1);
            dc.fillRectangle(BX - 32, 262, 4, GND - 262);
            dc.fillRectangle(BX + 28, 262, 4, GND - 262);
            dc.fillRectangle(BX - 2, 186, 4, 20);
            dc.setColor(P[15], -1);
            dc.fillRectangle(BX - 40, 204, 80, 60);
            dc.setColor(G.mix(P[15], P[14], 0.35), -1);
            for (var y = 212; y < 260; y += 8) {
                dc.fillRectangle(BX - 34, y, 68, 3);
            }
            dc.setColor(P[13], -1);
            dc.fillCircle(BX, 156, 32);
            dc.setColor(P[15], -1);
            dc.fillCircle(BX, 156, 27);
            dc.setColor(P[14], -1);
            for (var i = 0; i <= 8; i++) {
                var an = (-120 + i * 30) * Math.PI / 180;
                dc.fillRectangle(Math.round(BX + Math.sin(an) * 22).toNumber() - 1, Math.round(156 - Math.cos(an) * 22).toNumber() - 1, 3, 3);
            }
            var pr = d.pres > 0 ? d.pres / 100.0 : 1013.0;
            var pa = (-120 + G.clamp((pr - 970) / 80.0, 0, 1) * 240) * Math.PI / 180;
            dc.setColor(P[25], -1);
            for (var r = 0; r < 20; r += 2) {
                dc.fillRectangle(Math.round(BX + Math.sin(pa) * r).toNumber() - 2, Math.round(156 - Math.cos(pa) * r).toNumber() - 2, 4, 4);
            }
            dc.setColor(P[14], -1);
            dc.fillRectangle(BX - 3, 153, 6, 6);

            // ---- readings under the instruments
            var txt = snowy && k < 2 ? 0x1A2A4A : P[19];
            var dim = snowy && k < 2 ? 0x4A5A7A : P[20];
            dc.setColor(txt, -1);
            var wd = d.wind >= 0 ? Math.round(d.wind).toNumber() + " M/S" : "--";
            var dir = DIRS[(Math.round((((d.windDeg % 360) + 360) % 360) / 45.0).toNumber()) % 8];
            F.px(dc, wd, AX, 314, 2, 1, 0);
            F.px(dc, d.temp > -99 ? d.temp + "°" : "--", TX, 314, 2, 1, 0);
            F.px(dc, d.rain >= 0 ? rain + "%" : "--", RX, 314, 2, 1, 0);
            F.px(dc, d.pres > 0 ? Math.round(pr).toNumber() + "" : "--", BX, 314, 2, 1, 0);
            dc.setColor(dim, -1);
            F.px(dc, "WIND " + dir, AX, 334, 1, 1, 0);
            F.px(dc, d.hiT > -99 ? d.loT + "-" + d.hiT + "°" : "TEMP", TX, 334, 1, 1, 0);
            F.px(dc, "REGEN", RX, 334, 1, 1, 0);
            F.px(dc, "HPA" + (d.alt >= 0 ? " " + Math.round(d.alt).toNumber() + "M" : ""), BX, 334, 1, 1, 0);

            // ---- time, condition, moon
            dc.setColor(0x000000, -1);
            F.px(dc, G.timeStr(d), 229, 26, 5, 1, 0);
            dc.setColor(st == 3 ? 0x0F380F : 0xFFFFFF, -1);
            F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 68, 1, 1, 0);
            dc.setColor(txt, -1);
            F.px(dc, W[5] as String, 227, 362, 2, 1, 0);
            dc.setColor(dim, -1);
            F.px(dc, moonName(d.moon >= 0 ? d.moon : 0.5), 227, 384, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        // ---- mercury and rain water (climb on every raise)
        var ty = Math.round((G.clamp(temp, -20, 40) + 20) / 60.0 * 130 * grow).toNumber();
        dc.setColor(P[17], -1);
        dc.fillRectangle(TX - 3, 272 - ty, 6, ty + 4);
        dc.fillCircle(TX, 284, 7);
        var wh = Math.round(rain / 100.0 * (GND - 232) * grow).toNumber();
        dc.setColor(P[18], -1);
        dc.fillRectangle(RX - 10, GND - wh, 20, wh);
        // ---- cup anemometer spins with the wind (spins up on the raise), vane turns into the wind
        var ws = d.wind >= 0 ? d.wind : 2;
        var rot = tt * (0.0015 + ws * 0.0009) + (p < 1 ? (1 - p) * 6 : 0);
        dc.setColor(P[14], -1);
        dc.fillRectangle(AX - 3, 154, 6, 10);
        for (var i = 0; i < 3; i++) {
            var an = rot + i * 2 * Math.PI / 3;
            var x = Math.round(AX + Math.cos(an) * 30).toNumber();
            var z = Math.sin(an);
            var n = Math.round((x - AX).abs() / 4.0).toNumber();
            if (n < 1) {
                n = 1;
            }
            dc.setColor(P[14], -1);
            for (var j = 1; j <= n; j++) {
                dc.fillRectangle(Math.round(AX + (x - AX) * j / n.toFloat()).toNumber() - 1, 157, 3, 2);
            }
            dc.setColor(z > 0 ? P[13] : P[25], -1);
            dc.fillRectangle(x - 6, 152, 12, 10);
        }
        var wa = (d.windDeg + (live ? Math.sin(tt / 600.0) * 8 : 0)) * Math.PI / 180;
        var vx = Math.round(Math.sin(wa) * 34).toNumber();
        dc.setColor(P[14], -1);
        dc.fillRectangle(AX - vx.abs(), 206, 2 * vx.abs() + 1, 3);
        dc.setColor(P[25], -1);
        dc.fillRectangle(AX + vx - 4, 202, 8, 10);
        dc.setColor(P[13], -1);
        dc.fillRectangle(AX - vx - 6, 200, 12, 14);
        // ---- rain, snow, lightning
        if (rn > 0 || sn > 0) {
            var cnt = (rn + sn) * 10;
            var spd = sn > 0 ? 18 : 5;
            dc.setColor(sn > 0 ? P[12] : P[24], -1);
            for (var i = 0; i < cnt; i++) {
                var x = (i * 83 + tt / (spd * 3)) % 440 + 6;
                var y = (i * 47 + tt / spd) % (GND - 120) + 120;
                dc.fillRectangle(x, y, sn > 0 ? 4 : 2, sn > 0 ? 4 : 10);
            }
        }
        if (storm && live && (tt / 90) % 37 == 0) {
            dc.setColor(0xFFFFFF, -1);
            for (var i = 0; i < 6; i++) {
                dc.fillRectangle(300 - (i % 2) * 10 - i * 4, 130 + i * 14, 6, 14);
            }
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        dc.setColor(st == 3 ? 0x306230 : 0x3A3A42, -1);
        dc.fillRectangle(o[0], GND + o[1], 454, 2);
        dc.drawRectangle(TX - 6 + o[0], 136 + o[1], 12, 140);
        dc.drawRectangle(BX - 40 + o[0], 204 + o[1], 80, 60);
        dc.fillRectangle(AX - 1 + o[0], 162 + o[1], 2, GND - 162);
        dc.setColor(st == 3 ? 0x8BAC0F : 0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
        if (d.temp > -99) {
            F.px(dc, d.temp + "°", TX + o[0], 314 + o[1], 2, 1, 1);
        }
    }
}
