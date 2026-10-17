import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// BUDDY — "Pixel Buddy": a virtual pet driven by your body data. Its mood follows
// Body Battery, stress, steps and the hour; four Tamagotchi needs bars (Energie, Ruhe,
// Futter, Schlaf), a speech bubble, and an egg that hatches on the first wake of the day.
// Styles: 1 Klassik, 2 Gameboy, 3 Pastell. Mirrors web/js/faces/buddy.js.
class FaceBuddy extends Face {
    // per body frame: face offset x/y and head top row (sprite pixels)
    const FDX = [6, 7, 5, 9];
    const FDY = [9, 8, 9, 5];
    const HT = [3, 2, 2, 2];
    const PX = 5; // scene pixel size
    const BASE = 314; // bottom edge of the buddy
    const LBL = ["ENERGIE", "RUHE", "FUTTER", "SCHLAF"];
    // moods: 0 SLEEP, 1 STRESS, 2 PARTY, 3 LAZY, 4 TIRED, 5 HAPPY
    // ambient pose tables (8 fps steps): frame + y offset
    const HOP_F = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 2, 1, 0];
    const HOP_Y = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -10, -20, -10, 0, 0];
    const PAR_F = [0, 1, 2, 0, 0, 2];
    const PAR_Y = [0, 0, -10, -20, -20, -10];
    const POP_F = [1, 1, 1, 2, 0, 0, 2, 1, 0, 0];
    const POP_Y = [0, 0, 0, -15, -25, -25, -10, 0, 0, 0];
    const HAT_F = [2, 2, 0, 0, 2, 1, 0, 0];
    const HAT_Y = [-10, -30, -40, -35, -15, 0, 0, 0];
    const REST = [300, 875, 375, 0, 0, 0];
    const STX = [64, 388, 146, 316];
    const STY = [166, 170, 188, 186];

    hidden var _bodies as Array<ByteArray>;
    hidden var _eyes as Array<ByteArray>;
    hidden var _mouths as Array<ByteArray>;
    hidden var _icons as Array<ByteArray>;
    hidden var _hatchDay = -2;
    hidden var _pKey = -1;
    hidden var _P as Array<Number> = [] as Array<Number>;

    function initialize() {
        Face.initialize();
        _bodies = [SprBuddy.BODY, SprBuddy.SQUASH, SprBuddy.STRETCH, SprBuddy.FLAT] as Array<ByteArray>;
        _eyes = [SprBuddy.EYE_OPEN, SprBuddy.EYE_BLINK, SprBuddy.EYE_HAPPY, SprBuddy.EYE_SLEEP, SprBuddy.EYE_TIRED, SprBuddy.EYE_STRESS] as Array<ByteArray>;
        _mouths = [SprBuddy.MOUTH_SMILE, SprBuddy.MOUTH_OPEN, SprBuddy.MOUTH_FLAT, SprBuddy.MOUTH_FROWN, SprBuddy.MOUTH_O, SprBuddy.MOUTH_DOT] as Array<ByteArray>;
        _icons = [SprBuddy.ICO_BOLT, SprBuddy.ICO_LEAF, SprBuddy.ICO_APPLE, SprBuddy.ICO_MOON] as Array<ByteArray>;
    }

    function fps() as Number {
        return 8;
    }

    hidden function mood(d as D) as Number {
        if ((d.bb >= 0 && d.bb < 20) || d.h >= 22 || d.h < 6) {
            return 0;
        }
        if (d.stress >= 70) {
            return 1;
        }
        if (d.stepGoal > 0 && d.steps >= d.stepGoal) {
            return 2;
        }
        if (d.h >= 15 && d.steps >= 0 && d.steps < d.stepGoal * 0.3) {
            return 3;
        }
        if (d.bb >= 0 && d.bb < 40) {
            return 4;
        }
        return 5;
    }

    hidden function line(d as D, md) as String {
        var alt = d.m % 2 == 1;
        if (md == 0) {
            return (d.h >= 22 || d.h < 6) ? "Zzz... gute Nacht!" : "Akku leer... Zzz";
        }
        if (md == 1) {
            return alt ? "Tief durchatmen!" : "Puh, Stress...";
        }
        if (md == 2) {
            return alt ? "Du bist super! @" : "Zieeel! Juhuu!";
        }
        if (md == 3) {
            return "BEWEG DICH!";
        }
        if (md == 4) {
            return alt ? "Ein Nickerchen?" : "Bin so müde...";
        }
        if (d.bb >= 70) {
            return "Ich bin voll geladen!";
        }
        return alt ? "Hab dich lieb @" : "Alles super!";
    }

    // colour table per style (cached per style + accent)
    hidden function pal(st, acc) as Array<Number> {
        var key = st * 16777216 + acc;
        if (key == _pKey) {
            return _P;
        }
        _pKey = key;
        var W = 0xFFFFFF;
        if (st == 2) {
            var c0 = 0x0F380F;
            var c1 = 0x306230;
            var c2 = 0x8BAC0F;
            var c3 = 0x9BBC0F;
            _P = [c3, c0, c2, c3, c1, c3, c1, c0, c3, c1,
                c0, c2, c1, c3, c0, c0, c2, c0, c0, c0, c0,
                c1, c2, c0, c1, c3, c3, c1, c3, c0,
                c1, c1, c2, c1, c0, c0, c0, -1, -1] as Array<Number>;
        } else if (st == 3) {
            var ink = 0x5B4B6B;
            var shell = G.mix(acc, 0xFFF6EE, 0.62);
            var scr = 0xEEF3E2;
            _P = [shell, ink, G.mix(acc, W, 0.25), G.mix(acc, W, 0.75), G.mix(acc, ink, 0.3), G.mix(acc, W, 0.55), 0xFF9EB5, 0x3D3048, W, 0xFF8FA3,
                ink, G.mix(shell, W, 0.7), G.mix(ink, shell, 0.38), W, ink, ink, G.mix(scr, ink, 0.16), 0xF0B030, 0x4CC2AC, 0xF38A66, 0x9C80E6,
                0xA7C7F2, 0xD6E6FF, G.mix(0xA7C7F2, ink, 0.45), 0x8FB0EA, W, W, 0xF7C95C, 0xFF8FA3, 0x7FD3C3,
                0x7CC8F0, 0x8A7CC0, 0xFFFAF2, 0xE6D7C0, acc, 0xE0506A, ink, scr, G.mix(shell, ink, 0.35)] as Array<Number>;
        } else {
            _P = [-1, G.mix(acc, 0, 0.72), acc, G.mix(acc, W, 0.6), G.mix(acc, 0, 0.3), G.mix(acc, W, 0.35), G.mix(acc, 0xFF2D55, 0.55), 0x1B1024, W, 0xFF5A6E,
                W, G.dim(acc, 0.45), 0x9A94A8, W, W, 0x22182E, 0x2C2638, 0xFFD23D, 0x4FD8C4, 0xFF8A3D, 0x9B7BFF,
                0x4C5BD4, 0x7D8CFF, 0x2A327A, 0x3E4FC8, 0xEDEBFF, W, 0xFFD23D, 0xFF5A7A, 0x4FD8C4,
                0x7FD8FF, 0xA9C8FF, 0xFFF4E0, 0xE0CFAE, acc, 0xFF4A4A, -2, -1, -1] as Array<Number>;
        }
        return _P;
    }

    // cut-corner pixel box
    hidden function pbox(dc as Dc, x, y, w, h, c) as Void {
        dc.setColor(c, -1);
        dc.fillRectangle(x + 4, y, w - 8, h);
        dc.fillRectangle(x, y + 4, w, h - 8);
    }

    // speech / thought bubble centred at cx, top y
    hidden function bubble(dc as Dc, P as Array<Number>, txt as String, cx, y, thought as Boolean) {
        var tw = F.pxW(txt, 2);
        var w = tw + 24;
        var h = 28;
        var x = Math.round(cx - w / 2.0).toNumber();
        var edge = P[14];
        var fill = P[13];
        pbox(dc, x, y, w, h, edge);
        if (edge != fill) {
            pbox(dc, x + 3, y + 3, w - 6, h - 6, fill);
        }
        var tx = 246;
        if (thought) {
            pbox(dc, tx, y + h + 3, 12, 10, edge);
            if (edge != fill) {
                dc.setColor(fill, -1);
                dc.fillRectangle(tx + 3, y + h + 6, 6, 4);
            }
            dc.setColor(edge, -1);
            dc.fillRectangle(tx - 8, y + h + 17, 6, 6);
        } else {
            dc.setColor(edge, -1);
            dc.fillRectangle(tx, y + h - 2, 15, 6);
            dc.fillRectangle(tx, y + h + 4, 10, 5);
            dc.fillRectangle(tx, y + h + 9, 5, 5);
            if (edge != fill) {
                dc.setColor(fill, -1);
                dc.fillRectangle(tx + 3, y + h - 3, 9, 5);
                dc.fillRectangle(tx + 3, y + h + 2, 4, 5);
            }
        }
        dc.setColor(P[15], -1);
        return x + 12;
    }

    hidden function needVal(d as D, i) {
        if (i == 0) {
            return d.bb;
        }
        if (i == 1) {
            return d.stress < 0 ? -1 : 100 - d.stress;
        }
        if (i == 2) {
            return (d.stepGoal > 0 && d.steps >= 0) ? (100.0 * d.steps) / d.stepGoal : -1;
        }
        return d.sleep;
    }

    // static layer: backdrop, time, needs bars, cushion, slots; the buddy and its bubble move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var st = d.cfg.style;
        var P = pal(st, d.accent);
        var p = a.intro;
        var md = mood(d);
        var live = a.live;
        var t = live ? a.t : REST[md];
        var k = t / 125;
        var today = d.year * 1000 + d.doy;
        if (_hatchDay == -2) {
            _hatchDay = St.get("bDay", -1);
        }
        var hatch = md != 0 && _hatchDay != today;
        if (hatch && p >= 1 && !a.so) {
            _hatchDay = today;
            St.set("bDay", today);
        }

        if (S) {
            // ---------------- backdrop
            if (st == 2) {
                dc.setColor(P[0], -1);
                dc.fillRectangle(0, 0, 454, 454);
                dc.setColor(P[11], -1);
                dc.setPenWidth(8);
                dc.drawCircle(227, 227, 222);
            } else if (st == 3) {
                dc.setColor(P[0], -1);
                dc.fillRectangle(0, 0, 454, 454);
                dc.setColor(P[38], -1);
                dc.fillRoundedRectangle(26, 116, 402, 216, 30);
                dc.setColor(P[37], -1);
                dc.fillRoundedRectangle(32, 122, 390, 204, 25);
            }

            // ---------------- time + date
            var ts = G.timeStr(d);
            var ty = 40 - Math.round((1 - G.ease(p * 3)) * 30).toNumber();
            dc.setColor(P[11], -1);
            F.px(dc, ts, 231, ty + 4, 7, 1, 0);
            dc.setColor(P[10], -1);
            F.px(dc, ts, 227, ty, 7, 1, 0);
            dc.setColor(P[12], -1);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 97, 2, 1, 0);

            // ---------------- needs bars (2 left, 2 right)
            for (var i = 0; i < 4; i++) {
                var right = i >= 2;
                var y = (i % 2) * 56 + 200;
                var v = needVal(d, i);
                var n = v < 0 ? 0 : G.clamp(Math.ceil(v / 20.0 - 0.001).toNumber(), v > 0 ? 1 : 0, 5);
                var fill = p >= 1 ? n : Math.floor(n * G.ease(G.stag(p - 0.45, i, 0.06, 0.3)) + 0.001).toNumber();
                var warn = v >= 0 && n <= 1 && (!live || k % 8 < 5);
                var lx = right ? 410 : 44;
                dc.setColor(P[12], -1);
                F.px(dc, LBL[i], lx, y, 2, right ? 2 : 0, 0);
                var ix = right ? 389 : 44;
                Spr.draw(dc, _icons[i], ix, y + 18, 3, [-1, warn ? P[35] : P[17 + i], st == 1 ? P[13] : (st == 2 ? P[11] : P[1])], false);
                var sx = right ? 322 : 70;
                for (var s = 0; s < 5; s++) {
                    var on = right ? 4 - s < fill : s < fill;
                    dc.setColor(on ? P[17 + i] : P[16], -1);
                    dc.fillRectangle(sx + s * 13, y + 21, 10, 15);
                }
            }
        }

        if (M) {
            // ---------------- night sky (sleeping)
            if (md == 0) {
                dc.setColor(P[27], -1);
                for (var i = 0; i < 4; i++) {
                    var sx = STX[i];
                    var sy = STY[i];
                    dc.fillRectangle(sx, sy, 3, 3);
                    if ((k + i * 3) % 10 < 6) {
                        dc.fillRectangle(sx - 3, sy, 9, 3);
                        dc.fillRectangle(sx, sy - 3, 3, 9);
                    }
                }
            }
        }

        if (S) {
            // ---------------- cushion
            var cy0 = BASE - 20;
            Spr.draw(dc, SprBuddy.CUSHION, 137, cy0, PX, [P[23], P[21], P[22], P[27]], false);
        }

        if (M) {
            // ---------------- buddy pose
            var fr = 0;
            var by = 0;
            var bx = 0;
            var eye = 0;
            var mouth = 0;
            var show = true;
            var egg = -1;
            var eggX = 0;
            var eggY = 0;
            var shellT = -1.0;
            if (md == 5) {
                var q = k % 16;
                fr = HOP_F[q];
                by = HOP_Y[q];
                eye = by < 0 ? 2 : (k % 27 == 5 ? 1 : 0);
                mouth = by < 0 ? 1 : 0;
            } else if (md == 2) {
                var q = k % 6;
                fr = PAR_F[q];
                by = PAR_Y[q];
                eye = 2;
                mouth = 1;
            } else if (md == 1) {
                bx = k % 10 < 5 ? ((k % 2) * 2 - 1) * 5 : 0;
                eye = 5;
                mouth = 3;
            } else if (md == 0) {
                fr = k % 16 < 8 ? 0 : 1;
                eye = 3;
                mouth = fr == 0 ? 4 : 5;
            } else if (md == 4) {
                fr = k % 12 < 6 ? 0 : 1;
                var yawn = k % 48 >= 30 && k % 48 < 38;
                eye = yawn ? 1 : 4;
                mouth = yawn ? 4 : 2;
            } else {
                fr = 3;
                eye = k % 30 == 4 ? 1 : 4;
                mouth = 2;
            }
            // intro: egg hatch (first wake of the day) or a squash & stretch pop
            if (p < 1) {
                bx = 0;
                if (hatch) {
                    if (p < 0.5) {
                        show = false;
                        egg = p < 0.28 ? 0 : (p < 0.4 ? 1 : 2);
                        eggY = -Math.round((1 - G.ease(p / 0.15)) * 24).toNumber() * 5;
                        eggX = p > 0.15 ? (Math.floor(p * 22).toNumber() % 2) * 10 - 5 : 0;
                    } else {
                        var u = (p - 0.5) / 0.5;
                        var q = G.clamp(Math.floor(u * 8).toNumber(), 0, 7);
                        fr = md == 3 ? 3 : HAT_F[q];
                        by = HAT_Y[q];
                        eye = q < 5 ? 2 : eye;
                        mouth = q < 5 ? 1 : mouth;
                        shellT = u;
                    }
                } else {
                    var q = G.clamp(Math.floor(p * 10).toNumber(), 0, 9);
                    if (md != 3) {
                        fr = POP_F[q];
                    }
                    by = POP_Y[q];
                    if (q < 3) {
                        eye = md == 0 ? 3 : 1;
                    }
                }
            }

            // ---------------- confetti (behind)
            if (md == 2 && p >= 0.75) {
                var cc = st == 2 ? [P[1], P[4], P[1], P[4], P[1]] : [P[17], P[18], P[28], P[20], P[19]];
                var sd = 4242;
                for (var i = 0; i < 16; i++) {
                    sd = G.rnd(sd);
                    var x = 145 + (sd % 160);
                    sd = G.rnd(sd);
                    var v = 40 + (sd % 50);
                    sd = G.rnd(sd);
                    var yy = 130 + (t * v / 1000 + (sd % 190)) % 190;
                    var sy = (yy / 5) * 5 + 4;
                    var sx = Math.floor((x + G.noise(t / 400.0 + i) * 8) / 5.0).toNumber() * 5 + 2;
                    if (sy > 285) {
                        continue;
                    }
                    dc.setColor(cc[i % 5], -1);
                    if ((i + k) % 3 == 0) {
                        dc.fillRectangle(sx, sy, 5, 5);
                    } else {
                        dc.fillRectangle(sx, sy, i % 2 == 0 ? 10 : 5, i % 2 == 0 ? 5 : 10);
                    }
                }
            }

            // ---------------- egg
            if (egg >= 0) {
                var ex = 187 + eggX;
                var ey = BASE - 100 + eggY;
                var ep = [P[1], P[32], P[33], P[34]];
                Spr.draw(dc, SprBuddy.EGG, ex, ey, PX, ep, false);
                if (egg == 1) {
                    Spr.draw(dc, SprBuddy.CRACK1, ex, ey, PX, ep, false);
                }
                if (egg == 2) {
                    Spr.draw(dc, SprBuddy.CRACK2, ex, ey, PX, ep, false);
                }
            }

            // ---------------- buddy
            var B = _bodies[fr];
            var W = B[0];
            var H = B[1];
            var X = 227 - (W * PX) / 2 + bx;
            var Y = BASE - H * PX + by;
            if (show) {
                Spr.draw(dc, B, X, Y, PX, [P[1], P[2], P[3], P[4], P[5], P[6]], false);
                var fp = [P[7], P[8], -1, P[4], -1, P[6], P[9]];
                Spr.draw(dc, _eyes[eye], X + FDX[fr] * PX, Y + FDY[fr] * PX, PX, fp, false);
                Spr.draw(dc, _mouths[mouth], X + FDX[fr] * PX, Y + (FDY[fr] + 3) * PX, PX, fp, false);
                var hy = Y + (HT[fr] + 1) * PX;
                if (md == 0) {
                    Spr.draw(dc, SprBuddy.NIGHTCAP, X + (W / 2 - 8) * PX - 5, hy - 9 * PX, PX, [P[1], P[24], P[25], P[26]], false);
                }
                if (md == 2) {
                    Spr.draw(dc, SprBuddy.PARTYHAT, X + ((W - 7) / 2) * PX, hy - 9 * PX, PX, [P[1], P[27], P[28], P[29]], false);
                }
            }
            // shell pieces of the hatch
            if (shellT >= 0 && shellT < 1) {
                var ep = [P[1], P[32], P[33], P[34]];
                var sx = 187 - Math.round(shellT * 18).toNumber() * 5;
                var sy = BASE - 100 - Math.round(40 * shellT - 50 * shellT * shellT).toNumber() * 5;
                if (shellT < 0.8) {
                    Spr.draw(dc, SprBuddy.SHELL_TOP, sx, sy, PX, ep, false);
                }
                if (shellT < 0.4) {
                    Spr.draw(dc, SprBuddy.SHELL_BOT, 187, BASE - 50, PX, ep, false);
                } else if (shellT < 0.6) {
                    dc.setColor(P[32], -1);
                    var r = Math.round((shellT - 0.4) * 100).toNumber();
                    for (var i = 0; i < 6; i++) {
                        dc.fillRectangle(222 + Math.round(Math.sin(i * 1.05) * (40 + r)).toNumber(), BASE - 15 - Math.round(Math.cos(i * 1.05).abs() * r).toNumber(), 5, 5);
                    }
                }
            }

            // ---------------- mood props
            if (show && p >= 0.6) {
                if (md == 1) {
                    var sp = [P[30], st == 2 ? P[3] : 0xFFFFFF];
                    for (var i = 0; i < 2; i++) {
                        var ph = ((t + i * 520) % 1040) / 1040.0;
                        var sx = i == 0 ? X - 10 - Math.round(ph * 3).toNumber() * 5 : X + W * PX - 5 + Math.round(ph * 3).toNumber() * 5;
                        Spr.draw(dc, SprBuddy.SWEAT, sx, Y + 25 + Math.round(ph * 8).toNumber() * 5, PX, sp, false);
                    }
                } else if (md == 0) {
                    dc.setColor(P[31], -1);
                    for (var i = 0; i < 3; i++) {
                        var ph = ((t + i * 800) % 2400) / 2400.0;
                        var zs = 2 + Math.floor(ph * 3).toNumber();
                        F.px(dc, zs >= 4 ? "Z" : "z", X + W * PX - 5 + Math.round(ph * 5).toNumber() * 5, Y + 15 - Math.round(ph * 7).toNumber() * 5, zs, 0, 0);
                    }
                }
            }

            // ---------------- speech bubble
            if (p >= 1) {
                var txt = line(d, md);
                var bw = txt;
                var n = txt.length();
                if (live) {
                    if (md == 3) {
                        if ((t / 2000) % 2 == 0) {
                            bw = "...";
                            txt = "...".substring(0, k % 4) as String;
                            n = txt.length();
                        }
                    } else {
                        n = G.clamp((t - 1400) / 45, 0, txt.length());
                    }
                }
                var tx = bubble(dc, P, bw, 227, 129, md == 0 || md == 3);
                if (n > 0) {
                    F.px(dc, txt.substring(0, n) as String, tx, 136, 2, 0, 0);
                }
            }
        }

        if (!S) {
            return;
        }
        // ---------------- slots
        for (var i = 0; i < 3; i++) {
            var sl = d.slots[i];
            var x = 125 + i * 102;
            var lbl = sl[:lbl] as String;
            if (lbl.length() == 0) {
                continue;
            }
            var val = sl[:val] as String;
            var vs = F.pxW(val, 3) > 88 ? 2 : 3;
            if (st == 3) {
                dc.setColor(P[12], -1);
                F.px(dc, lbl, x, 336, 2, 1, 0);
                dc.setColor(P[38], -1);
                dc.fillRoundedRectangle(x - 50, 352, 100, 36, 18);
                dc.setColor(P[13], -1);
                dc.fillRoundedRectangle(x - 48, 352, 96, 32, 16);
                dc.setColor(P[10], -1);
                F.px(dc, val, x, vs == 3 ? 358 : 361, vs, 1, 0);
            } else {
                dc.setColor(P[12], -1);
                F.px(dc, lbl, x, 338, 2, 1, 0);
                dc.setColor(st == 2 ? P[36] : d.dcol, -1);
                F.px(dc, val, x, vs == 3 ? 356 : 359, vs, 1, 0);
            }
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var c = st == 2 ? 0x306230 : G.dim(d.accent, 0.5);
        dc.setColor(0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 96 + o[1], 6, 1, 1);
        var X = 227 - 60 + o[0];
        var Y = BASE - 110 + o[1];
        Spr.draw(dc, SprBuddy.BODY, X, Y, PX, [c, -1, -1, -1, -1, -1], false);
        Spr.draw(dc, SprBuddy.EYE_SLEEP, X + 30, Y + 45, PX, [c], false);
        Spr.draw(dc, SprBuddy.NIGHTCAP, X + 15, Y - 25, PX, [c, -1, -1, -1], false);
        dc.setColor(G.dim(c, 0.8), -1);
        F.px(dc, "z", X + 125, Y + 5, 3, 0, 0);
        F.px(dc, "Z", X + 145, Y - 25, 4, 0, 0);
    }
}
