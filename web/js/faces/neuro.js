// NEURO — "Neuronetz": your body data as the inputs of a tiny neural network. Six input
// neurons (BB, STR, SCHL, PULS, SCHR, ERH) feed two hidden layers (fixed, seeded weights,
// a real forward pass with tanh) and a softmax output: RUHE / LOCKER / VOLLGAS = today's
// form forecast. Signal pulses flow layer by layer; each wrist raise replays the forward pass.
// Styles: 1 Synapse (glow), 2 Schaltplan (blueprint), 3 Bio (organic). Mirrors watch/source/faces/Neuro.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const IN_L = ["BB", "STR", "SCHL", "PULS", "SCHR", "ERH"];
const OUT_L = ["VOLLGAS", "LOCKER", "RUHE"];
// input polarity (+ = makes you fresher), hidden unit signs
const P = [1, -1, 1, -1, 0.4, -1];
const S1 = [1, -1, 1, 1, -1];
const S2 = [1, -1, 1, -1];
// output layer: VOLLGAS reads the "fresh" units, RUHE the "tired" ones, LOCKER sits in between
const W3B = [1.6, -0.9, 0.8, -0.5, -0.9, -0.9, -0.3, -0.3, -0.9, 1.6, -0.5, 0.8];
const B3 = [0, 1.0, 0.7];
const LX = [100, 176, 252, 326];
const LN = [6, 5, 4, 3];
const CY = 1800; // ambient forward-pass cycle (ms)
const Q = [
  ["KOM-Jagd frei!", "Beine sagen: Go!", "Heute Intervalle", "BB # - Attacke!", "Zwift-Rennen? Ja!"],
  ["Grundlage, Zone 2", "Kaffeefahrt passt", "Locker rollen", "Plaudertempo, ja?", "Kein Heldentum"],
  ["Sofa-Modus an", "Netz sagt: Pause", "Tee statt Tempo", "Erholung: #h", "Regeneration!"],
];

// weights: deterministic from a fixed seed (identical on the watch)
const W1 = [], B1 = [], W2 = [], B2 = [], W3 = [];
{
  let sd = 970;
  const r = () => { sd = G.rnd(sd); return G.rf(sd); };
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < 6; i++) W1.push(P[i] * S1[j] * (0.35 + 0.9 * r()));
    B1.push((r() - 0.5) * 0.4);
  }
  for (let k = 0; k < 4; k++) {
    for (let j = 0; j < 5; j++) W2.push(S2[k] * S1[j] * (0.4 + 0.8 * r()));
    B2.push(k < 2 ? -0.5 : (r() - 0.5) * 0.4);
  }
  for (let q = 0; q < 12; q++) W3.push(W3B[q] + (r() - 0.5) * 0.3);
}

// network state (refreshed every frame, cheap)
const A0 = [0, 0, 0, 0, 0, 0]; // input display value 0..1
const U = [0, 0, 0, 0, 0, 0]; // centred input -1..1
const KN = [true, true, true, true, true, true];
const H1 = [0, 0, 0, 0, 0];
const H2 = [0, 0, 0, 0];
const PR = [0, 0, 0];
const PX = [0, 0, 0, 0, 0, 0];
const PY = [0, 0, 0, 0, 0, 0];

function tanh(x) { return 1 - 2 / (Math.pow(2.718281828, 2 * x) + 1); }

function ny(L, i) { return L === 3 ? 202 + 50 * i : 172 + 16 * (6 - LN[L]) + 32 * i; }

function setIn(i, v, known) {
  KN[i] = known;
  A0[i] = known ? G.clamp(v, 0, 1) : 0.5;
  U[i] = A0[i] * 2 - 1;
}

