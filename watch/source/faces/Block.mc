import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// BLOCK — "Blockfall": a falling-block puzzle well. The time is a stack of pixel pieces
// (HH over MM, 3x5 cells per digit). On every raise the pieces rain down, rotate and slide
// into place; then the waiting piece drops down the shaft between the digits into the
// matching hole of the floor and clears lines. Score = minutes of the day, level = hour
// (gravity gets faster late in the day), lines = raises today, record = best score of
// previous days (persisted). Next-piece preview + the three data slots on the right.
// Styles: 1 Klassik, 2 Gameboy, 3 Neon. Mirrors web/js/faces/block.js.
class FaceBlock extends Face {
    const C = 20; // cell size
    const X0 = 127; // well inner left
    const Y0 = 70; // well inner top
    const NR = 16; // rows (10 columns)
    // digits: 3x5 cells, value = piece id (1..4) inside the digit, 0 empty
    const DG = [
        1, 1, 1, 2, 0, 1, 2, 0, 3, 2, 0, 3, 2, 3, 3,
        0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 2, 0, 2, 2, 2,
        1, 1, 1, 0, 0, 1, 2, 2, 2, 2, 0, 0, 3, 3, 3,
        1, 1, 1, 0, 0, 1, 0, 2, 2, 0, 0, 2, 3, 3, 2,
        1, 0, 2, 1, 0, 2, 1, 1, 2, 0, 0, 3, 0, 0, 3,
        1, 1, 1, 1, 0, 0, 2, 2, 2, 0, 0, 2, 3, 3, 3,
        1, 1, 1, 1, 0, 0, 2, 3, 3, 2, 0, 3, 2, 2, 3,
        1, 1, 1, 0, 0, 1, 0, 0, 2, 0, 0, 2, 0, 0, 2,
        1, 1, 1, 1, 0, 2, 3, 2, 2, 3, 0, 4, 3, 3, 4,
        1, 1, 2, 1, 0, 2, 1, 2, 2, 0, 0, 3, 3, 3, 3
    ];
    // piece count and colour (piece type 0..6) per digit piece
    const DN = [3, 2, 3, 3, 3, 3, 3, 2, 4, 3];
    const DCOL = [5, 0, 6, 0, 2, 3, 0, 0, 5, 6, 1, 0, 5, 6, 4, 0, 6, 0, 4, 0, 6, 5, 0, 0, 6, 1, 5, 0, 5, 0, 0, 0, 6, 4, 3, 0, 5, 2, 6, 0];
    // piece types 0 I, 1 O, 2 T, 3 S, 4 Z, 5 J, 6 L
    // shaft orientation (row, col) x4, rows relative to the floor box (well rows 13..15), cols 4..5
    const SH = [-1, 0, 0, 0, 1, 0, 2, 0, 1, 0, 1, 1, 2, 0, 2, 1, 0, 0, 1, 0, 1, 1, 2, 0, 0, 0, 1, 0, 1, 1, 2, 1,
        0, 1, 1, 0, 1, 1, 2, 0, 0, 0, 0, 1, 1, 0, 2, 0, 0, 0, 0, 1, 1, 1, 2, 1];
    // floor cells inside the 2x3 shaft box that are already filled (bit r*2+c), rows cleared (bit r)
    const GM = [42, 0, 32, 16, 32, 40, 20];
    const CL = [7, 6, 6, 6, 6, 7, 7];
    // spawn orientation (preview, idle) (row, col) x4
    const SP = [0, 0, 0, 1, 0, 2, 0, 3, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 0, 2, 1, 1, 0, 1, 0, 2, 1, 0, 1, 1,
        0, 0, 0, 1, 1, 1, 1, 2, 0, 0, 1, 0, 1, 1, 1, 2, 0, 2, 1, 0, 1, 1, 1, 2];
    const GB = [0x0F380F, 0x306230, 0x8BAC0F, 0x9BBC0F];
    const PC1 = [0x3FD8FF, 0xFFD23F, 0xB45CFF, 0x4FE060, 0xFF4A4A, 0x3F6BFF, 0xFF9A2A];
    const PC3 = [0x00F0FF, 0xFFE14A, 0xD04BFF, 0x39FF6A, 0xFF3B6B, 0x4B7BFF, 0xFF8C2B];

