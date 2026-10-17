// TRAIN — "Pixel-Zug": a steam train crossing the week. Every training day hooks on another loaded
// wagon (logs, coal, crates, barrels, hay, parcels, a passenger coach), the weekly day goal is the
// station. On every wrist raise the train rolls in and stops with a hiss of brake steam; at the goal
// it stands at the station platform. After dark it runs as the night train with its lamp lit, under
// the real sky. The three data slots are on the timetable board.
// Styles: 1 Dampf, 2 Nacht, 3 Gameboy. Mirrors watch/source/faces/Train.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/train.js";

const SP = encodeAll(S);
const RAIL = 328; // top of the rail
const LX = 268; // loco x when the train stands
const WW = 52; // wagon pitch

function goal(d) { return d.dayGoal > 0 ? d.dayGoal : 4; }
function wagons(d) { return G.clamp(d.trainDays > 0 ? d.trainDays : 0, 0, 7); }

// [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, hill far, hill near,
//  grass, gravel, sleeper, rail, text, text dim, loco, black, band, cab glass, buffer, spokes, lamp, wagon,
//  wagon dark, logs, coal, crate, barrel, hay, parcel, coach, station wall, station roof, platform, board,
//  board text, smoke, star, signal post]
function pal(st, acc) {
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [c, e, b, c, a, a, b, b, c, b, a, a, a, b, a, a, e, e, a, c, e, b, a, b, a, b, a, c, e, b, e, a, b, a, e, e, e, a];
  }
  return [0x3a8ad8, 0xa8d8ff, 0x5a4a9a, 0xff9a6a, 0x060a20, 0x141c44, 0x6a9a7a, 0x4a8a4a, 0x3a7a32, 0x8a8478,
    0x5a3a24, 0xc8c8d0, 0xffffff, 0xe8f0e0, 0x2a2a30, 0x141414, acc, 0xffe08a, 0xd8302a, 0xb0b0b8, 0xfff2a0, 0x8a3a24,
    0x5a2418, 0xa8743a, 0x2a2a2e, 0xd88a3a, 0x7a4a2a, 0xe8c858, 0xf4f0e6, 0x2a5a8a, 0xe8d8b8, 0x8a3a2a, 0xb8b0a0,
    0x1e2a4a, 0xffffff, 0xe8e8ee, 0xffffff, 0x3a3a40];
}

// one wagon with its cargo kind k at x (wheels on the rail)
function wagon(dc, P, x, k, wf) {
  const y = RAIL - 58;
  dc.setColor(P[22], -1);
  dc.fillRectangle(x, y + 22, 48, 14);
  dc.setColor(k === 6 ? P[29] : P[21], -1);
  dc.fillRectangle(x, y + (k === 6 ? 0 : 10), 48, k === 6 ? 32 : 22);
  dc.setColor(P[22], -1);
  dc.fillRectangle(x - 4, y + 30, 4, 4);
  if (k === 0) {
    dc.setColor(P[23], -1);
    for (let i = 0; i < 3; i++) dc.fillRectangle(x + 2, y - 2 + i * 6, 44, 5);
    dc.setColor(G.mix(P[23], 0xffffff, 0.3), -1);
    for (let i = 0; i < 3; i++) dc.fillRectangle(x + 2, y - 2 + i * 6, 4, 5);
  } else if (k === 1) {
    dc.setColor(P[24], -1);
    dc.fillRectangle(x + 4, y + 2, 40, 8);
    dc.fillRectangle(x + 12, y - 4, 24, 6);
  } else if (k === 2) {
    dc.setColor(P[25], -1);
    dc.fillRectangle(x + 4, y - 4, 18, 14);
    dc.fillRectangle(x + 26, y, 18, 10);
    dc.setColor(G.mix(P[25], 0, 0.35), -1);
    dc.fillRectangle(x + 4, y + 2, 18, 2);
  } else if (k === 3) {
    dc.setColor(P[26], -1);
    for (let i = 0; i < 3; i++) dc.fillRectangle(x + 4 + i * 14, y - 6, 12, 16);
    dc.setColor(G.mix(P[26], 0, 0.4), -1);
    for (let i = 0; i < 3; i++) dc.fillRectangle(x + 4 + i * 14, y, 12, 2);
  } else if (k === 4) {
    dc.setColor(P[27], -1);
    dc.fillRectangle(x + 2, y - 2, 44, 12);
    dc.fillRectangle(x + 8, y - 8, 32, 6);
  } else if (k === 5) {
    dc.setColor(P[28], -1);
    dc.fillRectangle(x + 4, y - 2, 16, 12);
    dc.fillRectangle(x + 24, y - 6, 20, 16);
    dc.setColor(P[16], -1);
    dc.fillRectangle(x + 11, y - 2, 2, 12);
    dc.fillRectangle(x + 33, y - 6, 2, 16);
  } else {
    dc.setColor(P[17], -1);
    for (let i = 0; i < 3; i++) dc.fillRectangle(x + 4 + i * 15, y + 6, 10, 10);
    dc.setColor(G.mix(P[29], 0, 0.4), -1);
    dc.fillRectangle(x - 2, y - 2, 52, 4);
  }
  const w = wf ? SP.WHEEL_B : SP.WHEEL_A;
  SPR.draw(dc, w, x + 2, RAIL - 24, 3, [-1, -1, P[15], -1, -1, -1, P[19]], false);
  SPR.draw(dc, w, x + 22, RAIL - 24, 3, [-1, -1, P[15], -1, -1, -1, P[19]], false);
}

