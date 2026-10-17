// SCAN — "KI-Vision": the display is a camera feed running an object detector. A scan line
// sweeps down and every object it passes is locked with corner-bracket boxes: three data
// slots ("STRESS 97%" + value) and the time ("UHRZEIT 99,9%"). Every wrist raise re-detects
// (new confidences from wakeN); while awake the boxes gently track.
// Styles: 1 Terminator (red HUD), 2 Clean (labelling tool), 3 Thermal (heat camera).
// Mirrors watch/source/faces/Scan.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const SP = 2000; // scan period (ms): 520 px sweep
const LOCK = 380; // lock-on animation (ms)
const CC = [0x00c2ff, 0xffd60a, 0x30d158]; // Clean: class colours of the slots
// thermal palette stops (v = 0, .25, .45, .7, .9, 1)
const TV = [0, 0.25, 0.45, 0.7, 0.9, 1.0];
const TC = [0x05020e, 0x2a0a5e, 0x9b1f8a, 0xff6a00, 0xffd200, 0xfff6c0];
// box geometry (x, y, w, h) filled per frame: 0..2 slots, 3 time
const BX = [0, 0, 0, 0];
const BY = [70, 300, 300, 148];
const BW = [0, 0, 0, 280];
const BH = [52, 54, 54, 116];

// heat map runs (x, y, w, colour) of the thermal background
const RX = [], RY = [], RW = [], RC = [];
let RN = 0;
// heat blobs: x, y, radius, base amplitude, amplitude per heat
const HB = [227, 215, 160, 0.36, 0.45, 112, 335, 95, 0.25, 0.3, 345, 322, 105, 0.22, 0.35, 262, 70, 85, 0.18, 0.3, 58, 170, 75, 0.12, 0.25];

// per-cell heat = 0.1 + A + H * B; A and B (x1000, ints) depend only on the geometry
let HA = null, HM = null;

function heatPrep() {
  HA = []; HM = [];
  for (let r = 0; r < 19; r++) {
    for (let c = 0; c < 19; c++) {
      const cx = c * 24 + 11, cy = r * 24 + 11;
      let sa = 0, sm = 0;
      for (let b = 0; b < 25; b += 5) {
        const dx = cx - HB[b], dy = cy - HB[b + 1];
        const f = 1 - (dx * dx + dy * dy) / (HB[b + 2] * HB[b + 2]);
        if (f > 0) { sa += HB[b + 3] * f * f; sm += HB[b + 4] * f * f; }
      }
      HA.push(Math.round(sa * 1000)); HM.push(Math.round(sm * 1000));
    }
  }
}

function heat(d) {
  if (HA === null) heatPrep();
  const H = Math.round(G.clamp((d.hr > 0 ? (d.hr - 50) / 80 : 0.2) + (d.stress >= 0 ? d.stress / 200 : 0.1), 0, 1) * 1000);
  RN = 0;
  for (let r = 0; r < 19; r++) {
    const y = r * 24 - 1;
    const cy = y + 12;
    let q0 = -1, x0 = 0;
    for (let c = 0; c <= 19; c++) {
      let q = -1;
      const cx = c * 24 - 1 + 12;
      if (c < 19 && (cx - 227) * (cx - 227) + (cy - 227) * (cy - 227) < 245 * 245) {
        const v = 100000 + HA[r * 19 + c] * 1000 + HM[r * 19 + c] * H; // x 1e6
        q = v >= 1000000 ? 11 : Math.floor((v * 12) / 1000000);
      }
      if (q !== q0) {
        if (q0 >= 0) { RX[RN] = x0; RY[RN] = y; RW[RN] = c * 24 - 1 - x0; RC[RN] = therm(q0 / 11); RN++; }
        q0 = q; x0 = c * 24 - 1;
      }
    }
  }
}

// verdict on the main object (you): fit / stressed / tired / ok
const VQ = [
  ["MENSCH: STARTKLAR", "ZIEL: KOM-JÄGER", "MODUS: ANGRIFF"],
  ["MENSCH: UNTER STROM", "EMPFEHLUNG: ATMEN", "STRESSQUELLE: DU"],
  ["MENSCH: AKKU LEER", "EMPFEHLUNG: SOFA", "SCHLAFBEDARF HOCH"],
  ["MENSCH: STABIL", "ZUSTAND: SOLIDE", "KEINE ANOMALIEN"],
  ["SIGNAL UNSCHARF", "ZU WENIG DATEN", "OBJEKT VERDECKT"],
];

