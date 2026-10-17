import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// QUEST — "Daily Quest": three deterministic daily challenges (Sunday: the 3rd is a BOSS),
// XP, levels, streak flame. Progress is persisted with St (XP is claimed once per quest/day).
// Styles: 1 Pixel, 2 Clean, 3 Neon. Mirrors web/js/faces/quest.js.
class FaceQuest extends Face {
    // quest kinds: 0 steps, 1 floors, 2 active minutes today, 3 kcal, 4 distance km, 5 floors before 12:00
    const QB = [6000, 9000, 13000, 6, 10, 16, 10, 25, 45, 2000, 2400, 2800, 4, 7, 10, 3, 5, 8];
    const QS = [500, 1, 5, 50, 1, 1];
    const MULT = [70, 100, 130, 170];
    const XPV = [50, 100, 150, 300];
    // 7x7 pixel icons, one row bitmask per line (bit 6 = left)
    const ICO = [
        0x60, 0x60, 0x70, 0x78, 0x7F, 0x7F, 0x2A,
        0x03, 0x03, 0x0F, 0x0F, 0x3F, 0x3F, 0x7F,
        0x0E, 0x1C, 0x38, 0x7E, 0x0C, 0x18, 0x30,
        0x08, 0x18, 0x1C, 0x3E, 0x7F, 0x7F, 0x3E,
        0x7E, 0x7C, 0x7E, 0x40, 0x40, 0x40, 0x40,
        0x1C, 0x22, 0x49, 0x4F, 0x41, 0x22, 0x1C
    ];
    const FLO = [0x08, 0x0C, 0x1C, 0x1E, 0x3E, 0x7F, 0x7F, 0x7F, 0x3E];
    const FLI = [0x00, 0x00, 0x00, 0x00, 0x08, 0x1C, 0x1E, 0x3E, 0x1C];
    const CHK = [0x01, 0x03, 0x46, 0x6C, 0x38, 0x10, 0x00];

