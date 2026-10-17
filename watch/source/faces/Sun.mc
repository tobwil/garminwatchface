import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// SUN — "Daylight": the sun's real day path over a horizon, sky colour from the
// true solar elevation, golden/blue hour, remaining daylight, moon with real phase.
// Styles: 1 Himmel, 2 Linie, 3 24h. Mirrors web/js/faces/sun.js.
class FaceSun extends Face {
    const HY = 302;   // horizon
    const XL = 72;    // sunrise foot
    const XR = 382;   // sunset foot
    const ND = 25;    // dots on the day arc
    const CX = 227;

    // sky keyframes: elevation -> zenith / horizon colour
    const SKY_E = [-12, -6, -2, 3, 10, 25];
    const SKY_Z = [0x03061A, 0x0A1438, 0x1A2A5E, 0x24427E, 0x1D5296, 0x1B58A2];
    const SKY_H = [0x0A1030, 0x1F3A7A, 0x74466C, 0xE88C3A, 0x4A8BD0, 0x4F93D8];

    // per-day cache (pure function of doy/lat/lon/tz)
    hidden var _kd = -999;
    hidden var _kla = -999.0;
    hidden var _klo = -999.0;
    hidden var _ktz = -9999;
    hidden var _rise = -1.0;
    hidden var _set = -1.0;
    hidden var _c6r = -1.0;
    hidden var _c6s = -1.0;
    hidden var _g6r = -1.0;
    hidden var _g6s = -1.0;
    hidden var _noonE = 0.0;
    hidden var _H = 100.0;
    hidden var _dy = [] as Array;
    hidden var _de = [] as Array;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    function calc(d as D) as Void {
        if (_kd == d.doy && _kla == d.lat && _klo == d.lon && _ktz == d.tz) {
            return;
        }
        _kd = d.doy; _kla = d.lat; _klo = d.lon; _ktz = d.tz;
        _rise = AST.cross(d.doy, d.lat, d.lon, d.tz, -0.833, true);
        _set = AST.cross(d.doy, d.lat, d.lon, d.tz, -0.833, false);
        _c6r = AST.cross(d.doy, d.lat, d.lon, d.tz, -6, true);
        _c6s = AST.cross(d.doy, d.lat, d.lon, d.tz, -6, false);
        _g6r = AST.cross(d.doy, d.lat, d.lon, d.tz, 6, true);
        _g6s = AST.cross(d.doy, d.lat, d.lon, d.tz, 6, false);
        _noonE = AST.elev(d.doy, AST.noon(d.doy, d.lon, d.tz), d.lat, d.lon, d.tz);
        _H = G.clamp(82 + _noonE, 92, 126);
        var rr0 = r0();
        var len = dayLen();
        _dy = new [ND];
        _de = new [ND];
        var nmax = _noonE > 1 ? _noonE : 1.0;
        for (var i = 0; i < ND; i++) {
            var e = AST.elev(d.doy, rr0 + len * i / (ND - 1.0), d.lat, d.lon, d.tz);
            _de[i] = e;
            _dy[i] = HY - _H * G.clamp(e, 0.0, 90.0) / nmax;
        }
    }

    // day window start / length (polar day: whole day)
    function r0() {
        return (_rise >= 0 && _set >= 0) ? _rise : 0.0;
    }

    function dayLen() {
        if (_rise < 0 || _set < 0) {
            return 1440.0;
        }
        var l = _set - _rise;
        if (l <= 0) { l += 1440; }
        return l;
    }

    function isPolar() as Boolean {
        return _rise < 0 || _set < 0;
    }

    // minute-of-day m is between sunrise and sunset?
    function isDay(d as D, m) as Boolean {
        if (isPolar()) {
            return _noonE > 0;
        }
        var u = m - _rise;
        if (u < 0) { u += 1440; }
        return u <= dayLen();
    }

    // arc position for minute m (day) -> [x, y]
    function arcPos(d as D, m) as Array {
        var u = m - r0();
        if (u < 0) { u += 1440; }
        var f = G.clamp(u / dayLen(), 0.0, 1.0);
        var e = AST.elev(d.doy, m, d.lat, d.lon, d.tz);
        var nmax = _noonE > 1 ? _noonE : 1.0;
        return [G.lerp(XL, XR, f), HY - _H * G.clamp(e, 0.0, 90.0) / nmax];
    }

