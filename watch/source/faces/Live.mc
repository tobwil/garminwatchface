import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// LIVE — "Live-Coach": what is going on in your body right now. The "now" lib combines heart rate,
// resting heart rate, movement and the stress / Body Battery trends into one state ("Anspannung im
// Sitzen", "Lädt gerade auf", "Nachbrenner" ...), says why with the real numbers and gives a short,
// warm tip that changes with every raise. While you look, the pulse ticks live and the heart beats in
// your real rhythm.
// Styles 1 Kiesel (black) and 2 Kiesel Weiß (white): Pebble Text Watch spirit in the bitmap font, the
// lines slide in from the right one after the other on every raise; below the live pulse with a
// beating heart and the three trend arrows (pulse, stress, Body Battery).
// Style 3 Aura: a meditating figure in a glow of the state colour (opaque stepped rings), the heart
// beats in its chest; for tense states the aura becomes a breathing guide (4 s in, 6 s out).
// Mirrors web/js/faces/live.js.
class FaceLive extends Face {
    const DOW = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const X0 = 62; // left edge of the Kiesel text
    const HEART = [0x36, 0x7F, 0x7F, 0x3E, 0x1C, 0x08]; // 7 x 6 pixel heart
    const ARW = [
        [0x04, 0x0E, 0x15, 0x04, 0x04, 0x04, 0x04], // up
        [0x00, 0x04, 0x02, 0x1F, 0x02, 0x04, 0x00], // steady
        [0x04, 0x04, 0x04, 0x04, 0x15, 0x0E, 0x04]  // down
    ];
    const TL = ["Puls", "Stress", "Akku"];
    const ACX = 227;
    const ACY = 212;
    const AR = 92; // aura centre and outer radius (at rest)

    // text lines of the Kiesel styles, built once per static layer: text, y, scale, kind (0 head 1 reason 2 tip)
    hidden var _lk = -1;
    hidden var _LT = [] as Array<String>;
    hidden var _LY = [] as Array<Number>;
    hidden var _LS = [] as Array<Number>;
    hidden var _LB = [] as Array<Number>;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    function reveal() as Boolean {
        return false;
    }

    // the coach brings its own tips, breathing guide and wind-down hint: no assistant cards
    function speaks() as Boolean {
        return true;
    }

    // dot bitmap: rows of w bits (msb = left)
    hidden function bits(dc as Dc, rows as Array, w as Number, x as Number, y as Number, sc as Number) as Void {
        for (var r = 0; r < rows.size(); r++) {
            var row = rows[r] as Number;
            var c = 0;
            while (c < w) {
                if ((row & (1 << (w - 1 - c))) != 0) {
                    var e = c + 1;
                    while (e < w && (row & (1 << (w - 1 - e))) != 0) {
                        e++;
                    }
                    dc.fillRectangle(x + c * sc, y + r * sc, (e - c) * sc, sc);
                    c = e;
                } else {
                    c++;
                }
            }
        }
    }

    // longest word of s
    hidden function longest(s as String) as Number {
        var cs = s.toCharArray();
        var m = 0;
        var n = 0;
        for (var i = 0; i < cs.size(); i++) {
            if (cs[i] == ' ') {
                n = 0;
            } else {
                n++;
                if (n > m) {
                    m = n;
                }
            }
        }
        return m;
    }

    // heart size factor from the beat: 1 on the beat, 0.5 on the second (smaller) knock, else 0
    hidden function beat(t as Number, bpm as Number) as Float {
        var per = 60000 / (bpm > 30 ? bpm : 60);
        var ph = (t % per) / per.toFloat();
        return ph < 0.14 ? 1.0 : (ph >= 0.2 && ph < 0.3 ? 0.5 : 0.0);
    }

