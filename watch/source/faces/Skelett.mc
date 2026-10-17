import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// SKELETT — an open mechanical skeleton movement as a true analog watch. Barrel (with the
// mainspring coiled by the battery level), centre, third and fourth wheel mesh visibly; the
// escape wheel steps, the pallet fork flicks and the balance wheel swings with its breathing
// hairspring (3 beats/s). Bridges with chamfered edges, ruby jewels, blued screws, lume hands.
// Power reserve (Gangreserve, AUF/AB) = battery. Every wrist raise the balance starts swinging.
// Styles: 1 Gold (rhodium bridges, gold wheels), 2 Stahl (black DLC bridges, steel wheels),
// 3 Tourbillon (anthracite bridges, a rotating cage at 6 o'clock: 1 turn per minute = seconds).
// Mirrors web/js/faces/skelett.js.
class FaceSkelett extends Face {
    const RAD = 0.017453292519943295;
    // movement geometry
    const BX = 227; const BY = 118; const BR = 58; const BN = 46; // barrel
    const R2 = 50; const N2 = 40;                                  // centre wheel
    const W3X = 271; const W3Y = 269; const R3 = 40; const N3 = 32; const P3 = 11; // third wheel + pinion
    const W4X = 227; const W4Y = 338; const R4 = 42; const N4 = 34; // fourth (seconds) wheel
    const EX = 178; const EY = 327; const ER = 22; const EN = 15;   // escape wheel (on the r 111 bridge)
    const PX = 144; const PY = 315;                                 // pallet fork pivot
    const LX = 106; const LY = 297; const LR = 40;                  // balance
    const HZ = 1.5;                                                 // balance frequency (3 beats/s)

    hidden var _fx = 0;
    // static geometry, computed once (polygons are far cheaper than thick arcs/lines on the watch)
    // bridges: [r, w, a0, a1] crescents around the dial centre
    const BRT = [109, 20, -32, 32, 61, 14, 104, 166, 140, 18, 110, 138, 140, 18, 222, 250, 111, 16, 150, 222, 111, 12, 156, 204];
    // minute ticks [x1,y1,x2,y2], index quads + lume lines, plate halves, bridge polygons (chamfer, top)
    hidden var _tk as Array;
    hidden var _iq as Array;
    hidden var _il as Array;
    hidden var _bf as Array;
    hidden var _bpl as Array;
    hidden var _pf as Array;
    hidden var _ppl as Array;

    function initialize() {
        Face.initialize();
        _tk = new [192];
        _iq = new [12];
        _il = new [48];
        var t = 0;
        var x = 0;
        for (var i = 0; i < 60; i++) {
            var g = i * 6;
            if (i % 5 == 0) {
                _iq[x / 4] = quad(196, 219, i % 15 == 0 ? 7 : 5, g);
                _il[x] = G.ptX(227, 200, g); _il[x + 1] = G.ptY(227, 200, g);
                _il[x + 2] = G.ptX(227, 215, g); _il[x + 3] = G.ptY(227, 215, g);
                x += 4;
            } else {
                _tk[t] = G.ptX(227, 210, g); _tk[t + 1] = G.ptY(227, 210, g);
                _tk[t + 2] = G.ptX(227, 218, g); _tk[t + 3] = G.ptY(227, 218, g);
                t += 4;
            }
        }
        _bf = new [12];
        for (var k = 0; k < 24; k += 4) {
            _bf[k / 2] = band(BRT[k], BRT[k + 1], BRT[k + 2], BRT[k + 3]);
            _bf[k / 2 + 1] = band(BRT[k], BRT[k + 1] - 6, BRT[k + 2], BRT[k + 3]);
        }
        _bpl = pts(_bf[0] as Array, null);
        _pf = [halfF(175, 205, 0), halfF(175, 205, 180)];
        _ppl = pts(_pf[0] as Array, null);
    }

    function fps() as Number {
        return _fx;
    }

