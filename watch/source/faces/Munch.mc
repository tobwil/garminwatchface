import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// MUNCH — "Muncher": an arcade maze homage. The dots are your step goal: the share
// steps/stepGoal of the dots along a fixed path is already eaten and the chomper sits at that
// point; stress spawns ghosts (1 + stress/25), reaching the goal turns them blue and the
// chomper hunts them. Score = steps, HI = best day this week, lives = training days.
// Styles: 1 Arcade, 2 Gameboy, 3 Neon. Mirrors web/js/faces/munch.js.
class FaceMunch extends Face {
    const MF = [0, 1, 2, 1]; // chomp cycle
    const C = 21; // 15 x 13 tiles of 21 px
    const X0 = 70;
    const Y0 = 96;
    // walk through the maze (waypoints col,row): the order in which the dots get eaten
    const WALK_WP = [7, 9, 4, 9, 4, 11, 1, 11, 1, 9, 3, 9, 1, 9, 1, 3, 13, 3, 13, 11, 5, 11, 7, 11, 7, 9, 10, 9, 10, 10, 10, 9,
        13, 9, 13, 1, 10, 1, 10, 2, 10, 1, 7, 1, 7, 2, 7, 1, 4, 1, 4, 2, 4, 1, 1, 1, 1, 2];
    const GSPD = [2600, 2200, 3000, 2400]; // milli-tiles per second
    // wall outlines [x, y, w, h]: frame outer, frame inner, ghost house, 8 blocks
    const BOX = [73, 99, 309, 267, 85, 111, 285, 243, 115, 183, 225, 99,
        115, 141, 36, 15, 178, 141, 36, 15, 241, 141, 36, 15, 304, 141, 36, 15,
        115, 309, 36, 15, 178, 309, 36, 15, 241, 309, 36, 15, 304, 309, 36, 15];

    hidden var _walk as Array<Number>;
    hidden var _cum as Array<Number>;
    hidden var _dots as Array<Number>;
    hidden var _first as Array<Number>;
    hidden var _loops as Array<Array<Number> >;
    hidden var _nd = 0;
    hidden var _chR as Array<ByteArray>;
    hidden var _chU as Array<ByteArray>;
    hidden var _chD as Array<ByteArray>;
    hidden var _pKey = -1;
    hidden var _P as Array<Number> = [] as Array<Number>;

    function initialize() {
        Face.initialize();
        _chR = [SprMunch.CH_R0, SprMunch.CH_R1, SprMunch.CH_R2] as Array<ByteArray>;
        _chU = [SprMunch.CH_U0, SprMunch.CH_U1, SprMunch.CH_U2] as Array<ByteArray>;
        _chD = [SprMunch.CH_D0, SprMunch.CH_D1, SprMunch.CH_D2] as Array<ByteArray>;
        _walk = expand(WALK_WP, false);
        var n = _walk.size();
        _cum = new [n] as Array<Number>;
        _dots = [] as Array<Number>;
        _first = [] as Array<Number>;
        var seen = new [195] as Array<Boolean>;
        for (var i = 0; i < 195; i++) {
            seen[i] = false;
        }
        seen[_walk[0]] = true; // start tile: no dot
        for (var i = 0; i < n; i++) {
            var tc = _walk[i];
            if (!seen[tc]) {
                seen[tc] = true;
                _dots.add(tc);
                _first.add(i);
            }
            _cum[i] = _dots.size();
        }
        _nd = _dots.size();
        _loops = [
            expand([1, 3, 13, 3, 13, 9, 1, 9], true),
            expand([1, 1, 1, 11, 13, 11, 13, 1], true),
            expand([4, 1, 10, 1, 10, 3, 4, 3], true),
            expand([4, 11, 10, 11, 10, 9, 4, 9], true)
        ] as Array<Array<Number> >;
    }

    function fps() as Number {
        return 12;
    }

    hidden function sgn(v) as Number {
        return v > 0 ? 1 : (v < 0 ? -1 : 0);
    }

