import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// ORAKEL — "KI-Orakel": a glowing oracle orb. Every wrist raise it "thinks" (the swirl
// accelerates, the glow swells), then answers a question about your day — 27 question/answer
// pairs mixing your data with a pinch of chance, picked from d.wakeN. Touch & hold shakes it.
// Styles: 1 Kristall (glass sphere), 2 Nebula (galaxy vortex), 3 8-Bit (pixel crystal ball).
// Mirrors web/js/faces/orakel.js.
class FaceOrakel extends Face {
    const CX = 227;
    const CY = 226;
    const R = 86;
    const NT = 27;
    const T_THINK = 1800; // swirl spin-up and slow-down
    const T_ANS = 1650; // headline fades in
    const T_DET = 1950; // detail fades in
    const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
    // 8-bit grid: 6 px cells, orb = 28 x 28 cells
    const PS = 6;
    const OX = 143;
    const OY = 142;

    // ---- precomputed geometry (small)
    hidden var _kp as Array; // Kristall particles: [radius frac, angle, y offset, speed, colour] x 30
    hidden var _np as Array; // Nebula arm jitter [r, a, size] x 60
    hidden var _nd as Array; // Nebula dust [r, a, s] x 30
    hidden var _sp as Array; // stars [x, y, phase, speed] x 16
    hidden var _runs as ByteArray; // 8-bit orb runs [i0+1, len, j+1, colour]

    hidden var _tapN = 0;
    hidden var _busy = true;
    hidden var _cUnix = -1;
    hidden var _cSeed = -1;
    hidden var _cQ = null;
    hidden var _cH = "";
    hidden var _cD = null;
    // derived numbers
    hidden var _dl = 0;
    hidden var _rem = 0;
    hidden var _rh = 0;
    hidden var _kmLeft = 0;
    hidden var _bikeOk = false;
    hidden var _stl = 0;
    hidden var _kmh = 0;

