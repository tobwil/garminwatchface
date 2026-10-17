// FARM — "Pixel-Hof": a day on a small farm, told by the real sun. At dawn the rooster crows on the
// fence post and the farmer steps out of the barn, during the day he waters the field, which grows
// with the steps (seed, sprout, plant, wheat), and at the step goal it is harvest time: golden wheat
// and the farmer cheering with a sheaf. In the evening he rests on the bench, at night the farm
// sleeps under the real stars and moon. The three data slots are chalked on the farm shop board.
// Styles: 1 Sommer, 2 Herbst, 3 Gameboy. Mirrors watch/source/faces/Farm.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/farm.js";

const SP = encodeAll(S);
const GY = 338; // ground line of the barn
const ROWS = [314, 330, 346, 362]; // crop rows (base lines)
const CAP = ["NACHTRUHE", "KIKERIKI!", "FELDARBEIT", "FEIERABEND", "ERNTEZEIT!"];

// scene: 0 night, 1 dawn, 2 field work, 3 evening, 4 harvest (step goal reached by day)
function scene(d) {
  const sr = d.sunrise > 0 ? Math.round(d.sunrise) : 390;
  const ss = d.sunset > 0 ? Math.round(d.sunset) : 1140;
  if (d.mins >= 1320 || d.mins < sr - 30) return 0;
  if (d.mins < sr + 60) return 1;
  if (d.mins < ss - 60) return d.steps >= d.stepGoal && d.stepGoal > 0 ? 4 : 2;
  return 3;
}

function growth(d) {
  return G.clamp(d.steps / (d.stepGoal > 0 ? d.stepGoal : 10000), 0, 1);
}

// [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, hill, grass, grass dark,
//  barn, barn dark, roof, trim, window, soil, soil dark, leaf, leaf dark, wheat, board, chalk, text, text dim,
//  shirt, skin, eye, overalls, boots, hat, can, hen, comb, beak, hen dark, rooster, star, moon, moon dark,
//  water, wood]
function pal(st, acc) {
  if (st === 2) return [0x6a8ab8, 0xf0d8b0, 0x5a4a8a, 0xff8a5a, 0x060a20, 0x161c40, 0x9a7a3a, 0x8a8a3a, 0x6a6a2a,
    0x9a3a24, 0x6a2418, 0x3a2a24, 0xf0e6d0, 0xffc85a, 0x6a4424, 0x4a2e18, 0xc89a3a, 0x9a6a2a, 0xe8b84a, 0x2a2a26,
    0xf4f0e6, 0xffffff, 0xfff0d8, acc, 0xf2c08a, 0x1a1a1a, 0x3a4a7a, 0x3a2a1a, 0xe8c070, 0x8a9aa8, 0xf4f0e6, 0xe03a2a,
    0xf0a830, 0x3a2a1a, 0xa85a2a, 0xffffff, 0xf4f0d8, 0x3a3a48, 0x6ab4ff, 0x8a6038];
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [c, e, b, c, a, a, b, c, b, b, a, a, e, e, b, a, a, a, e, a, e, a, b, e, e, a, a, a, e, b, e, a, a, a, b, e, e, b, e, a];
  }
  return [0x3a8ad8, 0xa8d8ff, 0x5a4a9a, 0xff9a6a, 0x060a20, 0x141c44, 0x5aa83a, 0x4a9a32, 0x3a7a28,
    0xc0392b, 0x8a2a1e, 0x4a3a34, 0xf4f0e6, 0xffc85a, 0x7a5030, 0x5a3a20, 0x5ac83a, 0x3a8a2a, 0xf0c840, 0x2a2a26,
    0xf4f0e6, 0xffffff, 0xe8f4e0, acc, 0xf2c08a, 0x1a1a1a, 0x3a5a9a, 0x3a2a1a, 0xf0d070, 0x8a9aa8, 0xf4f0e6, 0xe03a2a,
    0xf0a830, 0x3a2a1a, 0xa85a2a, 0xffffff, 0xf4f0d8, 0x3a3a48, 0x6ab4ff, 0x8a6038];
}