    // expand waypoints into tile codes (c + r * 15)
    hidden function expand(wp as Array<Number>, closed as Boolean) as Array<Number> {
        var out = [] as Array<Number>;
        var n = wp.size() / 2;
        var c = wp[0];
        var r = wp[1];
        out.add(c + r * 15);
        var last = closed ? n : n - 1;
        for (var i = 1; i <= last; i++) {
            var tc = wp[(i % n) * 2];
            var tr = wp[(i % n) * 2 + 1];
            while (c != tc || r != tr) {
                c += sgn(tc - c);
                r += sgn(tr - r);
                out.add(c + r * 15);
            }
        }
        if (closed) {
            out = out.slice(0, out.size() - 1) as Array<Number>;
        }
        return out;
    }

    hidden function pal(st, acc) as Array<Number> {
        var key = st * 16777216 + acc;
        if (key == _pKey) {
            return _P;
        }
        _pKey = key;
        if (st == 2) {
            var c0 = 0x0F380F;
            var c1 = 0x306230;
            var c2 = 0x8BAC0F;
            var c3 = 0x9BBC0F;
            // bg, wall, wallGlow, door, dot, pellet, txt, lbl, ready, chomp body/shade/eye/teeth/hi, eyeW, pupil, fright, frightFace, flash, flashFace, g0..g3, dim
            _P = [c3, c1, -1, c2, c1, c0, c0, c1, c0, c1, c0, c0, c3, c2, c3, c0, c2, c0, c3, c1, c0, c0, c0, c0, c2] as Array<Number>;
        } else if (st == 3) {
            var cy = 0x00E5FF;
            var mg = 0xFF2BD6;
            _P = [-1, cy, G.dim(cy, 0.3), mg, G.mix(mg, 0xFFFFFF, 0.3), mg, 0xFFFFFF, G.mix(cy, 0xFFFFFF, 0.3), acc,
                acc, G.mix(acc, 0, 0.35), 0x1A1A1A, 0xFFFFFF, G.mix(acc, 0xFFFFFF, 0.6), 0xFFFFFF, 0x1A1AFF, 0x5B4BFF, 0xFFC8F0, 0xE8E8FF, mg,
                mg, cy, 0x7CFF4F, 0xFF9A2B, G.dim(mg, 0.35)] as Array<Number>;
        } else {
            _P = [-1, 0x2D3CF0, -1, 0xFFB8DE, 0xFFC8B0, 0xFFC8B0, 0xFFFFFF, 0xDEDEDE, 0xFFE135,
                acc, G.mix(acc, 0, 0.35), 0x1A1A1A, 0xFFFFFF, G.mix(acc, 0xFFFFFF, 0.6), 0xFFFFFF, 0x2233CC, 0x2B3BFF, 0xFFC8B8, 0xE8E8FF, 0xFF2A2A,
                0xFF2A2A, 0xFFA6E8, 0x2AE8FF, 0xFFAA3A, 0x555555] as Array<Number>;
        }
        return _P;
    }

    // rounded (cut-corner) rectangle outline, drawn up to fraction f of its perimeter
    hidden function boxP(dc as Dc, x, y, w, h, th, f) as Void {
        var a = w - 2 * th;
        var b = h - 2 * th;
        var rem = f * (2 * a + 2 * b);
        if (rem <= 0) {
            return;
        }
        var l = rem < a ? rem : a;
        dc.fillRectangle(x + th, y, l, th);
        rem -= a;
        if (rem <= 0) {
            return;
        }
        l = rem < b ? rem : b;
        dc.fillRectangle(x + w - th, y + th, th, l);
        rem -= b;
        if (rem <= 0) {
            return;
        }
        l = rem < a ? rem : a;
        dc.fillRectangle(x + w - th - l, y + h - th, l, th);
        rem -= a;
        if (rem <= 0) {
            return;
        }
        l = rem < b ? rem : b;
        dc.fillRectangle(x, y + h - th - l, th, l);
    }

