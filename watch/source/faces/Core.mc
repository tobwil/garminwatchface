import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// CORE — "Energy Core": the round display is a glass tank, Body Battery is the
// liquid level. Waves get choppier with stress, bubbles rise; the lowest and
// highest level of the last 24 h are shown under the value.
// Styles: 1 Plasma, 2 Ozean, 3 Lava. Mirrors web/js/faces/core.js.
class FaceCore extends Face {
    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 20;
    }

    // liquid level (y) for a Body Battery value 0..100
    hidden function lvlY(v) {
        return 446 - v * 4.16;
    }

    // x of the right glass edge at height y (inset by ins)
    hidden function edgeX(y, ins) {
        var dy = y - 227;
        var q = 227 * 227 - dy * dy;
        return 227 + (q > 0 ? Math.sqrt(q) : 0) - ins;
    }

    hidden function pal(st, k) {
        if (st == 2) { return k == 0 ? 0x22D3EE : (k == 1 ? 0x2563EB : 0x5B3FD6); }
        if (st == 3) { return k == 0 ? 0xFFC53D : (k == 1 ? 0xFF6A00 : 0xD0142C); }
        return k == 0 ? 0x29E6FF : (k == 1 ? 0xA6FF4D : 0xFF4A2A);
    }

    hidden function deep(st) {
        return st == 2 ? 0x020A26 : (st == 3 ? 0x240300 : 0x170A40);
    }

    hidden function liqCol(st, bb) {
        var f = G.clamp(bb / 100.0, 0.0, 1.0);
        if (f > 0.5) { return G.mix(pal(st, 1), pal(st, 0), (f - 0.5) * 2); }
        return G.mix(pal(st, 2), pal(st, 1), f * 2);
    }

    hidden function wave(x, t, amp, w, ph) {
        return amp * (0.62 * Math.sin(x * 0.021 + t * w * 0.0021 + ph)
            + 0.38 * Math.sin(x * 0.047 - t * w * 0.0033 + 1.7 + ph)
            + 0.18 * Math.sin(x * 0.113 + t * w * 0.0061 + ph * 2.0));
    }

    hidden function wavePoly(lv, t, amp, w, ph) {
        var pts = new [34] as Array<Array>;
        for (var i = 0; i <= 31; i++) {
            var x = i * 15.2;
            pts[i] = [x, lv + wave(x, t, amp, w, ph)];
        }
        pts[32] = [454.0, 454.0];
        pts[33] = [0.0, 454.0];
        return pts;
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var p = a.intro;
        var t = a.t.toFloat();
        var cx = 227;
        var bb = d.bb < 0 ? 50 : d.bb;
        var sv = d.stress < 0 ? 30 : d.stress;
        var ch = G.clamp((sv - 15) / 70.0, 0.0, 1.0);
        var amp = 5 + 13 * ch;
        var w = 0.5 + 2.2 * ch;
        var c = liqCol(st, bb);
        var target = lvlY(bb);
        // intro: liquid rises with overshoot, sloshing waves
        var rp = G.clamp(p * 1.25 - 0.25, 0.0, 1.0);
        var lv = 454 + (target - 454) * G.spring(rp);
        amp += 26 * (1 - p) * (1 - p);

        // ---- glass back
        dc.setPenWidth(2);
        dc.setColor(0x1C1C1C, -1);
        dc.drawCircle(cx, 227, 224);

        // ---- back wave
        var back = G.dim(G.mix(c, 0x7A3CFF, 0.55), 0.42);
        if (st == 2) { back = G.dim(G.mix(c, 0x0A1A5C, 0.5), 0.55); }
        if (st == 3) { back = G.dim(G.mix(c, 0xFF1E00, 0.5), 0.42); }
        dc.setColor(back, -1);
        dc.fillPolygon(wavePoly(lv - 8, t, amp * 1.2, w * 0.8, 2.3));

        // ---- front wave + depth gradient
        var front = wavePoly(lv, t, amp, w, 0);
        var top = st == 3 ? G.dim(G.mix(c, 0xFF2000, 0.45), 0.42) : G.dim(c, 0.40);
        dc.setColor(top, -1);
        dc.fillPolygon(front);
        var y0 = lv + amp * 1.25 + 10;
        if (y0 < 454) {
            var step = (454 - y0) / 8.0;
            for (var k = 1; k <= 7; k++) {
                var yb = y0 + step * k - step * 0.5;
                dc.setColor(G.mix(top, deep(st), k / 7.5), -1);
                dc.fillRectangle(0, yb, 454, k == 7 ? 455 - yb : step + 1);
            }
        }

        // ---- surface glow line
        dc.setPenWidth(7);
        dc.setColor(G.mix(top, c, 0.45), -1);
        for (var i = 0; i < 31; i++) {
            dc.drawLine(front[i][0], front[i][1], front[i + 1][0], front[i + 1][1]);
        }
        dc.setPenWidth(3);
        dc.setColor(G.mix(c, 0xFFFFFF, 0.25), -1);
        for (var i = 0; i < 31; i++) {
            dc.drawLine(front[i][0], front[i][1], front[i + 1][0], front[i + 1][1]);
        }

        // ---- bubbles / particles / blobs
        var n = st == 3 ? 6 : 9;
        var seed = 7919;
        for (var i = 0; i < n; i++) {
            seed = G.rnd(seed + i * 131);
            var r1 = G.rf(seed);
            seed = G.rnd(seed);
            var r2 = G.rf(seed);
            seed = G.rnd(seed);
            var r3 = G.rf(seed);
            var span = 470 - lv;
            if (span < 30) {
                continue;
            }
            var v = st == 3 ? 9 + r2 * 9 : 22 + r2 * 34 + 30 * ch;
            var q = t * v / 1000.0 + r3 * span;
            var yy = 470 - (q - span * Math.floor(q / span));
            var xx = 70 + r1 * 314 + Math.sin(t * 0.0017 + i * 1.9) * (st == 3 ? 10 : 7);
            var surf = lv + wave(xx, t, amp, w, 0);
            var fade = G.clamp((yy - surf) / 40.0, 0.0, 1.0);
            if (fade < 0.05) {
                continue;
            }
            if (st == 3) {
                var rr = 7 + r1 * 10;
                var wob = Math.sin(t * 0.002 + i) * 0.18;
                dc.setColor(G.mix(top, c, 0.4 * fade), -1);
                dc.fillEllipse(xx, yy, rr * (1 + wob) + 5, rr * (1 - wob) + 5);
                dc.setColor(G.mix(top, G.mix(c, 0xFFD36A, 0.4), fade), -1);
                dc.fillEllipse(xx, yy, rr * (1 + wob), rr * (1 - wob));
            } else if (st == 2) {
                var rr = 2.5 + r1 * 4;
                dc.setPenWidth(2);
                dc.setColor(G.dim(G.mix(c, 0xFFFFFF, 0.5), 0.75 * fade), -1);
                dc.drawCircle(xx, yy, rr);
                dc.fillCircle(xx - rr * 0.35, yy - rr * 0.35, 1);
            } else {
                var rr = 1.6 + r1 * 1.6;
                dc.setColor(G.mix(top, 0xB48CFF, 0.35 * fade), -1);
                dc.fillCircle(xx, yy, rr + 4);
                dc.setColor(G.mix(c, 0xFFFFFF, 0.6 * fade), -1);
                dc.fillCircle(xx, yy, rr);
            }
        }

        // ---- splash droplets (intro)
        if (p > 0.6 && p < 1) {
            var tau = (p - 0.6) * 1.5;
            var s2 = 4241;
            for (var i = 0; i < 7; i++) {
                s2 = G.rnd(s2 + i * 17);
                var vx = (G.rf(s2) - 0.5) * 90;
                s2 = G.rnd(s2);
                var vy = -(150 + G.rf(s2) * 140);
                var dx = 90 + i * 46 + vx * tau;
                var dy = target + vy * tau + 450 * tau * tau;
                if (dy < target - 4) {
                    dc.setColor(G.mix(c, 0xFFFFFF, 0.3), -1);
                    dc.fillCircle(dx, dy, 3.2 - (i % 3) * 0.6);
                }
            }
        }

        // ---- measuring scale on the right glass edge + level marker
        dc.setPenWidth(2);
        for (var v = 0; v <= 100; v += 10) {
            var y = lvlY(v);
            var big = v % 50 == 0;
            dc.setColor(y > lv ? G.mix(c, 0xFFFFFF, 0.3) : 0x4A4A4A, -1);
            dc.drawLine(edgeX(y, big ? 22 : 15), y, edgeX(y, 5), y);
        }
        dc.setColor(0xFFFFFF, -1);
        dc.setPenWidth(3);
        dc.drawLine(edgeX(lv, 34), lv, edgeX(lv, 5), lv);
        dc.fillCircle(edgeX(lv, 34), lv, 3);

        // ---- glass highlights
        dc.setColor(0x5A5A5A, -1);
        G.capArc(dc, cx, 227, 212, 3, 296, 332);
        dc.setColor(0x2C2C2C, -1);
        G.capArc(dc, cx, 227, 212, 3, 338, 344);

        // ---- text
        var tp = G.ease(p * 1.6 - 0.25);
        dc.setColor(G.dim(G.mix(c, 0xFFFFFF, 0.35), tp), -1);
        F.px(dc, "BODY BATTERY", cx, 52, 2, 1, 0);
        var bbs = d.bb < 0 ? "--" : "" + Math.round(bb * G.ease(p)).toNumber();
        dc.setColor(G.dim(0xFFFFFF, tp), -1);
        F.st(dc, bbs, cx, 94, 38, 5, 1, 1.0, 0);
        // lowest / highest level of the last 24 h
        var lo = d.bb < 0 ? 101 : d.bb;
        var hi = d.bb;
        var hs = d.bbHist;
        for (var i = 0; i < hs.size(); i++) {
            var v = hs[i];
            if (v < 0) {
                continue;
            }
            if (v < lo) {
                lo = v;
            }
            if (v > hi) {
                hi = v;
            }
        }
        if (hi >= 0) {
            dc.setColor(G.dim(G.mix(c, 0xFFFFFF, 0.6), tp * 0.8), -1);
            F.px(dc, "TIEF " + lo + "   HOCH " + hi, cx, 124, 2, 1, 0);
        }

        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        var ts = hh + ":" + G.pad2(d.m);
        var wp = G.easeInOut(p * 1.3 - 0.15);
        dc.setColor(0xFFFFFF, -1);
        F.st(dc, ts, cx, 212, 96, 8, 1, wp, 0);

        dc.setColor(G.dim(0xD0D0D0, tp), -1);
        F.px(dc, d.dowStr + " " + d.day + " " + d.monStr, cx, 282, 2, 1, 0);

        // slots (skip a Body Battery slot: it is the liquid itself)
        var ns = 0;
        for (var k = 0; k < 3; k++) {
            var l = d.slots[k][:lbl] as String;
            if (l.length() > 0 && !l.equals("B-BATT")) {
                ns++;
            }
        }
        var j = 0;
        for (var k = 0; k < 3; k++) {
            var sl = d.slots[k];
            if ((sl[:lbl] as String).length() == 0 || (sl[:lbl] as String).equals("B-BATT")) {
                continue;
            }
            var x = cx + (j - (ns - 1) / 2.0) * 112;
            var sp = G.stag(p, j, 0.12, 0.5);
            j++;
            if (sp <= 0) {
                continue;
            }
            dc.setColor(G.dim(0xB8B8B8, sp), -1);
            F.px(dc, sl[:lbl] as String, x, 318, 2, 1, 0);
            dc.setColor(G.mix(0x000000, d.dcol, sp), -1);
            F.st(dc, sl[:val] as String, x, 354, 26, 4, 1, 1.0, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var bb = d.bb < 0 ? 50 : d.bb;
        var c = G.dim(G.mix(liqCol(st, bb), 0xFFFFFF, 0.25), 0.62);
        var y = lvlY(bb) + o[1];
        var dy = y - 227;
        var q = 225 * 225 - dy * dy;
        if (q > 0) {
            var hw = Math.sqrt(q);
            // waterline + glass below it as a thin arc
            dc.setColor(c, -1);
            dc.setPenWidth(2);
            dc.drawLine(227 - hw + 8 + o[0], y, 227 + hw - 8 + o[0], y);
            var ang = Math.atan2(hw, -dy) * 180 / Math.PI;
            dc.setColor(G.dim(c, 0.5), -1);
            G.arcC(dc, 227 + o[0], 227, 221, ang, 360 - ang);
        }
        dc.setColor(0x8A8A8A, -1);
        F.st(dc, G.timeStr(d), 227 + o[0], 212 + o[1], 72, 3, 1, 1.0, 0);
        dc.setColor(c, -1);
        F.st(dc, d.bb < 0 ? "--" : "" + d.bb, 227 + o[0], 94 + o[1], 30, 2, 1, 1.0, 0);
    }
}
