// PULSE — the last two hours of heart rate as a radial spectrum (newest bar at
// 12 o'clock, time runs clockwise like a clock), an ECG sweep and a heart that
// beat at your real pulse. Styles: 1 Monitor, 2 Zonen, 3 Akzent.
// Mirrors watch/source/faces/Pulse.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const RAD = Math.PI / 180;
// ECG keypoints: phase, value (R peak = 1 at phase 0.31)
const EK_P = [0.08, 0.12, 0.16, 0.27, 0.29, 0.31, 0.335, 0.355, 0.45, 0.48, 0.51, 0.545, 0.58];
const EK_V = [0, 0.11, 0, 0, -0.1, 1.0, -0.26, 0, 0, 0.13, 0.21, 0.13, 0];
const MONGREEN = 0x39ff6a;

// ECG value at absolute time tm (ms) for beat period per
function ecg(tm, per) {
  const f = tm / per - Math.floor(tm / per);
  if (f <= EK_P[0] || f >= EK_P[12]) return 0;
  for (let i = 1; i < 13; i++) {
    if (f <= EK_P[i]) return G.lerp(EK_V[i - 1], EK_V[i], (f - EK_P[i - 1]) / (EK_P[i] - EK_P[i - 1]));
  }
  return 0;
}

function zcol(v, mx) {
  const q = v / mx;
  if (q < 0.6) return 0x6f8ab0;
  if (q < 0.7) return 0x2e8bff;
  if (q < 0.8) return 0x2bd96b;
  if (q < 0.9) return 0xff8a1f;
  return 0xff2d3a;
}

function heart(dc, x, y, r) {
  dc.fillCircle(x - r * 0.5, y - r * 0.28, r * 0.56);
  dc.fillCircle(x + r * 0.5, y - r * 0.28, r * 0.56);
  dc.fillPolygon([[x - r * 1.04, y - r * 0.12], [x + r * 1.04, y - r * 0.12], [x, y + r * 1.0]]);
}

