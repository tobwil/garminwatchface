import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// WOCHE — "Wochenbilanz": the current ISO week (Mon–Sun) at a glance. A 7-column grid with
// training-day checks and per-day steps / floors / active minutes, a segmented outer ring for
// training days vs. the weekly goal, a summary line and three small data slots.
// Styles: 1 Heatmap, 2 Balken, 3 Pixel. Mirrors web/js/faces/woche.js.
class FaceWoche extends Face {
    const DL = ["M", "D", "M", "D", "F", "S", "S"];
    // 7x7 pixel icons (bit 6 = left): shoe, stairs, bolt, check, avg sign
    const ICO = [
        0x60, 0x60, 0x70, 0x78, 0x7F, 0x7F, 0x2A,
        0x03, 0x03, 0x0F, 0x0F, 0x3F, 0x3F, 0x7F,
        0x0E, 0x1C, 0x38, 0x7E, 0x0C, 0x18, 0x30,
        0x01, 0x03, 0x46, 0x6C, 0x38, 0x10, 0x00,
        0x02, 0x1C, 0x26, 0x2A, 0x32, 0x1C, 0x20
    ];
    const RY = [218, 248, 278];
    const CY = 202;
    const BASE = 306;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 6;
    }

    hidden function colX(i) {
        return 107 + i * 40;
    }

    hidden function icon(dc as Dc, k, x, y, sc) as Void {
        for (var r = 0; r < 7; r++) {
            var b = ICO[k * 7 + r];
            if (b == 0) {
                continue;
            }
            for (var c = 0; c < 7; c++) {
                if ((b & (64 >> c)) != 0) {
                    dc.fillRectangle(x + c * sc, y + r * sc, sc, sc);
                }
            }
        }
    }

    hidden function actGoal(d as D) as Number {
        var g = Math.round(d.imGoal / 5.0).toNumber();
        return g > 0 ? g : 30;
    }

    // fraction of the daily goal for metric k on day i (-1 = future / unknown)
    hidden function frac(d as D, k, i) {
        var v = k == 0 ? d.wkSteps[i] : (k == 1 ? d.wkFloors[i] : d.wkAct[i]);
        if (v == null || v < 0) {
            return -1.0;
        }
        var g = k == 0 ? (d.stepGoal > 0 ? d.stepGoal : 10000) : (k == 1 ? (d.floorsGoal > 0 ? d.floorsGoal : 10) : actGoal(d));
        return v.toFloat() / g;
    }

    // [avg steps, sum floors, sum active minutes, days with data]
    hidden function totals(d as D) as Array<Number> {
        var s = 0;
        var f = 0;
        var a = 0;
        var n = 0;
        for (var i = 0; i < 7; i++) {
            if (i > d.dayIdx || d.wkSteps[i] < 0) {
                continue;
            }
            s += d.wkSteps[i];
            if (d.wkFloors[i] > 0) {
                f += d.wkFloors[i];
            }
            if (d.wkAct[i] > 0) {
                a += d.wkAct[i];
            }
            n++;
        }
        return [n > 0 ? Math.round(s.toFloat() / n).toNumber() : 0, f, a, n] as Array<Number>;
    }

    // static layer: the whole week; only the frame of today pulses
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var live = a.live && p >= 1;
        var px = st == 3;
        var ti = d.dayIdx;
        var dark = st == 3 ? 0x1C1C26 : 0x1A221E;
        var goal = d.dayGoal > 0 ? d.dayGoal : 4;
        var td = d.trainDays > 0 ? d.trainDays : 0;
        var pulse = live ? 0.5 + 0.5 * Math.sin(a.t / 1000.0 * 3.1416) : 1.0;
        if (a.bg) {
            // over the cached week only the frame of today pulses
            var tx = colX(ti);
            dc.setColor(G.mix(dark, acc, 0.3 + 0.35 * pulse), -1);
            if (px) {
                dc.fillRectangle(tx - 18, 172, 36, 2);
                dc.fillRectangle(tx - 18, 310, 36, 2);
                dc.fillRectangle(tx - 20, 174, 2, 136);
                dc.fillRectangle(tx + 18, 174, 2, 136);
            } else {
                dc.setPenWidth(2);
                dc.drawRoundedRectangle(tx - 19, 172, 38, 140, 10);
            }
            return;
        }

        // ---------------- outer ring: training days vs goal
        if (px) {
            var n = 56;
            for (var j = 0; j < n; j++) {
                var sg = j * goal / n;
                if ((j + 1) * goal / n != sg && j < n - 1) {
                    continue;
                }
                var on = sg < td;
                var sp = G.stag(p, sg, 0.1, 0.3);
                var lit = on && (j - sg * n / goal) < sp * (n.toFloat() / goal);
                dc.setColor(lit ? acc : 0x262634, -1);
                var ang = (j + 0.5) * (360.0 / n);
                var x = Math.round(G.ptX(227, 210, ang) / 2.0).toNumber() * 2;
                var y = Math.round(G.ptY(227, 210, ang) / 2.0).toNumber() * 2;
                dc.fillRectangle(x - 4, y - 4, 8, 8);
            }
        } else {
            var sw = 360.0 / goal;
            dc.setPenWidth(8);
            for (var i = 0; i < goal; i++) {
                var a0 = i * sw + 2;
                var a1 = (i + 1) * sw - 2;
                dc.setColor(0x222A26, -1);
                G.arcC(dc, 227, 227, 214, a0, a1);
                if (i < td) {
                    var sp = G.ease(G.stag(p, i, 0.1, 0.3));
                    if (sp > 0) {
                        dc.setColor(acc, -1);
                        G.arcC(dc, 227, 227, 214, a0, a0 + (a1 - a0) * sp);
                    }
                }
            }
        }

        // ---------------- date, time, training label
        var ds = d.dowStr + " " + d.day + ". " + d.monStr + "  KW " + d.wk;
        dc.setColor(0x9A9A9A, -1);
        F.px(dc, ds, 227, 54, 2, 1, 0);
        var ts = G.timeStr(d);
        if (px) {
            dc.setColor(G.dim(acc, 0.35), -1);
            F.px(dc, ts, 231, 80, 9, 1, 0);
            dc.setColor(0xFFFFFF, -1);
            F.px(dc, ts, 227, 76, 9, 1, 0);
        } else {
            dc.setColor(0xFFFFFF, -1);
            F.st(dc, ts, 227, 110, 60, st == 2 ? 5 : 6, 1, G.easeInOut(p * 1.6), 0);
        }
        var tl = td + "/" + goal + " TRAININGSTAGE";
        dc.setColor(td >= goal ? acc : 0xC8C8C8, -1);
        F.px(dc, tl, 227, 152, 2, 1, 0);

        // ---------------- today column frame (pulses)
        var tx = colX(ti);
        var fc = G.mix(dark, acc, 0.3 + 0.35 * pulse);
        if (px) {
            dc.setColor(fc, -1);
            dc.fillRectangle(tx - 18, 172, 36, 2);
            dc.fillRectangle(tx - 18, 310, 36, 2);
            dc.fillRectangle(tx - 20, 174, 2, 136);
            dc.fillRectangle(tx + 18, 174, 2, 136);
        } else {
            dc.setColor(G.mix(0x000000, acc, 0.1 + 0.06 * pulse), -1);
            dc.fillRoundedRectangle(tx - 19, 172, 38, 140, 10);
            dc.setColor(fc, -1);
            dc.setPenWidth(2);
            dc.drawRoundedRectangle(tx - 19, 172, 38, 140, 10);
        }

        // ---------------- day labels + checks
        for (var i = 0; i < 7; i++) {
            var x = colX(i);
            var fut = i > ti;
            dc.setColor(i == ti ? 0xFFFFFF : (fut ? 0x5A5A5A : 0x9A9A9A), -1);
            if (px || st == 1) {
                F.px(dc, DL[i], x, 178, 2, 1, 0);
            } else {
                F.st(dc, DL[i], x, 185, 16, 2, 1, 1.0, 0);
            }
            var tr = ((d.trainMask >> i) & 1) == 1;
            var pp = G.spring(G.stag(p, 1, 0.3 + i * 0.06, 0.25));
            if (tr) {
                if (pp <= 0) {
                    continue;
                }
                dc.setColor(acc, -1);
                if (px) {
                    var s = Math.round(3 * pp).toNumber();
                    if (s < 1) {
                        s = 1;
                    }
                    icon(dc, 3, x - 3.5 * s, CY - 3.5 * s, s);
                } else {
                    dc.fillCircle(x, CY, 9 * pp);
                    if (pp > 0.6) {
                        dc.setColor(0x000000, -1);
                        dc.setPenWidth(3);
                        dc.drawLine(x - 5, CY, x - 1, CY + 4);
                        dc.drawLine(x - 1, CY + 4, x + 5, CY - 4);
                    }
                }
            } else if (fut) {
                dc.setColor(0x3A3A3A, -1);
                if (px) {
                    dc.fillRectangle(x - 2, CY - 2, 4, 4);
                } else {
                    dc.fillCircle(x, CY, 2);
                }
            } else {
                dc.setColor(i == ti ? G.dim(acc, 0.6) : 0x444444, -1);
                if (px) {
                    dc.fillRectangle(x - 6, CY - 6, 12, 2);
                    dc.fillRectangle(x - 6, CY + 4, 12, 2);
                    dc.fillRectangle(x - 6, CY - 4, 2, 8);
                    dc.fillRectangle(x + 4, CY - 4, 2, 8);
                } else {
                    dc.setPenWidth(2);
                    dc.drawCircle(x, CY, 8);
                }
            }
        }

        // ---------------- data area
        var tone = [acc, G.mix(acc, 0xFFFFFF, 0.55), G.dim(acc, 0.6)];
        for (var i = 0; i < 7; i++) {
            var x = colX(i);
            var cp = G.easeInOut(G.stag(p, i, 0.07, 0.35));
            for (var k = 0; k < 3; k++) {
                var f = frac(d, k, i);
                if (st == 1) {
                    var y = RY[k];
                    if (f < 0) {
                        dc.setColor(0x262626, -1);
                        dc.setPenWidth(1);
                        dc.drawRoundedRectangle(x - 15, y, 30, 26, 6);
                        continue;
                    }
                    var lv = f >= 1 ? 4 : (f <= 0 ? 0 : 1 + Math.floor(G.clamp(f, 0.0, 0.999) * 3).toNumber());
                    var lvp = Math.floor(lv * cp + 0.001).toNumber();
                    dc.setColor(lvp == 0 ? 0x1C2420 : G.mix(0x1C2420, acc, lvp / 4.0), -1);
                    dc.fillRoundedRectangle(x - 15, y, 30, 26, 6);
                    if (f >= 1 && cp >= 1) {
                        dc.setColor(0xFFFFFF, -1);
                        dc.fillCircle(x + 9, y + 6, 2);
                    }
                } else {
                    var bx = x - 14 + k * 10;
                    if (f < 0) {
                        dc.setColor(0x333333, -1);
                        dc.fillRectangle(bx + 2, BASE - 2, 4, 2);
                        continue;
                    }
                    var fe = G.clamp(f, 0.0, 1.25) * cp;
                    if (st == 2) {
                        var h = Math.round(fe * 64).toNumber();
                        dc.setColor(tone[k], -1);
                        if (h >= 3) {
                            dc.fillRoundedRectangle(bx, BASE - h, 8, h, 3);
                        } else {
                            dc.fillRectangle(bx, BASE - 2, 8, 2);
                        }
                    } else {
                        var nb = Math.round(fe * 8).toNumber();
                        for (var b = 0; b < nb; b++) {
                            dc.setColor(b >= 8 ? 0xFFFFFF : tone[k], -1);
                            dc.fillRectangle(bx, BASE - 6 - b * 8, 8, 6);
                        }
                        if (nb == 0) {
                            dc.setColor(tone[k], -1);
                            dc.fillRectangle(bx, BASE - 2, 8, 2);
                        }
                    }
                }
            }
        }
        if (st == 1) {
            // row icons
            dc.setColor(0x8A8A8A, -1);
            for (var k = 0; k < 3; k++) {
                icon(dc, k, 64, RY[k] + 6, 2);
            }
        } else {
            // goal line (100 %) + baseline
            var gy = BASE - 65;
            dc.setColor(0x4A4A4A, -1);
            for (var x = 84; x < 368; x += 8) {
                dc.fillRectangle(x, gy, 4, 2);
            }
            dc.setColor(0x6A6A6A, -1);
            F.px(dc, "ZIEL", 78, gy - 6, 2, 2, 0);
            dc.setColor(0x3A3A3A, -1);
            dc.fillRectangle(82, BASE + 2, 290, 2);
        }

        // ---------------- summary line: avg steps, floors, active minutes vs goal
        var T = totals(d);
        var s1 = G.num(T[0]);
        var s2 = "" + T[1];
        var s3 = T[2] + "/" + d.imGoal;
        var w = 30 + F.pxW(s1, 2) + 36 + F.pxW(s2, 2) + 36 + F.pxW(s3, 2);
        var x = Math.round(227 - w / 2.0).toNumber();
        var sy = 320;
        dc.setColor(st == 1 ? acc : tone[0], -1);
        icon(dc, 0, x, sy, 2);
        x += 18;
        dc.setColor(0xD8D8D8, -1);
        icon(dc, 4, x, sy, 2);
        x += 12;
        F.px(dc, s1, x, sy, 2, 0, 0);
        x += F.pxW(s1, 2) + 18;
        dc.setColor(st == 1 ? acc : tone[1], -1);
        icon(dc, 1, x, sy, 2);
        x += 18;
        dc.setColor(0xD8D8D8, -1);
        F.px(dc, s2, x, sy, 2, 0, 0);
        x += F.pxW(s2, 2) + 18;
        dc.setColor(st == 1 ? acc : tone[2], -1);
        icon(dc, 2, x, sy, 2);
        x += 18;
        dc.setColor(T[2] >= d.imGoal ? acc : 0xD8D8D8, -1);
        F.px(dc, s3, x, sy, 2, 0, 0);

        // ---------------- slots
        for (var k = 0; k < 3; k++) {
            var sl = d.slots[k];
            var sx = 227 + (k - 1) * 96;
            var sp = G.stag(p, k, 0.1, 0.5);
            if (sp <= 0) {
                continue;
            }
            dc.setColor(G.dim(0x888888, sp), -1);
            F.px(dc, sl[:lbl] as String, sx, 346, 2, 1, 0);
            dc.setColor(G.mix(0x000000, d.dcol, sp), -1);
            if (px) {
                F.px(dc, sl[:val] as String, sx, 366, 3, 1, 0);
            } else {
                F.st(dc, sl[:val] as String, sx, 376, 20, 3, 1, 1.0, 0);
            }
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var cx = 227 + o[0];
        var cy = o[1];
        var px = d.cfg.style == 3;
        var ts = G.timeStr(d);
        dc.setColor(0x9A9A9A, -1);
        if (px) {
            F.px(dc, ts, cx, 150 + cy, 9, 1, 2);
        } else {
            F.st(dc, ts, cx, 186 + cy, 72, 3, 1, 1.0, 0);
        }
        var goal = d.dayGoal > 0 ? d.dayGoal : 4;
        dc.setColor(G.dim(d.accent, 0.6), -1);
        F.px(dc, (d.trainDays > 0 ? d.trainDays : 0) + "/" + goal, cx, 246 + cy, 2, 1, 0);
        for (var i = 0; i < 7; i++) {
            var x = cx + (i - 3) * 26;
            var y = 286 + cy;
            var tr = ((d.trainMask >> i) & 1) == 1;
            if (tr) {
                dc.setColor(G.dim(d.accent, 0.7), -1);
                dc.fillCircle(x, y, 5);
            } else if (i <= d.dayIdx) {
                dc.setColor(0x5A5A5A, -1);
                dc.setPenWidth(1);
                dc.drawCircle(x, y, 5);
            } else {
                dc.setColor(0x3A3A3A, -1);
                dc.fillCircle(x, y, 1);
            }
            dc.setColor(i == d.dayIdx ? 0x9A9A9A : 0x4A4A4A, -1);
            F.px(dc, DL[i], x, y + 12, 2, 1, 0);
        }
    }
}
