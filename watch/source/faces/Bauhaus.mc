import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// BAUHAUS — a geometric poster. Circle, square, triangle and bars on paper; the big red
// disc stands at the hour, the small square at the minute ("Formen, keine Zeiger"), the
// rest of the composition is re-seeded every minute (date + time) and slides into its new
// arrangement when the minute turns. Clean geometric numerals (bars + arcs) with a paper
// halo keep the time legible. Intro: shapes fall in and settle with a spring.
// Styles: 1 Bauhaus (red/yellow/blue/black on cream), 2 Mondrian (black bars, coloured
// cells; red field = hour of the day, blue field = minute, "Boogie-Woogie" squares travel
// along the bars), 3 Memphis (pastels, squiggles, dots, hard shadows).
// Mirrors web/js/faces/bauhaus.js.
class FaceBauhaus extends Face {
    const CX = 227;
    const CY = 227;
    // numerals: digit width, height, stroke, gap, colon side gap
    const DW = 60;
    const DH = 100;
    const DT = 16;
    const DG = 14;
    const CG = 20;
    const TY = 177; // numerals top
    // palettes: 0 paper, 1 ink, 2 red, 3 yellow, 4 blue, 5 grey text, 6 extra A, 7 extra B, 8 numeral shadow
    const PAL = [
        [0xEFE6D3, 0x161616, 0xD93A26, 0xF2B630, 0x1F4E9C, 0x6E665A, 0, 0, -1],
        [0xF4F1EA, 0x141414, 0xD52B1E, 0xF5C400, 0x1D3F97, 0x5A5A5A, 0, 0, -1],
        [0xF8E4EC, 0x1A1A1A, 0xFF7A6B, 0xFFD84D, 0x7CC6F2, 0x6A5560, 0x7FD8C3, 0xB79CF2, 0xFF5C8A]
    ];
    // composition per style (1 and 3): kind and colour index per element
    // kinds: 0 disc, 1 square, 2 triangle, 3 half disc, 4 bar, 5 arc, 6 dots, 7 zigzag, 8 stripes, 9 thick half ring
    const KIND = [
        [4, 5, 2, 3, 0, 1, 0, 8],
        [6, 7, 9, 1, 0, 2, 4, 4]
    ];
    const KCOL = [
        [1, 1, 3, 4, 2, 1, 1, 1],
        [1, 1, 2, 7, 6, 3, 4, 2]
    ];
    const NE = 8;
    const RAD = 0.017453292519943295;

    hidden var _e as Array; // current layout: x, y, size, rot per element
    hidden var _p as Array; // previous minute's layout (for the transition)
    hidden var _mp as Array; // Mondrian layout: see mlayout()
    hidden var _mq as Array; // previous minute

    function initialize() {
        Face.initialize();
        _e = new [NE * 4];
        _p = new [NE * 4];
        for (var i = 0; i < NE * 4; i++) {
            _e[i] = 0.0;
            _p[i] = 0.0;
        }
        _mp = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
        _mq = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    }

    function fps() as Number {
        return 10;
    }

    // ------------------------------------------------------------ primitives (e = grow)
    hidden function rc(dc as Dc, x, y, w, h, e) as Void {
        dc.fillRectangle(x - e, y - e, w + 2 * e, h + 2 * e);
    }

    hidden function ar(dc as Dc, cx, cy, r, t, a0, a1, e) as Void {
        dc.setPenWidth(t + 2 * e);
        if (a1 - a0 >= 359) {
            dc.drawCircle(cx, cy, r);
            return;
        }
        var x = e * 57.3 / r;
        G.arcC(dc, cx, cy, r, a0 - x, a1 + x);
    }

    // thick diagonal stroke from (x1,y1) down to (x2,y2), horizontal cuts at both ends
    hidden function dg(dc as Dc, x1, y1, x2, y2, t, e) as Void {
        var dx = (x2 - x1).toFloat();
        var dy = (y2 - y1).toFloat();
        var hw = (t / 2.0 + e) * Math.sqrt(dx * dx + dy * dy) / dy;
        var k = dx * e / dy;
        dc.fillPolygon([[x1 - k - hw, y1 - e], [x1 - k + hw, y1 - e], [x2 + k + hw, y2 + e], [x2 + k - hw, y2 + e]]);
    }

