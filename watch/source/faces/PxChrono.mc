import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// PXCHRONO — "Pixel-Chronograph": a classic chronograph set entirely in pixels. Tachymeter scale on the
// rim, railroad minute track, block indices, three sub-dials (9 / 3 / 6) carrying the data slots
// (0–100 values as a pixel arc), a date window at 4:30 and hands built from stepped blocks. On
// every wrist raise the chronograph hand runs one full lap and lands on the current second.
// Styles: 1 Panda, 2 Racing, 3 Gameboy. Mirrors web/js/faces/pxchrono.js.
class FacePxChrono extends Face {
    const CX = 227;
    const CY = 227;
    const SUBR = 44;
    const SUBX = [-95, 95, 0];
    const SUBY = [0, 0, 95];
    const TACH = [500, 300, 200, 150, 120, 100, 80, 70, 60];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    // slot types whose raw value is naturally 0..100 -> drawn as a gauge
    hidden function isGauge(t as Number) as Boolean {
        return t == 23 || t == 22 || t == 1 || t == 42 || t == 35;
    }

    // [dial, dial ring, rim, rim text, track, index, sub disc, sub ring, sub text, sub dim, brand, hand, hand edge (dial),
    //  seconds, date bg, date text]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x101012, 0x2A2A2E, 0x000000, 0xD8D8D8, 0x8A8A8A, 0xF4F4F4, 0x000000, acc, 0xFFFFFF, 0x8A8A8A,
                0xF4F4F4, 0xF4F4F4, 0x101012, acc, 0xF4F4F4, 0x101012] as Array<Number>;
        }
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [c, b, a, e, b, a, b, a, e, c, a, a, c, a, e, a] as Array<Number>;
        }
        return [0xE8E2D0, 0xC8C0AA, 0x141414, 0xE8E2D0, 0x5A564C, 0x1A1A1A, 0x141414, 0x5A564C, 0xF4F0E4, 0xA8A090,
            0x1A1A1A, 0x1A1A1A, 0xE8E2D0, acc, 0xF8F6F0, 0x1A1A1A] as Array<Number>;
    }

    // one block of size b at the polar point (deg, r) around (cx, cy), snapped to the b grid
    hidden function blk(dc as Dc, cx as Number, cy as Number, deg, r, b as Number) as Void {
        var rd = deg * Math.PI / 180;
        var x = cx + Math.floor(Math.sin(rd) * r / b).toNumber() * b;
        var y = cy + Math.floor(-Math.cos(rd) * r / b).toNumber() * b;
        dc.fillRectangle(x, y, b, b);
    }

    // stepped hand: blocks of size b from -back to len along deg
    hidden function hand(dc as Dc, cx as Number, cy as Number, deg, len as Number, back as Number, b as Number) as Void {
        var st = b * 0.7;
        for (var t = -back.toFloat(); t <= len; t += st) {
            blk(dc, cx, cy, deg, t, b);
        }
    }

    // pixel ring of blocks
    hidden function ring(dc as Dc, cx as Number, cy as Number, r as Number, b as Number) as Void {
        var n = Math.round(2 * Math.PI * r / (b * 0.8)).toNumber();
        if (n < 24) {
            n = 24;
        }
        for (var i = 0; i < n; i++) {
            blk(dc, cx, cy, i * 360.0 / n, r, b);
        }
    }

    // pixel disc (4 px rows)
    hidden function disc(dc as Dc, cx as Number, cy as Number, r as Number) as Void {
        for (var y = -r; y < r; y += 4) {
            var hw = (Math.sqrt(r * r - (y + 2) * (y + 2)) / 4).toNumber() * 4;
            dc.fillRectangle(cx - hw, cy + y, 2 * hw, 4);
        }
    }

    // static layer: dial, scales, sub-dials with the data, date and the hour / minute hands; the
    // seconds / chronograph hand moves
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

        if (S) {
            // ---- dial and tachymeter rim
            dc.setColor(P[2], -1);
            dc.fillCircle(CX, CY, 227);
            dc.setColor(P[0], -1);
            disc(dc, CX, CY, 188);
            dc.setColor(P[3], -1);
            for (var i = 0; i < TACH.size(); i++) {
                var rd = 3600.0 / TACH[i] * 6 * Math.PI / 180;
                var tx = Math.round(CX + Math.sin(rd) * 206).toNumber();
                var ty = Math.round(CY - Math.cos(rd) * 206).toNumber();
                F.px(dc, "" + TACH[i], tx, ty - 7, 2, 1, 0);
            }
            for (var i = 0; i < 60; i++) {
                if (i % 5 != 0) {
                    blk(dc, CX, CY, i * 6, 196, 2);
                }
            }

            // ---- railroad minute track and block indices (none behind the sub-dials)
            dc.setColor(P[4], -1);
            for (var i = 0; i < 60; i++) {
                blk(dc, CX, CY, i * 6, 182, i % 5 == 0 ? 6 : 4);
            }
            dc.setColor(P[5], -1);
            for (var h = 0; h < 12; h++) {
                if (h == 3 || h == 6 || h == 9) {
                    continue;
                }
                for (var r = 146; r <= 170; r += 8) {
                    blk(dc, CX, CY, h * 30, r, 8);
                    if (h == 0) {
                        blk(dc, CX, CY, -3.5, r, 8);
                        blk(dc, CX, CY, 3.5, r, 8);
                    }
                }
            }

            // ---- brand
            dc.setColor(P[10], -1);
            F.px(dc, "PIXEL", CX, 104, 2, 1, 0);
            dc.setColor(P[13], -1);
            F.px(dc, "CHRONOGRAPH", CX, 124, 1, 1, 0);

            // ---- sub-dials with the data slots
            for (var k = 0; k < 3; k++) {
                var x = CX + SUBX[k];
                var y = CY + SUBY[k];
                var sl = d.slots[k];
                dc.setColor(P[6], -1);
                disc(dc, x, y, SUBR);
                dc.setColor(P[7], -1);
                ring(dc, x, y, SUBR - 2, 2);
                var lb = sl[:lbl] as String;
                if (lb.length() == 0) {
                    continue;
                }
                var t = d.cfg.slots[k] as Number;
                var g = isGauge(t);
                var raw = sl[:raw];
                dc.setColor(P[9], -1);
                if (g) {
                    for (var j = 0; j <= 12; j++) {
                        blk(dc, x, y, -120 + j * 20, SUBR - 8, j % 3 == 0 ? 4 : 2);
                    }
                    if (raw != null && raw >= 0) {
                        var f = G.clamp(raw / 100.0, 0, 1);
                        dc.setColor(P[13], -1);
                        for (var deg = -120; deg <= -120 + 240 * f; deg += 8) {
                            blk(dc, x, y, deg, SUBR - 16, 4);
                        }
                        dc.setColor(P[8], -1);
                        hand(dc, x, y, -120 + 240 * f, SUBR - 14, 4, 2);
                    }
                } else {
                    for (var j = 0; j < 12; j++) {
                        blk(dc, x, y, j * 30, SUBR - 8, j % 3 == 0 ? 4 : 2);
                    }
                }
                while (lb.length() > 2 && F.pxW(lb, 1) > 56) {
                    lb = lb.substring(0, lb.length() - 1);
                }
                dc.setColor(P[9], -1);
                F.px(dc, lb, x, y - 18, 1, 1, 0);
                dc.setColor(P[8], -1);
                F.px(dc, sl[:val] as String, x, y + (g ? 14 : 2), 2, 1, 0);
            }

            // ---- date window at 4:30
            dc.setColor(P[4], -1);
            dc.fillRectangle(318, 320, 38, 26);
            dc.setColor(P[14], -1);
            dc.fillRectangle(320, 322, 34, 22);
            dc.setColor(P[15], -1);
            F.px(dc, "" + d.day, 337, 326, 2, 1, 0);

            // ---- hour and minute hands (they move once a minute: part of the static layer), edged in the
            // dial colour so they stay visible over the sub-dials
            var hd = ((G.hour(d) % 12) + d.m / 60.0) * 30;
            dc.setColor(P[12], -1);
            hand(dc, CX - 2, CY - 2, hd, 106, 18, 14);
            hand(dc, CX - 2, CY - 2, d.m * 6, 168, 22, 12);
            dc.setColor(P[11], -1);
            hand(dc, CX, CY, hd, 104, 16, 10);
            hand(dc, CX, CY, d.m * 6, 166, 20, 8);
        }

        if (!M) {
            return;
        }
        // ---- chronograph / seconds hand: one full lap on every raise, landing on the current second
        if (live || p < 1) {
            var sd = (d.s + (live ? a.ms / 1000.0 : 0)) * 6;
            var deg = p < 1 ? (360 + sd) * G.easeInOut(p) : sd;
            dc.setColor(P[13], -1);
            hand(dc, CX, CY, deg, 186, 40, 4);
            blk(dc, CX, CY, deg + 180, 40, 8);
        }
        dc.setColor(P[13], -1);
        dc.fillRectangle(CX - 8, CY - 8, 16, 16);
        dc.setColor(P[0], -1);
        dc.fillRectangle(CX - 2, CY - 2, 4, 4);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var cx = CX + o[0];
        var cy = CY + o[1];
        dc.setColor(st == 3 ? 0x306230 : 0x4A4A4A, -1);
        for (var h = 0; h < 12; h++) {
            blk(dc, cx, cy, h * 30, 160, 6);
        }
        var hd = ((G.hour(d) % 12) + d.m / 60.0) * 30;
        dc.setColor(st == 3 ? 0x8BAC0F : 0x9A9A9A, -1);
        hand(dc, cx, cy, hd, 104, 0, 6);
        hand(dc, cx, cy, d.m * 6, 166, 0, 4);
    }
}
