// BODY — "Körperscan": a pixel anatomy chart of you, live. The heart beats with your heart rate, the
// lungs breathe with your respiration rate, the brain glows from calm blue to stressed red and sparks
// more the higher the stress, the Body Battery sits in the belly as a battery, the legs charge up with
// today's steps and the arms with the week's intensity minutes. Leader lines label it all: stress,
// breathing, Body Battery, steps, sleep, pulse, SpO2, intensity minutes, floors; below a one-word
// verdict and calories / VO2max. On every wrist raise a scanner bar sweeps over the body.
// Styles: 1 Röntgen, 2 Lehrtafel, 3 Gameboy. Mirrors watch/source/faces/Body.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/body.js";

const SP = encodeAll(S);
const X0 = 161, Y0 = 96, C = 6; // grid origin and cell size of the figure
// labels: x, y, alignment (2 right, 0 left), target x, target y
const LB = [148, 98, 2, 209, 114, 148, 158, 2, 197, 180, 148, 214, 2, 209, 226, 148, 284, 2, 203, 300,
  306, 98, 0, 245, 112, 306, 152, 0, 241, 190, 306, 200, 0, 257, 204, 306, 248, 0, 281, 250, 306, 296, 0, 251, 300];
const NAMES = ["STRESS", "ATMUNG", "BODY BATT", "SCHRITTE", "SCHLAF", "PULS", "SPO2", "AKTIV-MIN", "ETAGEN"];

function cx(c) { return X0 + c * C; }
function cy(r) { return Y0 + r * C; }

function values(d) {
  return [
    d.stress >= 0 ? "" + d.stress : "--",
    d.resp > 0 ? d.resp + "/MIN" : "--",
    d.bb >= 0 ? d.bb + "%" : "--",
    G.num(Math.max(0, d.steps)),
    d.sleep >= 0 ? "" + d.sleep : "--",
    d.hr > 0 ? d.hr + " BPM" : "--",
    d.spo2 > 0 ? d.spo2 + "%" : "--",
    Math.max(0, d.imWeek) + "/" + (d.imGoal > 0 ? d.imGoal : 150),
    "" + Math.max(0, d.floors),
  ];
}

function verdict(d) {
  if (d.stress >= 60) return "GESTRESST";
  if (d.bb >= 0 && d.bb < 25) return "ERSCHÖPFT";
  if (d.sleep >= 0 && d.sleep < 50) return "MÜDE";
  if (d.bb >= 70 && d.stress >= 0 && d.stress < 30) return "TOPFIT";
  if (d.steps >= d.stepGoal && d.stepGoal > 0) return "IN BEWEGUNG";
  return "IM GLEICHGEWICHT";
}

// [bg, grid, fill, outline, label, value, leader, heart, heart light, lung, brain calm, brain hot,
//  battery frame, battery fill, battery empty, legs, arms, scan, time, spark]
function pal(st, acc) {
  if (st === 2) return [0xf0e6d0, 0xe0d4ba, 0xf4c8b0, 0x6a3a2a, 0x6a5a48, 0x2a1a10, 0xa8907a, 0xc0282a, 0xff6a5a,
    0xd88a8a, 0x5a8ad8, 0xd83a2a, 0x3a2a20, 0x3aa84a, 0xe0d4ba, 0x3a8ad8, 0xe8a03a, acc, 0x2a1a10, 0xffe03a];
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [c, c, e, a, b, a, b, a, e, b, b, a, a, a, e, a, b, a, a, e];
  }
  return [0x060c1a, 0x0e1a2e, 0x16304e, 0x6ad8ff, 0x6a8ab0, 0xffffff, 0x2a5a7a, 0xff3a4a, 0xff9aa0, 0x4a8ab8,
    0x3a8aff, 0xff3a3a, 0x6ad8ff, 0x5aff8a, 0x16304e, 0x5aff8a, 0xffb02a, acc, 0xffffff, 0xffffff];
}

