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
const NA = 36; // aurora rays
const NT = 30; // far shore trees
const CHUNK = 40; // stars re-projected per frame (rolling update, see sky())
const AUC = [0x86ffc0, 0x3ee69a, 0x179a78, 0x6a40c0];
const AUA = [1.0, 0.86, 0.62, 0.46];

// ---- catalogue, decoded once: magnitude, sin/cos declination
const MAG = [], SDE = [], CDE = [];
for (let i = 0; i < NS; i++) {
  const v = ST[i];
  MAG.push(((v >> 2) & 127) / 10.0 - 2);
  const de = (((v >> 9) & 2047) / 10.0 - 90) * RAD;
  SDE.push(Math.sin(de));
  CDE.push(Math.cos(de));
}

// ---- sky state. Star positions are re-projected in rolling chunks of CHUNK stars per frame
// whenever the minute (or style) changes, so no single frame does the whole catalogue.
let KC = -1, KD = -1, PTR = 0, CNT = 0, C0 = 0, CL = 0, LST = 0;
const SX = new Array(NS).fill(0), SY = new Array(NS).fill(0), SU = new Array(NS).fill(-1);
const WX = new Array(NM).fill(0), WY = new Array(NM).fill(0), WU = new Array(NM).fill(0);
let SUNX = 0, SUNY = 0, SUNU = 0, MOX = 0, MOY = 0, MOU = 0, EL = 0;
// ---- paint state: star palette (4 colour classes x 16 levels on the sky colour), per-star
// palette index + brightness, Milky Way colours, constellation labels
const SPAL = new Array(64).fill(0);
let SPB = -1;
const SCI = new Array(NS).fill(-1), SFF = new Array(NS).fill(0);
const MWC = new Array(NM * 2).fill(0);
let LK = -2, NLB = 0;
const LBX = [0, 0, 0], LBY = [0, 0, 0], LBW = [0, 0, 0], LBI = [0, 0, 0];
// per-frame (intro-animated) positions
const RX = new Array(NS).fill(0), RY = new Array(NS).fill(0);
// style 3 static geometry (built once): horizon y every 8 px, aurora rays, far trees
let HZ = null;
const ABX = new Array(NA).fill(0), ABY = new Array(NA).fill(0), AUX = new Array(NA).fill(0), AUY = new Array(NA).fill(0);
const ARH = new Array(NA).fill(0); // 2 x horizon y under each ray (mirror line)
const AS = new Array(NA).fill(0), AF = new Array(NA).fill(0); // per-frame ray strength / shimmer
const AP = new Array(64).fill(0); // aurora palettes: sky + lake, 4 bands x 8 levels
let APK = -1, APB = -1;
const TRX = new Array(NT).fill(0), TRB = new Array(NT).fill(0), TRW = new Array(NT).fill(0), TRH = new Array(NT).fill(0);
// reusable polygon buffers
const LAKE = [];
for (let j = 0; j < 32; j++) LAKE.push([0, 0]);
const TRI = [[0, 0], [0, 0], [0, 0]];
const PB = [];
for (let j = 0; j < 29; j++) PB.push([0, 0]);
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

