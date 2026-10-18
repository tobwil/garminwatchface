import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// Season — the year and the real weather for the story designs (FARM, CAMP, POST, BAKERY, OFFICE,
// LIGHT, TRAIN): the season, the special days (Advent, Christmas, New Year's Eve with fireworks, New
// Year, Easter, Halloween, Valentine's Day and your birthday) and the reported weather, plus small
// pixel decorations the scenes place at their own spots. Copied into a watch face only with
// "libs": ["season"]. Mirrors web/js/engine/season.js.
module Season {
    // special days
    const NONE = 0;
    const ADVENT = 1;
    const XMAS = 2;
    const NYE = 3;
    const NEWYEAR = 4;
    const EASTER = 5;
    const HALLOWEEN = 6;
    const VALENTINE = 7;
    const BIRTHDAY = 8;
    const BULB = [0xFF3A3A, 0xFFD23A, 0x3AE07A, 0x3AB4FF, 0xFF8AD8];
    const GREET = ["", "FROHEN ADVENT", "FROHE WEIHNACHTEN", "GUTEN RUTSCH!", "FROHES NEUES!", "FROHE OSTERN",
        "HALLOWEEN", "VALENTINSTAG", "ALLES GUTE!"];
    const DOY0 = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

    function doyOf(y as Number, mon as Number, day as Number) as Number {
        var leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
        return DOY0[mon - 1] + day + (leap && mon > 2 ? 1 : 0);
    }

    // day of the year of Easter Sunday (anonymous Gregorian algorithm)
    function easter(y as Number) as Number {
        var a = y % 19;
        var b = y / 100;
        var c = y % 100;
        var dd = b / 4;
        var e = b % 4;
        var f = (b + 8) / 25;
        var g = (b - f + 1) / 3;
        var h = (19 * a + b - dd - g + 15) % 30;
        var i = c / 4;
        var k = c % 4;
        var l = (32 + 2 * e + 2 * i - h - k) % 7;
        var m = (a + 11 * h + 22 * l) / 451;
        var mon = (h + l - 7 * m + 114) / 31;
        var day = ((h + l - 7 * m + 114) % 31) + 1;
        return doyOf(y, mon, day);
    }

    // 0 winter, 1 spring, 2 summer, 3 autumn
    function season(d as D) as Number {
        return d.mon == 12 || d.mon <= 2 ? 0 : d.mon <= 5 ? 1 : d.mon <= 8 ? 2 : 3;
    }

    // the special day
    function event(d as D) as Number {
        var md = d.mon * 100 + d.day;
        if (d.cfg.bday > 0 && d.cfg.bday == md) {
            return BIRTHDAY;
        }
        if ((md == 1231 && d.mins >= 1080) || (md == 101 && d.mins < 120)) {
            return NYE;
        }
        if (md >= 1224 && md <= 1226) {
            return XMAS;
        }
        if (md >= 1201 && md <= 1223) {
            return ADVENT;
        }
        if (md == 101) {
            return NEWYEAR;
        }
        var e = easter(d.year);
        if (d.doy >= e - 2 && d.doy <= e + 1) {
            return EASTER;
        }
        if (md == 1031) {
            return HALLOWEEN;
        }
        return md == 214 ? VALENTINE : NONE;
    }

    // reported weather: 0 clear, 1 clouds, 2 rain, 3 snow, 4 storm, 5 fog
    function wx(d as D) as Number {
        var c = d.cond;
        if (c < 0 || c == 0 || c == 23 || c == 39 || c == 22 || c == 1 || c == 51) {
            return 0;
        }
        if (c == 2 || c == 20 || c == 5) {
            return 1;
        }
        if (c == 6 || c == 12 || c == 27 || c == 31 || c == 35 || c == 40 || c == 41) {
            return 4;
        }
        if (c == 4 || c == 7 || c == 16 || c == 17 || c == 18 || c == 19 || c == 21 || c == 33 || c == 42 || c == 43
            || c == 45 || c == 46 || c == 47 || c == 50 || c == 10) {
            return 3;
        }
        if (c == 8 || c == 9 || c == 28 || c == 29 || c == 32 || c == 34 || c == 36 || c == 37 || c == 38) {
            return 5;
        }
        return 2;
    }

