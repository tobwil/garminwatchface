import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// FORM — "Tagesform": how ready you are today, and why. A score ring (0..100) built from Body Battery,
// sleep, stress of the last two hours and recovery time; the four factors sit in the corners with the
// points they add or cost ("+8", "-5"), below the advice and the main reason in plain words. The whole
// colour world follows your state: green when top fit, blue when solid, violet when tired, red when
// exhausted, amber when stressed. On every wrist raise the ring fills and the score counts up.
// Styles: 1 Nacht, 2 Tag, 3 Minimal. Mirrors web/js/faces/form.js.
class FaceForm extends Face {
    const CX = 227;
    const CY = 222;
    const RR = 102;
    const SC = [0x3AE07A, 0x3AB4FF, 0xB48AFF, 0xFF6A4A, 0xFFB02A];
    const FC = [44, 108, 0, 410, 108, 2, 44, 292, 0, 410, 292, 2];
    const FN = ["AKKU", "SCHLAF", "STRESS 2H", "ERHOLUNG"];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 0;
    }

    function reveal() as Boolean {
        return false;
    }

    // [bg top, bg bottom, ink, dim, track, plus, minus]
    hidden function pal(st as Number, c as Number) as Array<Number> {
        if (st == 2) {
            return [0xFFFFFF, G.mix(c, 0xFFFFFF, 0.7), 0x1A1A22, 0x6A6A78, G.mix(c, 0xFFFFFF, 0.75), 0x1A9A4A, 0xD83A2A] as Array<Number>;
        }
        if (st == 3) {
            return [0x000000, 0x000000, 0xFFFFFF, 0x8A8A96, G.mix(c, 0, 0.8), 0x5AFF8A, 0xFF5A4A] as Array<Number>;
        }
        return [0x000000, G.mix(c, 0, 0.72), 0xFFFFFF, G.mix(c, 0xFFFFFF, 0.45), G.mix(c, 0, 0.7), 0x5AFF8A, 0xFF6A5A] as Array<Number>;
    }

    hidden function factorValue(d as D, k as Number) as String {
        if (k == 0) {
            return d.bb >= 0 ? d.bb + "%" : "--";
        }
        if (k == 1) {
            return d.sleep >= 0 ? "" + d.sleep : "--";
        }
        if (k == 2) {
            var s = Insight.stress2h(d);
            return s >= 0 ? "" + s : "--";
        }
        if (d.recov < 0) {
            return "--";
        }
        return d.recov < 60 ? "BEREIT" : Math.round(d.recov / 60.0).toNumber() + " STD";
    }

    // static layer: background, factors, advice, time; the ring and the score count up on the raise
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var r = Insight.ready(d);
        var stt = Insight.state(d, r[0]);
        var C = SC[stt];
        var P = pal(d.cfg.style, C);
        var p = a.intro;

        if (S) {
            for (var i = 0; i < 16; i++) {
                dc.setColor(G.mix(P[0], P[1], i / 15.0), -1);
                dc.fillRectangle(0, i * 29, 454, 29);
            }
            dc.setColor(P[2], -1);
            F.st(dc, G.timeStr(d), 227, 34, 38, 5, 1, 1.0, 0);
            dc.setColor(P[3], -1);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 62, 2, 1, 0);
            // ---- the four factors with the points they add or cost
            for (var k = 0; k < 4; k++) {
                var x = FC[k * 3];
                var y = FC[k * 3 + 1];
                var al = FC[k * 3 + 2];
                dc.setColor(P[3], -1);
                F.px(dc, FN[k], x, y, 1, al, 0);
                dc.setColor(P[2], -1);
                F.px(dc, factorValue(d, k), x, y + 12, 2, al, 0);
                var c = r[k + 1];
                dc.setColor(c > 0 ? P[5] : c < 0 ? P[6] : P[3], -1);
                F.px(dc, (c > 0 ? "+" : "") + c, x, y + 32, 2, al, 0);
            }
            // ---- advice and the main reason
            dc.setColor(C == SC[0] || d.cfg.style != 2 ? C : G.mix(C, 0, 0.3), -1);
            F.px(dc, Insight.advice(stt), 227, 352, 2, 1, 0);
            dc.setColor(P[3], -1);
            var w = Insight.worst(r);
            F.px(dc, w >= 0 ? Insight.reason(d, w) : "ALLES IM GRÜNEN BEREICH", 227, 374, 2, 1, 0);
            dc.setColor(P[4], -1);
            dc.setPenWidth(16);
            G.arcC(dc, CX, CY, RR, -135, 135);
        }

        if (!M) {
            return;
        }
        // ---- the ring fills and the score counts up
        var e = G.ease(G.clamp(p / 0.8, 0, 1));
        var R = r[0] >= 0 ? r[0] : 0;
        dc.setColor(C, -1);
        dc.setPenWidth(16);
        G.arcC(dc, CX, CY, RR, -135, -135 + 270 * (R / 100.0) * e);
        dc.setColor(P[2], -1);
        F.st(dc, r[0] >= 0 ? "" + Math.round(R * e).toNumber() : "--", CX, CY - 6, 64, 9, 1, 1.0, 0);
        dc.setColor(C, -1);
        F.px(dc, Insight.STATE_NAMES[stt], CX, CY + 40, 2, 1, 0);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var r = Insight.ready(d);
        var C = SC[Insight.state(d, r[0])];
        dc.setColor(G.mix(C, 0, 0.55), -1);
        dc.setPenWidth(3);
        G.arcC(dc, CX + o[0], CY + o[1], RR, -135, -135 + 270 * ((r[0] > 0 ? r[0] : 0) / 100.0));
        dc.setColor(0x8A8A8A, -1);
        F.st(dc, G.timeStr(d), CX + o[0], CY - 6 + o[1], 52, 3, 1, 1.0, 0);
    }
}
