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
    // rain trail colours (head, then fading)
    const RC = [0x2A9A4C, 0x145D2A, 0x125325, 0x104820, 0x0D3E1C, 0x0B3417, 0x092912, 0x061F0E, 0x041409, 0x020A04];
    const PROMPT = "fr970:~$ ";
    // commands typed at the prompt on each wrist raise
    const CMDS = ["uptime", "cat /schlaf", "ls ~/ziele", "top -b -n1", "ping coach", "./motivation", "sudo laufen", "git push --force"];
    const NCH = 22; // session width in characters
    const LY = 152; // first session line (top)
    const LP = 21; // line pitch

    hidden var _busy = true;
    hidden var _rain = false;
    hidden var _cKey = -1;
    hidden var _cLines = null;
    // RUNS[bits * 6 + 2r] = first column, [+1] = length of the r-th run of lit dots in a 5-bit row
    hidden var _runs as Array<Number>;

    function initialize() {
        Face.initialize();
        _runs = new [192] as Array<Number>;
        for (var b = 0; b < 32; b++) {
            var r = 0;
            var c = 0;
            for (var i = 0; i < 6; i++) {
                _runs[b * 6 + i] = 0;
            }
            while (c < 5) {
                if ((b & (16 >> c)) != 0) {
                    var s0 = c;
                    while (c < 5 && (b & (16 >> c)) != 0) {
                        c++;
                    }
                    _runs[b * 6 + r * 2] = s0;
                    _runs[b * 6 + r * 2 + 1] = c - s0;
                    r++;
                } else {
                    c++;
                }
            }
        }
    }

    // Dot-matrix text, left aligned, pixel-identical to F.px for gap <= 0, but drawn as
    // horizontal runs merged over identical rows (~4x fewer draw calls: the session has
    // ~200 characters and F.px alone would come close to the watchdog limit).
    hidden function pxt(dc as Dc, txt as String, x, y, sc, g) as Void {
        var ox = Math.round(x).toNumber();
        var d = sc - g;
        var cs = txt.toCharArray();
        var map = FontData.PX_MAP;
        var data = FontData.PX_DATA;
        var runs = _runs;
        for (var k = 0; k < cs.size(); k++) {
            var code = cs[k].toNumber();
            var gi = (code > 255 || code == 32) ? -1 : map[code] - 1;
            if (gi >= 0) {
                var g7 = gi * 7;
                for (var row = 0; row < 7; row++) {
                    var bits = data[g7 + row];
                    if (bits == 0) {
                        continue;
                    }
                    var h = 1;
                    while (row + h < 7 && data[g7 + row + h] == bits) {
                        h++;
                    }
                    var hh = (h - 1) * sc + d;
                    var q0 = bits * 6;
                    for (var q = q0; q < q0 + 6; q += 2) {
                        var n = runs[q + 1];
                        if (n == 0) {
                            break;
                        }
                        dc.fillRectangle(ox + runs[q] * sc, y + row * sc, (n - 1) * sc + d, hh);
                    }
                    row += h - 1;
                }
            }
            ox += 6 * sc;
        }
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

    // matrix rain columns (style 3); skipTime keeps them off the big time (drawn over a cached layer)
    hidden function rain(dc as Dc, ms, skipTime as Boolean) as Void {
        for (var c = 0; c < 24; c++) {
            var sd = G.rnd(c * 7919 + 13);
            var x = 24 + (c % 15) * 28 + (sd % 9);
            sd = G.rnd(sd);
            var v = 70 + (sd % 90); // px/s
            sd = G.rnd(sd);
            var span = 454 + 10 * 16;
            var head = (ms * v / 1000 + (sd % span)) % span;
            var hy = (head / 16) * 16;
            for (var j = 0; j < 10; j++) {
                var yy = hy - j * 16;
                // inside the circle, and never behind the session text (legibility + watchdog budget)
                var dx = x + 5 - 227;
                var dy = yy + 7 - 227;
                if (dx * dx + dy * dy > 42000) {
                    continue;
                }
                if (yy > LY - 16 && yy < LY + 11 * LP && x > 84 && x < 370) {
                    continue;
                }
                // over the cached layer it also keeps clear of the big time
                if (skipTime && yy > 44 && yy < 136 && x > 70 && x < 384) {
                    continue;
                }
                var ci = ((c * 31 + (yy / 16) * 7 + (ms / 220) * (j == 0 ? 3 : 0)) % 10) * 16;
                dc.setColor(RC[j], -1);
                for (var q = ci; q < ci + 16; q += 4) {
                    if (RG[q + 2] > 0) {
                        dc.fillRectangle(x + RG[q], yy + RG[q + 1], RG[q + 2], RG[q + 3]);
                    }
                }
            }
        }
    }

    // static layer: the finished session; every wrist raise types a new command at the prompt
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    hidden function moving(dc as Dc, d as D, a as A, st, fg) as Void {
        var ms = a.live ? a.t : 99999;
        if (st == 3) {
            rain(dc, ms, true);
        }
        var y = LY + 10 * LP;
        var lx = 227 - (NCH * 12 - 2) / 2.0;
        var c2 = 227 - chord(y, 14);
        if (c2 > lx) {
            lx = c2;
        }
        var cx = lx + F.pxW(PROMPT, 2) + 2;
        var cmd = CMDS[d.wakeN % CMDS.size()] as String;
        var n = G.clamp((ms - 600) / 70, 0, cmd.length());
        dc.setColor(fg, -1);
        if (n > 0) {
            pxt(dc, cmd.substring(0, n), cx, y, 2, 0);
        }
        _busy = n < cmd.length();
        if (_busy || !a.live || (a.t / 500) % 2 == 0) {
            dc.fillRectangle(cx + n * 12, y - 1, 10, 16);
        }
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var fg = st == 2 ? 0xFFB000 : (st == 3 ? 0x3BFF6A : d.accent);
        var live = a.live;
        var ms = live ? a.t : 99999;
        _rain = st == 3;
        if (a.bg) {
            moving(dc, d, a, st, fg);
            return;
        }

        // ---- matrix rain (behind everything)
        if (st == 3 && !a.so) {
            rain(dc, ms, false);
        }

        // ---- big time with phosphor glow + scanlines
        var ts = G.timeStr(d);
        var tn = G.clamp(ms / 70, 0, ts.length());
        var tw = F.pxW(ts, 9);
        var tx0 = 227 - tw / 2.0;
        var ty = 66;
        if (tn > 0) {
            var sub = ts.substring(0, tn) as String;
            // glow: one pass with oversized dots (negative gap) = 2 px halo around every dot
            dc.setColor(G.dim(fg, 0.2), -1);
            pxt(dc, sub, tx0 - 2, ty - 2, 9, -4);
            dc.setColor(fg, -1);
            pxt(dc, sub, tx0, ty, 9, 0);
        }
        if (tn < ts.length()) {
            dc.setColor(fg, -1);
            dc.fillRectangle(tx0 + tn * 54, ty, 45, 63);
        }
        dc.setColor(0x000000, -1);
        for (var yy = ty + 2; yy < ty + 63; yy += 3) {
            dc.fillRectangle(tx0 - 3, yy, tw + 6, 1);
        }
        if (tn < ts.length()) {
            _busy = true;
            return;
        }

        // ---- session lines
        // strings only change with the data (refreshed once a minute): build them once per snapshot
        if (_cKey != d.unix || _cLines == null) {
            _cKey = d.unix;
            var body = "battery " + nv(d.bb, "%") + "  stress " + nv(d.stress, "");
            var hr = nv(d.hr, " bpm") + " (ruhe " + nv(d.rhr, "") + ")";
            var cl = [
                "date", DOWS[d.dow] + " " + d.day + ". " + MONS[d.mon - 1] + " " + d.year,
                "cat /body/*", body,
                "hr", hr,
                "./slots", "", "", ""
            ];
            for (var k = 0; k < 3; k++) {
                var sl = d.slots[k];
                if ((sl[:lbl] as String).length() == 0) {
                    continue; // empty slot: blank line
                }
                var l = lc(sl[:lbl] as String);
                var v = lc(sl[:val] as String);
                var dots = " ";
                for (var i = l.length() + v.length() + 2; i < NCH; i++) {
                    dots += ".";
                }
                cl[7 + k] = l + dots + " " + v;
            }
            _cLines = cl;
        }
        var lines = _cLines as Array;
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
                pxt(dc, PROMPT, lx, y, 2, 0);
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
                pxt(dc, s, lx + pw, y, 2, 0);
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
                pxt(dc, s, lx, y, 2, 0);
            }
        }
        if (!a.so) {
            _busy = ms < tc + 60;
        }
        // block cursor (blinks when idle)
        if (cy >= 0 && !a.so && (_busy || !live || (a.t / 500) % 2 == 0)) {
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
