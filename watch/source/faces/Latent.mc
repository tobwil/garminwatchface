import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// LATENT — "Latent": like an image-diffusion model, every wrist raise generates the time
// from pure noise in 50 denoising steps. The seed is the raise counter, so every look gives
// new noise, a new palette accent and a new background (mountains, stars, sun).
// Styles: 1 Diffusion (ML paper figure), 2 Pixel (chunky retro), 3 Aquarell (watercolour dabs
// that converge onto the digits, finished with an ink line). Mirrors web/js/faces/latent.js.
class FaceLatent extends Face {
    // 7x11 digits for the Diffusion latent grid, one row bitmask per line (bit 6 = left)
    const D7 = [62,127,99,99,99,99,99,99,99,127,62, 28,60,108,12,12,12,12,12,12,63,63, 62,127,99,3,7,14,28,56,112,127,127,
        62,127,99,3,30,30,3,3,99,127,62, 6,14,30,54,102,102,127,127,6,6,6, 127,127,96,96,126,127,3,3,99,127,62,
        62,127,96,96,126,127,99,99,99,127,62, 127,127,3,6,12,12,24,24,24,24,24, 62,127,99,99,62,62,99,99,99,127,62,
        62,127,99,99,99,127,63,3,3,127,62];
    const NS = 50;  // denoising steps
    const SMS = 50; // ms per step (2.5 s)
    const DOWS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const MONS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    // second hue per seed (background tint of the Diffusion image)
    const HUE = [0x5468FF, 0x8A5CFF, 0xFF4F8B, 0x2FB4FF, 0x39D98A];
    // retro palettes, levels 1..5
    const PIX = [0x1D2B53, 0x7E2553, 0xFF004D, 0xFFA300, 0xFFEC27, 0x0F380F, 0x306230, 0x8BAC0F, 0x9BBC0F, 0xD8F0A0,
        0x352879, 0x6C5EB5, 0x70A4B2, 0x9AD284, 0xFFFFFF];
    const PIXN = ["SUNSET", "GAMEBOY", "C64", "AKZENT"];
    // watercolour pigment pairs
    const AQ = [0xE58F9E, 0xF2B26B, 0x7FB3E0, 0xA48AD4, 0x7DBF8E, 0x5FA8B0];
    const PAPER = 0xF1E9DA;
    const INK = 0x3E3229;
    const AY = 206; // aquarell time centre
    const AH = 104; // aquarell time height
    const SP = 15.0; // aquarell dab spacing along the stroke
    // custom 5x7 glyphs: guillemets and a check mark
    const LUT = [0, 64, 107, 150, 193, 236]; // level -> 0..255 brightness for the noise mix
    const GL = [0, 20, 10, 5, 10, 20, 0, 0, 5, 10, 20, 10, 5, 0, 0, 0, 1, 2, 20, 8, 0];

