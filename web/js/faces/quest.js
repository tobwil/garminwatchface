// QUEST — "Daily Quest": three deterministic daily challenges (Sunday: the 3rd is a BOSS),
// XP, levels, streak flame. Progress is persisted with St (XP is claimed once per quest/day).
// Styles: 1 Pixel, 2 Clean, 3 Neon. Mirrors watch/source/faces/Quest.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

// quest kinds: 0 steps, 1 floors, 2 active minutes today, 3 kcal, 4 distance km, 5 floors before 12:00
const QB = [6000, 9000, 13000, 6, 10, 16, 10, 25, 45, 2000, 2400, 2800, 4, 7, 10, 3, 5, 8];
const QS = [500, 1, 5, 50, 1, 1]; // rounding step
const MULT = [70, 100, 130, 170];
const XPV = [50, 100, 150, 300];
// 7x7 pixel icons, one row bitmask per line (bit 6 = left)
const ICO = [
  0x60, 0x60, 0x70, 0x78, 0x7f, 0x7f, 0x2a, // shoe
  0x03, 0x03, 0x0f, 0x0f, 0x3f, 0x3f, 0x7f, // stairs
  0x0e, 0x1c, 0x38, 0x7e, 0x0c, 0x18, 0x30, // bolt
  0x08, 0x18, 0x1c, 0x3e, 0x7f, 0x7f, 0x3e, // fire
  0x7e, 0x7c, 0x7e, 0x40, 0x40, 0x40, 0x40, // flag
  0x1c, 0x22, 0x49, 0x4f, 0x41, 0x22, 0x1c, // stopwatch
];
// streak flame 7x9: outer + inner
const FLO = [0x08, 0x0c, 0x1c, 0x1e, 0x3e, 0x7f, 0x7f, 0x7f, 0x3e];
const FLI = [0x00, 0x00, 0x00, 0x00, 0x08, 0x1c, 0x1e, 0x3e, 0x1c];
const CHK = [0x01, 0x03, 0x46, 0x6c, 0x38, 0x10, 0x00];

function leap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function dayKey(d) { return d.year * 1000 + d.doy; }
function yKey(d) { return d.doy > 1 ? d.year * 1000 + d.doy - 1 : (d.year - 1) * 1000 + (leap(d.year - 1) ? 366 : 365); }

// cumulative XP needed to reach level index L (level shown = L + 1)
function need(L) { return 50 * L * (L + 1); }
function levelOf(xp) {
  let L = 0;
  while (need(L + 1) <= xp) L++;
  return L;
}

// today's quests -> [k0,k1,k2, t0,t1,t2, x0,x1,x2]
function quests(d) {
  let s = G.rnd(G.rnd(dayKey(d)));
  const q = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const lv = G.clamp(d.cfg.quest, 0, 2);
  for (let i = 0; i < 3; i++) {
    s = G.rnd(s);
    let k = Math.floor(s / 65536) % 6;
    while ((i > 0 && q[0] === k) || (i > 1 && q[1] === k)) k = (k + 1) % 6;
    q[i] = k;
    s = G.rnd(s);
    const j = (Math.floor(s / 256) % 17) - 8;
    const mi = i === 2 && d.dow === 0 ? 3 : i;
    const st = QS[k];
    const div = 10000 * st;
    let b = QB[k * 3 + lv];
    if (k === 3) b = b - 1600;
    let t = Math.floor((b * MULT[mi] * (100 + j) + div / 2) / div) * st;
    if (k === 3) t += 1600;
    q[3 + i] = t < st ? st : t;
    q[6 + i] = XPV[mi];
  }
  return q;
}

function label(k, t) {
  if (k === 0) return G.num(t) + " SCHRITTE";
  if (k === 1) return t + " ETAGEN";
  if (k === 2) return t + " AKTIV-MIN";
  if (k === 3) return G.num(t) + " KCAL";
  if (k === 4) return t + " KM STRECKE";
  return t + " ETAGEN VOR 12";
}

// draw a 7-wide pixel bitmap: rows bitmasks from arr[off..off+rows)
function icon(dc, arr, off, rows, x, y, sc) {
  for (let r = 0; r < rows; r++) {
    const b = arr[off + r];
    if (b === 0) continue;
    for (let c = 0; c < 7; c++) if (b & (64 >> c)) dc.fillRectangle(x + c * sc, y + r * sc, sc, sc);
  }
}

