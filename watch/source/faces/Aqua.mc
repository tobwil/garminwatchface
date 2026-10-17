import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// AQUA — "Aquarium": a living pixel tank (4 px grid). Fish swim smooth paths with a 2-frame
// tail flap, bubbles rise, plants sway. Which fish (and how many) changes with every wrist raise
// and with the time of day (night: dark water, glowing fish). Right after a raise the curious
// fish swim up to the glass. The time sits on the glass in big pixel digits.
// Styles: 1 Riff (coral reef), 2 Teich (koi pond from above), 3 Tiefsee (anglerfish lantern).
// Mirrors web/js/faces/aqua.js.
class FaceAqua extends Face {
    const SURF = 48; // water surface (reef)
    const SAND = 376; // floor top
    // reef fish palettes (7 each): outline, body, light, dark, fins, stripe, eye
    const FPAL = [
        0x1B1622, 0xFF7F1E, 0xFFA04A, 0xE0601A, 0xFF9A3A, 0xFFFFFF, 0xFFFFFF,
        0x0B1030, 0x2A5CFF, 0x5A8CFF, 0x0B1030, 0xFFD23A, 0xFFFFFF, 0xFFFFFF,
        0x5A4000, 0xFFD820, 0xFFF070, 0xE0B000, 0xFFE040, 0xFFFFFF, 0xFFFFFF,
        0x111111, 0xF4F0E0, 0xFFFFFF, 0xFFD030, 0x222222, 0x151515, 0xFFFFFF,
        0x2A2010, 0xE8D090, 0xFFF4D0, 0x8A6A30, 0xD0B070, 0xFFFFFF, 0xFFFFFF,
        0x0A2040, 0x40C8FF, 0x9FF0FF, 0x2080C0, 0x40C8FF, 0xFFFFFF, 0xFFFFFF
    ];
    // koi varieties (6 each): outline, body, patch, fins, -, eye
    const KPAL = [
        0x3A1A10, 0xF8F4EC, 0xFF4A1A, 0xE8DDD4, 0, 0x101010,
        0x4A3000, 0xF0B030, 0xFFE080, 0xF8D890, 0, 0x201000,
        0x0A0A0A, 0x262626, 0xFF5A1A, 0xC8C8C8, 0, 0xFFFFFF,
        0x1A2A3A, 0x8AA8C0, 0xE8742A, 0xC8D8E4, 0, 0x101010,
        0x3A4048, 0xE4E8EE, 0xFFFFFF, 0xD8E0E8, 0, 0x101010
    ];
    // school formation (dx, dy) behind the leader
    const SCH = [0, 0, -16, 10, -14, -12, -30, 2, -32, -16, -44, 12, -46, -6, -58, 4];
    const MOON = [10, 20, 25, 25, 20, 15, 15, 10]; // moon reflection half widths
    const PENX = [48, 228, 392]; // sea pens
    const PENN = [9, 6, 8];
    // marine snow seeds
    const SNOW = [31, 7, 112, 41, 197, 88, 263, 15, 338, 60, 402, 99, 76, 133, 151, 170, 229, 201, 300, 236, 371, 270, 58, 302, 140, 333, 215, 47, 287, 120, 352, 181, 98, 222, 186, 260, 251, 296, 326, 330];

    hidden var _fa as Array<ByteArray>;
    hidden var _fb as Array<ByteArray>;
    hidden var _ka as Array<ByteArray>;
    hidden var _kb as Array<ByteArray>;
    // per-raise setup: kinds + path parameters, cached by key
    hidden var _cKey = -1;
    hidden var _nf = 0; // big fish
    hidden var _ns = 0; // school / small fish
    hidden var _fk = [0, 0, 0, 0, 0, 0] as Array<Number>;
    hidden var _fp as Array<Float>;

    function initialize() {
        Face.initialize();
        _fa = [SprAqua.CLOWN_A, SprAqua.TANG_A, SprAqua.YTANG_A, SprAqua.IDOL_A, SprAqua.PUFF_A, SprAqua.MINI_A] as Array<ByteArray>;
        _fb = [SprAqua.CLOWN_B, SprAqua.TANG_B, SprAqua.YTANG_B, SprAqua.IDOL_B, SprAqua.PUFF_B, SprAqua.MINI_B] as Array<ByteArray>;
        _ka = [SprAqua.KOI_0A, SprAqua.KOI_1A, SprAqua.KOI_2A, SprAqua.KOI_3A, SprAqua.KOI_4A, SprAqua.KOI_5A, SprAqua.KOI_6A, SprAqua.KOI_7A] as Array<ByteArray>;
        _kb = [SprAqua.KOI_0B, SprAqua.KOI_1B, SprAqua.KOI_2B, SprAqua.KOI_3B, SprAqua.KOI_4B, SprAqua.KOI_5B, SprAqua.KOI_6B, SprAqua.KOI_7B] as Array<ByteArray>;
        _fp = new [48] as Array<Float>;
        for (var i = 0; i < 48; i++) {
            _fp[i] = 0.0;
        }
    }

    function fps() as Number {
        return 12;
    }

