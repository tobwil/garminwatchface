// BUDDY — "Pixel Buddy": a virtual pet driven by your body data. Its mood follows
// Body Battery, stress, steps and the hour; four Tamagotchi needs bars (Energie, Ruhe,
// Futter, Schlaf), a speech bubble, and an egg that hatches on the first wake of the day.
// Styles: 1 Klassik, 2 Gameboy, 3 Pastell. Mirrors watch/source/faces/Buddy.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/buddy.js";

const SP = encodeAll(S);
const BODIES = [SP.BODY, SP.SQUASH, SP.STRETCH, SP.FLAT];
const EYES = [SP.EYE_OPEN, SP.EYE_BLINK, SP.EYE_HAPPY, SP.EYE_SLEEP, SP.EYE_TIRED, SP.EYE_STRESS];
const MOUTHS = [SP.MOUTH_SMILE, SP.MOUTH_OPEN, SP.MOUTH_FLAT, SP.MOUTH_FROWN, SP.MOUTH_O, SP.MOUTH_DOT];
const ICONS = [SP.ICO_BOLT, SP.ICO_LEAF, SP.ICO_APPLE, SP.ICO_MOON];
// per body frame: face offset x/y and head top row (sprite pixels)
const FDX = [6, 7, 5, 9];
const FDY = [9, 8, 9, 5];
const HT = [3, 2, 2, 2];
const PX = 5; // scene pixel size
const BASE = 314; // bottom edge of the buddy
const LBL = ["ENERGIE", "RUHE", "FUTTER", "SCHLAF"];
// moods
const SLEEP = 0, STRESS = 1, PARTY = 2, LAZY = 3, TIRED = 4, HAPPY = 5;
// ambient pose tables (8 fps steps): frame + y offset
const HOP_F = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 2, 1, 0];
const HOP_Y = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -10, -20, -10, 0, 0];
const PAR_F = [0, 1, 2, 0, 0, 2];
const PAR_Y = [0, 0, -10, -20, -20, -10];
const POP_F = [1, 1, 1, 2, 0, 0, 2, 1, 0, 0];
const POP_Y = [0, 0, 0, -15, -25, -25, -10, 0, 0, 0];
const HAT_F = [2, 2, 0, 0, 2, 1, 0, 0];
const HAT_Y = [-10, -30, -40, -35, -15, 0, 0, 0];
const REST = [300, 875, 375, 0, 0, 0];
const STX = [64, 388, 146, 316];
const STY = [166, 170, 188, 186];

let hatchDay = -2;

function mood(d) {
  if ((d.bb >= 0 && d.bb < 20) || d.h >= 22 || d.h < 6) return SLEEP;
  if (d.stress >= 70) return STRESS;
  if (d.stepGoal > 0 && d.steps >= d.stepGoal) return PARTY;
  if (d.h >= 15 && d.steps >= 0 && d.steps < d.stepGoal * 0.3) return LAZY;
  if (d.bb >= 0 && d.bb < 40) return TIRED;
  return HAPPY;
}

function line(d, md) {
  const alt = d.m % 2 === 1;
  if (md === SLEEP) return d.h >= 22 || d.h < 6 ? "Zzz... gute Nacht!" : "Akku leer... Zzz";
  if (md === STRESS) return alt ? "Tief durchatmen!" : "Puh, Stress...";
  if (md === PARTY) return alt ? "Du bist super! @" : "Zieeel! Juhuu!";
  if (md === LAZY) return "BEWEG DICH!";
  if (md === TIRED) return alt ? "Ein Nickerchen?" : "Bin so müde...";
  if (d.bb >= 70) return "Ich bin voll geladen!";
  return alt ? "Hab dich lieb @" : "Alles super!";
}