    // lines for the Kiesel styles (head / reason / tip), vertically centred between y 80 and 334
    hidden function layout(d as D, R as Array<Number>) as Void {
        var k = (d.doy * 1440 + d.mins) * 4 + (d.wakeN % 4);
        if (k == _lk) {
            return;
        }
        _lk = k;
        _LT = [] as Array<String>;
        _LY = [] as Array<Number>;
        _LS = [] as Array<Number>;
        _LB = [] as Array<Number>;
        var head = Now.head(R);
        var hs = longest(head) > 11 ? 4 : 5;
        var H = Now.wrap(head, hs == 5 ? 11 : 14);
        var Rs = Now.wrap(Now.reason(d, R), 20);
        var T = Now.wrap(Now.tip(d, R, d.wakeN), 20);
        var tot = H.size() * (hs * 7 + 7) + 10 + Rs.size() * 25 + 12 + T.size() * 25 - 4;
        var y = 80 + Math.floor((254 - tot) / 2.0).toNumber();
        for (var i = 0; i < H.size(); i++) {
            _LT.add(H[i]); _LY.add(y); _LS.add(hs); _LB.add(0); y += hs * 7 + 7;
        }
        y += 10;
        for (var i = 0; i < Rs.size(); i++) {
            _LT.add(Rs[i]); _LY.add(y); _LS.add(3); _LB.add(1); y += 25;
        }
        y += 12;
        for (var i = 0; i < T.size(); i++) {
            _LT.add(T[i]); _LY.add(y); _LS.add(3); _LB.add(2); y += 25;
        }
    }

    // [background, ink, dim ink, state colour]
    hidden function pal(st as Number, c as Number) as Array<Number> {
        if (st == 2) {
            return [0xFFFFFF, 0x000000, 0x555555, G.mix(c, 0x000000, 0.3)] as Array<Number>;
        }
        return [0x000000, 0xFFFFFF, 0xAAAAAA, c] as Array<Number>;
    }

    hidden function kLine(dc as Dc, i as Number, x as Number) as Void {
        var sc = _LS[i];
        F.px(dc, _LT[i], x, _LY[i], sc, 0, 0);
        if (_LB[i] == 0) {
            F.px(dc, _LT[i], x + 2, _LY[i], sc, 0, 0);
        }
    }

