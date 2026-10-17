// RIDER — "Pixel Rider": an 8-bit side-scroller. A pixel cyclist pedals in place while
// parallax layers (far mountains, pine hills, road) scroll by — faster when the heart rate
// is up. Sky, sun and moon follow the real sun elevation. The weekly goal is a stage
// ("ETAPPE") with a finish flag; reaching it brings a finish banner and confetti.
// Styles: 1 Tag & Nacht, 2 Gameboy, 3 Neon. Mirrors watch/source/faces/Rider.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import S from "../sprites/rider.js";
import { SPR, encodeAll } from "../engine/spr.js";

const SP = encodeAll(S);
const P = 4; // scene pixel size
const RX = 164; // rider x (left of sprite)
const RY = 268; // rider y (top of sprite)
// sky band tops (last = horizon, where the sky stops)
const BAND = [0, 100, 152, 196, 232, 300];
// far mountains: peak cell x, rows, left slope*2, right slope*2 (128-cell period, base y 288)
const FAR = [6, 18, 3, 2, 31, 14, 2, 2, 52, 21, 2, 3, 79, 16, 3, 2, 104, 19, 2, 2];
// pine hills: centre cell x, rows, pine dx 1, pine dx 2 (96-cell period, base y 284)
const HILL = [8, 7, -3, 1, 27, 10, -5, 2, 45, 6, -1, 3, 62, 9, -4, 0, 81, 8, -2, 4];
const HW = [2, 4, 5, 6, 7, 8, 8, 9, 9, 10, 10];
// colour keyframes (Tag & Nacht): 5 sky bands, rock, rock shade, snow, hill, hill rim, pine,
// strip, road, white, panel, kerb red, cloud, cloud shade
const K_NIGHT = [0x050818, 0x0a1230, 0x111c42, 0x18264f, 0x22305a, 0x1d2546, 0x151b36, 0x6a7898, 0x0f2a26, 0x1a3c34, 0x0a1c18, 0x12301e, 0x1a1c26, 0x6e7080, 0x0a0a10, 0x6a2a30, 0x283258, 0x1a2242];
const K_DUSK = [0x141a44, 0x2a2862, 0x553a7a, 0x8a4a7c, 0xc0607a, 0x3a3462, 0x2a2650, 0xb0a0c8, 0x1e3e38, 0x2e5a4c, 0x13281f, 0x234628, 0x2a2a38, 0xb4b0c0, 0x120e16, 0xa03a3a, 0x7a5a8a, 0x4e3e70];
const K_GOLD = [0x2c3a8a, 0x6a4a9a, 0xd0607a, 0xf48c4c, 0xffc46a, 0x6a5288, 0x4e3c6c, 0xffd2a8, 0x3c6e34, 0x6a9a3c, 0x1f3e22, 0x5a8a2c, 0x3e3a4a, 0xffe8c8, 0x22160e, 0xd04030, 0xffcab0, 0xe0849a];
const K_DAY = [0x2a6ad8, 0x3a82e6, 0x56a0f0, 0x7abcf6, 0xa8d8fc, 0x6880b8, 0x4e6498, 0xf2f6ff, 0x3fa34a, 0x7ccf5a, 0x1e6a34, 0x58c03c, 0x4a4c56, 0xf4f4f4, 0x2e2016, 0xe03a3a, 0xffffff, 0xcfe2f6];
const GB = [0x0f380f, 0x306230, 0x8bac0f, 0x9bbc0f];
// Gameboy: indices into GB per palette slot (day / night)
const GB_DAY = [3, 3, 3, 3, 3, 2, 2, 3, 1, 2, 0, 1, 1, 3, 0, 0, 2, 1];
const GB_NIGHT = [0, 0, 0, 0, 0, 1, 1, 2, 0, 1, 1, 0, 1, 2, 0, 2, 1, 0];
const MAG = 0xff2bd6;
const CYA = 0x18e0ff;

