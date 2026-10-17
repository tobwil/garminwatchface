// BLICK — "Blick-Zähler": a playful game about your own glances. An eye opens on every
// wrist raise, looks around, focuses on you and counts the look (+1). Badges for 10/25/50/
// 100/200 looks a day, yesterday's total, the weekly record, time since the last look and
// the average rhythm. Every 7th look it winks, at night (22-6) it is sleepy.
// Styles: 1 Auge (vector eye), 2 Pixel (8-bit eye), 3 Minimal (ring of glance dots).
// Mirrors watch/source/faces/Blick.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const TH = [10, 25, 50, 100, 200];
const BN = ["NEUGIERIG", "ZEITWÄCHTER", "UHREN-FAN", "SÜCHTIG?", "DIGITAL-DETOX!"];
const BL = ["Neugierig", "Zeitwächter", "Uhren-Fan", "Süchtig?", "Detox"];
const TC = [0xcd7f32, 0xc9d1d9, 0xffc93c, 0xff8a3d, 0xff3b5c];
// 7x7 badge icons (bit 6 = left): eye, clock, heart, question mark, moon
const ICO = [
  0x1c, 0x22, 0x49, 0x5d, 0x49, 0x22, 0x1c,
  0x3e, 0x41, 0x49, 0x49, 0x47, 0x41, 0x3e,
  0x36, 0x7f, 0x7f, 0x7f, 0x3e, 0x1c, 0x08,
  0x3e, 0x63, 0x03, 0x0e, 0x0c, 0x00, 0x0c,
  0x1e, 0x38, 0x70, 0x70, 0x70, 0x38, 0x1e,
];
const NE = 16; // eye outline segments
const FU = []; // upper lid shape 0..1 over the eye width
const FL = []; // lower lid shape
for (let i = 0; i <= NE; i++) {
  const t = -1 + (2 * i) / NE;
  FU.push(Math.pow(1 - t * t, 0.75));
  FL.push(1 - t * t);
}
// veins: polylines relative to the eye centre (x, y pairs, 4 points each)
const VN = [-110, 2, -94, -6, -78, -2, -64, -12, -108, 6, -96, 14, -82, 10, -68, 20, 110, 0, 96, 6, 84, 0, 68, 8, 109, -4, 98, -14, 88, -10, 70, -20];
const PRE = 1500; // intro look-around ends
const SAC = 1300; // ambient saccade period

let sKey = -1;
let S = [-1, 0, -1, -1];

// persistent glance stats -> [yesterday, 7-day record, unix of previous look, minute of first look today]
function sync(d) {
  const dn = Math.floor((d.unix + d.tz * 60) / 86400);
  const key = d.wakeN * 3 + dn * 7919 + d.glances * 131;
  if (key === sKey) return S;
  sKey = key;
  // web preview only: seed a demo history once
  if (St.get("bkDemo", 0) === 0) {
    St.set("bkDemo", 1);
    St.set("bkDn", dn);
    St.set("bkY", 41);
    const w = [];
    const v = [41, 47, 52, 29, 63, 38];
    for (let i = 0; i < 7; i++) { w.push(-1); w.push(0); }
    for (let k = 1; k <= 6; k++) { w[((dn - k) % 7) * 2] = dn - k; w[((dn - k) % 7) * 2 + 1] = v[k - 1]; }
    St.set("bkW", w);
    St.set("bkCur", d.unix - 12 * 60);
    St.set("bkN", d.wakeN - 1);
    St.set("bkFirst", 6 * 60 + 41);
  }
  const lastDn = St.get("bkDn", -1);
  if (lastDn !== dn) {
    const last = St.get("bkCnt", 0);
    St.set("bkY", lastDn === dn - 1 ? last : lastDn < 0 ? -1 : 0);
    St.set("bkDn", dn);
    St.set("bkFirst", d.glances <= 1 ? d.mins : -1);
  }
  if (St.get("bkCnt", -1) !== d.glances) St.set("bkCnt", d.glances);
  let w = St.get("bkW", null);
  if (w === null || w.length !== 14) {
    w = [];
    for (let i = 0; i < 7; i++) { w.push(-1); w.push(0); }
  }
  const sl = (dn % 7) * 2;
  if (w[sl] !== dn || w[sl + 1] !== d.glances) {
    w[sl] = dn;
    w[sl + 1] = d.glances;
    St.set("bkW", w);
  }
  let rec = 0;
  for (let i = 0; i < 7; i++) if (w[i * 2] > dn - 7 && w[i * 2] <= dn && w[i * 2 + 1] > rec) rec = w[i * 2 + 1];
  if (St.get("bkN", -1) !== d.wakeN) {
    St.set("bkPrev", St.get("bkCur", -1));
    St.set("bkCur", d.unix);
    St.set("bkN", d.wakeN);
  }
  S = [St.get("bkY", -1), rec, St.get("bkPrev", -1), St.get("bkFirst", -1)];
  return S;
}

