// SKELETT — an open mechanical skeleton movement as a true analog watch. Barrel (with the
// mainspring coiled by the battery level), centre, third and fourth wheel mesh visibly; the
// escape wheel steps, the pallet fork flicks and the balance wheel swings with its breathing
// hairspring (3 beats/s). Bridges with chamfered edges, ruby jewels, blued screws, lume hands.
// Power reserve (Gangreserve, AUF/AB) = battery. Every wrist raise the balance starts swinging.
// Styles: 1 Gold (rhodium bridges, gold wheels), 2 Stahl (black DLC bridges, steel wheels),
// 3 Tourbillon (anthracite bridges, a rotating cage at 6 o'clock: 1 turn per minute = seconds).
// Mirrors watch/source/faces/Skelett.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const RAD = Math.PI / 180;
// movement geometry
const BX = 227, BY = 118, BR = 58, BN = 46; // barrel
const R2 = 50, N2 = 40;                      // centre wheel
const W3X = 271, W3Y = 269, R3 = 40, N3 = 32, P3 = 11; // third wheel + pinion
const W4X = 227, W4Y = 338, R4 = 42, N4 = 34; // fourth (seconds) wheel
const EX = 178, EY = 327, ER = 22, EN = 15;   // escape wheel (on the r 111 bridge)
const PX = 144, PY = 315;                     // pallet fork pivot
const LX = 106, LY = 297, LR = 40;            // balance
const HZ = 1.5;                               // balance frequency (3 beats/s)

let fx = 0;

// static geometry, computed once (polygons are far cheaper than thick arcs/lines on the watch)
// bridges: [r, w, a0, a1] crescents around the dial centre
const BRT = [109, 20, -32, 32, 61, 14, 104, 166, 140, 18, 110, 138, 140, 18, 222, 250, 111, 16, 150, 222, 111, 12, 156, 204];

// band on a circle around the centre (clock a0..a1) with round end caps, as flat [x0, y0, x1, y1, ...]
function band(r, w, a0, a1) {
  const n = Math.max(4, Math.round((a1 - a0) / 6));
  const h = w / 2;
  const f = [];
  for (let i = 0; i <= n; i++) { const g = a0 + ((a1 - a0) * i) / n; f.push(G.ptX(227, r + h, g), G.ptY(227, r + h, g)); }
  let cx = G.ptX(227, r, a1), cy = G.ptY(227, r, a1);
  for (let j = 1; j < 4; j++) f.push(G.ptX(cx, h, a1 + 45 * j), G.ptY(cy, h, a1 + 45 * j));
  for (let i = n; i >= 0; i--) { const g = a0 + ((a1 - a0) * i) / n; f.push(G.ptX(227, r - h, g), G.ptY(227, r - h, g)); }
  cx = G.ptX(227, r, a0); cy = G.ptY(227, r, a0);
  for (let j = 1; j < 4; j++) f.push(G.ptX(cx, h, a0 + 180 + 45 * j), G.ptY(cy, h, a0 + 180 + 45 * j));
  return f;
}

// point list for fillPolygon from a flat array, reusing pool (same length) when given
function pts(f, pool) {
  const n = f.length / 2;
  const o = pool || [];
  for (let i = 0; i < n; i++) {
    if (!pool) o.push([0, 0]);
    o[i][0] = f[i * 2];
    o[i][1] = f[i * 2 + 1];
  }
  return o;
}

// radial quad (applied index) of width w from r1 to r2 at clock angle g
function quad(r1, r2, w, g) {
  const c = Math.cos(g * RAD) * w / 2, s = Math.sin(g * RAD) * w / 2;
  const x1 = G.ptX(227, r1, g), y1 = G.ptY(227, r1, g), x2 = G.ptX(227, r2, g), y2 = G.ptY(227, r2, g);
  return [[x1 - c, y1 - s], [x2 - c, y2 - s], [x2 + c, y2 + s], [x1 + c, y1 + s]];
}

