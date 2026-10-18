// IN — conclusions from the health data, shared by the "insight" designs (FORM, INNEN, BEFUND, PLAN).
// Mirrors watch/source/lib/Insight.mc (copied into a watch face only when faces.json lists
// "libs": ["insight"]).
//
// Readiness (0..100) is the weighted mean of four parts: Body Battery (40 %), sleep score (25 %),
// calm = 100 - stress of the last two hours (20 %) and recovery = 100 - recovery time / 48 h (15 %).
// Missing parts drop out. Each part's contribution is reported in points around the neutral 60, so
// the contributions plus 60 add up to the score and can be shown as "+8" / "-5".
import { G } from "./gfx.js";

export const STATE_NAMES = ["TOPFIT", "SOLIDE", "MÜDE", "ERSCHÖPFT", "GESTRESST"];
const W = [0.4, 0.25, 0.2, 0.15]; // Body Battery, sleep, calm, recovery

export const IN = {
  // mean of the valid (>= 0) values of a[from..to)
  avg(a, from, to) {
    let s = 0, n = 0;
    for (let i = Math.max(0, from); i < Math.min(a.length, to); i++) {
      if (a[i] >= 0) { s += a[i]; n++; }
    }
    return n > 0 ? Math.round(s / n) : -1;
  },

  // change of the history over its last n buckets (0 when unknown)
  delta(a, n) {
    const k = a.length;
    if (k <= n || a[k - 1] < 0 || a[k - 1 - n] < 0) return 0;
    return a[k - 1] - a[k - 1 - n];
  },

  // stress of the last two hours (4 half-hour buckets), else the current value
  stress2h(d) {
    const s = IN.avg(d.stressHist, d.stressHist.length - 4, d.stressHist.length);
    return s >= 0 ? s : d.stress;
  },

  // Body Battery change per hour (last two half-hour buckets)
  bbRate(d) { return IN.delta(d.bbHist, 2); },

  // the four parts (0..100, -1 = unknown): Body Battery, sleep, calm, recovery
  parts(d) {
    const s2 = IN.stress2h(d);
    return [
      d.bb >= 0 ? d.bb : -1,
      d.sleep >= 0 ? d.sleep : -1,
      s2 >= 0 ? 100 - s2 : -1,
      d.recov >= 0 ? Math.round(100 * (1 - G.clamp(d.recov / 2880, 0, 1))) : -1,
    ];
  },

  // [score, contribution Body Battery, sleep, calm, recovery]; score -1 when nothing is known
  ready(d) {
    const v = IN.parts(d);
    let sw = 0, sum = 0;
    for (let i = 0; i < 4; i++) if (v[i] >= 0) { sw += W[i]; sum += W[i] * v[i]; }
    if (sw <= 0) return [-1, 0, 0, 0, 0];
    const out = [Math.round(sum / sw)];
    for (let i = 0; i < 4; i++) out.push(v[i] >= 0 ? Math.round((W[i] / sw) * (v[i] - 60)) : 0);
    return out;
  },

  // 0 topfit, 1 solide, 2 müde, 3 erschöpft, 4 gestresst
  state(d, R) {
    if (IN.stress2h(d) >= 60 || d.stress >= 75) return 4;
    if (R < 0) return 1;
    return R >= 75 ? 0 : R >= 55 ? 1 : R >= 35 ? 2 : 3;
  },

  // index of the part that pulls the score down the most (-1 if none is negative)
  worst(r) {
    let k = -1, m = 0;
    for (let i = 0; i < 4; i++) if (r[i + 1] < m) { m = r[i + 1]; k = i; }
    return k;
  },

  // short reason for a part, e.g. "SCHLAF NUR 45"
  reason(d, k) {
    if (k === 0) return "AKKU NUR " + d.bb + "%";
    if (k === 1) return "SCHLAF NUR " + d.sleep;
    if (k === 2) return "STRESS " + IN.stress2h(d) + " SEIT 2 STD";
    if (k === 3) return "NOCH " + Math.round(d.recov / 60) + " STD ERHOLUNG";
    return "ALLES IM GRÜNEN BEREICH";
  },

  // the reported outside weather in one word (Garmin Weather.CONDITION_*)
  condName(c) {
    if (c === 0 || c === 23 || c === 39) return "KLAR";
    if (c === 22 || c === 1 || c === 51) return "HEITER";
    if (c === 2 || c === 20) return "BEWÖLKT";
    if (c === 5) return "WINDIG";
    if (c === 6 || c === 12 || c === 27 || c === 31 || c === 35 || c === 40 || c === 41) return "GEWITTER";
    if (c === 4 || c === 7 || c === 16 || c === 17 || c === 18 || c === 19 || c === 21 || c === 33 || c === 42 || c === 43 || c === 45 || c === 46 || c === 47 || c === 50 || c === 10) return "SCHNEE";
    if (c === 8 || c === 9 || c === 28 || c === 29 || c === 32 || c === 34 || c === 36 || c === 37 || c === 38) return "NEBEL";
    if (c >= 0) return "REGEN";
    return "";
  },

  // the advice in a few words for a state
  advice(st) {
    return ["HEUTE GEHT WAS!", "NORMALES PENSUM OK", "LOCKER BLEIBEN", "RUHETAG EINLEGEN", "DURCHATMEN, PAUSE"][st];
  },
};
