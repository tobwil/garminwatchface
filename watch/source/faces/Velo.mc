import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// VELO — "Velodrom": a 250 m track seen from above. Weekly bike km become laps (1 km = 4 laps);
// your rider sits at the position of the current lap, the outer rail fills towards the weekly
// goal, the lap board counts the laps still to go and the bell rings once the goal is reached.
// A ghost rider rides at the minute-hand angle, so the track doubles as a clock.
// Styles: 1 Holz, 2 Nacht, 3 Neon. Mirrors web/js/faces/velo.js.
class FaceVelo extends Face {
    const CX = 227;
    const CY = 227;
    const HA = 40;
    const R_RAIL = 182;
    const R_OUT = 178;
    const R_STAY = 160;
    const R_SPR = 146;
    const R_MEAS = 139;
    const R_IN = 136;
    const R_COTE = 124;
    const BELL = [-3, 4, 3, 4, 7, 12, 9, 22, 13, 26, -13, 26, -9, 22, -7, 12];

    hidden var _crx = null;
    hidden var _cry = null;
    hidden var _crh = null;
    hidden var _bc = null;
    hidden var _bcs = -1;
    const NB = 8;

    function initialize() {
        Face.initialize();
    }

    hidden var _fps = 15;

    function fps() as Number {
        return _fps;
    }

    // spectators on the two stand tiers (visible part only), relative to the centre at zoom 1
    hidden function crowd() as Void {
        if (_crx != null) {
            return;
        }
        var xs = [];
        var ys = [];
        var hs = [];
        for (var row = 0; row < 2; row++) {
            var r = 195 + row * 11;
            var s = 77 + row * 31;
            for (var k = 0; k < 96; k++) {
                s = G.rnd(s);
                var q = stadPt(HA, r, (k + row * 0.5) / 96.0);
                var dx = q[0] - CX;
                var dy = q[1] - CY;
                if (dx * dx + dy * dy > 221 * 221) {
                    continue;
                }
                xs.add(dx);
                ys.add(dy);
                hs.add(s % 7 > 4 ? 4 : s % 7);
            }
        }
        _crx = xs;
        _cry = ys;
        _crh = hs;
    }

    // ---------- stadium helpers (all radii/half straight already scaled)
    hidden function stadFill(dc as Dc, a, r) as Void {
        dc.fillCircle(CX - a, CY, r);
        dc.fillCircle(CX + a, CY, r);
        dc.fillRectangle(CX - a, CY - r, 2 * a, 2 * r);
    }

    // outline from the finish line (bottom centre) counter-clockwise, fraction f of the lap
    hidden function stadLine(dc as Dc, a, r, f) as Void {
        if (f <= 0) {
            return;
        }
        var P = 4 * a + 2 * Math.PI * r;
        var l = f * P;
        var s = l < a ? l : a;
        if (s > 0.3) {
            dc.drawLine(CX, CY + r, CX + s, CY + r);
        }
        l -= a;
        if (l <= 0) {
            return;
        }
        s = l < Math.PI * r ? l : Math.PI * r;
        G.arcC(dc, CX + a, CY, r, 180 - s / r * 180 / Math.PI, 180);
        l -= Math.PI * r;
        if (l <= 0) {
            return;
        }
        s = l < 2 * a ? l : 2 * a;
        dc.drawLine(CX + a, CY - r, CX + a - s, CY - r);
        l -= 2 * a;
        if (l <= 0) {
            return;
        }
        s = l < Math.PI * r ? l : Math.PI * r;
        G.arcC(dc, CX - a, CY, r, 360 - s / r * 180 / Math.PI, 360);
        l -= Math.PI * r;
        if (l <= 0) {
            return;
        }
        s = l < a ? l : a;
        dc.drawLine(CX - a, CY + r, CX - a + s, CY + r);
    }

    // point + CCW tangent at lap fraction u (0 = finish line, bottom centre)
    hidden function stadPt(a, r, u) {
        u = u - Math.floor(u);
        var P = 4 * a + 2 * Math.PI * r;
        var l = u * P;
        if (l < a) {
            return [CX + l, CY + r, 1, 0];
        }
        l -= a;
        if (l < Math.PI * r) {
            return bendPt(CX + a, r, 180 - l / r * 180 / Math.PI);
        }
        l -= Math.PI * r;
        if (l < 2 * a) {
            return [CX + a - l, CY - r, -1, 0];
        }
        l -= 2 * a;
        if (l < Math.PI * r) {
            return bendPt(CX - a, r, 360 - l / r * 180 / Math.PI);
        }
        l -= Math.PI * r;
        return [CX - a + l, CY + r, 1, 0];
    }

