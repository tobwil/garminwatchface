// BAUHAUS — a geometric poster. Circle, square, triangle and bars on paper; the big red
// disc stands at the hour, the small square at the minute ("Formen, keine Zeiger"), the
// rest of the composition is re-seeded every minute (date + time) and slides into its new
// arrangement when the minute turns. Clean geometric numerals (bars + arcs) with a paper
// halo keep the time legible. Intro: shapes fall in and settle with a spring.
// Styles: 1 Bauhaus (red/yellow/blue/black on cream), 2 Mondrian (black bars, coloured
// cells; red field = hour of the day, blue field = minute, "Boogie-Woogie" squares travel
// along the bars), 3 Memphis (pastels, squiggles, dots, hard shadows).
// Mirrors watch/source/faces/Bauhaus.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const CX = 227, CY = 227;
// numerals: digit width, height, stroke, gap, colon side gap
const DW = 60, DH = 100, DT = 16, DG = 14, CG = 20;
const TY = 177; // numerals top
// palettes: 0 paper, 1 ink, 2 red, 3 yellow, 4 blue, 5 grey text, 6 extra A, 7 extra B, 8 numeral shadow
const PAL = [
  [0xefe6d3, 0x161616, 0xd93a26, 0xf2b630, 0x1f4e9c, 0x6e665a, 0, 0, -1],
  [0xf4f1ea, 0x141414, 0xd52b1e, 0xf5c400, 0x1d3f97, 0x5a5a5a, 0, 0, -1],
  [0xf8e4ec, 0x1a1a1a, 0xff7a6b, 0xffd84d, 0x7cc6f2, 0x6a5560, 0x7fd8c3, 0xb79cf2, 0xff5c8a],
];
// composition per style (1 and 3): kind and colour index per element
// kinds: 0 disc, 1 square, 2 triangle, 3 half disc, 4 bar, 5 arc, 6 dots, 7 zigzag, 8 stripes, 9 thick half ring
const KIND = [
  [4, 5, 2, 3, 0, 1, 0, 8],
  [6, 7, 9, 1, 0, 2, 4, 4],
];
const KCOL = [
  [1, 1, 3, 4, 2, 1, 1, 1],
  [1, 1, 2, 7, 6, 3, 4, 2],
];
const NE = 8;
const RAD = Math.PI / 180;

let E = []; // current layout: x, y, size, rot per element
let P = []; // previous minute's layout (for the transition)
for (let i = 0; i < NE * 4; i++) { E.push(0); P.push(0); }
const MP = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // Mondrian layout: see mlayout()
const MQ = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // previous minute

// ---------------------------------------------------------------- primitives (e = grow)
function rc(dc, x, y, w, h, e) { dc.fillRectangle(x - e, y - e, w + 2 * e, h + 2 * e); }
function ar(dc, cx, cy, r, t, a0, a1, e) {
  dc.setPenWidth(t + 2 * e);
  if (a1 - a0 >= 359) { dc.drawCircle(cx, cy, r); return; }
  const x = (e * 57.3) / r;
  G.arcC(dc, cx, cy, r, a0 - x, a1 + x);
}
// thick diagonal stroke from (x1,y1) down to (x2,y2), horizontal cuts at both ends
function dg(dc, x1, y1, x2, y2, t, e) {
  const dx = x2 - x1, dy = y2 - y1;
  const hw = ((t / 2 + e) * Math.sqrt(dx * dx + dy * dy)) / dy;
  const k = (dx * e) / dy;
  dc.fillPolygon([[x1 - k - hw, y1 - e], [x1 - k + hw, y1 - e], [x2 + k + hw, y2 + e], [x2 + k - hw, y2 + e]]);
}

