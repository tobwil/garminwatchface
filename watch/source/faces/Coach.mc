import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// COACH — "KI-Coach": a chat with your training coach. Every wrist raise the coach
// types a NEW message built from your data (31 templates: readiness, time of day,
// weekly goals, steps, praise), picked deterministically from d.wakeN.
// Styles: 1 Messenger, 2 Terminal, 3 Glas. Mirrors web/js/faces/coach.js.
class FaceCoach extends Face {
    const NT = 31; // number of templates
    const QS = [
        "Wie fit bin ich?", "Bin ich startklar?",
        "Was steht an?", "Was mach ich heute?",
        "Wie läuft die Woche?", "Schaff ich mein Ziel?",
        "Genug bewegt?", "Wie viele Schritte?",
        "Sag was Nettes!", "Motivier mich!"
    ];
    const WCH = 21; // max characters per bubble line
    const LH = 20; // bubble line pitch
    const T_Q = 120; // question bubble appears
    const T_DOT = 560; // "Coach tippt..." starts
    const T_TXT = 1500; // answer starts typing
    const CPS = 30; // ms per typed character

    hidden var _tapN = 0; // touch & hold: next message
    hidden var _busy = true;
    hidden var _cUnix = -1;
    hidden var _cSeed = -1;
    hidden var _cSt = -1;
    hidden var _cQ = "";
    hidden var _cLines = null;
    hidden var _cMsg = "";
    // derived numbers (shared by ok/txt)
    hidden var _km = 0;
    hidden var _kmLeft = 0;
    hidden var _bikeOk = false;
    hidden var _dl = 0;
    hidden var _rem = 0;
    hidden var _rh = 0;
    hidden var _stl = 0;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return _busy ? 20 : 6;
    }

    function tap(x as Number, y as Number, d as D) as Boolean {
        _tapN++;
        return true;
    }

    hidden function cat(i) {
        return i < 8 ? 0 : (i < 15 ? 1 : (i < 22 ? 2 : (i < 26 ? 3 : 4)));
    }

    hidden function prep(d as D) as Void {
        _bikeOk = d.wkBike >= 0 && d.cfg.bikeGoal > 0;
        _km = d.wkBike >= 0 ? d.wkBike / 1000 : 0;
        _kmLeft = d.cfg.bikeGoal - _km;
        _dl = d.dayGoal - d.trainDays;
        _rem = 7 - d.dayIdx;
        _rh = d.recov >= 0 ? (d.recov + 59) / 60 : 0;
        _stl = d.stepGoal - d.steps;
    }

    // does template i apply to the data?
    hidden function ok(i, d as D) as Boolean {
        var bb = d.bb;
        var sl = d.sleep;
        var rc = d.recov;
        var sr = d.stress;
        var h = d.h;
        switch (i) {
            case 0: return bb >= 65 && sl >= 70;
            case 1: return bb >= 45 && bb < 65;
            case 2: return bb >= 0 && bb < 30;
            case 3: return rc >= 360;
            case 4: return sr >= 60;
            case 5: return sl >= 0 && sl < 55;
            case 6: return rc >= 0 && rc < 180 && bb >= 60;
            case 7: return sr >= 0 && sr < 25 && bb >= 40;
            case 8: return h >= 5 && h < 11 && bb >= 50;
            case 9: return h >= 5 && h < 11;
            case 10: return h >= 11 && h < 17 && bb >= 45;
            case 11: return h >= 17 && h < 21 && bb >= 40 && _bikeOk && _kmLeft > 0;
            case 12: return h >= 17 && h < 21;
            case 13: return h >= 21 || h < 5;
            case 14: return h >= 11 && h < 17 && bb >= 0 && bb < 45;
            case 15: return _dl > 0 && _dl <= _rem;
            case 16: return _dl <= 0;
            case 17: return _bikeOk && _kmLeft <= 0;
            case 18: return _bikeOk && _kmLeft > 0;
            case 19: return _dl > _rem;
            case 20: return d.dayIdx == 0;
            case 21: return d.dayIdx >= 5;
            case 22: return d.stepGoal > 0 && d.steps >= d.stepGoal;
            case 23: return d.steps >= 0 && _stl > 0 && _stl <= 3000;
            case 24: return d.steps >= 0 && _stl > 3000 && h >= 15;
            case 25: return d.steps >= 0 && d.steps < 2000 && h >= 10;
            case 26: return d.trainDays >= 3;
            case 28: return d.glances >= 2;
            case 29: return bb >= 70;
        }
        return true;
    }

    hidden function txt(i, d as D) as String {
        switch (i) {
            case 0: return "Body Battery " + d.bb + " und Schlafscore " + d.sleep + " - heute gehen Intervalle!";
            case 1: return "Body Battery " + d.bb + ". Solide! Tempo geht, nur kein Rekordversuch.";
            case 2: return "Akku bei " + d.bb + ". Heute ist Sofa-Training: Beine hoch, Wasser trinken.";
            case 3: return "Erholung noch " + _rh + " h - lieber locker rollen.";
            case 4: return "Stress " + d.stress + ". Atme 4 Sekunden ein, 6 aus. Ich warte.";
            case 5: return "Schlafscore " + d.sleep + ". Heute kein Ego-Sprint, okay? Und früh ins Bett!";
            case 6: return "Voll erholt und " + d.bb + " im Akku. Du bist startklar!";
            case 7: return "Stress nur " + d.stress + ". Tiefenentspannt - perfekt für lange Grundlage.";
            case 8: return "Guten Morgen! 20 Minuten locker vor der Arbeit? Akku " + d.bb + " sagt ja.";
            case 9: return "Morgen! Erst Kaffee, dann der Plan: Heute zählt jede Treppe.";
            case 10: return "Mittagstief? 10 Minuten zügig gehen schlagen jeden Espresso.";
            case 11: return "Noch " + _kmLeft + " km bis zu deinem Wochenziel. Kleine Feierabendrunde?";
            case 12: return "Feierabend! 15 Minuten locker ausrollen oder die Hüfte dehnen.";
            case 13: return "Es ist " + G.timeStr(d) + ". Bester Trainingsreiz jetzt: Schlaf. Gute Nacht!";
            case 14: return "Akku " + d.bb + " am Nachmittag: heute nur Zone 2, versprochen?";
            case 15: return d.trainDays + " von " + d.dayGoal + " Trainingstagen. Noch " + _dl + " - das packst du!";
            case 16: return "Wochenziel " + d.dayGoal + " Tage: erledigt! Alles ab jetzt ist Bonus.";
            case 17: return _km + " km diese Woche - Radziel geknackt! Respekt.";
            case 18: return _km + " von " + d.cfg.bikeGoal + " km. Zwift heute Abend? Noch " + _kmLeft + " km bis zum Ziel.";
            case 19: return "Ziel " + d.dayGoal + " Tage wird knapp. Mach heute, was geht - ohne Stress!";
            case 20: return "Montag! Frische Woche, " + d.dayGoal + " Trainingstage. Wir starten sanft.";
            case 21: return "Wochenende! Zeit für die lange Runde - mit Kuchenstopp.";
            case 22: return G.num(d.steps) + " Schritte - Ziel erreicht! Der Rest ist Kür.";
            case 23: return "Nur noch " + G.num(_stl) + " Schritte. Einmal um den Block?";
            case 24: return "Noch " + G.num(_stl) + " Schritte offen. Telefonate ab jetzt im Gehen!";
            case 25: return "Erst " + G.num(d.steps) + " Schritte? Steh auf, ich zähle mit.";
            case 26: return d.trainDays + " Trainingstage diese Woche. Ich bin ein bisschen stolz.";
            case 27: return "Konstanz schlägt Intensität. Heute zählt nur: dranbleiben.";
            case 28: return "Schon " + d.glances + "x heute nach mir geschaut. Ich mag dich auch.";
            case 29: return "Akku " + d.bb + "? Heute fährst du allen davon.";
        }
        return "Kette ölen, Reifen prüfen. Ein guter Coach ist auch Mechaniker.";
    }

    // greedy word wrap: first line w1 chars, the rest w chars
    hidden function wrap(s as String, w1, w) as Array {
        var out = [];
        var cs = s.toCharArray();
        var n = cs.size();
        var i = 0;
        var lw = w1;
        while (i < n) {
            if (n - i <= lw) {
                out.add(s.substring(i, n));
                break;
            }
            var cut = -1;
            for (var k = i + lw; k > i; k--) {
                if (cs[k] == ' ') {
                    cut = k;
                    break;
                }
            }
            if (cut < 0) {
                out.add(s.substring(i, i + lw));
                i += lw;
            } else {
                out.add(s.substring(i, cut));
                i = cut + 1;
            }
            lw = w;
        }
        return out;
    }

    // choose question + message for this raise (cached per data snapshot / raise)
    hidden function pick(d as D, seed, st) as Void {
        if (_cUnix == d.unix && _cSeed == seed && _cSt == st && _cLines != null) {
            return;
        }
        _cUnix = d.unix;
        _cSeed = seed;
        _cSt = st;
        prep(d);
        // candidates in a strided order (7 is coprime to 31) so consecutive raises jump between categories
        var cand = [];
        for (var k = 0; k < NT; k++) {
            var i = (k * 7) % NT;
            if (ok(i, d)) {
                cand.add(i);
            }
        }
        var n = cand.size();
        var ix = cand[seed % n];
        _cQ = QS[cat(ix) * 2 + ((seed / n) % 2)];
        _cMsg = txt(ix, d);
        _cLines = st == 2 ? wrap(_cMsg, WCH - 7, WCH) : wrap(_cMsg, WCH, WCH);
    }

    // glass background colour at height y (vertical gradient)
    hidden function glassBg(y) as Number {
        return G.mix(0x2A1550, 0x0B3A4A, G.clamp((y - 40) / 380.0, 0.0, 1.0));
    }

    // three bouncing dots
    hidden function dots(dc as Dc, x, y, ms, col) as Void {
        for (var k = 0; k < 3; k++) {
            var ph = (ms / 1000.0) * 6.0 - k * 0.7;
            var b = Math.sin(ph);
            if (b < 0) {
                b = 0.0;
            }
            dc.setColor(G.mix(G.dim(col, 0.45), col, b), -1);
            dc.fillCircle(x + k * 14, y - b * 6, 4);
        }
    }

    hidden function seedOf(d as D) {
        var s = d.wakeN + _tapN;
        return s < 0 ? 0 : s;
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = st == 2 ? 0x3BFF6A : d.accent;
        var p = a.intro;
        var live = a.live;
        var ms = live ? (a.tap < a.t ? a.tap : a.t) : 99999;
        pick(d, seedOf(d), st);
        var lines = _cLines as Array;
        var nl = lines.size();
        var nch = 0;
        for (var k = 0; k < nl; k++) {
            nch += (lines[k] as String).length();
        }
        var tEnd = T_TXT + nch * CPS;
        _busy = ms < tEnd + 100;
        var typing = ms >= T_DOT && ms < T_TXT;
        // characters typed so far
        var shown = ms < T_TXT ? 0 : (ms - T_TXT) / CPS;
        var qp = G.ease((ms - T_Q) / 320.0);

        // ---- background
        if (st == 3) {
            for (var k = 0; k < 19; k++) {
                dc.setColor(glassBg(k * 24 + 12), -1);
                dc.fillRectangle(0, k * 24, 454, 24);
            }
            // soft bokeh blobs drifting slowly
            var tt = live ? a.t / 1000.0 : 0.0;
            for (var b = 0; b < 3; b++) {
                var bx = 227 + (b - 1) * 120 + Math.sin(tt * 0.5 + b * 2.1) * 18;
                var by = 150 + b * 90 + Math.cos(tt * 0.4 + b) * 14;
                var bc = b == 1 ? 0xD65DB1 : acc;
                var bg = glassBg(by);
                for (var r = 0; r < 8; r++) {
                    dc.setColor(G.mix(bg, bc, 0.06 + r * 0.035), -1);
                    dc.fillCircle(bx, by, 84 - r * 9);
                }
            }
        }

        // ---- time
        var ts = G.timeStr(d);
        if (st == 2) {
            var tw = F.pxW(ts, 6);
            dc.setColor(G.dim(acc, 0.22), -1);
            F.px(dc, ts, 227 - tw / 2 - 2, 38, 6, 0, -4);
            dc.setColor(acc, -1);
            F.px(dc, ts, 227 - tw / 2, 40, 6, 0, 0);
        } else {
            dc.setColor(0xFFFFFF, -1);
            F.st(dc, ts, 227, 66, 48, st == 3 ? 3 : 5, 1, G.ease(p * 1.3), 0);
        }

        // ---- header: pulsing presence dot + "Coach online / tippt..."
        var hp = G.ease(p * 1.5 - 0.2);
        if (hp > 0) {
            var sub = typing ? "tippt..." : "online";
            var head = st == 2 ? "coach.ki" : "COACH";
            var hw = F.pxW(head + " online", 2) + 16;
            var hx = 227 - hw / 2;
            var hy = 102;
            var onC = st == 2 ? acc : 0x34D27B;
            var pulse = (live && !_busy) ? (a.t % 1400) / 1400.0 : 1.0;
            if (pulse < 1) {
                dc.setColor(G.dim(onC, (1 - pulse) * 0.6), -1);
                dc.fillCircle(hx + 5, hy + 7, 5 + pulse * 6);
            }
            dc.setColor(G.dim(onC, hp), -1);
            dc.fillCircle(hx + 5, hy + 7, 5);
            dc.setColor(G.dim(st == 2 ? acc : 0xFFFFFF, hp), -1);
            F.px(dc, head, hx + 16, hy, 2, 0, 0);
            dc.setColor(G.dim(st == 2 ? acc : 0x9AA3AD, hp * 0.8), -1);
            F.px(dc, sub, hx + 16 + F.pxW(head + " ", 2) + 2, hy, 2, 0, 0);
        }

        // ---- conversation
        if (st == 2) {
            // terminal transcript
            var x0 = 70;
            var y = 132 + (206 - (30 + nl * LH + LH)) / 2;
            var dimC = G.dim(acc, 0.55);
            if (qp > 0) {
                dc.setColor(G.dim(acc, 0.55 * qp), -1);
                F.px(dc, ">", x0, y, 2, 0, 0);
                dc.setColor(G.dim(acc, qp), -1);
                F.px(dc, _cQ, x0 + 24, y, 2, 0, 0);
            }
            y += 30;
            if (ms >= T_DOT) {
                dc.setColor(dimC, -1);
                F.px(dc, "coach:", x0, y, 2, 0, 0);
                if (typing) {
                    dots(dc, x0 + 92, y + 7, ms - T_DOT, acc);
                } else {
                    var left = shown;
                    var cx = -1;
                    var cy = -1;
                    for (var k = 0; k < nl; k++) {
                        var lx = k == 0 ? x0 + 84 : x0;
                        var ly = y + k * LH;
                        var s = lines[k] as String;
                        var len = s.length();
                        if (left < len) {
                            s = s.substring(0, left) as String;
                            cx = lx + left * 12;
                            cy = ly;
                        }
                        left -= len;
                        dc.setColor(acc, -1);
                        if (s.length() > 0) {
                            F.px(dc, s, lx, ly, 2, 0, 0);
                        }
                        if (cy >= 0) {
                            break;
                        }
                    }
                    if (cy < 0) {
                        cx = x0;
                        cy = y + nl * LH;
                    }
                    if (_busy || !live || (a.t / 500) % 2 == 0) {
                        dc.setColor(acc, -1);
                        dc.fillRectangle(cx, cy - 1, 10, 16);
                    }
                }
            }
        } else {
            // bubbles
            var bh = nl * LH - 6 + 24; // final coach bubble height
            var top = 132 + (206 - (30 + 12 + bh)) / 2;
            // question (user, right)
            if (qp > 0) {
                var qw = F.pxW(_cQ, 2) + 24;
                var qx = 372 - qw;
                var qy = top + (1 - qp) * 14;
                var qc;
                if (st == 3) {
                    qc = G.mix(glassBg(qy + 15), acc, 0.55 * qp);
                } else {
                    qc = G.dim(acc, qp);
                }
                dc.setColor(qc, -1);
                dc.fillRoundedRectangle(qx, qy, qw, 30, 14);
                dc.fillPolygon([[qx + qw - 16, qy + 20], [qx + qw + 6, qy + 31], [qx + qw - 4, qy + 14]]);
                if (st == 3) {
                    dc.setColor(G.mix(qc, 0xFFFFFF, 0.35), -1);
                    dc.setPenWidth(1);
                    dc.drawRoundedRectangle(qx, qy, qw, 30, 14);
                }
                dc.setColor(G.dim(0xFFFFFF, qp), -1);
                F.px(dc, _cQ, qx + 12, qy + 8, 2, 0, 0);
            }
            // coach (left) with avatar
            if (ms >= T_DOT) {
                var by = top + 42;
                var bw;
                var h;
                if (typing) {
                    bw = 74;
                    h = 30;
                } else {
                    var mw = 0;
                    for (var k = 0; k < nl; k++) {
                        var lw = F.pxW(lines[k] as String, 2);
                        if (lw > mw) {
                            mw = lw;
                        }
                    }
                    bw = mw + 24;
                    // grow with the typed lines
                    var left = shown;
                    var rows = 0;
                    for (var k = 0; k < nl; k++) {
                        if (left > 0 || k == 0) {
                            rows = k + 1;
                        }
                        left -= (lines[k] as String).length();
                    }
                    h = rows * LH - 6 + 24;
                }
                var bx = 76;
                var bc;
                var tc;
                if (st == 3) {
                    bc = G.mix(glassBg(by + h / 2.0), 0xFFFFFF, 0.16);
                    tc = 0xFFFFFF;
                } else {
                    bc = 0x262B33;
                    tc = 0xF2F4F7;
                }
                // avatar
                var ay = by + h - 13;
                dc.setColor(st == 3 ? G.mix(acc, 0xFFFFFF, 0.25) : acc, -1);
                dc.fillCircle(52, ay, 14);
                dc.setColor(0xFFFFFF, -1);
                F.px(dc, "C", 52, ay - 7, 2, 1, 0);
                // bubble + tail
                dc.setColor(bc, -1);
                dc.fillRoundedRectangle(bx, by, bw, h, 14);
                dc.fillPolygon([[bx + 16, by + h - 4], [bx - 6, by + h + 1], [bx + 4, by + h - 16]]);
                if (st == 3) {
                    dc.setColor(G.mix(bc, 0xFFFFFF, 0.3), -1);
                    dc.setPenWidth(1);
                    dc.drawRoundedRectangle(bx, by, bw, h, 14);
                    dc.setColor(G.mix(bc, 0xFFFFFF, 0.55), -1);
                    dc.fillRectangle(bx + 14, by + 1, bw - 28, 1);
                }
                if (typing) {
                    dots(dc, bx + 23, by + 15, ms - T_DOT, st == 3 ? 0xFFFFFF : 0xAAB4C0);
                } else {
                    var left = shown;
                    dc.setColor(tc, -1);
                    for (var k = 0; k < nl && left > 0; k++) {
                        var s = lines[k] as String;
                        var len = s.length();
                        if (left < len) {
                            s = s.substring(0, left) as String;
                        }
                        left -= len;
                        F.px(dc, s, bx + 12, by + 12 + k * LH, 2, 0, 0);
                    }
                }
            }
        }

        // ---- slot chips
        var lb = new [3];
        var ws = new [3];
        var tw = 0;
        for (var k = 0; k < 3; k++) {
            lb[k] = d.slots[k][:lbl] as String;
        }
        for (var pass = 0; pass < 2; pass++) {
            tw = 16;
            for (var k = 0; k < 3; k++) {
                var w1 = F.pxW(lb[k] as String, 2);
                var w2 = F.pxW(d.slots[k][:val] as String, 2);
                var w = (w1 > w2 ? w1 : w2) + 16;
                ws[k] = w;
                tw += w;
            }
            if (tw <= 300) {
                break;
            }
            for (var k = 0; k < 3; k++) {
                if ((lb[k] as String).length() > 6) {
                    lb[k] = (lb[k] as String).substring(0, 6);
                }
            }
        }
        var x = 227 - tw / 2.0;
        for (var k = 0; k < 3; k++) {
            var sp = G.stag(p, k, 0.1, 0.5);
            var w = ws[k];
            if (sp > 0) {
                var y = 352 + (1 - G.ease(sp)) * 10;
                var val = d.slots[k][:val] as String;
                if (st == 2) {
                    dc.setColor(G.dim(acc, 0.35 * sp), -1);
                    dc.setPenWidth(1);
                    dc.drawRectangle(x, y, w, 40);
                    dc.setColor(G.dim(acc, 0.55 * sp), -1);
                    F.px(dc, lb[k] as String, x + w / 2.0, y + 5, 2, 1, 0);
                    dc.setColor(G.dim(acc, sp), -1);
                    F.px(dc, val, x + w / 2.0, y + 21, 2, 1, 0);
                } else {
                    var cc = st == 3 ? G.mix(glassBg(y + 20), 0xFFFFFF, 0.13 * sp) : G.dim(0x1B1F25, sp);
                    dc.setColor(cc, -1);
                    dc.fillRoundedRectangle(x, y, w, 40, 12);
                    if (st == 3) {
                        dc.setColor(G.mix(cc, 0xFFFFFF, 0.25), -1);
                        dc.setPenWidth(1);
                        dc.drawRoundedRectangle(x, y, w, 40, 12);
                    }
                    dc.setColor(G.dim(st == 3 ? 0xC9C3E6 : 0x8A94A0, sp), -1);
                    F.px(dc, lb[k] as String, x + w / 2.0, y + 5, 2, 1, 0);
                    dc.setColor(G.dim(st == 3 ? 0xFFFFFF : d.dcol, sp), -1);
                    F.px(dc, val, x + w / 2.0, y + 21, 2, 1, 0);
                }
            }
            x += w + 8;
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        pick(d, seedOf(d), st);
        var ts = G.timeStr(d);
        var fg = st == 2 ? 0x3BFF6A : d.accent;
        if (st == 2) {
            dc.setColor(G.dim(fg, 0.5), -1);
            F.px(dc, ts, 227 + o[0], 150 + o[1], 6, 1, 1);
        } else {
            dc.setColor(0x8A8A8A, -1);
            F.st(dc, ts, 227 + o[0], 186 + o[1], 64, 2, 1, 1.0, 0);
        }
        var m = _cMsg;
        if (m.length() > 19) {
            m = m.substring(0, 18) + "...";
        }
        dc.setColor(G.dim(fg, 0.55), -1);
        dc.fillCircle(227 + o[0] - F.pxW(m, 2) / 2.0 - 12, 263 + o[1], 4);
        dc.setColor(0x6A6A6A, -1);
        F.px(dc, m, 227 + o[0] + 6, 256 + o[1], 2, 1, 0);
    }
}
