import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// BLICK — "Blick-Zähler": a playful game about your own glances. An eye opens on every
// wrist raise, looks around, focuses on you and counts the look (+1). Badges for 10/25/50/
// 100/200 looks a day, yesterday's total, the weekly record, time since the last look and
// the average rhythm. Every 7th look it winks, at night (22-6) it is sleepy.
// Styles: 1 Auge (vector eye), 2 Pixel (8-bit eye), 3 Minimal (ring of glance dots).
// Mirrors web/js/faces/blick.js.
class FaceBlick extends Face {
    const TH = [10, 25, 50, 100, 200];
    const BN = ["NEUGIERIG", "ZEITWÄCHTER", "UHREN-FAN", "SÜCHTIG?", "DIGITAL-DETOX!"];
    const BL = ["Neugierig", "Zeitwächter", "Uhren-Fan", "Süchtig?", "Detox"];
    const TC = [0xCD7F32, 0xC9D1D9, 0xFFC93C, 0xFF8A3D, 0xFF3B5C];
    // 7x7 badge icons (bit 6 = left): eye, clock, heart, question mark, moon
    const ICO = [
        0x1C, 0x22, 0x49, 0x5D, 0x49, 0x22, 0x1C,
        0x3E, 0x41, 0x49, 0x49, 0x47, 0x41, 0x3E,
        0x36, 0x7F, 0x7F, 0x7F, 0x3E, 0x1C, 0x08,
        0x3E, 0x63, 0x03, 0x0E, 0x0C, 0x00, 0x0C,
        0x1E, 0x38, 0x70, 0x70, 0x70, 0x38, 0x1E
    ];
    const NE = 16; // eye outline segments
    // veins: polylines relative to the eye centre (x, y pairs, 4 points each)
    const VN = [-110, 2, -94, -6, -78, -2, -64, -12, -108, 6, -96, 14, -82, 10, -68, 20, 110, 0, 96, 6, 84, 0, 68, 8, 109, -4, 98, -14, 88, -10, 70, -20];
    const PRE = 1500; // intro look-around ends
    const SAC = 1300; // ambient saccade period

    hidden var _fu as Array<Float>; // upper lid shape 0..1 over the eye width
    hidden var _fl as Array<Float>; // lower lid shape
    hidden var _sKey = -1;
    hidden var _S = [-1, 0, -1, -1] as Array<Number>;

    function initialize() {
        Face.initialize();
        _fu = new [NE + 1] as Array<Float>;
        _fl = new [NE + 1] as Array<Float>;
        for (var i = 0; i <= NE; i++) {
            var t = -1 + 2.0 * i / NE;
            _fu[i] = Math.pow(1 - t * t, 0.75).toFloat();
            _fl[i] = (1 - t * t).toFloat();
        }
    }

    function fps() as Number {
        return 10;
    }

    hidden function gi(k as String, def as Number) as Number {
        var v = St.get(k, def);
        return v instanceof Number ? v as Number : def;
    }

    // persistent glance stats -> [yesterday, 7-day record, unix of previous look, minute of first look today]
    hidden function sync(d as D) as Array<Number> {
        var dn = (d.unix + d.tz * 60) / 86400;
        var key = d.wakeN * 3 + dn * 7919 + d.glances * 131;
        if (key == _sKey) {
            return _S;
        }
        _sKey = key;
        var lastDn = gi("bkDn", -1);
        if (lastDn != dn) {
            var last = gi("bkCnt", 0);
            St.set("bkY", lastDn == dn - 1 ? last : (lastDn < 0 ? -1 : 0));
            St.set("bkDn", dn);
            St.set("bkFirst", d.glances <= 1 ? d.mins : -1);
        }
        if (gi("bkCnt", -1) != d.glances) {
            St.set("bkCnt", d.glances);
        }
        var wv = St.get("bkW", null);
        var w;
        if (wv instanceof Array && (wv as Array).size() == 14) {
            w = wv as Array;
        } else {
            w = [-1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0];
        }
        var sl = (dn % 7) * 2;
        if (w[sl] != dn || w[sl + 1] != d.glances) {
            w[sl] = dn;
            w[sl + 1] = d.glances;
            St.set("bkW", w);
        }
        var rec = 0;
        for (var i = 0; i < 7; i++) {
            var wd = w[i * 2] as Number;
            var wc = w[i * 2 + 1] as Number;
            if (wd > dn - 7 && wd <= dn && wc > rec) {
                rec = wc;
            }
        }
        if (gi("bkN", -1) != d.wakeN) {
            St.set("bkPrev", gi("bkCur", -1));
            St.set("bkCur", d.unix);
            St.set("bkN", d.wakeN);
        }
        _S = [gi("bkY", -1), rec, gi("bkPrev", -1), gi("bkFirst", -1)] as Array<Number>;
        return _S;
    }

