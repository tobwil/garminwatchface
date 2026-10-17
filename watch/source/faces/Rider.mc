import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// RIDER — "Pixel Rider": an 8-bit side-scroller. A pixel cyclist pedals in place while
// parallax layers (far mountains, pine hills, road) scroll by — faster when the heart rate
// is up. Sky, sun and moon follow the real sun elevation. The weekly goal is a stage
// ("ETAPPE") with a finish flag; reaching it brings a finish banner and confetti.
// Styles: 1 Tag & Nacht, 2 Gameboy, 3 Neon. Mirrors web/js/faces/rider.js.
class FaceRider extends Face {
    const P = 4;
    const RX = 164;
    const RY = 268;
    const BAND = [0, 100, 152, 196, 232, 300];
    const FAR = [6, 18, 3, 2, 31, 14, 2, 2, 52, 21, 2, 3, 79, 16, 3, 2, 104, 19, 2, 2];
    const HILL = [8, 7, -3, 1, 27, 10, -5, 2, 45, 6, -1, 3, 62, 9, -4, 0, 81, 8, -2, 4];
    const HW = [2, 4, 5, 6, 7, 8, 8, 9, 9, 10, 10];
    const K_NIGHT = [0x050818, 0x0A1230, 0x111C42, 0x18264F, 0x22305A, 0x1D2546, 0x151B36, 0x6A7898, 0x0F2A26, 0x1A3C34, 0x0A1C18, 0x12301E, 0x1A1C26, 0x6E7080, 0x0A0A10, 0x6A2A30, 0x283258, 0x1A2242];
    const K_DUSK = [0x141A44, 0x2A2862, 0x553A7A, 0x8A4A7C, 0xC0607A, 0x3A3462, 0x2A2650, 0xB0A0C8, 0x1E3E38, 0x2E5A4C, 0x13281F, 0x234628, 0x2A2A38, 0xB4B0C0, 0x120E16, 0xA03A3A, 0x7A5A8A, 0x4E3E70];
    const K_GOLD = [0x2C3A8A, 0x6A4A9A, 0xD0607A, 0xF48C4C, 0xFFC46A, 0x6A5288, 0x4E3C6C, 0xFFD2A8, 0x3C6E34, 0x6A9A3C, 0x1F3E22, 0x5A8A2C, 0x3E3A4A, 0xFFE8C8, 0x22160E, 0xD04030, 0xFFCAB0, 0xE0849A];
    const K_DAY = [0x2A6AD8, 0x3A82E6, 0x56A0F0, 0x7ABCF6, 0xA8D8FC, 0x6880B8, 0x4E6498, 0xF2F6FF, 0x3FA34A, 0x7CCF5A, 0x1E6A34, 0x58C03C, 0x4A4C56, 0xF4F4F4, 0x2E2016, 0xE03A3A, 0xFFFFFF, 0xCFE2F6];
    const GB = [0x0F380F, 0x306230, 0x8BAC0F, 0x9BBC0F];
    const GB_DAY = [3, 3, 3, 3, 3, 2, 2, 3, 1, 2, 0, 1, 1, 3, 0, 0, 2, 1];
    const GB_NIGHT = [0, 0, 0, 0, 0, 1, 1, 2, 0, 1, 1, 0, 1, 2, 0, 2, 1, 0];
    const MAG = 0xFF2BD6;
    const CYA = 0x18E0FF;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 12;
    }

    // scene palette for sun elevation el
    hidden function scenePal(st, el) as Array<Number> {
        var out = new [18] as Array<Number>;
        if (st == 2) {
            var m = el > -3 ? GB_DAY : GB_NIGHT;
            for (var i = 0; i < 18; i++) {
                out[i] = GB[m[i]];
            }
            return out;
        }
        if (st == 3) {
            return [0x000000, 0x000000, 0x000000, 0x06000C, 0x12001E, 0x000000, -1, -1, 0x000000, CYA, G.dim(CYA, 0.55), 0x000000, 0x000000, 0xE8E8FF, 0x000000, MAG, 0x000000, G.dim(MAG, 0.45)] as Array<Number>;
        }
        var a = K_NIGHT;
        var b = K_NIGHT;
        var f = 0.0;
        if (el >= 12) {
            a = K_DAY;
            b = K_DAY;
        } else if (el >= 3) {
            a = K_GOLD;
            b = K_DAY;
            f = (el - 3) / 9.0;
        } else if (el >= -3) {
            a = K_DUSK;
            b = K_GOLD;
            f = (el + 3) / 6.0;
        } else if (el >= -10) {
            a = K_NIGHT;
            b = K_DUSK;
            f = (el + 10) / 7.0;
        }
        for (var i = 0; i < 18; i++) {
            out[i] = G.mix(a[i], b[i], f);
        }
        return out;
    }

    hidden function q4(v) as Number {
        return Math.floor(v / 4.0).toNumber() * P;
    }

    // one row of a stepped layer shape: fill, optional rim edge (cells cl..cr, previous row pl..pr)
    hidden function lrow(dc as Dc, ox, y, cl, cr, pl, pr, top, fill, edge) as Void {
        dc.setColor(fill, -1);
        dc.fillRectangle(ox + cl * P, y, (cr - cl + 1) * P, P);
        if (edge == -1) {
            return;
        }
        dc.setColor(edge, -1);
        if (top) {
            dc.fillRectangle(ox + cl * P, y, (cr - cl + 1) * P, P);
            return;
        }
        dc.fillRectangle(ox + cl * P, y, (pl - cl + 1) * P, P);
        dc.fillRectangle(ox + pr * P, y, (cr - pr + 1) * P, P);
    }

    hidden function mountain(dc as Dc, sx, i, pal as Array<Number>, st) as Void {
        var h = FAR[i + 1];
        var sl = FAR[i + 2];
        var sr = FAR[i + 3];
        var top = 288 - h * P;
        var sn = h / 5 + 1;
        var edge = st == 3 ? MAG : (st == 2 ? (pal[0] == GB[0] ? GB[2] : GB[1]) : -1);
        for (var r = 0; r < h; r++) {
            var y = top + r * P;
            var cl = -((r * sl) / 2);
            var cr = (r * sr) / 2;
            var pl = r > 0 ? -(((r - 1) * sl) / 2) : 0;
            var pr = r > 0 ? ((r - 1) * sr) / 2 : 0;
            lrow(dc, sx, y, cl, cr, pl, pr, r == 0, pal[5], edge);
            if (st == 3) {
                continue;
            }
            if (cr > 0 && pal[6] != pal[5]) {
                dc.setColor(pal[6], -1);
                dc.fillRectangle(sx + P, y, cr * P, P);
            }
            if (r < sn) {
                dc.setColor(pal[7], -1);
                dc.fillRectangle(sx + cl * P, y, (cr - cl + 1) * P, P);
            } else if (r == sn) {
                dc.setColor(pal[7], -1);
                dc.fillRectangle(sx - ((-cl) / 2) * P, y, P, P);
                dc.fillRectangle(sx, y, P, P);
                dc.fillRectangle(sx + (cr / 2) * P, y, P, P);
            }
        }
    }

    hidden function hill(dc as Dc, sx, i, pal as Array<Number>, st) as Void {
        var h = HILL[i + 1];
        var top = 284 - h * P;
        for (var r = 0; r < h; r++) {
            var w = HW[r];
            var pw = r > 0 ? HW[r - 1] : 0;
            lrow(dc, sx, top + r * P, -w, w, -pw, pw, r == 0, pal[8], pal[9]);
        }
        // pines
        var pp = st == 2 ? [pal[10], pal[9], pal[10]] : (st == 3 ? [pal[10], pal[10], -1] : [pal[10], pal[9], 0x5A3A22]);
        for (var k = 2; k < 4; k++) {
            var dx = HILL[i + k];
            var adx = dx < 0 ? -dx : dx;
            var r = 0;
            while (r < h - 1 && HW[r] < adx + 1) {
                r++;
            }
            Spr.draw(dc, SprRider.PINE, sx + (dx - 2) * P, top + r * P - 3 * P, P, pp, false);
        }
    }

    // x position of an element at world cell cx in a layer of period per (px), offset off
    hidden function wrapX(cx, off, per) as Number {
        return (((cx * P - off) % per) + per) % per;
    }

    hidden function riderPal(st, acc) as Array<Number> {
        if (st == 2) {
            return [GB[0], GB[3], GB[2], GB[3], GB[3], GB[0], GB[2], GB[2], GB[2], GB[0], GB[0]] as Array<Number>;
        }
        if (st == 3) {
            return [MAG, acc, 0xFFE0D0, CYA, CYA, 0x5A1A80, G.dim(CYA, 0.6), G.dim(acc, 0.6), 0x9A7A90, MAG, CYA] as Array<Number>;
        }
        return [0x16161E, acc, 0xF2B98A, 0xFFFFFF, 0x2EC4F0, 0x23232E, 0xB8B8C4, G.dim(acc, 0.7), 0xB07850, 0xE03A3A, 0x2A2A2A] as Array<Number>;
    }

    // progress: [value, goal, label text]
    hidden function stage(d as D) as Array {
        if (d.src == 0) {
            var v = d.floorsWeek > 0 ? d.floorsWeek * 3 : 0;
            return [v, 1071, "HM " + v + "/1071"];
        }
        if (d.src == 2) {
            var v = d.trainDays > 0 ? d.trainDays : 0;
            var g = d.dayGoal > 0 ? d.dayGoal : 4;
            return [v, g, "TAGE " + v + "/" + g];
        }
        var km = d.wkBike > 0 ? (d.wkBike / 1000).toNumber() : 0;
        var g = d.cfg.bikeGoal > 0 ? d.cfg.bikeGoal : 150;
        return [km, g, "KM " + km + "/" + g];
    }

    hidden function timeStr(d as D) as String {
        return (d.is24 ? G.pad2(d.h) : "" + G.hour(d)) + ":" + G.pad2(d.m);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var tt = a.live ? a.t : 1400;
        var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var pal = scenePal(st, el);
        var night = el < -3;
        // speed from heart rate
        var v = 1.0;
        if (d.hr > 0 && d.rhr > 0) {
            v = 1 + G.clamp((d.hr - d.rhr) / 45.0, 0.0, 2.0);
        }
        // distance travelled (px): steady ride + a decelerating fast-forward during the intro
        var dist = 72 * v * tt / 1000.0 + 640 * G.ease(tt / 1400.0);

        // ---------------- sky
        for (var i = 0; i < 5; i++) {
            dc.setColor(pal[i], -1);
            dc.fillRectangle(0, BAND[i], 454, BAND[i + 1] - BAND[i]);
        }
        // stars
        var sf = st == 3 ? 0.8 : G.clamp((-2 - el) / 6.0, 0.0, 1.0);
        if (sf > 0) {
            var s = 7;
            for (var i = 0; i < 20; i++) {
                s = G.rnd(s);
                var x = 24 + (s % 102) * P;
                s = G.rnd(s);
                var y = 8 + (s % 56) * P;
                var tw = (a.live && (tt / 300 + i) % 7 == 0) ? 0.35 : 1.0;
                var b = (0.35 + (i % 3) * 0.3) * sf * tw;
                dc.setColor(st == 2 ? GB[2] : G.mix(pal[1], 0xFFFFFF, b), -1);
                dc.fillRectangle(x, y, P, P);
            }
        }
        // sun / moon
        var rise = d.sunrise;
        var set = d.sunset;
        if (st == 3 && el > -6) {
            // synthwave sun behind the mountains
            for (var r = 0; r < 26; r++) {
                if (r > 12 && r % 3 == 0) {
                    continue;
                }
                var dy = r - 12.5;
                var hw = Math.floor(Math.sqrt(169 - dy * dy)).toNumber();
                dc.setColor(G.mix(acc, MAG, r / 25.0), -1);
                dc.fillRectangle(227 - hw * P, 184 + r * P, hw * 2 * P, P);
            }
        } else if (el > -3) {
            var f = 0.5;
            if (rise >= 0 && set > rise) {
                f = G.clamp((d.mins - rise) / (set - rise), 0.0, 1.0);
            }
            var sx = q4(72 + f * 310) - 16;
            var sy = q4(G.clamp(268 - el * 4.5, 172, 300)) - 16;
            var gf = G.clamp((10 - el) / 12.0, 0.0, 1.0);
            var sp = st == 2 ? [GB[0], GB[2], GB[3]] : [G.mix(0xFFC83A, 0xFF5A28, gf), G.mix(0xFFF2A0, 0xFF9A3A, gf), G.mix(0xFFFFFF, 0xFFD080, gf)];
            Spr.draw(dc, SprRider.SUN, sx, sy, P, sp, false);
        } else if (d.moon > 0.05 && d.moon < 0.95) {
            var f = 0.5;
            if (rise >= 0 && set >= 0) {
                var m = d.mins - set;
                if (m < 0) {
                    m += 1440;
                }
                f = G.clamp(m / (rise + 1440 - set), 0.0, 1.0);
            }
            var mx = q4(72 + f * 310) - 14;
            var my = q4(160 + (1 - Math.sin(f * Math.PI)) * 70) - 14;
            var lit = st == 2 ? GB[3] : (st == 3 ? CYA : 0xF4F1D0);
            Spr.draw(dc, SprRider.MOON, mx, my, P, [lit, st == 2 ? GB[2] : (st == 3 ? CYA : 0xC8C3A0)], false);
            if (d.moon < 0.35 || d.moon > 0.65) {
                Spr.draw(dc, SprRider.MOON_C, mx, my, P, [pal[1]], d.moon > 0.5);
            }
        }
        // clouds (drift with the wind, a little parallax)
        if (st != 3) {
            var co = q4((tt * 0.006 + dist * 0.05).toNumber() % 640);
            var cp = [pal[16], pal[17]];
            Spr.draw(dc, SprRider.CLOUD_A, ((560 - co + 640) % 640) - 80, 160, P, cp, false);
            Spr.draw(dc, SprRider.CLOUD_B, ((300 - co + 640) % 640) - 80, 184, P, cp, false);
            Spr.draw(dc, SprRider.CLOUD_A, ((90 - co + 640) % 640) - 80, 208, P, cp, true);
        }

        // ---------------- far mountains (period 512 px)
        var fo = q4(dist * 0.12);
        for (var i = 0; i < FAR.size(); i += 4) {
            var sx = wrapX(FAR[i], fo, 512);
            if (sx - 130 < 454) {
                mountain(dc, sx, i, pal, st);
            }
            if (sx + 130 > 512) {
                mountain(dc, sx - 512, i, pal, st);
            }
        }
        // ---------------- hills strip + pine hills (period 384 px)
        dc.setColor(pal[8], -1);
        dc.fillRectangle(0, 284, 454, 16);
        if (st == 3) {
            dc.setColor(CYA, -1);
            dc.fillRectangle(0, 284, 454, P);
        }
        var ho = q4(dist * 0.35);
        for (var i = 0; i < HILL.size(); i += 4) {
            var sx = wrapX(HILL[i], ho, 384);
            if (sx - 48 < 454) {
                hill(dc, sx, i, pal, st);
            }
            if (sx + 48 > 384) {
                hill(dc, sx - 384, i, pal, st);
            }
        }

        // ---------------- road
        var ro = q4(dist);
        dc.setColor(pal[12], -1);
        dc.fillRectangle(0, 300, 454, 44);
        if (st == 3) {
            dc.setColor(acc, -1);
            dc.fillRectangle(0, 300, 454, P);
            dc.setColor(CYA, -1);
            dc.fillRectangle(0, 340, 454, P);
        } else {
            // red/white kerb along the far edge, plain line on the near edge
            dc.setColor(pal[13], -1);
            dc.fillRectangle(0, 300, 454, 8);
            dc.setColor(pal[15], -1);
            for (var x = -(ro % 32); x < 454; x += 32) {
                dc.fillRectangle(x, 300, 16, 8);
            }
            dc.setColor(st == 2 ? GB[2] : G.mix(pal[12], pal[13], 0.45), -1);
            dc.fillRectangle(0, 340, 454, P);
        }
        dc.setColor(st == 3 ? MAG : pal[13], -1);
        for (var x = -(ro % 64); x < 454; x += 64) {
            dc.fillRectangle(x, 320, 28, P);
        }
        // panel
        dc.setColor(pal[14], -1);
        dc.fillRectangle(0, 344, 454, 110);

        // ---------------- progress (stage)
        var sg = stage(d);
        var frac = G.clamp(sg[0].toFloat() / sg[1], 0.0, 1.0);
        var done = sg[0] >= sg[1];
        var rp = G.easeInOut(G.stag(p, 3, 0.1, 0.6));

        // finish banner (goal reached)
        if (done) {
            var bx = q4(RX - 30 - dist + 72 * v * 1400 / 1000.0 + 640);
            if (bx > -140 && bx < 454) {
                dc.setColor(st == 2 ? GB[0] : (st == 3 ? CYA : 0xD8D8D8), -1);
                dc.fillRectangle(bx, 232, P, 72);
                dc.fillRectangle(bx + 132, 232, P, 108);
                // checkered banner
                dc.setColor(st == 2 ? GB[3] : (st == 3 ? 0x000000 : 0xFFFFFF), -1);
                dc.fillRectangle(bx - 4, 216, 144, 28);
                dc.setColor(st == 2 ? GB[0] : (st == 3 ? MAG : 0x111111), -1);
                for (var c = 0; c < 18; c += 2) {
                    dc.fillRectangle(bx - 4 + c * 8, 216, 8, P);
                    dc.fillRectangle(bx + 4 + c * 8, 220, 8, P);
                    dc.fillRectangle(bx - 4 + c * 8, 236, 8, P);
                    dc.fillRectangle(bx + 4 + c * 8, 240, 8, P);
                }
                dc.setColor(st == 2 ? GB[0] : (st == 3 ? acc : 0xE03A3A), -1);
                F.px(dc, "ZIEL", bx + 68, 226, 2, 1, 0);
            }
        }

        // night headlight
        var rxp = q4(G.lerp(-96, RX, G.ease(G.stag(p, 0, 0, 0.75))));
        if (night && st == 1) {
            for (var k = 0; k < 3; k++) {
                dc.setColor(G.mix(pal[12], 0xFFF0B0, 0.15 - k * 0.04), -1);
                dc.fillRectangle(rxp + 80 + k * 40, 316 - k * 4, 40, 12 + k * 8);
            }
            dc.setColor(0xFFF6C0, -1);
            dc.fillRectangle(rxp + 64, RY + 32, P, P);
        }

        // rider
        var fr = (tt * v / 120).toNumber() % 4;
        var rs = fr == 0 ? SprRider.RIDER_0 : (fr == 1 ? SprRider.RIDER_1 : (fr == 2 ? SprRider.RIDER_2 : SprRider.RIDER_3));
        if (st >= 2) {
            Spr.draw(dc, SprRider.RIDER_GLOW, rxp - P, RY - P, P, [st == 2 ? GB[0] : G.dim(acc, 0.28)], false);
        }
        Spr.draw(dc, rs, rxp, RY, P, riderPal(st, acc), false);

        // confetti burst at the finish line
        if (done) {
            var ct = (tt - 1000) / 1000.0;
            if (ct > 0 && ct < 2.2) {
                var cc = st == 2 ? [GB[3], GB[2], GB[0], GB[1]] : [acc, CYA, MAG, 0xFFFFFF, 0x5FE08A];
                var s = 11;
                for (var i = 0; i < 26; i++) {
                    s = G.rnd(s);
                    var vx = (s % 400) - 200;
                    s = G.rnd(s);
                    var vy = -120 - (s % 260);
                    var x = q4(RX + 40 + vx * ct);
                    var y = q4(230 + vy * ct + 260 * ct * ct);
                    if (y < 340) {
                        dc.setColor(cc[i % cc.size()], -1);
                        dc.fillRectangle(x, y, P, (i + tt / 90) % 3 == 0 ? P / 2 : P);
                    }
                }
            }
        }

        // ---------------- HUD in the panel
        var dimT = st == 2 ? GB[2] : (st == 3 ? G.dim(CYA, 0.7) : G.mix(pal[14], 0xFFFFFF, 0.5));
        var hiT = st == 2 ? GB[3] : 0xFFFFFF;
        var pre = done ? "ZIEL! " : "ETAPPE ";
        var lbl = sg[2] as String;
        var lw = F.pxW(pre + lbl, 2);
        var lx = 227 - lw / 2.0;
        var blink = done && a.live && p >= 1 && (tt / 400) % 2 == 1;
        dc.setColor(done ? (blink ? hiT : (st == 2 ? GB[3] : acc)) : dimT, -1);
        F.px(dc, pre, lx, 352, 2, 0, 0);
        dc.setColor(hiT, -1);
        F.px(dc, lbl, lx + F.pxW(pre, 2) + 2, 352, 2, 0, 0);
        // stage bar: 60 cells, segmented every 16 px
        var bx0 = 100;
        var bw = 240;
        var by = 384;
        dc.setColor(st == 2 ? GB[1] : (st == 3 ? G.dim(acc, 0.25) : G.mix(pal[14], 0xFFFFFF, 0.16)), -1);
        dc.fillRectangle(bx0, by, bw, 8);
        var fw = q4(bw * frac * rp);
        if (fw > 0) {
            dc.setColor(st == 2 ? GB[3] : acc, -1);
            dc.fillRectangle(bx0, by, fw, 8);
        }
        dc.setColor(pal[14], -1);
        for (var x = bx0 + 12; x < bx0 + bw; x += 16) {
            dc.fillRectangle(x, by, P, 8);
        }
        // finish flag + rider marker
        Spr.draw(dc, SprRider.FLAG, bx0 + bw + 10, by - 12, 2, st == 2 ? [GB[2], GB[0], GB[3]] : [dimT, st == 3 ? MAG : 0x111111, 0xFFFFFF], false);
        var mp = riderPal(st, acc);
        Spr.draw(dc, SprRider.MINI, bx0 + fw - 9, by - 16, 2, [hiT, mp[1], -1, mp[3], mp[4]], false);
        // one slot (skips a slot that repeats the stage value)
        var si = 0;
        var l0 = d.slots[0][:lbl] as String;
        if ((d.src == 1 && l0.equals("RAD/WO")) || (d.src == 0 && l0.equals("ETAGEN"))) {
            si = 1;
        }
        var sl = d.slots[si];
        var slb = sl[:lbl] as String;
        var svl = sl[:val] as String;
        var sw = F.pxW(slb + " " + svl, 2);
        dc.setColor(dimT, -1);
        F.px(dc, slb, 227 - sw / 2.0, 408, 2, 0, 0);
        dc.setColor(st == 2 ? GB[3] : d.dcol, -1);
        F.px(dc, svl, 227 + sw / 2.0, 408, 2, 2, 0);

        // ---------------- time + date
        var tq = G.stag(p, 1, 0.12, 0.55);
        var ty = 56 - q4((1 - G.spring(tq)) * 130);
        var ts = timeStr(d);
        var tc = st == 2 ? (night ? GB[3] : GB[0]) : 0xFFFFFF;
        var sc = st == 2 ? (night ? GB[1] : GB[3]) : (st == 3 ? MAG : G.mix(pal[0], 0x000000, 0.55));
        if (tq > 0) {
            dc.setColor(sc, -1);
            F.px(dc, ts, 227 + P, ty + P, 8, 1, 0);
            dc.setColor(tc, -1);
            F.px(dc, ts, 227, ty, 8, 1, 0);
        }
        var dp = G.stag(p, 3, 0.12, 0.4);
        dc.setColor(G.mix(pal[0], st == 2 ? tc : (st == 3 ? CYA : 0xFFFFFF), dp * 0.9), -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 126, 2, 1, 0);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var ox = o[0];
        var oy = o[1];
        dc.setColor(0x2E2E2E, -1);
        dc.fillRectangle(60 + ox, 332 + oy, 334, 1);
        var c = G.dim(d.accent, 0.42);
        Spr.draw(dc, SprRider.RIDER_0, RX + ox, RY + oy, P, [c, c, c, c, c, c, -1, c, c, c, c], false);
        dc.setColor(0x8A8A8A, -1);
        F.px(dc, timeStr(d), 227 + ox, 96 + oy, 8, 1, 2);
    }
}