    // geometric digit n at top-left (x, y), grown by e
    hidden function digit(dc as Dc, n, x, y, e) as Void {
        var w = DW;
        var h = DH;
        var t = DT;
        var cx = x + w / 2;
        var r = w / 2 - t / 2;
        if (n == 0) {
            ar(dc, cx, y + w / 2, r, t, 270, 450, e);
            ar(dc, cx, y + h - w / 2, r, t, 90, 270, e);
            rc(dc, x, y + w / 2 - 1, t, h - w + 2, e);
            rc(dc, x + w - t, y + w / 2 - 1, t, h - w + 2, e);
        } else if (n == 1) {
            var bx = x + w / 2 - t / 2 + 6;
            rc(dc, bx, y, t, h, e);
            rc(dc, bx - 20, y, 21, t, e);
        } else if (n == 2) {
            ar(dc, cx, y + w / 2, r, t, 270, 495, e);
            dg(dc, cx + r * 0.7071, y + w / 2 + r * 0.7071, x + t / 2 + 2, y + h - t + 1, t, e);
            dc.fillCircle(cx + r * 0.7071, y + w / 2 + r * 0.7071, t / 2 + e);
            rc(dc, x, y + h - t, w, t, e);
        } else if (n == 3) {
            ar(dc, x + w - 25, y + 25, 17, t, 0, 180, e);
            ar(dc, x + w - 25, y + h - 25, 17, t, 0, 180, e);
            rc(dc, x + 4, y, w - 25 - 3, t, e);
            rc(dc, x + 16, y + h / 2 - t / 2, w - 25 - 15, t, e);
            rc(dc, x + 4, y + h - t, w - 25 - 3, t, e);
        } else if (n == 4) {
            var bx = x + w - t - 2;
            rc(dc, bx, y, t, h, e);
            dg(dc, bx + t * 0.35, y, x + t / 2, y + 76, t, e);
            rc(dc, x, y + 60, w, t, e);
        } else if (n == 5) {
            rc(dc, x + 2, y, w - 2, t, e);
            rc(dc, x + 2, y, t, 56, e);
            rc(dc, x + 2, y + 40, w / 2 - 1, t, e);
            ar(dc, cx, y + 70, 22, t, 0, 225, e);
        } else if (n == 6) {
            ar(dc, cx, y + 70, 22, t, 0, 360, e);
            dg(dc, x + w * 0.72, y, x + t / 2, y + 70, t, e);
        } else if (n == 7) {
            rc(dc, x, y, w, t, e);
            dg(dc, x + w - t / 2 - 1, y + t - 1, x + w * 0.3, y + h, t, e);
        } else if (n == 8) {
            ar(dc, cx, y + 24, 16, t, 0, 360, e);
            ar(dc, cx, y + 70, 22, t, 0, 360, e);
        } else {
            ar(dc, cx, y + 30, 22, t, 0, 360, e);
            dg(dc, x + w - t / 2, y + 30, x + w * 0.28, y + h, t, e);
        }
    }

    // the whole time at (x0, y): digits + square colon
    hidden function timeW(d as D) as Number {
        var nh = (d.is24 || G.hour(d) >= 10) ? 2 : 1;
        return (nh + 2) * DW + nh * DG + 2 * CG + DT - DG;
    }

    hidden function time(dc as Dc, d as D, x0, y, e) as Void {
        var hr = d.is24 ? d.h : G.hour(d);
        var x = x0;
        if (d.is24 || hr >= 10) {
            digit(dc, hr / 10, x, y, e);
            x += DW + DG;
        }
        digit(dc, hr % 10, x, y, e);
        x += DW + CG;
        rc(dc, x, y + 24, DT, DT, e);
        rc(dc, x, y + DH - 24 - DT, DT, DT, e);
        x += DT + CG;
        digit(dc, d.m / 10, x, y, e);
        digit(dc, d.m % 10, x + DW + DG, y, e);
    }