// geometric digit n at top-left (x, y), grown by e
function digit(dc, n, x, y, e) {
  const w = DW, h = DH, t = DT, cx = x + w / 2, r = w / 2 - t / 2;
  if (n === 0) {
    ar(dc, cx, y + w / 2, r, t, 270, 450, e);
    ar(dc, cx, y + h - w / 2, r, t, 90, 270, e);
    rc(dc, x, y + w / 2 - 1, t, h - w + 2, e);
    rc(dc, x + w - t, y + w / 2 - 1, t, h - w + 2, e);
  } else if (n === 1) {
    const bx = x + w / 2 - t / 2 + 6;
    rc(dc, bx, y, t, h, e);
    rc(dc, bx - 20, y, 21, t, e);
  } else if (n === 2) {
    ar(dc, cx, y + w / 2, r, t, 270, 495, e);
    dg(dc, cx + r * 0.7071, y + w / 2 + r * 0.7071, x + t / 2 + 2, y + h - t + 1, t, e);
    dc.fillCircle(cx + r * 0.7071, y + w / 2 + r * 0.7071, t / 2 + e);
    rc(dc, x, y + h - t, w, t, e);
  } else if (n === 3) {
    ar(dc, x + w - 25, y + 25, 17, t, 0, 180, e);
    ar(dc, x + w - 25, y + h - 25, 17, t, 0, 180, e);
    rc(dc, x + 4, y, w - 25 - 3, t, e);
    rc(dc, x + 16, y + h / 2 - t / 2, w - 25 - 15, t, e);
    rc(dc, x + 4, y + h - t, w - 25 - 3, t, e);
  } else if (n === 4) {
    const bx = x + w - t - 2;
    rc(dc, bx, y, t, h, e);
    dg(dc, bx + t * 0.35, y, x + t / 2, y + 76, t, e);
    rc(dc, x, y + 60, w, t, e);
  } else if (n === 5) {
    rc(dc, x + 2, y, w - 2, t, e);
    rc(dc, x + 2, y, t, 56, e);
    rc(dc, x + 2, y + 40, w / 2 - 1, t, e);
    ar(dc, cx, y + 70, 22, t, 0, 225, e);
  } else if (n === 6) {
    ar(dc, cx, y + 70, 22, t, 0, 360, e);
    dg(dc, x + w * 0.72, y, x + t / 2, y + 70, t, e);
  } else if (n === 7) {
    rc(dc, x, y, w, t, e);
    dg(dc, x + w - t / 2 - 1, y + t - 1, x + w * 0.3, y + h, t, e);
  } else if (n === 8) {
    ar(dc, cx, y + 24, 16, t, 0, 360, e);
    ar(dc, cx, y + 70, 22, t, 0, 360, e);
  } else {
    ar(dc, cx, y + 30, 22, t, 0, 360, e);
    dg(dc, x + w - t / 2, y + 30, x + w * 0.28, y + h, t, e);
  }
}

// the whole time at (x0, y): digits + square colon
function timeW(d) {
  const nh = d.is24 || G.hour(d) >= 10 ? 2 : 1;
  return (nh + 2) * DW + nh * DG + 2 * CG + DT - DG;
}
function time(dc, d, x0, y, e) {
  const hr = d.is24 ? d.h : G.hour(d);
  let x = x0;
  if (d.is24 || hr >= 10) { digit(dc, Math.floor(hr / 10), x, y, e); x += DW + DG; }
  digit(dc, hr % 10, x, y, e);
  x += DW + CG;
  rc(dc, x, y + 24, DT, DT, e);
  rc(dc, x, y + DH - 24 - DT, DT, DT, e);
  x += DT + CG;
  digit(dc, Math.floor(d.m / 10), x, y, e);
  digit(dc, d.m % 10, x + DW + DG, y, e);
}

