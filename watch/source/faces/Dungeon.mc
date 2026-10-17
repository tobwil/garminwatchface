import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// DUNGEON — "Dungeon": a side-view pixel JRPG battle. Every day a new monster (Sunday: the
// DRACHE boss) whose HP are today's step target; your steps are the hero's damage. Reach the
// target and it falls: chest, "SIEG!", +1 gold (once per day), victory streak, LV from gold.
// Styles: 1 Verlies, 2 Wald, 3 Lava. Mirrors web/js/faces/dungeon.js.
class FaceDungeon extends Face {
    const SC = 4;
    const GY = 292;
    const HX = 84;
    const MX = 318;
    const NAMES = ["SCHLEIM", "SKELETT", "FLEDERMAUS", "GOBLIN", "PILZLING", "GOLEM", "DRACHE"];
    const FAC = [80, 100, 130];
    const MPAL = [
        [0x0B1A10, 0x8AF27E, 0x3FBF5A, 0x1F7A3C, -1, -1, -1, -1, -1, 0xFFFFFF],
        [0x140F1E, 0xEEEADC, 0xB4AE9C, 0x6A6454, -1, 0xFF3A2A, -1, -1, -1, 0xFFFFFF, 0x8A8E9A],
        [0x120A1E, 0x9A6AD8, 0x5E3C96, 0x3A2466, -1, 0xFFE040, -1, -1, -1, 0xFFFFFF],
        [0x0E140A, 0x9AD04E, 0x5E9A30, 0x3A5A22, 0xF0C040, 0xFFE040, -1, -1, -1, 0xFFFFFF, 0x8A5A2C, 0x5A3A1C],
        [0x1A0A0A, 0xF6E8CC, 0xC8B08A, -1, -1, 0xE8402E, 0x9A1E2A, -1, -1, 0xFFFFFF, 0x8A5A2C],
        [0x121214, 0xA09A8C, 0x726E64, 0x48443E, -1, 0x5AEAFF, -1, -1, -1, -1, -1, -1, 0x6AB84A, 0x3E7A2E],
        [0x1A0606, 0xD8432C, 0x9A2418, 0x5C2A6E, 0xF2B440, 0xFFE040, -1, -1, -1, 0xFFF4D8]
    ];
    const WHITE = [0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF];
    const CPAL = [0x1A0F08, -1, -1, -1, 0xD08A2C, -1, -1, -1, 0xF2C040, 0xFFF6C0, 0x9A5A24, 0x6A3A18];
    const FPAL = [-1, 0xFFF6C8, 0xFFD84A, 0xFF8A1E, 0xD8401A];
    const COINPAL = [0x2A1A04, 0xFFF6C0, 0xF2C040, 0xA8741A];
    const SHD = [0x16131E, 0x14281A, 0x160C0E];
    const WIN = [0x2C3C9E, 0x111A56, 0xE4E8F4, 0x1E5C4C, 0x0A2A22, 0xE0F0E4, 0x6A2018, 0x260A08, 0xF4E0C0];
    const SKY = [0x060A1E, 0x0A1230, 0x0E1A40, 0x14244E, 0x1A2E58];
    const WALL = [0x110607, 0x170808, 0x1F0A0A, 0x2A0E0C, 0x3A140E];
    const TST = [227, 126, 6, 196, 126, 3, 262, 126, 4, 62, 84, 6, 392, 84, 6, 40, 140, 3, 416, 140, 3];
    const CRG = [24, 7, 92, 4, 176, 3, 236, 5, 300, 3, 372, 6, 440, 8];
    const VEIN = [20, 226, 24, 234, 28, 242, 368, 214, 372, 222, 376, 230, 380, 238, 440, 182, 436, 190, 440, 198, 88, 226, 92, 234];

    hidden var _sKey = -1;
    hidden var _S = [0, 0, 0] as Array<Number>;
    hidden var _hAcc = -1;
    hidden var _hPal = [] as Array<Number>;

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

    // today's monster index (Sunday = dragon boss)
    hidden function monster(d as D) as Number {
        if (d.dow == 0) {
            return 6;
        }
        var s = G.rnd(G.rnd(d.year * 1000 + d.doy));
        return (s / 4096) % 6;
    }