    // band on a circle around the centre (clock a0..a1) with round end caps, as flat [x0, y0, x1, y1, ...]
    hidden function band(r, w, a0, a1) as Array {
        var n = 10; // fixed: every band has 28 points and shares one point pool
        var h = w / 2.0;
        var f = new [4 * n + 16];
        var q = 0;
        for (var i = 0; i <= n; i++) {
            var g = a0 + (a1 - a0) * i / n.toFloat();
            f[q] = G.ptX(227, r + h, g);
            f[q + 1] = G.ptY(227, r + h, g);
            q += 2;
        }
        var cx = G.ptX(227, r, a1);
        var cy = G.ptY(227, r, a1);
        for (var j = 1; j < 4; j++) {
            f[q] = G.ptX(cx, h, a1 + 45 * j);
            f[q + 1] = G.ptY(cy, h, a1 + 45 * j);
            q += 2;
        }
        for (var i = n; i >= 0; i--) {
            var g = a0 + (a1 - a0) * i / n.toFloat();
            f[q] = G.ptX(227, r - h, g);
            f[q + 1] = G.ptY(227, r - h, g);
            q += 2;
        }
        cx = G.ptX(227, r, a0);
        cy = G.ptY(227, r, a0);
        for (var j = 1; j < 4; j++) {
            f[q] = G.ptX(cx, h, a0 + 180 + 45 * j);
            f[q + 1] = G.ptY(cy, h, a0 + 180 + 45 * j);
            q += 2;
        }
        return f;
    }

    // plate ring: half annulus r1..r2 from clock a0 (flat)
    hidden function halfF(r1, r2, a0) as Array {
        var f = new [92];
        for (var i = 0; i <= 22; i++) {
            f[i * 2] = G.ptX(227, r2, a0 + i * 180 / 22.0);
            f[i * 2 + 1] = G.ptY(227, r2, a0 + i * 180 / 22.0);
        }
        for (var i = 22; i >= 0; i--) {
            f[(45 - i) * 2] = G.ptX(227, r1, a0 + i * 180 / 22.0);
            f[(45 - i) * 2 + 1] = G.ptY(227, r1, a0 + i * 180 / 22.0);
        }
        return f;
    }

    // point list for fillPolygon from a flat array, reusing pool (same length) when given
    hidden function pts(f as Array, pool) as Array {
        var n = f.size() / 2;
        var o = pool;
        if (o == null) {
            o = new [n];
            for (var i = 0; i < n; i++) {
                o[i] = [0.0, 0.0];
            }
        }
        for (var i = 0; i < n; i++) {
            var q = o[i] as Array;
            q[0] = f[i * 2];
            q[1] = f[i * 2 + 1];
        }
        return o as Array;
    }

    // radial quad (applied index) of width w from r1 to r2 at clock angle g
    hidden function quad(r1, r2, w, g) as Array {
        var c = Math.cos(g * RAD) * w / 2.0;
        var s = Math.sin(g * RAD) * w / 2.0;
        var x1 = G.ptX(227, r1, g);
        var y1 = G.ptY(227, r1, g);
        var x2 = G.ptX(227, r2, g);
        var y2 = G.ptY(227, r2, g);
        return [[x1 - c, y1 - s], [x2 - c, y2 - s], [x2 + c, y2 + s], [x1 + c, y1 + s]];
    }

    // n radial teeth from r1 to r2 starting at clock angle a0; sk = tip lean in degrees (escape wheel hooks)
    hidden function teeth(dc as Dc, cx, cy, r1, r2, n, a0, sk) as Void {
        var stp = 2 * Math.PI / n;
        var cs = Math.cos(stp);
        var sn = Math.sin(stp);
        var x = Math.sin(a0 * RAD);
        var y = -Math.cos(a0 * RAD);
        var kc = Math.cos(sk * RAD);
        var ks = Math.sin(sk * RAD);
        for (var i = 0; i < n; i++) {
            dc.drawLine(cx + x * r1, cy + y * r1, cx + (x * kc - y * ks) * r2, cy + (x * ks + y * kc) * r2);
            var nx = x * cs - y * sn;
            y = x * sn + y * cs;
            x = nx;
        }
    }