function tier(n) {
  let t = -1;
  for (let i = 0; i < 5; i++) if (n >= TH[i]) t = i;
  return t;
}

function night(d) { return d.h >= 22 || d.h < 6; }

// gaze target of the k-th ambient saccade: [x, y] in -1..1 (often straight at you)
function tgt(k, seed) {
  if (k < 0) return [0, 0];
  const r = G.rnd(seed + k * 7919);
  if (r % 5 < 2) return [0, 0];
  return [(((r >> 4) % 100) / 100.0) * 1.5 - 0.75, (((r >> 11) % 100) / 100.0) * 0.9 - 0.45];
}

// gaze [x, y] at time ms
function look(ms, seed, nt) {
  if (ms < 600 || (ms >= 99999 && !nt)) return [0, 0];
  if (nt) return [0.35 * Math.sin(ms / 1700.0), 0.25];
  if (ms < PRE) {
    // look left, right, then straight at the viewer
    const k = (ms - 600) / 300.0;
    const i = Math.floor(k);
    const f = G.easeInOut((k - i) * 3);
    const P = [0, -0.8, 0.8, 0];
    return [G.lerp(P[i], P[i + 1], f), -0.15 * Math.sin(k * 1.047)];
  }
  const k = Math.floor((ms - PRE) / SAC);
  const a = tgt(k - 1, seed), b = tgt(k, seed);
  const f = G.ease((ms - PRE - k * SAC) / 140.0);
  return [G.lerp(a[0], b[0], f), G.lerp(a[1], b[1], f)];
}

// lid opening 0..1 at time ms (intro opening, blinks, the 7th-look wink, sleepy at night)
function lid(ms, seed, nt, wink) {
  let op = ms < 550 ? Math.min(1.06, G.spring(ms / 550.0)) : 1;
  if (nt) op *= 0.42 + 0.05 * Math.sin(ms / 900.0);
  if (wink && ms >= 1650 && ms < 2450) {
    const w = (ms - 1650) / 800.0;
    op *= w < 0.25 ? 1 - w / 0.25 : w < 0.6 ? 0 : (w - 0.6) / 0.4;
  } else if (ms > 2600 && ms < 99999) {
    const ph = (ms - 2600 + (seed % 1500)) % (nt ? 2600 : 3900);
    if (ph < 240) {
      const c = ph / 240.0;
      op *= c < 0.4 ? 1 - c / 0.4 : (c - 0.4) / 0.6;
    }
  }
  return op;
}

function icon(dc, k, x, y, sc) {
  for (let r = 0; r < 7; r++) {
    const b = ICO[k * 7 + r];
    if (b === 0) continue;
    let c = 0;
    while (c < 7) {
      if (b & (64 >> c)) {
        let e = c + 1;
        while (e < 7 && b & (64 >> e)) e++;
        dc.fillRectangle(x + c * sc, y + r * sc, (e - c) * sc, sc);
        c = e;
      } else c++;
    }
  }
}