    // moon position on a softer night dome
    function nightPos(m) as Array {
        var f = 0.5;
        if (!isPolar()) {
            var u = m - _set;
            if (u < 0) { u += 1440; }
            f = G.clamp(u / (1440 - dayLen()), 0.0, 1.0);
        } else {
            f = m / 1440.0;
        }
        return [G.lerp(XL, XR, f), HY - _H * 0.82 * Math.sin(f * Math.PI)];
    }

    function sky(e) as Array {
        if (e <= SKY_E[0]) { return [SKY_Z[0], SKY_H[0]]; }
        if (e >= SKY_E[5]) { return [SKY_Z[5], SKY_H[5]]; }
        var i = 0;
        while (i < 4 && e > SKY_E[i + 1]) { i++; }
        var t = (e - SKY_E[i]) / (SKY_E[i + 1] - SKY_E[i]).toFloat();
        return [G.mix(SKY_Z[i], SKY_Z[i + 1], t), G.mix(SKY_H[i], SKY_H[i + 1], t)];
    }

    function clk(d as D, m) as String {
        var r = Math.round(m).toNumber() % 1440;
        var h = r / 60;
        if (!d.is24) { h = h % 12 == 0 ? 12 : h % 12; }
        return (d.is24 ? G.pad2(h) : "" + h) + ":" + G.pad2(r % 60);
    }

    // [main line, sub line]
    function status(d as D, e) as Array<String> {
        var m = d.mins;
        if (isPolar()) {
            if (_noonE > 0) { return ["MITTERNACHTSSONNE", "SONNE " + Math.round(e).toNumber() + "°"]; }
            return ["POLARNACHT", "MOND " + Math.round(AST.illum(d.moon) * 100).toNumber() + "%"];
        }
        if (isDay(d, m)) {
            var left = _set - m;
            if (left < 0) { left += 1440; }
            var light = "NOCH " + G.hm(left) + " H LICHT";
            if (e < 6) { return ["GOLDENE STUNDE", light]; }
            return [light, _g6s >= 0 ? "GOLDENE STUNDE " + clk(d, _g6s) : ""];
        }
        var until = _rise - m;
        if (until < 0) { until += 1440; }
        var lightIn = "LICHT IN " + G.hm(until);
        if (e >= -6) {
            var main = e < -4 ? "BLAUE STUNDE" : "DÄMMERUNG";
            if (until < 180) { return [main, lightIn]; }
            var dk = _c6s - m;
            if (dk < 0) { dk += 1440; }
            return [main, "DUNKEL IN " + G.hm(dk)];
        }
        return [lightIn, "MOND " + Math.round(AST.illum(d.moon) * 100).toNumber() + "%"];
    }

    // moon disc with real phase. dark = -1 -> outline only.
    function moonDisc(dc as Dc, d as D, x, y, r, phase, lit, dark) as Void {
        if (dark != -1) {
            dc.setColor(dark, -1);
            dc.fillCircle(x, y, r);
        } else {
            dc.setColor(G.dim(lit, 0.6), -1);
            dc.setPenWidth(2);
            dc.drawCircle(x, y, r);
        }
        if (AST.illum(phase) < 0.03) {
            return;
        }
        var s = phase < 0.5 ? 1 : -1;
        if (d.lat < 0) { s = -s; }
        var c = Math.cos(phase * 2 * Math.PI);
        var pts = new [18];
        for (var i = 0; i <= 8; i++) {
            var a = (-90 + i * 22.5) * (Math.PI / 180);
            pts[i] = [x + s * r * Math.cos(a), y + r * Math.sin(a)];
            pts[17 - i] = [x + s * r * Math.cos(a) * c, y + r * Math.sin(a)];
        }
        dc.setColor(lit, -1);
        dc.fillPolygon(pts);
    }

    // small drawn arrow, up or down, centred on (x, y)
    function arrow(dc as Dc, x, y, up, col) as Void {
        dc.setColor(col, -1);
        dc.setPenWidth(2);
        var k = up ? -1 : 1;
        dc.drawLine(x, y - 7 * k, x, y + 7 * k);
        dc.drawLine(x, y + 7 * k, x - 5, y + 2 * k);
        dc.drawLine(x, y + 7 * k, x + 5, y + 2 * k);
    }