    // thin monoline version of the numerals (stroke centrelines) for the always-on screen
    hidden function digitThin(dc as Dc, n, x, y) as Void {
        var cx = x + DW / 2;
        if (n == 0) {
            G.arcC(dc, cx, y + 30, 22, 270, 450);
            G.arcC(dc, cx, y + 70, 22, 90, 270);
            dc.drawLine(x + 8, y + 30, x + 8, y + 70);
            dc.drawLine(x + 52, y + 30, x + 52, y + 70);
        } else if (n == 1) {
            dc.drawLine(x + 36, y + 1, x + 36, y + 99);
            dc.drawLine(x + 16, y + 8, x + 36, y + 8);
        } else if (n == 2) {
            G.arcC(dc, cx, y + 30, 22, 270, 495);
            dc.drawLine(cx + 15.6, y + 45.6, x + 10, y + 92);
            dc.drawLine(x + 1, y + 92, x + 59, y + 92);
        } else if (n == 3) {
            G.arcC(dc, x + 35, y + 25, 17, 0, 180);
            G.arcC(dc, x + 35, y + 75, 17, 0, 180);
            dc.drawLine(x + 4, y + 8, x + 35, y + 8);
            dc.drawLine(x + 16, y + 50, x + 35, y + 50);
            dc.drawLine(x + 4, y + 92, x + 35, y + 92);
        } else if (n == 4) {
            dc.drawLine(x + 50, y + 1, x + 50, y + 99);
            dc.drawLine(x + 50, y + 1, x + 6, y + 68);
            dc.drawLine(x + 1, y + 68, x + 59, y + 68);
        } else if (n == 5) {
            dc.drawLine(x + 3, y + 8, x + 59, y + 8);
            dc.drawLine(x + 10, y + 8, x + 10, y + 48);
            dc.drawLine(x + 10, y + 48, cx, y + 48);
            G.arcC(dc, cx, y + 70, 22, 0, 225);
        } else if (n == 6) {
            dc.drawCircle(cx, y + 70, 22);
            dc.drawLine(x + 43, y + 1, x + 8, y + 70);
        } else if (n == 7) {
            dc.drawLine(x + 1, y + 8, x + 59, y + 8);
            dc.drawLine(x + 51, y + 8, x + 18, y + 99);
        } else if (n == 8) {
            dc.drawCircle(cx, y + 24, 16);
            dc.drawCircle(cx, y + 70, 22);
        } else {
            dc.drawCircle(cx, y + 30, 22);
            dc.drawLine(x + 52, y + 30, x + 17, y + 99);
        }
    }

    hidden function timeThin(dc as Dc, d as D, x0, y) as Void {
        var hr = d.is24 ? d.h : G.hour(d);
        var x = x0;
        if (d.is24 || hr >= 10) {
            digitThin(dc, hr / 10, x, y);
            x += DW + DG;
        }
        digitThin(dc, hr % 10, x, y);
        x += DW + CG;
        dc.fillRectangle(x + 4, y + 28, 7, 7);
        dc.fillRectangle(x + 4, y + DH - 35, 7, 7);
        x += DT + CG;
        digitThin(dc, d.m / 10, x, y);
        digitThin(dc, d.m % 10, x + DW + DG, y);
    }

    // cap height that fits txt into maxW
    hidden function fitH(txt as String, h, maxW) {
        var w = F.stW(txt, h);
        return w > maxW ? h * maxW / w : h;
    }

    // ------------------------------------------------------------ composition (styles 1, 3)
    hidden function seedOf(d as D, mins) as Number {
        return G.rnd((G.rnd(d.year * 400 + d.doy) % 1000000) + mins * 7919);
    }