// minute ticks [x1,y1,x2,y2], index quads + lume lines, bridge bands (chamfer, top) + one point pool per bridge
const TK = [], IQ = [], IL = [], BF = [], BPL = [];
for (let i = 0; i < 60; i++) {
  const g = i * 6;
  if (i % 5 === 0) {
    IQ.push(quad(196, 219, i % 15 === 0 ? 7 : 5, g));
    IL.push(G.ptX(227, 200, g), G.ptY(227, 200, g), G.ptX(227, 215, g), G.ptY(227, 215, g));
  } else {
    TK.push(G.ptX(227, 210, g), G.ptY(227, 210, g), G.ptX(227, 218, g), G.ptY(227, 218, g));
  }
}
for (let k = 0; k < 24; k += 4) {
  BF.push(band(BRT[k], BRT[k + 1], BRT[k + 2], BRT[k + 3]));
  BF.push(band(BRT[k], BRT[k + 1] - 6, BRT[k + 2], BRT[k + 3]));
  BPL.push(pts(BF[BF.length - 1], null));
}

// n radial teeth from r1 to r2 starting at clock angle a0; sk = tip lean in degrees (escape wheel hooks)
function teeth(dc, cx, cy, r1, r2, n, a0, sk) {
  const stp = (2 * Math.PI) / n, cs = Math.cos(stp), sn = Math.sin(stp);
  let x = Math.sin(a0 * RAD), y = -Math.cos(a0 * RAD);
  const kc = Math.cos(sk * RAD), ks = Math.sin(sk * RAD);
  for (let i = 0; i < n; i++) {
    dc.drawLine(cx + x * r1, cy + y * r1, cx + (x * kc - y * ks) * r2, cy + (x * ks + y * kc) * r2);
    const nx = x * cs - y * sn;
    y = x * sn + y * cs;
    x = nx;
  }
}

// open wheel: toothed rim, k tapered spokes, hub
function wheel(dc, cx, cy, r, n, ang, k, col, hi) {
  dc.setColor(col, -1);
  dc.setPenWidth(4);
  dc.drawCircle(cx, cy, r - 4);
  dc.setPenWidth(3);
  teeth(dc, cx, cy, r - 3, r + 1, n, ang, 0);
  for (let i = 0; i < k; i++) G.hand(dc, cx, cy, ang + 18 + (i * 360) / k, r - 5, 0, 7, 4);
  dc.fillCircle(cx, cy, 8);
  dc.setColor(hi, -1);
  dc.setPenWidth(1);
  G.arcC(dc, cx, cy, r - 6, 285, 345);
}

// small pinion (leaves) on top of a wheel
function pinion(dc, cx, cy, r, n, ang, col) {
  dc.setColor(col, -1);
  dc.fillCircle(cx, cy, r - 2);
  dc.setPenWidth(3);
  teeth(dc, cx, cy, r - 3, r + 1, n, ang, 0);
}

// curved bridge k: chamfer (darker), flat top surface, polished edge lines
function arcBr(dc, k, col, hi, lo) {
  dc.setColor(lo, -1);
  dc.fillPolygon(pts(BF[k * 2], BPL[k]));
  dc.setColor(col, -1);
  dc.fillPolygon(pts(BF[k * 2 + 1], BPL[k]));
  const r = BRT[k * 4], h = BRT[k * 4 + 1] / 2 - 1;
  dc.setPenWidth(1);
  dc.setColor(hi, -1);
  G.arcC(dc, 227, 227, r + h, BRT[k * 4 + 2], BRT[k * 4 + 3]);
  G.arcC(dc, 227, 227, r - h + 4, BRT[k * 4 + 2], BRT[k * 4 + 3]);
}

// ruby jewel in a polished chaton
function jewel(dc, x, y, r, chat) {
  dc.setColor(chat, -1);
  dc.fillCircle(x, y, r + 2);
  dc.setColor(0xa3122f, -1);
  dc.fillCircle(x, y, r);
  dc.setColor(0xff8aa0, -1);
  dc.fillRectangle(x - r * 0.5, y - r * 0.5, 2, 2);
}

// screw with slot
function screw(dc, x, y, ang, col, hi) {
  dc.setColor(col, -1);
  dc.fillCircle(x, y, 5);
  dc.setColor(hi, -1);
  dc.setPenWidth(2);
  dc.drawLine(G.ptX(x, 4, ang), G.ptY(y, 4, ang), G.ptX(x, 4, ang + 180), G.ptY(y, 4, ang + 180));
}

