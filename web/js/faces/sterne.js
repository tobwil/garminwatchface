// STERNE — "Sternenhimmel": the real sky above the user's location, now. ~150 bright stars,
// constellation figures, the Milky Way, the Moon at its real position and phase and the Sun,
// in a zenith-centred stereographic all-sky projection (north up, east left — as seen lying on
// your back). Star positions follow the local sidereal time (computed once per minute).
// Daytime: blue/twilight dome with the sun, stars only faint. Each wrist raise may bring a
// shooting star. Styles: 1 Planetarium, 2 Sternkarte (printed chart), 3 Polarlicht (aurora
// curtains over a pine forest). Mirrors watch/source/faces/Sterne.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const RAD = Math.PI / 180;
const CX = 227;
// stars: ra*40 << 20 | (dec+90)*10 << 9 | (mag+2)*10 << 2 | colour (0 blue-white, 1 white, 2 yellow-orange, 3 red)
const ST = [464247962, 463171760, 499858096, 514555092, 541812888, 562778796, 579527324, 106824353,
  735956224, 704475386, 660413692, 623695014, 644654280, 684520729, 7055533, 29061802,
  40617640, 60538044, 80478936, 868913792, 855256745, 818493642, 872001718, 829066948,
  781848656, 787085564, 790209756, 796497616, 793373439, 833075825, 829938878, 836208870,
  815220441, 801644232, 801547992, 249011299, 220619860, 228034704, 232194728, 235335828,
  238477976, 243680932, 234344152, 193483378, 229196944, 236498632, 181944546, 188254430,
  159967940, 318342800, 325662846, 278417564, 267963079, 282656458, 307806429, 283490836,
  292865164, 300218522, 267755680, 310689456, 321351773, 312979140, 426244232, 496512164,
  433624230, 471376568, 471350484, 425220316, 410576074, 414781678, 431545561, 598247506,
  619259570, 609879753, 630862046, 640262878, 583563454, 563488888, 675642552, 671433900,
  670367428, 692385919, 696571072, 705977006, 708055240, 709081314, 721660117, 739486877,
  742653104, 736371344, 772036760, 794098336, 799322808, 769963198, 775228610, 786754768,
  759474378, 802479830, 968374452, 968440499, 9976000, 6901412, 911724210, 952623320,
  27882198, 48877731, 87709350, 143322777, 131742884, 129709766, 156943560, 167389380,
  164202176, 221945942, 252349596, 252309688, 208249022, 652836084, 649678565, 653860520,
  659101416, 664343306, 669590262, 701071554, 702157534, 724166867, 713650924, 692631234,
  753602219, 734731970, 751532778, 735795476, 806113998, 720120528, 688641726, 647734486,
  591139040, 522328688, 537026176, 525505171, 513962176, 737674404, 962902144, 30777506,
  89710242, 80259256, 396778146, 68325476, 268626485, 614615110, 590499944];
// constellation figure lines: star a << 8 | star b
const LN = [1, 258, 515, 768, 772, 1029, 1286, 1800, 2057, 2314,
  2571, 2828, 3085, 3338, 3599, 3856, 4113, 4370, 4884, 5141,
  5908, 5142, 6169, 6426, 6683, 6940, 7193, 7709, 7455, 7456,
  8226, 8225, 10787, 10789, 9000, 9510, 9767, 10024, 10281, 9764,
  11823, 12076, 11819, 11053, 12594, 12597, 13620, 12854, 13875, 14903,
  14137, 14648, 14651, 15421, 15939, 17216, 16454, 17989, 17732, 16449,
  16703, 16194, 16958, 16706, 18248, 18507, 19274, 19017, 18759, 18252,
  20047, 20304, 20305, 20818, 21075, 21332, 21589, 21846, 22103, 22360,
  22617, 24666, 23133, 23904, 23902, 24159, 24413, 24411, 23393, 24924,
  23647, 23642, 25187, 25445, 25956, 25698, 25191, 26470, 25960, 26729,
  26986, 28011, 27502, 28271, 28528, 27500, 29042, 29299, 29484, 11380,
  29809, 30070, 30327, 30584, 30841, 31098, 31612, 31869, 32126, 32379,
  31615, 32897, 33155, 33666, 33408, 33412, 33925, 34182, 34439, 34696,
  35211, 35468, 37009, 38294];
// Milky Way: galactic equator every 10° (ra*40 << 20 | (dec+90)*10 << 9 | brightness 0..100)
const MW = [744801885, 760574561, 774251107, 787928164, 800556643, 814233185, 827909725, 844730455,
  864695888, 889900617, 923489344, 968604727, 18607661, 79421485, 131831341, 171647021,
  200970285, 223998509, 241781293, 257465901, 271052333, 284638253, 297175597, 310762029,
  324348461, 341082157, 360962605, 386089517, 419609645, 464671789, 521282093, 582103095,
  634550848, 674426953, 703823952, 726933079];
// constellation names (label order = priority) and [first star, count]
const CN = ["Gr. Wagen", "Polarstern", "Kassiopeia", "Schwan", "Leier", "Adler", "Orion", "Stier", "Zwillinge", "Gr. Hund",
  "", "Löwe", "Bärenhüter", "", "Skorpion", "Schütze", "Pegasus", "Andromeda", "Perseus", "Fuhrmann", "Krone",
  "Herkules", "Drache", "Kreuz"];
const CS = [0, 7, 7, 7, 14, 5, 19, 5, 24, 5, 29, 6, 35, 8, 43, 6, 49, 6, 55, 5, 60, 2, 62, 9, 71, 6, 77, 1, 78, 12,
  90, 8, 98, 6, 104, 3, 107, 6, 113, 4, 117, 6, 123, 5, 128, 9, 137, 4];