    hidden var _busy = true;
    hidden var _aq = false; // Aquarell: slower ambient (it only dries)
    hidden var _pKey = -1;  // prompt built for raise
    hidden var _nKey = -1;  // noise built for (raise, style)
    hidden var _tKey = "";  // target built for (style, time, raise)
    hidden var _tg = null;  // target image, level 0..5 per cell
    hidden var _nz = null;  // seeded noise, 0..255 per cell
    hidden var _gc = 0;
    hidden var _gr = 0;
    hidden var _cs = 0;
    hidden var _gx0 = 0;
    hidden var _gy0 = 0;
    hidden var _nm = 1;
    hidden var _pmt = "";
    hidden var _bn = 0;     // aquarell: number of brush dabs
    hidden var _bd = null;  // per dab: tx, ty, sx, sy, r0, col, r1, edge col
    hidden var _bq = null;  // per dab per frame: x, y, r, e
    hidden var _wn = 0;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return _busy ? 20 : (_aq ? 4 : 6);
    }

    hidden function seedNo(w) {
        return ((w % 9000) * 7919 + 1013) % 9000 + 1000;
    }

    // one of the custom glyphs (0 », 1 «, 2 check) at x, y (top) with dot size sc
    hidden function glyph(dc as Dc, g, x, y, sc) as Void {
        for (var r = 0; r < 7; r++) {
            var b = GL[g * 7 + r];
            for (var c = 0; c < 5; c++) {
                if ((b & (16 >> c)) != 0) {
                    dc.fillRectangle(x + c * sc, y + r * sc, sc, sc);
                }
            }
        }
    }

    // the "prompt": time + a modifier chosen by the raise counter from what the data says
    hidden function prompt(d as D, w) as String {
        var m = ["minimalistisch", "gestochen scharf", "im bauhaus-stil", "ohne zeiger"];
        if (d.h >= 5 && d.h < 10) { m.add("mit kaffee"); }
        if (d.h >= 17 && d.h < 22) { m.add("feierabend"); }
        if (d.h >= 22 || d.h < 5) { m.add("bei mondlicht"); }
        if (d.bb >= 70) { m.add("voller energie"); }
        else if (d.bb >= 0 && d.bb < 30) { m.add("etwas müde"); }
        if (d.stress > 60) { m.add("tief durchatmen"); }
        if (d.trainDays >= d.dayGoal) { m.add("wochenziel erfüllt"); }
        else if (d.trainDays >= 0) { m.add(d.dayGoal - d.trainDays == 1 ? "noch 1 training" : "noch " + (d.dayGoal - d.trainDays) + " trainings"); }
        if (d.wkBike > 0) { m.add("mit rückenwind"); }
        if (d.stepGoal > 0 && d.steps >= d.stepGoal) { m.add(G.num(d.stepGoal) + " schritte"); }
        return m[w % m.size()] as String;
    }

    // per raise: grid geometry and the prompt
    hidden function prep(d as D, st) as Void {
        _wn = d.wakeN.abs() % 100000;
        if (st == 1) { _cs = 9; _gc = 42; _gr = 19; _gy0 = 118; } else { _cs = 14; _gc = 29; _gr = 11; _gy0 = 126; }
        _gx0 = 227 - (_gc * _cs) / 2;
        _nm = _gc * _gr;
        if (_wn != _pKey) {
            _pKey = _wn;
            _pmt = prompt(d, _wn);
        }
    }

    // the seeded noise (cheap 16-bit LCG, identical on the web); only built when it is drawn
    hidden function noise(st) as Void {
        var wn = _wn;
        var key = wn * 4 + st;
        if (key == _nKey) {
            return;
        }
        _nKey = key;
        _nz = null;
        var nm = _nm;
        var nz = new [nm]b;
        var sd = (wn * 7 + st * 131 + 17) % 65537;
        for (var k = 0; k < nm; k++) {
            sd = (sd * 75 + 74) % 65537;
            nz[k] = sd & 255;
        }
        _nz = nz;
    }

    // the target image as levels 0..5 (time + scenery), or the brush dabs for Aquarell; once per
    // raise/minute. Grid styles only need it from step ~5 on, so the first frame after a raise stays light.
    hidden function target(d as D, st) as Void {
        var ts = G.timeStr(d);
        var wn = _wn;
        var key = "" + st + ts + "/" + wn;
        if (key.equals(_tKey)) {
            return;
        }
        _tKey = key;
        if (st == 3) {
            _tg = null;
            buildAq(ts, G.rnd(wn * 31 + 11));
            return;
        }
        _bd = null;
        _bq = null;
        _tg = null;
        var gc = _gc;
        var gr = _gr;
        var tg = new [_nm]b;
        // scenery: mountain ridge (Diffusion), horizon with a pixel sun and stars (Pixel)
        var ph = (wn % 97) * 1.0;
        var mx = 5 + ((wn * 7) % (gc - 10));
        for (var c = 0; c < gc; c++) {
            if (st == 1) {
                for (var r = gr - 3 - Math.floor(2.2 * (1 + G.noise(c * 0.45 + ph))).toNumber(); r < gr; r++) {
                    tg[r * gc + c] = 1;
                }
            } else {
                tg[9 * gc + c] = (c >= mx - 1 && c <= mx + 1) ? 4 : 2;
                tg[10 * gc + c] = 1;
                if ((c * 7 + wn) % 9 == 0) { tg[c] = 1; } // stars
                if ((c * 7 + gc * 7 + wn) % 9 == 0) { tg[gc + c] = 1; }
            }
        }
        // glyphs (+ glow halo around them for Diffusion: never over a digit, digits overwrite it)
        var dw = st == 1 ? 7 : 5;
        var cw = st == 1 ? 2 : 1;
        var r0 = st == 1 ? 4 : 2;
        var rows = st == 1 ? 11 : 7;
        var cs = ts.toCharArray();
        var W = 0;
        for (var i = 0; i < cs.size(); i++) {
            var col = cs[i] == ':';
            W += col ? cw : dw;
            if (i > 0) { W += (st == 1 && (col || cs[i - 1] == ':')) ? 2 : 1; }
        }
        var x = (gc - W) / 2;
        for (var i = 0; i < cs.size(); i++) {
            var col = cs[i] == ':';
            if (i > 0) { x += (st == 1 && (col || cs[i - 1] == ':')) ? 2 : 1; }
            var n = cs[i].toNumber() - 48;
            var w = col ? cw : dw;
            for (var rr = 0; rr < rows; rr++) {
                var bits;
                if (col) {
                    bits = st == 1 ? ((rr == 3 || rr == 4 || rr == 7 || rr == 8) ? 3 : 0) : ((rr == 2 || rr == 4) ? 1 : 0);
                } else {
                    bits = st == 1 ? D7[n * 11 + rr] : FontData.PX_DATA[(FontData.PX_MAP[48 + n] - 1) * 7 + rr];
                }
                if (bits == 0) {
                    continue;
                }
                var lv = st == 1 ? (rr >= 8 ? 4 : 5) : (rr < 4 ? 5 : 4);
                for (var c = 0; c < w; c++) {
                    if ((bits & (1 << (w - 1 - c))) != 0) {
                        var k = (r0 + rr) * gc + x + c;
                        tg[k] = lv;
                        if (st == 1) {
                            for (var q = k - gc - 1; q <= k + gc - 1; q += gc) {
                                if (tg[q] < 3) { tg[q] = 3; }
                                if (tg[q + 1] < 3) { tg[q + 1] = 3; }
                                if (tg[q + 2] < 3) { tg[q + 2] = 3; }
                            }
                        }
                    }
                }
            }
            x += w;
        }
        _tg = tg;
    }

    // Aquarell: brush dabs sampled along the stroke-font digits (the later ink line follows them)
    hidden function buildAq(ts as String, sd) as Void {
        var s = AH / 80.0;
        var w = F.stW(ts, AH);
        var ox = 227 - w / 2.0;
        var oy = AY - AH / 2.0 - 24 * s;
        var p = [];
        var cs = ts.toCharArray();
        var data = FontData.STROKE_DATA;
        _bd = null;
        for (var k = 0; k < cs.size(); k++) {
            var code = cs[k].toNumber();
            var gi = code > 255 ? -1 : FontData.STROKE_MAP[code] - 1;
            if (gi < 0) {
                ox += (20 + 22) * s;
                continue;
            }
            var a = FontData.STROKE_OFFS[gi];
            var b = FontData.STROKE_OFFS[gi + 1];
            var px = -1.0;
            var py = 0.0;
            var rem = 0.0;
            var i = a;
            while (i < b) {
                if (data[i] == 255) {
                    px = -1.0;
                    i += 1;
                    continue;
                }
                var nx = ox + (data[i] & 127) * s;
                var ny = oy + data[i + 1] * s;
                if (px < 0) {
                    p.add(nx);
                    p.add(ny);
                    rem = SP;
                } else {
                    // one dab every SP px of stroke length
                    var L = Math.sqrt((nx - px) * (nx - px) + (ny - py) * (ny - py));
                    var pos = 0.0;
                    while (L - pos >= rem) {
                        pos += rem;
                        p.add(px + (nx - px) * pos / L);
                        p.add(py + (ny - py) * pos / L);
                        rem = SP;
                    }
                    rem -= L - pos;
                }
                px = nx;
                py = ny;
                i += 2;
            }
            ox += (FontData.STROKE_W[gi] + 22) * s;
        }
        var bn = p.size() / 2;
        _bq = null;
        var bd = new [bn * 8];
        var pa = AQ[(_wn % 3) * 2];
        var pb = AQ[(_wn % 3) * 2 + 1];
        var x0 = 227 - w / 2.0;
        for (var i = 0; i < bn; i++) {
            sd = G.rnd(sd);
            var ang = G.rf(sd) * 6.2832;
            sd = G.rnd(sd);
            var rad = Math.sqrt(G.rf(sd)) * 165;
            sd = G.rnd(sd);
            var o = i * 8;
            bd[o] = p[i * 2];
            bd[o + 1] = p[i * 2 + 1];
            bd[o + 2] = 227 + Math.sin(ang) * rad;
            bd[o + 3] = 215 + Math.cos(ang) * rad;
            bd[o + 4] = 11 + G.rf(sd) * 13;
            bd[o + 5] = G.mix(pa, pb, (p[i * 2] - x0) / w);
            sd = G.rnd(sd);
            bd[o + 6] = 9.5 + G.rf(sd) * 3; // brush pressure
            bd[o + 7] = G.mix(bd[o + 5], INK, 0.25);
        }
        p = null;
        _bq = new [bn * 4];
        _bn = bn;
        _bd = bd;
    }

    hidden function dateStr(d as D) as String {
        return DOWS[d.dow] + ", " + d.day + ". " + MONS[d.mon - 1];
    }

    // »prompt« centred, top y
    hidden function promptLine(dc as Dc, d as D, y, col) as Void {
        var txt = G.timeStr(d) + ", " + _pmt;
        var w = F.pxW(txt, 2);
        var x = 227 - (w + 24) / 2.0;
        dc.setColor(col, -1);
        glyph(dc, 0, x, y, 2);
        F.px(dc, txt, x + 12, y, 2, 0, 0);
        glyph(dc, 1, x + w + 14, y, 2);
    }

    // paper -> pigment c by f/256 (cheap integer mix for the many brush dabs)
    hidden function pm(c, f) as Number {
        return ((0xF1 + ((((c >> 16) & 255) - 0xF1) * f >> 8)) << 16) | ((0xE9 + ((((c >> 8) & 255) - 0xE9) * f >> 8)) << 8) | (0xDA + (((c & 255) - 0xDA) * f >> 8));
    }

    hidden function drawAq(dc as Dc, d as D, a as A, s, t) as Void {
        var g = s.toFloat() / NS;
        var dry = (a.live && s >= NS) ? G.clamp((t - NS * SMS) / 6000.0, 0.0, 1.0) * 0.14 : 0.0;
        var bd = _bd;
        var bn = _bn;
        dc.setColor(PAPER, -1);
        dc.fillRectangle(0, 0, 454, 454);
        // the scattered dabs converge onto the stroke (painted left to right), larger and more
        // watery while travelling; edge pass first so only the outer pooled edge stays visible
        var bq = _bq;
        for (var i = 0; i < bn; i++) {
            var o = i * 8;
            var q = i * 4;
            var e = g * 1.5 - 0.5 * i / bn;
            e = e <= 0 ? 0.0 : (e >= 1 ? 1.0 : e * e * (3 - 2 * e));
            var sw = (i % 2 == 0 ? 18 : -18) * Math.sin(e * 3.1416);
            bq[q] = bd[o + 2] + (bd[o] - bd[o + 2]) * e + sw;
            bq[q + 1] = bd[o + 3] + (bd[o + 1] - bd[o + 3]) * e - sw * 0.5;
            bq[q + 2] = bd[o + 4] + (bd[o + 6] - bd[o + 4]) * e;
            bq[q + 3] = e;
            dc.setColor(pm(bd[o + 7], Math.floor((0.22 + 0.6 * e - dry) * 256).toNumber()), -1);
            dc.fillCircle(bq[q], bq[q + 1], bq[q + 2] + 1.8);
        }
        for (var i = 0; i < bn; i++) {
            var q = i * 4;
            dc.setColor(pm(bd[i * 8 + 5], Math.floor((0.18 + 0.56 * bq[q + 3] - dry) * 256).toNumber()), -1);
            dc.fillCircle(bq[q], bq[q + 1], bq[q + 2]);
        }
        // a few splatters land at the end
        if (s > 42 && bn > 0) {
            var sd = G.rnd(_wn + 77);
            for (var j = 0; j < 9; j++) {
                sd = G.rnd(sd);
                var x = 70 + (sd % 314);
                sd = G.rnd(sd);
                var y = AY - 80 + (sd % 160);
                sd = G.rnd(sd);
                dc.setColor(G.mix(PAPER, bd[((sd >> 4) % bn) * 8 + 5], 0.7 - dry), -1);
                dc.fillCircle(x, y, 1.5 + (sd % 4) * G.clamp((s - 42) / 5.0, 0.0, 1.0));
            }
        }
        // line and wash: the ink line writes itself over the last steps
        if (s > 34) {
            dc.setColor(INK, -1);
            F.st(dc, G.timeStr(d), 229, AY - 2, AH, 2, 1, (s - 34) / 16.0, 0);
        }
        // captions in ink
        dc.setColor(0x9A8A76, -1);
        F.px(dc, "studie nr. " + seedNo(_wn), 227, 60, 2, 1, 0);
        promptLine(dc, d, 82, 0x5A4A3E);
        if (s < NS) {
            dc.setColor(0x8A7A66, -1);
            F.px(dc, "lasur " + s + "/" + NS, 227, 300, 2, 1, 0);
            dc.setColor(0xDDD2BF, -1);
            dc.fillRoundedRectangle(147, 324, 160, 4, 2);
            dc.setColor(G.mix(PAPER, bn > 0 ? bd[5] : INK, 0.8), -1);
            dc.fillRoundedRectangle(147, 324, 160.0 * s / NS, 4, 2);
        } else {
            dc.setColor(INK, -1);
            F.px(dc, dateStr(d), 227, 300, 2, 1, 0);
            dc.setColor(0x9A8A76, -1);
            F.px(dc, "aquarell, " + NS + " lasuren", 227, 326, 2, 1, 0);
        }
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        prep(d, st);
        var t = a.live ? a.t : 99999;
        var s = t / SMS;
        if (s > NS) { s = NS; }
        _busy = a.live && t < NS * SMS + 150;
        _aq = st == 3;
        var ai = Math.round(G.easeInOut(s.toFloat() / NS) * 256).toNumber();
        // pure noise needs no target yet; while animating, the frame that builds it only draws
        // noise (watchdog budget: building + mixing in one frame is too much on the watch)
        if (st == 3) {
            target(d, st);
            drawAq(dc, d, a, s, t);
            return;
        }
        if (ai > 0 && !_tKey.equals("" + st + G.timeStr(d) + "/" + _wn)) {
            target(d, st);
            if (a.live) {
                ai = 0;
            }
        }
        if (ai < 256) {
            noise(st);
        }
        var acc = d.accent;
        var wn = _wn;
        var pi = wn % 4;
        // level colours: grey noise that takes on the palette while it denoises
        var cur = [0, 0, 0, 0, 0, 0];
        var bi = 256 - ai;
        var ae = ai / 256.0;
        if (st == 1) {
            var hu = HUE[wn % 5];
            var fin = [0, G.dim(hu, 0.28), G.dim(hu, 0.55), G.mix(G.dim(hu, 0.45), G.dim(acc, 0.5), 0.5), G.dim(acc, 0.8), G.mix(acc, 0xFFFFFF, 0.35)];
            for (var l = 1; l < 6; l++) {
                cur[l] = G.mix(G.rgb(l * 44, l * 44, l * 44), fin[l], ae);
            }
        } else {
            for (var l = 1; l < 6; l++) {
                cur[l] = pi < 3 ? PIX[pi * 5 + l - 1] : (l == 5 ? G.mix(acc, 0xFFFFFF, 0.5) : G.dim(acc, l * 0.2));
            }
        }
        // x = alpha * image + (1 - alpha) * noise, quantised to 6 levels, drawn as merged runs
        var tg = _tg;
        var nz = _nz;
        var gc = _gc;
        var gr = _gr;
        var cs = _cs;
        var gx0 = _gx0;
        var nm = _nm;
        var sx = (s * 151) & 255;
        for (var r = 0; r < gr; r++) {
            var y = _gy0 + r * cs;
            var kb = r * gc;
            var c0 = 0;
            var lv = -1;
            for (var c = 0; c <= gc; c++) {
                var q = -1;
                if (c < gc) {
                    var k = kb + c;
                    q = ai >= 256 ? tg[k] : (ai <= 0 ? ((nz[k] ^ sx) * 6) >> 8 : ((LUT[tg[k]] * ai + (nz[k] ^ sx) * bi) * 6) >> 16);
                }
                if (q != lv) {
                    if (lv > 0) {
                        dc.setColor(cur[lv], -1);
                        dc.fillRectangle(gx0 + c0 * cs, y, (c - c0) * cs, cs);
                    }
                    lv = q;
                    c0 = c;
                }
            }
        }
        // finished: a few background cells keep twinkling (latent residue)
        if (s >= NS && a.live) {
            var tick = t / 170;
            for (var j = 0; j < 7; j++) {
                var k = (tick * 7919 + j * 2731 + wn * 13) % nm;
                if (tg[k] < 3) {
                    var l = tg[k] + 1;
                    dc.setColor(cur[l], -1);
                    dc.fillRectangle(gx0 + (k % gc) * cs, _gy0 + (k / gc) * cs, cs, cs);
                }
            }
        }
        var wd = gc * cs;
        if (st == 2) {
            // chunky pixel grid
            dc.setColor(0x000000, -1);
            for (var c = 1; c < gc; c++) {
                dc.fillRectangle(gx0 + c * cs - 1, _gy0, 2, gr * cs);
            }
            for (var r = 1; r < gr; r++) {
                dc.fillRectangle(gx0, _gy0 + r * cs - 1, wd, 2);
            }
            dc.setColor(cur[3], -1);
            F.px(dc, "PALETTE " + PIXN[pi], 227, 62, 2, 1, 0);
            promptLine(dc, d, 86, 0xDDDDDD);
            dc.setColor(cur[4], -1);
            F.px(dc, "STEP " + s + "/" + NS, 60, 294, 2, 0, 0);
            F.px(dc, "SEED " + seedNo(wn), 394, 294, 2, 2, 0);
            var nb = s * 20 / NS;
            for (var i = 0; i < 20; i++) {
                dc.setColor(i < nb ? cur[5] : 0x2A2A2A, -1);
                dc.fillRectangle(87 + i * 14, 316, 12, 10);
            }
            dc.setColor(cur[5], -1);
            if (s < NS) {
                F.px(dc, "RENDERE" + "...".substring(0, (t / 200) % 4), 167, 338, 2, 0, 0);
            } else if (!a.live || (t / 500) % 2 == 0) {
                F.px(dc, "FERTIG!", 227, 338, 2, 1, 0);
            }
            dc.setColor(cur[3], -1);
            F.px(dc, d.dowStr + " " + d.day + " " + d.monStr, 227, 362, 2, 1, 0);
            return;
        }
        // Diffusion: thin figure frame + paper captions
        dc.setColor(0x333333, -1);
        dc.setPenWidth(1);
        dc.drawRectangle(gx0 - 4, _gy0 - 4, wd + 8, gr * cs + 8);
        dc.setColor(0x8A8A8A, -1);
        F.px(dc, "prompt", 227, 58, 2, 1, 0);
        promptLine(dc, d, 80, 0xDDDDDD);
        var yb = _gy0 + gr * cs + 12;
        dc.setColor(0x9A9A9A, -1);
        F.px(dc, "step " + s + "/" + NS, 58, yb, 2, 0, 0);
        F.px(dc, "seed " + seedNo(wn), 396, yb, 2, 2, 0);
        dc.setColor(0x2E2E2E, -1);
        dc.fillRectangle(58, yb + 21, 338, 2);
        dc.setColor(acc, -1);
        dc.fillRectangle(58, yb + 21, 338 * s / NS, 2);
        if (s < NS) {
            dc.setColor(0x9A9A9A, -1);
            F.px(dc, "entrausche" + "...".substring(0, (t / 200) % 4), 227 - 63, yb + 34, 2, 0, 0);
        } else {
            var txt = "fertig in 2,5 s";
            var w = F.pxW(txt, 2) + 16;
            dc.setColor(acc, -1);
            glyph(dc, 2, 227 - w / 2.0, yb + 34, 2);
            F.px(dc, txt, 227 - w / 2.0 + 16, yb + 34, 2, 0, 0);
        }
        dc.setColor(0x666666, -1);
        F.px(dc, "Abb. " + d.glances + ": " + dateStr(d), 227, yb + 58, 2, 1, 0);
    }

    // the time as dim, dithered latent blocks with a little residual noise
    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var ts = G.timeStr(d);
        var cs = ts.toCharArray();
        var p = 13;
        var w = (cs.size() * 6 - 1) * p;
        var x0 = Math.round(227 - w / 2.0).toNumber() + o[0];
        var y0 = 182 + o[1];
        dc.setColor(G.dim(d.accent, 0.5), -1);
        for (var i = 0; i < cs.size(); i++) {
            var gi = FontData.PX_MAP[cs[i].toNumber()] - 1;
            for (var r = 0; r < 7; r++) {
                var bits = FontData.PX_DATA[gi * 7 + r];
                for (var c = 0; c < 5; c++) {
                    if ((bits & (16 >> c)) != 0) {
                        var x = x0 + (i * 6 + c) * p;
                        var y = y0 + r * p;
                        dc.fillRectangle(x, y, 6, 6);
                        dc.fillRectangle(x + 6, y + 6, 6, 6);
                    }
                }
            }
        }
        dc.setColor(0x2A2A2A, -1);
        var sd = G.rnd(d.mins + 7);
        for (var j = 0; j < 18; j++) {
            sd = G.rnd(sd);
            var c = sd % (cs.size() * 6 + 4) - 2;
            sd = G.rnd(sd);
            var r = (sd % 11) - 2;
            dc.fillRectangle(x0 + c * p + 3, y0 + r * p + 3, 6, 6);
        }
        dc.setColor(0x5A5A5A, -1);
        F.px(dc, "latent", 227 + o[0], 300 + o[1], 2, 1, 0);
    }
}