function moon(dc, P, cx, cy, r, k) {
  for (let y = -r; y < r; y += 4) {
    const yy = y + 2;
    const hw = Math.floor(Math.sqrt(r * r - yy * yy) / 4) * 4;
    if (hw <= 0) continue;
    dc.setColor(P[37], -1);
    dc.fillRectangle(cx - hw, cy + y, 2 * hw, 4);
    const x0 = k < 0.5 ? Math.round(hw * Math.cos(k * 2 * Math.PI) / 4) * 4 : -hw;
    const x1 = k < 0.5 ? hw : Math.round(hw * Math.cos((k - 0.5) * 2 * Math.PI) / 4) * 4;
    if (x1 > x0) {
      dc.setColor(P[36], -1);
      dc.fillRectangle(cx + x0, cy + y, x1 - x0, 4);
    }
  }
}

export default {
  fps: 8,

  // static layer: sky, hills, barn, board, field with its crops, fence, texts; farmer, chickens,
  // water drops and the Zzz move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P0 = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const sc = scene(d);
    const g = growth(d);
    const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const k = el > 6 ? 0 : el > -6 ? 1 : 2;
    // the farm darkens with the sun (window light, chalk, text, moon and stars keep their colours)
    const nf = st === 3 ? 0 : [0, 0.3, 0.65][k];
    const P = P0.map((c, i) => i >= 6 && i <= 39 && i !== 13 && i !== 20 && i !== 21 && i !== 22 && i < 35 || i >= 38 ? G.mix(c, 0x050814, i >= 23 && i <= 34 ? Math.min(nf, 0.35) : nf) : c);

    if (S) {
      // ---- sky with sun / moon / stars
      for (let i = 0; i < 6; i++) {
        dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 5), -1);
        dc.fillRectangle(0, i * 50, 454, 50);
      }
      if (k === 2) {
        dc.setColor(P[35], -1);
        for (let i = 0; i < 28; i++) dc.fillRectangle(30 + ((i * 101 + 17) % 394), 96 + ((i * 47 + 11) % 140), i % 6 === 0 ? 4 : 2, i % 6 === 0 ? 4 : 2);
      }
      if (el < 0) moon(dc, P, 372, 128, 20, d.moon >= 0 ? d.moon : 0.5);
      if (el > -4) {
        dc.setColor(0xfff6d0, -1);
        dc.fillCircle(330, 236 - Math.round(G.clamp(el, -4, 40) * 3.5), 14);
      }

      // ---- rolling hills, meadow
      dc.setColor(P[6], -1);
      for (let x = 0; x < 454; x += 4) {
        const h = 24 + Math.round(18 * Math.sin(x / 70) + 10 * Math.sin(x / 31 + 1));
        dc.fillRectangle(x, 300 - h, 4, h);
      }
      dc.setColor(P[7], -1);
      dc.fillRectangle(0, 300, 454, 154);
      dc.setColor(P[8], -1);
      for (let x = 0; x < 454; x += 14) dc.fillRectangle(x + ((x / 14) % 3) * 4, 372 + ((x * 13) % 60), 4, 2);

      // ---- barn: walls, roof, door with the white cross, hayloft and window
      dc.setColor(P[11], -1);
      dc.fillPolygon([[12, 200], [100, 146], [188, 200]]);
      dc.setColor(P[9], -1);
      dc.fillRectangle(24, 198, 152, GY - 198);
      dc.setColor(P[10], -1);
      for (let x = 32; x < 176; x += 16) dc.fillRectangle(x, 204, 2, GY - 204);
      dc.setColor(P[12], -1);
      dc.fillRectangle(24, 198, 152, 4);
      dc.fillRectangle(74, 240, 52, GY - 240);
      dc.setColor(P[10], -1);
      dc.fillRectangle(78, 244, 44, GY - 244);
      dc.setColor(P[12], -1);
      for (let i = 0; i < 22; i++) {
        dc.fillRectangle(78 + i * 2, 244 + Math.round(i * 4.2), 4, 4);
        dc.fillRectangle(118 - i * 2, 244 + Math.round(i * 4.2), 4, 4);
      }
      const lit = sc === 3 || (sc === 0 && d.mins >= 1320 && d.mins < 1380) || (sc === 1 && k > 0);
      dc.setColor(P[12], -1);
      dc.fillRectangle(86, 160, 28, 26);
      dc.fillRectangle(136, 214, 28, 26);
      dc.setColor(lit ? P[13] : P[10], -1);
      dc.fillRectangle(90, 164, 20, 18);
      dc.fillRectangle(140, 218, 20, 18);

      // ---- farm shop board with the data slots
      dc.setColor(P[39], -1);
      dc.fillRectangle(266, 252, 6, 54);
      dc.fillRectangle(394, 252, 6, 54);
      dc.setColor(P[19], -1);
      dc.fillRectangle(252, 190, 162, 76);
      dc.setColor(P[39], -1);
      dc.drawRectangle(252, 190, 162, 76);
      dc.drawRectangle(253, 191, 160, 74);
      dc.setColor(P[20], -1);
      F.px(dc, "HOFLADEN", 333, 196, 2, 1, 0);
      for (let i = 0; i < 3; i++) {
        const s = d.slots[i];
        if (!s.lbl || G.stag(p, i, 0.1, 0.4) <= 0) continue;
        let lb = s.lbl;
        while (lb.length > 2 && F.pxW(lb, 2) > 128 - F.pxW(s.val, 2)) lb = lb.substring(0, lb.length - 1);
        dc.setColor(G.mix(P[20], P[19], 0.3), -1);
        F.px(dc, lb, 262, 218 + i * 16, 2, 0, 0);
        dc.setColor(P[20], -1);
        F.px(dc, s.val, 406, 218 + i * 16, 2, 2, 0);
      }

      // ---- the field: furrows and crops by today's steps (seed, sprout, plant, wheat)
      const stg = Math.min(5, Math.floor(g * 5) + (g > 0 ? 1 : 0));
      for (let r = 0; r < ROWS.length; r++) {
        const by = ROWS[r];
        dc.setColor(P[14], -1);
        dc.fillRectangle(206, by - 6, 210 - r * 4, 8);
        dc.setColor(P[15], -1);
        dc.fillRectangle(206, by, 210 - r * 4, 2);
        for (let x = 214 + (r % 2) * 8; x < 406 - r * 4; x += 18) {
          if (stg === 1) {
            dc.setColor(P[17], -1);
            dc.fillRectangle(x, by - 4, 2, 2);
          } else if (stg >= 2 && stg <= 4) {
            const h = [0, 0, 6, 10, 16][stg];
            dc.setColor(P[17], -1);
            dc.fillRectangle(x, by - 4 - h, 2, h);
            dc.setColor(P[16], -1);
            dc.fillRectangle(x - 4, by - 4 - h + 2, 4, 2);
            if (stg >= 3) dc.fillRectangle(x + 2, by - 4 - h + 6, 4, 2);
            if (stg === 4) dc.fillRectangle(x - 4, by - 4 - h + 10, 4, 2);
          } else if (stg === 5) {
            dc.setColor(G.mix(P[18], P[17], 0.3), -1);
            dc.fillRectangle(x, by - 20, 2, 16);
            dc.setColor(P[18], -1);
            dc.fillRectangle(x - 2, by - 26, 6, 8);
          }
        }
      }

      // ---- fence post for the rooster, bench
      dc.setColor(P[39], -1);
      dc.fillRectangle(186, 326, 8, 46);
      dc.fillRectangle(176, 338, 30, 4);
      dc.fillRectangle(176, 354, 30, 4);
      dc.fillRectangle(130, 312, 46, 6);
      dc.fillRectangle(134, 318, 4, 20);
      dc.fillRectangle(168, 318, 4, 20);

      // ---- time, date, caption
      dc.setColor(0x000000, -1);
      F.px(dc, G.timeStr(d), 229, 34, 5, 1, 0);
      dc.setColor(P[21], -1);
      F.px(dc, G.timeStr(d), 227, 32, 5, 1, 0);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 76, 2, 1, 0);
      F.px(dc, CAP[sc], 227, 394, 2, 1, 0);
      const sr = d.sunrise > 0 ? d.sunrise : 390;
      const sub = sc === 0 ? "SONNE UM " + G.hm(sr) : G.num(Math.max(0, d.steps)) + " SCHRITTE";
      dc.setColor(P[22], -1);
      F.px(dc, sub, 227, 414, 2, 1, 0);
    }

    if (!M) return;
    const fp = [-1, P[23], P[24], P[25], P[26], P[27], P[28], P[29], P[18]];
    const hen = [-1, P[30], P[31], P[32], P[33]];
    const fr = live ? Math.floor(tt / 300) % 2 : 0;
    // chickens peck in the yard from dawn to evening
    if (sc >= 1 && sc !== 3) {
      SPR.draw(dc, fr === 0 ? SP.HEN_A : SP.HEN_B, 128, 352, 3, hen, false);
      SPR.draw(dc, fr === 1 ? SP.HEN_A : SP.HEN_B, 40, 360, 3, hen, true);
    }
    if (sc === 0) {
      // the farm sleeps: Zzz from the hayloft
      dc.setColor(P[21], -1);
      for (let i = 0; i < 3; i++) {
        if (!live && i > 0) break;
        const ph = (Math.floor(tt + i * 500) % 1500) / 1500;
        F.px(dc, "Z", 116 + Math.round(ph * 24) + i * 4, 150 - Math.round(ph * 60), ph > 0.5 ? 3 : 2, 1, 0);
      }
    } else if (sc === 1) {
      // the rooster crows on the post, the farmer steps out of the barn door
      const crow = p < 1 ? p > 0.2 && p < 0.8 : live && Math.floor(tt / 1500) % 3 === 0;
      SPR.draw(dc, crow ? SP.CROW : SP.HEN_A, 178, 305, 3, [-1, P[34], P[31], P[32], P[33]], false);
      if (crow) {
        dc.setColor(P[21], -1);
        F.px(dc, "KIKERIKI!", 214, 282, 2, 0, 0);
      }
      SPR.draw(dc, SP.STAND, 70, GY - 90 + (p < 1 ? Math.round((1 - G.ease(p)) * 6) : 0), 5, fp, false);
    } else if (sc === 2) {
      // waters the rows, walking up and down the field; on every raise he comes out of the barn
      const x = p < 1 ? Math.round(G.lerp(80, 220, G.easeInOut(p))) : 260 + Math.round(70 * Math.sin(tt / 2600));
      const right = p < 1 || Math.cos(tt / 2600) >= 0;
      const step = live && Math.floor(tt / 220) % 2 === 1;
      SPR.draw(dc, step ? SP.WALK_B : SP.WALK_A, x, 378 - 90, 5, fp, !right);
      if (p >= 1) {
        dc.setColor(P[38], -1);
        const sx = right ? x + 60 : x - 4;
        for (let i = 0; i < 3; i++) dc.fillRectangle(sx + ((i + fr) % 2) * 4, 348 + i * 8 + (Math.floor(tt / 120) % 3) * 2, 2, 4);
      }
    } else if (sc === 4) {
      // harvest: cheering with a sheaf of wheat
      const jump = live ? Math.abs(Math.round(Math.sin(tt / 260) * 10)) : 0;
      SPR.draw(dc, SP.CHEER, 222, 378 - 90 - jump, 5, fp, false);
      dc.setColor(P[18], -1);
      dc.fillRectangle(226, 266 - jump, 16, 24);
      dc.fillRectangle(222, 260 - jump, 24, 8);
      dc.setColor(G.mix(P[18], 0x6a4a1a, 0.4), -1);
      dc.fillRectangle(226, 276 - jump, 16, 3);
    } else {
      // evening on the bench in front of the barn
      SPR.draw(dc, SP.SIT, 120, GY - 80 + 6, 5, fp, false);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const c = st === 3 ? 0x306230 : 0x3a3a42;
    dc.setColor(c, -1);
    dc.drawRectangle(24 + o[0], 198 + o[1], 152, GY - 198);
    dc.fillPolygon([[12 + o[0], 200 + o[1]], [100 + o[0], 146 + o[1]], [188 + o[0], 200 + o[1]]]);
    dc.fillRectangle(o[0], 300 + o[1], 454, 2);
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 32 + o[1], 5, 1, 1);
  },
};