const NS = ST.length;
const NM = MW.length;
const NL = LN.length;
const STAR_COL = [0xcfe0ff, 0xffffff, 0xffe0a8, 0xffa486];
const INK = 0x1b2238;
const PAPER = 0xece3cb;
// style 3 panorama: looking north, view centre 15° above the horizon
const SH3 = 0.258819, CH3 = 0.9659258, K3 = 300, CY3 = 255;
const NA = 44; // aurora rays
const NT = 40; // far shore trees
const AUC = [0x86ffc0, 0x3ee69a, 0x179a78, 0x6a40c0];
const AUA = [1.0, 0.86, 0.62, 0.46];

// ---- catalogue, decoded once: magnitude, right ascension (deg), sin/cos declination
const MAG = [], SRA = [], SDE = [], CDE = [];
for (let i = 0; i < NS; i++) {
  const v = ST[i];
  MAG.push(((v >> 2) & 127) / 10.0 - 2);
  SRA.push((v >> 20) * 0.375);
  const de = (((v >> 9) & 2047) / 10.0 - 90) * RAD;
  SDE.push(Math.sin(de));
  CDE.push(Math.cos(de));
}

// ---- per-minute sky cache (screen positions of the resting sky)
let K = -1;
const SX = new Array(NS).fill(0), SY = new Array(NS).fill(0), SU = new Array(NS).fill(0);
const WX = new Array(NM).fill(0), WY = new Array(NM).fill(0), WU = new Array(NM).fill(0);
let SUNX = 0, SUNY = 0, SUNU = 0, MOX = 0, MOY = 0, MOU = 0, EL = 0;
// ---- per-minute paint cache for the resting frame (intro finished): star colours,
// Milky Way colours, constellation label positions
let PK = -1;
const SC = new Array(NS).fill(-1), SF = new Array(NS).fill(0);
const MWC = new Array(NM * 2).fill(0);
let NLB = 0;
const LBX = [0, 0, 0, 0], LBY = [0, 0, 0, 0], LBW = [0, 0, 0, 0], LBI = [0, 0, 0, 0];
// per-frame (intro-animated) positions
const RX = new Array(NS).fill(0), RY = new Array(NS).fill(0);
// style 3 static geometry (built once): horizon y every 8 px, aurora rays, landscape polygons
let HZ = null;
const ABX = new Array(NA).fill(0), ABY = new Array(NA).fill(0), AUX = new Array(NA).fill(0), AUY = new Array(NA).fill(0);
const ARH = new Array(NA).fill(0); // 2 x horizon y under each ray (mirror line)
const AS = new Array(NA).fill(0), AF = new Array(NA).fill(0); // per-frame ray strength / shimmer
const AP = new Array(64).fill(0); // aurora palettes: sky + lake, 4 bands x 8 levels
let APK = -1, APB = -1;
let LAKE = null, TREES = null, NEAR = null;
let FPS = 8;
let px = 0, py = 0, pu = 0;
let sp = 0, cp = 1;

function wrap(v) { return v - 360 * Math.floor(v / 360); }

// local horizontal unit vector (east, north, up) -> screen px, py for the style's projection
function projV(e, n, u, st, R) {
  pu = u;
  if (st === 3) {
    const dd = n * CH3 + u * SH3;
    const k = K3 / (dd > -0.9 ? 1 + dd : 0.1);
    px = CX + k * e;
    py = CY3 - k * (u * CH3 - n * SH3);
  } else {
    // zenith-centred stereographic all-sky map, north up, east left
    const k = R / (u > -0.95 ? 1 + u : 0.05);
    px = CX - k * e;
    py = CX - k * n;
  }
}

// hour angle h (deg) / sin, cos of the declination
function proj(h, sd, cd, st, R) {
  const sh = Math.sin(h * RAD), ch = Math.cos(h * RAD);
  projV(-cd * sh, cp * sd - sp * cd * ch, sp * sd + cp * cd * ch, st, R);
}

// azimuth / altitude (degrees)
function projA(az, alt, st, R) {
  const ca = Math.cos(alt * RAD);
  projV(ca * Math.sin(az * RAD), ca * Math.cos(az * RAD), Math.sin(alt * RAD), st, R);
}

// ecliptic longitude/latitude (deg) at local sidereal time lst
function projEcl(lam, bet, lst, st, R) {
  const ep = 23.439 * RAD;
  const sl = Math.sin(lam * RAD), cl = Math.cos(lam * RAD);
  const sb = Math.sin(bet * RAD), cb = Math.cos(bet * RAD);
  const ra = Math.atan2(sl * Math.cos(ep) - (sb / cb) * Math.sin(ep), cl) / RAD;
  const de = Math.asin(sb * Math.cos(ep) + cb * Math.sin(ep) * sl);
  proj(lst - ra, Math.sin(de), Math.cos(de), st, R);
}

function radius(st) { return st === 2 ? 192 : 196; }