// Sky for the current minute: sun, moon and Milky Way at once, the stars in rolling chunks
// (all of them when `all`). C0/CL = the stars re-projected in this call.
function sky(d, st, all) {
  const R = radius(st);
  const key = ((d.year % 10) * 400 + d.doy) * 5760 + d.mins * 4 + st;
  CL = 0;
  if (key !== KC) {
    if (KC === -1 || (KC & 3) !== (key & 3)) all = true;
    KC = key;
    CNT = 0;
    const lat = d.locOk ? d.lat : 52.52;
    const lon = d.locOk ? d.lon : 13.4;
    sp = Math.sin(lat * RAD);
    cp = Math.cos(lat * RAD);
    const sec = d.unix - 946728000;
    const nd = Math.floor(sec / 86400);
    const fr = (sec - nd * 86400) / 86400.0;
    LST = wrap(280.46061837 + 0.98564736629 * nd + 360.98564736629 * fr + lon);
    for (let i = 0; i < NM; i++) {
      const v = MW[i];
      const de = (((v >> 9) & 2047) / 10.0 - 90) * RAD;
      proj(LST - (v >> 20) * 0.375, Math.sin(de), Math.cos(de), st, R);
      WX[i] = px; WY[i] = py; WU[i] = pu;
    }
    const n = nd + fr;
    // sun (low precision ephemeris)
    const g = wrap(357.528 + 0.9856003 * n);
    const ls = wrap(280.46 + 0.9856474 * n) + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD);
    projEcl(ls, 0, LST, st, R);
    SUNX = px; SUNY = py; SUNU = pu;
    EL = Math.asin(G.clamp(pu, -1, 1)) / RAD;
    // moon (main periodic terms)
    const l0 = wrap(218.316 + 13.176396 * n);
    const mm = wrap(134.963 + 13.064993 * n);
    const ff = wrap(93.272 + 13.22935 * n);
    projEcl(l0 + 6.289 * Math.sin(mm * RAD), 5.128 * Math.sin(ff * RAD), LST, st, R);
    MOX = px; MOY = py; MOU = pu;
  }
  if (CNT >= NS) return;
  const cnt = all ? NS - CNT : Math.min(CHUNK, NS - CNT);
  C0 = PTR;
  CL = cnt;
  for (let k = 0; k < cnt; k++) {
    const i = PTR;
    const h = (LST - (ST[i] >> 20) * 0.375) * RAD;
    const sh = Math.sin(h), ch = Math.cos(h), sd = SDE[i], cd = CDE[i];
    const e = -cd * sh, n = cp * sd - sp * cd * ch, u = sp * sd + cp * cd * ch;
    if (st === 3) {
      const dd = n * CH3 + u * SH3;
      const kk = K3 / (dd > -0.9 ? 1 + dd : 0.1);
      SX[i] = CX + kk * e;
      SY[i] = CY3 - kk * (u * CH3 - n * SH3);
    } else {
      const kk = R / (u > -0.95 ? 1 + u : 0.05);
      SX[i] = CX - kk * e;
      SY[i] = CX - kk * n;
    }
    SU[i] = u;
    PTR = PTR + 1 >= NS ? 0 : PTR + 1;
  }
  CNT += cnt;
  if (CNT >= NS) KD = KC;
}

function hy(x) {
  const f = G.clamp(x / 8.0, 0, 56.99);
  const j = Math.floor(f);
  return HZ[j] + (HZ[j + 1] - HZ[j]) * (f - j);
}

// style 3: horizon table, aurora ray geometry and far trees (static, built once)
function panoInit() {
  if (HZ !== null) return;
  HZ = new Array(58).fill(CY3);
  // horizon (alt 0) point for screen x: solve K3 sin a - X CH3 cos a = X for the azimuth a
  for (let j = 0; j < 58; j++) {
    const X = j * 8 - CX;
    const rr = Math.sqrt(K3 * K3 + X * X * CH3 * CH3);
    const az = Math.atan2(X * CH3, K3) + Math.asin(G.clamp(X / rr, -1, 1));
    const k = K3 / (1 + Math.cos(az) * CH3);
    HZ[j] = CY3 + k * Math.cos(az) * SH3;
  }
  for (let i = 0; i < NA; i++) {
    const az = -77 + i * 4.4;
    projA(az, 4, 3, 0);
    ABX[i] = px; ABY[i] = py;
    projA(az, 14, 3, 0);
    AUX[i] = (px - ABX[i]) / 10.0; AUY[i] = (py - ABY[i]) / 10.0;
    ARH[i] = 2 * hy(ABX[i]);
  }
  let s = 4242;
  for (let i = 0; i < NT; i++) {
    s = G.rnd(s);
    const x = 4 + i * 15.2 + (s % 7);
    TRX[i] = x;
    TRH[i] = 12 + (s % 24) + (Math.abs(x - CX) > 150 ? 8 : 0);
    TRW[i] = 6 + (s % 3);
    TRB[i] = hy(x) + 1;
  }
}

