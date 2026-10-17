// NEBEL — "Nebel": the display is fogged up. On every wrist raise a finger wipes a curved path
// through the fog and reveals the bright time and date; a second, small stroke frees the data
// slots. Then the fog slowly creeps back from the edges while droplets run down the clear path.
// Every raise wipes a different path (seed = raise counter); one raise in eight leaves a smiley.
// Styles: 1 Beschlagen (bathroom mirror, warm light), 2 Frost (ice ferns, the wipe melts them),
// 3 Rauch (drifting smoke, the time glows orange). Mirrors watch/source/faces/Nebel.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const NSTR = 76; // fog is drawn in vertical strips of 6 px
const Y0 = 212; // centre of the main wipe / content block
const Y2 = 350; // centre of the slot wipe
const X2A = 92, X2B = 362; // slot wipe from .. to
const T0 = 120, SW = 800; // main wipe start / duration (ms)
const T2 = 950, SW2 = 450; // slot wipe
const TC = 1600, CR = 7400; // fog creeps back from TC over CR ms
// per style: fog base, fog base 2 (streaks), light blob, dark blob, rim, under bg, under glow,
// time, date, slot label, slot value, droplet, light shining through the fog
const PAL = [
  0x56606a, 0x5b656f, 0x636d77, 0x4e5760, 0x8b959f, 0x140b05, 0x3a210e, 0xfff0da, 0xf0b77c, 0xb68f6c, 0xffe6c6, 0x9aa6b2, 0x7d6e60,
  0x2b3c4c, 0x30425a, 0x34485c, 0x253546, 0xcdeaff, 0x030b16, 0x0b2440, 0xeaf8ff, 0x9ed8ff, 0x7096b8, 0xdff3ff, 0xbfe6ff, 0x37587a,
  0x18181b, 0x1b1b1f, 0x2b2b31, 0x111113, 0x26262c, 0x0a0503, 0x341405, 0xff9a3c, 0xe07a34, 0x9a6a48, 0xffb878, 0xff7a20, 0x2e1d14,
];
const NP = 13;

const A1 = new Float64Array(NSTR), B1 = new Float64Array(NSTR), A2 = new Float64Array(NSTR), B2 = new Float64Array(NSTR);
const COLS = new Array(NSTR); // fog colour per strip (streaks + light shining through)
const NJ = new Float64Array(NSTR); // edge raggedness per strip
const GLOW = new Array(NSTR); // background colour under the fog per strip (light behind the time)
let busy = true;
let any = false; // is anything wiped right now?
let ymin = 0, ymax = 0; // vertical extent of everything wiped (cheap early-out)
let cKey = -1;
let wn = 0, tilt = 0, bow = 0, dir = 1, ph = 0, tilt2 = 0;
let blobs = null; // x, y, r, tone
let fern = null; // x1, y1, x2, y2 (main segments first, then side branches)
let nMain = 0;