function sky(d, st) {
  const R = radius(st);
  const key = ((d.year % 10) * 400 + d.doy) * 5760 + d.mins * 4 + st;
  if (key === K) return;
  K = key;
  const lat = d.locOk ? d.lat : 52.52;
  const lon = d.locOk ? d.lon : 13.4;
  sp = Math.sin(lat * RAD);
  cp = Math.cos(lat * RAD);
  const sec = d.unix - 946728000;
  const nd = Math.floor(sec / 86400);
  const fr = (sec - nd * 86400) / 86400.0;
  const lst = wrap(280.46061837 + 0.98564736629 * nd + 360.98564736629 * fr + lon);
  for (let i = 0; i < NS; i++) {
    proj(lst - SRA[i], SDE[i], CDE[i], st, R);
    SX[i] = px; SY[i] = py; SU[i] = pu;
  }
  for (let i = 0; i < NM; i++) {
    const v = MW[i];
    const de = (((v >> 9) & 2047) / 10.0 - 90) * RAD;
    proj(lst - (v >> 20) * 0.375, Math.sin(de), Math.cos(de), st, R);
    WX[i] = px; WY[i] = py; WU[i] = pu;
  }
  const n = nd + fr;
  // sun (low precision ephemeris)
  const g = wrap(357.528 + 0.9856003 * n);
  const ls = wrap(280.46 + 0.9856474 * n) + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD);
  projEcl(ls, 0, lst, st, R);
  SUNX = px; SUNY = py; SUNU = pu;
  EL = Math.asin(G.clamp(pu, -1, 1)) / RAD;
  // moon (main periodic terms)
  const l0 = wrap(218.316 + 13.176396 * n);
  const mm = wrap(134.963 + 13.064993 * n);
  const ff = wrap(93.272 + 13.22935 * n);
  projEcl(l0 + 6.289 * Math.sin(mm * RAD), 5.128 * Math.sin(ff * RAD), lst, st, R);
  MOX = px; MOY = py; MOU = pu;
}

function hy(x) {
  const f = G.clamp(x / 8.0, 0, 56.99);
  const j = Math.floor(f);
  return HZ[j] + (HZ[j + 1] - HZ[j]) * (f - j);
}

// spruce outline with n drooping branch tiers (base centre x, b; half width w; height h)
function pinePts(x, b, w, h, n) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const yk = b - (h * k * 0.9) / n, wk = w * (1 - k / n);
    pts.push([x - wk, yk]);
    pts.push([x - wk * 0.32, yk - (h * 0.5) / n]);
  }
  pts.push([x, b - h]);
  for (let k = n - 1; k >= 0; k--) {
    const yk = b - (h * k * 0.9) / n, wk = w * (1 - k / n);
    pts.push([x + wk * 0.32, yk - (h * 0.5) / n]);
    pts.push([x + wk, yk]);
  }
  return pts;
}

// style 3: horizon table, aurora ray geometry and landscape polygons (static, built once)
function panoInit() {
  if (HZ !== null) return;
  HZ = new Array(58).fill(CY3);
  for (let az = -100; az <= 100; az++) {
    projA(az, 0, 3, 0);
    const j = Math.floor(px / 8.0 + 0.5);
    if (j >= 0 && j < 58) HZ[j] = py;
  }
  for (let i = 0; i < NA; i++) {
    const az = -77.4 + i * 3.6;
    projA(az, 4, 3, 0);
    ABX[i] = px; ABY[i] = py;
    projA(az, 14, 3, 0);
    AUX[i] = (px - ABX[i]) / 10.0; AUY[i] = (py - ABY[i]) / 10.0;
    ARH[i] = 2 * hy(ABX[i]);
  }
  // lake below the horizon
  LAKE = [];
  for (let j = 0; j < 58; j += 2) LAKE.push([j * 8, HZ[j]]);
  LAKE.push([456, HZ[57]]);
  LAKE.push([456, 456]);
  LAKE.push([0, 456]);
  // far shore: four polygons of ten trees each, standing on a 4 px shore strip
  TREES = [];
  let s = 4242;
  for (let g = 0; g < 4; g++) {
    const pts = [];
    let x0 = 0, x1 = 0;
    for (let i = 0; i < 10; i++) {
      s = G.rnd(s);
      const x = 4 + (g * 10 + i) * 11.4 + (s % 6);
      const h = 10 + (s % 23) + (Math.abs(x - CX) > 150 ? 8 : 0);
      const w = 5 + (s % 3);
      const b = hy(x) + 1;
      if (i === 0) x0 = g === 0 ? -2 : x - w;
      x1 = g === 3 && i === 9 ? 456 : x + w;
      pts.push([x - w, b]);
      pts.push([x, b - h]);
      pts.push([x + w, b]);
    }
    pts.push([x1, hy(x1) + 4]);
    pts.push([x0, hy(x0) + 4]);
    TREES.push(pts);
  }
  // near spruces framing the view
  NEAR = [pinePts(30, 430, 58, 270, 7), pinePts(78, 450, 34, 190, 5), pinePts(424, 430, 58, 280, 7), pinePts(380, 452, 32, 170, 5)];
}

// sky colours [zenith, horizon] for a sun elevation and style
function skyCols(st, el) {
  let zn, hn, zt, ht, zd, hd;
  if (st === 3) { zn = 0x010308; hn = 0x061a1a; zt = 0x0a1a3a; ht = 0x34507a; zd = 0x2a66b4; hd = 0x9cc8e8; }
  else { zn = 0x03050d; hn = 0x0b1730; zt = 0x0c1840; ht = 0x3a4f86; zd = 0x1f56a6; hd = 0x7cb2e2; }
  if (el >= 4) return [zd, hd];
  if (el >= -6) { const f = (el + 6) / 10.0; return [G.mix(zt, zd, f), G.mix(ht, hd, f)]; }
  if (el >= -18) { const f = (el + 18) / 12.0; return [G.mix(zn, zt, f), G.mix(hn, ht, f)]; }
  return [zn, hn];
}

// filled lens: limb on the side of unit vector (ux, uy), terminator at c * r
function lens(dc, x, y, r, ux, uy, c) {
  const vx = -uy, vy = ux;
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = (-90 + i * 22.5) * RAD;
    const a = r * Math.cos(t), b = r * Math.sin(t);
    pts.push([x + ux * a + vx * b, y + uy * a + vy * b]);
  }
  for (let i = 8; i >= 0; i--) {
    const t = (-90 + i * 22.5) * RAD;
    const a = r * Math.cos(t) * c, b = r * Math.sin(t);
    pts.push([x + ux * a + vx * b, y + uy * a + vy * b]);
  }
  dc.fillPolygon(pts);
}

