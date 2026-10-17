// CAMP — "Lagerfeuer": a day at a camp in the wild, told by the real sun. At night the camper sleeps
// in the tent under the real stars and moon, at sunrise he stands at the fire with a coffee, during
// the day the camp is empty (he is out on a hike and back an hour before sunset), and in the evening
// he sits on the log roasting a marshmallow over the campfire, which burns as high as the Body
// Battery. The three data slots are written on the trail sign. Every wrist raise plays a short
// episode: a sleepy Zzz, crawling out to the fire, setting off on the hike, a log on the fire.
// Styles: 1 Wald, 2 Strand, 3 Winter. Mirrors watch/source/faces/Camp.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/camp.js";

const SP = encodeAll(S);
const GY = 338; // ground line of tent, fire and camper
const FX = 262; // centre of the fire
const TREES = [20, 70, 52, 96, 86, 58, 120, 84, 150, 64, 300, 70, 334, 100, 368, 62, 400, 88, 436, 66];
const CAP = ["SCHLAFENSZEIT", "MORGENKAFFEE", "AUF TOUR", "LAGERFEUER"];

// scene: 0 asleep, 1 morning coffee, 2 out hiking, 3 campfire
function scene(d) {
  const sr = d.sunrise > 0 ? Math.round(d.sunrise) : 390;
  const ss = d.sunset > 0 ? Math.round(d.sunset) : 1140;
  if (d.mins < sr - 30) return 0;
  if (d.mins < sr + 150) return 1;
  if (d.mins < ss - 60) return 2;
  return 3;
}

// [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, ground, ground dark,
//  tree, tree top, sea, text, text dim, tent, tent dark, tent door, log, log dark, stone, jacket, skin, beanie,
//  trousers, boots, eye, cup, backpack, flame red, flame orange, flame yellow, sign, sign dark, star, moon, moon dark]
function pal(st, acc) {
  const base = [0x3a8ad8, 0xa8d8ff, 0x5a4a9a, 0xff9a6a, 0x060a20, 0x141c44];
  if (st === 2) return base.concat([0xe8d098, 0xc8a870, 0x1e3a2a, 0x2a4a34, 0x2a7ac8, 0xffffff, 0xfff0d8, acc, G.mix(acc, 0, 0.4),
    0x1a1410, 0x8a5a34, 0x5a3a20, 0x9a9a9a, 0x2a8ac8, 0xf2c08a, 0xff5a3a, 0x3a4a6a, 0x5a3a2a, 0x1a1a1a, 0xffffff, 0x6a7a3a,
    0xd8302a, 0xff8a2a, 0xffe05a, 0xa87a4a, 0x6a4a2a, 0xffffff, 0xf4f0d8, 0x3a3a48]);
  if (st === 3) return [0x4a7ac0, 0xc8e0f4, 0x5a5a9a, 0xffb08a, 0x060a20, 0x18204a, 0xf0f4fa, 0xc8d4e8, 0x1e3a3a, 0xffffff,
    0x2a5a8a, 0xffffff, 0x2a3a5a, acc, G.mix(acc, 0, 0.4), 0x1a1410, 0x7a5030, 0x4a3018, 0x8a8a96, 0xc83a3a, 0xf2c08a,
    0xffffff, 0x2a3a5a, 0x3a2a1a, 0x1a1a1a, 0xffffff, 0x3a5a8a, 0xd8302a, 0xff8a2a, 0xffe05a, 0x9a6a3a, 0x5a3a1a, 0xffffff,
    0xf4f0d8, 0x3a3a48];
  return base.concat([0x3a6a2a, 0x2a5222, 0x163a22, 0x1e4a2a, 0x2a5a8a, 0xffffff, 0xd8ecd0, acc, G.mix(acc, 0, 0.4),
    0x1a1410, 0x8a5a34, 0x5a3a20, 0x8a8a8a, 0x3a7a3a, 0xf2c08a, 0xd83a2a, 0x3a4a6a, 0x4a3020, 0x1a1a1a, 0xffffff, 0x8a5a2a,
    0xd8302a, 0xff8a2a, 0xffe05a, 0xa87a4a, 0x6a4a2a, 0xffffff, 0xf4f0d8, 0x3a3a48]);
}

