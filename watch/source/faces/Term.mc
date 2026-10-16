import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// TERM — "Terminal": a green phosphor CRT shell session. Big glowing pixel time,
// below a typed session (date, body, hr, slots) and a blinking block cursor.
// Styles: 1 Phosphor (accent), 2 Amber, 3 Matrix (code rain). Mirrors web/js/faces/term.js.
class FaceTerm extends Face {
    const DOWS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const MONS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    // code-rain glyphs: 10 katakana-like signs, 4 rects each [x, y, w, h] in a 10x14 cell
    // (much cheaper than the dot-matrix font, which would trip the watchdog)
    const RG = [0,0,10,2, 7,2,2,5, 3,7,2,7, 0,0,0,0,  0,3,10,2, 4,0,2,14, 0,0,0,0, 0,0,0,0,  0,0,10,2, 1,6,8,2, 0,12,10,2, 0,0,0,0,  2,0,2,14, 6,0,2,9, 8,9,2,5, 0,0,0,0,  0,0,2,8, 0,6,10,2, 8,0,2,14, 0,0,0,0,  0,1,10,2, 8,3,2,6, 4,9,2,5, 0,0,0,0,  4,0,2,14, 0,5,10,2, 0,10,3,2, 7,10,3,2,  0,0,10,2, 0,0,2,14, 0,12,10,2, 0,0,0,0,  0,2,2,3, 4,3,2,3, 8,3,2,7, 3,12,6,2,  2,0,6,2, 2,0,2,8, 2,6,6,2, 6,6,2,8];
    const PROMPT = "fr970:~$ ";
    const NCH = 22; // session width in characters
    const LY = 152; // first session line (top)
    const LP = 21; // line pitch