    // lying snow: it snows, or it is winter and freezing
    function snowy(d as D) as Boolean {
        return wx(d) == 3 || (season(d) == 0 && d.temp > -99 && d.temp <= 0);
    }

    // falling rain or snow inside a box (moving part)
    function precip(dc as Dc, d as D, x as Number, y as Number, w as Number, h as Number, t as Number) as Void {
        var k = wx(d);
        if (k != 2 && k != 3 && k != 4) {
            return;
        }
        var snow = k == 3;
        var n = Math.round(w * h / (snow ? 2600.0 : 1800.0)).toNumber();
        dc.setColor(snow ? 0xFFFFFF : 0x9AC8FF, -1);
        for (var i = 0; i < n; i++) {
            var px = x + ((i * 83 + t / (snow ? 60 : 16)) % w);
            var py = y + ((i * 47 + t / (snow ? 22 : 5)) % h);
            if (snow) {
                dc.fillRectangle(px + Math.round(Math.sin(t / 500.0 + i) * 3).toNumber(), py, 4, 4);
            } else {
                dc.fillRectangle(px, py, 2, 10);
            }
        }
        if (k == 4 && (t / 90) % 31 == 0) {
            dc.setColor(0xFFFFFF, -1);
            for (var i = 0; i < 5; i++) {
                dc.fillRectangle(x + (w * 0.7).toNumber() - (i % 2) * 10 - i * 3, y + i * 16, 5, 16);
            }
        }
    }

    // a snow cap along the top of a roof or wall
    function snowCap(dc as Dc, x as Number, y as Number, w as Number) as Void {
        dc.setColor(0xF4F8FF, -1);
        dc.fillRectangle(x, y - 6, w, 7);
        for (var i = 0; i < w; i += 14) {
            dc.fillRectangle(x + i + 2, y - 10, 9, 4);
        }
    }

    // a string of fairy lights sagging from (x0, y0) to (x1, y1), blinking (moving part)
    function lights(dc as Dc, x0 as Number, y0 as Number, x1 as Number, y1 as Number, t as Number) as Void {
        var n = Math.round((x1 - x0).abs() / 18.0).toNumber();
        if (n < 3) {
            n = 3;
        }
        dc.setColor(0x2A3A2A, -1);
        for (var i = 0; i <= n * 3; i++) {
            var f = i / (n * 3.0);
            dc.fillRectangle(Math.round(G.lerp(x0, x1, f)).toNumber(), Math.round(G.lerp(y0, y1, f) + Math.sin(f * Math.PI) * 10).toNumber(), 2, 2);
        }
        for (var i = 0; i <= n; i++) {
            var f = i / n.toFloat();
            var on = (t / 500 + i) % 3 != 0;
            dc.setColor(on ? BULB[i % 5] : G.mix(BULB[i % 5], 0, 0.6), -1);
            dc.fillRectangle(Math.round(G.lerp(x0, x1, f)).toNumber() - 3, Math.round(G.lerp(y0, y1, f) + Math.sin(f * Math.PI) * 10).toNumber() + 2, 6, 7);
        }
    }

    // a little Christmas tree standing on (x, y), size s (1, 2, ...)
    function tree(dc as Dc, x as Number, y as Number, s as Number) as Void {
        dc.setColor(0x5A3A1E, -1);
        dc.fillRectangle(x - 2 * s, y - 6 * s, 4 * s, 6 * s);
        dc.setColor(0x1E7A3A, -1);
        for (var i = 0; i < 4; i++) {
            dc.fillRectangle(x - (14 - i * 3) * s, y - (12 + i * 8) * s, (28 - i * 6) * s, 8 * s);
        }
        dc.setColor(0xFFD23A, -1);
        dc.fillRectangle(x - 3 * s, y - 50 * s, 6 * s, 6 * s);
        dc.setColor(0xFF3A3A, -1);
        dc.fillRectangle(x - 8 * s, y - 20 * s, 3 * s, 3 * s);
        dc.fillRectangle(x + 5 * s, y - 30 * s, 3 * s, 3 * s);
    }