    // layout for clock minute `mins` into arr (x, y, size, rot per element).
    // Two or three decorations get their own sectors of the upper arc (-80..80 deg, order
    // seeded, skipping +-35 deg around the hour disc); one sits low on the rim below the slots.
    // Hour disc and minute square follow the time.
    hidden function layout(arr as Array, st, d as D, mins) as Void {
        var s = seedOf(d, mins);
        var ha = ((mins / 60) % 12) * 30 + (mins % 60) * 0.5;
        var ma = (mins % 60) * 6;
        s = G.rnd(s);
        var off = Math.floor(G.rf(s) * 12).toNumber();
        var nS = st == 1 ? 2 : 3;
        // window around the hour disc inside the upper arc
        var hn = ha > 180 ? ha - 360 : ha;
        var wl = G.clamp(hn - 35, -80, 80);
        var wh = G.clamp(hn + 35, -80, 80);
        var sw = (160 - (wh - wl)) / nS.toFloat();
        for (var i = 0; i < NE; i++) {
            s = G.rnd(s);
            var r1 = G.rf(s);
            s = G.rnd(s);
            var r2 = G.rf(s);
            s = G.rnd(s);
            var r3 = G.rf(s);
            var ang = 0.0;
            var orb = 0.0;
            var sz = 0.0;
            var rot = 0.0;
            // sector rank of this element (-1 = not a sector decoration)
            var rk = -1;
            if (st == 1) {
                rk = i == 2 ? 0 : (i == 7 ? 1 : -1);
            } else {
                rk = i == 0 ? 0 : (i == 1 ? 1 : (i == 3 ? 2 : -1));
            }
            if (rk >= 0) {
                ang = -80 + ((rk + off) % nS) * sw + sw * 0.2 + r1 * sw * 0.6;
                if (ang >= wl) {
                    ang += wh - wl;
                }
            }
            if (st == 1) {
                if (i == 0) { ang = r1 * 360; orb = 30 + r2 * 50; sz = 470; rot = 20 + r3 * 140; }
                else if (i == 1) { orb = 0; sz = 204; rot = r1 * 360; }
                else if (i == 2) { orb = 128 + r2 * 20; sz = 58; rot = r3 * 120; }
                else if (i == 3) { ang = 150 + r1 * 60; orb = 196; sz = 54; rot = r3 * 360; }
                else if (i == 4) { ang = ha; orb = 166; sz = 72; }
                else if (i == 5) { ang = ma; orb = 192; sz = 40; rot = ma; }
                else if (i == 6) { ang = -60 + r1 * 120; orb = 174 + r2 * 14; sz = 11; }
                else { orb = 140 + r2 * 16; sz = 58; rot = r3 * 180; }
            } else {
                if (i == 0) { orb = 158 + r2 * 10; sz = 4; }
                else if (i == 1) { orb = 150 + r2 * 16; sz = 140; rot = ang + 90 + r3 * 40 - 20; }
                else if (i == 2) { ang = 145 + r1 * 70; orb = 188 + r2 * 8; sz = 32; rot = r3 * 360; }
                else if (i == 3) { orb = 132 + r2 * 16; sz = 62; rot = r3 * 90; }
                else if (i == 4) { ang = ha; orb = 166; sz = 70; }
                else if (i == 5) { ang = ma; orb = 190; sz = 40; rot = ma + 180; }
                else { ang = r1 * 360; orb = 176 + r2 * 24; sz = 30; rot = r3 * 180; }
            }
            arr[i * 4] = G.ptX(CX, orb, ang);
            arr[i * 4 + 1] = G.ptY(CY, orb, ang);
            arr[i * 4 + 2] = sz;
            arr[i * 4 + 3] = rot;
        }
    }

    // rotated polygon helpers
    hidden function poly(dc as Dc, x, y, n, r, rot) as Void {
        var pts = new [n];
        for (var k = 0; k < n; k++) {
            var a = rot + k * 360.0 / n;
            pts[k] = [G.ptX(x, r, a), G.ptY(y, r, a)];
        }
        dc.fillPolygon(pts);
    }

    hidden function bar(dc as Dc, x, y, len, w, rot) as Void {
        var c = Math.cos(rot * RAD);
        var s = Math.sin(rot * RAD);
        var lx = c * len / 2;
        var ly = s * len / 2;
        var wx = -s * w / 2;
        var wy = c * w / 2;
        dc.fillPolygon([[x - lx - wx, y - ly - wy], [x + lx - wx, y + ly - wy], [x + lx + wx, y + ly + wy], [x - lx + wx, y - ly + wy]]);
    }

    // arc in clock degrees with a0 normalised to 0..360 (the watch drops arcs far below -360)
    hidden function arcN(dc as Dc, cx, cy, r, a0, a1) as Void {
        var n = Math.floor(a0 / 360.0) * 360;
        G.arcC(dc, cx, cy, r, a0 - n, a1 - n);
    }