    // pixel position (snapped to the 3 px grid) along a tile list at pos (milli-tiles); returns [x, y, dir]
    // dir 0 right, 1 left, 2 up, 3 down
    hidden function at(arr as Array<Number>, posM, loop as Boolean, back as Boolean) as Array<Number> {
        var n = arr.size();
        var i = posM / 1000;
        var f = posM % 1000;
        if (!loop && i >= n - 1) {
            i = n - 1;
            f = 0;
        }
        var ta = arr[i % n];
        var tb = loop ? arr[(i + 1) % n] : arr[i + 1 < n - 1 ? i + 1 : n - 1];
        var ac = ta % 15;
        var ar = ta / 15;
        var bc = tb % 15;
        var br = tb / 15;
        var dx = bc - ac;
        var dy = br - ar;
        if (dx == 0 && dy == 0 && i > 0) {
            var tp = arr[i - 1];
            dx = ac - (tp % 15);
            dy = ar - (tp / 15);
        }
        if (back) {
            dx = -dx;
            dy = -dy;
        }
        var x = ((ac * C * 1000 + (bc - ac) * C * f) / 1000) / 3 * 3;
        var y = ((ar * C * 1000 + (br - ar) * C * f) / 1000) / 3 * 3;
        var dir = dx > 0 ? 0 : (dx < 0 ? 1 : (dy < 0 ? 2 : 3));
        return [X0 + x - 3, Y0 + y - 3, dir] as Array<Number>;
    }

    hidden function pad5(n) as String {
        var v = Math.round(n).toNumber();
        if (v < 0) {
            v = 0;
        }
        var s = "" + v;
        while (s.length() < 5) {
            s = "0" + s;
        }
        return s;
    }

    hidden function chomp(dc as Dc, P as Array<Number>, x, y, dir, fr) as Void {
        var pl = [P[11], P[9], P[10], P[12], P[13]];
        if (dir == 2) {
            Spr.draw(dc, _chU[fr], x, y, 3, pl, false);
        } else if (dir == 3) {
            Spr.draw(dc, _chD[fr], x, y, 3, pl, false);
        } else {
            Spr.draw(dc, _chR[fr], x, y, 3, pl, dir == 1);
        }
    }

    // static layer: maze, dots, time, score; chomper, ghosts, pellets and 1UP move
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
        var t = live ? a.t : 0;
        var goal = d.stepGoal > 0 ? d.stepGoal : 10000;
        var steps = d.steps > 0 ? d.steps : 0;
        var power = steps >= goal;
        var ND = _nd;
        var nEat = power ? ND : (ND.toLong() * steps / goal).toNumber();
        var wE = nEat > 0 ? _first[nEat - 1] : 0;
        var nw = _walk.size();

        if (st == 2 && S) {
            dc.setColor(P[0], -1);
            dc.fillRectangle(0, 0, 454, 454);
        }

        // ---------------- maze walls (draw themselves during the intro)
        for (var i = 0; i < 11 && S; i++) {
            var f = p >= 1 ? 1.0 : G.ease(G.stag(p, i < 3 ? i : 3 + (i - 3) * 0.4, 0.05, 0.25));
            if (f <= 0) {
                continue;
            }
            var x = BOX[i * 4];
            var y = BOX[i * 4 + 1];
            var w = BOX[i * 4 + 2];
            var h = BOX[i * 4 + 3];
            if (st == 3) {
                dc.setColor(P[2], -1);
                boxP(dc, x - 2, y - 2, w + 4, h + 4, 7, f);
            }
            dc.setColor(P[1], -1);
            boxP(dc, x, y, w, h, 3, f);
        }
        if (p >= 0.3 && S) {
            dc.setColor(P[3], -1);
            dc.fillRectangle(212, 183, 30, 3);
        }