    // a carved pumpkin standing on (x, y), size s
    function pumpkin(dc as Dc, x as Number, y as Number, s as Number) as Void {
        dc.setColor(0xF07A1A, -1);
        dc.fillRectangle(x - 10 * s, y - 14 * s, 20 * s, 14 * s);
        dc.fillRectangle(x - 12 * s, y - 11 * s, 24 * s, 8 * s);
        dc.setColor(0x3A7A2A, -1);
        dc.fillRectangle(x - s, y - 18 * s, 3 * s, 4 * s);
        dc.setColor(0xFFE05A, -1);
        dc.fillRectangle(x - 6 * s, y - 10 * s, 3 * s, 3 * s);
        dc.fillRectangle(x + 3 * s, y - 10 * s, 3 * s, 3 * s);
        dc.fillRectangle(x - 5 * s, y - 5 * s, 10 * s, 2 * s);
    }

    // three Easter eggs lying on (x, y)
    function eggs(dc as Dc, x as Number, y as Number) as Void {
        var C = [0xFF7AA8, 0x7AD8FF, 0xFFE05A];
        for (var i = 0; i < 3; i++) {
            dc.setColor(C[i], -1);
            dc.fillRectangle(x + i * 16, y - 12, 10, 12);
            dc.fillRectangle(x + i * 16 + 2, y - 14, 6, 2);
            dc.setColor(0xFFFFFF, -1);
            dc.fillRectangle(x + i * 16, y - 7, 10, 2);
        }
    }

    // a heart around (x, y), size s
    function heart(dc as Dc, x as Number, y as Number, s as Number) as Void {
        dc.setColor(0xFF3A6A, -1);
        dc.fillRectangle(x - 6 * s, y - 4 * s, 5 * s, 4 * s);
        dc.fillRectangle(x + s, y - 4 * s, 5 * s, 4 * s);
        dc.fillRectangle(x - 6 * s, y, 12 * s, 3 * s);
        dc.fillRectangle(x - 4 * s, y + 3 * s, 8 * s, 2 * s);
        dc.fillRectangle(x - 2 * s, y + 5 * s, 4 * s, 2 * s);
    }

    // birthday balloons tied at (x, y), swaying (moving part)
    function balloons(dc as Dc, x as Number, y as Number, t as Number) as Void {
        var C = [0xFF5AB4, 0x3AB4FF, 0xFFD23A];
        for (var i = 0; i < 3; i++) {
            var bx = x - 18 + i * 18 + Math.round(Math.sin(t / 600.0 + i) * 4).toNumber();
            var by = y - 64 - (i % 2) * 12;
            dc.setColor(0xD8D8D8, -1);
            dc.fillRectangle(bx, by + 12, 1, y - by - 12);
            dc.setColor(C[i], -1);
            dc.fillRectangle(bx - 8, by - 10, 16, 20);
            dc.fillRectangle(bx - 6, by - 13, 12, 26);
        }
    }

    // a few fireworks bursting in the box (moving part)
    function fireworks(dc as Dc, x as Number, y as Number, w as Number, h as Number, t as Number) as Void {
        for (var b = 0; b < 2; b++) {
            var per = 1600;
            var k = (t + b * 800) / per;
            var age = ((t + b * 800) % per) / per.toFloat();
            var cx = x + (G.rnd(k * 7 + b) % w);
            var cy = y + (G.rnd(k * 11 + b) % h);
            var R = 34 * G.ease(age);
            dc.setColor(G.mix(BULB[G.rnd(k * 13 + b) % 5], 0, age * 0.9), -1);
            for (var i = 0; i < 12; i++) {
                var an = i * 2 * Math.PI / 12;
                dc.fillRectangle(Math.round(cx + Math.cos(an) * R).toNumber(), Math.round(cy + Math.sin(an) * R + age * age * 18).toNumber(), 4, 4);
            }
        }
    }

    // a short greeting for the special day ("" for none)
    function greeting(ev as Number) as String {
        return GREET[ev];
    }
}
