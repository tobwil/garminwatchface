import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// GLITCH — the time glitches with your stress level: calm = clean and crisp,
// stressed = RGB split, displaced slices, block artifacts and scanlines.
// Bursts come more often the higher the stress. Styles: 1 RGB, 2 Vaporwave,
// 3 Mono. Mirrors web/js/faces/glitch.js.
class FaceGlitch extends Face {
    const TY = 194;   // time centre
    const TH = 104;   // time cap height

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 15;
    }

    // glitch colours [left ghost, right ghost, core] per style
    hidden function gcol(st, acc, k) {
        if (st == 2) { return k == 0 ? 0xFF4FD8 : (k == 1 ? 0x00F0FF : 0xFFF0FB); }
        if (st == 3) { return k == 0 ? acc : (k == 1 ? G.dim(acc, 0.45) : 0xFFFFFF); }
        return k == 0 ? 0xFF2A4A : (k == 1 ? 0x00E5FF : 0xFFFFFF);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var p = a.intro;
        var t = a.t;
        var cx = 227;
        var acc = d.accent;
        var g = d.stress < 0 ? 0.3 : G.clamp((d.stress - 20) / 60.0, 0.0, 1.0);

        // ---- glitch intensity: steady part + bursts + intro shock
        var slot = a.live ? t / 120 : 3;
        var seed = G.rnd(slot * 977 + 31);
        var burst = 0.0;
        if (a.live && G.rf(seed) < 0.03 + 0.3 * g) {
            seed = G.rnd(seed);
            burst = 0.35 + 0.65 * G.rf(seed);
        }
        var ib = Math.pow(1.0 - p, 1.4);
        var gs = g - 0.12 > 0 ? g - 0.12 : 0.0;
        var k = G.clamp(gs * 0.6 + burst * (0.3 + 0.7 * g) + ib, 0.0, 1.0);

        var c0 = gcol(st, acc, 0);
        var c1 = gcol(st, acc, 1);
        var c2 = gcol(st, acc, 2);

        // ---- vaporwave horizon grid
        if (st == 2) {
            var hz = 372;
            dc.setPenWidth(1);
            dc.setColor(0x6A1FB0, -1);
            for (var j = -7; j <= 7; j++) {
                dc.drawLine(cx + j * 14, hz, cx + j * 70, 454);
            }
            var ph = 0.4;
            if (a.live) {
                var q = t / 1400.0;
                ph = q - Math.floor(q);
            }
            for (var i = 0; i < 5; i++) {
                var f = (i + ph) / 5.0;
                var y = hz + 82 * f * f;
                dc.setColor(G.dim(0x8A2BE2, 0.4 + 0.6 * f), -1);
                dc.drawLine(0, y, 454, y);
            }
            dc.setPenWidth(2);
            dc.setColor(0xFF4FD8, -1);
            dc.drawLine(30, hz, 424, hz);
        }

        // ---- date header
        var tp = G.ease(p * 1.5 - 0.3);
        dc.setColor(G.dim(0x9A9A9A, tp), -1);
        F.px(dc, d.dowStr + " " + d.day + " " + d.monStr + " // KW " + d.wk, cx, 86, 2, 1, 0);
        dc.setColor(G.dim(c0, 0.8 * tp), -1);
        dc.fillRectangle(cx - 60, 108, 120 * tp, 2);

        // ---- time with RGB split + slice displacement
        // HUD corner brackets
        dc.setPenWidth(2);
        dc.setColor(G.dim(0x4A4A4A, tp), -1);
        for (var i = 0; i < 4; i++) {
            var bx = i % 2 == 0 ? 46 : 408;
            var by = i < 2 ? 130 : 258;
            var sx = i % 2 == 0 ? 1 : -1;
            var sy = i < 2 ? 1 : -1;
            dc.drawLine(bx, by, bx + 14 * sx, by);
            dc.drawLine(bx, by, bx, by + 14 * sy);
        }

        var ts = G.timeStr(d);
        var o = k > 0.04 ? 1 + 12 * k : 0;
        var ytop = TY - TH / 2 - 12;
        if (o > 0) {
            dc.setColor(c0, -1);
            F.st(dc, ts, cx - o, TY, TH, 9, 1, 1.0, 0);
            dc.setColor(c1, -1);
            F.st(dc, ts, cx + o, TY + (k > 0.5 ? 2 : 0), TH, 9, 1, 1.0, 0);
            // scanlines through the colour ghosts
            if (k > 0.15) {
                dc.setPenWidth(1);
                dc.setColor(0x000000, -1);
                var sp = k > 0.75 ? 3 : 4;
                for (var y = ytop; y < ytop + TH + 24; y += sp) {
                    dc.drawLine(30, y, 424, y);
                }
            }
        }
        dc.setColor(c2, -1);
        F.st(dc, ts, cx, TY, TH, 9, 1, 1.0, 0);

        if (k > 0.08) {
            var bh = (TH + 24) / 6.0;
            var s2 = G.rnd(seed + 7);
            var shifted = 0;
            var maxs = ib > 0.1 ? 3 : 2;
            for (var b = 0; b < 6 && shifted < maxs; b++) {
                s2 = G.rnd(s2);
                if (G.rf(s2) > k * 0.85) {
                    continue;
                }
                s2 = G.rnd(s2);
                var dx = Math.round((G.rf(s2) - 0.5) * 2 * (6 + 30 * k)).toNumber();
                if (dx > -2 && dx < 2) {
                    continue;
                }
                shifted++;
                var y0 = Math.floor(ytop + b * bh).toNumber();
                var hb = Math.ceil(bh).toNumber();
                dc.setClip(0, y0, 454, hb);
                dc.setColor(0x000000, -1);
                dc.fillRectangle(0, y0, 454, hb);
                dc.setColor(dx < 0 ? c0 : c1, -1);
                F.st(dc, ts, cx + dx * 1.4, TY, TH, 9, 1, 1.0, 0);
                dc.setColor(c2, -1);
                F.st(dc, ts, cx + dx, TY, TH, 9, 1, 1.0, 0);
                dc.clearClip();
            }

            // block artifacts + noise rows
            var nb = (k * 9).toNumber();
            for (var i = 0; i < nb; i++) {
                s2 = G.rnd(s2);
                var bx = 60 + G.rf(s2) * 300;
                s2 = G.rnd(s2);
                var by = 120 + G.rf(s2) * 170;
                s2 = G.rnd(s2);
                var bw = 6 + G.rf(s2) * 46;
                var bhh = 3 + (s2 % 9);
                dc.setColor(i % 4 == 3 ? c2 : (i % 2 == 1 ? c0 : c1), -1);
                dc.fillRectangle(bx, by, bw, bhh);
            }
            if (k > 0.3) {
                s2 = G.rnd(s2);
                dc.setColor(G.dim(c1, 0.5), -1);
                dc.fillRectangle(40, 130 + G.rf(s2) * 150, 374, 1);
            }
        }

        // ---- status line
        var msg = g < 0.34 ? "SYS STABIL" : (g < 0.67 ? "SYS UNRUHIG" : "SYS ÜBERLASTET");
        var scol = g < 0.34 ? (st == 3 ? acc : 0x3CFF9A) : (g < 0.67 ? 0xFFC02E : 0xFF3355);
        var nch = (msg.length() * G.clamp(p * 1.6 - 0.4, 0.0, 1.0)).toNumber();
        if (nch > 0) {
            var s3 = G.rnd(seed + 99);
            var out = "";
            for (var i = 0; i < nch; i++) {
                s3 = G.rnd(s3);
                out += (k > 0.25 && G.rf(s3) < k * 0.3) ? 127.toChar().toString() : msg.substring(i, i + 1);
            }
            var jx = burst > 0 ? Math.round((G.rf(s3) - 0.5) * 10) : 0;
            dc.setColor(scol, -1);
            var wq = F.px(dc, out, cx + jx, 270, 3, 1, 0);
            // blinking cursor
            if (!a.live || (t / 500) % 2 == 0) {
                dc.fillRectangle(cx + jx + wq / 2.0 + 6, 270, 12, 21);
            }
        }

        // ---- data readout (3 slots)
        for (var i = 0; i < 3; i++) {
            var sp = G.stag(p, i, 0.1, 0.45);
            if (sp <= 0) {
                continue;
            }
            var sl = d.slots[i];
            if ((sl[:lbl] as String).length() == 0) {
                continue;
            }
            var y = 312 + i * 21;
            var x = cx - 100;
            dc.setColor(G.dim(c0, sp), -1);
            F.px(dc, ">", x, y, 2, 0, 0);
            dc.setColor(G.dim(0x8A8A8A, sp), -1);
            F.px(dc, sl[:lbl] as String, x + 18, y, 2, 0, 0);
            dc.setColor(G.dim(d.dcol, sp), -1);
            F.px(dc, sl[:val] as String, cx + 100, y, 2, 2, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var ts = G.timeStr(d);
        dc.setColor(G.dim(gcol(d.cfg.style, d.accent, 0), 0.45), -1);
        F.st(dc, ts, 223 + o[0], TY + o[1], TH, 2, 1, 1.0, 0);
        dc.setColor(0x9A9A9A, -1);
        F.st(dc, ts, 227 + o[0], TY + o[1], TH, 3, 1, 1.0, 0);
    }
}