function build(st, d) {
  wn = Math.abs(d.wakeN) % 100000;
  const key = wn * 4 + st;
  if (key === cKey) return;
  cKey = key;
  let sd = G.rnd(wn * 131 + 7);
  sd = G.rnd(sd); tilt = (sd % 25) - 12;
  sd = G.rnd(sd); bow = (sd % 21) - 10;
  sd = G.rnd(sd); dir = (sd >> 5) % 3 === 0 ? -1 : 1;
  sd = G.rnd(sd); ph = (sd % 1000) / 100.0;
  sd = G.rnd(sd); tilt2 = (sd % 9) - 4;
  const nb = st === 3 ? 13 : 12;
  blobs = new Array(nb * 4);
  for (let i = 0; i < nb; i++) {
    sd = G.rnd(sd);
    const ang = G.rf(sd) * 6.2832;
    sd = G.rnd(sd);
    const rad = Math.sqrt(G.rf(sd)) * 205;
    sd = G.rnd(sd);
    blobs[i * 4] = 227 + Math.sin(ang) * rad;
    blobs[i * 4 + 1] = 227 + Math.cos(ang) * rad;
    blobs[i * 4 + 2] = 28 + (sd % 46);
    blobs[i * 4 + 3] = (sd >> 6) % 2;
  }
  const P = PAL.slice((st - 1) * NP, st * NP);
  for (let s = 0; s < NSTR; s++) {
    const xc = s * 6 + 3;
    const u = (xc - 227) / 227.0;
    COLS[s] = G.mix(G.mix(P[0], P[1], 0.5 + 0.5 * Math.sin(xc * 0.053 + ph)), P[12], (1 - u * u) * 0.55);
    NJ[s] = 1 + 0.6 * Math.sin(xc * 0.077 + ph) + 0.3 * Math.sin(xc * 0.19 + ph * 3);
    GLOW[s] = G.mix(P[5], P[6], G.clamp(1.15 - Math.abs(u) * 1.25, 0, 1));
  }
  fern = null;
  if (st === 2) {
    // ice ferns growing in from the rim: a wandering main rib with side branches at every node
    const nf = 11;
    fern = new Array(nf * 8 * 4 + nf * 14 * 4);
    nMain = nf * 8;
    let m = 0, sb = nMain * 4;
    for (let f = 0; f < nf; f++) {
      sd = G.rnd(sd);
      let ang = f * 32.7 + (sd % 24);
      let x = G.ptX(227, 228, ang), y = G.ptY(227, 228, ang);
      let dr = ang + 180;
      for (let i = 0; i < 8; i++) {
        sd = G.rnd(sd);
        dr += (sd % 31) - 15;
        const len = 15 - i;
        const sn = Math.sin(dr * 0.0174533), cn = Math.cos(dr * 0.0174533);
        const nx = x + len * sn, ny = y - len * cn;
        fern[m++] = x; fern[m++] = y; fern[m++] = nx; fern[m++] = ny;
        if (i > 0) {
          // side branches at +-58 degrees (rotated direction, no extra trig)
          const bl = (8 - i) * 2.8 + 5;
          fern[sb++] = x; fern[sb++] = y;
          fern[sb++] = x + bl * (sn * 0.5299 + cn * 0.848); fern[sb++] = y - bl * (cn * 0.5299 - sn * 0.848);
          fern[sb++] = x; fern[sb++] = y;
          fern[sb++] = x + bl * (sn * 0.5299 - cn * 0.848); fern[sb++] = y - bl * (cn * 0.5299 + sn * 0.848);
        }
        x = nx; y = ny;
      }
    }
  }
}

// clear (wiped) intervals of every strip for this moment: A1..B1 main wipe, A2..B2 slot wipe
function strips(st, t) {
  const p1 = G.easeInOut((t - T0) / SW);
  const head = dir > 0 ? -90 + p1 * 634 : 544 - p1 * 634;
  const cr = G.ease((t - TC) / CR);
  const hw = 84 - 13 * cr;
  const p2 = G.easeInOut((t - T2) / SW2);
  const head2 = X2A + (X2B - X2A) * p2;
  const hw2 = 27 - 3 * cr;
  const tt = t * 0.0006;
  any = t >= T0;
  ymin = 999; ymax = -999;
  for (let s = 0; s < NSTR; s++) {
    const xc = s * 6 + 3;
    const u = (xc - 227) / 227.0;
    const yc = Y0 + tilt * u + bow * (u * u - 0.1);
    const jit = (st === 3 ? NJ[s] * 0.6 + 0.4 * (1 + Math.sin(xc * 0.05 + tt * 2)) : NJ[s]) * (1.5 + 4 * cr);
    let h = -1;
    if (t >= T0) {
      const dx = dir > 0 ? xc - head : head - xc;
      h = dx <= 0 ? hw : dx < hw ? Math.sqrt(hw * hw - dx * dx) : -1;
    }
    if (h > jit) { A1[s] = yc - h + jit; B1[s] = yc + h - jit; } else { A1[s] = 1; B1[s] = 0; }
    h = -1;
    if (t >= T2) {
      const dx = xc < X2A ? X2A - xc : xc > head2 ? xc - head2 : 0;
      h = dx < hw2 ? Math.sqrt(hw2 * hw2 - dx * dx) : -1;
    }
    const y2 = Y2 + (tilt2 * (xc - 227)) / 107.0;
    const j2 = jit * 0.4;
    if (h > j2) { A2[s] = y2 - h + j2; B2[s] = y2 + h - j2; } else { A2[s] = 1; B2[s] = 0; }
    if (A1[s] < B1[s]) { if (A1[s] < ymin) ymin = A1[s]; if (B1[s] > ymax) ymax = B1[s]; }
    if (A2[s] < B2[s] && B2[s] > ymax) ymax = B2[s];
  }
}

function fmod(v, m) { return v - Math.floor(v / m) * m; }

// is the point inside a wiped area (with a margin)?
function clearAt(x, y, mg) {
  if (!any || x < 0) return false;
  const s = Math.floor(x / 6);
  if (s >= NSTR) return false;
  return (y > A1[s] - mg && y < B1[s] + mg) || (y > A2[s] - mg && y < B2[s] + mg);
}

