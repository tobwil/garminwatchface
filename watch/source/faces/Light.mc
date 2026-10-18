import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// LIGHT — "Leuchtturm": a lighthouse on the rocks and its keeper, told by the real sun. By day he
// fishes from the rocks and waves at the sailing ship that passes on every wrist raise; at dusk he
// climbs the tower (the windows light up one after another) and lights the lamp; at night the beam
// sweeps the sea while a ship's lights pass safely, his cottage window glowing below; at dawn he
// puts the light out. The three data slots are on the sea weather panel.
// The coast lives with the year and the real weather (Season.mc): snow on the rocks and the roof, rain
// or snow falling, fairy lights on the gallery and the cottage in Advent, fireworks over the sea on New
// Year's Eve, eggs, a pumpkin, a heart or birthday balloons at the cottage.
// Styles: 1 Küste, 2 Sturm (rain and high waves), 3 Gameboy. Mirrors web/js/faces/light.js.
class FaceLight extends Face {
    const HZ = 250;
    const TX = 300;
    const LY = 98;
    const CAP = ["AUF DEM FELSEN", "LICHT AN!", "NACHTWACHE", "LICHT AUS"];

    hidden var _nf = 0.0;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    // phase: 0 day, 1 dusk, 2 night, 3 dawn
    hidden function phase(d as D, el) as Number {
        if (el > 4) {
            return 0;
        }
        if (el < -6) {
            return 2;
        }
        return d.mins < 720 ? 3 : 1;
    }

