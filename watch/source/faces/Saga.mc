import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// SAGA — "Finos Reise": a serial story in 21 chapters. Fino the fox finds an old map and travels to
// the sea, with Pia the magpie, over a river, the mountains and through a village. Every good day
// unlocks the next chapter (one per day): the same day score as the garden (sleep score, steps
// against the goal, stress, Body Battery) has to reach 60. The new chapter is typed out on every
// wrist raise of its day while Fino walks into the scene; until the next one is unlocked, the face
// tells you how many steps are still missing. The progress lives in the watch's storage; after the
// last chapter a new journey begins. The scenes stand under the real sky and the real rain or snow.
// Styles: 1 Bilderbuch, 2 Nacht, 3 Gameboy. Mirrors web/js/faces/saga.js.
class FaceSaga extends Face {
    const GY = 290;
    const FX = 150;
    // per chapter: scene (0 forest, 1 meadow, 2 river, 3 mountains, 4 village, 5 cave, 6 sea), prop (0 none,
    // 1 map, 3 bridge, 4 campfire, 5 owl, 6 boat on the beach, 7 lantern, 8 lighthouse, 9 sailing, 10 on top)
    const SC = [0, 0, 0, 1, 1, 2, 2, 0, 0, 3, 3, 5, 5, 3, 4, 4, 1, 1, 6, 6, 6, 6];
    const PR = [0, 1, 0, 0, 0, 0, 3, 4, 5, 0, 0, 7, 7, 0, 0, 0, 0, 4, 8, 6, 9, 10];
    const TX = [
        "FINO TRÄUMT VOM MEER.", "HILF IHM: MACH AUS", "HEUTE EINEN GUTEN TAG!",
        "IM BAU FINDET FINO", "EINE ALTE KARTE.", "SIE ZEIGT DAS MEER!",
        "FINO PACKT SEINEN", "RUCKSACK UND ZIEHT", "DURCH DEN WALD.",
        "AUF DER WIESE TRIFFT", "ER PIA, DIE ELSTER.", "SIE KOMMT MIT.",
        "PIA FLIEGT VORAUS:", "DORT HINTEN GLITZERT", "EIN FLUSS!",
        "DER FLUSS IST BREIT.", "KEIN WEG HINÜBER.", "FINO DENKT NACH.",
        "DIE BIBER HABEN EINE", "BRÜCKE GEBAUT.", "DANKE, IHR BIBER!",
        "ABENDS KNISTERT DAS", "LAGERFEUER. PIA", "ERZÄHLT VOM MEER.",
        "EINE EULE WARNT:", "HINTER DEN BERGEN", "WIRD ES KALT.",
        "DIE BERGE SIND HOCH.", "SCHRITT FÜR SCHRITT", "GEHT ES BERGAUF.",
        "OBEN LIEGT SCHNEE.", "FINO FRIERT AN DEN", "PFOTEN UND LACHT.",
        "EIN STURM ZIEHT AUF.", "IN EINER HÖHLE", "FINDEN SIE SCHUTZ.",
        "IN DER HÖHLE", "LEUCHTEN KRISTALLE.", "FINO STAUNT.",
        "VOM GIPFEL SIEHT PIA", "EIN DORF IM TAL.", "DA GEHT'S LANG!",
        "IM DORF RIECHT ES", "NACH FRISCHEM BROT.", "FINO HAT HUNGER.",
        "DER BÄCKER SCHENKT", "IHM EINE BREZEL.", "DAS GIBT KRAFT!",
        "DIE LUFT WIRD SALZIG,", "MÖWEN KREISEN.", "ES IST NICHT WEIT.",
        "LETZTE NACHT UNTER", "DEN STERNEN. FINO", "KANN NICHT SCHLAFEN.",
        "DA IST ES: DAS MEER!", "SO GROSS UND BLAU", "WIE AUF DER KARTE.",
        "EIN ALTER FISCHER", "LEIHT IHNEN SEIN", "KLEINES BOOT.",
        "SIE SEGELN ZUM", "LEUCHTTURM. PIA", "SITZT AUF DEM MAST.",
        "OBEN AM LEUCHTTURM", "SCHAUT FINO ZURÜCK:", "WAS FÜR EINE REISE!",
    ];

