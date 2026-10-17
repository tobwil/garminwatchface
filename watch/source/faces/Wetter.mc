import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// WETTER — "Wetterfenster": the real weather outside as pixel art (4 px grid). Condition, temperature,
// wind, rain chance, high/low and day/night (sun elevation) drive the scene: clouds drift with the wind,
// rain streaks + drops running down the glass, snow falling and piling up, fog banks, thunder flashes,
// a tree bending in the wind, sun / moon (real phase) / stars. Every wrist raise brings a new detail
// (the cat looks back at you, new rain drops on the glass, another lightning pattern).
// Styles: 1 Fenster (a room window with curtains, cat and geranium on the sill), 2 Postkarte (a vintage
// postcard with stamp and postmark), 3 Diorama (a voxel cottage on a floating island).
// Mirrors web/js/faces/wetter.js.
class FaceWetter extends Face {
    const P = 4;
    const CX = 227;
    // style 1 window: glass x 128..328, y 112..312 (50 x 50 cells)
    const GX = 128;
    const GY = 112;
    const GW = 200;
    const GH = 200;
    // style 2 picture
    const PX0 = 68;
    const PY0 = 108;
    const PW = 320;
    const PH = 188;
    // sky bands (top -> bottom)
    const SKY_DAY = [0x3F86D8, 0x5C9CE2, 0x7CB4EC, 0xA6D0F4];
    const SKY_GREY = [0x7A8696, 0x8A95A4, 0x9BA5B2, 0xAEB6C0];
    const SKY_DUSK = [0x2C3472, 0x66498C, 0xC86C88, 0xF2A46C];
    const SKY_NIGHT = [0x060A1C, 0x0A122C, 0x101C40, 0x18284E];
    const SKY_NGREY = [0x0E1016, 0x14161E, 0x1A1D27, 0x212530];
    const FOGC = 0xB8BEC4;