// moon in its real phase, lit side towards the sun
function moon(dc, x, y, r, ph, lit, dark) {
  dc.setColor(dark, -1);
  dc.fillCircle(x, y, r);
  const il = (1 - Math.cos(ph * 2 * Math.PI)) / 2;
  if (il < 0.03) return;
  let ux = SUNX - MOX, uy = SUNY - MOY;
  const l = Math.sqrt(ux * ux + uy * uy);
  if (l < 0.5) { ux = 1; uy = 0; } else { ux = ux / l; uy = uy / l; }
  dc.setColor(lit, -1);
  if (il > 0.97) dc.fillCircle(x, y, r);
  else lens(dc, x, y, r, ux, uy, Math.cos(ph * 2 * Math.PI));
}

// true if (x, y) lies under the text (time/date/slots) of style st
function under(st, x, y, tw) {
  if (st === 3) return (y > 66 && y < 156 && Math.abs(x - CX) < tw) || (y > 40 && y <= 66 && Math.abs(x - CX) < 76);
  if (y > 136 && y < 262 && Math.abs(x - CX) < tw) return true;
  return y >= 262 && y < 318 && x > 72 && x < 382;
}

// brightness factor of star i at intro threshold thr (0 = not drawn)
function starF(st, i, x, y, thr, vis, tw) {
  const mag = MAG[i];
  if (mag > thr) return 0;
  let f = G.clamp(thr - mag, 0, 1) * vis * G.clamp(1.25 - mag * 0.13, 0.45, 1);
  if (SU[i] < 0.12) f = f * (0.45 + SU[i] * 4.5); // horizon extinction
  if (under(st, x, y, tw)) f = f * 0.55;
  return f;
}

// one star in colour c (already mixed into the sky colour bg)
function star(dc, st, x, y, mag, c, bg) {
  dc.setColor(c, -1);
  if (st === 2) {
    // printed chart: ink dots sized by magnitude
    const r = 4.4 - mag * 0.75;
    if (r >= 2.2) dc.fillCircle(x, y, r);
    else { const s = r >= 1.5 ? 3 : 2; dc.fillRectangle(x - 1, y - 1, s, s); }
  } else if (mag < 0.6) {
    dc.setColor(G.mix(bg, c, 0.22), -1);
    dc.fillCircle(x, y, 7);
    dc.setColor(G.mix(bg, c, 0.5), -1);
    dc.fillRectangle(x - 9, y, 19, 1);
    dc.fillRectangle(x, y - 9, 1, 19);
    dc.setColor(c, -1);
    dc.fillCircle(x, y, 3.2);
  } else if (mag < 1.6) {
    dc.setColor(G.mix(bg, c, 0.4), -1);
    dc.fillRectangle(x - 4, y, 9, 1);
    dc.fillRectangle(x, y - 4, 1, 9);
    dc.setColor(c, -1);
    dc.fillCircle(x, y, 2.4);
  } else if (mag < 2.6) dc.fillRectangle(x - 1, y - 1, 3, 3);
  else dc.fillRectangle(x - 1, y - 1, 2, 2);
}

function starCol(st, i, f, bg) { return G.mix(bg, st === 2 ? INK : STAR_COL[ST[i] & 3], f); }

function mwCol(st, pass, i, bg, k) {
  const w = ((MW[i] & 511) + (MW[(i + 1) % NM] & 511)) / 200.0;
  if (st === 2) return G.mix(bg, 0xcfcfc4, (pass === 0 ? 0.5 : 0.85) * w * k);
  return G.mix(bg, st === 3 ? 0x24343e : 0x2a3658, (pass === 0 ? 0.45 : 0.7) * w * k);
}

// constellation labels for the resting sky: below each figure, no overlaps, max 4
function labels(st, R, tw) {
  NLB = 0;
  for (let c = 0; c < CN.length && NLB < 4; c++) {
    if (CN[c].length === 0) continue;
    const s0 = CS[c * 2], n = CS[c * 2 + 1];
    let sx = 0, sy = 0, ok = true;
    for (let k = s0; k < s0 + n; k++) {
      if (SU[k] <= 0.05) { ok = false; break; }
      sx += SX[k];
      if (SY[k] > sy) sy = SY[k];
    }
    if (!ok) continue;
    sx = sx / n; sy = sy + 7;
    if (c === 1) { sx = SX[7]; sy = SY[7] + 7; }
    const lw = F.pxW(CN[c], 2) / 2;
    const ddx = Math.abs(sx - CX) + lw, ddy = Math.abs(sy + 7 - CX) + 7;
    if (ddx * ddx + ddy * ddy > (R - 4) * (R - 4)) continue;
    if (st === 3 && (sy + 44 > hy(sx) || sx < 96 || sx > 358)) continue;
    if (under(st, sx - lw, sy, tw) || under(st, sx + lw, sy, tw) || under(st, sx - lw, sy + 14, tw) || under(st, sx + lw, sy + 14, tw)) continue;
    let hit = false;
    for (let q = 0; q < NLB; q++) {
      if (Math.abs(LBX[q] - sx) < LBW[q] + lw + 6 && Math.abs(LBY[q] - sy) < 18) hit = true;
    }
    if (hit) continue;
    LBX[NLB] = sx; LBY[NLB] = sy; LBW[NLB] = lw; LBI[NLB] = c;
    NLB++;
  }
}