    hidden function bendPt(bx, r, c) {
        var x = G.ptX(bx, r, c);
        var y = G.ptY(CY, r, c);
        var ux = (x - bx) / r;
        var uy = (y - CY) / r;
        return [x, y, uy, -ux];
    }

    // point where the ray at clock angle deg meets the stadium of radius r
    hidden function rayPt(a, r, deg) {
        var sx = Math.sin(deg * Math.PI / 180);
        var sy = -Math.cos(deg * Math.PI / 180);
        var ay = sy.abs();
        if (ay > 0.001) {
            var t = r / ay;
            if ((t * sx).abs() <= a) {
                return [CX + t * sx, CY + t * sy, sy < 0 ? -1 : 1, 0];
            }
        }
        var ax = sx.abs();
        var t2 = a * ax + Math.sqrt(a * a * ax * ax - a * a + r * r);
        var bx = sx < 0 ? CX - a : CX + a;
        var x = CX + t2 * sx;
        var y = CY + t2 * sy;
        var ux = (x - bx) / r;
        var uy = (y - CY) / r;
        return [x, y, uy, -ux];
    }

    // top-down rider: bike along the tangent (tx, ty), jersey col, helmet hc
    hidden function rider(dc as Dc, x, y, tx, ty, col, hc, bike, s) as Void {
        var nx = -ty;
        var ny = tx;
        dc.setColor(bike, -1);
        dc.setPenWidth(3 * s);
        dc.drawLine(x - tx * 12 * s, y - ty * 12 * s, x + tx * 12 * s, y + ty * 12 * s);
        dc.setColor(col, -1);
        dc.setPenWidth(2 * s);
        dc.drawLine(x + (tx * 4 + nx * 5) * s, y + (ty * 4 + ny * 5) * s, x + (tx * 10 + nx * 3) * s, y + (ty * 10 + ny * 3) * s);
        dc.drawLine(x + (tx * 4 - nx * 5) * s, y + (ty * 4 - ny * 5) * s, x + (tx * 10 - nx * 3) * s, y + (ty * 10 - ny * 3) * s);
        dc.fillPolygon([
            [x - tx * 8 * s, y - ty * 8 * s],
            [x + (-tx * 3 + nx * 4) * s, y + (-ty * 3 + ny * 4) * s],
            [x + (tx * 4 + nx * 5.5) * s, y + (ty * 4 + ny * 5.5) * s],
            [x + tx * 7 * s, y + ty * 7 * s],
            [x + (tx * 4 - nx * 5.5) * s, y + (ty * 4 - ny * 5.5) * s],
            [x + (-tx * 3 - nx * 4) * s, y + (-ty * 3 - ny * 4) * s]
        ]);
        dc.setColor(hc, -1);
        dc.fillCircle(x + tx * 6 * s, y + ty * 6 * s, 3.6 * s);
    }

    // bell, hanging from (x, y), swing angle deg
    hidden function bell(dc as Dc, x, y, deg, col, dark) as Void {
        var s = Math.sin(deg * Math.PI / 180);
        var c = Math.cos(deg * Math.PI / 180);
        var n = BELL.size() / 2;
        var pts = new [n];
        for (var i = 0; i < n; i++) {
            var px = BELL[i * 2];
            var py = BELL[i * 2 + 1];
            pts[i] = [x + px * c - py * s, y + px * s + py * c];
        }
        dc.setColor(dark, -1);
        dc.setPenWidth(3);
        dc.drawLine(x, y, x - 4 * s, y + 4 * c);
        // clapper swings a little behind
        dc.fillCircle(x - 30 * s * 0.7, y + 30 * c, 3.5);
        dc.setColor(col, -1);
        dc.fillPolygon(pts);
        dc.fillCircle(x - 4 * s, y + 4 * c, 4);
    }