export default {
  fps: 20,

  draw(dc, d, a) {
    const st = d.cfg.style;
    const p = a.intro;
    const t = a.t;
    const cx = 227, cy = 227;
    const hs = d.hrHist;
    const n = hs.length;
    const acc = d.accent;

    // range: resting HR .. 2h max
    let mn = 999, mx = -1;
    for (let i = 0; i < n; i++) {
      const v = hs[i];
      if (v > 0) { if (v < mn) mn = v; if (v > mx) mx = v; }
    }
    const lo = d.rhr > 0 ? d.rhr - 6 : (mx > 0 ? mn - 6 : 40);
    const hi = Math.max(mx + 8, lo + 50);
    const main = st === 1 ? MONGREEN : st === 3 ? acc : (d.hr > 0 ? zcol(d.hr, d.hrMax) : 0x5a7090);

    // ---- style 1: monitor grid & rings
    if (st === 1) {
      dc.setPenWidth(1);
      dc.setColor(0x0b2614, -1);
      for (let gx = 97; gx <= 357; gx += 20) dc.drawLine(gx, 230, gx, 302);
      for (let gy = 230; gy <= 302; gy += 18) dc.drawLine(97, gy, 357, gy);
      dc.setColor(0x0f3a1c, -1);
      dc.drawCircle(cx, cy, 143);
    } else {
      dc.setPenWidth(1);
      dc.setColor(0x262626, -1);
      dc.drawCircle(cx, cy, 143);
    }

    // ---- radial spectrum: bar i at clock angle (i+1)*6, newest at 12
    for (let i = 0; i < n && i < 60; i++) {
      const v = hs[i];
      const ang = (i + 1 + 60 - n) * 6;
      const gp = G.stag(p, i, 0.0105, 0.34);
      if (gp <= 0) continue;
      if (v <= 0) {
        dc.setColor(0x2a2a2a, -1);
        dc.fillCircle(G.ptX(cx, 154, ang), G.ptY(cy, 154, ang), 2);
        continue;
      }
      const q = G.clamp((v - lo) / (hi - lo), 0, 1);
      const len = (6 + 50 * q) * G.spring(gp);
      const age = i / 59.0;
      let col;
      if (st === 1) col = G.dim(MONGREEN, 0.3 + 0.7 * age);
      else if (st === 2) col = G.dim(zcol(v, d.hrMax), 0.55 + 0.45 * age);
      else col = G.dim(acc, 0.28 + 0.72 * q);
      dc.setColor(col, -1);
      const r0 = 150, r1 = 150 + len;
      const s0 = Math.sin((ang - 1.8) * RAD), c0 = Math.cos((ang - 1.8) * RAD);
      const s1 = Math.sin((ang + 1.8) * RAD), c1 = Math.cos((ang + 1.8) * RAD);
      dc.fillPolygon([
        [cx + r0 * s0, cy - r0 * c0], [cx + r1 * s0, cy - r1 * c0],
        [cx + r1 * s1, cy - r1 * c1], [cx + r0 * s1, cy - r0 * c1],
      ]);
      if (i === n - 1) {
        dc.setColor(0xffffff, -1);
        dc.fillCircle(G.ptX(cx, r1 + 6, ang), G.ptY(cy, r1 + 6, ang), 3);
      }
    }
    // 30-minute ticks inside the ring
    dc.setPenWidth(2);
    dc.setColor(st === 1 ? 0x1f6a34 : 0x4a4a4a, -1);
    for (let k = 0; k < 4; k++) G.tick(dc, cx, cy, 136, 143, k * 90);

    // ---- time (top)
    const tp = G.ease(p * 1.5 - 0.2);
    dc.setColor(G.dim(0xffffff, tp), -1);
    F.st(dc, G.timeStr(d), cx, 112, 30, 4, 1, G.easeInOut(p * 1.4 - 0.1), 0);

    // ---- heart + HR
    const hr = d.hr;
    const per = 60000.0 / Math.max(hr > 0 ? hr : 60, 40);
    let k = t / per - Math.floor(t / per) - 0.29;
    if (k < 0) k += 1;
    const beat = k < 0.04 ? k / 0.04 : Math.exp(-(k - 0.04) * 7);
    const hrs = hr > 0 ? "" + hr : "--";
    const wn = F.stW(hrs, 60);
    const gw = 30 + 14 + wn + 10 + F.pxW("BPM", 2);
    const gx0 = cx - gw / 2;
    const hx = gx0 + 15, hy = 182;
    const hsz = 14 * G.spring(G.clamp(p * 2 - 0.5, 0, 1)) * (1 + 0.2 * beat);
    if (hsz > 0.5) {
      if (beat > 0.08) {
        dc.setColor(G.argb(34 * beat, main), -1);
        dc.fillCircle(hx, hy, hsz * 1.6);
      }
      dc.setColor(main, -1);
      heart(dc, hx, hy, hsz);
    }
    dc.setColor(st === 1 ? MONGREEN : 0xffffff, -1);
    F.st(dc, hrs, gx0 + 44, 184, 60, 7, 0, G.easeInOut(p * 1.4 - 0.2), 0);
    dc.setColor(G.dim(st === 1 ? MONGREEN : 0xaaaaaa, tp), -1);
    F.px(dc, "BPM", gx0 + 54 + wn, 199, 2, 0, 0);

    // ---- ECG sweep
    const ep = G.clamp(p * 2.5 - 1.5, 0, 1);
    if (ep > 0) {
      const x0 = 97, W = 260, by = 272, amp = 36;
      const v = W / 2800.0;
      const tv = (W - 16) / v; // visible span (gap ahead of the cursor)
      const xc = x0 + ((t * v) % W);
      const ecol = hr > 0 ? (st === 2 ? 0xffffff : main) : 0x555555;
      const t0 = t - tv;
      let pt = t0, px = xc - tv * v, py = by - amp * ecg(t0, per);
      if (px < x0) px += W;
      const b0 = Math.floor(t0 / per), b1 = Math.floor(t / per);
      dc.setPenWidth(3);
      for (let b = b0; b <= b1 + 1; b++) {
        for (let j = 0; j <= 13; j++) {
          let tm = j < 13 ? (b + EK_P[j]) * per : -1;
          if (j === 13) { if (b !== b1 + 1) continue; tm = t; }
          if (tm <= pt || tm > t) continue;
          let nx = xc - (t - tm) * v;
          if (nx < x0) nx += W;
          const ny = by - amp * (j < 13 ? EK_V[j] : ecg(t, per));
          const age = (t - (tm + pt) / 2) / tv;
          dc.setColor(G.dim(ecol, ep * (1 - 0.9 * age)), -1);
          if (nx >= px) {
            dc.drawLine(px, py, nx, ny);
          } else {
            // wrap at the right edge
            const f = (x0 + W - px) / (nx + W - px);
            const wy = py + (ny - py) * f;
            dc.drawLine(px, py, x0 + W, wy);
            dc.drawLine(x0, wy, nx, ny);
          }
          pt = tm; px = nx; py = ny;
        }
      }
      // cursor head
      dc.setColor(G.argb(1 + 89 * ep, ecol), -1);
      dc.fillCircle(px, py, 7);
      dc.setColor(G.dim(0xffffff, ep), -1);
      dc.fillCircle(px, py, 3);
    }

    // ---- stats
    const labels = ["RUHE", "MIN", "MAX"];
    const vals = [d.rhr > 0 ? "" + d.rhr : "--", mx > 0 ? "" + mn : "--", mx > 0 ? "" + mx : "--"];
    for (let i = 0; i < 3; i++) {
      const sp = G.stag(p, i, 0.1, 0.5);
      if (sp <= 0) continue;
      const x = cx + (i - 1) * 70;
      dc.setColor(G.dim(st === 1 ? 0x2f9a50 : 0x8a8a8a, sp), -1);
      F.px(dc, labels[i], x, 318, 2, 1, 0);
      dc.setColor(G.dim(st === 1 ? MONGREEN : d.dcol, sp), -1);
      F.st(dc, vals[i], x, 347, 20, 3, 1, 1.0, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const hs = d.hrHist;
    const n = hs.length;
    const cx = 227 + o[0], cy = 227 + o[1];
    let mn = 999, mx = -1;
    for (let i = 0; i < n; i++) {
      const v = hs[i];
      if (v > 0) { if (v < mn) mn = v; if (v > mx) mx = v; }
    }
    const lo = d.rhr > 0 ? d.rhr - 6 : (mx > 0 ? mn - 6 : 40);
    const hi = Math.max(mx + 8, lo + 50);
    const col = st === 1 ? 0x1f8a3c : G.dim(st === 3 ? d.accent : 0x8aa0c0, 0.6);
    dc.setColor(col, -1);
    for (let i = 0; i < n && i < 60; i++) {
      const v = hs[i];
      if (v <= 0) continue;
      const ang = (i + 1 + 60 - n) * 6;
      const r = 156 + 50 * G.clamp((v - lo) / (hi - lo), 0, 1);
      dc.fillCircle(G.ptX(cx, r, ang), G.ptY(cy, r, ang), 2);
    }
    dc.setColor(0x8a8a8a, -1);
    F.st(dc, G.timeStr(d), cx, cy - 10, 60, 3, 1, 1.0, 0);
    dc.setColor(col, -1);
    heart(dc, cx - 22, cy + 52, 6);
    F.px(dc, d.hr > 0 ? "" + d.hr : "--", cx - 8, cy + 46, 2, 0, 0);
  },
};