    hidden function target(d as D, m) as Number {
        var g = d.stepGoal > 0 ? d.stepGoal : 10000;
        var t = (g * FAC[G.clamp(d.cfg.quest, 0, 2)] * (m == 6 ? 120 : 100)) / 100000 * 10;
        return t < 10 ? 10 : t;
    }

    hidden function levelOf(gold) as Number {
        var L = 0;
        while ((L + 1) * (L + 2) / 2 <= gold) {
            L++;
        }
        return L + 1;
    }

    hidden function msprite(m, f) as ByteArray {
        if (m == 0) { return f == 1 ? SprDungeon.SLIME_B : SprDungeon.SLIME_A; }
        if (m == 1) { return f == 1 ? SprDungeon.SKEL_B : SprDungeon.SKEL; }
        if (m == 2) { return f == 1 ? SprDungeon.BAT_B : SprDungeon.BAT_A; }
        if (m == 3) { return f == 1 ? SprDungeon.GOBLIN_B : SprDungeon.GOBLIN; }
        if (m == 4) { return f == 1 ? SprDungeon.SHROOM_B : SprDungeon.SHROOM; }
        if (m == 5) { return f == 1 ? SprDungeon.GOLEM_B : SprDungeon.GOLEM; }
        return f == 1 ? SprDungeon.DRAGON_B : SprDungeon.DRAGON;
    }

    // persistent state -> [gold, streak, wonToday]
    hidden function sync(d as D, m) as Array<Number> {
        var key = d.doy * 100000 + d.steps;
        if (key == _sKey) {
            return _S;
        }
        _sKey = key;
        var today = dayKey(d);
        var won = d.steps >= target(d, m);
        var day = St.get("dgDay", -1);
        var gold = St.get("dgGold", 0);
        var ser = St.get("dgSer", 0);
        if (won && day != today) {
            gold += 1;
            ser = day == yKey(d) ? ser + 1 : 1;
            day = today;
            St.set("dgGold", gold);
            St.set("dgSer", ser);
            St.set("dgDay", today);
        }
        if (day != today && day != yKey(d)) {
            ser = 0;
        }
        _S = [gold, ser, won ? 1 : 0] as Array<Number>;
        return _S;
    }

    // half chord of the display circle for a band y..y+h
    hidden function chord(y, h) {
        var a = (y - 227).abs();
        var b = (y + h - 227).abs();
        var dy = a > b ? a : b;
        return dy >= 227 ? 0.0 : Math.sqrt(227 * 227 - dy * dy);
    }

    // filled pixel circle made of horizontal bands (unit u)
    hidden function pxc(dc as Dc, cx, cy, r, u) as Void {
        for (var y = -r; y < r; y += u) {
            var m = y + u / 2.0;
            var q = r * r - m * m;
            var hw = (Math.floor(Math.sqrt(q > 0 ? q : 0) / u + 0.5) * u).toNumber();
            if (hw > 0) {
                dc.fillRectangle(cx - hw, cy + y, hw * 2, u);
            }
        }
    }

    // JRPG window: black rim, light border (pixel-rounded corners), banded gradient fill
    hidden function win(dc as Dc, x, y, w, h, st) as Void {
        var c0 = WIN[(st - 1) * 3];
        var c1 = WIN[(st - 1) * 3 + 1];
        var cb = WIN[(st - 1) * 3 + 2];
        dc.setColor(0x000000, -1);
        dc.fillRectangle(x + 2, y, w - 4, h);
        dc.fillRectangle(x, y + 2, w, h - 4);
        dc.setColor(cb, -1);
        dc.fillRectangle(x + 4, y + 2, w - 8, h - 4);
        dc.fillRectangle(x + 2, y + 4, w - 4, h - 8);
        var ih = h - 10;
        for (var i = 0; i < 4; i++) {
            var y0 = y + 5 + Math.floor(ih * i / 4.0).toNumber();
            var y1 = y + 5 + Math.floor(ih * (i + 1) / 4.0).toNumber();
            dc.setColor(G.mix(c0, c1, i / 3.0), -1);
            dc.fillRectangle(x + 5, y0, w - 10, y1 - y0);
        }
    }

