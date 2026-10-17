import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// HUD — "Power HUD": Zwift-inspired training HUD. Rounded panels, bold italic numbers,
// FTP / W/kg / category, the 6 power zones in watts and a workout of the day picked from
// Body Battery, sleep, recovery and stress. Tap cycles 3 pages (overview, zones, workout).
// Styles: 1 Watopia, 2 Carbon, 3 Neon. Mirrors web/js/faces/hud.js.
class FaceHud extends Face {
    const SL = 0.18;
    const ZC = [0x7F7F7F, 0x338CFF, 0x59BF59, 0xFFCC3F, 0xFF6639, 0xFF330C];
    const ZP = [0, 60, 76, 90, 105, 119];
    const ZN = ["ERHOLUNG", "AUSDAUER", "TEMPO", "SCHWELLE", "VO2MAX", "ANAEROB"];
    const HZ = [0x9A9A9A, 0x338CFF, 0x59BF59, 0xFF9F1A, 0xFF330C];
    const CATC = [0xE8322B, 0x4FBF4F, 0x2FA8E8, 0xFFC83C];
    const WN = ["VO2MAX", "SWEET SPOT", "TEMPO", "GRUNDLAGE", "ERHOLUNG"];
    const WS = ["5X4'", "3X12'", "2X20'", "60'", "30'"];
    const WR = [5, 3, 2, 1, 1];
    const WON = [4, 12, 20, 60, 30];
    const WP = [115, 90, 80, 65, 50];
    const WOFF = [3, 4, 5, 0, 0];

    hidden var _pg = 0;

    function initialize() {
        Face.initialize();
        _pg = St.get("hudPage", 0);
    }

    function fps() as Number {
        return 10;
    }

    // tap cycles the pages: 0 overview, 1 zone table, 2 workout detail
    function tap(x as Number, y as Number, d as D) as Boolean {
        _pg = (_pg + 1) % 3;
        St.set("hudPage", _pg);
        return true;
    }

    hidden function rn(v) as Number {
        return Math.round(v).toNumber();
    }

    // power zone index of a % FTP value
    hidden function zoneOf(pct) as Number {
        var i = 5;
        while (i > 0 && pct < ZP[i]) {
            i--;
        }
        return i;
    }

    // readiness 0..100 from bb, sleep, recovery time and stress (missing inputs ignored)
    hidden function readiness(d as D) as Number {
        var sum = 0.0;
        var n = 0;
        if (d.bb >= 0) { sum += d.bb; n++; }
        if (d.sleep >= 0) { sum += d.sleep; n++; }
        if (d.recov >= 0) { sum += 100 - G.clamp(d.recov * 100.0 / 2880, 0.0, 100.0); n++; }
        if (d.stress >= 0) { sum += 100 - d.stress; n++; }
        return n > 0 ? rn(sum / n) : 60;
    }

    hidden function workoutOf(r) as Number {
        return r >= 80 ? 0 : (r >= 65 ? 1 : (r >= 45 ? 2 : (r >= 25 ? 3 : 4)));
    }

    // style colours: [bg, panel, edge, label]
    hidden function pal(st) as Array<Number> {
        if (st == 2) { return [0x000000, 0x19191B, 0x343437, 0x9A9A9A]; }
        if (st == 3) { return [0x000000, 0x05070B, 0x000000, 0x8A8A8A]; }
        return [0x050B17, 0x13203A, 0x26385A, 0x8FA3C7];
    }

    hidden function panel(dc as Dc, x, y, w, h, st, acc, P as Array<Number>) as Void {
        var r = 12;
        dc.setColor(P[1], -1);
        dc.fillRoundedRectangle(x, y, w, h, r);
        if (st == 1) {
            dc.setColor(P[2], -1);
            dc.setPenWidth(2);
            dc.drawLine(x + r, y + 1, x + w - r, y + 1);
        } else if (st == 2) {
            dc.setColor(0x232326, -1);
            dc.setPenWidth(1);
            for (var k = 14; k < w + h - 14; k += 9) {
                var x0 = k < h ? x + 4 : x + 4 + k - h;
                var y0 = k < h ? y + k : y + h - 4;
                var x1 = k < w ? x + k : x + w - 4;
                var y1 = k < w ? y + 4 : y + 4 + k - w;
                if (x1 > x0) {
                    dc.drawLine(x0, y0, x1, y1);
                }
            }
            dc.setColor(P[2], -1);
            dc.drawRoundedRectangle(x, y, w, h, r);
            dc.setColor(acc, -1);
            dc.fillRectangle(x + r, y + h - 3, 22, 3);
        } else {
            dc.setColor(G.dim(acc, 0.28), -1);
            dc.setPenWidth(5);
            dc.drawRoundedRectangle(x, y, w, h, r);
            dc.setColor(acc, -1);
            dc.setPenWidth(2);
            dc.drawRoundedRectangle(x, y, w, h, r);
        }
    }

