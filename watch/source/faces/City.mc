import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// CITY — "Pixel City": a pixel skyline that grows with you. Every floor climbed today lights
// one window; reaching the floors goal lights the TV tower ("Fernsehturm") sphere and hangs
// a "ZIEL!" banner. Sky by real sun elevation, rain/snow, an S-Bahn on the viaduct, a plane
// at night, slot values on rooftop billboards. Styles: 1 Neon-Nacht, 2 Retro, 3 Winter.
// Mirrors web/js/faces/city.js.
class FaceCity extends Face {
    const P = 4;
    const GY = 388;
    const TX = 360;
    const BAND = [0, 100, 150, 200, 260, 388];
    const BLD = [8, 92, 284, 0, 0, 100, 44, 196, 1, 1, 176, 88, 292, 2, 0, 264, 48, 208, 3, 2, 312, 40, 256, 0, 3, 352, 88, 296, 1, 0];
    const NB = 6;
    const ORD = [2, 0, 4, 1, 5, 3];
    const BOARD_B = [0, 2, 5];
    const BOARD_X = [58, 224, 392];
    const SPH = [2, 3, 4, 4, 4, 4, 3, 2];
    const PK = [0x000000, 0x1D2B53, 0x7E2553, 0x008751, 0xAB5236, 0x5F574F, 0xC2C3C7, 0xFFF1E8, 0xFF004D, 0xFFA300, 0xFFEC27, 0x00E436, 0x29ADFF, 0x83769C, 0xFF77A8, 0xFFCCAA];
    const MAG = 0xFF2BD6;
    const CYA = 0x18E0FF;
    const NEON = [0x05030F, 0x0A0620, 0x120A30, 0x1C0E3E, 0x28124A, 0x1E1230, 0x121C30, 0x201C2C, 0x0E1A32, 0x0A0A16, 0xFFD27A, 0xFF9E4A, 0x7AE8FF, 0x1C1830, 0x2C2848, 0x2A1420, 0x07040A, 0x050408, 0x342C4C, 0x050308, 0x1A4A48];
    const R_DAY = [12, 12, 12, 12, 6, 4, 5, 15, 13, 12, 7, 7, 6, 6, 7, 4, 0, 5, 7, 7, 3];
    const R_DUSK = [1, 2, 2, 14, 9, 4, 5, 2, 1, 1, 10, 9, 7, 5, 13, 2, 0, 1, 13, 0, 3];
    const R_NIGHT = [0, 0, 1, 1, 1, 2, 5, 5, 0, 1, 10, 9, 7, 5, 13, 2, 0, 0, 13, 0, 3];
    const W_DAY = [0x6C9CD0, 0x82AED8, 0x98C0E2, 0xB0D2EC, 0xCADFF2, 0x8A6A72, 0x7E8A9C, 0xA49C94, 0x5E7E9E, 0x8AB8DC, 0xEAF6FF, 0xD8ECFA, 0xFFFFFF, 0x9AA4B2, 0xC6CEDA, 0x7A5A54, 0x34303A, 0xD6E2EE, 0xFFFFFF, 0xE8EEF6, 0x5A9A8A];
    const W_DUSK = [0x1C2250, 0x3A3474, 0x6A4A8C, 0xA8688E, 0xD89A9A, 0x4A3A52, 0x3E4660, 0x56505E, 0x34465E, 0x2A3048, 0xFFD27A, 0xFFB14A, 0xFFF0D0, 0x4A5068, 0x6A7088, 0x4A3240, 0x141018, 0x8A90B0, 0xE8E8F8, 0xD8DCEA, 0x3A6A64];
    const W_NIGHT = [0x050A1A, 0x0A1228, 0x0F1A34, 0x162440, 0x1E2E4C, 0x2A2232, 0x222A3A, 0x2E2C36, 0x1A2A40, 0x121828, 0xFFD27A, 0xFFB14A, 0xFFF0D0, 0x262C3C, 0x363E50, 0x2A1C24, 0x0C0A0E, 0x4A5468, 0xC8D4E8, 0xB8C4D8, 0x24443E];

    // window grid per building: [x0, rows, cols]; WIN = windows in lighting order (b*10000 + r*100 + c)
    hidden var WG as Array<Number>;
    hidden var WIN as Array<Number>;

