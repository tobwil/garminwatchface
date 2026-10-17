// BLOCK — "Blockfall": a falling-block puzzle well. The time is a stack of pixel pieces
// (HH over MM, 3x5 cells per digit). On every raise the pieces rain down, rotate and slide
// into place; then the waiting piece drops down the shaft between the digits into the
// matching hole of the floor and clears lines. Score = minutes of the day, level = hour
// (gravity gets faster late in the day), lines = raises today, record = best score of
// previous days (persisted). Next-piece preview + the three data slots on the right.
// Styles: 1 Klassik, 2 Gameboy, 3 Neon. Mirrors watch/source/faces/Block.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const C = 20; // cell size
const X0 = 127; // well inner left
const Y0 = 70; // well inner top
const NR = 16; // rows (10 columns)
// digits: 3x5 cells, value = piece id (1..4) inside the digit, 0 empty
const DG = [
  1, 1, 1, 2, 0, 1, 2, 0, 3, 2, 0, 3, 2, 3, 3,
  0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 2, 0, 2, 2, 2,
  1, 1, 1, 0, 0, 1, 2, 2, 2, 2, 0, 0, 3, 3, 3,
  1, 1, 1, 0, 0, 1, 0, 2, 2, 0, 0, 2, 3, 3, 2,
  1, 0, 2, 1, 0, 2, 1, 1, 2, 0, 0, 3, 0, 0, 3,
  1, 1, 1, 1, 0, 0, 2, 2, 2, 0, 0, 2, 3, 3, 3,
  1, 1, 1, 1, 0, 0, 2, 3, 3, 2, 0, 3, 2, 2, 3,
  1, 1, 1, 0, 0, 1, 0, 0, 2, 0, 0, 2, 0, 0, 2,
  1, 1, 1, 1, 0, 2, 3, 2, 2, 3, 0, 4, 3, 3, 4,
  1, 1, 2, 1, 0, 2, 1, 2, 2, 0, 0, 3, 3, 3, 3,
];
// piece count and colour (piece type 0..6) per digit piece
const DN = [3, 2, 3, 3, 3, 3, 3, 2, 4, 3];
const DCOL = [5, 0, 6, 0, 2, 3, 0, 0, 5, 6, 1, 0, 5, 6, 4, 0, 6, 0, 4, 0, 6, 5, 0, 0, 6, 1, 5, 0, 5, 0, 0, 0, 6, 4, 3, 0, 5, 2, 6, 0];
// piece types 0 I, 1 O, 2 T, 3 S, 4 Z, 5 J, 6 L
// shaft orientation (row, col) x4, rows relative to the floor box (well rows 13..15), cols 4..5
const SH = [-1, 0, 0, 0, 1, 0, 2, 0, 1, 0, 1, 1, 2, 0, 2, 1, 0, 0, 1, 0, 1, 1, 2, 0, 0, 0, 1, 0, 1, 1, 2, 1,
  0, 1, 1, 0, 1, 1, 2, 0, 0, 0, 0, 1, 1, 0, 2, 0, 0, 0, 0, 1, 1, 1, 2, 1];
// floor cells inside the 2x3 shaft box that are already filled (bit r*2+c), rows cleared (bit r)
const GM = [42, 0, 32, 16, 32, 40, 20];
const CL = [7, 6, 6, 6, 6, 7, 7];
// spawn orientation (preview, idle) (row, col) x4
const SP = [0, 0, 0, 1, 0, 2, 0, 3, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 0, 2, 1, 1, 0, 1, 0, 2, 1, 0, 1, 1,
  0, 0, 0, 1, 1, 1, 1, 2, 0, 0, 1, 0, 1, 1, 1, 2, 0, 2, 1, 0, 1, 1, 1, 2];
const GB = [0x0f380f, 0x306230, 0x8bac0f, 0x9bbc0f];

