// POST — "Postbote": the postman walks his round down a street of 24 houses. Today's steps decide
// which house he has reached (the house numbers on the doors count up), every wrist raise he walks
// up to the next letter box, drops a letter and the flag pops up; the notifications are the letters
// still in his bag. At the step goal the round is done and he waves goodbye. In the evening the
// windows and the street lamp light up and a cat strolls along the pavement; late at night most
// windows go dark. The three data slots are posted on the advertising column.
// The street lives with the year and the real weather (season.js): snow on the roofs and the pavement,
// rain and snowfall, fairy lights under the eaves and wreaths on the doors in Advent, eggs at Easter,
// pumpkins at Halloween, balloons on your birthday, fireworks on New Year's Eve.
// Styles: 1 Stadt, 2 Dorf, 3 Gameboy. Mirrors watch/source/faces/Post.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import { SPR, encodeAll } from "../engine/spr.js";
import { SE, EV } from "../engine/season.js";
import S from "../sprites/post.js";

const SP = encodeAll(S);
const HOUSES = 24;
const GY = 352; // pavement line where people stand
const HX = [-10, 110, 230]; // facades: left edge
const HW = [120, 120, 110];
const PX = 128; // where the postman stops: his hand reaches the middle house's letter box

// scene: 0 night, 1 on his round, 2 round done, 3 evening
function scene(d) {
  const ss = d.sunset > 0 ? Math.round(d.sunset) : 1140;
  if (d.mins < 360 || d.mins >= 1320) return 0;
  if (d.steps >= d.stepGoal && d.stepGoal > 0) return d.mins < ss ? 2 : 3;
  if (d.mins < ss) return 1;
  return 3;
}

// house the postman has reached (1..24)
function house(d) {
  const g = d.stepGoal > 0 ? d.stepGoal : 10000;
  return Math.min(HOUSES, 1 + Math.floor(Math.max(0, d.steps) / g * HOUSES));
}

// [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, wall a, wall b, wall c,
//  trim, glass, window lit, roof, door a, door b, door c, letter box, flag, pavement, pavement line, kerb, road,
//  text, text dim, column, column cap, poster, poster text, uniform, skin, eye, trousers, shoes, cap, bag, letter,
//  lamp post, lamp light, cat, star]
function pal(st, acc) {
  if (st === 2) return [0x4a90d8, 0xb8e0ff, 0x5a4a9a, 0xff9a6a, 0x060a20, 0x141c44, 0xf4ead4, 0xf0e2c4, 0xf6eedc,
    0x5a3a24, 0x2a3a4a, 0xffd27a, 0xb0402a, 0x6a3a1e, 0x2a5a3a, 0x7a2a24, 0xd8302a, 0xffd23a, 0xb8b0a0, 0x9a9282,
    0x8a8478, 0x4a4a4e, 0xffffff, 0xe0e0e8, 0x3a6a4a, 0x2a4a34, 0xf4f0e0, 0x2a2a2a, 0x2a4a8a, 0xf2c08a, 0x1a1a1a,
    0x1e2a4a, 0x141414, 0x1e2a4a, acc, 0xffffff, 0x2a2a30, 0xffe08a, 0x4a3a30, 0xffffff];
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [c, e, b, c, a, a, c, e, c, a, b, e, a, a, b, a, a, e, c, b, b, a, e, c, b, a, e, a, a, e, a, a, a, a, b, e, a, e, a, e];
  }
  return [0x3a8ad8, 0xa8d8ff, 0x5a4a9a, 0xff9a6a, 0x060a20, 0x141c44, 0xd88a5a, 0xe8d0a0, 0x8ab0c8,
    0xf4f0e6, 0x2a3a4a, 0xffd27a, 0x5a4a48, 0x4a2a1a, 0x2a4a7a, 0x8a2a2a, 0xd8302a, 0xffd23a, 0xa8a8b0, 0x8a8a92,
    0x7a7a82, 0x3a3a40, 0xffffff, 0xe0e0e8, 0x2a5a3a, 0x1e3a28, 0xf4f0e0, 0x2a2a2a, 0x2a4a8a, 0xf2c08a, 0x1a1a1a,
    0x1e2a4a, 0x141414, 0x1e2a4a, acc, 0xffffff, 0x2a2a30, 0xffe08a, 0x3a3a40, 0xffffff];
}