// thin monoline version of the numerals (stroke centrelines) for the always-on screen
function ln(dc, x1, y1, x2, y2) { dc.drawLine(x1, y1, x2, y2); }
function digitThin(dc, n, x, y) {
  const cx = x + DW / 2;
  if (n === 0) {
    G.arcC(dc, cx, y + 30, 22, 270, 450);
    G.arcC(dc, cx, y + 70, 22, 90, 270);
    ln(dc, x + 8, y + 30, x + 8, y + 70);
    ln(dc, x + 52, y + 30, x + 52, y + 70);
  } else if (n === 1) {
    ln(dc, x + 36, y + 1, x + 36, y + 99);
    ln(dc, x + 16, y + 8, x + 36, y + 8);
  } else if (n === 2) {
    G.arcC(dc, cx, y + 30, 22, 270, 495);
    ln(dc, cx + 15.6, y + 45.6, x + 10, y + 92);
    ln(dc, x + 1, y + 92, x + 59, y + 92);
  } else if (n === 3) {
    G.arcC(dc, x + 35, y + 25, 17, 0, 180);
    G.arcC(dc, x + 35, y + 75, 17, 0, 180);
    ln(dc, x + 4, y + 8, x + 35, y + 8);
    ln(dc, x + 16, y + 50, x + 35, y + 50);
    ln(dc, x + 4, y + 92, x + 35, y + 92);
  } else if (n === 4) {
    ln(dc, x + 50, y + 1, x + 50, y + 99);
    ln(dc, x + 50, y + 1, x + 6, y + 68);
    ln(dc, x + 1, y + 68, x + 59, y + 68);
  } else if (n === 5) {
    ln(dc, x + 3, y + 8, x + 59, y + 8);
    ln(dc, x + 10, y + 8, x + 10, y + 48);
    ln(dc, x + 10, y + 48, cx, y + 48);
    G.arcC(dc, cx, y + 70, 22, 0, 225);
  } else if (n === 6) {
    dc.drawCircle(cx, y + 70, 22);
    ln(dc, x + 43, y + 1, x + 8, y + 70);
  } else if (n === 7) {
    ln(dc, x + 1, y + 8, x + 59, y + 8);
    ln(dc, x + 51, y + 8, x + 18, y + 99);
  } else if (n === 8) {
    dc.drawCircle(cx, y + 24, 16);
    dc.drawCircle(cx, y + 70, 22);
  } else {
    dc.drawCircle(cx, y + 30, 22);
    ln(dc, x + 52, y + 30, x + 17, y + 99);
  }
}
function timeThin(dc, d, x0, y) {
  const hr = d.is24 ? d.h : G.hour(d);
  let x = x0;
  if (d.is24 || hr >= 10) { digitThin(dc, Math.floor(hr / 10), x, y); x += DW + DG; }
  digitThin(dc, hr % 10, x, y);
  x += DW + CG;
  dc.fillRectangle(x + 4, y + 28, 7, 7);
  dc.fillRectangle(x + 4, y + DH - 35, 7, 7);
  x += DT + CG;
  digitThin(dc, Math.floor(d.m / 10), x, y);
  digitThin(dc, d.m % 10, x + DW + DG, y);
}

// cap height that fits txt into maxW
function fitH(txt, h, maxW) {
  const w = F.stW(txt, h);
  return w > maxW ? (h * maxW) / w : h;
}

// ---------------------------------------------------------------- composition (styles 1, 3)
function seedOf(d, mins) { return G.rnd((G.rnd(d.year * 400 + d.doy) % 1000000) + mins * 7919); }

