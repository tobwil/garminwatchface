// FORM — "Tagesform": how ready you are today, and why. A score ring (0..100) built from Body Battery,
// sleep, stress of the last two hours and recovery time; the four factors sit in the corners with the
// points they add or cost ("+8", "-5"), below the advice and the main reason in plain words. The whole
// colour world follows your state: green when top fit, blue when solid, violet when tired, red when
// exhausted, amber when stressed. On every wrist raise the ring fills and the score counts up.
// Styles: 1 Nacht, 2 Tag, 3 Minimal. Mirrors watch/source/faces/Form.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { IN, STATE_NAMES } from "../engine/insight.js";

const CX = 227, CY = 222, RR = 102;
const SC = [0x3ae07a, 0x3ab4ff, 0xb48aff, 0xff6a4a, 0xffb02a]; // colour per state
// factor corners: x, y, alignment
const FC = [44, 108, 0, 410, 108, 2, 44, 292, 0, 410, 292, 2];
const FN = ["AKKU", "SCHLAF", "STRESS 2H", "ERHOLUNG"];

// [bg top, bg bottom, ink, dim, track, plus, minus]
function pal(st, c) {
  if (st === 2) return [0xffffff, G.mix(c, 0xffffff, 0.7), 0x1a1a22, 0x6a6a78, G.mix(c, 0xffffff, 0.75), 0x1a9a4a, 0xd83a2a];
  if (st === 3) return [0x000000, 0x000000, 0xffffff, 0x8a8a96, G.mix(c, 0, 0.8), 0x5aff8a, 0xff5a4a];
  return [0x000000, G.mix(c, 0, 0.72), 0xffffff, G.mix(c, 0xffffff, 0.45), G.mix(c, 0, 0.7), 0x5aff8a, 0xff6a5a];
}

function factorValue(d, k) {
  if (k === 0) return d.bb >= 0 ? d.bb + "%" : "--";
  if (k === 1) return d.sleep >= 0 ? "" + d.sleep : "--";
  if (k === 2) { const s = IN.stress2h(d); return s >= 0 ? "" + s : "--"; }
  if (d.recov < 0) return "--";
  return d.recov < 60 ? "BEREIT" : Math.round(d.recov / 60) + " STD";
}

export default {
  fps: 0,

  // static layer: background, factors, advice, time; the ring and the score count up on the raise
  bgKey(d) { return d.doy * 1440 + d.mins; },
  reveal() { return false; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const r = IN.ready(d);
    const stt = IN.state(d, r[0]);
    const C = SC[stt];
    const P = pal(d.cfg.style, C);
    const p = a.intro;

    if (S) {
      for (let i = 0; i < 16; i++) {
        dc.setColor(G.mix(P[0], P[1], i / 15), -1);
        dc.fillRectangle(0, i * 29, 454, 29);
      }
      dc.setColor(P[2], -1);
      F.st(dc, G.timeStr(d), 227, 34, 38, 5, 1, 1, 0);
      dc.setColor(P[3], -1);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 62, 2, 1, 0);
      // ---- the four factors with the points they add or cost
      for (let k = 0; k < 4; k++) {
        const x = FC[k * 3], y = FC[k * 3 + 1], al = FC[k * 3 + 2];
        dc.setColor(P[3], -1);
        F.px(dc, FN[k], x, y, 1, al, 0);
        dc.setColor(P[2], -1);
        F.px(dc, factorValue(d, k), x, y + 12, 2, al, 0);
        const c = r[k + 1];
        dc.setColor(c > 0 ? P[5] : c < 0 ? P[6] : P[3], -1);
        F.px(dc, (c > 0 ? "+" : "") + c, x, y + 32, 2, al, 0);
      }
      // ---- advice and the main reason
      dc.setColor(C === SC[0] || d.cfg.style !== 2 ? C : G.mix(C, 0, 0.3), -1);
      F.px(dc, IN.advice(stt), 227, 352, 2, 1, 0);
      dc.setColor(P[3], -1);
      const w = IN.worst(r);
      F.px(dc, w >= 0 ? IN.reason(d, w) : "ALLES IM GRÜNEN BEREICH", 227, 374, 2, 1, 0);
      dc.setColor(P[4], -1);
      dc.setPenWidth(16);
      G.arcC(dc, CX, CY, RR, -135, 135);
    }

    if (!M) return;
    // ---- the ring fills and the score counts up
    const e = G.ease(G.clamp(p / 0.8, 0, 1));
    const R = r[0] >= 0 ? r[0] : 0;
    dc.setColor(C, -1);
    dc.setPenWidth(16);
    G.arcC(dc, CX, CY, RR, -135, -135 + 270 * (R / 100) * e);
    dc.setColor(P[2], -1);
    F.st(dc, r[0] >= 0 ? "" + Math.round(R * e) : "--", CX, CY - 6, 64, 9, 1, 1, 0);
    dc.setColor(C, -1);
    F.px(dc, STATE_NAMES[stt], CX, CY + 40, 2, 1, 0);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const r = IN.ready(d);
    const C = SC[IN.state(d, r[0])];
    dc.setColor(G.mix(C, 0, 0.55), -1);
    dc.setPenWidth(3);
    G.arcC(dc, CX + o[0], CY + o[1], RR, -135, -135 + 270 * (Math.max(0, r[0]) / 100));
    dc.setColor(0x8a8a8a, -1);
    F.st(dc, G.timeStr(d), CX + o[0], CY - 6 + o[1], 52, 3, 1, 1, 0);
  },
};
