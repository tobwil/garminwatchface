import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// F — procedural fonts (stroke / pixel / segment). Mirrors web/js/engine/fonts.js.
module F {
    const GAP = 22;

    function glyph(code as Number, map as ByteArray) as Number {
        if (code > 255 || code < 0) {
            return -1;
        }
        return map[code] - 1;
    }

    function stW(txt as String, h) as Float {
        txt = txt.toUpper();
        var w = 0;
        var cs = txt.toCharArray();
        for (var k = 0; k < cs.size(); k++) {
            var gi = glyph(cs[k].toNumber(), FontData.STROKE_MAP);
            w += (gi < 0 ? 20 : FontData.STROKE_W[gi]) + GAP;
        }
        if (cs.size() > 0) {
            w -= GAP;
        }
        return w * h / 80.0;
    }

    function glyphLen(gi as Number) as Float {
        var len = 0.0;
        var data = FontData.STROKE_DATA;
        var a = FontData.STROKE_OFFS[gi];
        var b = FontData.STROKE_OFFS[gi + 1];
        var px = -1;
        var py = -1;
        var i = a;
        while (i < b) {
            if (data[i] == 255) {
                px = -1;
                i += 1;
                continue;
            }
            var gx = data[i] & 127;
            if (px >= 0) {
                var dx = gx - px;
                var dy = data[i + 1] - py;
                len += Math.sqrt(dx * dx + dy * dy);
            }
            px = gx;
            py = data[i + 1];
            i += 2;
        }
        return len;
    }

    // Stroke text, vertically centred on y. just: 0 left, 1 centre, 2 right.
    // prog 0..1 draws partially (write-on animation). slant = italic shear.
    function st(dc as Dc, txt as String, x, y, h, pen, just, prog, slant) as Float {
        txt = txt.toUpper();
        var s = h / 80.0;
        var w = stW(txt, h);
        var ox = just == 1 ? x - w / 2.0 : (just == 2 ? x - w : x);
        var oy = y - h / 2.0 - 24 * s;
        var r = pen / 2.0;
        var cs = txt.toCharArray();
        var n = cs.size();
        var budget = 1.0e9;
        if (prog < 1.0) {
            var total = 0.0;
            for (var k = 0; k < n; k++) {
                var g0 = glyph(cs[k].toNumber(), FontData.STROKE_MAP);
                if (g0 >= 0) {
                    total += glyphLen(g0);
                }
            }
            budget = (prog < 0 ? 0 : prog) * total;
            if (budget <= 0) {
                return w;
            }
        }
        var data = FontData.STROKE_DATA;
        var big = pen >= 3;
        dc.setPenWidth(pen);
        for (var k = 0; k < n && budget > 0; k++) {
            var gi = glyph(cs[k].toNumber(), FontData.STROKE_MAP);
            if (gi >= 0) {
                var a = FontData.STROKE_OFFS[gi];
                var b = FontData.STROKE_OFFS[gi + 1];
                var px = 0.0;
                var py = 0.0;
                var lgx = 0;
                var lgy = 0;
                var hp = false;
                var single = true;
                var i = a;
                while (i < b && budget > 0) {
                    if (data[i] == 255) {
                        if (single && hp) {
                            dc.fillCircle(px, py, pen * 0.72);
                        }
                        hp = false;
                        single = true;
                        i += 1;
                        continue;
                    }
                    var xb = data[i];
                    var gx = xb & 127;
                    var gy = data[i + 1];
                    var nx = ox + gx * s + (slant != 0 ? (80 - gy) * s * slant : 0);
                    var ny = oy + gy * s;
                    if (hp) {
                        single = false;
                        var dx = gx - lgx;
                        var dy = gy - lgy;
                        var seg = Math.sqrt(dx * dx + dy * dy);
                        var tx = nx;
                        var ty = ny;
                        if (seg > budget) {
                            var f = budget / seg;
                            tx = px + (nx - px) * f;
                            ty = py + (ny - py) * f;
                        }
                        budget -= seg;
                        dc.drawLine(px, py, tx, ty);
                        if (big && ((xb & 128) != 0 || budget < 0)) {
                            dc.fillCircle(tx, ty, r);
                        }
                    } else if (big && i + 2 < b && data[i + 2] != 255) {
                        dc.fillCircle(nx, ny, r);
                    }
                    px = nx;
                    py = ny;
                    lgx = gx;
                    lgy = gy;
                    hp = true;
                    i += 2;
                }
                if (single && hp && budget > 0) {
                    dc.fillCircle(px, py, pen * 0.72);
                }
                ox += (FontData.STROKE_W[gi] + GAP) * s;
            } else {
                ox += (20 + GAP) * s;
            }
        }
        return w;
    }

