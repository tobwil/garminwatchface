// FLAP — "Split-Flap": a retro departure board. Four big flap tiles for HH MM,
// a row of mini flaps for the date and a 3-row "Abfahrt" board for the slots.
// Every tile rattles through its drum on wake (and flips once on a minute change).
// Styles: 1 Bahnhof, 2 Café, 3 Akzent. Mirrors watch/source/faces/Flap.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { FONTDATA as FD } from "../engine/fontdata.js";

const DIG = "0123456789";
const DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789.:/-%°+";
const COLS = 18; // board columns
const PITCH = 15; // board cell pitch

// face state (minute flip): last minute key and wake time of the flip
let lastKey = -1;
let mT0 = -1;
let busy = true;

// character k of a flip sequence of n flips ending in `target` (k = n -> target)
function seqCh(drum, target, k, n, blank) {
  if (k >= n) return target;
  if (k <= 0 && blank) return " ";
  const len = drum.length;
  let i = drum.indexOf(target);
  if (i < 0) i = 0;
  const j = (((i - (n - k)) % len) + len * 4) % len;
  return drum.substring(j, j + 1);
}

// RUNS[bits * 6 + 2r] = first column, [+1] = length of the r-th run of lit dots in a 5-bit row
const RUNS = [];
for (let b = 0; b < 32; b++) {
  let r = 0, c = 0;
  const e = [0, 0, 0, 0, 0, 0];
  while (c < 5) {
    if (b & (16 >> c)) {
      const s0 = c;
      while (c < 5 && (b & (16 >> c))) c++;
      e[r * 2] = s0; e[r * 2 + 1] = c - s0; r++;
    } else c++;
  }
  for (let i = 0; i < 6; i++) RUNS.push(e[i]);
}

// Dot-matrix text, left aligned, pixel-identical to F.px for gap <= 0, but drawn as
// horizontal runs merged over identical rows (~4x fewer draw calls; keeps the
// board rattle well inside the watchdog budget).
function pxt(dc, txt, x, y, sc, g) {
  let ox = Math.round(x);
  const d = sc - g;
  for (let k = 0; k < txt.length; k++) {
    const code = txt.charCodeAt(k);
    const gi = code > 255 || code === 32 ? -1 : FD.pxMap[code] - 1;
    if (gi >= 0) {
      const g7 = gi * 7;
      for (let row = 0; row < 7; row++) {
        const bits = FD.pxData[g7 + row];
        if (bits === 0) continue;
        let h = 1;
        while (row + h < 7 && FD.pxData[g7 + row + h] === bits) h++;
        const hh = (h - 1) * sc + d;
        for (let q = bits * 6; q < bits * 6 + 6; q += 2) {
          const n = RUNS[q + 1];
          if (n === 0) break;
          dc.fillRectangle(ox + RUNS[q] * sc, y + row * sc, (n - 1) * sc + d, hh);
        }
        row += h - 1;
      }
    }
    ox += 6 * sc;
  }
}

// hour as two flap characters (12 h: leading blank flap)
function hhStr(h, is24) {
  if (is24) return G.pad2(h);
  const k = h % 12 === 0 ? 12 : h % 12;
  return k < 10 ? " " + k : "" + k;
}

// glyph of a cell: big = stroke digit, else pixel char
function glyph(dc, ch, x, y, w, h, big, col, fast) {
  if (ch === " ") return;
  dc.setColor(col, -1);
  if (big) {
    // bold digit from three thin passes (thick verticals, finer horizontals, no joint notches);
    // a single heavy pass while the flap is moving (cheaper, motion hides the joints)
    const gh = h * 0.66;
    if (fast) F.st(dc, ch, x + w / 2, y + h / 2, gh, 9, 1, 1.0, 0);
    else for (let k = -1; k <= 1; k++) F.st(dc, ch, x + w / 2 + k * 2.2, y + h / 2, gh, 6, 1, 1.0, 0);
  }
  else pxt(dc, ch, x + w / 2 - 5, y + h / 2 - 7, 2, 0);
}

// tile body: lighter top half, darker bottom half
function tile(dc, x, y, w, h, r, tT, tB) {
  const hy = y + h / 2;
  if (r <= 2) {
    // tiny board cell: two plain halves, the 1 px gap is the hinge
    dc.setColor(tT, -1);
    dc.fillRectangle(x, y, w, h / 2 - 1);
    dc.setColor(tB, -1);
    dc.fillRectangle(x, hy, w, h / 2);
    return;
  }
  dc.setColor(tT, -1);
  dc.fillRoundedRectangle(x, y, w, h, r);
  dc.setColor(tB, -1);
  dc.fillRectangle(x, hy, w, h / 2 - r);
  dc.fillRoundedRectangle(x, y + h - 2 * r, w, 2 * r, r);
}