    hidden var _busy = true;
    hidden var _rain = false;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return _busy ? 20 : (_rain ? 12 : 4);
    }

    // lower-case incl. umlauts (identical on the web)
    hidden function lc(s as String) as String {
        var cs = s.toCharArray();
        var o = "";
        for (var i = 0; i < cs.size(); i++) {
            var c = cs[i].toNumber();
            if ((c >= 65 && c <= 90) || c == 196 || c == 214 || c == 220) {
                c += 32;
            }
            o += c.toChar();
        }
        return o;
    }

    // half chord of the display circle (minus a margin) for a text row y..y+h
    hidden function chord(y, h) {
        var r = 213;
        var dy = (y - 227).abs();
        var dy2 = (y + h - 227).abs();
        if (dy2 > dy) {
            dy = dy2;
        }
        return dy >= r ? 0.0 : Math.sqrt(r * r - dy * dy);
    }

    hidden function nv(v, suf as String) as String {
        return v < 0 ? "--" : v + suf;
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = 3;
        var fg = st == 2 ? 0xFFB000 : (st == 3 ? 0x3BFF6A : d.accent);
        var live = a.live;
        var ms = live ? a.t : 99999;
        _rain = st == 3;

        // ---- matrix rain (behind everything)
        if (st == 3) {
            for (var c = 0; c < 15; c++) {
                var sd = G.rnd(c * 7919 + 13);
                var x = 24 + c * 28 + (sd % 9);
                sd = G.rnd(sd);
                var v = 70 + (sd % 90); // px/s
                sd = G.rnd(sd);
                var span = 454 + 10 * 16;
                var head = (ms * v / 1000 + (sd % span)) % span;
                var hy = (head / 16) * 16;
                for (var j = 0; j < 10; j++) {
                    var yy = hy - j * 16;
                    if (yy < 0 || yy > 440) {
                        continue;
                    }
                    var hc = chord(yy, 14);
                    if (x < 227 - hc || x + 10 > 227 + hc) {
                        continue;
                    }
                    var ci = ((c * 31 + (yy / 16) * 7 + (ms / 220) * (j == 0 ? 3 : 0)) % 10) * 16;
                    // fainter where it runs behind the session text
                    var f = (yy > LY - 16 && yy < LY + 11 * LP && x > 80 && x < 374) ? 0.55 : 1.0;
                    dc.setColor(G.dim(j == 0 ? 0x2A9A4C : 0x17682F, f * (1 - j / 10.0)), -1);
                    for (var q = ci; q < ci + 16; q += 4) {
                        if (RG[q + 2] > 0) {
                            dc.fillRectangle(x + RG[q], yy + RG[q + 1], RG[q + 2], RG[q + 3]);
                        }
                    }
                }
            }
        }

        // ---- big time with phosphor glow + scanlines
        var ts = G.timeStr(d);
        var tn = G.clamp(ms / 70, 0, ts.length());
        var tw = F.pxW(ts, 9);
        var tx = 227 - tw / 2.0;
        var ty = 66;
        if (tn > 0) {
            var sub = ts.substring(0, tn) as String;
            dc.setColor(G.dim(fg, 0.2), -1);
            F.px(dc, sub, tx - 2, ty, 9, 0, 0);
            F.px(dc, sub, tx + 2, ty, 9, 0, 0);
            F.px(dc, sub, tx, ty - 2, 9, 0, 0);
            F.px(dc, sub, tx, ty + 2, 9, 0, 0);
            dc.setColor(fg, -1);
            F.px(dc, sub, tx, ty, 9, 0, 0);
        }
        if (tn < ts.length()) {
            dc.setColor(fg, -1);
            dc.fillRectangle(tx + tn * 54, ty, 45, 63);
        }
        dc.setColor(0x000000, -1);
        for (var yy = ty + 2; yy < ty + 63; yy += 3) {
            dc.fillRectangle(tx - 3, yy, tw + 6, 1);
        }
        if (tn < ts.length()) {
            _busy = true;
            return;
        }

        // ---- session lines
        var body = "battery " + nv(d.bb, "%") + "  stress " + nv(d.stress, "");
        var hr = nv(d.hr, " bpm") + " (ruhe " + nv(d.rhr, "") + ")";
        var lines = [
            "date", DOWS[d.dow] + " " + d.day + ". " + MONS[d.mon - 1] + " " + d.year,
            "cat /body/*", body,
            "hr", hr,
            "./slots", "", "", ""
        ];
        for (var k = 0; k < 3; k++) {
            var sl = d.slots[k];
            var l = lc(sl[:lbl] as String);
            var v = lc(sl[:val] as String);
            var dots = " ";
            for (var i = l.length() + v.length() + 2; i < NCH; i++) {
                dots += ".";
            }
            lines[7 + k] = l + dots + " " + v;
        }
        var nl = lines.size();
        var isP = [true, false, true, false, true, false, true, false, false, false];
        var x0 = 227 - (NCH * 12 - 2) / 2.0;
        var pw = F.pxW(PROMPT, 2) + 2;
        var dim = G.dim(fg, 0.5);
        var out = G.dim(fg, 0.82);
        var tc = 420; // typing clock
        var cx = -1;
        var cy = -1;
        for (var i = 0; i <= nl; i++) {
            var y = LY + i * LP;
            var hc = chord(y, 14);
            var lx = 227 - hc;
            if (x0 > lx) {
                lx = x0;
            }
            var maxc = Math.floor((227 + hc - lx + 2) / 12.0).toNumber();
            if (i == nl || isP[i]) {
                if (ms < tc) {
                    break;
                }
                dc.setColor(dim, -1);
                F.px(dc, PROMPT, lx, y, 2, 0, 0);
                if (i == nl) {
                    cx = lx + pw;
                    cy = y;
                    break;
                }
                var s = lines[i] as String;
                var n = (ms - tc) / 30;
                tc += s.length() * 30 + 120;
                if (n < s.length()) {
                    s = s.substring(0, n) as String;
                    cx = lx + pw + n * 12;
                    cy = y;
                }
                dc.setColor(fg, -1);
                F.px(dc, s, lx + pw, y, 2, 0, 0);
                if (cy >= 0) {
                    break;
                }
            } else {
                if (ms < tc) {
                    break;
                }
                tc += 50;
                var s = lines[i] as String;
                if (s.length() > maxc) {
                    s = s.substring(0, maxc) as String;
                }
                dc.setColor(out, -1);
                F.px(dc, s, lx, y, 2, 0, 0);
            }
        }
        _busy = ms < tc + 60;
        // block cursor (blinks when idle)
        if (cy >= 0 && (_busy || !live || (a.t / 500) % 2 == 0)) {
            dc.setColor(fg, -1);
            dc.fillRectangle(cx, cy - 1, 10, 16);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var fg = st == 2 ? 0xFFB000 : (st == 3 ? 0x3BFF6A : d.accent);
        var ts = G.timeStr(d);
        dc.setColor(G.dim(fg, 0.5), -1);
        F.px(dc, ts, 227 + o[0], 150 + o[1], 8, 1, 1);
        dc.setColor(G.dim(fg, 0.35), -1);
        var w = F.pxW(PROMPT, 2);
        var x = 227 - (w + 12) / 2.0 + o[0];
        F.px(dc, PROMPT, x, 240 + o[1], 2, 0, 0);
        dc.fillRectangle(x + w + 2, 239 + o[1], 10, 16);
    }
}
