import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// NIXIE — glowing Nixie tubes. Four big glass tubes with stacked wire cathodes (all ten
// digits visible as a faint wire tangle), the lit digit glows with a warm halo behind the
// anode mesh. Every wrist raise runs the "cathode check": the tubes warm up and cycle
// through all digits until the time locks in, tube by tube. Two INS-1 neon lamps blink the
// seconds, small tubes show the date, three neon windows the data slots. Occasional flicker.
// Styles: 1 Klassisch (accent glow), 2 Eisblau (IN-18 domes, ice blue + LED underglow),
// 3 Dekatron (the dial is a counting tube: a glow dot runs round the 60 cathodes = seconds).
// Mirrors web/js/faces/nixie.js.
class FaceNixie extends Face {
    // Nixie digit wires in a 10 x 18 unit box. Ops of 6 numbers:
    // [0, x1, y1, x2, y2, 0] line, [1, cx, cy, r, a0, a1] arc (clock degrees, clockwise), [2, cx, cy, r, 0, 0] circle
    const GL = [
        [1, 5, 5, 5, -90, 90, 1, 5, 13, 5, 90, 270, 0, 0, 5, 0, 13, 0, 0, 10, 5, 10, 13, 0],
        [0, 5.5, 0, 5.5, 18, 0, 0, 5.5, 0, 2.5, 3, 0],
        [1, 5, 5, 5, -80, 125, 0, 9.1, 7.9, 0, 18, 0, 0, 0, 18, 10, 18, 0],
        [0, 0.5, 0, 10, 0, 0, 0, 10, 0, 3.6, 7.2, 0, 1, 5, 12.5, 5.5, -15, 240],
        [0, 7, 18, 7, 0, 0, 0, 7, 0, 0, 12.5, 0, 0, 0, 12.5, 10, 12.5, 0],
        [0, 9.5, 0, 1, 0, 0, 0, 1, 0, 1.5, 8.3, 0, 1, 5, 12.5, 5.5, -40, 240],
        [2, 5, 12.5, 5.5, 0, 0, 1, 13, 13, 13, -90, -30],
        [0, 0, 0, 10, 0, 0, 0, 10, 0, 3, 18, 0],
        [2, 5, 4.3, 4.3, 0, 0, 2, 5, 12.8, 5.2, 0, 0],
        [2, 5, 5.5, 5.5, 0, 0, 1, -3, 5, 13, 90, 150]
    ];
    // round caps for thick passes (corners / free ends), x,y pairs
    const CP = [
        [],
        [5.5, 18, 5.5, 0, 2.5, 3],
        [0.1, 4.1, 0, 18, 10, 18],
        [0.5, 0, 10, 0, 3.6, 7.2, 0.2, 15.2],
        [7, 18, 7, 0, 0, 12.5, 10, 12.5],
        [9.5, 0, 1, 0, 0.2, 15.2],
        [6.5, 1.7],
        [0, 0, 10, 0, 3, 18],
        [],
        [3.5, 16.3]
    ];
    const WD = ["SONNTAG", "MONTAG", "DIENSTAG", "MITTWOCH", "DONNERSTAG", "FREITAG", "SAMSTAG"];
    // layout per style: tube w, h, top, pair gap, colon gap, glyph h, date tube top, weekday y, slot y
    const LAY = [
        [78, 156, 140, 10, 34, 104, 70, 50, 336],
        [84, 176, 126, 10, 34, 118, 64, 44, 340],
        [64, 128, 154, 8, 30, 84, 86, 66, 316]
    ];

