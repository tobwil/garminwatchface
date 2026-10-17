import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// FIREWORK — "Feuerwerk": the time written in sparks over a dark skyline, made for AMOLED. On every
// wrist raise one rocket per digit climbs from the rooftops, bursts, and its sparks fly out and then
// fall into place as the dots of the digit. While awake the dots twinkle and small fireworks go off
// in the sky; once the step goal is reached it is the grand finale (more and bigger bursts).
// Styles: 1 Silvester (every digit its own colour), 2 Gold, 3 Akzent.
// Mirrors web/js/faces/fireworks.js.
class FaceFireworks extends Face {
    const DIG = [[14, 17, 19, 21, 25, 17, 14], [4, 12, 4, 4, 4, 4, 14], [14, 17, 1, 2, 4, 8, 31], [31, 2, 4, 2, 1, 17, 14],
        [2, 6, 10, 18, 31, 2, 2], [31, 16, 30, 1, 1, 17, 14], [6, 8, 16, 30, 17, 17, 14], [31, 1, 2, 4, 8, 8, 8],
        [14, 17, 17, 14, 17, 17, 14], [14, 17, 17, 15, 1, 2, 12]];
    const C = 14;
    const Y0 = 108;
    const SKY = 330;
    const GLOW = 0.72;
    const BLD = [0, 360, 34, 340, 70, 372, 96, 326, 128, 350, 160, 332, 196, 364, 226, 318, 262, 346, 296, 336, 330, 358, 368, 330, 404, 352, 440, 344];