    // slide offset for panel i, direction dir (-1 from the left, 1 from the right)
    hidden function slide(p, i, dir) {
        return (1.0 - G.ease(G.stag(p, i, 0.09, 0.55))) * 300 * dir;
    }

    // Zwift-style workout block chart: x,yb = left/bottom, w,h size, prog 0..1 reveal
    hidden function chart(dc as Dc, x, yb, w, h, wi, prog) as Void {
        var wu = wi < 3 ? 10 : 6;
        var cd = wi < 3 ? 8 : 5;
        var reps = WR[wi];
        var on = WON[wi];
        var pc = WP[wi];
        var off = WOFF[wi];
        var tot = wu + reps * on + (reps - 1) * off + cd;
        var sx = w.toFloat() / tot;
        var sy = h / 130.0;
        var top = pc < 75 ? pc : 75;
        var ctop = pc < 70 ? pc : 70;
        var xEnd = x + w * prog;
        // warm-up ramp
        var cx = x;
        var nr = wu / 2;
        for (var k = 0; k < nr; k++) {
            var a0 = 40 + (top - 40) * k.toFloat() / nr;
            var a1 = 40 + (top - 40) * (k + 1.0) / nr;
            var x0 = cx + k * 2 * sx;
            var x1 = cx + (k + 1) * 2 * sx;
            if (x0 >= xEnd) {
                break;
            }
            var xe = x1 < xEnd ? x1 : xEnd;
            var a2 = a0 + (a1 - a0) * (xe - x0) / (x1 - x0);
            dc.setColor(ZC[zoneOf((a0 + a1) / 2)], -1);
            dc.fillPolygon([[x0, yb], [x0, yb - a0 * sy], [xe, yb - a2 * sy], [xe, yb]]);
        }
        cx += wu * sx;
        for (var i = 0; i < reps; i++) {
            blk(dc, cx + 1, yb, on * sx - 2, pc * sy, ZC[zoneOf(pc)], xEnd);
            cx += on * sx;
            if (i < reps - 1) {
                blk(dc, cx + 1, yb, off * sx - 2, 55 * sy, ZC[zoneOf(55)], xEnd);
                cx += off * sx;
            }
        }
        var nc = cd / 2.0 > 2 ? 4 : 2;
        var cw = cd.toFloat() / nc;
        for (var k = 0; k < nc; k++) {
            var a0 = ctop - (ctop - 40) * k.toFloat() / nc;
            var a1 = ctop - (ctop - 40) * (k + 1.0) / nc;
            var x0 = cx + k * cw * sx;
            var x1 = cx + (k + 1) * cw * sx;
            if (x0 >= xEnd) {
                break;
            }
            var xe = x1 < xEnd ? x1 : xEnd;
            var a2 = a0 + (a1 - a0) * (xe - x0) / (x1 - x0);
            dc.setColor(ZC[zoneOf((a0 + a1) / 2)], -1);
            dc.fillPolygon([[x0, yb], [x0, yb - a0 * sy], [xe, yb - a2 * sy], [xe, yb]]);
        }
    }

    hidden function blk(dc as Dc, x, yb, w, h, col, xEnd) as Void {
        if (x >= xEnd) {
            return;
        }
        var ww = x + w < xEnd ? w : xEnd - x;
        dc.setColor(col, -1);
        dc.fillRectangle(x, yb - h, ww, h);
        dc.setColor(G.mix(col, 0xFFFFFF, 0.45), -1);
        dc.fillRectangle(x, yb - h, ww, 2);
    }

