// WOCHE — "Wochenbilanz": the current ISO week (Mon–Sun) at a glance. A 7-column grid with
// training-day checks and per-day steps / floors / active minutes, a segmented outer ring for
// training days vs. the weekly goal, a summary line and three small data slots.
// Styles: 1 Heatmap, 2 Balken, 3 Pixel. Mirrors watch/source/faces/Woche.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const DL = ["M", "D", "M", "D", "F", "S", "S"];
// 7x7 pixel icons (bit 6 = left): shoe, stairs, bolt, check, avg sign (5 wide)
const ICO = [
  0x60, 0x60, 0x70, 0x78, 0x7f, 0x7f, 0x2a,
  0x03, 0x03, 0x0f, 0x0f, 0x3f, 0x3f, 0x7f,
  0x0e, 0x1c, 0x38, 0x7e, 0x0c, 0x18, 0x30,
  0x01, 0x03, 0x46, 0x6c, 0x38, 0x10, 0x00,
  0x02, 0x1c, 0x26, 0x2a, 0x32, 0x1c, 0x20,
];
const RY = [218, 248, 278]; // data rows (heatmap) top
const CY = 202; // check row centre
const BASE = 306; // bar baseline

function colX(i) { return 107 + i * 40; }

function icon(dc, k, x, y, sc) {
  for (let r = 0; r < 7; r++) {
    const b = ICO[k * 7 + r];
    if (b === 0) continue;
    for (let c = 0; c < 7; c++) if (b & (64 >> c)) dc.fillRectangle(x + c * sc, y + r * sc, sc, sc);
  }
}

// fraction of the daily goal for metric k on day i (-1 = future / unknown)
function frac(d, k, i) {
  const v = k === 0 ? d.wkSteps[i] : k === 1 ? d.wkFloors[i] : d.wkAct[i];
  if (v === undefined || v < 0) return -1;
  const g = k === 0 ? (d.stepGoal > 0 ? d.stepGoal : 10000) : k === 1 ? (d.floorsGoal > 0 ? d.floorsGoal : 10) : actGoal(d);
  return v / g;
}
function actGoal(d) {
  const g = Math.round(d.imGoal / 5);
  return g > 0 ? g : 30;
}

// [avg steps, sum floors, sum active minutes, days with data]
function totals(d) {
  let s = 0, f = 0, a = 0, n = 0;
  for (let i = 0; i < 7; i++) {
    if (i > d.dayIdx || d.wkSteps[i] < 0) continue;
    s += d.wkSteps[i];
    if (d.wkFloors[i] > 0) f += d.wkFloors[i];
    if (d.wkAct[i] > 0) a += d.wkAct[i];
    n++;
  }
  return [n > 0 ? Math.round(s / n) : 0, f, a, n];
}