// update persistent state; returns [xp, qc, streak, imToday, celebrate, celebQ]
function sync(d, q) {
  // web preview only: seed a demo profile once
  if (St.get("demoSeeded", 0) === 0) {
    St.set("demoSeeded", 1);
    St.set("xp", 2350);
    St.set("streak", 6);
    St.set("lastFull", yKey(d));
    St.set("imDay", dayKey(d));
    St.set("imBase", d.imWeek > 22 ? d.imWeek - 22 : 0);
  }
  const today = dayKey(d);
  const imw = d.imWeek > 0 ? d.imWeek : 0;
  if (St.get("imDay", -1) !== today) { St.set("imDay", today); St.set("imBase", imw); }
  let base = St.get("imBase", imw);
  if (imw < base) { base = 0; St.set("imBase", 0); }
  const im = imw - base;
  let qc = 0;
  if (St.get("qd", -1) === today) qc = St.get("qc", 0);
  else { St.set("qd", today); St.set("qc", 0); }
  let add = 0, nb = 0;
  for (let i = 0; i < 3; i++) {
    const bit = 1 << i;
    if ((qc & bit) === 0 && val(d, q[i], im) >= q[3 + i] && (q[i] !== 5 || d.h < 12)) {
      qc |= bit; nb |= bit; add += q[6 + i];
    }
  }
  let xp = St.get("xp", 0);
  if (add > 0) {
    xp += add;
    St.set("xp", xp);
    St.set("qc", qc);
    St.set("celebrate", St.get("celebrate", 0) + add);
    St.set("celebQ", St.get("celebQ", 0) | nb);
  }
  let lf = St.get("lastFull", -1);
  let sk = St.get("streak", 0);
  if (qc === 7 && lf !== today) {
    sk = lf === yKey(d) ? sk + 1 : 1;
    lf = today;
    St.set("streak", sk);
    St.set("lastFull", today);
  }
  if (lf !== today && lf !== yKey(d)) sk = 0;
  return [xp, qc, sk, im, St.get("celebrate", 0), St.get("celebQ", 0)];
}

function val(d, k, im) {
  if (k === 0) return d.steps;
  if (k === 1 || k === 5) return d.floors;
  if (k === 2) return im;
  if (k === 3) return d.kcal;
  return d.distM / 1000.0;
}