    hidden function tier(n) as Number {
        var t = -1;
        for (var i = 0; i < 5; i++) {
            if (n >= TH[i]) {
                t = i;
            }
        }
        return t;
    }

    // gaze target of the k-th ambient saccade: [x, y] in -1..1 (often straight at you)
    hidden function tgt(k, seed) as Array {
        if (k < 0) {
            return [0.0, 0.0];
        }
        var r = G.rnd(seed + k * 7919);
        if (r % 5 < 2) {
            return [0.0, 0.0];
        }
        return [((r >> 4) % 100) / 100.0 * 1.5 - 0.75, ((r >> 11) % 100) / 100.0 * 0.9 - 0.45];
    }

    // gaze [x, y] at time ms
    hidden function look(ms, seed, nt) as Array {
        if (ms < 600 || (ms >= 99999 && !nt)) {
            return [0.0, 0.0];
        }
        if (nt) {
            return [0.35 * Math.sin(ms / 1700.0), 0.25];
        }
        if (ms < PRE) {
            // look left, right, then straight at the viewer
            var k = (ms - 600) / 300.0;
            var i = Math.floor(k).toNumber();
            var f = G.easeInOut((k - i) * 3);
            var P = [0.0, -0.8, 0.8, 0.0];
            return [G.lerp(P[i], P[i + 1], f), -0.15 * Math.sin(k * 1.047)];
        }
        var k = (ms - PRE) / SAC;
        var a = tgt(k - 1, seed);
        var b = tgt(k, seed);
        var f = G.ease((ms - PRE - k * SAC) / 140.0);
        return [G.lerp(a[0], b[0], f), G.lerp(a[1], b[1], f)];
    }

    // lid opening 0..1 at time ms (intro opening, blinks, the 7th-look wink, sleepy at night)
    hidden function lid(ms, seed, nt, wink) {
        var op = 1.0;
        if (ms < 550) {
            op = G.spring(ms / 550.0);
            if (op > 1.06) {
                op = 1.06;
            }
        }
        if (nt) {
            op *= 0.42 + 0.05 * Math.sin(ms / 900.0);
        }
        if (wink && ms >= 1650 && ms < 2450) {
            var w = (ms - 1650) / 800.0;
            op *= w < 0.25 ? 1 - w / 0.25 : (w < 0.6 ? 0 : (w - 0.6) / 0.4);
        } else if (ms > 2600 && ms < 99999) {
            var ph = (ms - 2600 + (seed % 1500)) % (nt ? 2600 : 3900);
            if (ph < 240) {
                var c = ph / 240.0;
                op *= c < 0.4 ? 1 - c / 0.4 : (c - 0.4) / 0.6;
            }
        }
        return op;
    }

    hidden function icon(dc as Dc, k, x, y, sc) as Void {
        for (var r = 0; r < 7; r++) {
            var b = ICO[k * 7 + r];
            if (b == 0) {
                continue;
            }
            var c = 0;
            while (c < 7) {
                if ((b & (64 >> c)) != 0) {
                    var e = c + 1;
                    while (e < 7 && (b & (64 >> e)) != 0) {
                        e++;
                    }
                    dc.fillRectangle(x + c * sc, y + r * sc, (e - c) * sc, sc);
                    c = e;
                } else {
                    c++;
                }
            }
        }
    }

    // medal: tier-coloured disc with a dark icon
    hidden function medal(dc as Dc, t, x, y) as Void {
        dc.setColor(G.dim(TC[t], 0.45), -1);
        dc.fillCircle(x, y, 13);
        dc.setColor(TC[t], -1);
        dc.fillCircle(x, y, 11);
        dc.setColor(0x141414, -1);
        icon(dc, t, x - 7, y - 7, 2);
    }