    hidden var _fx = 0; // ambient frame rate (set in draw)
    hidden var _pin = null; // dekatron pin coordinates, computed on first use

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return _fx;
    }

    // one digit wire set; s = px per unit, caps = round ends for thick pens
    hidden function glyph(dc as Dc, dg, cx, cy, s, pen, caps) as Void {
        var g = GL[dg] as Array;
        var ox = cx - 5 * s;
        var oy = cy - 9 * s;
        for (var i = 0; i < g.size(); i += 6) {
            var t = g[i];
            if (t == 0) {
                dc.drawLine(ox + g[i + 1] * s, oy + g[i + 2] * s, ox + g[i + 3] * s, oy + g[i + 4] * s);
            } else if (t == 1) {
                G.arcC(dc, ox + g[i + 1] * s, oy + g[i + 2] * s, g[i + 3] * s, g[i + 4], g[i + 5]);
            } else {
                dc.drawCircle(ox + g[i + 1] * s, oy + g[i + 2] * s, g[i + 3] * s);
            }
        }
        if (caps) {
            var c = CP[dg] as Array;
            for (var i = 0; i < c.size(); i += 2) {
                dc.fillCircle(ox + c[i] * s, oy + c[i + 1] * s, pen / 2.0);
            }
        }
    }

    // glowing digit: 4 passes (wide halo, halo, body, hot core)
    hidden function glow(dc as Dc, dg, cx, cy, s, cols as Array, big) as Void {
        if (cols[2] == 0 || dg < 0) {
            return;
        }
        var pens = [s * 2.7, s * 1.6, s * 0.78, (s * 0.3 > 2 ? s * 0.3 : 2)];
        for (var k = big ? 0 : 1; k < 4; k++) {
            dc.setColor(cols[k], -1);
            var pw = Math.round(pens[k]).toNumber();
            dc.setPenWidth(pw);
            glyph(dc, dg, cx, cy, s, pw, big && k < 2);
        }
    }

    // glow palette scaled by brightness b (0..1.6; > 1 = lock flash towards white)
    hidden function pal(st, acc, b) as Array {
        var c;
        if (st == 2) {
            c = [0x06182A, 0x114C78, 0x44BFF5, 0xE0F8FF];
        } else {
            c = [G.dim(acc, 0.17), G.dim(acc, 0.45), acc, G.mix(acc, 0xFFFFFF, 0.62)];
        }
        if (b > 1) {
            var w = G.clamp(b - 1, 0.0, 1.0);
            return [G.mix(c[0], c[1], w), G.mix(c[1], c[2], w), G.mix(c[2], c[3], w), G.mix(c[3], 0xFFFFFF, w)];
        }
        return [G.dim(c[0], b), G.dim(c[1], b), G.dim(c[2], b), G.dim(c[3], b)];
    }

    // width of a nixie-style string (digits as wires, everything else stroke font)
    hidden function nsW(s as String, h) {
        var u = h / 18.0;
        var w = 0.0;
        var cs = s.toCharArray();
        for (var i = 0; i < cs.size(); i++) {
            var c = cs[i].toNumber();
            w += (c >= 48 && c <= 57 ? 10 * u : F.stW(s.substring(i, i + 1) as String, h * 0.86)) + 4 * u;
        }
        return w - 4 * u;
    }

    // glowing nixie-style string centred on (cx, cy), cap height h
    hidden function nStr(dc as Dc, s as String, cx, cy, h, w, cols as Array) as Void {
        var u = h / 18.0;
        var x0 = cx - w / 2.0;
        var p2 = Math.round(u * 0.42).toNumber();
        var pens = [Math.round(u * 1.5).toNumber(), p2 > 2 ? p2 : 2];
        var cs = s.toCharArray();
        for (var k = 0; k < 2; k++) {
            dc.setColor(cols[k * 2 + 1], -1);
            dc.setPenWidth(pens[k]);
            var x = x0;
            for (var i = 0; i < cs.size(); i++) {
                var c = cs[i].toNumber();
                if (c >= 48 && c <= 57) {
                    glyph(dc, c - 48, x + 5 * u, cy, u, pens[k], false);
                    x += 14 * u;
                } else {
                    x += F.st(dc, s.substring(i, i + 1) as String, x, cy, h * 0.86, pens[k], 0, 1.0, 0) + 4 * u;
                }
            }
        }
    }

    // anode mesh in front of the digits: diamond grid, lines clipped analytically to the box
    hidden function mesh(dc as Dc, x1, y1, x2, y2, col) as Void {
        dc.setColor(col, -1);
        dc.setPenWidth(1);
        for (var m = Math.floor(x1 - y2).toNumber() + 5; m < x2 - y1; m += 11) {
            var a = x1 - m > y1 ? x1 - m : y1;
            var b = x2 - m < y2 ? x2 - m : y2;
            dc.drawLine(a + m, a, b + m, b);
        }
        for (var n = Math.floor(x1 + y1).toNumber() + 5; n < x2 + y2; n += 11) {
            var a = n - x2 > y1 ? n - x2 : y1;
            var b = n - x1 < y2 ? n - x1 : y2;
            dc.drawLine(n - a, a, n - b, b);
        }
    }

    // glass envelope of a tube (outline, highlights, tip); dome = IN-18 rounded top
    hidden function glass(dc as Dc, x, y, w, h, st, cg, ch) as Void {
        var r = st == 2 ? w / 2.0 : w * 0.3;
        dc.setColor(cg, -1);
        dc.setPenWidth(2);
        dc.drawRoundedRectangle(x, y, w, h, r);
        dc.fillRoundedRectangle(x + w / 2.0 - 4, y - 6, 8, 9, 3);
        dc.setColor(ch, -1);
        dc.drawLine(x + 7, y + r + 4, x + 7, y + h - 26);
        dc.setPenWidth(1);
        dc.drawLine(x + w - 7, y + r + 10, x + w - 7, y + h * 0.55);
        G.arcC(dc, x + w / 2.0, y + r + 2, r - 7, 300, 340);
    }

    hidden function hm12(d as D) as Number {
        return d.is24 ? d.h : (d.h % 12 == 0 ? 12 : d.h % 12);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var L = LAY[st - 1] as Array;
        var tw = L[0];
        var th = L[1];
        var ty = L[2];
        var gp = L[3];
        var cgp = L[4];
        var gh = L[5];
        var p = a.intro;
        var live = a.live;
        var t = a.t;
        var acc = d.accent;
        var seed = d.wakeN * 7 + 3;
        _fx = live ? (p < 1 ? 20 : (st == 3 ? 15 : 10)) : 0;

        // palette
        var cGlass = st == 2 ? 0x2B3A46 : 0x2E3133;
        var cHi = st == 2 ? 0x6C8798 : 0x5D6266;
        var cGhost = st == 2 ? 0x2F3A42 : 0x352F2A;
        var cMesh = st == 2 ? 0x121B22 : 0x1C1815;
        var cLbl = st == 2 ? 0x6F8696 : 0x8C7A68;

        var P1 = pal(st, acc, 1);
        // warm-up (first 30 % of the intro)
        var warm = G.ease(G.clamp((p - 0.04) / 0.3, 0.0, 1.0));

        // ---- dekatron ring (style 3): 60 cathode pins, a glow dot runs round = seconds
        if (st == 3) {
            // glass rim: reflections only (full circles are expensive on the watch)
            dc.setColor(0x34383B, -1);
            dc.setPenWidth(1);
            G.arcC(dc, 227, 227, 219, 290, 350);
            G.arcC(dc, 227, 227, 219, 110, 170);
            G.arcC(dc, 227, 227, 193, 300, 340);
            // seconds index 0..50 outside the time area
            dc.setColor(0x4A4440, -1);
            for (var i = 0; i < 6; i++) {
                var lb = "" + i * 10;
                F.px(dc, lb, G.ptX(227, 180, i * 60), G.ptY(227, 180, i * 60) - 7, 2, 1, 0);
            }
            if (_pin == null) {
                var pn = new [240];
                for (var i = 0; i < 60; i++) {
                    var r1 = i % 5 == 0 ? 199 : 202;
                    pn[i * 4] = G.ptX(227, r1, i * 6);
                    pn[i * 4 + 1] = G.ptY(227, r1, i * 6);
                    pn[i * 4 + 2] = G.ptX(227, 210, i * 6);
                    pn[i * 4 + 3] = G.ptY(227, 210, i * 6);
                }
                _pin = pn;
            }
            var pin = _pin as Array;
            dc.setPenWidth(3);
            for (var i = 0; i < 60; i++) {
                dc.setColor(i % 5 == 0 ? 0x5A5550 : 0x3A3633, -1);
                dc.drawLine(pin[i * 4], pin[i * 4 + 1], pin[i * 4 + 2], pin[i * 4 + 3]);
            }
            // glow position: jumps pin to pin, gliding over the guide cathodes in the first 160 ms
            var sec = d.s;
            var pos = sec.toFloat();
            if (live && p >= 1) {
                pos = sec - 1 + G.easeInOut(G.clamp(a.ms / 160.0, 0.0, 1.0));
            }
            if (p < 1) {
                pos = sec - 40 * (1 - G.ease(p)); // intro: the glow spins in
            }
            var cd = pal(3, acc, warm);
            for (var k = 3; k >= 1; k--) {
                var ang = (pos - k * 0.7) * 6;
                dc.setColor(G.dim(cd[1], 0.9 - k * 0.22), -1);
                dc.fillCircle(G.ptX(227, 205, ang), G.ptY(227, 205, ang), 6 - k);
            }
            var ang = pos * 6;
            var gx = G.ptX(227, 205, ang);
            var gy = G.ptY(227, 205, ang);
            dc.setColor(cd[0], -1);
            dc.fillCircle(gx, gy, 14);
            dc.setColor(cd[1], -1);
            dc.fillCircle(gx, gy, 9);
            dc.setColor(cd[2], -1);
            dc.fillCircle(gx, gy, 5);
            dc.setColor(cd[3], -1);
            dc.fillCircle(gx, gy, 2.5);
        }

        // ---- base rail behind the sockets
        var by = ty + th - 12;
        var tot = 4 * tw + 2 * gp + cgp;
        var x0 = 227 - tot / 2.0;
        dc.setColor(st == 2 ? 0x15191D : 0x15110E, -1);
        dc.fillRoundedRectangle(x0 - 10, by + 4, tot + 20, 16, 6);
        dc.setColor(st == 2 ? 0x46525C : 0x4A3A2C, -1);
        dc.setPenWidth(1);
        dc.drawLine(x0 - 4, by + 5, x0 + tot + 4, by + 5);
        if (st == 2) {
            // blue LED underglow
            for (var i = 0; i < 4; i++) {
                var tx = x0 + i * tw + (i > 0 ? gp : 0) + (i > 1 ? cgp : 0) + (i > 2 ? gp : 0);
                dc.setColor(G.dim(0x0F3A60, warm), -1);
                dc.fillEllipse(tx + tw / 2.0, by - 5, tw * 0.4, 13);
            }
        }

        // ---- big tubes: HH MM
        var hh = hm12(d);
        // 12 h mode: the first tube stays dark before 10 o'clock (no leading zero)
        var dig = [(!d.is24 && hh < 10) ? -1 : hh / 10, hh % 10, d.m / 10, d.m % 10];
        var s = gh / 18.0;
        for (var i = 0; i < 4; i++) {
            var tx = x0 + i * tw + (i > 0 ? gp : 0) + (i > 1 ? cgp : 0) + (i > 2 ? gp : 0);
            var cx = tx + tw / 2.0;
            var cy = ty + th / 2.0 - 4;
            // brightness: warm-up, lock flash, ambient flicker
            var lockAt = 0.4 + 0.13 * i;
            var b = warm;
            var dg = dig[i];
            if (p < lockAt) {
                dg = (t / 55 + i * 3 + seed) % 10;
                // ignition: uneven, flickering strike
                b = warm * (0.55 + 0.3 * G.rf(G.rnd((t / 40) * 3 + i + seed)));
            } else if (p < lockAt + 0.16) {
                b = 1 + 0.6 * (1 - (p - lockAt) / 0.16);
            }
            if (live && p >= 1) {
                var k = Math.floor(t / 2300.0 + i * 0.41).toNumber();
                var r = G.rf(G.rnd(k * 31 + i * 7 + seed));
                var ph = t - (k - i * 0.41) * 2300;
                if (r < 0.3 && ph < 200) {
                    b = 0.55 + 0.45 * G.rf(G.rnd(t / 45 + i));
                } else {
                    b = 1;
                }
            }
            var cols = b == 1 ? P1 : pal(st, acc, b);
            // glass glow fill
            if (dg >= 0) {
                dc.setColor(G.dim(cols[0], 0.7), -1);
                dc.fillEllipse(cx, cy, tw * 0.4, th * 0.36);
            }
            // the unlit cathode stack (wire tangle)
            dc.setPenWidth(1);
            for (var q = 0; q < 4; q++) {
                var z = (q * 7 + 3) % 10;
                if (z == dg) {
                    continue;
                }
                dc.setColor(q % 2 == 0 ? cGhost : G.dim(cGhost, 0.72), -1);
                glyph(dc, z, cx + (q % 3 - 1) * 0.6, cy, s, 1, false);
            }
            glow(dc, dg, cx, cy, s, cols, true);
            // anode mesh in front (diamond grid, clipped to the tube)
            mesh(dc, tx + 5, ty + (st == 2 ? 20 : 10), tx + tw - 5, by - 12, cMesh);
            // supports + mica
            dc.setColor(0x3C3A38, -1);
            dc.drawLine(tx + 10, by - 12, tx + tw - 10, by - 12);
            glass(dc, tx, ty, tw, th, st, cGlass, cHi);
            // socket
            dc.setColor(st == 2 ? 0x2A2F34 : 0x1B1714, -1);
            dc.fillRoundedRectangle(tx - 3, by - 6, tw + 6, 16, 4);
            dc.setColor(st == 2 ? 0x8A96A0 : 0x6B5440, -1);
            dc.drawLine(tx, by - 5, tx + tw, by - 5);
        }

        // ---- INS-1 colon lamps: blink with the seconds
        var on = (!live || p < 1) ? p > 0.5 : a.ms < 500;
        var cc = on ? P1 : pal(st, acc, 0.18);
        for (var k = 0; k < 2; k++) {
            var ly = ty + th * (k == 0 ? 0.36 : 0.62);
            dc.setColor(cGlass, -1);
            dc.setPenWidth(1);
            dc.drawRoundedRectangle(222, ly - 10, 10, 20, 5);
            dc.setColor(cc[0], -1);
            dc.fillCircle(227, ly, 9);
            dc.setColor(cc[1], -1);
            dc.fillCircle(227, ly, 5);
            dc.setColor(cc[3], -1);
            dc.fillCircle(227, ly, 2.5);
        }

        // ---- weekday + small date tubes (DD.MM)
        var dp = G.ease(G.clamp((p - 0.25) / 0.5, 0.0, 1.0));
        dc.setColor(G.dim(cLbl, dp), -1);
        F.px(dc, WD[d.dow], 227, L[7], 2, 1, 0);
        var sw = 30;
        var sh = 50;
        var sy = L[6];
        var dd = [d.day / 10, d.day % 10, d.mon / 10, d.mon % 10];
        var ss = 30 / 18.0;
        for (var i = 0; i < 4; i++) {
            var tx = 227 - 2 * sw - 9 - 3 + i * (sw + 6) + (i > 1 ? 12 : 0);
            var cx = tx + sw / 2.0;
            var cy = sy + sh / 2.0 - 1;
            var lockAt = 0.5 + 0.08 * i;
            var dg = dd[i];
            var b = dp;
            if (p < lockAt) {
                dg = (t / 60 + i * 5 + seed) % 10;
                b = dp * 0.8;
            }
            var cols = b == 1 ? P1 : pal(st, acc, b);
            dc.setColor(G.dim(cols[0], 0.8), -1);
            dc.fillEllipse(cx, cy, sw * 0.4, sh * 0.36);
            glow(dc, dg, cx, cy, ss, cols, false);
            if (i == 1) {
                // decimal point cathode
                dc.setColor(cols[1], -1);
                dc.fillCircle(tx + sw + 3, cy + 15, 4);
                dc.setColor(cols[3], -1);
                dc.fillCircle(tx + sw + 3, cy + 15, 1.5);
            }
            dc.setColor(cGlass, -1);
            dc.setPenWidth(1);
            dc.drawRoundedRectangle(tx, sy, sw, sh, st == 2 ? 15 : 9);
            dc.setColor(cHi, -1);
            dc.drawLine(tx + 4, sy + 10, tx + 4, sy + sh - 10);
        }

        // ---- data slots: neon windows
        var y0 = L[8];
        for (var k = 0; k < 3; k++) {
            var sl = d.slots[k];
            if ((sl[:lbl] as String).length() == 0) {
                continue;
            }
            var sp = G.stag(p, k, 0.1, 0.4);
            if (sp <= 0) {
                continue;
            }
            var cx = 227 + (k - 1) * (st == 3 ? 92 : 104);
            var ww = st == 3 ? 80 : 88;
            var cols = sp == 1 ? P1 : pal(st, acc, sp);
            dc.setColor(G.dim(cols[0], 0.9), -1);
            dc.fillRoundedRectangle(cx - ww / 2 + 3, y0 + 3, ww - 6, 28, 12);
            dc.setColor(cGlass, -1);
            dc.setPenWidth(1);
            dc.drawRoundedRectangle(cx - ww / 2, y0, ww, 34, 14);
            var val = sl[:val] as String;
            var hgt = 18.0;
            var w = nsW(val, hgt);
            if (w > ww - 16) {
                hgt = hgt * (ww - 16) / w;
                w = ww - 16;
            }
            nStr(dc, val, cx, y0 + 17, hgt, w, cols);
            dc.setColor(G.dim(cLbl, sp), -1);
            F.px(dc, sl[:lbl] as String, cx, y0 + 42, 2, 1, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var L = LAY[st - 1] as Array;
        var tw = L[0];
        var th = L[1];
        var ty = L[2] + o[1];
        var gp = L[3];
        var cgp = L[4];
        var s = L[5] / 18.0;
        var tot = 4 * tw + 2 * gp + cgp;
        var x0 = 227 - tot / 2.0 + o[0];
        var core = st == 2 ? 0x2F86B8 : G.dim(d.accent, 0.62);
        var halo = st == 2 ? 0x082236 : G.dim(d.accent, 0.16);
        var hh = hm12(d);
        var dig = [(!d.is24 && hh < 10) ? -1 : hh / 10, hh % 10, d.m / 10, d.m % 10];
        for (var i = 0; i < 4; i++) {
            var tx = x0 + i * tw + (i > 0 ? gp : 0) + (i > 1 ? cgp : 0) + (i > 2 ? gp : 0);
            var cx = tx + tw / 2.0;
            var cy = ty + th / 2.0 - 4;
            dc.setColor(0x1C1E20, -1);
            dc.setPenWidth(1);
            dc.drawRoundedRectangle(tx, ty, tw, th, st == 2 ? tw / 2.0 : tw * 0.3);
            if (dig[i] < 0) {
                continue;
            }
            dc.setColor(halo, -1);
            dc.setPenWidth(Math.round(s * 1.1).toNumber());
            glyph(dc, dig[i], cx, cy, s, 0, false);
            dc.setColor(core, -1);
            dc.setPenWidth(2);
            glyph(dc, dig[i], cx, cy, s, 0, false);
        }
        dc.setColor(G.dim(core, 0.7), -1);
        dc.fillCircle(227 + o[0], ty + th * 0.36, 2);
        dc.fillCircle(227 + o[0], ty + th * 0.62, 2);
        dc.setColor(0x5A5048, -1);
        F.px(dc, d.dowStr + " " + d.day + "." + d.mon + ".", 227 + o[0], L[6] + 18 + o[1], 2, 1, 0);
    }
}