// layout for clock minute `mins` into arr (x, y, size, rot per element).
// Two or three decorations get their own sectors of the upper arc (-80..80 deg, order
// seeded, skipping +-35 deg around the hour disc); one sits low on the rim below the slots.
// Hour disc and minute square follow the time.
function layout(arr, st, d, mins) {
  let s = seedOf(d, mins);
  const ha = ((Math.floor(mins / 60) % 12) * 30) + (mins % 60) * 0.5;
  const ma = (mins % 60) * 6;
  s = G.rnd(s);
  const off = Math.floor(G.rf(s) * 12);
  const nS = st === 1 ? 2 : 3;
  // window around the hour disc inside the upper arc
  const hn = ha > 180 ? ha - 360 : ha;
  const wl = G.clamp(hn - 35, -80, 80), wh = G.clamp(hn + 35, -80, 80);
  const sw = (160 - (wh - wl)) / nS;
  for (let i = 0; i < NE; i++) {
    s = G.rnd(s); const r1 = G.rf(s);
    s = G.rnd(s); const r2 = G.rf(s);
    s = G.rnd(s); const r3 = G.rf(s);
    let ang = 0, orb = 0, sz = 0, rot = 0;
    // sector rank of this element (-1 = not a sector decoration)
    let rk = -1;
    if (st === 1) rk = i === 2 ? 0 : i === 7 ? 1 : -1;
    else rk = i === 0 ? 0 : i === 1 ? 1 : i === 3 ? 2 : -1;
    if (rk >= 0) {
      ang = -80 + ((rk + off) % nS) * sw + sw * 0.2 + r1 * sw * 0.6;
      if (ang >= wl) ang += wh - wl;
    }
    if (st === 1) {
      if (i === 0) { ang = r1 * 360; orb = 30 + r2 * 50; sz = 470; rot = 20 + r3 * 140; }
      else if (i === 1) { orb = 0; sz = 204; rot = r1 * 360; }
      else if (i === 2) { orb = 128 + r2 * 20; sz = 58; rot = r3 * 120; }
      else if (i === 3) { ang = 150 + r1 * 60; orb = 196; sz = 54; rot = r3 * 360; }
      else if (i === 4) { ang = ha; orb = 166; sz = 72; }
      else if (i === 5) { ang = ma; orb = 192; sz = 40; rot = ma; }
      else if (i === 6) { ang = -60 + r1 * 120; orb = 174 + r2 * 14; sz = 11; }
      else { orb = 140 + r2 * 16; sz = 58; rot = r3 * 180; }
    } else {
      if (i === 0) { orb = 158 + r2 * 10; sz = 4; }
      else if (i === 1) { orb = 150 + r2 * 16; sz = 140; rot = ang + 90 + r3 * 40 - 20; }
      else if (i === 2) { ang = 145 + r1 * 70; orb = 188 + r2 * 8; sz = 32; rot = r3 * 360; }
      else if (i === 3) { orb = 132 + r2 * 16; sz = 62; rot = r3 * 90; }
      else if (i === 4) { ang = ha; orb = 166; sz = 70; }
      else if (i === 5) { ang = ma; orb = 190; sz = 40; rot = ma + 180; }
      else { ang = r1 * 360; orb = 176 + r2 * 24; sz = 30; rot = r3 * 180; }
    }
    arr[i * 4] = G.ptX(CX, orb, ang);
    arr[i * 4 + 1] = G.ptY(CY, orb, ang);
    arr[i * 4 + 2] = sz;
    arr[i * 4 + 3] = rot;
  }
}

// rotated polygon helpers
function poly(dc, x, y, n, r, rot) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = rot + (k * 360) / n;
    pts.push([G.ptX(x, r, a), G.ptY(y, r, a)]);
  }
  dc.fillPolygon(pts);
}
function bar(dc, x, y, len, w, rot) {
  const c = Math.cos(rot * RAD), s = Math.sin(rot * RAD);
  const lx = (c * len) / 2, ly = (s * len) / 2, wx = (-s * w) / 2, wy = (c * w) / 2;
  dc.fillPolygon([[x - lx - wx, y - ly - wy], [x + lx - wx, y + ly - wy], [x + lx + wx, y + ly + wy], [x - lx + wx, y - ly + wy]]);
}

// arc in clock degrees with a0 normalised to 0..360 (the watch drops arcs far below -360)
function arcN(dc, cx, cy, r, a0, a1) {
  const n = Math.floor(a0 / 360) * 360;
  G.arcC(dc, cx, cy, r, a0 - n, a1 - n);
}