    // open wheel: toothed rim, k tapered spokes, hub
    hidden function wheel(dc as Dc, cx, cy, r, n, ang, k, col, hi) as Void {
        dc.setColor(col, -1);
        dc.setPenWidth(4);
        dc.drawCircle(cx, cy, r - 4);
        dc.setPenWidth(3);
        teeth(dc, cx, cy, r - 3, r + 1, n, ang, 0);
        for (var i = 0; i < k; i++) {
            G.hand(dc, cx, cy, ang + 18 + i * 360.0 / k, r - 5, 0, 7, 4);
        }
        dc.fillCircle(cx, cy, 8);
        dc.setColor(hi, -1);
        dc.setPenWidth(1);
        G.arcC(dc, cx, cy, r - 6, 285, 345);
    }

    // small pinion (leaves) on top of a wheel
    hidden function pinion(dc as Dc, cx, cy, r, n, ang, col) as Void {
        dc.setColor(col, -1);
        dc.fillCircle(cx, cy, r - 2);
        dc.setPenWidth(3);
        teeth(dc, cx, cy, r - 3, r + 1, n, ang, 0);
    }

    // curved bridge k: chamfer (darker), flat top surface, polished edge lines
    hidden function arcBr(dc as Dc, k, col, hi, lo) as Void {
        dc.setColor(lo, -1);
        dc.fillPolygon(pts(_bf[k * 2] as Array, _bpl));
        dc.setColor(col, -1);
        dc.fillPolygon(pts(_bf[k * 2 + 1] as Array, _bpl));
        var r = BRT[k * 4];
        var h = BRT[k * 4 + 1] / 2.0 - 1;
        dc.setPenWidth(1);
        dc.setColor(hi, -1);
        G.arcC(dc, 227, 227, r + h, BRT[k * 4 + 2], BRT[k * 4 + 3]);
        G.arcC(dc, 227, 227, r - h + 4, BRT[k * 4 + 2], BRT[k * 4 + 3]);
    }

    // ruby jewel in a polished chaton
    hidden function jewel(dc as Dc, x, y, r, chat) as Void {
        dc.setColor(chat, -1);
        dc.fillCircle(x, y, r + 2);
        dc.setColor(0xA3122F, -1);
        dc.fillCircle(x, y, r);
        dc.setColor(0xFF8AA0, -1);
        dc.fillRectangle(x - r * 0.5, y - r * 0.5, 2, 2);
    }

    // screw with slot
    hidden function screw(dc as Dc, x, y, ang, col, hi) as Void {
        dc.setColor(col, -1);
        dc.fillCircle(x, y, 5);
        dc.setColor(hi, -1);
        dc.setPenWidth(2);
        dc.drawLine(G.ptX(x, 4, ang), G.ptY(y, 4, ang), G.ptX(x, 4, ang + 180), G.ptY(y, 4, ang + 180));
    }

    // spiral (mainspring / hairspring) from half circles with alternating centres
    hidden function spiral(dc as Dc, cx, cy, r0, d, turns, rot) as Void {
        var ux = Math.sin(rot * RAD) * d * 0.5;
        var uy = -Math.cos(rot * RAD) * d * 0.5;
        for (var k = 0; k < turns * 2; k++) {
            var o = k % 2 == 0 ? 0 : 1;
            G.arcC(dc, cx + ux * o, cy + uy * o, r0 + k * d, rot + 90 + o * 180, rot + 270 + o * 180);
        }
    }

    // lance hand outline: tail (behind the centre), widest at 70 %, pointed tip
    hidden function hpts(s, c, l, ww, tail) as Array {
        return [
            [227 - s * tail - c * ww * 0.35, 227 + c * tail - s * ww * 0.35],
            [227 + s * l * 0.7 - c * ww, 227 - c * l * 0.7 - s * ww],
            [227 + s * l, 227 - c * l],
            [227 + s * l * 0.7 + c * ww, 227 - c * l * 0.7 + s * ww],
            [227 - s * tail + c * ww * 0.35, 227 + c * tail + s * ww * 0.35]
        ];
    }

