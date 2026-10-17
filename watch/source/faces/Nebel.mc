import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// NEBEL — "Nebel": the display is fogged up. On every wrist raise a finger wipes a curved path
// through the fog and reveals the bright time and date; a second, small stroke frees the data
// slots. Then the fog slowly creeps back from the edges while droplets run down the clear path.
// Every raise wipes a different path (seed = raise counter); one raise in eight leaves a smiley.
// Styles: 1 Beschlagen (bathroom mirror, warm light), 2 Frost (ice ferns, the wipe melts them),
// 3 Rauch (drifting smoke, the time glows orange). Mirrors web/js/faces/nebel.js.
class FaceNebel extends Face {
    const NSTR = 76; // fog is drawn in vertical strips of 6 px
    const Y0 = 212;  // centre of the main wipe / content block
    const Y2 = 350;  // centre of the slot wipe
    const X2A = 92;  // slot wipe from .. to
    const X2B = 362;
    const T0 = 120;  // main wipe start / duration (ms)
    const SW = 800;
    const T2 = 950;  // slot wipe
    const SW2 = 450;
    const TC = 1600; // fog creeps back from TC over CR ms
    const CR = 7400;
    // per style: fog base, fog base 2 (streaks), light blob, dark blob, rim, under bg, under glow,
    // time, date, slot label, slot value, droplet, light shining through the fog
    const PAL = [
        0x56606A, 0x5B656F, 0x636D77, 0x4E5760, 0x8B959F, 0x140B05, 0x3A210E, 0xFFF0DA, 0xF0B77C, 0xB68F6C, 0xFFE6C6, 0x9AA6B2, 0x7D6E60,
        0x2B3C4C, 0x30425A, 0x34485C, 0x253546, 0xCDEAFF, 0x030B16, 0x0B2440, 0xEAF8FF, 0x9ED8FF, 0x7096B8, 0xDFF3FF, 0xBFE6FF, 0x37587A,
        0x18181B, 0x1B1B1F, 0x2B2B31, 0x111113, 0x26262C, 0x0A0503, 0x341405, 0xFF9A3C, 0xE07A34, 0x9A6A48, 0xFFB878, 0xFF7A20, 0x2E1D14
    ];
    const NP = 13;

    hidden var _a1 as Array<Float>;
    hidden var _b1 as Array<Float>;
    hidden var _a2 as Array<Float>;
    hidden var _b2 as Array<Float>;
    hidden var _cols as Array<Number>; // fog colour per strip (streaks + light shining through)
    hidden var _nj as Array<Float>;    // edge raggedness per strip
    hidden var _glow as Array<Number>; // background colour under the fog per strip (light behind the time)
    hidden var _busy = true;
    hidden var _any = false; // is anything wiped right now?
    hidden var _key = -1;
    hidden var _wn = 0;
    hidden var _tilt = 0;
    hidden var _bow = 0;
    hidden var _dir = 1;
    hidden var _ph = 0.0;
    hidden var _tilt2 = 0;
    hidden var _blobs = null; // x, y, r, tone
    hidden var _fern = null;  // x1, y1, x2, y2 (main segments first, then side branches)
    hidden var _nMain = 0;

    function initialize() {
        Face.initialize();
        _a1 = new [NSTR] as Array<Float>;
        _b1 = new [NSTR] as Array<Float>;
        _a2 = new [NSTR] as Array<Float>;
        _b2 = new [NSTR] as Array<Float>;
        _cols = new [NSTR] as Array<Number>;
        _nj = new [NSTR] as Array<Float>;
        _glow = new [NSTR] as Array<Number>;
        for (var s = 0; s < NSTR; s++) {
            _a1[s] = 1.0;
            _b1[s] = 0.0;
            _a2[s] = 1.0;
            _b2[s] = 0.0;
        }
    }

    function fps() as Number {
        return _busy ? 20 : 12;
    }

    hidden function fl(v) as Number {
        return Math.floor(v).toNumber();
    }

    hidden function ce(v) as Number {
        return Math.ceil(v).toNumber();
    }

    hidden function fmod(v, m) {
        return v - Math.floor(v / m) * m;
    }