// forward pass; returns the winning output index
function forward(d) {
  setIn(0, d.bb / 100, d.bb >= 0);
  setIn(1, d.stress / 100, d.stress >= 0);
  setIn(2, d.sleep / 100, d.sleep >= 0);
  setIn(3, d.rhr > 0 ? (d.hr - d.rhr) / 40 : (d.hr - 45) / 60, d.hr > 0);
  setIn(4, d.stepGoal > 0 ? d.steps / d.stepGoal : 0, d.steps >= 0);
  setIn(5, d.recov / 2160, d.recov >= 0);
  for (let j = 0; j < 5; j++) {
    let s = 0;
    for (let i = 0; i < 6; i++) s += W1[j * 6 + i] * U[i];
    H1[j] = tanh(0.35 * s + B1[j]);
  }
  for (let k = 0; k < 4; k++) {
    let s = 0;
    for (let j = 0; j < 5; j++) s += W2[k * 5 + j] * H1[j];
    H2[k] = tanh(0.4 * s + B2[k]);
  }
  let mx = -99, win = 0;
  for (let o = 0; o < 3; o++) {
    let s = B3[o];
    for (let k = 0; k < 4; k++) s += W3[o * 4 + k] * H2[k];
    PR[o] = s * 1.4;
    if (PR[o] > mx) { mx = PR[o]; win = o; }
  }
  let tot = 0;
  for (let o = 0; o < 3; o++) { PR[o] = Math.pow(2.718281828, PR[o] - mx); tot += PR[o]; }
  for (let o = 0; o < 3; o++) PR[o] = PR[o] / tot;
  return win;
}

// edge e of layer L from node i to node j: signed weight and its |w·activation| strength
function edgeW(L, i, j) { return L === 0 ? W1[j * 6 + i] : L === 1 ? W2[j * 5 + i] : W3[j * 4 + i]; }
function edgeA(L, i) { return L === 0 ? U[i] : L === 1 ? H1[i] : H2[i]; }

// node activation for display 0..1
function nodeV(L, i) { return L === 0 ? A0[i] : L === 1 ? (H1[i] + 1) / 2 : L === 2 ? (H2[i] + 1) / 2 : PR[i]; }

// path of an edge into PX/PY; returns point count (style-dependent wiring)
function path(st, L, i, j, e, tt) {
  const x1 = LX[L] , y1 = ny(L, i), x2 = LX[L + 1], y2 = ny(L + 1, j);
  PX[0] = x1; PY[0] = y1;
  if (st === 2) {
    // schematic: horizontal - vertical - horizontal, one vertical bus per target neuron
    const mx = x1 + 16 + (j * (x2 - x1 - 32)) / (LN[L + 1] - 1);
    PX[1] = mx; PY[1] = y1; PX[2] = mx; PY[2] = y2; PX[3] = x2; PY[3] = y2;
    return 4;
  }
  if (st === 3) {
    // wavy dendrite, gently breathing
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const amp = 5 * Math.cos(tt / 900 + e * 0.7);
    for (let k = 1; k < 5; k++) {
      const f = k / 5;
      const o = amp * Math.sin(f * 6.283);
      PX[k] = x1 + dx * f - (dy / len) * o;
      PY[k] = y1 + dy * f + (dx / len) * o;
    }
    PX[5] = x2; PY[5] = y2;
    return 6;
  }
  PX[1] = x2; PY[1] = y2;
  return 2;
}

// draw the first `prog` (0..1) of the current path
function drawPath(dc, n, prog) {
  const segs = (n - 1) * prog;
  for (let k = 0; k < n - 1; k++) {
    if (segs <= k) break;
    const f = G.clamp(segs - k, 0, 1);
    dc.drawLine(PX[k], PY[k], PX[k] + (PX[k + 1] - PX[k]) * f, PY[k] + (PY[k + 1] - PY[k]) * f);
  }
}

// point at fraction f along the current path (length weighted) -> [x, y]
function along(n, f) {
  let tot = 0;
  for (let k = 0; k < n - 1; k++) tot += Math.abs(PX[k + 1] - PX[k]) + Math.abs(PY[k + 1] - PY[k]);
  let rem = f * tot;
  for (let k = 0; k < n - 1; k++) {
    const sl = Math.abs(PX[k + 1] - PX[k]) + Math.abs(PY[k + 1] - PY[k]);
    if (rem <= sl || k === n - 2) {
      const g = sl > 0 ? G.clamp(rem / sl, 0, 1) : 0;
      return [PX[k] + (PX[k + 1] - PX[k]) * g, PY[k] + (PY[k + 1] - PY[k]) * g];
    }
    rem -= sl;
  }
  return [PX[n - 1], PY[n - 1]];
}

