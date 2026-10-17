import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// ALPE 21 — weekly climbing challenge. Floors this week (x 3 m) carry a rider up
// Alpe d'Huez, Mont Ventoux, Stelvio or (cumulative) Everest.
// Styles: 1 Serpentinen, 2 Nacht, 3 Profil. Mirrors web/js/faces/alpe.js.
class FaceAlpe extends Face {
    const CX = 227;
    const HM = [1071, 1610, 1808, 8848];
    const TURNS = [21, 0, 48, 0];
    const LEGS = [9, 4, 13, 6];
    const QG = [0.87, 0.74, 0.93, 0.84];
    const PEN0 = [15, 18, 11, 14];
    const PEN1 = [7, 9, 5, 7];
    const KM = [13.8, 21.5, 24.3, 0.0];
    const NAME = ["ALPE D'HUEZ", "MONT VENTOUX", "STELVIO", "EVEREST"];
    const GRAD = [
        [10.4, 9.8, 7.9, 8.3, 9.4, 8.1, 7.6, 8.5, 7.4, 6.2, 5.7, 10.6, 4.8, 2.4],
        [4.5, 3.8, 4.5, 4.3, 5.4, 6.5, 9.4, 9.0, 9.2, 10.4, 9.0, 9.4, 8.7, 7.3, 9.1, 7.7, 6.0, 8.0, 7.0, 7.5, 10.1],
        [5.0, 5.8, 6.5, 6.3, 7.4, 7.0, 7.5, 7.0, 8.3, 7.4, 8.6, 9.3, 8.0, 7.6, 8.4, 7.8, 8.3, 8.6, 7.4, 9.0, 7.9, 8.9, 7.2, 7.0],
        [4.0, 5.0, 6.0, 7.5, 9.0, 11.0, 12.5, 14.0, 16.0, 18.0, 21.0, 25.0]
    ];
    const MT = [
        [0, 420, 50, 372, 92, 340, 128, 292, 160, 262, 186, 222, 206, 196, 227, 168, 246, 186, 262, 204, 288, 238, 318, 262, 348, 300, 384, 330, 420, 372, 454, 410, 454, 454, 0, 454],
        [0, 410, 60, 362, 112, 300, 150, 246, 180, 206, 204, 180, 227, 170, 250, 180, 274, 206, 304, 246, 342, 300, 394, 362, 454, 410, 454, 454, 0, 454],
        [0, 410, 54, 360, 96, 318, 124, 280, 150, 262, 172, 228, 194, 214, 210, 186, 227, 160, 240, 182, 254, 196, 270, 186, 286, 214, 312, 240, 344, 288, 386, 322, 420, 360, 454, 400, 454, 454, 0, 454]
    ];
    const FAR = [
        [0, 330, 40, 290, 78, 262, 104, 244, 130, 266, 160, 300, 190, 330, 270, 330, 300, 282, 330, 250, 356, 232, 386, 256, 420, 288, 454, 320, 454, 454, 0, 454],
        [0, 360, 60, 320, 110, 300, 150, 318, 300, 318, 344, 296, 400, 312, 454, 340, 454, 454, 0, 454],
        [0, 320, 36, 282, 70, 250, 96, 226, 118, 244, 140, 270, 170, 300, 290, 300, 318, 262, 342, 236, 366, 214, 390, 240, 420, 270, 454, 306, 454, 454, 0, 454]
    ];
    const SNOW = [
        [227, 168, 246, 186, 240, 190, 233, 184, 226, 192, 218, 186, 208, 194, 206, 196],
        [204, 180, 227, 170, 250, 180, 262, 194, 248, 198, 236, 192, 222, 198, 206, 194, 194, 194],
        [227, 160, 240, 182, 234, 186, 228, 180, 220, 190, 212, 184, 204, 196, 194, 214, 210, 186]
    ];
    const YB = 404.0;
    const YT = 214.0;

