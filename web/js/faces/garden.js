// GARDEN — "Pixel-Garten": a raised bed that grows with you over weeks. Every day is judged at
// midnight from what the watch knows about it (sleep score, steps against the goal, stress, Body
// Battery): a good day makes the youngest plant grow (a great day twice), sows a new seed once all
// have taken root and brings in the harvest when everything is ripe; bad days make the garden wilt.
// The state lives in the watch's storage, so the garden remembers. Six plants: tulips (in the
// accent colour), sunflowers, a strawberry and a tomato on its stake, from seed to fruit. Today's
// "water" on the board shows how the day is going and what is still missing; a watering can pours on
// every wrist raise, butterflies visit the blossoms, fireflies glow on summer nights, and after three
// good days in a row a hedgehog moves in. Lives with the year and the real weather (season.js).
// Styles: 1 Garten, 2 Nacht, 3 Gameboy. Mirrors watch/source/faces/Garden.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import { SE, EV } from "../engine/season.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/garden.js";

const SP = encodeAll(S);
const BED = 304; // soil top, where the plants stand
const XS = [72, 134, 196, 258, 320, 382]; // plant spots
const KIND = [1, 0, 3, 2, 0, 1]; // 0 sunflower, 1 tulip, 2 tomato, 3 strawberry
const GROWN = [SP.SUN_GROWN, SP.TULIP_GROWN, SP.TOM_GROWN, SP.BERRY_GROWN];
const BLOOM = [SP.SUN_BLOOM, SP.TULIP_BLOOM, SP.TOM_BLOOM, SP.BERRY_BLOOM];
const FRUIT = [SP.SUN_FRUIT, SP.TULIP_FRUIT, SP.TOM_FRUIT, SP.BERRY_FRUIT];
// per kind: petal, flower centre, fruit
const KC = [0xffd23a, 0x6a3a1a, 0x3a2410, -1, 0xffe05a, -1, 0xffe05a, 0xffe05a, 0xe8302a, 0xffffff, 0xffe05a, 0xe8304a];

let gs = null; // the garden, read from the storage with every static redraw

function leap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function dayKey(d) { return d.year * 1000 + d.doy; }
function yKey(d) { return d.doy > 1 ? d.year * 1000 + d.doy - 1 : (d.year - 1) * 1000 + (leap(d.year - 1) ? 366 : 365); }

// the parts of today's score without the steps: 0.3 sleep + 0.15 calm + 0.15 energy
function base(d) {
  const sl = d.sleep > 0 ? d.sleep : 60, ca = d.stress >= 0 ? 100 - d.stress : 60, en = d.bb >= 0 ? d.bb : 60;
  return 0.3 * sl + 0.15 * ca + 0.15 * en;
}
function goalOf(d) { return d.stepGoal > 0 ? d.stepGoal : 10000; }
// today's score 0..100 (60 = the garden grows)
function score(d) { return Math.round(base(d) + 40 * G.clamp(d.steps / goalOf(d), 0, 1)); }

// one growth step: the youngest plant grows; a seed once all have taken root; harvest when all are ripe
function grow(P) {
  let b = -1;
  for (let i = 0; i < 6; i++) if (P[i] > 0 && P[i] < 6 && (b < 0 || P[i] < P[b])) b = i;
  let e = -1;
  for (let i = 0; i < 6; i++) if (P[i] === 0 && e < 0) e = i;
  if (e >= 0 && (b < 0 || P[b] >= 3)) { P[e] = 1; return 0; }
  if (b >= 0) { P[b] += 1; return 0; }
  for (let i = 0; i < 6; i++) if (P[i] === 6) { P[i] = 1; return 1; }
  return 0;
}