    hidden function build(st, d as D) as Void {
        _wn = d.wakeN.abs() % 100000;
        var wn = _wn;
        var key = wn * 4 + st;
        if (key == _key) {
            return;
        }
        _key = key;
        var sd = G.rnd(wn * 131 + 7);
        sd = G.rnd(sd); _tilt = (sd % 25) - 12;
        sd = G.rnd(sd); _bow = (sd % 21) - 10;
        sd = G.rnd(sd); _dir = (sd >> 5) % 3 == 0 ? -1 : 1;
        sd = G.rnd(sd); _ph = (sd % 1000) / 100.0;
        sd = G.rnd(sd); _tilt2 = (sd % 9) - 4;
        var nb = st == 3 ? 13 : 12;
        var bl = new [nb * 4];
        for (var i = 0; i < nb; i++) {
            sd = G.rnd(sd);
            var ang = G.rf(sd) * 6.2832;
            sd = G.rnd(sd);
            var rad = Math.sqrt(G.rf(sd)) * 205;
            sd = G.rnd(sd);
            bl[i * 4] = 227 + Math.sin(ang) * rad;
            bl[i * 4 + 1] = 227 + Math.cos(ang) * rad;
            bl[i * 4 + 2] = 28 + (sd % 46);
            bl[i * 4 + 3] = (sd >> 6) % 2;
        }
        _blobs = bl;
        var b = (st - 1) * NP;
        for (var s = 0; s < NSTR; s++) {
            var xc = s * 6 + 3;
            var u = (xc - 227) / 227.0;
            _cols[s] = G.mix(G.mix(PAL[b], PAL[b + 1], 0.5 + 0.5 * G.noise(xc * 0.031 + _ph)), PAL[b + 12], (1 - u * u) * 0.55);
            _nj[s] = 1 + G.noise(xc * 0.045 + _ph);
            _glow[s] = G.mix(PAL[b + 5], PAL[b + 6], G.clamp(1.15 - u.abs() * 1.25, 0.0, 1.0));
        }
        _fern = null;
        if (st == 2) {
            // ice ferns growing in from the rim: a wandering main rib with side branches at every node
            var nf = 11;
            var fern = new [nf * 8 * 4 + nf * 14 * 4];
            _nMain = nf * 8;
            var m = 0;
            var sb = _nMain * 4;
            for (var f = 0; f < nf; f++) {
                sd = G.rnd(sd);
                var ang = f * 32.7 + (sd % 24);
                var x = G.ptX(227, 228, ang);
                var y = G.ptY(227, 228, ang);
                var dr = ang + 180;
                for (var i = 0; i < 8; i++) {
                    sd = G.rnd(sd);
                    dr += (sd % 31) - 15;
                    var len = 15 - i;
                    var nx = G.ptX(x, len, dr);
                    var ny = G.ptY(y, len, dr);
                    fern[m] = x; fern[m + 1] = y; fern[m + 2] = nx; fern[m + 3] = ny;
                    m += 4;
                    if (i > 0) {
                        var bl2 = (8 - i) * 2.8 + 5;
                        for (var sgn = -1; sgn <= 1; sgn += 2) {
                            fern[sb] = x;
                            fern[sb + 1] = y;
                            fern[sb + 2] = G.ptX(x, bl2, dr + sgn * 58);
                            fern[sb + 3] = G.ptY(y, bl2, dr + sgn * 58);
                            sb += 4;
                        }
                    }
                    x = nx;
                    y = ny;
                }
            }
            _fern = fern;
        }
    }