function verdict(d) {
  const k = d.bb < 0 && d.stress < 0 ? 4 : d.stress >= 60 ? 1 : d.bb >= 0 && d.bb < 30 ? 2 : d.bb >= 60 && d.stress < 40 ? 0 : 3;
  return VQ[k][d.wakeN % 3];
}

function therm(v) {
  v = G.clamp(v, 0, 1);
  let k = 1;
  while (k < 5 && v > TV[k]) k++;
  return G.mix(TC[k - 1], TC[k], (v - TV[k - 1]) / (TV[k] - TV[k - 1]));
}

// scan line y at time t (first sweep starts above the screen)
function scanY(t) { return ((t % SP) / SP) * 520 - 30; }

// ms (since wake) at which the first sweep passes y
function passT(y) { return ((y + 30) / 520) * SP; }

// corner brackets around x,y,w,h with arm length cl
function brackets(dc, x, y, w, h, cl) {
  dc.drawLine(x, y, x + cl, y); dc.drawLine(x, y, x, y + cl);
  dc.drawLine(x + w, y, x + w - cl, y); dc.drawLine(x + w, y, x + w, y + cl);
  dc.drawLine(x, y + h, x + cl, y + h); dc.drawLine(x, y + h, x, y + h - cl);
  dc.drawLine(x + w, y + h, x + w - cl, y + h); dc.drawLine(x + w, y + h, x + w, y + h - cl);
}

// label chip "<lbl> · <conf>" typed out to n characters; returns chip width
function chip(dc, x, y, lbl, conf, n, bg, fg) {
  const txt = lbl + "  " + conf;
  const w = F.pxW(txt, 2) + 8;
  n = G.clamp(n, 0, txt.length);
  if (n <= 0) return w;
  const wn = n >= txt.length ? w : F.pxW(txt.substring(0, n), 2) + 8;
  dc.setColor(bg, -1);
  dc.fillRectangle(x, y, wn, 18);
  dc.setColor(fg, -1);
  F.px(dc, txt.substring(0, n), x + 4, y + 2, 2, 0, 0);
  if (n > lbl.length + 1) dc.fillRectangle(x + 4 + lbl.length * 12 + 9, y + 7, 3, 3);
  return w;
}

function outline(dc, txt, x, y, h, pen, col, glow) {
  dc.setColor(glow, -1);
  F.st(dc, txt, x, y, h, pen + 6, 1, 1.0, 0);
  dc.setColor(col, -1);
  F.st(dc, txt, x, y, h, pen, 1, 1.0, 0);
}