export default {
  fps: 10,

  // static layer: sky, hills, track, station or signal, timetable board, texts; the train, its
  // smoke, the brake steam and the lamp beam move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const n = wagons(d);
    const gl = goal(d);
    const done = n >= gl;
    const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const k = st === 2 ? 2 : el > 6 ? 0 : el > -6 ? 1 : 2;
    const night = k === 2;

    if (S) {
      // ---- sky, sun / stars
      for (let i = 0; i < 6; i++) {
        dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 5), -1);
        dc.fillRectangle(0, i * 50, 454, 50);
      }
      if (night) {
        dc.setColor(P[36], -1);
        for (let i = 0; i < 26; i++) dc.fillRectangle(30 + ((i * 101 + 17) % 394), 96 + ((i * 47 + 11) % 130), i % 6 === 0 ? 4 : 2, i % 6 === 0 ? 4 : 2);
      } else if (el > -4) {
        dc.setColor(st === 3 ? 0x9bbc0f : 0xfff6d0, -1);
        dc.fillCircle(100, 230 - Math.round(G.clamp(el, -4, 40) * 3.5), 14);
      }

      // ---- hills, meadow
      const dim = night && st !== 3 ? 0.55 : 0;
      dc.setColor(G.mix(P[6], 0x050814, dim), -1);
      for (let x = 0; x < 454; x += 4) {
        const h = 50 + Math.round(26 * Math.sin(x / 60 + 2) + 14 * Math.sin(x / 23));
        dc.fillRectangle(x, 300 - h, 4, h);
      }
      dc.setColor(G.mix(P[7], 0x050814, dim), -1);
      for (let x = 0; x < 454; x += 4) {
        const h = 22 + Math.round(14 * Math.sin(x / 45) + 8 * Math.sin(x / 17 + 1));
        dc.fillRectangle(x, 304 - h, 4, h);
      }
      dc.setColor(G.mix(P[8], 0x050814, dim), -1);
      dc.fillRectangle(0, 300, 454, 154);

      // ---- station at the goal, a signal on the way
      if (done) {
        dc.setColor(G.mix(P[31], 0x050814, dim), -1);
        dc.fillRectangle(236, 168, 196, 16);
        dc.setColor(G.mix(P[30], 0x050814, dim), -1);
        dc.fillRectangle(246, 184, 176, 118);
        dc.setColor(night ? P[17] : G.mix(P[33], 0x050814, dim), -1);
        for (let i = 0; i < 4; i++) dc.fillRectangle(258 + i * 42, 228, 26, 34);
        dc.setColor(P[33], -1);
        dc.fillRectangle(282, 190, 104, 22);
        dc.setColor(P[34], -1);
        F.px(dc, "BAHNHOF", 334, 194, 2, 1, 0);
        dc.setColor(G.mix(P[32], 0x050814, dim), -1);
        dc.fillRectangle(200, 302, 254, 14);
      } else {
        dc.setColor(P[37], -1);
        dc.fillRectangle(414, 218, 6, RAIL - 218);
        dc.fillRectangle(406, 206, 22, 30);
        dc.setColor(0x3aff6a, -1);
        dc.fillRectangle(412, 212, 10, 8);
        dc.setColor(0x3a1010, -1);
        dc.fillRectangle(412, 224, 10, 8);
      }

      // ---- track on its gravel bed
      dc.setColor(G.mix(P[9], 0x050814, dim), -1);
      dc.fillRectangle(0, RAIL + 2, 454, 22);
      dc.setColor(G.mix(P[10], 0x050814, dim), -1);
      for (let x = 0; x < 454; x += 18) dc.fillRectangle(x, RAIL + 4, 10, 6);
      dc.setColor(P[11], -1);
      dc.fillRectangle(0, RAIL, 454, 4);

      // ---- timetable board with the data slots
      dc.setColor(P[37], -1);
      dc.fillRectangle(150, 168, 6, 22);
      dc.fillRectangle(298, 168, 6, 22);
      dc.setColor(P[33], -1);
      dc.fillRectangle(130, 96, 194, 74);
      dc.setColor(P[34], -1);
      F.px(dc, "FAHRPLAN", 227, 100, 1, 1, 0);
      for (let i = 0; i < 3; i++) {
        const s = d.slots[i];
        if (!s.lbl || G.stag(p, i, 0.1, 0.4) <= 0) continue;
        let lb = s.lbl;
        while (lb.length > 2 && F.pxW(lb, 2) > 172 - F.pxW(s.val, 2)) lb = lb.substring(0, lb.length - 1);
        dc.setColor(G.mix(P[34], P[33], 0.35), -1);
        F.px(dc, lb, 140, 114 + i * 18, 2, 0, 0);
        dc.setColor(P[16], -1);
        F.px(dc, s.val, 314, 114 + i * 18, 2, 2, 0);
      }

      // ---- time, date, caption
      dc.setColor(0x000000, -1);
      F.px(dc, G.timeStr(d), 229, 26, 5, 1, 0);
      dc.setColor(st === 3 ? 0x0f380f : P[12], -1);
      F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 68, 2, 1, 0);
      const cap = (night && d.mins >= 1260) || d.mins < 300 ? "NACHTZUG" : done ? "ANKUNFT!" : n === 0 ? "LEERFAHRT" : "UNTERWEGS";
      dc.setColor(P[12], -1);
      F.px(dc, cap, 227, 374, 2, 1, 0);
      dc.setColor(P[13], -1);
      F.px(dc, done ? n + " WAGGONS GELADEN" : n + " VON " + gl + " WAGGONS", 227, 394, 2, 1, 0);
    }

    if (!M) return;
    // ---- the train rolls in on every raise and stops
    const run = p < 1 ? G.ease(G.clamp(p / 0.85, 0, 1)) : 1;
    const off = Math.round((1 - run) * -520);
    const moving = run < 1;
    const wf = moving && Math.floor(a.t / 70) % 2 === 1;
    const lx = LX + off;
    // lamp beam at night
    if (night) {
      dc.setColor(G.mix(P[8], P[20], 0.5), -1);
      for (let i = 0; i < 4; i++) dc.fillRectangle(lx + 112 + i * 18, RAIL - 46 - i * 2, 18, 8 + i * 4);
    }
    for (let i = 0; i < n; i++) {
      const x = lx - WW * (i + 1);
      if (x + 48 < 0 || x > 454) continue;
      wagon(dc, P, x, i, wf);
    }
    SPR.draw(dc, SP.LOCO, lx, RAIL - 76, 4, [-1, P[14], P[15], P[16], P[17], P[18], -1, P[20]], false);
    const w = wf ? SP.WHEEL_B : SP.WHEEL_A;
    const wp = [-1, -1, P[15], -1, -1, -1, P[19]];
    SPR.draw(dc, w, lx + 4, RAIL - 32, 4, wp, false);
    SPR.draw(dc, w, lx + 40, RAIL - 32, 4, wp, false);
    SPR.draw(dc, w, lx + 72, RAIL - 32, 4, wp, false);
    // smoke puffs from the chimney
    dc.setColor(G.mix(P[35], P[1], night ? 0.6 : 0.2), -1);
    for (let i = 0; i < 4; i++) {
      const ph = (Math.floor(tt + i * 300) % 1200) / 1200;
      const r = 6 + Math.round(ph * 8);
      dc.fillRectangle(lx + 84 - Math.round(ph * (moving ? 80 : 20)) - r, RAIL - 84 - Math.round(ph * 70) - r, r * 2, r * 2);
    }
    // brake steam when it stops
    if (p > 0.7 && p < 1) {
      dc.setColor(P[35], -1);
      const s = (p - 0.7) / 0.3;
      for (let i = 0; i < 4; i++) dc.fillRectangle(lx + 8 + i * 24 - Math.round(s * 10), RAIL - 14 - Math.round(s * 12), 14, 10);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const c = st === 3 ? 0x306230 : 0x3a3a42;
    SPR.draw(dc, SP.LOCO, LX + o[0], RAIL - 76 + o[1], 4, [-1, c, c, -1, -1, -1, -1, G.dim(0xfff2a0, 0.5)], false);
    dc.setColor(c, -1);
    dc.fillRectangle(o[0], RAIL + o[1], 454, 2);
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
  },
};