    // clear (wiped) intervals of every strip for this moment: A1..B1 main wipe, A2..B2 slot wipe
    hidden function strips(st, t) as Void {
        var p1 = G.easeInOut((t - T0) / (SW * 1.0));
        var head = _dir > 0 ? -90 + p1 * 634 : 544 - p1 * 634;
        var cr = G.ease((t - TC) / (CR * 1.0));
        var hw = 84 - 13 * cr;
        var p2 = G.easeInOut((t - T2) / (SW2 * 1.0));
        var head2 = X2A + (X2B - X2A) * p2;
        var hw2 = 27 - 3 * cr;
        var tt = t * 0.0006;
        _any = t >= T0;
        var a1 = _a1;
        var b1 = _b1;
        var a2 = _a2;
        var b2 = _b2;
        for (var s = 0; s < NSTR; s++) {
            var xc = s * 6 + 3;
            var u = (xc - 227) / 227.0;
            var yc = Y0 + _tilt * u + _bow * (u * u - 0.1);
            var jit = (st == 3 ? _nj[s] * 0.6 + 0.4 * (1 + Math.sin(xc * 0.05 + tt * 2)) : _nj[s]) * (1.5 + 4 * cr);
            var h = -1.0;
            if (t >= T0) {
                var dx = _dir > 0 ? xc - head : head - xc;
                h = dx <= 0 ? hw : (dx < hw ? Math.sqrt(hw * hw - dx * dx) : -1.0);
            }
            if (h > jit) {
                a1[s] = yc - h + jit;
                b1[s] = yc + h - jit;
            } else {
                a1[s] = 1.0;
                b1[s] = 0.0;
            }
            h = -1.0;
            if (t >= T2) {
                var dx = xc < X2A ? X2A - xc : (xc > head2 ? xc - head2 : 0);
                h = dx < hw2 ? Math.sqrt(hw2 * hw2 - dx * dx) : -1.0;
            }
            var y2 = Y2 + (_tilt2 * (xc - 227)) / 107.0;
            var j2 = jit * 0.4;
            if (h > j2) {
                a2[s] = y2 - h + j2;
                b2[s] = y2 + h - j2;
            } else {
                a2[s] = 1.0;
                b2[s] = 0.0;
            }
        }
    }

    // is the point inside a wiped area (with a margin)?
    hidden function clearAt(x, y, mg) as Boolean {
        if (!_any || x < 0) {
            return false;
        }
        var s = x.toNumber() / 6;
        if (s >= NSTR) {
            return false;
        }
        return (y > _a1[s] - mg && y < _b1[s] + mg) || (y > _a2[s] - mg && y < _b2[s] + mg);
    }

    // a fog blob that never paints into the wiped areas: drawn in clipped vertical slices
    hidden function fogCirc(dc as Dc, bx, by, r) as Void {
        var a1 = _a1;
        var b1 = _b1;
        var a2 = _a2;
        var b2 = _b2;
        var s0 = fl((bx - r) / 6.0);
        var s1 = fl((bx + r) / 6.0);
        if (s0 < 0) { s0 = 0; }
        if (s1 > NSTR - 1) { s1 = NSTR - 1; }
        var hit = false;
        for (var s = s0; s <= s1 && !hit; s++) {
            if ((a1[s] < b1[s] && a1[s] - 3 < by + r && b1[s] + 3 > by - r) || (a2[s] < b2[s] && a2[s] - 3 < by + r && b2[s] + 3 > by - r)) {
                hit = true;
            }
        }
        if (!hit) {
            dc.fillCircle(bx, by, r);
            return;
        }
        for (var s = s0; s <= s1; s += 4) {
            var e = s + 3 < s1 ? s + 3 : s1;
            var ta = 999.0;
            var tb = -999.0;
            var ua = 999.0;
            var ub = -999.0;
            for (var q = s; q <= e; q++) {
                if (a1[q] < b1[q]) {
                    if (a1[q] < ta) { ta = a1[q]; }
                    if (b1[q] > tb) { tb = b1[q]; }
                }
                if (a2[q] < b2[q]) {
                    if (a2[q] < ua) { ua = a2[q]; }
                    if (b2[q] > ub) { ub = b2[q]; }
                }
            }
            var xl = s * 6;
            var w = (e - s + 1) * 6;
            var y = fl(by - r);
            var ye = ce(by + r);
            if (ta < tb) {
                var y1 = fl(ta) - 3;
                if (y1 > y) {
                    dc.setClip(xl, y, w, y1 - y);
                    dc.fillCircle(bx, by, r);
                }
                var ny = ce(tb) + 3;
                if (ny > y) { y = ny; }
            }
            if (ua < ub) {
                var y1 = fl(ua) - 3;
                if (y1 > y) {
                    dc.setClip(xl, y, w, y1 - y);
                    dc.fillCircle(bx, by, r);
                }
                var ny = ce(ub) + 3;
                if (ny > y) { y = ny; }
            }
            if (ye > y) {
                dc.setClip(xl, y, w, ye - y);
                dc.fillCircle(bx, by, r);
            }
        }
        dc.clearClip();
    }