// one element: kind k at (x, y), size s, rotation r; tt = ambient time (s)
function shape(dc, k, x, y, s, r, tt) {
  if (k === 0) dc.fillCircle(x, y, s);
  else if (k === 1) poly(dc, x, y, 4, s * 0.7071, r + 45);
  else if (k === 2) poly(dc, x, y, 3, s, r);
  else if (k === 3) {
    const pts = [];
    for (let j = 0; j <= 8; j++) { const a = r - 90 + j * 22.5; pts.push([G.ptX(x, s, a), G.ptY(y, s, a)]); }
    dc.fillPolygon(pts);
  } else if (k === 4) bar(dc, x, y, s, s > 100 ? 5 : 10, r);
  else if (k === 5) {
    dc.setPenWidth(4);
    arcN(dc, CX, CY, s, r, r + 150);
    dc.setPenWidth(2);
    arcN(dc, CX, CY, s - 12, r + 180, r + 250);
  } else if (k === 6) {
    for (let j = 0; j < 16; j++) dc.fillRectangle(x - 26 + (j % 4) * 16, y - 26 + Math.floor(j / 4) * 16, 6, 6);
  } else if (k === 7) {
    dc.setPenWidth(6);
    const c = Math.cos(r * RAD), sn = Math.sin(r * RAD);
    let px = 0, py = 0;
    for (let j = 0; j <= 8; j++) {
      const u = -s / 2 + (j * s) / 8;
      const v = (j % 2 === 0 ? -9 : 9) * (0.75 + 0.25 * Math.sin(tt * 2.2 + j));
      const qx = x + c * u - sn * v, qy = y + sn * u + c * v;
      if (j > 0) dc.drawLine(px, py, qx, qy);
      dc.fillCircle(qx, qy, 3);
      px = qx; py = qy;
    }
  } else if (k === 8) {
    const c = Math.cos(r * RAD), sn = Math.sin(r * RAD);
    for (let j = -1; j <= 1; j++) bar(dc, x - sn * j * 13, y + c * j * 13, s, 6, r);
  } else {
    dc.setPenWidth(14);
    arcN(dc, x, y, s, r, r + 180);
  }
}

// ---------------------------------------------------------------- Mondrian (style 2)
// MP: 0 hour bar x, 1 minute bar x, 2 top split y, 3 top split colour, 4 slot bar 1 x, 5 slot bar 2 x,
//     6 coloured slot cell (0..2), 7 slot cell colour, 8 left band colour, 9 right band colour, 10 bottom split x, 11 unused
function mlayout(arr, d, mins) {
  let s = seedOf(d, mins);
  arr[0] = 26 + ((mins % 1440) / 1440) * 400;
  arr[1] = 70 + ((mins % 60) / 59) * 312;
  s = G.rnd(s); arr[2] = 52 + G.rf(s) * 46;
  s = G.rnd(s); arr[3] = 3 + Math.floor(G.rf(s) * 3) % 3; // 3 yellow, 4 blue, 5 paper
  s = G.rnd(s); arr[4] = 150 + G.rf(s) * 22;
  s = G.rnd(s); arr[5] = 284 + G.rf(s) * 22;
  s = G.rnd(s); arr[6] = Math.floor(G.rf(s) * 3) % 3;
  s = G.rnd(s); arr[7] = G.rf(s) < 0.6 ? 3 : 2;
  s = G.rnd(s); arr[8] = 2 + Math.floor(G.rf(s) * 4) % 4; // 2 red 3 yellow 4 blue 5 paper
  s = G.rnd(s); arr[9] = 2 + Math.floor(G.rf(s) * 4) % 4;
  s = G.rnd(s); arr[10] = G.rf(s);
  arr[11] = 0;
}