    // ---- 5x7 dot matrix. y = top.
    function pxW(txt as String, sc) {
        var n = txt.length();
        return n > 0 ? n * 6 * sc - sc : 0;
    }

    function px(dc as Dc, txt as String, x, y, sc, just, gap) {
        var w = pxW(txt, sc);
        var ox = just == 1 ? x - w / 2.0 : (just == 2 ? x - w : x);
        ox = Math.round(ox).toNumber();
        var d = sc - gap;
        var cs = txt.toCharArray();
        for (var k = 0; k < cs.size(); k++) {
            var gi = glyph(cs[k].toNumber(), FontData.PX_MAP);
            if (gi >= 0) {
                for (var row = 0; row < 7; row++) {
                    var bits = FontData.PX_DATA[gi * 7 + row];
                    if (bits == 0) {
                        continue;
                    }
                    for (var col = 0; col < 5; col++) {
                        if ((bits & (16 >> col)) != 0) {
                            dc.fillRectangle(ox + col * sc, y + row * sc, d, d);
                        }
                    }
                }
            }
            ox += 6 * sc;
        }
        return w;
    }

    // ---- seven segment. y = top.
    function segW(txt as String, h) {
        var w = 0.0;
        var cs = txt.toCharArray();
        for (var k = 0; k < cs.size(); k++) {
            var c = cs[k];
            w += (c == ':' || c == '.') ? h * 0.22 : h * 0.62;
        }
        return w - h * 0.1;
    }

    function seg(dc as Dc, txt as String, x, y, h, th, just, onCol, offCol) {
        txt = txt.toUpper();
        var w = segW(txt, h);
        var ox = just == 1 ? x - w / 2.0 : (just == 2 ? x - w : x);
        var cs = txt.toCharArray();
        for (var k = 0; k < cs.size(); k++) {
            var c = cs[k];
            if (c == ':' || c == '.') {
                dc.setColor(onCol, -1);
                var r = th * 0.6;
                if (c == ':') {
                    dc.fillCircle(ox + h * 0.06, y + h * 0.3, r);
                    dc.fillCircle(ox + h * 0.06, y + h * 0.7, r);
                } else {
                    dc.fillCircle(ox + h * 0.06, y + h - r, r);
                }
                ox += h * 0.22;
                continue;
            }
            var gi = glyph(c.toNumber(), FontData.SEG_MAP);
            var m = gi >= 0 ? FontData.SEG_DATA[gi] : 0;
            digit(dc, ox, y, h * 0.52, h, th, m, onCol, offCol);
            ox += h * 0.62;
        }
        return w;
    }

    function hs(x, w, yy, t2, t, g) {
        return [[x + t2 + g, yy], [x + t + g, yy - t2], [x + w - t - g, yy - t2], [x + w - t2 - g, yy], [x + w - t - g, yy + t2], [x + t + g, yy + t2]];
    }

    function vs(xx, y0, y1, t2, t, g) {
        return [[xx, y0 + t2 + g], [xx + t2, y0 + t + g], [xx + t2, y1 - t - g], [xx, y1 - t2 - g], [xx - t2, y1 - t - g], [xx - t2, y0 + t + g]];
    }

    function digit(dc as Dc, x, y, w, h, t, m, on, off) as Void {
        var t2 = t / 2.0;
        var g = t * 0.18;
        var hm = y + h / 2.0;
        for (var i = 0; i < 7; i++) {
            var lit = (m >> i) & 1;
            if (lit == 0 && off == -1) {
                continue;
            }
            var p;
            if (i == 0) { p = hs(x, w, y + t2, t2, t, g); }
            else if (i == 1) { p = vs(x + w - t2, y + t2, hm, t2, t, g); }
            else if (i == 2) { p = vs(x + w - t2, hm, y + h - t2, t2, t, g); }
            else if (i == 3) { p = hs(x, w, y + h - t2, t2, t, g); }
            else if (i == 4) { p = vs(x + t2, hm, y + h - t2, t2, t, g); }
            else if (i == 5) { p = vs(x + t2, y + t2, hm, t2, t, g); }
            else { p = hs(x, w, hm, t2, t, g); }
            dc.setColor(lit == 1 ? on : off, -1);
            dc.fillPolygon(p);
        }
    }
}
