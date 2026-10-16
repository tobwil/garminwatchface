import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// FLAP — "Split-Flap": a retro departure board. Four big flap tiles for HH MM,
// a row of mini flaps for the date and a 3-row "Abfahrt" board for the slots.
// Every tile rattles through its drum on wake (and flips once on a minute change).
// Styles: 1 Bahnhof, 2 Café, 3 Akzent. Mirrors web/js/faces/flap.js.
class FaceFlap extends Face {
    const DIG = "0123456789";
    const DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789.:/-%°+";
    const COLS = 18;
    const PITCH = 15;

    // minute flip state: last minute key and wake time of the flip
    hidden var _lastKey = -1;
    hidden var _mT0 = -1;
    hidden var _busy = true;
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
    // horizontal runs merged over identical rows (~4x fewer draw calls; keeps the
    // board rattle well inside the watchdog budget).
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
        return _busy ? 20 : 1;
    }

    // character k of a flip sequence of n flips ending in `target` (k = n -> target)
    hidden function seqCh(drum as String, target as String, k, n, blank) as String {
        if (k >= n) {
            return target;
        }
        if (k <= 0 && blank) {
            return " ";
        }
        var len = drum.length();
        var i = drum.find(target);
        if (i == null) {
            i = 0;
        }
        var j = ((i - (n - k)) % len + len * 4) % len;
        return drum.substring(j, j + 1) as String;
    }

    // hour as two flap characters (12 h: leading blank flap)
    hidden function hhStr(h, is24) as String {
        if (is24) {
            return G.pad2(h);
        }
        var k = h % 12 == 0 ? 12 : h % 12;
        return k < 10 ? " " + k : "" + k;
    }

    // glyph of a cell: big = stroke digit, else pixel char
    hidden function glyph(dc as Dc, ch as String, x, y, w, h, big, col, fast) as Void {
        if (ch.equals(" ")) {
            return;
        }
        dc.setColor(col, -1);
        if (big) {
            // bold digit from three thin passes (thick verticals, finer horizontals, no joint notches);
            // a single heavy pass while the flap is moving (cheaper, motion hides the joints)
            var gh = h * 0.66;
            if (fast) {
                F.st(dc, ch, x + w / 2.0, y + h / 2.0, gh, 9, 1, 1.0, 0);
            } else {
                for (var k = -1; k <= 1; k++) {
                    F.st(dc, ch, x + w / 2.0 + k * 2.2, y + h / 2.0, gh, 6, 1, 1.0, 0);
                }
            }
        } else {
            pxt(dc, ch, x + w / 2.0 - 5, y + h / 2 - 7, 2, 0);
        }
    }

    // tile body: lighter top half, darker bottom half
    hidden function tile(dc as Dc, x, y, w, h, r, tT, tB) as Void {
        var hy = y + h / 2;
        if (r <= 2) {
            // tiny board cell: two plain halves, the 1 px gap is the hinge
            dc.setColor(tT, -1);
            dc.fillRectangle(x, y, w, h / 2 - 1);
            dc.setColor(tB, -1);
            dc.fillRectangle(x, hy, w, h / 2);
            return;
        }
        dc.setColor(tT, -1);
        dc.fillRoundedRectangle(x, y, w, h, r);
        dc.setColor(tB, -1);
        dc.fillRectangle(x, hy, w, h / 2 - r);
        dc.fillRoundedRectangle(x, y + h - 2 * r, w, 2 * r, r);
    }

    // One split-flap cell flipping from A to B at progress q (q >= 1: static B).
    hidden function cell(dc as Dc, x, y, w, h, r, aCh as String, bCh as String, q, big, col, tT, tB) as Void {
        var hy = y + h / 2;
        tile(dc, x, y, w, h, r, tT, tB);
        if (q >= 1 || aCh.equals(bCh)) {
            glyph(dc, bCh, x, y, w, h, big, col, false);
        } else {
            // new char's top half is revealed behind the falling flap, old bottom still shows
            dc.setClip(x, y, w, h / 2);
            glyph(dc, bCh, x, y, w, h, big, col, true);
            dc.setClip(x, hy, w, h / 2);
            glyph(dc, aCh, x, y, w, h, big, col, true);
            dc.clearClip();
            var k;
            var fy;
            var fh;
            var base;
            var ch;
            if (q < 0.5) {
                k = 1 - q * 2; fh = k * h / 2.0; fy = hy - fh; base = tT; ch = aCh;
            } else {
                k = q * 2 - 1; fh = k * h / 2.0; fy = hy; base = tB; ch = bCh;
            }
            var sh = G.mix(base, 0x000000, (1 - k) * 0.55);
            var ex = (1 - k) * w * 0.07; // free edge swings towards the viewer -> wider
            dc.setColor(sh, -1);
            if (q < 0.5) {
                dc.fillPolygon([[x - ex, fy], [x + w + ex, fy], [x + w, hy], [x, hy]]);
            } else {
                dc.fillPolygon([[x, hy], [x + w, hy], [x + w + ex, fy + fh], [x - ex, fy + fh]]);
            }
            if (k > 0.55 && fh > 2) {
                dc.setClip(x - ex, fy, w + ex * 2, fh);
                glyph(dc, ch, x, y, w, h, big, G.mix(col, 0x000000, (1 - k) * 0.6), true);
                dc.clearClip();
            }
        }
        // hinge gap
        if (r > 2) {
            dc.setColor(0x000000, -1);
            if (big) {
                dc.fillRectangle(x, hy - 1, w, 2);
            } else {
                dc.fillRectangle(x, hy - 0.5, w, 1);
            }
        }
    }

    // flip state of a cell: [A, B, q] at local time lt (ms) with n flips of fd ms
    hidden function flipAt(drum as String, target as String, lt, n, fd, blank) as Array {
        if (lt >= n * fd) {
            return [target, target, 1.0];
        }
        if (lt <= 0) {
            var c = seqCh(drum, target, 0, n, blank);
            return [c, c, 1.0];
        }
        var k = Math.floor(lt / fd).toNumber() + 1;
        return [seqCh(drum, target, k - 1, n, blank), seqCh(drum, target, k, n, blank), (lt - (k - 1) * fd) / fd.toFloat()];
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var col;
        var tT;
        var tB;
        var pin;
        var lab;
        if (st == 2) {
            col = 0xF2E3C6; tT = 0x3A2A20; tB = 0x2C1F17; pin = 0x6B5444; lab = 0xC9B79A;
        } else if (st == 3) {
            col = d.accent; tT = G.mix(0x1D1D1F, d.accent, 0.06); tB = G.mix(0x141416, d.accent, 0.04);
            pin = 0x4A4A4E; lab = G.mix(d.accent, 0xFFFFFF, 0.35);
        } else {
            col = 0xFFD24A; tT = 0x1F1F1F; tB = 0x151515; pin = 0x4C4C4C; lab = 0xD9D4C4;
        }
        var lab2 = G.dim(lab, 0.8);

        // timeline: intro rattle (ms of the 1.4 s intro) or a single flip on minute change
        var key = d.h * 60 + d.m;
        if (a.t < _mT0) {
            _mT0 = -1;
        }
        if (_lastKey >= 0 && key != _lastKey && a.live && a.intro >= 1) {
            _mT0 = a.t;
        }
        _lastKey = key;
        var intro = a.intro < 1;
        var ms = intro ? a.intro * 1400 : 99999.0;
        var mm = _mT0 >= 0 ? a.t - _mT0 : 99999;
        _busy = intro || mm < 900;

        // ---- date row: mini flaps "FR" "16" "OKT"
        var dl = [d.dowStr, "" + d.day, d.monStr];
        var cw = 22;
        var chh = 30;
        var gp = 3;
        var gg = 12;
        var tw = -gg;
        for (var g = 0; g < 3; g++) {
            tw += (dl[g] as String).length() * (cw + gp) - gp + gg;
        }
        var x = 227 - tw / 2.0;
        var ci = 0;
        for (var g = 0; g < 3; g++) {
            var s = dl[g] as String;
            for (var k = 0; k < s.length(); k++) {
                var ch = s.substring(k, k + 1) as String;
                var f = flipAt(DRUM, ch, ms - 60 - ci * 45, 4, 70, true);
                cell(dc, x, 60, cw, chh, 3, f[0], f[1], f[2], false, lab, tT, tB);
                x += cw + gp;
                ci++;
            }
            x += gg - gp;
        }

        // ---- big HH MM tiles
        var tm = hhStr(d.h, d.is24) + G.pad2(d.m);
        // previous minute (for the minute-change flip)
        var pk = (key + 1439) % 1440;
        var ph = pk / 60;
        var pv = hhStr(ph, d.is24) + G.pad2(pk % 60);
        var bw = 78;
        var bh = 122;
        var by = 110;
        for (var i = 0; i < 4; i++) {
            var bx = 227 - 177 + i * (bw + 6) + (i >= 2 ? 24 : 0);
            var tch = tm.substring(i, i + 1) as String;
            var f;
            if (intro) {
                f = flipAt(DIG, tch, ms - i * 80, 5 + i, 100, true);
            } else {
                var och = pv.substring(i, i + 1) as String;
                f = och.equals(tch) ? [tch, tch, 1.0] : [och, tch, G.clamp((mm - (3 - i) * 120) / 260.0, 0.0, 1.0)];
            }
            // hinge pins
            dc.setColor(pin, -1);
            dc.fillRoundedRectangle(bx - 3, by + bh / 2 - 7, 6, 14, 2);
            dc.fillRoundedRectangle(bx + bw - 3, by + bh / 2 - 7, 6, 14, 2);
            cell(dc, bx, by, bw, bh, 9, f[0], f[1], f[2], true, col, tT, tB);
            // top-edge highlight
            dc.setColor(G.mix(tT, 0xFFFFFF, 0.07), -1);
            dc.fillRectangle(bx + 9, by, bw - 18, 1);
        }
        // colon
        dc.setColor(G.dim(col, 0.75), -1);
        dc.fillRoundedRectangle(222, by + 38, 10, 10, 3);
        dc.fillRoundedRectangle(222, by + bh - 48, 10, 10, 3);

        // ---- board header
        var bx0 = 227 - (COLS * PITCH - 2) / 2;
        var bx1 = bx0 + COLS * PITCH - 2;
        var hp = G.ease(ms / 500.0);
        dc.setColor(lab2, -1);
        pxt(dc, "ABFAHRT", bx0, 245, 2, 0);
        pxt(dc, "GLEIS 970", bx1 - F.pxW("GLEIS 970", 2), 245, 2, 0);
        dc.setColor(G.dim(lab, 0.35), -1);
        dc.fillRectangle(227 - (bx1 - bx0) * hp / 2, 263, (bx1 - bx0) * hp, 1);

        // ---- board rows: label left, value right, one flap per character
        for (var r = 0; r < 3; r++) {
            var sl = d.slots[r];
            var v = sl[:val] as String;
            if (v.length() > COLS - 2) {
                v = v.substring(0, COLS - 2) as String;
            }
            var l = sl[:lbl] as String;
            var room = COLS - v.length() - 1;
            if (l.length() > room) {
                l = l.substring(0, room) as String;
            }
            var y = 270 + r * 28;
            var vl = v.length();
            for (var c = 0; c < COLS; c++) {
                var ch = " ";
                var isV = false;
                if (c < l.length()) {
                    ch = l.substring(c, c + 1) as String;
                } else if (c >= COLS - vl) {
                    ch = v.substring(c - (COLS - vl), c - (COLS - vl) + 1) as String;
                    isV = true;
                }
                var cx = bx0 + c * PITCH;
                var f = flipAt(DRUM, ch, ms - 380 - r * 160 - c * 22, 3 + ((c + r) % 4), 55, true);
                cell(dc, cx, y, PITCH - 2, 24, 2, f[0], f[1], f[2], false, isV ? col : lab, tT, tB);
            }
        }

        // ---- footer: Deutsche-Bahn humour driven by Body Battery
        var msg;
        var sig;
        var bb = d.bb;
        if (bb < 0) {
            msg = "OHNE GEWÄHR"; sig = 0x5A5A5A;
        } else if (bb >= 60) {
            msg = "PÜNKTLICH"; sig = 0x3CCB6A;
        } else if (bb >= 30) {
            msg = "+5 MIN VERSPÄTUNG"; sig = 0xFFA63A;
        } else {
            msg = "ZUG FÄLLT AUS"; sig = 0xFF4A3A;
        }
        var fp = G.clamp((ms - 1150) / 250.0, 0.0, 1.0);
        if (fp > 0) {
            var fw = F.pxW(msg, 2) + 16;
            var fx = 227 - fw / 2.0;
            dc.setColor(G.dim(sig, fp), -1);
            dc.fillCircle(fx + 4, 371, 4);
            dc.setColor(G.dim(lab2, fp), -1);
            pxt(dc, msg, fx + 16, 364, 2, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var col = G.dim(st == 2 ? 0xF2E3C6 : (st == 3 ? d.accent : 0xFFD24A), 0.55);
        var tm = hhStr(d.h, d.is24) + G.pad2(d.m);
        var bw = 78;
        var bh = 122;
        var by = 110 + o[1];
        dc.setPenWidth(1);
        for (var i = 0; i < 4; i++) {
            var bx = 227 - 177 + i * (bw + 6) + (i >= 2 ? 24 : 0) + o[0];
            dc.setColor(0x262626, -1);
            dc.drawRoundedRectangle(bx, by, bw, bh, 9);
            dc.drawLine(bx + 4, by + bh / 2, bx + bw - 4, by + bh / 2);
            dc.setColor(col, -1);
            var ch = tm.substring(i, i + 1) as String;
            if (!ch.equals(" ")) {
                F.st(dc, ch, bx + bw / 2, by + bh / 2, bh * 0.62, 3, 1, 1.0, 0);
            }
        }
        dc.setColor(G.dim(col, 0.7), -1);
        dc.fillRoundedRectangle(223 + o[0], by + 40, 8, 8, 2);
        dc.fillRoundedRectangle(223 + o[0], by + bh - 48, 8, 8, 2);
        dc.setColor(0x5A5A5A, -1);
        F.px(dc, d.dowStr + " " + d.day + " " + d.monStr, 227 + o[0], 268 + o[1], 2, 1, 1);
    }
}