    hidden function setup(d as D, st, night) as Void {
        var key = d.wakeN * 8 + st * 2 + (night ? 1 : 0);
        if (key == _cKey) {
            return;
        }
        _cKey = key;
        var s = G.rnd(G.rnd(G.rnd(d.wakeN * 7919 + st * 101 + (night ? 7 : 0) + 3)));
        s = G.rnd(s);
        if (st == 3) {
            // angler + 1-2 jellies + 2-4 lanternfish
            _nf = 2 + (s / 4096) % 2;
            s = G.rnd(s);
            _ns = 2 + (s / 4096) % 3;
        } else if (st == 2) {
            _nf = (night ? 2 : 4) + (s / 4096) % 3;
            _ns = 0;
        } else {
            _nf = (night ? 2 : 3) + (s / 4096) % (night ? 2 : 3);
            s = G.rnd(s);
            _ns = night ? 0 : 5 + (s / 4096) % 4;
        }
        // kinds: shuffled so the same kind rarely repeats
        var bag = [0, 1, 2, 3, 4];
        for (var j = 4; j > 0; j--) {
            s = G.rnd(s);
            var r = (s / 65536) % (j + 1);
            var x = bag[j];
            bag[j] = bag[r];
            bag[r] = x;
        }
        for (var i = 0; i < 6; i++) {
            _fk[i] = st == 3 ? (i == 0 ? 0 : 1) : bag[i % 5];
            for (var k = 0; k < 8; k++) {
                s = G.rnd(s);
                _fp[i * 8 + k] = G.rf(s);
            }
        }
    }

    hidden function sn(v) as Number {
        return (Math.floor(v / 4.0) * 4).toNumber();
    }

    hidden function s5(v) as Number {
        return (Math.floor(v / 5.0) * 5).toNumber();
    }

    hidden function fl(v) as Number {
        return Math.floor(v).toNumber();
    }

    hidden function fmod(v, m) as Float {
        return (v - Math.floor(v / m) * m).toFloat();
    }

    // colour scaled by the tank light (intro flicker)
    hidden function lit(c, l) as Number {
        return l >= 1 ? c : G.dim(c, l);
    }

    // palette from table tb at offset o (n entries), l = light.
    // nm 1 = night glow (glowing outline + dark body), 2 = moonlit (dimmed)
    hidden function fpal(tb as Array<Number>, o, n, nm, l) as Array<Number> {
        var p = new [n] as Array<Number>;
        for (var i = 0; i < n; i++) {
            var c = tb[o + i];
            if (nm == 1) {
                if (i == 0) {
                    c = G.mix(tb[o + 1], 0xFFFFFF, 0.45);
                } else if (i < n - 1) {
                    c = G.dim(c, 0.22);
                }
            } else if (nm == 2) {
                c = G.dim(c, 0.5);
            }
            p[i] = lit(c, l);
        }
        return p;
    }

    // fish i position on its path at time tau (s): [x, y, vx, vy]
    hidden function path(i, tau, st) as Array<Float> {
        var o = i * 8;
        if (st == 2) {
            // koi: wobbly orbits around the pond centre
            var R = 50 + _fp[o] * 120;
            var w = (0.12 + _fp[o + 2] * 0.12) * (_fp[o + 3] < 0.5 ? 1 : -1);
            var th = _fp[o + 1] * 6.283 + w * tau;
            var rr = R + 22 * Math.sin(tau * 0.11 + _fp[o + 4] * 6.283);
            var ry = 0.72 + _fp[o + 5] * 0.25;
            return [(227 + rr * Math.cos(th)).toFloat(), (236 + rr * ry * Math.sin(th)).toFloat(), (-w * Math.sin(th)).toFloat(), (w * ry * Math.cos(th)).toFloat()] as Array<Float>;
        }
        var A = (st == 3 && i == 0 ? 70 : 100) + _fp[o] * 70;
        var cx = 227 + (_fp[o + 1] - 0.5) * 40;
        var w = (st == 3 && i == 0 ? 0.07 : 0.13) + _fp[o + 2] * 0.12;
        var ph = i * 2.4 + _fp[o + 3] * 1.2;
        var y0 = (st == 3 && i == 0) ? 210 + _fp[o + 4] * 50 : 196 + fmod(i * 47 + _fp[o + 4] * 30, 124.0);
        var B = 8 + _fp[o + 5] * 22;
        var w2 = 0.2 + _fp[o + 6] * 0.3;
        var ps = _fp[o + 7] * 6.283;
        return [(cx + A * Math.sin(w * tau + ph)).toFloat(), (y0 + B * Math.sin(w2 * tau + ps) + 3 * Math.sin(tau * 1.7 + ph)).toFloat(), Math.cos(w * tau + ph).toFloat(), 0.0] as Array<Float>;
    }

    // curiosity after a raise: 0 -> 1 (at the glass) -> 0
    hidden function curious(a as A) as Float {
        if (!a.live) {
            return 0.0;
        }
        var t = a.t;
        if (t < 1500) {
            return 0.0;
        }
        if (t < 2500) {
            return G.ease((t - 1500) / 1000.0);
        }
        if (t < 4400) {
            return 1.0;
        }
        if (t < 5600) {
            return 1.0 - G.easeInOut((t - 4400) / 1200.0);
        }
        return 0.0;
    }