    // one element: kind k at (x, y), size s, rotation r; tt = ambient time (s)
    hidden function shape(dc as Dc, k, x, y, s, r, tt) as Void {
        if (k == 0) {
            dc.fillCircle(x, y, s);
        } else if (k == 1) {
            poly(dc, x, y, 4, s * 0.7071, r + 45);
        } else if (k == 2) {
            poly(dc, x, y, 3, s, r);
        } else if (k == 3) {
            var pts = new [9];
            for (var j = 0; j <= 8; j++) {
                var a = r - 90 + j * 22.5;
                pts[j] = [G.ptX(x, s, a), G.ptY(y, s, a)];
            }
            dc.fillPolygon(pts);
        } else if (k == 4) {
            bar(dc, x, y, s, s > 100 ? 5 : 10, r);
        } else if (k == 5) {
            dc.setPenWidth(4);
            arcN(dc, CX, CY, s, r, r + 150);
            dc.setPenWidth(2);
            arcN(dc, CX, CY, s - 12, r + 180, r + 250);
        } else if (k == 6) {
            for (var j = 0; j < 16; j++) {
                dc.fillRectangle(x - 26 + (j % 4) * 16, y - 26 + (j / 4) * 16, 6, 6);
            }
        } else if (k == 7) {
            dc.setPenWidth(6);
            var c = Math.cos(r * RAD);
            var sn = Math.sin(r * RAD);
            var px = 0.0;
            var py = 0.0;
            for (var j = 0; j <= 8; j++) {
                var u = -s / 2.0 + j * s / 8.0;
                var v = (j % 2 == 0 ? -9 : 9) * (0.75 + 0.25 * Math.sin(tt * 2.2 + j));
                var qx = x + c * u - sn * v;
                var qy = y + sn * u + c * v;
                if (j > 0) {
                    dc.drawLine(px, py, qx, qy);
                }
                dc.fillCircle(qx, qy, 3);
                px = qx;
                py = qy;
            }
        } else if (k == 8) {
            var c = Math.cos(r * RAD);
            var sn = Math.sin(r * RAD);
            for (var j = -1; j <= 1; j++) {
                bar(dc, x - sn * j * 13, y + c * j * 13, s, 6, r);
            }
        } else {
            dc.setPenWidth(14);
            arcN(dc, x, y, s, r, r + 180);
        }
    }

    // ------------------------------------------------------------ Mondrian (style 2)
    // MP: 0 hour bar x, 1 minute bar x, 2 top split y, 3 top split colour, 4 slot bar 1 x, 5 slot bar 2 x,
    //     6 coloured slot cell (0..2), 7 slot cell colour, 8 left band colour, 9 right band colour, 10 bottom split x, 11 unused
    hidden function mlayout(arr as Array, d as D, mins) as Void {
        var s = seedOf(d, mins);
        arr[0] = 26 + (mins % 1440) / 1440.0 * 400;
        arr[1] = 70 + (mins % 60) / 59.0 * 312;
        s = G.rnd(s);
        arr[2] = 52 + G.rf(s) * 46;
        s = G.rnd(s);
        arr[3] = 3 + Math.floor(G.rf(s) * 3).toNumber() % 3; // 3 yellow, 4 blue, 5 paper
        s = G.rnd(s);
        arr[4] = 150 + G.rf(s) * 22;
        s = G.rnd(s);
        arr[5] = 284 + G.rf(s) * 22;
        s = G.rnd(s);
        arr[6] = Math.floor(G.rf(s) * 3).toNumber() % 3;
        s = G.rnd(s);
        arr[7] = G.rf(s) < 0.6 ? 3 : 2;
        s = G.rnd(s);
        arr[8] = 2 + Math.floor(G.rf(s) * 4).toNumber() % 4; // 2 red 3 yellow 4 blue 5 paper
        s = G.rnd(s);
        arr[9] = 2 + Math.floor(G.rf(s) * 4).toNumber() % 4;
        s = G.rnd(s);
        arr[10] = G.rf(s);
        arr[11] = 0;
    }

    // Boogie-Woogie (Mondrian): small coloured squares travel along the horizontal bars
    hidden function boogie(dc as Dc, d as D, a as A, c as Array<Number>) as Void {
        var tt = a.t / 1000.0;
        var b = 10;
        for (var j = 0; j < 4; j++) {
            var yb = j < 2 ? 166 : 288;
            var sp = 18 + j * 7;
            var v = tt * sp + j * 131 + (d.wakeN % 50) * 9;
            var x = v - Math.floor(v / 474) * 474 - 10;
            dc.setColor(c[2 + (j % 3)], -1);
            dc.fillRectangle(x, yb - b / 2, b, b);
            dc.setColor(c[0], -1);
            dc.fillRectangle(x + b + 3, yb - b / 2 + 3, 4, 4);
        }
    }

    // static layer: the whole composition; only the seconds dot / the travelling squares move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var c = PAL[st - 1];
        var p = a.intro;
        var tt = a.t / 1000.0;
        // minute turn while awake: slide from the previous arrangement
        var k = 1.0;
        if (a.live && d.s == 0 && a.ms < 900 && p >= 1) {
            k = G.spring(a.ms / 900.0);
        }
        if (a.bg && k < 1) {
            a.bg = false; // the minute turn repaints everything
        }
        if (a.bg) {
            // over the cached composition: the travelling squares (Mondrian) / the seconds dot
            if (st == 2) {
                boogie(dc, d, a, c);
            } else if (a.live) {
                var sd = (d.s + a.ms / 1000.0) * 6;
                dc.setColor(st == 1 ? c[2] : c[1], -1);
                dc.fillCircle(G.ptX(CX, 214, sd), G.ptY(CY, 214, sd), 6);
            }
            return;
        }
        var paper = c[0];
        var ink = c[1];
        dc.setColor(paper, -1);
        dc.fillRectangle(0, 0, 454, 454);

