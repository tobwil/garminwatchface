import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// LAVA — "Lavalampe": a tall lava lamp fills the round display. Wax blobs rise from the
// heated pool, stretch, pinch off, merge and sink again (metaball look from filled
// ellipses + curved "neck" polygons). Blob speed follows the outside temperature.
// The time floats inside the glass (hours over minutes), date left, three slots right.
// Styles: 1 Retro (red/orange on purple, brass), 2 Ozean (teal, chrome), 3 Plasma (neon).
// Mirrors web/js/faces/lava.js.
class FaceLava extends Face {
    const CX = 227;
    // glass profile: y, half width (top under the cap -> waist above the base)
    const PY = [64, 110, 170, 230, 280, 306, 326, 342];
    const PW = [44, 56, 74, 92, 106, 110, 106, 96];
    // free blobs: radius, x offset (fraction of the free half width), period factor, phase
    const BR = [34, 23, 38, 19, 28];
    const BX = [-0.42, 0.38, 0.06, -0.12, 0.5];
    const BP = [1.0, 1.27, 0.86, 1.43, 1.12];
    const BO = [0.0, 0.33, 0.58, 0.13, 0.8];
    const POOL_Y = 346;
    const Y_BOT = 324;
    const Y_TOP = 92;
    const MF = [0.0, 0.1, 0.3, 0.46, 0.6, 0.86, 1.0];

    // palettes per style:
    // 0 bg top, 1 bg bottom, 2 glow, 3 liquid top, 4 liquid bottom, 5 wax rim, 6 wax core, 7 wax hot,
    // 8 glass edge, 9 time, 10 time outline, 11 text, 12..17 metal ramp (left .. right)
    const PAL = [
        [0x12041C, 0x3A0C46, 0xFF4F6A, 0x2A0834, 0x8A1F58, 0xC8201E, 0xFF6A1A, 0xFFC04A, 0xD77AA8, 0xFFF0D8, 0x1E0526, 0xE9C9DC,
            0x4A2A0C, 0x8E5C1C, 0xE0B24E, 0xFFF0B8, 0xB47A2A, 0x5E3A10],
        [0x010914, 0x05223A, 0x2FD2D0, 0x02203C, 0x0A5A86, 0x0A8F8A, 0x27D8BF, 0xB8FFF0, 0x7CC8E0, 0xEEFCFF, 0x011628, 0xBFE2EE,
            0x26303A, 0x5E6E7C, 0xBAC8D2, 0xFFFFFF, 0x7F909E, 0x2C3640],
        [0x000000, 0x0C0018, 0xFF2BD6, 0x0A0018, 0x2E0858, 0xD4157A, 0xFF4FD0, 0xF4F0FF, 0x2EF2FF, 0xFFFFFF, 0x07000F, 0xC9B6FF,
            0x0E0B16, 0x221C30, 0x463C62, 0x7A6AA6, 0x2A2240, 0x0C0912]
    ];

    hidden var _bx as Array;
    hidden var _by as Array;
    hidden var _ba as Array;
    hidden var _bb as Array;
    hidden var _bh as Array;
    hidden var _fps = 10; // slower wax (cold outside) needs fewer frames

    function initialize() {
        Face.initialize();
        _bx = [0.0, 0.0, 0.0, 0.0, 0.0];
        _by = [0.0, 0.0, 0.0, 0.0, 0.0];
        _ba = [0.0, 0.0, 0.0, 0.0, 0.0];
        _bb = [0.0, 0.0, 0.0, 0.0, 0.0];
        _bh = [0.0, 0.0, 0.0, 0.0, 0.0];
    }

    function fps() as Number {
        return _fps;
    }

    hidden function frac(x) {
        return x - Math.floor(x);
    }