    // stepped (pixel) disc
    hidden function disc(dc as Dc, cx, cy, r, step) as Void {
        for (var y = -r; y < r; y += step) {
            var yy = y + step / 2;
            var q = r * r - yy * yy;
            var hw = s5(Math.sqrt(q > 0 ? q : 0));
            if (hw > 0) {
                dc.fillRectangle(cx - hw, cy + y, 2 * hw, step);
            }
        }
    }

    // rising bubble: small dot low, ring higher up
    hidden function bubble(dc as Dc, x, y, big, col) as Void {
        dc.setColor(col, -1);
        if (!big) {
            dc.fillRectangle(x, y, 4, 4);
            return;
        }
        dc.fillRectangle(x + 4, y, 4, 4);
        dc.fillRectangle(x, y + 4, 4, 4);
        dc.fillRectangle(x + 8, y + 4, 4, 4);
        dc.fillRectangle(x + 4, y + 8, 4, 4);
    }

    // swaying plant: n segments of 8 px from (x, base) up
    hidden function weed(dc as Dc, x, base, n, tau, ph, c1, c2) as Void {
        for (var k = 0; k < n; k++) {
            var ox = sn(Math.sin(tau * 1.3 + ph - k * 0.3) * k * 0.9 + 2);
            dc.setColor(k % 2 == 0 ? c1 : c2, -1);
            dc.fillRectangle(x + ox, base - (k + 1) * 8, k < n / 2.0 ? 8 : 4, 8);
            if (k % 3 == 1) {
                dc.fillRectangle(x + ox + (k % 2 == 0 ? 8 : -4), base - (k + 1) * 8 + 4, 4, 4);
            }
        }
    }