export default {
  fps: 12,

  // static layer: chart, figure, battery, charged legs and arms, labels, texts; heart, lungs, brain
  // sparks and the scanner move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const sv = d.stress >= 0 ? G.clamp(d.stress / 100, 0, 1) : 0.3;

    if (S) {
      // ---- chart background with a fine grid
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 0, 454, 454);
      dc.setColor(P[1], -1);
      for (let x = 11; x < 454; x += 24) dc.fillRectangle(x, 0, 1, 454);
      for (let y = 8; y < 454; y += 24) dc.fillRectangle(0, y, 454, 1);

      // ---- the figure
      SPR.draw(dc, SP.FIGURE, X0, Y0, C, [-1, P[2], P[3]], false);
      // brain tinted by stress
      dc.setColor(G.mix(P[10], P[11], sv), -1);
      dc.fillRectangle(cx(8), cy(1), 6 * C, 2 * C);
      dc.fillRectangle(cx(9), cy(3), 4 * C, C);
      // legs charged by today's steps (from the feet up), arms by the week's intensity minutes
      const fs = G.clamp(Math.max(0, d.steps) / (d.stepGoal > 0 ? d.stepGoal : 10000), 0, 1);
      const nl = Math.round(fs * 14);
      dc.setColor(P[15], -1);
      if (nl > 0) {
        dc.fillRectangle(cx(7), cy(42 - nl), 2 * C, nl * C);
        dc.fillRectangle(cx(13), cy(42 - nl), 2 * C, nl * C);
      }
      const fa = G.clamp(Math.max(0, d.imWeek) / (d.imGoal > 0 ? d.imGoal : 150), 0, 1);
      const na = Math.round(fa * 15);
      dc.setColor(P[16], -1);
      if (na > 0) {
        dc.fillRectangle(cx(1), cy(28 - na), 2 * C, na * C);
        dc.fillRectangle(cx(19), cy(28 - na), 2 * C, na * C);
      }
      // Body Battery in the belly
      dc.setColor(P[12], -1);
      dc.fillRectangle(cx(8), cy(19), 6 * C, 5 * C);
      dc.fillRectangle(cx(10), cy(18) + 2, 2 * C, C - 2);
      dc.setColor(P[14], -1);
      dc.fillRectangle(cx(8) + 3, cy(19) + 3, 6 * C - 6, 5 * C - 6);
      const fb = d.bb >= 0 ? G.clamp(d.bb / 100, 0, 1) : 0;
      const bh = Math.round(fb * (5 * C - 6));
      dc.setColor(d.bb >= 0 && d.bb < 25 ? P[11] : P[13], -1);
      dc.fillRectangle(cx(8) + 3, cy(24) - 3 - bh, 6 * C - 6, bh);

      // ---- labels with leader lines
      const V = values(d);
      for (let i = 0; i < 9; i++) {
        const x = LB[i * 5], y = LB[i * 5 + 1], al = LB[i * 5 + 2], tx = LB[i * 5 + 3], ty = LB[i * 5 + 4];
        if (G.stag(p, i, 0.05, 0.4) <= 0) continue;
        dc.setColor(P[4], -1);
        F.px(dc, NAMES[i], x, y, 1, al, 0);
        dc.setColor(P[5], -1);
        F.px(dc, V[i], x, y + 10, 2, al, 0);
        // dotted leader from the label to the organ
        const sx = al === 2 ? x + 4 : x - 4, sy = y + 16;
        const n = Math.max(1, Math.round(Math.max(Math.abs(tx - sx), Math.abs(ty - sy)) / 6));
        dc.setColor(P[6], -1);
        for (let k = 0; k <= n; k++) dc.fillRectangle(Math.round(sx + ((tx - sx) * k) / n) - 1, Math.round(sy + ((ty - sy) * k) / n) - 1, 2, 2);
      }

      // ---- time, verdict, calories / VO2max
      dc.setColor(P[18], -1);
      F.px(dc, G.timeStr(d), 227, 18, 5, 1, 0);
      dc.setColor(P[4], -1);
      F.px(dc, "SCAN  " + d.dowStr + " " + d.day + ". " + d.monStr, 227, 62, 1, 1, 0);
      dc.setColor(st === 2 ? 0x1a5a8a : P[17], -1);
      F.px(dc, verdict(d), 227, 370, 2, 1, 0);
      dc.setColor(P[4], -1);
      const vo = Math.max(d.vo2r, d.vo2b);
      F.px(dc, G.num(Math.max(0, d.kcal)) + " KCAL" + (vo > 0 ? "  VO2 " + vo : ""), 227, 392, 2, 1, 0);
    }

    if (!M) return;
    // ---- lungs breathe with the respiration rate
    const br = d.resp > 0 ? 60000 / d.resp : 4000;
    const bf = live ? 0.5 - 0.5 * Math.cos(((tt % br) / br) * 2 * Math.PI) : 0.5;
    const lw = Math.round(bf * C);
    dc.setColor(P[9], -1);
    dc.fillRectangle(cx(7) - lw, cy(12) + 3, 2 * C + lw, 5 * C);
    dc.fillRectangle(cx(8) - lw, cy(11) + 3, C + lw, C);
    dc.fillRectangle(cx(13), cy(12) + 3, 2 * C + lw, 5 * C);
    dc.fillRectangle(cx(13), cy(11) + 3, C + lw, C);
    // ---- the heart beats with the heart rate
    const beat = d.hr > 0 ? 60000 / d.hr : 1000;
    const hs = !live || (tt % beat) < beat / 4 ? 1 : 0;
    dc.setColor(P[7], -1);
    dc.fillRectangle(cx(10) + 3 - hs * 3, cy(14) - hs * 3, 2 * C + hs * 6, 2 * C + hs * 3);
    dc.fillRectangle(cx(10) + 6, cy(16), C, C + hs * 3);
    dc.setColor(P[8], -1);
    dc.fillRectangle(cx(10) + 5, cy(14) + 2, 4, 4);
    // ---- brain sparks: more with more stress
    const ns = 1 + Math.round(sv * 6);
    dc.setColor(P[19], -1);
    for (let i = 0; i < ns; i++) {
      const s = G.rnd(i * 37 + Math.floor(tt / 160));
      if (live && s % 3 === 0) continue;
      dc.fillRectangle(cx(8) + (s % 34), cy(1) + ((s >> 4) % 14), 2, 2);
    }
    // ---- scanner bar on every raise
    if (p < 1) {
      const y = Y0 - 10 + Math.round(G.easeInOut(p) * 290);
      dc.setColor(P[17], -1);
      dc.fillRectangle(120, y, 214, 2);
      dc.setColor(G.mix(P[0], P[17], 0.4), -1);
      dc.fillRectangle(120, y - 6, 214, 4);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    SPR.draw(dc, SP.FIGURE, X0 + o[0], Y0 + o[1], C, [-1, -1, st === 3 ? 0x306230 : 0x2a4a6a], false);
    const beat = d.hr > 0;
    if (beat) {
      dc.setColor(G.dim(0xff3a4a, 0.5), -1);
      dc.fillRectangle(cx(10) + 3 + o[0], cy(14) + o[1], 2 * C, 2 * C);
    }
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a9a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 18 + o[1], 5, 1, 1);
  },
};