export default {
  get fps() { return 15; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const live = a.live;
    const t = live ? a.t : 99999;
    const tt = live ? a.t : 0;
    const wk = d.wakeN;

    // ---- camera background
    if (st === 3) {
      // low-res heat sensor image (24 px cells), driven by heart rate and stress
      heat(d);
      for (let k = 0; k < RN; k++) {
        dc.setColor(RC[k], -1);
        dc.fillRectangle(RX[k], RY[k], RW[k], 24);
      }
    } else if (st === 2) {
      dc.setColor(0x0e1014, -1);
      dc.fillCircle(227, 227, 227);
      dc.setColor(0x171b22, -1);
      for (let g = 37; g < 454; g += 38) {
        dc.drawLine(g, 0, g, 454);
        dc.drawLine(0, g, 454, g);
      }
    } else {
      dc.setColor(0x140101, -1);
      dc.fillCircle(227, 227, 227);
      dc.setColor(0x220404, -1);
      dc.fillCircle(227, 227, 150);
      dc.setColor(0x0a0000, -1);
      for (let y = 2; y < 454; y += 4) dc.fillRectangle(0, y, 454, 1);
    }
    // sensor noise
    if (st !== 3) {
      let sd = 77 + Math.floor(tt / 66);
      dc.setColor(st === 1 ? 0x3a0c0c : 0x262b33, -1);
      for (let k = 0; k < 36; k++) {
        sd = G.rnd(sd);
        const x = 20 + (sd % 414);
        sd = G.rnd(sd);
        const y = 20 + (sd % 414);
        dc.fillRectangle(x, y, 2, 2);
      }
    }

    // ---- style colours
    const hud = st === 1 ? acc : st === 2 ? 0x8e96a3 : 0xffffff; // reticle / status
    const txt = st === 1 ? 0xffe2dc : 0xffffff;
    const dark = st === 1 ? 0x140101 : st === 2 ? 0x0b0d10 : 0x000000;

    // ---- viewfinder reticle: lens ring with ticks + four chevrons
    dc.setColor(G.dim(hud, st === 3 ? 0.7 : 0.35), -1);
    dc.setPenWidth(1);
    dc.drawCircle(227, 227, 214);
    for (let k = 0; k < 36; k++) G.tick(dc, 227, 227, k % 9 === 0 ? 200 : 208, 214, k * 10);
    dc.setColor(G.dim(hud, 0.8), -1);
    dc.setPenWidth(2);
    for (let k = 0; k < 4; k++) {
      const deg = k * 90;
      G.tick(dc, 227, 227, 186, 200, deg);
      G.tick(dc, 227, 227, 186, 186 + 8, deg - 4);
      G.tick(dc, 227, 227, 186, 186 + 8, deg + 4);
    }

    // ---- box layout (widths follow the content)
    const big = st !== 2; // Terminator / Thermal: dot-matrix values
    for (let i = 0; i < 3; i++) {
      const v = d.slots[i].val;
      const vw = big ? F.pxW(v, v.length > 5 ? 3 : 4) : F.stW(v, 28);
      BW[i] = Math.max(Math.max(124, F.pxW(d.slots[i].lbl + "  99%", 2) + 8), Math.round(vw / 2) * 2 + 36);
    }
    BX[0] = 227 - BW[0] / 2;
    BX[1] = 212 - BW[1];
    BX[2] = 242;
    BX[3] = 87;

    // ---- objects: slots 0..2 and the time (3)
    let found = 0, nObj = 1; // the time plus every non-empty slot
    for (let k = 0; k < 3; k++) if (d.slots[k].lbl) nObj++;
    const order = [3, 0, 1, 2]; // draw time last (on top)
    for (let oi = 0; oi < 4; oi++) {
      const i = order[oi];
      const sl = i < 3 ? d.slots[i] : null;
      if (sl && !sl.lbl) continue; // empty slot: nothing to detect
      const known = i === 3 || sl.raw !== -1;
      const t0 = passT(BY[i] + BH[i] / 2);
      const lt = t - t0; // ms since lock started
      if (lt < 0) continue;
      found++;
      const lp = G.clamp(lt / LOCK, 0, 1);
      const e = G.ease(lp);
      // tracking jitter while live
      let jx = 0, jy = 0, gr = 0;
      if (live && lp >= 1) {
        jx = Math.round(1.5 * Math.sin(tt / 530 + i * 2.1));
        jy = Math.round(1.5 * Math.cos(tt / 610 + i * 1.3));
        gr = 1.5 + 1.5 * Math.sin(tt / 400 + i);
      }
      // lock-on: brackets fly in from 1.8x and shrink to fit
      const sc = 1 + 0.8 * (1 - e);
      const w = BW[i] * sc + 2 * gr, h = BH[i] * sc + 2 * gr;
      const cx = BX[i] + BW[i] / 2 + jx, cy = BY[i] + BH[i] / 2 + jy;
      const x = cx - w / 2, y = cy - h / 2;
      const col = st === 1 ? acc : st === 2 ? (i === 3 ? acc : CC[i]) : 0xffffff;
      const bc = G.mix(0xffffff, col, lp);
      if (st === 2 && lp >= 1) {
        // labelling tool: thin full rectangle under the corner brackets
        dc.setColor(G.dim(col, 0.55), -1);
        dc.setPenWidth(1);
        dc.drawRectangle(x, y, w, h);
      }
      dc.setColor(bc, -1);
      dc.setPenWidth(i === 3 ? 3 : 2);
      brackets(dc, x, y, w, h, Math.round(Math.min(w, h) * 0.26));
      if (lp < 1) {
        // crosshair converging on the object centre
        dc.setPenWidth(1);
        dc.drawLine(cx - 16 * (1 - e) - 4, cy, cx - 4, cy);
        dc.drawLine(cx + 4, cy, cx + 16 * (1 - e) + 4, cy);
      }

      // label chip (types out after the lock)
      let conf = i === 3 ? "99,9%" : (known ? 80 + (G.rnd(wk * 97 + i * 13 + 5) % 20) : 12 + ((wk + i * 7) % 25)) + "%";
      if (i === 3) conf = "99,9%";
      const lbl = i === 3 ? "UHRZEIT" : sl.lbl;
      const n = Math.floor((lt - LOCK * 0.6) / 28);
      const cbg = st === 3 ? 0xffffff : col;
      chip(dc, BX[i] + jx, BY[i] + jy - 18, lbl, conf, n, cbg, dark);

      // object content
      const vx = cx, vy = BY[i] + BH[i] / 2 + jy;
      if (i === 3) {
        const ts = G.timeStr(d);
        if (lp > 0.25) {
          if (st === 1) {
            dc.setColor(txt, -1);
            F.px(dc, ts, vx, vy - 28, 8, 1, 0);
          } else if (st === 3) {
            outline(dc, ts, vx, vy, 74, 6, 0xffffff, 0x14051f);
          } else {
            dc.setColor(0xffffff, -1);
            F.st(dc, ts, vx, vy, 74, 6, 1, 1.0, 0);
          }
        }
      } else if (lp > 0.25) {
        // value: scrambled until locked
        let v = sl.val;
        if (lp < 1) {
          let sd = G.rnd(i * 31 + Math.floor(lt / 60) + 3);
          let s = "";
          for (let k = 0; k < v.length; k++) { sd = G.rnd(sd); s += "" + (sd % 10); }
          v = s;
        }
        const vc = known ? txt : G.dim(txt, 0.5);
        if (st !== 2) {
          const vs = v.length > 5 ? 3 : 4;
          if (st === 3) {
            // drop shadow keeps the value legible on hot spots
            dc.setColor(0x14051f, -1);
            F.px(dc, v, vx + 3, vy - (7 * vs) / 2 + 3, vs, 1, 0);
          }
          dc.setColor(vc, -1);
          F.px(dc, v, vx, vy - (7 * vs) / 2, vs, 1, 0);
        } else {
          dc.setColor(vc, -1);
          F.st(dc, v, vx, vy, 28, 4, 1, 1.0, 0);
        }
      }
    }

    // ---- scan line + trail
    if (live) {
      const sy = scanY(a.t);
      const sc = st === 1 ? acc : 0xffffff;
      for (let k = 3; k >= 1; k--) {
        dc.setColor(st === 3 ? G.mix(0xffffff, 0x000000, 0.25 * k) : G.dim(sc, 0.45 / k), -1);
        dc.fillRectangle(0, sy - k * 6, 454, 2);
      }
      dc.setColor(sc, -1);
      dc.fillRectangle(0, sy, 454, 2);
    }

    // ---- status: REC, date stamp, detections
    const sCol = st === 3 ? 0xffffff : G.dim(hud, st === 1 ? 0.9 : 1.0);
    if (!live || Math.floor(a.t / 500) % 2 === 0) {
      dc.setColor(st === 2 ? 0xff3b30 : st === 1 ? acc : 0xff3b30, -1);
      dc.fillCircle(87, 99, 5);
    }
    dc.setColor(sCol, -1);
    F.px(dc, "REC", 98, 92, 2, 0, 0);
    // camera battery = watch battery
    dc.setPenWidth(2);
    dc.drawRectangle(318, 92, 22, 13);
    dc.fillRectangle(340, 96, 3, 5);
    dc.fillRectangle(321, 95, Math.round(16 * G.clamp(d.batt / 100, 0, 1)), 7);
    F.px(dc, d.batt + "%", 348, 92, 2, 0, 0);
    const all = found >= nObj;
    let msg = all ? "ERKANNT: " + nObj + (nObj === 1 ? " OBJEKT" : " OBJEKTE") : "SUCHE ... " + found + "/" + nObj;
    if (all && t > 4200) {
      // after the detection: a verdict on the main object, typed out
      msg = verdict(d);
      msg = msg.substring(0, G.clamp(Math.floor((t - 4200) / 40), 0, msg.length));
    }
    F.px(dc, msg, 227 - F.pxW(all && t > 4200 ? verdict(d) : msg, 2) / 2, 370, 2, 0, 0);
    dc.setColor(G.dim(sCol, 0.7), -1);
    F.px(dc, d.dowStr + " " + G.pad2(d.day) + "." + G.pad2(d.mon) + ".  FPS 15", 227, 392, 2, 1, 0);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const x = 87 + o[0], y = 148 + o[1];
    const col = st === 3 ? 0x8a8a8a : G.dim(d.accent, 0.55);
    dc.setColor(col, -1);
    dc.setPenWidth(2);
    brackets(dc, x, y, 280, 116, 28);
    dc.setColor(0x8a8a8a, -1);
    if (st === 1) F.px(dc, G.timeStr(d), 227 + o[0], 178 + o[1], 8, 1, 3);
    else F.st(dc, G.timeStr(d), 227 + o[0], 206 + o[1], 74, 3, 1, 1.0, 0);
    dc.setColor(G.dim(col, 0.8), -1);
    F.px(dc, "UHRZEIT", x, y - 18, 2, 0, 0);
  },
};