// spruce with n drooping branch tiers into the reusable buffer PB (base centre x, b; half width w; height h)
function pine(dc, x, b, w, h, n) {
  for (let k = 0; k < n; k++) {
    const yk = b - (h * k * 0.9) / n, wk = w * (1 - k / n), yn = yk - (h * 0.5) / n;
    PB[k * 2][0] = x - wk; PB[k * 2][1] = yk;
    PB[k * 2 + 1][0] = x - wk * 0.32; PB[k * 2 + 1][1] = yn;
    PB[4 * n - k * 2][0] = x + wk; PB[4 * n - k * 2][1] = yk;
    PB[4 * n - k * 2 - 1][0] = x + wk * 0.32; PB[4 * n - k * 2 - 1][1] = yn;
  }
  PB[2 * n][0] = x; PB[2 * n][1] = b - h;
  dc.fillPolygon(n === 7 ? PB : PB.slice(0, 4 * n + 1));
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

// a bright star (mag < 1.6) from palette entry pi = class * 16 + level
function star(dc, x, y, mag, pi) {
  const b = pi - (pi % 16), q = pi % 16;
  if (mag < 0.6) {
    dc.setColor(SPAL[b + Math.floor(q * 0.22 + 0.5)], -1);
    dc.fillCircle(x, y, 7);
    dc.setColor(SPAL[b + Math.floor(q * 0.5 + 0.5)], -1);
    dc.fillRectangle(x - 9, y, 19, 1);
    dc.fillRectangle(x, y - 9, 1, 19);
    dc.setColor(SPAL[pi], -1);
    dc.fillCircle(x, y, 3.2);
  } else {
    dc.setColor(SPAL[b + Math.floor(q * 0.4 + 0.5)], -1);
    dc.fillRectangle(x - 4, y, 9, 1);
    dc.fillRectangle(x, y - 4, 1, 9);
    dc.setColor(SPAL[pi], -1);
    dc.fillCircle(x, y, 2.4);
  }
}

// constellation labels for the resting sky: below each figure, no overlaps, max 3
function labels(st, R, tw) {
  NLB = 0;
  for (let c = 0; c < CN.length && NLB < 3; c++) {
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

// aurora over the northern horizon (style 3): rays from bright green (low) to violet (high).
// refl: mirror image in the lake (dimmer, broken by ripples), reuses the main pass' rays
function aurora(dc, t, k, refl) {
  dc.setPenWidth(refl ? 5 : 8);
  const o = refl ? 32 : 0;
  for (let i = 0; i < NA; i++) {
    let s, fine;
    if (refl) { s = AS[i]; fine = AF[i]; }
    else {
      s = auS(-77 + i * 4.4, t);
      fine = 0.62 + 0.38 * G.noise(i * 1.41 + t * 0.0013);
      AS[i] = s; AF[i] = fine;
    }
    if (s < 0.06) continue;
    const q = Math.floor(G.clamp(s * fine * k * 1.25, 0, 0.999) * 8) + o;
    const L = (6 + 40 * s) * (0.8 + 0.2 * fine) * k;
    const bx = ABX[i], by = ABY[i], ux = AUX[i] * L, uy = AUY[i] * L;
    if (refl) {
      const y0 = ARH[i] - by + 6;
      dc.setColor(AP[q], -1);
      dc.drawLine(bx, y0, bx + ux * 0.12, y0 - uy * 0.12);
      dc.setColor(AP[8 + q], -1);
      dc.drawLine(bx + ux * 0.2, y0 - uy * 0.2 + 3, bx + ux * 0.32, y0 - uy * 0.32 + 3);
      continue;
    }
    let x0 = bx, y0 = by;
    for (let j = 0; j < 4; j++) {
      const f = j === 0 ? 0.3 : j === 1 ? 0.55 : j === 2 ? 0.8 : 1.0;
      const x = bx + ux * f, y = by + uy * f;
      dc.setColor(AP[j * 8 + q], -1);
      dc.setPenWidth(8 - j * 2);
      dc.drawLine(x0, y0, x, y);
      x0 = x; y0 = y;
    }
  }
}

// shooting star: one per wrist raise (dark sky)
function shoot(dc, d, a, st, bg, dark, t, rest) {
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
}

// seconds pointer on the printed chart's cover (style 2)
function secPtr(dc, d, a, R) {
  const sa = (d.s + a.ms / 1000.0) * 6;
  dc.setColor(0xe2574a, -1);
  dc.fillPolygon([[G.ptX(CX, R + 3, sa), G.ptY(CX, R + 3, sa)], [G.ptX(CX, R + 13, sa - 2.6), G.ptY(CX, R + 13, sa - 2.6)],
    [G.ptX(CX, R + 13, sa + 2.6), G.ptY(CX, R + 13, sa + 2.6)]]);
}

// moving parts on top of the cached layer: the bright stars twinkle (not those under the text),
// the shooting star, the seconds pointer of the chart
function moving(dc, d, a, st, bg, dark, t, tw, R) {
  if (st !== 2 && a.live) {
    for (let i = 0; i < NS; i++) {
      const mag = MAG[i];
      if (mag >= 2 || SCI[i] < 0 || SU[i] <= 0 || under(st, SX[i], SY[i], tw)) continue;
      const pi = (ST[i] & 3) * 16 + Math.floor(SFF[i] * (0.8 + 0.2 * G.noise(t * 0.004 + i * 1.37)) * 15 + 0.5);
      if (mag < 1.6) star(dc, SX[i], SY[i], mag, pi);
      else {
        dc.setColor(SPAL[pi], -1);
        dc.fillRectangle(SX[i] - 1, SY[i] - 1, 3, 3);
      }
    }
  }
  shoot(dc, d, a, st, bg, dark, t, true);
  if (st === 2 && a.live) secPtr(dc, d, a, R);
}

export default {
  get fps() { return FPS; },

  // static layer (planetarium, chart): everything but twinkle, shooting star and seconds pointer.
  // The polar-light panorama (aurora, lake) moves almost everywhere: no cache.
  bgKey(d) { return d.cfg.style === 3 ? -1 : d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const R = radius(st);
    if (st === 3) panoInit();
    sky(d, st, false);
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

    // ---- paint state: palettes when the sky colour changes, star levels for the re-projected chunk
    if (SPB !== bg * 4 + st) {
      SPB = bg * 4 + st;
      for (let c = 0; c < 4; c++) {
        const x = st === 2 ? INK : STAR_COL[c];
        for (let q = 0; q < 16; q++) SPAL[c * 16 + q] = G.mix(bg, x, q / 15.0);
      }
      const mwk = st === 2 ? 1 : dark;
      for (let i = 0; i < NM; i++) {
        const w = ((MW[i] & 511) + (MW[(i + 1) % NM] & 511)) / 200.0;
        if (st === 2) { MWC[i] = G.mix(bg, 0xcfcfc4, 0.5 * w * mwk); MWC[NM + i] = G.mix(bg, 0xcfcfc4, 0.85 * w * mwk); }
        else {
          const x = st === 3 ? 0x24343e : 0x2a3658;
          MWC[i] = G.mix(bg, x, 0.45 * w * mwk); MWC[NM + i] = G.mix(bg, x, 0.7 * w * mwk);
        }
      }
    }
    for (let k = 0; k < CL; k++) {
      const i = (C0 + k) % NS;
      let f = 0;
      if (SU[i] > 0) {
        f = vis * G.clamp(1.25 - MAG[i] * 0.13, 0.45, 1);
        if (SU[i] < 0.12) f = f * (0.45 + SU[i] * 4.5); // horizon extinction
        if (under(st, SX[i], SY[i], tw)) f = f * 0.55;
      }
      SFF[i] = f;
      const q = Math.floor(f * 15 + 0.5);
      SCI[i] = q > 0 ? (ST[i] & 3) * 16 + q : -1;
    }
    if (rest && LK !== KD) { LK = KD; labels(st, R, tw); }
    if (a.bg) {
      moving(dc, d, a, st, bg, dark, t, tw, R);
      return;
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
    if (st === 2 || dark > 0.05) {
      for (let pass = 0; pass < 2; pass++) {
        dc.setPenWidth(pass === 0 ? 30 : 12);
        for (let i = 0; i < NM; i++) {
          const j = i + 1 < NM ? i + 1 : 0;
          if (WU[i] < -0.2 || WU[j] < -0.2) continue;
          dc.setColor(MWC[pass * NM + i], -1);
          if (rest || st === 3) dc.drawLine(WX[i], WY[i] + lift, WX[j], WY[j] + lift);
          else {
            const ax = WX[i] - CX, ay = WY[i] - CX, bx = WX[j] - CX, by = WY[j] - CX;
            dc.drawLine(CX + ax * cr - ay * sr, CX + ax * sr + ay * cr, CX + bx * cr - by * sr, CX + bx * sr + by * cr);
          }
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
        if (rest) dc.drawLine(rx[sa], ry[sa], rx[sb], ry[sb]);
        else dc.drawLine(rx[sa], ry[sa], rx[sa] + (rx[sb] - rx[sa]) * lp, ry[sa] + (ry[sb] - ry[sa]) * lp);
      }
    }

    // ---- stars (brightest first during the intro; the bright ones twinkle while awake)
    const thr = -1.5 + 7.5 * G.ease(p * 1.3);
    const twk = st !== 2 && a.live && rest;
    for (let i = 0; i < NS; i++) {
      let pi = SCI[i];
      if (pi < 0 || SU[i] <= 0) continue;
      const mag = MAG[i];
      if (!rest) {
        if (mag > thr) continue;
        const q = Math.floor(SFF[i] * G.clamp(thr - mag, 0, 1) * 15 + 0.5);
        if (q <= 0) continue;
        pi = (ST[i] & 3) * 16 + q;
      } else if (twk && mag < 2) {
        pi = (ST[i] & 3) * 16 + Math.floor(SFF[i] * (0.8 + 0.2 * G.noise(t * 0.004 + i * 1.37)) * 15 + 0.5);
      }
      if (st !== 2 && mag < 1.6) star(dc, rx[i], ry[i], mag, pi);
      else {
        dc.setColor(SPAL[pi], -1);
        if (st === 2) {
          // ink dots sized by magnitude (small ones as two crossed rectangles: round and cheap)
          const r = 4.4 - mag * 0.75;
          if (r >= 3) dc.fillCircle(rx[i], ry[i], r);
          else if (r >= 2.2) {
            dc.fillRectangle(rx[i] - 2, ry[i] - 1, 5, 3);
            dc.fillRectangle(rx[i] - 1, ry[i] - 2, 3, 5);
          } else dc.fillRectangle(rx[i] - 1, ry[i] - 1, r >= 1.5 ? 3 : 2, r >= 1.5 ? 3 : 2);
        } else dc.fillRectangle(rx[i] - 1, ry[i] - 1, mag < 2.6 ? 3 : 2, mag < 2.6 ? 3 : 2);
      }
    }
    // Pleiades (star 48 = Alcyone)
    if (SU[48] > 0 && thr > 3) {
      dc.setColor(SPAL[Math.floor(10 * vis)], -1);
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
    shoot(dc, d, a, st, bg, dark, t, rest);

    // ---- landscape (3) / rim with compass (1, 2)
    const day = EL > 0;
    if (st === 3) {
      // lake: shore strip (offset copy of the water polygon), water, depth bands
      for (let j = 0; j < 29; j++) { LAKE[j][0] = j * 16; LAKE[j][1] = HZ[j * 2] - 1; }
      LAKE[29][0] = 456; LAKE[29][1] = HZ[57] - 1;
      LAKE[30][0] = 456; LAKE[30][1] = 456;
      LAKE[31][0] = 0; LAKE[31][1] = 456;
      const tc = G.mix(0x010302, 0x10261e, G.clamp((EL + 6) / 12.0, 0, 1));
      dc.setColor(tc, -1);
      dc.fillPolygon(LAKE);
      for (let j = 0; j < 30; j++) LAKE[j][1] = LAKE[j][1] + 5;
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
      // far shore forest
      dc.setColor(tc, -1);
      for (let i = 0; i < NT; i++) {
        const x = TRX[i], b = TRB[i], w = TRW[i];
        TRI[0][0] = x - w; TRI[0][1] = b;
        TRI[1][0] = x; TRI[1][1] = b - TRH[i];
        TRI[2][0] = x + w; TRI[2][1] = b;
        dc.fillPolygon(TRI);
      }
      // near spruces framing the view
      dc.setColor(0x000000, -1);
      pine(dc, 30, 430, 58, 270, 7);
      pine(dc, 78, 450, 34, 190, 5);
      pine(dc, 424, 430, 58, 280, 7);
      pine(dc, 380, 452, 32, 170, 5);
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
      // azimuth scale every 10° (unit vector rotated step by step, no trig per tick)
      const c10 = 0.98480775, s10 = 0.17364818;
      let ux = 0, uy = -1;
      for (let k = 0; k < 36; k++) {
        if (k % 9 !== 0) {
          const r2 = R + (k % 3 === 0 ? 11 : 6);
          dc.drawLine(CX + ux * (R + 3), CX + uy * (R + 3), CX + ux * r2, CX + uy * r2);
        }
        const nx = ux * c10 - uy * s10;
        uy = uy * c10 + ux * s10;
        ux = nx;
      }
      // seconds pointer on the printed chart's cover
      if (st === 2 && a.live && rest) secPtr(dc, d, a, R);
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
    sky(d, st, true);
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
