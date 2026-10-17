import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// NEURO — "Neuronetz": your body data as the inputs of a tiny neural network. Six input
// neurons (BB, STR, SCHL, PULS, SCHR, ERH) feed two hidden layers (fixed, seeded weights,
// a real forward pass with tanh) and a softmax output: RUHE / LOCKER / VOLLGAS = today's
// form forecast. Signal pulses flow layer by layer; each wrist raise replays the forward pass.
// Styles: 1 Synapse (glow), 2 Schaltplan (blueprint), 3 Bio (organic). Mirrors web/js/faces/neuro.js.
class FaceNeuro extends Face {
    const IN_L = ["BB", "STR", "SCHL", "PULS", "SCHR", "ERH"];
    const OUT_L = ["VOLLGAS", "LOCKER", "RUHE"];
    // input polarity (+ = makes you fresher), hidden unit signs
    const P = [1.0, -1.0, 1.0, -1.0, 0.4, -1.0];
    const S1 = [1, -1, 1, 1, -1];
    const S2 = [1, -1, 1, -1];
    // output layer: VOLLGAS reads the "fresh" units, RUHE the "tired" ones, LOCKER sits in between
    const W3B = [1.6, -0.9, 0.8, -0.5, -0.9, -0.9, -0.3, -0.3, -0.9, 1.6, -0.5, 0.8];
    const B3 = [0.0, 1.0, 0.7];
    const LX = [100, 176, 252, 326];
    const LN = [6, 5, 4, 3];
    const NS = [0.0, 0.33, 0.6, 0.82];
    const CY = 1800; // ambient forward-pass cycle (ms)
    const Q = [
        ["KOM-Jagd frei!", "Beine sagen: Go!", "Heute Intervalle", "BB # - Attacke!", "Zwift-Rennen? Ja!"],
        ["Grundlage, Zone 2", "Kaffeefahrt passt", "Locker rollen", "Plaudertempo, ja?", "Kein Heldentum"],
        ["Sofa-Modus an", "Netz sagt: Pause", "Tee statt Tempo", "Erholung: #h", "Regeneration!"]
    ];