    // "^ 07:52" style label centred on x
    function riseSet(dc as Dc, d as D, x, y, m, up, col, sp) as Void {
        if (m < 0 || sp <= 0) {
            return;
        }
        var txt = clk(d, m);
        var w = F.stW(txt, 16) + 16;
        var x0 = x - w / 2.0;
        var c = G.dim(col, sp);
        arrow(dc, x0 + 5, y, up, c);
        dc.setColor(c, -1);
        F.st(dc, txt, x0 + 16, y, 16, 2, 0, 1.0, 0);
    }

    function stars(dc as Dc, d as D, a as A, vis, n, rMax, yMax) as Void {
        if (vis <= 0.02) {
            return;
        }
        var sd = 7919 + d.doy;
        for (var i = 0; i < n; i++) {
            sd = G.rnd(sd);
            var x = 227 + (G.rf(sd) * 2 - 1) * rMax;
            sd = G.rnd(sd);
            var y = 30 + G.rf(sd) * (yMax - 30);
            sd = G.rnd(sd);
            var b = 0.35 + G.rf(sd) * 0.65;
            if ((x - 227).abs() < 150 && y > 40 && y < 162) {
                continue;
            }
            var dx = x - 227;
            var dy = y - 227;
            if (dx * dx + dy * dy > rMax * rMax) {
                continue;
            }
            var tw = b;
            if (a.live) {
                tw = b * (0.55 + 0.45 * Math.sin(a.t * 0.0031 + i * 1.73));
            }
            dc.setColor(G.dim(0xDFE6FF, tw * vis), -1);
            if (b > 0.85) {
                dc.fillCircle(x, y, 1.6);
            } else {
                dc.fillRectangle(x, y, 2, 2);
            }
        }
    }

