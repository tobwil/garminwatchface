import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// SYNTH — "Synthwave": an 80s outrun scene. A striped retro sun whose height follows
// the real solar elevation (a ringed magenta planet and stars at night), gradient sky,
// low-poly mountains and a perspective neon grid floor with a road that scrolls towards
// the viewer at a speed set by the heart rate. Chrome-neon time (3 stroke passes).
// Styles: 1 Outrun, 2 Sunset, 3 Vapor (checkerboard floor, palms).
// Mirrors web/js/faces/synth.js.
class FaceSynth extends Face {
    const CX = 227;
    const HZ = 262; // horizon
    const FD = 192.0; // floor depth in px (HZ..454)
    const PC = 1000.0; // perspective constant: y = HZ + PC / z
    const SR = 84; // sun radius
    const CW = 58; // grid column width at the bottom edge
    const TY = 134; // time centre

    // palettes: skyTop skyMid skyHor sun0 sun1 sun2 floor grid edge mtnLight mtnDark ridge tUnder tMid tTop panel
    const PAL = [
        [0x0A0326, 0x3A0C5E, 0xC2257D, 0xFFE45C, 0xFF8A3D, 0xFF2E88, 0x0C0220, -1, 0x3EF2FF, 0x3B1661, 0x200B3C, 0x3EF2FF, -1, 0x2EE6FF, 0xFFFFFF, 0x07000F],
        [0x12031F, 0x4A0E40, 0xE0482F, 0xFFE7A0, 0xFF9A3C, 0xE8243A, 0x120310, 0xFF5A2E, 0xFFC24A, 0x2C0A2C, 0x170518, 0xFF7A3A, 0x6A0F2A, 0xFF9A3C, 0xFFF1C9, 0x0B0208],
        [0x1A1747, 0x5E4A9E, 0xF6A6CB, 0xFFF2F8, 0xFFB3DA, 0x7FE6E0, 0x241A4E, 0xE58FC4, 0xFFFFFF, 0x3A2D6E, 0x2A1F55, 0xFFB3DA, 0x4B2A86, 0xFF9FD6, 0xFFFFFF, 0x150F33]
    ];
    // mountains (back to front): peak x, height, left half-width, right half-width
    const MT = [118, 100, 74, 64, 352, 92, 70, 80, 56, 70, 86, 66, 412, 66, 70, 72];
    // palm fronds: angle from up (deg, clockwise), relative length
    const FR = [-112, 0.5, -70, 0.62, -30, 0.5, 18, 0.55, 62, 0.62, 104, 0.5];