// n-th piece: shuffled bags of all 7 pieces (no droughts, no floods)
function kind(n) {
  const b = Math.floor(n / 7);
  let s = G.rnd(G.rnd(G.rnd(b * 977 + 11)));
  const bag = [0, 1, 2, 3, 4, 5, 6];
  for (let j = 6; j > 0; j--) {
    s = G.rnd(s);
    const r = Math.floor(s / 65536) % (j + 1);
    const x = bag[j];
    bag[j] = bag[r];
    bag[r] = x;
  }
  return bag[n % 7];
}

// 7 piece colours per style (style 2 uses textures instead)
function pcol(st, i) {
  if (st === 3) return [0x00f0ff, 0xffe14a, 0xd04bff, 0x39ff6a, 0xff3b6b, 0x4b7bff, 0xff8c2b][i];
  return [0x3fd8ff, 0xffd23f, 0xb45cff, 0x4fe060, 0xff4a4a, 0x3f6bff, 0xff9a2a][i];
}

// one cell at (x, y). e = outline edges (1 up, 2 right, 4 down, 8 left) for the neon style
function cell(dc, st, x, y, t, e, dim) {
  if (st === 2) {
    // Game Boy textures: outer, inner, centre colour, centre size
    const o = t === 6 ? GB[1] : GB[0];
    const n = t === 0 || t === 3 ? GB[3] : t === 2 || t === 6 ? GB[1] : GB[2];
    dc.setColor(dim ? GB[0] : o, -1);
    dc.fillRectangle(x, y, 19, 19);
    dc.setColor(dim ? GB[1] : n, -1);
    dc.fillRectangle(x + 2, y + 2, 15, 15);
    if (dim) return;
    let cc = -1, cs = 0;
    if (t === 0) { cc = GB[0]; cs = 7; }
    else if (t === 1) { cc = GB[0]; cs = 3; }
    else if (t === 3) { cc = GB[1]; cs = 11; }
    else if (t === 4) { dc.setColor(GB[3], -1); dc.fillRectangle(x + 4, y + 4, 4, 4); }
    else if (t === 5) { cc = GB[3]; cs = 5; }
    else if (t === 6) { cc = GB[0]; cs = 7; }
    if (cc !== -1) {
      dc.setColor(cc, -1);
      const o2 = Math.floor((19 - cs) / 2);
      dc.fillRectangle(x + o2, y + o2, cs, cs);
    }
    return;
  }
  const col = dim ? G.mix(pcol(st, t), 0x1a1d2c, 0.62) : pcol(st, t);
  if (st === 3) {
    dc.setColor(G.dim(col, dim ? 0.3 : 0.2), -1);
    dc.fillRectangle(x, y, 19, 19);
    dc.setColor(col, -1);
    if (e & 1) dc.fillRectangle(x - 1, y - 1, 21, 3);
    if (e & 4) dc.fillRectangle(x - 1, y + 17, 21, 3);
    if (e & 8) dc.fillRectangle(x - 1, y - 1, 3, 21);
    if (e & 2) dc.fillRectangle(x + 17, y - 1, 3, 21);
    return;
  }
  dc.setColor(G.mix(col, 0x000000, 0.45), -1);
  dc.fillRectangle(x, y, 19, 19);
  dc.setColor(G.mix(col, 0xffffff, 0.5), -1);
  dc.fillRectangle(x, y, 17, 17);
  dc.setColor(col, -1);
  dc.fillRectangle(x + 2, y + 2, 15, 15);
  if (!dim) {
    dc.setColor(G.mix(col, 0xffffff, 0.75), -1);
    dc.fillRectangle(x + 3, y + 3, 3, 3);
  }
}

// a piece of 4 cells given as (row, col) pairs in arr from offset o (n cells), at well row r0 / col c0
function piece(dc, st, arr, o, n, r0, c0, t, x0, y0, cs) {
  for (let i = 0; i < n; i++) {
    const r = arr[o + i * 2], c = arr[o + i * 2 + 1];
    let e = 0;
    if (st === 3) {
      e = 15;
      for (let j = 0; j < n; j++) {
        const rr = arr[o + j * 2], cc = arr[o + j * 2 + 1];
        if (rr === r - 1 && cc === c) e &= 14;
        if (rr === r + 1 && cc === c) e &= 11;
        if (rr === r && cc === c - 1) e &= 7;
        if (rr === r && cc === c + 1) e &= 13;
      }
    }
    if (cs === C) cell(dc, st, x0 + (c0 + c) * C, y0 + (r0 + r) * C, t, e, false);
    else mini(dc, st, x0 + (c0 + c) * cs, y0 + (r0 + r) * cs, cs, t);
  }
}