    // static layer: everything but the shimmer and the blinking marker (per minute and page)
    function bgKey(d as D) as Number {
        return minuteKey(d) * 3 + _pg;
    }

    // ambient shimmer across the power zone bar (after the intro, while live)
    hidden function shimmer(dc as Dc, a as A) as Void {
        if (!a.live) {
            return;
        }
        var bx = 52;
        var bw = 350;
        var by = 218;
        var bh = 18;
        var sw = bw / 6.0;
        var ph = (a.t % 2600) / 2600.0;
        var sx = bx - 30 + (bw + 60) * ph;
        dc.setClip(bx, by, bw, bh);
        dc.setPenWidth(5);
        for (var k = -4; k <= 4; k += 2) {
            var xx = sx + k * 3;
            var z = G.clamp(Math.floor((xx - bx) / sw).toNumber(), 0, 5);
            dc.setColor(G.mix(ZC[z], 0xFFFFFF, 0.55 * (1 - k.abs() / 5.0)), -1);
            dc.drawLine(xx + 4, by, xx - 4, by + bh);
        }
        dc.clearClip();
    }

    // blinking "you are here" marker on the workout chart (never part of the static layer)
    hidden function marker(dc as Dc, a as A) as Void {
        if (a.so || (a.live && a.t % 1000 >= 600)) {
            return;
        }
        var chx = 80;
        var chb = 376;
        dc.setColor(0xFFFFFF, -1);
        dc.setPenWidth(2);
        dc.drawLine(chx, chb + 1, chx, chb - 36);
        dc.fillPolygon([[chx - 5, chb - 42], [chx + 5, chb - 42], [chx, chb - 36]]);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var pg = _pg;
        if (a.bg) {
            // moving parts on top of the cached layer
            if (pg == 0) {
                shimmer(dc, a);
                marker(dc, a);
            }
            return;
        }
        var st = d.cfg.style;
        var acc = d.accent;
        var P = pal(st);
        var p = a.intro;
        var cx = 227;

        if (st == 1) {
            dc.setColor(P[0], -1);
            dc.fillCircle(cx, cx, 227);
        }

        // ---------------- top row: HR | time | bike km
        var ox = 0;
        var tp = G.ease(G.stag(p, 0, 0.0, 0.5));
        var ty = (1 - tp) * -120;
        panel(dc, 124, 48 + ty, 206, 92, st, acc, P);
        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        if (st == 3) {
            dc.setColor(G.dim(acc, 0.35), -1);
            F.st(dc, hh + ":" + G.pad2(d.m), cx + 2, 84 + ty, 52, 11, 1, 1.0, SL);
        }
        dc.setColor(0xFFFFFF, -1);
        F.st(dc, hh + ":" + G.pad2(d.m), cx + 2, 84 + ty, 52, 6, 1, 1.0, SL);
        dc.setColor(P[3], -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, cx, 116 + ty, 2, 1, 0);

        // HR panel (left)
        var cu = G.ease(G.stag(p, 3, 0.09, 0.6));
        ox = slide(p, 1, -1);
        panel(dc, 44 + ox, 90, 72, 56, st, acc, P);
        var hz = 0;
        if (d.hr > 0 && d.hrMax > 0) {
            var hp = d.hr * 100.0 / d.hrMax;
            hz = hp < 60 ? 0 : (hp < 70 ? 1 : (hp < 80 ? 2 : (hp < 90 ? 3 : 4)));
        }
        dc.setColor(P[3], -1);
        F.px(dc, "HF", 80 + ox, 98, 2, 1, 0);
        var vs = d.hr > 0 ? "" + rn(d.hr * cu) : "--";
        var vw = F.stW(vs, 18);
        var vx = 80 + ox - (vw + 14) / 2;
        dc.setColor(HZ[hz], -1);
        F.px(dc, "@", vx, 117, 2, 0, 0);
        dc.setColor(d.hr > 0 ? 0xFFFFFF : 0x777777, -1);
        F.st(dc, vs, vx + 14, 124, 18, 3, 0, 1.0, SL);
        for (var k = 0; k < 5; k++) {
            dc.setColor(k == hz && d.hr > 0 ? HZ[k] : G.dim(HZ[k], 0.3), -1);
            dc.fillRectangle(56 + ox + k * 10, 137, 8, 3);
        }

        // bike km panel (right)
        ox = slide(p, 1, 1);
        panel(dc, 338 + ox, 90, 72, 56, st, acc, P);
        var km = d.wkBike >= 0 ? (d.metric ? d.wkBike / 1000.0 : d.wkBike / 1609.344) : -1;
        dc.setColor(P[3], -1);
        F.px(dc, "RAD", 374 + ox, 98, 2, 1, 0);
        vs = km >= 0 ? "" + rn(km * cu) : "--";
        vw = F.stW(vs, 18);
        vx = 374 + ox - (vw + 26) / 2;
        dc.setColor(km >= 0 ? 0xFFFFFF : 0x777777, -1);
        F.st(dc, vs, vx, 124, 18, 3, 0, 1.0, SL);
        dc.setColor(acc, -1);
        F.px(dc, d.metric ? "KM" : "MI", vx + vw + 26, 119, 2, 2, 0);
        var gf = km >= 0 && d.cfg.bikeGoal > 0 ? G.clamp(km / d.cfg.bikeGoal, 0.0, 1.0) : 0.0;
        dc.setColor(st == 1 ? 0x26385A : 0x333333, -1);
        dc.fillRectangle(350 + ox, 137, 48, 3);
        dc.setColor(acc, -1);
        dc.fillRectangle(350 + ox, 137, 48 * gf * cu, 3);

        var ftp = d.cfg.ftp;
        var r = readiness(d);
        var wi = workoutOf(r);

        if (pg == 1) {
            pageZones(dc, d, p, st, acc, P, ftp);
        } else if (pg == 2) {
            pageWork(dc, d, a, st, acc, P, ftp, r, wi);
        } else {
            pageMain(dc, d, a, st, acc, P, ftp, r, wi);
        }

        // page dots
        for (var k = 0; k < 3; k++) {
            dc.setColor(k == pg ? acc : 0x444444, -1);
            dc.fillCircle(cx - 12 + k * 12, 404, k == pg ? 3.5 : 2.5);
        }
    }