    function initialize() {
        Face.initialize();
        var s = 4242;
        _kp = new [150];
        for (var k = 0; k < 30; k++) {
            s = G.rnd(s);
            var pr = 0.2 + G.rf(s) * 0.7;
            s = G.rnd(s);
            var pa = G.rf(s) * 6.283;
            s = G.rnd(s);
            var yo = (G.rf(s) * 2 - 1) * (1 - pr) * 0.8;
            s = G.rnd(s);
            var pk = 0.6 + G.rf(s) * 0.8;
            _kp[k * 5] = pr;
            _kp[k * 5 + 1] = pa;
            _kp[k * 5 + 2] = yo;
            _kp[k * 5 + 3] = pk / (0.4 + pr);
            _kp[k * 5 + 4] = k % 3;
        }
        _np = new [180];
        for (var k = 0; k < 60; k++) {
            s = G.rnd(s);
            _np[k * 3] = (G.rf(s) * 2 - 1) * 9;
            s = G.rnd(s);
            _np[k * 3 + 1] = (G.rf(s) * 2 - 1) * 0.22;
            s = G.rnd(s);
            _np[k * 3 + 2] = G.rf(s);
        }
        _nd = new [90];
        for (var k = 0; k < 30; k++) {
            s = G.rnd(s);
            _nd[k * 3] = 20 + G.rf(s) * 105;
            s = G.rnd(s);
            _nd[k * 3 + 1] = G.rf(s) * 6.283;
            s = G.rnd(s);
            _nd[k * 3 + 2] = G.rf(s);
        }
        _sp = new [64];
        var n = 0;
        while (n < 16) {
            s = G.rnd(s);
            var x = 30 + (s % 394);
            s = G.rnd(s);
            var y = 30 + (s % 394);
            s = G.rnd(s);
            var dx = x - 227;
            var dy = y - 227;
            var q = dx * dx + dy * dy;
            var ox = x - CX;
            var oy = y - CY;
            if (q > 200 * 200 || ox * ox + oy * oy < 125 * 125) {
                continue;
            }
            if (y > 26 && y < 132 && x > 96 && x < 358) {
                continue; // keep time + question clean
            }
            if (y > 330 && y < 396 && x > 60 && x < 394) {
                continue; // and the answer
            }
            var near = false;
            for (var k = 0; k < n * 4; k += 4) {
                if ((_sp[k] - x).abs() < 40 && (_sp[k + 1] - y).abs() < 40) {
                    near = true;
                }
            }
            if (near) {
                continue;
            }
            _sp[n * 4] = OX + Math.floor((x - OX) / 6.0).toNumber() * PS;
            _sp[n * 4 + 1] = OY + Math.floor((y - OY) / 6.0).toNumber() * PS;
            _sp[n * 4 + 2] = G.rf(s) * 6.283;
            _sp[n * 4 + 3] = 1.2 + (s % 100) / 50.0;
            n++;
        }
        // pixel sphere, light from the top left. 0 outline, 1..4 body light->dark, 5 rim light, 6 glow
        var rr = [];
        for (var j = -1; j < 29; j++) {
            var cur = -1;
            var i0 = 0;
            for (var i = -1; i <= 29; i++) {
                var c = -1;
                if (i < 29) {
                    var ddx = i - 13.5;
                    var ddy = j - 13.5;
                    var qq = ddx * ddx + ddy * ddy;
                    if (qq < 158) {
                        var sh = Math.sqrt(qq) / 12.6 * 0.55 + (ddx + ddy) / 25 * 0.45;
                        c = sh < 0.05 ? 1 : (sh < 0.3 ? 2 : (sh < 0.55 ? 3 : 4));
                        if (qq > 112 && ddx + ddy > 9) {
                            c = 5;
                        }
                    } else if (qq < 196) {
                        c = 0;
                    } else if (qq < 240) {
                        c = 6;
                    }
                }
                if (c != cur) {
                    if (cur >= 0) {
                        rr.add(i0 + 1);
                        rr.add(i - i0);
                        rr.add(j + 1);
                        rr.add(cur);
                    }
                    cur = c;
                    i0 = i;
                }
            }
        }
        _runs = new [rr.size()]b;
        for (var k = 0; k < rr.size(); k++) {
            _runs[k] = rr[k];
        }
    }

    function fps() as Number {
        return _busy ? 20 : 15;
    }

    function tap(x as Number, y as Number, d as D) as Boolean {
        _tapN++;
        return true;
    }

    hidden function prep(d as D) as Void {
        _dl = d.dayGoal - d.trainDays;
        _rem = 7 - d.dayIdx;
        _rh = d.recov >= 0 ? (d.recov + 59) / 60 : 0;
        _bikeOk = d.wkBike >= 0 && d.cfg.bikeGoal > 0;
        _kmLeft = d.cfg.bikeGoal - (d.wkBike >= 0 ? d.wkBike / 1000 : 0);
        _stl = d.stepGoal - d.steps;
        _kmh = d.wind >= 0 ? Math.round(d.wind * 3.6).toNumber() : -1;
    }

    hidden function ok(i, d as D) as Boolean {
        var bb = d.bb;
        var h = d.h;
        switch (i) {
            case 0: return bb >= 55 && d.recov < 360;
            case 1: return d.recov >= 360;
            case 2: return bb >= 0 && bb < 35 && d.recov < 360;
            case 3: return _dl > 0 && _dl <= _rem;
            case 4: return _dl <= 0;
            case 5: return _dl > _rem;
            case 6: return h >= 20 || h < 5;
            case 7: return h >= 5 && h < 20 && bb >= 0 && bb < 40;
            case 8: return h >= 5 && h < 14 && bb >= 40;
            case 9: return _bikeOk && _kmLeft > 0;
            case 10: return d.sleep >= 0 && d.sleep < 60;
            case 11: return d.sleep >= 75;
            case 12: return d.stress >= 50;
            case 13: return d.stress >= 0 && d.stress < 50;
            case 14: return d.steps >= 0 && _stl > 0;
            case 15: return d.stepGoal > 0 && d.steps >= d.stepGoal;
            case 16: return d.rain >= 0;
            case 17: return d.sunset >= 0;
            case 24: return _kmh >= 0;
            case 26: return d.glances >= 2;
        }
        return true;
    }