    // [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, sea far, sea near,
    //  wave, rock, rock dark, tower white, tower red, lantern frame, glass, lamp, rail, cottage, roof, window lit,
    //  door, text, text dim, panel, panel text, sweater, skin, eye, trousers, boots, cap, beard, hull, sail, gull,
    //  star, moon, moon dark]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x3A4A5A, 0x8A9AA8, 0x3A3A5A, 0x8A6A7A, 0x05080E, 0x101826, 0x2A3A4A, 0x1A2A3A, 0xC8D8E8,
                0x3A3A40, 0x26262C, 0xE8E8E8, 0xB02A24, 0x1A1A1E, 0x2A3A48, acc, 0x1A1A1E, 0xB8A890, 0x4A3A34, 0xFFD27A,
                0x3A2A1E, 0xFFFFFF, 0xD8E0E8, 0x101820, 0xFFFFFF, 0x2A3A5A, 0xF2C08A, 0x1A1A1A, 0x2A2A34, 0x1A1A1A, 0x1A1A24,
                0xD8D8D8, 0x5A3A2A, 0xE8E8E0, 0xFFFFFF, 0xFFFFFF, 0xF4F0D8, 0x3A3A48] as Array<Number>;
        }
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [c, e, b, c, a, a, b, b, e, a, a, e, b, a, a, e, a, c, a, e, a, a, e, a, e, b, e, a, a, a, a, e, a, e, a, e, e, b] as Array<Number>;
        }
        return [0x3A8AD8, 0xA8D8FF, 0x5A4A9A, 0xFF9A6A, 0x060A20, 0x141C44, 0x2A6AA8, 0x1E5A94, 0xE8F4FF,
            0x6A6058, 0x4A423C, 0xF4F4F4, 0xD8302A, 0x2A2A30, 0x2A3A48, acc, 0x2A2A30, 0xF0E6D0, 0x8A3A2A, 0xFFD27A,
            0x4A2A1A, 0xFFFFFF, 0xE8F4FF, 0x101820, 0xFFFFFF, 0x2A4A8A, 0xF2C08A, 0x1A1A1A, 0x3A3A48, 0x1A1A1A, 0x1A2A4A,
            0xE8E8E8, 0x6A3A24, 0xF8F4E8, 0xFFFFFF, 0xFFFFFF, 0xF4F0D8, 0x3A3A48] as Array<Number>;
    }

    hidden function dk(c as Number) as Number {
        return G.mix(c, 0x050814, _nf);
    }

    hidden function moon(dc as Dc, P as Array<Number>, cx as Number, cy as Number, r as Number, k) as Void {
        for (var y = -r; y < r; y += 4) {
            var yy = y + 2;
            var hw = (Math.sqrt(r * r - yy * yy) / 4).toNumber() * 4;
            if (hw <= 0) {
                continue;
            }
            dc.setColor(P[37], -1);
            dc.fillRectangle(cx - hw, cy + y, 2 * hw, 4);
            var x0 = k < 0.5 ? Math.round(hw * Math.cos(k * 2 * Math.PI) / 4).toNumber() * 4 : -hw;
            var x1 = k < 0.5 ? hw : Math.round(hw * Math.cos((k - 0.5) * 2 * Math.PI) / 4).toNumber() * 4;
            if (x1 > x0) {
                dc.setColor(P[36], -1);
                dc.fillRectangle(cx + x0, cy + y, x1 - x0, 4);
            }
        }
    }

    // static layer: sky, sea, rocks, tower, cottage, panel, texts; the beam, the lamp, the tower
    // windows, the keeper, ships, gulls, waves and rain move
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
        var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var ph = phase(d, el);
        var k = ph == 0 ? 0 : ph == 2 ? 2 : 1;
        _nf = st == 3 ? 0.0 : [0.0, 0.3, 0.6][k];
        var ev = Season.event(d);
        var xmas = ev == Season.ADVENT || ev == Season.XMAS;

        if (S) {
            // ---- sky, moon / sun, stars
            for (var i = 0; i < 5; i++) {
                dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 4.0), -1);
                dc.fillRectangle(0, i * 50, 454, 50);
            }
            if (k == 2 && st != 2) {
                dc.setColor(P[35], -1);
                for (var i = 0; i < 26; i++) {
                    var ss = i % 6 == 0 ? 4 : 2;
                    dc.fillRectangle(30 + ((i * 101 + 17) % 394), 20 + ((i * 47 + 11) % 210), ss, ss);
                }
            }
            if (el < 0 && st != 2) {
                moon(dc, P, 96, 92, 18, d.moon >= 0 ? d.moon : 0.5);
            }
            if (el > -4 && st != 2) {
                dc.setColor(st == 3 ? 0x9BBC0F : 0xFFF6D0, -1);
                dc.fillCircle(150, HZ - 10 - Math.round(G.clamp(el, -4, 40) * 4).toNumber(), 14);
            }

            // ---- sea
            dc.setColor(dk(P[6]), -1);
            dc.fillRectangle(0, HZ, 454, 60);
            dc.setColor(dk(P[7]), -1);
            dc.fillRectangle(0, HZ + 60, 454, 454 - HZ - 60);

            // ---- rocks, tower, gallery, cottage
            dc.setColor(dk(P[10]), -1);
            dc.fillRectangle(236, 318, 218, 60);
            dc.setColor(dk(P[9]), -1);
            dc.fillRectangle(250, 304, 204, 30);
            dc.fillRectangle(222, 336, 60, 24);
            dc.fillRectangle(300, 296, 154, 12);
            for (var y = 124; y < 312; y += 4) {
                var hw = Math.round(G.lerp(18, 30, (y - 124) / 188.0) / 2).toNumber() * 2;
                var band = ((y - 124) / 32) % 2 == 1;
                dc.setColor(dk(band ? P[12] : P[11]), -1);
                dc.fillRectangle(TX - hw, y, 2 * hw, 4);
            }
            dc.setColor(dk(P[13]), -1);
            dc.fillRectangle(TX - 28, 118, 56, 8);
            dc.fillRectangle(TX - 18, 74, 36, 6);
            dc.fillRectangle(TX - 10, 64, 20, 10);
            dc.fillRectangle(TX - 18, 80, 4, 38);
            dc.fillRectangle(TX + 14, 80, 4, 38);
            dc.setColor(dk(P[16]), -1);
            dc.fillRectangle(TX - 28, 108, 2, 10);
            dc.fillRectangle(TX + 26, 108, 2, 10);
            dc.fillRectangle(TX - 28, 108, 56, 2);
            // cottage
            dc.setColor(dk(P[18]), -1);
            dc.fillPolygon([[338, 262], [382, 236], [426, 262]]);
            dc.setColor(dk(P[17]), -1);
            dc.fillRectangle(344, 262, 76, 42);
            dc.setColor(dk(P[20]), -1);
            dc.fillRectangle(356, 270, 18, 34);
            dc.setColor(k > 0 ? P[19] : dk(P[14]), -1);
            dc.fillRectangle(388, 272, 20, 14);
            // ---- snow on the roof and the rocks, decorations for the special days
            if (st != 3 && Season.snowy(d)) {
                dc.setColor(dk(0xF4F8FF), -1);
                dc.fillPolygon([[340, 260], [382, 236], [424, 260]]);
                Season.snowCap(dc, 300, 296, 154);
                Season.snowCap(dc, 250, 304, 50);
                Season.snowCap(dc, 222, 336, 28);
            }
            if (ev == Season.EASTER) {
                Season.eggs(dc, 384, 320);
            } else if (ev == Season.HALLOWEEN) {
                Season.pumpkin(dc, 404, 304, 1);
            } else if (ev == Season.VALENTINE) {
                Season.heart(dc, 382, 212, 2);
            }

            // ---- sea weather panel with the data slots
            dc.setColor(P[23], -1);
            dc.fillRectangle(40, 128, 176, 74);
            dc.setColor(P[15], -1);
            F.px(dc, "SEEWETTER", 128, 132, 1, 1, 0);
            for (var i = 0; i < 3; i++) {
                var s = d.slots[i];
                var lb = s[:lbl] as String;
                if (lb.length() == 0 || G.stag(p, i, 0.1, 0.4) <= 0) {
                    continue;
                }
                var val = s[:val] as String;
                while (lb.length() > 2 && F.pxW(lb, 2) > 156 - F.pxW(val, 2)) {
                    lb = lb.substring(0, lb.length() - 1);
                }
                dc.setColor(G.mix(P[24], P[23], 0.35), -1);
                F.px(dc, lb, 48, 146 + i * 18, 2, 0, 0);
                dc.setColor(P[24], -1);
                F.px(dc, val, 208, 146 + i * 18, 2, 2, 0);
            }

            // ---- time, date, caption
            dc.setColor(0x000000, -1);
            F.px(dc, G.timeStr(d), 222, 26, 5, 1, 0);
            dc.setColor(st == 3 ? 0x0F380F : P[21], -1);
            F.px(dc, G.timeStr(d), 220, 24, 5, 1, 0);
            F.px(dc, ev != Season.NONE ? Season.greeting(ev) : d.dowStr + " " + d.day + ". " + d.monStr, 206, 68, 2, 1, 0);
            dc.setColor(P[21], -1);
            F.px(dc, CAP[ph], 200, 392, 2, 1, 0);
            var ssn = d.sunset > 0 ? d.sunset : 1140;
            var srs = d.sunrise > 0 ? d.sunrise : 390;
            dc.setColor(P[22], -1);
            F.px(dc, ph == 0 ? "LICHT UM " + G.hm(ssn) : ph == 2 ? "BIS " + G.hm(srs) : G.hm(ph == 1 ? ssn : srs), 200, 412, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        var kp = [-1, dk(P[25]), P[26], P[27], dk(P[28]), P[29], dk(P[30]), P[31]];
        // ---- waves roll in (higher in the storm)
        var storm = st == 2;
        dc.setColor(dk(P[8]), -1);
        for (var i = 0; i < 14; i++) {
            var wy = HZ + 14 + ((i * 37) % 100);
            var wx = ((i * 151 + tt / (storm ? 18 : 40)) % 520) - 40;
            if (wx + 26 > 222 && wy >= 290) {
                continue; // not on the rocks
            }
            dc.fillRectangle(wx, wy, storm ? 26 : 16, 2);
            if (storm) {
                dc.fillRectangle(wx + 6, wy - 2, 12, 2);
            }
        }
        // ---- the lamp, the tower windows and the beam
        var lampOn = ph == 2 || (ph == 1 && p >= 0.8) || (ph == 3 && p < 0.5);
        var winOn = ph == 1 && p < 1 ? (G.clamp(p / 0.8, 0, 1) * 3).toNumber() : 0;
        dc.setColor(P[19], -1);
        for (var w = 0; w < winOn; w++) {
            dc.fillRectangle(TX - 4, 276 - w * 56, 8, 14);
        }
        dc.setColor(lampOn ? P[15] : dk(P[14]), -1);
        dc.fillRectangle(TX - 14, 80, 28, 38);
        if (lampOn) {
            var ang = tt / 700.0;
            var c = Math.cos(ang);
            var len = Math.round(c.abs() * 300).toNumber();
            var dir = c < 0 ? -1 : 1;
            if (len > 12) {
                dc.setColor(G.mix(P[k * 2 + 1], P[15], 0.45), -1);
                dc.fillPolygon([[TX, LY - 4], [TX + dir * len, LY - 18], [TX + dir * len, LY + 14], [TX, LY + 4]]);
            }
            // glare when it points at us
            if (Math.sin(ang).abs() > 0.97) {
                dc.setColor(0xFFFFFF, -1);
                dc.fillRectangle(TX - 20, LY - 4, 40, 8);
                dc.fillRectangle(TX - 4, LY - 20, 8, 40);
            }
        }
        // ---- rain in the storm
        if (storm) {
            dc.setColor(G.mix(P[1], 0xFFFFFF, 0.3), -1);
            for (var i = 0; i < 24; i++) {
                dc.fillRectangle((i * 97 + tt / 8) % 470 - 10, (i * 61 + tt / 4) % 400, 2, 10);
            }
        }
        // ---- real weather, lights, fireworks, balloons
        if (!storm) {
            Season.precip(dc, d, 0, 40, 454, 300, tt);
        }
        if (xmas) {
            Season.lights(dc, TX - 28, 108, TX + 28, 108, tt);
            Season.lights(dc, 338, 262, 426, 262, tt);
        } else if (ev == Season.NYE) {
            Season.fireworks(dc, 330, 140, 100, 60, tt);
        } else if (ev == Season.BIRTHDAY) {
            Season.balloons(dc, 432, 296, tt);
        }
        // ---- the story
        if (ph == 0) {
            // fishing from the rocks; a ship sails by on every raise, he waves
            if (p < 1) {
                Spr.draw(dc, SprLight.SHIP, Math.round(G.lerp(-60, 300, p)).toNumber(), HZ - 34, 3, [-1, P[32], P[33], P[15]], false);
            }
            var wv = p > 0.2 && p < 0.9 && (a.t / 200) % 2 == 0;
            Spr.draw(dc, wv ? SprLight.WAVE : SprLight.KEEPER, 244, 298 - 36, 2, kp, true);
            if (!wv) {
                dc.setColor(dk(P[13]), -1);
                for (var i = 0; i < 8; i++) {
                    dc.fillRectangle(238 - i * 6, 280 - i * 4, 6, 2);
                }
                dc.setColor(P[22], -1);
                dc.fillRectangle(190, 248 + (live ? ((tt / 500) % 2) * 2 : 0), 2, 26);
            }
            // gulls
            for (var i = 0; i < 2; i++) {
                var gx = (i * 211 + tt / 30) % 560 - 60;
                var gy = 160 + i * 30 + Math.round(6 * Math.sin(tt / 300.0 + i)).toNumber();
                Spr.draw(dc, (tt / 240 + i) % 2 == 0 ? SprLight.GULL_A : SprLight.GULL_B, gx, gy, 3, [-1, P[34]], false);
            }
        } else if (ph == 1 || ph == 3) {
            // on the gallery: climbs up and lights the lamp / puts it out at dawn
            if (ph == 3 || p >= 0.8) {
                Spr.draw(dc, ph == 3 ? SprLight.WAVE : SprLight.KEEPER, TX - 56, 120 - 36, 2, kp, false);
            }
        } else {
            // a ship's lights pass safely in the night
            var sx = ((tt / 40 + 380) % 600) - 80;
            dc.setColor(0xFF3A2A, -1);
            dc.fillRectangle(sx, HZ + 6, 4, 4);
            dc.setColor(0x3AFF6A, -1);
            dc.fillRectangle(sx + 30, HZ + 6, 4, 4);
            dc.setColor(0xFFE08A, -1);
            dc.fillRectangle(sx + 14, HZ - 2, 4, 4);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        dc.setColor(st == 3 ? 0x306230 : 0x3A3A42, -1);
        dc.drawRectangle(TX - 15 + o[0], 124 + o[1], 30, 188);
        dc.fillRectangle(TX - 28 + o[0], 118 + o[1], 56, 4);
        dc.fillRectangle(o[0], HZ + o[1], 454, 2);
        dc.setColor(G.dim(d.accent, 0.5), -1);
        dc.fillRectangle(TX - 8 + o[0], 88 + o[1], 16, 20);
        dc.setColor(st == 3 ? 0x8BAC0F : 0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 220 + o[0], 24 + o[1], 5, 1, 1);
    }
}