        if (st == 2) {
            mondrian(dc, d, a, c, k);
        } else {
            var e = _e;
            var pp = _p;
            layout(e, st, d, d.mins);
            if (k < 1) {
                layout(pp, st, d, d.mins == 0 ? 1439 : d.mins - 1);
            }
            var ki = st == 1 ? 0 : 1;
            var kinds = KIND[ki];
            var kcol = KCOL[ki];
            for (var i = 0; i < NE; i++) {
                var kd = kinds[i];
                var x = e[i * 4];
                var y = e[i * 4 + 1];
                var sz = e[i * 4 + 2];
                var r = e[i * 4 + 3];
                if (k < 1) {
                    var r0 = pp[i * 4 + 3];
                    if (r < r0 - 180) {
                        r += 360;
                    }
                    x = G.lerp(pp[i * 4], x, k);
                    y = G.lerp(pp[i * 4 + 1], y, k);
                    r = G.lerp(r0, r, k);
                }
                // intro: fall in from above, settle with a spring
                var f = G.spring(G.stag(p, i + 1, 0.06, 0.5));
                if (f <= 0) {
                    continue;
                }
                y -= (1 - f) * 460;
                if (kd == 2 && st == 1) {
                    r += 4 * Math.sin(tt * 0.9);
                }
                if (kd == 4 && sz < 100) {
                    r += 6 * Math.sin(tt * 1.3 + i);
                }
                if (st == 3 && kd != 6 && kd != 7 && kd != 9) {
                    dc.setColor(ink, -1);
                    shape(dc, kd, x + 5, y + 5, sz, r, tt);
                }
                dc.setColor(c[kcol[i]], -1);
                shape(dc, kd, x, y, sz, r, tt);
            }
            // seconds: a small dot runs around the rim
            if (a.live && p >= 1) {
                var sd = (d.s + a.ms / 1000.0) * 6;
                dc.setColor(st == 1 ? c[2] : ink, -1);
                dc.fillCircle(G.ptX(CX, 214, sd), G.ptY(CY, 214, sd), 6);
            }
        }

        // ---- numerals: paper halo, (Memphis: hard shadow), ink
        var w = timeW(d);
        var x0 = CX - w / 2;
        var fN = G.spring(G.stag(p, 0, 0.06, 0.5));
        var ny = TY - (1 - fN) * 300;
        if (fN > 0) {
            dc.setColor(paper, -1);
            time(dc, d, x0, ny, 6);
            if (c[8] != -1) {
                dc.setColor(c[8], -1);
                time(dc, d, x0 + 6, ny + 6, 0);
            }
            dc.setColor(ink, -1);
            time(dc, d, x0, ny, 0);
        }