    // sub line: a different remark on every look
    hidden function remark(d as D, n, S as Array<Number>, nt, wink) as String {
        if (nt) {
            return "Schlaf jetzt!";
        }
        if (wink) {
            return "jeder 7. Blick: Zwinker!";
        }
        var k = d.wakeN % 4;
        if (k == 1 && S[0] > 0) {
            return n > S[0] ? (n - S[0]) + " mehr als gestern" : "noch " + (S[0] - n) + " bis gestern";
        }
        if (k == 2 && S[1] > 0) {
            return n >= S[1] ? "neuer Wochenrekord!" : "noch " + (S[1] - n) + " bis zum Rekord";
        }
        if (k == 3) {
            return d.h < 11 ? "Guten Morgen, Späher!" : (d.h < 14 ? "Mittagsblick?" : (d.h < 18 ? "Kurzer Kontrollblick" : "Feierabend-Blick"));
        }
        if (S[2] < 0) {
            return "dein erster Blick heute";
        }
        var m = (d.unix - S[2]) / 60;
        return m < 1 ? "gerade eben geschaut!" : (m < 120 ? "letzter Blick vor " + m + " min" : "letzter Blick vor " + (m / 60) + " h");
    }

    // average minutes between looks today (-1 = unknown)
    hidden function avg(d as D, n, S as Array<Number>) as Number {
        var f = S[3] >= 0 ? S[3] : (d.mins > 360 ? 360 : 0);
        if (n < 2) {
            return -1;
        }
        var v = Math.round((d.mins - f).toFloat() / (n - 1)).toNumber();
        return v < 1 ? -1 : v;
    }

    // vector eye: op lid opening, (lx, ly) gaze, pr pupil radius
    hidden function eye1(dc as Dc, cx, cy, op, lx, ly, pr, acc) as Void {
        var hw = 118;
        var hU = 58;
        var hL = 44;
        var xs = new [NE + 1];
        var yU = new [NE + 1];
        var yL = new [NE + 1];
        for (var i = 0; i <= NE; i++) {
            xs[i] = cx - hw + 2.0 * hw * i / NE;
            yL[i] = cy + hL * _fl[i];
            yU[i] = cy + hL * _fl[i] - (hU * _fu[i] + hL * _fl[i]) * op;
        }
        if (op > 0.04) {
            var pts = new [2 * NE + 2];
            for (var i = 0; i <= NE; i++) {
                pts[i] = [xs[i], yU[i]];
                pts[2 * NE + 1 - i] = [xs[i], yL[i]];
            }
            dc.setColor(0xCFC6B8, -1);
            dc.fillPolygon(pts as Array<Graphics.Point2D>);
            dc.setColor(0xECE6DC, -1);
            dc.fillEllipse(cx + lx * 18, cy - 2 + (1 - op) * 26, 88, 36 * op);
            // veins
            dc.setColor(0xC06A62, -1);
            dc.setPenWidth(1);
            for (var v = 0; v < 4; v++) {
                for (var j = 0; j < 3; j++) {
                    var o = v * 8 + j * 2;
                    dc.drawLine(cx + VN[o], cy + VN[o + 1], cx + VN[o + 2], cy + VN[o + 3]);
                }
            }
            // tear duct
            dc.setColor(0xD98A86, -1);
            dc.fillEllipse(cx - hw + 11, cy + 3, 7, 5);
            // iris
            var ix = cx + lx * 52;
            var iy = cy + ly * 20 - 2;
            dc.setColor(G.mix(acc, 0x000000, 0.6), -1);
            dc.fillCircle(ix, iy, 43);
            dc.setColor(G.mix(acc, 0x000000, 0.15), -1);
            dc.fillCircle(ix, iy, 39);
            dc.setPenWidth(2);
            var cA = G.mix(acc, 0xFFFFFF, 0.35);
            var cB = G.mix(acc, 0x000000, 0.4);
            for (var k = 0; k < 12; k++) {
                var a = k * 30 + 7;
                dc.setColor(k % 2 == 0 ? cA : cB, -1);
                dc.drawLine(G.ptX(ix, pr + 3, a), G.ptY(iy, pr + 3, a), G.ptX(ix, 36, a + 8), G.ptY(iy, 36, a + 8));
            }
            dc.setColor(G.mix(acc, 0xFFFFFF, 0.2), -1);
            dc.setPenWidth(3);
            dc.drawCircle(ix, iy, pr + 5);
            dc.setColor(0x050505, -1);
            dc.fillCircle(ix, iy, pr);
            dc.setColor(0xFFFFFF, -1);
            dc.fillCircle(ix - 14, iy - 15, 7);
            dc.setColor(0xBDBDBD, -1);
            dc.fillCircle(ix + 12, iy + 10, 3);
            // lids: mask everything outside the eye opening
            var top = new [NE + 3];
            var bot = new [NE + 3];
            for (var i = 0; i <= NE; i++) {
                top[i] = [xs[i], yU[i]];
                bot[i] = [xs[i], yL[i]];
            }
            top[NE + 1] = [cx + hw + 4, cy - hU - 12];
            top[NE + 2] = [cx - hw - 4, cy - hU - 12];
            bot[NE + 1] = [cx + hw + 4, cy + hL + 26];
            bot[NE + 2] = [cx - hw - 4, cy + hL + 26];
            dc.setColor(0x000000, -1);
            dc.fillPolygon(top as Array<Graphics.Point2D>);
            dc.fillPolygon(bot as Array<Graphics.Point2D>);
        }
        // crease, lower lid, upper lid + lashes
        dc.setPenWidth(2);
        dc.setColor(0x4A423C, -1);
        for (var i = 3; i < NE - 3; i += 2) {
            dc.drawLine(xs[i], yU[i] - 16 * _fu[i] - 4, xs[i + 2], yU[i + 2] - 16 * _fu[i + 2] - 4);
        }
        dc.setColor(0x8A7D72, -1);
        for (var i = 0; i < NE; i += 2) {
            dc.drawLine(xs[i], yL[i], xs[i + 2], yL[i + 2]);
        }
        dc.setColor(0xF2E6D8, -1);
        dc.setPenWidth(5);
        for (var i = 0; i < NE; i++) {
            dc.drawLine(xs[i], yU[i], xs[i + 1], yU[i + 1]);
        }
        dc.setPenWidth(3);
        var dn = op < 0.25 ? 1 : -1; // closed: lashes hang down
        for (var i = 3; i <= 13; i += 2) {
            var t = -1 + 2.0 * i / NE;
            dc.drawLine(xs[i], yU[i], xs[i] + t * 12, yU[i] + dn * (13 - t.abs() * 4));
        }
    }