    // weather state: cloud 0..3, rain 0..3, snow 0..3, storm, fog, wind 0..3, sun elevation
    hidden var _cld = 1;
    hidden var _rn = 0;
    hidden var _snw = 0;
    hidden var _stm = false;
    hidden var _fog = false;
    hidden var _wnd = 1;
    hidden var _el = 20.0;
    hidden var _night = false;
    hidden var _dusk = 0.0;
    hidden var _sunf = 0.5;
    hidden var _moonPh = 0.0;
    hidden var _live = false;
    hidden var _fps = 6;
    // colours, recomputed only when the minute / condition / style changes
    hidden var _ck = -1;
    hidden var _ck2 = -1;
    hidden var _skyc = [0, 0, 0, 0] as Array;
    hidden var _skyb = [0, 0, 0, 0] as Array;
    hidden var _clc = [0, 0, 0] as Array;
    hidden var _treec = [0, 0, 0, 0, 0] as Array;
    hidden var _tc = [0, 0, 0, 0, 0] as Array;
    hidden var _hill = [0, 0, 0, 0, 0] as Array;
    hidden var _hp = [0, 0, 0, 0, 0, 0, 0, 0, 0] as Array;
    hidden var _diop = [] as Array;
    hidden var _diot = [] as Array;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return _fps;
    }

    // Garmin Weather.CONDITION_* -> cloud / rain / snow / storm / fog / wind
    hidden function weather(d as D) as Void {
        var c = d.cond;
        _cld = 1; _rn = 0; _snw = 0; _stm = false; _fog = false;
        var w = 0;
        if (c == 0 || c == 23 || c == 39) {
            _cld = 0;
        } else if (c == 22 || c == 1 || c == 51) {
            _cld = 1;
        } else if (c == 2) {
            _cld = 2;
        } else if (c == 20) {
            _cld = 3;
        } else if (c == 5) {
            _cld = 1; w = 2;
        } else if (c == 14 || c == 26 || c == 30 || c == 44 || c == 11 || c == 13) {
            _cld = 2; _rn = 1;
        } else if (c == 3 || c == 24 || c == 48 || c == 49) {
            _cld = 3; _rn = 2;
        } else if (c == 15 || c == 25) {
            _cld = 3; _rn = 3;
        } else if (c == 16 || c == 42 || c == 45 || c == 47 || c == 33) {
            _cld = 2; _snw = 1;
        } else if (c == 4 || c == 7 || c == 18 || c == 21 || c == 43 || c == 46 || c == 50 || c == 10) {
            _cld = 3; _snw = 2;
        } else if (c == 17 || c == 19) {
            _cld = 3; _snw = 3;
        } else if (c == 6 || c == 12 || c == 27 || c == 31 || c == 35 || c == 40 || c == 41) {
            _cld = 3; _rn = 2; _stm = true;
        } else if (c == 8 || c == 9 || c == 28 || c == 38 || c == 29 || c == 32 || c == 34 || c == 36 || c == 37) {
            _cld = 2; _fog = true;
        }
        // wind: m/s -> 0 calm, 1 breeze, 2 windy, 3 gale
        var ws = d.wind;
        var wl = ws < 0 ? 1 : (ws < 3 ? 0 : (ws < 7 ? 1 : (ws < 12 ? 2 : 3)));
        if (_stm && wl < 2) {
            wl = 2;
        }
        _wnd = wl > w ? wl : w;
        var lat = d.locOk ? d.lat : 52.52;
        var lon = d.locOk ? d.lon : 13.4;
        _el = AST.elev(d.doy, d.mins, lat, lon, d.tz);
        _night = _el < -6;
        _dusk = (_el >= -6 && _el < 6) ? 1 - _el.abs() / 6.0 : 0.0;
        // fraction of the day (sun) or night (moon) passed, for the arc position
        var sr = d.sunrise;
        var ss = d.sunset;
        if (sr < 0 || ss < 0) {
            _sunf = 0.5;
        } else if (!_night) {
            _sunf = G.clamp((d.mins - sr + 30) / (ss - sr + 60), 0.0, 1.0);
        } else {
            var nl = 1440 - (ss - sr);
            _sunf = G.clamp(fm(d.mins - ss, 1440) / nl, 0.0, 1.0);
        }
    }

    hidden function skyColRaw(k) as Number {
        var g = _cld >= 3 ? 1.0 : (_cld == 2 ? 0.55 : 0.0);
        var c;
        if (_night) {
            c = G.mix(SKY_NIGHT[k], SKY_NGREY[k], g);
        } else {
            c = G.mix(SKY_DAY[k], SKY_GREY[k], g);
            if (_dusk > 0) {
                c = G.mix(c, G.mix(SKY_DUSK[k], SKY_NGREY[k], g * 0.6), _dusk);
            }
            if (_el < 0) {
                c = G.mix(c, SKY_NIGHT[k], -_el / 6.0);
            }
        }
        if (_stm) {
            c = G.mix(c, 0x20232C, 0.35);
        }
        if (_fog) {
            c = G.mix(c, _night ? 0x3A3E46 : FOGC, 0.55);
        }
        return c;
    }

    hidden function skyCol(k) as Number {
        return _skyc[k];
    }

    hidden function cloudCols() as Array {
        return _clc;
    }

    hidden function treeCols(d as D) as Array {
        return _treec;
    }

    hidden function prep(st, d as D) as Void {
        for (var k = 0; k < 4; k++) {
            _skyc[k] = skyColRaw(k);
        }
        for (var k = 0; k < 4; k++) {
            _skyb[k] = G.mix(_skyc[k], _skyc[k < 3 ? k + 1 : 3], 0.5);
        }
        _clc = cloudColsRaw();
        _treec = treeColsRaw(d);
        var night = _night;
        var snow = _snw >= 2;
        if (st == 1) {
            _tc = [shade(night ? 0x2A2230 : 0x8A4A3A), shade(night ? 0x2E3040 : 0xC8B8A0), night ? 0xFFD36A : shade(0x5A6A7C), shade(0x4A3C38), snow ? shade(0xF4F8FF) : shade(night ? 0x342A3A : 0x9A5A48)];
        } else if (st == 2) {
            _hill = [shade(snow ? 0xC8D4E0 : 0x7A96A8), shade(snow ? 0xF0F4FA : 0x5A9A3A), shade(snow ? 0xD8E2EE : 0x4A8A30), shade(0x8A6A44), shade(snow ? 0xD8E0EA : 0xD8C08A)];
            _hp = [shade(snow ? 0xF4F8FF : 0xC0483A), shade(0x5A2A1E), shade(0xF2ECE0), shade(0x5A3A24), night ? 0xFFD36A : shade(0x7AB0D8), shade(0x6A4428), shade(0x7A7A7A), 0, shade(0xE8404A)];
        } else {
            _diop = [
                shade(snow ? 0xF4F8FF : 0x6CBF4A), shade(snow ? 0xE0E8F2 : 0x86D45A), shade(0x8A5A34), shade(0x5E3A22),
                shade(snow ? 0xF4F8FF : 0xC8503A), shade(snow ? 0xC8D0DC : 0x8A3226), shade(0xEFE2C4), shade(0xBFAE8E),
                night ? 0xFFD36A : shade(0x9AD0F0), shade(0x5A3A22), shade(0x8A8A8A), shade(0x3A2A22), shade(snow ? 0xDCE4EE : 0xA43C2C),
                shade(snow ? 0xE8EEF6 : 0xD8C08A), shade(snow ? 0xE8F0F8 : 0x5AA83A), shade(0x3A7A2A), shade(0x6A4A2A), shade(0x6E5A4A),
                shade(snow ? 0xF4F8FF : 0xF08AB0), shade(_rn > 0 ? 0x6A9AD8 : 0x4A8AD8)];
            _diot = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, _diop[14], _diop[15], _diop[16]];
            if (d.mon >= 9 && d.mon <= 11 && !snow) {
                _diot[14] = shade(0xD0782A);
                _diot[15] = shade(0x9A4A1E);
            }
        }
    }

    // fade a scene colour into fog / night
    hidden function shade(c) as Number {
        if (_night) {
            c = G.mix(c, 0x05070E, 0.62);
        } else if (_el < 4) {
            c = G.mix(c, 0x1A1830, G.clamp((4 - _el) / 10.0, 0.0, 0.55));
        }
        if (_fog) {
            c = G.mix(c, _night ? 0x3A3E46 : FOGC, 0.5);
        }
        return c;
    }

    hidden function q4(v) as Number {
        return Math.floor(v / 4.0).toNumber() * 4;
    }

    // float modulo (positive)
    hidden function fm(v, m) {
        return v - m * Math.floor(v / m.toFloat());
    }

    // ---- outside: sky, stars, sun/moon, clouds inside the rect (x, y, w, h); horizon at y + h
    hidden function outside(dc as Dc, x, y, w, h, t, seed) as Void {
        // bands (8 on the full-screen sky: every second one a blend)
        var nb = h > 300 ? 8 : 4;
        var bh = q4(h / nb.toFloat());
        for (var k = 0; k < nb; k++) {
            var c;
            if (nb == 4) {
                c = skyCol(k);
            } else {
                c = k % 2 == 0 ? _skyc[k >> 1] : _skyb[k >> 1];
            }
            dc.setColor(c, -1);
            dc.fillRectangle(x, y + k * bh, w, k == nb - 1 ? h - (nb - 1) * bh : bh);
        }
        // stars (clear night)
        if (_night && _cld < 2 && !_fog) {
            var s = 777;
            var ns = h > 300 ? 40 : 22;
            for (var i = 0; i < ns; i++) {
                s = G.rnd(s);
                var sx = x + q4((s % 1000) * w / 1000.0);
                s = G.rnd(s);
                var sy = y + q4((s % 1000) * h * 0.6 / 1000.0);
                var tw = (i * 7 + t / 400) % 9 == 0;
                dc.setColor(tw ? 0x6A7090 : (i % 3 == 0 ? 0xFFF4D0 : 0xC8D0E8), -1);
                dc.fillRectangle(sx, sy, P, P);
            }
        }
        // sun / moon on an arc across the rect
        var pos = sunPos(x, y, w, h);
        if (!_fog && _cld < 3) {
            if (!_night) {
                var ph = (t / 500) % 2;
                Spr.draw(dc, SprWetter.SUN, pos[0] - 18, pos[1] - 18, P, [0xFFF6C8, 0xFFD23F, ph == 0 ? 0xFFE27A : -1], false);
            } else {
                var ph = _moonPh;
                var spr = null;
                if (ph < 0.06 || ph > 0.94) {
                    spr = null;
                } else if (ph < 0.19 || ph > 0.81) {
                    spr = SprWetter.MOON_C;
                } else if (ph < 0.31 || ph > 0.69) {
                    spr = SprWetter.MOON_H;
                } else if (ph < 0.44 || ph > 0.56) {
                    spr = SprWetter.MOON_G;
                } else {
                    spr = SprWetter.MOON_F;
                }
                if (spr != null) {
                    Spr.draw(dc, spr, pos[0] - 14, pos[1] - 14, P, [_cld >= 2 ? 0x9AA0A8 : 0xF4F0D8, 0xC8C4A8], ph > 0.5);
                }
            }
        }
        // two birds crossing the sky (fair weather, daytime)
        if (!_night && _rn == 0 && _snw == 0 && !_fog && _el > 3) {
            dc.setColor(0x2A2A36, -1);
            for (var i = 0; i < 2; i++) {
                var bx = x - 12 + q4(fm(seed * (i + 3) + t * (0.028 + i * 0.006), w + 24));
                var by = y + q4(h * (0.22 + i * 0.12) + 6 * Math.sin(t * 0.002 + i * 2));
                var up = (t / 260 + i) % 2 == 0;
                dc.fillRectangle(bx, by, P, P);
                dc.fillRectangle(bx - P, by - (up ? P : 0), P, P);
                dc.fillRectangle(bx + P, by - (up ? P : 0), P, P);
            }
        }
        // clouds drifting with the wind
        var n = _cld == 0 ? 1 : (_cld == 1 ? 2 : 3);
        var spd = (0.004 + _wnd * 0.006) * (_live ? 1 : 0);
        var cc = cloudCols();
        var s = seed;
        for (var i = 0; i < n; i++) {
            s = G.rnd(s);
            var big = i % 2 == 0;
            var spr = big ? SprWetter.CLOUD_A : SprWetter.CLOUD_B;
            var cw = spr[0] * P;
            var span = w + cw;
            var cx = x - cw + fm((s % 1000) * span / 1000.0 + t * spd * (big ? 1 : 1.4), span);
            var hc = (h * 0.45 / P).toNumber();
            var cy = y + q4(((i * 37 + (s % 13)) % (hc > 4 ? hc : 4)) * P);
            if (_cld == 0 && i == 0 && _night) {
                continue;
            }
            Spr.draw(dc, spr, q4(cx), cy, P, cc, false);
        }
    }

    hidden function cloudColsRaw() as Array {
        if (_stm) {
            return [0x8A8F9A, 0x5E6470, 0x40444E];
        }
        if (_night) {
            return _cld >= 2 ? [0x3A4050, 0x2C3240, 0x1E232E] : [0x5A6274, 0x3A4254, 0x262C3A];
        }
        if (_dusk > 0.4) {
            return [0xFFE0D0, 0xE8A8A0, 0x9A6A80];
        }
        if (_cld >= 2 || _rn > 0) {
            return [0xD4DAE0, 0xB0B8C2, 0x848E9A];
        }
        return [0xFFFFFF, 0xE8EEF4, 0xBCC8D4];
    }

    // sun (day) or moon (night) position on an arc across the rect
    hidden function sunPos(x, y, w, h) as Array {
        // full-screen sky (diorama): an arc behind the island, highest just above the roof
        if (h > 300) {
            var an = (_sunf - 0.5) * 150 * Math.PI / 180;
            return [q4(227 + 194 * Math.sin(an)), q4(320 - 194 * Math.cos(an))];
        }
        return [q4(x + w * (0.3 + 0.58 * _sunf)), q4(y + h * 0.5 - h * 0.36 * Math.sin(_sunf * Math.PI))];
    }

    // ---- precipitation within the rect: rain streaks / snow flakes
    hidden function precip(dc as Dc, x, y, w, h, t, seed) as Void {
        if (_rn == 0 && _snw == 0) {
            return;
        }
        var n = _rn > 0 ? 8 + _rn * 8 : 8 + _snw * 8;
        var slant = _wnd >= 2 ? 2 : (_wnd == 1 ? 1 : 0);
        var s = seed;
        if (_rn > 0) {
            dc.setColor(_night ? 0x6A7A94 : (_stm ? 0xAAB4C4 : 0xD0DCEC), -1);
        } else {
            dc.setColor(_night ? 0xB8C0D0 : 0xFFFFFF, -1);
        }
        if (_snw > 0 && !_night && _cld < 3) {
            dc.setColor(0xF8FCFF, -1);
        }
        s = s % 65537;
        var tr = t * 8 / 25;
        var tsn = t * 45 / 1000;
        for (var i = 0; i < n; i++) {
            s = (s * 75 + 74) % 65537;
            var x0 = s % 1000;
            s = (s * 75 + 74) % 65537;
            var y0 = s % 1000;
            if (_rn > 0) {
                var yy = (y0 * h / 1000 + tr) % h;
                var xx = (x0 * w / 1000 + yy * slant / 4) % w;
                // streak, leaning with the wind
                var rx = x + xx / 4 * 4;
                var ry = y + yy / 4 * 4;
                if (slant == 0) {
                    dc.fillRectangle(rx, ry, P, P * 3);
                } else {
                    dc.fillRectangle(rx, ry, P, P * 2);
                    dc.fillRectangle(rx + P, ry + P * 2, P, P * slant);
                }
            } else {
                var yy = (y0 * h / 1000 + tsn) % h;
                var xx = (x0 * w / 1000 + yy * slant * 3 / 10 + (6 * Math.sin(t * 0.002 + i)).toNumber() + w) % w;
                var fx = x + xx / 4 * 4;
                var fy = y + yy / 4 * 4;
                if (i % 3 == 0) {
                    // big flake in front: a little plus
                    dc.fillRectangle(fx - P, fy, 3 * P, P);
                    dc.fillRectangle(fx, fy - P, P, 3 * P);
                } else {
                    dc.fillRectangle(fx, fy, P, P);
                }
            }
        }
    }

    // ---- fog banks drifting through the lower part of the rect
    hidden function fogBands(dc as Dc, x, y, w, h, t) as Void {
        if (!_fog) {
            return;
        }
        var fc = _night ? 0x4A4E58 : 0xD2D6DA;
        for (var k = 0; k < 3; k++) {
            var by = y + h - 24 - k * 28;
            var off = q4(fm(t * (0.01 + k * 0.004) + k * 60, 64));
            dc.setColor(G.mix(skyCol(3), fc, 0.75 - k * 0.15), -1);
            dc.fillRectangle(x, by, w, 12);
            // dithered fringe
            var nc = w / 8;
            for (var c = 0; c < nc; c++) {
                dc.fillRectangle(x + ((c * 8 + off) % w), by - 4, P, P);
            }
        }
    }

    // lightning: one strike pattern per wrist raise; returns flash strength 0..1
    hidden function flash(t, wake) {
        if (!_stm || !_live) {
            return 0.0;
        }
        var s = G.rnd(wake * 31 + 7);
        for (var i = 0; i < 3; i++) {
            s = G.rnd(s);
            var t0 = 1200 + i * 2600 + (s % 1800);
            var u = t - t0;
            if (u >= 0 && u < 160) {
                return u < 60 ? 1.0 : 0.5;
            }
        }
        return 0.0;
    }

    // crown lean (cells) for the wind level and time
    hidden function treeLean(t) as Number {
        if (_wnd == 0 || !_live) {
            return _wnd >= 2 ? 1 : 0;
        }
        var f = (t / (_wnd == 1 ? 700 : (_wnd == 2 ? 350 : 220))) % 4;
        if (_wnd == 1) {
            return f == 3 ? 1 : 0;
        }
        if (_wnd == 2) {
            return f % 2 == 0 ? 1 : 2;
        }
        return f == 1 ? 1 : 2;
    }

    // the big tree at (x, y): trunk + leaning crown, bare in winter
    hidden function tree(dc as Dc, d as D, t, x, y) as Void {
        var c = treeCols(d);
        if (d.mon == 12 || d.mon <= 2) {
            Spr.draw(dc, SprWetter.TREE_BARE, x, y, P, c, false);
            return;
        }
        dc.setColor(c[0], -1);
        dc.fillRectangle(x + 13 * P, y + 16 * P, 3 * P, 16 * P);
        dc.fillRectangle(x + 11 * P, y + 31 * P, 6 * P, P);
        dc.setColor(c[1], -1);
        dc.fillRectangle(x + 14 * P, y + 16 * P, P, 15 * P);
        Spr.draw(dc, SprWetter.TREE_CROWN, x + treeLean(t) * P, y, P, c, false);
    }

    hidden function treeColsRaw(d as D) as Array {
        var lv;
        if (d.mon >= 3 && d.mon <= 5) {
            lv = [0x3C7A2A, 0x5AA83A, 0x8AD05A];
        } else if (d.mon >= 6 && d.mon <= 8) {
            lv = [0x2C5E22, 0x3F8030, 0x62A844];
        } else {
            lv = [0x9A4A1E, 0xD0782A, 0xF0B040];
        }
        if (_snw >= 2) {
            lv = [lv[0], 0xD8E0E8, 0xFFFFFF];
        }
        return [shade(0x4A3020), shade(0x6A4A30), shade(lv[0]), shade(lv[1]), shade(lv[2])];
    }

    // ---- texts shared by the styles
    hidden function tempStr(d as D) as String {
        if (d.temp == -99) {
            return "--°";
        }
        return Math.round(d.metric ? d.temp : d.temp * 1.8 + 32).toNumber() + "°";
    }

    hidden function tStr(v, d as D) as String {
        if (v == -99) {
            return "--";
        }
        return Math.round(d.metric ? v : v * 1.8 + 32).toNumber() + "°";
    }

    hidden function rainStr(d as D) as String {
        return d.rain < 0 ? "--" : d.rain.toNumber() + "%";
    }

    // room colours under the lamp at night
    hidden function lampPal(c as Array, night) as Array {
        if (night) {
            for (var i = 0; i < c.size(); i++) {
                c[i] = G.mix(c[i], 0x1A1008, 0.3);
            }
        }
        return c;
    }

    // ---- style 1: the window
    // clearClip, but over the cached layer the repaint stays inside the glass / the picture
    hidden function unclip(dc as Dc, a as A, x, y, w, h) as Void {
        if (a.bg) {
            dc.setClip(x, y, w, h);
        } else {
            dc.clearClip();
        }
    }

    hidden function styleWindow(dc as Dc, d as D, a as A, t, p) as Void {
        var acc = d.accent;
        var wake = d.wakeN;
        var night = _night;
        // wall: striped wallpaper, darker at night (lamp light)
        if (!a.bg) {
            dc.setColor(night ? 0x2A2A33 : 0x34514E, -1);
            dc.fillRectangle(0, 0, 454, 454);
            dc.setColor(night ? 0x24242C : 0x2D4744, -1);
            for (var x = 8; x < 454; x += 24) {
                dc.fillRectangle(x, 0, 8, 454);
            }
        }
        // outside
        var fl = flash(t, wake);
        dc.setClip(GX, GY, GW, GH);
        outside(dc, GX, GY, GW, GH, t, wake * 13 + 5);
        if (fl > 0) {
            dc.setColor(G.mix(skyCol(1), 0xEEF2FF, fl * 0.8), -1);
            dc.fillRectangle(GX, GY, GW, GH);
        }
        if (fl >= 1) {
            var s = G.rnd(wake * 17 + t / 2600);
            Spr.draw(dc, SprWetter.BOLT, GX + 40 + q4(s % 100), GY + 8, P, [0xFFFFFF, 0xC8D4FF], s % 2 == 0);
        }
        // town skyline
        Spr.draw(dc, SprWetter.TOWN, GX, GY + GH - 44, P, _tc, false);
        // tree
        tree(dc, d, t, GX + 76, GY + GH - 128);
        // thermometer outside on the frame
        thermo(dc, d, GX + 6, GY + 4);
        precip(dc, GX, GY, GW, GH, t, wake * 7 + 3);
        fogBands(dc, GX, GY, GW, GH, t);
        // snow pile on the outer sill
        if (_snw > 0) {
            var ph = _snw + (a.live ? (t / 3000 < 2 ? t / 3000 : 2) : 1);
            dc.setColor(night ? 0xA8B0C0 : 0xF4F8FF, -1);
            for (var c = 0; c < 50; c++) {
                var hh = ph + ((c * 7) % 5 == 0 ? 1 : 0) - ((c * 3) % 7 == 0 ? 1 : 0);
                dc.fillRectangle(GX + c * P, GY + GH - hh * P, P, hh * P);
            }
        }
        // drops running down the glass (rain)
        if (_rn > 0) {
            var s = (wake * 101 + 9) % 65537;
            var nd = 4 + _rn * 3;
            for (var i = 0; i < nd; i++) {
                s = (s * 75 + 74) % 65537;
                var dx = GX + 4 + (s % 1000) * (GW - 8) / 1000 / 4 * 4;
                s = (s * 75 + 74) % 65537;
                var dy = GY + (((s >> 3) % 1000) * GH / 1000 + t * (48 + (s % 100)) / 4000) % GH / 4 * 4;
                dc.setColor(night ? 0x34405A : 0xE4EEF8, -1);
                dc.fillRectangle(dx, dy - 3 * P, P, 3 * P);
                dc.setColor(night ? 0x8A9AB8 : 0xFFFFFF, -1);
                dc.fillRectangle(dx, dy, P, P + 4);
            }
        }
        // frost in the pane corners
        if (d.temp != -99 && d.temp <= 0) {
            var fc = [night ? 0x8A9AB0 : 0xD8ECFF, 0xFFFFFF];
            Spr.draw(dc, SprWetter.FROST, GX, GY, P, fc, false);
            Spr.draw(dc, SprWetter.FROST, GX + GW - 40, GY, P, fc, true);
            Spr.draw(dc, SprWetter.FROST, GX, GY + 72, P, fc, false);
            Spr.draw(dc, SprWetter.FROST, GX + GW - 40, GY + 72, P, fc, true);
        }
        // glass sheen
        dc.setColor(G.mix(skyCol(1), 0xFFFFFF, 0.16), -1);
        for (var k = 0; k < 5; k++) {
            dc.fillRectangle(GX + 20 + k * P, GY + 132 - k * 2 * P, P, 2 * P);
        }
        unclip(dc, a, GX, GY, GW, GH);

        // window frame (painted wood) + cross bars
        var fw = 0xEEE8DA;
        var fs = 0xC6BCA8;
        var fwN = night ? G.mix(fw, 0x2A2018, 0.35) : fw;
        var fsN = night ? G.mix(fs, 0x2A2018, 0.35) : fs;
        dc.setColor(fsN, -1);
        dc.fillRectangle(GX - 12, GY - 12, GW + 24, 12);
        dc.fillRectangle(GX - 12, GY, 12, GH);
        dc.fillRectangle(GX + GW, GY, 12, GH);
        dc.setColor(fwN, -1);
        dc.fillRectangle(GX - 12, GY - 12, GW + 24, 8);
        dc.fillRectangle(GX - 12, GY - 4, 8, GH + 4);
        dc.fillRectangle(GX + GW + 4, GY - 4, 8, GH + 4);
        dc.fillRectangle(GX + 96, GY, 8, GH);
        dc.fillRectangle(GX, GY + 64, GW, 8);
        dc.setColor(0x8C826E, -1);
        dc.fillRectangle(GX + 104, GY, 4, GH);
        dc.fillRectangle(GX, GY + 72, GW, 4);
        dc.fillRectangle(GX - 4, GY - 4, 4, GH + 4);

        // curtains: closed during the intro, then drawn aside
        var op = G.easeInOut(G.clamp((p - 0.1) / 0.75, 0.0, 1.0));
        curtain(dc, acc, op, false, night);
        curtain(dc, acc, op, true, night);
        // rod
        dc.setColor(0x5A3A22, -1);
        dc.fillRectangle(76, 84, 302, 8);
        dc.setColor(0x8A5A32, -1);
        dc.fillRectangle(68, 80, 12, 16);
        dc.fillRectangle(374, 80, 12, 16);

        // sill (inside)
        dc.setColor(night ? 0x6A4A2A : 0xA8743E, -1);
        dc.fillRectangle(100, GY + GH + 12, 256, 12);
        dc.setColor(night ? 0x4A321C : 0x7A4E26, -1);
        dc.fillRectangle(100, GY + GH + 24, 256, 8);

        // cat (sleeps at night), plant, mug when cold
        var sy = GY + GH + 12;
        var cp = lampPal([0x3A2416, 0xE0873A, 0xF6B26B, 0xB05A26, 0x8ADC58, 0x5A2A1A], night);
        if (night) {
            Spr.draw(dc, SprWetter.CAT_SLEEP, 148, sy - 32, P, cp, false);
            if (a.live) {
                var z = (t / 700) % 3;
                dc.setColor(0xD8D0E8, -1);
                F.px(dc, "z", 206 + z * 6, sy - 44 - z * 12, 2, 0, 0);
            }
        } else {
            var mode = wake % 4;
            Spr.draw(dc, SprWetter.CAT, 140, sy - 72, P, cp, false);
            // on some raises the cat looks back over its shoulder at you
            if (mode == 0 && a.live && t > 600 && t < 3600) {
                dc.setColor(cp[4], -1);
                dc.fillRectangle(152, sy - 52, P, 2 * P);
                dc.fillRectangle(172, sy - 52, P, 2 * P);
                dc.setColor(cp[0], -1);
                dc.fillRectangle(156, sy - 52, P, 2 * P);
                dc.fillRectangle(176, sy - 52, P, 2 * P);
                dc.setColor(cp[5], -1);
                dc.fillRectangle(164, sy - 44, P, P);
            }
            var tf = a.live ? (t / 420) % 4 : 0;
            Spr.draw(dc, tf == 1 ? SprWetter.TAIL_B : (tf == 3 ? SprWetter.TAIL_C : SprWetter.TAIL_A), 188, sy + 8, P, cp, false);
        }
        var pp = lampPal([0x24301A, 0x3C7A2A, 0x62A844, 0xD8302A, 0xFF7A6A, 0xC0603A, 0x8A3E24], night);
        Spr.draw(dc, SprWetter.PLANT, 274, sy - 64, P, pp, false);
        if (d.temp != -99 && d.temp < 8) {
            Spr.draw(dc, SprWetter.MUG, 244, sy - 28, P, [0x2A2A2A, night ? 0x9A3A3A : 0xD84A3A, 0x7A4A2A], false);
            if (a.live) {
                dc.setColor(night ? 0x8A8A9A : 0xE8EEF4, -1);
                for (var k = 0; k < 3; k++) {
                    var ph = fm(t / 600.0 + k * 0.33, 1);
                    dc.fillRectangle(252 + q4(4 * Math.sin(ph * 6 + k)), sy - 32 - q4(ph * 24), P, P);
                }
            }
        }

        // over the cached room only the glass is repainted (weather, tree, bars, curtains, cat)
        if (a.bg) {
            dc.clearClip();
            return;
        }
        // wall calendar (date) left, weather note right: high / low / rain chance
        calendar(dc, d, 24, 148, night);
        note(dc, d, 372, 152, night);

        // time on the wall above the window
        var ts = G.timeStr(d);
        var ty = 30 - q4((1 - G.ease(p * 1.4)) * 60);
        dc.setColor(night ? 0x14141A : 0x22322F, -1);
        F.px(dc, ts, CX + 4, ty + 4, 7, 1, 0);
        dc.setColor(night ? 0xFFE2A8 : 0xFFF4DC, -1);
        F.px(dc, ts, CX, ty, 7, 1, 0);

        // slots under the sill
        slots(dc, d, p, 356, night ? 0x9A90A8 : 0x9EC0B8, night ? 0xFFE2A8 : 0xFFFFFF);
    }

    hidden function curtain(dc as Dc, acc, op, right, night) as Void {
        var base = night ? G.mix(acc, 0x1A1008, 0.4) : acc;
        var dk = G.mix(base, 0x000000, 0.3);
        var lt = G.mix(base, 0xFFFFFF, 0.25);
        // width at the top, the tie (row 33) and the bottom, closed -> open
        var wTop = Math.floor(G.lerp(28, 10, op)).toNumber() * P;
        var wTie = Math.floor(G.lerp(28, 5, op)).toNumber() * P;
        var wBot = Math.floor(G.lerp(28, 8, op)).toNumber() * P;
        // rows of equal width are drawn as one block
        var r0 = 0;
        var wp = -1;
        for (var r = 0; r <= 60; r++) {
            var w = -1;
            if (r < 60) {
                w = (r < 33 ? wTop + (wTie - wTop) * r / 33 : wTie + (wBot - wTie) * (r - 33) / 27) / 4 * 4;
            }
            if (w == wp) {
                continue;
            }
            if (wp > 0) {
                var x0 = right ? 380 - wp : 76;
                var y = 88 + r0 * P;
                var hh = (r - r0) * P;
                dc.setColor(base, -1);
                dc.fillRectangle(x0, y, wp, hh);
                // folds: two darker stripes and a highlight
                dc.setColor(dk, -1);
                dc.fillRectangle(x0 + wp * 3 / 10 / 4 * 4, y, P, hh);
                dc.fillRectangle(x0 + wp * 7 / 10 / 4 * 4, y, P, hh);
                dc.setColor(lt, -1);
                dc.fillRectangle(x0 + wp / 2 / 4 * 4, y, P, hh);
            }
            r0 = r;
            wp = w;
        }
        // tie band
        if (op > 0.3) {
            dc.setColor(G.mix(base, 0x000000, 0.45), -1);
            dc.fillRectangle(right ? 380 - wTie - 4 : 76, 88 + 33 * P, wTie + 4, 8);
        }
    }

    hidden function thermo(dc as Dc, d as D, x, y) as Void {
        Spr.draw(dc, SprWetter.THERMO, x, y, P, [0xE8E8E8, 0x3A4250, 0xD8302A, 0x9AA4B0], false);
        if (d.temp != -99) {
            var f = G.clamp((d.temp + 20) / 60.0, 0.0, 1.0);
            var hh = (f * 11).toNumber() * P;
            dc.setColor(0xD8302A, -1);
            dc.fillRectangle(x + P * 2, y + 48 - hh, P, hh);
        }
        dc.setColor(_night ? 0xC8D0E0 : 0x1A2430, -1);
        F.px(dc, tempStr(d), x + 26, y + 24, 2, 0, 0);
    }

    hidden function calendar(dc as Dc, d as D, x, y, night) as Void {
        var pap = night ? 0xA8A090 : 0xF2EAD8;
        var red = night ? 0x8A3024 : 0xC8402E;
        dc.setColor(0x1A1A1A, -1);
        dc.fillRectangle(x + 30, y - 12, 4, 12);
        dc.setColor(pap, -1);
        dc.fillRectangle(x, y, 64, 72);
        dc.setColor(G.mix(pap, 0x000000, 0.2), -1);
        dc.fillRectangle(x + 4, y + 72, 64, 4);
        dc.fillRectangle(x + 64, y + 4, 4, 68);
        dc.setColor(red, -1);
        dc.fillRectangle(x, y, 64, 18);
        dc.setColor(0xFFFFFF, -1);
        F.px(dc, d.dowStr, x + 32, y + 3, 2, 1, 0);
        dc.setColor(0x2A2A2A, -1);
        F.px(dc, "" + d.day, x + 32, y + 24, 4, 1, 0);
        dc.setColor(red, -1);
        F.px(dc, d.monStr, x + 32, y + 56, 2, 1, 0);
    }

    hidden function note(dc as Dc, d as D, x, y, night) as Void {
        var pap = night ? 0x9A9688 : 0xFAF4E0;
        dc.setColor(pap, -1);
        dc.fillRectangle(x, y, 64, 64);
        dc.setColor(G.mix(pap, 0x000000, 0.2), -1);
        dc.fillRectangle(x + 4, y + 64, 64, 4);
        dc.fillRectangle(x + 64, y + 4, 4, 64);
        dc.setColor(0xD8302A, -1);
        dc.fillRectangle(x + 28, y - 4, 8, 8);
        var ic = night ? 0x5A5A5A : 0x3A3A3A;
        Spr.draw(dc, SprWetter.ARROW_UP, x + 6, y + 8, 2, [0xD8402E], false);
        Spr.draw(dc, SprWetter.ARROW_DN, x + 6, y + 28, 2, [0x2E6AD8], false);
        Spr.draw(dc, SprWetter.UMBRELLA, x + 5, y + 46, 2, [0x2E6AD8, ic], false);
        dc.setColor(ic, -1);
        F.px(dc, tStr(d.hiT, d), x + 40, y + 8, 2, 1, 0);
        F.px(dc, tStr(d.loT, d), x + 40, y + 28, 2, 1, 0);
        F.px(dc, rainStr(d), x + 40, y + 48, 2, 1, 0);
    }

    hidden function slots(dc as Dc, d as D, p, y, lc, vc) as Void {
        for (var k = 0; k < 3; k++) {
            var sl = d.slots[k];
            var x = CX + (k - 1) * 96;
            var sp = G.stag(p, k, 0.12, 0.5);
            if (sp <= 0) {
                continue;
            }
            dc.setColor(lc, -1);
            F.px(dc, sl[:lbl] as String, x, y, 2, 1, 0);
            dc.setColor(vc, -1);
            F.px(dc, sl[:val] as String, x, y + 20 + q4((1 - G.ease(sp)) * 16), 3, 1, 0);
        }
    }

    // ---- caption for the postcard
    hidden function greeting() as String {
        if (_stm) { return "Stürmische Grüße!"; }
        if (_snw > 0) { return "Verschneite Grüße!"; }
        if (_rn > 0) { return "Regnerische Grüße!"; }
        if (_fog) { return "Neblige Grüße!"; }
        if (_wnd >= 2) { return "Windige Grüße!"; }
        if (_night) { return _cld < 2 ? "Sternklare Grüße!" : "Gute Nacht!"; }
        if (_cld >= 2) { return "Wolkige Grüße!"; }
        return "Sonnige Grüße!";
    }

    // stamp icon for the current weather
    hidden function icon() as ByteArray {
        if (_stm) { return SprWetter.ICON_STORM; }
        if (_snw > 0) { return SprWetter.ICON_SNOW; }
        if (_rn > 0) { return SprWetter.ICON_RAIN; }
        if (_fog) { return SprWetter.ICON_FOG; }
        if (_cld >= 2) { return SprWetter.ICON_CLOUD; }
        return _night ? SprWetter.ICON_MOON : SprWetter.ICON_SUN;
    }

    // pixel text with a 1-dot shadow
    hidden function ptext(dc as Dc, txt as String, x, y, sc, col, sh) as Void {
        dc.setColor(sh, -1);
        F.px(dc, txt, x + sc, y + sc, sc, 1, 0);
        dc.setColor(col, -1);
        F.px(dc, txt, x, y, sc, 1, 0);
    }

    // ---- style 2: the postcard. Picture x 68..388, y 108..296 on a cream card with airmail border
    hidden function stylePostcard(dc as Dc, d as D, a as A, t, p) as Void {
        var wake = d.wakeN;
        var night = _night;
        var card = 0xF3EAD6;
        var ink = 0x2C3448;
        if (!a.bg) {
        dc.setColor(card, -1);
        dc.fillRectangle(0, 0, 454, 454);
        // airmail border
        dc.setPenWidth(10);
        for (var k = 0; k < 40; k++) {
            dc.setColor(k % 2 == 0 ? 0xC8302A : 0x2A4AA8, -1);
            G.arcC(dc, CX, CX, 220, k * 9 + 1, k * 9 + 6);
        }
        // picture frame (white deckle) + shadow
        dc.setColor(0xD8CCB0, -1);
        dc.fillRectangle(PX0 - 4, PY0 - 4, PW + 12, PH + 12);
        dc.setColor(0xFFFFFF, -1);
        dc.fillRectangle(PX0 - 8, PY0 - 8, PW + 16, PH + 16);
        }
        // the picture is printed top -> bottom during the intro
        var rv = q4(G.ease(p * 1.3) * PH);
        if (rv < 4) {
            rv = 4;
        }
        dc.setClip(PX0, PY0, PW, rv);
        outside(dc, PX0, PY0, PW, PH - 56, t, wake * 13 + 5);
        var fl = flash(t, wake);
        if (fl > 0) {
            dc.setColor(G.mix(skyCol(1), 0xEEF2FF, fl * 0.8), -1);
            dc.fillRectangle(PX0, PY0, PW, PH);
        }
        var hz = PY0 + PH - 56;
        // far hills (hazy), near meadow: stepped columns
        dc.setColor(_hill[0], -1);
        for (var c = 0; c < 40; c++) {
            var hh = q4(24 + 14 * Math.sin(c * 0.3 + 1.2) + 8 * Math.sin(c * 0.71));
            dc.fillRectangle(PX0 + c * 8, hz - hh, 8, hh + 8);
        }
        dc.setColor(_hill[1], -1);
        for (var c = 0; c < 40; c++) {
            var hh = q4(6 + 8 * Math.sin(c * 0.17 + 0.4));
            dc.fillRectangle(PX0 + c * 8, hz - hh + 8, 8, 60 + hh);
        }
        dc.setColor(_hill[2], -1);
        for (var c = 0; c < 40; c++) {
            dc.fillRectangle(PX0 + c * 8, hz + 36 + q4(4 * Math.sin(c * 0.4)), 8, 24);
        }
        // tree, house, path, fence
        tree(dc, d, t, PX0 + 4, hz - 112);
        Spr.draw(dc, SprWetter.HOUSE2, PX0 + 168, hz - 72, P, _hp, false);
        // chimney smoke
        if (a.live && !_stm) {
            dc.setColor(night ? 0x5A5A66 : 0xE8E8EC, -1);
            for (var k = 0; k < 4; k++) {
                var ph = fm(t / 900.0 + k * 0.25, 1);
                dc.fillRectangle(q4(PX0 + 232 + ph * 10 * (_wnd + 1) + 2 * Math.sin(k + t * 0.003)), q4(hz - 72 - ph * 40), P, P);
            }
        }
        dc.setColor(_hill[3], -1);
        for (var k = 0; k < 7; k++) {
            dc.fillRectangle(PX0 + 112 + k * 12, hz + 4, P, 16);
        }
        dc.fillRectangle(PX0 + 112, hz + 8, 76, P);
        dc.setColor(_hill[4], -1);
        for (var k = 0; k < 6; k++) {
            dc.fillRectangle(PX0 + 208 + k * 8, hz + 12 + k * 8, 24, 8);
        }
        precip(dc, PX0, PY0, PW, PH, t, wake * 7 + 3);
        fogBands(dc, PX0, PY0 + 60, PW, PH - 60, t);
        unclip(dc, a, PX0, PY0, PW, PH);

        // stamp (weather icon + temperature) and postmark (date) over the picture's corner
        var sp = G.spring(G.stag(p, 0, 0.55, 0.4));
        if (sp > 0) {
            var sx = 330;
            var sy = 84 - q4((1 - sp) * 20);
            dc.setColor(0xFDFBF4, -1);
            dc.fillRectangle(sx, sy, 64, 76);
            dc.setColor(card, -1);
            for (var k = 0; k < 8; k++) {
                dc.fillRectangle(sx + 4 + k * 8, sy - 2, 4, 4);
                dc.fillRectangle(sx + 4 + k * 8, sy + 74, 4, 4);
            }
            for (var k = 0; k < 9; k++) {
                dc.fillRectangle(sx - 2, sy + 4 + k * 8, 4, 4);
                dc.fillRectangle(sx + 62, sy + 4 + k * 8, 4, 4);
            }
            dc.setColor(night ? 0x2A3050 : 0xA6D0F4, -1);
            dc.fillRectangle(sx + 6, sy + 6, 52, 44);
            Spr.draw(dc, icon(), sx + 12, sy + 8, P, [night ? 0xF4F0D0 : 0xFFD23F, 0xFFFFFF, 0xB8C4D0, night ? 0xFFF4C0 : 0x4A7AD8, 0xFFD23F], false);
            dc.setColor(0x8A2A22, -1);
            F.px(dc, tempStr(d), sx + 32, sy + 56, 2, 1, 0);
            // postmark ring with the date + wavy cancel lines
            dc.setColor(ink, -1);
            dc.setPenWidth(2);
            dc.drawCircle(sx - 6, sy + 82, 32);
            F.px(dc, d.day + "." + d.mon, sx - 6, sy + 68, 2, 1, 0);
            F.px(dc, "" + d.year, sx - 6, sy + 84, 2, 1, 0);
            for (var k = 0; k < 3; k++) {
                for (var c = 0; c < 12; c++) {
                    dc.fillRectangle(sx - 36 - c * 6, sy + 70 + k * 9 + q4(3 * Math.sin(c * 0.9)), 4, 2);
                }
            }
        }

        // over the cached card only the picture is repainted (weather, smoke, stamp corner)
        if (a.bg) {
            dc.clearClip();
            return;
        }
        // time printed on the card, greeting + high / low / rain handwritten below the picture
        dc.setColor(ink, -1);
        F.px(dc, G.timeStr(d), CX, 48, 6, 1, 0);
        F.px(dc, greeting(), CX, 314, 2, 1, 0);
        F.px(dc, tStr(d.hiT, d) + " / " + tStr(d.loT, d), CX - 30, 334, 2, 1, 0);
        Spr.draw(dc, SprWetter.UMBRELLA, CX + 26, 333, 2, [0x2A4AA8, ink], false);
        F.px(dc, rainStr(d), CX + 66, 334, 2, 1, 0);
        // slots
        slots(dc, d, p, 358, 0x8A7A60, ink);
    }

    // ---- style 3: the voxel diorama
    hidden function styleDiorama(dc as Dc, d as D, a as A, t, p) as Void {
        var wake = d.wakeN;
        var night = _night;
        outside(dc, 0, 0, 454, 454, t, wake * 13 + 5);
        var fl = flash(t, wake);
        if (fl > 0) {
            dc.setColor(G.mix(skyCol(1), 0xEEF2FF, fl * 0.7), -1);
            dc.fillRectangle(0, 0, 454, 454);
        }
        // island floats in during the intro, then bobs gently
        var bob = (a.live && p >= 1) ? ((t / 900) % 2) * P : 0;
        var ix = 131;
        var iy = 156 + q4((1 - G.ease(p * 1.2)) * 300) + bob;
        var pal = _diop;
        Spr.draw(dc, SprWetter.DIO_A, ix + 14 * P, iy, P, pal, false);
        Spr.draw(dc, SprWetter.DIO_B, ix + 12 * P, iy + 32, P, pal, false);
        Spr.draw(dc, SprWetter.DIO_C, ix + 2 * P, iy + 64, P, pal, false);
        Spr.draw(dc, SprWetter.DIO_D, ix, iy + 96, P, pal, false);
        Spr.draw(dc, SprWetter.DIO_E, ix + 4 * P, iy + 128, P, pal, false);
        Spr.draw(dc, SprWetter.DIO_F, ix + 13 * P, iy + 160, P, pal, false);
        // tree (sways with the wind)
        var sway = _wnd >= 1 && a.live && (t / (_wnd >= 2 ? 300 : 700)) % 2 == 1;
        Spr.draw(dc, sway ? SprWetter.DIO_TREE_B : SprWetter.DIO_TREE_A, ix + 28 * P, iy + 17 * P, P, _diot, false);
        // chimney smoke
        if (a.live && !_stm && _rn < 3) {
            dc.setColor(night ? 0x5A5A66 : 0xE8E8EC, -1);
            for (var k = 0; k < 4; k++) {
                var ph = fm(t / 900.0 + k * 0.25, 1);
                dc.fillRectangle(q4(ix + 94 + ph * 10 * (_wnd + 1) + 2 * Math.sin(k + t * 0.003)), q4(iy - 4 - ph * 44), P, P);
            }
        }
        // a rain / snow cloud parked over the island
        if (_rn > 0 || _snw > 0 || _stm) {
            var cy = iy - 60;
            precip(dc, ix + 20, cy + 24, 152, 100, t, wake * 7 + 3);
            var cc = cloudCols();
            Spr.draw(dc, SprWetter.CLOUD_A, ix + 28, cy, P, cc, false);
            Spr.draw(dc, SprWetter.CLOUD_B, ix + 96, cy + 8, P, cc, false);
            if (fl >= 1) {
                Spr.draw(dc, SprWetter.BOLT, ix + 116, cy + 28, P, [0xFFFFFF, 0xC8D4FF], false);
            }
        }
        fogBands(dc, 0, iy + 40, 454, 160, t);

        // time, date, temperature + high / low / rain, slots
        var shd = G.mix(skyCol(0), 0x000000, 0.5);
        ptext(dc, G.timeStr(d), CX, 30, 7, night ? 0xFFE8B8 : 0xFFFFFF, shd);
        ptext(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX, 86, 2, night ? 0xC8D0E8 : 0xFFFFFF, shd);
        thermo(dc, d, 52, 214);
        var hx = 384;
        Spr.draw(dc, SprWetter.ARROW_UP, hx - 28, 222, 2, [0xE8402E], false);
        Spr.draw(dc, SprWetter.ARROW_DN, hx - 28, 244, 2, [0x2A5AD8], false);
        Spr.draw(dc, SprWetter.UMBRELLA, hx - 29, 264, 2, [0x2A5AD8, 0x1A2030], false);
        ptext(dc, tStr(d.hiT, d), hx + 6, 222, 2, 0xFFFFFF, 0x1A2030);
        ptext(dc, tStr(d.loT, d), hx + 6, 244, 2, 0xFFFFFF, 0x1A2030);
        ptext(dc, rainStr(d), hx + 6, 266, 2, 0xFFFFFF, 0x1A2030);
        slots(dc, d, p, 372, night ? 0xA8B0C8 : 0xE8F0FF, 0xFFFFFF);
    }

    // static layer: room / card; the weather in the glass / picture is repainted. The diorama's sky
    // moves everywhere: no cache
    function bgKey(d as D) as Number {
        return d.cfg.style == 3 ? -1 : minuteKey(d);
    }

    // the curtains opening / the card being printed are the reveal
    function reveal() as Boolean {
        return false;
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var p = a.intro;
        if (a.bg && p < 1) {
            a.bg = false; // the intro repaints everything
        }
        var t = a.live ? a.t : 0;
        _live = a.live;
        var key = ((st * 64 + d.cond + 2) * 1440 + d.mins) * 16 + d.mon;
        var k2 = Math.round(d.wind).toNumber() * 1000 + d.temp + 100;
        if (key != _ck || k2 != _ck2) {
            _ck = key;
            _ck2 = k2;
            weather(d);
            prep(st, d);
        }
        _moonPh = d.moon;
        _fps = (_rn > 0 || _snw > 0 || _stm) ? 12 : 6;
        if (st == 2) {
            stylePostcard(dc, d, a, t, p);
        } else if (st == 3) {
            styleDiorama(dc, d, a, t, p);
        } else {
            styleWindow(dc, d, a, t, p);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var st = d.cfg.style;
        var o = St.shift(d);
        var ox = o[0];
        var oy = o[1];
        weather(d);
        dc.setColor(0x3C3C3C, -1);
        if (st == 1) {
            // window frame + cross, outlined
            dc.fillRectangle(GX - 12 + ox, GY - 12 + oy, GW + 24, 4);
            dc.fillRectangle(GX - 12 + ox, GY + GH + 8 + oy, GW + 24, 4);
            dc.fillRectangle(GX - 12 + ox, GY - 12 + oy, 4, GH + 24);
            dc.fillRectangle(GX + GW + 8 + ox, GY - 12 + oy, 4, GH + 24);
            dc.fillRectangle(GX + 98 + ox, GY + oy, 4, GH);
            dc.fillRectangle(GX + ox, GY + 66 + oy, GW, 4);
        } else if (st == 2) {
            // stamp perforation
            for (var k = 0; k < 8; k++) {
                dc.fillRectangle(186 + k * 8 + ox, 140 + oy, 4, 4);
                dc.fillRectangle(186 + k * 8 + ox, 228 + oy, 4, 4);
            }
            for (var k = 0; k < 11; k++) {
                dc.fillRectangle(178 + ox, 140 + k * 8 + oy, 4, 4);
                dc.fillRectangle(246 + ox, 140 + k * 8 + oy, 4, 4);
            }
        } else {
            // island outline (diamond)
            for (var k = 0; k < 24; k++) {
                dc.fillRectangle(131 + k * 4 + ox, 228 - k * 2 + oy, 4, 2);
                dc.fillRectangle(227 + k * 4 + ox, 180 + k * 2 + oy, 4, 2);
                dc.fillRectangle(131 + k * 4 + ox, 228 + k * 2 + oy, 4, 2);
                dc.fillRectangle(227 + k * 4 + ox, 276 - k * 2 + oy, 4, 2);
            }
        }
        var ic = 0x6A6A6A;
        var ix = st == 1 ? GX + 28 : CX - 20;
        var iy = st == 1 ? GY + 14 : (st == 2 ? 150 : 202);
        Spr.draw(dc, icon(), ix + ox, iy + oy, P, [ic, 0x5A5A5A, 0x3A3A3A, 0x5A5A5A, ic], false);
        dc.setColor(0x9A9A9A, -1);
        F.px(dc, G.timeStr(d), CX + ox, 40 + oy, 7, 1, 1);
        dc.setColor(G.dim(d.accent, 0.6), -1);
        F.px(dc, tempStr(d), (st == 1 ? GX + 152 : CX) + ox, (st == 1 ? GY + 24 : (st == 2 ? 196 : 290)) + oy, 3, 1, 1);
    }
}