// small preview cell
function mini(dc, st, x, y, s, t) {
  if (st === 2) {
    dc.setColor(GB[0], -1);
    dc.fillRectangle(x, y, s - 1, s - 1);
    dc.setColor(t === 0 || t === 3 ? GB[3] : GB[2], -1);
    dc.fillRectangle(x + 2, y + 2, s - 5, s - 5);
    return;
  }
  const col = pcol(st, t);
  if (st === 3) {
    dc.setColor(G.dim(col, 0.25), -1);
    dc.fillRectangle(x, y, s - 1, s - 1);
    dc.setColor(col, -1);
    dc.setPenWidth(2);
    dc.drawRectangle(x, y, s - 1, s - 1);
    return;
  }
  dc.setColor(G.mix(col, 0, 0.45), -1);
  dc.fillRectangle(x, y, s - 1, s - 1);
  dc.setColor(col, -1);
  dc.fillRectangle(x, y, s - 3, s - 3);
}

// digit d (0..9) cells, only piece pk (0 = all) with offset/rotation; static when pk = 0
function digit(dc, st, v, rb, cb, pk, dr, dcc, rot, ct) {
  const b = v * 15;
  // pivot of the piece (centre of its bounding box)
  let pr = 0, pc = 0;
  if (rot !== 0) {
    let r0 = 9, r1 = -1, c0 = 9, c1 = -1;
    for (let i = 0; i < 15; i++) {
      if (DG[b + i] !== pk) continue;
      const r = Math.floor(i / 3), c = i % 3;
      if (r < r0) r0 = r;
      if (r > r1) r1 = r;
      if (c < c0) c0 = c;
      if (c > c1) c1 = c;
    }
    pr = Math.floor((r0 + r1) / 2);
    pc = Math.floor((c0 + c1) / 2);
  }
  for (let i = 0; i < 15; i++) {
    const id = DG[b + i];
    if (id === 0 || (pk !== 0 && id !== pk)) continue;
    const r = Math.floor(i / 3), c = i % 3;
    let e = 0;
    if (st === 3) {
      if (r === 0 || DG[b + i - 3] !== id) e |= 1;
      if (c === 2 || DG[b + i + 1] !== id) e |= 2;
      if (r === 4 || DG[b + i + 3] !== id) e |= 4;
      if (c === 0 || DG[b + i - 1] !== id) e |= 8;
    }
    let rr = r, cc = c;
    if (rot !== 0) {
      rr = pr + (c - pc);
      cc = pc - (r - pr);
      e = ((e << 1) | (e >> 3)) & 15;
    }
    const t = DCOL[v * 4 + id - 1];
    cell(dc, st, X0 + (cb + cc + dcc) * C, Y0 + (rb + rr + dr) * C, (t + ct) % 7, e, false);
  }
}

// floor rows 13..15 with the shaft hole for piece type k; rows in mask clr are skipped; yo = pixel offset
function floor(dc, st, k, seed, clr, yo) {
  const gm = GM[k];
  for (let r = 0; r < 3; r++) {
    if ((clr >> r) & 1) continue;
    let s = seed + r * 31;
    for (let c = 0; c < 10; c++) {
      s = G.rnd(s);
      let on = true;
      if (c === 4 || c === 5) on = ((gm >> (r * 2 + c - 4)) & 1) === 1;
      if (on) {
        const x = X0 + c * C, y = Y0 + (13 + r) * C + yo;
        if (st === 3) {
          dc.setColor(0x1c2230, -1);
          dc.fillRectangle(x, y, 19, 19);
          dc.setColor(0x3a4560, -1);
          dc.fillRectangle(x, y, 19, 2);
        } else cell(dc, st, x, y, Math.floor(s / 65536) % 7, 0, true);
      }
    }
  }
}