    hidden function ques(i) as String {
        if (i < 3) {
            return "Soll ich heute trainieren?";
        }
        if (i < 6) {
            return "Schaffe ich mein Wochenziel?";
        }
        if (i < 9) {
            return "Kaffee oder Schlaf?";
        }
        switch (i) {
            case 9: return "Wie weit fahre ich heute?";
            case 10: case 11: return "Werde ich heute müde?";
            case 12: case 13: return "Bin ich gestresst?";
            case 14: case 15: return "Schaffe ich meine Schritte?";
            case 16: return "Regnet es heute?";
            case 17: return "Wann wird es dunkel?";
            case 18: return "Was ist der Sinn des Lebens?";
            case 19: return "Was bringt der Tag?";
            case 20: return "Gewinne ich den Zwift-Sprint?";
            case 21: return "Brauche ich ein neues Rad?";
            case 22: return "Wird heute ein guter Tag?";
            case 23: return "Pause oder Pizza?";
            case 24: return "Wird es windig?";
            case 25: return "Wer ist der Schnellste?";
        }
        return "Schaue ich zu oft auf die Uhr?";
    }

    // suggested ride length (km) for "Wie weit fahre ich heute?"
    hidden function rideKm() {
        return G.clamp(((_kmLeft / _rem + 4) / 5) * 5, 20, 90);
    }

    hidden function rideRest() as String {
        var r = _kmLeft - rideKm();
        return r > 0 ? "Dann fehlen noch " + r + " km zum Wochenziel." : "Damit ist dein Wochenziel voll!";
    }

    hidden function head(i, d as D) as String {
        switch (i) {
            case 0: case 3: case 10: case 14: case 22: return "JA.";
            case 1: case 2: return "NEIN.";
            case 4: return "LÄNGST.";
            case 5: return "KNAPP.";
            case 6: return "SCHLAF.";
            case 7: case 8: return "KAFFEE.";
            case 9: return rideKm() + " KM";
            case 11: return "NÖ.";
            case 12: return "LEIDER.";
            case 13: return "ZEN.";
            case 15: return "SCHON!";
            case 16: return d.rain >= 50 ? "JA." : "NEIN.";
            case 17: return G.hm(d.sunset);
            case 18: return "42.";
            case 19: return "BERGE.";
            case 20: return "JEIN.";
            case 21: return "N+1";
            case 23: return "BEIDES.";
            case 24: return _kmh >= 20 ? "JA." : "NEIN.";
            case 25: return "DU.";
        }
        return "JA.";
    }

