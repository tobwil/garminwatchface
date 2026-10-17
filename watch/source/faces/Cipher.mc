import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// CIPHER — "Geheimcode": the time is shown ENCRYPTED. After every wrist raise a
// decryption runs (~3 s: progress bar, scrambling digits that lock one by one), then the
// plain time stays below the code until the watch sleeps. AOD shows the code only.
// Styles: 1 Binär (BCD LED clock), 2 Morse, 3 Römisch (engraved stone tablet).
// Mirrors web/js/faces/cipher.js.
class FaceCipher extends Face {
    // morse digits as 5-bit masks, bit (16 >> k) set = dash at position k
    const MB = [31, 15, 7, 3, 1, 0, 16, 24, 28, 30];
    const MORSE = ["-----", ".----", "..---", "...--", "....-", ".....", "-....", "--...", "---..", "----."];
    const RV = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const RS = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
    const SCR = "0123456789ABCDEF#%&*?$";
    // Binär: LED columns (H tens, H ones, M tens, M ones), rows (8 4 2 1), bits per column
    const BX = [127, 185, 269, 327];
    const BY = [124, 168, 212, 256];
    const BN = [2, 4, 3, 4];
    // Morse: rows (H tens, H ones, M tens, M ones), first symbol cell
    const MY = [112, 156, 236, 280];
    const MX = 64;
    const DEC0 = 900; // decryption starts (ms after the raise) ...
    const DECL = 2600; // ... and takes this long
    const LOCK = [0.2, 0.42, 0.64, 0.86]; // progress at which digit i locks
    const GOLD = 0xE9C46A;
    const UNIT = 150; // morse lamp time unit (ms)