    // sclera half width (cells) of pixel-eye row j (0..13)
    hidden function rowW(j) as Number {
        var v = ((j + 0.5 - 7) / 7.0).abs();
        return v >= 1 ? 3 : Math.round(15 * Math.sqrt(1 - v * 0.98)).toNumber();
    }

    // one clipped run of cells [c0, c1) in pixel-eye row y
    hidden function run(dc as Dc, cx, y, c0, c1, hw, P) as Void {
        if (c0 < -hw) {
            c0 = -hw;
        }
        if (c1 > hw) {
            c1 = hw;
        }
        if (c1 > c0) {
            dc.fillRectangle(cx + c0 * P, y, (c1 - c0) * P, P);
        }
    }

    // 8-bit eye on a 7 px grid: 30 x 14 cells
    hidden function eye2(dc as Dc, cx, cy, op, lx, ly, acc) as Void {
        var P = 7;
        var y0 = cy - 7 * P;
        var o = G.clamp(op, 0.0, 1.0);
        var jT = Math.round(G.lerp(11, 0, o)).toNumber();
        var jB = 13 - Math.round(3 * (1 - o)).toNumber();
        var icx = Math.round(lx * 7).toNumber();
        var icy = Math.round(ly * 2).toNumber();
        var skin = 0xF6C08A;
        var dark = G.mix(acc, 0x000000, 0.5);
        var lite = G.mix(acc, 0xFFFFFF, 0.4);
        for (var j = jT; j <= jB; j++) {
            var hw = rowW(j);
            var y = y0 + j * P;
            dc.setColor(skin, -1);
            dc.fillRectangle(cx - (hw + 1) * P, y, P, P);
            dc.fillRectangle(cx + hw * P, y, P, P);
            dc.setColor(j == jT ? 0xC8BEB0 : 0xF4F0E8, -1);
            dc.fillRectangle(cx - hw * P, y, hw * 2 * P, P);
            // iris (radius 6 cells), pupil, glint
            var gy = j + 0.5 - 7 - icy;
            var dy = gy.abs();
            if (dy < 6) {
                var iw = dy < 2 ? 6 : (dy < 4 ? 5 : (dy < 5 ? 4 : 2));
                dc.setColor(dark, -1);
                run(dc, cx, y, icx - iw, icx + iw, hw, P);
                if (dy < 4) {
                    dc.setColor(acc, -1);
                    run(dc, cx, y, icx - iw + 1, icx + iw - 1, hw, P);
                    if (gy > 1) {
                        dc.setColor(lite, -1);
                        run(dc, cx, y, icx + 1, icx + iw - 1, hw, P);
                    }
                }
                if (dy < 2) {
                    dc.setColor(0x000000, -1);
                    run(dc, cx, y, icx - 2, icx + 2, hw, P);
                }
                if (gy > -2 && gy < 0) {
                    dc.setColor(0xFFFFFF, -1);
                    run(dc, cx, y, icx - 2, icx - 1, hw, P);
                }
            }
        }
        // upper lid (+ lashes; they hang down when closed), lower lid
        var closed = jT > jB;
        var jl = closed ? 11 : jT - 1;
        var hl = rowW(jl) + 1;
        dc.setColor(skin, -1);
        dc.fillRectangle(cx - hl * P, y0 + jl * P, hl * 2 * P, P);
        var yl = closed ? y0 + (jl + 1) * P : y0 + (jl - 1) * P;
        for (var k = -2; k <= 2; k++) {
            dc.fillRectangle(cx + k * 5 * P - (k < 0 ? P : 0), yl, P, P);
        }
        if (!closed) {
            var hb = rowW(jB + 1);
            dc.setColor(0xC98A5E, -1);
            dc.fillRectangle(cx - hb * P, y0 + (jB + 1) * P, hb * 2 * P, P);
        }
    }