    // [bg, woodIn, woodOut, board, cote, infield, meas, red, blue, rail, ink, sub, crowd]
    hidden function trackCols(st, acc) {
        if (st == 2) {
            return [0x000000, 0x33251A, 0x1C130C, 0x291D13, 0x173E66, 0x05080E, 0x0A0A0A, 0xFF3B3F, 0x3D8BFF, 0x5A5A5A, 0xFFFFFF, 0x8A93A6, 0x161A24];
        }
        if (st == 3) {
            return [0x000000, 0x000000, 0x000000, 0x000000, G.dim(acc, 0.22), 0x000000, G.dim(acc, 0.45), acc, G.dim(acc, 0.7), G.dim(acc, 0.35), 0xFFFFFF, G.dim(acc, 0.75), G.dim(acc, 0.25)];
        }
        return [0x0B0B0B, 0xDCAC70, 0xB47C45, 0xC4904F, 0x4FA3E3, 0x1C3A2B, 0x1A1A1A, 0xD6262B, 0x2F6FD6, 0xDEDEDE, 0xFFFFFF, 0x9FB3C4, 0x3A3A3A];
    }

    // static layer: track, stands, rail, infield, time, lap board; the riders and the bell move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var t = a.t;
        var live = a.live && p >= 1;
        var C = trackCols(st, acc);
        var bg = C[0];
        _fps = st == 2 ? 12 : 15;

        // camera zoom
        var z = 0.6 + 0.4 * G.ease(G.clamp(p / 0.6, 0.0, 1.0));
        var za = HA * z;
        var fade = G.clamp(p / 0.35, 0.0, 1.0);

        if (S) {
            // ---- stands (outside the rail): two tiers with spectators
            if (st != 3) {
                dc.setColor(G.mix(bg, C[12], fade), -1);
                dc.setPenWidth(9);
                for (var row = 0; row < 2; row++) {
                    var r = (195 + row * 11) * z;
                    // only the parts inside the round screen
                    var v = row == 0 ? 52 : 30;
                    dc.drawLine(CX - za, CY - r, CX + za, CY - r);
                    dc.drawLine(CX - za, CY + r, CX + za, CY + r);
                    G.arcC(dc, CX + za, CY, r, 0, v);
                    G.arcC(dc, CX + za, CY, r, 180 - v, 180);
                    G.arcC(dc, CX - za, CY, r, 180, 180 + v);
                    G.arcC(dc, CX - za, CY, r, 360 - v, 360);
                }
                crowd();
                var n = _crx.size();
                var HC = [acc, 0xF0F0F0, 0x4A78C8, 0xF2C14E, 0x8A8A8A];
                for (var h = 0; h < 5; h++) {
                    dc.setColor(G.mix(bg, HC[h], (st == 2 ? 0.4 : 0.7) * fade), -1);
                    for (var i = 0; i < n; i++) {
                        if (_crh[i] == h) {
                            dc.fillRectangle(CX + _crx[i] * z - 1.5, CY + _cry[i] * z - 1.5, 3, 3);
                        }
                    }
                }
            }

            // ---- track surface
            if (st != 3) {
                dc.setColor(G.mix(bg, 0x2A2A2A, fade), -1);
                dc.setPenWidth(Math.ceil(8 * z).toNumber());
                stadLine(dc, za, (R_RAIL - 0.5) * z, 1.0);
                // banked boards: concentric bands, darker towards the outside (colours cached per style)
                if (_bcs != st) {
                    var bc = new [NB];
                    for (var j = 0; j < NB; j++) {
                        var c = G.mix(C[1], C[2], j / (NB - 1.0));
                        if (j % 2 == 1) {
                            c = G.mix(c, C[3], 0.5);
                        }
                        bc[j] = c;
                    }
                    _bc = bc;
                    _bcs = st;
                }
                var bw = 42.0 / NB;
                dc.setPenWidth(Math.ceil(bw * z).toNumber() + 1);
                for (var j = 0; j < NB; j++) {
                    dc.setColor(fade >= 1 ? _bc[j] : G.mix(bg, _bc[j], fade), -1);
                    var r = (R_IN + bw / 2 + j * bw) * z;
                    G.arcC(dc, CX + za, CY, r, 0, 180);
                    G.arcC(dc, CX - za, CY, r, 180, 360);
                    var r0 = (R_IN + j * bw) * z;
                    dc.fillRectangle(CX - za, CY - r0 - bw * z, 2 * za, bw * z + 1);
                    dc.fillRectangle(CX - za, CY + r0, 2 * za, bw * z + 1);
                }
                // spotlights (Nacht): warm pools on the boards, flickering
                if (st == 2) {
                    var LU = [0.08, 0.3, 0.55, 0.8];
                    for (var k = 0; k < 4; k++) {
                        var q = stadPt(za, (R_IN + 21) * z, LU[k]);
                        var fl = 1.0;
                        if (live) {
                            fl = 0.85 + 0.15 * G.noise(t / 160.0 + k * 3.7);
                        }
                        for (var j = 0; j < 2; j++) {
                            dc.setColor(G.mix(C[1], 0xFFD59A, (0.12 + j * 0.2) * fl * fade), -1);
                            dc.fillCircle(q[0], q[1], (19 - j * 8) * z);
                        }
                    }
                }
                // côte d'azur + infield
                dc.setColor(G.mix(bg, C[4], fade), -1);
                dc.setPenWidth(Math.ceil(13 * z).toNumber());
                stadLine(dc, za, (R_COTE + 6) * z, 1.0);
                dc.setColor(G.mix(bg, C[5], fade), -1);
                stadFill(dc, za, R_COTE * z);
            } else {
                // Neon: côte d'azur as a dim line
                dc.setColor(C[4], -1);
                dc.setPenWidth(2);
                stadLine(dc, za, R_COTE * z, G.ease(G.stag(p, 0, 0, 0.6)));
            }

            // ---- lines draw themselves (measurement, sprinter, stayer, outer edge)
            var LR = [R_IN, R_MEAS, R_SPR, R_STAY, R_OUT];
            var LC = [C[6], C[6], C[7], C[8], st == 3 ? C[7] : C[3]];
            var LW = [st == 3 ? 2 : 0, st == 3 ? 0 : 2, 3, 3, st == 3 ? 3 : 0];
            for (var k = 0; k < 5; k++) {
                if (LW[k] == 0) {
                    continue;
                }
                var f = G.easeInOut(G.stag(p, k, 0.07, 0.5));
                if (st == 2 && k >= 2) {
                    dc.setColor(G.dim(LC[k], 0.3), -1);
                    dc.setPenWidth(6);
                    stadLine(dc, za, LR[k] * z, f);
                }
                dc.setColor(LC[k], -1);
                dc.setPenWidth(LW[k]);
                stadLine(dc, za, LR[k] * z, f);
            }

            // ---- finish line (bottom centre) + 200 m line + pursuit line (top centre)
            var lp = G.ease(G.stag(p, 2, 0.1, 0.4));
            if (lp > 0) {
                var y0 = CY + R_IN * z;
                var y1 = CY + R_OUT * z;
                dc.setColor(st == 3 ? 0xFFFFFF : 0xF4F4F4, -1);
                dc.fillRectangle(CX - 4, y0, 8, (y1 - y0) * lp);
                dc.setColor(st == 3 ? acc : 0x111111, -1);
                dc.fillRectangle(CX - 1, y0, 2, (y1 - y0) * lp);
                dc.setColor(C[7], -1);
                dc.fillRectangle(CX - 1, CY - R_OUT * z, 3, (R_OUT - R_IN) * z * lp);
                dc.setColor(st == 3 ? G.dim(0xFFFFFF, 0.6) : 0xF4F4F4, -1);
                dc.setPenWidth(2);
                var q0 = stadPt(za, R_IN * z, 0.8);
                var q1 = stadPt(za, R_OUT * z, 0.8);
                dc.drawLine(q0[0], q0[1], G.lerp(q0[0], q1[0], lp), G.lerp(q0[1], q1[1], lp));
            }
        }