        // ---------------- chomper position along the walk
        var cpos = wE * 1000; // milli-tiles
        var back = false;
        if (p < 1) {
            var kI = wE < 6 ? wE : 6;
            cpos = Math.round((wE - kI * (1 - G.ease((p - 0.55) / 0.45))) * 1000).toNumber();
        } else if (live && !power) {
            var D = wE < 8 ? wE : 8;
            if (D > 0) {
                var T = D * 1000 / 3;
                var tm = (t - 1400) % (2 * T);
                back = tm < T;
                cpos = wE * 1000 - 3 * (tm < T ? tm : 2 * T - tm);
            }
        }
        var eatW = cpos / 1000;

        // ---------------- dots + power pellets
        var n0 = power ? ND : _cum[eatW < nw - 1 ? eatW : nw - 1];
        var reveal = p >= 1 ? ND : Math.floor(G.clamp((p - 0.3) / 0.25, 0.0, 1.0) * (ND - n0)).toNumber();
        var blink = live && (t / 250) % 2 == 1;
        for (var j = n0; j < n0 + reveal && j < ND; j++) {
            var tc = _dots[j];
            var x = X0 + (tc % 15) * C;
            var y = Y0 + (tc / 15) * C;
            if (tc == 16 || tc == 28 || tc == 166 || tc == 178) {
                // the power pellets blink over the cached maze
                if (blink || !M) {
                    continue;
                }
                dc.setColor(P[5], -1);
                dc.fillRectangle(x + 6, y + 9, 9, 3);
                dc.fillRectangle(x + 9, y + 6, 3, 9);
                dc.fillRectangle(x + 7, y + 7, 7, 7);
            } else if (S) {
                dc.setColor(P[4], -1);
                dc.fillRectangle(x + 9, y + 9, 3, 3);
            }
        }

        // ---------------- time in the ghost house
        if (p >= 0.2 && S) {
            var ts = G.timeStr(d);
            if (st == 3) {
                dc.setColor(P[24], -1);
                F.px(dc, ts, 225, 196, 7, 1, -4);
            }
            dc.setColor(P[6], -1);
            F.px(dc, ts, 227, 198, 7, 1, 0);
            if (p < 1) {
                if ((a.t / 180) % 2 == 0) {
                    dc.setColor(P[8], -1);
                    F.px(dc, "READY!", 227, 257, 2, 1, 0);
                }
            } else {
                dc.setColor(P[7], -1);
                F.px(dc, power ? "ZIEL! " + d.dowStr + " " + d.day + "." : d.dowStr + " " + d.day + ". " + d.monStr, 227, 257, 2, 1, 0);
            }
        }

        // ---------------- ghosts
        var ng = d.stress < 0 ? 1 : 1 + d.stress / 25;
        if (ng > 4) {
            ng = 4;
        }
        var gfr = live ? (t / 150) % 2 : 0;
        var flash = live && t % 2000 > 1600;
        var cx = 0;
        var cy = 0;
        var cd = 0;
        var gx = 0;
        var gy = 0;
        var gd = 0;
        var pop = -1;
        if (power) {
            // the chomper hunts ghost 0 around the house; caught every 4 s
            var l0 = _loops[0];
            var L0 = l0.size() * 1000;
            var base = (((d.mins * 3) % l0.size()) * 1000 + t * 3500 / 1000) % L0;
            var tc = live ? t % 4000 : 1700;
            var gap = tc < 3400 ? 6000 - tc * 6000 / 3400 : 0;
            var q = at(l0, base, true, false);
            cx = q[0];
            cy = q[1];
            cd = q[2];
            if (tc >= 3400) {
                pop = tc;
            }
            q = at(l0, (base + gap) % L0, true, false);
            gx = q[0];
            gy = q[1];
            gd = q[2];
        } else {
            var q = at(_walk, cpos, false, back);
            cx = q[0];
            cy = q[1];
            cd = q[2];
        }
        if (M && p >= 0.6 && (p >= 0.8 || (a.t / 90) % 2 == 0)) {
            for (var i = 0; i < ng; i++) {
                var g;
                if (power && i == 0) {
                    if (pop >= 0) {
                        continue;
                    }
                    g = [gx, gy, gd];
                } else {
                    var lp = _loops[i];
                    var L = lp.size();
                    var spd = power ? GSPD[i] * 6 / 10 : GSPD[i];
                    g = at(lp, (((d.mins * 3 + i * 7) % L) * 1000 + t * spd / 1000) % (L * 1000), true, false);
                }
                var body = gfr == 0 ? SprMunch.GH_A : SprMunch.GH_B;
                if (power) {
                    Spr.draw(dc, body, g[0], g[1], 3, [-1, flash ? P[18] : P[16]], false);
                    Spr.draw(dc, SprMunch.FRIGHT, g[0], g[1], 3, [-1, flash ? P[19] : P[17]], false);
                } else {
                    Spr.draw(dc, body, g[0], g[1], 3, [-1, P[20 + i]], false);
                    var ey = g[2] == 2 ? SprMunch.EY_U : (g[2] == 3 ? SprMunch.EY_D : SprMunch.EY_L);
                    Spr.draw(dc, ey, g[0], g[1], 3, [P[15], P[14]], g[2] == 0);
                }
            }
        }