// persistent state -> [plants (6 stages 0..6), age in days, harvests, good-day streak, wilt 0..3]
function sync(d) {
  // web preview only: seed a demo garden once
  if (St.get("gaDemo", 0) === 0) {
    St.set("gaDemo", 1);
    St.set("gaP", [5, 6, 6, 5, 4, 2]);
    St.set("gaA", 23);
    St.set("gaH", 1);
    St.set("gaS", 4);
    St.set("gaW", 0);
    St.set("gaT", 70);
    St.set("gaD", yKey(d));
  }
  const today = dayKey(d);
  const day = St.get("gaD", -1);
  const sc = score(d);
  if (day === -1) {
    // first start: a sprout and two seeds
    St.set("gaP", [2, 1, 0, 1, 0, 0]);
    St.set("gaA", 1);
    St.set("gaH", 0);
    St.set("gaS", 0);
    St.set("gaW", 0);
    St.set("gaD", today);
    St.set("gaT", sc);
  } else if (day !== today) {
    const P = St.get("gaP", [2, 1, 0, 1, 0, 0]).slice();
    let H = St.get("gaH", 0), sk = St.get("gaS", 0), w = St.get("gaW", 0);
    if (day === yKey(d)) {
      // judge yesterday (after a gap the garden simply waited for you)
      const y = St.get("gaT", 0);
      if (y >= 60) {
        H += grow(P);
        if (y >= 80) H += grow(P);
        sk += 1;
        w = Math.max(0, w - 1);
      } else if (y < 35) {
        sk = 0;
        if (w >= 3) {
          let t = 0;
          for (let i = 1; i < 6; i++) if (P[i] > P[t]) t = i;
          if (P[t] > 1) P[t] -= 1;
        }
        w = Math.min(3, w + 1);
      }
    } else sk = 0;
    St.set("gaP", P);
    St.set("gaA", St.get("gaA", 1) + 1);
    St.set("gaH", H);
    St.set("gaS", sk);
    St.set("gaW", w);
    St.set("gaD", today);
    St.set("gaT", sc);
  } else if (Math.abs(sc - St.get("gaT", 0)) >= 2) St.set("gaT", sc);
  return [St.get("gaP", [2, 1, 0, 1, 0, 0]), St.get("gaA", 1), St.get("gaH", 0), St.get("gaS", 0), St.get("gaW", 0)];
}

// [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, hedge, fence,
//  fence shade, soil, soil dark, wood, wood dark, grass, grass dark, text, text dim, board, board text,
//  stem, leaf, leaf dark, star, spines, face, can, water]
function pal(st) {
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [c, e, b, c, a, a, b, e, c, b, a, b, a, c, b, a, b, a, e, a, b, a, e, a, c, b, e];
  }
  const night = st === 2;
  return [0x3a8ad8, 0xa8d8ff, 0x5a4a9a, 0xff9a6a, night ? 0x000000 : 0x060a20, night ? 0x060c1a : 0x141c44,
    0x2a5a2a, 0xf0ece0, 0xb8b0a0, 0x5a3a24, 0x3a2414, 0x9a6a3a, 0x6a4422, 0x4a8a3a, 0x3a7030, 0xffffff,
    0xe0f0d0, 0x2a3a2a, 0xffffff, 0x3a8a2a, 0x5ac83a, 0x2a6a24, 0xffffff, 0x6a5040, 0xe8c8a0, 0x7a9ab8, 0x8ad0ff];
}