// One split-flap cell flipping from A to B at progress q (q >= 1: static B).
function cell(dc, x, y, w, h, r, A, B, q, big, col, tT, tB) {
  const hy = y + h / 2;
  tile(dc, x, y, w, h, r, tT, tB);
  if (q >= 1 || A === B) {
    glyph(dc, B, x, y, w, h, big, col, false);
  } else {
    // new char's top half is revealed behind the falling flap, old bottom still shows
    dc.setClip(x, y, w, h / 2);
    glyph(dc, B, x, y, w, h, big, col, true);
    dc.setClip(x, hy, w, h / 2);
    glyph(dc, A, x, y, w, h, big, col, true);
    dc.clearClip();
    let k, fy, fh, base, ch;
    if (q < 0.5) {
      k = 1 - q * 2; fh = (k * h) / 2; fy = hy - fh; base = tT; ch = A;
    } else {
      k = q * 2 - 1; fh = (k * h) / 2; fy = hy; base = tB; ch = B;
    }
    const sh = G.mix(base, 0x000000, (1 - k) * 0.55);
    const ex = (1 - k) * w * 0.07; // free edge swings towards the viewer -> wider
    dc.setColor(sh, -1);
    if (q < 0.5) dc.fillPolygon([[x - ex, fy], [x + w + ex, fy], [x + w, hy], [x, hy]]);
    else dc.fillPolygon([[x, hy], [x + w, hy], [x + w + ex, fy + fh], [x - ex, fy + fh]]);
    if (k > 0.55 && fh > 2) {
      dc.setClip(x - ex, fy, w + ex * 2, fh);
      glyph(dc, ch, x, y, w, h, big, G.mix(col, 0x000000, (1 - k) * 0.6), true);
      dc.clearClip();
    }
  }
  // hinge gap
  if (r > 2) {
    dc.setColor(0x000000, -1);
    dc.fillRectangle(x, hy - (big ? 1 : 0.5), w, big ? 2 : 1);
  }
}

// flip state of a cell: [A, B, q] at local time lt (ms) with n flips of fd ms
function flipAt(drum, target, lt, n, fd, blank) {
  if (lt >= n * fd) return [target, target, 1];
  if (lt <= 0) { const c = seqCh(drum, target, 0, n, blank); return [c, c, 1]; }
  const k = Math.floor(lt / fd) + 1;
  return [seqCh(drum, target, k - 1, n, blank), seqCh(drum, target, k, n, blank), (lt - (k - 1) * fd) / fd];
}