        // ---- rail + goal progress
        var km = d.wkBike > 0 ? d.wkBike / 1000.0 : 0.0;
        var goal = d.cfg.bikeGoal > 0 ? d.cfg.bikeGoal : 1;
        var laps4 = km * 4;
        var laps = Math.floor(laps4 + 0.0001).toNumber();
        var gl = goal * 4;
        var rem = gl - laps;
        var gf = G.clamp(km / goal, 0.0, 1.0);
        var rf = G.easeInOut(G.stag(p, 4, 0.07, 0.5));
        if (S) {
            dc.setColor(st == 3 ? G.dim(acc, 0.25) : C[9], -1);
            dc.setPenWidth(st == 3 ? 2 : 3);
            stadLine(dc, za, R_RAIL * z, rf);
            if (gf > 0) {
                var ef = gf * G.ease(G.stag(p, 0, 0.4, 0.6));
                if (st == 2) {
                    dc.setColor(G.dim(acc, 0.35), -1);
                    dc.setPenWidth(11);
                    stadLine(dc, za, R_RAIL * z, ef);
                }
                dc.setColor(acc, -1);
                dc.setPenWidth(5);
                stadLine(dc, za, R_RAIL * z, ef);
                var q = stadPt(za, R_RAIL * z, ef);
                dc.fillCircle(q[0], q[1], 5);
            }
        }