const face = {
  get fps() { return 10; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const c = PAL[st - 1];
    const p = a.intro;
    const tt = a.t / 1000.0;
    // minute turn while awake: slide from the previous arrangement
    let k = 1.0;
    if (a.live && d.s === 0 && a.ms < 900 && p >= 1) k = G.spring(a.ms / 900.0);
    const paper = c[0], ink = c[1];
    dc.setColor(paper, -1);
    dc.fillRectangle(0, 0, 454, 454);

    if (st === 2) {
      this.mondrian(dc, d, a, c, k);
    } else {
      layout(E, st, d, d.mins);
      if (k < 1) layout(P, st, d, d.mins === 0 ? 1439 : d.mins - 1);
      const ki = st === 1 ? 0 : 1;
      for (let i = 0; i < NE; i++) {
        const kd = KIND[ki][i];
        let x = E[i * 4], y = E[i * 4 + 1], sz = E[i * 4 + 2], r = E[i * 4 + 3];
        if (k < 1) {
          let r0 = P[i * 4 + 3];
          if (r < r0 - 180) r += 360;
          x = G.lerp(P[i * 4], x, k); y = G.lerp(P[i * 4 + 1], y, k); r = G.lerp(r0, r, k);
        }
        // intro: fall in from above, settle with a spring
        const f = G.spring(G.stag(p, i + 1, 0.06, 0.5));
        if (f <= 0) continue;
        y -= (1 - f) * 460;
        if (kd === 2 && st === 1) r += 4 * Math.sin(tt * 0.9);
        if (kd === 4 && sz < 100) r += 6 * Math.sin(tt * 1.3 + i);
        if (st === 3 && kd !== 6 && kd !== 7 && kd !== 9) {
          dc.setColor(ink, -1);
          shape(dc, kd, x + 5, y + 5, sz, r, tt);
        }
        dc.setColor(c[KCOL[ki][i]], -1);
        shape(dc, kd, x, y, sz, r, tt);
      }
      // seconds: a small dot runs around the rim
      if (a.live && p >= 1) {
        const sd = (d.s + a.ms / 1000.0) * 6;
        dc.setColor(st === 1 ? c[2] : ink, -1);
        dc.fillCircle(G.ptX(CX, 214, sd), G.ptY(CY, 214, sd), 6);
      }
    }

    // ---- numerals: paper halo, (Memphis: hard shadow), ink
    const w = timeW(d);
    const x0 = Math.round(CX - w / 2);
    const fN = G.spring(G.stag(p, 0, 0.06, 0.5));
    const ny = TY - (1 - fN) * 300;
    if (fN > 0) {
      dc.setColor(paper, -1);
      time(dc, d, x0, ny, 6);
      if (c[8] !== -1) {
        dc.setColor(c[8], -1);
        time(dc, d, x0 + 6, ny + 6, 0);
      }
      dc.setColor(ink, -1);
      time(dc, d, x0, ny, 0);
    }

    // ---- date tag (top) and three slots (bottom)
    const q = G.ease(G.stag(p, 5, 0.08, 0.4));
    if (q > 0 && st !== 2) {
      const ds = d.dowStr + " " + d.day + ". " + d.monStr;
      const tw = F.stW(ds, 18) + 28;
      dc.setColor(ink, -1);
      if (st === 3) dc.fillRoundedRectangle(CX - tw / 2, 72, tw, 32, 16);
      else dc.fillRectangle(CX - tw / 2, 72, tw, 32);
      dc.setColor(G.mix(ink, paper, q), -1);
      F.st(dc, ds, CX, 88, 18, 3, 1, 1.0, 0);
    }
    if (q > 0 && st !== 2) {
      for (let j = 0; j < 3; j++) {
        const sl = d.slots[j];
        if (!sl.lbl) continue; // empty slot: no cell
        const x = CX + (j - 1) * 106;
        if (st === 3) {
          dc.setColor(ink, -1);
          dc.fillRoundedRectangle(x - 47, 303, 100, 70, 10);
          dc.setColor(paper, -1);
          dc.fillRoundedRectangle(x - 50, 300, 100, 70, 10);
          dc.setColor(ink, -1);
          dc.setPenWidth(2);
          dc.drawRoundedRectangle(x - 50, 300, 100, 70, 10);
        } else {
          dc.setColor(ink, -1);
          dc.fillRectangle(x - 50, 300, 100, 72);
          dc.setColor(paper, -1);
          dc.fillRectangle(x - 48, 302, 96, 68);
        }
        // bullet: circle / square / triangle in the primary colours
        dc.setColor(c[2 + j], -1);
        if (j === 0) dc.fillCircle(x, 313, 7);
        else if (j === 1) dc.fillRectangle(x - 6, 307, 13, 13);
        else poly(dc, x, 315, 3, 9, 0);
        dc.setColor(G.mix(paper, ink, q), -1);
        F.st(dc, sl.val, x, 336, fitH(sl.val, 22, 86), 3, 1, 1.0, 0);
        dc.setColor(G.mix(paper, c[5], q), -1);
        F.px(dc, sl.lbl, x, 352, 2, 1, 0);
      }
    }
  },

  // style 2: Mondrian grid, bars grow in during the intro
  mondrian(dc, d, a, c, k) {
    const p = a.intro;
    const tt = a.t / 1000.0;
    mlayout(MP, d, d.mins);
    if (k < 1) mlayout(MQ, d, d.mins === 0 ? 1439 : d.mins - 1);
    const L = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6; i++) L[i] = k < 1 ? G.lerp(MQ[i], MP[i], k) : MP[i];
    // (L[3] unused: colours switch at the minute)
    const B = 10; // bar thickness
    const y1 = 166, y2 = 288, y3 = 380;
    const xh = L[0], xm = L[1], ys = L[2], xs1 = L[4], xs2 = L[5];
    const cf = G.ease(G.stag(p, 3, 0.1, 0.5)); // cell colour fade-in
    // coloured cells
    dc.setColor(G.mix(c[0], c[2], cf), -1);
    dc.fillRectangle(0, 0, xh, y1); // hour field (red)
    if (MP[3] !== 5) {
      dc.setColor(G.mix(c[0], c[MP[3]], cf), -1);
      if (xh < 227) dc.fillRectangle(xh, 0, 454 - xh, ys);
      else dc.fillRectangle(0, 0, xh, ys);
    }
    dc.setColor(G.mix(c[0], c[4], cf), -1);
    dc.fillRectangle(0, y3, xm, 454 - y3); // minute field (blue)
    if (MP[10] < 0.5) {
      dc.setColor(G.mix(c[0], c[3], cf), -1);
      dc.fillRectangle(xm, y3 + 40, 454 - xm, 454 - y3 - 40);
    }
    // one slot cell coloured (yellow or blue)
    const cs = MP[6];
    const xa = cs === 0 ? 0 : cs === 1 ? xs1 : xs2;
    const xb = cs === 0 ? xs1 : cs === 1 ? xs2 : 454;
    dc.setColor(G.mix(c[0], c[MP[7] === 2 ? 4 : 3], cf), -1);
    dc.fillRectangle(xa, y2, xb - xa, y3 - y2);
    if (MP[8] !== 5) { dc.setColor(G.mix(c[0], c[MP[8]], cf), -1); dc.fillRectangle(0, y1, 44, y2 - y1); }
    if (MP[9] !== 5) { dc.setColor(G.mix(c[0], c[MP[9]], cf), -1); dc.fillRectangle(410, y1, 44, y2 - y1); }

    // black bars, growing in
    dc.setColor(c[1], -1);
    const g0 = G.ease(G.stag(p, 0, 0.08, 0.45));
    const g1 = G.ease(G.stag(p, 1, 0.08, 0.45));
    const g2 = G.ease(G.stag(p, 2, 0.08, 0.45));
    dc.fillRectangle(0, y1 - B / 2, 454 * g0, B);
    dc.fillRectangle(454 - 454 * g0, y2 - B / 2, 454 * g0, B);
    dc.fillRectangle(0, y3 - B / 2, 454 * g1, B);
    dc.fillRectangle(xh - B / 2, y1 - y1 * g1, B, y1 * g1);
    if (xh < 227) dc.fillRectangle(xh, ys - B / 2, (454 - xh) * g2, B);
    else dc.fillRectangle(xh - xh * g2, ys - B / 2, xh * g2, B);
    dc.fillRectangle(xs1 - B / 2, y2, B, (y3 - y2) * g2);
    dc.fillRectangle(xs2 - B / 2, y3 - (y3 - y2) * g2, B, (y3 - y2) * g2);
    dc.fillRectangle(xm - B / 2, y3, B, (454 - y3) * g2);
    if (MP[10] < 0.5) dc.fillRectangle(xm, y3 + 40 - B / 2, (454 - xm) * g2, B);
    dc.fillRectangle(44 - B / 2, y1, B, (y2 - y1) * g1);
    dc.fillRectangle(410 - B / 2, y2 - (y2 - y1) * g1, B, (y2 - y1) * g1);

    // Boogie-Woogie: small coloured squares travel along the horizontal bars
    if (p >= 1) {
      for (let j = 0; j < 4; j++) {
        const yb = j < 2 ? y1 : y2;
        const sp = 18 + j * 7;
        const v = tt * sp + j * 131 + (d.wakeN % 50) * 9;
        const x = v - Math.floor(v / 474) * 474 - 10;
        dc.setColor(c[2 + (j % 3)], -1);
        dc.fillRectangle(x, yb - B / 2, B, B);
        dc.setColor(c[0], -1);
        dc.fillRectangle(x + B + 3, yb - B / 2 + 3, 4, 4);
      }
    }

    // slots centred in their cells (visible part), date in the larger top cell
    const q = G.ease(G.stag(p, 5, 0.08, 0.4));
    if (q > 0) {
      for (let j = 0; j < 3; j++) {
        const sl = d.slots[j];
        const xl = j === 0 ? 28 : j === 1 ? xs1 + B / 2 : xs2 + B / 2;
        const xr = j === 0 ? xs1 - B / 2 : j === 1 ? xs2 - B / 2 : 426;
        const inv = j === cs && MP[7] === 2;
        const x = (xl + xr) / 2;
        dc.setColor(G.mix(c[0], inv ? 0xffffff : c[1], q), -1);
        F.st(dc, sl.val, x, 326, fitH(sl.val, 22, xr - xl - 12), 3, 1, 1.0, 0);
        dc.setColor(G.mix(c[0], inv ? 0xdde4f4 : c[5], q), -1);
        F.px(dc, sl.lbl, x, 346, 2, 1, 0);
      }
      const ds = d.dowStr + " " + d.day + ". " + d.monStr;
      const red = xh > 227;
      const xl = red ? 40 : xh + B / 2;
      const xr = red ? xh - B / 2 : 414;
      dc.setColor(red ? G.mix(c[2], c[0], q) : G.mix(c[0], c[1], q), -1);
      F.st(dc, ds, (xl + xr) / 2, (ys + y1) / 2 + 4, 18, 3, 1, 1.0, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const c = PAL[st - 1];
    const ox = o[0], oy = o[1];
    const ha = (d.h % 12) * 30 + d.m * 0.5;
    const ma = d.m * 6;
    dc.setPenWidth(2);
    if (st === 2) {
      dc.setColor(0x4a4a4a, -1);
      dc.drawLine(0, 166 + oy, 454, 166 + oy);
      dc.drawLine(0, 288 + oy, 454, 288 + oy);
      const xh = 26 + (d.mins / 1440) * 400;
      dc.drawLine(xh + ox, 0, xh + ox, 166 + oy);
      dc.setColor(G.dim(c[2], 0.6), -1);
      dc.fillRectangle(xh + ox - 30, 120 + oy, 30, 6);
    } else {
      // hour disc and minute marker as outlines
      dc.setColor(G.dim(c[st === 1 ? 2 : 6], 0.7), -1);
      dc.drawCircle(G.ptX(CX + ox, 166, ha), G.ptY(CY + oy, 166, ha), 72);
      dc.setColor(G.dim(st === 1 ? 0xffffff : c[3], 0.5), -1);
      dc.fillCircle(G.ptX(CX + ox, 192, ma), G.ptY(CY + oy, 192, ma), 8);
    }
    // thin numerals: grey strokes via the same geometry (outline look)
    const w = timeW(d);
    const x0 = Math.round(CX - w / 2) + ox;
    dc.setColor(0xa0a0a0, -1);
    dc.setPenWidth(3);
    timeThin(dc, d, x0, TY + oy);
    dc.setColor(G.dim(c[3], 0.55), -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX + ox, 82 + oy, 2, 1, 0);
  },
};
export default face;