    hidden var _ss = null; // [chapter, unlocked today, journey], read with every static redraw
    hidden var _nf = 0.0;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    hidden function leap(y) as Boolean {
        return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    }

    hidden function dayKey(d as D) as Number {
        return d.year * 1000 + d.doy;
    }

    hidden function goalOf(d as D) as Number {
        return d.stepGoal > 0 ? d.stepGoal : 10000;
    }

    // the day score without the steps: 0.3 sleep + 0.15 calm + 0.15 energy (+ 0.4 steps = 0..100)
    hidden function base(d as D) as Float {
        var sl = d.sleep > 0 ? d.sleep : 60;
        var ca = d.stress >= 0 ? 100 - d.stress : 60;
        var en = d.bb >= 0 ? d.bb : 60;
        return 0.3 * sl + 0.15 * ca + 0.15 * en;
    }

    hidden function score(d as D) as Number {
        return Math.round(base(d) + 40 * G.clamp(d.steps.toFloat() / goalOf(d), 0, 1)).toNumber();
    }

    // persistent state: unlock today's chapter once the day is good enough
    hidden function sync(d as D) as Array<Number> {
        var today = dayKey(d);
        var c = St.get("saC", 0) as Number;
        var r = St.get("saR", 1) as Number;
        if (St.get("saD", -1) != today && score(d) >= 60) {
            if (c >= 21) {
                c = 1;
                r += 1;
            } else {
                c += 1;
            }
            St.set("saC", c);
            St.set("saR", r);
            St.set("saD", today);
        }
        return [c, St.get("saD", -1) == today ? 1 : 0, r];
    }

