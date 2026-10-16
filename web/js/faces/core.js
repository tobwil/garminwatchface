// CORE — "Energy Core": the round display is a glass tank, Body Battery is the
// liquid level. Waves get choppier with stress, bubbles rise, the 24 h Body
// Battery history is etched on the glass at the same scale as the liquid.
// Styles: 1 Plasma, 2 Ozean, 3 Lava. Mirrors watch/source/faces/Core.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

// liquid level (y) for a Body Battery value 0..100
function lvlY(v) {
  return 446 - v * 4.16;
}

// x of the right glass edge at height y (inset by `ins`)
function edgeX(y, ins) {
  const dy = y - 227;
  const q = 227 * 227 - dy * dy;
  return 227 + (q > 0 ? Math.sqrt(q) : 0) - ins;
}

// palette: [high, mid, low] per style
function pal(st, k) {
  if (st === 2) return k === 0 ? 0x22d3ee : k === 1 ? 0x2563eb : 0x5b3fd6;
  if (st === 3) return k === 0 ? 0xffc53d : k === 1 ? 0xff6a00 : 0xd0142c;
  return k === 0 ? 0x29e6ff : k === 1 ? 0xa6ff4d : 0xff4a2a;
}

// colour at the bottom of the tank
function deep(st) {
  return st === 2 ? 0x020a26 : st === 3 ? 0x240300 : 0x170a40;
}

function liqCol(st, bb) {
  const f = G.clamp(bb / 100.0, 0, 1);
  if (f > 0.5) return G.mix(pal(st, 1), pal(st, 0), (f - 0.5) * 2);
  return G.mix(pal(st, 2), pal(st, 1), f * 2);
}

// wave height at x
function wave(x, t, amp, w, ph) {
  return amp * (0.62 * Math.sin(x * 0.021 + t * w * 0.0021 + ph)
    + 0.38 * Math.sin(x * 0.047 - t * w * 0.0033 + 1.7 + ph)
    + 0.18 * Math.sin(x * 0.113 + t * w * 0.0061 + ph * 2.0));
}

function wavePoly(lv, t, amp, w, ph) {
  const pts = [];
  for (let i = 0; i <= 31; i++) {
    const x = i * 15.2;
    pts.push([x, lv + wave(x, t, amp, w, ph)]);
  }
  pts.push([454, 454]);
  pts.push([0, 454]);
  return pts;
}