    hidden function det(i, d as D) as String {
        switch (i) {
            case 0: return "Deine Body Battery sagt " + d.bb + ".";
            case 1: return "Erholung: noch " + _rh + " h. Geduld.";
            case 2: return "Akku " + d.bb + ". Die Kugel sieht ein Sofa.";
            case 3: return "Mit " + d.trainDays + " von " + d.dayGoal + " Tagen? Die Sterne sagen: " + DAYS[(d.dayIdx + 1) % 7] + "!";
            case 4: return d.trainDays + " von " + d.dayGoal + " Tagen. Die Kugel verneigt sich.";
            case 5: return "Noch " + _dl + " Tage, " + _rem + " bleiben. Wunder gibt es.";
            case 6: return "Es ist " + G.timeStr(d) + ". Die Kugel gähnt schon.";
            case 7: return "Akku " + d.bb + ". Einen Doppelten, bitte.";
            case 8: return "Und danach raus aufs Rad!";
            case 9: return rideRest();
            case 10: return "Schlafscore " + d.sleep + ". Ich sehe Gähnen.";
            case 11: return "Schlafscore " + d.sleep + ". Du strahlst ja richtig.";
            case 12: return "Stress " + d.stress + ". Atme 4 ein, 6 aus. Ich atme mit.";
            case 13: return "Stress " + d.stress + ". Ruhig wie ein Bergsee.";
            case 14: return "Noch " + G.num(_stl) + " Schritte. Die Kugel glaubt an dich.";
            case 15: return G.num(d.steps) + " Schritte. Die Prophezeiung ist erfüllt.";
            case 16: return "Regenrisiko " + d.rain + "%. " + (d.rain >= 50 ? "Zwift wartet." : "Ab aufs Rad!");
            case 17: return d.mins < d.sunset ? "Bis dahin passt noch eine Runde." : "Schon passiert. Licht ans Rad!";
            case 18: return "Die Frage war nur zu schwierig.";
            case 19: return "Frag mich nach dem nächsten Anstieg.";
            case 20: return "Nur wenn du zuerst antrittst.";
            case 21: return "Die richtige Zahl Räder ist immer n+1.";
            case 22: return "Die Sterne stehen auf Rückenwind.";
            case 23: return "Die Kugel urteilt nicht.";
            case 24: return _kmh + " km/h. " + (_kmh >= 20 ? "Windschatten suchen!" : "Kaum Gegenwind.");
            case 25: return "Zumindest an diesem Handgelenk.";
        }
        return d.glances + " Blicke heute. Die Kugel fühlt sich geehrt.";
    }

    // greedy word wrap, w chars per line
    hidden function wrap(s as String, w) as Array {
        var out = [];
        var cs = s.toCharArray();
        var n = cs.size();
        var i = 0;
        while (i < n) {
            if (n - i <= w) {
                out.add(s.substring(i, n));
                break;
            }
            var cut = -1;
            for (var k = i + w; k > i; k--) {
                if (cs[k] == ' ') {
                    cut = k;
                    break;
                }
            }
            if (cut < 0) {
                out.add(s.substring(i, i + w));
                i += w;
            } else {
                out.add(s.substring(i, cut));
                i = cut + 1;
            }
        }
        return out;
    }

    hidden function pick(d as D, seed) as Void {
        if (_cUnix == d.unix && _cSeed == seed && _cQ != null) {
            return;
        }
        _cUnix = d.unix;
        _cSeed = seed;
        prep(d);
        var cand = [];
        for (var k = 0; k < NT; k++) {
            var i = (k * 7) % NT;
            if (ok(i, d)) {
                cand.add(i);
            }
        }
        var ix = cand[seed % cand.size()];
        _cQ = wrap(ques(ix), 26);
        _cH = head(ix, d);
        _cD = wrap(det(ix, d), 26);
    }

    hidden function seedOf(d as D) {
        var s = d.wakeN + _tapN;
        return s < 0 ? 0 : s;
    }

    // twinkling background stars
    hidden function stars(dc as Dc, t, pix as Boolean, col) as Void {
        var sp = _sp;
        var sc = [G.dim(col, 0.25), G.dim(col, 0.5), G.dim(col, 0.75), col];
        for (var k = 0; k < 64; k += 4) {
            var b = 0.5 + 0.5 * Math.sin(t * 0.001 * sp[k + 3] + sp[k + 2]);
            var x = sp[k];
            var y = sp[k + 1];
            dc.setColor(sc[(b * 3.99).toNumber()], -1);
            if (pix) {
                dc.fillRectangle(x, y, PS, PS);
                if (b > 0.8) {
                    dc.setColor(sc[1], -1);
                    dc.fillRectangle(x - PS, y, PS, PS);
                    dc.fillRectangle(x + PS, y, PS, PS);
                    dc.fillRectangle(x, y - PS, PS, PS);
                    dc.fillRectangle(x, y + PS, PS, PS);
                }
            } else {
                dc.fillCircle(x + 3, y + 3, 1 + b * 1.2);
                if (b > 0.85) {
                    dc.fillRectangle(x + 3 - 5, y + 3, 11, 1);
                    dc.fillRectangle(x + 3, y + 3 - 5, 1, 11);
                }
            }
        }
    }