// medal: tier-coloured disc with a dark icon
function medal(dc, t, x, y) {
  dc.setColor(G.dim(TC[t], 0.45), -1);
  dc.fillCircle(x, y, 13);
  dc.setColor(TC[t], -1);
  dc.fillCircle(x, y, 11);
  dc.setColor(0x141414, -1);
  icon(dc, t, x - 7, y - 7, 2);
}

// sub line: a different remark on every look
function remark(d, n, S, nt, wink) {
  if (nt) return "Schlaf jetzt!";
  if (wink) return "jeder 7. Blick: Zwinker!";
  const k = d.wakeN % 4;
  if (k === 1 && S[0] > 0) return n > S[0] ? (n - S[0]) + " mehr als gestern" : "noch " + (S[0] - n) + " bis gestern";
  if (k === 2 && S[1] > 0) return n >= S[1] ? "neuer Wochenrekord!" : "noch " + (S[1] - n) + " bis zum Rekord";
  if (k === 3) return d.h < 11 ? "Guten Morgen, Späher!" : d.h < 14 ? "Mittagsblick?" : d.h < 18 ? "Kurzer Kontrollblick" : "Feierabend-Blick";
  if (S[2] < 0) return "dein erster Blick heute";
  const m = Math.floor((d.unix - S[2]) / 60);
  return m < 1 ? "gerade eben geschaut!" : m < 120 ? "letzter Blick vor " + m + " min" : "letzter Blick vor " + Math.floor(m / 60) + " h";
}

// average minutes between looks today ("-1" = unknown)
function avg(d, n, S) {
  const f = S[3] >= 0 ? S[3] : d.mins > 360 ? 360 : 0;
  if (n < 2) return -1;
  const v = Math.round((d.mins - f) / (n - 1));
  return v < 1 ? -1 : v;
}

// vector eye: op lid opening, (lx, ly) gaze, pr pupil radius
function eye1(dc, cx, cy, op, lx, ly, pr, acc) {
  const hw = 118, hU = 58, hL = 44;
  const xs = [], yU = [], yL = [];
  for (let i = 0; i <= NE; i++) {
    xs.push(cx - hw + (2 * hw * i) / NE);
    yL.push(cy + hL * FL[i]);
    yU.push(cy + hL * FL[i] - (hU * FU[i] + hL * FL[i]) * op);
  }
  if (op > 0.04) {
    const pts = [];
    for (let i = 0; i <= NE; i++) pts.push([xs[i], yU[i]]);
    for (let i = NE; i >= 0; i--) pts.push([xs[i], yL[i]]);
    dc.setColor(0xcfc6b8, -1);
    dc.fillPolygon(pts);
    dc.setColor(0xece6dc, -1);
    dc.fillEllipse(cx + lx * 18, cy - 2 + (1 - op) * 26, 88, 36 * op);
    // veins
    dc.setColor(0xc06a62, -1);
    dc.setPenWidth(1);
    for (let v = 0; v < 4; v++) {
      for (let j = 0; j < 3; j++) {
        const o = v * 8 + j * 2;
        dc.drawLine(cx + VN[o], cy + VN[o + 1], cx + VN[o + 2], cy + VN[o + 3]);
      }
    }
    // tear duct
    dc.setColor(0xd98a86, -1);
    dc.fillEllipse(cx - hw + 11, cy + 3, 7, 5);
    // iris
    const ix = cx + lx * 52, iy = cy + ly * 20 - 2;
    dc.setColor(G.mix(acc, 0x000000, 0.6), -1);
    dc.fillCircle(ix, iy, 43);
    dc.setColor(G.mix(acc, 0x000000, 0.15), -1);
    dc.fillCircle(ix, iy, 39);
    dc.setPenWidth(2);
    for (let k = 0; k < 12; k++) {
      const a = k * 30 + 7;
      dc.setColor(k % 2 === 0 ? G.mix(acc, 0xffffff, 0.35) : G.mix(acc, 0x000000, 0.4), -1);
      dc.drawLine(G.ptX(ix, pr + 3, a), G.ptY(iy, pr + 3, a), G.ptX(ix, 36, a + 8), G.ptY(iy, 36, a + 8));
    }
    dc.setColor(G.mix(acc, 0xffffff, 0.2), -1);
    dc.setPenWidth(3);
    dc.drawCircle(ix, iy, pr + 5);
    dc.setColor(0x050505, -1);
    dc.fillCircle(ix, iy, pr);
    dc.setColor(0xffffff, -1);
    dc.fillCircle(ix - 14, iy - 15, 7);
    dc.setColor(0xbdbdbd, -1);
    dc.fillCircle(ix + 12, iy + 10, 3);
    // lids: mask everything outside the eye opening
    const top = [], bot = [];
    for (let i = 0; i <= NE; i++) { top.push([xs[i], yU[i]]); bot.push([xs[i], yL[i]]); }
    top.push([cx + hw + 4, cy - hU - 12]);
    top.push([cx - hw - 4, cy - hU - 12]);
    bot.push([cx + hw + 4, cy + hL + 26]);
    bot.push([cx - hw - 4, cy + hL + 26]);
    dc.setColor(0x000000, -1);
    dc.fillPolygon(top);
    dc.fillPolygon(bot);
  }
  // crease, lower lid, upper lid + lashes
  dc.setPenWidth(2);
  dc.setColor(0x4a423c, -1);
  for (let i = 3; i < NE - 3; i += 2) dc.drawLine(xs[i], yU[i] - 16 * FU[i] - 4, xs[i + 2], yU[i + 2] - 16 * FU[i + 2] - 4);
  dc.setColor(0x8a7d72, -1);
  for (let i = 0; i < NE; i += 2) dc.drawLine(xs[i], yL[i], xs[i + 2], yL[i + 2]);
  dc.setColor(0xf2e6d8, -1);
  dc.setPenWidth(5);
  for (let i = 0; i < NE; i++) dc.drawLine(xs[i], yU[i], xs[i + 1], yU[i + 1]);
  dc.setPenWidth(3);
  const dn = op < 0.25 ? 1 : -1; // closed: lashes hang down
  for (let i = 3; i <= 13; i += 2) {
    const t = -1 + (2 * i) / NE;
    dc.drawLine(xs[i], yU[i], xs[i] + t * 12, yU[i] + dn * (13 - Math.abs(t) * 4));
  }
}