// a fog blob that never paints into the wiped areas: drawn in clipped vertical slices
function fogCirc(dc, bx, by, r) {
  const s0 = Math.max(0, Math.floor((bx - r) / 6)), s1 = Math.min(NSTR - 1, Math.floor((bx + r) / 6));
  let hit = false;
  for (let s = s0; s <= s1 && !hit; s++) {
    if ((A1[s] < B1[s] && A1[s] - 3 < by + r && B1[s] + 3 > by - r) || (A2[s] < B2[s] && A2[s] - 3 < by + r && B2[s] + 3 > by - r)) hit = true;
  }
  if (!hit) { dc.fillCircle(bx, by, r); return; }
  for (let s = s0; s <= s1; s += 4) {
    const e = Math.min(s + 3, s1);
    let ta = 999, tb = -999, ua = 999, ub = -999;
    for (let q = s; q <= e; q++) {
      if (A1[q] < B1[q]) { ta = Math.min(ta, A1[q]); tb = Math.max(tb, B1[q]); }
      if (A2[q] < B2[q]) { ua = Math.min(ua, A2[q]); ub = Math.max(ub, B2[q]); }
    }
    const xl = s * 6, w = (e - s + 1) * 6;
    let y = Math.floor(by - r);
    const ye = Math.ceil(by + r);
    if (ta < tb) {
      const y1 = Math.floor(ta) - 3;
      if (y1 > y) { dc.setClip(xl, y, w, y1 - y); dc.fillCircle(bx, by, r); }
      y = Math.max(y, Math.ceil(tb) + 3);
    }
    if (ua < ub) {
      const y1 = Math.floor(ua) - 3;
      if (y1 > y) { dc.setClip(xl, y, w, y1 - y); dc.fillCircle(bx, by, r); }
      y = Math.max(y, Math.ceil(ub) + 3);
    }
    if (ye > y) { dc.setClip(xl, y, w, ye - y); dc.fillCircle(bx, by, r); }
  }
  dc.clearClip();
}

function content(dc, d, st, P) {
  // what lies under the fog: a dark background with a soft light (only where it can be seen:
  // inside the wiped strips), date, time, data slots
  for (let s = 0; s < NSTR; s++) {
    if (A1[s] < B1[s]) {
      dc.setColor(GLOW[s], -1);
      dc.fillRectangle(s * 6, Math.floor(A1[s]), 6, Math.ceil(B1[s]) - Math.floor(A1[s]));
    }
    if (A2[s] < B2[s]) {
      dc.setColor(P[5], -1);
      dc.fillRectangle(s * 6, Math.floor(A2[s]), 6, Math.ceil(B2[s]) - Math.floor(A2[s]));
    }
  }
  const ts = G.timeStr(d);
  dc.setColor(P[8], -1);
  F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, Y0 - 58, 2, 1, 0);
  if (st === 3) {
    dc.setColor(G.mix(P[6], P[7], 0.45), -1);
    F.st(dc, ts, 227, Y0 + 14, 78, 15, 1, 1.0, 0);
  }
  dc.setColor(P[7], -1);
  F.st(dc, ts, 227, Y0 + 14, 78, st === 2 ? 6 : 8, 1, 1.0, 0);
  for (let k = 0; k < 3; k++) {
    const sl = d.slots[k];
    const x = 227 + (k - 1) * 104;
    dc.setColor(P[9], -1);
    F.px(dc, sl.lbl, x, Y2 - 21, 2, 1, 0);
    dc.setColor(P[10], -1);
    slotVal(dc, sl.val, x);
  }
}

// slot value: large, or smaller when it is long (race times, big step counts)
function slotVal(dc, v, x) {
  if (F.pxW(v, 3) > 88) F.px(dc, v, x, Y2, 2, 1, 0);
  else F.px(dc, v, x, Y2 - 3, 3, 1, 0);
}