    // minimal eye icon (almond outline + dot)
    hidden function eye3(dc as Dc, cx, cy, op, lx, col) as Void {
        var hw = 34;
        dc.setPenWidth(3);
        dc.setColor(col, -1);
        var px = 0.0;
        var pu = 0.0;
        var pl = 0.0;
        for (var i = 0; i <= NE; i += 2) {
            var x = cx - hw + 2.0 * hw * i / NE;
            var yl = cy + 12 * _fl[i];
            var yu = yl - (16 * _fu[i] + 12 * _fl[i]) * op;
            if (i > 0) {
                dc.drawLine(px, pl, x, yl);
                dc.drawLine(px, pu, x, yu);
            }
            px = x;
            pu = yu;
            pl = yl;
        }
        if (op > 0.3) {
            dc.fillCircle(cx + lx * 12, cy - 2, 7 * op);
        }
    }

    // static layer: ring, time, stats, badges; the counter, the eye and its moods move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var SL = !a.bg; // draw the static parts (S is the stats here)
        var ML = !a.so; // draw the moving parts
        var st = d.cfg.style;
        var acc = d.accent;
        var live = a.live;
        var ms = live ? a.t : 99999;
        var n = d.glances < 0 ? 0 : d.glances;
        var S = sync(d);
        var nt = d.h >= 22 || d.h < 6;
        var wink = n > 0 && n % 7 == 0 && !nt;
        var seed = d.wakeN * 131 + 7;
        var op = lid(ms, seed, nt, wink);
        var lk = look(ms, seed, nt);
        var t = tier(n);
        var cnt = (ms < 950 && n > 0) ? n - 1 : n;
        var pop = (ms >= 950 && ms < 1950) ? (ms - 950) / 1000.0 : -1.0;
        var sp = G.ease(ms / 1400.0);
        var ts = G.timeStr(d);
        var rem = remark(d, n, S, nt, wink);
        var av = avg(d, n, S);
        // next badge line
        var nx = t < 4 ? "noch " + (TH[t + 1] - n) + " bis " + BL[t + 1] : "Digital-Detox empfohlen";
        var lo = t < 0 ? 0 : TH[t];
        var fr = t < 4 ? (n - lo).toFloat() / (TH[t + 1] - lo) : 1.0;
        var stV = [S[0] < 0 ? "--" : "" + S[0], "" + (S[1] > n ? S[1] : n), av < 0 ? "--" : av + "'"];
        var stL = ["GESTERN", "REKORD", "TAKT"];