    // sun disc with glow / rays
    function sunDisc(dc as Dc, a as A, x, y, e, st, bg, acc) as Void {
        var pulse = a.live ? Math.sin(a.t * 0.004) : 0.0;
        if (st == 2) {
            dc.setColor(acc, -1);
            dc.setPenWidth(2);
            dc.drawCircle(x, y, 11);
            dc.fillCircle(x, y, 4);
            var rot = a.live ? a.t * 0.012 : 0.0;
            dc.setPenWidth(2);
            for (var k = 0; k < 10; k++) {
                G.tick(dc, x, y, 16 + pulse, 21 + pulse, rot + k * 36);
            }
            return;
        }
        var core = e < 6 ? G.mix(0xFF9A3C, 0xFFE08A, G.clamp((e + 1) / 7.0, 0.0, 1.0)) : 0xFFF0C0;
        dc.setColor(G.mix(bg, core, 0.16), -1); dc.fillCircle(x, y, 24 + pulse * 2);
        dc.setColor(G.mix(bg, core, 0.32), -1); dc.fillCircle(x, y, 18 + pulse);
        dc.setColor(G.mix(bg, core, 0.6), -1); dc.fillCircle(x, y, 14);
        dc.setColor(core, -1); dc.fillCircle(x, y, 11);
        dc.setColor(G.mix(core, 0xFFFFFF, 0.6), -1); dc.fillCircle(x, y, 6);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        calc(d);
        var st = d.cfg.style;
        if (st == 3) {
            dial(dc, d, a);
            return;
        }
        var acc = d.accent;
        var p = a.intro;
        var sp = G.ease(p * 1.4);
        var e = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var day = isDay(d, d.mins);
        var sk = sky(e);

        // ---- sky (style 1)
        if (st == 1) {
            var nb = 24;
            for (var i = 0; i < nb; i++) {
                var t = (i + 0.5) / nb;
                var y0 = i * HY / nb;
                var y1 = (i + 1) * HY / nb;
                dc.setColor(G.dim(G.mix(sk[0], sk[1], t * t), sp), -1);
                dc.fillRectangle(0, y0, 454, y1 - y0);
            }
            // twilight glow where the sun hides below the horizon
            if (!day && e > -9) {
                var until = _rise - d.mins;
                if (until < 0) { until += 1440; }
                var gx = isPolar() ? CX : (until < 720 ? XL : XR);
                var gk = G.clamp((e + 9) / 9.0, 0.0, 1.0) * sp;
                dc.setColor(G.mix(sk[1], 0xFF9A5A, 0.12 * gk), -1);
                dc.fillEllipse(gx, HY, 140, 54);
                dc.setColor(G.mix(sk[1], 0xFF9A5A, 0.24 * gk), -1);
                dc.fillEllipse(gx, HY, 96, 34);
                dc.setColor(G.mix(sk[1], 0xFFB070, 0.4 * gk), -1);
                dc.fillEllipse(gx, HY, 54, 17);
            }
            dc.setColor(G.dim(G.mix(0, sk[1], 0.12), sp), -1);
            dc.fillRectangle(0, HY, 454, 454 - HY);
        }

        // ---- stars
        var sv = G.clamp((-3 - e) / 7.0, 0.0, 1.0) * sp;
        stars(dc, d, a, sv, 34, 205, HY - 14);

        // ---- horizon
        var hc = st == 1 ? G.mix(sk[1], 0xFFFFFF, 0.45) : acc;
        dc.setPenWidth(2);
        dc.setColor(G.dim(hc, sp * 0.35), -1);
        dc.drawLine(22, HY, 432, HY);
        dc.setColor(G.dim(hc, sp), -1);
        var hw = 205 * G.ease(p * 1.2);
        dc.drawLine(CX - hw * 0.8, HY, CX + hw * 0.8, HY);

        // ---- sun / moon time along the path (intro: travels from sunrise)
        var wp = G.easeInOut(p);
        var sm = d.mins;
        if (day) {
            var u = d.mins - r0();
            if (u < 0) { u += 1440; }
            sm = r0() + u * wp;
        }
        var pos;
        if (day) {
            pos = arcPos(d, sm);
        } else {
            pos = nightPos(d.mins);
            var n0 = nightPos(_set >= 0 ? _set : 0);
            pos = [G.lerp(n0[0], pos[0], wp), G.lerp(n0[1], pos[1], wp)];
        }

        // ---- day arc dots
        if (_noonE > -0.833) {
            var len = dayLen();
            var cur = sm - r0();
            if (cur < 0) { cur += 1440; }
            for (var i = 0; i < ND; i++) {
                var f = i / (ND - 1.0);
                var x = G.lerp(XL, XR, f);
                var y = _dy[i];
                var gold = _de[i] < 6;
                var done = day && f * len <= cur;
                var c;
                if (st == 1) {
                    c = gold ? 0xFFB560 : 0xFFFFFF;
                } else {
                    c = acc;
                }
                var k = done ? 0.95 : 0.4;
                if (!day) { k = 0.28; }
                if (st == 1) {
                    var bgc = G.mix(sk[0], sk[1], (y / HY) * (y / HY));
                    dc.setColor(G.dim(G.mix(bgc, c, k), sp), -1);
                } else {
                    dc.setColor(G.dim(c, k * sp), -1);
                }
                dc.fillCircle(x, y, done ? 2.6 : 2);
            }
        }

        // ---- sun or moon
        if (day) {
            var bgc = st == 1 ? G.mix(sk[0], sk[1], (pos[1] / HY) * (pos[1] / HY)) : 0;
            sunDisc(dc, a, pos[0], pos[1], e, st, G.dim(bgc, sp), acc);
        } else if (sp > 0.05) {
            var mr = 13;
            if (st == 1) {
                var bgc = G.mix(sk[0], sk[1], (pos[1] / HY) * (pos[1] / HY));
                dc.setColor(G.mix(bgc, 0xE8E4D0, 0.12 * sp), -1);
                dc.fillCircle(pos[0], pos[1], mr + 7);
                moonDisc(dc, d, pos[0], pos[1], mr, d.moon, G.dim(0xF2ECD8, sp), G.mix(bgc, 0x2A3350, sp));
            } else {
                moonDisc(dc, d, pos[0], pos[1], mr, d.moon, G.dim(acc, sp), -1);
            }
        }

        // ---- date + time
        var dp = G.ease(p * 1.6);
        dc.setColor(G.dim(st == 1 ? 0xD8E0F0 : 0x9A9A9A, dp), -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX, 50, 2, 1, 0);
        dc.setColor(0xFFFFFF, -1);
        F.st(dc, G.timeStr(d), CX, 116, 72, st == 1 ? 6 : 3, 1, G.easeInOut(p * 1.15 - 0.05), 0);

        // ---- ground: rise / slot / set
        var gp = G.stag(p, 1, 0.25, 0.5);
        var gc = st == 1 ? 0xC8CCD6 : 0x9A9A9A;
        riseSet(dc, d, 80, 326, _rise, true, gc, gp);
        riseSet(dc, d, 374, 326, _set, false, gc, gp);
        var sl = d.slots[0];
        if (gp > 0) {
            dc.setColor(G.mix(0, d.dcol, gp), -1);
            F.st(dc, sl[:val] as String, CX, 326, 18, 3, 1, 1.0, 0);
            dc.setColor(G.dim(0x808080, gp), -1);
            F.px(dc, sl[:lbl] as String, CX, 341, 2, 1, 0);
        }

        // ---- status
        var tp = G.stag(p, 2, 0.2, 0.5);
        if (tp > 0) {
            var s2 = status(d, e);
            dc.setColor(G.dim(acc, tp), -1);
            F.st(dc, s2[0], CX, 380, 20, 3, 1, tp, 0);
            if (s2[1].length() > 0) {
                dc.setColor(G.dim(st == 1 ? 0xAAB0C0 : 0x8A8A8A, tp), -1);
                F.px(dc, s2[1], CX, 400, 2, 1, 0);
            }
        }
    }