// pixel disc of the moon (4 px rows) with the lit part for phase k (0 new, .5 full)
function moon(dc, P, cx, cy, r, k) {
  for (let y = -r; y < r; y += 4) {
    const yy = y + 2;
    const hw = Math.floor(Math.sqrt(r * r - yy * yy) / 4) * 4;
    if (hw <= 0) continue;
    dc.setColor(P[34], -1);
    dc.fillRectangle(cx - hw, cy + y, 2 * hw, 4);
    const x0 = k < 0.5 ? Math.round(hw * Math.cos(k * 2 * Math.PI) / 4) * 4 : -hw;
    const x1 = k < 0.5 ? hw : Math.round(hw * Math.cos((k - 0.5) * 2 * Math.PI) / 4) * 4;
    if (x1 > x0) {
      dc.setColor(P[33], -1);
      dc.fillRectangle(cx + x0, cy + y, x1 - x0, 4);
    }
  }
}

// flames: seven 8 px columns, h = height, f = flicker seed
function fire(dc, P, h, f) {
  const prof = [0.35, 0.6, 0.85, 1, 0.8, 0.55, 0.3];
  for (let i = 0; i < 7; i++) {
    const hh = Math.round(h * prof[i] * (0.8 + ((G.rnd(f * 7 + i) % 5) / 10)));
    const x = FX - 28 + i * 8;
    dc.setColor(P[27], -1);
    dc.fillRectangle(x, GY - 10 - hh, 8, hh);
    dc.setColor(P[28], -1);
    dc.fillRectangle(x + 2, GY - 10 - Math.round(hh * 0.7), 4, Math.round(hh * 0.7));
    if (i > 1 && i < 5) {
      dc.setColor(P[29], -1);
      dc.fillRectangle(x + 2, GY - 10 - Math.round(hh * 0.35), 4, Math.round(hh * 0.35));
    }
  }
}