    // lance hand with lume: shadow, metal, lume
    hidden function lhand(dc as Dc, deg, len, w, col, lume) as Void {
        var s = Math.sin(deg * RAD);
        var c = Math.cos(deg * RAD);
        dc.setColor(0x000000, -1);
        dc.fillPolygon(hpts(s, c, len + 4, w + 3, 26));
        dc.setColor(col, -1);
        dc.fillPolygon(hpts(s, c, len, w, 22));
        dc.setColor(lume, -1);
        dc.fillPolygon(hpts(s, c, len - 9, w - 3.5, -18));
    }

    // static layer: plate ring, chapter ring, power reserve, date, slots; the movement and the hands run
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var live = a.live;
        _fx = live ? 15 : 0;

        // palette per style: bridge, bridge hi, wheel, wheel hi, screw, screw hi, hands, lume, ring
        var cBr;
        var cBrH;
        var cW;
        var cWH;
        var cSc;
        var cScH;
        var cHd;
        var cLu;
        var cRg;
        if (st == 2) {
            cBr = 0x232529; cBrH = 0x8D949C; cW = 0xA9AFB7; cWH = 0xEEF1F4; cSc = 0xB9BEC5; cScH = 0x4B4F55;
            cHd = 0xD9DDE2; cLu = 0xBFEAFF; cRg = 0x9AA0A8;
        } else if (st == 3) {
            cBr = 0x4B5057; cBrH = 0xC5CAD0; cW = acc; cWH = G.mix(acc, 0xFFFFFF, 0.5); cSc = 0x2B54B8; cScH = 0x9CB8F0;
            cHd = acc; cLu = 0xE8F7D8; cRg = G.mix(acc, 0x888888, 0.4);
        } else {
            cBr = 0xB4B9BF; cBrH = 0xF2F4F6; cW = acc; cWH = G.mix(acc, 0xFFFFFF, 0.5); cSc = 0x2B54B8; cScH = 0x9CB8F0;
            cHd = acc; cLu = 0xE8F7D8; cRg = acc;
        }
        var tour = st == 3;
        var cPl = st == 2 ? 0x141518 : (st == 3 ? 0x1C1E21 : 0x23252A);

        // time base: seconds within the hour (ticks 3x per second while live)
        var frac = live ? a.ms / 1000.0 : 0.0;
        var sec = d.m * 60 + d.s + frac;
        var tk = Math.floor(sec * 3).toNumber();
        var tf = G.ease(G.clamp((sec * 3 - tk) / 0.3, 0.0, 1.0)); // step easing after each beat
        var step = tk + tf;
        var bf = G.clamp(d.batt / 100.0, 0.0, 1.0);
        // balance angle
        var amp = 150 * G.ease(G.clamp(p * 1.3, 0.0, 1.0));
        var bal = live ? amp * Math.sin(2 * Math.PI * HZ * sec) : 0.0;

        if (S) {
            // ---- main plate ring with polished reflections + chapter ring: minute track + applied indices
            dc.setColor(cPl, -1);
            dc.fillPolygon(pts(_pf[0] as Array, _ppl));
            dc.fillPolygon(pts(_pf[1] as Array, _ppl));
            dc.setColor(G.mix(cPl, 0xFFFFFF, 0.12), -1);
            dc.setPenWidth(1);
            G.arcC(dc, 227, 227, 186, 296, 346);
            G.arcC(dc, 227, 227, 198, 300, 336);
            G.arcC(dc, 227, 227, 186, 116, 166);
            G.arcC(dc, 227, 227, 198, 120, 156);
            if (p < 1) {
                // intro: a polish glint runs round the plate
                var g = p * 400 - 20;
                dc.setColor(G.mix(cPl, 0xFFFFFF, 0.22 * (1 - p)), -1);
                dc.fillPolygon(pts(band(190, 26, g - 30, g), _bpl));
            }
            dc.setPenWidth(2);
            dc.setColor(0x6A6A6A, -1);
            var tkk = _tk;
            for (var i = 0; i < 192; i += 4) {
                dc.drawLine(tkk[i], tkk[i + 1], tkk[i + 2], tkk[i + 3]);
            }
            dc.setColor(cRg, -1);
            for (var i = 0; i < 12; i++) {
                dc.fillPolygon(_iq[i] as Array);
            }
            dc.setColor(cLu, -1);
            var il = _il;
            for (var i = 0; i < 48; i += 4) {
                dc.drawLine(il[i], il[i + 1], il[i + 2], il[i + 3]);
            }
        }