    hidden var _fps = 20;
    hidden var _kw = -1;
    hidden var _k = [0, 0, 0] as Array<Number>;
    hidden var _rKey = -1;
    hidden var _hi = 0;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return _fps;
    }

    // n-th piece: shuffled bags of all 7 pieces (no droughts, no floods)
    hidden function kind(n) as Number {
        var b = n / 7;
        var s = G.rnd(G.rnd(G.rnd(b * 977 + 11)));
        var bag = [0, 1, 2, 3, 4, 5, 6];
        for (var j = 6; j > 0; j--) {
            s = G.rnd(s);
            var r = (s / 65536) % (j + 1);
            var x = bag[j];
            bag[j] = bag[r];
            bag[r] = x;
        }
        return bag[n % 7];
    }

    // 7 piece colours per style (style 2 uses textures instead)
    hidden function pcol(st, i) as Number {
        return st == 3 ? PC3[i] : PC1[i];
    }

    // one cell at (x, y). e = outline edges (1 up, 2 right, 4 down, 8 left) for the neon style
    hidden function cell(dc as Dc, st, x, y, t, e, dim) as Void {
        if (st == 2) {
            // Game Boy textures: outer, inner, centre colour, centre size
            var o = t == 6 ? GB[1] : GB[0];
            var n = (t == 0 || t == 3) ? GB[3] : ((t == 2 || t == 6) ? GB[1] : GB[2]);
            dc.setColor(dim ? GB[0] : o, -1);
            dc.fillRectangle(x, y, 19, 19);
            dc.setColor(dim ? GB[1] : n, -1);
            dc.fillRectangle(x + 2, y + 2, 15, 15);
            if (dim) {
                return;
            }
            var cc = -1;
            var cs = 0;
            if (t == 0) {
                cc = GB[0]; cs = 7;
            } else if (t == 1) {
                cc = GB[0]; cs = 3;
            } else if (t == 3) {
                cc = GB[1]; cs = 11;
            } else if (t == 4) {
                dc.setColor(GB[3], -1);
                dc.fillRectangle(x + 4, y + 4, 4, 4);
            } else if (t == 5) {
                cc = GB[3]; cs = 5;
            } else if (t == 6) {
                cc = GB[0]; cs = 7;
            }
            if (cc != -1) {
                dc.setColor(cc, -1);
                var o2 = (19 - cs) / 2;
                dc.fillRectangle(x + o2, y + o2, cs, cs);
            }
            return;
        }
        var col = dim ? G.mix(pcol(st, t), 0x1A1D2C, 0.62) : pcol(st, t);
        if (st == 3) {
            dc.setColor(G.dim(col, dim ? 0.3 : 0.2), -1);
            dc.fillRectangle(x, y, 19, 19);
            dc.setColor(col, -1);
            if ((e & 1) != 0) { dc.fillRectangle(x - 1, y - 1, 21, 3); }
            if ((e & 4) != 0) { dc.fillRectangle(x - 1, y + 17, 21, 3); }
            if ((e & 8) != 0) { dc.fillRectangle(x - 1, y - 1, 3, 21); }
            if ((e & 2) != 0) { dc.fillRectangle(x + 17, y - 1, 3, 21); }
            return;
        }
        dc.setColor(G.mix(col, 0x000000, 0.45), -1);
        dc.fillRectangle(x, y, 19, 19);
        dc.setColor(G.mix(col, 0xFFFFFF, 0.5), -1);
        dc.fillRectangle(x, y, 17, 17);
        dc.setColor(col, -1);
        dc.fillRectangle(x + 2, y + 2, 15, 15);
        if (!dim) {
            dc.setColor(G.mix(col, 0xFFFFFF, 0.75), -1);
            dc.fillRectangle(x + 3, y + 3, 3, 3);
        }
    }

    // a piece of n cells given as (row, col) pairs in arr from offset o, at well row r0 / col c0
    hidden function piece(dc as Dc, st, arr as Array<Number>, o, n, r0, c0, t, x0, y0, cs) as Void {
        for (var i = 0; i < n; i++) {
            var r = arr[o + i * 2];
            var c = arr[o + i * 2 + 1];
            var e = 0;
            if (st == 3) {
                e = 15;
                for (var j = 0; j < n; j++) {
                    var rr = arr[o + j * 2];
                    var cc = arr[o + j * 2 + 1];
                    if (rr == r - 1 && cc == c) { e &= 14; }
                    if (rr == r + 1 && cc == c) { e &= 11; }
                    if (rr == r && cc == c - 1) { e &= 7; }
                    if (rr == r && cc == c + 1) { e &= 13; }
                }
            }
            if (cs == C) {
                cell(dc, st, x0 + (c0 + c) * C, y0 + (r0 + r) * C, t, e, false);
            } else {
                mini(dc, st, x0 + (c0 + c) * cs, y0 + (r0 + r) * cs, cs, t);
            }
        }
    }

    // small preview cell
    hidden function mini(dc as Dc, st, x, y, s, t) as Void {
        if (st == 2) {
            dc.setColor(GB[0], -1);
            dc.fillRectangle(x, y, s - 1, s - 1);
            dc.setColor((t == 0 || t == 3) ? GB[3] : GB[2], -1);
            dc.fillRectangle(x + 2, y + 2, s - 5, s - 5);
            return;
        }
        var col = pcol(st, t);
        if (st == 3) {
            dc.setColor(G.dim(col, 0.25), -1);
            dc.fillRectangle(x, y, s - 1, s - 1);
            dc.setColor(col, -1);
            dc.setPenWidth(2);
            dc.drawRectangle(x, y, s - 1, s - 1);
            return;
        }
        dc.setColor(G.mix(col, 0, 0.45), -1);
        dc.fillRectangle(x, y, s - 1, s - 1);
        dc.setColor(col, -1);
        dc.fillRectangle(x, y, s - 3, s - 3);
    }

    // digit v (0..9) cells, only piece pk (0 = all) with offset/rotation
    hidden function digit(dc as Dc, st, v, rb, cb, pk, dr, dcc, rot, ct) as Void {
        var b = v * 15;
        // pivot of the piece (centre of its bounding box)
        var pr = 0;
        var pc = 0;
        if (rot != 0) {
            var r0 = 9;
            var r1 = -1;
            var c0 = 9;
            var c1 = -1;
            for (var i = 0; i < 15; i++) {
                if (DG[b + i] != pk) {
                    continue;
                }
                var r = i / 3;
                var c = i % 3;
                if (r < r0) { r0 = r; }
                if (r > r1) { r1 = r; }
                if (c < c0) { c0 = c; }
                if (c > c1) { c1 = c; }
            }
            pr = (r0 + r1) / 2;
            pc = (c0 + c1) / 2;
        }
        for (var i = 0; i < 15; i++) {
            var id = DG[b + i];
            if (id == 0 || (pk != 0 && id != pk)) {
                continue;
            }
            var r = i / 3;
            var c = i % 3;
            var e = 0;
            if (st == 3) {
                if (r == 0 || DG[b + i - 3] != id) { e |= 1; }
                if (c == 2 || DG[b + i + 1] != id) { e |= 2; }
                if (r == 4 || DG[b + i + 3] != id) { e |= 4; }
                if (c == 0 || DG[b + i - 1] != id) { e |= 8; }
            }
            var rr = r;
            var cc = c;
            if (rot != 0) {
                rr = pr + (c - pc);
                cc = pc - (r - pr);
                e = ((e << 1) | (e >> 3)) & 15;
            }
            var t = DCOL[v * 4 + id - 1];
            cell(dc, st, X0 + (cb + cc + dcc) * C, Y0 + (rb + rr + dr) * C, (t + ct) % 7, e, false);
        }
    }

    // floor rows 13..15 with the shaft hole for piece type k; rows in mask clr are skipped; yo = pixel offset
    hidden function floor(dc as Dc, st, k, seed, clr, yo) as Void {
        var gm = GM[k];
        for (var r = 0; r < 3; r++) {
            if (((clr >> r) & 1) != 0) {
                continue;
            }
            var s = seed + r * 31;
            for (var c = 0; c < 10; c++) {
                s = G.rnd(s);
                var on = true;
                if (c == 4 || c == 5) {
                    on = ((gm >> (r * 2 + c - 4)) & 1) == 1;
                }
                if (on) {
                    var x = X0 + c * C;
                    var y = Y0 + (13 + r) * C + yo;
                    if (st == 3) {
                        dc.setColor(0x1C2230, -1);
                        dc.fillRectangle(x, y, 19, 19);
                        dc.setColor(0x3A4560, -1);
                        dc.fillRectangle(x, y, 19, 2);
                    } else {
                        cell(dc, st, x, y, (s / 65536) % 7, 0, true);
                    }
                }
            }
        }
    }

    // ghost outline of piece type k in the shaft
    hidden function ghost(dc as Dc, st, k, col) as Void {
        dc.setColor(col, -1);
        dc.setPenWidth(st == 2 ? 2 : 1);
        for (var i = 0; i < 4; i++) {
            var r = SH[k * 8 + i * 2];
            var c = SH[k * 8 + i * 2 + 1];
            dc.drawRectangle(X0 + (4 + c) * C + 2, Y0 + (13 + r) * C + 2, 15, 15);
        }
    }

    // colour for the piece in play that differs from the digit pieces next to the shaft top
    hidden function freeCol(c, dv as Array<Number>, ct, on0) as Number {
        for (var n = 0; n < 7; n++) {
            var hit = false;
            for (var r = 0; r < 3; r++) {
                var a = on0 ? DG[dv[0] * 15 + r * 3 + 2] : 0;
                if (a > 0 && (DCOL[dv[0] * 4 + a - 1] + ct) % 7 == c) {
                    hit = true;
                }
                var b = DG[dv[1] * 15 + r * 3];
                if (b > 0 && (DCOL[dv[1] * 4 + b - 1] + ct) % 7 == c) {
                    hit = true;
                }
            }
            if (!hit) {
                return c;
            }
            c = (c + 1) % 7;
        }
        return c;
    }

    hidden function pad(n, l) as String {
        var v = Math.floor(n).toNumber();
        var s = "" + (v < 0 ? 0 : v);
        while (s.length() < l) {
            s = "0" + s;
        }
        return s;
    }

    // persisted record: best score (minute of day) of previous days
    hidden function record(d as D) as Number {
        var dk = d.year * 1000 + d.doy;
        var key = dk * 1440 + d.mins;
        if (key == _rKey) {
            return _hi;
        }
        _rKey = key;
        var hi = St.get("bkHi", 0);
        var bt = St.get("bkT", 0);
        if (St.get("bkD", -1) != dk) {
            if (bt > hi) {
                hi = bt;
                St.set("bkHi", hi);
            }
            bt = 0;
            St.set("bkD", dk);
        }
        if (d.mins > bt) {
            bt = d.mins;
            St.set("bkT", bt);
        }
        _hi = hi;
        return hi;
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var p = a.intro;
        var live = a.live;
        var t = a.t;
        var ct = d.wakeN % 7; // piece colours shift with every raise
        if (_kw != d.wakeN) {
            _kw = d.wakeN;
            _k = [kind(d.wakeN), kind(d.wakeN + 1), kind(d.wakeN + 2)] as Array<Number>;
        }
        var k0 = _k[0];
        var k1 = _k[1];
        var k2 = _k[2];
        var hi = record(d);
        var fg = st == 2 ? GB[0] : 0xFFFFFF;
        var lb = st == 2 ? GB[1] : (st == 3 ? G.dim(d.accent, 0.8) : 0x8A93B0);

        // ---------------- the line-clear sequence after the intro (live only)
        var g = G.clamp(130 - d.h * 4, 45, 130); // ms per row: higher level = faster
        var nf = k0 == 0 ? 12 : 13;
        var tl = 1650 + nf * g; // lock time
        var ph = 0; // 0 waiting, 1 falling, 2 flash, 3 vanish, 4 regrow, 5 done
        if (live && p >= 1) {
            if (t < 1650) {
                ph = 0;
            } else if (t < tl) {
                ph = 1;
            } else if (t < tl + 640) {
                ph = 2;
            } else if (t < tl + 760) {
                ph = 3;
            } else if (t < tl + 1120) {
                ph = 4;
            } else {
                ph = 5;
            }
        } else if (!live) {
            ph = 5;
        }
        _fps = ph >= 5 ? 5 : 20;
        var post = ph >= 4;
        var ka = post ? k1 : k0; // piece in play
        var kn = post ? k2 : k1; // preview
        var hv = d.is24 ? d.h : G.hour(d);
        var dv = [hv / 10, hv % 10, d.m / 10, d.m % 10] as Array<Number>;
        var on0 = d.is24 || hv >= 10;
        var c0 = freeCol((k0 + ct) % 7, dv, ct, on0);
        var cA = freeCol((ka + ct) % 7, dv, ct, on0);

        // ---------------- background
        if (st == 2) {
            dc.setColor(GB[2], -1);
            dc.fillRectangle(0, 0, 454, 454);
        }
        var wp = G.ease(p / 0.2);
        var wh = Math.floor(NR * C * wp).toNumber();
        if (st == 2) {
            // brick walls
            dc.setColor(GB[1], -1);
            dc.fillRectangle(X0 - 12, Y0 + NR * C - wh, 12, wh + 12);
            dc.fillRectangle(X0 + 200, Y0 + NR * C - wh, 12, wh + 12);
            dc.fillRectangle(X0 - 12, Y0 + NR * C, 224, 12);
            dc.setColor(GB[0], -1);
            for (var y = Y0 + NR * C + 6; y > Y0 + NR * C - wh; y -= 10) {
                dc.fillRectangle(X0 - 12, y, 12, 2);
                dc.fillRectangle(X0 + 200, y, 12, 2);
                var o = (((y - Y0) / 10) % 2) * 5;
                dc.fillRectangle(X0 - 6 - o, y - 8, 2, 8);
                dc.fillRectangle(X0 + 205 + o, y - 8, 2, 8);
            }
            for (var x = X0 - 12; x < X0 + 212; x += 14) {
                dc.fillRectangle(x, Y0 + NR * C, 2, 12);
            }
            dc.setColor(GB[3], -1);
            dc.fillRectangle(X0, Y0 + NR * C - wh, 200, wh);
        } else {
            dc.setColor(st == 3 ? 0x05070C : 0x0B1020, -1);
            dc.fillRectangle(X0, Y0 + NR * C - wh, 200, wh);
            // grid
            dc.setColor(st == 3 ? G.dim(d.accent, 0.12) : 0x151C35, -1);
            for (var c = 1; c < 10; c++) {
                dc.fillRectangle(X0 + c * C - 1, Y0 + NR * C - wh, 1, wh);
            }
            for (var r = NR - 1; r > 0; r--) {
                if (r * C > NR * C - wh) {
                    dc.fillRectangle(X0, Y0 + r * C - 1, 200, 1);
                }
            }
            // walls
            if (st == 3) {
                dc.setColor(G.dim(d.accent, 0.35), -1);
                dc.fillRectangle(X0 - 9, Y0 + NR * C - wh, 3, wh + 9);
                dc.fillRectangle(X0 + 206, Y0 + NR * C - wh, 3, wh + 9);
                dc.fillRectangle(X0 - 9, Y0 + NR * C + 6, 218, 3);
                dc.setColor(d.accent, -1);
                dc.fillRectangle(X0 - 4, Y0 + NR * C - wh, 2, wh + 4);
                dc.fillRectangle(X0 + 202, Y0 + NR * C - wh, 2, wh + 4);
                dc.fillRectangle(X0 - 4, Y0 + NR * C + 2, 208, 2);
            } else {
                dc.setColor(0x3A4466, -1);
                dc.fillRectangle(X0 - 8, Y0 + NR * C - wh, 8, wh + 8);
                dc.fillRectangle(X0 + 200, Y0 + NR * C - wh, 8, wh + 8);
                dc.fillRectangle(X0 - 8, Y0 + NR * C, 216, 8);
                dc.setColor(0x6C7AA8, -1);
                dc.fillRectangle(X0 - 8, Y0 + NR * C - wh, 2, wh + 8);
                dc.fillRectangle(X0 + 200, Y0 + NR * C - wh, 2, wh + 8);
                dc.fillRectangle(X0 - 8, Y0 + NR * C, 216, 2);
            }
        }

        // ---------------- floor + shaft
        var fy = ph == 4 ? (tl + 1120 - t) * 3 * C / 360 : 0;
        dc.setClip(X0, Y0, 200, NR * C);
        var fseed = d.wakeN * 13 + (post ? 7 : 0);
        if (ph == 2) {
            // flash the completed rows
            var on = ((t - tl) / 107) % 2 == 0;
            floor(dc, st, k0, d.wakeN * 13, on ? CL[k0] : 0, 0);
            piece(dc, st, SH, k0 * 8, 4, 13, 4, c0, X0, Y0, C);
            if (on) {
                dc.setColor(st == 2 ? GB[3] : 0xFFFFFF, -1);
                for (var r = 0; r < 3; r++) {
                    if (((CL[k0] >> r) & 1) != 0) {
                        dc.fillRectangle(X0, Y0 + (13 + r) * C, 200, 19);
                    }
                }
            }
            dc.setColor(fg, -1);
            F.px(dc, CL[k0] == 7 ? "DREIFACH!" : "DOPPEL!", 227, Y0 + 12, 2, 1, 0);
        } else if (ph == 3) {
            dc.setColor(fg, -1);
            F.px(dc, CL[k0] == 7 ? "DREIFACH!" : "DOPPEL!", 227, Y0 + 12, 2, 1, 0);
        } else {
            floor(dc, st, ka, fseed, 0, fy);
            if (ph != 4) {
                var pl = p >= 1 ? 1.0 : G.clamp((p - 0.85) / 0.1, 0.0, 1.0);
                ghost(dc, st, ka, st == 2 ? GB[1] : G.dim(pcol(st, cA), (live && ph == 5) ? 0.35 + 0.2 * Math.sin(t / 300.0) : 0.45 * pl));
            }
        }
        // piece in play
        if (ph == 1) {
            var n = (t - 1650) / g;
            piece(dc, st, SH, k0 * 8, 4, 13 - nf + (n < nf ? n : nf), 4, c0, X0, Y0, C);
        } else if (ph != 2 && ph != 3 && p > 0.86) {
            // waiting at the spawn: during idle it sometimes tries the flat orientation
            var flat = live && ph == 5 && (t - tl) % 2600 > 1900;
            if (flat) {
                piece(dc, st, SP, ka * 8, 4, 0, 3, cA, X0, Y0, C);
            } else {
                piece(dc, st, SH, ka * 8, 4, ka == 0 ? 1 : 0, 4, cA, X0, Y0, C);
            }
        }

        // ---------------- time digits (pieces rain into place during the intro)
        var N = 0;
        for (var i = 0; i < 4; i++) {
            if (i > 0 || on0) {
                N += DN[dv[i]];
            }
        }
        var k = 0;
        // build order: minutes first (bottom of the stack), each digit bottom piece first
        for (var j = 0; j < 4; j++) {
            var i = (j + 2) % 4;
            if (i == 0 && !on0) {
                continue;
            }
            var v = dv[i];
            var rb = i < 2 ? 2 : 8;
            var cb = i % 2 == 0 ? 1 : 6;
            if (p >= 1) {
                digit(dc, st, v, rb, cb, 0, 0, 0, 0, ct);
                k += DN[v];
                continue;
            }
            for (var pk = DN[v]; pk >= 1; pk--) {
                var q = G.clamp((p - 0.04 - (k * 0.5) / N) / 0.4, 0.0, 1.0);
                k++;
                if (q <= 0) {
                    continue;
                }
                var s = G.rnd(d.wakeN * 31 + k * 17);
                var dr = 0;
                var dcc = 0;
                var rot = 0;
                if (q < 1) {
                    dr = -Math.floor((1 - q) * (rb + 9)).toNumber();
                    var sd = ((s / 4096) % 5) - 2;
                    dcc = q < 0.6 ? Math.floor(sd * (1 - q / 0.6) + 0.5).toNumber() : 0;
                    rot = (q < 0.45 && (s / 256) % 3 != 0) ? 1 : 0;
                }
                digit(dc, st, v, rb, cb, pk, dr, dcc, rot, ct);
            }
        }
        dc.clearClip();

        // ---------------- panels
        var pp = G.ease(G.stag(p, 0, 0, 0.5));
        var lc = st == 2 ? lb : G.mix(0x000000, lb, pp);
        var vc = st == 2 ? fg : G.mix(0x000000, fg, pp);
        var xl = X0 - 16;
        var xr = X0 + 216;
        var ys = [116, 168, 220, 272];
        var lines = (ph >= 4 || !live) ? d.glances : (d.glances > 1 ? d.glances - 1 : 0);
        var lbl = ["PUNKTE", "LEVEL", "REIHEN", "REKORD"];
        var best = hi > d.mins ? hi : d.mins;
        var neu = hi > 0 && d.mins > hi;
        var val = [pad(d.mins * G.ease(p / 0.9), 5), "" + d.h, "" + lines, pad(best, 5)];
        for (var i = 0; i < 4; i++) {
            dc.setColor(lc, -1);
            F.px(dc, (i == 3 && neu) ? "NEU!" : lbl[i], xl, ys[i], 2, 2, 0);
            dc.setColor((i == 3 && neu) ? (st == 2 ? GB[1] : d.accent) : vc, -1);
            F.px(dc, val[i], xl, ys[i] + 18, 3, 2, 0);
        }
        // next piece
        dc.setColor(lc, -1);
        F.px(dc, "NÄCHST", xr, ys[0], 2, 0, 0);
        var by = ys[0] + 20;
        if (st == 2) {
            dc.setColor(GB[3], -1);
            dc.fillRectangle(xr, by, 70, 44);
            dc.setColor(GB[0], -1);
            dc.setPenWidth(2);
            dc.drawRectangle(xr, by, 70, 44);
        } else {
            dc.setColor(st == 3 ? 0x05070C : 0x0B1020, -1);
            dc.fillRectangle(xr, by, 70, 44);
            dc.setColor(st == 3 ? G.dim(d.accent, 0.5) : 0x3A4466, -1);
            dc.setPenWidth(2);
            dc.drawRectangle(xr, by, 70, 44);
        }
        var nw = kn == 0 ? 4 : (kn == 1 ? 2 : 3);
        var nh = kn == 0 ? 1 : 2;
        if (pp > 0.3) {
            piece(dc, st, SP, kn * 8, 4, 0, 0, (kn + ct) % 7, xr + 1 + (70 - nw * 14) / 2, by + 2 + (44 - nh * 14) / 2, 14);
        }
        // slots
        for (var i = 0; i < 3; i++) {
            var sl = d.slots[i];
            var y = ys[1] + 20 + i * 50;
            dc.setColor(lc, -1);
            F.px(dc, sl[:lbl] as String, xr, y, 2, 0, 0);
            dc.setColor(st == 2 ? fg : G.mix(0x000000, d.dcol, pp), -1);
            F.px(dc, sl[:val] as String, xr, y + 18, 3, 0, 0);
        }
        // date
        dc.setColor(st == 2 ? GB[0] : G.mix(0x000000, st == 3 ? d.accent : 0xC8CFE6, pp), -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 42, 2, 1, 0);
        dc.setColor(lc, -1);
        F.px(dc, "BLOCKFALL", 227, 404, 2, 1, 0);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var x0 = X0 + o[0];
        var y0 = Y0 + o[1];
        var col = st == 2 ? 0x5F7A2A : G.dim(st == 3 ? d.accent : 0x9AA6D0, 0.7);
        // well outline
        dc.setColor(G.dim(col, 0.6), -1);
        dc.fillRectangle(x0 - 4, y0, 2, NR * C + 2);
        dc.fillRectangle(x0 + 202, y0, 2, NR * C + 2);
        dc.fillRectangle(x0 - 4, y0 + NR * C + 2, 208, 2);
        // digit pieces as outlines
        var hv = d.is24 ? d.h : G.hour(d);
        var dv = [hv / 10, hv % 10, d.m / 10, d.m % 10];
        dc.setColor(col, -1);
        for (var i = 0; i < 4; i++) {
            if (i == 0 && !d.is24 && hv < 10) {
                continue;
            }
            var b = dv[i] * 15;
            var xb = x0 + (i % 2 == 0 ? 1 : 6) * C;
            var yb = y0 + (i < 2 ? 2 : 8) * C;
            for (var j = 0; j < 15; j++) {
                var id = DG[b + j];
                if (id == 0) {
                    continue;
                }
                var r = j / 3;
                var c = j % 3;
                var x = xb + c * C;
                var y = yb + r * C;
                if (r == 0 || DG[b + j - 3] != id) { dc.fillRectangle(x, y, 19, 2); }
                if (r == 4 || DG[b + j + 3] != id) { dc.fillRectangle(x, y + 17, 19, 2); }
                if (c == 0 || DG[b + j - 1] != id) { dc.fillRectangle(x, y, 2, 19); }
                if (c == 2 || DG[b + j + 1] != id) { dc.fillRectangle(x + 17, y, 2, 19); }
            }
        }
        dc.setColor(G.dim(col, 0.8), -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227 + o[0], 42 + o[1], 2, 1, 0);
    }
}
