// BEFUND — "Befund": a daily report on your body, written by the watch. Three curves – pulse over the
// last two hours, Body Battery and stress over 24 hours (with the 50 line) – each with its current
// value and a finding in plain words ("SINKT, DU KOMMST RUNTER", "LÄDT +8/STD", "3 STD STRESS HEUTE"),
// and at the bottom the conclusion. The header colour follows your state. On every wrist raise the
// curves are plotted. Styles: 1 Monitor, 2 Papier, 3 Akzent. Mirrors watch/source/faces/Befund.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { IN } from "../engine/insight.js";

const SC = [0x3ae07a, 0x3ab4ff, 0xb48aff, 0xff6a4a, 0xffb02a];
const X0 = 52, X1 = 402; // panels
const PY = [100, 176, 252]; // panel tops
const TITLE = ["PULS 2 STD", "BODY BATTERY 24 STD", "STRESS 24 STD"];

function hrFinding(d) {
  if (d.hr <= 0) return "KEINE PULSDATEN";
  const up = d.rhr > 0 ? d.hr - d.rhr : 0;
  const n = d.hrHist.length;
  const tr = IN.avg(d.hrHist, n - 10, n) - IN.avg(d.hrHist, n - 20, n - 10);
  if (up >= 30) return "DEUTLICH ÜBER RUHE (+" + up + ")";
  if (tr >= 8) return "STEIGT (+" + tr + " IN 20 MIN)";
  if (tr <= -8) return "SINKT, DU KOMMST RUNTER";
  if (up <= 8) return "ENTSPANNT, NAHE RUHEPULS";
  return "LEICHT ERHÖHT (+" + up + ")";
}

function bbFinding(d) {
  const r = IN.bbRate(d);
  if (d.bb < 0) return "KEINE DATEN";
  if (r >= 5) return "LÄDT +" + r + "/STD";
  if (r <= -6) return "ENTLÄDT " + r + "/STD";
  if (d.bb >= 70) return "GUT GEFÜLLT";
  if (d.bb < 25) return "FAST LEER";
  return "STABIL";
}

function stressFinding(d) {
  const s2 = IN.stress2h(d);
  if (s2 < 0) return "KEINE DATEN";
  let hi = 0;
  for (const v of d.stressHist) if (v >= 50) hi++;
  const hrs = Math.round(hi / 2);
  if (s2 >= 60) return "HOCH SEIT 2 STD (" + s2 + ")";
  if (hrs >= 4) return hrs + " STD STRESS HEUTE";
  if (s2 <= 25) return "RUHIG";
  return "IM RAHMEN";
}

// [bg, panel, ink, dim, grid, curve hr, curve bb, curve stress]
function pal(st, acc) {
  if (st === 2) return [0xf4f1ea, 0xe8e4da, 0x1a1a22, 0x6a6a72, 0xc8c2b4, 0xc0282a, 0x1a8a4a, 0xd87a1a];
  if (st === 3) return [0x000000, 0x0e0e12, 0xffffff, 0x8a8a96, 0x2a2a30, acc, G.mix(acc, 0xffffff, 0.4), G.mix(acc, 0, 0.3)];
  return [0x000000, 0x0a1210, 0xe8fff0, 0x6a8a7a, 0x16302a, 0xff5a6a, 0x5aff8a, 0xffb02a];
}

// curve of a history inside panel k, values lo..hi, drawn up to fraction f
function curve(dc, a, k, lo, hi, f) {
  const n = a.length;
  const y0 = PY[k] + 14, h = 30;
  const m = Math.max(2, Math.round(n * f));
  let px = -1, py = 0;
  for (let i = 0; i < m; i++) {
    if (a[i] < 0) continue;
    const x = X0 + 8 + ((X1 - X0 - 16) * i) / (n - 1);
    const y = y0 + h - (h * G.clamp((a[i] - lo) / Math.max(1, hi - lo), 0, 1));
    if (px >= 0) dc.drawLine(px, py, x, y);
    px = x;
    py = y;
  }
}