// spiral (mainspring / hairspring) from half circles with alternating centres
function spiral(dc, cx, cy, r0, d, turns, rot) {
  const ux = Math.sin(rot * RAD) * d * 0.5, uy = -Math.cos(rot * RAD) * d * 0.5;
  for (let k = 0; k < turns * 2; k++) {
    const o = k % 2 === 0 ? 0 : 1;
    G.arcC(dc, cx + ux * o, cy + uy * o, r0 + k * d, rot + 90 + o * 180, rot + 270 + o * 180);
  }
}

// lance hand outline: tail (behind the centre), widest at 70 %, pointed tip
function hpts(s, c, l, ww, tail) {
  return [
    [227 - s * tail - c * ww * 0.35, 227 + c * tail - s * ww * 0.35],
    [227 + s * l * 0.7 - c * ww, 227 - c * l * 0.7 - s * ww],
    [227 + s * l, 227 - c * l],
    [227 + s * l * 0.7 + c * ww, 227 - c * l * 0.7 + s * ww],
    [227 - s * tail + c * ww * 0.35, 227 + c * tail + s * ww * 0.35],
  ];
}

// lance hand with lume: shadow, metal, lume
function lhand(dc, deg, len, w, col, lume) {
  const s = Math.sin(deg * RAD), c = Math.cos(deg * RAD);
  dc.setColor(0x000000, -1);
  dc.fillPolygon(hpts(s, c, len + 4, w + 3, 26));
  dc.setColor(col, -1);
  dc.fillPolygon(hpts(s, c, len, w, 22));
  dc.setColor(lume, -1);
  dc.fillPolygon(hpts(s, c, len - 9, w - 3.5, -18));
}