        var gcol = st == 3 ? 0xBFC7D4 : (st == 2 ? 0x8FA3C4 : 0xE9EEF5);
        if (M) {
            // ---- riders: two training partners lapping, the ghost (minute) and you
            var bike = st == 1 ? 0x2A2A2A : 0x9A9A9A;
            var e = G.easeInOut(G.clamp((p - 0.3) / 0.7, 0.0, 1.0));
            for (var k = 0; k < 2; k++) {
                var u = live ? ((t + 13400 + k * 260) % 6500) / 6500.0 : 0.66 + k * 0.04;
                var q = stadPt(za, (R_MEAS + 6) * z, u * e);
                var pc = st == 3 ? G.dim(acc, 0.45) : (k == 0 ? 0x3C6E9E : 0x5F8FBF);
                if (e > 0.02) {
                    rider(dc, q[0], q[1], q[2], q[3], pc, st == 3 ? G.dim(acc, 0.6) : 0xE8E8E8, bike, 0.8 * z);
                }
            }
            // ghost rider at the minute angle
            var mdeg = d.m * 6 + d.s * 0.1;
            var delta = 180 - mdeg;
            if (delta < 0) {
                delta += 360;
            }
            var gdeg = 180 - delta * e;
            var gq = rayPt(za, (R_STAY + 9) * z, gdeg);
            var gbase = st == 1 ? C[2] : bg;
            if (e > 0.02) {
                // pursuit trail
                for (var k = 1; k <= 3; k++) {
                    var tq = rayPt(za, (R_STAY + 9) * z, gdeg + k * 2.2);
                    dc.setColor(G.mix(gbase, gcol, 0.5 - k * 0.13), -1);
                    dc.fillCircle(tq[0], tq[1], 4 - k * 0.8);
                }
                rider(dc, gq[0], gq[1], gq[2], gq[3], G.mix(gbase, gcol, 0.75), gcol, G.mix(gbase, bike, 0.6), z);
            }
            // you: fractional position of the current lap, oscillating a little while live
            var fu = laps4 - Math.floor(laps4);
            if (live) {
                fu += 0.012 * Math.sin(t / 700.0);
            }
            var yq = stadPt(za, (R_SPR + 7) * z, fu * e);
            if (e > 0.02) {
                if (st != 1) {
                    dc.setColor(G.dim(acc, 0.3), -1);
                    dc.fillCircle(yq[0], yq[1], 13 * z);
                }
                rider(dc, yq[0], yq[1], yq[2], yq[3], acc, 0xFFFFFF, bike, 1.1 * z);
            }
        }

        // ---- infield content (fades in with the zoom)
        var ip = G.ease(G.clamp((p - 0.25) / 0.6, 0.0, 1.0));
        var ink = C[10];
        var sub = C[11];
        var ib = C[5];
        if (S) {
            // slots
            for (var k = 0; k < 2; k++) {
                var sp = G.ease(G.stag(p - 0.3, k, 0.08, 0.5));
                var sl = d.slots[k];
                var x = k == 0 ? 162 : 292;
                dc.setColor(G.mix(ib, sub, ip), -1);
                F.px(dc, sl[:lbl] as String, x, 124, 2, 1, 0);
                dc.setColor(G.mix(ib, d.dcol, ip * sp), -1);
                F.px(dc, sl[:val] as String, x, 142, 3, 1, 0);
            }
            // time
            var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
            var ts = hh + ":" + G.pad2(d.m);
            var tp = G.ease(G.clamp((p - 0.2) * 1.6, 0.0, 1.0));
            if (st == 3) {
                dc.setColor(G.dim(acc, 0.35), -1);
                F.st(dc, ts, CX, 212, 70, 12, 1, tp, 0);
            }
            dc.setColor(ink, -1);
            F.st(dc, ts, CX, 212, 70, st == 3 ? 4 : 8, 1, tp, 0);
        }

