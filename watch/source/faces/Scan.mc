import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// SCAN — "KI-Vision": the display is a camera feed running an object detector. A scan line
// sweeps down and every object it passes is locked with corner-bracket boxes: three data
// slots ("STRESS 97%" + value) and the time ("UHRZEIT 99,9%"). Every wrist raise re-detects
// (new confidences from wakeN); while awake the boxes gently track.
// Styles: 1 Terminator (red HUD), 2 Clean (labelling tool), 3 Thermal (heat camera).
// Mirrors web/js/faces/scan.js.
class FaceScan extends Face {
    const SP = 2000; // scan period (ms): 520 px sweep
    const LOCK = 380; // lock-on animation (ms)
    const CC = [0x00C2FF, 0xFFD60A, 0x30D158]; // Clean: class colours of the slots
    // thermal palette stops (v = 0, .25, .45, .7, .9, 1)
    const TV = [0.0, 0.25, 0.45, 0.7, 0.9, 1.0];
    const TC = [0x05020E, 0x2A0A5E, 0x9B1F8A, 0xFF6A00, 0xFFD200, 0xFFF6C0];
    const BY = [70, 300, 300, 148];
    const BH = [52, 54, 54, 116];
    // heat blobs: x, y, radius, base amplitude, amplitude per heat
    const HB = [227, 215, 160, 0.36, 0.45, 112, 335, 95, 0.25, 0.3, 345, 322, 105, 0.22, 0.35, 262, 70, 85, 0.18, 0.3, 58, 170, 75, 0.12, 0.25];
    const ORDER = [3, 0, 1, 2]; // draw time last (on top)
    const MAXR = 240;
    // verdict on the main object (you): fit / stressed / tired / ok
    const VQ = [
        ["MENSCH: STARTKLAR", "ZIEL: KOM-JÄGER", "MODUS: ANGRIFF"],
        ["MENSCH: UNTER STROM", "EMPFEHLUNG: ATMEN", "STRESSQUELLE: DU"],
        ["MENSCH: AKKU LEER", "EMPFEHLUNG: SOFA", "SCHLAFBEDARF HOCH"],
        ["MENSCH: STABIL", "ZUSTAND: SOLIDE", "KEINE ANOMALIEN"],
        ["SIGNAL UNSCHARF", "ZU WENIG DATEN", "OBJEKT VERDECKT"]
    ];

    // box geometry filled per frame: 0..2 slots, 3 time
    hidden var _bx = [0, 0, 0, 87] as Array<Number>;
    hidden var _bw = [0, 0, 0, 280] as Array<Number>;
    // heat map runs (x, y, w, colour), cached per heart rate / stress
    hidden var _rx as Array<Number>;
    hidden var _ry as Array<Number>;
    hidden var _rw as Array<Number>;
    hidden var _rc as Array<Number>;
    hidden var _rn = 0;
    hidden var _hk = -999999;
    hidden var _ha = null;
    hidden var _hm = null;
    // reticle lines (x1, y1, x2, y2): 36 lens ticks, then 12 chevron strokes
    hidden var _rt as Array<Float>;

    function initialize() {
        Face.initialize();
        _rx = new [MAXR] as Array<Number>;
        _ry = new [MAXR] as Array<Number>;
        _rw = new [MAXR] as Array<Number>;
        _rc = new [MAXR] as Array<Number>;
        _rt = new [192] as Array<Float>;
        heatPrep();
        for (var k = 0; k < 36; k++) {
            tk(k, k % 9 == 0 ? 200 : 208, 214, k * 10);
        }
        for (var k = 0; k < 4; k++) {
            var deg = k * 90;
            tk(36 + k * 3, 186, 200, deg);
            tk(37 + k * 3, 186, 186 + 8, deg - 4);
            tk(38 + k * 3, 186, 186 + 8, deg + 4);
        }
    }

    hidden function tk(i, r1, r2, deg) as Void {
        _rt[i * 4] = G.ptX(227, r1, deg).toFloat();
        _rt[i * 4 + 1] = G.ptY(227, r1, deg).toFloat();
        _rt[i * 4 + 2] = G.ptX(227, r2, deg).toFloat();
        _rt[i * 4 + 3] = G.ptY(227, r2, deg).toFloat();
    }