    // ---------------------------------------------------------------- style 3: 24h dial
    function ang(m) {
        return m / 4.0 + 180;
    }

    function layer(dc as Dc, rs, ss, el, lim) as Void {
        if (rs >= 0 && ss >= 0) {
            var a0 = ang(rs);
            var a1 = ang(ss);
            if (a1 < a0) { a1 += 360; }
            if (a1 > lim) { a1 = lim; }
            if (a1 > a0) { G.arcC(dc, CX, CX, 204, a0, a1); }
        } else if (_noonE > el) {
            G.arcC(dc, CX, CX, 204, 180, lim);
        }
    }

    function dial(dc as Dc, d as D, a as A) as Void {
        var acc = d.accent;
        var p = a.intro;
        var e = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var day = isDay(d, d.mins);
        var lim = 180 + 360 * G.ease(p * 1.3);

        // sectors (layered: night < twilight < golden < day)
        dc.setPenWidth(18);
        dc.setColor(0x161C36, -1);
        G.arcC(dc, CX, CX, 204, 180, lim);
        dc.setColor(0x2F4F9E, -1);
        layer(dc, _c6r, _c6s, -6, lim);
        dc.setColor(0xE8892F, -1);
        layer(dc, _rise, _set, -0.833, lim);
        dc.setColor(0xF6E4B0, -1);
        layer(dc, _g6r, _g6s, 6, lim);

        // hour ticks + labels
        var tp = G.ease(p * 1.5);
        dc.setPenWidth(2);
        for (var h = 0; h < 24; h++) {
            dc.setColor(G.dim(h % 6 == 0 ? 0xBBBBBB : 0x555555, tp), -1);
            G.tick(dc, CX, CX, h % 6 == 0 ? 184 : 188, 193, ang(h * 60));
        }
        dc.setColor(G.dim(0xAAAAAA, tp), -1);
        F.st(dc, "12", CX, 54, 16, 2, 1, 1.0, 0);
        F.st(dc, "0", CX, 400, 16, 2, 1, 1.0, 0);
        F.st(dc, "6", 56, CX, 16, 2, 1, 1.0, 0);
        F.st(dc, "18", 398, CX, 16, 2, 1, 1.0, 0);

        // marker: travels from sunrise (day) / sunset (night)
        var wp = G.easeInOut(p);
        var m0 = day ? _rise : _set;
        if (m0 < 0) { m0 = d.mins; }
        var u = d.mins - m0;
        if (u < 0) { u += 1440; }
        var deg = ang(m0 + u * wp);
        var mx = G.ptX(CX, 204, deg);
        var my = G.ptY(CX, 204, deg);
        dc.setColor(0, -1);
        dc.fillCircle(mx, my, 17);
        if (day) {
            var pulse = a.live ? Math.sin(a.t * 0.004) : 0.0;
            dc.setColor(0x3A2A10, -1);
            dc.fillCircle(mx, my, 15 + pulse);
            dc.setColor(0xFFD27A, -1);
            dc.fillCircle(mx, my, 11);
            dc.setColor(0xFFF4D6, -1);
            dc.fillCircle(mx, my, 6);
        } else {
            moonDisc(dc, d, mx, my, 12, d.moon, 0xF2ECD8, 0x2A3350);
        }

        // centre text
        var dp = G.ease(p * 1.6);
        dc.setColor(G.dim(0x9A9A9A, dp), -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX, 124, 2, 1, 0);
        dc.setColor(0xFFFFFF, -1);
        F.st(dc, G.timeStr(d), CX, 202, 78, 6, 1, G.easeInOut(p * 1.15 - 0.05), 0);

        var sp = G.stag(p, 2, 0.2, 0.5);
        if (sp > 0) {
            var s2 = status(d, e);
            dc.setColor(G.dim(acc, sp), -1);
            F.st(dc, s2[0], CX, 270, 20, 3, 1, sp, 0);
            riseSet(dc, d, CX - 52, 304, _rise, true, 0xB0B0B0, sp);
            riseSet(dc, d, CX + 52, 304, _set, false, 0xB0B0B0, sp);
            var sl = d.slots[0];
            var lbl = sl[:lbl] as String;
            var val = sl[:val] as String;
            var lw = F.pxW(lbl, 2);
            var vw = F.stW(val, 18);
            var x0 = CX - (lw + 10 + vw) / 2.0;
            dc.setColor(G.dim(0x808080, sp), -1);
            F.px(dc, lbl, x0, 331, 2, 0, 0);
            dc.setColor(G.mix(0, d.dcol, sp), -1);
            F.st(dc, val, x0 + lw + 10, 338, 18, 3, 0, 1.0, 0);
        }
    }

