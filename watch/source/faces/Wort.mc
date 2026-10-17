import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// WORT — German word clock ("ES IST VIERTEL NACH ZEHN") on an 11x10 letter
// grid, 0-4 minute dots below. Styles: 1 Klassisch, 2 Akzent, 3 Neon.
// Mirrors web/js/faces/wort.js.
class FaceWort extends Face {
    const CW = 28;   // cell width
    const RH = 27;   // row height
    const X0 = 87;   // 227 - 5 * CW
    const Y0 = 90;
    const LH = 16;   // letter cap height

    // words: row, col, len (flat triples)
    // 0 ES 1 IST 2 FÜNF 3 ZEHN 4 ZWANZIG 5 VIERTEL 6 VOR 7 NACH 8 HALB 9 UHR
    // 10..21 hours EINS..ZWÖLF (index 9 + h), 22 EIN
    hidden var _w = [
        0, 0, 2, 0, 3, 3, 0, 7, 4, 1, 0, 4, 1, 4, 7, 2, 4, 7, 3, 0, 3, 3, 7, 4, 4, 0, 4, 9, 8, 3,
        5, 0, 4, 5, 7, 4, 6, 0, 4, 6, 7, 4, 4, 7, 4, 7, 0, 5, 8, 0, 6, 7, 7, 4, 9, 3, 4, 9, 0, 4, 4, 5, 3, 8, 6, 5,
        5, 0, 3
    ];
    // sentence per 5-minute step: minute words; -1 = hour (current), -2 = hour (next)
    hidden var _sent = [
        [-1, 9], [2, 7, -1], [3, 7, -1], [5, 7, -1], [4, 7, -1], [2, 6, 8, -2],
        [8, -2], [2, 7, 8, -2], [4, 6, -2], [5, 6, -2], [3, 6, -2], [2, 6, -2]
    ];
    hidden var _ch as Array<String>;
    hidden var _gi as Array<Number>;
    hidden var _lit as Array;
    hidden var _total = 0.0;

    function initialize() {
        Face.initialize();
        var rows = [
            "ESKISTAFÜNF",
            "ZEHNZWANZIG",
            "DREIVIERTEL",
            "VORFUNKNACH",
            "HALBAELFÜNF",
            "EINSXAMZWEI",
            "DREIPMJVIER",
            "SECHSNLACHT",
            "SIEBENZWÖLF",
            "ZEHNEUNKUHR"
        ];
        _ch = new [110] as Array<String>;
        _gi = new [110] as Array<Number>;
        for (var r = 0; r < 10; r++) {
            var cs = rows[r].toCharArray();
            for (var c = 0; c < 11; c++) {
                _ch[r * 11 + c] = cs[c].toString();
                _gi[r * 11 + c] = FontData.STROKE_MAP[cs[c].toNumber()] - 1;
            }
        }
        _lit = new [110];
    }

    function fps() as Number {
        return 0;
    }

    // per-cell order value (letter position in the sentence incl. word pauses), -1 = unlit
    hidden function litMap(d as D) as Void {
        for (var i = 0; i < 110; i++) {
            _lit[i] = -1.0;
        }
        var m5 = d.m / 5;
        var sw = _sent[m5] as Array<Number>;
        var k = 0.0;
        for (var i = -2; i < sw.size(); i++) {
            var w = i < 0 ? i + 2 : sw[i]; // ES, IST first
            if (w < 0) {
                var hh = (d.h + (w == -2 ? 1 : 0)) % 12;
                if (hh == 0) {
                    hh = 12;
                }
                w = (m5 == 0 && hh == 1) ? 22 : 9 + hh;
            }
            var r = _w[w * 3];
            var c = _w[w * 3 + 1];
            var n = _w[w * 3 + 2];
            for (var j = 0; j < n; j++) {
                _lit[r * 11 + c + j] = k;
                k += 1.0;
            }
            k += 1.5; // pause between words
        }
        _total = k;
    }

    // Fast path for the dim letters: one centred glyph at pen 2, pixel-identical to
    // F.st(dc, ch, x, y, LH, 2, 1, 1.0, 0) but without its per-call string work.
    hidden function glyph2(dc as Dc, gi as Number, x, y) as Void {
        var s = LH / 80.0;
        var data = FontData.STROKE_DATA;
        var ox = x - FontData.STROKE_W[gi] * s / 2.0;
        var oy = y - LH / 2.0 - 24 * s;
        var b = FontData.STROKE_OFFS[gi + 1];
        var hasP = false;
        var single = true;
        var px = 0.0;
        var py = 0.0;
        var i = FontData.STROKE_OFFS[gi];
        while (i < b) {
            var xb = data[i];
            if (xb == 255) {
                if (single && hasP) {
                    dc.fillCircle(px, py, 1.44);
                }
                hasP = false;
                single = true;
                i += 1;
                continue;
            }
            var nx = ox + (xb & 127) * s;
            var ny = oy + data[i + 1] * s;
            if (hasP) {
                single = false;
                dc.drawLine(px, py, nx, ny);
            }
            px = nx;
            py = ny;
            hasP = true;
            i += 2;
        }
        if (single && hasP) {
            dc.fillCircle(px, py, 1.44);
        }
    }