    function fps() as Number {
        return 15;
    }

    // per-cell heat = 0.1 + A + H * B; A and B (x1000) depend only on the geometry:
    // computed once, so a data change only re-quantizes the 361 cells
    hidden function heatPrep() as Void {
        _ha = new [361] as Array<Number>;
        _hm = new [361] as Array<Number>;
        for (var r = 0; r < 19; r++) {
            for (var c = 0; c < 19; c++) {
                var cx = c * 24 + 11;
                var cy = r * 24 + 11;
                var sa = 0.0;
                var sm = 0.0;
                for (var b = 0; b < 25; b += 5) {
                    var dx = cx - HB[b];
                    var dy = cy - HB[b + 1];
                    var f = 1 - (dx * dx + dy * dy).toFloat() / (HB[b + 2] * HB[b + 2]);
                    if (f > 0) {
                        sa += HB[b + 3] * f * f;
                        sm += HB[b + 4] * f * f;
                    }
                }
                _ha[r * 19 + c] = Math.round(sa * 1000).toNumber();
                _hm[r * 19 + c] = Math.round(sm * 1000).toNumber();
            }
        }
    }

    hidden function heatH(d as D) as Number {
        return Math.round(G.clamp((d.hr > 0 ? (d.hr - 50) / 80.0 : 0.2) + (d.stress >= 0 ? d.stress / 200.0 : 0.1), 0.0, 1.0) * 1000).toNumber();
    }

    hidden function heat(H) as Void {
        var ha = _ha as Array<Number>;
        var hm = _hm as Array<Number>;
        _rn = 0;
        for (var r = 0; r < 19; r++) {
            var y = r * 24 - 1;
            var cy = y + 12;
            var q0 = -1;
            var x0 = 0;
            for (var c = 0; c <= 19; c++) {
                var q = -1;
                var cx = c * 24 - 1 + 12;
                if (c < 19 && (cx - 227) * (cx - 227) + (cy - 227) * (cy - 227) < 245 * 245) {
                    var v = 100000 + ha[r * 19 + c] * 1000 + hm[r * 19 + c] * H; // x 1e6
                    q = v >= 1000000 ? 11 : (v * 12) / 1000000;
                }
                if (q != q0) {
                    if (q0 >= 0 && _rn < MAXR) {
                        _rx[_rn] = x0;
                        _ry[_rn] = y;
                        _rw[_rn] = c * 24 - 1 - x0;
                        _rc[_rn] = therm(q0 / 11.0);
                        _rn++;
                    }
                    q0 = q;
                    x0 = c * 24 - 1;
                }
            }
        }
    }

    hidden function verdict(d as D) as String {
        var k = (d.bb < 0 && d.stress < 0) ? 4 : (d.stress >= 60 ? 1 : ((d.bb >= 0 && d.bb < 30) ? 2 : ((d.bb >= 60 && d.stress < 40) ? 0 : 3)));
        return VQ[k][d.wakeN % 3] as String;
    }

    hidden function therm(v) as Number {
        v = G.clamp(v, 0.0, 1.0);
        var k = 1;
        while (k < 5 && v > TV[k]) {
            k++;
        }
        return G.mix(TC[k - 1], TC[k], (v - TV[k - 1]) / (TV[k] - TV[k - 1]));
    }

    // scan line y at time t (first sweep starts above the screen)
    hidden function scanY(t) {
        return ((t % SP).toFloat() / SP) * 520 - 30;
    }

    // ms (since wake) at which the first sweep passes y
    hidden function passT(y) {
        return ((y + 30) / 520.0) * SP;
    }

    // corner brackets around x,y,w,h with arm length cl
    hidden function brackets(dc as Dc, x, y, w, h, cl) as Void {
        dc.drawLine(x, y, x + cl, y);
        dc.drawLine(x, y, x, y + cl);
        dc.drawLine(x + w, y, x + w - cl, y);
        dc.drawLine(x + w, y, x + w, y + cl);
        dc.drawLine(x, y + h, x + cl, y + h);
        dc.drawLine(x, y + h, x, y + h - cl);
        dc.drawLine(x + w, y + h, x + w - cl, y + h);
        dc.drawLine(x + w, y + h, x + w, y + h - cl);
    }

