import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// PLAN — "Was geht heute?": the watch's training advice for today, as a little scene. It weighs your
// state (Body Battery, sleep, stress, recovery), the recovery time, the week's training days against
// your goal, the weather outside and the time of day, and suggests: rest day on the sofa, relaxing
// (a breathing guide at six breaths a minute), a walk, an easy ride, an endurance ride, intervals –
// on the indoor trainer when it rains, freezes or is too hot – or, late at night, sleep. Below the
// reasons in plain words. On every wrist raise the scene comes to life (the cranks turn).
// Styles: 1 Hell, 2 Nacht, 3 Akzent. Mirrors web/js/faces/plan.js.
class FacePlan extends Face {
    const GY = 316;
    const TITLE = ["RUHETAG", "ENTSPANNEN", "SPAZIERGANG", "LOCKER RADELN", "GRUNDLAGE", "INTERVALLE", "ROLLE DRINNEN", "SCHLAFEN"];
    const SUB = ["SOFA, TEE, FRÜH INS BETT", "10 MIN ATMEN ODER YOGA", "30 MIN AN DER LUFT", "60 MIN, ZONE 1-2", "90 MIN, ZONE 2",
        "5 X 4 MIN HART", "", "MORGEN GEHT'S WEITER"];
    const RIDE = ["", "", "", "60 MIN LOCKER", "90 MIN ZONE 2", "5 X 4 MIN HART"];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    // bad weather for being outside: rain chance, frost, heat or a storm
    hidden function badWeather(d as D) as Boolean {
        return d.rain >= 60 || (d.temp > -99 && (d.temp < 1 || d.temp > 32)) || Insight.condName(d.cond).equals("GEWITTER");
    }

    // [activity, outdoor activity it replaces (for the indoor trainer)]
    hidden function advise(d as D) as Array<Number> {
        var r = Insight.ready(d);
        var st = Insight.state(d, r[0]);
        var m = d.mins;
        if (m >= 1320 || m < 330) {
            return [7, 7] as Array<Number>;
        }
        if (st == 3 || d.recov > 2160) {
            return [0, 0] as Array<Number>;
        }
        if (st == 4) {
            return [1, 1] as Array<Number>;
        }
        var done = d.trainDays >= (d.dayGoal > 0 ? d.dayGoal : 4);
        var a = 2;
        if (m >= 1200 || st == 2) {
            a = 2;
        } else if (st == 1) {
            a = done ? 3 : 4;
        } else {
            a = d.recov >= 0 && d.recov < 720 && !done ? 5 : 4;
        }
        if (badWeather(d)) {
            return a == 2 ? [1, 2] as Array<Number> : [6, a] as Array<Number>;
        }
        return [a, a] as Array<Number>;
    }