    // dots of the current time (x, y, digit index; -1 = colon) and the burst point of every digit
    hidden var _ts = "";
    hidden var _dx = [] as Array<Number>;
    hidden var _dy = [] as Array<Number>;
    hidden var _dk = [] as Array<Number>;
    hidden var _bx = [] as Array<Number>;
    hidden var _by = [] as Array<Number>;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 12;
    }

    function reveal() as Boolean {
        return false;
    }

    hidden function layout(ts as String) as Void {
        if (ts.equals(_ts)) {
            return;
        }
        _ts = ts;
        _dx = [] as Array<Number>;
        _dy = [] as Array<Number>;
        _dk = [] as Array<Number>;
        _bx = [] as Array<Number>;
        _by = [] as Array<Number>;
        var cs = ts.toCharArray();
        var W = 0;
        for (var i = 0; i < cs.size(); i++) {
            W += cs[i] == ':' ? 2 * C : 6 * C;
        }
        var x = 227 - (W - C) / 2;
        var k = 0;
        for (var i = 0; i < cs.size(); i++) {
            if (cs[i] == ':') {
                _dx.add(x);
                _dy.add(Y0 + 2 * C);
                _dk.add(-1);
                _dx.add(x);
                _dy.add(Y0 + 4 * C);
                _dk.add(-1);
                x += 2 * C;
                continue;
            }
            var g = DIG[cs[i].toNumber() - 48] as Array<Number>;
            for (var r = 0; r < 7; r++) {
                for (var c = 0; c < 5; c++) {
                    if ((g[r] & (16 >> c)) != 0) {
                        _dx.add(x + c * C);
                        _dy.add(Y0 + r * C);
                        _dk.add(k);
                    }
                }
            }
            _bx.add(x + 2 * C + 6);
            _by.add(Y0 + 3 * C + 6);
            x += 6 * C;
            k++;
        }
    }

    // [spark colours per digit (4), colon, (unused), skyline, window, star, text]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0xFFD25A, 0xFFF2B0, 0xFFB02A, 0xFFE08A, 0xFFFFFF, 0, 0x0A0A10, 0xFFB84A, 0x8A8A9A, 0xFFD25A] as Array<Number>;
        }
        if (st == 3) {
            return [acc, G.mix(acc, 0xFFFFFF, 0.3), acc, G.mix(acc, 0xFFFFFF, 0.3), 0xFFFFFF, 0, 0x0A0A10, G.mix(acc, 0xFFD25A, 0.5), 0x8A8A9A, acc] as Array<Number>;
        }
        return [0xFFD25A, 0xFF3A8A, 0x3AE0FF, 0x7AFF5A, 0xFFFFFF, 0, 0x0A0A10, 0xFFB84A, 0x8A8A9A, 0xFFD25A] as Array<Number>;
    }

    // static layer: sky, stars, skyline, date, steps; the rockets, sparks, digit dots and bursts move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var P = pal(d.cfg.style, d.accent);
        var p = a.intro;
        var live = a.live;
        var tt = live ? a.t : 0;
        var finale = d.steps >= d.stepGoal && d.stepGoal > 0;

        if (S) {
            dc.setColor(0x000000, -1);
            dc.fillRectangle(0, 0, 454, 454);
            dc.setColor(G.mix(P[8], 0, 0.5), -1);
            for (var i = 0; i < 30; i++) {
                dc.fillRectangle(30 + ((i * 101 + 17) % 394), 20 + ((i * 47 + 11) % 290), 2, 2);
            }
            // skyline with a few lit windows
            dc.setColor(P[6], -1);
            for (var i = 0; i < BLD.size(); i += 2) {
                dc.fillRectangle(BLD[i], BLD[i + 1], 38, 454 - BLD[i + 1]);
            }
            dc.setColor(P[7], -1);
            for (var i = 0; i < BLD.size(); i += 2) {
                for (var w = 0; w < 6; w++) {
                    if (G.rnd(i * 31 + w * 7 + d.day) % 4 != 0) {
                        continue;
                    }
                    dc.fillRectangle(BLD[i] + 6 + (w % 2) * 16, BLD[i + 1] + 10 + (w / 2) * 18, 6, 8);
                }
            }
            dc.setColor(P[9], -1);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 70, 2, 1, 0);
            var sg = d.stepGoal > 0 ? d.stepGoal : 10000;
            F.px(dc, finale ? "FINALE! " + G.num(d.steps) + " SCHRITTE" : G.num(d.steps > 0 ? d.steps : 0) + " / " + G.num(sg), 227, 230, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        layout(G.timeStr(d));
        // ---- rockets climb from the roofs, burst, the sparks fly out and settle into the digits
        var q = G.clamp((p - 0.3) / 0.5, 0, 1);
        if (p < 0.3) {
            for (var k = 0; k < _bx.size(); k++) {
                var bx = _bx[k];
                var y = Math.round(G.lerp(SKY, _by[k], G.ease(G.clamp((p - k * 0.03) / 0.27, 0, 1)))).toNumber();
                dc.setColor(P[k % 4], -1);
                dc.fillRectangle(bx - 2, y, 4, 6);
                dc.setColor(G.mix(P[k % 4], 0, 0.6), -1);
                for (var i = 1; i < 5; i++) {
                    dc.fillRectangle(bx - 1 + ((i + a.t / 50) % 2), y + i * 8, 2, 4);
                }
            }
            return;
        }
        var tw = live ? tt / 120 : 0;
        var e = G.easeInOut(q);
        var sq = Math.sin(q * Math.PI);
        for (var i = 0; i < _dx.size(); i++) {
            var k = _dk[i];
            var x = _dx[i];
            var y = _dy[i];
            var col = k < 0 ? P[4] : P[k % 4];
            if (q < 1) {
                var kb = k < 0 ? 1 : k;
                var ang = (G.rnd(i * 17 + 3) % 360) * Math.PI / 180;
                var out = sq * (40 + (G.rnd(i * 5 + 1) % 50));
                x = Math.round(G.lerp(_bx[kb], x, e) + Math.cos(ang) * out).toNumber();
                y = Math.round(G.lerp(_by[kb], y, e) + Math.sin(ang) * out).toNumber();
            }
            var hot = q < 0.6 || (live && G.rnd(i * 13 + tw) % 23 == 0);
            dc.setColor(G.mix(col, 0x000000, GLOW), -1);
            dc.fillRectangle(x - 1, y - 1, 14, 14);
            dc.setColor(hot ? 0xFFFFFF : col, -1);
            dc.fillRectangle(x + 2, y + 2, 8, 8);
        }
        // ---- small fireworks in the sky while awake (bigger and more at the finale)
        if (live && p >= 1) {
            var per = finale ? 1300 : 2400;
            var n = finale ? 2 : 1;
            for (var b = 0; b < n; b++) {
                var kk = (tt + b * 650) / per;
                var age = ((tt + b * 650) % per) / per.toFloat();
                var cx = 90 + (G.rnd(kk * 7 + b) % 274);
                var cy = 276 + (G.rnd(kk * 5 + b) % 20);
                var col = P[G.rnd(kk * 13 + b) % 4];
                var R = (finale ? 56 : 38) * G.ease(age);
                dc.setColor(G.mix(col, 0x000000, age * 0.9), -1);
                for (var i = 0; i < 14; i++) {
                    var an = i * 2 * Math.PI / 14;
                    dc.fillRectangle(Math.round(cx + Math.cos(an) * R).toNumber(), Math.round(cy + Math.sin(an) * R + age * age * 26).toNumber(), 4, 4);
                }
            }
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        layout(G.timeStr(d));
        dc.setColor(0x6A5A2A, -1);
        for (var i = 0; i < _dx.size(); i++) {
            dc.fillRectangle(_dx[i] + 4 + o[0], _dy[i] + 4 + o[1], 4, 4);
        }
    }
}