    function initialize() {
        Face.initialize();
        WG = new [NB * 3] as Array<Number>;
        var cnt = 0;
        for (var b = 0; b < NB; b++) {
            var x = BLD[b * 5];
            var w = BLD[b * 5 + 1];
            var top = BLD[b * 5 + 2];
            var n = (w - 4) / 12;
            WG[b * 3] = x + ((w - (n * 12 - 4)) / 8) * 4;
            WG[b * 3 + 1] = (GY - 32 - top - 12 + 4) / 12;
            WG[b * 3 + 2] = n;
            cnt += WG[b * 3 + 1] * n;
        }
        var tmp = new [cnt] as Array<Number>;
        var k = 0;
        for (var b = 0; b < NB; b++) {
            for (var r = 0; r < WG[b * 3 + 1]; r++) {
                for (var c = 0; c < WG[b * 3 + 2]; c++) {
                    var cx = WG[b * 3] + c * 12 + 4 - 227;
                    var cy = BLD[b * 5 + 2] + 12 + r * 12 + 4 - 227;
                    if (cx * cx + cy * cy < 216 * 216) {
                        tmp[k] = b * 10000 + r * 100 + c;
                        k++;
                    }
                }
            }
        }
        WIN = tmp.slice(0, k) as Array<Number>;
        var s = 4242;
        for (var i = k - 1; i > 0; i--) {
            s = G.rnd(s);
            var j = s % (i + 1);
            var t = WIN[i];
            WIN[i] = WIN[j];
            WIN[j] = t;
        }
    }

    function fps() as Number {
        return 10;
    }

    hidden function q4(v) as Number {
        return Math.floor(v / 4.0).toNumber() * P;
    }

    hidden function palette(st, el, rain) as Array<Number> {
        var out = new [21] as Array<Number>;
        if (st == 1) {
            for (var i = 0; i < 21; i++) {
                out[i] = NEON[i];
            }
        } else if (st == 2) {
            var m = el >= 4 ? R_DAY : (el >= -4 ? R_DUSK : R_NIGHT);
            for (var i = 0; i < 21; i++) {
                out[i] = PK[m[i]];
            }
        } else {
            var a = W_NIGHT;
            var b = W_NIGHT;
            var f = 0.0;
            if (el >= 6) {
                a = W_DAY;
                b = W_DAY;
            } else if (el >= -2) {
                a = W_DUSK;
                b = W_DAY;
                f = (el + 2) / 8.0;
            } else if (el >= -8) {
                a = W_NIGHT;
                b = W_DUSK;
                f = (el + 8) / 6.0;
            }
            for (var i = 0; i < 21; i++) {
                out[i] = G.mix(a[i], b[i], f);
            }
        }
        if (rain && st != 2) {
            for (var i = 0; i < 5; i++) {
                out[i] = G.mix(out[i], 0x3A4250, 0.35);
            }
        }
        return out;
    }

    hidden function signCols(st, acc) as Array<Number> {
        if (st == 1) {
            return [acc, MAG, CYA] as Array<Number>;
        }
        if (st == 2) {
            return [PK[8], PK[12], PK[11]] as Array<Number>;
        }
        return [acc, 0x3A8AD0, 0xD04A4A] as Array<Number>;
    }

    // rooftop billboard: two lines (label, value), on legs above roof y `roof`
    hidden function board(dc as Dc, cx, roof, lbl as String, val as String, col, st, pal as Array<Number>, day) as Void {
        var w1 = F.pxW(lbl, 2);
        var w2 = F.pxW(val, 2);
        var tw = w1 > w2 ? w1 : w2;
        var bw = q4(tw + 15);
        var bx = q4(cx - bw / 2);
        var by = roof - 48;
        // legs
        dc.setColor(st == 1 ? 0x2A2438 : G.mix(pal[13], 0x000000, 0.3), -1);
        dc.fillRectangle(bx + 8, by + 40, P, 8);
        dc.fillRectangle(bx + bw - 12, by + 40, P, 8);
        // frame + fill
        dc.setColor(col, -1);
        dc.fillRectangle(bx, by, bw, 40);
        var lite = st == 3 || (st == 2 && day);
        dc.setColor(st == 1 ? pal[19] : (lite ? pal[19] : PK[0]), -1);
        dc.fillRectangle(bx + 2, by + 2, bw - 4, 36);
        if (st == 3) {
            dc.setColor(pal[18], -1);
            dc.fillRectangle(bx - 2, by - 4, bw + 4, P);
        }
        var lc;
        var vc;
        if (st == 1) {
            lc = G.dim(col, 0.62);
            vc = G.mix(col, 0xFFFFFF, 0.45);
        } else if (lite) {
            lc = st == 2 ? PK[5] : 0x5A6478;
            vc = st == 2 ? PK[0] : 0x1A2030;
        } else {
            lc = PK[6];
            vc = col;
        }
        dc.setColor(lc, -1);
        F.px(dc, lbl, bx + bw / 2, by + 6, 2, 1, 0);
        dc.setColor(vc, -1);
        F.px(dc, val, bx + bw / 2, by + 22, 2, 1, 0);
    }