    // [bg top, bg low, floor, wall line, ink, dim, title, shirt, skin, eye, trousers, shoes, hair, mug, frame,
    //  sofa, blanket]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0x0A0E1E, 0x1A2244, 0x16182A, 0x22263A, 0xFFFFFF, 0x8A92B0, acc, acc, 0xF2C08A, 0x1A1A1A,
                0x2A2A3A, 0x141414, 0x5A3A1A, 0xF4F0E6, 0xD8D8E8, 0x5A3A6A, 0x3A5A9A] as Array<Number>;
        }
        if (st == 3) {
            return [G.mix(acc, 0, 0.75), G.mix(acc, 0, 0.45), G.mix(acc, 0, 0.82), G.mix(acc, 0, 0.6), 0xFFFFFF,
                G.mix(acc, 0xFFFFFF, 0.55), 0xFFFFFF, 0xFFFFFF, 0xF2C08A, 0x1A1A1A, 0x1A1A22, 0x111111, 0x3A2A1A, 0xFFFFFF, 0xFFFFFF,
                G.mix(acc, 0, 0.5), G.mix(acc, 0xFFFFFF, 0.3)] as Array<Number>;
        }
        return [0x6AB4F0, 0xD0ECFF, 0x6A7A4A, 0xD8C8B0, 0x1A1A22, 0x4A4A58, 0xC0392B, acc, 0xF2C08A, 0x1A1A1A, 0x2A2A3A,
            0x141414, 0x5A3A1A, 0xFFFFFF, 0x2A2A30, 0x8A4A3A, 0x3A6AAA] as Array<Number>;
    }

    // a cyclist from the side: wheels, frame and a rider whose legs follow the crank angle a
    hidden function bike(dc as Dc, P as Array<Number>, cx as Number, gy as Number, a, trainer as Boolean) as Void {
        var ry = gy - 24;
        var rx = cx - 40;
        var fx = cx + 40;
        dc.setColor(P[14], -1);
        dc.setPenWidth(4);
        dc.drawCircle(rx, ry, 22);
        dc.drawCircle(fx, ry, 22);
        var bx = cx - 4;
        var by = gy - 22;
        var sx = cx - 16;
        var sy = gy - 60;
        var hx = cx + 26;
        var hy = gy - 58;
        dc.drawLine(rx, ry, bx, by);
        dc.drawLine(rx, ry, sx, sy);
        dc.drawLine(bx, by, sx, sy);
        dc.drawLine(sx, sy, hx, hy);
        dc.drawLine(bx, by, hx, hy);
        dc.drawLine(hx, hy, fx, ry);
        if (trainer) {
            dc.fillPolygon([[rx - 4, ry], [rx + 4, ry], [rx + 22, gy], [rx - 22, gy]]);
        }
        // legs: hip -> knee -> foot on the pedal
        var px = Math.cos(a) * 13;
        var py = Math.sin(a) * 13;
        var hipx = sx + 2;
        var hipy = sy - 6;
        dc.setColor(P[10], -1);
        dc.setPenWidth(8);
        for (var sgn = -1; sgn <= 1; sgn += 2) {
            var ftx = bx + sgn * px;
            var fty = by + sgn * py;
            var kx = (hipx + ftx) / 2.0 + 12;
            var ky = (hipy + fty) / 2.0 - 4;
            dc.drawLine(hipx, hipy, kx, ky);
            dc.drawLine(kx, ky, ftx, fty);
        }
        // body, arm, head with helmet
        dc.setColor(P[7], -1);
        dc.setPenWidth(14);
        dc.drawLine(hipx, hipy, cx + 12, gy - 84);
        dc.setColor(P[8], -1);
        dc.setPenWidth(6);
        dc.drawLine(cx + 12, gy - 82, hx + 2, hy - 2);
        dc.fillCircle(cx + 24, gy - 96, 9);
        dc.setColor(P[7], -1);
        dc.fillRectangle(cx + 14, gy - 108, 22, 8);
    }

    // static layer: backdrop, furniture, titles and reasons; the person, the bike, steam, rain on the
    // window, the breathing guide and the Zzz move
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
        var ad = advise(d);
        var act = ad[0];
        var base = ad[1];
        var outdoor = act >= 2 && act <= 5;
        var el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
        var r = Insight.ready(d);
        var pp = [-1, P[7], P[8], P[9], P[10], P[11], P[12], P[13]];

        if (S) {
            // ---- backdrop: sky and road outside, a room inside
            var night = el < -6 && st == 1;
            for (var i = 0; i < 10; i++) {
                dc.setColor(outdoor ? G.mix(night ? 0x0A1030 : P[0], night ? 0x2A3060 : P[1], i / 9.0) : G.mix(P[3], P[1], 0.3 + i / 30.0), -1);
                dc.fillRectangle(0, i * 32, 454, 32);
            }
            dc.setColor(outdoor ? P[2] : G.mix(P[15], P[3], 0.45), -1);
            dc.fillRectangle(0, GY, 454, 454 - GY);
            if (outdoor) {
                dc.setColor(G.mix(P[2], 0xFFFFFF, 0.2), -1);
                for (var x = 0; x < 454; x += 40) {
                    dc.fillRectangle(x, GY + 10, 22, 3);
                }
                dc.setColor(G.mix(P[2], 0, 0.25), -1);
                for (var t = 0; t < 2; t++) {
                    var tx = t == 0 ? 70 : 380;
                    dc.fillRectangle(tx - 4, GY - 60, 8, 60);
                    dc.fillCircle(tx, GY - 76, 26);
                }
            } else {
                // a window: rain outside when that is why you stay in
                dc.setColor(P[3], -1);
                dc.fillRectangle(300, 150, 96, 80);
                dc.setColor(badWeather(d) ? 0x6A7A8A : el > -6 ? 0x9AD4FF : 0x10183A, -1);
                dc.fillRectangle(306, 156, 84, 68);
                dc.setColor(P[3], -1);
                dc.fillRectangle(346, 156, 4, 68);
            }
            if (act == 0) {
                dc.setColor(P[15], -1);
                dc.fillRectangle(110, GY - 56, 170, 40);
                dc.fillRectangle(100, GY - 90, 28, 74);
                dc.fillRectangle(262, GY - 90, 28, 74);
                dc.fillRectangle(118, GY - 16, 10, 16);
                dc.fillRectangle(262, GY - 16, 10, 16);
            } else if (act == 7) {
                dc.setColor(P[15], -1);
                dc.fillRectangle(90, GY - 50, 260, 34);
                dc.fillRectangle(90, GY - 92, 14, 92);
                dc.setColor(0xF4F0E6, -1);
                dc.fillRectangle(108, GY - 66, 60, 18);
                dc.setColor(P[16], -1);
                dc.fillRectangle(150, GY - 70, 196, 26);
                dc.setColor(P[8], -1);
                dc.fillCircle(132, GY - 74, 14);
                dc.setColor(P[12], -1);
                dc.fillRectangle(118, GY - 90, 30, 10);
            } else if (act == 1) {
                dc.setColor(P[16], -1);
                dc.fillRectangle(160, GY - 8, 140, 8);
            }
            // ---- time, today's advice, the reasons
            dc.setColor(P[4], -1);
            F.st(dc, G.timeStr(d), 227, 30, 34, 5, 1, 1.0, 0);
            dc.setColor(P[5], -1);
            F.px(dc, "HEUTE  " + d.dowStr + " " + d.day + ". " + d.monStr, 227, 54, 1, 1, 0);
            dc.setColor(st == 1 ? P[6] : P[4], -1);
            F.px(dc, TITLE[act], 227, 76, 3, 1, 0);
            dc.setColor(P[4], -1);
            F.px(dc, act == 6 ? RIDE[base] : SUB[act], 227, 340, 2, 1, 0);
            dc.setColor(P[5], -1);
            var rec = d.recov < 0 ? "" : d.recov < 60 ? "ERHOLT" : "ERHOLUNG " + Math.round(d.recov / 60.0).toNumber() + " STD";
            F.px(dc, "FORM " + (r[0] >= 0 ? "" + r[0] : "--") + (rec.length() > 0 ? ", " + rec : ""), 227, 364, 2, 1, 0);
            var wx = d.temp > -99 ? d.temp + "°" + (d.rain >= 0 ? " REGEN " + d.rain + "%" : "") : "";
            F.px(dc, "WOCHE " + d.trainDays + "/" + (d.dayGoal > 0 ? d.dayGoal : 4) + (wx.length() > 0 ? ", " + wx : ""), 227, 386, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        var go = G.ease(G.clamp(p / 0.6, 0, 1));
        if (act >= 3 && act <= 6) {
            // ---- riding: the cranks turn, faster for intervals; outside the road rushes past
            var spd = act == 5 ? 0.012 : act == 3 ? 0.005 : 0.008;
            var x = act == 6 ? 200 : Math.round(G.lerp(-120, 220, go)).toNumber();
            bike(dc, P, x, GY, (live ? tt : a.t) * spd, act == 6);
            if (act != 6 && live) {
                dc.setColor(G.mix(P[1], 0xFFFFFF, 0.5), -1);
                var off = (tt * spd * 40).toNumber() % 454;
                for (var i = 0; i < 4; i++) {
                    dc.fillRectangle(((454 - off) + i * 120) % 454, GY - 30 - i * 18, 40, 2);
                }
            }
            if (act == 5) {
                dc.setColor(0x8AC8FF, -1);
                dc.fillRectangle(x + 40, GY - 100 + ((tt / 120) % 3) * 6, 4, 6);
            }
            if (act == 6) {
                // a fan blowing
                dc.setColor(P[14], -1);
                dc.fillRectangle(70, GY - 70, 8, 70);
                dc.drawCircle(74, GY - 84, 22);
                var fa = tt / 40.0;
                for (var i = 0; i < 3; i++) {
                    var an = fa + i * 2 * Math.PI / 3;
                    dc.fillRectangle(Math.round(74 + Math.cos(an) * 12).toNumber() - 3, Math.round(GY - 84 + Math.sin(an) * 12).toNumber() - 3, 6, 6);
                }
            }
        } else if (act == 2) {
            var x = Math.round(G.lerp(-60, 196, go)).toNumber();
            Spr.draw(dc, (a.t / 220) % 2 == 1 ? SprPlan.WALK_B : SprPlan.WALK_A, x, GY - 90, 5, pp, false);
        } else if (act == 0) {
            Spr.draw(dc, SprPlan.SOFA, 160, GY - 96, 5, pp, false);
            // steam from the mug
            dc.setColor(0xFFFFFF, -1);
            var fr = tt / 200;
            for (var i = 0; i < 3; i++) {
                dc.fillRectangle(214 + ((i + fr) % 2) * 4, GY - 70 - i * 10 - (fr % 3) * 2, 4, 4);
            }
        } else if (act == 1) {
            // a breathing guide: six breaths a minute
            var b = 0.5 - 0.5 * Math.cos((tt % 10000) / 10000.0 * 2 * Math.PI);
            dc.setColor(G.mix(P[16], 0xFFFFFF, 0.4), -1);
            dc.setPenWidth(3);
            dc.drawCircle(230, GY - 66, 40 + Math.round(b * 30).toNumber());
            Spr.draw(dc, SprPlan.MED, 196, GY - 68, 5, pp, false);
            dc.setColor(P[4], -1);
            if (live) {
                F.px(dc, tt % 10000 < 5000 ? "EIN" : "AUS", 230, GY - 150, 2, 1, 0);
            }
        } else if (act == 7) {
            dc.setColor(P[4], -1);
            var ph = (tt % 1500) / 1500.0;
            F.px(dc, "Z", 160 + Math.round(ph * 24).toNumber(), GY - 110 - Math.round(ph * 50).toNumber(), ph > 0.5 ? 3 : 2, 1, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var act = advise(d)[0];
        dc.setColor(0x8A8A8A, -1);
        F.st(dc, G.timeStr(d), 227 + o[0], 30 + o[1], 34, 3, 1, 1.0, 0);
        dc.setColor(0x5A5A62, -1);
        F.px(dc, TITLE[act], 227 + o[0], 76 + o[1], 3, 1, 1);
    }
}