    // glow halo (octagon of two rects) behind lights
    hidden function halo(dc as Dc, x, y, r, col) as Void {
        dc.setColor(col, -1);
        dc.fillRectangle(sn(x - r), sn(y - r / 2), sn(2 * r), sn(r));
        dc.fillRectangle(sn(x - r / 2), sn(y - r), sn(r), sn(2 * r));
        dc.fillRectangle(sn(x - r * 0.8), sn(y - r * 0.8), sn(1.6 * r), sn(1.6 * r));
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var p = a.intro;
        var live = a.live;
        var tau = (d.h * 3600 + d.m * 60 + d.s).toFloat() + (live ? a.ms / 1000.0 : 0.0);
        // night factor from sunrise / sunset (fallback 7:00 / 19:00)
        var sr = d.sunrise >= 0 ? d.sunrise : 420;
        var ss = d.sunset >= 0 ? d.sunset : 1140;
        var mn = d.mins;
        var nf = 0.0;
        if (mn < sr - 30 || mn > ss + 30) {
            nf = 1.0;
        } else if (mn < sr + 30) {
            nf = (sr + 30 - mn) / 60.0;
        } else if (mn > ss - 30) {
            nf = (mn - ss + 30) / 60.0;
        }
        var night = nf > 0.5;
        setup(d, st, night);
        // tank light switching on (fluorescent flicker), complete at p = 0.34
        var L = p < 0.1 ? 0.0 : (p < 0.17 ? 0.75 : (p < 0.23 ? 0.12 : (p < 0.3 ? 0.9 : (p < 0.34 ? 0.45 : 1.0))));
        var cu = curious(a);

        if (st == 1) {
            // ---------------- coral reef
            var wT = G.mix(0x38B4E0, 0x0C2A4C, nf);
            var wB = G.mix(0x0A4A86, 0x02081A, nf);
            dc.setColor(lit(G.mix(0x0A1A28, 0x03070C, nf), L), -1);
            dc.fillRectangle(0, 0, 454, SURF);
            for (var i = 0; i < 11; i++) {
                dc.setColor(lit(G.mix(wT, wB, i / 10.0), L), -1);
                dc.fillRectangle(0, SURF + i * 30, 454, 30);
            }
            // light rays (moonlight at night)
            var rk = (1 - nf * 0.7) * 0.2;
            for (var r = 0; r < 3; r++) {
                var x0 = 96 + r * 112 + Math.sin(tau * 0.21 + r * 2.1) * 14;
                for (var j = 0; j < 20; j++) {
                    var y = SURF + 4 + j * 15;
                    var bnd = G.mix(wT, wB, ((y - SURF) / 30) / 10.0);
                    dc.setColor(lit(G.mix(bnd, 0xE0F8FF, rk * (1 - j / 20.0)), L), -1);
                    dc.fillRectangle(sn(x0 + j * 6), y, 16 + j * 2, 15);
                }
            }
            // surface
            dc.setColor(lit(G.mix(0x9FE6FF, 0x34566E, nf), L), -1);
            dc.fillRectangle(0, SURF, 454, 4);
            var wv = fl(tau * 3);
            for (var x = 0; x < 454; x += 24) {
                if ((x / 24 + wv) % 3 == 0) {
                    dc.fillRectangle(x, SURF - 4, 12, 4);
                }
            }
            // sand
            dc.setColor(lit(G.mix(0xE6C48A, 0x2A2A30, nf * 0.85), L), -1);
            dc.fillRectangle(0, SAND + 8, 454, 80);
            for (var x = 0; x < 454; x += 16) {
                var hh = 4 * fl(2 + 1.5 * Math.sin(x * 0.031 + 1));
                dc.fillRectangle(x, SAND + 8 - hh, 16, hh);
            }
            dc.setColor(lit(G.mix(0xC9A46A, 0x1C1C22, nf * 0.85), L), -1);
            for (var i = 0; i < 20; i += 2) {
                dc.fillRectangle(sn(60 + SNOW[i] * 0.85), SAND + 16 + (SNOW[i + 1] % 40), 8, 4);
            }
            dc.setColor(lit(G.mix(0xF6DCAA, 0x3A3A42, nf * 0.85), L), -1);
            for (var i = 20; i < 40; i += 2) {
                dc.fillRectangle(sn(70 + SNOW[i] * 0.85), SAND + 14 + (SNOW[i + 1] % 44), 4, 4);
            }
            // plants + props
            var kd = L * (1 - 0.62 * nf);
            var g1 = lit(0x2F9A4A, kd);
            var g2 = lit(0x1F7A3A, kd);
            weed(dc, 88, SAND + 8, 12, tau, 0, g1, g2);
            weed(dc, 180, SAND + 8, 8, tau, 1.7, g1, g2);
            weed(dc, 284, SAND + 8, 10, tau, 3.1, g1, g2);
            weed(dc, 384, SAND + 8, 12, tau, 4.4, g1, g2);
            Spr.draw(dc, SprAqua.CORAL_C, 48, SAND - 44, 4, [lit(0x3A0A30, kd), lit(0xC040A0, kd), lit(0xFF80D0, kd), lit(0x802070, kd)], false);
            var open = fmod(tau, 9) < 2;
            Spr.draw(dc, open ? SprAqua.CHEST_B : SprAqua.CHEST_A, 112, SAND - (open ? 32 : 24), 4,
                [lit(0x2A160A, kd), lit(0x8A4D22, kd), lit(0xB06A32, kd), lit(0xF2C23A, kd), lit(0xFFF09A, kd), lit(0x1A0D05, kd)], false);
            Spr.draw(dc, SprAqua.CORAL_B, 188, SAND - 16, 4, [lit(0x3A2A10, kd), lit(0xD8B060, kd), lit(0xF0D890, kd), lit(0x9A7A40, kd)], false);
            Spr.draw(dc, SprAqua.HELMET, 300, SAND - 44, 4, [lit(0x2A1A08, kd), lit(0xC8892A, kd), lit(0xF0C060, kd), lit(0x7A4A14, kd), lit(0x2A5470, kd), lit(0x9FD8F0, kd)], false);
            Spr.draw(dc, SprAqua.CORAL_A, 348, SAND - 48, 4, [lit(0x4A1020, kd), lit(0xFF6A8A, kd), lit(0xFFA0B8, kd), lit(0xB03050, kd)], false);
            Spr.draw(dc, SprAqua.STAR, 252, SAND - 20, 4, [lit(0x601010, kd), lit(0xFF5030, kd), lit(0xFF9070, kd)], false);
            // bubbles: helmet stream + chest burst
            var bc = lit(G.mix(0xD8F6FF, 0x6A9AB8, nf), L);
            for (var j = 0; j < 6; j++) {
                var ph = fmod(tau * 0.23 + j / 6.0, 1.0);
                var y = sn(SAND - 44 - ph * (SAND - 44 - SURF - 8));
                bubble(dc, sn(320 + Math.sin(tau * 2.3 + j * 1.9) * 6), y, ph > 0.3, bc);
            }
            if (open) {
                for (var j = 0; j < 3; j++) {
                    var ph = fmod(tau, 9) / 2.0;
                    bubble(dc, sn(128 + j * 8 + Math.sin(tau * 3 + j) * 4), sn(SAND - 36 - ph * (110 + j * 30)), j != 1, bc);
                }
            }
            // school of small fish
            if (_ns > 0) {
                var lx = 227 + 160 * Math.sin(tau * 0.17 + 1.3);
                var ly = 300 + 18 * Math.sin(tau * 0.41);
                var dir = Math.cos(tau * 0.17 + 1.3) >= 0;
                var pm = fpal(FPAL, 35, 7, night ? 1 : 0, L);
                for (var j = 0; j < _ns; j++) {
                    var x = lx + (dir ? SCH[j * 2] : -SCH[j * 2]) + 3 * Math.sin(tau * 2 + j);
                    var y = ly + SCH[j * 2 + 1] + 2 * Math.sin(tau * 1.7 + j * 2);
                    Spr.draw(dc, (fl(tau * 6) + j) % 2 == 0 ? SprAqua.MINI_A : SprAqua.MINI_B, sn(x - 14), sn(y - 8), 4, pm, !dir);
                }
            }
            // fish (the first two are the curious ones)
            for (var i = _nf - 1; i >= 0; i--) {
                var k = _fk[i];
                var q = path(i, tau, 1);
                var x = q[0];
                var y = q[1];
                var right = q[2] >= 0;
                var s = 4;
                if (i < 2 && cu > 0) {
                    var tx = i == 0 ? 150 : 304;
                    var ty = i == 0 ? 240 : 256;
                    x = G.lerp(x, tx, cu);
                    y = G.lerp(y, ty, cu);
                    if (cu > 0.5) {
                        right = i == 0;
                    }
                    s = cu > 0.75 ? 8 : (cu > 0.4 ? 6 : 4);
                    if (cu >= 1) {
                        x += (i == 0 ? 4 : -4) * ((a.t / 400) % 3 == 0 ? 1 : 0);
                    }
                }
                var spr = (fl(tau * 4) + i) % 2 == 0 ? _fa[k] : _fb[k];
                if (night) {
                    halo(dc, x, y, spr[0] * s * 0.62, lit(G.mix(wB, FPAL[k * 7 + 1], 0.1), L));
                }
                Spr.draw(dc, spr, sn(x - (spr[0] * s) / 2.0), sn(y - (spr[1] * s) / 2.0), s, fpal(FPAL, k * 7, 7, night ? 1 : 0, L), !right);
                if (i < 2 && cu >= 1) {
                    // curious bubbles from the mouth
                    var bph = ((a.t - 2500) % 900) / 900.0;
                    bubble(dc, sn(x + (i == 0 ? 1 : -1) * spr[0] * 4 - 4), sn(y - 30 - bph * 40), bph > 0.4, bc);
                }
            }
        } else if (st == 2) {
            // ---------------- koi pond from above (5 px grid: the koi are the stars here)
            var w0 = G.mix(0x2A6450, 0x08201A, nf);
            var w1 = G.mix(0x1F5242, 0x061914, nf);
            var w2 = G.mix(0x16402F, 0x041210, nf);
            dc.setColor(lit(w0, L), -1);
            dc.fillRectangle(0, 0, 454, 454);
            dc.setColor(lit(w1, L), -1);
            disc(dc, 225, 235, 170, 10);
            dc.setColor(lit(w2, L), -1);
            disc(dc, 225, 240, 105, 10);
            // dappled light / moon reflection
            if (!night) {
                dc.setColor(lit(G.mix(w0, 0xB8E8A0, 0.16), L), -1);
                for (var j = 0; j < 5; j++) {
                    var x = s5(80 + j * 70 + 18 * Math.sin(tau * 0.13 + j * 1.3));
                    var y = s5(90 + ((j * 97) % 260) + 10 * Math.sin(tau * 0.17 + j));
                    dc.fillRectangle(x, y, 20, 10);
                    dc.fillRectangle(x + 5, y - 5, 10, 20);
                }
            } else {
                for (var j = 0; j < 8; j++) {
                    dc.setColor(lit(j < 3 ? 0xE8E4C0 : (j < 6 ? 0xA8A688 : 0x6A6A58), L), -1);
                    var hw = MOON[j];
                    var x = s5(290 - hw + 5 * Math.sin(tau * 1.3 + j * 1.7));
                    var gp = 5 + s5(hw * 0.5 + 5 * Math.sin(tau * 2.1 + j));
                    var rw = 2 * hw - gp - 5;
                    dc.fillRectangle(x, 210 + j * 10, gp, 5);
                    dc.fillRectangle(x + gp + 5, 210 + j * 10, rw > 5 ? rw : 5, 5);
                }
            }
            // pebbles on the bottom
            dc.setColor(lit(G.mix(w1, 0x000000, 0.3), L), -1);
            for (var i = 0; i < 40; i += 2) {
                dc.fillRectangle(s5(70 + SNOW[i] * 0.8), s5(100 + SNOW[i + 1] * 0.9 + (i % 3) * 30), 10, 5);
            }
            // lily pads
            var kd = L * (1 - 0.6 * nf);
            var lp = [lit(0x0A2A10, kd), lit(0x2F8A3A, kd), lit(0x5AB84A, kd), lit(0x1A5A24, kd), lit(0xFFC0D8, kd), lit(0xFFE060, kd)];
            Spr.draw(dc, SprAqua.LILY_B, s5(55 + 6 * Math.sin(tau * 0.05)), 105, 5, lp, false);
            Spr.draw(dc, SprAqua.LILY_A, s5(335 + 6 * Math.sin(tau * 0.04 + 2)), 290, 5, lp, true);
            Spr.draw(dc, SprAqua.LILY_A, 75, 300, 5, lp, false);
            // ripples (from rising bubbles / feeding)
            var rc = lit(G.mix(w0, 0xD8F0E0, 0.5), L);
            for (var j = 0; j < 3; j++) {
                var ph = fmod(tau * 0.25 + j * 0.37, 1.0);
                var cyc = fl(tau * 0.25 + j * 0.37);
                var cx = 120 + ((j * 131 + cyc * 77) % 220);
                var cy = 160 + ((j * 59 + cyc * 43) % 160);
                if (cu > 0 && j < 2) {
                    cx = 227 + (j == 0 ? -20 : 24);
                    cy = 262 + (j == 0 ? 8 : -10);
                }
                dc.setColor(G.mix(rc, w1, ph), -1);
                var r = 6 + ph * 36;
                for (var k = 0; k < 12; k++) {
                    dc.fillRectangle(s5(cx + r * Math.cos(k * 0.5236)), s5(cy + r * 0.8 * Math.sin(k * 0.5236)), 5, 5);
                }
            }
            // koi (feeding after a raise)
            if (cu > 0) {
                dc.setColor(lit(0x8A5A2A, L), -1);
                for (var j = 0; j < 5; j++) {
                    if (cu < 0.9 || j % 2 == (a.t / 500) % 2) {
                        dc.fillRectangle(s5(210 + j * 10), s5(250 + ((j * 7) % 3) * 10), 5, 5);
                    }
                }
            }
            for (var i = 0; i < _nf; i++) {
                var q = path(i, tau, 2);
                var x = q[0];
                var y = q[1];
                var vx = q[2];
                var vy = q[3];
                if (cu > 0) {
                    var tx = 227 + 52 * Math.cos(i * 2.4);
                    var ty = 262 + 40 * Math.sin(i * 2.4);
                    x = G.lerp(x, tx, cu);
                    y = G.lerp(y, ty, cu);
                    if (cu > 0.3) {
                        vx = 227 - tx;
                        vy = 262 - ty;
                    }
                }
                var dir = (Math.round(Math.atan2(vy, vx) / 0.7854).toNumber() + 8) % 8;
                var spr = (fl(tau * 3) + i) % 2 == 0 ? _ka[dir] : _kb[dir];
                var k = _fk[i] % 5;
                Spr.draw(dc, spr, s5(x - 42), s5(y - 42), 5, fpal(KPAL, k * 6, 6, night ? 2 : 0, L), false);
            }
            // stone rim
            for (var k = 0; k < 18; k++) {
                var an = k * 0.349 + 0.1;
                var x = s5(227 + 214 * Math.cos(an));
                var y = s5(227 + 214 * Math.sin(an));
                var w = 30 + (k % 3) * 10;
                var h = 20 + ((k * 5) % 3) * 5;
                dc.setColor(lit(G.mix(0x6A6A5E, 0x1C1C1A, nf), L), -1);
                dc.fillRectangle(x - w / 2, y - h / 2, w, h);
                dc.fillRectangle(x - w / 2 + 5, y - h / 2 - 5, w - 10, h + 10);
                dc.setColor(lit(G.mix(0x9A9A8A, 0x2A2A28, nf), L), -1);
                dc.fillRectangle(x - w / 2 + 5, y - h / 2 - 5, w - 15, 5);
                if (k % 4 == 1) {
                    dc.setColor(lit(G.mix(0x4A7A3A, 0x16241A, nf), L), -1);
                    dc.fillRectangle(x - w / 2, y + h / 2 - 5, 15, 5);
                }
            }
            // fireflies at night
            if (night) {
                for (var j = 0; j < 6; j++) {
                    var b = Math.sin(tau * (1.1 + j * 0.23) + j * 2);
                    if (b < 0.2) {
                        continue;
                    }
                    var x = s5(90 + j * 54 + 20 * Math.sin(tau * 0.3 + j));
                    var y = s5(200 + ((j * 71) % 150) + 16 * Math.sin(tau * 0.23 + j * 3));
                    dc.setColor(lit(G.dim(0x9AB830, b), L), -1);
                    dc.fillRectangle(x - 5, y, 15, 5);
                    dc.fillRectangle(x, y - 5, 5, 15);
                    dc.setColor(lit(0xE8FF8A, L), -1);
                    dc.fillRectangle(x, y, 5, 5);
                }
            }
        } else {
            // ---------------- deep sea
            var dT = G.mix(0x08203A, 0x041222, nf);
            var dB = G.mix(0x010409, 0x000000, nf);
            for (var i = 0; i < 13; i++) {
                dc.setColor(lit(G.mix(dT, dB, i / 12.0), L), -1);
                dc.fillRectangle(0, i * 32, 454, 32);
            }
            // marine snow
            for (var i = 0; i < 40; i += 2) {
                var y = sn(fmod(SNOW[i + 1] * 1.3 + tau * 7, 360.0) + 30);
                var x = sn(SNOW[i] + 8 * Math.sin(tau * 0.4 + i));
                dc.setColor(lit(i % 6 == 0 ? 0x5A7A90 : 0x2A3E4E, L), -1);
                dc.fillRectangle(x, y, 4, 4);
            }
            // sea floor rocks
            dc.setColor(lit(0x0C141C, L), -1);
            for (var x = 0; x < 454; x += 16) {
                var hh = 8 * fl(2 + 1.6 * Math.sin(x * 0.023 + 0.6) + 0.8 * Math.sin(x * 0.07));
                dc.fillRectangle(x, SAND - hh, 16, 100);
            }
            dc.setColor(lit(0x18242E, L), -1);
            for (var x = 0; x < 454; x += 16) {
                var hh = 8 * fl(2 + 1.6 * Math.sin(x * 0.023 + 0.6) + 0.8 * Math.sin(x * 0.07));
                dc.fillRectangle(x, SAND - hh, 16, 4);
            }
            // vent chimney with drifting smoke bubbles
            dc.setColor(lit(0x1A1E24, L), -1);
            dc.fillRectangle(84, SAND - 64, 20, 64);
            dc.fillRectangle(80, SAND - 40, 28, 40);
            dc.fillRectangle(76, SAND - 16, 36, 16);
            dc.setColor(lit(0xFF6A2A, L * 0.7), -1);
            dc.fillRectangle(88, SAND - 64, 12, 4);
            var vb = lit(0x4A6A80, L);
            for (var j = 0; j < 5; j++) {
                var ph = fmod(tau * 0.18 + j / 5.0, 1.0);
                bubble(dc, sn(90 + Math.sin(tau * 1.6 + j * 2.3) * 8), sn(SAND - 72 - ph * 260), ph > 0.4, vb);
            }
            // sunken chest with a gold glint
            Spr.draw(dc, SprAqua.CHEST_A, 160, SAND - 20, 4, [lit(0x050302, L), lit(0x2A1A10, L), lit(0x3A2614, L), lit(0x8A6A20, L), lit(0xFFE080, L), 0], false);
            if (Math.sin(tau * 0.9) > 0.85) {
                dc.setColor(lit(0xFFF4C0, L), -1);
                dc.fillRectangle(188, SAND - 12, 4, 4);
            }
            // tube worms (sway)
            for (var j = 0; j < 5; j++) {
                var x = 300 + j * 12;
                var hgt = 16 + ((j * 13) % 5) * 6;
                var ox = sn(Math.sin(tau * 1.1 + j) * 4 + 2);
                dc.setColor(lit(0x8A8A80, L), -1);
                dc.fillRectangle(x, SAND - 8 - hgt, 4, hgt + 8);
                dc.setColor(lit(j % 2 == 0 ? 0xD8283A : 0x9A1A2A, L), -1);
                dc.fillRectangle(x - 4 + ox, SAND - 12 - hgt, 12, 4);
                dc.fillRectangle(x + ox, SAND - 16 - hgt, 4, 4);
            }
            // glowing sea pens
            for (var j = 0; j < 3; j++) {
                var bx = PENX[j];
                var n = PENN[j];
                for (var k = 0; k < n; k++) {
                    var ox = sn(Math.sin(tau * 0.9 + j * 2 - k * 0.35) * k * 0.8 + 2);
                    dc.setColor(lit(k % 2 == 0 ? 0x2AD8C8 : 0x0E6A66, L * (0.5 + 0.5 * Math.sin(tau * 0.7 + k * 0.4 + j).abs())), -1);
                    dc.fillRectangle(bx + ox, SAND - 8 - (k + 1) * 8, 4, 8);
                    if (k > 1 && k % 2 == 0) {
                        dc.fillRectangle(bx + ox - 4, SAND - 4 - (k + 1) * 8, 12, 4);
                    }
                }
            }
            // lanternfish
            for (var j = 0; j < _ns; j++) {
                var o = (j + 2) * 8;
                var w = 0.22 + _fp[o] * 0.15;
                var x = 227 + 190 * Math.sin(w * tau + _fp[o + 1] * 6.28);
                var y = 120 + _fp[o + 2] * 220 + 10 * Math.sin(tau + j);
                var right = Math.cos(w * tau + _fp[o + 1] * 6.28) >= 0;
                Spr.draw(dc, (fl(tau * 6) + j) % 2 == 0 ? SprAqua.LANT_A : SprAqua.LANT_B, sn(x - 18), sn(y - 10), 4,
                    [lit(0x14262E, L), lit(0x2A4A5A, L), lit(0x4A6A7A, L), lit(0x1A2A3A, L), 0, 0, lit(0x40FFF0, L)], !right);
            }
            // jellyfish
            for (var j = 1; j < _nf; j++) {
                var o = j * 8;
                var x = sn(110 + _fp[o] * 230 + 16 * Math.sin(tau * 0.07 + j));
                var y = sn(120 + _fp[o + 1] * 140 + 34 * Math.sin(tau * 0.19 + _fp[o + 2] * 6));
                var pc = _fp[o + 3] < 0.5 ? 0xFF70D0 : 0x70B8FF;
                halo(dc, x + 18, y + 14, 30, lit(G.mix(dB, pc, 0.08), L));
                var pl = (fl(tau / 0.7) + j) % 2;
                Spr.draw(dc, pl == 0 ? SprAqua.JELLY_A : SprAqua.JELLY_B, x, y, 4, [lit(pc, L), lit(G.dim(pc, 0.45), L), lit(G.dim(pc, 0.7), L), lit(G.mix(pc, 0xFFFFFF, 0.3), L)], false);
            }
            // the anglerfish and its lantern
            var aq = path(0, tau, 3);
            var ax = aq[0];
            var ay = aq[1];
            var ar = aq[2] >= 0;
            var sa = 4;
            if (cu > 0) {
                ax = G.lerp(ax, 227, cu);
                ay = G.lerp(ay, 262, cu);
                sa = cu > 0.75 ? 8 : (cu > 0.4 ? 6 : 4);
                if (cu > 0.5) {
                    ar = true;
                }
            }
            var asp = fl(tau * 2) % 2 == 0 ? SprAqua.ANGLER_A : SprAqua.ANGLER_B;
            var x0 = sn(ax - (22 * sa) / 2.0);
            var y0 = sn(ay - (16 * sa) / 2.0);
            var lx = ar ? x0 + 19.5 * sa : x0 + 2.5 * sa;
            var ly = y0 + 3.5 * sa;
            var pu = 1 + 0.12 * Math.sin(tau * 2.2);
            halo(dc, lx, ly, 52 * pu * sa / 4.0, lit(G.mix(dB, 0x40FFF0, 0.06), L));
            halo(dc, lx, ly, 34 * pu * sa / 4.0, lit(G.mix(dB, 0x40FFF0, 0.13), L));
            halo(dc, lx, ly, 18 * pu * sa / 4.0, lit(G.mix(dB, 0x40FFF0, 0.3), L));
            Spr.draw(dc, asp, x0, y0, sa, [lit(0x050507, L), lit(0x3A2C3C, L), lit(0x56425A, L), lit(0x261C2A, L), lit(0x2E2434, L), lit(0xE8E0D0, L), lit(0xC0F0FF, L), lit(0x5A4A5E, L), lit(0xB8FFF6, L)], !ar);
        }

        // ---------------- glass: time, date, slots
        var tp = G.clamp((p - 0.34) / 0.3, 0.0, 1.0);
        if (tp > 0) {
            var ts = G.timeStr(d);
            var shc = st == 1 ? G.mix(0x08304E, 0x000000, nf) : (st == 2 ? 0x06140E : 0x000814);
            var tc = st == 3 ? 0xA8F8FF : 0xFFFFFF;
            dc.setColor(shc, -1);
            F.px(dc, ts, 232, 92, 8, 1, 0);
            dc.setColor(G.mix(shc, tc, tp), -1);
            F.px(dc, ts, 228, 88, 8, 1, 0);
            var dtx = d.dowStr + " " + d.day + ". " + d.monStr;
            dc.setColor(G.dim(shc, tp), -1);
            F.px(dc, dtx, 230, 162, 2, 1, 0);
            dc.setColor(G.mix(0x000000, st == 3 ? 0x6AD8E8 : (st == 2 ? 0xE8F0D8 : 0xE8F6FF), tp), -1);
            F.px(dc, dtx, 228, 160, 2, 1, 0);
            // slots on the sand / rim
            for (var k = 0; k < 3; k++) {
                var sl = d.slots[k];
                var x = 228 + (k - 1) * 76;
                if (st == 1) {
                    dc.setColor(G.mix(0x000000, G.mix(0x8A6A3A, 0x7A8AA0, nf), tp * L), -1);
                    F.px(dc, sl[:lbl] as String, x, 390, 2, 1, 0);
                    dc.setColor(G.mix(0x000000, G.mix(0x4A2E12, 0xD8E4F4, nf), tp * L), -1);
                    F.px(dc, sl[:val] as String, x, 406, 3, 1, 0);
                } else {
                    dc.setColor(st == 2 ? 0x0A1A12 : 0x000000, -1);
                    F.px(dc, sl[:val] as String, x + 2, 408, 3, 1, 0);
                    dc.setColor(G.mix(0x000000, st == 2 ? 0xC8D8B8 : 0x3A8A98, tp), -1);
                    F.px(dc, sl[:lbl] as String, x, 390, 2, 1, 0);
                    dc.setColor(G.mix(0x000000, st == 2 ? 0xFFFFFF : 0xA8F0FF, tp), -1);
                    F.px(dc, sl[:val] as String, x, 406, 3, 1, 0);
                }
            }
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var ts = G.timeStr(d);
        var col = st == 3 ? 0x3A8A96 : (st == 2 ? 0x7A8A70 : 0x6A96B0);
        dc.setColor(col, -1);
        F.px(dc, ts, 228 + o[0], 150 + o[1], 8, 1, 2);
        dc.setColor(G.dim(col, 0.8), -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 228 + o[0], 222 + o[1], 2, 1, 0);
        // one sleeping fish outline
        var spr = st == 3 ? SprAqua.ANGLER_A : (st == 2 ? SprAqua.KOI_4A : SprAqua.CLOWN_A);
        var w = spr[0] * 4;
        var ksc = st == 2 ? 5 : 4;
        var fc = G.dim(col, 0.7);
        var pal = st == 3 ? [fc, -1, -1, -1, -1, -1, -1, fc, 0x40A8A0] : (st == 2 ? [fc, -1, -1, G.dim(fc, 0.6), -1, -1] : [fc, -1, -1, -1, -1, -1, fc]);
        Spr.draw(dc, spr, sn(227 - (spr[0] * ksc) / 2.0) + o[0], 282 + o[1] - (st == 2 ? 20 : 0), ksc, pal, st == 1);
        // bubbles
        dc.setColor(G.dim(col, 0.6), -1);
        dc.fillRectangle(sn(227 + w / 2.0) + o[0] - (st == 2 ? 60 : 0), 262 + o[1], 4, 4);
        dc.fillRectangle(sn(227 + w / 2.0) + o[0] + 8 - (st == 2 ? 60 : 0), 244 + o[1], 4, 4);
    }
}