        if (st == 3) {
            // ---- Minimal: ring of glance dots (60 per ring, 3 rings)
            if (SL) {
                var shown = (G.clamp(ms / 900.0, 0.0, 1.0) * cnt).toNumber();
                dc.setColor(0x262626, -1);
                for (var i = 0; i < 60; i++) {
                    if (i < shown) {
                        continue;
                    }
                    dc.fillRectangle(G.ptX(227, 213, i * 6) - 1, G.ptY(227, 213, i * 6) - 1, 2, 2);
                }
                dc.setColor(G.dim(acc, 0.6), -1);
                for (var i = 0; i < shown && i < 180; i++) {
                    var r = 213 - (i / 60) * 10;
                    dc.fillCircle(G.ptX(227, r, (i % 60) * 6), G.ptY(227, r, (i % 60) * 6), 3);
                }
                // next badge target on the ring
                if (t < 4 && TH[t + 1] <= 180) {
                    var i = TH[t + 1] - 1;
                    var r = 213 - (i / 60) * 10;
                    dc.setColor(TC[t + 1], -1);
                    dc.setPenWidth(2);
                    dc.drawCircle(G.ptX(227, r, (i % 60) * 6), G.ptY(227, r, (i % 60) * 6), 6);
                }
            }
            // the current look glows
            if (ML && n > 0 && ms >= 950) {
                var i = n - 1 < 179 ? n - 1 : 179;
                var r = 213 - (i / 60) * 10;
                var x = G.ptX(227, r, (i % 60) * 6);
                var y = G.ptY(227, r, (i % 60) * 6);
                var pu = live ? 0.5 + 0.5 * Math.sin(a.t / 260.0) : 1.0;
                var g = pop >= 0 ? G.spring(pop * 2.5) : 1.0;
                dc.setColor(G.dim(acc, 0.22 + 0.15 * pu), -1);
                dc.fillCircle(x, y, 11 * g);
                dc.setColor(acc, -1);
                dc.fillCircle(x, y, 6 * g);
                dc.setColor(G.mix(acc, 0xFFFFFF, 0.7), -1);
                dc.fillCircle(x, y, 2.5 * g);
            }
            if (ML) {
                eye3(dc, 227, 112, op, lk[0], nt ? G.dim(acc, 0.7) : 0x9A9A9A);
            }
            dc.setColor(d.dcol, -1);
            if (SL) {
                F.st(dc, ts, 227, 188, 78, 8, 1, G.easeInOut(ms / 900.0), 0);
            }
            var ch = pop >= 0 ? 48 * (1 + 0.3 * (1 - G.ease(pop * 2.5))) : 48;
            dc.setColor(acc, -1);
            if (ML) {
                F.st(dc, "" + cnt, 227, 270, ch, 6, 1, 1.0, 0);
            }
            if (pop >= 0 && ML) {
                dc.setColor(G.dim(acc, 1 - pop), -1);
                F.st(dc, "+1", 227 + F.stW("" + n, 48) / 2 + 28, 260 - pop * 30, 20, 3, 1, 1.0, 0);
            }
            if (!SL) {
                return;
            }
            dc.setColor(0x777777, -1);
            F.px(dc, "BLICKE HEUTE", 227, 302, 2, 1, 0);
            if (sp > 0.5) {
                dc.setColor(nt ? acc : (t >= 0 ? TC[t] : 0x777777), -1);
                F.px(dc, nt ? "Schlaf jetzt!" : (t >= 0 ? BN[t] : "NOCH KEIN ABZEICHEN"), 227, 326, 2, 1, 0);
                dc.setColor(0x5A5A5A, -1);
                F.px(dc, "gestern " + stV[0] + "  Rekord " + stV[1], 227, 348, 2, 1, 0);
            }
            return;
        }