// colour table per style
function pal(st, acc) {
  const W = 0xffffff;
  if (st === 2) {
    const c0 = 0x0f380f, c1 = 0x306230, c2 = 0x8bac0f, c3 = 0x9bbc0f;
    return [c3, c0, c2, c3, c1, c3, c1, c0, c3, c1, // bg, outline, body, hi, shade, belly, cheek, eye, eyeW, tongue
      c0, c2, c1, c3, c0, c0, c2, c0, c0, c0, c0, // time, shadow, dim, bubFill, bubEdge, bubText, segOff, needs x4
      c1, c2, c0, c1, c3, c3, c1, c3, c0, // cushion main/light/dark, cap main/stripe/pom, party main/stripe/pom
      c1, c1, c2, c1, c0, c0, c0, -1, -1]; // sweat, zzz, egg shell/shade/spot, warn, slot value, screen, screenEdge
  }
  if (st === 3) {
    const ink = 0x5b4b6b;
    const shell = G.mix(acc, 0xfff6ee, 0.62);
    const scr = 0xeef3e2;
    return [shell, ink, G.mix(acc, W, 0.25), G.mix(acc, W, 0.75), G.mix(acc, ink, 0.3), G.mix(acc, W, 0.55), 0xff9eb5, 0x3d3048, W, 0xff8fa3,
      ink, G.mix(shell, W, 0.7), G.mix(ink, shell, 0.38), W, ink, ink, G.mix(scr, ink, 0.16), 0xf0b030, 0x4cc2ac, 0xf38a66, 0x9c80e6,
      0xa7c7f2, 0xd6e6ff, G.mix(0xa7c7f2, ink, 0.45), 0x8fb0ea, W, W, 0xf7c95c, 0xff8fa3, 0x7fd3c3,
      0x7cc8f0, 0x8a7cc0, 0xfffaf2, 0xe6d7c0, acc, 0xe0506a, ink, scr, G.mix(shell, ink, 0.35)];
  }
  return [-1, G.mix(acc, 0, 0.72), acc, G.mix(acc, W, 0.6), G.mix(acc, 0, 0.3), G.mix(acc, W, 0.35), G.mix(acc, 0xff2d55, 0.55), 0x1b1024, W, 0xff5a6e,
    W, G.dim(acc, 0.45), 0x9a94a8, W, W, 0x22182e, 0x2c2638, 0xffd23d, 0x4fd8c4, 0xff8a3d, 0x9b7bff,
    0x4c5bd4, 0x7d8cff, 0x2a327a, 0x3e4fc8, 0xedebff, W, 0xffd23d, 0xff5a7a, 0x4fd8c4,
    0x7fd8ff, 0xa9c8ff, 0xfff4e0, 0xe0cfae, acc, 0xff4a4a, -2, -1, -1];
}

// cut-corner pixel box
function pbox(dc, x, y, w, h, c) {
  dc.setColor(c, -1);
  dc.fillRectangle(x + 4, y, w - 8, h);
  dc.fillRectangle(x, y + 4, w, h - 8);
}

// speech / thought bubble centred at cx, top y
function bubble(dc, P, txt, cx, y, thought) {
  const tw = F.pxW(txt, 2);
  const w = tw + 24, h = 28;
  const x = Math.round(cx - w / 2);
  const edge = P[14], fill = P[13];
  pbox(dc, x, y, w, h, edge);
  if (edge !== fill) pbox(dc, x + 3, y + 3, w - 6, h - 6, fill);
  const tx = 246;
  if (thought) {
    pbox(dc, tx, y + h + 3, 12, 10, edge);
    if (edge !== fill) { dc.setColor(fill, -1); dc.fillRectangle(tx + 3, y + h + 6, 6, 4); }
    dc.setColor(edge, -1);
    dc.fillRectangle(tx - 8, y + h + 17, 6, 6);
  } else {
    dc.setColor(edge, -1);
    dc.fillRectangle(tx, y + h - 2, 15, 6);
    dc.fillRectangle(tx, y + h + 4, 10, 5);
    dc.fillRectangle(tx, y + h + 9, 5, 5);
    if (edge !== fill) { dc.setColor(fill, -1); dc.fillRectangle(tx + 3, y + h - 3, 9, 5); dc.fillRectangle(tx + 3, y + h + 2, 4, 5); }
  }
  dc.setColor(P[15], -1);
  return x + 12;
}

function needVal(d, i) {
  if (i === 0) return d.bb;
  if (i === 1) return d.stress < 0 ? -1 : 100 - d.stress;
  if (i === 2) return d.stepGoal > 0 && d.steps >= 0 ? (100 * d.steps) / d.stepGoal : -1;
  return d.sleep;
}