    // ---------------------------------------------------------------- always-on
    function aod(dc as Dc, d as D) as Void {
        calc(d);
        var o = St.shift(d);
        var ox = o[0];
        var oy = o[1];
        var acc = G.dim(d.accent, 0.55);
        var day = isDay(d, d.mins);
        if (d.cfg.style == 3) {
            dc.setPenWidth(2);
            dc.setColor(0x262A3A, -1);
            dc.drawCircle(CX + ox, CX + oy, 204);
            dc.setColor(acc, -1);
            if (_rise >= 0 && _set >= 0) {
                var a0 = ang(_rise);
                var a1 = ang(_set);
                if (a1 < a0) { a1 += 360; }
                G.arcC(dc, CX + ox, CX + oy, 204, a0, a1);
            }
            var deg = ang(d.mins);
            var mx = G.ptX(CX + ox, 204, deg);
            var my = G.ptY(CX + oy, 204, deg);
            dc.setColor(0, -1);
            dc.fillCircle(mx, my, 13);
            if (day) {
                dc.setColor(acc, -1);
                dc.drawCircle(mx, my, 9);
            } else {
                moonDisc(dc, d, mx, my, 9, d.moon, G.dim(0xF2ECD8, 0.5), -1);
            }
            dc.setColor(0x9A9A9A, -1);
            F.st(dc, G.timeStr(d), CX + ox, 202 + oy, 78, 3, 1, 1.0, 0);
            return;
        }
        dc.setPenWidth(1);
        dc.setColor(0x4A4A4A, -1);
        dc.drawLine(40 + ox, HY + oy, 414 + ox, HY + oy);
        if (_noonE > -0.833) {
            dc.setColor(0x3A3A3A, -1);
            for (var i = 0; i < ND; i += 2) {
                dc.fillCircle(G.lerp(XL, XR, i / (ND - 1.0)) + ox, _dy[i] + oy, 1.5);
            }
        }
        var pos;
        if (day) {
            pos = arcPos(d, d.mins);
        } else {
            pos = nightPos(d.mins);
        }
        if (day) {
            dc.setColor(acc, -1);
            dc.setPenWidth(2);
            dc.drawCircle(pos[0] + ox, pos[1] + oy, 10);
        } else {
            moonDisc(dc, d, pos[0] + ox, pos[1] + oy, 11, d.moon, G.dim(0xF2ECD8, 0.5), -1);
        }
        dc.setColor(0x9A9A9A, -1);
        F.st(dc, G.timeStr(d), CX + ox, 116 + oy, 72, 3, 1, 1.0, 0);
    }
}