        if (M) {
            // ---- wheels (bottom level)
            var a4 = step * 2; // fourth wheel: 6 deg/s
            var a3 = -a4 * R4 / R3.toFloat();
            var a2 = -a3 * P3 / R2.toFloat();
            var aB = -a2 * R2 / BR.toFloat();
            var aE = -step * 12;
            if (!tour) {
                wheel(dc, W4X, W4Y, R4, N4, a4, 4, cW, cWH);
            }
            wheel(dc, W3X, W3Y, R3, N3, a3, 5, cW, cWH);
            pinion(dc, W3X, W3Y, P3, 8, a3, G.mix(cW, cWH, 0.3));
            wheel(dc, 227, 227, R2, N2, a2, 4, cW, cWH);

            // barrel: drum, mainspring (battery), teeth
            dc.setColor(0x101010, -1);
            dc.fillCircle(BX, BY, BR - 3);
            dc.setColor(G.dim(cW, 0.75), -1);
            dc.setPenWidth(2);
            spiral(dc, BX, BY, 12 + (1 - bf) * 20, 2.6 + (1 - bf) * 0.6, 4, aB * 3);
            dc.setColor(cW, -1);
            dc.setPenWidth(5);
            dc.drawCircle(BX, BY, BR - 4);
            dc.setPenWidth(3);
            teeth(dc, BX, BY, BR - 3, BR + 1, BN, aB, 0);

            // escapement (styles 1/2): escape wheel, pallet fork, balance
            if (!tour) {
                dc.setColor(cW, -1);
                dc.setPenWidth(3);
                dc.drawCircle(EX, EY, ER - 5);
                teeth(dc, EX, EY, ER - 5, ER + 1, EN, aE, 14);
                for (var i = 0; i < 4; i++) {
                    G.hand(dc, EX, EY, aE + i * 90, ER - 6, 0, 4, 3);
                }
                pinion(dc, EX, EY, 7, 7, aE, G.mix(cW, cWH, 0.3));
                // fork: toward the balance with pallet arms at the escape wheel
                var fa = 296 + 8 * G.clamp(bal / 25.0, -1.0, 1.0);
                dc.setColor(cWH, -1);
                G.hand(dc, PX, PY, fa, 34, 0, 6, 3);
                G.hand(dc, PX, PY, fa + 180 - 34, 22, 0, 5, 4);
                G.hand(dc, PX, PY, fa + 180 + 34, 22, 0, 5, 4);
                dc.setColor(0xC0183A, -1);
                dc.fillCircle(G.ptX(PX, 21, fa + 146), G.ptY(PY, 21, fa + 146), 2.5);
                dc.fillCircle(G.ptX(PX, 21, fa + 214), G.ptY(PY, 21, fa + 214), 2.5);
                // balance wheel
                dc.setColor(cW, -1);
                dc.setPenWidth(5);
                dc.drawCircle(LX, LY, LR);
                for (var i = 0; i < 3; i++) {
                    G.hand(dc, LX, LY, bal + i * 120, LR - 2, 0, 5, 4);
                }
                for (var i = 0; i < 4; i++) {
                    var wa = bal + 60 + i * 90;
                    dc.fillCircle(G.ptX(LX, LR + 1, wa), G.ptY(LY, LR + 1, wa), 4);
                }
                dc.setColor(cWH, -1);
                dc.setPenWidth(1);
                G.arcC(dc, LX, LY, LR - 2, 290, 340);
                // hairspring: breathes with the balance
                dc.setColor(G.mix(cBrH, 0x4466AA, st == 2 ? 0.1 : 0.45), -1);
                spiral(dc, LX, LY, 6, 2.3 * (1 + 0.08 * Math.sin(bal * RAD)), 5, bal * 0.5);
            }

            // ---- tourbillon (style 3): fixed seconds wheel, cage turning once a minute, balance inside
            if (tour) {
                dc.setColor(cW, -1);
                dc.setPenWidth(3);
                dc.drawCircle(W4X, W4Y, 52);
                teeth(dc, W4X, W4Y, 52, 57, 44, 0, 0);
                // seconds scale around the cage
                dc.setColor(cRg, -1);
                dc.setPenWidth(2);
                for (var i = 0; i < 12; i++) {
                    G.tick(dc, W4X, W4Y, 60, i % 3 == 0 ? 68 : 64, i * 30);
                }
                var cg = step * 2; // cage angle = seconds
                // cage: ring + three arms (one is the seconds pointer)
                dc.setColor(cBrH, -1);
                dc.setPenWidth(3);
                dc.drawCircle(W4X, W4Y, 45);
                for (var i = 0; i < 3; i++) {
                    G.hand(dc, W4X, W4Y, cg + i * 120, 45, 0, 10, 6);
                }
                dc.setColor(cLu, -1);
                G.hand(dc, W4X, W4Y, cg, 58, -42, 4, 2);
                // escape wheel riding on the cage
                var ex = G.ptX(W4X, 31, cg + 60);
                var ey = G.ptY(W4Y, 31, cg + 60);
                dc.setColor(cW, -1);
                dc.setPenWidth(2);
                dc.drawCircle(ex, ey, 7);
                teeth(dc, ex, ey, 7, 11, 15, aE * 2, 14);
                // balance at the cage axis
                dc.setColor(cW, -1);
                dc.setPenWidth(4);
                dc.drawCircle(W4X, W4Y, 30);
                for (var i = 0; i < 3; i++) {
                    G.hand(dc, W4X, W4Y, cg + bal + i * 120, 29, 0, 4, 3);
                }
                dc.setColor(G.mix(cBrH, 0x4466AA, 0.45), -1);
                dc.setPenWidth(1);
                spiral(dc, W4X, W4Y, 4, 2.1 * (1 + 0.08 * Math.sin(bal * RAD)), 4, cg + bal * 0.5);
                for (var i = 0; i < 3; i++) {
                    screw(dc, G.ptX(W4X, 45, cg + i * 120), G.ptY(W4Y, 45, cg + i * 120), cg, cSc, cScH);
                }
            }

            // ---- bridges: concentric crescents around the dial centre
            var cLo = G.mix(cBr, 0x000000, 0.45);
            arcBr(dc, 0, cBr, cBrH, cLo); // barrel bridge through the barrel arbor
            // ratchet wheel on the barrel arbor (turns with the barrel)
            dc.setColor(G.mix(cBr, 0xFFFFFF, 0.25), -1);
            dc.fillCircle(BX, BY, 20);
            dc.setColor(cLo, -1);
            dc.setPenWidth(2);
            teeth(dc, BX, BY, 15, 21, 22, aB, 22);
            dc.setColor(cBrH, -1);
            dc.setPenWidth(1);
            dc.drawCircle(BX, BY, 21);
            screw(dc, BX, BY, aB * 5, cBr, cLo);
            arcBr(dc, 1, cBr, cBrH, cLo); // third wheel bridge
            arcBr(dc, 2, cBr, cBrH, cLo); // counter bridge (4 o'clock)
            jewel(dc, G.ptX(227, 140, 124), G.ptY(227, 140, 124), 3, cBrH);
            screw(dc, G.ptX(227, 140, 110), G.ptY(227, 140, 110), 30, cSc, cScH);
            screw(dc, G.ptX(227, 140, 138), G.ptY(227, 140, 138), 150, cSc, cScH);
            if (tour) {
                arcBr(dc, 3, cBr, cBrH, cLo); // mirrored bridge (8 o'clock)
                jewel(dc, G.ptX(227, 140, 236), G.ptY(227, 140, 236), 3, cBrH);
                screw(dc, G.ptX(227, 140, 222), G.ptY(227, 140, 222), 70, cSc, cScH);
                screw(dc, G.ptX(227, 140, 250), G.ptY(227, 140, 250), 120, cSc, cScH);
            }
            if (!tour) {
                arcBr(dc, 4, cBr, cBrH, cLo); // fourth + escape wheel bridge
                arcBr(dc, 3, cBr, cBrH, cLo); // balance cock
                jewel(dc, LX, LY, 4, cBrH);
                dc.setColor(cBrH, -1);
                dc.setPenWidth(1);
                G.tick(dc, LX, LY, 6, 30, 30); // regulator index
                jewel(dc, EX, EY, 3, cBrH);
                jewel(dc, PX, PY, 3, cBrH);
                screw(dc, G.ptX(227, 111, 150), G.ptY(227, 111, 150), 20, cSc, cScH);
                screw(dc, G.ptX(227, 140, 222), G.ptY(227, 140, 222), 70, cSc, cScH);
                screw(dc, G.ptX(227, 140, 250), G.ptY(227, 140, 250), 120, cSc, cScH);
                // small seconds on the fourth wheel
                dc.setColor(cRg, -1);
                dc.setPenWidth(2);
                for (var i = 0; i < 12; i++) {
                    if (i < 8 || i > 10) {
                        G.tick(dc, W4X, W4Y, 48, i % 3 == 0 ? 55 : 52, i * 30);
                    }
                }
                var sd = live ? step * 2 : d.s * 6;
                dc.setColor(0x000000, -1);
                G.hand(dc, W4X, W4Y, sd, 47, 14, 6, 4);
                dc.setColor(cLu, -1);
                G.hand(dc, W4X, W4Y, sd, 45, 12, 3, 1.5);
                dc.setColor(st == 2 ? 0xFF5A1F : cHd, -1);
                G.hand(dc, W4X, W4Y, sd, 45, -30, 3, 1.5);
                jewel(dc, W4X, W4Y, 3, cBrH);
            } else {
                arcBr(dc, 5, cBr, cBrH, cLo); // tourbillon bridge over the cage
                jewel(dc, W4X, W4Y, 4, cBrH);
                screw(dc, G.ptX(227, 111, 156), G.ptY(227, 111, 156), 20, cSc, cScH);
                screw(dc, G.ptX(227, 111, 204), G.ptY(227, 111, 204), 70, cSc, cScH);
            }
            jewel(dc, W3X, W3Y, 3, cBrH);
            screw(dc, G.ptX(227, 109, -32), G.ptY(227, 109, -32), 40, cSc, cScH);
            screw(dc, G.ptX(227, 109, 32), G.ptY(227, 109, 32), 110, cSc, cScH);
            screw(dc, G.ptX(227, 61, 104), G.ptY(227, 61, 104), 80, cSc, cScH);
        }