    // pixel bar with highlight
    hidden function bar(dc as Dc, x, y, w, h, f, col) as Void {
        dc.setColor(0x05060F, -1);
        dc.fillRectangle(x, y, w, h);
        var fw = Math.round((w - 2) * G.clamp(f, 0.0, 1.0)).toNumber();
        if (fw > 0) {
            dc.setColor(col, -1);
            dc.fillRectangle(x + 1, y + 1, fw, h - 2);
            dc.setColor(G.mix(col, 0xFFFFFF, 0.45), -1);
            dc.fillRectangle(x + 1, y + 1, fw, 2);
        }
    }

    hidden function torch(dc as Dc, x, y, t, k) as Void {
        var n = G.noise(t / 160.0 + k * 3.7);
        var fr = n > 0.3 ? SprDungeon.FL_B : (n < -0.3 ? SprDungeon.FL_C : SprDungeon.FL_A);
        dc.setColor(0x4A4A56, -1);
        dc.fillRectangle(x - 10, y + 28, 20, 4);
        dc.fillRectangle(x - 6, y + 32, 12, 4);
        dc.setColor(0x2A2A32, -1);
        dc.fillRectangle(x - 2, y + 36, 4, 20);
        Spr.draw(dc, fr, x - 10, y, 4, FPAL, false);
    }

    hidden function bgVerlies(dc as Dc, t, live) as Void {
        var base = 0x2A2636;
        var mort = 0x14121B;
        var hil = 0x37324A;
        dc.setColor(base, -1);
        dc.fillRectangle(0, 0, 454, GY - 4);
        // torch glow (warm bricks), flickering radius
        for (var k = 0; k < 2; k++) {
            var tx = k == 0 ? 40 : 414;
            var fl = live ? Math.round(G.noise(t / 210.0 + k * 5.1) * 1.4).toNumber() * 4 : 0;
            dc.setColor(G.mix(base, 0x7A4220, 0.22), -1);
            pxc(dc, tx, 228, 64 + fl, 8);
            dc.setColor(G.mix(base, 0x8A4A22, 0.42), -1);
            pxc(dc, tx, 228, 40 + fl, 8);
        }
        // bricks 36x16 + 4 mortar
        for (var r = 0; r < 15; r++) {
            var y = r * 20 - 8;
            if (y >= GY - 4) {
                break;
            }
            var hc = chord(y, 20);
            if (hc <= 0) {
                continue;
            }
            var xa = Math.floor(227 - hc).toNumber();
            var xb = Math.ceil(227 + hc).toNumber();
            var hb = y + 20 < GY - 4 ? y + 20 : GY - 4;
            dc.setColor(hil, -1);
            if (y + 4 <= hb) {
                dc.fillRectangle(xa, y, xb - xa, 4);
            }
            dc.setColor(mort, -1);
            if (y + 20 <= GY - 4) {
                dc.fillRectangle(xa, y + 16, xb - xa, 4);
            }
            // joints (skip the ones hidden behind the time window)
            var hid = y >= 48 && y + 20 <= 126;
            for (var x = (r % 2) * 20 + 6; x < xb; x += 40) {
                if (x + 4 < xa || (hid && x > 92 && x < 358)) {
                    continue;
                }
                dc.fillRectangle(x, y, 4, hb - y > 16 ? 16 : hb - y);
            }
        }
        // floor flagstones
        dc.setColor(0x1B1824, -1);
        dc.fillRectangle(0, GY - 4, 454, 454 - GY + 4);
        dc.setColor(0x3C3650, -1);
        dc.fillRectangle(0, GY - 4, 454, 4);
        dc.setColor(0x100E16, -1);
        dc.fillRectangle(0, GY + 6, 454, 4);
        dc.fillRectangle(0, 396, 454, 4);
        dc.fillRectangle(0, 424, 454, 4);
        for (var i = 0; i < 6; i++) {
            dc.fillRectangle(30 + i * 80, GY, 4, 6);
            dc.fillRectangle(10 + i * 96, 400, 4, 24);
        }
        torch(dc, 40, 196, live ? t : 0, 0);
        torch(dc, 414, 196, live ? t + 700 : 0, 1);
    }

    hidden function pine(dc as Dc, x, base, h, col) as Void {
        dc.setColor(col, -1);
        var n = h / 12;
        for (var k = 0; k < n; k++) {
            var hw = Math.floor(h * 0.36 * (n - k) / n / 4).toNumber() * 4 + 4;
            dc.fillRectangle(x - hw, base - (k + 1) * 12, hw * 2, 12);
        }
        dc.fillRectangle(x - 4, base - 12 * n - 8, 8, 8);
    }