function range(a) {
  let lo = 999, hi = -1;
  for (const v of a) if (v >= 0) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  return hi < 0 ? [0, 100] : [lo - 4, hi + 4];
}

export default {
  fps: 0,

  // static layer: report frame, values, findings, conclusion; the curves are plotted on the raise
  bgKey(d) { return d.doy * 1440 + d.mins; },
  reveal() { return false; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const P = pal(d.cfg.style, d.accent);
    const r = IN.ready(d);
    const stt = IN.state(d, r[0]);
    const C = SC[stt];
    const p = a.intro;

    if (S) {
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 0, 454, 454);
      // ---- header in the colour of your state
      dc.setColor(P[2], -1);
      F.st(dc, G.timeStr(d), 227, 36, 36, 5, 1, 1, 0);
      dc.setColor(P[3], -1);
      F.px(dc, "BEFUND  " + d.dowStr + " " + d.day + ". " + d.monStr, 227, 62, 1, 1, 0);
      dc.setColor(C, -1);
      dc.fillRectangle(X0, 80, X1 - X0, 4);
      // ---- panels: title, current value, grid, finding
      const val = [d.hr > 0 ? d.hr + " BPM" : "--", d.bb >= 0 ? d.bb + "%" : "--", IN.stress2h(d) >= 0 ? "" + IN.stress2h(d) : "--"];
      const fnd = [hrFinding(d), bbFinding(d), stressFinding(d)];
      for (let k = 0; k < 3; k++) {
        const y = PY[k];
        dc.setColor(P[1], -1);
        dc.fillRectangle(X0, y - 8, X1 - X0, 74);
        dc.setColor(P[4], -1);
        dc.fillRectangle(X0 + 8, y + 44, X1 - X0 - 16, 1);
        if (k === 2) for (let x = X0 + 8; x < X1 - 8; x += 8) dc.fillRectangle(x, y + 29, 4, 1);
        dc.setColor(P[3], -1);
        F.px(dc, TITLE[k], X0 + 8, y - 2, 1, 0, 0);
        dc.setColor(P[5 + k], -1);
        F.px(dc, val[k], X1 - 8, y - 4, 2, 2, 0);
        dc.setColor(P[2], -1);
        F.px(dc, fnd[k], X0 + 8, y + 48, 2, 0, 0);
      }
      // ---- conclusion (a darker state colour on paper)
      dc.setColor(d.cfg.style === 2 ? G.mix(C, 0, 0.35) : C, -1);
      F.px(dc, "FAZIT: " + IN.advice(stt), 227, 336, 2, 1, 0);
      dc.setColor(P[3], -1);
      const w = IN.worst(r);
      F.px(dc, w >= 0 ? IN.reason(d, w) : "ALLES IM GRÜNEN BEREICH", 227, 358, 2, 1, 0);
      F.px(dc, "FORM " + (r[0] >= 0 ? r[0] : "--") + "  SCHLAF " + (d.sleep >= 0 ? d.sleep : "--") + "  SPO2 " + (d.spo2 > 0 ? d.spo2 + "%" : "--"), 227, 382, 1, 1, 0);
    }

    if (!M) return;
    // ---- the curves, plotted on the raise
    const f = G.ease(G.clamp(p / 0.8, 0, 1));
    dc.setPenWidth(2);
    const hr = range(d.hrHist);
    dc.setColor(P[5], -1);
    curve(dc, d.hrHist, 0, hr[0], hr[1], f);
    dc.setColor(P[6], -1);
    curve(dc, d.bbHist, 1, 0, 100, f);
    dc.setColor(P[7], -1);
    curve(dc, d.stressHist, 2, 0, 100, f);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const r = IN.ready(d);
    dc.setColor(G.mix(SC[IN.state(d, r[0])], 0, 0.5), -1);
    dc.fillRectangle(X0 + o[0], 80 + o[1], X1 - X0, 2);
    dc.setColor(0x8a8a8a, -1);
    F.st(dc, G.timeStr(d), 227 + o[0], 36 + o[1], 36, 3, 1, 1, 0);
  },
};