export default {
  get fps() { return busy ? 20 : 12; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const P = PAL.slice((st - 1) * NP, st * NP);
    build(st, d);
    const t = a.live ? a.t : 99999;
    busy = a.live && t < T2 + SW2 + 300;
    strips(st, t);
    // before the wipe nothing of the content is visible (and this frame also builds the fog)
    if (any) content(dc, d, st, P);

    // fog layer: strips around the wiped intervals, subtle vertical streaks
    for (let s = 0; s < NSTR; s++) {
      const x = s * 6, xc = x + 3;
      const ch = Math.sqrt(Math.max(0, 227 * 227 - (xc - 227) * (xc - 227))) + 2;
      const ya = Math.floor(227 - ch), yb = Math.ceil(227 + ch);
      dc.setColor(COLS[s], -1);
      let y = ya;
      if (A1[s] < B1[s]) {
        const e = Math.floor(A1[s]);
        if (e > y) dc.fillRectangle(x, y, 6, e - y);
        y = Math.ceil(B1[s]);
      }
      if (A2[s] < B2[s]) {
        const e = Math.floor(A2[s]);
        if (e > y) dc.fillRectangle(x, y, 6, e - y);
        y = Math.ceil(B2[s]);
      }
      if (yb > y) dc.fillRectangle(x, y, 6, yb - y);
    }
    // texture: soft lighter / darker fog clouds (smoke drifts upwards)
    const nb = blobs.length / 4;
    for (let i = 0; i < nb; i++) {
      let bx = blobs[i * 4], by = blobs[i * 4 + 1];
      const r = blobs[i * 4 + 2];
      if (st === 3) {
        bx += Math.sin(t * 0.0005 + i * 1.7) * 26;
        by = fmod(by - t * 0.009 * (1 + (i % 3)) + 80, 614) - 80;
      }
      const rr = st === 3 ? r * 0.85 : r * 0.7;
      const u = (bx - 227) / 227.0;
      const base = G.mix(P[0], P[12], G.clamp(1 - u * u, 0, 1) * 0.55);
      const lt = blobs[i * 4 + 3] === 0;
      const tone = lt ? G.mix(base, st === 3 ? 0x9a9aaa : 0xffffff, st === 3 ? 0.1 : 0.07) : G.mix(base, 0, st === 3 ? 0.4 : 0.11);
      dc.setColor(G.mix(base, tone, 0.5), -1);
      fogCirc(dc, bx, by, rr);
      dc.setColor(tone, -1);
      fogCirc(dc, bx, by, rr * 0.6);
    }
    // frost ferns (segments that would cross the wipe are melted away)
    if (st === 2) {
      const n = fern.length / 4;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        const x1 = fern[o], y1 = fern[o + 1], x2 = fern[o + 2], y2 = fern[o + 3];
        const my = (y1 + y2) / 2;
        if (my > ymin - 11 && my < ymax + 11 && clearAt((x1 + x2) / 2, my, 11)) continue;
        if (i < nMain) { dc.setColor(P[4], -1); dc.setPenWidth(2); }
        else { dc.setColor(0x86a9c8, -1); dc.setPenWidth(1); }
        dc.drawLine(x1, y1, x2, y2);
      }
    }
    // fine condensation droplets sitting in the fog
    if (st === 1) {
      let sd = G.rnd(wn + 9);
      for (let j = 0; j < 34; j++) {
        sd = G.rnd(sd);
        const x = 24 + (sd % 406);
        sd = G.rnd(sd);
        const y = 24 + (sd % 406);
        const r = 1.2 + (sd % 3) * 0.7;
        if ((x - 227) * (x - 227) + (y - 227) * (y - 227) > 44000 || clearAt(x, y, r + 3)) continue;
        dc.setColor(P[3], -1);
        dc.fillCircle(x, y, r + 0.6);
        dc.setColor(P[4], -1);
        dc.fillCircle(x - r * 0.35, y - r * 0.35, r * 0.45);
      }
    }
    // frost: glittering ice crystals
    if (st === 2) {
      let sd = G.rnd(wn + 5);
      for (let j = 0; j < 44; j++) {
        sd = G.rnd(sd);
        const x = 20 + (sd % 414);
        sd = G.rnd(sd);
        const y = 20 + (sd % 414);
        if ((x - 227) * (x - 227) + (y - 227) * (y - 227) > 46000 || clearAt(x, y, 3)) continue;
        const tw = Math.floor(t / 150 + j * 3) % 9;
        dc.setColor(tw === 0 ? 0xffffff : 0x8fb6d8, -1);
        dc.fillRectangle(x, y, 2, 2);
        if (tw === 0) { dc.fillRectangle(x - 2, y, 6, 2); dc.fillRectangle(x, y - 2, 2, 6); }
      }
    }
    // pushed-aside condensation along the wipe edges + little drops sitting on it
    dc.setColor(P[4], -1);
    for (let s = 0; s < NSTR; s++) {
      const x = s * 6;
      if (A1[s] < B1[s]) {
        dc.fillRectangle(x, Math.floor(A1[s]) - 3, 6, 3);
        dc.fillRectangle(x, Math.ceil(B1[s]), 6, 3);
      }
      if (A2[s] < B2[s]) {
        dc.fillRectangle(x, Math.floor(A2[s]) - 2, 6, 2);
        dc.fillRectangle(x, Math.ceil(B2[s]), 6, 2);
      }
    }
    if (st !== 3) {
      dc.setColor(P[11], -1);
      for (let s = 2; s < NSTR - 2; s += 5) {
        if (A1[s] < B1[s]) {
          const r = 1.5 + ((s * 7 + wn) % 3);
          dc.fillCircle(s * 6 + 3, A1[s] - 5 - r, r);
          if ((s + wn) % 2 === 0) dc.fillCircle(s * 6 + 5, B1[s] + 5 + r, r);
        }
      }
    }
    // the data slots shimmer faintly through the fog until the second stroke frees them
    const head2 = t < T2 ? -1 : X2A + (X2B - X2A) * G.easeInOut((t - T2) / SW2);
    for (let k = 0; k < 3; k++) {
      const x = 227 + (k - 1) * 104;
      if (head2 >= x) continue;
      const sl = d.slots[k];
      dc.setColor(G.mix(P[0], P[10], 0.22), -1);
      F.px(dc, sl.lbl, x, Y2 - 21, 2, 1, 0);
      slotVal(dc, sl.val, x);
    }
    // after the wipe: droplets run down the clear path (Rauch: embers rise)
    const cr = G.ease((t - TC) / CR);
    let sd = G.rnd(wn * 17 + 3);
    for (let j = 0; j < (st === 3 ? 6 : 4); j++) {
      sd = G.rnd(sd);
      const x = 112 + (sd % 230);
      sd = G.rnd(sd);
      const s = Math.floor(x / 6);
      if (A1[s] >= B1[s]) continue;
      if (st === 3) {
        const span = B1[s] - A1[s] - 10;
        if (span < 4) continue;
        const y = B1[s] - 5 - fmod(t * (0.02 + (sd % 10) * 0.003) + (sd % 97), span);
        dc.setColor(G.mix(P[5], P[11], 0.4 + 0.4 * Math.abs(Math.sin(t * 0.004 + j))), -1);
        dc.fillCircle(x + Math.sin(t * 0.002 + j * 2) * 6, y, 1.6);
        continue;
      }
      const t0 = TC + j * 1100 + (sd % 700);
      if (t < t0) continue;
      const y0 = A1[s] + 2;
      const y = Math.min(B1[s] - 4, y0 + ((t - t0) * (18 + (sd % 22))) / 1000);
      const wob = Math.sin(y * 0.07 + j) * 2;
      dc.setColor(G.mix(P[6], P[11], 0.15), -1);
      dc.setPenWidth(2);
      dc.drawLine(x, Math.max(y0, y - 34), x + wob, y);
      dc.setColor(P[11], -1);
      dc.fillCircle(x + wob, y, 3.2);
      dc.setColor(0xffffff, -1);
      dc.fillCircle(x + wob - 1, y - 1, 1);
    }
    // one raise in eight: somebody drew a smiley into the fog
    if (wn % 8 === 5 && t > TC - 200) {
      const sp = G.clamp((t - TC + 200) / 900, 0, 1);
      const cx = 227 + ((wn * 13) % 61) - 30, cy = 90;
      dc.setColor(G.mix(G.mix(P[5], P[6], 0.5), P[0], cr * 0.55), -1);
      dc.setPenWidth(6);
      G.arcC(dc, cx, cy, 24, 200, 200 + 360 * G.clamp(sp * 1.6, 0, 1));
      if (sp > 0.62) { dc.fillCircle(cx - 8, cy - 6, 3.5); dc.fillCircle(cx + 8, cy - 6, 3.5); }
      if (sp > 0.75) G.arcC(dc, cx, cy + 1, 13, 120, 120 + 120 * G.clamp((sp - 0.75) * 4, 0, 1));
    }
  },

  // dim fog droplets with the time very faint beneath
  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const P = PAL.slice((st - 1) * NP, st * NP);
    dc.setColor(G.dim(P[7], 0.42), -1);
    F.st(dc, G.timeStr(d), 227 + o[0], Y0 + 14 + o[1], 78, 3, 1, 1.0, 0);
    dc.setColor(G.dim(P[8], 0.4), -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227 + o[0], Y0 - 58 + o[1], 2, 1, 0);
    // a veil of fine droplets
    let sd = G.rnd(d.h * 60 + 11);
    dc.setColor(G.dim(P[11], st === 3 ? 0.35 : 0.22), -1);
    for (let j = 0; j < 46; j++) {
      sd = G.rnd(sd);
      const ang = G.rf(sd) * 6.2832;
      sd = G.rnd(sd);
      const rad = 60 + G.rf(sd) * 150;
      dc.fillCircle(227 + Math.sin(ang) * rad + o[0], 227 + Math.cos(ang) * rad + o[1], 1 + (sd % 3));
    }
  },
};