// sclera half width (cells) of pixel-eye row j (0..13)
function rowW(j) {
  const v = Math.abs((j + 0.5 - 7) / 7.0);
  return v >= 1 ? 3 : Math.round(15 * Math.sqrt(1 - v * 0.98));
}

// one clipped run of cells [c0, c1) in pixel-eye row y
function run(dc, cx, y, c0, c1, hw, P) {
  if (c0 < -hw) c0 = -hw;
  if (c1 > hw) c1 = hw;
  if (c1 > c0) dc.fillRectangle(cx + c0 * P, y, (c1 - c0) * P, P);
}

// 8-bit eye on a 7 px grid: 30 x 14 cells
function eye2(dc, cx, cy, op, lx, ly, acc) {
  const P = 7;
  const y0 = cy - 7 * P;
  const o = G.clamp(op, 0, 1);
  const jT = Math.round(G.lerp(11, 0, o));
  const jB = 13 - Math.round(3 * (1 - o));
  const icx = Math.round(lx * 7), icy = Math.round(ly * 2);
  const skin = 0xf6c08a;
  const dark = G.mix(acc, 0x000000, 0.5), lite = G.mix(acc, 0xffffff, 0.4);
  for (let j = jT; j <= jB; j++) {
    const hw = rowW(j);
    const y = y0 + j * P;
    dc.setColor(skin, -1);
    dc.fillRectangle(cx - (hw + 1) * P, y, P, P);
    dc.fillRectangle(cx + hw * P, y, P, P);
    dc.setColor(j === jT ? 0xc8beb0 : 0xf4f0e8, -1);
    dc.fillRectangle(cx - hw * P, y, hw * 2 * P, P);
    // iris (radius 6 cells), pupil, glint
    const dy = Math.abs(j + 0.5 - 7 - icy);
    if (dy < 6) {
      const iw = dy < 2 ? 6 : dy < 4 ? 5 : dy < 5 ? 4 : 2;
      dc.setColor(dark, -1);
      run(dc, cx, y, icx - iw, icx + iw, hw, P);
      if (dy < 4) {
        dc.setColor(acc, -1);
        run(dc, cx, y, icx - iw + 1, icx + iw - 1, hw, P);
        if (j + 0.5 - 7 - icy > 1) {
          dc.setColor(lite, -1);
          run(dc, cx, y, icx + 1, icx + iw - 1, hw, P);
        }
      }
      if (dy < 2) {
        dc.setColor(0x000000, -1);
        run(dc, cx, y, icx - 2, icx + 2, hw, P);
      }
      const gy = j + 0.5 - 7 - icy;
      if (gy > -2 && gy < 0) {
        dc.setColor(0xffffff, -1);
        run(dc, cx, y, icx - 2, icx - 1, hw, P);
      }
    }
  }
  // upper lid (+ lashes; they hang down when closed), lower lid
  const closed = jT > jB;
  const jl = closed ? 11 : jT - 1;
  const hl = rowW(jl) + 1;
  dc.setColor(skin, -1);
  dc.fillRectangle(cx - hl * P, y0 + jl * P, hl * 2 * P, P);
  const yl = closed ? y0 + (jl + 1) * P : y0 + (jl - 1) * P;
  for (let k = -2; k <= 2; k++) dc.fillRectangle(cx + k * 5 * P - (k < 0 ? P : 0), yl, P, P);
  if (!closed) {
    const hb = rowW(jB + 1);
    dc.setColor(0xc98a5e, -1);
    dc.fillRectangle(cx - hb * P, y0 + (jB + 1) * P, hb * 2 * P, P);
  }
}