// aurora curtain envelope at azimuth az (deg from north, east positive), 0..1
function auS(az, t) {
  const e = 1 - (az / 82) * (az / 82);
  if (e <= 0) return 0;
  return G.clamp(0.42 + 0.7 * G.noise(az * 0.045 + t * 0.00032), 0.04, 1) * e;
}

// aurora over the northern horizon (style 3): dense rays from bright green (low) to violet (high).
// refl: mirror image in the lake (dimmer, broken by ripples), reuses the main pass' rays
function aurora(dc, t, k, refl) {
  dc.setPenWidth(refl ? 4 : 6);
  const o = refl ? 32 : 0;
  for (let i = 0; i < NA; i++) {
    let s, fine;
    if (refl) { s = AS[i]; fine = AF[i]; }
    else {
      s = auS(-77.4 + i * 3.6, t);
      fine = 0.62 + 0.38 * G.noise(i * 1.09 + t * 0.0013);
      AS[i] = s; AF[i] = fine;
    }
    if (s < 0.06) continue;
    const q = Math.floor(G.clamp(s * fine * k * 1.25, 0, 0.999) * 8) + o;
    const L = (6 + 40 * s) * (0.8 + 0.2 * fine) * k;
    const bx = ABX[i], by = ABY[i], ux = AUX[i] * L, uy = AUY[i] * L;
    if (refl) {
      const h2 = ARH[i];
      for (let j = 0; j < 3; j++) {
        const y0 = h2 - (by + uy * j * 0.2) + 6 + j * 3;
        dc.setColor(AP[j * 8 + q], -1);
        dc.drawLine(bx + ux * j * 0.2, y0, bx + ux * (j * 0.2 + 0.12), y0 - uy * 0.12);
      }
      continue;
    }
    let x0 = bx, y0 = by;
    for (let j = 0; j < 4; j++) {
      const f = j === 0 ? 0.3 : j === 1 ? 0.55 : j === 2 ? 0.8 : 1.0;
      const x = bx + ux * f, y = by + uy * f;
      dc.setColor(AP[j * 8 + q], -1);
      dc.drawLine(x0, y0, x, y);
      x0 = x; y0 = y;
    }
  }
}