        // ---------------- chomper
        if (M && p >= 0.55) {
            var fr = live ? MF[(t / 83) % 4] : 1;
            chomp(dc, P, cx, cy, cd, fr);
            if (pop >= 0) {
                dc.setColor(P[st == 1 ? 22 : 6], -1);
                F.px(dc, "200", cx + 13, cy - 17, 2, 1, 0);
            }
        }

        // ---------------- top: 1UP / score, HI
        var blinkUp = live && p >= 1 && (t / 400) % 2 == 1;
        var hi = steps;
        for (var i = 0; i < 7; i++) {
            if (d.wkSteps[i] > hi) {
                hi = d.wkSteps[i];
            }
        }
        dc.setColor(P[st == 1 ? 20 : 7], -1);
        if (!blinkUp && M) {
            F.px(dc, "1UP", 160, 40, 2, 1, 0);
        }
        if (!S) {
            return;
        }
        F.px(dc, "HI", 294, 40, 2, 1, 0);
        dc.setColor(P[6], -1);
        F.px(dc, pad5(steps * G.ease(p)), 160, 58, 3, 1, 0);
        F.px(dc, pad5(hi), 294, 58, 3, 1, 0);

        // ---------------- lives = training days
        var nl = G.clamp(d.trainDays > d.dayGoal ? d.trainDays : d.dayGoal, 0, 7);
        var x0 = 227 - (nl * 20 - 6) / 2;
        for (var i = 0; i < nl; i++) {
            Spr.draw(dc, SprMunch.LIFE, x0 + i * 20, 378, 2, [P[11], i < d.trainDays ? P[9] : P[24]], false);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var wall = st == 2 ? 0x306230 : G.dim(st == 3 ? 0x00E5FF : 0x2D3CF0, 0.55);
        dc.setColor(wall, -1);
        boxP(dc, 73 + o[0], 99 + o[1], 309, 267, 2, 1);
        dc.setColor(0x8A8A8A, -1);
        F.px(dc, G.timeStr(d), 227 + o[0], 202 + o[1], 6, 1, 1);
        var goal = d.stepGoal > 0 ? d.stepGoal : 10000;
        var steps = d.steps > 0 ? d.steps : 0;
        var nEat = steps >= goal ? _nd : (_nd.toLong() * steps / goal).toNumber();
        var c = at(_walk, (nEat > 0 ? _first[nEat - 1] : 0) * 1000, false, false);
        var col = st == 2 ? 0x306230 : G.dim(d.accent, 0.6);
        var sp = c[2] == 2 ? SprMunch.CH_U1 : (c[2] == 3 ? SprMunch.CH_D1 : SprMunch.CH_R1);
        Spr.draw(dc, sp, c[0] + o[0], c[1] + o[1], 3, [-1, col, col, -1, col], c[2] == 1);
    }
}