// scene palette for sun elevation el
function scenePal(st, el) {
  const out = [];
  if (st === 2) {
    const m = el > -3 ? GB_DAY : GB_NIGHT;
    for (let i = 0; i < 18; i++) out.push(GB[m[i]]);
    return out;
  }
  if (st === 3) {
    // neon: black world, colours used for outlines only
    return [0x000000, 0x000000, 0x000000, 0x06000c, 0x12001e, 0x000000, -1, -1, 0x000000, CYA, G.dim(CYA, 0.55), 0x000000, 0x000000, 0xe8e8ff, 0x000000, MAG, 0x000000, G.dim(MAG, 0.45)];
  }
  let a = K_NIGHT, b = K_NIGHT, f = 0;
  if (el >= 12) { a = K_DAY; b = K_DAY; }
  else if (el >= 3) { a = K_GOLD; b = K_DAY; f = (el - 3) / 9.0; }
  else if (el >= -3) { a = K_DUSK; b = K_GOLD; f = (el + 3) / 6.0; }
  else if (el >= -10) { a = K_NIGHT; b = K_DUSK; f = (el + 10) / 7.0; }
  for (let i = 0; i < 18; i++) out.push(G.mix(a[i], b[i], f));
  return out;
}

function q4(v) { return Math.floor(v / P) * P; }

// one row of a stepped layer shape: fill, optional rim edge (cells cl..cr, previous row pl..pr)
function lrow(dc, ox, y, cl, cr, pl, pr, top, fill, edge) {
  dc.setColor(fill, -1);
  dc.fillRectangle(ox + cl * P, y, (cr - cl + 1) * P, P);
  if (edge === -1) return;
  dc.setColor(edge, -1);
  if (top) { dc.fillRectangle(ox + cl * P, y, (cr - cl + 1) * P, P); return; }
  dc.fillRectangle(ox + cl * P, y, (pl - cl + 1) * P, P);
  dc.fillRectangle(ox + pr * P, y, (cr - pr + 1) * P, P);
}

function mountain(dc, sx, i, pal, st) {
  const h = FAR[i + 1], sl = FAR[i + 2], sr = FAR[i + 3];
  const top = 288 - h * P;
  const sn = Math.floor(h / 5) + 1;
  const edge = st === 3 ? MAG : st === 2 ? (pal[0] === GB[0] ? GB[2] : GB[1]) : -1;
  for (let r = 0; r < h; r++) {
    const y = top + r * P;
    const cl = -Math.floor((r * sl) / 2), cr = Math.floor((r * sr) / 2);
    const pl = -Math.floor(((r - 1) * sl) / 2), pr = Math.floor(((r - 1) * sr) / 2);
    lrow(dc, sx, y, cl, cr, pl, pr, r === 0, pal[5], edge);
    if (st === 3) continue;
    if (cr > 0 && pal[6] !== pal[5]) {
      dc.setColor(pal[6], -1);
      dc.fillRectangle(sx + P, y, cr * P, P);
    }
    if (r < sn) {
      dc.setColor(pal[7], -1);
      dc.fillRectangle(sx + cl * P, y, (cr - cl + 1) * P, P);
    } else if (r === sn) {
      dc.setColor(pal[7], -1);
      dc.fillRectangle(sx - Math.floor(-cl / 2) * P, y, P, P);
      dc.fillRectangle(sx, y, P, P);
      dc.fillRectangle(sx + Math.floor(cr / 2) * P, y, P, P);
    }
  }
}

function hill(dc, sx, i, pal, st) {
  const h = HILL[i + 1];
  const top = 284 - h * P;
  for (let r = 0; r < h; r++) {
    const w = HW[r], pw = r > 0 ? HW[r - 1] : 0;
    lrow(dc, sx, top + r * P, -w, w, -pw, pw, r === 0, pal[8], pal[9]);
  }
  // pines
  const pp = st === 2 ? [pal[10], pal[9], pal[10]] : st === 3 ? [pal[10], pal[10], -1] : [pal[10], pal[9], 0x5a3a22];
  for (let k = 2; k < 4; k++) {
    const dx = HILL[i + k];
    let r = 0;
    while (r < h - 1 && HW[r] < (dx < 0 ? -dx : dx) + 1) r++;
    SPR.draw(dc, SP.PINE, sx + (dx - 2) * P, top + r * P - 3 * P, P, pp, false);
  }
}

