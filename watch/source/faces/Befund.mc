import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// BEFUND — "Befund": a daily report on your body, written by the watch. Three curves – pulse over the
// last two hours, Body Battery and stress over 24 hours (with the 50 line) – each with its current
// value and a finding in plain words ("SINKT, DU KOMMST RUNTER", "LÄDT +8/STD", "3 STD STRESS HEUTE"),
// and at the bottom the conclusion. The header colour follows your state. On every wrist raise the
// curves are plotted. Styles: 1 Monitor, 2 Papier, 3 Akzent. Mirrors web/js/faces/befund.js.
class FaceBefund extends Face {
    const SC = [0x3AE07A, 0x3AB4FF, 0xB48AFF, 0xFF6A4A, 0xFFB02A];
    const X0 = 52;
    const X1 = 402;
    const PY = [100, 176, 252];
    const TITLE = ["PULS 2 STD", "BODY BATTERY 24 STD", "STRESS 24 STD"];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 0;
    }

    function reveal() as Boolean {
        return false;
    }

    hidden function hrFinding(d as D) as String {
        if (d.hr <= 0) {
            return "KEINE PULSDATEN";
        }
        var up = d.rhr > 0 ? d.hr - d.rhr : 0;
        var n = d.hrHist.size();
        var tr = Insight.avg(d.hrHist, n - 10, n) - Insight.avg(d.hrHist, n - 20, n - 10);
        if (up >= 30) {
            return "DEUTLICH ÜBER RUHE (+" + up + ")";
        }
        if (tr >= 8) {
            return "STEIGT (+" + tr + " IN 20 MIN)";
        }
        if (tr <= -8) {
            return "SINKT, DU KOMMST RUNTER";
        }
        if (up <= 8) {
            return "ENTSPANNT, NAHE RUHEPULS";
        }
        return "LEICHT ERHÖHT (+" + up + ")";
    }

    hidden function bbFinding(d as D) as String {
        var r = Insight.bbRate(d);
        if (d.bb < 0) {
            return "KEINE DATEN";
        }
        if (r >= 5) {
            return "LÄDT +" + r + "/STD";
        }
        if (r <= -6) {
            return "ENTLÄDT " + r + "/STD";
        }
        if (d.bb >= 70) {
            return "GUT GEFÜLLT";
        }
        return d.bb < 25 ? "FAST LEER" : "STABIL";
    }

    hidden function stressFinding(d as D) as String {
        var s2 = Insight.stress2h(d);
        if (s2 < 0) {
            return "KEINE DATEN";
        }
        var hi = 0;
        for (var i = 0; i < d.stressHist.size(); i++) {
            if (d.stressHist[i] >= 50) {
                hi++;
            }
        }
        var hrs = Math.round(hi / 2.0).toNumber();
        if (s2 >= 60) {
            return "HOCH SEIT 2 STD (" + s2 + ")";
        }
        if (hrs >= 4) {
            return hrs + " STD STRESS HEUTE";
        }
        return s2 <= 25 ? "RUHIG" : "IM RAHMEN";
    }

    // [bg, panel, ink, dim, grid, curve hr, curve bb, curve stress]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0xF4F1EA, 0xE8E4DA, 0x1A1A22, 0x6A6A72, 0xC8C2B4, 0xC0282A, 0x1A8A4A, 0xD87A1A] as Array<Number>;
        }
        if (st == 3) {
            return [0x000000, 0x0E0E12, 0xFFFFFF, 0x8A8A96, 0x2A2A30, acc, G.mix(acc, 0xFFFFFF, 0.4), G.mix(acc, 0, 0.3)] as Array<Number>;
        }
        return [0x000000, 0x0A1210, 0xE8FFF0, 0x6A8A7A, 0x16302A, 0xFF5A6A, 0x5AFF8A, 0xFFB02A] as Array<Number>;
    }

    // curve of a history inside panel k, values lo..hi, drawn up to fraction f
    hidden function curve(dc as Dc, a as Array<Number>, k as Number, lo as Number, hi as Number, f) as Void {
        var n = a.size();
        if (n < 2) {
            return;
        }
        var y0 = PY[k] + 14;
        var h = 30;
        var m = Math.round(n * f).toNumber();
        if (m < 2) {
            m = 2;
        }
        var span = hi - lo > 1 ? hi - lo : 1;
        var px = -1.0;
        var py = 0.0;
        for (var i = 0; i < m; i++) {
            if (a[i] < 0) {
                continue;
            }
            var x = X0 + 8 + (X1 - X0 - 16) * i / (n - 1.0);
            var y = y0 + h - h * G.clamp((a[i] - lo) / span.toFloat(), 0, 1);
            if (px >= 0) {
                dc.drawLine(px, py, x, y);
            }
            px = x;
            py = y;
        }
    }

    // static layer: report frame, values, findings, conclusion; the curves are plotted on the raise
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var P = pal(d.cfg.style, d.accent);
        var r = Insight.ready(d);
        var stt = Insight.state(d, r[0]);
        var C = SC[stt];
        var p = a.intro;

        if (S) {
            dc.setColor(P[0], -1);
            dc.fillRectangle(0, 0, 454, 454);
            // ---- header in the colour of your state
            dc.setColor(P[2], -1);
            F.st(dc, G.timeStr(d), 227, 36, 36, 5, 1, 1.0, 0);
            dc.setColor(P[3], -1);
            F.px(dc, "BEFUND  " + d.dowStr + " " + d.day + ". " + d.monStr, 227, 62, 1, 1, 0);
            dc.setColor(C, -1);
            dc.fillRectangle(X0, 80, X1 - X0, 4);
            // ---- panels: title, current value, grid, finding
            var s2 = Insight.stress2h(d);
            var val = [d.hr > 0 ? d.hr + " BPM" : "--", d.bb >= 0 ? d.bb + "%" : "--", s2 >= 0 ? "" + s2 : "--"];
            var fnd = [hrFinding(d), bbFinding(d), stressFinding(d)];
            for (var k = 0; k < 3; k++) {
                var y = PY[k];
                dc.setColor(P[1], -1);
                dc.fillRectangle(X0, y - 8, X1 - X0, 74);
                dc.setColor(P[4], -1);
                dc.fillRectangle(X0 + 8, y + 44, X1 - X0 - 16, 1);
                if (k == 2) {
                    for (var x = X0 + 8; x < X1 - 8; x += 8) {
                        dc.fillRectangle(x, y + 29, 4, 1);
                    }
                }
                dc.setColor(P[3], -1);
                F.px(dc, TITLE[k], X0 + 8, y - 2, 1, 0, 0);
                dc.setColor(P[5 + k], -1);
                F.px(dc, val[k] as String, X1 - 8, y - 4, 2, 2, 0);
                dc.setColor(P[2], -1);
                F.px(dc, fnd[k] as String, X0 + 8, y + 48, 2, 0, 0);
            }
            // ---- conclusion (a darker state colour on paper)
            dc.setColor(d.cfg.style == 2 ? G.mix(C, 0, 0.35) : C, -1);
            F.px(dc, "FAZIT: " + Insight.advice(stt), 227, 336, 2, 1, 0);
            dc.setColor(P[3], -1);
            var w = Insight.worst(r);
            F.px(dc, w >= 0 ? Insight.reason(d, w) : "ALLES IM GRÜNEN BEREICH", 227, 358, 2, 1, 0);
            F.px(dc, "FORM " + (r[0] >= 0 ? "" + r[0] : "--") + "  SCHLAF " + (d.sleep >= 0 ? "" + d.sleep : "--")
                + "  SPO2 " + (d.spo2 > 0 ? d.spo2 + "%" : "--"), 227, 382, 1, 1, 0);
        }

        if (!M) {
            return;
        }
        // ---- the curves, plotted on the raise
        var f = G.ease(G.clamp(p / 0.8, 0, 1));
        dc.setPenWidth(2);
        var lo = 999;
        var hi = -1;
        for (var i = 0; i < d.hrHist.size(); i++) {
            var v = d.hrHist[i];
            if (v >= 0) {
                lo = v < lo ? v : lo;
                hi = v > hi ? v : hi;
            }
        }
        dc.setColor(P[5], -1);
        curve(dc, d.hrHist, 0, hi < 0 ? 0 : lo - 4, hi < 0 ? 100 : hi + 4, f);
        dc.setColor(P[6], -1);
        curve(dc, d.bbHist, 1, 0, 100, f);
        dc.setColor(P[7], -1);
        curve(dc, d.stressHist, 2, 0, 100, f);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var r = Insight.ready(d);
        dc.setColor(G.mix(SC[Insight.state(d, r[0])], 0, 0.5), -1);
        dc.fillRectangle(X0 + o[0], 80 + o[1], X1 - X0, 2);
        dc.setColor(0x8A8A8A, -1);
        F.st(dc, G.timeStr(d), 227 + o[0], 36 + o[1], 36, 3, 1, 1.0, 0);
    }
}