        // ---- date tag (top) and three slots (bottom)
        var q = G.ease(G.stag(p, 5, 0.08, 0.4));
        if (q > 0 && st != 2) {
            var ds = d.dowStr + " " + d.day + ". " + d.monStr;
            var tw = F.stW(ds, 18) + 28;
            dc.setColor(ink, -1);
            if (st == 3) {
                dc.fillRoundedRectangle(CX - tw / 2, 72, tw, 32, 16);
            } else {
                dc.fillRectangle(CX - tw / 2, 72, tw, 32);
            }
            dc.setColor(G.mix(ink, paper, q), -1);
            F.st(dc, ds, CX, 88, 18, 3, 1, 1.0, 0);
        }
        if (q > 0 && st != 2) {
            for (var j = 0; j < 3; j++) {
                var sl = d.slots[j];
                if ((sl[:lbl] as String).length() == 0) {
                    continue; // empty slot: no cell
                }
                var x = CX + (j - 1) * 106;
                if (st == 3) {
                    dc.setColor(ink, -1);
                    dc.fillRoundedRectangle(x - 47, 303, 100, 70, 10);
                    dc.setColor(paper, -1);
                    dc.fillRoundedRectangle(x - 50, 300, 100, 70, 10);
                    dc.setColor(ink, -1);
                    dc.setPenWidth(2);
                    dc.drawRoundedRectangle(x - 50, 300, 100, 70, 10);
                } else {
                    dc.setColor(ink, -1);
                    dc.fillRectangle(x - 50, 300, 100, 72);
                    dc.setColor(paper, -1);
                    dc.fillRectangle(x - 48, 302, 96, 68);
                }
                // bullet: circle / square / triangle in the primary colours
                dc.setColor(c[2 + j], -1);
                if (j == 0) {
                    dc.fillCircle(x, 313, 7);
                } else if (j == 1) {
                    dc.fillRectangle(x - 6, 307, 13, 13);
                } else {
                    poly(dc, x, 315, 3, 9, 0);
                }
                dc.setColor(G.mix(paper, ink, q), -1);
                F.st(dc, sl[:val] as String, x, 336, fitH(sl[:val] as String, 22, 86), 3, 1, 1.0, 0);
                dc.setColor(G.mix(paper, c[5], q), -1);
                F.px(dc, sl[:lbl] as String, x, 352, 2, 1, 0);
            }
        }
    }

    // style 2: Mondrian grid, bars grow in during the intro
    hidden function mondrian(dc as Dc, d as D, a as A, c, k) as Void {
        var p = a.intro;
        var tt = a.t / 1000.0;
        var mp = _mp;
        var mq = _mq;
        mlayout(mp, d, d.mins);
        if (k < 1) {
            mlayout(mq, d, d.mins == 0 ? 1439 : d.mins - 1);
        }
        var xh = k < 1 ? G.lerp(mq[0], mp[0], k) : mp[0];
        var xm = k < 1 ? G.lerp(mq[1], mp[1], k) : mp[1];
        var ys = k < 1 ? G.lerp(mq[2], mp[2], k) : mp[2];
        var xs1 = k < 1 ? G.lerp(mq[4], mp[4], k) : mp[4];
        var xs2 = k < 1 ? G.lerp(mq[5], mp[5], k) : mp[5];
        // (mp[3] etc.: colours switch at the minute)
        var b = 10; // bar thickness
        var y1 = 166;
        var y2 = 288;
        var y3 = 380;
        var cf = G.ease(G.stag(p, 3, 0.1, 0.5)); // cell colour fade-in
        // coloured cells
        dc.setColor(G.mix(c[0], c[2], cf), -1);
        dc.fillRectangle(0, 0, xh, y1); // hour field (red)
        if (mp[3] != 5) {
            dc.setColor(G.mix(c[0], c[mp[3]], cf), -1);
            if (xh < 227) {
                dc.fillRectangle(xh, 0, 454 - xh, ys);
            } else {
                dc.fillRectangle(0, 0, xh, ys);
            }
        }
        dc.setColor(G.mix(c[0], c[4], cf), -1);
        dc.fillRectangle(0, y3, xm, 454 - y3); // minute field (blue)
        if (mp[10] < 0.5) {
            dc.setColor(G.mix(c[0], c[3], cf), -1);
            dc.fillRectangle(xm, y3 + 40, 454 - xm, 454 - y3 - 40);
        }
        // one slot cell coloured (yellow or blue)
        var cs = mp[6];
        var xa = cs == 0 ? 0 : (cs == 1 ? xs1 : xs2);
        var xb = cs == 0 ? xs1 : (cs == 1 ? xs2 : 454);
        dc.setColor(G.mix(c[0], c[mp[7] == 2 ? 4 : 3], cf), -1);
        dc.fillRectangle(xa, y2, xb - xa, y3 - y2);
        if (mp[8] != 5) {
            dc.setColor(G.mix(c[0], c[mp[8]], cf), -1);
            dc.fillRectangle(0, y1, 44, y2 - y1);
        }
        if (mp[9] != 5) {
            dc.setColor(G.mix(c[0], c[mp[9]], cf), -1);
            dc.fillRectangle(410, y1, 44, y2 - y1);
        }

        // black bars, growing in
        dc.setColor(c[1], -1);
        var g0 = G.ease(G.stag(p, 0, 0.08, 0.45));
        var g1 = G.ease(G.stag(p, 1, 0.08, 0.45));
        var g2 = G.ease(G.stag(p, 2, 0.08, 0.45));
        dc.fillRectangle(0, y1 - b / 2, 454 * g0, b);
        dc.fillRectangle(454 - 454 * g0, y2 - b / 2, 454 * g0, b);
        dc.fillRectangle(0, y3 - b / 2, 454 * g1, b);
        dc.fillRectangle(xh - b / 2, y1 - y1 * g1, b, y1 * g1);
        if (xh < 227) {
            dc.fillRectangle(xh, ys - b / 2, (454 - xh) * g2, b);
        } else {
            dc.fillRectangle(xh - xh * g2, ys - b / 2, xh * g2, b);
        }
        dc.fillRectangle(xs1 - b / 2, y2, b, (y3 - y2) * g2);
        dc.fillRectangle(xs2 - b / 2, y3 - (y3 - y2) * g2, b, (y3 - y2) * g2);
        dc.fillRectangle(xm - b / 2, y3, b, (454 - y3) * g2);
        if (mp[10] < 0.5) {
            dc.fillRectangle(xm, y3 + 40 - b / 2, (454 - xm) * g2, b);
        }
        dc.fillRectangle(44 - b / 2, y1, b, (y2 - y1) * g1);
        dc.fillRectangle(410 - b / 2, y2 - (y2 - y1) * g1, b, (y2 - y1) * g1);

        // Boogie-Woogie: small coloured squares travel along the horizontal bars
        if (p >= 1 && !a.so) {
            boogie(dc, d, a, c);
        }

        // slots centred in their cells (visible part), date in the larger top cell
        var q = G.ease(G.stag(p, 5, 0.08, 0.4));
        if (q > 0) {
            for (var j = 0; j < 3; j++) {
                var sl = d.slots[j];
                var xl = j == 0 ? 28 : (j == 1 ? xs1 + b / 2 : xs2 + b / 2);
                var xr = j == 0 ? xs1 - b / 2 : (j == 1 ? xs2 - b / 2 : 426);
                var inv = j == cs && mp[7] == 2;
                var x = (xl + xr) / 2;
                dc.setColor(G.mix(c[0], inv ? 0xFFFFFF : c[1], q), -1);
                F.st(dc, sl[:val] as String, x, 326, fitH(sl[:val] as String, 22, xr - xl - 12), 3, 1, 1.0, 0);
                dc.setColor(G.mix(c[0], inv ? 0xDDE4F4 : c[5], q), -1);
                F.px(dc, sl[:lbl] as String, x, 346, 2, 1, 0);
            }
            var ds = d.dowStr + " " + d.day + ". " + d.monStr;
            var red = xh > 227;
            var xl2 = red ? 40 : xh + b / 2;
            var xr2 = red ? xh - b / 2 : 414;
            dc.setColor(red ? G.mix(c[2], c[0], q) : G.mix(c[0], c[1], q), -1);
            F.st(dc, ds, (xl2 + xr2) / 2, (ys + y1) / 2 + 4, 18, 3, 1, 1.0, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var c = PAL[st - 1];
        var ox = o[0];
        var oy = o[1];
        var ha = (d.h % 12) * 30 + d.m * 0.5;
        var ma = d.m * 6;
        dc.setPenWidth(2);
        if (st == 2) {
            dc.setColor(0x4A4A4A, -1);
            dc.drawLine(0, 166 + oy, 454, 166 + oy);
            dc.drawLine(0, 288 + oy, 454, 288 + oy);
            var xh = 26 + d.mins / 1440.0 * 400;
            dc.drawLine(xh + ox, 0, xh + ox, 166 + oy);
            dc.setColor(G.dim(c[2], 0.6), -1);
            dc.fillRectangle(xh + ox - 30, 120 + oy, 30, 6);
        } else {
            // hour disc and minute marker as outlines
            dc.setColor(G.dim(c[st == 1 ? 2 : 6], 0.7), -1);
            dc.drawCircle(G.ptX(CX + ox, 166, ha), G.ptY(CY + oy, 166, ha), 72);
            dc.setColor(G.dim(st == 1 ? 0xFFFFFF : c[3], 0.5), -1);
            dc.fillCircle(G.ptX(CX + ox, 192, ma), G.ptY(CY + oy, 192, ma), 8);
        }
        // thin numerals: grey strokes via the same geometry (outline look)
        var w = timeW(d);
        var x0 = CX - w / 2 + ox;
        dc.setColor(0xA0A0A0, -1);
        dc.setPenWidth(3);
        timeThin(dc, d, x0, TY + oy);
        dc.setColor(G.dim(c[3], 0.55), -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX + ox, 82 + oy, 2, 1, 0);
    }
}