    // label chip "<lbl> · <conf>" typed out to n characters
    hidden function chip(dc as Dc, x, y, lbl as String, conf as String, n, bg, fg) as Void {
        var txt = lbl + "  " + conf;
        var w = F.pxW(txt, 2) + 8;
        n = G.clamp(n, 0, txt.length());
        if (n <= 0) {
            return;
        }
        var wn = n >= txt.length() ? w : F.pxW(txt.substring(0, n), 2) + 8;
        dc.setColor(bg, -1);
        dc.fillRectangle(x, y, wn, 18);
        dc.setColor(fg, -1);
        F.px(dc, txt.substring(0, n), x + 4, y + 2, 2, 0, 0);
        if (n > lbl.length() + 1) {
            dc.fillRectangle(x + 4 + lbl.length() * 12 + 9, y + 7, 3, 3);
        }
    }

    hidden function outline(dc as Dc, txt as String, x, y, h, pen, col, glow) as Void {
        dc.setColor(glow, -1);
        F.st(dc, txt, x, y, h, pen + 6, 1, 1.0, 0);
        dc.setColor(col, -1);
        F.st(dc, txt, x, y, h, pen, 1, 1.0, 0);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var live = a.live;
        var t = live ? a.t : 99999;
        var tt = live ? a.t : 0;
        var wk = d.wakeN;

        // ---- camera background
        if (st == 3) {
            // low-res heat sensor image (24 px cells), driven by heart rate and stress
            // (runs cached per heat level; the JS version rebuilds them every frame)
            var hk = heatH(d);
            if (hk != _hk) {
                _hk = hk;
                heat(hk);
            }
            for (var k = 0; k < _rn; k++) {
                dc.setColor(_rc[k], -1);
                dc.fillRectangle(_rx[k], _ry[k], _rw[k], 24);
            }
        } else if (st == 2) {
            dc.setColor(0x0E1014, -1);
            dc.fillCircle(227, 227, 227);
            dc.setColor(0x171B22, -1);
            for (var g = 37; g < 454; g += 38) {
                dc.drawLine(g, 0, g, 454);
                dc.drawLine(0, g, 454, g);
            }
        } else {
            dc.setColor(0x140101, -1);
            dc.fillCircle(227, 227, 227);
            dc.setColor(0x220404, -1);
            dc.fillCircle(227, 227, 150);
            dc.setColor(0x0A0000, -1);
            for (var y = 2; y < 454; y += 4) {
                dc.fillRectangle(0, y, 454, 1);
            }
        }
        // sensor noise
        if (st != 3) {
            var sd = 77 + tt / 66;
            dc.setColor(st == 1 ? 0x3A0C0C : 0x262B33, -1);
            for (var k = 0; k < 36; k++) {
                sd = G.rnd(sd);
                var x = 20 + (sd % 414);
                sd = G.rnd(sd);
                var y = 20 + (sd % 414);
                dc.fillRectangle(x, y, 2, 2);
            }
        }

        // ---- style colours
        var hud = st == 1 ? acc : (st == 2 ? 0x8E96A3 : 0xFFFFFF); // reticle / status
        var txc = st == 1 ? 0xFFE2DC : 0xFFFFFF;
        var dark = st == 1 ? 0x140101 : (st == 2 ? 0x0B0D10 : 0x000000);

        // ---- viewfinder reticle: lens ring with ticks + four chevrons
        dc.setColor(G.dim(hud, st == 3 ? 0.7 : 0.35), -1);
        dc.setPenWidth(1);
        dc.drawCircle(227, 227, 214);
        var rt = _rt;
        for (var k = 0; k < 144; k += 4) {
            dc.drawLine(rt[k], rt[k + 1], rt[k + 2], rt[k + 3]);
        }
        dc.setColor(G.dim(hud, 0.8), -1);
        dc.setPenWidth(2);
        for (var k = 144; k < 192; k += 4) {
            dc.drawLine(rt[k], rt[k + 1], rt[k + 2], rt[k + 3]);
        }

        // ---- box layout (widths follow the content)
        var big = st != 2; // Terminator / Thermal: dot-matrix values
        for (var i = 0; i < 3; i++) {
            var v = d.slots[i][:val] as String;
            var vw = big ? F.pxW(v, v.length() > 5 ? 3 : 4) : F.stW(v, 28);
            var cw = F.pxW((d.slots[i][:lbl] as String) + "  99%", 2) + 8;
            var w = Math.round(vw / 2.0).toNumber() * 2 + 36;
            if (cw < 124) {
                cw = 124;
            }
            _bw[i] = w > cw ? w : cw;
        }
        _bx[0] = 227 - _bw[0] / 2;
        _bx[1] = 212 - _bw[1];
        _bx[2] = 242;
        _bx[3] = 87;

        // ---- objects: slots 0..2 and the time (3)
        var found = 0;
        for (var oi = 0; oi < 4; oi++) {
            var i = ORDER[oi];
            var sl = i < 3 ? d.slots[i] : null;
            var known = i == 3 || (sl[:raw] != -1);
            var t0 = passT(BY[i] + BH[i] / 2.0);
            var lt = t - t0; // ms since lock started
            if (lt < 0) {
                continue;
            }
            found++;
            var lp = G.clamp(lt / LOCK, 0.0, 1.0);
            var e = G.ease(lp);
            // tracking jitter while live
            var jx = 0;
            var jy = 0;
            var gr = 0.0;
            if (live && lp >= 1) {
                jx = Math.round(1.5 * Math.sin(tt / 530.0 + i * 2.1)).toNumber();
                jy = Math.round(1.5 * Math.cos(tt / 610.0 + i * 1.3)).toNumber();
                gr = 1.5 + 1.5 * Math.sin(tt / 400.0 + i);
            }
            // lock-on: brackets fly in from 1.8x and shrink to fit
            var sc = 1 + 0.8 * (1 - e);
            var w = _bw[i] * sc + 2 * gr;
            var h = BH[i] * sc + 2 * gr;
            var cx = _bx[i] + _bw[i] / 2.0 + jx;
            var cy = BY[i] + BH[i] / 2.0 + jy;
            var x = cx - w / 2;
            var y = cy - h / 2;
            var col = st == 1 ? acc : (st == 2 ? (i == 3 ? acc : CC[i]) : 0xFFFFFF);
            var bc = G.mix(0xFFFFFF, col, lp);
            if (st == 2 && lp >= 1) {
                // labelling tool: thin full rectangle under the corner brackets
                dc.setColor(G.dim(col, 0.55), -1);
                dc.setPenWidth(1);
                dc.drawRectangle(x, y, w, h);
            }
            dc.setColor(bc, -1);
            dc.setPenWidth(i == 3 ? 3 : 2);
            brackets(dc, x, y, w, h, Math.round((w < h ? w : h) * 0.26));
            if (lp < 1) {
                // crosshair converging on the object centre
                dc.setPenWidth(1);
                dc.drawLine(cx - 16 * (1 - e) - 4, cy, cx - 4, cy);
                dc.drawLine(cx + 4, cy, cx + 16 * (1 - e) + 4, cy);
            }

            // label chip (types out after the lock)
            var conf = "99,9%";
            if (i < 3) {
                conf = (known ? 80 + (G.rnd(wk * 97 + i * 13 + 5) % 20) : 12 + ((wk + i * 7) % 25)) + "%";
            }
            var lbl = i == 3 ? "UHRZEIT" : sl[:lbl] as String;
            var n = Math.floor((lt - LOCK * 0.6) / 28).toNumber();
            var cbg = st == 3 ? 0xFFFFFF : col;
            chip(dc, _bx[i] + jx, BY[i] + jy - 18, lbl, conf, n, cbg, dark);

            // object content
            var vx = cx;
            var vy = BY[i] + BH[i] / 2.0 + jy;
            if (i == 3) {
                var ts = G.timeStr(d);
                if (lp > 0.25) {
                    if (st == 1) {
                        dc.setColor(txc, -1);
                        F.px(dc, ts, vx, vy - 28, 8, 1, 0);
                    } else if (st == 3) {
                        outline(dc, ts, vx, vy, 74, 6, 0xFFFFFF, 0x14051F);
                    } else {
                        dc.setColor(0xFFFFFF, -1);
                        F.st(dc, ts, vx, vy, 74, 6, 1, 1.0, 0);
                    }
                }
            } else if (lp > 0.25) {
                // value: scrambled until locked
                var v = sl[:val] as String;
                if (lp < 1) {
                    var sd = G.rnd(i * 31 + Math.floor(lt / 60).toNumber() + 3);
                    var s = "";
                    for (var k = 0; k < v.length(); k++) {
                        sd = G.rnd(sd);
                        s += "" + (sd % 10);
                    }
                    v = s;
                }
                var vc = known ? txc : G.dim(txc, 0.5);
                if (st != 2) {
                    var vs = v.length() > 5 ? 3 : 4;
                    if (st == 3) {
                        // drop shadow keeps the value legible on hot spots
                        dc.setColor(0x14051F, -1);
                        F.px(dc, v, vx + 3, vy - (7 * vs) / 2.0 + 3, vs, 1, 0);
                    }
                    dc.setColor(vc, -1);
                    F.px(dc, v, vx, vy - (7 * vs) / 2.0, vs, 1, 0);
                } else {
                    dc.setColor(vc, -1);
                    F.st(dc, v, vx, vy, 28, 4, 1, 1.0, 0);
                }
            }
        }

        // ---- scan line + trail
        if (live) {
            var sy = scanY(a.t);
            var sc = st == 1 ? acc : 0xFFFFFF;
            for (var k = 3; k >= 1; k--) {
                dc.setColor(st == 3 ? G.mix(0xFFFFFF, 0x000000, 0.25 * k) : G.dim(sc, 0.45 / k), -1);
                dc.fillRectangle(0, sy - k * 6, 454, 2);
            }
            dc.setColor(sc, -1);
            dc.fillRectangle(0, sy, 454, 2);
        }

        // ---- status: REC, battery, detections, date stamp
        var sCol = st == 3 ? 0xFFFFFF : G.dim(hud, st == 1 ? 0.9 : 1.0);
        if (!live || (a.t / 500) % 2 == 0) {
            dc.setColor(st == 1 ? acc : 0xFF3B30, -1);
            dc.fillCircle(87, 99, 5);
        }
        dc.setColor(sCol, -1);
        F.px(dc, "REC", 98, 92, 2, 0, 0);
        // camera battery = watch battery
        dc.setPenWidth(2);
        dc.drawRectangle(318, 92, 22, 13);
        dc.fillRectangle(340, 96, 3, 5);
        dc.fillRectangle(321, 95, Math.round(16 * G.clamp(d.batt / 100.0, 0.0, 1.0)), 7);
        F.px(dc, d.batt + "%", 348, 92, 2, 0, 0);
        var all = found >= 4;
        var msg = all ? "ERKANNT: 4 OBJEKTE" : "SUCHE ... " + found + "/4";
        var full = msg;
        if (all && t > 4200) {
            // after the detection: a verdict on the main object, typed out
            full = verdict(d);
            msg = full.substring(0, G.clamp((t - 4200) / 40, 0, full.length()));
        }
        F.px(dc, msg, 227 - F.pxW(full, 2) / 2, 370, 2, 0, 0);
        dc.setColor(G.dim(sCol, 0.7), -1);
        F.px(dc, d.dowStr + " " + G.pad2(d.day) + "." + G.pad2(d.mon) + ".  FPS 15", 227, 392, 2, 1, 0);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var x = 87 + o[0];
        var y = 148 + o[1];
        var col = st == 3 ? 0x8A8A8A : G.dim(d.accent, 0.55);
        dc.setColor(col, -1);
        dc.setPenWidth(2);
        brackets(dc, x, y, 280, 116, 28);
        dc.setColor(0x8A8A8A, -1);
        if (st == 1) {
            F.px(dc, G.timeStr(d), 227 + o[0], 178 + o[1], 8, 1, 3);
        } else {
            F.st(dc, G.timeStr(d), 227 + o[0], 206 + o[1], 74, 3, 1, 1.0, 0);
        }
        dc.setColor(G.dim(col, 0.8), -1);
        F.px(dc, "UHRZEIT", x, y - 18, 2, 0, 0);
    }
}