// ghost outline of piece type k in the shaft
function ghost(dc, st, k, col) {
  dc.setColor(col, -1);
  dc.setPenWidth(st === 2 ? 2 : 1);
  for (let i = 0; i < 4; i++) {
    const r = SH[k * 8 + i * 2], c = SH[k * 8 + i * 2 + 1];
    dc.drawRectangle(X0 + (4 + c) * C + 2, Y0 + (13 + r) * C + 2, 15, 15);
  }
}

// colour for the piece in play that differs from the digit pieces next to the shaft top
function freeCol(c, dv, ct, on0) {
  for (let n = 0; n < 7; n++) {
    let hit = false;
    for (let r = 0; r < 3; r++) {
      const a = on0 ? DG[dv[0] * 15 + r * 3 + 2] : 0;
      if (a > 0 && (DCOL[dv[0] * 4 + a - 1] + ct) % 7 === c) hit = true;
      const b = DG[dv[1] * 15 + r * 3];
      if (b > 0 && (DCOL[dv[1] * 4 + b - 1] + ct) % 7 === c) hit = true;
    }
    if (!hit) return c;
    c = (c + 1) % 7;
  }
  return c;
}

function pad(n, l) {
  let s = "" + Math.max(0, Math.floor(n));
  while (s.length < l) s = "0" + s;
  return s;
}

// persisted record: best score (minute of day) of previous days
function record(d) {
  if (St.get("bkSeed", 0) === 0) { St.set("bkSeed", 1); St.set("bkHi", 1312); } // web preview demo profile
  const dk = d.year * 1000 + d.doy;
  let hi = St.get("bkHi", 0);
  let bt = St.get("bkT", 0);
  if (St.get("bkD", -1) !== dk) {
    if (bt > hi) { hi = bt; St.set("bkHi", hi); }
    bt = 0;
    St.set("bkD", dk);
  }
  if (d.mins > bt) { bt = d.mins; St.set("bkT", bt); }
  return hi;
}

let fpsNow = 20;