    // weights: deterministic from a fixed seed (identical on the web)
    hidden var _w1 as Array<Float>;
    hidden var _b1 as Array<Float>;
    hidden var _w2 as Array<Float>;
    hidden var _b2 as Array<Float>;
    hidden var _w3 as Array<Float>;
    hidden var _sd = 970;
    // network state
    hidden var _a0 = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0] as Array<Float>;
    hidden var _u = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0] as Array<Float>;
    hidden var _kn = [true, true, true, true, true, true] as Array<Boolean>;
    hidden var _h1 = [0.0, 0.0, 0.0, 0.0, 0.0] as Array<Float>;
    hidden var _h2 = [0.0, 0.0, 0.0, 0.0] as Array<Float>;
    hidden var _pr = [0.0, 0.0, 0.0] as Array<Float>;
    hidden var _px = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0] as Array<Float>;
    hidden var _py = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0] as Array<Float>;
    hidden var _qx = 0.0;
    hidden var _qy = 0.0;

    function initialize() {
        Face.initialize();
        _w1 = new [30] as Array<Float>;
        _b1 = new [5] as Array<Float>;
        _w2 = new [20] as Array<Float>;
        _b2 = new [4] as Array<Float>;
        _w3 = new [12] as Array<Float>;
        _sd = 970;
        for (var j = 0; j < 5; j++) {
            for (var i = 0; i < 6; i++) {
                _w1[j * 6 + i] = P[i] * S1[j] * (0.35 + 0.9 * r());
            }
            _b1[j] = (r() - 0.5) * 0.4;
        }
        for (var k = 0; k < 4; k++) {
            for (var j = 0; j < 5; j++) {
                _w2[k * 5 + j] = S2[k] * S1[j] * (0.4 + 0.8 * r());
            }
            _b2[k] = k < 2 ? -0.5 : (r() - 0.5) * 0.4;
        }
        for (var q = 0; q < 12; q++) {
            _w3[q] = W3B[q] + (r() - 0.5) * 0.3;
        }
    }

    hidden function r() as Float {
        _sd = G.rnd(_sd);
        return G.rf(_sd);
    }

    function fps() as Number {
        return 15;
    }

    hidden function tanh(x) as Float {
        return (1.0 - 2.0 / (Math.pow(2.718281828, 2.0 * x) + 1.0)).toFloat();
    }

    hidden function ny(L, i) {
        return L == 3 ? 202 + 50 * i : 172 + 16 * (6 - LN[L]) + 32 * i;
    }

    hidden function setIn(i, v, known as Boolean) as Void {
        _kn[i] = known;
        _a0[i] = known ? G.clamp(v.toFloat(), 0.0, 1.0) : 0.5;
        _u[i] = _a0[i] * 2.0 - 1.0;
    }

    // forward pass; returns the winning output index
    hidden function forward(d as D) as Number {
        setIn(0, d.bb / 100.0, d.bb >= 0);
        setIn(1, d.stress / 100.0, d.stress >= 0);
        setIn(2, d.sleep / 100.0, d.sleep >= 0);
        setIn(3, d.rhr > 0 ? (d.hr - d.rhr) / 40.0 : (d.hr - 45) / 60.0, d.hr > 0);
        setIn(4, d.stepGoal > 0 ? d.steps.toFloat() / d.stepGoal : 0.0, d.steps >= 0);
        setIn(5, d.recov / 2160.0, d.recov >= 0);
        for (var j = 0; j < 5; j++) {
            var s = 0.0;
            for (var i = 0; i < 6; i++) {
                s += _w1[j * 6 + i] * _u[i];
            }
            _h1[j] = tanh(0.35 * s + _b1[j]);
        }
        for (var k = 0; k < 4; k++) {
            var s = 0.0;
            for (var j = 0; j < 5; j++) {
                s += _w2[k * 5 + j] * _h1[j];
            }
            _h2[k] = tanh(0.4 * s + _b2[k]);
        }
        var mx = -99.0;
        var win = 0;
        for (var o = 0; o < 3; o++) {
            var s = B3[o];
            for (var k = 0; k < 4; k++) {
                s += _w3[o * 4 + k] * _h2[k];
            }
            _pr[o] = s * 1.4;
            if (_pr[o] > mx) {
                mx = _pr[o];
                win = o;
            }
        }
        var tot = 0.0;
        for (var o = 0; o < 3; o++) {
            _pr[o] = Math.pow(2.718281828, _pr[o] - mx).toFloat();
            tot += _pr[o];
        }
        for (var o = 0; o < 3; o++) {
            _pr[o] = _pr[o] / tot;
        }
        return win;
    }

    // edge of layer L from node i to node j: signed weight and the source activation
    hidden function edgeW(L, i, j) as Float {
        return L == 0 ? _w1[j * 6 + i] : (L == 1 ? _w2[j * 5 + i] : _w3[j * 4 + i]);
    }

    hidden function edgeA(L, i) as Float {
        return L == 0 ? _u[i] : (L == 1 ? _h1[i] : _h2[i]);
    }

    // node activation for display 0..1
    hidden function nodeV(L, i) as Float {
        return L == 0 ? _a0[i] : (L == 1 ? (_h1[i] + 1) / 2.0 : (L == 2 ? (_h2[i] + 1) / 2.0 : _pr[i]));
    }

    // path of an edge into _px/_py; returns point count (style-dependent wiring)
    hidden function path(st, L, i, j, e, tt) as Number {
        var x1 = LX[L];
        var y1 = ny(L, i);
        var x2 = LX[L + 1];
        var y2 = ny(L + 1, j);
        _px[0] = x1;
        _py[0] = y1;
        if (st == 2) {
            // schematic: horizontal - vertical - horizontal, one vertical bus per target neuron
            var mx = x1 + 16 + (j * (x2 - x1 - 32)).toFloat() / (LN[L + 1] - 1);
            _px[1] = mx;
            _py[1] = y1;
            _px[2] = mx;
            _py[2] = y2;
            _px[3] = x2;
            _py[3] = y2;
            return 4;
        }
        if (st == 3) {
            // wavy dendrite, gently breathing
            var dx = x2 - x1;
            var dy = y2 - y1;
            var len = Math.sqrt(dx * dx + dy * dy);
            var amp = 5 * Math.cos(tt / 900.0 + e * 0.7);
            for (var k = 1; k < 5; k++) {
                var f = k / 5.0;
                var o = amp * Math.sin(f * 6.283);
                _px[k] = x1 + dx * f - (dy / len) * o;
                _py[k] = y1 + dy * f + (dx / len) * o;
            }
            _px[5] = x2;
            _py[5] = y2;
            return 6;
        }
        _px[1] = x2;
        _py[1] = y2;
        return 2;
    }

    // draw the first `prog` (0..1) of the current path
    hidden function drawPath(dc as Dc, n, prog) as Void {
        var segs = (n - 1) * prog;
        for (var k = 0; k < n - 1; k++) {
            if (segs <= k) {
                break;
            }
            var f = G.clamp(segs - k, 0.0, 1.0);
            dc.drawLine(_px[k], _py[k], _px[k] + (_px[k + 1] - _px[k]) * f, _py[k] + (_py[k + 1] - _py[k]) * f);
        }
    }

    // point at fraction f along the current path (length weighted) -> _qx, _qy
    hidden function along(n, f) as Void {
        var tot = 0.0;
        for (var k = 0; k < n - 1; k++) {
            tot += (_px[k + 1] - _px[k]).abs() + (_py[k + 1] - _py[k]).abs();
        }
        var rem = f * tot;
        for (var k = 0; k < n - 1; k++) {
            var sl = (_px[k + 1] - _px[k]).abs() + (_py[k + 1] - _py[k]).abs();
            if (rem <= sl || k == n - 2) {
                var g = sl > 0 ? G.clamp(rem / sl, 0.0, 1.0) : 0.0;
                _qx = _px[k] + (_px[k + 1] - _px[k]) * g;
                _qy = _py[k] + (_py[k + 1] - _py[k]) * g;
                return;
            }
            rem -= sl;
        }
        _qx = _px[n - 1];
        _qy = _py[n - 1];
    }

    // style palette: [bg, pos, neg, label, time, node-dark, win]
    hidden function pal(st, acc) as Array<Number> {
        if (st == 2) {
            return [0x0A1D3A, 0xD8ECFF, 0xFFA940, 0x7FA6D6, 0xE6F2FF, 0x0A1D3A, acc] as Array<Number>;
        }
        if (st == 3) {
            return [0x100705, 0xFFB347, 0xFF5C8A, 0xB08A74, 0xFFF0DC, 0x2A120C, 0xFFD166] as Array<Number>;
        }
        return [0x05030C, 0x2FE6FF, acc, 0x8A84B4, 0xFFFFFF, 0x0D0A1C, acc] as Array<Number>;
    }

    hidden function quip(d as D, win) as String {
        var s = Q[win][d.wakeN % 5] as String;
        var at = s.find("#");
        if (at != null) {
            var v = win == 0 ? d.bb : Math.round(d.recov / 60.0).toNumber();
            if (v < 0) {
                return Q[win][0] as String;
            }
            s = s.substring(0, at) + v + s.substring(at + 1, s.length());
        }
        return s;
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var C = pal(st, d.accent);
        var p = a.intro;
        var live = a.live;
        var tt = live ? a.t : 900; // frozen pulse phase when static
        var win = forward(d);

        // ---- background
        dc.setColor(C[0], -1);
        dc.fillCircle(227, 227, 227);
        if (st == 2) {
            for (var g = 11; g < 454; g += 24) {
                dc.setColor((g - 11) % 96 == 48 ? 0x173A68 : 0x10294D, -1);
                dc.drawLine(g, 0, g, 454);
                dc.drawLine(0, g, 454, g);
            }
        } else if (st == 3) {
            // drifting soft cells
            for (var c = 0; c < 4; c++) {
                var x = 227 + 150 * Math.sin(c * 2.1 + tt / 9000.0);
                var y = 227 + 150 * Math.cos(c * 1.7 + tt / 11000.0);
                for (var k = 0; k < 3; k++) {
                    dc.setColor(G.mix(C[0], 0x22100A, (k + 1) / 3.0), -1);
                    dc.fillCircle(x, y, (46 + c * 9) * (1 - k * 0.22));
                }
            }
        } else {
            for (var k = 0; k < 5; k++) {
                dc.setColor(G.mix(C[0], 0x150E30, (k + 1) / 5.0), -1);
                dc.fillCircle(227, 252, 190 - 34 * k);
            }
        }

        // ---- intro schedule: layer reveal (nodes) and edge growth
        var nP = [G.clamp(p / 0.14, 0.0, 1.0), G.clamp((p - 0.33) / 0.14, 0.0, 1.0), G.clamp((p - 0.6) / 0.14, 0.0, 1.0), G.clamp((p - 0.82) / 0.18, 0.0, 1.0)];
        var eP = [G.easeInOut((p - 0.1) / 0.25), G.easeInOut((p - 0.4) / 0.22), G.easeInOut((p - 0.66) / 0.2)];
        var ph = ((tt % CY).toFloat() / CY) * 3.6 - 0.3; // layer phase of the travelling wave

        // ---- edges
        var e = 0;
        for (var L = 0; L < 3; L++) {
            var ep = eP[L];
            for (var j = 0; j < LN[L + 1]; j++) {
                for (var i = 0; i < LN[L]; i++) {
                    if (ep > 0) {
                        var w = edgeW(L, i, j);
                        var s = G.clamp((w * edgeA(L, i)).abs() / (L == 2 ? 1.6 : 1.0), 0.0, 1.0);
                        var col = w >= 0 ? C[1] : C[2];
                        var n = path(st, L, i, j, e, tt);
                        dc.setColor(G.mix(C[0], col, 0.16 + 0.7 * s), -1);
                        dc.setPenWidth(s > 0.62 ? 2 : 1);
                        drawPath(dc, n, ep);
                        // signal pulse on strong edges
                        if (p >= 1 && s > 0.22) {
                            var f = ph - L + (((e * 37) % 11) - 5) * 0.03;
                            if (f >= 0 && f <= 1) {
                                along(n, f);
                                if (st == 2) {
                                    dc.setColor(G.mix(col, 0xFFFFFF, 0.6), -1);
                                    dc.fillRectangle(_qx - 2, _qy - 2, 5, 5);
                                } else {
                                    dc.setColor(G.mix(C[0], col, 0.45), -1);
                                    dc.fillCircle(_qx, _qy, 5);
                                    dc.setColor(G.mix(col, 0xFFFFFF, 0.6), -1);
                                    dc.fillCircle(_qx, _qy, s > 0.6 ? 3 : 2);
                                }
                            }
                        }
                    }
                    e++;
                }
            }
        }

        // ---- nodes
        for (var L = 0; L < 4; L++) {
            if (nP[L] <= 0) {
                continue;
            }
            // arrival flash when the wave reaches this layer
            var fl = ph - L;
            fl = (p >= 1 && fl >= 0 && fl < 0.35) ? 1 - fl / 0.35 : 0.0;
            for (var i = 0; i < LN[L]; i++) {
                var np = G.clamp((p - NS[L] - i * 0.02) / 0.12, 0.0, 1.0);
                if (np <= 0) {
                    continue;
                }
                var x = LX[L];
                var y = ny(L, i);
                var v = nodeV(L, i);
                var isWin = L == 3 && i == win;
                var pos = L == 0 ? P[i] > 0 : (L == 1 ? _h1[i] >= 0 : (L == 2 ? _h2[i] >= 0 : true));
                var col = L == 3 ? (isWin ? C[6] : C[3]) : (pos ? C[1] : C[2]);
                var known = L > 0 || _kn[i];
                var br = G.clamp((0.3 + 0.7 * v) * np + fl * 0.3, 0.0, 1.0);
                var r = L == 0 ? 5 + 4 * v : (L == 3 ? 6 + 5 * v : 6);
                r = r * G.spring(np);
                if (st == 2) {
                    var h = Math.round(r).toNumber() + 1;
                    dc.setColor(C[0], -1);
                    dc.fillRectangle(x - h, y - h, 2 * h + 1, 2 * h + 1);
                    dc.setColor(G.mix(C[0], col, 0.5 + 0.5 * br), -1);
                    dc.setPenWidth(2);
                    dc.drawRectangle(x - h, y - h, 2 * h + 1, 2 * h + 1);
                    if (known) {
                        var ih = Math.round((h - 2) * v).toNumber();
                        if (ih > 0) {
                            dc.fillRectangle(x - ih, y - ih, 2 * ih + 1, 2 * ih + 1);
                        }
                    }
                } else {
                    // glow halo, body, bright core
                    dc.setColor(G.mix(C[0], col, (st == 3 ? 0.22 : 0.28) * br), -1);
                    dc.fillCircle(x, y, r + (st == 3 ? 6 : 5));
                    if (!known) {
                        dc.setColor(G.mix(C[0], col, 0.6), -1);
                        dc.setPenWidth(2);
                        dc.drawCircle(x, y, r);
                    } else {
                        dc.setColor(G.mix(C[5], col, br), -1);
                        dc.fillCircle(x, y, r);
                        if (br > 0.55) {
                            dc.setColor(G.mix(col, 0xFFFFFF, st == 3 ? 0.45 : 0.7), -1);
                            dc.fillCircle(x, y, r * 0.4);
                        }
                    }
                }
                if (isWin && np >= 1) {
                    dc.setColor(C[6], -1);
                    dc.setPenWidth(2);
                    if (st == 2) {
                        dc.drawRectangle(x - r - 5, y - r - 5, 2 * r + 11, 2 * r + 11);
                    } else {
                        dc.drawCircle(x, y, r + 6 + (live ? 1.5 * Math.sin(a.t / 250.0) : 0));
                    }
                }
            }
        }

        // ---- labels
        if (nP[0] > 0) {
            for (var i = 0; i < 6; i++) {
                dc.setColor(G.mix(C[0], C[3], nP[0] * (_kn[i] ? 1 : 0.5)), -1);
                F.px(dc, IN_L[i], 82, ny(0, i) - 7, 2, 2, 0);
            }
        }
        if (nP[3] > 0) {
            for (var o = 0; o < 3; o++) {
                var y = ny(3, o);
                var c = o == win ? C[6] : C[3];
                dc.setColor(G.mix(C[0], c, nP[3]), -1);
                F.px(dc, OUT_L[o], 346, y - 15, 2, 0, 0);
                dc.setColor(G.mix(C[0], o == win ? C[4] : C[3], nP[3] * (o == win ? 1 : 0.7)), -1);
                F.px(dc, Math.round(_pr[o] * 100 * nP[3]).toNumber() + "%", 346, y + 2, 2, 0, 0);
            }
        }

        // ---- time + date
        var tp = G.easeInOut(p * 1.35);
        var ts = G.timeStr(d);
        if (st == 1) {
            dc.setColor(G.dim(d.accent, 0.35), -1);
            F.st(dc, ts, 227, 98, 74, 13, 1, tp, 0);
        } else if (st == 3) {
            dc.setColor(0x4A2414, -1);
            F.st(dc, ts, 227, 98, 74, 14, 1, tp, 0);
        }
        dc.setColor(C[4], -1);
        F.st(dc, ts, 227, 98, 74, st == 2 ? 4 : (st == 3 ? 7 : 5), 1, tp, 0);
        if (st == 2) {
            // dimension line under the time
            dc.setColor(C[3], -1);
            dc.setPenWidth(1);
            var hw = F.stW(ts, 74) / 2 + 6;
            dc.drawLine(227 - hw, 142, 227 + hw, 142);
            dc.drawLine(227 - hw, 137, 227 - hw, 147);
            dc.drawLine(227 + hw, 137, 227 + hw, 147);
        }
        dc.setColor(G.mix(C[0], C[3], G.clamp(p * 2, 0.0, 1.0)), -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 36, 2, 1, 0);

        // ---- forecast
        if (nP[3] > 0) {
            dc.setColor(G.mix(C[0], C[3], nP[3]), -1);
            F.px(dc, "FORM-PROGNOSE", 227, 352, 2, 1, 0);
            dc.setColor(G.mix(C[0], C[6], nP[3]), -1);
            F.st(dc, OUT_L[win] + " " + Math.round(_pr[win] * 100 * nP[3]).toNumber() + "%", 227, 386, 26, 4, 1, 1.0, 0);
            // caption: inference time while the pass runs, then a witty verdict
            var cap = "Inferenz " + (9 + ((d.wakeN * 7) % 8)) + " ms";
            var n = cap.length();
            if (!live || a.t > 2600) {
                cap = quip(d, win);
                n = live ? G.clamp((a.t - 2600) / 45, 0, cap.length()) : cap.length();
            }
            dc.setColor(G.mix(C[0], C[3], nP[3] * 0.9), -1);
            var w = F.pxW(cap, 2);
            F.px(dc, cap.substring(0, n), 227 - w / 2, 408, 2, 0, 0);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var st = d.cfg.style;
        var C = pal(st, d.accent);
        var win = forward(d);
        // strongest path: back-trace from the winning output
        var k = 0;
        var j = 0;
        var i = 0;
        var best = -1.0;
        for (var q = 0; q < 4; q++) {
            var s = (_w3[win * 4 + q] * _h2[q]).abs();
            if (s > best) {
                best = s;
                k = q;
            }
        }
        best = -1.0;
        for (var q = 0; q < 5; q++) {
            var s = (_w2[k * 5 + q] * _h1[q]).abs();
            if (s > best) {
                best = s;
                j = q;
            }
        }
        best = -1.0;
        for (var q = 0; q < 6; q++) {
            var s = (_w1[j * 6 + q] * _u[q]).abs();
            if (s > best) {
                best = s;
                i = q;
            }
        }
        var ox = o[0];
        var oy = o[1];
        dc.setColor(G.dim(C[6], 0.55), -1);
        dc.setPenWidth(2);
        dc.drawLine(LX[0] + ox, ny(0, i) + oy, LX[1] + ox, ny(1, j) + oy);
        dc.drawLine(LX[1] + ox, ny(1, j) + oy, LX[2] + ox, ny(2, k) + oy);
        dc.drawLine(LX[2] + ox, ny(2, k) + oy, LX[3] + ox, ny(3, win) + oy);
        dc.setColor(0x505050, -1);
        for (var L = 0; L < 4; L++) {
            for (var q = 0; q < LN[L]; q++) {
                if (st == 2) {
                    dc.fillRectangle(LX[L] - 2 + ox, ny(L, q) - 2 + oy, 5, 5);
                } else {
                    dc.fillCircle(LX[L] + ox, ny(L, q) + oy, 2);
                }
            }
        }
        dc.setColor(G.dim(C[6], 0.7), -1);
        F.px(dc, OUT_L[win], 346 + ox, ny(3, win) - 7 + oy, 2, 0, 0);
        dc.setColor(0x9A9A9A, -1);
        F.st(dc, G.timeStr(d), 227 + ox, 98 + oy, 74, 3, 1, 1.0, 0);
    }
}