    hidden function content(dc as Dc, d as D, st, P as Array) as Void {
        // what lies under the fog: a dark background with a soft light (only where it can be seen:
        // inside the wiped strips), date, time, data slots
        var a1 = _a1;
        var b1 = _b1;
        var a2 = _a2;
        var b2 = _b2;
        for (var s = 0; s < NSTR; s++) {
            if (a1[s] < b1[s]) {
                dc.setColor(_glow[s], -1);
                dc.fillRectangle(s * 6, fl(a1[s]), 6, ce(b1[s]) - fl(a1[s]));
            }
            if (a2[s] < b2[s]) {
                dc.setColor(P[5], -1);
                dc.fillRectangle(s * 6, fl(a2[s]), 6, ce(b2[s]) - fl(a2[s]));
            }
        }
        var ts = G.timeStr(d);
        dc.setColor(P[8], -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, Y0 - 58, 2, 1, 0);
        if (st == 3) {
            dc.setColor(G.mix(P[6], P[7], 0.45), -1);
            F.st(dc, ts, 227, Y0 + 14, 78, 15, 1, 1.0, 0);
        }
        dc.setColor(P[7], -1);
        F.st(dc, ts, 227, Y0 + 14, 78, st == 2 ? 6 : 8, 1, 1.0, 0);
        for (var k = 0; k < 3; k++) {
            var sl = d.slots[k];
            var x = 227 + (k - 1) * 104;
            dc.setColor(P[9], -1);
            F.px(dc, sl[:lbl] as String, x, Y2 - 21, 2, 1, 0);
            dc.setColor(P[10], -1);
            slotVal(dc, sl[:val] as String, x);
        }
    }