// x position of an element at world cell cx in a layer of period per (px), offset off
function wrapX(cx, off, per) {
  return ((((cx * P - off) % per) + per) % per);
}

function riderPal(st, acc) {
  if (st === 2) return [GB[0], GB[3], GB[2], GB[3], GB[3], GB[0], GB[2], GB[2], GB[2], GB[0], GB[0]];
  if (st === 3) return [MAG, acc, 0xffe0d0, CYA, CYA, 0x5a1a80, G.dim(CYA, 0.6), G.dim(acc, 0.6), 0x9a7a90, MAG, CYA];
  return [0x16161e, acc, 0xf2b98a, 0xffffff, 0x2ec4f0, 0x23232e, 0xb8b8c4, G.dim(acc, 0.7), 0xb07850, 0xe03a3a, 0x2a2a2a];
}

// progress: [value, goal, label text]
function stage(d) {
  if (d.src === 0) {
    const v = d.floorsWeek > 0 ? d.floorsWeek * 3 : 0;
    return [v, 1071, "HM " + v + "/1071"];
  }
  if (d.src === 2) {
    const v = d.trainDays > 0 ? d.trainDays : 0;
    const g = d.dayGoal > 0 ? d.dayGoal : 4;
    return [v, g, "TAGE " + v + "/" + g];
  }
  const km = d.wkBike > 0 ? Math.floor(d.wkBike / 1000) : 0;
  const g = d.cfg.bikeGoal > 0 ? d.cfg.bikeGoal : 150;
  return [km, g, "KM " + km + "/" + g];
}

function timeStr(d) {
  return (d.is24 ? G.pad2(d.h) : "" + G.hour(d)) + ":" + G.pad2(d.m);
}