    hidden function pageMain(dc as Dc, d as D, a as A, st, acc, P as Array<Number>, ftp, r, wi) as Void {
        var p = a.intro;
        var cu = G.ease(G.stag(p, 3, 0.09, 0.6));

        // ---------------- FTP / W/kg / category
        var ox = slide(p, 2, -1);
        panel(dc, 40 + ox, 150, 374, 58, st, acc, P);
        var kg = d.cfg.kg > 0 ? d.cfg.kg : 75;
        var wkg = ftp.toFloat() / kg;
        var cat = wkg >= 4.0 ? 0 : (wkg >= 3.2 ? 1 : (wkg >= 2.5 ? 2 : 3));
        dc.setColor(P[3], -1);
        F.px(dc, "FTP", 62 + ox, 158, 2, 0, 0);
        F.px(dc, "W/KG", 200 + ox, 158, 2, 0, 0);
        dc.setColor(0xFFFFFF, -1);
        var w = F.st(dc, "" + rn(ftp * cu), 62 + ox, 188, 26, 5, 0, 1.0, SL);
        dc.setColor(acc, -1);
        F.st(dc, "W", 70 + ox + w, 192, 14, 3, 0, 1.0, SL);
        dc.setColor(0xFFFFFF, -1);
        F.st(dc, G.fix1(wkg * cu), 200 + ox, 188, 26, 5, 0, 1.0, SL);
        // category badge
        var bp = G.spring(G.stag(p, 6, 0.09, 0.4));
        if (bp > 0) {
            var bs = 40 * bp;
            dc.setColor(CATC[cat], -1);
            dc.fillRoundedRectangle(368 + ox - bs / 2, 179 - bs / 2, bs, bs, 8 * bp);
            dc.setColor(cat == 3 ? 0x1A1A1A : 0xFFFFFF, -1);
            F.st(dc, "ABCD".substring(cat, cat + 1), 369 + ox, 179, 22 * bp, 4, 1, 1.0, SL);
        }
        dc.setColor(P[3], -1);
        F.px(dc, "KAT", 340 + ox, 172, 2, 2, 0);

        // ---------------- power zone bar
        var bx = 52;
        var bw = 350;
        var by = 218;
        var bh = 18;
        var fp = G.easeInOut(G.stag(p, 3, 0.09, 0.6));
        var sw = bw / 6.0;
        var fx = bx + bw * fp;
        for (var z = 0; z < 6; z++) {
            var x0 = bx + z * sw;
            if (x0 >= fx) {
                break;
            }
            var ww = x0 + sw - 2 < fx ? sw - 2 : fx - x0;
            dc.setColor(ZC[z], -1);
            if (z == 0 || z == 5) {
                // rounded outer ends, square inner joints
                dc.fillRoundedRectangle(x0, by, ww, bh, 5);
                if (ww > 6) {
                    dc.fillRectangle(z == 0 ? x0 + 6 : x0, by, ww - 6, bh);
                }
            } else {
                dc.fillRectangle(x0, by, ww, bh);
            }
            if (ww > sw * 0.6) {
                dc.setColor(0x101010, -1);
                F.px(dc, "" + (z + 1), x0 + sw / 2 - 1, by + 2, 2, 1, 0);
            }
        }
        // ambient shimmer across the bar
        if (p >= 1) {
            shimmer(dc, a);
        }
        // boundary watts
        dc.setColor(0xB8B8B8, -1);
        for (var z = 1; z < 6; z++) {
            if (bx + z * sw > fx) {
                break;
            }
            F.px(dc, "" + rn(ftp * ZP[z] / 100.0), bx + z * sw - 1, by + bh + 6, 2, 1, 0);
        }
        // workout target pointer
        var tz = zoneOf(WP[wi]);
        var tf = tz < 5 ? (WP[wi] - ZP[tz]).toFloat() / (ZP[tz + 1] - ZP[tz]) : G.clamp((WP[wi] - 119) / 31.0, 0.0, 1.0);
        var tx = bx + (tz + tf) * sw;
        if (fp >= 1) {
            dc.setColor(0xFFFFFF, -1);
            dc.fillPolygon([[tx - 6, by - 9], [tx + 6, by - 9], [tx, by - 2]]);
        }

        // ---------------- workout of the day
        ox = slide(p, 4, 1);
        panel(dc, 62 + ox, 262, 330, 124, st, acc, P);
        dc.setColor(acc, -1);
        F.px(dc, "WORKOUT DES TAGES", 80 + ox, 273, 2, 0, 0);
        dc.setColor(0xFFFFFF, -1);
        F.px(dc, WN[wi], 80 + ox, 290, 3, 0, 0);
        dc.setColor(0xC8C8C8, -1);
        F.px(dc, WS[wi] + " " + WP[wi] + "% " + rn(ftp * WP[wi] / 100.0) + "W", 80 + ox, 316, 2, 0, 0);
        // readiness ring
        var rp = G.ease(G.stag(p, 5, 0.09, 0.5));
        var rc = r >= 65 ? 0x59BF59 : (r >= 45 ? 0xFFCC3F : 0xFF6639);
        G.ring(dc, 350 + ox, 305, 23, 5, r / 100.0 * rp, rc, st == 1 ? 0x22324F : 0x2A2A2A);
        dc.setColor(0xFFFFFF, -1);
        F.st(dc, "" + rn(r * rp), 351 + ox, 305, 14, 3, 1, 1.0, SL);
        dc.setColor(P[3], -1);
        F.px(dc, "FORM", 350 + ox, 334, 2, 1, 0);
        // chart
        var cp = G.easeInOut(G.stag(p, 5, 0.09, 0.5));
        var chx = 80 + ox;
        var chb = 376;
        chart(dc, chx, chb, 214, 34, wi, cp);
        // "you are here" marker
        if (cp >= 1 && ox == 0) {
            marker(dc, a);
        }
    }