// minimal eye icon (almond outline + dot)
function eye3(dc, cx, cy, op, lx, col) {
  const hw = 34;
  dc.setPenWidth(3);
  dc.setColor(col, -1);
  let px = 0, pu = 0, pl = 0;
  for (let i = 0; i <= NE; i += 2) {
    const x = cx - hw + (2 * hw * i) / NE;
    const yl = cy + 12 * FL[i];
    const yu = yl - (16 * FU[i] + 12 * FL[i]) * op;
    if (i > 0) {
      dc.drawLine(px, pl, x, yl);
      dc.drawLine(px, pu, x, yu);
    }
    px = x; pu = yu; pl = yl;
  }
  if (op > 0.3) dc.fillCircle(cx + lx * 12, cy - 2, 7 * op);
}

function headCount(n, ms) { return ms < 950 && n > 0 ? n - 1 : n; }

export default {
  fps: 10,

  // static layer: ring, time, stats, badges; the counter, the eye and its moods move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const SL = !a.bg, ML = !a.so; // draw the static / the moving parts (S is the stats here)
    const st = d.cfg.style;
    const acc = d.accent;
    const live = a.live;
    const ms = live ? a.t : 99999;
    const n = d.glances < 0 ? 0 : d.glances;
    const S = sync(d);
    const nt = night(d);
    const wink = n > 0 && n % 7 === 0 && !nt;
    const seed = d.wakeN * 131 + 7;
    const op = lid(ms, seed, nt, wink);
    const lk = look(ms, seed, nt);
    const t = tier(n);
    const cnt = headCount(n, ms);
    const pop = ms >= 950 && ms < 1950 ? (ms - 950) / 1000.0 : -1;
    const sp = G.ease(ms / 1400.0);
    const ts = G.timeStr(d);
    const rem = remark(d, n, S, nt, wink);
    const av = avg(d, n, S);
    // next badge line
    const nx = t < 4 ? "noch " + (TH[t + 1] - n) + " bis " + BL[t + 1] : "Digital-Detox empfohlen";
    const lo = t < 0 ? 0 : TH[t];
    const fr = t < 4 ? (n - lo) / (TH[t + 1] - lo) : 1;
    const stV = [S[0] < 0 ? "--" : "" + S[0], "" + (S[1] > n ? S[1] : n), av < 0 ? "--" : av + "'"];
    const stL = ["GESTERN", "REKORD", "TAKT"];

    if (st === 3) {
      // ---- Minimal: ring of glance dots (60 per ring, 3 rings)
      if (SL) {
        const shown = Math.floor(G.clamp(ms / 900.0, 0, 1) * cnt);
        dc.setColor(0x262626, -1);
        for (let i = 0; i < 60; i++) {
          if (i < shown) continue;
          dc.fillRectangle(G.ptX(227, 213, i * 6) - 1, G.ptY(227, 213, i * 6) - 1, 2, 2);
        }
        dc.setColor(G.dim(acc, 0.6), -1);
        for (let i = 0; i < shown && i < 180; i++) {
          const r = 213 - Math.floor(i / 60) * 10;
          dc.fillCircle(G.ptX(227, r, (i % 60) * 6), G.ptY(227, r, (i % 60) * 6), 3);
        }
        // next badge target on the ring
        if (t < 4 && TH[t + 1] <= 180) {
          const i = TH[t + 1] - 1;
          const r = 213 - Math.floor(i / 60) * 10;
          dc.setColor(TC[t + 1], -1);
          dc.setPenWidth(2);
          dc.drawCircle(G.ptX(227, r, (i % 60) * 6), G.ptY(227, r, (i % 60) * 6), 6);
        }
      }
      // the current look glows
      if (ML && n > 0 && ms >= 950) {
        const i = Math.min(n - 1, 179);
        const r = 213 - Math.floor(i / 60) * 10;
        const x = G.ptX(227, r, (i % 60) * 6), y = G.ptY(227, r, (i % 60) * 6);
        const pu = live ? 0.5 + 0.5 * Math.sin(a.t / 260.0) : 1;
        const g = pop >= 0 ? G.spring(pop * 2.5) : 1;
        dc.setColor(G.dim(acc, 0.22 + 0.15 * pu), -1);
        dc.fillCircle(x, y, 11 * g);
        dc.setColor(acc, -1);
        dc.fillCircle(x, y, 6 * g);
        dc.setColor(G.mix(acc, 0xffffff, 0.7), -1);
        dc.fillCircle(x, y, 2.5 * g);
      }
      if (ML) eye3(dc, 227, 112, op, lk[0], nt ? G.dim(acc, 0.7) : 0x9a9a9a);
      dc.setColor(d.dcol, -1);
      if (SL) F.st(dc, ts, 227, 188, 78, 8, 1, G.easeInOut(ms / 900.0), 0);
      const ch = pop >= 0 ? 48 * (1 + 0.3 * (1 - G.ease(pop * 2.5))) : 48;
      dc.setColor(acc, -1);
      if (ML) F.st(dc, "" + cnt, 227, 270, ch, 6, 1, 1.0, 0);
      if (pop >= 0 && ML) {
        dc.setColor(G.dim(acc, 1 - pop), -1);
        F.st(dc, "+1", 227 + F.stW("" + n, 48) / 2 + 28, 260 - pop * 30, 20, 3, 1, 1.0, 0);
      }
      if (!SL) return;
      dc.setColor(0x777777, -1);
      F.px(dc, "BLICKE HEUTE", 227, 302, 2, 1, 0);
      if (sp > 0.5) {
        dc.setColor(nt ? acc : t >= 0 ? TC[t] : 0x777777, -1);
        F.px(dc, nt ? "Schlaf jetzt!" : t >= 0 ? BN[t] : "NOCH KEIN ABZEICHEN", 227, 326, 2, 1, 0);
        dc.setColor(0x5a5a5a, -1);
        F.px(dc, "gestern " + stV[0] + "  Rekord " + stV[1], 227, 348, 2, 1, 0);
      }
      return;
    }

    if (SL) {
      // ---- progress ring to the next badge
      if (st === 1) {
        G.ring(dc, 227, 227, 221, 3, fr * sp, G.dim(t < 4 ? TC[t + 1] : TC[4], 0.75), 0x161616);
      } else {
        const lit = Math.floor(fr * sp * 60);
        for (let i = 0; i < 60; i++) {
          dc.setColor(i < lit ? G.dim(t < 4 ? TC[t + 1] : TC[4], 0.8) : 0x1c1c1c, -1);
          dc.fillRectangle(Math.round(G.ptX(227, 217, i * 6)) - 2, Math.round(G.ptY(227, 217, i * 6)) - 2, 5, 5);
        }
      }
    }
    if (ML) {
      // ---- headline: BLICK #24 (+1 pop)
      const num = "#" + cnt;
      const ns = pop >= 0 ? 1 + 0.35 * (1 - G.ease(pop * 2.5)) : 1;
      if (st === 1) {
        const h = 26;
        const w1 = F.stW("BLICK ", h);
        const w2 = F.stW(num, h);
        const x0 = 227 - (w1 + w2 + (22 * h) / 80) / 2;
        dc.setColor(0xd0d0d0, -1);
        F.st(dc, "BLICK", x0, 58, h, 4, 0, 1.0, 0);
        dc.setColor(acc, -1);
        F.st(dc, num, x0 + w1 + (22 * h) / 80 + w2 / 2, 58, h * ns, 4, 1, 1.0, 0);
        if (pop >= 0) {
          dc.setColor(G.dim(acc, 1 - pop), -1);
          F.st(dc, "+1", x0 + w1 + w2 + 34, 54 - pop * 22, 16, 3, 1, 1.0, 0);
        }
      } else {
        const sc = 4;
        const w = F.pxW("BLICK " + num, sc);
        const x0 = 227 - w / 2;
        dc.setColor(0xe8e8e8, -1);
        F.px(dc, "BLICK", x0, 34, sc, 0, 0);
        dc.setColor(acc, -1);
        F.px(dc, num, x0 + 6 * 6 * sc, 34 - (ns > 1 ? Math.round((ns - 1) * 20) : 0), sc, 0, 0);
        if (pop >= 0) {
          dc.setColor(G.dim(acc, 1 - pop), -1);
          F.px(dc, "+1", 227 - 17, 72 - Math.round(pop * 10), 3, 0, 0);
        }
      }
      // remark
      dc.setColor(nt || wink ? acc : 0x8a8a8a, -1);
      if (!(st === 2 && pop >= 0)) F.px(dc, rem, 227, st === 1 ? 76 : 72, 2, 1, 0);

      // ---- the eye (over the cached time it must stay above the digits)
      if (!SL) dc.setClip(0, 0, 454, st === 1 ? 234 : 212);
      if (st === 1) eye1(dc, 227, 170, op, lk[0], lk[1], nt ? 22 : ms < 1400 ? 21 : 21 - 4 * G.ease((ms - 1400) / 300.0), acc);
      else eye2(dc, 227, 150, op, lk[0], lk[1], acc);
      if (!SL) dc.clearClip();
      // sleepy Zzz / wink sparkle
      if (nt) {
        const z = live ? (a.t % 2400) / 2400.0 : 0.5;
        dc.setColor(G.dim(acc, 1 - z * 0.7), -1);
        F.px(dc, "z", 330 + Math.round(z * 18), 118 - Math.round(z * 30), 2, 0, 0);
        F.px(dc, "Z", 346 + Math.round(z * 14), 100 - Math.round(z * 24), 3, 0, 0);
      }
      if (wink && ms >= 2000 && ms < 3200) {
        const k = (ms - 2000) / 1200.0;
        const r = 14 * Math.sin(k * 3.1416);
        dc.setColor(acc, -1);
        dc.fillPolygon([[350, 104 - r], [353, 101], [350 + r, 104], [353, 107], [350, 104 + r], [347, 107], [350 - r, 104], [347, 101]]);
      }
    }
    if (!SL) return;
    // ---- time
    if (st === 1) {
      dc.setColor(d.dcol, -1);
      F.st(dc, ts, 227, 264, 56, 7, 1, G.easeInOut(ms / 900.0), 0);
    } else {
      const w = F.pxW(ts, 7);
      dc.setColor(G.dim(acc, 0.28), -1);
      F.px(dc, ts, 227 - w / 2 + 7, 221, 7, 0, 0);
      dc.setColor(d.dcol, -1);
      F.px(dc, ts, 227 - w / 2, 214, 7, 0, 0);
    }

    // ---- stats: yesterday, record, rhythm
    for (let k = 0; k < 3; k++) {
      const p = G.stag(sp, k, 0.12, 0.5);
      if (p <= 0) continue;
      const x = 227 + (k - 1) * 104;
      dc.setColor(G.dim(0x777777, p), -1);
      F.px(dc, stL[k], x, st === 1 ? 300 : 280, 2, 1, 0);
      dc.setColor(G.mix(0x000000, k === 1 && n >= S[1] && S[1] > 0 ? acc : d.dcol, p), -1);
      if (st === 1) F.st(dc, stV[k], x, 328, 22, 3, 1, 1.0, 0);
      else F.px(dc, stV[k], x, 298, 3, 1, 0);
    }

    // ---- badge + next badge
    if (sp > 0.6) {
      const lbl = t >= 0 ? BN[t] : "NOCH KEIN ABZEICHEN";
      const w = F.pxW(lbl, 2) + (t >= 0 ? 34 : 0);
      const x0 = 227 - w / 2;
      if (t >= 0) {
        if (st === 1) medal(dc, t, x0 + 12, 357);
        else {
          dc.setColor(TC[t], -1);
          icon(dc, t, x0 + 1, 330, 3);
        }
      }
      const by = st === 1 ? 350 : 337;
      dc.setColor(t >= 0 ? TC[t] : 0x777777, -1);
      F.px(dc, lbl, x0 + (t >= 0 ? 34 : 0), by, 2, 0, 0);
      dc.setColor(0x6a6a6a, -1);
      F.px(dc, nx, 227, st === 1 ? 376 : 364, 2, 1, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const acc = d.accent;
    const ox = o[0], oy = o[1];
    const n = d.glances < 0 ? 0 : d.glances;
    const col = G.dim(acc, 0.5);
    // closed eye: lower lid curve with lashes hanging down
    dc.setColor(col, -1);
    if (st === 2) {
      for (let k = -14; k < 14; k += 2) {
        const v = Math.abs((k + 1) / 14.0);
        dc.fillRectangle(227 + k * 6 + ox, 150 + Math.round(18 * (1 - v * v)) + oy, 12, 4);
      }
      for (let k = -2; k <= 2; k++) dc.fillRectangle(227 + k * 30 - 2 + ox, 172 + oy + Math.round(8 * (1 - k * k / 9.0)), 4, 8);
    } else {
      const hw = st === 3 ? 60 : 100;
      const hh = st === 3 ? 14 : 26;
      dc.setPenWidth(2);
      let px = 0, py = 0;
      for (let i = 0; i <= NE; i += 2) {
        const x = 227 - hw + (2 * hw * i) / NE + ox;
        const y = 150 + hh * FL[i] + oy;
        if (i > 0) dc.drawLine(px, py, x, y);
        px = x; py = y;
      }
      for (let i = 4; i <= 12; i += 2) {
        const tt = -1 + (2 * i) / NE;
        const x = 227 - hw + (2 * hw * i) / NE + ox, y = 150 + hh * FL[i] + oy;
        dc.drawLine(x, y, x + tt * 8, y + 10);
      }
    }
    dc.setColor(0x8a8a8a, -1);
    if (st === 2) F.px(dc, G.timeStr(d), 227 + ox, 214 + oy, 7, 1, 2);
    else F.st(dc, G.timeStr(d), 227 + ox, 240 + oy, 64, 3, 1, 1.0, 0);
    dc.setColor(col, -1);
    F.px(dc, "BLICK #" + n, 227 + ox, 300 + oy, 2, 1, 0);
  },
};