    // [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, text, text dim,
    //  panel, fur, white, dark, star, trunk]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 3) {
            var a = 0x0F380F;
            var b = 0x306230;
            var c = 0x8BAC0F;
            var e = 0x9BBC0F;
            return [c, e, b, c, a, a, e, c, a, b, e, a, e, a] as Array<Number>;
        }
        return [0x4A9AE8, 0xB8E0FF, 0x5A4A9A, 0xFF9A6A, st == 2 ? 0x000000 : 0x060A20, st == 2 ? 0x060C1A : 0x141C44,
            0xFFFFFF, acc, 0x0C1016, 0xF07A2A, 0xFFFFFF, 0x2A1A14, 0xFFFFFF, 0x5A3A24] as Array<Number>;
    }

    hidden function dk(c as Number) as Number {
        return G.mix(c, 0x050814, _nf);
    }

    // static layer: the sky, the chapter's scene and props, the text, the status and the chapter dots;
    // Fino, Pia, flames, the lantern's glow, rain or snow and the typewriter move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var st = d.cfg.style;
        var P = pal(st, d.accent);
        var p = a.intro;
        var tt = a.live ? a.t : 0;
        if (S || _ss == null) {
            _ss = sync(d);
        }
        var ss = _ss as Array<Number>;
        var ch = ss[0];
        var fresh = ss[1] == 1;
        var sc = SC[ch];
        var pr = PR[ch];
        var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var k = st == 2 || el < -6 || ch == 17 ? 2 : el > 4 ? 0 : 1;
        _nf = st == 3 ? 0.0 : [0.0, 0.3, 0.6][k];
        var gb = st == 3;

        if (S) {
            // ---- sky (the cave has rock instead)
            if (sc == 5) {
                dc.setColor(gb ? 0x0F380F : 0x1A1612, -1);
                dc.fillRectangle(0, 0, 454, GY);
                dc.setColor(gb ? 0x306230 : 0x2A241E, -1);
                for (var i = 0; i < 9; i++) {
                    dc.fillRectangle((i * 97) % 420, 90 + ((i * 41) % 160), 40 + (i % 3) * 20, 10);
                }
                // glowing crystals
                for (var i = 0; i < 5; i++) {
                    var x = 40 + i * 92;
                    var h = 24 + (i % 3) * 14;
                    dc.setColor(gb ? 0x9BBC0F : i % 2 == 0 ? 0x5AE0FF : 0xC87AFF, -1);
                    dc.fillPolygon([[x, GY], [x + 8, GY - h], [x + 16, GY]]);
                    dc.fillPolygon([[x + 12, GY], [x + 20, GY - (h * 0.6).toNumber()], [x + 28, GY]]);
                }
            } else {
                for (var i = 0; i < 5; i++) {
                    dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 4.0), -1);
                    dc.fillRectangle(0, i * 58, 454, 58);
                }
                if (k == 2) {
                    dc.setColor(P[12], -1);
                    for (var i = 0; i < 28; i++) {
                        var z = i % 6 == 0 ? 4 : 2;
                        dc.fillRectangle(20 + ((i * 101 + 17) % 414), 92 + ((i * 47 + 11) % 120), z, z);
                    }
                } else if (el > -4) {
                    dc.setColor(gb ? 0x9BBC0F : 0xFFF6D0, -1);
                    dc.fillCircle(84, 250 - Math.round(G.clamp(el, -4, 40) * 3.6).toNumber(), 14);
                }
            }

            // ---- the scene
            var gnd = [0x3A6A2A, 0x5AA83A, 0x5AA83A, 0xE8EEF6, 0x8AA85A, 0x2A2420, 0xE8D098][sc];
            if (sc == 0) {
                dc.setColor(dk(gb ? 0x306230 : 0x1E4A2A), -1);
                for (var i = 0; i < 9; i++) {
                    var x = i * 56 - 20;
                    var h = 90 + ((i * 37) % 50);
                    dc.fillPolygon([[x, GY], [x + 30, GY - h], [x + 60, GY]]);
                }
                var TXS = [-30, 300, 380];
                var THS = [150, 130, 170];
                dc.setColor(dk(gb ? 0x0F380F : 0x2A6A32), -1);
                for (var i = 0; i < 3; i++) {
                    dc.fillPolygon([[TXS[i], GY - 20], [TXS[i] + 40, GY - THS[i]], [TXS[i] + 80, GY - 20]]);
                }
                dc.setColor(dk(P[13]), -1);
                for (var i = 0; i < 3; i++) {
                    dc.fillRectangle(TXS[i] + 34, GY - 20, 12, 20);
                }
            } else if (sc == 1 || sc == 4) {
                dc.setColor(dk(gb ? 0x306230 : 0x6AB84A), -1);
                for (var x = 0; x < 454; x += 8) {
                    var h = 30 + Math.round(16 * Math.sin(x / 70.0 + 1) + 8 * Math.sin(x / 29.0)).toNumber();
                    dc.fillRectangle(x, GY - h, 8, h);
                }
                if (sc == 4) {
                    // the village
                    var HX = [24, 110, 290, 372];
                    var HC = [0xF0E0C0, 0xE8C8A0, 0xD8E0E8, 0xF0D8B0];
                    for (var i = 0; i < 4; i++) {
                        var x = HX[i];
                        var w = 66;
                        var h = 54 + (i % 2) * 20;
                        dc.setColor(dk(gb ? 0x8BAC0F : HC[i]), -1);
                        dc.fillRectangle(x, GY - h, w, h);
                        dc.setColor(dk(gb ? 0x0F380F : 0xB84A2A), -1);
                        dc.fillPolygon([[x - 6, GY - h], [x + w / 2, GY - h - 30], [x + w + 6, GY - h]]);
                        dc.setColor(k == 2 ? 0xFFD27A : dk(gb ? 0x306230 : 0x3A5A8A), -1);
                        dc.fillRectangle(x + 10, GY - h + 14, 14, 14);
                        dc.fillRectangle(x + 40, GY - h + 14, 14, 14);
                        dc.setColor(dk(gb ? 0x306230 : 0x6A3A24), -1);
                        dc.fillRectangle(x + 26, GY - 26, 14, 26);
                    }
                }
            } else if (sc == 3) {
                var MX = [-30, 110, 290];
                var MW = [200, 260, 200];
                var MT = [90, 110, 150];
                for (var i = 0; i < 3; i++) {
                    var x = MX[i];
                    var w = MW[i];
                    var top = MT[i];
                    dc.setColor(dk(gb ? 0x306230 : 0x6A7488), -1);
                    dc.fillPolygon([[x, GY], [x + w / 2, top], [x + w, GY]]);
                    dc.setColor(dk(gb ? 0x9BBC0F : 0xF4F8FF), -1);
                    dc.fillPolygon([[x + w / 2 - 22, top + 30], [x + w / 2, top], [x + w / 2 + 22, top + 30]]);
                }
            } else if (sc == 6) {
                dc.setColor(dk(gb ? 0x306230 : 0x2A6AA8), -1);
                dc.fillRectangle(0, 214, 454, GY - 214);
                dc.setColor(dk(gb ? 0x8BAC0F : 0x8AC8F0), -1);
                for (var i = 0; i < 10; i++) {
                    dc.fillRectangle((i * 89) % 430, 222 + ((i * 23) % 60), 18, 2);
                }
            }
            // ground (the river runs through a gap)
            dc.setColor(dk(gb ? 0x8BAC0F : gnd), -1);
            if (sc == 2) {
                dc.fillRectangle(0, GY - 30, 180, 44);
                dc.fillRectangle(290, GY - 30, 164, 44);
                dc.setColor(dk(gb ? 0x306230 : 0x2A6AA8), -1);
                dc.fillRectangle(180, GY - 14, 110, 28);
                dc.setColor(dk(gb ? 0x9BBC0F : 0x8AC8F0), -1);
                for (var i = 0; i < 4; i++) {
                    dc.fillRectangle(190 + i * 24, GY - 8 + (i % 2) * 8, 14, 2);
                }
            } else {
                dc.fillRectangle(0, GY, 454, 14);
            }
            if (sc == 1 && !gb) {
                var FC = [0xFF5A8A, 0xFFE05A, 0xFFFFFF];
                for (var i = 0; i < 14; i++) {
                    dc.setColor(dk(FC[i % 3]), -1);
                    dc.fillRectangle(20 + ((i * 67) % 414), GY + 4 + ((i * 13) % 8), 4, 4);
                }
            }

            // ---- the props
            if (pr == 1) {
                dc.setColor(dk(gb ? 0x9BBC0F : 0xF0E0B0), -1);
                dc.fillRectangle(236, GY - 18, 40, 22);
                dc.setColor(dk(gb ? 0x0F380F : 0xD83A2A), -1);
                dc.fillRectangle(262, GY - 12, 4, 4);
                dc.fillRectangle(242, GY - 8, 14, 2);
            } else if (pr == 3) {
                dc.setColor(dk(gb ? 0x306230 : 0x8A5A2A), -1);
                dc.fillRectangle(170, GY - 34, 130, 8);
                for (var i = 0; i < 6; i++) {
                    dc.fillRectangle(172 + i * 24, GY - 52, 4, 20);
                }
                dc.fillRectangle(170, GY - 52, 130, 4);
            } else if (pr == 4) {
                dc.setColor(dk(gb ? 0x0F380F : 0x5A3A1A), -1);
                dc.fillRectangle(272, GY - 6, 40, 6);
                dc.fillRectangle(280, GY - 10, 24, 4);
            } else if (pr == 5) {
                dc.setColor(dk(P[13]), -1);
                dc.fillRectangle(300, 176, 110, 8);
                Spr.draw(dc, SprSaga.OWL, 350, 140, 4, [-1, dk(gb ? 0x306230 : 0x8A6A4A), dk(gb ? 0x8BAC0F : 0xE8D8B8), gb ? 0x9BBC0F : 0xFFD23A, 0x1A1A1A], false);
            } else if (pr == 7) {
                dc.setColor(gb ? 0x9BBC0F : 0x3A3A3A, -1);
                dc.fillRectangle(286, GY - 30, 16, 26);
                dc.setColor(gb ? 0x8BAC0F : 0xFFD27A, -1);
                dc.fillRectangle(290, GY - 24, 8, 14);
            } else if (pr == 6 || pr == 8 || pr == 10) {
                // the lighthouse (and the fisherman's boat on the beach)
                var lx = 372;
                for (var y = 110; y < GY; y += 4) {
                    var hw = Math.round(G.lerp(10, 18, (y - 110) / (GY - 110).toFloat())).toNumber();
                    var red = ((y - 110) / 30) % 2 == 1;
                    dc.setColor(dk(gb ? (red ? 0x306230 : 0x9BBC0F) : red ? 0xD8302A : 0xF4F4F4), -1);
                    dc.fillRectangle(lx - hw, y, 2 * hw, 4);
                }
                dc.setColor(dk(gb ? 0x0F380F : 0x2A2A30), -1);
                dc.fillRectangle(lx - 16, 106, 32, 6);
                dc.fillRectangle(lx - 8, 82, 16, 4);
                dc.setColor(k > 0 ? 0xFFE08A : dk(0x2A3A48), -1);
                dc.fillRectangle(lx - 8, 86, 16, 20);
                if (pr == 6) {
                    dc.setColor(dk(gb ? 0x306230 : 0x8A4A2A), -1);
                    dc.fillPolygon([[220, GY - 18], [320, GY - 18], [306, GY], [234, GY]]);
                    dc.setColor(dk(gb ? 0x0F380F : 0x5A3A24), -1);
                    dc.fillRectangle(268, GY - 70, 4, 52);
                }
            }

            // ---- the chapter text, the status, the chapter dots
            dc.setColor(P[8], -1);
            dc.fillRectangle(0, GY + 14, 454, 150);
            dc.setColor(P[6], -1);
            for (var i = 0; i < 3; i++) {
                F.px(dc, TX[ch * 3 + i], 227, GY + 22 + i * 20, 2, 1, 0);
            }
            var need = Math.ceil(((60 - base(d)) / 40) * goalOf(d)).toNumber() - d.steps;
            var msg;
            if (fresh) {
                msg = ch == 21 ? "ENDE DER REISE!" : "MORGEN GEHT'S WEITER";
            } else if (need > 0 && d.steps + need <= goalOf(d)) {
                msg = "NOCH " + G.num(need) + " SCHRITTE";
            } else {
                msg = ch == 21 ? "EINE NEUE REISE WARTET" : "KAPITEL " + (ch + 1) + " WARTET";
            }
            dc.setColor(P[7], -1);
            F.px(dc, msg, 227, 384, 2, 1, 0);
            for (var i = 0; i < 21; i++) {
                dc.setColor(i < ch ? (i == ch - 1 && fresh ? P[6] : P[7]) : G.mix(P[7], 0, 0.7), -1);
                dc.fillRectangle(124 + i * 10, 408, 6, 6);
            }

            // ---- time, chapter and date
            dc.setColor(0x000000, -1);
            F.px(dc, G.timeStr(d), 229, 26, 5, 1, 0);
            dc.setColor(gb ? 0x0F380F : P[6], -1);
            F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
            F.px(dc, (ch == 0 ? "PROLOG" : "KAPITEL " + ch + "/21") + "   " + d.dowStr + " " + d.day + ". " + d.monStr, 227, 68, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        // ---- real rain or snow (not in the cave)
        if (sc != 5) {
            Season.precip(dc, d, 0, 90, 454, GY - 90, tt);
        }
        // ---- the campfire and the lantern flicker
        if (pr == 4 || pr == 7) {
            var n = G.noise(tt / 140.0);
            dc.setColor(gb ? 0x9BBC0F : 0xFF8A2A, -1);
            if (pr == 4) {
                dc.fillPolygon([[278, GY - 8], [292, GY - 40 - Math.round(n * 8).toNumber()], [306, GY - 8]]);
                dc.setColor(gb ? 0x8BAC0F : 0xFFE05A, -1);
                dc.fillPolygon([[284, GY - 8], [292, GY - 26 - Math.round(n * 6).toNumber()], [300, GY - 8]]);
            } else {
                dc.fillRectangle(292, GY - 20 + Math.round(n * 2).toNumber(), 4, 6);
            }
        }
        // ---- Fino: walks into a new chapter on its day, otherwise sits (in the boat, on the lighthouse)
        var walk = fresh && p < 0.85 && a.live;
        var fp = [-1, dk(gb ? 0x306230 : P[9]), dk(P[10]), P[11], dk(gb ? 0x0F380F : d.accent)];
        var bob = Math.round(3 * Math.sin(tt / 400.0)).toNumber();
        var bx = Math.round(G.lerp(60, 200, G.ease(p))).toNumber();
        if (pr == 9) {
            dc.setColor(dk(gb ? 0x306230 : 0x8A4A2A), -1);
            dc.fillPolygon([[bx, GY - 30 + bob], [bx + 110, GY - 30 + bob], [bx + 96, GY - 10 + bob], [bx + 14, GY - 10 + bob]]);
            dc.setColor(dk(gb ? 0x0F380F : 0x5A3A24), -1);
            dc.fillRectangle(bx + 70, GY - 110 + bob, 4, 80);
            dc.setColor(dk(gb ? 0x9BBC0F : 0xF8F4E8), -1);
            dc.fillPolygon([[bx + 76, GY - 106 + bob], [bx + 76, GY - 38 + bob], [bx + 120, GY - 38 + bob]]);
            Spr.draw(dc, SprSaga.FOX_SIT, bx + 10, GY - 74 + bob, 3, fp, false);
        } else if (pr == 10) {
            Spr.draw(dc, SprSaga.FOX_SIT, 330, 82, 2, fp, false);
        } else {
            var fx = walk ? Math.round(G.lerp(-70, FX, p / 0.85)).toNumber() : sc == 2 && pr != 3 ? 90 : pr == 3 ? 196 : FX;
            var fy = sc == 2 ? GY - 82 + (pr == 3 ? 4 : 0) : GY - 48;
            Spr.draw(dc, walk ? ((a.t / 140) % 2 == 1 ? SprSaga.FOX_B : SprSaga.FOX_A) : SprSaga.FOX_SIT, fx, fy, 4, fp, false);
        }
        // ---- Pia the magpie travels along from chapter 3
        if (ch >= 3) {
            var bp = [-1, gb ? 0x0F380F : 0x101418, gb ? 0x9BBC0F : 0xFFFFFF, gb ? 0x306230 : 0x3A6AD8];
            if (pr == 9) {
                Spr.draw(dc, SprSaga.BIRD_B, bx + 62, GY - 136 + bob, 3, bp, false);
            } else {
                Spr.draw(dc, (tt / 160) % 2 == 0 ? SprSaga.BIRD_A : SprSaga.BIRD_B, FX + 90 + Math.round(30 * Math.sin(tt / 1100.0)).toNumber(),
                    170 + Math.round(14 * Math.sin(tt / 450.0)).toNumber(), 3, bp, false);
            }
        }
        // ---- the typewriter: today's new chapter appears letter by letter
        if (fresh && a.live && p < 1) {
            var n = Math.floor(G.clamp(p / 0.9, 0, 1) * 66).toNumber();
            var cur = false;
            for (var i = 0; i < 3; i++) {
                var t = TX[ch * 3 + i] as String;
                var L = t.length();
                var W = F.pxW(t, 2);
                var shown = n < 0 ? 0 : n > L ? L : n;
                var x0 = Math.round(227 - W / 2.0).toNumber();
                if (shown < L) {
                    dc.setColor(P[8], -1);
                    dc.fillRectangle(x0 + shown * 12, GY + 20 + i * 20, W - shown * 12 + 2, 18);
                    if (!cur && n >= 0 && (a.t / 200) % 2 == 0) {
                        dc.setColor(P[7], -1);
                        dc.fillRectangle(x0 + shown * 12, GY + 22 + i * 20, 10, 14);
                    }
                    cur = true;
                }
                n -= L;
            }
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var ch = _ss == null ? 0 : (_ss as Array<Number>)[0];
        dc.setColor(st == 3 ? 0x8BAC0F : 0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
        dc.setColor(st == 3 ? 0x306230 : 0x4A4A52, -1);
        F.px(dc, ch == 0 ? "PROLOG" : "KAPITEL " + ch + "/21", 227 + o[0], 384 + o[1], 2, 1, 0);
    }
}