    // caches (the JS version recomputes every frame; same results)
    hidden var _qDay = -1;
    hidden var _q = [0, 0, 0, 0, 0, 0, 0, 0, 0] as Array<Number>;
    hidden var _sKey = -1;
    hidden var _S = [0, 0, 0, 0, 0, 0] as Array<Number>;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 8;
    }

    hidden function leap(y) as Boolean {
        return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    }

    hidden function dayKey(d as D) as Number {
        return d.year * 1000 + d.doy;
    }

    hidden function yKey(d as D) as Number {
        return d.doy > 1 ? d.year * 1000 + d.doy - 1 : (d.year - 1) * 1000 + (leap(d.year - 1) ? 366 : 365);
    }

    // cumulative XP needed to reach level index L (level shown = L + 1)
    hidden function need(L) as Number {
        return 50 * L * (L + 1);
    }

    hidden function levelOf(xp) as Number {
        var L = 0;
        while (need(L + 1) <= xp) {
            L++;
        }
        return L;
    }

    // today's quests -> [k0,k1,k2, t0,t1,t2, x0,x1,x2]
    hidden function quests(d as D) as Array<Number> {
        var key = dayKey(d) * 10 + d.cfg.quest;
        if (key == _qDay) {
            return _q;
        }
        _qDay = key;
        var s = G.rnd(G.rnd(dayKey(d)));
        var q = [0, 0, 0, 0, 0, 0, 0, 0, 0] as Array<Number>;
        var lv = G.clamp(d.cfg.quest, 0, 2);
        for (var i = 0; i < 3; i++) {
            s = G.rnd(s);
            var k = (s / 65536) % 6;
            while ((i > 0 && q[0] == k) || (i > 1 && q[1] == k)) {
                k = (k + 1) % 6;
            }
            q[i] = k;
            s = G.rnd(s);
            var j = ((s / 256) % 17) - 8;
            var mi = (i == 2 && d.dow == 0) ? 3 : i;
            var st = QS[k];
            var div = 10000 * st;
            var b = QB[k * 3 + lv];
            if (k == 3) {
                b = b - 1600;
            }
            var t = ((b * MULT[mi] * (100 + j) + div / 2) / div) * st;
            if (k == 3) {
                t += 1600;
            }
            q[3 + i] = t < st ? st : t;
            q[6 + i] = XPV[mi];
        }
        _q = q;
        return q;
    }

    hidden function label(k, t) as String {
        if (k == 0) { return G.num(t) + " SCHRITTE"; }
        if (k == 1) { return t + " ETAGEN"; }
        if (k == 2) { return t + " AKTIV-MIN"; }
        if (k == 3) { return G.num(t) + " KCAL"; }
        if (k == 4) { return t + " KM STRECKE"; }
        return t + " ETAGEN VOR 12";
    }

    // draw a 7-wide pixel bitmap: rows bitmasks from arr[off..off+rows)
    hidden function icon(dc as Dc, arr as Array<Number>, off, rows, x, y, sc) as Void {
        for (var r = 0; r < rows; r++) {
            var b = arr[off + r];
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

    hidden function val(d as D, k, im) {
        if (k == 0) { return d.steps; }
        if (k == 1 || k == 5) { return d.floors; }
        if (k == 2) { return im; }
        if (k == 3) { return d.kcal; }
        return d.distM / 1000.0;
    }

    // update persistent state; returns [xp, qc, streak, imToday, celebrate, celebQ]
    hidden function sync(d as D, q as Array<Number>) as Array<Number> {
        var key = d.mins + d.doy * 1440 + d.steps * 7 + d.floors * 131 + d.kcal * 17 + d.imWeek * 4099 + d.distM * 3;
        if (key == _sKey) {
            return _S;
        }
        _sKey = key;
        var today = dayKey(d);
        var imw = d.imWeek > 0 ? d.imWeek : 0;
        if (St.get("imDay", -1) != today) {
            St.set("imDay", today);
            St.set("imBase", imw);
        }
        var base = St.get("imBase", imw);
        if (imw < base) {
            base = 0;
            St.set("imBase", 0);
        }
        var im = imw - base;
        var qc = 0;
        if (St.get("qd", -1) == today) {
            qc = St.get("qc", 0);
        } else {
            St.set("qd", today);
            St.set("qc", 0);
        }
        var add = 0;
        var nb = 0;
        for (var i = 0; i < 3; i++) {
            var bit = 1 << i;
            if ((qc & bit) == 0 && val(d, q[i], im) >= q[3 + i] && (q[i] != 5 || d.h < 12)) {
                qc |= bit;
                nb |= bit;
                add += q[6 + i];
            }
        }
        var xp = St.get("xp", 0);
        if (add > 0) {
            xp += add;
            St.set("xp", xp);
            St.set("qc", qc);
            St.set("celebrate", St.get("celebrate", 0) + add);
            St.set("celebQ", St.get("celebQ", 0) | nb);
        }
        var lf = St.get("lastFull", -1);
        var sk = St.get("streak", 0);
        if (qc == 7 && lf != today) {
            sk = lf == yKey(d) ? sk + 1 : 1;
            lf = today;
            St.set("streak", sk);
            St.set("lastFull", today);
        }
        if (lf != today && lf != yKey(d)) {
            sk = 0;
        }
        _S = [xp, qc, sk, im, St.get("celebrate", 0), St.get("celebQ", 0)] as Array<Number>;
        return _S;
    }

    // streak flame (fl: flicker -1..1)
    hidden function flame(dc as Dc, fx, ty, sk, fl) as Void {
        var sh = fl > 0.35 ? 1 : (fl < -0.35 ? -1 : 0);
        dc.setColor(sk > 0 ? 0xFF6A1A : 0x4A4A4A, -1);
        for (var r = 0; r < 9; r++) {
            var b = FLO[r];
            var o = r < 3 ? sh * 3 : 0;
            for (var c = 0; c < 7; c++) {
                if ((b & (64 >> c)) != 0) {
                    dc.fillRectangle(fx + c * 3 + o, 48 + ty + r * 3, 3, 3);
                }
            }
    }
    if (sk > 0) {
        dc.setColor(fl > 0.1 ? 0xFFF0A0 : 0xFFD23D, -1);
        var lift = fl > 0.6 ? 1 : 0;
        for (var r = 4 - lift; r < 9; r++) {
            var b = FLI[r + lift];
            for (var c = 0; c < 7; c++) {
                if ((b & (64 >> c)) != 0) {
                    dc.fillRectangle(fx + c * 3, 48 + ty + r * 3, 3, 3);
                }
            }
        }
    }
    }

    // celebration burst on top of the time (bb: intro progress)
    hidden function burst(dc as Dc, st, acc, bb, celeb, cx) as Void {
        var e = G.ease(bb / 0.8);
        var fade = G.clamp((1 - bb) / 0.35, 0.0, 1.0);
        dc.setColor(G.mix(0x000000, acc, fade), -1);
        dc.setPenWidth(3);
        for (var i = 0; i < 12; i++) {
            var ang = i * 30 + 15;
            var r0 = 60 + 40 * e;
            var r1 = 72 + 56 * e;
            dc.drawLine(G.ptX(cx, r0, ang), G.ptY(152, r0 * 0.4, ang), G.ptX(cx, r1, ang), G.ptY(152, r1 * 0.4, ang));
    }
    dc.setColor(G.mix(0x000000, 0xFFFFFF, fade), -1);
    var bs = G.spring(bb / 0.5);
    if (st == 1) {
        F.px(dc, "+" + celeb + " XP", cx, 152 - 17 * bs, Math.round(1 + 4 * bs).toNumber(), 1, 0);
    } else {
        F.st(dc, "+" + celeb + " XP", cx, 152, 18 + 22 * bs, 4, 1, 1.0, 0);
    }
    }

    // static layer: everything but the flame flicker and the celebration burst
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var cx = 227;
        var q = quests(d);
        var S = sync(d, q);
        var xp = S[0];
        var qc = S[1];
        var sk = S[2];
        var im = S[3];
        var celeb = S[4];
        var cq = S[5];
        var boss = d.dow == 0;
        var red = 0xFF4A3D;
        var good = st == 1 ? 0x3CD070 : 0x5FE08A;
        if (a.bg) {
            // moving parts on the cached layer: the flickering streak flame, the celebration burst
            var lv0 = "LVL " + (levelOf(xp) + 1);
            var lw0 = F.pxW(lv0, 3);
            var fx0 = cx - (lw0 + 26 + 27 + F.pxW("" + sk, 3)) / 2.0 + lw0 + 26;
            if (a.live && p >= 1) {
                dc.setColor(0x000000, -1);
                dc.fillRectangle(fx0 - 3, 48, 27, 27);
                flame(dc, fx0, 0, sk, G.noise(a.t / 140.0));
            }
            if (celeb > 0 && p < 1) {
                burst(dc, st, acc, p, celeb, cx);
            }
            if (celeb > 0 && p >= 1) {
                St.set("celebrate", 0);
                St.set("celebQ", 0);
                _S[4] = 0;
                _S[5] = 0;
            }
            return;
        }

        // ---------------- XP ring
        var L = levelOf(xp);
        var lf = (xp - need(L)) / (100.0 * (L + 1));
        var rf = lf * G.ease(G.stag(p, 0, 0, 0.7));
        if (st == 1) {
            var lit = Math.floor(rf * 60 + 0.001).toNumber();
            dc.setPenWidth(9);
            for (var i = 0; i < 60; i++) {
                dc.setColor(i < lit ? acc : 0x2A2440, -1);
                G.arcC(dc, cx, cx, 216, i * 6 + 1, i * 6 + 5);
            }
        } else if (st == 2) {
            G.ring(dc, cx, cx, 216, 4, rf, acc, 0x262626);
        } else {
            dc.setPenWidth(12);
            dc.setColor(G.dim(acc, 0.22), -1);
            if (rf > 0.004) {
                G.arcC(dc, cx, cx, 214, 0, rf * 360);
            }
            G.ring(dc, cx, cx, 214, 4, rf, acc, 0x1E1E1E);
            if (rf > 0.004) {
                dc.setColor(0xFFFFFF, -1);
                dc.fillCircle(G.ptX(cx, 214, rf * 360), G.ptY(cx, 214, rf * 360), 3);
            }
        }

        // ---------------- level + streak
        var tp = G.ease(G.stag(p, 1, 0.08, 0.5));
        var ty = (1 - tp) * -40;
        var lv = "LVL " + (L + 1);
        var lw = F.pxW(lv, 3);
        var sks = "" + sk;
        var sw = 21 + 6 + F.pxW(sks, 3);
        var x0 = cx - (lw + 26 + sw) / 2.0;
        dc.setColor(st == 1 ? acc : 0xFFFFFF, -1);
        if (st == 1) {
            F.px(dc, lv, x0, 52 + ty, 3, 0, 0);
        } else {
            F.st(dc, lv, x0 + lw / 2.0, 62 + ty, 20, 3, 1, 1.0, 0);
        }
        // flame (flickers in ambient)
        var fx = x0 + lw + 26;
        flame(dc, fx, ty, sk, a.live && p >= 1 ? G.noise(a.t / 140.0) : 0.0);
        dc.setColor(sk > 0 ? 0xFFFFFF : 0x777777, -1);
        F.px(dc, sks, fx + 27, 52 + ty, 3, 0, 0);
        // xp text
        dc.setColor(0x8A8A8A, -1);
        F.px(dc, G.num(xp - need(L)) + "/" + G.num(100 * (L + 1)) + " XP", cx, 86 + ty, 2, 1, 0);

        // ---------------- time
        var tc = celeb > 0 && p < 1 ? G.mix(0x000000, 0xFFFFFF, G.clamp((p - 0.55) / 0.35, 0.0, 1.0)) : 0xFFFFFF;
        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        var ts = hh + ":" + G.pad2(d.m);
        if (st == 1) {
            dc.setColor(tc, -1);
            F.px(dc, ts, cx, 114, 10, 1, 1);
        } else {
            if (st == 3) {
                dc.setColor(G.mix(0x000000, acc, 0.3 * ((tc & 255) / 255.0)), -1);
                F.st(dc, ts, cx, 152, 76, 14, 1, 1.0, 0);
            }
            dc.setColor(tc, -1);
            F.st(dc, ts, cx, 152, 76, st == 3 ? 5 : 6, 1, 1.0, 0);
        }
        // celebration burst (on top of the dimmed time)
        if (celeb > 0 && p < 1) {
            burst(dc, st, acc, p, celeb, cx);
        }
        dc.setColor(boss ? red : 0x8A8A8A, -1);
        F.px(dc, boss ? "SONNTAG: BOSS-QUEST!" : d.dowStr + " " + d.day + ". " + d.monStr, cx, 200, 2, 1, 0);

        // ---------------- quest rows
        if (st == 1) {
            // RPG dialog box
            dc.setColor(0x0E0B22, -1);
            dc.fillRectangle(82, 228, 290, 140);
            dc.setColor(0xE8E8E8, -1);
            dc.setPenWidth(2);
            dc.drawRectangle(82, 228, 290, 140);
            dc.setColor(0x5A5390, -1);
            dc.drawRectangle(87, 233, 280, 130);
        }
        for (var i = 0; i < 3; i++) {
            var y = 254 + i * 42;
            var k = q[i];
            var t = q[3 + i];
            var isB = boss && i == 2;
            var done = (qc & (1 << i)) != 0;
            var fail = !done && k == 5 && d.h >= 12;
            var rp = G.stag(p, i, 0.12, 0.6);
            var col = isB ? red : acc;
            // icon
            dc.setColor(done ? good : (fail ? 0x555555 : col), -1);
            icon(dc, ICO, k * 7, 7, 96, y - 12, 3);
            // label
            dc.setColor(fail ? 0x666666 : 0xE6E6E6, -1);
            if (st == 1) {
                F.px(dc, label(k, t), 128, y - 13, 2, 0, 0);
            } else {
                F.st(dc, label(k, t), 128, y - 8, 16, 2, 0, 1.0, 0);
            }
            // bar
            var v = val(d, k, im);
            var fr = done ? 1.0 : G.clamp(v.toFloat() / t, 0.0, 1.0);
            var bf = fr * G.easeInOut(rp);
            var bx = 128;
            var bw = 184;
            var by = y + 6;
            if (st == 1) {
                var n = 10;
                var gw = 3;
                var cw = (bw - (n - 1) * gw) / n.toFloat();
                var lit = Math.floor(bf * n + 0.001).toNumber();
                for (var c = 0; c < n; c++) {
                    dc.setColor(c < lit ? (done ? good : col) : 0x2A2440, -1);
                    dc.fillRectangle(bx + c * (cw + gw), by, cw, 7);
                }
            } else if (st == 2) {
                dc.setColor(0x2A2A2A, -1);
                dc.fillRoundedRectangle(bx, by + 1, bw, 4, 2);
                if (bf > 0.01) {
                    dc.setColor(done ? good : col, -1);
                    dc.fillRoundedRectangle(bx, by + 1, bw * bf, 4, 2);
                }
            } else {
                dc.setColor(G.dim(col, 0.35), -1);
                dc.setPenWidth(1);
                dc.drawRoundedRectangle(bx, by - 1, bw, 8, 4);
                if (bf > 0.01) {
                    dc.setColor(G.dim(done ? good : col, 0.3), -1);
                    dc.fillRoundedRectangle(bx - 2, by - 3, bw * bf + 4, 12, 6);
                    dc.setColor(done ? good : col, -1);
                    dc.fillRoundedRectangle(bx, by - 1, bw * bf, 8, 4);
                }
            }
            // right: check / xp reward / fail
            var rx = 344;
            if (done) {
                var cp = G.spring(G.stag(p, i + 3, 0.1, 0.4));
                if (cp > 0) {
                    var csc = 4 * cp;
                    if ((cq & (1 << i)) != 0 && p < 1) {
                        dc.setColor(G.dim(good, 1 - p), -1);
                        dc.setPenWidth(2);
                        dc.drawCircle(rx, y - 2, 10 + 22 * p);
                    }
                    dc.setColor(good, -1);
                    for (var r = 0; r < 7; r++) {
                        var b = CHK[r];
                        for (var c = 0; c < 7; c++) {
                            if ((b & (64 >> c)) != 0) {
                                dc.fillRectangle(rx - 14 * cp + c * csc, y - 2 - 14 * cp + r * csc, csc, csc);
                            }
                        }
                    }
                }
            } else if (fail) {
                dc.setColor(0x666666, -1);
                F.px(dc, "X", rx, y - 9, 2, 1, 0);
            } else {
                dc.setColor(G.dim(col, 0.85), -1);
                F.px(dc, "+" + q[6 + i], rx, y - 9, 2, 1, 0);
            }
        }

        // celebration shown -> clear
        if (celeb > 0 && p >= 1 && !a.so) {
            St.set("celebrate", 0);
            St.set("celebQ", 0);
            _S[4] = 0;
            _S[5] = 0;
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var q = quests(d);
        var S = sync(d, q);
        var o = St.shift(d);
        var cx = 227 + o[0];
        var hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
        dc.setColor(0x9A9A9A, -1);
        F.st(dc, hh + ":" + G.pad2(d.m), cx, 200 + o[1], 76, 3, 1, 1.0, 0);
        var L = levelOf(S[0]);
        dc.setColor(G.dim(d.accent, 0.4), -1);
        dc.setPenWidth(2);
        G.arcC(dc, cx, 227 + o[1], 214, 0, (S[0] - need(L)) * 360.0 / (100.0 * (L + 1)));
        dc.setColor(G.dim(d.accent, 0.6), -1);
        F.px(dc, "LVL " + (L + 1), cx, 116 + o[1], 2, 1, 0);
        for (var i = 0; i < 3; i++) {
            var x = cx - 16 + i * 16;
            var y = 270 + o[1];
            if ((S[1] & (1 << i)) != 0) {
                dc.fillCircle(x, y, 4);
            } else {
                dc.setPenWidth(1);
                dc.drawCircle(x, y, 4);
            }
        }
    }
}
