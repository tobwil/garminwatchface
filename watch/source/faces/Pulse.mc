import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// PULSE — the last two hours of heart rate as a radial spectrum (newest bar at
// 12 o'clock, time runs clockwise like a clock), an ECG sweep and a heart that
// beat at your real pulse. Styles: 1 Monitor, 2 Zonen, 3 Akzent.
// Mirrors web/js/faces/pulse.js.
class FacePulse extends Face {
    const RAD = 0.017453292519943295;
    const MONGREEN = 0x39FF6A;
    // ECG keypoints: phase, value (R peak = 1 at phase 0.31)
    hidden var EK_P = [0.08, 0.12, 0.16, 0.27, 0.29, 0.31, 0.335, 0.355, 0.45, 0.48, 0.51, 0.545, 0.58] as Array<Float>;
    hidden var EK_V = [0.0, 0.11, 0.0, 0.0, -0.1, 1.0, -0.26, 0.0, 0.0, 0.13, 0.21, 0.13, 0.0] as Array<Float>;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 20;
    }

    // ECG value at absolute time tm (ms) for beat period per
    hidden function ecg(tm, per) {
        var f = tm / per - Math.floor(tm / per);
        if (f <= EK_P[0] || f >= EK_P[12]) {
            return 0.0;
        }
        for (var i = 1; i < 13; i++) {
            if (f <= EK_P[i]) {
                return G.lerp(EK_V[i - 1], EK_V[i], (f - EK_P[i - 1]) / (EK_P[i] - EK_P[i - 1]));
            }
        }
        return 0.0;
    }

    hidden function zcol(v, mx) {
        var q = v.toFloat() / mx;
        if (q < 0.6) { return 0x6F8AB0; }
        if (q < 0.7) { return 0x2E8BFF; }
        if (q < 0.8) { return 0x2BD96B; }
        if (q < 0.9) { return 0xFF8A1F; }
        return 0xFF2D3A;
    }

    hidden function heart(dc as Dc, x, y, r) as Void {
        dc.fillCircle(x - r * 0.5, y - r * 0.28, r * 0.56);
        dc.fillCircle(x + r * 0.5, y - r * 0.28, r * 0.56);
        dc.fillPolygon([[x - r * 1.04, y - r * 0.12], [x + r * 1.04, y - r * 0.12], [x, y + r * 1.0]]);
    }

    // static layer: cached, redrawn when the minute changes
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var p = a.intro;
        var t = a.t.toFloat();
        var cx = 227;
        var cy = 227;
        var hs = d.hrHist;
        var n = hs.size();
        var acc = d.accent;

        // range: resting HR .. 2h max
        var mn = 999;
        var mx = -1;
        for (var i = 0; i < n; i++) {
            var v = hs[i];
            if (v > 0) {
                if (v < mn) { mn = v; }
                if (v > mx) { mx = v; }
            }
        }
        var lo = d.rhr > 0 ? d.rhr - 6 : (mx > 0 ? mn - 6 : 40);
        var hi = mx + 8 > lo + 50 ? mx + 8 : lo + 50;
        var main = st == 1 ? MONGREEN : (st == 3 ? acc : (d.hr > 0 ? zcol(d.hr, d.hrMax) : 0x5A7090));

        var tp = G.ease(p * 1.5 - 0.2);
        if (!a.bg) {
            // ---- style 1: monitor grid & rings
            if (st == 1) {
                dc.setPenWidth(1);
                dc.setColor(0x0B2614, -1);
                for (var gx = 97; gx <= 357; gx += 20) {
                    dc.drawLine(gx, 230, gx, 302);
                }
                for (var gy = 230; gy <= 302; gy += 18) {
                    dc.drawLine(97, gy, 357, gy);
                }
                dc.setColor(0x0F3A1C, -1);
                dc.drawCircle(cx, cy, 143);
            } else {
                dc.setPenWidth(1);
                dc.setColor(0x262626, -1);
                dc.drawCircle(cx, cy, 143);
            }

            // ---- radial spectrum: bar i at clock angle (i+1)*6, newest at 12
            for (var i = 0; i < n && i < 60; i++) {
                var v = hs[i];
                var ang = (i + 1 + 60 - n) * 6;
                var gp = G.stag(p, i, 0.0105, 0.34);
                if (gp <= 0) {
                    continue;
                }
                if (v <= 0) {
                    dc.setColor(0x2A2A2A, -1);
                    dc.fillCircle(G.ptX(cx, 154, ang), G.ptY(cy, 154, ang), 2);
                    continue;
                }
                var q = G.clamp((v - lo).toFloat() / (hi - lo), 0.0, 1.0);
                var len = (6 + 50 * q) * G.spring(gp);
                var age = i / 59.0;
                var col;
                if (st == 1) { col = G.dim(MONGREEN, 0.3 + 0.7 * age); }
                else if (st == 2) { col = G.dim(zcol(v, d.hrMax), 0.55 + 0.45 * age); }
                else { col = G.dim(acc, 0.28 + 0.72 * q); }
                dc.setColor(col, -1);
                var r0 = 150;
                var r1 = 150 + len;
                var s0 = Math.sin((ang - 1.8) * RAD);
                var c0 = Math.cos((ang - 1.8) * RAD);
                var s1 = Math.sin((ang + 1.8) * RAD);
                var c1 = Math.cos((ang + 1.8) * RAD);
                dc.fillPolygon([
                    [cx + r0 * s0, cy - r0 * c0], [cx + r1 * s0, cy - r1 * c0],
                    [cx + r1 * s1, cy - r1 * c1], [cx + r0 * s1, cy - r0 * c1]
                ]);
                if (i == n - 1) {
                    dc.setColor(0xFFFFFF, -1);
                    dc.fillCircle(G.ptX(cx, r1 + 6, ang), G.ptY(cy, r1 + 6, ang), 3);
                }
            }
            // 30-minute ticks inside the ring
            dc.setPenWidth(2);
            dc.setColor(st == 1 ? 0x1F6A34 : 0x4A4A4A, -1);
            for (var k = 0; k < 4; k++) {
                G.tick(dc, cx, cy, 136, 143, k * 90);
            }

            // ---- time (top)
            dc.setColor(G.dim(0xFFFFFF, tp), -1);
            F.st(dc, G.timeStr(d), cx, 112, 30, 4, 1, G.easeInOut(p * 1.4 - 0.1), 0);

        }
        if (a.so) {
            return;
        }
        // ---- heart + HR
        var hr = d.hr;
        var per = 60000.0 / (hr > 40 ? hr : (hr > 0 ? 40 : 60));
        var kk = t / per - Math.floor(t / per) - 0.29;
        if (kk < 0) { kk += 1; }
        var beat = kk < 0.04 ? kk / 0.04 : Math.pow(Math.E, -(kk - 0.04) * 7);
        var hrs = hr > 0 ? "" + hr : "--";
        var wn = F.stW(hrs, 60);
        var gw = 30 + 14 + wn + 10 + F.pxW("BPM", 2);
        var gx0 = cx - gw / 2.0;
        var hx = gx0 + 15;
        var hy = 182;
        var hsz = 14 * G.spring(G.clamp(p * 2 - 0.5, 0.0, 1.0)) * (1 + 0.2 * beat);
        if (hsz > 0.5) {
            if (beat > 0.08) {
                dc.setColor(G.dim(main, 0.22 * beat), -1);
                dc.fillCircle(hx, hy, hsz * 1.6);
            }
            dc.setColor(main, -1);
            heart(dc, hx, hy, hsz);
        }
        dc.setColor(st == 1 ? MONGREEN : 0xFFFFFF, -1);
        F.st(dc, hrs, gx0 + 44, 184, 60, 7, 0, G.easeInOut(p * 1.4 - 0.2), 0);
        dc.setColor(G.dim(st == 1 ? MONGREEN : 0xAAAAAA, tp), -1);
        F.px(dc, "BPM", gx0 + 54 + wn, 199, 2, 0, 0);

        // ---- ECG sweep
        var ep = G.clamp(p * 2.5 - 1.5, 0.0, 1.0);
        if (ep > 0) {
            var x0 = 97;
            var W = 260;
            var by = 272;
            var amp = 36;
            var v = W / 2800.0;
            var tv = (W - 16) / v; // visible span (gap ahead of the cursor)
            var sw = t * v;
            var xc = x0 + (sw - W * Math.floor(sw / W));
            var ecol = hr > 0 ? (st == 2 ? 0xFFFFFF : main) : 0x555555;
            var t0 = t - tv;
            var pt = t0;
            var px = xc - tv * v;
            var py = by - amp * ecg(t0, per);
            if (px < x0) { px += W; }
            var b0 = Math.floor(t0 / per).toNumber();
            var b1 = Math.floor(t / per).toNumber();
            dc.setPenWidth(3);
            for (var b = b0; b <= b1 + 1; b++) {
                for (var j = 0; j <= 13; j++) {
                    var tm = j < 13 ? (b + EK_P[j]) * per : -1.0;
                    if (j == 13) {
                        if (b != b1 + 1) {
                            continue;
                        }
                        tm = t;
                    }
                    if (tm <= pt || tm > t) {
                        continue;
                    }
                    var nx = xc - (t - tm) * v;
                    if (nx < x0) { nx += W; }
                    var ny = by - amp * (j < 13 ? EK_V[j] : ecg(t, per));
                    var age = (t - (tm + pt) / 2) / tv;
                    dc.setColor(G.dim(ecol, ep * (1 - 0.9 * age)), -1);
                    if (nx >= px) {
                        dc.drawLine(px, py, nx, ny);
                    } else {
                        // wrap at the right edge
                        var f = (x0 + W - px) / (nx + W - px);
                        var wy = py + (ny - py) * f;
                        dc.drawLine(px, py, x0 + W, wy);
                        dc.drawLine(x0, wy, nx, ny);
                    }
                    pt = tm;
                    px = nx;
                    py = ny;
                }
            }
            // cursor head
            dc.setColor(G.dim(ecol, 0.35 * ep), -1);
            dc.fillCircle(px, py, 7);
            dc.setColor(G.dim(0xFFFFFF, ep), -1);
            dc.fillCircle(px, py, 3);
        }

        // ---- stats
        var labels = ["RUHE", "MIN", "MAX"];
        var vals = [d.rhr > 0 ? "" + d.rhr : "--", mx > 0 ? "" + mn : "--", mx > 0 ? "" + mx : "--"];
        for (var i = 0; i < 3; i++) {
            var sp = G.stag(p, i, 0.1, 0.5);
            if (sp <= 0) {
                continue;
            }
            var x = cx + (i - 1) * 70;
            dc.setColor(G.dim(st == 1 ? 0x2F9A50 : 0x8A8A8A, sp), -1);
            F.px(dc, labels[i], x, 318, 2, 1, 0);
            dc.setColor(G.dim(st == 1 ? MONGREEN : d.dcol, sp), -1);
            F.st(dc, vals[i], x, 347, 20, 3, 1, 1.0, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var hs = d.hrHist;
        var n = hs.size();
        var cx = 227 + o[0];
        var cy = 227 + o[1];
        var mn = 999;
        var mx = -1;
        for (var i = 0; i < n; i++) {
            var v = hs[i];
            if (v > 0) {
                if (v < mn) { mn = v; }
                if (v > mx) { mx = v; }
            }
        }
        var lo = d.rhr > 0 ? d.rhr - 6 : (mx > 0 ? mn - 6 : 40);
        var hi = mx + 8 > lo + 50 ? mx + 8 : lo + 50;
        var col = st == 1 ? 0x1F8A3C : G.dim(st == 3 ? d.accent : 0x8AA0C0, 0.6);
        dc.setColor(col, -1);
        for (var i = 0; i < n && i < 60; i++) {
            var v = hs[i];
            if (v <= 0) {
                continue;
            }
            var ang = (i + 1 + 60 - n) * 6;
            var r = 156 + 50 * G.clamp((v - lo).toFloat() / (hi - lo), 0.0, 1.0);
            dc.fillCircle(G.ptX(cx, r, ang), G.ptY(cy, r, ang), 2);
        }
        dc.setColor(0x8A8A8A, -1);
        F.st(dc, G.timeStr(d), cx, cy - 10, 60, 3, 1, 1.0, 0);
        dc.setColor(col, -1);
        heart(dc, cx - 22, cy + 52, 6);
        F.px(dc, d.hr > 0 ? "" + d.hr : "--", cx - 8, cy + 46, 2, 0, 0);
    }
}
