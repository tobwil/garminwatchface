import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// MONO — big monoline digits, a 60-tick step ring and three data slots.
// Styles: 1 Outline, 2 Bold, 3 Stack. Mirrors web/js/faces/mono.js.
class FaceMono extends Face {
    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var cx = 227;
        var cy = 227;

        // tick ring: steps progress, live second marker
        var frac = d.stepGoal > 0 ? d.steps.toFloat() / d.stepGoal : 0.0;
        var lit = (G.clamp(frac, 0.0, 1.0) * 60).toNumber();
        var shown = (G.ease(p) * 60).toNumber();
        dc.setPenWidth(3);
        for (var i = 0; i < shown; i++) {
            var deg = i * 6;
            var big = i % 5 == 0;
            dc.setColor(i < lit ? acc : 0x333333, -1);
            G.tick(dc, cx, cy, big ? 200 : 207, 219, deg);
        }
        if (a.live) {
            var sd = (d.s * 6) + (a.t % 1000) * 0.006;
            dc.setColor(0xFFFFFF, -1);
            dc.setPenWidth(5);
            G.tick(dc, cx, cy, 196, 222, sd);
        }

        // date
        dc.setColor(0xBBBBBB, -1);
        F.st(dc, d.dowStr + " " + d.day + " " + d.monStr, cx, 96, 22, 3, 1, G.ease(p * 1.6), 0);

        // time
        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        var mm = G.pad2(d.m);
        var wp = G.easeInOut(p);
        if (st == 3) {
            dc.setColor(0xFFFFFF, -1);
            F.st(dc, hh, cx, 162, 92, 12, 1, wp, 0);
            dc.setColor(acc, -1);
            F.st(dc, mm, cx, 274, 92, 12, 1, G.easeInOut(p * 1.2 - 0.2), 0);
        } else {
            var pen = st == 2 ? 16 : 7;
            var h = 112;
            var wH = F.stW(hh, h);
            var wAll = F.stW(hh + ":" + mm, h);
            var x0 = cx - wAll / 2;
            dc.setColor(0xFFFFFF, -1);
            F.st(dc, hh, x0, 222, h, pen, 0, wp, 0);
            dc.setColor(acc, -1);
            F.st(dc, ":" + mm, x0 + wH + 22.0 * h / 80.0, 222, h, pen, 0, G.easeInOut(p * 1.2 - 0.2), 0);
        }

        // slots
        var y0 = st == 3 ? 340 : 318;
        for (var k = 0; k < 3; k++) {
            var sl = d.slots[k];
            var x = cx + (k - 1) * 104;
            var sp = G.stag(p, k, 0.12, 0.5);
            if (sp <= 0) {
                continue;
            }
            dc.setColor(G.dim(0x888888, sp), -1);
            F.px(dc, sl[:lbl] as String, x, y0, 2, 1, 0);
            dc.setColor(G.mix(0x000000, d.dcol, sp), -1);
            F.st(dc, sl[:val] as String, x, y0 + 36, 26, 4, 1, 1.0, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        dc.setColor(0x9A9A9A, -1);
        F.st(dc, hh + ":" + G.pad2(d.m), 227 + o[0], 222 + o[1], 112, 3, 1, 1.0, 0);
        dc.setColor(G.dim(d.accent, 0.6), -1);
        F.st(dc, d.dowStr + " " + d.day, 227 + o[0], 96 + o[1], 22, 2, 1, 1.0, 0);
    }
}