    hidden function pageZones(dc as Dc, d as D, p, st, acc, P as Array<Number>, ftp) as Void {
        var ox = slide(p, 2, -1);
        panel(dc, 58 + ox, 150, 338, 232, st, acc, P);
        dc.setColor(acc, -1);
        F.px(dc, "LEISTUNGSZONEN", 227 + ox, 160, 2, 1, 0);
        for (var z = 0; z < 6; z++) {
            var y = 196 + z * 32;
            var rp = G.ease(G.stag(p, 2 + z, 0.06, 0.4));
            if (rp <= 0) {
                continue;
            }
            var rx = ox + (1 - rp) * 60;
            dc.setColor(ZC[z], -1);
            dc.fillRoundedRectangle(74 + rx, y - 11, 34, 22, 5);
            dc.setColor(z == 3 ? 0x2A2200 : 0x101010, -1);
            F.px(dc, "Z" + (z + 1), 91 + rx, y - 7, 2, 1, 0);
            dc.setColor(P[3], -1);
            F.px(dc, ZN[z], 118 + rx, y - 7, 2, 0, 0);
            var lo = rn(ftp * ZP[z] / 100.0);
            var hi = z < 5 ? rn(ftp * ZP[z + 1] / 100.0) - 1 : 0;
            var txt = z == 0 ? "<" + (hi + 1) : (z == 5 ? ">" + lo : lo + "-" + hi);
            dc.setColor(0xFFFFFF, -1);
            F.st(dc, txt + " W", 382 + rx, y, 15, 3, 2, 1.0, SL);
        }
    }