        if (S) {
            // ---- power reserve (battery) on the plate ring at 12: AB ... AUF
            var ip = G.ease(G.clamp((p - 0.2) / 0.6, 0.0, 1.0));
            var bfv = bf * ip;
            dc.setColor(G.mix(cPl, 0x000000, 0.6), -1);
            dc.setPenWidth(7);
            G.arcC(dc, 227, 227, 186, -26, 26);
            dc.setColor(bf < 0.15 ? 0xD8432F : cRg, -1);
            dc.setPenWidth(5);
            if (bfv > 0.02) {
                G.arcC(dc, 227, 227, 186, -26, -26 + 52 * bfv);
            }
            dc.setColor(cLu, -1);
            dc.fillCircle(G.ptX(227, 186, -26 + 52 * bfv), G.ptY(227, 186, -26 + 52 * bfv), 4);
            dc.setColor(0x8A8A8A, -1);
            F.px(dc, "AB", G.ptX(227, 185, -34), G.ptY(227, 185, -34) - 7, 2, 1, 0);
            F.px(dc, "AUF", G.ptX(227, 185, 35), G.ptY(227, 185, 35) - 7, 2, 1, 0);

            // ---- date window at 3, slots at 10, 2 and 9
            dc.setColor(0x8A8A8A, -1);
            F.px(dc, d.dowStr, 358, 190, 2, 1, 0);
            dc.setColor(0x000000, -1);
            dc.fillRoundedRectangle(332, 208, 52, 36, 5);
            dc.setColor(cRg, -1);
            dc.setPenWidth(2);
            dc.drawRoundedRectangle(332, 208, 52, 36, 5);
            dc.setColor(0xF2F2F2, -1);
            F.st(dc, "" + d.day, 358, 226, 20, 3, 1, 1.0, 0);
            var SX = [112, 342, 96];
            var SY = [140, 140, 222];
            for (var k = 0; k < 3; k++) {
                var sl = d.slots[k];
                var sp = G.stag(p, k, 0.12, 0.45);
                if (sp <= 0) {
                    continue;
                }
                dc.setColor(G.dim(0x8A8A8A, sp), -1);
                F.px(dc, sl[:lbl] as String, SX[k], SY[k] - 20, 2, 1, 0);
                dc.setColor(G.mix(0x000000, d.dcol, sp), -1);
                var val = sl[:val] as String;
                var vw = F.stW(val, 18);
                F.st(dc, val, SX[k], SY[k] + 6, vw > 80 ? 18 * 80 / vw : 18, 2, 1, 1.0, 0);
            }
        }