    // per-minute cache of the solar elevation
    hidden var _ek = -1;
    hidden var _ela = -999.0;
    hidden var _elev = 0.0;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 15;
    }

    hidden function sky(c, y, n) as Number {
        var t = y / (HZ * 1.0);
        var col = t < 0.55 ? G.mix(c[0], c[1], t / 0.55) : G.mix(c[1], c[2], (t - 0.55) / 0.45);
        if (n > 0) {
            col = G.mix(col, G.mix(0x02010A, c[1], t * t * 0.7), n * 0.75);
        }
        return col;
    }

    // rows of a disc between y0 and the horizon, three-colour vertical gradient, with
    // drifting slits in its lower part (gaps widen towards the bottom)
    hidden function disc(dc as Dc, cx, cy, r, c0, c1, c2, drift, slits) as Void {
        var top = Math.floor(cy - r).toNumber();
        if (top < 0) {
            top = 0;
        }
        var bot = cy + r;
        if (bot > HZ) {
            bot = HZ;
        }
        var s0 = cy - r * 0.2;
        for (var y = top; y < bot; y += 2) {
            var dy = y + 1 - cy;
            var q = r * r - dy * dy;
            var hw = q > 0 ? Math.sqrt(q) : 0.0;
            if (hw < 1) {
                continue;
            }
            if (slits && y > s0) {
                var rel = (y - s0) / (cy + r - s0);
                var v = y - s0 - drift;
                var ph = v - 14 * Math.floor(v / 14.0);
                if (ph < 1.5 + rel * 8) {
                    continue;
                }
            }
            var t = (y - (cy - r)) / (2.0 * r);
            dc.setColor(t < 0.5 ? G.mix(c0, c1, t * 2) : G.mix(c1, c2, t * 2 - 1), -1);
            dc.fillRectangle(cx - hw, y, hw * 2, 2);
        }
    }

    hidden function palm(dc as Dc, bx, by, hg, lean, col) as Void {
        dc.setColor(col, -1);
        var px = bx * 1.0;
        var py = by * 1.0;
        var pw = 7.0;
        for (var i = 1; i <= 5; i++) {
            var t = i / 5.0;
            var x = bx + lean * hg * t * t;
            var y = by - hg * t;
            var w = 7 - 3.5 * t;
            dc.fillPolygon([[px - pw, py], [x - w, y], [x + w, y], [px + pw, py]]);
            px = x;
            py = y;
            pw = w;
        }
        for (var k = 0; k < 12; k += 2) {
            var an = FR[k];
            var L = FR[k + 1] * hg * 0.62;
            var a2 = an + (an < 0 ? -48 : 48);
            var mx = G.ptX(px, L * 0.55, an);
            var my = G.ptY(py, L * 0.55, an);
            var ex = G.ptX(mx, L * 0.55, a2);
            var ey = G.ptY(my, L * 0.55, a2);
            var nx = G.ptX(0, 6, an + 90);
            var ny = G.ptY(0, 6, an + 90);
            dc.fillPolygon([[px, py], [mx + nx, my + ny], [ex, ey], [mx - nx, my - ny]]);
        }
        dc.fillCircle(px, py, 5);
    }

    // one pass of the time (centred on x): hours, slanted square colon, minutes
    hidden function time(dc as Dc, hh as String, mm as String, x, y, pen, col) as Void {
        dc.setColor(col, -1);
        var wh = F.stW(hh, 76);
        x = x + (wh - F.stW(mm, 76)) / 2.0;
        F.st(dc, hh, x - 15, y, 76, pen, 2, 1.0, 0.15);
        F.st(dc, mm, x + 15, y, 76, pen, 0, 1.0, 0.15);
        var r = pen * 0.5 + 3;
        for (var k = 0; k < 2; k++) {
            var cy = y + (k == 0 ? -17 : 17);
            var sx = x + (y - cy) * 0.15;
            dc.fillPolygon([[sx - r + r * 0.3, cy - r], [sx + r + r * 0.3, cy - r], [sx + r - r * 0.3, cy + r], [sx - r - r * 0.3, cy + r]]);
        }
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var c = PAL[G.clamp(st, 1, 3) - 1];
        var acc = d.accent;
        var grid = c[7] == -1 ? acc : c[7];
        var tUnder = c[12] == -1 ? G.mix(0x000000, acc, 0.5) : c[12];
        var p = a.intro;
        var live = a.live;
        var sec = live ? a.t / 1000.0 : 0.0;
        var vapor = st == 3;

        // ---- sun elevation (real) -> day / night
        var ek = d.doy * 1440 + d.mins;
        if (ek != _ek || d.lat != _ela) {
            _ek = ek;
            _ela = d.lat;
            _elev = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        }
        var elev = _elev;
        var night = G.clamp((2 - elev) / 10.0, 0.0, 1.0);

        // ---- sky bands
        for (var y = 0; y < HZ; y += 8) {
            var dy = y + 8 < 227 ? 227 - y - 8 : 0;
            var hw = Math.sqrt(227 * 227 - dy * dy) + 1;
            dc.setColor(sky(c, y + 4, night), -1);
            dc.fillRectangle(CX - hw, y, hw * 2, 8);
        }

        // ---- stars (always a few up high; many at night)
        var sv = 0.3 + 0.7 * night;
        var seed = 7;
        var lim = 0.25 + 0.75 * night;
        var fade = G.ease(p * 2);
        for (var i = 0; i < 30; i++) {
            seed = G.rnd(seed);
            var x = 60 + (seed % 335);
            seed = G.rnd(seed);
            var y = 22 + (seed % 170);
            if (y > 22 + 170 * lim) {
                continue;
            }
            var tw = live ? 0.6 + 0.4 * Math.sin(sec * 2.3 + i * 1.7) : 0.8;
            var b = sv * tw * (1 - y / 260.0) * fade;
            dc.setColor(G.mix(sky(c, y, night), 0xFFFFFF, b), -1);
            if (i % 7 == 0) {
                dc.fillRectangle(x - 1, y - 3, 2, 8);
                dc.fillRectangle(x - 4, y, 8, 2);
            } else {
                dc.fillRectangle(x, y, 2, 2);
            }
        }

        // ---- sun (rises during the intro) or ringed planet at night
        var rise = G.ease(G.clamp(p / 0.6, 0.0, 1.0));
        var drift = live ? sec * 4 : 0.0;
        if (elev >= -6) {
            var ty = HZ + 18 - G.clamp(elev, -12.0, 50.0) * 2.0;
            var cy = G.lerp(HZ + SR + 4, ty, rise);
            dc.setColor(G.mix(c[2], c[5], 0.35), -1);
            dc.fillCircle(CX, cy, SR + 7);
            disc(dc, CX, cy, SR, c[3], c[4], c[5], drift, true);
        } else {
            var pr = 54;
            var cy = G.lerp(HZ + pr + 30, HZ - 36, rise);
            var p0 = vapor ? 0x9FE9FF : 0xFF6AD5;
            var p1 = vapor ? 0xC79BFF : 0xC02A9E;
            var p2 = vapor ? 0x6A4FC0 : 0x4D1478;
            dc.setColor(G.mix(p1, 0xFFFFFF, 0.15), -1);
            dc.setPenWidth(3);
            dc.drawEllipse(CX, cy, pr * 1.75, pr * 0.3);
            disc(dc, CX, cy, pr, p0, p1, p2, drift, false);
            // front half of the ring
            dc.setColor(G.mix(p1, 0xFFFFFF, 0.35), -1);
            var lx = CX + pr * 1.75;
            var ly = cy;
            for (var k = 1; k <= 12; k++) {
                var an = k * Math.PI / 12;
                var x = CX + pr * 1.75 * Math.cos(an);
                var y = cy + pr * 0.3 * Math.sin(an);
                dc.drawLine(lx, ly, x, y);
                lx = x;
                ly = y;
            }
        }

        // ---- low-poly mountains
        var mL = night > 0.5 ? G.dim(c[9], 0.7) : c[9];
        var mD = night > 0.5 ? G.dim(c[10], 0.7) : c[10];
        dc.setPenWidth(2);
        for (var i = 0; i < MT.size(); i += 4) {
            var x = MT[i];
            var h = MT[i + 1] * (vapor ? 0.7 : 1.0);
            var wl = MT[i + 2];
            var wr = MT[i + 3];
            var yb = HZ + 1;
            var yp = HZ - h;
            var xm = x + wr * 0.22;
            dc.setColor(mL, -1);
            dc.fillPolygon([[x - wl, yb], [x, yp], [xm, yb]]);
            dc.setColor(mD, -1);
            dc.fillPolygon([[xm, yb], [x, yp], [x + wr, yb]]);
            dc.setColor(G.mix(mD, c[11], 0.75), -1);
            dc.drawLine(x - wl, yb, x, yp);
            dc.drawLine(x, yp, x + wr, yb);
        }

        // ---- floor
        dc.setColor(c[6], -1);
        dc.fillRectangle(0, HZ, 454, 454 - HZ);
        dc.setColor(G.mix(c[6], c[2], 0.3), -1);
        dc.fillRectangle(0, HZ, 454, 10);

        // scroll: heart rate -> speed (rows per second); the intro flies rows in from the horizon
        var hr = d.hr > 0 ? d.hr : 70;
        var spd = G.clamp(0.4 + (hr - 60) * 2.1 / 90.0, 0.4, 2.5);
        var sc = live ? sec * spd : 0.35;
        var ph = sc - Math.floor(sc);
        var gq = G.ease(G.clamp((p - 0.15) / 0.6, 0.0, 1.0));
        var fly = 1 + (1 - gq) * 7;
        var rw = CW * 1.5; // road half-width at the bottom edge

        if (vapor) {
            // checkerboard
            var base = Math.floor(sc).toNumber();
            var y2 = 454.0;
            for (var k = 0; k < 12; k++) {
                var z = (4 + (k + 1 - ph) * 2.4) * fly;
                var y1 = HZ + PC / z;
                if (y1 >= 454) {
                    continue;
                }
                if (y1 - HZ < 9) {
                    break;
                }
                var f1 = (y1 - HZ) / FD;
                var f2 = (y2 - HZ) / FD;
                dc.setColor(G.mix(c[6], grid, G.clamp((y1 - HZ) / 70.0, 0.2, 1.0) * 0.55), -1);
                for (var j = -8; j < 8; j++) {
                    if (((k + j + base) & 1) == 0 || j == -1 || j == 0) {
                        continue;
                    }
                    var xa = j * CW;
                    var xb = (j + 1) * CW;
                    if (xa * f2 > 230 || xb * f2 < -230) {
                        continue;
                    }
                    dc.fillPolygon([[CX + xa * f1, y1], [CX + xb * f1, y1], [CX + xb * f2, y2], [CX + xa * f2, y2]]);
                }
                y2 = y1;
            }
        } else {
            // horizontal grid lines (split at the road)
            dc.setPenWidth(2);
            for (var k = 0; k < 22; k++) {
                var z = (4 + (k + 1 - ph) * 2.2) * fly;
                var y = HZ + PC / z;
                if (y >= 454) {
                    continue;
                }
                if (y - HZ < 3) {
                    break;
                }
                var f = (y - HZ) / FD;
                dc.setColor(G.mix(c[6], grid, G.clamp((y - HZ) / 90.0, 0.15, 1.0)), -1);
                dc.drawLine(0, y, CX - rw * f, y);
                dc.drawLine(CX + rw * f, y, 454, y);
            }
            // converging verticals
            var yb = HZ + FD * gq;
            dc.setColor(G.mix(c[6], grid, 0.85), -1);
            for (var j = -9; j <= 9; j++) {
                if (j >= -1 && j <= 1) {
                    continue;
                }
                dc.drawLine(CX + j * CW * 0.02, HZ + 4, CX + j * CW * (yb - HZ) / FD, yb);
            }
        }

        // road + dashed centre line
        dc.setColor(G.mix(c[6], 0x000000, 0.45), -1);
        dc.fillPolygon([[CX - 3, HZ], [CX + 3, HZ], [CX + rw, 454], [CX - rw, 454]]);
        dc.setColor(c[8], -1);
        dc.setPenWidth(2);
        dc.drawLine(CX - 3, HZ + 1, CX - rw * gq - 3 * (1 - gq), HZ + FD * gq);
        dc.drawLine(CX + 3, HZ + 1, CX + rw * gq + 3 * (1 - gq), HZ + FD * gq);
        dc.setColor(G.mix(c[8], 0xFFFFFF, 0.3), -1);
        for (var k = 0; k < 10; k++) {
            var z1 = (4 + (k + 1 - ph) * 2.2) * fly;
            var z2 = z1 + 1.1 * fly;
            var y1 = HZ + PC / z1;
            var y2 = HZ + PC / z2;
            if (y2 >= 454) {
                continue;
            }
            if (y1 - HZ < 4) {
                break;
            }
            var w1 = 4 * (y1 - HZ) / FD;
            var w2 = 4 * (y2 - HZ) / FD;
            var yc = y1 < 454 ? y1 : 454;
            dc.fillPolygon([[CX - w2, y2], [CX + w2, y2], [CX + w1, yc], [CX - w1, yc]]);
        }

        if (vapor) {
            palm(dc, 70, HZ + 70, 150, 0.22, 0x120A26);
            palm(dc, 392, HZ + 60, 128, -0.26, 0x120A26);
        }
        // horizon glow line
        dc.setColor(G.mix(c[2], 0xFFFFFF, 0.45), -1);
        dc.fillRectangle(0, HZ - 1, 454, 2);

        // ---- date (pixel font)
        var dq = G.ease(G.clamp((p - 0.35) / 0.4, 0.0, 1.0));
        if (dq > 0) {
            dc.setColor(G.mix(sky(c, 50, night), G.mix(c[13], 0xFFFFFF, 0.35), dq), -1);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX, 50, 3, 1, 0);
        }

        // ---- time: chrome-neon, powers on with a flicker
        var tq = G.clamp((p - 0.45) / 0.45, 0.0, 1.0);
        var on = tq >= 1;
        if (!on && tq > 0.05) {
            var fl = G.rnd(a.t / 45 + 11) % 10;
            on = fl < 3 + tq * 7;
        }
        if (on) {
            var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
            var mm = G.pad2(d.m);
            time(dc, hh, mm, CX + 3, TY + 4, 13, tUnder);
            time(dc, hh, mm, CX, TY, 7, tq < 1 ? G.dim(c[13], 0.6) : c[13]);
            if (tq > 0.5) {
                time(dc, hh, mm, CX - 1, TY - 1, 2.5, c[14]);
            }
        }

        // ---- slots: three neon readouts
        for (var k = 0; k < 3; k++) {
            var q = G.stag(p - 0.55, k, 0.08, 0.3);
            if (q <= 0) {
                continue;
            }
            var sl = d.slots[k];
            if ((sl[:lbl] as String).length() == 0) {
                continue;
            }
            var x = CX + (k - 1) * 106;
            dc.setColor(c[15], -1);
            dc.fillRoundedRectangle(x - 50, 340, 100, 48, 7);
            dc.setColor(G.mix(c[15], grid, q * 0.8), -1);
            dc.setPenWidth(2);
            dc.drawRoundedRectangle(x - 50, 340, 100, 48, 7);
            dc.setColor(G.mix(c[15], G.mix(grid, 0xFFFFFF, 0.35), q), -1);
            F.px(dc, sl[:lbl] as String, x, 347, 2, 1, 0);
            dc.setColor(G.mix(c[15], G.mix(c[13], 0xFFFFFF, 0.25), q), -1);
            var val = sl[:val] as String;
            var vs = F.pxW(val, 3) > 92 ? 2 : 3;
            F.px(dc, val, x, vs == 3 ? 362 : 365, vs, 1, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var c = PAL[G.clamp(st, 1, 3) - 1];
        var acc = d.accent;
        var grid = c[7] == -1 ? acc : c[7];
        var x = CX + o[0];
        var hz = HZ + o[1];
        // horizon + sun outline with three slits
        dc.setPenWidth(1);
        dc.setColor(G.dim(grid, 0.6), -1);
        dc.drawLine(x - 150, hz, x + 150, hz);
        dc.setColor(G.dim(c[4], 0.6), -1);
        dc.setPenWidth(2);
        G.arcC(dc, x, hz, 62, -90, 90);
        dc.setPenWidth(1);
        for (var k = 0; k < 3; k++) {
            var y = hz - 10 - k * 12;
            var hw = Math.sqrt(62 * 62 - (hz - y) * (hz - y));
            dc.drawLine(x - hw, y, x + hw, y);
        }
        // thin time
        time(dc, d.is24 ? G.pad2(d.h) : "" + G.hour(d), G.pad2(d.m), x, TY + o[1], 3, G.dim(c[13], 0.75));
        dc.setColor(G.dim(c[13], 0.45), -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, x, 50 + o[1], 2, 1, 0);
    }
}