export default {
  fps: 8,

  // static layer: sky, moon, landscape, tent, fire place, log, sign, texts; camper, flames, sparks,
  // steam, smoke and the Zzz move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P0 = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const sc = scene(d);
    const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const k = el > 6 ? 0 : el > -6 ? 1 : 2;
    // the landscape darkens with the sun (the camper only a little: he is in the firelight; fire,
    // sign, text and the moon keep their colours)
    const nf = [0, 0.35, 0.7][k];
    const P = P0.map((c, i) => (i >= 6 && i <= 10) || (i >= 13 && i <= 18 && i !== 15) ? G.mix(c, 0x050814, nf) : i >= 19 && i <= 26 ? G.mix(c, 0x050814, Math.min(nf, 0.3)) : c);
    P[15] = sc === 0 || sc === 3 ? 0xffc85a : P[14]; // lantern in the tent
    const bb = d.bb >= 0 ? d.bb : 50;
    const fh = sc === 3 ? 16 + Math.round(bb * 0.7) : sc === 1 ? 16 : 0;

    if (S) {
      // ---- sky, sun / moon and stars
      for (let i = 0; i < 6; i++) {
        dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 5), -1);
        dc.fillRectangle(0, i * 50, 454, 50);
      }
      if (k === 2) {
        dc.setColor(P[32], -1);
        for (let i = 0; i < 30; i++) dc.fillRectangle(30 + ((i * 101 + 17) % 394), 100 + ((i * 47 + 11) % 150), i % 5 === 0 ? 4 : 2, i % 5 === 0 ? 4 : 2);
      }
      if (el < 0) moon(dc, P, 340, 120, 20, d.moon >= 0 ? d.moon : 0.5);
      if (el > -4) {
        const sy = 250 - Math.round(G.clamp(el, -4, 40) * 4);
        dc.setColor(0xfff6d0, -1);
        dc.fillCircle(110, sy, 14);
      }

      // ---- background: sea (beach) or a line of pines (snowy in winter)
      if (st === 2) {
        dc.setColor(P[10], -1);
        dc.fillRectangle(0, 262, 454, 40);
        dc.setColor(G.mix(P[10], 0xffffff, 0.3), -1);
        for (let x = 10; x < 454; x += 46) dc.fillRectangle(x, 270 + (x % 3) * 8, 18, 2);
      } else {
        for (let i = 0; i < TREES.length; i += 2) {
          const tx = TREES[i], th = TREES[i + 1], ty = 300 - th;
          dc.setColor(P[8], -1);
          for (let y = 0; y < th; y += 6) {
            const w = 4 + Math.floor(y * 0.55 / 2) * 2 + (y % 12 === 6 ? 4 : 0);
            dc.fillRectangle(tx - w / 2, ty + y, w, 6);
          }
          if (st === 3) {
            dc.setColor(P[9], -1);
            dc.fillRectangle(tx - 2, ty, 4, 6);
            dc.fillRectangle(tx - 6, ty + 18, 12, 4);
          }
        }
      }
      dc.setColor(P[6], -1);
      dc.fillRectangle(0, 300, 454, 154);
      dc.setColor(P[7], -1);
      for (let x = 0; x < 454; x += 14) dc.fillRectangle(x + ((x / 14) % 3) * 4, 306 + ((x * 13) % 60), 4, 2);
      // firelight on the ground
      if (fh > 0 && k > 0) {
        dc.setColor(G.mix(P[6], P[28], 0.3), -1);
        dc.fillRectangle(FX - 70, GY - 4, 140, 14);
        dc.fillRectangle(FX - 44, GY + 10, 88, 6);
      }

      // ---- tent, fire place, log seat
      SPR.draw(dc, SP.TENT, 24, GY - 65, 5, [-1, P[13], P[14], P[15], P[17]], false);
      dc.setColor(P[18], -1);
      for (let i = 0; i < 5; i++) dc.fillRectangle(FX - 40 + i * 18, GY - 6, 12, 8);
      dc.setColor(P[16], -1);
      dc.fillRectangle(FX - 30, GY - 12, 60, 8);
      dc.setColor(P[17], -1);
      dc.fillRectangle(FX - 22, GY - 16, 44, 6);
      dc.setColor(P[16], -1);
      dc.fillRectangle(162, 318, 42, 20);
      dc.setColor(P[17], -1);
      dc.fillRectangle(162, 318, 6, 20);
      if (sc === 1) {
        // coffee pot over the morning fire
        dc.setColor(P[18], -1);
        dc.fillRectangle(FX - 12, GY - 50, 24, 22);
        dc.fillRectangle(FX + 12, GY - 46, 6, 4);
        dc.fillRectangle(FX - 6, GY - 56, 12, 6);
      }

      // ---- trail sign with the data slots
      dc.setColor(P[31], -1);
      dc.fillRectangle(388, 186, 6, GY - 186);
      for (let i = 0; i < 3; i++) {
        const s = d.slots[i];
        const y = 196 + i * 30;
        dc.setColor(P[30], -1);
        dc.fillRectangle(318, y, 112, 22);
        dc.fillRectangle(430, y + 4, 4, 14);
        dc.fillRectangle(434, y + 8, 4, 6);
        if (!s.lbl || G.stag(p, i, 0.1, 0.4) <= 0) continue;
        let lb = s.lbl;
        while (lb.length > 2 && F.pxW(lb, 2) > 98 - F.pxW(s.val, 2)) lb = lb.substring(0, lb.length - 1);
        dc.setColor(P[31], -1);
        F.px(dc, lb, 324, y + 4, 2, 0, 0);
        F.px(dc, s.val, 426, y + 4, 2, 2, 0);
      }

      // ---- time, date, story caption
      dc.setColor(0x000000, -1);
      F.px(dc, G.timeStr(d), 229, 34, 5, 1, 0);
      dc.setColor(P[11], -1);
      F.px(dc, G.timeStr(d), 227, 32, 5, 1, 0);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 76, 2, 1, 0);
      // dark captions on sand and snow by day
      const dark = st >= 2 && k < 2;
      dc.setColor(dark ? 0x1a2a4a : P[11], -1);
      F.px(dc, CAP[sc], 227, 370, 2, 1, 0);
      const sr = d.sunrise > 0 ? d.sunrise : 390, ss = d.sunset > 0 ? d.sunset : 1140;
      const sub = sc === 0 ? "SONNE UM " + G.hm(sr) : sc === 1 ? "GUTEN MORGEN" : sc === 2 ? "ZURÜCK UM " + G.hm(ss - 60) : "FEUER " + bb + "%";
      dc.setColor(dark ? 0x4a5a7a : P[12], -1);
      F.px(dc, sub, 227, 392, 2, 1, 0);
    }

    if (!M) return;
    const cp = [-1, P[19], P[20], P[21], P[22], P[23], P[24], P[25], P[26]];
    const fl = live ? Math.floor(tt / 120) : 3;
    if (sc === 0) {
      // embers and a sleepy Zzz from the tent
      dc.setColor(fl % 3 === 0 ? P[28] : P[27], -1);
      dc.fillRectangle(FX - 14, GY - 20, 8, 4);
      dc.fillRectangle(FX + 4, GY - 22, 8, 4);
      dc.setColor(P[11], -1);
      for (let i = 0; i < 3; i++) {
        if (!live && i > 0) break;
        const ph = (Math.floor(tt + i * 500) % 1500) / 1500;
        F.px(dc, "Z", 96 + Math.round(ph * 24) + i * 4, 250 - Math.round(ph * 70), ph > 0.5 ? 3 : 2, 1, 0);
      }
    } else if (sc === 1) {
      fire(dc, P, fh, fl);
      // steam from the pot, and he crawls out of the tent to the fire on every raise
      dc.setColor(G.mix(P[1], 0xffffff, 0.5), -1);
      for (let i = 0; i < 3; i++) dc.fillRectangle(FX - 4 + ((i + fl) % 2) * 6, GY - 66 - i * 10 - (fl % 3) * 2, 4, 4);
      const x = p < 1 ? Math.round(G.lerp(90, 190, G.ease(G.clamp((p - 0.2) / 0.8, 0, 1)))) : 190;
      SPR.draw(dc, p < 1 && p > 0.2 && Math.floor(a.t / 150) % 2 === 1 ? SP.WALK_B : SP.STAND, x, GY - 90, 5, cp, false);
    } else if (sc === 2) {
      // a wisp of smoke from the cold fire place; on every raise he sets off on his hike
      dc.setColor(G.mix(P[1], 0x8a8a8a, 0.4), -1);
      for (let i = 0; i < 4; i++) dc.fillRectangle(FX - 2 + Math.round(4 * Math.sin(tt / 400 + i)), GY - 30 - i * 14 - (fl % 2) * 2, 6, 6);
      if (p < 1) {
        const x = Math.round(G.lerp(180, 470, G.easeInOut(p)));
        SPR.draw(dc, Math.floor(a.t / 150) % 2 === 1 ? SP.WALK_B : SP.WALK_A, x, GY - 90, 5, cp, false);
      }
    } else {
      // the campfire: a fresh log flares it up on every raise, sparks rise
      const flare = p < 1 ? Math.round((1 - p) * 40) : 0;
      fire(dc, P, fh + flare, fl);
      dc.setColor(P[29], -1);
      for (let i = 0; i < 6; i++) {
        const ph = (Math.floor(tt + i * 330) % 2000) / 2000;
        dc.fillRectangle(FX - 20 + ((i * 17) % 40) + Math.round(6 * Math.sin(ph * 9 + i)), GY - 20 - fh - Math.round(ph * 110), 4, 4);
      }
      const up = live && Math.floor(tt / 900) % 2 === 1;
      SPR.draw(dc, up ? SP.SIT_B : SP.SIT_A, 160, GY - 80, 5, cp, false);
      // marshmallow stick into the flames
      const hx = up ? 212 : 207, hy = up ? 280 : 290;
      dc.setColor(P[17], -1);
      for (let i = 0; i < 6; i++) dc.fillRectangle(hx + i * 6, hy + i * 2, 6, 3);
      dc.setColor(P[25], -1);
      dc.fillRectangle(hx + 34, hy + 8, 8, 8);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    SPR.draw(dc, SP.TENT, 24 + o[0], GY - 65 + o[1], 5, [-1, 0x2a2a30, 0x1a1a20, 0x3a2a10, 0x2a2a30], false);
    dc.setColor(G.dim(0xff8a2a, 0.45), -1);
    dc.fillRectangle(FX - 14 + o[0], GY - 20 + o[1], 8, 4);
    dc.fillRectangle(FX + 4 + o[0], GY - 22 + o[1], 8, 4);
    dc.setColor(0x3a3a42, -1);
    dc.fillRectangle(o[0], 300 + o[1], 454, 2);
    dc.setColor(st === 3 ? 0x9aa6b8 : 0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 32 + o[1], 5, 1, 1);
  },
};