        if (SL) {
            // ---- progress ring to the next badge
            if (st == 1) {
                G.ring(dc, 227, 227, 221, 3, fr * sp, G.dim(t < 4 ? TC[t + 1] : TC[4], 0.75), 0x161616);
            } else {
                var lit = (fr * sp * 60).toNumber();
                var cr = G.dim(t < 4 ? TC[t + 1] : TC[4], 0.8);
                for (var i = 0; i < 60; i++) {
                    dc.setColor(i < lit ? cr : 0x1C1C1C, -1);
                    dc.fillRectangle(Math.round(G.ptX(227, 217, i * 6)) - 2, Math.round(G.ptY(227, 217, i * 6)) - 2, 5, 5);
                }
            }
        }
        if (ML) {
            // ---- headline: BLICK #24 (+1 pop)
            var num = "#" + cnt;
            var ns = pop >= 0 ? 1 + 0.35 * (1 - G.ease(pop * 2.5)) : 1.0;
            if (st == 1) {
                var h = 26;
                var w1 = F.stW("BLICK ", h);
                var w2 = F.stW(num, h);
                var x0 = 227 - (w1 + w2 + 22.0 * h / 80) / 2;
                dc.setColor(0xD0D0D0, -1);
                F.st(dc, "BLICK", x0, 58, h, 4, 0, 1.0, 0);
                dc.setColor(acc, -1);
                F.st(dc, num, x0 + w1 + 22.0 * h / 80 + w2 / 2, 58, h * ns, 4, 1, 1.0, 0);
                if (pop >= 0) {
                    dc.setColor(G.dim(acc, 1 - pop), -1);
                    F.st(dc, "+1", x0 + w1 + w2 + 34, 54 - pop * 22, 16, 3, 1, 1.0, 0);
                }
            } else {
                var sc = 4;
                var w = F.pxW("BLICK " + num, sc);
                var x0 = 227 - w / 2;
                dc.setColor(0xE8E8E8, -1);
                F.px(dc, "BLICK", x0, 34, sc, 0, 0);
                dc.setColor(acc, -1);
                F.px(dc, num, x0 + 6 * 6 * sc, 34 - (ns > 1 ? Math.round((ns - 1) * 20).toNumber() : 0), sc, 0, 0);
                if (pop >= 0) {
                    dc.setColor(G.dim(acc, 1 - pop), -1);
                    F.px(dc, "+1", 227 - 17, 72 - Math.round(pop * 10).toNumber(), 3, 0, 0);
                }
            }
            // remark
            dc.setColor((nt || wink) ? acc : 0x8A8A8A, -1);
            if (!(st == 2 && pop >= 0)) {
                F.px(dc, rem, 227, st == 1 ? 76 : 72, 2, 1, 0);
            }

            // ---- the eye (over the cached time it must stay above the digits)
            if (!SL) {
                dc.setClip(0, 0, 454, st == 1 ? 234 : 212);
            }
            if (st == 1) {
                eye1(dc, 227, 170, op, lk[0], lk[1], nt ? 22 : (ms < 1400 ? 21 : 21 - 4 * G.ease((ms - 1400) / 300.0)), acc);
            } else {
                eye2(dc, 227, 150, op, lk[0], lk[1], acc);
            }
            if (!SL) {
                dc.clearClip();
            }
            // sleepy Zzz / wink sparkle
            if (nt) {
                var z = live ? (a.t % 2400) / 2400.0 : 0.5;
                dc.setColor(G.dim(acc, 1 - z * 0.7), -1);
                F.px(dc, "z", 330 + Math.round(z * 18).toNumber(), 118 - Math.round(z * 30).toNumber(), 2, 0, 0);
                F.px(dc, "Z", 346 + Math.round(z * 14).toNumber(), 100 - Math.round(z * 24).toNumber(), 3, 0, 0);
            }
            if (wink && ms >= 2000 && ms < 3200) {
                var k = (ms - 2000) / 1200.0;
                var r = 14 * Math.sin(k * 3.1416);
                dc.setColor(acc, -1);
                dc.fillPolygon([[350, 104 - r], [353, 101], [350 + r, 104], [353, 107], [350, 104 + r], [347, 107], [350 - r, 104], [347, 101]]);
            }
        }
        if (!SL) {
            return;
        }
        // ---- time
        if (st == 1) {
            dc.setColor(d.dcol, -1);
            F.st(dc, ts, 227, 264, 56, 7, 1, G.easeInOut(ms / 900.0), 0);
        } else {
            var w = F.pxW(ts, 7);
            dc.setColor(G.dim(acc, 0.28), -1);
            F.px(dc, ts, 227 - w / 2 + 7, 221, 7, 0, 0);
            dc.setColor(d.dcol, -1);
            F.px(dc, ts, 227 - w / 2, 214, 7, 0, 0);
        }