export default {
  fps: 8,

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const cx = 227;
    const q = quests(d);
    const S = sync(d, q);
    const xp = S[0], qc = S[1], sk = S[2], im = S[3], celeb = S[4], cq = S[5];
    const boss = d.dow === 0;
    const red = 0xff4a3d;
    const good = st === 1 ? 0x3cd070 : 0x5fe08a;

    // ---------------- XP ring
    const L = levelOf(xp);
    const lf = (xp - need(L)) / (100.0 * (L + 1));
    const rf = lf * G.ease(G.stag(p, 0, 0, 0.7));
    if (st === 1) {
      const lit = Math.floor(rf * 60 + 0.001);
      dc.setPenWidth(9);
      for (let i = 0; i < 60; i++) {
        dc.setColor(i < lit ? acc : 0x2a2440, -1);
        G.arcC(dc, cx, cx, 216, i * 6 + 1, i * 6 + 5);
      }
    } else if (st === 2) {
      G.ring(dc, cx, cx, 216, 4, rf, acc, 0x262626);
    } else {
      dc.setPenWidth(12);
      dc.setColor(G.dim(acc, 0.22), -1);
      if (rf > 0.004) G.arcC(dc, cx, cx, 214, 0, rf * 360);
      G.ring(dc, cx, cx, 214, 4, rf, acc, 0x1e1e1e);
      if (rf > 0.004) {
        dc.setColor(0xffffff, -1);
        dc.fillCircle(G.ptX(cx, 214, rf * 360), G.ptY(cx, 214, rf * 360), 3);
      }
    }

    // ---------------- level + streak
    const tp = G.ease(G.stag(p, 1, 0.08, 0.5));
    const ty = (1 - tp) * -40;
    const lv = "LVL " + (L + 1);
    const lw = F.pxW(lv, 3);
    const sks = "" + sk;
    const sw = 21 + 6 + F.pxW(sks, 3);
    const x0 = cx - (lw + 26 + sw) / 2;
    dc.setColor(st === 1 ? acc : 0xffffff, -1);
    if (st === 1) F.px(dc, lv, x0, 52 + ty, 3, 0, 0);
    else F.st(dc, lv, x0 + lw / 2, 62 + ty, 20, 3, 1, 1.0, 0);
    // flame (flickers in ambient)
    const fx = x0 + lw + 26;
    const fl = a.live && p >= 1 ? G.noise(a.t / 140.0) : 0;
    const sh = fl > 0.35 ? 1 : fl < -0.35 ? -1 : 0;
    const fc = sk > 0 ? 0xff6a1a : 0x4a4a4a;
    dc.setColor(fc, -1);
    for (let r = 0; r < 9; r++) {
      const b = FLO[r];
      const o = r < 3 ? sh * 3 : 0;
      for (let c = 0; c < 7; c++) if (b & (64 >> c)) dc.fillRectangle(fx + c * 3 + o, 48 + ty + r * 3, 3, 3);
    }
    if (sk > 0) {
      dc.setColor(fl > 0.1 ? 0xfff0a0 : 0xffd23d, -1);
      const lift = fl > 0.6 ? 1 : 0;
      for (let r = 4 - lift; r < 9; r++) {
        const b = FLI[r + lift];
        for (let c = 0; c < 7; c++) if (b & (64 >> c)) dc.fillRectangle(fx + c * 3, 48 + ty + r * 3, 3, 3);
      }
    }
    dc.setColor(sk > 0 ? 0xffffff : 0x777777, -1);
    F.px(dc, sks, fx + 27, 52 + ty, 3, 0, 0);
    // xp text
    dc.setColor(0x8a8a8a, -1);
    F.px(dc, G.num(xp - need(L)) + "/" + G.num(100 * (L + 1)) + " XP", cx, 86 + ty, 2, 1, 0);

    // ---------------- time
    const tc = celeb > 0 && p < 1 ? G.mix(0x000000, 0xffffff, G.clamp((p - 0.55) / 0.35, 0, 1)) : 0xffffff;
    const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
    const ts = hh + ":" + G.pad2(d.m);
    if (st === 1) {
      dc.setColor(tc, -1);
      F.px(dc, ts, cx, 114, 10, 1, 1);
    } else {
      if (st === 3) {
        dc.setColor(G.mix(0x000000, acc, 0.3 * ((tc & 255) / 255.0)), -1);
        F.st(dc, ts, cx, 152, 76, 14, 1, 1.0, 0);
      }
      dc.setColor(tc, -1);
      F.st(dc, ts, cx, 152, 76, st === 3 ? 5 : 6, 1, 1.0, 0);
    }
    // celebration burst (on top of the dimmed time)
    if (celeb > 0 && p < 1) {
      const b = p;
      const e = G.ease(b / 0.8);
      const fade = G.clamp((1 - b) / 0.35, 0, 1);
      dc.setColor(G.mix(0x000000, acc, fade), -1);
      dc.setPenWidth(3);
      for (let i = 0; i < 12; i++) {
        const ang = i * 30 + 15;
        const r0 = 60 + 40 * e, r1 = 72 + 56 * e;
        dc.drawLine(G.ptX(cx, r0, ang), G.ptY(152, r0 * 0.4, ang), G.ptX(cx, r1, ang), G.ptY(152, r1 * 0.4, ang));
      }
      dc.setColor(G.mix(0x000000, 0xffffff, fade), -1);
      const bs = G.spring(b / 0.5);
      if (st === 1) F.px(dc, "+" + celeb + " XP", cx, 152 - 17 * bs, Math.round(1 + 4 * bs), 1, 0);
      else F.st(dc, "+" + celeb + " XP", cx, 152, 18 + 22 * bs, 4, 1, 1.0, 0);
    }
    dc.setColor(boss ? red : 0x8a8a8a, -1);
    F.px(dc, boss ? "SONNTAG: BOSS-QUEST!" : d.dowStr + " " + d.day + ". " + d.monStr, cx, 200, 2, 1, 0);

    // ---------------- quest rows
    if (st === 1) {
      // RPG dialog box
      dc.setColor(0x0e0b22, -1);
      dc.fillRectangle(82, 228, 290, 140);
      dc.setColor(0xe8e8e8, -1);
      dc.setPenWidth(2);
      dc.drawRectangle(82, 228, 290, 140);
      dc.setColor(0x5a5390, -1);
      dc.drawRectangle(87, 233, 280, 130);
    }
    for (let i = 0; i < 3; i++) {
      const y = 254 + i * 42;
      const k = q[i], t = q[3 + i];
      const isB = boss && i === 2;
      const done = (qc & (1 << i)) !== 0;
      const fail = !done && k === 5 && d.h >= 12;
      const rp = G.stag(p, i, 0.12, 0.6);
      const col = isB ? red : acc;
      // icon
      dc.setColor(done ? good : fail ? 0x555555 : col, -1);
      icon(dc, ICO, k * 7, 7, 96, y - 12, 3);
      // label
      dc.setColor(fail ? 0x666666 : 0xe6e6e6, -1);
      if (st === 1) F.px(dc, label(k, t), 128, y - 13, 2, 0, 0);
      else F.st(dc, label(k, t), 128, y - 8, 16, 2, 0, 1.0, 0);
      // bar
      const v = val(d, k, im);
      const fr = done ? 1 : G.clamp(v / t, 0, 1);
      const bf = fr * G.easeInOut(rp);
      const bx = 128, bw = 184, by = y + 6;
      if (st === 1) {
        const n = 10, gw = 3, cw = (bw - (n - 1) * gw) / n;
        const lit = Math.floor(bf * n + 0.001);
        for (let c = 0; c < n; c++) {
          dc.setColor(c < lit ? (done ? good : col) : 0x2a2440, -1);
          dc.fillRectangle(bx + c * (cw + gw), by, cw, 7);
        }
      } else if (st === 2) {
        dc.setColor(0x2a2a2a, -1);
        dc.fillRoundedRectangle(bx, by + 1, bw, 4, 2);
        if (bf > 0.01) {
          dc.setColor(done ? good : col, -1);
          dc.fillRoundedRectangle(bx, by + 1, bw * bf, 4, 2);
        }
      } else {
        dc.setColor(G.dim(col, 0.35), -1);
        dc.setPenWidth(1);
        dc.drawRoundedRectangle(bx, by - 1, bw, 8, 4);
        if (bf > 0.01) {
          dc.setColor(G.dim(done ? good : col, 0.3), -1);
          dc.fillRoundedRectangle(bx - 2, by - 3, bw * bf + 4, 12, 6);
          dc.setColor(done ? good : col, -1);
          dc.fillRoundedRectangle(bx, by - 1, bw * bf, 8, 4);
        }
      }
      // right: check / xp reward / fail
      const rx = 344;
      if (done) {
        const cp = G.spring(G.stag(p, i + 3, 0.1, 0.4));
        if (cp > 0) {
          const csc = 4 * cp;
          if ((cq & (1 << i)) !== 0 && p < 1) {
            dc.setColor(G.dim(good, 1 - p), -1);
            dc.setPenWidth(2);
            dc.drawCircle(rx, y - 2, 10 + 22 * p);
          }
          dc.setColor(good, -1);
          for (let r = 0; r < 7; r++) {
            const b = CHK[r];
            for (let c = 0; c < 7; c++) if (b & (64 >> c)) dc.fillRectangle(rx - 14 * cp + c * csc, y - 2 - 14 * cp + r * csc, csc, csc);
          }
        }
      } else if (fail) {
        dc.setColor(0x666666, -1);
        F.px(dc, "X", rx, y - 9, 2, 1, 0);
      } else {
        dc.setColor(G.dim(col, 0.85), -1);
        F.px(dc, "+" + q[6 + i], rx, y - 9, 2, 1, 0);
      }
    }

    // celebration shown -> clear
    if (celeb > 0 && p >= 1) { St.set("celebrate", 0); St.set("celebQ", 0); }
  },

  aod(dc, d) {
    const q = quests(d);
    const S = sync(d, q);
    const o = St.shift(d);
    const cx = 227 + o[0];
    const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
    dc.setColor(0x9a9a9a, -1);
    F.st(dc, hh + ":" + G.pad2(d.m), cx, 200 + o[1], 76, 3, 1, 1.0, 0);
    const L = levelOf(S[0]);
    dc.setColor(G.dim(d.accent, 0.4), -1);
    dc.setPenWidth(2);
    G.arcC(dc, cx, 227 + o[1], 214, 0, ((S[0] - need(L)) * 360.0) / (100.0 * (L + 1)));
    dc.setColor(G.dim(d.accent, 0.6), -1);
    F.px(dc, "LVL " + (L + 1), cx, 116 + o[1], 2, 1, 0);
    for (let i = 0; i < 3; i++) {
      const x = cx - 16 + i * 16, y = 270 + o[1];
      if ((S[1] & (1 << i)) !== 0) dc.fillCircle(x, y, 4);
      else { dc.setPenWidth(1); dc.drawCircle(x, y, 4); }
    }
  },
};