export default {
  get fps() { return fx; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const live = a.live;
    fx = live ? 20 : 0;

    // palette per style: bridge, bridge hi, wheel, wheel hi, screw, screw hi, hands, lume, ring
    let cBr, cBrH, cW, cWH, cSc, cScH, cHd, cLu, cRg;
    if (st === 2) {
      cBr = 0x232529; cBrH = 0x8d949c; cW = 0xa9afb7; cWH = 0xeef1f4; cSc = 0xb9bec5; cScH = 0x4b4f55;
      cHd = 0xd9dde2; cLu = 0xbfeaff; cRg = 0x9aa0a8;
    } else if (st === 3) {
      cBr = 0x4b5057; cBrH = 0xc5cad0; cW = acc; cWH = G.mix(acc, 0xffffff, 0.5); cSc = 0x2b54b8; cScH = 0x9cb8f0;
      cHd = acc; cLu = 0xe8f7d8; cRg = G.mix(acc, 0x888888, 0.4);
    } else {
      cBr = 0xb4b9bf; cBrH = 0xf2f4f6; cW = acc; cWH = G.mix(acc, 0xffffff, 0.5); cSc = 0x2b54b8; cScH = 0x9cb8f0;
      cHd = acc; cLu = 0xe8f7d8; cRg = acc;
    }
    const tour = st === 3;
    const cPl = st === 2 ? 0x141518 : st === 3 ? 0x1c1e21 : 0x23252a;

    // time base: seconds within the hour (ticks 3x per second while live)
    const frac = live ? a.ms / 1000 : 0;
    const sec = d.m * 60 + d.s + frac;
    const tk = Math.floor(sec * 3);
    const tf = G.ease(G.clamp((sec * 3 - tk) / 0.3, 0, 1)); // step easing after each beat
    const step = tk + tf;
    const bf = G.clamp(d.batt / 100, 0, 1);
    // balance angle
    const amp = 150 * G.ease(G.clamp(p * 1.3, 0, 1));
    const bal = live ? amp * Math.sin(2 * Math.PI * HZ * sec) : 0;

    // ---- main plate ring (circular graining) + chapter ring: minute track + applied indices
    dc.setColor(cPl, -1);
    dc.fillCircle(227, 227, 205);
    dc.setColor(0x000000, -1);
    dc.fillCircle(227, 227, 175);
    dc.setColor(G.mix(cPl, 0xffffff, 0.07), -1);
    dc.setPenWidth(1);
    for (let r = 182; r < 205; r += 8) dc.drawCircle(227, 227, r);
    dc.setColor(G.mix(cPl, 0x000000, 0.5), -1);
    dc.drawCircle(227, 227, 175);
    if (p < 1) {
      // intro: a polish glint runs round the plate
      const g = p * 400 - 20;
      dc.setColor(G.mix(cPl, 0xffffff, 0.22 * (1 - p)), -1);
      dc.fillPolygon(pts(band(190, 26, g - 30, g), null));
    }
    dc.setColor(0x2a2a2a, -1);
    dc.drawCircle(227, 227, 222);
    dc.setPenWidth(2);
    dc.setColor(0x6a6a6a, -1);
    for (let i = 0; i < 192; i += 4) dc.drawLine(TK[i], TK[i + 1], TK[i + 2], TK[i + 3]);
    dc.setColor(cRg, -1);
    for (let i = 0; i < 12; i++) dc.fillPolygon(IQ[i]);
    dc.setColor(cLu, -1);
    for (let i = 0; i < 48; i += 4) dc.drawLine(IL[i], IL[i + 1], IL[i + 2], IL[i + 3]);

    // ---- wheels (bottom level)
    const a4 = step * 2; // fourth wheel: 6 deg/s
    const a3 = -a4 * (R4 / R3);
    const a2 = -a3 * (P3 / R2);
    const aB = -a2 * (R2 / BR);
    const aE = -step * 12;
    if (!tour) wheel(dc, W4X, W4Y, R4, N4, a4, 4, cW, cWH);
    wheel(dc, W3X, W3Y, R3, N3, a3, 5, cW, cWH);
    pinion(dc, W3X, W3Y, P3, 8, a3, G.mix(cW, cWH, 0.3));
    wheel(dc, 227, 227, R2, N2, a2, 4, cW, cWH);

    // barrel: drum, mainspring (battery), teeth
    dc.setColor(0x101010, -1);
    dc.fillCircle(BX, BY, BR - 3);
    dc.setColor(G.dim(cW, 0.75), -1);
    dc.setPenWidth(2);
    spiral(dc, BX, BY, 12 + (1 - bf) * 20, 2.6 + (1 - bf) * 0.6, 4, aB * 3);
    dc.setColor(cW, -1);
    dc.setPenWidth(5);
    dc.drawCircle(BX, BY, BR - 4);
    dc.setPenWidth(3);
    teeth(dc, BX, BY, BR - 3, BR + 1, BN, aB, 0);

    // escapement (styles 1/2): escape wheel, pallet fork, balance
    if (!tour) {
      dc.setColor(cW, -1);
      dc.setPenWidth(3);
      dc.drawCircle(EX, EY, ER - 5);
      teeth(dc, EX, EY, ER - 5, ER + 1, EN, aE, 14);
      for (let i = 0; i < 4; i++) G.hand(dc, EX, EY, aE + i * 90, ER - 6, 0, 4, 3);
      pinion(dc, EX, EY, 7, 7, aE, G.mix(cW, cWH, 0.3));
      // fork: toward the balance with pallet arms at the escape wheel
      const fa = 296 + 8 * G.clamp(bal / 25, -1, 1);
      dc.setColor(cWH, -1);
      G.hand(dc, PX, PY, fa, 34, 0, 6, 3);
      G.hand(dc, PX, PY, fa + 180 - 34, 22, 0, 5, 4);
      G.hand(dc, PX, PY, fa + 180 + 34, 22, 0, 5, 4);
      dc.setColor(0xc0183a, -1);
      dc.fillCircle(G.ptX(PX, 21, fa + 146), G.ptY(PY, 21, fa + 146), 2.5);
      dc.fillCircle(G.ptX(PX, 21, fa + 214), G.ptY(PY, 21, fa + 214), 2.5);
      // balance wheel
      dc.setColor(cW, -1);
      dc.setPenWidth(5);
      dc.drawCircle(LX, LY, LR);
      for (let i = 0; i < 3; i++) G.hand(dc, LX, LY, bal + i * 120, LR - 2, 0, 5, 4);
      for (let i = 0; i < 4; i++) {
        const wa = bal + 60 + i * 90;
        dc.fillCircle(G.ptX(LX, LR + 1, wa), G.ptY(LY, LR + 1, wa), 4);
      }
      dc.setColor(cWH, -1);
      dc.setPenWidth(1);
      G.arcC(dc, LX, LY, LR - 2, 290, 340);
      // hairspring: breathes with the balance
      dc.setColor(G.mix(cBrH, 0x4466aa, st === 2 ? 0.1 : 0.45), -1);
      spiral(dc, LX, LY, 6, 2.3 * (1 + 0.08 * Math.sin(bal * RAD)), 5, bal * 0.5);
    }

    // ---- tourbillon (style 3): fixed seconds wheel, cage turning once a minute, balance inside
    if (tour) {
      dc.setColor(cW, -1);
      dc.setPenWidth(3);
      dc.drawCircle(W4X, W4Y, 52);
      teeth(dc, W4X, W4Y, 52, 57, 44, 0, 0);
      // seconds scale around the cage
      dc.setColor(cRg, -1);
      dc.setPenWidth(2);
      for (let i = 0; i < 12; i++) G.tick(dc, W4X, W4Y, 60, i % 3 === 0 ? 68 : 64, i * 30);
      const cg = step * 2; // cage angle = seconds
      // cage: ring + three arms (one is the seconds pointer)
      dc.setColor(cBrH, -1);
      dc.setPenWidth(3);
      dc.drawCircle(W4X, W4Y, 45);
      for (let i = 0; i < 3; i++) G.hand(dc, W4X, W4Y, cg + i * 120, 45, 0, 10, 6);
      dc.setColor(cLu, -1);
      G.hand(dc, W4X, W4Y, cg, 58, -42, 4, 2);
      // escape wheel riding on the cage
      const ex = G.ptX(W4X, 31, cg + 60), ey = G.ptY(W4Y, 31, cg + 60);
      dc.setColor(cW, -1);
      dc.setPenWidth(2);
      dc.drawCircle(ex, ey, 7);
      teeth(dc, ex, ey, 7, 11, 15, aE * 2, 14);
      // balance at the cage axis
      dc.setColor(cW, -1);
      dc.setPenWidth(4);
      dc.drawCircle(W4X, W4Y, 30);
      for (let i = 0; i < 3; i++) G.hand(dc, W4X, W4Y, cg + bal + i * 120, 29, 0, 4, 3);
      dc.setColor(G.mix(cBrH, 0x4466aa, 0.45), -1);
      dc.setPenWidth(1);
      spiral(dc, W4X, W4Y, 4, 2.1 * (1 + 0.08 * Math.sin(bal * RAD)), 4, cg + bal * 0.5);
      for (let i = 0; i < 3; i++) screw(dc, G.ptX(W4X, 45, cg + i * 120), G.ptY(W4Y, 45, cg + i * 120), cg, cSc, cScH);
    }

    // ---- bridges: concentric crescents around the dial centre
    const cLo = G.mix(cBr, 0x000000, 0.45);
    arcBr(dc, 0, cBr, cBrH, cLo); // barrel bridge through the barrel arbor
    // ratchet wheel on the barrel arbor (turns with the barrel)
    dc.setColor(G.mix(cBr, 0xffffff, 0.25), -1);
    dc.fillCircle(BX, BY, 20);
    dc.setColor(cLo, -1);
    dc.setPenWidth(2);
    teeth(dc, BX, BY, 15, 21, 22, aB, 22);
    dc.setColor(cBrH, -1);
    dc.setPenWidth(1);
    dc.drawCircle(BX, BY, 21);
    screw(dc, BX, BY, aB * 5, cBr, cLo);
    arcBr(dc, 1, cBr, cBrH, cLo); // third wheel bridge
    arcBr(dc, 2, cBr, cBrH, cLo); // counter bridge (4 o'clock)
    jewel(dc, G.ptX(227, 140, 124), G.ptY(227, 140, 124), 3, cBrH);
    screw(dc, G.ptX(227, 140, 110), G.ptY(227, 140, 110), 30, cSc, cScH);
    screw(dc, G.ptX(227, 140, 138), G.ptY(227, 140, 138), 150, cSc, cScH);
    if (tour) {
      arcBr(dc, 3, cBr, cBrH, cLo); // mirrored bridge (8 o'clock)
      jewel(dc, G.ptX(227, 140, 236), G.ptY(227, 140, 236), 3, cBrH);
      screw(dc, G.ptX(227, 140, 222), G.ptY(227, 140, 222), 70, cSc, cScH);
      screw(dc, G.ptX(227, 140, 250), G.ptY(227, 140, 250), 120, cSc, cScH);
    }
    if (!tour) {
      arcBr(dc, 4, cBr, cBrH, cLo); // fourth + escape wheel bridge
      arcBr(dc, 3, cBr, cBrH, cLo); // balance cock
      jewel(dc, LX, LY, 4, cBrH);
      dc.setColor(cBrH, -1);
      dc.setPenWidth(1);
      G.tick(dc, LX, LY, 6, 30, 30); // regulator index
      jewel(dc, EX, EY, 3, cBrH);
      jewel(dc, PX, PY, 3, cBrH);
      screw(dc, G.ptX(227, 111, 150), G.ptY(227, 111, 150), 20, cSc, cScH);
      screw(dc, G.ptX(227, 140, 222), G.ptY(227, 140, 222), 70, cSc, cScH);
      screw(dc, G.ptX(227, 140, 250), G.ptY(227, 140, 250), 120, cSc, cScH);
      // small seconds on the fourth wheel
      dc.setColor(cRg, -1);
      dc.setPenWidth(2);
      for (let i = 0; i < 12; i++) if (i < 8 || i > 10) G.tick(dc, W4X, W4Y, 48, i % 3 === 0 ? 55 : 52, i * 30);
      const sd = live ? step * 2 : d.s * 6;
      dc.setColor(0x000000, -1);
      G.hand(dc, W4X, W4Y, sd, 47, 14, 6, 4);
      dc.setColor(cLu, -1);
      G.hand(dc, W4X, W4Y, sd, 45, 12, 3, 1.5);
      dc.setColor(st === 2 ? 0xff5a1f : cHd, -1);
      G.hand(dc, W4X, W4Y, sd, 45, -30, 3, 1.5);
      jewel(dc, W4X, W4Y, 3, cBrH);
    } else {
      arcBr(dc, 5, cBr, cBrH, cLo); // tourbillon bridge over the cage
      jewel(dc, W4X, W4Y, 4, cBrH);
      screw(dc, G.ptX(227, 111, 156), G.ptY(227, 111, 156), 20, cSc, cScH);
      screw(dc, G.ptX(227, 111, 204), G.ptY(227, 111, 204), 70, cSc, cScH);
    }
    jewel(dc, W3X, W3Y, 3, cBrH);
    screw(dc, G.ptX(227, 109, -32), G.ptY(227, 109, -32), 40, cSc, cScH);
    screw(dc, G.ptX(227, 109, 32), G.ptY(227, 109, 32), 110, cSc, cScH);
    screw(dc, G.ptX(227, 61, 104), G.ptY(227, 61, 104), 80, cSc, cScH);

    // ---- power reserve (battery) on the plate ring at 12: AB ... AUF
    const ip = G.ease(G.clamp((p - 0.2) / 0.6, 0, 1));
    const bfv = bf * ip;
    dc.setColor(G.mix(cPl, 0x000000, 0.6), -1);
    dc.setPenWidth(7);
    G.arcC(dc, 227, 227, 186, -26, 26);
    dc.setColor(bf < 0.15 ? 0xd8432f : cRg, -1);
    dc.setPenWidth(5);
    if (bfv > 0.02) G.arcC(dc, 227, 227, 186, -26, -26 + 52 * bfv);
    dc.setColor(cLu, -1);
    dc.fillCircle(G.ptX(227, 186, -26 + 52 * bfv), G.ptY(227, 186, -26 + 52 * bfv), 4);
    dc.setColor(0x8a8a8a, -1);
    F.px(dc, "AB", G.ptX(227, 185, -34), G.ptY(227, 185, -34) - 7, 2, 1, 0);
    F.px(dc, "AUF", G.ptX(227, 185, 35), G.ptY(227, 185, 35) - 7, 2, 1, 0);

    // ---- date window at 3, slots at 10, 2 and 9
    dc.setColor(0x8a8a8a, -1);
    F.px(dc, d.dowStr, 358, 190, 2, 1, 0);
    dc.setColor(0x000000, -1);
    dc.fillRoundedRectangle(332, 208, 52, 36, 5);
    dc.setColor(cRg, -1);
    dc.setPenWidth(2);
    dc.drawRoundedRectangle(332, 208, 52, 36, 5);
    dc.setColor(0xf2f2f2, -1);
    F.st(dc, "" + d.day, 358, 226, 20, 3, 1, 1.0, 0);
    const SX = [112, 342, 96], SY = [140, 140, 222];
    for (let k = 0; k < 3; k++) {
      const sl = d.slots[k];
      const sp = G.stag(p, k, 0.12, 0.45);
      if (sp <= 0) continue;
      dc.setColor(G.dim(0x8a8a8a, sp), -1);
      F.px(dc, sl.lbl, SX[k], SY[k] - 20, 2, 1, 0);
      dc.setColor(G.mix(0x000000, d.dcol, sp), -1);
      F.st(dc, sl.val, SX[k], SY[k] + 6, 18, 2, 1, 1.0, 0);
    }

    // ---- hands (spring in from 12 on every raise)
    const hp = G.spring(G.clamp((p - 0.15) / 0.75, 0, 1));
    const md = (d.m + d.s / 60) * 6 * hp;
    const hd = ((d.h % 12) * 30 + d.m * 0.5) * hp;
    lhand(dc, hd, 112, 9, cHd, cLu);
    lhand(dc, md, 170, 7, cHd, cLu);
    dc.setColor(cHd, -1);
    dc.fillCircle(227, 227, 9);
    jewel(dc, 227, 227, 3, cHd);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const cx = 227 + o[0], cy = 227 + o[1];
    const met = st === 2 ? 0x5a5e63 : G.dim(d.accent, 0.5);
    // indices + power reserve
    dc.setColor(met, -1);
    dc.setPenWidth(2);
    for (let i = 0; i < 12; i++) G.tick(dc, cx, cy, 198, i % 3 === 0 ? 218 : 212, i * 30);
    dc.setColor(0x262626, -1);
    G.arcC(dc, cx, cy, 186, -26, 26);
    dc.setColor(met, -1);
    G.arcC(dc, cx, cy, 186, -26, -26 + 52 * G.clamp(d.batt / 100, 0, 1));
    // ghost of the movement: barrel, centre wheel, balance / tourbillon
    dc.setColor(0x2a2a2a, -1);
    dc.setPenWidth(1);
    dc.drawCircle(BX + o[0], BY + o[1], BR - 4);
    dc.drawCircle(cx, cy, R2 - 4);
    dc.drawCircle(W3X + o[0], W3Y + o[1], R3 - 4);
    if (st === 3) {
      dc.drawCircle(W4X + o[0], W4Y + o[1], 52);
      dc.drawCircle(W4X + o[0], W4Y + o[1], 30);
    } else {
      dc.drawCircle(W4X + o[0], W4Y + o[1], R4 - 4);
      dc.drawCircle(LX + o[0], LY + o[1], LR);
    }
    // date
    dc.setColor(0x6a6a6a, -1);
    F.px(dc, "" + d.day, 358 + o[0], 219 + o[1], 2, 1, 0);
    // hands: dim metal with lume
    const md = d.m * 6, hd = (d.h % 12) * 30 + d.m * 0.5;
    const lu = st === 2 ? 0x3a5a66 : 0x4a5a40;
    for (let k = 0; k < 2; k++) {
      const deg = k === 0 ? hd : md;
      const len = k === 0 ? 112 : 170, w = k === 0 ? 9 : 7;
      const s = Math.sin(deg * RAD), c = Math.cos(deg * RAD);
      const p1 = hpts(s, c, len, w, 22), p2 = hpts(s, c, len - 9, w - 3.5, -18);
      for (let i = 0; i < 5; i++) { p1[i][0] += o[0]; p1[i][1] += o[1]; p2[i][0] += o[0]; p2[i][1] += o[1]; }
      dc.setColor(met, -1);
      dc.fillPolygon(p1);
      dc.setColor(lu, -1);
      dc.fillPolygon(p2);
    }
    dc.setColor(met, -1);
    dc.fillCircle(cx, cy, 6);
  },
};