export default {
  fps: 20,

  draw(dc, d, a) {
    const st = d.cfg.style;
    const p = a.intro;
    const t = a.t;
    const cx = 227;
    const bb = d.bb < 0 ? 50 : d.bb;
    const sv = d.stress < 0 ? 30 : d.stress;
    const ch = G.clamp((sv - 15) / 70.0, 0, 1);
    let amp = 5 + 13 * ch;
    const w = 0.5 + 2.2 * ch;
    const c = liqCol(st, bb);
    const target = lvlY(bb);
    // intro: liquid rises with overshoot, sloshing waves
    const rp = G.clamp(p * 1.25 - 0.25, 0, 1);
    const lv = 454 + (target - 454) * G.spring(rp);
    amp += 26 * (1 - p) * (1 - p);

    // ---- glass back
    dc.setPenWidth(2);
    dc.setColor(0x1c1c1c, -1);
    dc.drawCircle(cx, 227, 224);

    // ---- back wave
    let back = G.dim(G.mix(c, 0x7a3cff, 0.55), 0.42);
    if (st === 2) back = G.dim(G.mix(c, 0x0a1a5c, 0.5), 0.55);
    if (st === 3) back = G.dim(G.mix(c, 0xff1e00, 0.5), 0.42);
    dc.setColor(back, -1);
    dc.fillPolygon(wavePoly(lv - 8, t, amp * 1.2, w * 0.8, 2.3));

    // ---- front wave + depth gradient
    const front = wavePoly(lv, t, amp, w, 0);
    const top = st === 3 ? G.dim(G.mix(c, 0xff2000, 0.45), 0.42) : G.dim(c, 0.40);
    dc.setColor(top, -1);
    dc.fillPolygon(front);
    const y0 = lv + amp * 1.25 + 10;
    if (y0 < 454) {
      const step = (454 - y0) / 8.0;
      for (let k = 1; k <= 7; k++) {
        const yb = y0 + step * k - step * 0.5;
        dc.setColor(G.mix(top, deep(st), k / 7.5), -1);
        dc.fillRectangle(0, yb, 454, k === 7 ? 455 - yb : step + 1);
      }
    }

    // ---- surface glow line
    dc.setPenWidth(7);
    dc.setColor(G.argb(60, c), -1);
    for (let i = 0; i < 31; i++) dc.drawLine(front[i][0], front[i][1], front[i + 1][0], front[i + 1][1]);
    dc.setPenWidth(3);
    dc.setColor(G.mix(c, 0xffffff, 0.25), -1);
    for (let i = 0; i < 31; i++) dc.drawLine(front[i][0], front[i][1], front[i + 1][0], front[i + 1][1]);

    // ---- bubbles / particles / blobs
    const n = st === 3 ? 6 : 9;
    let seed = 7919;
    for (let i = 0; i < n; i++) {
      seed = G.rnd(seed + i * 131);
      const r1 = G.rf(seed);
      seed = G.rnd(seed);
      const r2 = G.rf(seed);
      seed = G.rnd(seed);
      const r3 = G.rf(seed);
      const span = 470 - lv;
      if (span < 30) continue;
      const v = st === 3 ? 9 + r2 * 9 : 22 + r2 * 34 + 30 * ch;
      const yy = 470 - ((t * v / 1000.0 + r3 * span) % span);
      const xx = 70 + r1 * 314 + Math.sin(t * 0.0017 + i * 1.9) * (st === 3 ? 10 : 7);
      const surf = lv + wave(xx, t, amp, w, 0);
      const fade = G.clamp((yy - surf) / 40.0, 0, 1);
      if (fade < 0.05) continue;
      if (st === 3) {
        const rr = 7 + r1 * 10;
        const wob = Math.sin(t * 0.002 + i) * 0.18;
        dc.setColor(G.argb(80 * fade, c), -1);
        dc.fillEllipse(xx, yy, rr * (1 + wob) + 5, rr * (1 - wob) + 5);
        dc.setColor(G.mix(top, G.mix(c, 0xffd36a, 0.4), fade), -1);
        dc.fillEllipse(xx, yy, rr * (1 + wob), rr * (1 - wob));
      } else if (st === 2) {
        const rr = 2.5 + r1 * 4;
        dc.setPenWidth(2);
        dc.setColor(G.dim(G.mix(c, 0xffffff, 0.5), 0.75 * fade), -1);
        dc.drawCircle(xx, yy, rr);
        dc.fillCircle(xx - rr * 0.35, yy - rr * 0.35, 1);
      } else {
        const rr = 1.6 + r1 * 1.6;
        dc.setColor(G.argb(70 * fade, 0xb48cff), -1);
        dc.fillCircle(xx, yy, rr + 4);
        dc.setColor(G.mix(c, 0xffffff, 0.6 * fade), -1);
        dc.fillCircle(xx, yy, rr);
      }
    }

    // ---- splash droplets (intro)
    if (p > 0.6 && p < 1) {
      const tau = (p - 0.6) * 1.5;
      let s2 = 4241;
      for (let i = 0; i < 7; i++) {
        s2 = G.rnd(s2 + i * 17);
        const vx = (G.rf(s2) - 0.5) * 90;
        s2 = G.rnd(s2);
        const vy = -(150 + G.rf(s2) * 140);
        const dx = 90 + i * 46 + vx * tau;
        const dy = target + vy * tau + 450 * tau * tau;
        if (dy < target - 4) {
          dc.setColor(G.mix(c, 0xffffff, 0.3), -1);
          dc.fillCircle(dx, dy, 3.2 - i % 3 * 0.6);
        }
      }
    }

    // ---- 24h history etched on the glass (same scale as the liquid)
    const hs = d.bbHist;
    const hn = hs.length;
    if (hn > 1) {
      const hp = G.ease(p * 1.4 - 0.3);
      const lim = Math.floor((hn - 1) * hp);
      dc.setPenWidth(2);
      dc.setColor(G.dim(G.mix(c, 0xffffff, 0.45), 0.42), -1);
      for (let i = 0; i < lim; i++) {
        const v1 = hs[i], v2 = hs[i + 1];
        if (v1 < 0 || v2 < 0) continue;
        const ya = lvlY(v1), yb = lvlY(v2);
        const xa = 84 + i * 286.0 / (hn - 1);
        // the line passes behind the time
        if ((ya + yb) / 2 > 156 && (ya + yb) / 2 < 268) continue;
        dc.drawLine(xa, ya, xa + 286.0 / (hn - 1), yb);
      }
    }

    // ---- measuring scale on the right glass edge + level marker
    dc.setPenWidth(2);
    for (let v = 0; v <= 100; v += 10) {
      const y = lvlY(v);
      const big = v % 50 === 0;
      dc.setColor(y > lv ? G.mix(c, 0xffffff, 0.3) : 0x4a4a4a, -1);
      dc.drawLine(edgeX(y, big ? 22 : 15), y, edgeX(y, 5), y);
    }
    const my = lv;
    dc.setColor(0xffffff, -1);
    dc.setPenWidth(3);
    dc.drawLine(edgeX(my, 34), my, edgeX(my, 5), my);
    dc.fillCircle(edgeX(my, 34), my, 3);

    // ---- glass highlights
    dc.setColor(0x5a5a5a, -1);
    G.capArc(dc, cx, 227, 212, 3, 296, 332);
    dc.setColor(0x2c2c2c, -1);
    G.capArc(dc, cx, 227, 212, 3, 338, 344);

    // ---- text
    const tp = G.ease(p * 1.6 - 0.25);
    dc.setColor(G.dim(G.mix(c, 0xffffff, 0.35), tp), -1);
    F.px(dc, "BODY BATTERY", cx, 52, 2, 1, 0);
    const bbs = d.bb < 0 ? "--" : "" + Math.round(bb * G.ease(p));
    dc.setColor(G.dim(0xffffff, tp), -1);
    F.st(dc, bbs, cx, 94, 38, 5, 1, 1.0, 0);

    const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
    const ts = hh + ":" + G.pad2(d.m);
    const wp = G.easeInOut(p * 1.3 - 0.15);
    dc.setColor(0xffffff, -1);
    F.st(dc, ts, cx, 212, 96, 8, 1, wp, 0);

    dc.setColor(G.dim(0xd0d0d0, tp), -1);
    F.px(dc, d.dowStr + " " + d.day + " " + d.monStr, cx, 282, 2, 1, 0);

    // slots (skip a Body Battery slot: it is the liquid itself)
    let ns = 0;
    for (let k = 0; k < 3; k++) if (d.slots[k].lbl !== "B-BATT") ns++;
    let j = 0;
    for (let k = 0; k < 3; k++) {
      const sl = d.slots[k];
      if (sl.lbl === "B-BATT") continue;
      const x = cx + (j - (ns - 1) / 2.0) * 112;
      const sp = G.stag(p, j, 0.12, 0.5);
      j++;
      if (sp <= 0) continue;
      dc.setColor(G.dim(0xb8b8b8, sp), -1);
      F.px(dc, sl.lbl, x, 318, 2, 1, 0);
      dc.setColor(G.mix(0x000000, d.dcol, sp), -1);
      F.st(dc, sl.val, x, 354, 26, 4, 1, 1.0, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const bb = d.bb < 0 ? 50 : d.bb;
    const c = G.dim(G.mix(liqCol(st, bb), 0xffffff, 0.25), 0.62);
    const y = lvlY(bb) + o[1];
    const dy = y - 227;
    const q = 225 * 225 - dy * dy;
    if (q > 0) {
      const hw = Math.sqrt(q);
      // waterline + glass below it as a thin arc
      dc.setColor(c, -1);
      dc.setPenWidth(2);
      dc.drawLine(227 - hw + 8 + o[0], y, 227 + hw - 8 + o[0], y);
      const ang = Math.atan2(hw, -dy) * 180 / Math.PI;
      dc.setColor(G.dim(c, 0.5), -1);
      G.arcC(dc, 227 + o[0], 227, 221, ang, 360 - ang);
    }
    dc.setColor(0x8a8a8a, -1);
    F.st(dc, G.timeStr(d), 227 + o[0], 212 + o[1], 72, 3, 1, 1.0, 0);
    dc.setColor(c, -1);
    F.st(dc, d.bb < 0 ? "--" : "" + d.bb, 227 + o[0], 94 + o[1], 30, 2, 1, 1.0, 0);
  },
};
