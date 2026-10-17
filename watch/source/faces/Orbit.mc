import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// ORBIT — a solar system as a clock: hour gas giant on the outer orbit, minute
// earth (with a moon in its real phase) on the middle orbit, a seconds comet on
// the inner orbit, steps as an asteroid belt. Styles: 1 Kosmos, 2 Blueprint,
// 3 Eclipse. Mirrors web/js/faces/orbit.js.
class FaceOrbit extends Face {
    const CX = 227;
    const RH = 186;   // hour orbit
    const RM = 136;   // minute orbit
    const RS = 70;    // seconds orbit
    const RB = 214;   // asteroid belt
    const TY = 331;   // time centre
    const DY = 130;   // date top
    const RAD = 0.017453292519943295;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 20;
    }

    // filled lens/phase polygon: limb on the `dir` side (clock degrees),
    // terminator at c * r * cos (c = 1 nothing, 0 half, -1 full disc).
    function lens(dc as Dc, x, y, r, dir, c) as Void {
        var ux = Math.sin(dir * RAD);
        var uy = -Math.cos(dir * RAD);
        var vx = -uy;
        var vy = ux;
        var pts = new [18];
        for (var i = 0; i <= 8; i++) {
            var t = (-90 + i * 22.5) * RAD;
            var a = r * Math.cos(t);
            var b = r * Math.sin(t);
            pts[i] = [x + ux * a + vx * b, y + uy * a + vy * b];
            a = a * c;
            pts[17 - i] = [x + ux * a + vx * b, y + uy * a + vy * b];
        }
        dc.fillPolygon(pts);
    }

    // upper (top=true) or lower half of an axis-aligned ellipse as a polyline
    function halfEll(dc as Dc, x, y, a, b, top) as Void {
        var px = x - a;
        var py = y;
        for (var i = 1; i <= 10; i++) {
            var t = i * 18 * RAD;
            var nx = x - a * Math.cos(t);
            var ny = top ? y - b * Math.sin(t) : y + b * Math.sin(t);
            dc.drawLine(px, py, nx, ny);
            px = nx;
            py = ny;
        }
    }

    // moon disc in its real phase (waxing lit on the right)
    function moonDisc(dc as Dc, x, y, r, ph, lit, dark) as Void {
        if (dark != -1) {
            dc.setColor(dark, -1);
            dc.fillCircle(x, y, r);
        }
        var il = (1 - Math.cos(ph * 2 * Math.PI)) / 2.0;
        if (il < 0.03) {
            if (dark == -1) {
                dc.setColor(G.dim(lit, 0.5), -1);
                dc.setPenWidth(1);
                dc.drawCircle(x, y, r);
            }
            return;
        }
        dc.setColor(lit, -1);
        lens(dc, x, y, r, ph < 0.5 ? 90 : 270, Math.cos(ph * 2 * Math.PI));
    }

    // dotted orbit, drawn clockwise from 12 o'clock up to `frac`
    function orbit(dc as Dc, r, frac, step) as Void {
        var n = 4 * Math.round(2 * Math.PI * r / step / 4.0).toNumber();
        if (frac >= 1) {
            // full circle: one quadrant of trig, mirrored 4x
            for (var i = 0; i < n / 4; i++) {
                var t = i * 360.0 / n;
                var sx = r * Math.sin(t * RAD) - 1;
                var cy = r * Math.cos(t * RAD);
                dc.fillRectangle(CX + sx, CX - cy - 1, 2, 2);
                dc.fillRectangle(CX + cy - 1, CX + sx, 2, 2);
                dc.fillRectangle(CX - sx - 2, CX + cy - 1, 2, 2);
                dc.fillRectangle(CX - cy - 1, CX - sx - 2, 2, 2);
            }
            return;
        }
        var m = (n * frac).toNumber();
        for (var i = 0; i < m; i++) {
            var t = i * 360.0 / n;
            dc.fillRectangle(G.ptX(CX, r, t) - 1, G.ptY(CX, r, t) - 1, 2, 2);
        }
    }

    // time moves to the top while the minute planet passes below it
    function flip(d as D) as Boolean {
        var ma = d.m * 6 + d.s * 0.1;
        return ma > 110 && ma < 250;
    }

    function stars(dc as Dc, a as A, col) as Void {
        var sd = 4242;
        for (var i = 0; i < 40; i++) {
            sd = G.rnd(sd);
            var x = 14 + G.rf(sd) * 426;
            sd = G.rnd(sd);
            var y = 14 + G.rf(sd) * 426;
            sd = G.rnd(sd);
            var b = 0.3 + G.rf(sd) * 0.7;
            var dx = x - CX;
            var dy = y - CX;
            var rr = dx * dx + dy * dy;
            if (rr > 218 * 218 || rr < 48 * 48) {
                continue;
            }
            if (dx.abs() < 98 && ((y - TY).abs() < 36 || (y - (454 - TY)).abs() < 36)) {
                continue;
            }
            if (dx.abs() < 72 && ((y - DY - 7).abs() < 15 || (y - (447 - DY)).abs() < 15)) {
                continue;
            }
            var k = b;
            if (a.live) {
                k = b * (0.5 + 0.5 * Math.sin(a.t * 0.0027 + i * 2.1));
            }
            dc.setColor(G.dim(col, k), -1);
            if (b > 0.88) {
                dc.fillCircle(x, y, 1.5);
            } else {
                dc.fillRectangle(x, y, 2, 2);
            }
        }
    }

    function sun(dc as Dc, a as A, st, acc, p) as Void {
        var pu = a.live ? Math.sin(a.t * 0.003) : 0.0;
        var s = G.ease(p * 2);
        if (st == 2) {
            dc.setColor(acc, -1);
            dc.setPenWidth(2);
            dc.drawCircle(CX, CX, 22 * s);
            dc.setPenWidth(1);
            dc.drawCircle(CX, CX, (30 + pu) * s);
            dc.fillCircle(CX, CX, 3);
            dc.setColor(G.dim(acc, 0.5), -1);
            for (var k = 0; k < 4; k++) {
                G.tick(dc, CX, CX, 36, 56, k * 90);
            }
            return;
        }
        if (st == 3) {
            dc.setColor(0x141414, -1); dc.fillCircle(CX, CX, (44 + pu * 2) * s);
            dc.setColor(0x2C2C2C, -1); dc.fillCircle(CX, CX, (36 + pu) * s);
            dc.setColor(0x6A6A6A, -1); dc.fillCircle(CX, CX, 30 * s);
            dc.setColor(0x5A5A5A, -1);
            dc.setPenWidth(2);
            var rot = a.live ? a.t * 0.004 : 0.0;
            for (var k = 0; k < 12; k++) {
                G.tick(dc, CX, CX, 30 * s, (k % 2 == 0 ? 50 : 41) * s, rot + k * 30);
            }
            dc.setColor(0xFFFFFF, -1);
            dc.fillCircle(CX, CX, 27 * s);
            dc.setColor(0, -1);
            dc.fillCircle(CX, CX, 24.5 * s);
            // diamond ring bead
            dc.setColor(0xFFFFFF, -1);
            dc.fillCircle(G.ptX(CX, 26 * s, 128), G.ptY(CX, 26 * s, 128), 3.5 * s);
            return;
        }
        dc.setColor(0x2A1000, -1); dc.fillCircle(CX, CX, (42 + pu * 2.5) * s);
        dc.setColor(0x5C2405, -1); dc.fillCircle(CX, CX, (35 + pu * 1.5) * s);
        dc.setColor(0xB4480C, -1); dc.fillCircle(CX, CX, 29 * s);
        dc.setColor(0xFF7A1A, -1); dc.fillCircle(CX, CX, 24 * s);
        dc.setColor(0xFFAE40, -1); dc.fillCircle(CX, CX, 17 * s);
        dc.setColor(0xFFE6A8, -1); dc.fillCircle(CX, CX, 9 * s);
    }

    // ringed gas giant; sd = direction to the sun (clock degrees)
    function giant(dc as Dc, x, y, st, acc, sd) as Void {
        var r = 19;
        var ring;
        var body;
        var band;
        var shade;
        if (st == 1) {
            ring = 0xB89A6A; body = 0xE4C896; band = 0xB88A54; shade = 0x2A2014;
        } else if (st == 3) {
            ring = 0x8A8A8A; body = 0xD8D8D8; band = 0xA8A8A8; shade = 0x1A1A1A;
        } else {
            ring = acc; body = 0; band = G.dim(acc, 0.5); shade = G.dim(acc, 0.22);
        }
        dc.setColor(ring, -1);
        dc.setPenWidth(3);
        if (st == 2) { dc.setPenWidth(1); }
        halfEll(dc, x, y, 36, 10, true);
        dc.setColor(body, -1);
        dc.fillCircle(x, y, r);
        if (st != 2) {
            dc.setColor(band, -1);
            dc.setPenWidth(3);
            dc.drawLine(x - 17, y - 7, x + 17, y - 7);
            dc.setPenWidth(2);
            dc.drawLine(x - 18, y + 5, x + 18, y + 5);
        }
        dc.setColor(shade, -1);
        lens(dc, x, y, r, sd + 180, 0.3);
        if (st == 2) {
            dc.setColor(acc, -1);
            dc.setPenWidth(2);
            dc.drawCircle(x, y, r);
        }
        dc.setColor(ring, -1);
        dc.setPenWidth(st == 2 ? 1 : 3);
        halfEll(dc, x, y, 36, 10, false);
    }

    function earth(dc as Dc, x, y, st, acc, sd) as Void {
        var r = 14;
        if (st == 2) {
            dc.setColor(0, -1); dc.fillCircle(x, y, r);
            dc.setColor(G.dim(acc, 0.22), -1); lens(dc, x, y, r, sd + 180, 0.3);
            dc.setColor(acc, -1); dc.setPenWidth(2); dc.drawCircle(x, y, r);
            return;
        }
        var ocean = st == 1 ? 0x2D8EE0 : 0xB4B4B4;
        var land = st == 1 ? 0x46C08A : 0x7C7C7C;
        var atmo = st == 1 ? 0x2A5F9A : 0x444444;
        dc.setColor(atmo, -1); dc.fillCircle(x, y, r + 2);
        dc.setColor(ocean, -1); dc.fillCircle(x, y, r);
        dc.setColor(land, -1);
        dc.fillEllipse(x - 4, y - 5, 6, 5);
        dc.fillEllipse(x + 6, y + 5, 4, 5);
        dc.setColor(st == 1 ? 0x081626 : 0x141414, -1);
        lens(dc, x, y, r + 0.5, sd + 180, 0.3);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;

        // ---- stars
        if (st != 2) { stars(dc, a, st == 1 ? 0xD8E0FF : 0xBBBBBB); }

        // ---- asteroid belt = steps
        var frac = (d.stepGoal > 0 && d.steps > 0) ? G.clamp(d.steps.toFloat() / d.stepGoal, 0.0, 1.0) : 0.0;
        var bp = G.ease(p * 1.3);
        var lit = (frac * 100 * bp).toNumber();
        var sd = 977;
        var bcol = st == 3 ? 0xD8D8D8 : acc;
        var boff = st == 2 ? G.dim(acc, 0.18) : 0x262626;
        for (var i = 0; i < 100; i++) {
            sd = G.rnd(sd);
            var rr = RB + (G.rf(sd) - 0.5) * 7;
            sd = G.rnd(sd);
            var sz = 1 + G.rf(sd) * 1.6;
            var t = i * 3.6 + 1.8;
            dc.setColor(i < lit ? bcol : boff, -1);
            dc.fillCircle(G.ptX(CX, rr, t), G.ptY(CX, rr, t), i < lit ? sz : 1);
        }

        // ---- orbits
        var oc = st == 1 ? 0x3C4A66 : (st == 2 ? G.dim(acc, 0.45) : 0x383838);
        var o1 = G.ease(G.stag(p, 0, 0.1, 0.6));
        var o2 = G.ease(G.stag(p, 1, 0.1, 0.6));
        var o3 = G.ease(G.stag(p, 2, 0.1, 0.6));
        dc.setColor(oc, -1);
        if (st == 2) {
            dc.setPenWidth(1);
            G.arcC(dc, CX, CX, RH, 0, 360 * o1);
            G.arcC(dc, CX, CX, RM, 0, 360 * o2);
            G.arcC(dc, CX, CX, RS, 0, 360 * o3);
            dc.setColor(acc, -1);
            dc.setPenWidth(2);
            for (var k = 0; k < 12; k++) {
                var big = k % 3 == 0;
                if (k * 30 <= 360 * o1) { G.tick(dc, CX, CX, RH - (big ? 7 : 4), RH + (big ? 7 : 4), k * 30); }
                if (k * 30 <= 360 * o2) { G.tick(dc, CX, CX, RM - (big ? 5 : 3), RM + (big ? 5 : 3), k * 30); }
                if (big && k * 30 <= 360 * o3) { G.tick(dc, CX, CX, RS - 4, RS + 4, k * 30); }
            }
        } else {
            orbit(dc, RH, o1, 10);
            orbit(dc, RM, o2, 10);
            orbit(dc, RS, o3, 10);
        }

        // ---- sun
        sun(dc, a, st, acc, p);

        // ---- planets (spiral out from the sun)
        var s = d.s;
        var ha = (d.h % 12) * 30 + d.m * 0.5;
        var ma = d.m * 6 + s * 0.1;
        var e1 = G.easeInOut(G.stag(p, 0, 0.12, 0.7));
        var e2 = G.easeInOut(G.stag(p, 1, 0.12, 0.7));
        var e3 = G.easeInOut(G.stag(p, 2, 0.12, 0.7));

        // hour giant
        if (e1 > 0) {
            var ang = ha - (1 - e1) * 270;
            var r = RH * e1;
            var x = G.ptX(CX, r, ang);
            var y = G.ptY(CX, r, ang);
            giant(dc, x, y, st, acc, ang + 180);
            if (st == 2) {
                dc.setColor(acc, -1);
                F.px(dc, "H", G.ptX(CX, r, ang - 17), G.ptY(CX, r, ang - 17) - 7, 2, 1, 0);
            }
        }

        // minute earth + moon
        if (e2 > 0) {
            var ang = ma - (1 - e2) * 270;
            var r = RM * e2;
            var x = G.ptX(CX, r, ang);
            var y = G.ptY(CX, r, ang);
            var mo = ang + 180 - d.moon * 360 - (a.live ? a.t * 0.003 : 0.0);
            var mx = G.ptX(x, 27 * e2, mo);
            var my = G.ptY(y, 27 * e2, mo);
            dc.setColor(st == 1 ? 0x1C2638 : (st == 2 ? G.dim(acc, 0.3) : 0x2A2A2A), -1);
            dc.setPenWidth(1);
            dc.drawCircle(x, y, 27 * e2);
            earth(dc, x, y, st, acc, ang + 180);
            if (st == 2) {
                moonDisc(dc, mx, my, 7, d.moon, acc, -1);
                dc.setColor(acc, -1);
                F.px(dc, "M", G.ptX(CX, r, ang - 21), G.ptY(CX, r, ang - 21) - 7, 2, 1, 0);
            } else {
                moonDisc(dc, mx, my, 7, d.moon, st == 1 ? 0xF0EAD6 : 0xFFFFFF, st == 1 ? 0x2C3040 : 0x262626);
            }
        }

        // seconds comet
        if (e3 > 0) {
            var sec = s + (a.live ? a.ms / 1000.0 : 0.0);
            var ang = sec * 6 - (1 - e3) * 270;
            var r = RS * e3;
            var cc = st == 3 ? 0xFFFFFF : acc;
            if (a.live) {
                for (var i = 9; i >= 1; i--) {
                    var ta = ang - i * 3.2;
                    var tr = r + i * 1.3 * e3;
                    dc.setColor(G.dim(cc, (1 - i / 10.0) * 0.8), -1);
                    dc.fillCircle(G.ptX(CX, tr, ta), G.ptY(CX, tr, ta), 3.4 - i * 0.28);
                }
                dc.setColor(G.dim(cc, 0.35), -1);
                dc.fillCircle(G.ptX(CX, r, ang), G.ptY(CX, r, ang), 7);
                dc.setColor(G.mix(cc, 0xFFFFFF, 0.6), -1);
                dc.fillCircle(G.ptX(CX, r, ang), G.ptY(CX, r, ang), 4);
            } else {
                dc.setColor(cc, -1);
                dc.fillCircle(G.ptX(CX, r, ang), G.ptY(CX, r, ang), 3);
            }
            if (st == 2) {
                dc.setColor(acc, -1);
                F.px(dc, "S", G.ptX(CX, r, ang + 19), G.ptY(CX, r, ang + 19) - 7, 2, 1, 0);
            }
        }

        // ---- date + time (black halo keeps them readable over the orbits)
        var top = flip(d);
        var ty = top ? 454 - TY : TY;
        var dy = top ? 440 - DY : DY;
        var dp = G.ease(G.stag(p, 1, 0.2, 0.6));
        var ds = d.dowStr + " " + d.day + ". " + d.monStr;
        if (dp > 0) {
            var w = F.pxW(ds, 2);
            dc.setColor(0, -1);
            dc.fillRoundedRectangle(CX - w / 2.0 - 6, dy - 4, w + 12, 22, 6);
            dc.setColor(G.dim(st == 2 ? acc : 0xA8A8A8, dp), -1);
            F.px(dc, ds, CX, dy, 2, 1, 0);
        }
        var tp = G.easeInOut(p * 1.2 - 0.1);
        var ts = G.timeStr(d);
        dc.setColor(0, -1);
        F.st(dc, ts, CX, ty, 52, 13, 1, tp, 0);
        dc.setColor(st == 2 ? acc : 0xFFFFFF, -1);
        F.st(dc, ts, CX, ty, 52, st == 2 ? 3 : 5, 1, tp, 0);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var x0 = CX + o[0];
        var y0 = CX + o[1];
        dc.setPenWidth(1);
        dc.setColor(0x262626, -1);
        dc.drawCircle(x0, y0, RH);
        dc.drawCircle(x0, y0, RM);
        dc.setColor(0x5A5A5A, -1);
        dc.drawCircle(x0, y0, 14);
        var ha = (d.h % 12) * 30 + d.m * 0.5;
        var ma = d.m * 6;
        dc.setColor(0, -1);
        dc.fillCircle(G.ptX(x0, RH, ha), G.ptY(y0, RH, ha), 10);
        dc.fillCircle(G.ptX(x0, RM, ma), G.ptY(y0, RM, ma), 8);
        dc.setColor(G.dim(d.accent, 0.6), -1);
        dc.setPenWidth(2);
        dc.drawCircle(G.ptX(x0, RH, ha), G.ptY(y0, RH, ha), 7);
        dc.setColor(0x6A6A6A, -1);
        dc.fillCircle(G.ptX(x0, RM, ma), G.ptY(y0, RM, ma), 4);
        dc.setColor(0x9A9A9A, -1);
        F.st(dc, G.timeStr(d), x0, (flip(d) ? 454 - TY : TY) + o[1], 52, 3, 1, 1.0, 0);
    }
}