export default {
  fps: 12,

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const tt = a.live ? a.t : 1400;
    const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const pal = scenePal(st, el);
    const night = el < -3;
    // speed from heart rate
    let v = 1.0;
    if (d.hr > 0 && d.rhr > 0) v = 1 + G.clamp((d.hr - d.rhr) / 45.0, 0, 2);
    // distance travelled (px): steady ride + a decelerating fast-forward during the intro
    const dist = (72 * v * tt) / 1000.0 + 640 * G.ease(tt / 1400.0);

    // ---------------- sky
    for (let i = 0; i < 5; i++) {
      dc.setColor(pal[i], -1);
      dc.fillRectangle(0, BAND[i], 454, BAND[i + 1] - BAND[i]);
    }
    // stars
    const sf = st === 3 ? 0.8 : G.clamp((-2 - el) / 6.0, 0, 1);
    if (sf > 0) {
      let s = 7;
      for (let i = 0; i < 20; i++) {
        s = G.rnd(s);
        const x = 24 + (s % 102) * P;
        s = G.rnd(s);
        const y = 8 + (s % 56) * P;
        const tw = a.live && (Math.floor(tt / 300) + i) % 7 === 0 ? 0.35 : 1;
        const b = (0.35 + (i % 3) * 0.3) * sf * tw;
        dc.setColor(st === 2 ? GB[2] : G.mix(pal[1], 0xffffff, b), -1);
        dc.fillRectangle(x, y, P, P);
      }
    }
    // sun / moon
    const rise = d.sunrise, set = d.sunset;
    if (st === 3 && el > -6) {
      // synthwave sun behind the mountains
      for (let r = 0; r < 26; r++) {
        if (r > 12 && r % 3 === 0) continue;
        const dy = r - 12.5;
        const hw = Math.floor(Math.sqrt(169 - dy * dy));
        dc.setColor(G.mix(acc, MAG, r / 25.0), -1);
        dc.fillRectangle(227 - hw * P, 184 + r * P, hw * 2 * P, P);
      }
    } else if (el > -3) {
      let f = 0.5;
      if (rise >= 0 && set > rise) f = G.clamp((d.mins - rise) / (set - rise), 0, 1);
      const sx = q4(72 + f * 310) - 16;
      const sy = q4(G.clamp(268 - el * 4.5, 172, 300)) - 16;
      const gf = G.clamp((10 - el) / 12.0, 0, 1);
      const sp = st === 2 ? [GB[0], GB[2], GB[3]] : [G.mix(0xffc83a, 0xff5a28, gf), G.mix(0xfff2a0, 0xff9a3a, gf), G.mix(0xffffff, 0xffd080, gf)];
      SPR.draw(dc, SP.SUN, sx, sy, P, sp, false);
    } else if (d.moon > 0.05 && d.moon < 0.95) {
      let f = 0.5;
      if (rise >= 0 && set >= 0) {
        let m = d.mins - set;
        if (m < 0) m += 1440;
        f = G.clamp(m / (rise + 1440 - set), 0, 1);
      }
      const mx = q4(72 + f * 310) - 14;
      const my = q4(160 + (1 - Math.sin(f * Math.PI)) * 70) - 14;
      const lit = st === 2 ? GB[3] : st === 3 ? CYA : 0xf4f1d0;
      SPR.draw(dc, SP.MOON, mx, my, P, [lit, st === 2 ? GB[2] : st === 3 ? CYA : 0xc8c3a0], false);
      if (d.moon < 0.35 || d.moon > 0.65) SPR.draw(dc, SP.MOON_C, mx, my, P, [pal[1]], d.moon > 0.5);
    }
    // clouds (drift with the wind, a little parallax)
    if (st !== 3) {
      const co = q4((tt * 0.006 + dist * 0.05) % 640);
      const cp = [pal[16], pal[17]];
      SPR.draw(dc, SP.CLOUD_A, ((560 - co + 640) % 640) - 80, 160, P, cp, false);
      SPR.draw(dc, SP.CLOUD_B, ((300 - co + 640) % 640) - 80, 184, P, cp, false);
      SPR.draw(dc, SP.CLOUD_A, ((90 - co + 640) % 640) - 80, 208, P, cp, true);
    }

    // ---------------- far mountains (period 512 px)
    const fo = q4(dist * 0.12);
    for (let i = 0; i < FAR.length; i += 4) {
      const sx = wrapX(FAR[i], fo, 512);
      if (sx - 130 < 454) mountain(dc, sx, i, pal, st);
      if (sx + 130 > 512) mountain(dc, sx - 512, i, pal, st);
    }
    // ---------------- hills strip + pine hills (period 384 px)
    dc.setColor(pal[8], -1);
    dc.fillRectangle(0, 284, 454, 16);
    if (st === 3) {
      dc.setColor(CYA, -1);
      dc.fillRectangle(0, 284, 454, P);
    }
    const ho = q4(dist * 0.35);
    for (let i = 0; i < HILL.length; i += 4) {
      const sx = wrapX(HILL[i], ho, 384);
      if (sx - 48 < 454) hill(dc, sx, i, pal, st);
      if (sx + 48 > 384) hill(dc, sx - 384, i, pal, st);
    }

    // ---------------- road
    const ro = q4(dist);
    dc.setColor(pal[12], -1);
    dc.fillRectangle(0, 300, 454, 44);
    if (st === 3) {
      dc.setColor(acc, -1);
      dc.fillRectangle(0, 300, 454, P);
      dc.setColor(CYA, -1);
      dc.fillRectangle(0, 340, 454, P);
    } else {
      // red/white kerb along the far edge, plain line on the near edge
      dc.setColor(pal[13], -1);
      dc.fillRectangle(0, 300, 454, 8);
      dc.setColor(pal[15], -1);
      for (let x = -(ro % 32); x < 454; x += 32) dc.fillRectangle(x, 300, 16, 8);
      dc.setColor(st === 2 ? GB[2] : G.mix(pal[12], pal[13], 0.45), -1);
      dc.fillRectangle(0, 340, 454, P);
    }
    dc.setColor(st === 3 ? MAG : pal[13], -1);
    for (let x = -(ro % 64); x < 454; x += 64) dc.fillRectangle(x, 320, 28, P);
    // panel
    dc.setColor(pal[14], -1);
    dc.fillRectangle(0, 344, 454, 110);

    // ---------------- progress (stage)
    const sg = stage(d);
    const frac = G.clamp(sg[0] / sg[1], 0, 1);
    const done = sg[0] >= sg[1];
    const rp = G.easeInOut(G.stag(p, 3, 0.1, 0.6));

    // finish banner + confetti (goal reached)
    if (done) {
      const bx = q4(RX - 30 - dist + (72 * v * 1400) / 1000.0 + 640);
      if (bx > -140 && bx < 454) {
        dc.setColor(st === 2 ? GB[0] : st === 3 ? CYA : 0xd8d8d8, -1);
        dc.fillRectangle(bx, 232, P, 72);
        dc.fillRectangle(bx + 132, 232, P, 108);
        // checkered banner
        dc.setColor(st === 2 ? GB[3] : st === 3 ? 0x000000 : 0xffffff, -1);
        dc.fillRectangle(bx - 4, 216, 144, 28);
        dc.setColor(st === 2 ? GB[0] : st === 3 ? MAG : 0x111111, -1);
        for (let c = 0; c < 18; c += 2) {
          dc.fillRectangle(bx - 4 + c * 8, 216, 8, P);
          dc.fillRectangle(bx + 4 + c * 8, 220, 8, P);
          dc.fillRectangle(bx - 4 + c * 8, 236, 8, P);
          dc.fillRectangle(bx + 4 + c * 8, 240, 8, P);
        }
        dc.setColor(st === 2 ? GB[0] : st === 3 ? acc : 0xe03a3a, -1);
        F.px(dc, "ZIEL", bx + 68, 226, 2, 1, 0);
      }
    }

    // night headlight
    const rxp = q4(G.lerp(-96, RX, G.ease(G.stag(p, 0, 0, 0.75))));
    if (night && st === 1) {
      for (let k = 0; k < 3; k++) {
        dc.setColor(G.mix(pal[12], 0xfff0b0, 0.15 - k * 0.04), -1);
        dc.fillRectangle(rxp + 80 + k * 40, 316 - k * 4, 40, 12 + k * 8);
      }
      dc.setColor(0xfff6c0, -1);
      dc.fillRectangle(rxp + 64, RY + 32, P, P);
    }

    // rider
    const fr = Math.floor((tt * v) / 120) % 4;
    const rs = fr === 0 ? SP.RIDER_0 : fr === 1 ? SP.RIDER_1 : fr === 2 ? SP.RIDER_2 : SP.RIDER_3;
    if (st >= 2) SPR.draw(dc, SP.RIDER_GLOW, rxp - P, RY - P, P, [st === 2 ? GB[0] : G.dim(acc, 0.28)], false);
    SPR.draw(dc, rs, rxp, RY, P, riderPal(st, acc), false);

    // confetti burst at the finish line
    if (done) {
      const ct = (tt - 1000) / 1000.0;
      if (ct > 0 && ct < 2.2) {
        const cc = st === 2 ? [GB[3], GB[2], GB[0], GB[1]] : [acc, CYA, MAG, 0xffffff, 0x5fe08a];
        let s = 11;
        for (let i = 0; i < 26; i++) {
          s = G.rnd(s);
          const vx = (s % 400) - 200;
          s = G.rnd(s);
          const vy = -120 - (s % 260);
          const x = q4(RX + 40 + vx * ct);
          const y = q4(230 + vy * ct + 260 * ct * ct);
          if (y < 340) {
            dc.setColor(cc[i % cc.length], -1);
            dc.fillRectangle(x, y, P, (i + Math.floor(tt / 90)) % 3 === 0 ? P / 2 : P);
          }
        }
      }
    }

    // ---------------- HUD in the panel
    const dimT = st === 2 ? GB[2] : st === 3 ? G.dim(CYA, 0.7) : G.mix(pal[14], 0xffffff, 0.5);
    const hiT = st === 2 ? GB[3] : 0xffffff;
    const pre = done ? "ZIEL! " : "ETAPPE ";
    const lw = F.pxW(pre + sg[2], 2);
    const lx = 227 - lw / 2;
    const blink = done && a.live && p >= 1 && Math.floor(tt / 400) % 2 === 1;
    dc.setColor(done ? (blink ? hiT : st === 2 ? GB[3] : acc) : dimT, -1);
    F.px(dc, pre, lx, 352, 2, 0, 0);
    dc.setColor(hiT, -1);
    F.px(dc, sg[2], lx + F.pxW(pre, 2) + 2, 352, 2, 0, 0);
    // stage bar: 60 cells, segmented every 16 px
    const bx0 = 100, bw = 240, by = 384;
    dc.setColor(st === 2 ? GB[1] : st === 3 ? G.dim(acc, 0.25) : G.mix(pal[14], 0xffffff, 0.16), -1);
    dc.fillRectangle(bx0, by, bw, 8);
    const fw = q4(bw * frac * rp);
    if (fw > 0) {
      dc.setColor(st === 2 ? GB[3] : acc, -1);
      dc.fillRectangle(bx0, by, fw, 8);
    }
    dc.setColor(pal[14], -1);
    for (let x = bx0 + 12; x < bx0 + bw; x += 16) dc.fillRectangle(x, by, P, 8);
    // finish flag + rider marker
    SPR.draw(dc, SP.FLAG, bx0 + bw + 10, by - 12, 2, st === 2 ? [GB[2], GB[0], GB[3]] : [dimT, st === 3 ? MAG : 0x111111, 0xffffff], false);
    const mp = riderPal(st, acc);
    SPR.draw(dc, SP.MINI, bx0 + fw - 9, by - 16, 2, [hiT, mp[1], -1, mp[3], mp[4]], false);
    // one slot (skips a slot that repeats the stage value)
    let si = 0;
    if ((d.src === 1 && d.slots[0].lbl === "RAD/WO") || (d.src === 0 && d.slots[0].lbl === "ETAGEN")) si = 1;
    const sl = d.slots[si];
    const sw = F.pxW(sl.lbl + " " + sl.val, 2);
    dc.setColor(dimT, -1);
    F.px(dc, sl.lbl, 227 - sw / 2, 408, 2, 0, 0);
    dc.setColor(st === 2 ? GB[3] : d.dcol, -1);
    F.px(dc, sl.val, 227 + sw / 2, 408, 2, 2, 0);

    // ---------------- time + date
    const tq = G.stag(p, 1, 0.12, 0.55);
    const ty = 56 - q4((1 - G.spring(tq)) * 130);
    const ts = timeStr(d);
    const tc = st === 2 ? (night ? GB[3] : GB[0]) : 0xffffff;
    const sc = st === 2 ? (night ? GB[1] : GB[3]) : st === 3 ? MAG : G.mix(pal[0], 0x000000, 0.55);
    if (tq > 0) {
      dc.setColor(sc, -1);
      F.px(dc, ts, 227 + P, ty + P, 8, 1, 0);
      dc.setColor(tc, -1);
      F.px(dc, ts, 227, ty, 8, 1, 0);
    }
    const dp = G.stag(p, 3, 0.12, 0.4);
    dc.setColor(G.mix(pal[0], st === 2 ? tc : st === 3 ? CYA : 0xffffff, dp * 0.9), -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 126, 2, 1, 0);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const ox = o[0], oy = o[1];
    dc.setColor(0x2e2e2e, -1);
    dc.fillRectangle(60 + ox, 332 + oy, 334, 1);
    const c = G.dim(d.accent, 0.42);
    SPR.draw(dc, SP.RIDER_0, RX + ox, RY + oy, P, [c, c, c, c, c, c, -1, c, c, c, c], false);
    dc.setColor(0x8a8a8a, -1);
    F.px(dc, timeStr(d), 227 + ox, 96 + oy, 8, 1, 2);
  },
};