// style palette: [bg, pos, neg, label, time, node-dark, win]
function pal(st, acc) {
  if (st === 2) return [0x0a1d3a, 0xd8ecff, 0xffa940, 0x7fa6d6, 0xe6f2ff, 0x0a1d3a, acc];
  if (st === 3) return [0x100705, 0xffb347, 0xff5c8a, 0xb08a74, 0xfff0dc, 0x2a120c, 0xffd166];
  return [0x05030c, 0x2fe6ff, acc, 0x8a84b4, 0xffffff, 0x0d0a1c, acc];
}

function quip(d, win) {
  let s = Q[win][d.wakeN % 5];
  if (s.indexOf("#") >= 0) {
    const v = win === 0 ? d.bb : Math.round(d.recov / 60);
    if (v < 0) return Q[win][0];
    s = s.replace("#", "" + v);
  }
  return s;
}

export default {
  get fps() { return 15; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const C = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 900; // frozen pulse phase when static
    const win = forward(d);

    // ---- background
    dc.setColor(C[0], -1);
    dc.fillCircle(227, 227, 227);
    if (st === 2) {
      for (let g = 11; g < 454; g += 24) {
        dc.setColor((g - 11) % 96 === 48 ? 0x173a68 : 0x10294d, -1);
        dc.drawLine(g, 0, g, 454);
        dc.drawLine(0, g, 454, g);
      }
    } else if (st === 3) {
      // drifting soft cells
      for (let c = 0; c < 4; c++) {
        const x = 227 + 150 * Math.sin(c * 2.1 + tt / 9000);
        const y = 227 + 150 * Math.cos(c * 1.7 + tt / 11000);
        for (let k = 0; k < 3; k++) {
          dc.setColor(G.mix(C[0], 0x22100a, (k + 1) / 3), -1);
          dc.fillCircle(x, y, (46 + c * 9) * (1 - k * 0.22));
        }
      }
    } else {
      for (let k = 0; k < 5; k++) {
        dc.setColor(G.mix(C[0], 0x150e30, (k + 1) / 5), -1);
        dc.fillCircle(227, 252, 190 - 34 * k);
      }
    }

    // ---- intro schedule: layer reveal (nodes) and edge growth
    const NS = [0, 0.33, 0.6, 0.82];
    const nP = [G.clamp(p / 0.14, 0, 1), G.clamp((p - 0.33) / 0.14, 0, 1), G.clamp((p - 0.6) / 0.14, 0, 1), G.clamp((p - 0.82) / 0.18, 0, 1)];
    const eP = [G.easeInOut((p - 0.1) / 0.25), G.easeInOut((p - 0.4) / 0.22), G.easeInOut((p - 0.66) / 0.2)];
    const ph = ((tt % CY) / CY) * 3.6 - 0.3; // layer phase of the travelling wave

    // ---- edges
    let e = 0;
    for (let L = 0; L < 3; L++) {
      const ep = eP[L];
      for (let j = 0; j < LN[L + 1]; j++) {
        for (let i = 0; i < LN[L]; i++) {
          if (ep > 0) {
            const w = edgeW(L, i, j);
            const s = G.clamp(Math.abs(w * edgeA(L, i)) / (L === 2 ? 1.6 : 1.0), 0, 1);
            const col = w >= 0 ? C[1] : C[2];
            const n = path(st, L, i, j, e, tt);
            dc.setColor(G.mix(C[0], col, 0.16 + 0.7 * s), -1);
            dc.setPenWidth(s > 0.62 ? 2 : 1);
            drawPath(dc, n, ep);
            // signal pulse on strong edges
            if (p >= 1 && s > 0.22) {
              const f = ph - L + (((e * 37) % 11) - 5) * 0.03;
              if (f >= 0 && f <= 1) {
                const q = along(n, f);
                if (st === 2) {
                  dc.setColor(G.mix(col, 0xffffff, 0.6), -1);
                  dc.fillRectangle(q[0] - 2, q[1] - 2, 5, 5);
                } else {
                  dc.setColor(G.mix(C[0], col, 0.45), -1);
                  dc.fillCircle(q[0], q[1], 5);
                  dc.setColor(G.mix(col, 0xffffff, 0.6), -1);
                  dc.fillCircle(q[0], q[1], s > 0.6 ? 3 : 2);
                }
              }
            }
          }
          e++;
        }
      }
    }

    // ---- nodes
    for (let L = 0; L < 4; L++) {
      if (nP[L] <= 0) continue;
      // arrival flash when the wave reaches this layer
      let fl = ph - L;
      fl = p >= 1 && fl >= 0 && fl < 0.35 ? 1 - fl / 0.35 : 0;
      for (let i = 0; i < LN[L]; i++) {
        const np = G.clamp((p - NS[L] - i * 0.02) / 0.12, 0, 1);
        if (np <= 0) continue;
        const x = LX[L], y = ny(L, i);
        const v = nodeV(L, i);
        const isWin = L === 3 && i === win;
        const pos = L === 0 ? P[i] > 0 : L === 1 ? H1[i] >= 0 : L === 2 ? H2[i] >= 0 : true;
        let col = L === 3 ? (isWin ? C[6] : C[3]) : pos ? C[1] : C[2];
        const known = L > 0 || KN[i];
        const br = G.clamp((0.3 + 0.7 * v) * np + fl * 0.3, 0, 1);
        let r = L === 0 ? 5 + 4 * v : L === 3 ? 6 + 5 * v : 6;
        r = r * G.spring(np);
        if (st === 2) {
          const h = Math.round(r) + 1;
          dc.setColor(C[0], -1);
          dc.fillRectangle(x - h, y - h, 2 * h + 1, 2 * h + 1);
          dc.setColor(G.mix(C[0], col, 0.5 + 0.5 * br), -1);
          dc.setPenWidth(2);
          dc.drawRectangle(x - h, y - h, 2 * h + 1, 2 * h + 1);
          if (known) {
            const ih = Math.round((h - 2) * v);
            if (ih > 0) dc.fillRectangle(x - ih, y - ih, 2 * ih + 1, 2 * ih + 1);
          }
        } else {
          // glow halo, body, bright core
          dc.setColor(G.mix(C[0], col, (st === 3 ? 0.22 : 0.28) * br), -1);
          dc.fillCircle(x, y, r + (st === 3 ? 6 : 5));
          if (!known) {
            dc.setColor(G.mix(C[0], col, 0.6), -1);
            dc.setPenWidth(2);
            dc.drawCircle(x, y, r);
          } else {
            dc.setColor(G.mix(C[5], col, br), -1);
            dc.fillCircle(x, y, r);
            if (br > 0.55) {
              dc.setColor(G.mix(col, 0xffffff, st === 3 ? 0.45 : 0.7), -1);
              dc.fillCircle(x, y, r * 0.4);
            }
          }
        }
        if (isWin && np >= 1) {
          dc.setColor(C[6], -1);
          dc.setPenWidth(2);
          if (st === 2) dc.drawRectangle(x - r - 5, y - r - 5, 2 * r + 11, 2 * r + 11);
          else dc.drawCircle(x, y, r + 6 + (live ? 1.5 * Math.sin(a.t / 250) : 0));
        }
      }
    }

    // ---- labels
    if (nP[0] > 0) {
      for (let i = 0; i < 6; i++) {
        dc.setColor(G.mix(C[0], C[3], nP[0] * (KN[i] ? 1 : 0.5)), -1);
        F.px(dc, IN_L[i], 82, ny(0, i) - 7, 2, 2, 0);
      }
    }
    if (nP[3] > 0) {
      for (let o = 0; o < 3; o++) {
        const y = ny(3, o);
        const c = o === win ? C[6] : C[3];
        dc.setColor(G.mix(C[0], c, nP[3]), -1);
        F.px(dc, OUT_L[o], 346, y - 15, 2, 0, 0);
        dc.setColor(G.mix(C[0], o === win ? C[4] : C[3], nP[3] * (o === win ? 1 : 0.7)), -1);
        F.px(dc, Math.round(PR[o] * 100 * nP[3]) + "%", 346, y + 2, 2, 0, 0);
      }
    }

    // ---- time + date
    const tp = G.easeInOut(p * 1.35);
    const ts = G.timeStr(d);
    if (st === 1) {
      dc.setColor(G.dim(d.accent, 0.35), -1);
      F.st(dc, ts, 227, 98, 74, 13, 1, tp, 0);
    } else if (st === 3) {
      dc.setColor(0x4a2414, -1);
      F.st(dc, ts, 227, 98, 74, 14, 1, tp, 0);
    }
    dc.setColor(C[4], -1);
    F.st(dc, ts, 227, 98, 74, st === 2 ? 4 : st === 3 ? 7 : 5, 1, tp, 0);
    if (st === 2) {
      // dimension line under the time
      dc.setColor(C[3], -1);
      dc.setPenWidth(1);
      const hw = F.stW(ts, 74) / 2 + 6;
      dc.drawLine(227 - hw, 142, 227 + hw, 142);
      dc.drawLine(227 - hw, 137, 227 - hw, 147);
      dc.drawLine(227 + hw, 137, 227 + hw, 147);
    }
    dc.setColor(G.mix(C[0], C[3], G.clamp(p * 2, 0, 1)), -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 36, 2, 1, 0);

    // ---- forecast
    if (nP[3] > 0) {
      dc.setColor(G.mix(C[0], C[3], nP[3]), -1);
      F.px(dc, "FORM-PROGNOSE", 227, 352, 2, 1, 0);
      dc.setColor(G.mix(C[0], C[6], nP[3]), -1);
      F.st(dc, OUT_L[win] + " " + Math.round(PR[win] * 100 * nP[3]) + "%", 227, 386, 26, 4, 1, 1.0, 0);
      // caption: inference time while the pass runs, then a witty verdict
      let cap = "Inferenz " + (9 + ((d.wakeN * 7) % 8)) + " ms";
      let n = cap.length;
      if (!live || a.t > 2600) {
        cap = quip(d, win);
        n = live ? G.clamp(Math.floor((a.t - 2600) / 45), 0, cap.length) : cap.length;
      }
      dc.setColor(G.mix(C[0], C[3], nP[3] * 0.9), -1);
      const w = F.pxW(cap, 2);
      F.px(dc, cap.substring(0, n), 227 - w / 2, 408, 2, 0, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const C = pal(st, d.accent);
    const win = forward(d);
    // strongest path: back-trace from the winning output
    let k = 0, j = 0, i = 0, best = -1;
    for (let q = 0; q < 4; q++) { const s = Math.abs(W3[win * 4 + q] * H2[q]); if (s > best) { best = s; k = q; } }
    best = -1;
    for (let q = 0; q < 5; q++) { const s = Math.abs(W2[k * 5 + q] * H1[q]); if (s > best) { best = s; j = q; } }
    best = -1;
    for (let q = 0; q < 6; q++) { const s = Math.abs(W1[j * 6 + q] * U[q]); if (s > best) { best = s; i = q; } }
    const ox = o[0], oy = o[1];
    dc.setColor(G.dim(C[6], 0.55), -1);
    dc.setPenWidth(2);
    dc.drawLine(LX[0] + ox, ny(0, i) + oy, LX[1] + ox, ny(1, j) + oy);
    dc.drawLine(LX[1] + ox, ny(1, j) + oy, LX[2] + ox, ny(2, k) + oy);
    dc.drawLine(LX[2] + ox, ny(2, k) + oy, LX[3] + ox, ny(3, win) + oy);
    dc.setColor(0x505050, -1);
    for (let L = 0; L < 4; L++) {
      for (let q = 0; q < LN[L]; q++) {
        if (st === 2) dc.fillRectangle(LX[L] - 2 + ox, ny(L, q) - 2 + oy, 5, 5);
        else dc.fillCircle(LX[L] + ox, ny(L, q) + oy, 2);
      }
    }
    dc.setColor(G.dim(C[6], 0.7), -1);
    F.px(dc, OUT_L[win], 346 + ox, ny(3, win) - 7 + oy, 2, 0, 0);
    dc.setColor(0x9a9a9a, -1);
    F.st(dc, G.timeStr(d), 227 + ox, 98 + oy, 74, 3, 1, 1.0, 0);
  },
};