        if (!M) {
            return;
        }
        // ---- hands (spring in from 12 on every raise)
        var hp = G.spring(G.clamp((p - 0.15) / 0.75, 0.0, 1.0));
        var md = (d.m + d.s / 60.0) * 6 * hp;
        var hd = ((d.h % 12) * 30 + d.m * 0.5) * hp;
        lhand(dc, hd, 112, 9, cHd, cLu);
        lhand(dc, md, 170, 7, cHd, cLu);
        dc.setColor(cHd, -1);
        dc.fillCircle(227, 227, 9);
        jewel(dc, 227, 227, 3, cHd);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var cx = 227 + o[0];
        var cy = 227 + o[1];
        var met = st == 2 ? 0x5A5E63 : G.dim(d.accent, 0.5);
        // indices + power reserve
        dc.setColor(met, -1);
        dc.setPenWidth(2);
        for (var i = 0; i < 12; i++) {
            G.tick(dc, cx, cy, 198, i % 3 == 0 ? 218 : 212, i * 30);
        }
        dc.setColor(0x262626, -1);
        G.arcC(dc, cx, cy, 186, -26, 26);
        dc.setColor(met, -1);
        G.arcC(dc, cx, cy, 186, -26, -26 + 52 * G.clamp(d.batt / 100.0, 0.0, 1.0));
        // ghost of the movement: barrel, centre wheel, balance / tourbillon
        dc.setColor(0x2A2A2A, -1);
        dc.setPenWidth(1);
        dc.drawCircle(BX + o[0], BY + o[1], BR - 4);
        dc.drawCircle(cx, cy, R2 - 4);
        dc.drawCircle(W3X + o[0], W3Y + o[1], R3 - 4);
        if (st == 3) {
            dc.drawCircle(W4X + o[0], W4Y + o[1], 52);
            dc.drawCircle(W4X + o[0], W4Y + o[1], 30);
        } else {
            dc.drawCircle(W4X + o[0], W4Y + o[1], R4 - 4);
            dc.drawCircle(LX + o[0], LY + o[1], LR);
        }
        // date
        dc.setColor(0x6A6A6A, -1);
        F.px(dc, "" + d.day, 358 + o[0], 219 + o[1], 2, 1, 0);
        // hands: dim metal with lume
        var md = d.m * 6;
        var hd = (d.h % 12) * 30 + d.m * 0.5;
        var lu = st == 2 ? 0x4A7A8A : 0x6A8A5C;
        for (var k = 0; k < 2; k++) {
            var deg = k == 0 ? hd : md;
            var len = k == 0 ? 112 : 170;
            var w = k == 0 ? 9 : 7;
            var s = Math.sin(deg * RAD);
            var c = Math.cos(deg * RAD);
            var p1 = hpts(s, c, len, w, 22);
            var p2 = hpts(s, c, len - 9, w - 3.5, -18);
            for (var i = 0; i < 5; i++) {
                var q1 = p1[i] as Array;
                var q2 = p2[i] as Array;
                q1[0] += o[0];
                q1[1] += o[1];
                q2[0] += o[0];
                q2[1] += o[1];
            }
            dc.setColor(met, -1);
            dc.fillPolygon(p1);
            dc.setColor(lu, -1);
            dc.fillPolygon(p2);
        }
        dc.setColor(met, -1);
        dc.fillCircle(cx, cy, 6);
    }
}
