import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// BODY — "Körperscan": a pixel anatomy chart of you, live. The heart beats with your heart rate, the
// lungs breathe with your respiration rate, the brain glows from calm blue to stressed red and sparks
// more the higher the stress, the Body Battery sits in the belly as a battery, the legs charge up with
// today's steps and the arms with the week's intensity minutes. Leader lines label it all: stress,
// breathing, Body Battery, steps, sleep, pulse, SpO2, intensity minutes, floors; below a one-word
// verdict and calories / VO2max. On every wrist raise a scanner bar sweeps over the body.
// Styles: 1 Röntgen, 2 Lehrtafel, 3 Gameboy. Mirrors web/js/faces/body.js.
class FaceBody extends Face {
    const X0 = 161;
    const Y0 = 96;
    const C = 6;
    const LB = [148, 98, 2, 209, 114, 148, 158, 2, 197, 180, 148, 214, 2, 209, 226, 148, 284, 2, 203, 300,
        306, 98, 0, 245, 112, 306, 152, 0, 241, 190, 306, 200, 0, 257, 204, 306, 248, 0, 281, 250, 306, 296, 0, 251, 300];
    const NAMES = ["STRESS", "ATMUNG", "BODY BATT", "SCHRITTE", "SCHLAF", "PULS", "SPO2", "AKTIV-MIN", "ETAGEN"];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 12;
    }

    hidden function cx(c as Number) as Number {
        return X0 + c * C;
    }

    hidden function cy(r as Number) as Number {
        return Y0 + r * C;
    }

    hidden function values(d as D) as Array<String> {
        return [
            d.stress >= 0 ? "" + d.stress : "--",
            d.resp > 0 ? d.resp + "/MIN" : "--",
            d.bb >= 0 ? d.bb + "%" : "--",
            G.num(d.steps > 0 ? d.steps : 0),
            d.sleep >= 0 ? "" + d.sleep : "--",
            d.hr > 0 ? d.hr + " BPM" : "--",
            d.spo2 > 0 ? d.spo2 + "%" : "--",
            (d.imWeek > 0 ? d.imWeek : 0) + "/" + (d.imGoal > 0 ? d.imGoal : 150),
            "" + (d.floors > 0 ? d.floors : 0)
        ] as Array<String>;
    }

    hidden function verdict(d as D) as String {
        if (d.stress >= 60) {
            return "GESTRESST";
        }
        if (d.bb >= 0 && d.bb < 25) {
            return "ERSCHÖPFT";
        }
        if (d.sleep >= 0 && d.sleep < 50) {
            return "MÜDE";
        }
        if (d.bb >= 70 && d.stress >= 0 && d.stress < 30) {
            return "TOPFIT";
        }
        if (d.steps >= d.stepGoal && d.stepGoal > 0) {
            return "IN BEWEGUNG";
        }
        return "IM GLEICHGEWICHT";
    }

    // [bg, grid, fill, outline, label, value, leader, heart, heart light, lung, brain calm, brain hot,
    //  battery frame, battery fill, battery empty, legs, arms, scan, time, spark]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0xF0E6D0, 0xE0D4BA, 0xF4C8B0, 0x6A3A2A, 0x6A5A48, 0x2A1A10, 0xA8907A, 0xC0282A, 0xFF6A5A,
                0xD88A8A, 0x5A8AD8, 0xD83A2A, 0x3A2A20, 0x3AA84A, 0xE0D4BA, 0x3A8AD8, 0xE8A03A, acc, 0x2A1A10, 0xFFE03A] as Array<Number>;
        }
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [c, c, e, a, b, a, b, a, e, b, b, a, a, a, e, a, b, a, a, e] as Array<Number>;
        }
        return [0x060C1A, 0x0E1A2E, 0x16304E, 0x6AD8FF, 0x6A8AB0, 0xFFFFFF, 0x2A5A7A, 0xFF3A4A, 0xFF9AA0, 0x4A8AB8,
            0x3A8AFF, 0xFF3A3A, 0x6AD8FF, 0x5AFF8A, 0x16304E, 0x5AFF8A, 0xFFB02A, acc, 0xFFFFFF, 0xFFFFFF] as Array<Number>;
    }

    // static layer: chart, figure, battery, charged legs and arms, labels, texts; heart, lungs, brain
    // sparks and the scanner move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var st = d.cfg.style;
        var P = pal(st, d.accent);
        var p = a.intro;
        var live = a.live;
        var tt = live ? a.t : 0;
        var sv = d.stress >= 0 ? G.clamp(d.stress / 100.0, 0, 1) : 0.3;

        if (S) {
            // ---- chart background with a fine grid
            dc.setColor(P[0], -1);
            dc.fillRectangle(0, 0, 454, 454);
            dc.setColor(P[1], -1);
            for (var x = 11; x < 454; x += 24) {
                dc.fillRectangle(x, 0, 1, 454);
            }
            for (var y = 8; y < 454; y += 24) {
                dc.fillRectangle(0, y, 454, 1);
            }

            // ---- the figure
            Spr.draw(dc, SprBody.FIGURE, X0, Y0, C, [-1, P[2], P[3]], false);
            // brain tinted by stress
            dc.setColor(G.mix(P[10], P[11], sv), -1);
            dc.fillRectangle(cx(8), cy(1), 6 * C, 2 * C);
            dc.fillRectangle(cx(9), cy(3), 4 * C, C);
            // legs charged by today's steps (from the feet up), arms by the week's intensity minutes
            var sg = d.stepGoal > 0 ? d.stepGoal : 10000;
            var nl = Math.round(G.clamp((d.steps > 0 ? d.steps : 0) / sg.toFloat(), 0, 1) * 14).toNumber();
            dc.setColor(P[15], -1);
            if (nl > 0) {
                dc.fillRectangle(cx(7), cy(42 - nl), 2 * C, nl * C);
                dc.fillRectangle(cx(13), cy(42 - nl), 2 * C, nl * C);
            }
            var ig = d.imGoal > 0 ? d.imGoal : 150;
            var na = Math.round(G.clamp((d.imWeek > 0 ? d.imWeek : 0) / ig.toFloat(), 0, 1) * 15).toNumber();
            dc.setColor(P[16], -1);
            if (na > 0) {
                dc.fillRectangle(cx(1), cy(28 - na), 2 * C, na * C);
                dc.fillRectangle(cx(19), cy(28 - na), 2 * C, na * C);
            }
            // Body Battery in the belly
            dc.setColor(P[12], -1);
            dc.fillRectangle(cx(8), cy(19), 6 * C, 5 * C);
            dc.fillRectangle(cx(10), cy(18) + 2, 2 * C, C - 2);
            dc.setColor(P[14], -1);
            dc.fillRectangle(cx(8) + 3, cy(19) + 3, 6 * C - 6, 5 * C - 6);
            var fb = d.bb >= 0 ? G.clamp(d.bb / 100.0, 0, 1) : 0;
            var bh = Math.round(fb * (5 * C - 6)).toNumber();
            dc.setColor(d.bb >= 0 && d.bb < 25 ? P[11] : P[13], -1);
            dc.fillRectangle(cx(8) + 3, cy(24) - 3 - bh, 6 * C - 6, bh);

            // ---- labels with leader lines
            var V = values(d);
            for (var i = 0; i < 9; i++) {
                var x = LB[i * 5];
                var y = LB[i * 5 + 1];
                var al = LB[i * 5 + 2];
                var tx = LB[i * 5 + 3];
                var ty = LB[i * 5 + 4];
                if (G.stag(p, i, 0.05, 0.4) <= 0) {
                    continue;
                }
                dc.setColor(P[4], -1);
                F.px(dc, NAMES[i], x, y, 1, al, 0);
                dc.setColor(P[5], -1);
                F.px(dc, V[i], x, y + 10, 2, al, 0);
                // dotted leader from the label to the organ
                var sx = al == 2 ? x + 4 : x - 4;
                var sy = y + 16;
                var ax = (tx - sx).abs();
                var ay = (ty - sy).abs();
                var n = Math.round((ax > ay ? ax : ay) / 6.0).toNumber();
                if (n < 1) {
                    n = 1;
                }
                dc.setColor(P[6], -1);
                for (var k = 0; k <= n; k++) {
                    dc.fillRectangle(Math.round(sx + (tx - sx) * k / n.toFloat()).toNumber() - 1, Math.round(sy + (ty - sy) * k / n.toFloat()).toNumber() - 1, 2, 2);
                }
            }

            // ---- time, verdict, calories / VO2max
            dc.setColor(P[18], -1);
            F.px(dc, G.timeStr(d), 227, 18, 5, 1, 0);
            dc.setColor(P[4], -1);
            F.px(dc, "SCAN  " + d.dowStr + " " + d.day + ". " + d.monStr, 227, 62, 1, 1, 0);
            dc.setColor(st == 2 ? 0x1A5A8A : P[17], -1);
            F.px(dc, verdict(d), 227, 370, 2, 1, 0);
            dc.setColor(P[4], -1);
            var vo = d.vo2r > d.vo2b ? d.vo2r : d.vo2b;
            F.px(dc, G.num(d.kcal > 0 ? d.kcal : 0) + " KCAL" + (vo > 0 ? "  VO2 " + vo : ""), 227, 392, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        // ---- lungs breathe with the respiration rate
        var br = d.resp > 0 ? 60000 / d.resp : 4000;
        var bf = live ? 0.5 - 0.5 * Math.cos((tt % br) / br.toFloat() * 2 * Math.PI) : 0.5;
        var lw = Math.round(bf * C).toNumber();
        dc.setColor(P[9], -1);
        dc.fillRectangle(cx(7) - lw, cy(12) + 3, 2 * C + lw, 5 * C);
        dc.fillRectangle(cx(8) - lw, cy(11) + 3, C + lw, C);
        dc.fillRectangle(cx(13), cy(12) + 3, 2 * C + lw, 5 * C);
        dc.fillRectangle(cx(13), cy(11) + 3, C + lw, C);
        // ---- the heart beats with the heart rate
        var beat = d.hr > 0 ? 60000 / d.hr : 1000;
        var hs = !live || (tt % beat) < beat / 4 ? 1 : 0;
        dc.setColor(P[7], -1);
        dc.fillRectangle(cx(10) + 3 - hs * 3, cy(14) - hs * 3, 2 * C + hs * 6, 2 * C + hs * 3);
        dc.fillRectangle(cx(10) + 6, cy(16), C, C + hs * 3);
        dc.setColor(P[8], -1);
        dc.fillRectangle(cx(10) + 5, cy(14) + 2, 4, 4);
        // ---- brain sparks: more with more stress
        var ns = 1 + Math.round(sv * 6).toNumber();
        dc.setColor(P[19], -1);
        for (var i = 0; i < ns; i++) {
            var s = G.rnd(i * 37 + tt / 160);
            if (live && s % 3 == 0) {
                continue;
            }
            dc.fillRectangle(cx(8) + (s % 34), cy(1) + ((s >> 4) % 14), 2, 2);
        }
        // ---- scanner bar on every raise
        if (p < 1) {
            var y = Y0 - 10 + Math.round(G.easeInOut(p) * 290).toNumber();
            dc.setColor(P[17], -1);
            dc.fillRectangle(120, y, 214, 2);
            dc.setColor(G.mix(P[0], P[17], 0.4), -1);
            dc.fillRectangle(120, y - 6, 214, 4);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        Spr.draw(dc, SprBody.FIGURE, X0 + o[0], Y0 + o[1], C, [-1, -1, st == 3 ? 0x306230 : 0x2A4A6A], false);
        if (d.hr > 0) {
            dc.setColor(G.dim(0xFF3A4A, 0.5), -1);
            dc.fillRectangle(cx(10) + 3 + o[0], cy(14) + o[1], 2 * C, 2 * C);
        }
        dc.setColor(st == 3 ? 0x8BAC0F : 0x8A8A9A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 18 + o[1], 5, 1, 1);
    }
}