    // slot value: large, or smaller when it is long (race times, big step counts)
    hidden function slotVal(dc as Dc, v as String, x) as Void {
        if (F.pxW(v, 3) > 88) {
            F.px(dc, v, x, Y2, 2, 1, 0);
        } else {
            F.px(dc, v, x, Y2 - 3, 3, 1, 0);
        }
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var P = PAL.slice((st - 1) * NP, st * NP);
        build(st, d);
        var t = a.live ? a.t : 99999;
        _busy = a.live && t < T2 + SW2 + 300;
        strips(st, t);
        // before the wipe nothing of the content is visible (and this frame also builds the fog)
        if (_any) {
            content(dc, d, st, P);
        }
        var a1 = _a1;
        var b1 = _b1;
        var a2 = _a2;
        var b2 = _b2;
        var wn = _wn;

        // fog layer: strips around the wiped intervals, subtle vertical streaks
        for (var s = 0; s < NSTR; s++) {
            var x = s * 6;
            var xc = x + 3;
            var ch = Math.sqrt(227 * 227 - (xc - 227) * (xc - 227)) + 2;
            var ya = fl(227 - ch);
            var yb = ce(227 + ch);
            dc.setColor(_cols[s], -1);
            var y = ya;
            if (a1[s] < b1[s]) {
                var e = fl(a1[s]);
                if (e > y) { dc.fillRectangle(x, y, 6, e - y); }
                y = ce(b1[s]);
            }
            if (a2[s] < b2[s]) {
                var e = fl(a2[s]);
                if (e > y) { dc.fillRectangle(x, y, 6, e - y); }
                y = ce(b2[s]);
            }
            if (yb > y) { dc.fillRectangle(x, y, 6, yb - y); }
        }
        // texture: soft lighter / darker fog clouds (smoke drifts upwards)
        var bl = _blobs;
        var nb = bl.size() / 4;
        for (var i = 0; i < nb; i++) {
            var bx = bl[i * 4];
            var by = bl[i * 4 + 1];
            var r = bl[i * 4 + 2];
            if (st == 3) {
                bx += Math.sin(t * 0.0005 + i * 1.7) * 26;
                by = fmod(by - t * 0.009 * (1 + (i % 3)) + 80, 614) - 80;
            }
            var rr = st == 3 ? r * 0.85 : r * 0.7;
            var u = (bx - 227) / 227.0;
            var base = G.mix(P[0], P[12], G.clamp(1 - u * u, 0.0, 1.0) * 0.55);
            var lt = bl[i * 4 + 3] == 0;
            var tone = lt ? G.mix(base, st == 3 ? 0x9A9AAA : 0xFFFFFF, st == 3 ? 0.1 : 0.07) : G.mix(base, 0, st == 3 ? 0.4 : 0.11);
            dc.setColor(G.mix(base, tone, 0.5), -1);
            fogCirc(dc, bx, by, rr);
            dc.setColor(tone, -1);
            fogCirc(dc, bx, by, rr * 0.6);
        }
        // frost ferns (segments that would cross the wipe are melted away)
        if (st == 2) {
            var fern = _fern;
            var n = fern.size() / 4;
            for (var i = 0; i < n; i++) {
                var o = i * 4;
                var x1 = fern[o];
                var y1 = fern[o + 1];
                var x2 = fern[o + 2];
                var y2 = fern[o + 3];
                if (clearAt((x1 + x2) / 2, (y1 + y2) / 2, 11)) {
                    continue;
                }
                if (i < _nMain) {
                    dc.setColor(P[4], -1);
                    dc.setPenWidth(2);
                } else {
                    dc.setColor(0x86A9C8, -1);
                    dc.setPenWidth(1);
                }
                dc.drawLine(x1, y1, x2, y2);
            }
        }
        // fine condensation droplets sitting in the fog
        if (st == 1) {
            var sd = G.rnd(wn + 9);
            for (var j = 0; j < 34; j++) {
                sd = G.rnd(sd);
                var x = 24 + (sd % 406);
                sd = G.rnd(sd);
                var y = 24 + (sd % 406);
                var r = 1.2 + (sd % 3) * 0.7;
                if ((x - 227) * (x - 227) + (y - 227) * (y - 227) > 44000 || clearAt(x, y, r + 3)) {
                    continue;
                }
                dc.setColor(P[3], -1);
                dc.fillCircle(x, y, r + 0.6);
                dc.setColor(P[4], -1);
                dc.fillCircle(x - r * 0.35, y - r * 0.35, r * 0.45);
            }
        }
        // frost: glittering ice crystals
        if (st == 2) {
            var sd = G.rnd(wn + 5);
            for (var j = 0; j < 44; j++) {
                sd = G.rnd(sd);
                var x = 20 + (sd % 414);
                sd = G.rnd(sd);
                var y = 20 + (sd % 414);
                if ((x - 227) * (x - 227) + (y - 227) * (y - 227) > 46000 || clearAt(x, y, 3)) {
                    continue;
                }
                var tw = (t / 150 + j * 3) % 9;
                dc.setColor(tw == 0 ? 0xFFFFFF : 0x8FB6D8, -1);
                dc.fillRectangle(x, y, 2, 2);
                if (tw == 0) {
                    dc.fillRectangle(x - 2, y, 6, 2);
                    dc.fillRectangle(x, y - 2, 2, 6);
                }
            }
        }
        // pushed-aside condensation along the wipe edges + little drops sitting on it
        dc.setColor(P[4], -1);
        for (var s = 0; s < NSTR; s++) {
            var x = s * 6;
            if (a1[s] < b1[s]) {
                dc.fillRectangle(x, fl(a1[s]) - 3, 6, 3);
                dc.fillRectangle(x, ce(b1[s]), 6, 3);
            }
            if (a2[s] < b2[s]) {
                dc.fillRectangle(x, fl(a2[s]) - 2, 6, 2);
                dc.fillRectangle(x, ce(b2[s]), 6, 2);
            }
        }
        if (st != 3) {
            dc.setColor(P[11], -1);
            for (var s = 2; s < NSTR - 2; s += 5) {
                if (a1[s] < b1[s]) {
                    var r = 1.5 + ((s * 7 + wn) % 3);
                    dc.fillCircle(s * 6 + 3, a1[s] - 5 - r, r);
                    if ((s + wn) % 2 == 0) {
                        dc.fillCircle(s * 6 + 5, b1[s] + 5 + r, r);
                    }
                }
            }
        }
        // the data slots shimmer faintly through the fog until the second stroke frees them
        var head2 = t < T2 ? -1 : X2A + (X2B - X2A) * G.easeInOut((t - T2) / (SW2 * 1.0));
        for (var k = 0; k < 3; k++) {
            var x = 227 + (k - 1) * 104;
            if (head2 >= x) {
                continue;
            }
            var sl = d.slots[k];
            dc.setColor(G.mix(P[0], P[10], 0.22), -1);
            F.px(dc, sl[:lbl] as String, x, Y2 - 21, 2, 1, 0);
            slotVal(dc, sl[:val] as String, x);
        }
        // after the wipe: droplets run down the clear path (Rauch: embers rise)
        var cr = G.ease((t - TC) / (CR * 1.0));
        var sd = G.rnd(wn * 17 + 3);
        var nd = st == 3 ? 6 : 4;
        for (var j = 0; j < nd; j++) {
            sd = G.rnd(sd);
            var x = 112 + (sd % 230);
            sd = G.rnd(sd);
            var s = x / 6;
            if (a1[s] >= b1[s]) {
                continue;
            }
            if (st == 3) {
                var span = b1[s] - a1[s] - 10;
                if (span < 4) {
                    continue;
                }
                var y = b1[s] - 5 - fmod(t * (0.02 + (sd % 10) * 0.003) + (sd % 97), span);
                dc.setColor(G.mix(P[5], P[11], 0.4 + 0.4 * Math.sin(t * 0.004 + j).abs()), -1);
                dc.fillCircle(x + Math.sin(t * 0.002 + j * 2) * 6, y, 1.6);
                continue;
            }
            var t0 = TC + j * 1100 + (sd % 700);
            if (t < t0) {
                continue;
            }
            var y0 = a1[s] + 2;
            var y = y0 + ((t - t0) * (18 + (sd % 22))) / 1000.0;
            if (y > b1[s] - 4) { y = b1[s] - 4; }
            var wob = Math.sin(y * 0.07 + j) * 2;
            dc.setColor(G.mix(P[6], P[11], 0.15), -1);
            dc.setPenWidth(2);
            dc.drawLine(x, y - 34 > y0 ? y - 34 : y0, x + wob, y);
            dc.setColor(P[11], -1);
            dc.fillCircle(x + wob, y, 3.2);
            dc.setColor(0xFFFFFF, -1);
            dc.fillCircle(x + wob - 1, y - 1, 1);
        }
        // one raise in eight: somebody drew a smiley into the fog
        if (wn % 8 == 5 && t > TC - 200) {
            var sp = G.clamp((t - TC + 200) / 900.0, 0.0, 1.0);
            var cx = 227 + ((wn * 13) % 61) - 30;
            var cy = 90;
            dc.setColor(G.mix(G.mix(P[5], P[6], 0.5), P[0], cr * 0.55), -1);
            dc.setPenWidth(6);
            G.arcC(dc, cx, cy, 24, 200, 200 + 360 * G.clamp(sp * 1.6, 0.0, 1.0));
            if (sp > 0.62) {
                dc.fillCircle(cx - 8, cy - 6, 3.5);
                dc.fillCircle(cx + 8, cy - 6, 3.5);
            }
            if (sp > 0.75) {
                G.arcC(dc, cx, cy + 1, 13, 120, 120 + 120 * G.clamp((sp - 0.75) * 4, 0.0, 1.0));
            }
        }
    }

    // dim fog droplets with the time very faint beneath
    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var b = (st - 1) * NP;
        dc.setColor(G.dim(PAL[b + 7], 0.42), -1);
        F.st(dc, G.timeStr(d), 227 + o[0], Y0 + 14 + o[1], 78, 3, 1, 1.0, 0);
        dc.setColor(G.dim(PAL[b + 8], 0.4), -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227 + o[0], Y0 - 58 + o[1], 2, 1, 0);
        // a veil of fine droplets
        var sd = G.rnd(d.h * 60 + 11);
        dc.setColor(G.dim(PAL[b + 11], st == 3 ? 0.35 : 0.22), -1);
        for (var j = 0; j < 46; j++) {
            sd = G.rnd(sd);
            var ang = G.rf(sd) * 6.2832;
            sd = G.rnd(sd);
            var rad = 60 + G.rf(sd) * 150;
            dc.fillCircle(227 + Math.sin(ang) * rad + o[0], 227 + Math.cos(ang) * rad + o[1], 1 + (sd % 3));
        }
    }
}