export default {
  get fps() { return busy ? 20 : 1; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    let col, tT, tB, pin, lab;
    if (st === 2) {
      col = 0xf2e3c6; tT = 0x3a2a20; tB = 0x2c1f17; pin = 0x6b5444; lab = 0xc9b79a;
    } else if (st === 3) {
      col = d.accent; tT = G.mix(0x1d1d1f, d.accent, 0.06); tB = G.mix(0x141416, d.accent, 0.04);
      pin = 0x4a4a4e; lab = G.mix(d.accent, 0xffffff, 0.35);
    } else {
      col = 0xffd24a; tT = 0x1f1f1f; tB = 0x151515; pin = 0x4c4c4c; lab = 0xd9d4c4;
    }
    const lab2 = G.dim(lab, 0.8);

    // timeline: intro rattle (ms of the 1.4 s intro) or a single flip on minute change
    const key = d.h * 60 + d.m;
    if (a.t < mT0) mT0 = -1;
    if (lastKey >= 0 && key !== lastKey && a.live && a.intro >= 1) mT0 = a.t;
    lastKey = key;
    const intro = a.intro < 1;
    const ms = intro ? a.intro * 1400 : 99999;
    const mm = mT0 >= 0 ? a.t - mT0 : 99999;
    busy = intro || mm < 900;

    // ---- date row: mini flaps "FR" "16" "OKT"
    const dl = [d.dowStr, "" + d.day, d.monStr];
    const cw = 22, chh = 30, gp = 3, gg = 12;
    let tw = -gg;
    for (let g = 0; g < 3; g++) tw += dl[g].length * (cw + gp) - gp + gg;
    let x = 227 - tw / 2;
    let ci = 0;
    for (let g = 0; g < 3; g++) {
      const s = dl[g];
      for (let k = 0; k < s.length; k++) {
        const ch = s.substring(k, k + 1);
        const f = flipAt(DRUM, ch, ms - 60 - ci * 45, 4, 70, true);
        cell(dc, x, 60, cw, chh, 3, f[0], f[1], f[2], false, lab, tT, tB);
        x += cw + gp;
        ci++;
      }
      x += gg - gp;
    }

    // ---- big HH MM tiles
    const tm = hhStr(d.h, d.is24) + G.pad2(d.m);
    // previous minute (for the minute-change flip)
    const pk = (key + 1439) % 1440;
    const ph = Math.floor(pk / 60);
    const pv = hhStr(ph, d.is24) + G.pad2(pk % 60);
    const bw = 78, bh = 122, by = 110;
    for (let i = 0; i < 4; i++) {
      const bx = 227 - 177 + i * (bw + 6) + (i >= 2 ? 24 : 0);
      const tch = tm.substring(i, i + 1);
      let f;
      if (intro) f = flipAt(DIG, tch, ms - i * 80, 5 + i, 100, true);
      else {
        const och = pv.substring(i, i + 1);
        f = och === tch ? [tch, tch, 1] : [och, tch, G.clamp((mm - (3 - i) * 120) / 260, 0, 1)];
      }
      // hinge pins
      dc.setColor(pin, -1);
      dc.fillRoundedRectangle(bx - 3, by + bh / 2 - 7, 6, 14, 2);
      dc.fillRoundedRectangle(bx + bw - 3, by + bh / 2 - 7, 6, 14, 2);
      cell(dc, bx, by, bw, bh, 9, f[0], f[1], f[2], true, col, tT, tB);
      // top-edge highlight
      dc.setColor(G.mix(tT, 0xffffff, 0.07), -1);
      dc.fillRectangle(bx + 9, by, bw - 18, 1);
    }
    // colon
    dc.setColor(G.dim(col, 0.75), -1);
    dc.fillRoundedRectangle(222, by + 38, 10, 10, 3);
    dc.fillRoundedRectangle(222, by + bh - 48, 10, 10, 3);

    // ---- board header
    const bx0 = 227 - (COLS * PITCH - 2) / 2;
    const bx1 = bx0 + COLS * PITCH - 2;
    const hp = G.ease(ms / 500);
    dc.setColor(lab2, -1);
    pxt(dc, "ABFAHRT", bx0, 245, 2, 0);
    pxt(dc, "GLEIS 970", bx1 - F.pxW("GLEIS 970", 2), 245, 2, 0);
    dc.setColor(G.dim(lab, 0.35), -1);
    dc.fillRectangle(227 - (bx1 - bx0) * hp / 2, 263, (bx1 - bx0) * hp, 1);

    // ---- board rows: label left, value right, one flap per character
    for (let r = 0; r < 3; r++) {
      const sl = d.slots[r];
      let v = sl.val;
      if (v.length > COLS - 2) v = v.substring(0, COLS - 2);
      let l = sl.lbl;
      const room = COLS - v.length - 1;
      if (l.length > room) l = l.substring(0, room);
      const y = 270 + r * 28;
      for (let c = 0; c < COLS; c++) {
        let ch = " ";
        let isV = false;
        if (c < l.length) ch = l.substring(c, c + 1);
        else if (c >= COLS - v.length) { ch = v.substring(c - (COLS - v.length), c - (COLS - v.length) + 1); isV = true; }
        const cx = bx0 + c * PITCH;
        const f = flipAt(DRUM, ch, ms - 380 - r * 160 - c * 22, 3 + ((c + r) % 4), 55, true);
        cell(dc, cx, y, PITCH - 2, 24, 2, f[0], f[1], f[2], false, isV ? col : lab, tT, tB);
      }
    }

    // ---- footer: Deutsche-Bahn humour driven by Body Battery
    let msg, sig;
    const bb = d.bb;
    if (bb < 0) { msg = "OHNE GEWÄHR"; sig = 0x5a5a5a; }
    else if (bb >= 60) { msg = "PÜNKTLICH"; sig = 0x3ccb6a; }
    else if (bb >= 30) { msg = "+5 MIN VERSPÄTUNG"; sig = 0xffa63a; }
    else { msg = "ZUG FÄLLT AUS"; sig = 0xff4a3a; }
    const fp = G.clamp((ms - 1150) / 250, 0, 1);
    if (fp > 0) {
      const fw = F.pxW(msg, 2) + 16;
      const fx = 227 - fw / 2;
      dc.setColor(G.dim(sig, fp), -1);
      dc.fillCircle(fx + 4, 371, 4);
      dc.setColor(G.dim(lab2, fp), -1);
      pxt(dc, msg, fx + 16, 364, 2, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const col = G.dim(st === 2 ? 0xf2e3c6 : st === 3 ? d.accent : 0xffd24a, 0.55);
    const tm = hhStr(d.h, d.is24) + G.pad2(d.m);
    const bw = 78, bh = 122, by = 110 + o[1];
    dc.setPenWidth(1);
    for (let i = 0; i < 4; i++) {
      const bx = 227 - 177 + i * (bw + 6) + (i >= 2 ? 24 : 0) + o[0];
      dc.setColor(0x262626, -1);
      dc.drawRoundedRectangle(bx, by, bw, bh, 9);
      dc.drawLine(bx + 4, by + bh / 2, bx + bw - 4, by + bh / 2);
      dc.setColor(col, -1);
      if (tm.substring(i, i + 1) !== " ") F.st(dc, tm.substring(i, i + 1), bx + bw / 2, by + bh / 2, bh * 0.62, 3, 1, 1.0, 0);
    }
    dc.setColor(G.dim(col, 0.7), -1);
    dc.fillRoundedRectangle(223 + o[0], by + 40, 8, 8, 2);
    dc.fillRoundedRectangle(223 + o[0], by + bh - 48, 8, 8, 2);
    dc.setColor(0x5a5a5a, -1);
    F.px(dc, d.dowStr + " " + d.day + " " + d.monStr, 227 + o[0], 268 + o[1], 2, 1, 1);
  },
};