export default {
  get fps() { return FPS; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const R = radius(st);
    if (st === 3) panoInit();
    sky(d, st);
    const dark = G.clamp((-EL - 2) / 12.0, 0, 1);
    const sc = skyCols(st, EL);
    const zen = sc[0], hor = sc[1];
    const bg = st === 2 ? PAPER : G.mix(hor, zen, st === 3 ? 0.45 : 0.5);
    const t = a.live ? a.t : 0;
    FPS = st === 2 ? 5 : st === 3 && dark > 0.2 ? 12 : 8;
    const e = G.ease(p);
    const rest = p >= 1;
    const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
    const ts = hh + ":" + G.pad2(d.m);
    const th = st === 3 ? 76 : 84;
    const tw = F.stW(ts, th) / 2 + 14;
    const vis = st === 2 ? 1 : 0.16 + 0.84 * dark;
    const mwk = (st === 2 ? 1 : dark) * e;

    // ---- resting frame: colours + labels once per minute
    if (rest && PK !== K) {
      PK = K;
      for (let i = 0; i < NS; i++) {
        const f = SU[i] > 0 ? starF(st, i, SX[i], SY[i], 6, vis, tw) : 0;
        SF[i] = f;
        SC[i] = f > 0.02 ? starCol(st, i, f, bg) : -1;
      }
      for (let i = 0; i < NM; i++) { MWC[i] = mwCol(st, 0, i, bg, mwk); MWC[NM + i] = mwCol(st, 1, i, bg, mwk); }
      labels(st, R, tw);
    }

    // ---- intro: the dome turns into place (1, 2) / the sky rises (3)
    const rot = st === 3 ? 0 : -50 * (1 - e);
    const cr = Math.cos(rot * RAD), sr = Math.sin(rot * RAD);
    const lift = st === 3 ? 36 * (1 - e) : 0;
    const rx = rest ? SX : RX, ry = rest ? SY : RY;
    if (!rest) {
      for (let i = 0; i < NS; i++) {
        if (SU[i] <= 0) continue;
        if (st === 3) { RX[i] = SX[i]; RY[i] = SY[i] + lift; }
        else {
          const dx = SX[i] - CX, dy = SY[i] - CX;
          RX[i] = CX + dx * cr - dy * sr;
          RY[i] = CX + dx * sr + dy * cr;
        }
      }
    }

    // ---- background
    if (st === 2) {
      dc.setColor(PAPER, -1);
      dc.fillCircle(CX, CX, 227);
    } else if (st === 3) {
      for (let k = 0; k < 15; k++) {
        dc.setColor(G.mix(zen, hor, Math.pow(k / 14.0, 1.6)), -1);
        dc.fillRectangle(0, k * 20, 454, 20);
      }
    } else {
      // radial gradient: 10 concentric rings, horizon -> zenith
      const rw = R / 10.0;
      dc.setPenWidth(rw + 2);
      for (let k = 0; k < 10; k++) {
        dc.setColor(G.mix(hor, zen, Math.pow((k + 0.5) / 10.0, 0.6)), -1);
        if (k < 9) dc.drawCircle(CX, CX, R - rw * (k + 0.5));
        else dc.fillCircle(CX, CX, rw + 1);
      }
    }
    // twilight glow around the sun's direction (masked by rim / lake)
    const gl = st === 2 ? 0 : 1 - Math.abs(EL + 3) / 10.0;
    if (gl > 0) {
      let gx = SUNX - CX, gy = SUNY - CX;
      if (st === 3) { gx = G.clamp(gx, -260, 260); gy = hy(CX + G.clamp(gx, -227, 227)) - CX; }
      else {
        const gr = Math.sqrt(gx * gx + gy * gy);
        if (gr > R * 1.15) { gx = (gx * R * 1.15) / gr; gy = (gy * R * 1.15) / gr; }
      }
      for (let k = 0; k < 9; k++) {
        dc.setColor(G.mix(hor, k > 5 ? 0xffd08a : 0xf0905a, gl * (0.08 + k * 0.055)), -1);
        dc.fillCircle(CX + gx, CX + gy, 160 - k * 16);
      }
    }

    // ---- Milky Way
    if (mwk > 0.05) {
      for (let pass = 0; pass < 2; pass++) {
        dc.setPenWidth(pass === 0 ? 30 : 12);
        for (let i = 0; i < NM; i++) {
          const j = (i + 1) % NM;
          if (WU[i] < -0.2 || WU[j] < -0.2) continue;
          dc.setColor(rest ? MWC[pass * NM + i] : mwCol(st, pass, i, bg, mwk), -1);
          let x0 = WX[i], y0 = WY[i] + lift, x1 = WX[j], y1 = WY[j] + lift;
          if (!rest && st !== 3) {
            const ax = x0 - CX, ay = y0 - CX, bx = x1 - CX, by = y1 - CX;
            x0 = CX + ax * cr - ay * sr; y0 = CX + ax * sr + ay * cr;
            x1 = CX + bx * cr - by * sr; y1 = CX + bx * sr + by * cr;
          }
          dc.drawLine(x0, y0, x1, y1);
        }
      }
    }

    // ---- grid: altitude circles 30° / 60° (+ azimuth spokes on the chart)
    dc.setPenWidth(1);
    if (st === 2) {
      dc.setColor(0xcdb88e, -1);
      dc.drawCircle(CX, CX, R * 0.577);
      dc.drawCircle(CX, CX, R * 0.268);
      for (let k = 0; k < 12; k++) G.tick(dc, CX, CX, R * 0.268, R, k * 30);
    } else if (st === 1) {
      dc.setColor(G.mix(bg, acc, 0.16), -1);
      dc.drawCircle(CX, CX, R * 0.577);
      dc.drawCircle(CX, CX, R * 0.268);
    }

    // ---- aurora (behind the stars); palettes for sky + lake only change with k
    const ak = st === 3 ? dark * e : 0;
    const wt = G.mix(hor, 0x000000, 0.55);
    if (ak > 0.02) {
      if (APK !== ak || APB !== bg) {
        APK = ak; APB = bg;
        for (let j = 0; j < 4; j++) {
          for (let q = 0; q < 8; q++) {
            AP[j * 8 + q] = G.mix(bg, AUC[j], (AUA[j] * (q + 0.5)) / 8.0);
            AP[32 + j * 8 + q] = G.mix(wt, AUC[j], (AUA[j] * (q + 0.5) * 0.42) / 8.0);
          }
        }
      }
      aurora(dc, t, ak, false);
    }

    // ---- constellation figures (draw on after the stars appear)
    const lp = G.clamp((p - 0.45) / 0.5, 0, 1);
    if (lp > 0) {
      dc.setColor(st === 2 ? G.mix(bg, 0x5a6278, 0.75) : G.mix(bg, st === 3 ? 0x8fd8c0 : acc, 0.18 + 0.22 * dark), -1);
      dc.setPenWidth(1);
      for (let i = 0; i < NL; i++) {
        const sa = LN[i] >> 8, sb = LN[i] & 255;
        if (SU[sa] <= 0 || SU[sb] <= 0) continue;
        const x0 = rx[sa], y0 = ry[sa];
        dc.drawLine(x0, y0, x0 + (rx[sb] - x0) * lp, y0 + (ry[sb] - y0) * lp);
      }
    }

    // ---- stars (brightest first during the intro; twinkling when awake)
    const thr = -1.5 + 7.5 * G.ease(p * 1.3);
    const tw2 = st !== 2 && a.live && rest;
    for (let i = 0; i < NS; i++) {
      if (SU[i] <= 0) continue;
      let c;
      if (rest) {
        c = SC[i];
        if (c === -1) continue;
        if (tw2 && MAG[i] < 2) c = starCol(st, i, SF[i] * (0.8 + 0.2 * G.noise(t * 0.004 + i * 1.37)), bg);
      } else {
        const f = starF(st, i, rx[i], ry[i], thr, vis, tw);
        if (f <= 0.02) continue;
        c = starCol(st, i, f, bg);
      }
      star(dc, st, rx[i], ry[i], MAG[i], c, bg);
    }
    // Pleiades (star 48 = Alcyone)
    if (SU[48] > 0 && thr > 3) {
      dc.setColor(G.mix(bg, st === 2 ? INK : 0xcfe0ff, (st === 2 ? 0.7 : 0.6) * vis), -1);
      dc.fillRectangle(rx[48] - 5, ry[48] - 3, 2, 2);
      dc.fillRectangle(rx[48] + 3, ry[48] - 4, 2, 2);
      dc.fillRectangle(rx[48] - 3, ry[48] + 3, 2, 2);
      dc.fillRectangle(rx[48] + 4, ry[48] + 2, 2, 2);
    }

    // ---- constellation names (resting frame)
    if (rest && (st === 2 || dark > 0.4)) {
      dc.setColor(st === 2 ? 0x8a5a3a : G.mix(bg, st === 3 ? 0x8fd8c0 : acc, 0.3 + 0.25 * dark), -1);
      for (let q = 0; q < NLB; q++) F.px(dc, CN[LBI[q]], LBX[q], LBY[q], 2, 1, 0);
    }

    // ---- sun and moon
    const pop = G.spring(G.stag(p, 0, 0.3, 0.5));
    if (SUNU > -0.02 && pop > 0) {
      if (st === 2) {
        dc.setColor(0xb03a2a, -1);
        dc.setPenWidth(2);
        dc.drawCircle(SUNX, SUNY, 10 * pop);
        dc.fillCircle(SUNX, SUNY, 3 * pop);
        for (let k = 0; k < 8; k++) G.tick(dc, SUNX, SUNY, 14 * pop, 19 * pop, k * 45);
      } else {
        dc.setColor(G.mix(bg, 0xfff0c0, 0.25), -1);
        dc.fillCircle(SUNX, SUNY, 22 * pop);
        dc.setColor(G.mix(bg, 0xfff0c0, 0.5), -1);
        dc.fillCircle(SUNX, SUNY, 15 * pop);
        dc.setColor(0xfffbe8, -1);
        dc.fillCircle(SUNX, SUNY, 10 * pop);
      }
    }
    let mx = MOX, my = MOY + lift;
    if (rot !== 0) {
      const dx = mx - CX, dy = my - CX;
      mx = CX + dx * cr - dy * sr; my = CX + dx * sr + dy * cr;
    }
    const moonUp = MOU > -0.02 && pop > 0;
    if (moonUp) {
      if (st === 2) {
        moon(dc, mx, my, 11 * pop, d.moon, PAPER, 0x2a3044);
        dc.setColor(INK, -1);
        dc.setPenWidth(2);
        dc.drawCircle(mx, my, 11 * pop);
      } else {
        dc.setColor(G.mix(bg, 0xe8ecff, 0.12), -1);
        dc.fillCircle(mx, my, 17 * pop);
        moon(dc, mx, my, 11 * pop, d.moon, 0xf4f0dc, G.mix(bg, 0x39405a, 0.6));
      }
    }

    // ---- shooting star: one per wrist raise (dark sky)
    if (a.live && rest && (st === 2 || dark > 0.5)) {
      let s = G.rnd(d.wakeN * 7919 + 13);
      const t0 = 1800 + (s % 4200);
      const u = (t - t0) / 900.0;
      if (u > 0 && u < 1) {
        s = G.rnd(s);
        let x0, y0, dir;
        if (st === 3) {
          x0 = 110 + (s % 234); s = G.rnd(s);
          y0 = 150 + (s % 60); s = G.rnd(s);
          dir = 200 + (s % 80) + (x0 > CX ? 0 : -60);
        } else {
          const ang = s % 360;
          s = G.rnd(s);
          const rr = 70 + (s % 90);
          s = G.rnd(s);
          dir = ang + 100 + (s % 40);
          x0 = G.ptX(CX, rr, ang); y0 = G.ptY(CX, rr, ang);
        }
        const hd = 150 * G.ease(u);
        const fade = u < 0.7 ? 1 : (1 - u) / 0.3;
        for (let k = 0; k < 3; k++) {
          const a0 = G.clamp(hd - 22 - k * 22, 0, 999), a1 = G.clamp(hd - k * 22, 0, 999);
          if (a1 <= a0) continue;
          dc.setColor(G.mix(bg, st === 2 ? INK : 0xffffff, fade * (1 - k * 0.32)), -1);
          dc.setPenWidth(k === 0 ? 2 : 1);
          dc.drawLine(G.ptX(x0, a1, dir), G.ptY(y0, a1, dir), G.ptX(x0, a0, dir), G.ptY(y0, a0, dir));
        }
      }
    }

    // ---- landscape (3) / rim with compass (1, 2)
    const day = EL > 0;
    if (st === 3) {
      dc.setColor(wt, -1);
      dc.fillPolygon(LAKE);
      const lb = G.mix(zen, 0x000000, 0.7);
      for (let k = 0; k < 8; k++) {
        dc.setColor(G.mix(wt, lb, (k + 1) / 8.0), -1);
        dc.fillRectangle(0, 300 + k * 20, 454, 20);
      }
      if (ak > 0.02) aurora(dc, t, ak, true);
      // moon glitter on the water
      if (moonUp && my < hy(mx) && mx > 30 && mx < 424) {
        const h0 = hy(mx);
        for (let k = 0; k < 7; k++) {
          const w = 16 - k * 1.6 + 3 * G.noise(k * 1.7 + t * 0.002);
          dc.setColor(G.mix(wt, 0xf4f0dc, 0.5 - k * 0.055), -1);
          dc.fillRectangle(mx - w / 2, h0 + 8 + k * 9, w, 2);
        }
      }
      dc.setColor(G.mix(0x010302, 0x10261e, G.clamp((EL + 6) / 12.0, 0, 1)), -1);
      for (let k = 0; k < 4; k++) dc.fillPolygon(TREES[k]);
      dc.setColor(0x000000, -1);
      for (let k = 0; k < 4; k++) dc.fillPolygon(NEAR[k]);
      dc.setColor(G.mix(wt, 0x8fd8c0, 0.5), -1);
      F.px(dc, "N", CX, hy(CX) + 10, 2, 1, 0);
      F.px(dc, "NW", 101, hy(101) + 10, 2, 1, 0);
      F.px(dc, "NO", 353, hy(353) + 10, 2, 1, 0);
    } else {
      const rim = st === 2 ? 0x1d2a48 : 0x04060c;
      dc.setColor(rim, -1);
      dc.setPenWidth(36);
      dc.drawCircle(CX, CX, R + 18);
      const ink = st === 2 ? 0xe9dfc4 : G.mix(rim, acc, 0.55);
      dc.setColor(ink, -1);
      dc.setPenWidth(st === 2 ? 2 : 1);
      dc.drawCircle(CX, CX, R + 1);
      dc.setPenWidth(1);
      // azimuth scale every 5° (unit vector rotated step by step, no trig per tick)
      const c5 = Math.cos(5 * RAD), s5 = Math.sin(5 * RAD);
      let ux = 0, uy = -1;
      for (let k = 0; k < 72; k++) {
        if (k % 18 !== 0) {
          const r2 = R + (k % 6 === 0 ? 11 : 6);
          dc.drawLine(CX + ux * (R + 3), CX + uy * (R + 3), CX + ux * r2, CX + uy * r2);
        }
        const nx = ux * c5 - uy * s5;
        uy = uy * c5 + ux * s5;
        ux = nx;
      }
      // seconds pointer on the printed chart's cover
      if (st === 2 && a.live && rest) {
        const sa = (d.s + a.ms / 1000.0) * 6;
        dc.setColor(0xe2574a, -1);
        dc.fillPolygon([[G.ptX(CX, R + 3, sa), G.ptY(CX, R + 3, sa)], [G.ptX(CX, R + 13, sa - 2.6), G.ptY(CX, R + 13, sa - 2.6)],
          [G.ptX(CX, R + 13, sa + 2.6), G.ptY(CX, R + 13, sa + 2.6)]]);
      }
      const lr = R + 19;
      dc.setColor(st === 2 ? 0xe2574a : acc, -1);
      F.st(dc, "N", CX, CX - lr, 15, 2, 1, 1.0, 0);
      dc.setColor(ink, -1);
      F.st(dc, "S", CX, CX + lr, 15, 2, 1, 1.0, 0);
      F.st(dc, "O", CX - lr, CX, 15, 2, 1, 1.0, 0);
      F.st(dc, "W", CX + lr, CX, 15, 2, 1, 1.0, 0);
    }

    // ---- text
    const tcol = st === 2 ? INK : st === 3 ? 0xeafff4 : 0xffffff;
    const dcl = st === 2 ? 0xa8322a : st === 3 ? (day ? 0xeafff4 : 0x8fe8c0) : (day ? 0xffffff : acc);
    dc.setColor(dcl, -1);
    F.st(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX, st === 3 ? 54 : 150, 17, 2, 1, G.ease(p * 1.6), 0);
    dc.setColor(tcol, -1);
    F.st(dc, ts, CX, st === 3 ? 112 : 206, th, st === 2 ? 6 : 7, 1, G.easeInOut(p * 1.15), 0);
    const sy0 = st === 3 ? 352 : 268;
    const sb = st === 3 ? G.mix(hor, 0x000000, 0.6) : bg;
    for (let k = 0; k < 3; k++) {
      const sl = d.slots[k];
      const x = CX + (k - 1) * 100;
      const s2 = G.stag(p, k, 0.12, 0.5);
      if (s2 <= 0) continue;
      dc.setColor(G.mix(sb, st === 2 ? 0x6a6050 : st === 3 ? 0x7aa89a : day ? 0xe0ecff : 0x8a93a8, s2), -1);
      F.px(dc, sl.lbl, x, sy0, 2, 1, 0);
      dc.setColor(G.mix(sb, st === 2 ? INK : d.dcol, s2), -1);
      F.st(dc, sl.val, x, sy0 + 30, 20, 2, 1, 1.0, 0);
    }
  },

  aod(dc, d) {
    const st = d.cfg.style;
    const o = St.shift(d);
    const ox = o[0], oy = o[1];
    if (st === 3) panoInit();
    sky(d, st);
    const hh = d.is24 ? G.pad2(d.h) : "" + G.hour(d);
    const ts = hh + ":" + G.pad2(d.m);
    const th = st === 3 ? 76 : 84;
    const tw = F.stW(ts, th) / 2 + 14;
    dc.setColor(0x2a3040, -1);
    if (st === 3) {
      for (let j = 1; j < 57; j++) dc.fillRectangle(j * 8 + ox, HZ[j] + oy, 2, 2);
    } else {
      const rr = radius(st) + 1;
      for (let k = 0; k < 72; k++) dc.fillRectangle(G.ptX(CX + ox, rr, k * 5) - 1, G.ptY(CX + oy, rr, k * 5) - 1, 2, 2);
    }
    dc.setColor(0x1e2432, -1);
    dc.setPenWidth(1);
    for (let i = 0; i < NL; i++) {
      const sa = LN[i] >> 8, sb = LN[i] & 255;
      if (SU[sa] <= 0 || SU[sb] <= 0) continue;
      dc.drawLine(SX[sa] + ox, SY[sa] + oy, SX[sb] + ox, SY[sb] + oy);
    }
    for (let i = 0; i < NS; i++) {
      if (SU[i] <= 0.03) continue;
      const mag = MAG[i];
      if (mag > 2.6 || under(st, SX[i], SY[i], tw)) continue;
      dc.setColor(mag < 1 ? 0xb4bac8 : 0x6e7488, -1);
      dc.fillRectangle(SX[i] + ox - 1, SY[i] + oy - 1, mag < 1 ? 3 : 2, mag < 1 ? 3 : 2);
    }
    if (MOU > 0) moon(dc, MOX + ox, MOY + oy, 9, d.moon, 0x6a6a5e, 0x161616);
    dc.setColor(0x9a9a9a, -1);
    F.st(dc, ts, CX + ox, (st === 3 ? 112 : 206) + oy, th, 3, 1, 1.0, 0);
    dc.setColor(G.dim(d.accent, 0.55), -1);
    F.st(dc, d.dowStr + " " + d.day + ". " + d.monStr, CX + ox, (st === 3 ? 54 : 150) + oy, 17, 2, 1, 1.0, 0);
  },
};