    hidden function timeStr(d as D) as String {
        return (d.is24 ? G.pad2(d.h) : "" + G.hour(d)) + ":" + G.pad2(d.m);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var tt = a.live ? a.t : 3000;
        var el = st == 1 ? -30.0 : AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var rain = d.rain >= 50;
        var pal = palette(st, el, rain);
        var day = st != 1 && el >= (st == 2 ? 4 : 2);
        var night = st == 1 || el < -4;
        var goal = d.floorsGoal > 0 && d.floors >= d.floorsGoal;
        var blinkA = (tt / 500) % 2 == 0;

        // ---------------- sky
        for (var i = 0; i < 5; i++) {
            dc.setColor(pal[i], -1);
            dc.fillRectangle(0, BAND[i], 454, BAND[i + 1] - BAND[i]);
        }
        if (night && !rain) {
            var s = 3;
            for (var i = 0; i < 22; i++) {
                s = G.rnd(s);
                var x = 20 + (s % 104) * P;
                s = G.rnd(s);
                var y = 8 + (s % 50) * P;
                var tw = (a.live && (tt / 350 + i * 3) % 11 == 0) ? 0.3 : 1.0;
                dc.setColor(G.mix(pal[1], 0xFFFFFF, (0.3 + (i % 3) * 0.3) * tw), -1);
                dc.fillRectangle(x, y, P, P);
            }
        }
        // sun / moon
        var rise = d.sunrise;
        var set = d.sunset;
        if (st != 1 && el > -1 && !rain) {
            var f = 0.5;
            if (rise >= 0 && set > rise) {
                f = G.clamp((d.mins - rise) / (set - rise), 0.0, 1.0);
            }
            var sx = q4(40 + f * 300) - 16;
            var sy = q4(G.clamp(300 - el * 5, 156, 330)) - 16;
            var gf = G.clamp((10 - el) / 12.0, 0.0, 1.0);
            var sp = st == 2 ? [PK[9], PK[10], PK[7]] : [G.mix(0xFFE07A, 0xFF6A3A, gf), G.mix(0xFFF6C8, 0xFFA060, gf), 0xFFFFFF];
            Spr.draw(dc, SprCity.SUN, sx, sy, P, sp, false);
        } else if (night && d.moon > 0.05 && d.moon < 0.95) {
            var f = 0.12;
            if (st != 1 && rise >= 0 && set >= 0) {
                var m = d.mins - set;
                if (m < 0) {
                    m += 1440;
                }
                f = G.clamp(m / (rise + 1440 - set), 0.0, 1.0);
            }
            var mx = q4(40 + f * 300) - 14;
            var my = q4(170 + (1 - Math.sin(f * Math.PI)) * 60) - 14;
            Spr.draw(dc, SprCity.MOON, mx, my, P, [st == 2 ? PK[7] : 0xF4F1D0, st == 2 ? PK[6] : 0xC8C3A0], false);
            if (d.moon < 0.35 || d.moon > 0.65) {
                Spr.draw(dc, SprCity.MOON_C, mx, my, P, [pal[2]], d.moon > 0.5);
            }
        }
        // plane (night)
        if (night) {
            var ph = (tt % 11000) / 11000.0;
            var px = q4(480 - ph * 560);
            var py = 148 + q4(ph * 24);
            Spr.draw(dc, SprCity.PLANE, px, py, P, [st == 2 ? PK[5] : 0x3A3A50, st == 2 ? PK[10] : 0xFFE08A], true);
            dc.setColor(blinkA ? 0xFF3030 : 0x501010, -1);
            dc.fillRectangle(px + 32, py, P, P);
            if ((tt / 250) % 4 == 1) {
                dc.setColor(0xFFFFFF, -1);
                dc.fillRectangle(px + 16, py + 8, P, P);
            }
        }

        // ---------------- skyline (rising during the intro, clipped at street level)
        dc.setClip(0, 0, 454, GY);
        // TV tower (behind)
        var to = q4((1 - G.ease(G.stag(p, 0, 0, 0.5))) * 280);
        dc.setColor(pal[13], -1);
        dc.fillRectangle(TX - 8, 300 + to, 16, 88);
        dc.fillRectangle(TX - 4, 200 + to, 8, 100);
        dc.fillRectangle(TX - 4, 156 + to, 8, 12);
        dc.setColor(st == 2 ? PK[7] : G.mix(pal[13], 0xFFFFFF, 0.45), -1);
        dc.fillRectangle(TX - 2, 128 + to, P, 28);
        dc.setColor(st == 2 ? PK[8] : 0xD04040, -1);
        dc.fillRectangle(TX - 2, 136 + to, P, 4);
        dc.fillRectangle(TX - 2, 148 + to, P, 4);
        if (blinkA || !a.live) {
            dc.setColor(0xFF3030, -1);
            dc.fillRectangle(TX - 2, 124 + to, P, P);
        }
        var sc0 = goal ? acc : pal[14];
        if (goal) {
            dc.setColor(G.dim(acc, 0.35), -1);
            dc.fillRectangle(TX - 20, 168 + to, 40, 32);
            dc.fillRectangle(TX - 12, 164 + to, 24, 40);
        }
        for (var r = 0; r < 8; r++) {
            var hw = SPH[r] * P;
            dc.setColor(r < 3 && !goal ? G.mix(sc0, 0xFFFFFF, 0.25) : (r < 2 ? G.mix(acc, 0xFFFFFF, 0.45) : sc0), -1);
            dc.fillRectangle(TX - hw, 168 + r * P + to, hw * 2, P);
        }
        // sphere windows (restaurant)
        dc.setColor(goal ? 0xFFFFFF : (night ? pal[10] : G.mix(pal[14], 0x000000, 0.35)), -1);
        for (var k = -2; k < 2; k++) {
            dc.fillRectangle(TX + k * 8 + 2, 184 + to, P, P);
        }

        // church
        var co = q4((1 - G.ease(G.stag(p, 3, 0.07, 0.45))) * 200);
        var stone = G.mix(pal[7], 0x000000, 0.18);
        dc.setColor(stone, -1);
        dc.fillRectangle(144, 320 + co, 32, 68);
        dc.fillRectangle(152, 256 + co, 20, 64);
        dc.setColor(pal[20], -1);
        dc.fillRectangle(144, 316 + co, 32, P);
        dc.fillRectangle(152, 248 + co, 20, 8);
        dc.fillRectangle(156, 232 + co, 12, 16);
        dc.fillRectangle(160, 208 + co, P, 24);
        dc.setColor(0xE0B040, -1);
        dc.fillRectangle(160, 192 + co, P, 16);
        dc.fillRectangle(156, 196 + co, 12, P);
        dc.setColor(st == 2 ? PK[7] : G.mix(stone, 0xFFFFFF, 0.6), -1);
        dc.fillRectangle(156, 264 + co, 12, 12);
        dc.setColor(G.mix(stone, 0x000000, 0.6), -1);
        dc.fillRectangle(160, 264 + co, P, 8);
        dc.fillRectangle(160, 268 + co, 8, P);
        dc.setColor(night ? pal[11] : pal[9], -1);
        dc.fillRectangle(160, 288 + co, P, 16);
        dc.fillRectangle(148, 336 + co, P, 20);
        dc.fillRectangle(168, 336 + co, P, 20);

        // buildings
        var cols = signCols(st, acc);
        var up = [0, 0, 0, 0, 0, 0] as Array<Number>;
        for (var k = 0; k < NB; k++) {
            var b = ORD[k];
            var top = BLD[b * 5 + 2];
            up[b] = q4((1 - G.ease(G.stag(p, k, 0.07, 0.45))) * (GY - top + 60));
        }
        for (var b = 0; b < NB; b++) {
            var x = BLD[b * 5];
            var w = BLD[b * 5 + 1];
            var top = BLD[b * 5 + 2] + up[b];
            var ex = BLD[b * 5 + 4];
            var fac = pal[5 + BLD[b * 5 + 3]];
            // roof extras
            if (ex == 1) {
                var tc = G.mix(fac, 0x000000, 0.35);
                Spr.draw(dc, SprCity.TANK, x + 4, top - 36, P, [tc, G.mix(fac, 0x8A5A3A, 0.5), tc], false);
                dc.setColor(tc, -1);
                dc.fillRectangle(x + 36, top - 40, P, 40);
                if (blinkA || !a.live) {
                    dc.setColor(0xFF3030, -1);
                    dc.fillRectangle(x + 36, top - 44, P, P);
                }
            } else if (ex == 2) {
                dc.setColor(G.mix(fac, 0xFFFFFF, 0.12), -1);
                dc.fillRectangle(x + 8, top - 12, w - 16, 12);
                dc.fillRectangle(x + 16, top - 24, w - 32, 12);
                dc.fillRectangle(x + w / 2 - 2, top - 44, P, 20);
                if (!blinkA || !a.live) {
                    dc.setColor(0xFF3030, -1);
                    dc.fillRectangle(x + w / 2 - 2, top - 48, P, P);
                }
            } else if (ex == 3) {
                dc.setColor(G.mix(fac, 0x000000, 0.3), -1);
                dc.fillRectangle(x + 4, top - 8, 12, 8);
            }
            dc.setColor(fac, -1);
            dc.fillRectangle(x, top, w, GY - top);
            dc.setColor(st == 1 ? G.dim(cols[b % 3], 0.75) : G.mix(fac, 0xFFFFFF, 0.18), -1);
            dc.fillRectangle(x, top, w, P);
            dc.setColor(G.mix(fac, 0x000000, 0.25), -1);
            dc.fillRectangle(x + w - P, top + P, P, GY - top - P);
            // window grid: one block in the "off" colour, then facade bars between
            var x0 = WG[b * 3];
            var nr = WG[b * 3 + 1];
            var n = WG[b * 3 + 2];
            var y0 = top + 12;
            dc.setColor(pal[9], -1);
            dc.fillRectangle(x0, y0, n * 12 - 4, nr * 12 - 4);
            dc.setColor(fac, -1);
            for (var r = 1; r < nr; r++) {
                dc.fillRectangle(x0, y0 + r * 12 - 4, n * 12 - 4, P);
            }
            for (var c = 1; c < n; c++) {
                dc.fillRectangle(x0 + c * 12 - 4, y0, P, nr * 12 - 4);
            }
            // door
            dc.setColor(G.mix(fac, 0x000000, 0.55), -1);
            dc.fillRectangle(x + q4(w / 2) - 4, GY - 20, 12, 20);
            // snow on the roof
            if (st == 3) {
                dc.setColor(pal[18], -1);
                dc.fillRectangle(x, top - P, w, P);
                dc.fillRectangle(x + 4, top - 8, 12, P);
                dc.fillRectangle(x + w - 20, top - 8, 8, P);
            }
        }
        // lit windows (count up during the intro)
        var fl = d.floors > 0 ? d.floors : 0;
        var nl = Math.floor(fl * G.clamp((p - 0.45) / 0.4, 0.0, 1.0) + 0.0001).toNumber();
        if (nl > WIN.size()) {
            nl = WIN.size();
        }
        for (var i = 0; i < nl; i++) {
            var id = WIN[i];
            var b = id / 10000;
            var r = (id / 100) % 100;
            var c = id % 100;
            var k = (id * 7 + i) % 10;
            dc.setColor(k < 6 ? pal[10] : (k < 8 ? pal[11] : pal[12]), -1);
            dc.fillRectangle(WG[b * 3] + c * 12, BLD[b * 5 + 2] + up[b] + 12 + r * 12, 8, 8);
        }
        dc.clearClip();

        // ---------------- signs
        var tempSlot = false;
        for (var k = 0; k < 3; k++) {
            if ((d.slots[k][:lbl] as String).equals("TEMP")) {
                tempSlot = true;
            }
        }
        for (var k = 0; k < 4; k++) {
            var p0 = 0.70 + k * 0.05;
            if (p < p0) {
                continue;
            }
            // switch-on flicker, always over before the intro ends (p reaches exactly 1)
            if (p < p0 + 0.12 && p < 1 && (a.t / 60) % 2 == 1) {
                continue;
            }
            if (k < 3) {
                var b = BOARD_B[k];
                board(dc, BOARD_X[k], BLD[b * 5 + 2], d.slots[k][:lbl] as String, d.slots[k][:val] as String, cols[k], st, pal, day);
            } else if (!tempSlot) {
                // temperature billboard on the brick building next to the tower
                var ts = "--°";
                if (d.temp != -99) {
                    ts = Math.round(d.metric ? d.temp : d.temp * 1.8 + 32).toNumber() + "°";
                }
                var bw = q4(F.pxW(ts, 2) + 15);
                var bx = q4(324 - bw / 2);
                var lite = st == 3 || (st == 2 && day);
                dc.setColor(st == 1 ? 0x2A2438 : G.mix(pal[13], 0x000000, 0.3), -1);
                dc.fillRectangle(bx + 4, 248, P, 8);
                dc.fillRectangle(bx + bw - 8, 248, P, 8);
                dc.setColor(cols[2], -1);
                dc.fillRectangle(bx, 226, bw, 22);
                dc.setColor(st == 1 || lite ? pal[19] : PK[0], -1);
                dc.fillRectangle(bx + 2, 228, bw - 4, 18);
                dc.setColor(st == 1 ? G.mix(cols[2], 0xFFFFFF, 0.45) : (lite ? (st == 2 ? PK[0] : 0x1A2030) : cols[2]), -1);
                F.px(dc, ts, bx + bw / 2, 230, 2, 1, 0);
                if (st == 3) {
                    dc.setColor(pal[18], -1);
                    dc.fillRectangle(bx - 2, 222, bw + 4, P);
                }
            }
        }
        // goal banner on the tower
        if (goal && p >= 0.8) {
            var gp = G.spring(G.stag(p, 0, 0.8, 0.2));
            var gw = q4(68 * gp);
            if (gw > 8) {
                dc.setColor(0xFFFFFF, -1);
                dc.fillRectangle(TX + 4, 204, gw, 24);
                dc.setColor(acc, -1);
                dc.fillRectangle(TX + 6, 206, gw - 4, 20);
                if (gw >= 64) {
                    dc.setColor(0x000000, -1);
                    F.px(dc, "ZIEL!", TX + 6 + 32, 209, 2, 1, 0);
                }
            }
        }

        // ---------------- viaduct, street, S-Bahn
        dc.setColor(pal[15], -1);
        dc.fillRectangle(0, GY, 454, 36);
        dc.setColor(st == 2 ? PK[6] : G.mix(pal[13], 0xFFFFFF, 0.3), -1);
        dc.fillRectangle(0, GY, 454, P);
        dc.setColor(G.mix(pal[15], 0x000000, 0.3), -1);
        dc.fillRectangle(0, GY + 8, 454, P);
        for (var k = 0; k < 8; k++) {
            var ax = 12 + k * 56;
            dc.setColor(night && k % 3 == 1 ? pal[11] : pal[16], -1);
            dc.fillRectangle(ax + 8, GY + 16, 16, P);
            dc.fillRectangle(ax + 4, GY + 20, 24, P);
            dc.fillRectangle(ax, GY + 24, 32, 12);
        }
        dc.setColor(pal[17], -1);
        dc.fillRectangle(0, GY + 36, 454, 30);
        if (st == 3) {
            dc.setColor(pal[18], -1);
            dc.fillRectangle(0, GY - P, 454, P);
        }
        // train every 7 s
        var tph = (tt % 7000) / 7000.0;
        var tx = q4(-200 + tph * 860);
        var tp;
        if (st == 2) {
            tp = [PK[5], PK[9], PK[8], night ? PK[10] : PK[1], PK[2], PK[7]];
        } else if (st == 1) {
            tp = [0x18181E, 0x8A6420, 0x6A1A20, 0xFFE08A, 0x3A0E12, 0xFFF6C0];
        } else {
            tp = [st == 3 ? pal[18] : 0x3A3A44, 0xE0A030, 0xA8282A, night ? 0xFFE08A : 0x2A3040, 0x6A1A1A, 0xFFF6C0];
        }
        Spr.draw(dc, SprCity.TRAIN_CAR, tx, GY - 28, P, tp, false);
        Spr.draw(dc, SprCity.TRAIN_HEAD, tx + 100, GY - 28, P, tp, false);

        // ---------------- weather
        if (st == 3) {
            var s = 17;
            var nf = rain ? 64 : 40;
            for (var i = 0; i < nf; i++) {
                s = G.rnd(s);
                var x0 = s % 454;
                s = G.rnd(s);
                var y = q4(((s % 420) + (tt * (5 + (i % 3))) / 100) % 420 + 16);
                var x = q4(x0 + Math.sin(tt / 700.0 + i) * 8);
                dc.setColor(i % 4 == 0 ? 0xFFFFFF : G.mix(pal[2], 0xFFFFFF, 0.75), -1);
                dc.fillRectangle(x, y, i % 3 == 0 ? P : 2, i % 3 == 0 ? P : 2);
            }
        } else if (rain) {
            var s = 23;
            dc.setColor(st == 2 ? PK[6] : G.mix(pal[3], 0xFFFFFF, 0.4), -1);
            for (var i = 0; i < 40; i++) {
                s = G.rnd(s);
                var x0 = s % 520;
                s = G.rnd(s);
                var y = ((s % 420) + (tt * 45) / 100) % 420 + 20;
                dc.fillRectangle(x0 - y / 5, y, 2, 10);
            }
        }

        // ---------------- time + date
        var tq = G.stag(p, 1, 0.12, 0.55);
        var ty = 56 - q4((1 - G.spring(tq)) * 130);
        var ts = timeStr(d);
        var shc = st == 1 ? 0x4A1458 : (st == 2 ? PK[day ? 1 : 2] : G.mix(pal[0], 0x000000, 0.55));
        if (tq > 0) {
            dc.setColor(shc, -1);
            F.px(dc, ts, 227 + P, ty + P, 8, 1, 0);
            dc.setColor(st == 2 ? PK[7] : 0xFFFFFF, -1);
            F.px(dc, ts, 227, ty, 8, 1, 0);
        }
        var dp = G.stag(p, 3, 0.12, 0.4);
        dc.setColor(G.mix(pal[0], st == 1 ? CYA : (st == 2 ? PK[7] : 0xFFFFFF), dp * 0.9), -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 124, 2, 1, 0);
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var ox = o[0];
        var oy = o[1];
        // rooftop outline
        dc.setColor(0x34344A, -1);
        dc.setPenWidth(1);
        var px = -1;
        var py = -1;
        for (var b = 0; b < NB; b++) {
            var x = BLD[b * 5] + ox;
            var w = BLD[b * 5 + 1];
            var top = BLD[b * 5 + 2] + oy;
            if (px >= 0) {
                dc.drawLine(px, py, x, top);
            }
            dc.drawLine(x, top, x + w, top);
            px = x + w;
            py = top;
            if (b == 1) {
                // church tower + spire between building 1 and 2
                dc.drawLine(px, py, px, 320 + oy);
                dc.drawLine(px, 320 + oy, 152 + ox, 320 + oy);
                dc.drawLine(152 + ox, 320 + oy, 152 + ox, 248 + oy);
                dc.drawLine(152 + ox, 248 + oy, 162 + ox, 196 + oy);
                dc.drawLine(162 + ox, 196 + oy, 172 + ox, 248 + oy);
                dc.drawLine(172 + ox, 248 + oy, 172 + ox, 320 + oy);
                dc.drawLine(172 + ox, 320 + oy, 176 + ox, 320 + oy);
                px = 176 + ox;
                py = 320 + oy;
            }
        }
        // TV tower
        var goal = d.floorsGoal > 0 && d.floors >= d.floorsGoal;
        dc.drawLine(TX - 4 + ox, 256 + oy, TX - 4 + ox, 200 + oy);
        dc.drawLine(TX + 3 + ox, 256 + oy, TX + 3 + ox, 200 + oy);
        dc.drawLine(TX + ox, 168 + oy, TX + ox, 128 + oy);
        dc.setColor(goal ? G.dim(d.accent, 0.5) : 0x34344A, -1);
        dc.drawCircle(TX + ox, 184 + oy, 16);
        // a few lit windows (floors / 3)
        var fl = d.floors > 0 ? d.floors : 0;
        var nl = fl / 3;
        if (nl > WIN.size()) {
            nl = WIN.size();
        }
        dc.setColor(0x5A4A26, -1);
        for (var i = 0; i < nl; i++) {
            var id = WIN[i];
            var b = id / 10000;
            var r = (id / 100) % 100;
            var c = id % 100;
            dc.fillRectangle(WG[b * 3] + c * 12 + ox, BLD[b * 5 + 2] + 12 + r * 12 + oy, 8, 8);
        }
        dc.setColor(0x8A8A8A, -1);
        F.px(dc, timeStr(d), 227 + ox, 56 + oy, 8, 1, 2);
    }
}