    // AOD burn-in offset applied to path drawing
    hidden var _ox = 0;
    hidden var _oy = 0;
    // cached serpentine geometry (per climb)
    hidden var _gc = -1;
    hidden var _g = null;
    hidden var _gn = 0;
    hidden var _gtot = 0.0;
    // Everest cache
    hidden var _evKey = -1;
    hidden var _evTot = 0;
    hidden var _evFl = -1;
    // progress (set by progress())
    hidden var _pm = 0;
    hidden var _pH = 1071;
    hidden var _pf = 0.0;
    hidden var _psum = 0;
    hidden var _pdone = false;
    hidden var _psrc = 0;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 12;
    }

    hidden function mtIdx(c) {
        return c == 1 ? 1 : (c == 3 ? 2 : 0);
    }

    hidden function hw(y) {
        return G.lerp(112.0, 34.0, (YB - y) / (YB - YT));
    }

    // ---- Everest: running total of floors over all days (St)
    hidden function evMetres(d as D) {
        var key = d.year * 1000 + d.doy;
        var cur = d.floors > 0 ? d.floors : 0;
        if (key != _evKey) {
            var tot = St.get("evTotal", 0);
            var fl = St.get("evFl", 0);
            var day = St.get("evDay", -1);
            if (day != key) {
                if (day < 0) {
                    tot = d.floorsWeek - cur;
                    if (tot < 0) { tot = 0; }
                } else {
                    tot += fl;
                }
                St.set("evDay", key);
                St.set("evTotal", tot);
                fl = -1;
            }
            _evKey = key;
            _evTot = tot;
            _evFl = fl;
        }
        if (cur != _evFl) {
            St.set("evFl", cur);
            _evFl = cur;
        }
        return (_evTot + cur) * 3;
    }

    // ---- serpentine geometry: flat segments [type, a, b, c, d, pen, len]
    // type 0 line (a,b)->(c,d); 1 right turn (centre a,b radius c, travel 180->0); 2 left turn (180->360)
    hidden function geo(c) as Void {
        if (c == _gc) {
            return;
        }
        var L = LEGS[c];
        var q = QG[c];
        var g0 = (YB - YT) * (1.0 - q) / (1.0 - Math.pow(q, L - 1));
        var g = new [L * 2 * 7];
        var n = 0;
        var x = CX - hw(YB) + 8;
        var y = YB;
        var tot = 0.0;
        var xe = x;
        for (var j = 0; j < L; j++) {
            var pn = G.lerp(PEN0[c], PEN1[c], (YB - y) / (YB - YT));
            var ny = y - g0 * Math.pow(q, j);
            var s = j % 2 == 0 ? 1 : -1;
            xe = j < L - 1 ? CX + s * hw((y + ny) / 2.0) : CX - s * 14;
            var ln = (xe - x).abs();
            g[n] = 0; g[n + 1] = x; g[n + 2] = y; g[n + 3] = xe; g[n + 4] = y; g[n + 5] = pn; g[n + 6] = ln;
            n += 7;
            tot += ln;
            if (j < L - 1) {
                var r = (y - ny) / 2.0;
                g[n] = s > 0 ? 1 : 2; g[n + 1] = xe; g[n + 2] = y - r; g[n + 3] = r; g[n + 4] = 0;
                g[n + 5] = G.lerp(PEN0[c], PEN1[c], (YB - y + r) / (YB - YT));
                g[n + 6] = Math.PI * r;
                n += 7;
                tot += Math.PI * r;
                x = xe;
                y = ny;
            }
        }
        var sy = y - 24;
        var ln2 = Math.sqrt((CX - xe) * (CX - xe) + 24 * 24);
        g[n] = 0; g[n + 1] = xe; g[n + 2] = y; g[n + 3] = CX; g[n + 4] = sy; g[n + 5] = PEN1[c]; g[n + 6] = ln2;
        n += 7;
        tot += ln2;
        _g = g;
        _gn = n / 7;
        _gtot = tot;
        _gc = c;
    }

    hidden function segPt(k, t) {
        var g = _g;
        var i = k * 7;
        var ty = g[i];
        if (ty == 0) {
            return [G.lerp(g[i + 1], g[i + 3], t) + _ox, G.lerp(g[i + 2], g[i + 4], t) + _oy];
        }
        var ang = ty == 1 ? 180 - 180 * t : 180 + 180 * t;
        return [G.ptX(g[i + 1] + _ox, g[i + 3], ang), G.ptY(g[i + 2] + _oy, g[i + 3], ang)];
    }

    hidden function segPart(dc as Dc, k, t0, t1) as Void {
        var g = _g;
        var i = k * 7;
        var ty = g[i];
        if (ty == 0) {
            dc.drawLine(G.lerp(g[i + 1], g[i + 3], t0) + _ox, G.lerp(g[i + 2], g[i + 4], t0) + _oy,
                        G.lerp(g[i + 1], g[i + 3], t1) + _ox, G.lerp(g[i + 2], g[i + 4], t1) + _oy);
        } else if (ty == 1) {
            G.arcC(dc, g[i + 1] + _ox, g[i + 2] + _oy, g[i + 3], 180 - 180 * t1, 180 - 180 * t0);
        } else {
            G.arcC(dc, g[i + 1] + _ox, g[i + 2] + _oy, g[i + 3], 180 + 180 * t0, 180 + 180 * t1);
        }
    }

    // draw path range [s0,s1] (length units); pen = seg pen * mul + add
    hidden function path(dc as Dc, s0, s1, mul, add) as Void {
        var g = _g;
        var acc = 0.0;
        for (var k = 0; k < _gn; k++) {
            var ln = g[k * 7 + 6];
            var a = acc;
            var b = acc + ln;
            acc = b;
            if (b <= s0 || a >= s1 || ln <= 0) {
                continue;
            }
            var pw = g[k * 7 + 5] * mul + add;
            dc.setPenWidth(pw < 1 ? 1 : pw);
            segPart(dc, k, ((s0 > a ? s0 : a) - a) / ln, ((s1 < b ? s1 : b) - a) / ln);
            if (g[k * 7] == 0 && k > 0 && mul > 0.3) {
                if (s0 <= a) {
                    dc.fillCircle(g[k * 7 + 1] + _ox, g[k * 7 + 2] + _oy, pw / 2.0 - 0.5);
                }
            }
        }
    }

    hidden function pathPt(s) {
        var g = _g;
        var acc = 0.0;
        for (var k = 0; k < _gn; k++) {
            var ln = g[k * 7 + 6];
            if (s <= acc + ln || k == _gn - 1) {
                return segPt(k, ln > 0 ? G.clamp((s - acc) / ln, 0.0, 1.0) : 0.0);
            }
            acc += ln;
        }
        return [CX, YT];
    }

    // centre-line dashes between s0 and s1
    hidden function dashes(dc as Dc, s0, s1, off, pen) as Void {
        var P = 14.0;
        var D = 6.0;
        var v = s0 + off;
        var s = s0 - (v - P * Math.floor(v / P));
        dc.setPenWidth(pen);
        var g = _g;
        var k = 0;
        var acc = 0.0;
        for (; s < s1; s += P) {
            var a = s > s0 ? s : s0;
            var b = s + D < s1 ? s + D : s1;
            if (b <= a) {
                continue;
            }
            while (k < _gn - 1 && acc + g[k * 7 + 6] <= a) {
                acc += g[k * 7 + 6];
                k++;
            }
            var ln = g[k * 7 + 6];
            segPart(dc, k, (a - acc) / ln, G.clamp((b - acc) / ln, 0.0, 1.0));
        }
    }

    hidden function poly(dc as Dc, a) as Void {
        var n = a.size() / 2;
        var pts = new [n];
        for (var i = 0; i < n; i++) {
            pts[i] = [a[i * 2], a[i * 2 + 1]];
        }
        dc.fillPolygon(pts);
    }

    // marker label for visual turn at fraction f
    hidden function turnLbl(c, f, idx) as String {
        if (c == 0 || c == 2) {
            var T = TURNS[c];
            return "" + (T + 1 - G.clamp(Math.round(f * (T + 1)).toNumber(), 1, T));
        }
        if (c == 1) {
            return "" + Math.round(f * KM[1]).toNumber();
        }
        return idx == 0 ? "BC" : "C" + idx;
    }

    hidden function flag(dc as Dc, x, y, h, col, wave) as Void {
        dc.setColor(0xDDDDDD, -1);
        dc.setPenWidth(2);
        dc.drawLine(x, y, x, y - h);
        dc.setColor(col, -1);
        var w = h * 0.62;
        dc.fillPolygon([[x + 1, y - h], [x + w, y - h + h * 0.2 + wave], [x + 1, y - h + h * 0.42]]);
    }

    hidden function tower(dc as Dc, x, y) as Void {
        dc.setColor(0xCFCFC8, -1);
        dc.fillRectangle(x - 4, y - 24, 8, 24);
        dc.fillRoundedRectangle(x - 7, y - 32, 14, 9, 3);
        dc.setPenWidth(2);
        dc.drawLine(x, y - 32, x, y - 46);
        dc.setColor(0xE0383A, -1);
        dc.fillRectangle(x - 2, y - 44, 4, 4);
        dc.fillRectangle(x - 4, y - 16, 8, 3);
    }

    hidden function burst(dc as Dc, x, y, col, sp, a as A) as Void {
        var rot = a.live ? (a.t % 3000) * 0.01 : 0;
        dc.setColor(G.dim(col, 0.55), -1);
        dc.setPenWidth(2);
        for (var i = 0; i < 12; i++) {
            G.tick(dc, x, y, 17 * sp, 25 * sp, i * 30 + rot);
        }
    }

    hidden function confetti(dc as Dc, x, y, p) as Void {
        if (p >= 1) {
            return;
        }
        var sd = 4711;
        for (var i = 0; i < 28; i++) {
            sd = G.rnd(sd);
            var ang = G.rf(sd) * 360;
            sd = G.rnd(sd);
            var sp = 30 + G.rf(sd) * 90;
            var t = p;
            var px = x + Math.sin(ang * 0.0174533) * sp * t;
            var py = y - Math.cos(ang * 0.0174533) * sp * t * 0.8 - 40 * t + 120 * t * t;
            dc.setColor(G.dim(G.hsv(i * 47, 0.8, 1.0), 1 - t * 0.6), -1);
            dc.fillRectangle(px - 2, py - 2, 4, 4);
        }
    }

    // star field (x, y, brightness) — computed once
    hidden var _stars = null;
    hidden function stars() as Array {
        if (_stars == null) {
            var arr = new [138];
            var sd = 97;
            for (var i = 0; i < 46; i++) {
                sd = G.rnd(sd);
                arr[i * 3] = 30 + G.rf(sd) * 394;
                sd = G.rnd(sd);
                arr[i * 3 + 1] = 40 + G.rf(sd) * 230;
                sd = G.rnd(sd);
                arr[i * 3 + 2] = 0.3 + G.rf(sd) * 0.5;
            }
            _stars = arr;
        }
        return _stars as Array;
    }

    // progress along the climb from the chosen source (d.src):
    // 0 climbed metres (floors x 3; Everest cumulative), 1 weekly bike km vs bikeGoal, 2 training days vs dayGoal
    hidden function progress(d as D) as Void {
        var c = G.clamp(d.cfg.climb, 0, 3);
        var src = G.clamp(d.src, 0, 2);
        _psrc = src;
        if (src != 0) {
            var H2 = 1;
            var m2 = 0;
            if (src == 1) {
                H2 = d.cfg.bikeGoal > 1 ? d.cfg.bikeGoal : 1;
                m2 = d.wkBike > 0 ? d.wkBike / 1000.0 : 0.0;
            } else {
                H2 = G.clamp(d.dayGoal, 1, 7);
                m2 = d.trainDays > 0 ? d.trainDays : 0;
            }
            _pm = m2;
            _pH = H2;
            _pf = G.clamp(m2.toFloat() / H2, 0.0, 1.0);
            _pdone = m2 >= H2;
            _psum = _pdone ? 1 : 0;
            return;
        }
        var H = HM[c];
        var m = c == 3 ? evMetres(d) : (d.floorsWeek > 0 ? d.floorsWeek : 0) * 3;
        _pm = m;
        _pH = H;
        if (c == 3) {
            _pf = (m % H).toFloat() / H;
            _psum = m / H;
            _pdone = false;
        } else {
            _pf = G.clamp(m.toFloat() / H, 0.0, 1.0);
            _psum = m >= H ? 1 : 0;
            _pdone = m >= H;
        }
    }

    // "612/1.071 HM" / "87/150 KM" / "3/4 TAGE"
    hidden function amountStr(c) as String {
        if (_psrc == 1) {
            return "" + Math.floor(_pm).toNumber() + "/" + _pH + " KM";
        }
        if (_psrc == 2) {
            return "" + _pm + "/" + _pH + (_pH == 1 ? " TAG" : " TAGE");
        }
        return c == 3 ? G.num(_pm % _pH) + "/" + G.num(_pH) + " M" : G.num(_pm) + "/" + G.num(_pH) + " HM";
    }

    // what is left to the summit
    hidden function remStr() as String {
        if (_psrc == 1) {
            return "" + (_pdone ? 0 : Math.ceil(_pH - _pm).toNumber()) + " KM";
        }
        if (_psrc == 2) {
            var r = _pdone ? 0 : _pH - _pm;
            return "" + r + (r == 1 ? " TAG" : " TAGE");
        }
        return G.num(_pdone ? 0 : Math.round(_pH * (1 - _pf))) + " HM";
    }

    // weekday dots M D M D F S S: filled = training day, today outlined
    hidden function weekDots(dc as Dc, d as D, y, p, night) as Void {
        var acc = d.accent;
        var lt = ["M", "D", "M", "D", "F", "S", "S"];
        for (var i = 0; i < 7; i++) {
            var sp = G.ease(G.stag(p, i, 0.05, 0.4));
            if (sp <= 0) {
                continue;
            }
            var x = CX + (i - 3) * 24;
            var on = ((d.trainMask >> i) & 1) == 1;
            var fut = i > d.dayIdx;
            if (on) {
                dc.setColor(G.dim(acc, sp), -1);
            } else {
                dc.setColor(G.dim(night ? 0x13224A : 0x26282C, sp), -1);
            }
            dc.fillCircle(x, y, 10);
            if (i == d.dayIdx) {
                dc.setColor(G.dim(0xFFFFFF, sp), -1);
                dc.setPenWidth(2);
                dc.drawCircle(x, y, 11);
            }
            dc.setColor(on ? 0x000000 : G.dim(fut ? 0x5A5A5A : (night ? 0x9FB4E8 : 0xBDBDBD), sp), -1);
            F.px(dc, lt[i], x + 1, y - 7, 2, 1, 0);
        }
    }

    // profile: elevation fraction -> x
    hidden function profX(gr, sum, ef, x0, sw) {
        var e = 0.0;
        var n = gr.size();
        for (var i = 0; i < n; i++) {
            var ei = gr[i] / sum;
            if (ef <= e + ei || i == n - 1) {
                return x0 + (i + G.clamp((ef - e) / ei, 0.0, 1.0)) * sw;
            }
            e += ei;
        }
        return x0 + n * sw;
    }

    // "KEHRE 14" / "KM 12" / "LAGER 2"
    hidden function stageStr(c, f, prof) as String {
        if (_pdone) {
            return "GIPFEL!";
        }
        if (prof && c != 3) {
            return "KM " + G.fix1(f * KM[c]);
        }
        if (c == 0 || c == 2) {
            var T = TURNS[c];
            var k = T - Math.floor(f * (T + 1)).toNumber();
            return k < 1 ? "ZIEL" : "KEHRE " + k;
        }
        if (c == 1) {
            return "KM " + G.fix1(f * KM[1]);
        }
        var camp = Math.floor(f * 5).toNumber();
        return camp == 0 ? "BASISLAGER" : "LAGER " + camp;
    }

    hidden function gradCol(g) {
        return g < 5 ? 0x3DDC5A : (g < 8 ? 0xFFD22E : (g <= 10 ? 0xFF8A1E : 0xFF3B30));
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var c = G.clamp(d.cfg.climb, 0, 3);
        var acc = d.accent;
        var p = a.intro;
        progress(d);
        var night = st == 2;

        // ---- night sky
        if (night) {
            var sf = stars();
            for (var i = 0; i < 46; i++) {
                var x = sf[i * 3];
                var y = sf[i * 3 + 1];
                var b = sf[i * 3 + 2];
                var tw = a.live ? 0.75 + 0.25 * Math.sin(a.t * 0.002 + i * 1.7) : 1.0;
                dc.setColor(G.dim(0xC8D6FF, b * tw * G.ease(p * 2 - i * 0.02)), -1);
                var sz = i % 7 == 0 ? 2 : 1;
                dc.fillRectangle(x, y, sz, sz);
            }
            // moon
            dc.setColor(0xD8DEEA, -1);
            dc.fillCircle(352, 176, 11);
            dc.setColor(0x000000, -1);
            dc.fillCircle(357, 172, 10);
        }

        // ---- secondary ring: weekly bike km vs goal (or climbed HM when bike km drives the climb)
        var goal = _psrc == 1 ? HM[c] : d.cfg.bikeGoal;
        var bk = _psrc == 1 ? (d.floorsWeek >= 0 ? d.floorsWeek * 3.0 : -1.0) : (d.wkBike >= 0 ? d.wkBike / 1000.0 : -1.0);
        var bf = bk >= 0 && goal > 0 ? G.clamp(bk / goal, 0.0, 1.0) : 0.0;
        G.ring(dc, CX, 227, 222, 3, bf * G.ease(p * 1.3), night ? 0x8FB4FF : G.mix(acc, 0xFFFFFF, 0.45), night ? 0x0D1530 : 0x1A1A1A);

        // ---- header: climb name, time, stage
        var tcol = night ? 0xE4EBFF : 0xFFFFFF;
        dc.setColor(night ? 0x6F83B8 : 0x8A8A8A, -1);
        F.px(dc, NAME[c], CX, 26, 2, 1, 0);
        dc.setColor(tcol, -1);
        var prof = st == 3;
        F.st(dc, G.timeStr(d), CX, prof ? 82 : 78, prof ? 64 : 58, prof ? 7 : 6, 1, G.easeInOut(p * 1.25), 0);

        // info line: STAGE . m/H HM
        var s1 = stageStr(c, _pf, prof);
        var s2 = amountStr(c);
        var ih = 16;
        var iy = prof ? 140 : 132;
        var w1 = F.stW(s1, ih);
        var w2 = F.stW(s2, ih);
        var ix = CX - (w1 + w2 + 22) / 2.0;
        var ip = G.ease(p * 1.6 - 0.3);
        dc.setColor(_pdone ? acc : G.mix(0x000000, acc, ip), -1);
        F.st(dc, s1, ix, iy, ih, _pdone ? 3 : 2, 0, ip, 0);
        dc.setColor(G.dim(night ? 0x9FB0D8 : 0xB4B4B4, ip), -1);
        dc.fillCircle(ix + w1 + 11, iy, 2);
        F.st(dc, s2, ix + w1 + 22, iy, ih, 2, 0, ip, 0);
        if (c == 3 && _psrc == 0 && _psum > 0) {
            dc.setColor(acc, -1);
            F.px(dc, "^ " + _psum + "X GIPFEL", CX, iy + 16, 2, 1, 0);
        }

        if (prof) {
            profile(dc, d, a, c);
        } else {
            serp(dc, d, a, c, night);
        }

        // ---- side data: slot (left) + bike km (right) / bottom pair in profile
        var si = d.cfg.slots[0] == 20 ? 1 : 0;
        var sl = d.slots[si];
        var dp = G.ease(p * 1.5 - 0.4);
        var lx = prof ? 166 : 84;
        var rx = prof ? 288 : 370;
        var days = _psrc == 2;
        var ly = prof ? (days ? 350 : 380) : 214;
        dc.setColor(G.dim(night ? 0x7D8FBF : 0x8A8A8A, dp), -1);
        F.px(dc, sl[:lbl] as String, lx, ly, 2, 1, 0);
        F.px(dc, _psrc == 1 ? "HM/WO" : "RAD KM", rx, ly, 2, 1, 0);
        dc.setColor(G.dim(d.dcol, dp), -1);
        F.st(dc, sl[:val] as String, lx, ly + 32, 20, 3, 1, 1.0, 0);
        var bs = bk >= 0 ? G.num(bk) : "--";
        var gs = _psrc == 1 ? "" : "/" + G.num(goal);
        var wb = F.stW(bs, 20);
        var wg = F.stW(gs, 14);
        F.st(dc, bs, rx - (wb + wg + 3) / 2.0, ly + 32, 20, 3, 0, 1.0, 0);
        dc.setColor(G.dim(night ? 0x7D8FBF : 0x8A8A8A, dp), -1);
        F.st(dc, gs, rx + (wb + wg + 3) / 2.0, ly + 35, 14, 2, 2, 1.0, 0);
        if (days) {
            weekDots(dc, d, prof ? 420 : 428, G.clamp((p - 0.3) / 0.7, 0.0, 1.0), night);
        }
    }

    hidden function serp(dc as Dc, d as D, a as A, c, night) as Void {
        var p = a.intro;
        var acc = d.accent;
        var mi = mtIdx(c);
        var mp = G.ease(p * 2);
        // mountains
        dc.setColor(G.dim(night ? 0x070C1C : 0x121417, mp), -1);
        poly(dc, FAR[mi]);
        dc.setColor(G.dim(night ? 0x0B1430 : 0x1D2024, mp), -1);
        poly(dc, MT[mi]);
        dc.setColor(G.dim(night ? 0x1F3266 : (c == 1 ? 0x77756E : (c == 3 ? 0x868C96 : 0x5C626B)), mp), -1);
        poly(dc, SNOW[mi]);
        if (night) {
            // moonlit ridge
            var m = MT[mi];
            dc.setColor(G.dim(0x2A427F, mp), -1);
            dc.setPenWidth(2);
            for (var i = 2; i < m.size() - 6; i += 2) {
                dc.drawLine(m[i - 2], m[i - 1], m[i], m[i + 1]);
            }
        }

        geo(c);
        var L = _gtot;
        var sRoad = L * G.ease(G.clamp(p / 0.55, 0.0, 1.0));
        var sRid = _pf * L * G.easeInOut((p - 0.35) / 0.65);
        var off = a.live ? (a.t % 1400000) * 0.012 : 0.0;

        // road band
        if (night) {
            dc.setColor(0x2C4F9A, -1);
            path(dc, 0, sRoad, 1, 2);
            dc.setColor(0x000000, -1);
            path(dc, 0, sRoad, 1, -2);
        } else {
            dc.setColor(0x5D6066, -1);
            path(dc, 0, sRoad, 1, 2);
            dc.setColor(0x2F3135, -1);
            path(dc, 0, sRoad, 1, -1);
        }
        // centre dashes on the road ahead
        dc.setColor(night ? 0x34548F : 0x9A9A9A, -1);
        dashes(dc, sRid, sRoad, off, 1.5);

        // completed part
        if (sRid > 0.5) {
            if (night) {
                dc.setColor(G.dim(acc, 0.28), -1);
                path(dc, 0, sRid, 1, 6);
                dc.setColor(G.dim(acc, 0.6), -1);
                path(dc, 0, sRid, 1, 0);
                dc.setColor(G.mix(acc, 0xFFFFFF, 0.45), -1);
                path(dc, 0, sRid, 0.35, 0);
            } else {
                dc.setColor(acc, -1);
                path(dc, 0, sRid, 1, -2);
                dc.setColor(G.dim(acc, 0.55), -1);
                dashes(dc, 0, sRid, off, 1.5);
            }
        }

        // turn markers
        var acc0 = 0.0;
        var ti = 0;
        var g = _g;
        var lsc = 2;
        for (var k = 0; k < _gn; k++) {
            var ln = g[k * 7 + 6];
            if (g[k * 7] != 0) {
                var mid = acc0 + ln / 2.0;
                var show = c != 2 || ti % 2 == 0;
                if (mid < sRoad && show) {
                    var side = g[k * 7] == 1 ? 1 : -1;
                    var r = g[k * 7 + 3];
                    var lbl = turnLbl(c, mid / L, ti);
                    var mx = g[k * 7 + 1] + side * (r + g[k * 7 + 5] / 2.0 + 14);
                    var my = g[k * 7 + 2];
                    var w = F.pxW(lbl, lsc) + 6;
                    var hit = mid <= sRid;
                    dc.setColor(hit ? acc : (night ? 0x13224A : 0x3A3D42), -1);
                    dc.fillRoundedRectangle(mx - w / 2.0, my - 4 - lsc * 3, w, lsc * 7 + 6, 3);
                    dc.setColor(hit ? 0x000000 : (night ? 0x9FB4E8 : 0xDEDEDE), -1);
                    F.px(dc, lbl, mx, my - lsc * 3.5 + 0.5, lsc, 1, 0);
                }
                ti++;
            }
            acc0 += ln;
        }

        // start line
        var st0 = segPt(0, 0.0);
        dc.setColor(0xFFFFFF, -1);
        dc.fillRectangle(st0[0] - 1, st0[1] - PEN0[c] / 2.0, 3, PEN0[c]);

        // training-day stages: one bar across the road per day of the goal
        if (_psrc == 2 && _pH > 1) {
            for (var k = 1; k < _pH; k++) {
                var sk = L * k / _pH.toFloat();
                if (sk > sRoad) {
                    break;
                }
                var q0 = pathPt(sk - 1);
                var q1 = pathPt(sk + 1);
                var dx = q1[0] - q0[0];
                var dy = q1[1] - q0[1];
                var dl = Math.sqrt(dx * dx + dy * dy);
                var nx = dl > 0 ? -dy / dl : 0.0;
                var ny = dl > 0 ? dx / dl : 1.0;
                var pm = pathPt(sk);
                var hl = 9;
                dc.setColor(sk <= sRid ? 0xFFFFFF : (night ? 0x5A78C0 : 0x8A8A8A), -1);
                dc.setPenWidth(3);
                dc.drawLine(pm[0] - nx * hl, pm[1] - ny * hl, pm[0] + nx * hl, pm[1] + ny * hl);
            }
        }

        // summit
        var sm = pathPt(L);
        var sp = G.spring(G.clamp((p - 0.45) / 0.35, 0.0, 1.0));
        if (_pdone && sp > 0) {
            burst(dc, sm[0], sm[1] - 12, acc, sp, a);
        }
        if (sp > 0) {
            var wave = a.live ? Math.sin(a.t * 0.006) * 2 : 0;
            if (c == 1) {
                tower(dc, sm[0] + 10, sm[1] + 2);
            }
            flag(dc, sm[0] - (c == 1 ? 6 : 0), sm[1], (_pdone ? 30 : 22) * sp, _pdone ? acc : 0xFFFFFF, wave);
        }
        if (_pdone) {
            confetti(dc, sm[0], sm[1] - 20, p);
        }

        // rider
        var rp = pathPt(sRid);
        rider(dc, rp[0], rp[1], acc, a);
    }

    hidden function rider(dc as Dc, x, y, acc, a as A) as Void {
        if (a.live) {
            var ph = 0.5 + 0.5 * Math.sin(a.t * 0.005);
            dc.setColor(G.argb(70 + 60 * (1 - ph), acc), -1);
            dc.fillCircle(x, y, 11 + 5 * ph);
        } else {
            dc.setColor(G.argb(110, acc), -1);
            dc.fillCircle(x, y, 13);
        }
        dc.setColor(0x000000, -1);
        dc.fillCircle(x, y, 8);
        dc.setColor(0xFFFFFF, -1);
        dc.fillCircle(x, y, 6);
        dc.setColor(acc, -1);
        dc.fillCircle(x, y, 3);
    }

    hidden function profile(dc as Dc, d as D, a as A, c) as Void {
        var p = a.intro;
        var acc = d.accent;
        var gr = GRAD[c];
        var n = gr.size();
        var sum = 0.0;
        for (var i = 0; i < n; i++) {
            sum += gr[i];
        }
        var x0 = 38.0;
        var x1 = 416.0;
        var yb = 326.0;
        var yt = 196.0;
        var sw = (x1 - x0) / n;
        var y0 = yb - 14;
        // rider elevation -> x
        var ef = _pf * G.easeInOut((p - 0.35) / 0.65);
        var e = 0.0;
        var rx = x0;
        var ri = 0;
        for (var i = 0; i < n; i++) {
            var ei = gr[i] / sum;
            if (ef <= e + ei || i == n - 1) {
                rx = x0 + (i + G.clamp((ef - e) / ei, 0.0, 1.0)) * sw;
                ri = i;
                break;
            }
            e += ei;
        }
        // grid
        dc.setColor(0x1A1A1A, -1);
        dc.setPenWidth(1);
        for (var k = 1; k <= 3; k++) {
            var gy = y0 - (y0 - yt) * k / 4.0;
            for (var x = x0; x < x1; x += 8) {
                dc.drawLine(x, gy, x + 3, gy);
            }
        }
        // bars
        e = 0.0;
        var lx = x0;
        var ly = y0;
        dc.setPenWidth(2);
        for (var i = 0; i < n; i++) {
            e += gr[i] / sum;
            var bp = G.ease(G.stag(p, i, 0.45 / n, 0.3));
            var nx = x0 + (i + 1) * sw;
            var ny = y0 - (y0 - yt) * e;
            if (bp > 0) {
                var col = gradCol(gr[i]);
                var ty0 = G.lerp(yb, ly, bp);
                var ty1 = G.lerp(yb, ny, bp);
                var xa = lx + 1;
                var xb = nx - 1;
                var xm = G.clamp(rx, xa, xb);
                var tm = G.lerp(ty0, ty1, (xm - xa) / (xb - xa));
                if (xm > xa) {
                    dc.setColor(col, -1);
                    dc.fillPolygon([[xa, yb], [xa, ty0], [xm, tm], [xm, yb]]);
                }
                if (xm < xb) {
                    dc.setColor(0x202020, -1);
                    dc.fillPolygon([[xm, yb], [xm, tm], [xb, ty1], [xb, yb]]);
                    dc.setColor(G.dim(col, 0.75), -1);
                    dc.setPenWidth(3);
                    dc.drawLine(xm, tm + 1, xb, ty1 + 1);
                }
                if (xm > xa) {
                    dc.setColor(0xFFFFFF, -1);
                    dc.setPenWidth(2);
                    dc.drawLine(xa - 1, ty0 - 1, xm, tm - 1);
                }
            }
            lx = nx;
            ly = ny;
        }
        // remaining height to the summit
        var tp = G.ease(p * 1.5 - 0.4);
        dc.setColor(G.dim(0x8A8A8A, tp), -1);
        F.px(dc, "NOCH", 48, 184, 2, 0, 0);
        dc.setColor(G.dim(0xFFFFFF, tp), -1);
        F.st(dc, remStr(), 48, 214, 18, 3, 0, 1.0, 0);
        // training-day stages: dividers through the profile
        if (_psrc == 2 && _pH > 1) {
            for (var k = 1; k < _pH; k++) {
                var ek = k / _pH.toFloat();
                var xk = profX(gr, sum, ek, x0, sw);
                var yk = y0 - (y0 - yt) * ek;
                var dp2 = G.ease(G.stag(p, k, 0.08, 0.4));
                if (dp2 <= 0) {
                    continue;
                }
                dc.setColor(0x000000, -1);
                dc.setPenWidth(3);
                dc.drawLine(xk, yb, xk, yk - 2);
                dc.setColor(G.dim(ek <= ef + 0.0001 ? 0xFFFFFF : 0x777777, dp2), -1);
                dc.setPenWidth(2);
                dc.drawLine(xk, yk - 8, xk, yk - 16);
            }
        }
        // base line
        dc.setColor(0x444444, -1);
        dc.fillRectangle(x0, yb + 2, (x1 - x0) * G.ease(p * 2), 2);
        // summit flag
        var sp = G.spring(G.clamp((p - 0.4) / 0.35, 0.0, 1.0));
        if (_pdone && sp > 0) {
            burst(dc, x1 - 2, yt - 14, acc, sp, a);
        }
        if (sp > 0) {
            if (c == 1) {
                tower(dc, x1 - 4, yt - 2);
            } else {
                flag(dc, x1 - 2, yt - 2, (_pdone ? 30 : 22) * sp, _pdone ? acc : 0xFFFFFF, a.live ? Math.sin(a.t * 0.006) * 2 : 0);
            }
        }
        if (_pdone) {
            confetti(dc, x1 - 10, yt - 20, p);
        }
        // rider marker + gradient bubble
        e = 0.0;
        for (var i = 0; i < ri; i++) {
            e += gr[i] / sum;
        }
        var eri = gr[ri] / sum;
        var ry = y0 - (y0 - yt) * (e + eri * G.clamp((rx - x0 - ri * sw) / sw, 0.0, 1.0));
        var g = gr[ri];
        var col = gradCol(g);
        var lp = G.ease((p - 0.8) / 0.2);
        if (lp > 0 && !_pdone) {
            var lbl = G.fix1(g) + "%";
            var bw = F.stW(lbl, 16) + 16;
            var bx = G.clamp(rx, 40 + bw / 2.0, 414 - bw / 2.0);
            var by = ry - 36;
            dc.setColor(0x777777, -1);
            dc.setPenWidth(1);
            dc.drawLine(rx, by + 12, rx, ry - 8);
            dc.setColor(G.dim(col, lp), -1);
            dc.fillRoundedRectangle(bx - bw / 2.0, by - 12, bw, 24, 7);
            dc.setColor(0x000000, -1);
            F.st(dc, lbl, bx, by, 16, 2, 1, 1.0, 0);
        }
        rider(dc, rx, ry - 2, acc, a);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var c = G.clamp(d.cfg.climb, 0, 3);
        progress(d);
        dc.setColor(0x8A8A8A, -1);
        F.st(dc, G.timeStr(d), CX + o[0], 84 + o[1], 58, 3, 1, 1.0, 0);
        geo(c);
        _ox = o[0];
        _oy = o[1];
        dc.setColor(0x3A3A3A, -1);
        path(dc, 0, _gtot, 0, 2);
        dc.setColor(G.dim(d.accent, 0.6), -1);
        path(dc, 0, _pf * _gtot, 0, 3);
        var rp = pathPt(_pf * _gtot);
        dc.setColor(0xBBBBBB, -1);
        dc.fillCircle(rp[0], rp[1], 5);
        dc.setColor(0x000000, -1);
        dc.fillCircle(rp[0], rp[1], 2);
        var sm = pathPt(_gtot);
        _ox = 0;
        _oy = 0;
        dc.setColor(0x777777, -1);
        dc.setPenWidth(1);
        dc.drawLine(sm[0], sm[1], sm[0], sm[1] - 18);
        dc.fillPolygon([[sm[0], sm[1] - 18], [sm[0] + 11, sm[1] - 14], [sm[0], sm[1] - 10]]);
    }
}