export default {
  fps: 6,

  // static layer: the whole week; only the frame of today pulses
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const live = a.live && p >= 1;
    const px = st === 3;
    const ti = d.dayIdx;
    const dark = st === 3 ? 0x1c1c26 : 0x1a221e;
    const goal = d.dayGoal > 0 ? d.dayGoal : 4;
    const td = d.trainDays > 0 ? d.trainDays : 0;
    const pulse = live ? 0.5 + 0.5 * Math.sin((a.t / 1000.0) * 3.1416) : 1;
    if (a.bg) {
      // over the cached week only the frame of today pulses
      const tx = colX(ti);
      dc.setColor(G.mix(dark, acc, 0.3 + 0.35 * pulse), -1);
      if (px) {
        dc.fillRectangle(tx - 18, 172, 36, 2);
        dc.fillRectangle(tx - 18, 310, 36, 2);
        dc.fillRectangle(tx - 20, 174, 2, 136);
        dc.fillRectangle(tx + 18, 174, 2, 136);
      } else {
        dc.setPenWidth(2);
        dc.drawRoundedRectangle(tx - 19, 172, 38, 140, 10);
      }
      return;
    }

    // ---------------- outer ring: training days vs goal
    if (px) {
      const n = 56;
      for (let j = 0; j < n; j++) {
        const sg = Math.floor((j * goal) / n);
        if (Math.floor(((j + 1) * goal) / n) !== sg && j < n - 1) continue; // gap before next segment
        const on = sg < td;
        const sp = G.stag(p, sg, 0.1, 0.3);
        const lit = on && (j - Math.floor((sg * n) / goal)) < sp * (n / goal);
        dc.setColor(lit ? acc : 0x262634, -1);
        const ang = (j + 0.5) * (360 / n);
        const x = Math.round(G.ptX(227, 210, ang) / 2) * 2, y = Math.round(G.ptY(227, 210, ang) / 2) * 2;
        dc.fillRectangle(x - 4, y - 4, 8, 8);
      }
    } else {
      const sw = 360.0 / goal;
      dc.setPenWidth(8);
      for (let i = 0; i < goal; i++) {
        const a0 = i * sw + 2, a1 = (i + 1) * sw - 2;
        dc.setColor(0x222a26, -1);
        G.arcC(dc, 227, 227, 214, a0, a1);
        if (i < td) {
          const sp = G.ease(G.stag(p, i, 0.1, 0.3));
          if (sp > 0) {
            dc.setColor(acc, -1);
            G.arcC(dc, 227, 227, 214, a0, a0 + (a1 - a0) * sp);
          }
        }
      }
    }

    // ---------------- date, time, training label
    const ds = d.dowStr + " " + d.day + ". " + d.monStr + "  KW " + d.wk;
    dc.setColor(0x9a9a9a, -1);
    F.px(dc, ds, 227, 54, 2, 1, 0);
    const ts = G.timeStr(d);
    if (px) {
      dc.setColor(G.dim(acc, 0.35), -1);
      F.px(dc, ts, 231, 80, 9, 1, 0);
      dc.setColor(0xffffff, -1);
      F.px(dc, ts, 227, 76, 9, 1, 0);
    } else {
      dc.setColor(0xffffff, -1);
      F.st(dc, ts, 227, 110, 60, st === 2 ? 5 : 6, 1, G.easeInOut(p * 1.6), 0);
    }
    const tl = td + "/" + goal + " TRAININGSTAGE";
    dc.setColor(td >= goal ? acc : 0xc8c8c8, -1);
    F.px(dc, tl, 227, 152, 2, 1, 0);

    // ---------------- today column frame (pulses)
    const tx = colX(ti);
    const fc = G.mix(dark, acc, 0.3 + 0.35 * pulse);
    if (px) {
      dc.setColor(fc, -1);
      dc.fillRectangle(tx - 18, 172, 36, 2);
      dc.fillRectangle(tx - 18, 310, 36, 2);
      dc.fillRectangle(tx - 20, 174, 2, 136);
      dc.fillRectangle(tx + 18, 174, 2, 136);
    } else {
      dc.setColor(G.mix(0x000000, acc, 0.1 + 0.06 * pulse), -1);
      dc.fillRoundedRectangle(tx - 19, 172, 38, 140, 10);
      dc.setColor(fc, -1);
      dc.setPenWidth(2);
      dc.drawRoundedRectangle(tx - 19, 172, 38, 140, 10);
    }

    // ---------------- day labels + checks
    for (let i = 0; i < 7; i++) {
      const x = colX(i);
      const fut = i > ti;
      dc.setColor(i === ti ? 0xffffff : fut ? 0x5a5a5a : 0x9a9a9a, -1);
      if (px || st === 1) F.px(dc, DL[i], x, 178, 2, 1, 0);
      else F.st(dc, DL[i], x, 185, 16, 2, 1, 1.0, 0);
      const tr = ((d.trainMask >> i) & 1) === 1;
      const pp = G.spring(G.stag(p, 1, 0.3 + i * 0.06, 0.25));
      if (tr) {
        if (pp <= 0) continue;
        if (px) {
          dc.setColor(acc, -1);
          const s = Math.max(1, Math.round(3 * pp));
          icon(dc, 3, x - 3.5 * s, CY - 3.5 * s, s);
        } else {
          dc.setColor(acc, -1);
          dc.fillCircle(x, CY, 9 * pp);
          if (pp > 0.6) {
            dc.setColor(0x000000, -1);
            dc.setPenWidth(3);
            dc.drawLine(x - 5, CY, x - 1, CY + 4);
            dc.drawLine(x - 1, CY + 4, x + 5, CY - 4);
          }
        }
      } else if (fut) {
        dc.setColor(0x3a3a3a, -1);
        if (px) dc.fillRectangle(x - 2, CY - 2, 4, 4);
        else dc.fillCircle(x, CY, 2);
      } else {
        dc.setColor(i === ti ? G.dim(acc, 0.6) : 0x444444, -1);
        if (px) {
          dc.fillRectangle(x - 6, CY - 6, 12, 2);
          dc.fillRectangle(x - 6, CY + 4, 12, 2);
          dc.fillRectangle(x - 6, CY - 4, 2, 8);
          dc.fillRectangle(x + 4, CY - 4, 2, 8);
        } else {
          dc.setPenWidth(2);
          dc.drawCircle(x, CY, 8);
        }
      }
    }

    // ---------------- data area
    const tone = [acc, G.mix(acc, 0xffffff, 0.55), G.dim(acc, 0.6)];
    for (let i = 0; i < 7; i++) {
      const x = colX(i);
      const cp = G.easeInOut(G.stag(p, i, 0.07, 0.35));
      for (let k = 0; k < 3; k++) {
        const f = frac(d, k, i);
        if (st === 1) {
          const y = RY[k];
          if (f < 0) {
            dc.setColor(0x262626, -1);
            dc.setPenWidth(1);
            dc.drawRoundedRectangle(x - 15, y, 30, 26, 6);
            continue;
          }
          const lv = f >= 1 ? 4 : f <= 0 ? 0 : 1 + Math.floor(G.clamp(f, 0, 0.999) * 3);
          const lvp = Math.floor(lv * cp + 0.001);
          dc.setColor(lvp === 0 ? 0x1c2420 : G.mix(0x1c2420, acc, lvp / 4.0), -1);
          dc.fillRoundedRectangle(x - 15, y, 30, 26, 6);
          if (f >= 1 && cp >= 1) {
            dc.setColor(0xffffff, -1);
            dc.fillCircle(x + 9, y + 6, 2);
          }
        } else {
          const bx = x - 14 + k * 10;
          if (f < 0) {
            dc.setColor(0x333333, -1);
            dc.fillRectangle(bx + 2, BASE - 2, 4, 2);
            continue;
          }
          const fe = G.clamp(f, 0, 1.25) * cp;
          if (st === 2) {
            const h = Math.round(fe * 64);
            dc.setColor(tone[k], -1);
            if (h >= 3) dc.fillRoundedRectangle(bx, BASE - h, 8, h, 3);
            else dc.fillRectangle(bx, BASE - 2, 8, 2);
          } else {
            const nb = Math.round(fe * 8);
            for (let b = 0; b < nb; b++) {
              dc.setColor(b >= 8 ? 0xffffff : tone[k], -1);
              dc.fillRectangle(bx, BASE - 6 - b * 8, 8, 6);
            }
            if (nb === 0) {
              dc.setColor(tone[k], -1);
              dc.fillRectangle(bx, BASE - 2, 8, 2);
            }
          }
        }
      }
    }
    if (st === 1) {
      // row icons
      for (let k = 0; k < 3; k++) {
        dc.setColor(0x8a8a8a, -1);
        icon(dc, k, 64, RY[k] + 6, 2);
      }
    } else {
      // goal line (100 %) + baseline
      const gy = BASE - 65;
      dc.setColor(0x4a4a4a, -1);
      for (let x = 84; x < 368; x += 8) dc.fillRectangle(x, gy, 4, 2);
      dc.setColor(0x6a6a6a, -1);
      F.px(dc, "ZIEL", 78, gy - 6, 2, 2, 0);
      dc.setColor(0x3a3a3a, -1);
      dc.fillRectangle(82, BASE + 2, 290, 2);
    }

    // ---------------- summary line: avg steps, floors, active minutes vs goal
    const T = totals(d);
    const s1 = G.num(T[0]), s2 = "" + T[1], s3 = T[2] + "/" + d.imGoal;
    const w = 30 + F.pxW(s1, 2) + 36 + F.pxW(s2, 2) + 36 + F.pxW(s3, 2);
    let x = Math.round(227 - w / 2);
    const sy = 320;
    const ic = [st === 1 ? acc : tone[0], st === 1 ? acc : tone[1], st === 1 ? acc : tone[2]];
    dc.setColor(ic[0], -1);
    icon(dc, 0, x, sy, 2);
    x += 18;
    dc.setColor(0xd8d8d8, -1);
    icon(dc, 4, x, sy, 2);
    x += 12;
    F.px(dc, s1, x, sy, 2, 0, 0);
    x += F.pxW(s1, 2) + 18;
    dc.setColor(ic[1], -1);
    icon(dc, 1, x, sy, 2);
    x += 18;
    dc.setColor(0xd8d8d8, -1);
    F.px(dc, s2, x, sy, 2, 0, 0);
    x += F.pxW(s2, 2) + 18;
    dc.setColor(ic[2], -1);
    icon(dc, 2, x, sy, 2);
    x += 18;
    dc.setColor(T[2] >= d.imGoal ? acc : 0xd8d8d8, -1);
    F.px(dc, s3, x, sy, 2, 0, 0);

    // ---------------- slots
    for (let k = 0; k < 3; k++) {
      const sl = d.slots[k];
      const sx = 227 + (k - 1) * 96;
      const sp = G.stag(p, k, 0.1, 0.5);
      if (sp <= 0) continue;
      dc.setColor(G.dim(0x888888, sp), -1);
      F.px(dc, sl.lbl, sx, 346, 2, 1, 0);
      dc.setColor(G.mix(0x000000, d.dcol, sp), -1);
      if (px) F.px(dc, sl.val, sx, 366, 3, 1, 0);
      else F.st(dc, sl.val, sx, 376, 20, 3, 1, 1.0, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const cx = 227 + o[0], cy = o[1];
    const px = d.cfg.style === 3;
    const ts = G.timeStr(d);
    dc.setColor(0x9a9a9a, -1);
    if (px) F.px(dc, ts, cx, 150 + cy, 9, 1, 2);
    else F.st(dc, ts, cx, 186 + cy, 72, 3, 1, 1.0, 0);
    const goal = d.dayGoal > 0 ? d.dayGoal : 4;
    dc.setColor(G.dim(d.accent, 0.6), -1);
    F.px(dc, (d.trainDays > 0 ? d.trainDays : 0) + "/" + goal, cx, 246 + cy, 2, 1, 0);
    for (let i = 0; i < 7; i++) {
      const x = cx + (i - 3) * 26, y = 286 + cy;
      const tr = ((d.trainMask >> i) & 1) === 1;
      if (tr) {
        dc.setColor(G.dim(d.accent, 0.7), -1);
        dc.fillCircle(x, y, 5);
      } else if (i <= d.dayIdx) {
        dc.setColor(0x5a5a5a, -1);
        dc.setPenWidth(1);
        dc.drawCircle(x, y, 5);
      } else {
        dc.setColor(0x3a3a3a, -1);
        dc.fillCircle(x, y, 1);
      }
      dc.setColor(i === d.dayIdx ? 0x9a9a9a : 0x4a4a4a, -1);
      F.px(dc, DL[i], x, y + 12, 2, 1, 0);
    }
  },
};