    // the Kiesel styles
    hidden function kiesel(dc as Dc, d as D, a as A, R as Array<Number>, S as Boolean, M as Boolean) as Void {
        var P = pal(d.cfg.style, Now.COL[R[0]]);
        var p = a.intro;
        layout(d, R);
        var n = _LT.size();
        var step = n > 1 ? (0.58 / (n - 1) < 0.1 ? 0.58 / (n - 1) : 0.1) : 0.0;
        if (S) {
            dc.setColor(P[0], -1);
            dc.fillRectangle(0, 0, 454, 454);
            // small time + date
            var ts = G.timeStr(d);
            var ds = DOW[d.dow] + " " + d.day + "." + d.mon + ".";
            var w = F.pxW(ts, 3) + 14 + F.pxW(ds, 2);
            var x = Math.round(227 - w / 2.0).toNumber();
            dc.setColor(P[1], -1);
            F.px(dc, ts, x, 46, 3, 0, 0);
            dc.setColor(P[2], -1);
            F.px(dc, ds, x + F.pxW(ts, 3) + 14, 53, 2, 0, 0);
            if (!d.phone) {
                Spr.draw(dc, SprKiesel.BT, 223, 18, 2, [-1, P[2]], false);
                for (var i = 0; i < 7; i++) {
                    dc.fillRectangle(219 + i * 3, 16 + i * 3, 3, 3);
                }
            }
            // state marker beside the headline
            var hn = 0;
            for (var i = 0; i < n; i++) {
                if (_LB[i] == 0) {
                    hn++;
                }
            }
            dc.setColor(P[3], -1);
            dc.fillRectangle(X0 - 16, _LY[0], 6, hn * (_LS[0] * 7 + 7) - 7);
            // the lines (in a full frame during the intro the sliding ones are drawn below only)
            for (var i = 0; i < n; i++) {
                if (M && G.stag(p, i, step, 0.42) < 1) {
                    continue;
                }
                dc.setColor(_LB[i] == 1 ? P[2] : P[1], -1);
                kLine(dc, i, X0);
            }
            // trend arrows
            var tw = 0;
            for (var k = 0; k < 3; k++) {
                tw += F.pxW(TL[k], 2) + 16 + (k < 2 ? 20 : 0);
            }
            var tx = Math.round(227 - tw / 2.0).toNumber();
            for (var k = 0; k < 3; k++) {
                dc.setColor(P[2], -1);
                tx += F.pxW(TL[k], 2) + 6;
                F.px(dc, TL[k], tx - F.pxW(TL[k], 2) - 6, 398, 2, 0, 0);
                dc.setColor(P[1], -1);
                bits(dc, ARW[1 - Now.trend(R, k)], 5, tx, 398, 2);
                tx += 10 + 20;
            }
        }

        if (!M) {
            return;
        }
        // ---- intro: the lines slide in from the right one after the other
        if (p < 1) {
            for (var i = 0; i < n; i++) {
                var q = G.stag(p, i, step, 0.42);
                if (q >= 1) {
                    continue;
                }
                if (!S) {
                    // hide the line of the cached static layer
                    dc.setColor(P[0], -1);
                    dc.fillRectangle(X0 - 2, _LY[i] - 2, 454 - X0, _LS[i] * 7 + 4);
                }
                var x = X0 + Math.round((1 - G.easeInOut(q)) * 420).toNumber();
                if (x >= 454) {
                    continue;
                }
                dc.setColor(_LB[i] == 1 ? P[2] : P[1], -1);
                kLine(dc, i, x);
            }
        }
        // ---- live pulse: beating heart and the ticking number
        var hr = d.hrNow();
        var b = a.live ? beat(a.t, R[1]) : 0.0;
        var hs = b >= 1 ? 6 : (b > 0 ? 5 : 4);
        var num = hr > 0 ? "" + hr : "--";
        var nw = F.pxW(num, 5) + 2;
        var gx = Math.round(227 - (28 + 14 + nw + 10 + F.pxW("bpm", 2)) / 2.0).toNumber();
        dc.setColor(P[3], -1);
        bits(dc, HEART, 7, gx + 14 - Math.round(3.5 * hs).toNumber(), 360 - 3 * hs, hs);
        dc.setColor(P[1], -1);
        F.px(dc, num, gx + 42, 343, 5, 0, 0);
        F.px(dc, num, gx + 44, 343, 5, 0, 0);
        dc.setColor(P[2], -1);
        F.px(dc, "bpm", gx + 42 + nw + 10, 364, 2, 0, 0);
    }

    // silhouette of a sitting, meditating figure (centre x 227): head, torso, arms resting on the knees
    // (with a gap to the waist so the glow shows through), crossed legs
    hidden function figure(dc as Dc, col as Number) as Void {
        dc.setColor(col, -1);
        dc.fillCircle(227, 146, 16);
        dc.fillRectangle(221, 158, 12, 14);
        dc.fillPolygon([[204, 170], [250, 170], [260, 182], [250, 242], [204, 242], [194, 182]]);
        dc.fillCircle(205, 183, 12);
        dc.fillCircle(249, 183, 12);
        for (var k = 0; k < 2; k++) {
            var sx = k == 0 ? 1 : -1;
            var o = k == 0 ? 0 : 454;
            dc.fillPolygon([[o + sx * 195, 176], [o + sx * 207, 188], [o + sx * 193, 232], [o + sx * 179, 226]]);
            dc.fillPolygon([[o + sx * 179, 224], [o + sx * 193, 232], [o + sx * 168, 258], [o + sx * 156, 250]]);
            dc.fillCircle(o + sx * 160, 254, 7);
        }
        dc.fillEllipse(227, 260, 78, 16);
    }

    // the glow: opaque stepped rings, b = breath 0..1 (grows the rings), g = intro growth 0..1
    hidden function aura(dc as Dc, C as Number, b, g) as Void {
        for (var i = 0; i < 7; i++) {
            var r = Math.round((AR - i * 9 + b * (14 - i)) * g).toNumber();
            if (r <= 0) {
                continue;
            }
            dc.setColor(G.mix(0x000000, C, 0.13 + i * 0.08), -1);
            dc.fillCircle(ACX, ACY, r);
        }
        figure(dc, G.mix(0x000000, C, 0.04));
    }