        // ---- stats: yesterday, record, rhythm
        for (var k = 0; k < 3; k++) {
            var p = G.stag(sp, k, 0.12, 0.5);
            if (p <= 0) {
                continue;
            }
            var x = 227 + (k - 1) * 104;
            dc.setColor(G.dim(0x777777, p), -1);
            F.px(dc, stL[k], x, st == 1 ? 300 : 280, 2, 1, 0);
            dc.setColor(G.mix(0x000000, (k == 1 && n >= S[1] && S[1] > 0) ? acc : d.dcol, p), -1);
            if (st == 1) {
                F.st(dc, stV[k], x, 328, 22, 3, 1, 1.0, 0);
            } else {
                F.px(dc, stV[k], x, 298, 3, 1, 0);
            }
        }

        // ---- badge + next badge
        if (sp > 0.6) {
            var lbl = t >= 0 ? BN[t] : "NOCH KEIN ABZEICHEN";
            var w = F.pxW(lbl, 2) + (t >= 0 ? 34 : 0);
            var x0 = 227 - w / 2;
            if (t >= 0) {
                if (st == 1) {
                    medal(dc, t, x0 + 12, 357);
                } else {
                    dc.setColor(TC[t], -1);
                    icon(dc, t, x0 + 1, 330, 3);
                }
            }
            var by = st == 1 ? 350 : 337;
            dc.setColor(t >= 0 ? TC[t] : 0x777777, -1);
            F.px(dc, lbl, x0 + (t >= 0 ? 34 : 0), by, 2, 0, 0);
            dc.setColor(0x6A6A6A, -1);
            F.px(dc, nx, 227, st == 1 ? 376 : 364, 2, 1, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var acc = d.accent;
        var ox = o[0];
        var oy = o[1];
        var n = d.glances < 0 ? 0 : d.glances;
        var col = G.dim(acc, 0.5);
        // closed eye: lower lid curve with lashes hanging down
        dc.setColor(col, -1);
        if (st == 2) {
            for (var k = -14; k < 14; k += 2) {
                var v = ((k + 1) / 14.0).abs();
                dc.fillRectangle(227 + k * 6 + ox, 150 + Math.round(18 * (1 - v * v)).toNumber() + oy, 12, 4);
            }
            for (var k = -2; k <= 2; k++) {
                dc.fillRectangle(227 + k * 30 - 2 + ox, 172 + oy + Math.round(8 * (1 - k * k / 9.0)).toNumber(), 4, 8);
            }
        } else {
            var hw = st == 3 ? 60 : 100;
            var hh = st == 3 ? 14 : 26;
            dc.setPenWidth(2);
            var px = 0.0;
            var py = 0.0;
            for (var i = 0; i <= NE; i += 2) {
                var x = 227 - hw + 2.0 * hw * i / NE + ox;
                var y = 150 + hh * _fl[i] + oy;
                if (i > 0) {
                    dc.drawLine(px, py, x, y);
                }
                px = x;
                py = y;
            }
            for (var i = 4; i <= 12; i += 2) {
                var tt = -1 + 2.0 * i / NE;
                var x = 227 - hw + 2.0 * hw * i / NE + ox;
                var y = 150 + hh * _fl[i] + oy;
                dc.drawLine(x, y, x + tt * 8, y + 10);
            }
        }
        dc.setColor(0x8A8A8A, -1);
        if (st == 2) {
            F.px(dc, G.timeStr(d), 227 + ox, 214 + oy, 7, 1, 2);
        } else {
            F.st(dc, G.timeStr(d), 227 + ox, 240 + oy, 64, 3, 1, 1.0, 0);
        }
        dc.setColor(col, -1);
        F.px(dc, "BLICK #" + n, 227 + ox, 300 + oy, 2, 1, 0);
    }
}