    // glass half width at y (clamped to the profile)
    hidden function hwAt(y) {
        if (y <= PY[0]) {
            return PW[0];
        }
        for (var i = 1; i < 8; i++) {
            if (y <= PY[i]) {
                return PW[i - 1] + (PW[i] - PW[i - 1]) * (y - PY[i - 1]) / (PY[i] - PY[i - 1]).toFloat();
            }
        }
        return PW[7];
    }

    // metaball neck between two circles: a curved waist polygon, pinches off with distance
    hidden function neck(dc as Dc, x1, y1, r1, x2, y2, r2, k) as Void {
        var dx = x2 - x1;
        var dy = y2 - y1;
        var dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < 1) {
            return;
        }
        var rm = r1 < r2 ? r1 : r2;
        var g = dd - r1 - r2;
        var gm = rm * 0.95;
        if (g >= gm) {
            return;
        }
        var s = G.clamp((gm - g) / (gm + rm * 0.9), 0.0, 1.0);
        var wm = rm * (0.08 + 0.72 * s) * k;
        var w1 = r1 * 0.86 * k;
        var w2 = r2 * 0.86 * k;
        var nx = -dy / dd;
        var ny = dx / dd;
        var pts = new [10];
        for (var i = 0; i <= 4; i++) {
            var t = i / 4.0;
            var w = w1 * (1 - t) * (1 - 2 * t) + 4 * wm * t * (1 - t) + w2 * t * (2 * t - 1);
            if (w < wm * 0.7) {
                w = wm * 0.7;
            }
            pts[i] = [x1 + dx * t + nx * w, y1 + dy * t + ny * w];
            pts[9 - i] = [x1 + dx * t - nx * w, y1 + dy * t - ny * w];
        }
        dc.fillPolygon(pts);
    }

    // glass silhouette grown by e px (for the glow halo)
    hidden function glassPoly(e, y0) as Array {
        var pts = new [16];
        for (var i = 0; i < 8; i++) {
            var yy = PY[i] + (i == 0 ? y0 : 0);
            var ee = i == 0 ? e * 0.3 : e;
            pts[i] = [CX - PW[i] - ee, yy];
            pts[15 - i] = [CX + PW[i] + ee, yy];
        }
        return pts;
    }

    // metal part: trapezoid from (y0, hw0) to (y1, hw1) in 6 vertical shading slices
    hidden function metal(dc as Dc, c, y0, w0, y1, w1, l) as Void {
        for (var k = 0; k < 6; k++) {
            dc.setColor(G.dim(c[12 + k], l), -1);
            var a = MF[k];
            var b = MF[k + 1];
            if (w0 == w1) {
                var xa = Math.round(CX - w0 + 2 * w0 * a).toNumber();
                dc.fillRectangle(xa, y0, Math.round(CX - w0 + 2 * w0 * b).toNumber() - xa + 1, y1 - y0);
                continue;
            }
            dc.fillPolygon([
                [CX - w0 + 2 * w0 * a, y0], [CX - w0 + 2 * w0 * b + 1, y0],
                [CX - w1 + 2 * w1 * b + 1, y1], [CX - w1 + 2 * w1 * a, y1]
            ]);
        }
    }

    // cap height that fits txt into maxW
    hidden function fitH(txt as String, h, maxW) {
        var w = F.stW(txt, h);
        return w > maxW ? h * maxW / w : h;
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var c = PAL[st - 1];
        var acc = d.accent;
        var p = a.intro;
        // light level: the lamp switches on during the intro
        var l = 0.2 + 0.8 * G.easeInOut(p * 1.25);
        var lc = st == 1 ? acc : (st == 2 ? 0x5FE6D2 : 0x2EF2FF); // label colour
        // outside temperature -> wax speed (cold = lazy, warm = lively)
        var tc = d.temp == -99 ? 16 : d.temp;
        var sp = G.clamp((tc + 5) / 35.0, 0.0, 1.0);
        var per = 34000 - 22000 * sp;
        _fps = sp < 0.35 ? 7 : 10;
        var seed = (d.wakeN % 89) * 0.0731;
        var tt = a.t + 5200 * G.ease(p);
        var br = 0.9 + 0.1 * Math.sin(a.t / 900.0);

        // background: vertical gradient bands
        for (var i = 0; i < 12; i++) {
            dc.setColor(G.mix(c[0], c[1], i / 11.0), -1);
            dc.fillRectangle(0, i * 38, 454, 38);
        }
        // glow halo around the glass
        for (var i = 0; i < 3; i++) {
            dc.setColor(G.mix(c[1], c[2], (0.1 + i * 0.09) * l * br), -1);
            dc.fillPolygon(glassPoly(30 - i * 10, 0));
        }
        // liquid: 7 slices following the profile, darker at the top, lit from below
        for (var i = 0; i < 7; i++) {
            dc.setColor(G.dim(G.mix(c[3], c[4], i / 6.0), l), -1);
            dc.fillPolygon([[CX - PW[i], PY[i]], [CX + PW[i], PY[i]], [CX + PW[i + 1], PY[i + 1] + 1], [CX - PW[i + 1], PY[i + 1] + 1]]);
        }
        dc.setColor(G.dim(G.mix(c[4], c[2], 0.22 * br), l), -1);
        dc.fillEllipse(CX, 330, 92, 34);

        // ---- wax: blob centres
        var bx = _bx;
        var by = _by;
        var ba = _ba;
        var bb = _bb;
        var bh = _bh;
        var tau = Math.PI * 2;
        for (var i = 0; i < 5; i++) {
            var ph = frac(tt / (per * BP[i]) + BO[i] + seed * (i + 1));
            var u = 0.5 - 0.5 * Math.cos(ph * tau);
            var v = Math.sin(ph * tau).abs();
            var y = Y_BOT - u * (Y_BOT - Y_TOP);
            var r = BR[i] * (1.0 - 0.12 * u);
            var ea = r * (1 - 0.1 * v);
            var eb = r * (1 + 0.2 * v);
            var lim = hwAt(y - eb * 0.7) - ea - 5;
            if (lim < 0) {
                lim = 0;
            }
            var x = CX + BX[i] * (hwAt(y) - r) + 9 * G.noise(tt / 5200.0 + i * 2.7);
            x = G.clamp(x, CX - lim, CX + lim);
            bx[i] = x;
            by[i] = y;
            ba[i] = ea;
            bb[i] = eb;
            bh[i] = 322 - 150 * u;
        }
        var b0 = 13 + 7 * Math.sin(tt / 1700.0);
        var b1 = 13 + 7 * Math.sin(tt / 1700.0 + 2.1);
        var b2 = 13 + 7 * Math.sin(tt / 1700.0 + 4.2);
        // two passes: rim (full size) then core (shrunk, shifted down: lit from the bulb below)
        for (var pass = 0; pass < 2; pass++) {
            var k = pass == 0 ? 1.0 : 0.66;
            var oy = pass == 0 ? 0 : 3;
            var sat = pass == 0 ? 0.92 : 0.55;
            dc.setColor(G.dim(st == 3 ? G.hsv(186, sat, 1.0) : c[5 + pass], l), -1);
            dc.fillEllipse(CX, 66, 38 * k, 12 * k);
            if (st == 3) {
                dc.setColor(G.dim(G.hsv(322, sat, 1.0), l), -1);
            }
            dc.fillEllipse(CX, POOL_Y + oy, (hwAt(POOL_Y) + 2) * (pass == 0 ? 1 : 0.86), 32 * k);
            var by0 = 318 + oy + (1 - k) * 8;
            dc.fillCircle(CX - 54, by0, b0 * k);
            dc.fillCircle(CX, by0, b1 * k);
            dc.fillCircle(CX + 54, by0, b2 * k);
            for (var i = 0; i < 5; i++) {
                if (st == 3) {
                    dc.setColor(G.dim(G.hsv(bh[i], sat, 1.0), l), -1);
                }
                dc.fillEllipse(bx[i], by[i] + oy, ba[i] * k, bb[i] * k);
                // necks: to the pool, to the top, to other blobs
                neck(dc, bx[i], 326 + oy, 14, bx[i], by[i] + oy, ba[i], k);
                neck(dc, bx[i], 66, 10, bx[i], by[i] + oy, ba[i], k);
                for (var j = i + 1; j < 5; j++) {
                    neck(dc, bx[i], by[i] + oy, ba[i], bx[j], by[j] + oy, ba[j], k);
                }
            }
        }
        // hot spots near the bottom of the blobs that are still warm (lower half of the lamp)
        for (var i = 0; i < 5; i++) {
            var u = (322 - bh[i]) / 150.0;
            if (ba[i] > 18 && u < 0.5) {
                dc.setColor(G.dim(G.mix(c[6], c[7], 1 - u * 2), l), -1);
                dc.fillEllipse(bx[i] - ba[i] * 0.15, by[i] + bb[i] * 0.42, ba[i] * 0.34, bb[i] * 0.18);
            }
        }
        dc.setColor(G.dim(c[7], l), -1);
        dc.fillEllipse(CX - 20, POOL_Y - 12, 44, 7);

        // ---- glass: edge lines + reflection stripes
        dc.setColor(G.dim(c[8], l * 0.8), -1);
        dc.setPenWidth(2);
        for (var i = 0; i < 7; i++) {
            dc.drawLine(CX - PW[i], PY[i], CX - PW[i + 1], PY[i + 1]);
            dc.drawLine(CX + PW[i], PY[i], CX + PW[i + 1], PY[i + 1]);
        }
        dc.setColor(G.dim(G.mix(c[4], 0xFFFFFF, 0.38), l), -1);
        dc.fillPolygon([[CX - 34, 84], [CX - 26, 84], [CX - 66, 262], [CX - 80, 262]]);
        dc.setColor(G.dim(G.mix(c[4], 0xFFFFFF, 0.22), l), -1);
        dc.fillPolygon([[CX - 80, 272], [CX - 68, 272], [CX - 72, 292], [CX - 86, 292]]);
        dc.fillPolygon([[CX + 66, 200], [CX + 72, 200], [CX + 92, 284], [CX + 86, 284]]);

        // ---- metal: cap, collar, base
        metal(dc, c, 26, 22, 58, 50, l);
        metal(dc, c, 58, 52, 68, 52, l * 0.8);
        metal(dc, c, 336, 104, 350, 104, l * 0.85);
        metal(dc, c, 350, 92, 454, 150, l);
        dc.setColor(G.dim(c[12], l * 0.7), -1);
        dc.fillRectangle(CX - 104, 349, 208, 3);
        if (st == 3) {
            // neon outline on the dark metal
            dc.setColor(G.dim(c[8], l), -1);
            dc.drawLine(CX - 92, 352, CX - 150, 454);
            dc.drawLine(CX + 92, 352, CX + 150, 454);
            dc.drawLine(CX - 22, 26, CX + 22, 26);
        }

        // ---- time inside the glass: hours over minutes, rising up like wax
        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        var mm = G.pad2(d.m);
        var p1 = G.spring(G.stag(p, 0, 0.12, 0.6));
        var p2 = G.spring(G.stag(p, 1, 0.12, 0.6));
        var ty1 = 168 + (1 - p1) * 70;
        var ty2 = 258 + (1 - p2) * 70;
        if (p1 > 0) {
            dc.setColor(c[10], -1);
            F.st(dc, hh, CX + 3, ty1 + 4, 70, 12, 1, 1.0, 0);
            dc.setColor(G.mix(c[10], c[9], G.clamp(p1, 0.0, 1.0)), -1);
            F.st(dc, hh, CX, ty1, 70, 8, 1, 1.0, 0);
        }
        if (p2 > 0) {
            dc.setColor(c[10], -1);
            F.st(dc, mm, CX + 3, ty2 + 4, 70, 12, 1, 1.0, 0);
            dc.setColor(G.mix(c[10], c[9], G.clamp(p2, 0.0, 1.0)), -1);
            F.st(dc, mm, CX, ty2, 70, 8, 1, 1.0, 0);
        }

        // ---- date (left)
        var q1 = G.ease(G.stag(p, 2, 0.12, 0.5));
        if (q1 > 0) {
            dc.setColor(G.dim(lc, q1), -1);
            F.px(dc, d.dowStr, 80, 150, 3, 1, 0);
            dc.setColor(G.dim(c[9], q1), -1);
            F.st(dc, "" + d.day, 80, 202, 44, 6, 1, 1.0, 0);
            dc.setColor(G.dim(c[11], q1), -1);
            F.px(dc, d.monStr, 80, 236, 3, 1, 0);
        }
        // ---- slots (right)
        for (var k = 0; k < 3; k++) {
            var sl = d.slots[k];
            var q = G.ease(G.stag(p, 2 + k, 0.1, 0.5));
            if (q <= 0) {
                continue;
            }
            var y = 128 + k * 74;
            var x = 372 + k * 4;
            dc.setColor(G.dim(lc, q * 0.9), -1);
            F.px(dc, sl[:lbl] as String, x, y, 2, 1, 0);
            dc.setColor(G.dim(d.dcol, q), -1);
            F.st(dc, sl[:val] as String, x, y + 34, fitH(sl[:val] as String, 22, 104 - k * 6), 3, 1, 1.0, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var c = PAL[st - 1];
        var ox = o[0];
        var oy = o[1];
        // thin glass + cap + base outline
        dc.setPenWidth(2);
        dc.setColor(G.dim(c[8], 0.45), -1);
        for (var i = 0; i < 7; i++) {
            dc.drawLine(CX - PW[i] + ox, PY[i] + oy, CX - PW[i + 1] + ox, PY[i + 1] + oy);
            dc.drawLine(CX + PW[i] + ox, PY[i] + oy, CX + PW[i + 1] + ox, PY[i + 1] + oy);
        }
        dc.setColor(G.dim(c[14], 0.4), -1);
        dc.drawLine(CX - 22 + ox, 26 + oy, CX + 22 + ox, 26 + oy);
        dc.drawLine(CX - 22 + ox, 26 + oy, CX - 50 + ox, 58 + oy);
        dc.drawLine(CX + 22 + ox, 26 + oy, CX + 50 + ox, 58 + oy);
        dc.drawLine(CX - 92 + ox, 350 + oy, CX - 140 + ox, 440 + oy);
        dc.drawLine(CX + 92 + ox, 350 + oy, CX + 140 + ox, 440 + oy);
        dc.drawLine(CX - 104 + ox, 343 + oy, CX + 104 + ox, 343 + oy);
        // resting wax: dim pool and two blobs
        dc.setColor(G.dim(c[5], 0.3), -1);
        dc.fillEllipse(CX + ox, 336 + oy, 80, 10);
        dc.fillEllipse(CX - 44 + ox, 296 + oy, 17, 19);
        dc.fillEllipse(CX + 30 + ox, 112 + oy, 11, 13);
        // time
        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        dc.setColor(G.dim(c[9], 0.6), -1);
        F.st(dc, hh, CX + ox, 168 + oy, 70, 3, 1, 1.0, 0);
        F.st(dc, G.pad2(d.m), CX + ox, 258 + oy, 70, 3, 1, 1.0, 0);
        dc.setColor(G.dim(c[11], 0.45), -1);
        F.px(dc, d.dowStr + " " + d.day, 80 + ox, 196 + oy, 2, 1, 0);
    }
}