    // upper case incl. umlauts (the stroke font has Ä Ö Ü)
    hidden function upc(s as String) as String {
        var cs = s.toUpper().toCharArray();
        var out = "";
        for (var i = 0; i < cs.size(); i++) {
            var c = cs[i].toNumber();
            if (c == 228) {
                c = 196;
            } else if (c == 246) {
                c = 214;
            } else if (c == 252) {
                c = 220;
            }
            out += c.toChar().toString();
        }
        return out;
    }

    // the Aura style
    hidden function auraStyle(dc as Dc, d as D, a as A, R as Array<Number>, S as Boolean, M as Boolean) as Void {
        var C = Now.COL[R[0]];
        var p = a.intro;
        var dyn = Now.breathe(R[0]); // the aura is a breathing guide: drawn every frame
        if (S) {
            var head = upc(Now.head(R));
            var tip = Now.tip(d, R, d.wakeN);
            var T = Now.wrap(tip, tip.length() <= 24 ? 24 : (tip.length() + 1) / 2 + 3); // one line or two balanced ones
            if (T.size() > 2) {
                T = Now.wrap(tip, 25);
            }
            dc.setColor(0xFFFFFF, -1);
            F.st(dc, G.timeStr(d), 227, 56, 38, 4, 1, 1.0, 0);
            dc.setColor(0x8A8A96, -1);
            F.px(dc, upc(d.dowStr + " " + d.day + ". " + d.monStr), 227, 84, 2, 1, 0);
            if (!dyn) {
                aura(dc, C, 0.35, 1);
            }
            // side readouts: stress and Body Battery (right), the pulse label (left; the number ticks)
            dc.setColor(0x8A8A96, -1);
            F.px(dc, "PULS", 64, 232, 2, 1, 0);
            F.px(dc, "STRESS", 390, 196, 2, 1, 0);
            F.px(dc, "AKKU", 390, 262, 2, 1, 0);
            var sv = R[5] >= 0 ? "" + R[5] : "--";
            var bv = R[7] >= 0 ? R[7] + "%" : "--";
            dc.setColor(0xFFFFFF, -1);
            F.st(dc, sv, 380, 176, 24, 3, 1, 1.0, 0);
            F.st(dc, bv, 380, 242, 24, 3, 1, 1.0, 0);
            dc.setColor(G.mix(C, 0xFFFFFF, 0.3), -1);
            bits(dc, ARW[1 - Now.trend(R, 1)], 5, 382 + Math.round(F.stW(sv, 24) / 2).toNumber(), 167, 2);
            bits(dc, ARW[1 - Now.trend(R, 2)], 5, 382 + Math.round(F.stW(bv, 24) / 2).toNumber(), 233, 2);
            bits(dc, ARW[1 - Now.trend(R, 0)], 5, 59, 246, 2);
            // headline and tip
            dc.setColor(G.mix(C, 0xFFFFFF, 0.25), -1);
            if (F.stW(head, 20) <= 330) {
                F.st(dc, head, 227, 338, 20, 3, 1, 1.0, 0);
            } else {
                var H = Now.wrap(head, (head.length() + 1) / 2 + 2);
                F.st(dc, H[0], 227, 330, 18, 3, 1, 1.0, 0);
                if (H.size() > 1) {
                    F.st(dc, H[1], 227, 354, 18, 3, 1, 1.0, 0);
                }
            }
            dc.setColor(0xD0D0D8, -1);
            for (var i = 0; i < T.size() && i < 2; i++) {
                F.px(dc, T[i], 227, 360 + i * 20, 2, 1, 0);
            }
        }

        if (!M) {
            return;
        }
        // ---- the aura: grows on the raise; breathes (4 s in, 6 s out) for tense states
        var b = 0.35;
        var lbl = "";
        if (dyn && a.live && a.t >= 1400) {
            var ph = (a.t - 1400) % 10000;
            if (ph < 4000) {
                b = G.easeInOut(ph / 4000.0);
                lbl = "ein";
            } else {
                b = 1 - G.easeInOut((ph - 4000) / 6000.0);
                lbl = "aus";
            }
        } else if (dyn && a.live) {
            b = 0.0;
        }
        if (dyn || p < 1) {
            if (!dyn) {
                dc.setColor(0x000000, -1);
                dc.fillCircle(ACX, ACY, AR + 12);
            }
            aura(dc, C, b, G.ease(p));
            if (dyn) {
                dc.setColor(G.mix(C, 0xFFFFFF, 0.35), -1);
                dc.setPenWidth(2);
                dc.drawCircle(ACX, ACY, Math.round((AR + b * 14) * G.ease(p)).toNumber() + 3);
            }
            if (!lbl.equals("")) {
                dc.setColor(0xFFFFFF, -1);
                F.px(dc, lbl, 227, 290, 3, 1, 0);
            }
        }
        // ---- the heart in the chest, the live pulse number
        var hr = d.hrNow();
        var bt = a.live ? beat(a.t, R[1]) : 0.0;
        var hr2 = 7 + Math.round(bt * 3).toNumber();
        var hh = hr2 / 2;
        dc.setColor(G.mix(C, 0xFF3A4A, 0.6), -1);
        dc.fillCircle(240 - hh, 200, hh + 1);
        dc.fillCircle(240 + hh, 200, hh + 1);
        dc.fillPolygon([[240 - hr2 - 1, 201], [240 + hr2 + 1, 201], [240, 202 + hr2 + 2]]);
        dc.setColor(0xFFFFFF, -1);
        F.st(dc, hr > 0 ? "" + hr : "--", 64, 206, 30, 4, 1, 1.0, 0);
    }