    hidden var _busy = true;
    hidden var _lamp = false;
    hidden var _cKey = -1;
    hidden var _cDat = null; // [enc date, dec date, h roman, m roman]

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return _busy ? 15 : (_lamp ? 10 : 2);
    }

    hidden function digs(d as D) as Array<Number> {
        var h = G.hour(d);
        return [h / 10, h % 10, d.m / 10, d.m % 10] as Array<Number>;
    }

    hidden function roman(n) as String {
        if (n <= 0) {
            return "N"; // nulla
        }
        var s = "";
        for (var i = 0; i < 13; i++) {
            while (n >= RV[i]) {
                s += RS[i];
                n -= RV[i];
            }
        }
        return s;
    }

    hidden function bin(n, bits) as String {
        var s = "";
        for (var b = bits - 1; b >= 0; b--) {
            s += ((n >> b) & 1) != 0 ? "1" : "0";
        }
        return s;
    }

    // decryption progress 0..1 with five little "computing" stalls (monotonic)
    hidden function prog(ms) as Float {
        var p = G.clamp((ms - DEC0).toFloat() / DECL, 0.0, 1.0);
        if (p >= 1) {
            return 1.0;
        }
        return p - Math.sin(p * 31.415927) / 31.415927;
    }

    hidden function strs(d as D) as Array {
        if (_cKey != d.unix || _cDat == null) {
            _cKey = d.unix;
            var st = d.cfg.style;
            var enc;
            if (st == 1) {
                enc = bin(d.day, 5) + "." + bin(d.mon, 4);
            } else if (st == 2) {
                enc = MORSE[d.day / 10] + " " + MORSE[d.day % 10] + "/" + MORSE[d.mon / 10] + " " + MORSE[d.mon % 10];
            } else {
                enc = roman(d.day) + "." + roman(d.mon) + "." + roman(d.year);
            }
            _cDat = [enc, d.dowStr + " " + d.day + ". " + d.monStr, roman(G.hour(d)), roman(d.m)];
        }
        return _cDat as Array;
    }

    // glowing round LED
    hidden function led(dc as Dc, x, y, r, on, acc, hl) as Void {
        if (on) {
            var c = hl > 0 ? G.mix(acc, 0xFFFFFF, hl * 0.6) : acc;
            dc.setColor(G.dim(c, 0.13), -1);
            dc.fillCircle(x, y, r + 8);
            dc.setColor(G.dim(c, 0.3), -1);
            dc.fillCircle(x, y, r + 3);
            dc.setColor(G.mix(c, 0x000000, 0.25), -1);
            dc.fillCircle(x, y, r);
            dc.setColor(c, -1);
            dc.fillCircle(x, y, r - 3);
            dc.setColor(G.mix(c, 0xFFFFFF, 0.45), -1);
            dc.fillCircle(x - 1, y - 2, r - 9);
            dc.setColor(G.mix(c, 0xFFFFFF, 0.85), -1);
            dc.fillCircle(x - 5, y - 6, 3);
        } else {
            dc.setColor(hl > 0 ? G.dim(acc, 0.1 + hl * 0.25) : 0x0C0C0C, -1);
            dc.fillCircle(x, y, r);
            dc.setColor(G.mix(0x262626, acc, 0.12 + hl * 0.4), -1);
            dc.setPenWidth(2);
            dc.drawCircle(x, y, r);
            dc.setColor(0x1C1C1C, -1);
            dc.fillCircle(x - 5, y - 6, 2);
        }
    }

    // one morse symbol (dot / dash), centred in its 44 px cell
    hidden function sym(dc as Dc, dash, cx, y, g, col, glow) as Void {
        if (!dash) {
            if (glow >= 0) {
                dc.setColor(glow, -1);
                dc.fillCircle(cx, y, 8 * g + 4);
            }
            dc.setColor(col, -1);
            dc.fillCircle(cx, y, 8 * g);
        } else {
            var w = Math.round(22 * g).toNumber() * 2;
            if (glow >= 0) {
                dc.setColor(glow, -1);
                dc.fillRoundedRectangle(cx - w / 2 - 4, y - 12, w + 8, 24, 12);
            }
            dc.setColor(col, -1);
            dc.fillRoundedRectangle(cx - w / 2, y - 8, w, 16, 8);
        }
    }

    // morse lamp: which symbol (0..9 over the two minute digits) is lit at time u (ms), or -1
    hidden function lampSym(dg as Array<Number>, u) as Number {
        var tot = 0;
        for (var i = 2; i < 4; i++) {
            for (var k = 0; k < 5; k++) {
                tot += ((MB[dg[i]] & (16 >> k)) == 0 ? 1 : 3) + (k < 4 ? 1 : 3);
            }
        }
        tot += 4; // word gap (3 + 4 = 7 units)
        var t = (u / UNIT) % tot;
        for (var i = 2; i < 4; i++) {
            for (var k = 0; k < 5; k++) {
                var on = (MB[dg[i]] & (16 >> k)) == 0 ? 1 : 3;
                if (t < on) {
                    return (i - 2) * 5 + k;
                }
                t -= on + (k < 4 ? 1 : 3);
                if (t < 0) {
                    return -1;
                }
            }
        }
        return -1;
    }

    // stone tablet (Römisch)
    hidden function tablet(dc as Dc, sweep) as Void {
        dc.setColor(0x15120F, -1);
        dc.fillRoundedRectangle(80, 102, 300, 190, 16);
        dc.setColor(0x2B2620, -1);
        dc.fillRoundedRectangle(76, 98, 300, 190, 16);
        if (sweep > 0) {
            // torch light sweeping over the stone while it is "read"
            var x = Math.round(76 + sweep * 300).toNumber();
            var a0 = G.clamp(x - 34, 84, 368);
            dc.setColor(0x332D26, -1);
            dc.fillRectangle(a0, 104, G.clamp(x + 34, 84, 368) - a0, 178);
            a0 = G.clamp(x - 14, 84, 368);
            dc.setColor(0x3B342C, -1);
            dc.fillRectangle(a0, 104, G.clamp(x + 14, 84, 368) - a0, 178);
        }
        // speckles
        var s = 7331;
        for (var i = 0; i < 46; i++) {
            s = G.rnd(s);
            var x = 90 + (s % 272);
            s = G.rnd(s);
            var y = 110 + (s % 168);
            dc.setColor(i % 3 == 0 ? 0x39332B : 0x201C18, -1);
            dc.fillRectangle(x, y, 2 + (i % 2), 2);
        }
        // chiselled inner frame: dark groove + light lower edge
        dc.setPenWidth(2);
        dc.setColor(0x16130F, -1);
        dc.drawRoundedRectangle(86, 108, 280, 170, 9);
        dc.setColor(0x413A31, -1);
        dc.drawRoundedRectangle(88, 110, 280, 170, 9);
        // crack from the top right corner
        dc.setColor(0x14110E, -1);
        dc.drawLine(348, 98, 341, 112);
        dc.drawLine(341, 112, 346, 123);
        dc.drawLine(346, 123, 337, 139);
        dc.setPenWidth(1);
        dc.drawLine(346, 123, 356, 131);
    }

    // engraved, gilded roman numerals (write-on with prog)
    hidden function engrave(dc as Dc, txt as String, y, maxW, hMax, pg) as Void {
        var h = hMax.toFloat();
        var w = F.stW(txt, h);
        if (w > maxW) {
            h = hMax * maxW / w;
        }
        var pen = Math.round(h / 8.5).toNumber();
        if (pen < 4) {
            pen = 4;
        }
        dc.setColor(0x4C453B, -1);
        F.st(dc, txt, 229, y + 2, h, pen, 1, pg, 0);
        dc.setColor(0x0D0B09, -1);
        F.st(dc, txt, 227, y, h, pen, 1, pg, 0);
        dc.setColor(GOLD, -1);
        F.st(dc, txt, 227, y, h, pen - 3, 1, pg, 0);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var live = a.live;
        // touch & hold (bonus): re-encrypt and run the decryption again
        var ms = live ? (a.tap < a.t ? a.tap : a.t) : 99999;
        var q = prog(ms);
        var done = q >= 1;
        var dg = digs(d);
        var S = strs(d);
        var seed = d.wakeN * 977 + 13;
        var scr = ms / 70;
        _busy = live && ms < DEC0 + DECL + 200;
        _lamp = st == 2 && live;
        // the decryption episode repaints everything; afterwards only the lamp, the cursor and the
        // seconds LEDs change over the cached plain text (S is the strings here)
        if (a.bg && _busy) {
            dc.setColor(0x000000, -1);
            dc.fillRectangle(0, 0, 454, 454);
        } else if (a.bg) {
            after(dc, d, a, st, acc, dg, ms);
            return;
        }

        // ---- header (typed in)
        var key = 1000 + (G.rnd(d.wakeN * 7 + 3) % 9000);
        var h1 = "CHIFFRE " + st + "/3";
        var h2 = "SCHLÜSSEL #" + key;
        var nT = ms / 28;
        if (nT > 0) {
            dc.setColor(G.dim(acc, 0.75), -1);
            F.px(dc, h1.substring(0, G.clamp(nT, 0, h1.length())) as String, 227 - F.pxW(h1, 2) / 2, 48, 2, 0, 0);
            dc.setColor(0x6A6A6A, -1);
            F.px(dc, h2.substring(0, G.clamp(nT - 6, 0, h2.length())) as String, 227 - F.pxW(h2, 2) / 2, 68, 2, 0, 0);
        }

        // ---- the code
        var scanning = ms >= DEC0 && !done;
        if (st == 1) {
            // legend 8 4 2 1
            dc.setColor(0x4A4A4A, -1);
            for (var r = 0; r < 4; r++) {
                F.px(dc, "" + (8 >> r), 82, BY[r] - 7, 2, 1, 0);
            }
            // colon
            dc.setColor(G.dim(acc, 0.45), -1);
            dc.fillCircle(227, 190, 4);
            dc.fillCircle(227, 234, 4);
            var sx = 100 + q * 254;
            if (scanning) {
                dc.setColor(G.dim(acc, 0.35), -1);
                dc.setPenWidth(2);
                dc.drawLine(sx, 98, sx, 282);
            }
            for (var c = 0; c < 4; c++) {
                for (var r = 4 - BN[c]; r < 4; r++) {
                    var t0 = 80 + c * 110 + r * 45;
                    if (ms < t0) {
                        continue;
                    }
                    var on = (dg[c] & (8 >> r)) != 0;
                    if (ms - t0 < 260) {
                        on = G.rnd(seed + c * 31 + r * 7 + ms / 55) % 2 == 0;
                    }
                    var hl = 0.0;
                    if (scanning) {
                        var dx = (BX[c] - sx).abs();
                        if (dx < 34) {
                            hl = 1 - dx / 34.0;
                        }
                    }
                    led(dc, BX[c], BY[r], 17, on, acc, hl);
                }
            }
        } else if (st == 2) {
            // legend between hours and minutes
            dc.setColor(0x505050, -1);
            F.px(dc, "1=.----  6=-....", 227, 189, 2, 1, 0);
            var hiS = (live && done) ? lampSym(dg, ms - (DEC0 + DECL)) : -1;
            var glow = G.dim(acc, 0.2);
            for (var i = 0; i < 4; i++) {
                var code = MB[dg[i]];
                for (var k = 0; k < 5; k++) {
                    var t0 = 120 + i * 170 + k * 55;
                    if (ms < t0) {
                        continue;
                    }
                    var g = G.ease((ms - t0) / 160.0);
                    var col = acc;
                    var gl = glow;
                    if (scanning) {
                        var w = (q * 4 - (i + (k + 0.5) / 5)).abs();
                        if (w < 0.12) {
                            col = G.mix(acc, 0xFFFFFF, 0.7 * (1 - w / 0.12));
                        }
                    }
                    if (hiS >= 0 && i >= 2 && (i - 2) * 5 + k == hiS) {
                        col = G.mix(acc, 0xFFFFFF, 0.75);
                        gl = G.dim(acc, 0.45);
                    }
                    sym(dc, (code & (16 >> k)) != 0, MX + k * 54 + 22, MY[i], g, col, gl);
                }
            }
            // signal lamp: blinks the minutes in morse while awake
            if (done && live) {
                var on = hiS >= 0;
                dc.setColor(on ? G.dim(acc, 0.3) : 0x101010, -1);
                dc.fillCircle(227, 400, 15);
                dc.setColor(on ? acc : 0x2A2A2A, -1);
                dc.fillCircle(227, 400, 9);
                if (on) {
                    dc.setColor(G.mix(acc, 0xFFFFFF, 0.7), -1);
                    dc.fillCircle(227, 400, 4);
                }
            }
        } else {
            tablet(dc, scanning ? q : 0);
            dc.setColor(0x5A5248, -1);
            F.px(dc, "I=1 V=5 X=10 L=50", 227, 258, 2, 1, 0);
            // interpunct groove between hours and minutes
            dc.setColor(0x16130F, -1);
            dc.fillRectangle(150, 183, 154, 2);
            dc.setColor(0x413A31, -1);
            dc.fillRectangle(150, 185, 154, 1);
            dc.setColor(0x16130F, -1);
            dc.fillPolygon([[227, 177], [234, 184], [227, 191], [220, 184]]);
            dc.setColor(G.dim(GOLD, 0.8), -1);
            dc.fillPolygon([[227, 180], [231, 184], [227, 188], [223, 184]]);
            engrave(dc, S[2] as String, 145, 250, 60, G.easeInOut((ms - 150) / 700.0));
            engrave(dc, S[3] as String, 222, 250, 48, G.easeInOut((ms - 550) / 700.0));
        }

        // ---- plain digits (scramble, then lock one by one)
        var xs;
        var ys;
        if (st == 1) {
            xs = BX;
            ys = [312, 312, 312, 312];
        } else if (st == 2) {
            xs = [388, 388, 388, 388];
            ys = MY;
        } else {
            xs = [163, 199, 255, 291];
            ys = [314, 314, 314, 314];
        }
        var dh = st == 2 ? 30 : 38;
        for (var i = 0; i < 4; i++) {
            if (ms < 200 + i * 90) {
                continue;
            }
            var txt;
            var col;
            if (ms < DEC0) {
                txt = "_";
                col = 0x333333;
            } else if (q < LOCK[i]) {
                txt = "" + (G.rnd(seed + i * 101 + scr) % 10);
                col = G.dim(acc, 0.5);
            } else {
                txt = "" + dg[i];
                var f = G.clamp((q - LOCK[i]) / 0.1, 0.0, 1.0);
                col = G.mix(acc, d.dcol, f);
            }
            dc.setColor(col, -1);
            F.st(dc, txt, xs[i], ys[i], dh, st == 2 ? 4 : 5, 1, 1.0, 0);
        }
        if (st != 2 && ms >= DEC0) {
            dc.setColor(q >= LOCK[1] ? d.dcol : 0x333333, -1);
            dc.fillRectangle(224, 302, 6, 6);
            dc.fillRectangle(224, 318, 6, 6);
        }

        // ---- date: encoded, then decrypted char by char
        var dq = G.clamp((q - 0.45) / 0.5, 0.0, 1.0);
        if (ms >= 300) {
            if (dq <= 0) {
                dc.setColor(G.dim(acc, 0.55), -1);
                F.px(dc, S[0] as String, 227, 340, 2, 1, 0);
            } else {
                var dec = S[1] as String;
                var len = dec.length();
                var n = (dq * len).toNumber();
                var x0 = 227 - F.pxW(dec, 2) / 2;
                dc.setColor(0xBBBBBB, -1);
                F.px(dc, dec.substring(0, n) as String, x0, 340, 2, 0, 0);
                if (n < len) {
                    var r = "";
                    for (var k = n; k < len; k++) {
                        if (dec.substring(k, k + 1).equals(" ")) {
                            r += " ";
                        } else {
                            var j = G.rnd(seed + k * 13 + scr) % 22;
                            r += SCR.substring(j, j + 1);
                        }
                    }
                    dc.setColor(G.dim(acc, 0.55), -1);
                    F.px(dc, r, x0 + n * 12, 340, 2, 0, 0);
                }
            }
        }

        // ---- status line + progress bar
        if (ms >= 200) {
            var pct = (q * 100).toNumber();
            var bx = 137;
            if (ms < DEC0) {
                dc.setColor(0x777777, -1);
                F.px(dc, "VERSCHLÜSSELT", 227, 362, 2, 1, 0);
            } else if (!done) {
                dc.setColor(acc, -1);
                F.px(dc, "ENTSCHLÜSSELE " + pct + "%", bx - 10, 362, 2, 0, 0);
            } else {
                var tw = F.pxW("KLARTEXT", 2);
                dc.setColor(G.dim(acc, 0.8), -1);
                F.px(dc, "KLARTEXT", 227 - (tw + 14) / 2, 362, 2, 0, 0);
                if (!live || (a.t / 500) % 2 == 0) {
                    dc.fillRectangle(227 + (tw + 14) / 2 - 10, 361, 10, 16);
                }
            }
            if (!(st == 2 && done && live)) {
                var lit = (q * 18).toNumber();
                for (var k = 0; k < 18; k++) {
                    dc.setColor(k < lit ? (done ? G.dim(acc, 0.55) : acc) : 0x1E1E1E, -1);
                    dc.fillRectangle(bx + k * 10, 386, 8, 8);
                }
            }
            // Binär: live seconds as six small LEDs under the bar
            if (st == 1 && done && live) {
                for (var k = 0; k < 6; k++) {
                    var on = (d.s & (32 >> k)) != 0;
                    dc.setColor(on ? acc : 0x222222, -1);
                    dc.fillCircle(227 - 50 + k * 20, 410, on ? 4 : 3);
                }
            }
        }
    }

    // static layer: the decrypted code and plain text
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    // the decryption is the reveal
    function reveal() as Boolean {
        return false;
    }

    // moving parts over the cached plain text
    hidden function after(dc as Dc, d as D, a as A, st, acc, dg as Array<Number>, ms) as Void {
        var live = a.live;
        if (st == 2 && live) {
            var hiS = lampSym(dg, ms - (DEC0 + DECL));
            var glow = G.dim(acc, 0.2);
            for (var i = 2; i < 4; i++) {
                var code = MB[dg[i]];
                for (var k = 0; k < 5; k++) {
                    var h = hiS >= 0 && (i - 2) * 5 + k == hiS;
                    sym(dc, (code & (16 >> k)) != 0, MX + k * 54 + 22, MY[i], 1.0, h ? G.mix(acc, 0xFFFFFF, 0.75) : acc, h ? G.dim(acc, 0.45) : glow);
                }
            }
            // the signal lamp takes the place of the progress bar
            dc.setColor(0x000000, -1);
            dc.fillRectangle(137, 386, 180, 8);
            var on = hiS >= 0;
            dc.setColor(on ? G.dim(acc, 0.3) : 0x101010, -1);
            dc.fillCircle(227, 400, 15);
            dc.setColor(on ? acc : 0x2A2A2A, -1);
            dc.fillCircle(227, 400, 9);
            if (on) {
                dc.setColor(G.mix(acc, 0xFFFFFF, 0.7), -1);
                dc.fillCircle(227, 400, 4);
            }
        }
        // blinking cursor after KLARTEXT
        var tw = F.pxW("KLARTEXT", 2);
        dc.setColor(live && (a.t / 500) % 2 != 0 ? 0x000000 : G.dim(acc, 0.8), -1);
        dc.fillRectangle(227 + (tw + 14) / 2.0 - 10, 361, 10, 16);
        // Binär: live seconds as six small LEDs under the bar
        if (st == 1 && live) {
            for (var k = 0; k < 6; k++) {
                var on = (d.s & (32 >> k)) != 0;
                dc.setColor(0x000000, -1);
                dc.fillCircle(227 - 50 + k * 20, 410, 5);
                dc.setColor(on ? acc : 0x222222, -1);
                dc.fillCircle(227 - 50 + k * 20, 410, on ? 4 : 3);
            }
        }
    }

    function tap(x as Number, y as Number, d as D) as Boolean {
        return true;
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var acc = d.accent;
        var dg = digs(d);
        var ox = o[0];
        var oy = o[1];
        if (st == 1) {
            dc.setPenWidth(2);
            dc.setColor(G.dim(acc, 0.45), -1);
            for (var c = 0; c < 4; c++) {
                for (var r = 4 - BN[c]; r < 4; r++) {
                    if ((dg[c] & (8 >> r)) != 0) {
                        dc.drawCircle(BX[c] + ox, BY[r] + oy + 30, 15);
                    } else {
                        dc.setColor(0x262626, -1);
                        dc.fillRectangle(BX[c] + ox - 1, BY[r] + oy + 29, 3, 3);
                        dc.setColor(G.dim(acc, 0.45), -1);
                    }
                }
            }
            dc.setColor(G.dim(acc, 0.3), -1);
            dc.fillCircle(227 + ox, 220 + oy, 2);
            dc.fillCircle(227 + ox, 264 + oy, 2);
        } else if (st == 2) {
            dc.setPenWidth(2);
            dc.setColor(G.dim(acc, 0.45), -1);
            for (var i = 0; i < 4; i++) {
                var code = MB[dg[i]];
                for (var k = 0; k < 5; k++) {
                    var cx = MX + 32 + k * 54 + ox;
                    var y = MY[i] + oy + 20;
                    if ((code & (16 >> k)) == 0) {
                        dc.drawCircle(cx, y, 7);
                    } else {
                        dc.drawRoundedRectangle(cx - 21, y - 7, 42, 14, 7);
                    }
                }
            }
        } else {
            dc.setColor(G.dim(GOLD, 0.5), -1);
            var hs = roman(G.hour(d));
            var mn = roman(d.m);
            var h = 64.0;
            if (F.stW(hs, h) > 250) {
                h = 64 * 250 / F.stW(hs, 64);
            }
            F.st(dc, hs, 227 + ox, 180 + oy, h, 2, 1, 1.0, 0);
            h = 54.0;
            if (F.stW(mn, h) > 250) {
                h = 54 * 250 / F.stW(mn, 54);
            }
            F.st(dc, mn, 227 + ox, 260 + oy, h, 2, 1, 1.0, 0);
        }
    }
}