export default {
  fps: 8,

  // static layer: sky, facades with their numbers, delivered flags, column, lamp, pavement, texts;
  // the postman, the middle letter box flag, the cat and the lamp glow move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P0 = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const sc = scene(d);
    const hn = house(d);
    const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const k = el > 6 ? 0 : el > -6 ? 1 : 2;
    // the street darkens with the sun (lit windows, lamp, texts and the poster keep their colours)
    const nf = st === 3 ? 0 : [0, 0.3, 0.6][k];
    const P = P0.map((c, i) => i >= 6 && i <= 21 && i !== 11 || i === 24 || i === 25 || i === 36 || i === 38 ? G.mix(c, 0x050814, nf)
      : i >= 28 && i <= 35 ? G.mix(c, 0x050814, Math.min(nf, 0.3)) : c);
    const evening = sc === 0 || sc === 3;
    const lampOn = k > 0 || evening;
    // the year and the weather
    const ev = SE.event(d), sn = SE.snowy(d) && st !== 3;
    const xmas = ev === EV.ADVENT || ev === EV.XMAS;
    if (sn) {
      P[18] = G.mix(0xe8eef6, 0x050814, nf);
      P[19] = G.mix(0xc8d0dc, 0x050814, nf);
    }

    if (S) {
      // ---- sky and stars
      for (let i = 0; i < 4; i++) {
        dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 3), -1);
        dc.fillRectangle(0, i * 30, 454, 30);
      }
      if (k === 2) {
        dc.setColor(P[39], -1);
        for (let i = 0; i < 14; i++) dc.fillRectangle(70 + ((i * 101 + 17) % 314), 14 + ((i * 47 + 11) % 90), 2, 2);
      }

      // ---- three facades: roof, upper windows, door with the house number, letter box
      for (let h = 0; h < 3; h++) {
        const x = HX[h], w = HW[h];
        dc.setColor(P[12], -1);
        dc.fillRectangle(x, 96, w, 22);
        dc.setColor(G.mix(P[12], 0, 0.3), -1);
        dc.fillRectangle(x, 116, w, 4);
        if (sn) SE.snowCap(dc, x, 96, w);
        dc.setColor(P[6 + h], -1);
        dc.fillRectangle(x, 120, w, GY - 120);
        if (st === 2) {
          // half-timbering
          dc.setColor(P[9], -1);
          dc.fillRectangle(x, 206, w, 6);
          for (let bx = x + 4; bx < x + w; bx += 38) dc.fillRectangle(bx, 120, 6, 86);
          dc.fillRectangle(x, 120, w, 4);
        }
        // upper windows; at night only some stay lit
        for (let wi = 0; wi < 2; wi++) {
          const wx = x + 16 + wi * 54;
          const on = evening && (sc === 3 || G.rnd(h * 7 + wi * 3 + d.day) % 3 === 0);
          dc.setColor(P[9], -1);
          dc.fillRectangle(wx - 4, 140, 36, 52);
          dc.setColor(on ? P[11] : P[10], -1);
          dc.fillRectangle(wx, 144, 28, 44);
          dc.setColor(P[9], -1);
          dc.fillRectangle(wx + 12, 144, 4, 44);
          dc.fillRectangle(wx, 162, 28, 4);
        }
        // door and number plate
        dc.setColor(P[9], -1);
        dc.fillRectangle(x + 12, 238, 54, GY - 238);
        dc.setColor(P[13 + h], -1);
        dc.fillRectangle(x + 16, 242, 46, GY - 242);
        dc.setColor(G.mix(P[13 + h], 0xffffff, 0.25), -1);
        dc.fillRectangle(x + 22, 250, 34, 30);
        dc.fillRectangle(x + 22, 290, 34, 50);
        dc.setColor(P[9], -1);
        dc.fillRectangle(x + 52, 296, 4, 4);
        if (xmas) {
          // an Advent wreath on the door
          dc.setColor(0x1e7a3a, -1);
          dc.fillCircle(x + 39, 262, 11);
          dc.setColor(P[13 + h], -1);
          dc.fillCircle(x + 39, 262, 5);
          dc.setColor(0xd8302a, -1);
          dc.fillRectangle(x + 35, 270, 8, 5);
        } else if (ev === EV.HALLOWEEN) {
          SE.pumpkin(dc, x + 84, GY, 1);
        }
        const num = hn - 1 + h;
        if (num >= 1 && num <= HOUSES) {
          dc.setColor(0xf4f4f4, -1);
          dc.fillRectangle(x + 25, 218, 28, 16);
          dc.setColor(0x1a3a6a, -1);
          F.px(dc, "" + num, x + 39, 220, 2, 1, 0);
        }
        // letter box: houses passed have their flag up
        dc.setColor(P[16], -1);
        dc.fillRectangle(x + 72, 268, 24, 30);
        dc.setColor(G.mix(P[16], 0, 0.5), -1);
        dc.fillRectangle(x + 76, 274, 16, 3);
        if (h === 0 || (h === 1 && (evening || sc === 2))) {
          dc.setColor(P[17], -1);
          dc.fillRectangle(x + 96, 258, 4, 16);
          dc.fillRectangle(x + 96, 258, 10, 6);
        }
      }

      // ---- advertising column with the data slots
      dc.setColor(P[24], -1);
      dc.fillRectangle(344, 176, 92, GY - 176);
      dc.setColor(P[25], -1);
      dc.fillRectangle(338, 162, 104, 16);
      dc.fillRectangle(350, 150, 80, 12);
      dc.fillRectangle(338, GY - 10, 104, 10);
      dc.setColor(P[26], -1);
      dc.fillRectangle(352, 186, 76, 148);
      for (let i = 0; i < 3; i++) {
        const s = d.slots[i];
        if (!s.lbl || G.stag(p, i, 0.1, 0.4) <= 0) continue;
        let lb = s.lbl;
        while (lb.length > 2 && F.pxW(lb, 2) > 70) lb = lb.substring(0, lb.length - 1);
        dc.setColor(G.mix(P[27], P[26], 0.4), -1);
        F.px(dc, lb, 390, 194 + i * 48, 2, 1, 0);
        dc.setColor(P[27], -1);
        F.px(dc, s.val, 390, 212 + i * 48, 2, 1, 0);
      }

      // ---- street lamp, pavement, kerb, road
      dc.setColor(P[36], -1);
      dc.fillRectangle(226, 176, 6, GY - 176);
      dc.fillRectangle(214, 168, 30, 8);
      dc.setColor(lampOn ? P[37] : G.mix(P[36], 0xffffff, 0.3), -1);
      dc.fillRectangle(218, 176, 22, 8);
      dc.setColor(P[18], -1);
      dc.fillRectangle(0, GY, 454, 22);
      dc.setColor(P[19], -1);
      for (let x = 0; x < 454; x += 40) dc.fillRectangle(x, GY, 2, 22);
      dc.setColor(P[20], -1);
      dc.fillRectangle(0, GY + 22, 454, 6);
      dc.setColor(P[21], -1);
      dc.fillRectangle(0, GY + 28, 454, 454 - GY - 28);
      if (ev === EV.EASTER) SE.eggs(dc, 276, GY + 18);
      else if (ev === EV.VALENTINE) SE.heart(dc, 140, 168, 1);

      // ---- time, date, caption
      dc.setColor(0x000000, -1);
      F.px(dc, G.timeStr(d), 229, 26, 5, 1, 0);
      dc.setColor(st === 3 ? 0x0f380f : P[22], -1);
      F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
      F.px(dc, ev ? SE.greeting(ev) : d.dowStr + " " + d.day + ". " + d.monStr, 227, 68, 2, 1, 0);
      const cap = sc === 0 ? "NACHTRUHE" : sc === 1 ? "HAUS " + hn + " VON " + HOUSES : sc === 2 ? "RUNDE GESCHAFFT!" : "FEIERABEND";
      const nl = Math.max(0, d.notif);
      const sub = sc === 1 ? nl + (nl === 1 ? " BRIEF DABEI" : " BRIEFE DABEI") : G.num(Math.max(0, d.steps)) + " SCHRITTE";
      dc.setColor(P[22], -1);
      F.px(dc, cap, 227, 392, 2, 1, 0);
      dc.setColor(P[23], -1);
      F.px(dc, sub, 227, 412, 2, 1, 0);
    }

    if (!M) return;
    const pp = [-1, P[28], P[29], P[30], P[31], P[32], P[33], P[34], P[35]];
    // lamp light on the pavement
    if (lampOn) {
      dc.setColor(G.mix(P[18], P[37], live && Math.floor(tt / 1700) % 7 === 0 ? 0.2 : 0.35), -1);
      dc.fillRectangle(196, GY, 66, 6);
    }
    if (sc === 1) {
      // walks up to the letter box, posts a letter, the flag pops up
      const walk = G.clamp(p / 0.6, 0, 1);
      const x = p < 1 ? Math.round(G.lerp(-70, PX, G.ease(walk))) : PX;
      let spr = SP.STAND;
      if (p < 0.6) spr = Math.floor(a.t / 140) % 2 === 1 ? SP.WALK_B : SP.WALK_A;
      else if (p < 0.85) spr = SP.DELIVER;
      SPR.draw(dc, spr, x, GY - 90, 5, pp, false);
      if (p >= 0.8) {
        dc.setColor(P[17], -1);
        dc.fillRectangle(HX[1] + 96, 258, 4, 16);
        dc.fillRectangle(HX[1] + 96, 258, 10, 6);
      }
    } else if (sc === 2) {
      // round done: waves goodbye
      const wv = !live || Math.floor(tt / 400) % 2 === 0;
      SPR.draw(dc, wv ? SP.WAVE : SP.STAND, 250, GY - 90, 5, pp, false);
    } else {
      // a cat strolls along the pavement, sits down under the lamp
      const cx = p < 1 ? Math.round(G.lerp(470, 250, G.ease(p))) : 250;
      const cp = [-1, P[38], k > 0 ? 0x8aff6a : 0xffd23a];
      SPR.draw(dc, p < 1 && Math.floor(a.t / 160) % 2 === 1 ? SP.CAT_B : SP.CAT_A, cx, GY - 24, 4, cp, true);
    }
    // ---- the year and the weather: lights, balloons, fireworks, rain and snow
    if (xmas) SE.lights(dc, 0, 124, 340, 124, tt);
    else if (ev === EV.BIRTHDAY) SE.balloons(dc, HX[1] + 84, 268, tt);
    else if (ev === EV.NYE) SE.fireworks(dc, 40, 14, 370, 60, tt);
    SE.precip(dc, d, 0, 0, 454, 374, tt);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    dc.setColor(st === 3 ? 0x306230 : 0x3a3a42, -1);
    for (let h = 0; h < 3; h++) dc.drawRectangle(HX[h] + 16 + o[0], 242 + o[1], 46, GY - 242);
    dc.fillRectangle(o[0], GY + o[1], 454, 2);
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
    dc.setColor(st === 3 ? 0x306230 : 0x6a6a72, -1);
    F.px(dc, "HAUS " + house(d), 227 + o[0], 392 + o[1], 2, 1, 0);
  },
};