    // static layer: texts, trends, the aura at rest; the slide-in, the live pulse, the heart and the
    // breathing aura move. The tip changes with every raise (d.wakeN) -> part of the key.
    function bgKey(d as D) as Number {
        return (d.doy * 1440 + d.mins) * 4 + (d.wakeN % 4);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        Now.tick(d);
        var R = Now.judge(d);
        if (d.cfg.style == 3) {
            auraStyle(dc, d, a, R, S, M);
        } else {
            kiesel(dc, d, a, R, S, M);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        Now.tick(d);
        var R = Now.judge(d);
        var o = St.shift(d);
        var C = G.dim(Now.COL[R[0]], 0.6);
        var hr = d.hrNow();
        if (d.cfg.style == 3) {
            dc.setColor(G.dim(C, 0.8), -1);
            dc.setPenWidth(2);
            dc.drawCircle(227 + o[0], 200 + o[1], 92);
            dc.setColor(0x7A7A7A, -1);
            F.st(dc, G.timeStr(d), 227 + o[0], 196 + o[1], 44, 3, 1, 1.0, 0);
            dc.setColor(C, -1);
            F.px(dc, upc(Now.SHORT[R[0]]), 227 + o[0], 312 + o[1], 2, 1, 0);
        } else {
            dc.setColor(0x6A6A6A, -1);
            F.px(dc, G.timeStr(d), 227 + o[0], 170 + o[1], 7, 1, 1);
            dc.setColor(C, -1);
            F.px(dc, Now.SHORT[R[0]], 227 + o[0], 250 + o[1], 3, 1, 0);
        }
        dc.setColor(C, -1);
        var s = hr > 0 ? "" + hr : "--";
        var w = 14 + 8 + F.pxW(s, 2);
        bits(dc, HEART, 7, 227 - Math.round(w / 2.0).toNumber() + o[0], 340 + o[1], 2);
        dc.setColor(0x6A6A6A, -1);
        F.px(dc, s, 227 - Math.round(w / 2.0).toNumber() + 22 + o[0], 338 + o[1], 2, 0, 0);
    }
}