export default {
  fps: 8,

  draw(dc, d, a) {
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const md = mood(d);
    const live = a.live;
    const t = live ? a.t : REST[md];
    const k = Math.floor(t / 125);
    const today = d.year * 1000 + d.doy;
    if (hatchDay === -2) hatchDay = St.get("bDay", -1);
    const hatch = md !== SLEEP && hatchDay !== today;
    if (hatch && p >= 1) { hatchDay = today; St.set("bDay", today); }

    // ---------------- backdrop
    if (st === 2) {
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 0, 454, 454);
      dc.setColor(P[11], -1);
      dc.setPenWidth(8);
      dc.drawCircle(227, 227, 222);
    } else if (st === 3) {
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 0, 454, 454);
      dc.setColor(P[38], -1);
      dc.fillRoundedRectangle(26, 116, 402, 216, 30);
      dc.setColor(P[37], -1);
      dc.fillRoundedRectangle(32, 122, 390, 204, 25);
    }

    // ---------------- time + date
    const ts = G.timeStr(d);
    const ty = 40 - Math.round((1 - G.ease(p * 3)) * 30);
    dc.setColor(P[11], -1);
    F.px(dc, ts, 231, ty + 4, 7, 1, 0);
    dc.setColor(P[10], -1);
    F.px(dc, ts, 227, ty, 7, 1, 0);
    dc.setColor(P[12], -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 97, 2, 1, 0);

    // ---------------- needs bars (2 left, 2 right)
    for (let i = 0; i < 4; i++) {
      const right = i >= 2;
      const y = (i % 2) * 56 + 200;
      const v = needVal(d, i);
      const n = v < 0 ? 0 : G.clamp(Math.ceil(v / 20 - 0.001), v > 0 ? 1 : 0, 5);
      const fill = p >= 1 ? n : Math.floor(n * G.ease(G.stag(p - 0.45, i, 0.06, 0.3)) + 0.001);
      const warn = v >= 0 && n <= 1 && (!live || k % 8 < 5);
      const lx = right ? 410 : 44;
      dc.setColor(P[12], -1);
      F.px(dc, LBL[i], lx, y, 2, right ? 2 : 0, 0);
      const ix = right ? 389 : 44;
      SPR.draw(dc, ICONS[i], ix, y + 18, 3, [-1, warn ? P[35] : P[17 + i], st === 1 ? P[13] : st === 2 ? P[11] : P[1]], false);
      const sx = right ? 322 : 70;
      for (let s = 0; s < 5; s++) {
        const on = right ? 4 - s < fill : s < fill;
        dc.setColor(on ? P[17 + i] : P[16], -1);
        dc.fillRectangle(sx + s * 13, y + 21, 10, 15);
      }
    }

    // ---------------- night sky (sleeping)
    if (md === SLEEP) {
      dc.setColor(P[27], -1);
      for (let i = 0; i < 4; i++) {
        const sx = STX[i], sy = STY[i];
        dc.fillRectangle(sx, sy, 3, 3);
        if ((k + i * 3) % 10 < 6) {
          dc.fillRectangle(sx - 3, sy, 9, 3);
          dc.fillRectangle(sx, sy - 3, 3, 9);
        }
      }
    }

    // ---------------- cushion
    const cy0 = BASE - 20;
    SPR.draw(dc, SP.CUSHION, 137, cy0, PX, [P[23], P[21], P[22], P[27]], false);

    // ---------------- buddy pose
    let fr = 0, by = 0, bx = 0, eye = 0, mouth = 0, show = true;
    let egg = -1, eggX = 0, eggY = 0, shellT = -1;
    if (md === HAPPY) {
      const q = k % 16;
      fr = HOP_F[q]; by = HOP_Y[q];
      eye = by < 0 ? 2 : k % 27 === 5 ? 1 : 0;
      mouth = by < 0 ? 1 : 0;
    } else if (md === PARTY) {
      const q = k % 6;
      fr = PAR_F[q]; by = PAR_Y[q];
      eye = 2; mouth = 1;
    } else if (md === STRESS) {
      bx = k % 10 < 5 ? ((k % 2) * 2 - 1) * 5 : 0;
      eye = 5; mouth = 3;
    } else if (md === SLEEP) {
      fr = k % 16 < 8 ? 0 : 1;
      eye = 3; mouth = fr === 0 ? 4 : 5;
    } else if (md === TIRED) {
      fr = k % 12 < 6 ? 0 : 1;
      const yawn = k % 48 >= 30 && k % 48 < 38;
      eye = yawn ? 1 : 4; mouth = yawn ? 4 : 2;
    } else {
      fr = 3;
      eye = k % 30 === 4 ? 1 : 4; mouth = 2;
    }
    // intro: egg hatch (first wake of the day) or a squash & stretch pop
    if (p < 1) {
      bx = 0;
      if (hatch) {
        if (p < 0.5) {
          show = false;
          egg = p < 0.28 ? 0 : p < 0.4 ? 1 : 2;
          eggY = -Math.round((1 - G.ease(p / 0.15)) * 24) * 5;
          eggX = p > 0.15 ? (Math.floor(p * 22) % 2) * 10 - 5 : 0;
        } else {
          const u = (p - 0.5) / 0.5;
          const q = G.clamp(Math.floor(u * 8), 0, 7);
          fr = md === LAZY ? 3 : HAT_F[q]; by = HAT_Y[q];
          eye = q < 5 ? 2 : eye; mouth = q < 5 ? 1 : mouth;
          shellT = u;
        }
      } else {
        const q = G.clamp(Math.floor(p * 10), 0, 9);
        if (md !== LAZY) { fr = POP_F[q]; }
        by = POP_Y[q];
        if (q < 3) eye = md === SLEEP ? 3 : 1;
      }
    }

    // ---------------- confetti (behind)
    if (md === PARTY && p >= 0.75) {
      const cc = st === 2 ? [P[1], P[4], P[1], P[4], P[1]] : [P[17], P[18], P[28], P[20], P[19]];
      let sd = 4242;
      for (let i = 0; i < 16; i++) {
        sd = G.rnd(sd);
        const x = 145 + (sd % 160);
        sd = G.rnd(sd);
        const v = 40 + (sd % 50);
        sd = G.rnd(sd);
        const yy = 130 + Math.floor(((t * v) / 1000 + (sd % 190)) % 190);
        const sy = Math.floor(yy / 5) * 5 + 4;
        const sx = Math.floor((x + G.noise(t / 400 + i) * 8) / 5) * 5 + 2;
        if (sy > 285) continue;
        dc.setColor(cc[i % 5], -1);
        if ((i + k) % 3 === 0) dc.fillRectangle(sx, sy, 5, 5);
        else dc.fillRectangle(sx, sy, i % 2 === 0 ? 10 : 5, i % 2 === 0 ? 5 : 10);
      }
    }

    // ---------------- egg
    if (egg >= 0) {
      const ex = 187 + eggX, ey = BASE - 100 + eggY;
      const ep = [P[1], P[32], P[33], P[34]];
      SPR.draw(dc, SP.EGG, ex, ey, PX, ep, false);
      if (egg === 1) SPR.draw(dc, SP.CRACK1, ex, ey, PX, ep, false);
      if (egg === 2) SPR.draw(dc, SP.CRACK2, ex, ey, PX, ep, false);
    }

    // ---------------- buddy
    const B = BODIES[fr];
    const W = B[0], H = B[1];
    const X = 227 - Math.floor((W * PX) / 2) + bx;
    const Y = BASE - H * PX + by;
    if (show) {
      SPR.draw(dc, B, X, Y, PX, [P[1], P[2], P[3], P[4], P[5], P[6]], false);
      const fp = [P[7], P[8], -1, P[4], -1, P[6], P[9]];
      SPR.draw(dc, EYES[eye], X + FDX[fr] * PX, Y + FDY[fr] * PX, PX, fp, false);
      SPR.draw(dc, MOUTHS[mouth], X + FDX[fr] * PX, Y + (FDY[fr] + 3) * PX, PX, fp, false);
      const hy = Y + (HT[fr] + 1) * PX;
      if (md === SLEEP) SPR.draw(dc, SP.NIGHTCAP, X + (W / 2 - 8) * PX - 5, hy - 9 * PX, PX, [P[1], P[24], P[25], P[26]], false);
      if (md === PARTY) SPR.draw(dc, SP.PARTYHAT, X + Math.floor(W / 2 - 3.5) * PX, hy - 9 * PX, PX, [P[1], P[27], P[28], P[29]], false);
    }
    // shell pieces of the hatch
    if (shellT >= 0 && shellT < 1) {
      const ep = [P[1], P[32], P[33], P[34]];
      const sx = 187 - Math.round(shellT * 18) * 5;
      const sy = BASE - 100 - Math.round(40 * shellT - 50 * shellT * shellT) * 5;
      if (shellT < 0.8) SPR.draw(dc, SP.SHELL_TOP, sx, sy, PX, ep, false);
      if (shellT < 0.4) SPR.draw(dc, SP.SHELL_BOT, 187, BASE - 50, PX, ep, false);
      else if (shellT < 0.6) {
        dc.setColor(P[32], -1);
        const r = Math.round((shellT - 0.4) * 100);
        for (let i = 0; i < 6; i++) dc.fillRectangle(222 + Math.round(Math.sin(i * 1.05) * (40 + r)), BASE - 15 - Math.round(Math.abs(Math.cos(i * 1.05)) * r), 5, 5);
      }
    }

    // ---------------- mood props
    if (show && p >= 0.6) {
      if (md === STRESS) {
        const sp = [P[30], st === 2 ? P[3] : 0xffffff];
        for (let i = 0; i < 2; i++) {
          const ph = ((t + i * 520) % 1040) / 1040;
          const sx = i === 0 ? X - 10 - Math.round(ph * 3) * 5 : X + W * PX - 5 + Math.round(ph * 3) * 5;
          SPR.draw(dc, SP.SWEAT, sx, Y + 25 + Math.round(ph * 8) * 5, PX, sp, false);
        }
      } else if (md === SLEEP) {
        dc.setColor(P[31], -1);
        for (let i = 0; i < 3; i++) {
          const ph = ((t + i * 800) % 2400) / 2400;
          const zs = 2 + Math.floor(ph * 3);
          F.px(dc, zs >= 4 ? "Z" : "z", X + W * PX - 5 + Math.round(ph * 5) * 5, Y + 15 - Math.round(ph * 7) * 5, zs, 0, 0);
        }
      }
    }

    // ---------------- speech bubble
    if (p >= 1) {
      let txt = line(d, md);
      let bw = txt;
      let n = txt.length;
      if (live) {
        if (md === LAZY) {
          if (Math.floor(t / 2000) % 2 === 0) { bw = "..."; txt = "...".substring(0, k % 4); n = txt.length; }
        } else n = G.clamp(Math.floor((t - 1400) / 45), 0, txt.length);
      }
      const tx = bubble(dc, P, bw, 227, 129, md === SLEEP || md === LAZY);
      if (n > 0) F.px(dc, txt.substring(0, n), tx, 136, 2, 0, 0);
    }

    // ---------------- slots
    for (let i = 0; i < 3; i++) {
      const sl = d.slots[i];
      const x = 125 + i * 102;
      const vs = F.pxW(sl.val, 3) > 88 ? 2 : 3;
      if (st === 3) {
        dc.setColor(P[12], -1);
        F.px(dc, sl.lbl, x, 336, 2, 1, 0);
        dc.setColor(P[38], -1);
        dc.fillRoundedRectangle(x - 50, 352, 100, 36, 18);
        dc.setColor(P[13], -1);
        dc.fillRoundedRectangle(x - 48, 352, 96, 32, 16);
        dc.setColor(P[10], -1);
        F.px(dc, sl.val, x, vs === 3 ? 358 : 361, vs, 1, 0);
      } else {
        dc.setColor(P[12], -1);
        F.px(dc, sl.lbl, x, 338, 2, 1, 0);
        dc.setColor(st === 2 ? P[36] : d.dcol, -1);
        F.px(dc, sl.val, x, vs === 3 ? 356 : 359, vs, 1, 0);
      }
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const c = st === 2 ? 0x306230 : G.dim(d.accent, 0.5);
    dc.setColor(0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 96 + o[1], 6, 1, 1);
    const B = SP.BODY;
    const X = 227 - 60 + o[0], Y = BASE - 110 + o[1];
    SPR.draw(dc, B, X, Y, PX, [c, -1, -1, -1, -1, -1], false);
    SPR.draw(dc, SP.EYE_SLEEP, X + 30, Y + 45, PX, [c], false);
    SPR.draw(dc, SP.NIGHTCAP, X + 15, Y - 25, PX, [c, -1, -1, -1], false);
    dc.setColor(G.dim(c, 0.8), -1);
    F.px(dc, "z", X + 125, Y + 5, 3, 0, 0);
    F.px(dc, "Z", X + 145, Y - 25, 4, 0, 0);
  },
};