    // centred stroke headline with a dark halo
    hidden function headline(dc as Dc, txt as String, x, y, h, col, halo) as Void {
        dc.setColor(halo, -1);
        F.st(dc, txt, x, y, h, 9, 1, 1.0, 0);
        dc.setColor(col, -1);
        F.st(dc, txt, x, y, h, 3, 1, 1.0, 0);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var live = a.live;
        var ms = live ? (a.tap < a.t ? a.tap : a.t) : 99999;
        var t = live ? a.t : 0;
        _busy = ms < T_DET + 700;
        pick(d, seedOf(d));
        var cQ = _cQ as Array;
        var cD = _cD as Array;
        // thinking: swirl phase (spin-up and down), glow bump, answer reveal
        var tp = G.clamp(ms / (T_THINK * 1.0), 0.0, 1.0);
        var ph = ms * 0.0006 + 10 * G.easeInOut(tp);
        var think = Math.sin(Math.PI * tp);
        var rev = G.clamp((ms - T_ANS) / 500.0, 0.0, 1.0);
        var rd = G.clamp((ms - T_DET) / 500.0, 0.0, 1.0);
        // touch & hold: shake
        var cx = CX;
        if (live && a.tap < 700) {
            cx = CX + Math.sin(a.tap * 0.06) * 12 * (1 - a.tap / 700.0);
        }

        var pale = G.mix(acc, 0xFFFFFF, 0.6);
        stars(dc, t, st == 3, st == 3 ? 0xCDB8FF : 0xDCD4FF);

        // ---- time (always legible)
        var ts = G.timeStr(d);
        if (st == 3) {
            dc.setColor(0x3A2470, -1);
            F.px(dc, ts, 230, 37, 5, 1, 0);
            dc.setColor(0xF2EAFF, -1);
            F.px(dc, ts, 227, 34, 5, 1, 0);
        } else {
            dc.setColor(0xF2EEFF, -1);
            F.st(dc, ts, 227, 56, 40, 3, 1, G.ease(p * 1.4), 0);
        }

        // ---- question
        var qa = G.clamp((ms - 80) / 400.0, 0.0, 1.0);
        if (qa > 0) {
            dc.setColor(G.dim(G.mix(acc, 0xFFFFFF, 0.45), 0.85 * qa), -1);
            var q0 = cQ.size() > 1 ? 88 : 96;
            for (var k = 0; k < cQ.size(); k++) {
                F.px(dc, cQ[k] as String, 227, q0 + k * 18, 2, 1, 0);
            }
        }

        // ---- orb
        if (st == 1) {
            // halo
            for (var g = 0; g < 4; g++) {
                dc.setColor(G.dim(acc, (0.05 + g * 0.045) * (1 + 0.9 * think)), -1);
                dc.fillCircle(cx, CY, R + 18 - g * 4);
            }
            var body = 0x150B33;
            dc.setColor(body, -1);
            dc.fillCircle(cx, CY, R);
            // nebula clouds
            var nc = [0x7B3FE4, 0x2F5BFF, 0xD04FC0];
            for (var b = 0; b < 3; b++) {
                var an = ph * 0.35 + b * 2.094;
                var bx = cx + Math.cos(an) * 26;
                var by = CY + Math.sin(an) * 16;
                for (var l = 0; l < 4; l++) {
                    dc.setColor(G.mix(body, nc[b], (0.2 + l * 0.13) * (0.85 + 0.4 * think) * (1 - 0.2 * rev)), -1);
                    dc.fillCircle(bx, by, 46 - l * 10);
                }
            }
            // swirling particles (depth: front ones bigger and brighter)
            // palette: 3 colours x 4 depth levels (computed once per frame, not per particle)
            var pc = [0xC9B2FF, 0x8FB4FF, 0xFF9EE8];
            var pp = new [12];
            for (var c = 0; c < 12; c++) {
                pp[c] = G.mix(body, pc[c / 4], (0.35 + 0.7 * ((c % 4) + 0.5) / 4) * (1 - 0.4 * rev));
            }
            var kp = _kp;
            for (var k = 0; k < 150; k += 5) {
                var an = kp[k + 1] + ph * kp[k + 3];
                var pr = kp[k] * (R - 6);
                var dep = Math.sin(an);
                var x = cx + Math.cos(an) * pr;
                var y = CY + kp[k + 2] * R + dep * pr * 0.38;
                dc.setColor(pp[kp[k + 4] * 4 + ((dep + 1) * 1.99).toNumber()], -1);
                dc.fillCircle(x, y, 1.4 + (dep + 1) * 0.9 + think * 0.8);
            }
            if (rev > 0) {
                headline(dc, _cH, cx, CY + 2, 30, G.mix(body, 0xFFFFFF, rev), G.mix(body, 0x0C0620, rev));
            }
            // glass: rim, specular highlights, caustic
            dc.setPenWidth(2);
            dc.setColor(G.mix(G.dim(acc, 0.7), 0xFFFFFF, 0.25), -1);
            dc.drawCircle(cx, CY, R);
            dc.setColor(G.mix(body, 0xFFFFFF, 0.28), -1);
            dc.fillEllipse(cx - 38, CY - 46, 20, 11);
            dc.setColor(G.mix(body, 0xFFFFFF, 0.85), -1);
            dc.fillEllipse(cx - 42, CY - 50, 8, 4);
            dc.setColor(G.mix(body, pale, 0.45), -1);
            G.arcC(dc, cx, CY, R - 7, 140, 205);
            // stand: cup + foot
            var sy = CY + R;
            dc.setColor(0x4A3318, -1);
            dc.fillPolygon([[cx - 60, sy - 22], [cx + 60, sy - 22], [cx + 40, sy + 4], [cx - 40, sy + 4]]);
            dc.setColor(0x5E4220, -1);
            dc.fillPolygon([[cx - 60, sy - 22], [cx - 20, sy - 22], [cx - 14, sy + 4], [cx - 40, sy + 4]]);
            dc.setColor(0xD2A462, -1);
            dc.fillRectangle(cx - 60, sy - 23, 120, 2);
            dc.setColor(0x6E4D26, -1);
            dc.fillRectangle(cx - 52, sy - 10, 104, 1);
            dc.setColor(0x2E1F0F, -1);
            dc.fillRectangle(cx - 28, sy + 4, 56, 8);
            dc.setColor(0x3C2A16, -1);
            dc.fillRoundedRectangle(cx - 70, sy + 11, 140, 14, 6);
            dc.setColor(0xA57A44, -1);
            dc.fillRectangle(cx - 64, sy + 11, 128, 2);
        } else if (st == 2) {
            // galaxy vortex: two spiral arms + dust; the core collapses into an eye when answering
            var ac = [0xFFE6FF, 0xFF8FD8, acc, 0x4FC3FF];
            // faint gas clouds
            var gc = [acc, 0xFF6FC8, 0x3F8FFF];
            for (var b = 0; b < 3; b++) {
                var an = ph * 0.3 + b * 2.094;
                var bx = cx + Math.cos(an) * 64;
                var by = CY + Math.sin(an) * 40;
                for (var l = 0; l < 4; l++) {
                    dc.setColor(G.dim(gc[b], 0.035 + l * 0.03 + think * 0.04), -1);
                    dc.fillCircle(bx, by, 58 - l * 13);
                }
            }
            // palette: 8 colour bins along the arm x 4 depth levels (once per frame)
            var pp = new [32];
            var mul = 0.75 + 0.25 * think;
            for (var b = 0; b < 8; b++) {
                var ci = (b + 0.5) / 8 * 2.99;
                var cf = Math.floor(ci).toNumber();
                var c = G.mix(ac[cf], ac[cf + 1], ci - cf);
                for (var l = 0; l < 4; l++) {
                    pp[b * 4 + l] = G.dim(c, (0.3 + 0.7 * l / 3.0) * mul);
                }
            }
            var trail = think > 0.05 ? 1 : 0;
            var ph2 = ph * 1.2;
            var szm = 1 + think * 0.3;
            var np = _np;
            for (var k = 0; k < 48; k++) {
                var u = (k / 2) / 23.0;
                var r = 14 + u * 108 + np[k * 3];
                r += (70 - 0.55 * r) * rev; // the vortex opens into an eye
                var an = (k % 2) * 3.1416 + u * 4.2 + np[k * 3 + 1] + ph2;
                var b4 = (u * 7.99).toNumber() * 4;
                var sz = (4.0 - u * 2.4 + np[k * 3 + 2]) * szm;
                if (trail == 0) {
                    var sn = Math.sin(an);
                    dc.setColor(pp[b4 + ((sn + 1) * 1.99).toNumber()], -1);
                    dc.fillCircle(cx + Math.cos(an) * r, CY + sn * r * 0.62, sz);
                    continue;
                }
                // comet trail against the spin direction while thinking
                for (var q = trail; q >= 0; q--) {
                    var aq = an - q * 0.2;
                    var sn = Math.sin(aq);
                    var l = ((sn + 1) * 1.99).toNumber() - q;
                    if (l < 0) {
                        l = 0;
                    }
                    dc.setColor(pp[b4 + l], -1);
                    dc.fillCircle(cx + Math.cos(aq) * r, CY + sn * r * 0.62, sz * (1 - q * 0.25));
                }
            }
            var dc0 = G.dim(0xB8A8FF, 0.4);
            var dc1 = G.dim(0xB8A8FF, 0.75);
            var nd = _nd;
            for (var k = 0; k < 60; k += 3) {
                var r = nd[k];
                r += (72 - 0.55 * r) * rev;
                var an = nd[k + 1] + ph * (40 / r);
                dc.setColor(nd[k + 2] > 0.5 ? dc1 : dc0, -1);
                dc.fillCircle(cx + Math.cos(an) * r, CY + Math.sin(an) * r * 0.62, 1.2);
            }
            // core
            var cs = (1 - rev) * (0.7 + 0.5 * think);
            if (cs > 0.02) {
                for (var l = 0; l < 5; l++) {
                    dc.setColor(G.mix(G.dim(acc, 0.35), 0xFFFFFF, l / 4.0), -1);
                    dc.fillCircle(cx, CY, (34 - l * 6) * cs);
                }
            }
            if (rev > 0) {
                dc.setPenWidth(1);
                dc.setColor(G.dim(acc, 0.55 * rev), -1);
                dc.drawEllipse(cx, CY, 74, 45);
                var hv = G.clamp((rev - 0.4) / 0.6, 0.0, 1.0);
                if (hv > 0) {
                    dc.setColor(G.dim(0xFFFFFF, hv), -1);
                    F.st(dc, _cH, cx, CY + 1, 30, 3, 1, 1.0, 0);
                }
            }
        } else {
            // 8-bit crystal ball
            var ox = Math.round(cx - CX).toNumber() + OX;
            var glow = G.dim(acc, 0.22 + 0.4 * think);
            var pal = [0x1B0F3A, G.mix(0x8A63FF, 0xD8C8FF, think * 0.5), 0x6A3FE0, 0x4B28B0, 0x321A7C, 0x9F7BFF, glow];
            var runs = _runs;
            var nr = runs.size();
            for (var k = 0; k < nr; k += 4) {
                dc.setColor(pal[runs[k + 3]], -1);
                dc.fillRectangle(ox + (runs[k] - 1) * PS, OY + (runs[k + 2] - 1) * PS, runs[k + 1] * PS, PS);
            }
            // mist sparks swirling inside (snapped to the grid)
            var kp = _kp;
            for (var k = 0; k < 75; k += 5) {
                var an = kp[k + 1] + ph * kp[k + 3];
                var pr = kp[k] * 10.5;
                var dep = Math.sin(an);
                var ci = Math.floor(13.5 + Math.cos(an) * pr).toNumber();
                var cj = Math.floor(13.5 + kp[k + 2] * 11 + dep * pr * 0.4).toNumber();
                dc.setColor(rev > 0.5 ? (dep > 0 ? 0x8F6BF0 : 0x5C36C8) : (dep > 0 ? 0xE2D4FF : 0xA585FF), -1);
                dc.fillRectangle(ox + ci * PS, OY + cj * PS, PS, PS);
            }
            // highlight
            dc.setColor(0xF4EEFF, -1);
            dc.fillRectangle(ox + 7 * PS, OY + 5 * PS, 2 * PS, PS);
            dc.fillRectangle(ox + 5 * PS, OY + 6 * PS, 2 * PS, PS);
            dc.fillRectangle(ox + 5 * PS, OY + 7 * PS, PS, PS);
            dc.fillRectangle(ox + 10 * PS, OY + 4 * PS, PS, PS);
            if (rev > 0) {
                var sc = F.pxW(_cH, 4) <= 150 ? 4 : 3;
                var hy = CY - (7 * sc / 2);
                dc.setColor(0x1B0F3A, -1);
                F.px(dc, _cH, cx + sc, hy + sc, sc, 1, 0);
                dc.setColor(G.mix(0x4B28B0, 0xFFFFFF, rev), -1);
                F.px(dc, _cH, cx, hy, sc, 1, 0);
            }
            // pixel stand (gold)
            var sg = [0xFFD27A, 0xD89A3A, 0x8A5A1C, 0x4E300C];
            var stp = [24, 6, 16, 1, 25, 5, 18, 2, 26, 7, 14, 3, 27, 9, 10, 2, 28, 6, 16, 1, 29, 5, 18, 2, 30, 5, 18, 3];
            for (var k = 0; k < 28; k += 4) {
                dc.setColor(sg[stp[k + 3]], -1);
                dc.fillRectangle(ox + stp[k + 1] * PS, OY + stp[k] * PS, stp[k + 2] * PS, PS);
            }
            dc.setColor(sg[0], -1);
            dc.fillRectangle(ox + 7 * PS, OY + 25 * PS, PS * 3, PS);
            dc.fillRectangle(ox + 6 * PS, OY + 29 * PS, PS * 2, PS);
        }

        // ---- detail answer below the orb
        if (rd > 0) {
            dc.setColor(G.mix(0x000000, st == 3 ? 0xE9DCFF : 0xECE6FF, rd), -1);
            var y0 = cD.size() > 1 ? 348 : 356;
            for (var k = 0; k < cD.size() && k < 2; k++) {
                F.px(dc, cD[k] as String, 227, y0 + k * 19, 2, 1, 0);
            }
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        pick(d, seedOf(d));
        var ts = G.timeStr(d);
        var x = CX + o[0];
        var y = CY + o[1];
        if (st == 3) {
            dc.setColor(G.dim(d.accent, 0.45), -1);
            var runs = _runs;
            var nr = runs.size();
            for (var k = 0; k < nr; k += 4) {
                if (runs[k + 3] == 0) {
                    dc.fillRectangle(x - 84 + (runs[k] - 1) * PS, y - 84 + (runs[k + 2] - 1) * PS, runs[k + 1] * PS, PS);
                }
            }
            dc.setColor(0x8A8A8A, -1);
            F.px(dc, ts, x, y - 22, 4, 1, 0);
            dc.setColor(G.dim(d.accent, 0.5), -1);
            F.px(dc, _cH, x, y + 18, 2, 1, 0);
        } else {
            dc.setPenWidth(2);
            dc.setColor(G.dim(d.accent, 0.5), -1);
            dc.drawCircle(x, y, R);
            dc.setColor(G.dim(d.accent, 0.3), -1);
            dc.fillEllipse(x - 40, y - 48, 7, 4);
            dc.setColor(0x8A8A8A, -1);
            F.st(dc, ts, x, y - 6, 38, 2, 1, 1.0, 0);
            dc.setColor(G.dim(d.accent, 0.5), -1);
            F.px(dc, _cH, x, y + 28, 2, 1, 0);
        }
    }
}