export default {
  fps: 10,

  // static layer: sky, hedge, fence, bed, plants, board, texts; the watering can, butterflies,
  // fireflies, the hedgehog, rain or snow and the fairy lights move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st);
    const p = a.intro;
    const tt = a.live ? a.t : 0;
    const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const k = st === 2 || el < -6 ? 2 : el > 4 ? 0 : 1;
    const nf = st === 3 ? 0 : [0, 0.3, 0.6][k];
    const dk = (c) => G.mix(c, 0x050814, nf);
    const ev = SE.event(d);
    const sn = st !== 3 && SE.snowy(d);
    if (S || gs === null) gs = sync(d);
    const PL = gs[0];
    const sc = score(d);

    if (S) {
      // ---- sky, sun / moon, stars
      for (let i = 0; i < 5; i++) {
        dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 4), -1);
        dc.fillRectangle(0, i * 52, 454, 52);
      }
      if (k === 2) {
        dc.setColor(P[22], -1);
        for (let i = 0; i < 24; i++) dc.fillRectangle(30 + ((i * 101 + 17) % 394), 92 + ((i * 47 + 11) % 130), i % 6 === 0 ? 4 : 2, i % 6 === 0 ? 4 : 2);
      }
      if (el > -4 && st !== 2) {
        dc.setColor(st === 3 ? 0x9bbc0f : 0xfff6d0, -1);
        dc.fillCircle(100, 236 - Math.round(G.clamp(el, -4, 40) * 3.2), 14);
      } else if (k === 2) {
        dc.setColor(st === 3 ? 0x9bbc0f : 0xf4f0d8, -1);
        dc.fillCircle(100, 120, 12);
        dc.setColor(P[4], -1);
        dc.fillCircle(106, 116, 10);
      }

      // ---- hedge, fence
      dc.setColor(dk(sn ? 0xc8d4e2 : P[6]), -1);
      for (let x = 0; x < 454; x += 4) {
        const h = 26 + Math.round(6 * Math.sin(x / 19) + 4 * Math.sin(x / 7));
        dc.fillRectangle(x, 262 - h, 4, h);
      }
      dc.setColor(dk(P[8]), -1);
      dc.fillRectangle(0, 262, 454, 4);
      dc.fillRectangle(0, 288, 454, 4);
      dc.setColor(dk(P[7]), -1);
      for (let x = 6; x < 454; x += 22) {
        dc.fillRectangle(x, 252, 12, 52);
        dc.fillRectangle(x + 4, 248, 4, 4);
      }
      if (sn) SE.snowCap(dc, 0, 254, 454);

      // ---- the bed: soil (dry when the day lacks steps), frame, grass
      const dry = !sn && d.mins >= 720 && d.steps < goalOf(d) * 0.3;
      dc.setColor(dk(sn ? 0xe8eef6 : dry ? G.mix(P[9], 0xc8a878, 0.4) : P[9]), -1);
      dc.fillRectangle(40, BED, 374, 30);
      dc.setColor(dk(sn ? 0xc8d4e2 : P[10]), -1);
      for (let i = 0; i < 14; i++) dc.fillRectangle(48 + ((i * 53) % 356), BED + 6 + ((i * 19) % 20), dry ? 10 : 4, 2);
      dc.setColor(dk(sn ? 0xeef4fa : P[13]), -1);
      dc.fillRectangle(0, 348, 454, 106);
      dc.setColor(dk(sn ? 0xd8e2ec : P[14]), -1);
      for (let i = 0; i < 12; i++) dc.fillRectangle(30 + ((i * 89) % 394), 352 + ((i * 37) % 60), 4, 6);
      dc.setColor(dk(P[11]), -1);
      dc.fillRectangle(34, 334, 386, 14);
      dc.fillRectangle(34, 326, 8, 22);
      dc.fillRectangle(412, 326, 8, 22);
      dc.setColor(dk(P[12]), -1);
      dc.fillRectangle(34, 346, 386, 2);
      if (sn) SE.snowCap(dc, 34, 334, 386);

      // ---- the plants (wilting turns them brown)
      const wf = gs[4] * 0.2;
      const wl = (c) => dk(G.mix(c, 0x8a6a3a, wf));
      for (let i = 0; i < 6; i++) {
        const s = PL[i], kd = KIND[i], cx = XS[i];
        if (s === 0) continue;
        if (s === 1) {
          dc.setColor(dk(P[10]), -1);
          dc.fillRectangle(cx - 10, BED - 4, 20, 4);
          dc.setColor(dk(0xc8a060), -1);
          dc.fillRectangle(cx - 2, BED - 8, 4, 4);
          continue;
        }
        const pet = kd === 1 ? d.accent : KC[kd * 3];
        const sp = s === 2 ? SP.SPROUT : s === 3 ? SP.YOUNG : s === 4 ? GROWN[kd] : s === 5 ? BLOOM[kd] : FRUIT[kd];
        SPR.draw(dc, sp, cx - 22, BED - sp[1] * 4, 4,
          [-1, wl(P[19]), wl(P[20]), wl(P[21]), wl(pet), wl(KC[kd * 3 + 1] < 0 ? pet : KC[kd * 3 + 1]),
            wl(KC[kd * 3 + 2] < 0 ? pet : KC[kd * 3 + 2]), dk(0x8a6a3a)], false);
      }

      // ---- decorations for the special days
      if (ev === EV.EASTER) SE.eggs(dc, 52, 358);
      else if (ev === EV.HALLOWEEN) SE.pumpkin(dc, 70, 362, 1);
      else if (ev === EV.VALENTINE) SE.heart(dc, 180, 140, 2);

      // ---- the garden diary board: data slots and today's water
      dc.setColor(dk(P[12]), -1);
      dc.fillRectangle(262, 200, 6, 50);
      dc.fillRectangle(380, 200, 6, 50);
      dc.setColor(P[17], -1);
      dc.fillRectangle(232, 108, 180, 94);
      dc.setColor(P[20], -1);
      F.px(dc, "GARTEN-TAGEBUCH", 322, 112, 1, 1, 0);
      for (let i = 0; i < 3; i++) {
        const s = d.slots[i];
        if (!s.lbl || G.stag(p, i, 0.1, 0.4) <= 0) continue;
        let lb = s.lbl;
        while (lb.length > 2 && F.pxW(lb, 2) > 150 - F.pxW(s.val, 2)) lb = lb.substring(0, lb.length - 1);
        dc.setColor(G.mix(P[18], P[17], 0.35), -1);
        F.px(dc, lb, 242, 126 + i * 18, 2, 0, 0);
        dc.setColor(P[18], -1);
        F.px(dc, s.val, 402, 126 + i * 18, 2, 2, 0);
      }
      dc.setColor(G.mix(P[18], P[17], 0.35), -1);
      F.px(dc, "HEUTE", 242, 184, 1, 0, 0);
      dc.setColor(G.mix(P[17], 0x000000, 0.5), -1);
      dc.fillRectangle(280, 184, 122, 10);
      dc.setColor(sc >= 60 ? P[20] : P[26], -1);
      dc.fillRectangle(282, 186, Math.round(118 * G.clamp(sc / 100, 0, 1)), 6);
      dc.setColor(P[18], -1);
      dc.fillRectangle(282 + 71, 182, 2, 14);

      // ---- time, date or greeting, captions
      dc.setColor(0x000000, -1);
      F.px(dc, G.timeStr(d), 229, 26, 5, 1, 0);
      dc.setColor(st === 3 ? 0x0f380f : P[15], -1);
      F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
      F.px(dc, ev ? SE.greeting(ev) : d.dowStr + " " + d.day + ". " + d.monStr, 227, 68, 2, 1, 0);
      let n = 0;
      for (let i = 0; i < 6; i++) if (PL[i] > 0) n++;
      const dark = sn && k < 2;
      dc.setColor(dark ? 0x1e2a4a : P[15], -1);
      F.px(dc, "TAG " + gs[1] + "   " + (gs[2] > 0 ? "ERNTE " + gs[2] : n + " PFLANZEN"), 227, 362, 2, 1, 0);
      const need = Math.ceil(((60 - base(d)) / 40) * goalOf(d)) - d.steps;
      let msg;
      if (d.mins < 300 || d.mins >= 1320) msg = sc >= 60 ? "MORGEN WÄCHST WAS" : "DER GARTEN SCHLÄFT";
      else if (sc >= 80) msg = "PRÄCHTIGER TAG!";
      else if (sc >= 60) msg = "MORGEN WÄCHST WAS";
      else if (need > 0 && d.steps + need <= goalOf(d)) msg = "NOCH " + G.num(need) + " SCHRITTE";
      else if (gs[4] >= 2) msg = "DER GARTEN WELKT";
      else if (d.sleep > 0 && d.sleep < 60) msg = "ZU WENIG SCHLAF";
      else if (d.stress > 50) msg = "ZU VIEL STRESS";
      else msg = "ENERGIE TANKEN";
      dc.setColor(dark ? 0x4a5a7a : P[16], -1);
      F.px(dc, msg, 227, 384, 2, 1, 0);
    }

    if (!M) return;
    // ---- real weather, fairy lights on the fence, fireworks, balloons
    SE.precip(dc, d, 0, 90, 454, 210, tt);
    if (ev === EV.ADVENT || ev === EV.XMAS) SE.lights(dc, 10, 250, 444, 250, tt);
    else if (ev === EV.NYE) SE.fireworks(dc, 40, 96, 170, 60, tt);
    else if (ev === EV.BIRTHDAY) SE.balloons(dc, 52, 300, tt);
    // ---- the watering can pours over the bed on every raise (by day)
    if (k < 2 && p < 1 && !sn) {
      const cx = Math.round(G.lerp(20, 400, G.ease(p)));
      SPR.draw(dc, SP.CAN, cx - 16, 210, 3, [-1, P[25], G.mix(P[25], 0, 0.4)], false);
      dc.setColor(P[26], -1);
      for (let i = 0; i < 4; i++) dc.fillRectangle(cx + 18 + (i % 2) * 4, 236 + ((Math.floor(a.t / 4) + i * 17) % 64), 2, 6);
    }
    let bloom = false;
    for (let i = 0; i < 6; i++) if (PL[i] >= 5) bloom = true;
    if (k < 2 && bloom && !sn) {
      // butterflies visit the blossoms
      for (let i = 0; i < 2; i++) {
        const bx = 110 + i * 170 + Math.round(50 * Math.sin(tt / 1300 + i * 2));
        const by = 214 + Math.round(18 * Math.sin(tt / 500 + i * 3));
        SPR.draw(dc, Math.floor(tt / 150 + i) % 2 === 0 ? SP.BFLY_A : SP.BFLY_B, bx, by, 3,
          [-1, i === 0 ? 0xffd23a : 0x8ad8ff, 0x2a2a2a], false);
      }
    } else if (k === 2 && !sn && SE.season(d) % 3 !== 0) {
      // fireflies on spring and summer nights
      for (let i = 0; i < 6; i++) {
        if ((Math.floor(tt / 400) + i * 3) % 5 === 0) continue;
        dc.setColor(i % 2 === 0 ? 0xd8ff6a : 0xffe05a, -1);
        dc.fillRectangle(60 + i * 62 + Math.round(16 * Math.sin(tt / 900 + i)), 230 + ((i * 37) % 60) + Math.round(10 * Math.sin(tt / 700 + i * 2)), 4, 4);
      }
    }
    // ---- the hedgehog lives here after three good days in a row
    if (gs[3] >= 3) {
      const run = G.clamp(p / 0.8, 0, 1);
      const hx = Math.round(G.lerp(-40, 360, G.ease(run)));
      const step = run < 1 && Math.floor(a.t / 120) % 2 === 1;
      SPR.draw(dc, step ? SP.HEDGE_B : SP.HEDGE_A, hx, 339, 3, [-1, dk(P[23]), dk(P[24]), 0x1a1a1a], false);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const PL = gs === null ? [2, 1, 0, 1, 0, 0] : gs[0];
    dc.setColor(st === 3 ? 0x306230 : 0x2a4a2a, -1);
    for (let i = 0; i < 6; i++) if (PL[i] > 0) dc.fillRectangle(XS[i] - 2 + o[0], 330 - PL[i] * 14 + o[1], 4, PL[i] * 14);
    dc.setColor(st === 3 ? 0x306230 : 0x3a3a42, -1);
    dc.fillRectangle(40 + o[0], 330 + o[1], 374, 2);
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
  },
};