        // lap board
        var bp = G.ease(G.clamp((p - 0.45) / 0.55, 0.0, 1.0));
        if (bp > 0) {
            var by = 264;
            if (rem > 0 && S) {
                var shownRem = Math.round(G.lerp(gl, rem, bp)).toNumber();
                var txt = "" + shownRem;
                var n = txt.length();
                var cw = 24;
                var ch = 34;
                var bw = n * (cw + 4) + 62;
                var bx = CX - 16 - bw / 2.0;
                dc.setColor(st == 3 ? 0x000000 : 0x0D0D0D, -1);
                dc.fillRoundedRectangle(bx, by, bw, ch + 8, 5);
                dc.setColor(st == 3 ? acc : 0x6A6A6A, -1);
                dc.setPenWidth(2);
                dc.drawRoundedRectangle(bx, by, bw, ch + 8, 5);
                dc.setColor(sub, -1);
                F.px(dc, "NOCH", bx + 8, by + 14, 2, 0, 0);
                for (var i = 0; i < n; i++) {
                    var cx0 = bx + 58 + i * (cw + 4);
                    dc.setColor(st == 3 ? G.dim(acc, 0.18) : 0x2B2B2B, -1);
                    dc.fillRoundedRectangle(cx0, by + 4, cw, ch, 3);
                    dc.setColor(0xFFFFFF, -1);
                    F.st(dc, txt.substring(i, i + 1) as String, cx0 + cw / 2, by + 4 + ch / 2, 22, 3, 1, 1.0, 0);
                    dc.setColor(st == 3 ? 0x000000 : 0x0D0D0D, -1);
                    dc.fillRectangle(cx0, by + 4 + ch / 2, cw, 1);
                }
                bell(dc, CX + bw / 2.0 + 12, by + 2, 0, st == 3 ? G.dim(acc, 0.5) : 0x6E6E6E, 0x3A3A3A);
            } else if (rem <= 0) {
                var sw = live ? 28 * Math.sin(t / 110.0) : 18;
                dc.setColor(acc, -1);
                if (S) {
                    F.st(dc, "GLOCKE!", CX - 20, by + 21, 22, 4, 1, bp, 0);
                }
                var bx2 = CX + 78;
                // the bell rings over the cached board
                if (!M) {
                    return;
                }
                bell(dc, bx2, by, sw, 0xF2C14E, 0x8A6A1A);
                // ringing waves
                dc.setColor(G.dim(0xF2C14E, 0.8), -1);
                dc.setPenWidth(2);
                var ph = live ? (t % 500) / 500.0 : 0.5;
                G.arcC(dc, bx2, by + 16, 20 + ph * 6, 45, 105);
                G.arcC(dc, bx2, by + 16, 20 + ph * 6, 255, 315);
            }
        }

        if (!S) {
            return;
        }
        // laps + legend
        dc.setColor(G.mix(ib, ink, ip), -1);
        F.px(dc, laps + " RUNDEN", CX, 314, 2, 1, 0);
        dc.setColor(G.mix(ib, acc, ip), -1);
        dc.fillCircle(CX - 48, 341, 4);
        dc.setColor(G.mix(ib, sub, ip), -1);
        F.px(dc, "DU", CX - 40, 334, 2, 0, 0);
        dc.setColor(G.mix(ib, gcol, ip), -1);
        dc.setPenWidth(2);
        dc.drawCircle(CX + 4, 341, 4);
        dc.setColor(G.mix(ib, sub, ip), -1);
        F.px(dc, "MIN", CX + 12, 334, 2, 0, 0);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var ox = o[0];
        var oy = o[1];
        dc.setColor(0x333333, -1);
        dc.setPenWidth(2);
        G.arcC(dc, CX + HA + ox, CY + oy, R_OUT, 0, 180);
        G.arcC(dc, CX - HA + ox, CY + oy, R_OUT, 180, 360);
        dc.drawLine(CX - HA + ox, CY - R_OUT + oy, CX + HA + ox, CY - R_OUT + oy);
        dc.drawLine(CX - HA + ox, CY + R_OUT + oy, CX + HA + ox, CY + R_OUT + oy);
        var km = d.wkBike > 0 ? d.wkBike / 1000.0 : 0.0;
        var l4 = km * 4;
        var yq = stadPt(HA, R_SPR + 7, l4 - Math.floor(l4));
        dc.setColor(G.dim(d.accent, 0.7), -1);
        dc.fillCircle(yq[0] + ox, yq[1] + oy, 5);
        var gq = rayPt(HA, R_STAY + 9, d.m * 6);
        dc.setColor(0x7A7A7A, -1);
        dc.drawCircle(gq[0] + ox, gq[1] + oy, 5);
        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        dc.setColor(0x9A9A9A, -1);
        F.st(dc, hh + ":" + G.pad2(d.m), CX + ox, 212 + oy, 70, 3, 1, 1.0, 0);
    }
}