    hidden function bgWald(dc as Dc, t, live) as Void {
        for (var i = 0; i < 5; i++) {
            dc.setColor(SKY[i], -1);
            dc.fillRectangle(0, i * 56, 454, 56);
        }
        // moon + stars
        dc.setColor(0xE8ECD0, -1);
        pxc(dc, 60, 112, 20, 4);
        dc.setColor(0x0A1230, -1);
        pxc(dc, 70, 106, 16, 4);
        for (var i = 0; i < 9; i++) {
            var s = G.rnd(i * 977 + 31);
            var sx = 30 + (s % 394);
            s = G.rnd(s);
            var sy = 130 + (s % 70);
            var tw = live ? (t / 300 + i * 3) % 7 : 1;
            dc.setColor(tw == 0 ? 0x5A6A8A : 0xC8D4FF, -1);
            dc.fillRectangle(sx - (sx % 4), sy - (sy % 4), 4, 4);
        }
        // far pines + near pines
        for (var i = 0; i < 9; i++) {
            pine(dc, 20 + i * 52 + ((i * 37) % 20), GY - 2, 70 + ((i * 53) % 46), 0x16443C);
        }
        for (var i = 0; i < 5; i++) {
            pine(dc, 50 + i * 90 + ((i * 29) % 30), GY - 2, 50 + ((i * 41) % 30), 0x0E302C);
        }
        pine(dc, 12, GY + 4, 190, 0x06161A);
        pine(dc, 442, GY + 4, 180, 0x06161A);
        // ground
        dc.setColor(0x16301E, -1);
        dc.fillRectangle(0, GY - 4, 454, 454 - GY + 4);
        dc.setColor(0x2E6A34, -1);
        dc.fillRectangle(0, GY - 4, 454, 8);
        dc.setColor(0x3E8A40, -1);
        for (var i = 0; i < 12; i++) {
            var x = 12 + i * 38 + ((i * 17) % 12);
            dc.fillRectangle(x, GY - 8, 4, 4);
            dc.fillRectangle(x + 8, GY - 12, 4, 8);
        }
        dc.setColor(0x10241A, -1);
        dc.fillRectangle(0, GY + 12, 454, 4);
        dc.fillRectangle(0, 404, 454, 4);
        // fireflies
        var tt = live ? t / 1000.0 : 0.0;
        for (var i = 0; i < 7; i++) {
            var x = (Math.floor((40 + i * 58 + G.noise(tt * 0.5 + i * 2.1) * 26) / 4) * 4).toNumber();
            var y = (Math.floor((228 + ((i * 37) % 50) + G.noise(tt * 0.6 + i * 4.3) * 18) / 4) * 4).toNumber();
            var on = live ? G.noise(tt * 1.3 + i * 1.7) > -0.2 : i % 3 != 1;
            if (!on) {
                continue;
            }
            dc.setColor(0x3A5A14, -1);
            dc.fillRectangle(x - 4, y - 4, 12, 12);
            dc.setColor(0xD8FF6A, -1);
            dc.fillRectangle(x, y, 4, 4);
        }
    }