    hidden function pageWork(dc as Dc, d as D, a as A, st, acc, P as Array<Number>, ftp, r, wi) as Void {
        var p = a.intro;
        var ox = slide(p, 2, 1);
        panel(dc, 58 + ox, 150, 338, 232, st, acc, P);
        dc.setColor(acc, -1);
        F.px(dc, "WORKOUT DES TAGES", 227 + ox, 160, 2, 1, 0);
        dc.setColor(0xFFFFFF, -1);
        F.px(dc, WN[wi], 227 + ox, 178, 3, 1, 0);
        dc.setColor(0xC8C8C8, -1);
        F.px(dc, WS[wi] + " " + WP[wi] + "% " + rn(ftp * WP[wi] / 100.0) + "W", 227 + ox, 210, 2, 1, 0);
        var cp = G.easeInOut(G.stag(p, 3, 0.09, 0.6));
        chart(dc, 74 + ox, 294, 306, 60, wi, cp);
        // inputs
        var lb = ["BB", "SCHLAF", "ERHOL", "RUHE"];
        var rv = d.recov >= 0 ? rn(100 - G.clamp(d.recov * 100.0 / 2880, 0.0, 100.0)) : -1;
        var vs = [d.bb, d.sleep, rv, d.stress >= 0 ? 100 - d.stress : -1];
        for (var k = 0; k < 4; k++) {
            var x = 104 + k * 82 + ox;
            var vp = G.ease(G.stag(p, 4 + k, 0.06, 0.5));
            var v = vs[k];
            dc.setColor(P[3], -1);
            F.px(dc, lb[k], x, 310, 2, 1, 0);
            dc.setColor(v >= 0 ? 0xFFFFFF : 0x666666, -1);
            F.st(dc, v >= 0 ? "" + rn(v * vp) : "--", x, 337, 16, 3, 1, 1.0, SL);
            dc.setColor(0x333A48, -1);
            dc.fillRectangle(x - 26, 351, 52, 3);
            if (v > 0) {
                dc.setColor(v >= 65 ? 0x59BF59 : (v >= 40 ? 0xFFCC3F : 0xFF6639), -1);
                dc.fillRectangle(x - 26, 351, 52 * v * vp / 100.0, 3);
            }
        }
        dc.setColor(acc, -1);
        F.px(dc, "FORM " + r, 227 + ox, 362, 2, 1, 0);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        dc.setColor(0x9A9A9A, -1);
        F.st(dc, hh + ":" + G.pad2(d.m), 227 + o[0], 205 + o[1], 76, 3, 1, 1.0, SL);
        var kg = d.cfg.kg > 0 ? d.cfg.kg : 75;
        dc.setColor(G.dim(d.accent, 0.6), -1);
        F.st(dc, "FTP " + d.cfg.ftp + " W  " + G.fix1(d.cfg.ftp.toFloat() / kg) + " W/KG", 227 + o[0], 272 + o[1], 16, 2, 1, 1.0, SL);
        for (var z = 0; z < 6; z++) {
            dc.setColor(G.dim(ZC[z], 0.5), -1);
            dc.fillRectangle(137 + o[0] + z * 30, 298 + o[1], 28, 3);
        }
    }
}