    hidden function onCol(d as D) as Number {
        return d.cfg.style == 1 ? 0xFFFFFF : d.accent;
    }

    hidden function offCol(d as D) as Number {
        return d.cfg.style == 3 ? G.mix(0x1C1C1C, d.accent, 0.12) : 0x262626;
    }

    // static layer: the whole design (nothing moves once it is revealed)
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        if (a.bg) {
            return;
        }
        var p = a.intro;
        var on = onCol(d);
        var off = offCol(d);
        var glow = d.cfg.style == 3;
        litMap(d);
        var step = 0.6 / _total;

        // unlit letters (flicker in)
        dc.setColor(off, -1);
        dc.setPenWidth(2);
        for (var i = 0; i < 110; i++) {
            if (_lit[i] >= 0) {
                continue;
            }
            var t0 = 0.04 + G.rf(G.rnd(i * 7919 + 13)) * 0.5;
            if (p < t0) {
                continue;
            }
            if (p < t0 + 0.12 && (a.t / 40 + i) % 3 == 0) {
                continue;
            }
            var r = i / 11;
            var cc = i % 11;
            glyph2(dc, _gi[i], X0 + cc * CW, Y0 + r * RH);
        }

        // lit letters (typewriter, word by word)
        for (var i = 0; i < 110; i++) {
            if (_lit[i] < 0) {
                continue;
            }
            var lp = G.stag(p, _lit[i], step, 0.16);
            var r = i / 11;
            var cc = i % 11;
            var x = X0 + cc * CW;
            var y = Y0 + r * RH;
            if (lp <= 0) {
                if (p > 0.04) {
                    dc.setColor(off, -1);
                    dc.setPenWidth(2);
                    glyph2(dc, _gi[i], x, y);
                }
                continue;
            }
            if (glow) {
                // cheap radial halo (stacked discs) instead of extra stroke passes
                dc.setColor(G.dim(on, 0.09 * lp), -1);
                dc.fillCircle(x, y, 14);
                dc.setColor(G.dim(on, 0.19 * lp), -1);
                dc.fillCircle(x, y, 9.5);
            }
            // flash white, settle to the lit colour
            var col = lp < 0.5 ? G.mix(off, 0xFFFFFF, lp * 2) : G.mix(0xFFFFFF, on, (lp - 0.5) * 2);
            dc.setColor(col, -1);
            F.st(dc, _ch[i], x, y, LH, 3, 1, 1.0, 0);
        }

        // date line + minute dots
        var ep = G.ease((p - 0.55) / 0.45);
        dc.setColor(G.dim(0x8A8A8A, ep), -1);
        F.st(dc, d.dowStr + " " + d.day, 227, Y0 + 9 * RH + 38, 15, 2, 1, ep, 0);
        var md = d.m % 5;
        for (var k = 0; k < 4; k++) {
            var q = G.stag(p, k, 0.05, 0.2) * (p > 0.7 ? 1 : 0);
            var deg = 180 - (k - 1.5) * 9;
            var x = G.ptX(227, 196, deg);
            var y = G.ptY(227, 196, deg);
            var lit = k < md;
            if (lit && glow) {
                dc.setColor(G.dim(on, 0.3 * q), -1);
                dc.fillCircle(x, y, 7);
            }
            dc.setColor(lit ? G.mix(off, on, q) : off, -1);
            dc.fillCircle(x, y, lit ? 4 : 3);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        litMap(d);
        dc.setColor(d.cfg.style == 1 ? 0x8A8A8A : G.dim(onCol(d), 0.6), -1);
        for (var i = 0; i < 110; i++) {
            if (_lit[i] < 0) {
                continue;
            }
            var r = i / 11;
            var cc = i % 11;
            F.st(dc, _ch[i], X0 + cc * CW + o[0], Y0 + r * RH + o[1], LH, 2, 1, 1.0, 0);
        }
        var md = d.m % 5;
        for (var k = 0; k < md; k++) {
            var deg = 180 - (k - 1.5) * 9;
            dc.fillCircle(G.ptX(227 + o[0], 196, deg), G.ptY(227 + o[1], 196, deg), 3);
        }
    }
}