    hidden function bgLava(dc as Dc, t, live) as Void {
        // back wall: warmer towards the lava glow
        for (var i = 0; i < 5; i++) {
            dc.setColor(WALL[i], -1);
            dc.fillRectangle(0, i * 54 - 8, 454, 54);
        }
        // hanging stalactites
        dc.setColor(0x0C0405, -1);
        for (var i = 0; i < TST.size(); i += 3) {
            for (var k = 0; k < TST[i + 2]; k++) {
                var w = (TST[i + 2] - k) * 8;
                dc.fillRectangle(TST[i] - w / 2, TST[i + 1] + k * 10, w, 10);
            }
        }
        // rock crags along the lava
        for (var i = 0; i < CRG.size(); i += 2) {
            var n = CRG[i + 1];
            for (var k = 0; k < n; k++) {
                var w = (n - k) * 12 + 8;
                dc.setColor(k == n - 1 ? 0x4A1C12 : 0x1C0A0A, -1);
                dc.fillRectangle(CRG[i] - w / 2, 262 - (k + 1) * 12, w, 12);
            }
        }
        // glowing cracks
        var gl = live ? 0.55 + 0.45 * G.noise(t / 380.0) : 0.7;
        dc.setColor(G.mix(0x5A1A08, 0xE0601A, gl), -1);
        for (var i = 0; i < VEIN.size(); i += 2) {
            dc.fillRectangle(VEIN[i], VEIN[i + 1], 4, 8);
        }
        // lava lake behind the ledge
        dc.setColor(0xD8400C, -1);
        dc.fillRectangle(0, 262, 454, 30);
        dc.setColor(0xFF8A1E, -1);
        dc.fillRectangle(0, 262, 454, 8);
        dc.setColor(0xFFD060, -1);
        for (var i = 0; i < 9; i++) {
            var x = (i * 52 + (live ? (t / 90) * 4 : 0)) % 470 - 8;
            dc.fillRectangle(x, 262, 16, 4);
        }
        dc.setColor(0x8A1A06, -1);
        dc.fillRectangle(0, 280, 454, 4);
        // bubbles
        for (var i = 0; i < 4; i++) {
            var ph = live ? ((t + i * 530) % 2100) / 2100.0 : 0.3 + i * 0.15;
            var bx = 40 + i * 112 + ((i * 41) % 30);
            var r = 4 + Math.floor(ph * 3).toNumber() * 4;
            if (ph < 0.85) {
                dc.setColor(0xFFB040, -1);
                pxc(dc, bx, 266, r, 4);
                dc.setColor(0xFFF0A0, -1);
                dc.fillRectangle(bx - 4, 262 - r + 4, 4, 4);
            } else {
                dc.setColor(0xFFD060, -1);
                dc.fillRectangle(bx - 12, 250, 4, 4);
                dc.fillRectangle(bx + 8, 246, 4, 4);
                dc.fillRectangle(bx - 2, 240, 4, 4);
            }
        }
        // embers
        if (live) {
            dc.setColor(0xFF9A3A, -1);
            for (var i = 0; i < 6; i++) {
                var ph = ((t + i * 977) % 3000) / 3000.0;
                var x = 60 + i * 64 + Math.floor(G.noise(i * 3.1 + t / 700.0) * 5).toNumber() * 4;
                var y = 262 - Math.floor(ph * 120 / 4).toNumber() * 4;
                dc.fillRectangle(x, y, 4, 4);
            }
        }
        // basalt ledge
        dc.setColor(0x1A1012, -1);
        dc.fillRectangle(0, GY - 4, 454, 454 - GY + 4);
        dc.setColor(0x4A2A24, -1);
        dc.fillRectangle(0, GY - 4, 454, 4);
        dc.setColor(0x2C1A1A, -1);
        for (var i = 0; i < 7; i++) {
            dc.fillRectangle(14 + i * 68, GY + 4, 28, 4);
        }
        dc.fillRectangle(0, 404, 454, 4);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var live = a.live && p >= 1;
        var t = a.t;
        var m = monster(d);
        var tg = target(d, m);
        var S3 = sync(d, m);
        var gold = S3[0];
        var ser = S3[1];
        var won = S3[2] == 1;
        var rem = won ? 0 : tg - d.steps;
        var rf = G.clamp(rem.toFloat() / tg, 0.0, 1.0);

        // ---------------- background
        if (st == 2) {
            bgWald(dc, t, live);
        } else if (st == 3) {
            bgLava(dc, t, live);
        } else {
            bgVerlies(dc, t, live);
        }

        // ---------------- monster / chest
        var ms = msprite(m, 0);
        var mw = ms[0] * SC;
        var mh = ms[1] * SC;
        var mf = 0;
        var mdy = 0;
        var mdx = 0;
        if (live) {
            if (m == 0) {
                mf = (t / 400) % 2;
            } else if (m == 2) {
                mf = (t / 125) % 2;
                mdy = (t / 250) % 2 == 0 ? 0 : 4;
            } else {
                mf = (t / 600) % 2;
            }
        }
        var hov = m == 2 ? 44 : 0;
        // ground shadows
        dc.setColor(SHD[st - 1], -1);
        dc.fillRectangle(HX + 20, GY - 4, 48, 4);
        if (!won || p < 0.72) {
            dc.fillRectangle(MX - mw / 2 + (m == 2 ? 24 : 8), GY - 4, mw - (m == 2 ? 48 : 16), 4);
        } else {
            dc.fillRectangle(MX - 24, GY - 4, 48, 4);
        }
        var mvis = p >= 0.22 && (!won || p < 0.62 || (p < 0.74 && Math.floor(p * 50).toNumber() % 2 == 0));
        if (mvis) {
            var flash = (p >= 0.22 && p < 0.27) || (p >= 0.3 && p < 0.33) || (p >= 0.48 && p < 0.52);
            if (p >= 0.48 && p < 0.62) {
                mdx = Math.floor(p * 60).toNumber() % 2 == 0 ? 4 : -4;
            }
            Spr.draw(dc, msprite(m, mf), MX - mw / 2 + mdx, GY - mh - hov + mdy, SC, flash ? WHITE : MPAL[m], false);
        }
        if (won && p >= 0.72) {
            var cp = G.spring(G.stag(p, 1, 0.72, 0.14));
            var open = p >= 0.86;
            var cs = open ? SprDungeon.CHEST_O : SprDungeon.CHEST_C;
            Spr.draw(dc, cs, MX - 28, GY - cs[1] * SC - Math.round((1 - cp) * 60 / 4).toNumber() * 4, SC, CPAL, false);
            // coins popping out
            if (open && p < 1) {
                var q = (p - 0.86) / 0.14;
                dc.setColor(0xF2C040, -1);
                for (var i = 0; i < 3; i++) {
                    var cx = MX - 4 + (i - 1) * Math.round(q * 9).toNumber() * 4;
                    var cy = GY - 60 - Math.round((q * 4 - q * q * 3.2) * (i == 1 ? 9 : 6)).toNumber() * 4;
                    dc.fillRectangle(cx, cy, 8, 8);
                }
            }
            // sparkles
            if (p >= 1) {
                for (var i = 0; i < 3; i++) {
                    var ph = live ? (t / 180 + i * 3) % 8 : (i == 1 ? 2 : 7);
                    if (ph > 3) {
                        continue;
                    }
                    var sx = MX - 36 + i * 32;
                    var sy = GY - 76 + ((i * 20) % 28);
                    var r = ph == 1 || ph == 2 ? 8 : 4;
                    dc.setColor(ph == 1 || ph == 2 ? 0xFFFFFF : 0xFFF0A0, -1);
                    dc.fillRectangle(sx - 2, sy - r, 4, r * 2);
                    dc.fillRectangle(sx - r, sy - 2, r * 2, 4);
                }
            }
        }

        // ---------------- hero
        var hx = HX;
        var hs = SprDungeon.HERO_A;
        if (p >= 0.36 && p < 0.46) {
            hx = HX + Math.round(G.easeInOut((p - 0.36) / 0.1) * 28).toNumber() * 4;
        } else if (p >= 0.46 && p < 0.6) {
            hx = HX + 112;
            hs = SprDungeon.HERO_ATK;
        } else if (p >= 0.6 && p < 0.72) {
            hx = HX + Math.round((1 - G.easeInOut((p - 0.6) / 0.12)) * 28).toNumber() * 4;
        } else if (live && (t / 500) % 2 == 1) {
            hs = SprDungeon.HERO_B;
        }
        if (_hAcc != acc) {
            _hAcc = acc;
            _hPal = [0x140F1E, 0xDFE6F2, 0x9AA6C2, 0x56607E, 0xF2C294, acc, G.dim(acc, 0.55), 0x3866D0, 0xF2C040, 0xFFFFFF, 0x8A5A2C, 0x4A2E1E] as Array<Number>;
        }
        Spr.draw(dc, hs, hx, GY - hs[1] * SC, SC, _hPal, false);
        // slash streak
        if (p >= 0.47 && p < 0.57) {
            var sp = (p - 0.47) / 0.1;
            for (var k = 0; k < 12; k++) {
                if (k > sp * 15) {
                    break;
                }
                var sx = MX + 48 - k * 8;
                var sy = GY - 108 + k * 8;
                dc.setColor(k > sp * 15 - 4 ? 0xFFFFFF : G.mix(acc, 0xFFFFFF, 0.35), -1);
                dc.fillRectangle(sx, sy, 8, 8);
                dc.setColor(G.mix(acc, 0xFFFFFF, 0.6), -1);
                dc.fillRectangle(sx + 8, sy - 4, 4, 4);
            }
        }
        // victory banner
        if (won && p >= 0.8) {
            var vs = G.spring(G.stag(p, 1, 0.8, 0.15));
            var sc = Math.round(4 * vs).toNumber();
            if (sc < 1) {
                sc = 1;
            }
            dc.setColor(0x3A1A00, -1);
            F.px(dc, "SIEG!", 230, 236 - 3 * sc, sc, 1, 0);
            dc.setColor(0xFFD040, -1);
            F.px(dc, "SIEG!", 227, 233 - 3 * sc, sc, 1, 0);
        }

        // ---------------- time window + date tag
        win(dc, 92, 48, 270, 78, st);
        var ts = G.timeStr(d);
        var wb = WIN[(st - 1) * 3 + 1];
        dc.setColor(wb == 0x111A56 ? 0x0A0E30 : G.dim(wb, 0.6), -1);
        F.px(dc, ts, 231, 63, 8, 1, 0);
        dc.setColor(0xFFFFFF, -1);
        F.px(dc, ts, 227, 59, 8, 1, 0);
        var ds = d.dowStr + " " + d.day + ". " + d.monStr;
        var dw = F.pxW(ds, 2) + 20;
        win(dc, 227 - dw / 2, 116, dw, 24, st);
        dc.setColor(0xD8DCE8, -1);
        F.px(dc, ds, 227, 121, 2, 1, 0);

        // ---------------- hero status
        win(dc, 50, 142, 136, 62, st);
        dc.setColor(0xFFFFFF, -1);
        F.px(dc, "HELD", 60, 151, 2, 0, 0);
        dc.setColor(0xFFD040, -1);
        F.px(dc, "LV" + levelOf(gold), 176, 151, 2, 2, 0);
        var hp = d.bb;
        var mp = d.stress >= 0 ? 100 - d.stress : -1;
        var bp = G.ease(G.stag(p, 1, 0.3, 0.4));
        dc.setColor(0xA8B0C8, -1);
        F.px(dc, "HP", 60, 168, 2, 0, 0);
        F.px(dc, "MP", 60, 184, 2, 0, 0);
        bar(dc, 86, 170, 50, 10, (hp < 0 ? 0.0 : hp / 100.0) * bp, hp < 25 ? 0xFF5A3A : 0x48D860);
        bar(dc, 86, 186, 50, 10, (mp < 0 ? 0.0 : mp / 100.0) * bp, 0x4A9AFF);
        dc.setColor(0xFFFFFF, -1);
        F.px(dc, hp < 0 ? "--" : "" + hp, 176, 168, 2, 2, 0);
        F.px(dc, mp < 0 ? "--" : "" + mp, 176, 184, 2, 2, 0);

        // ---------------- monster status
        win(dc, 268, 142, 136, 62, st);
        dc.setColor(m == 6 ? 0xFF6A4A : 0xFFFFFF, -1);
        F.px(dc, NAMES[m], 336, 151, 2, 1, 0);
        var hf = G.lerp(1.0, rf, G.easeInOut(G.stag(p, 1, 0.5, 0.3)));
        bar(dc, 278, 170, 116, 10, hf, hf > 0.5 ? 0x48D860 : (hf > 0.25 ? 0xF0C040 : 0xFF4A3D));
        if (won && p >= 0.75) {
            dc.setColor(0x60E070, -1);
            F.px(dc, "BESIEGT", 336, 185, 2, 1, 0);
        } else {
            dc.setColor(0xA8B0C8, -1);
            F.px(dc, m == 6 ? "BOSS" : "HP", 278, 185, 2, 0, 0);
            dc.setColor(0xFFFFFF, -1);
            F.px(dc, G.num(Math.round(tg * hf)), 394, 185, 2, 2, 0);
        }

        // ---------------- battle log
        win(dc, 76, 302, 302, 84, st);
        var l1;
        var l2;
        if (won) {
            l1 = NAMES[m] + " besiegt!";
            l2 = "Beute: +1 Gold";
        } else {
            l1 = NAMES[m] + (rf > 0.75 ? " erscheint!" : (rf > 0.25 ? " greift an!" : " wankt!"));
            l2 = "Noch " + G.num(rem) + " Schritte";
        }
        var n1 = Math.floor(l1.length() * G.stag(p, 1, 0.55, 0.22)).toNumber();
        var n2 = Math.floor(l2.length() * G.stag(p, 1, 0.75, 0.22)).toNumber();
        dc.setColor(0xFFFFFF, -1);
        if (n1 > 0) {
            F.px(dc, l1.substring(0, n1) as String, 90, 312, 2, 0, 0);
        }
        dc.setColor(won ? 0xFFD040 : 0xD8DCE8, -1);
        if (n2 > 0) {
            F.px(dc, l2.substring(0, n2) as String, 90, 333, 2, 0, 0);
        }
        // footer: gold + streak + cursor
        dc.setColor(G.mix(wb, 0xFFFFFF, 0.25), -1);
        dc.fillRectangle(88, 354, 278, 2);
        Spr.draw(dc, SprDungeon.COIN, 100, 361, 2, COINPAL, false);
        dc.setColor(0xFFD040, -1);
        F.px(dc, gold + " Gold", 116, 361, 2, 0, 0);
        Spr.draw(dc, SprDungeon.FL_A, 216, 361, 2, FPAL, false);
        dc.setColor(ser > 0 ? 0xFFFFFF : 0x8890A8, -1);
        F.px(dc, ser + (ser == 1 ? " Sieg" : " Siege"), 232, 361, 2, 0, 0);
        if (p >= 1 && (!live || (t / 500) % 2 == 0)) {
            dc.setColor(acc, -1);
            dc.fillRectangle(350, 364, 10, 2);
            dc.fillRectangle(352, 366, 6, 2);
            dc.fillRectangle(354, 368, 2, 2);
        }

        // damage number
        if (p >= 0.53 && p < 0.94) {
            var dp = G.stag(p, 1, 0.53, 0.16);
            var sc = Math.round(1 + 3 * G.spring(dp)).toNumber();
            if (sc < 1) {
                sc = 1;
            }
            var dstr = d.steps > 0 ? "-" + d.steps : "VERFEHLT";
            var dy = GY - mh / 2 - hov - 24 - Math.round(G.ease((p - 0.5) / 0.44) * 5).toNumber() * 4;
            dc.setColor(0x000000, -1);
            F.px(dc, dstr, MX + 3, dy + 3, sc, 1, 0);
            dc.setColor(d.steps > 0 ? 0xFFFFFF : 0xA0A0A0, -1);
            F.px(dc, dstr, MX, dy, sc, 1, 0);
        }

        // ---------------- intro: battle wipe (horizontal bars)
        if (p < 0.3) {
            dc.setColor(0x000000, -1);
            for (var i = 0; i < 10; i++) {
                var e = G.easeInOut(G.stag(p, i, 0.012, 0.16));
                var w = Math.round(454 * (1 - e)).toNumber();
                if (w <= 0) {
                    continue;
                }
                dc.fillRectangle(i % 2 == 0 ? 0 : 454 - w, i * 46, w, 46);
            }
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var m = monster(d);
        var tg = target(d, m);
        var won = d.steps >= tg;
        dc.setColor(0x8A8E9E, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 70 + o[1], 8, 1, 2);
        dc.setColor(0x6A6E7E, -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227 + o[0], 140 + o[1], 2, 1, 0);
        var out = [0x4A5468, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
        Spr.draw(dc, SprDungeon.HERO_A, HX + o[0], GY - 80 + o[1], SC, out, false);
        if (won) {
            out[0] = 0x6A5A2A;
            Spr.draw(dc, SprDungeon.CHEST_C, MX - 28 + o[0], GY - 44 + o[1], SC, out, false);
        } else {
            var ms = msprite(m, 0);
            out[0] = G.dim(m == 6 ? 0xFF4A3D : d.accent, 0.45);
            Spr.draw(dc, ms, MX - ms[0] * SC / 2 + o[0], GY - ms[1] * SC - (m == 2 ? 44 : 0) + o[1], SC, out, false);
        }
        dc.setColor(0x2A2C36, -1);
        for (var x = 60; x < 400; x += 12) {
            dc.fillRectangle(x + o[0], GY + 4 + o[1], 4, 4);
        }
        dc.setColor(won ? 0x8A7430 : 0x6A6E7E, -1);
        F.px(dc, won ? "SIEG!" : "Noch " + G.num(tg - d.steps), 227 + o[0], 322 + o[1], 2, 1, 0);
    }
}