export default {
  get fps() { return fpsNow; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const p = a.intro;
    const live = a.live;
    const t = a.t;
    const ct = d.wakeN % 7; // piece colours shift with every raise
    const k0 = kind(d.wakeN), k1 = kind(d.wakeN + 1), k2 = kind(d.wakeN + 2);
    const hi = record(d);
    const fg = st === 2 ? GB[0] : 0xffffff;
    const lb = st === 2 ? GB[1] : st === 3 ? G.dim(d.accent, 0.8) : 0x8a93b0;

    // ---------------- the line-clear sequence after the intro (live only)
    const g = G.clamp(130 - d.h * 4, 45, 130); // ms per row: higher level = faster
    const nf = k0 === 0 ? 12 : 13;
    const tl = 1650 + nf * g; // lock time
    let ph = 0; // 0 waiting, 1 falling, 2 flash, 3 vanish, 4 regrow, 5 done
    if (live && p >= 1) {
      if (t < 1650) ph = 0;
      else if (t < tl) ph = 1;
      else if (t < tl + 640) ph = 2;
      else if (t < tl + 760) ph = 3;
      else if (t < tl + 1120) ph = 4;
      else ph = 5;
    } else if (!live) ph = 5;
    fpsNow = ph >= 5 ? 5 : 20;
    const post = ph >= 4;
    const ka = post ? k1 : k0; // piece in play
    const kn = post ? k2 : k1; // preview
    const hv = d.is24 ? d.h : G.hour(d);
    const dv = [Math.floor(hv / 10), hv % 10, Math.floor(d.m / 10), d.m % 10];
    const on0 = d.is24 || hv >= 10;
    const c0 = freeCol((k0 + ct) % 7, dv, ct, on0), cA = freeCol((ka + ct) % 7, dv, ct, on0);

    // ---------------- background
    if (st === 2) {
      dc.setColor(GB[2], -1);
      dc.fillRectangle(0, 0, 454, 454);
    }
    const wp = G.ease(p / 0.2);
    const wh = Math.floor(NR * C * wp);
    if (st === 2) {
      // brick walls
      dc.setColor(GB[1], -1);
      dc.fillRectangle(X0 - 12, Y0 + NR * C - wh, 12, wh + 12);
      dc.fillRectangle(X0 + 200, Y0 + NR * C - wh, 12, wh + 12);
      dc.fillRectangle(X0 - 12, Y0 + NR * C, 224, 12);
      dc.setColor(GB[0], -1);
      for (let y = Y0 + NR * C + 6; y > Y0 + NR * C - wh; y -= 10) {
        dc.fillRectangle(X0 - 12, y, 12, 2);
        dc.fillRectangle(X0 + 200, y, 12, 2);
        const o = (Math.floor((y - Y0) / 10) % 2) * 5;
        dc.fillRectangle(X0 - 6 - o, y - 8, 2, 8);
        dc.fillRectangle(X0 + 205 + o, y - 8, 2, 8);
      }
      for (let x = X0 - 12; x < X0 + 212; x += 14) dc.fillRectangle(x, Y0 + NR * C, 2, 12);
      dc.setColor(GB[3], -1);
      dc.fillRectangle(X0, Y0 + NR * C - wh, 200, wh);
    } else {
      dc.setColor(st === 3 ? 0x05070c : 0x0b1020, -1);
      dc.fillRectangle(X0, Y0 + NR * C - wh, 200, wh);
      // grid
      dc.setColor(st === 3 ? G.dim(d.accent, 0.12) : 0x151c35, -1);
      for (let c = 1; c < 10; c++) dc.fillRectangle(X0 + c * C - 1, Y0 + NR * C - wh, 1, wh);
      for (let r = NR - 1; r > 0; r--) if (r * C > NR * C - wh) dc.fillRectangle(X0, Y0 + r * C - 1, 200, 1);
      // walls
      if (st === 3) {
        dc.setColor(G.dim(d.accent, 0.35), -1);
        dc.fillRectangle(X0 - 9, Y0 + NR * C - wh, 3, wh + 9);
        dc.fillRectangle(X0 + 206, Y0 + NR * C - wh, 3, wh + 9);
        dc.fillRectangle(X0 - 9, Y0 + NR * C + 6, 218, 3);
        dc.setColor(d.accent, -1);
        dc.fillRectangle(X0 - 4, Y0 + NR * C - wh, 2, wh + 4);
        dc.fillRectangle(X0 + 202, Y0 + NR * C - wh, 2, wh + 4);
        dc.fillRectangle(X0 - 4, Y0 + NR * C + 2, 208, 2);
      } else {
        dc.setColor(0x3a4466, -1);
        dc.fillRectangle(X0 - 8, Y0 + NR * C - wh, 8, wh + 8);
        dc.fillRectangle(X0 + 200, Y0 + NR * C - wh, 8, wh + 8);
        dc.fillRectangle(X0 - 8, Y0 + NR * C, 216, 8);
        dc.setColor(0x6c7aa8, -1);
        dc.fillRectangle(X0 - 8, Y0 + NR * C - wh, 2, wh + 8);
        dc.fillRectangle(X0 + 200, Y0 + NR * C - wh, 2, wh + 8);
        dc.fillRectangle(X0 - 8, Y0 + NR * C, 216, 2);
      }
    }

    // ---------------- floor + shaft
    const fy = ph === 4 ? Math.floor(((tl + 1120 - t) * 3 * C) / 360) : 0;
    dc.setClip(X0, Y0, 200, NR * C);
    const fseed = d.wakeN * 13 + (post ? 7 : 0);
    if (ph === 2) {
      // flash the completed rows
      const on = Math.floor((t - tl) / 107) % 2 === 0;
      floor(dc, st, k0, d.wakeN * 13, on ? CL[k0] : 0, 0);
      piece(dc, st, SH, k0 * 8, 4, 13, 4, c0, X0, Y0, C);
      if (on) {
        dc.setColor(st === 2 ? GB[3] : 0xffffff, -1);
        for (let r = 0; r < 3; r++) if ((CL[k0] >> r) & 1) dc.fillRectangle(X0, Y0 + (13 + r) * C, 200, 19);
      }
      dc.setColor(fg, -1);
      F.px(dc, CL[k0] === 7 ? "DREIFACH!" : "DOPPEL!", 227, Y0 + 12, 2, 1, 0);
    } else if (ph === 3) {
      dc.setColor(fg, -1);
      F.px(dc, CL[k0] === 7 ? "DREIFACH!" : "DOPPEL!", 227, Y0 + 12, 2, 1, 0);
    } else {
      floor(dc, st, ka, fseed, 0, fy);
      if (ph !== 4) {
        const pl = p >= 1 ? 1 : G.clamp((p - 0.85) / 0.1, 0, 1);
        ghost(dc, st, ka, st === 2 ? GB[1] : G.dim(pcol(st, cA), live && ph === 5 ? 0.35 + 0.2 * Math.sin(t / 300.0) : 0.45 * pl));
      }
    }
    // piece in play
    if (ph === 1) {
      const n = Math.floor((t - 1650) / g);
      piece(dc, st, SH, k0 * 8, 4, 13 - nf + Math.min(n, nf), 4, c0, X0, Y0, C);
    } else if (ph !== 2 && ph !== 3 && p > 0.86) {
      // waiting at the spawn: during idle it sometimes tries the flat orientation
      const flat = live && ph === 5 && (t - tl) % 2600 > 1900;
      if (flat) piece(dc, st, SP, ka * 8, 4, 0, 3, cA, X0, Y0, C);
      else piece(dc, st, SH, ka * 8, 4, ka === 0 ? 1 : 0, 4, cA, X0, Y0, C);
    }

    // ---------------- time digits (pieces rain into place during the intro)
    let N = 0;
    for (let i = 0; i < 4; i++) if (i > 0 || on0) N += DN[dv[i]];
    let k = 0;
    // build order: minutes first (bottom of the stack), each digit bottom piece first
    for (let j = 0; j < 4; j++) {
      const i = (j + 2) % 4;
      if (i === 0 && !on0) continue;
      const v = dv[i];
      const rb = i < 2 ? 2 : 8, cb = i % 2 === 0 ? 1 : 6;
      if (p >= 1) { digit(dc, st, v, rb, cb, 0, 0, 0, 0, ct); k += DN[v]; continue; }
      for (let pk = DN[v]; pk >= 1; pk--) {
        const q = G.clamp((p - 0.04 - (k * 0.5) / N) / 0.4, 0, 1);
        k++;
        if (q <= 0) continue;
        const s = G.rnd(d.wakeN * 31 + k * 17);
        let dr = 0, dcc = 0, rot = 0;
        if (q < 1) {
          dr = -Math.floor((1 - q) * (rb + 9));
          const sd = (Math.floor(s / 4096) % 5) - 2;
          dcc = q < 0.6 ? Math.floor(sd * (1 - q / 0.6) + 0.5) : 0;
          rot = q < 0.45 && Math.floor(s / 256) % 3 !== 0 ? 1 : 0;
        }
        digit(dc, st, v, rb, cb, pk, dr, dcc, rot, ct);
      }
    }
    dc.clearClip();

    // ---------------- panels
    const pp = G.ease(G.stag(p, 0, 0, 0.5));
    const lc = st === 2 ? lb : G.mix(0x000000, lb, pp);
    const vc = st === 2 ? fg : G.mix(0x000000, fg, pp);
    const xl = X0 - 16, xr = X0 + 216;
    const ys = [116, 168, 220, 272];
    const lines = ph >= 4 || !live ? d.glances : Math.max(0, d.glances - 1);
    const lbl = ["PUNKTE", "LEVEL", "REIHEN", "REKORD"];
    const best = Math.max(hi, d.mins);
    const neu = hi > 0 && d.mins > hi;
    const val = [pad(d.mins * G.ease(p / 0.9), 5), "" + d.h, "" + lines, pad(best, 5)];
    for (let i = 0; i < 4; i++) {
      dc.setColor(lc, -1);
      F.px(dc, i === 3 && neu ? "NEU!" : lbl[i], xl, ys[i], 2, 2, 0);
      dc.setColor(i === 3 && neu ? (st === 2 ? GB[1] : d.accent) : vc, -1);
      F.px(dc, val[i], xl, ys[i] + 18, 3, 2, 0);
    }
    // next piece
    dc.setColor(lc, -1);
    F.px(dc, "NÄCHST", xr, ys[0], 2, 0, 0);
    const by = ys[0] + 20;
    if (st === 2) {
      dc.setColor(GB[3], -1);
      dc.fillRectangle(xr, by, 70, 44);
      dc.setColor(GB[0], -1);
      dc.setPenWidth(2);
      dc.drawRectangle(xr, by, 70, 44);
    } else {
      dc.setColor(st === 3 ? 0x05070c : 0x0b1020, -1);
      dc.fillRectangle(xr, by, 70, 44);
      dc.setColor(st === 3 ? G.dim(d.accent, 0.5) : 0x3a4466, -1);
      dc.setPenWidth(2);
      dc.drawRectangle(xr, by, 70, 44);
    }
    const nw = kn === 0 ? 4 : kn === 1 ? 2 : 3;
    const nh = kn === 0 ? 1 : 2;
    if (pp > 0.3) piece(dc, st, SP, kn * 8, 4, 0, 0, (kn + ct) % 7, xr + 1 + Math.floor((70 - nw * 14) / 2), by + 2 + Math.floor((44 - nh * 14) / 2), 14);
    // slots
    for (let i = 0; i < 3; i++) {
      const sl = d.slots[i];
      const y = ys[1] + 20 + i * 50;
      dc.setColor(lc, -1);
      F.px(dc, sl.lbl, xr, y, 2, 0, 0);
      dc.setColor(st === 2 ? fg : G.mix(0x000000, d.dcol, pp), -1);
      F.px(dc, sl.val, xr, y + 18, 3, 0, 0);
    }
    // date
    dc.setColor(st === 2 ? GB[0] : G.mix(0x000000, st === 3 ? d.accent : 0xc8cfe6, pp), -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 42, 2, 1, 0);
    dc.setColor(lc, -1);
    F.px(dc, "BLOCKFALL", 227, 404, 2, 1, 0);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const x0 = X0 + o[0], y0 = Y0 + o[1];
    const col = st === 2 ? 0x5f7a2a : G.dim(st === 3 ? d.accent : 0x9aa6d0, 0.7);
    // well outline
    dc.setColor(G.dim(col, 0.6), -1);
    dc.fillRectangle(x0 - 4, y0, 2, NR * C + 2);
    dc.fillRectangle(x0 + 202, y0, 2, NR * C + 2);
    dc.fillRectangle(x0 - 4, y0 + NR * C + 2, 208, 2);
    // digit pieces as outlines
    const hv = d.is24 ? d.h : G.hour(d);
    const dv = [Math.floor(hv / 10), hv % 10, Math.floor(d.m / 10), d.m % 10];
    dc.setColor(col, -1);
    for (let i = 0; i < 4; i++) {
      if (i === 0 && !d.is24 && hv < 10) continue;
      const b = dv[i] * 15;
      const xb = x0 + (i % 2 === 0 ? 1 : 6) * C, yb = y0 + (i < 2 ? 2 : 8) * C;
      for (let j = 0; j < 15; j++) {
        const id = DG[b + j];
        if (id === 0) continue;
        const r = Math.floor(j / 3), c = j % 3;
        const x = xb + c * C, y = yb + r * C;
        if (r === 0 || DG[b + j - 3] !== id) dc.fillRectangle(x, y, 19, 2);
        if (r === 4 || DG[b + j + 3] !== id) dc.fillRectangle(x, y + 17, 19, 2);
        if (c === 0 || DG[b + j - 1] !== id) dc.fillRectangle(x, y, 2, 19);
        if (c === 2 || DG[b + j + 1] !== id) dc.fillRectangle(x + 17, y, 2, 19);
      }
    }
    dc.setColor(G.dim(col, 0.8), -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227 + o[0], 42 + o[1], 2, 1, 0);
  },
};
