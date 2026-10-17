// OFFICE — "Büro": a working day in a pixel office, told by the real clock. Morning coffee at the
// machine, focused typing until lunch ("BIN ESSEN" on the screen), a video call after lunch, the
// final sprint, closing time at five, an empty dark office in the evening and the cleaning crew
// late at night; at weekends the office stays empty. The paper stack grows with the stress level,
// empty coffee cups pile up as the Body Battery drains, the three data slots are written on the
// whiteboard. Every wrist raise plays a short episode of the current scene.
// Styles: 1 Großraum, 2 Homeoffice, 3 Gameboy. Mirrors watch/source/faces/Office.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/office.js";

const SP = encodeAll(S);
const FLOOR = 355;
// scenes: 0 night, 1 coffee, 2 focus, 3 lunch, 4 meeting, 5 sprint, 6 leaving, 7 evening, 8 cleaning, 9 weekend
const CAP = ["NACHTRUHE", "ERSTER KAFFEE", "KONZENTRIERT", "MITTAGSPAUSE", "VIDEOCALL", "ENDSPURT", "FEIERABEND!", "FEIERABEND", "PUTZKOLONNE", "WOCHENENDE"];

function scene(d) {
  if (d.dow === 0 || d.dow === 6) return 9;
  const m = d.mins;
  if (m < 450) return 0;
  if (m < 540) return 1;
  if (m < 720) return 2;
  if (m < 780) return 3;
  if (m < 900) return 4;
  if (m < 1020) return 5;
  if (m < 1080) return 6;
  if (m < 1320) return 7;
  return 8;
}

// [wall, floor, baseboard, desk, desk dark, bezel, screen, chair, shirt, tie, hair, skin, trousers, dark,
//  board, board frame, ink, marker0, marker1, marker2, panel, led, caption, cleaner, leaf, leaf dark, pot, cup]
function pal(st, acc) {
  if (st === 2) return [0x3a5a4a, 0x8a6040, 0x2a3a30, 0xd8b080, 0x9a7048, 0x2a2a30, 0x1e2a3a, 0x5a3a2a, 0x8a3a6a, 0x8a3a6a, 0x2a1a10, 0xe8b080,
    0x3a4a6a, 0x1a1a1a, 0xf4f0e6, 0x9a8a70, 0x2a2a3a, 0x2a5ad8, 0xd83a2e, 0x2a9a48, 0x101010, acc, 0xf0e6d0, 0x3a6ab8, 0x4ab84a, 0x2a7a3a, 0xc86a3a, 0xf0f0f0];
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [c, b, a, b, a, a, a, a, e, a, a, e, a, a, e, a, a, a, a, a, a, e, e, b, b, a, a, e];
  }
  return [0xd9d4c7, 0x6b7a8a, 0x4a5560, 0xb07a4a, 0x7a5030, 0x2a2a30, 0x1e3a5a, 0x3a3a48, 0xffffff, acc, 0x4a3020, 0xf2c08a,
    0x3a3a50, 0x1a1a1a, 0xf8f8f8, 0xa0a0a8, 0x2a2a3a, 0x2a5ad8, 0xd83a2e, 0x2a9a48, 0x101010, 0xff3a2a, 0xe8eef4, 0x3a6ab8, 0x4ab84a, 0x2a7a3a, 0xc86a3a, 0xffffff];
}

function person(P, cleaner) {
  return [-1, P[11], P[10], cleaner ? P[23] : P[8], cleaner ? P[23] : P[12], P[13], cleaner ? P[23] : P[9], P[7]];
}

export default {
  fps: 10,

  // static layer: room, window, clock, whiteboard, furniture; screen, steam and people move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P0 = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const sc = scene(d);
    const lit = sc >= 1 && sc <= 6 || sc === 8;
    // lights off: dim the room (Gameboy keeps its four shades)
    const P = [];
    for (let i = 0; i < P0.length; i++) P.push(lit || st === 3 || i >= 20 ? P0[i] : G.mix(P0[i], 0x080a14, 0.55));

    if (S) {
      // ---- room
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 0, 454, FLOOR);
      dc.setColor(P[1], -1);
      dc.fillRectangle(0, FLOOR, 454, 454 - FLOOR);
      dc.setColor(P[2], -1);
      dc.fillRectangle(0, FLOOR - 6, 454, 6);

      // ---- window with the real sky
      const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
      const sky = st === 3 ? (el > 6 ? 0x9bbc0f : el > -4 ? 0x8bac0f : 0x306230) : el > 6 ? 0x7ac0ff : el > -4 ? 0xffa070 : 0x101838;
      dc.setColor(P[15], -1);
      dc.fillRectangle(60, 102, 140, 126);
      dc.setColor(sky, -1);
      dc.fillRectangle(66, 108, 128, 114);
      if (el > -4) {
        dc.setColor(st === 3 ? 0x9bbc0f : 0xfff2a0, -1);
        const sy = 196 - Math.round(G.clamp(el, -4, 40) * 2);
        dc.fillRectangle(160, sy, 12, 12);
      } else {
        dc.setColor(st === 3 ? 0x8bac0f : 0xe8e8ff, -1);
        for (let i = 0; i < 6; i++) dc.fillRectangle(74 + ((i * 37) % 110), 114 + ((i * 23) % 40), 2, 2);
      }
      // skyline
      const sl = st === 3 ? 0x0f380f : el > 6 ? 0x5a7a9a : 0x1a2038;
      const BLD = [66, 170, 22, 52, 90, 150, 26, 72, 118, 182, 18, 40, 138, 160, 30, 62, 170, 176, 24, 46];
      for (let i = 0; i < BLD.length; i += 4) {
        dc.setColor(sl, -1);
        dc.fillRectangle(BLD[i], BLD[i + 1], BLD[i + 2], 222 - BLD[i + 1]);
        if (el <= 6) {
          dc.setColor(st === 3 ? 0x9bbc0f : 0xffd870, -1);
          for (let k = 0; k < 4; k++) {
            if (G.rnd(i * 13 + k * 7 + d.day) % 3 === 0) dc.fillRectangle(BLD[i] + 4 + (k % 2) * 10, BLD[i + 1] + 6 + Math.floor(k / 2) * 14, 4, 6);
          }
        }
      }
      dc.setColor(P[15], -1);
      dc.fillRectangle(128, 108, 4, 114);
      dc.fillRectangle(66, 162, 128, 4);

      // ---- LED wall clock
      dc.setColor(P[20], -1);
      dc.fillRectangle(134, 24, 186, 64);
      dc.setColor(P[2], -1);
      dc.drawRectangle(134, 24, 186, 64);
      dc.setColor(P[21], -1);
      F.px(dc, G.timeStr(d), 227, 35, 6, 1, 1);

      // ---- whiteboard with the data slots
      dc.setColor(P[15], -1);
      dc.fillRectangle(236, 102, 156, 100);
      dc.setColor(P[14], -1);
      dc.fillRectangle(240, 106, 148, 92);
      for (let k = 0; k < 3; k++) {
        const s = d.slots[k];
        if (!s.lbl) continue;
        const sp = G.stag(p, k, 0.1, 0.4);
        if (sp <= 0) continue;
        // shorten the label until it fits next to the value
        let lb = s.lbl;
        while (lb.length > 2 && F.pxW(lb, 2) > 124 - F.pxW(s.val, 2)) lb = lb.substring(0, lb.length - 1);
        dc.setColor(P[17 + k], -1);
        F.px(dc, lb, 248, 116 + k * 26, 2, 0, 0);
        dc.setColor(P[16], -1);
        F.px(dc, s.val, 380, 116 + k * 26, 2, 2, 0);
      }
      dc.setColor(P[15], -1);
      dc.fillRectangle(300, 202, 40, 4);
    }

    if (S) {
      // ---- coffee corner: cabinet + machine
      dc.setColor(P[4], -1);
      dc.fillRectangle(36, 298, 96, 57);
      dc.setColor(P[3], -1);
      dc.fillRectangle(32, 292, 104, 8);
      dc.setColor(P[5], -1);
      dc.fillRectangle(48, 240, 48, 52);
      dc.setColor(P[13], -1);
      dc.fillRectangle(60, 262, 24, 6);
      dc.setColor(lit ? P[21] : P[2], -1);
      dc.fillRectangle(54, 248, 6, 6);
    }

    if (sc === 1) {
      dc.setColor(P[27], -1);
      if (S) dc.fillRectangle(64, 274, 16, 18);
      // steam (moves)
      if (M) {
        const sp = live ? Math.floor(tt / 160) % 3 : 1;
        dc.setColor(G.mix(P[0], 0xffffff, 0.6), -1);
        for (let i = 0; i < 3; i++) dc.fillRectangle(70 + ((i + sp) % 2) * 4, 266 - i * 8 - sp * 2, 4, 4);
      }
    }

    if (S) {
      // ---- desk, monitor, paper stack, cups
      dc.setColor(P[4], -1);
      dc.fillRectangle(152, 304, 10, 51);
      dc.fillRectangle(372, 304, 10, 51);
      dc.setColor(P[3], -1);
      dc.fillRectangle(140, 296, 254, 10);
      dc.setColor(P[5], -1);
      dc.fillRectangle(212, 226, 96, 66);
      dc.fillRectangle(252, 292, 16, 4);
    }

    const scr = lit && sc !== 6 ? P[6] : 0x000000;
    dc.setColor(st === 3 ? (lit && sc !== 6 ? P0[6] : 0x0f380f) : scr, -1);
    dc.fillRectangle(216, 230, 88, 58);
    if (M && lit && sc !== 6 && sc !== 1 && sc !== 8) {
      if (sc === 3) {
        dc.setColor(st === 3 ? 0x9bbc0f : 0xffffff, -1);
        if (!live || Math.floor(tt / 600) % 2 === 0) {
          F.px(dc, "BIN", 260, 242, 2, 1, 0);
          F.px(dc, "ESSEN", 260, 262, 2, 1, 0);
        }
      } else if (sc === 4) {
        const n = p < 1 ? Math.floor(G.clamp(p / 0.6, 0, 1) * 4) : 4;
        for (let i = 0; i < n; i++) {
          const x = 220 + (i % 2) * 42, y = 234 + Math.floor(i / 2) * 26;
          dc.setColor(st === 3 ? 0x306230 : [0x3a5a8a, 0x5a3a6a, 0x3a6a5a, 0x6a5a3a][i], -1);
          dc.fillRectangle(x, y, 38, 24);
          dc.setColor(st === 3 ? 0x9bbc0f : 0xf2c08a, -1);
          dc.fillRectangle(x + 15, y + 5, 8, 8);
          dc.fillRectangle(x + 12, y + 15, 14, 9);
        }
      } else {
        // code scrolling; faster in the final sprint and during the episode
        const spd = sc === 5 ? 140 : 260;
        const off = live ? Math.floor(tt / (p < 1 ? 60 : spd)) : 0;
        const nl = p < 1 ? Math.floor(G.clamp(p / 0.7, 0, 1) * 7) : 7;
        for (let i = 0; i < nl; i++) {
          const k = i + off;
          const ind = (G.rnd(k * 31 + 7) % 3) * 6;
          const w = 12 + (G.rnd(k * 17 + 3) % 44);
          dc.setColor(st === 3 ? 0x8bac0f : [0x7ac0ff, 0xffd870, 0x9ae07a, 0xff9ac0][G.rnd(k * 7 + 1) % 4], -1);
          dc.fillRectangle(222 + ind, 236 + i * 7, Math.min(w, 76 - ind), 4);
        }
      }
    } else if (S && !(lit && sc !== 6)) {
      dc.setColor(st === 3 ? 0x306230 : 0x3aff6a, -1);
      dc.fillRectangle(300, 288, 2, 2);
    }
    if (S) {
      // paper stack = stress
      const sh = d.stress > 0 ? G.clamp(Math.floor(d.stress / 12), 0, 8) : 0;
      for (let i = 0; i < sh; i++) {
        dc.setColor(i % 2 === 0 ? P[14] : G.mix(P[14], P[15], 0.5), -1);
        dc.fillRectangle(320 + (i % 3) * 2, 292 - i * 5, 44, 5);
      }
      // empty cups = drained Body Battery
      const nc = d.bb >= 0 ? G.clamp(Math.floor((100 - d.bb) / 20), 0, 4) : 1;
      for (let i = 0; i < nc; i++) {
        const x = 150 + (i % 2) * 24, y = 278 - Math.floor(i / 2) * 20;
        dc.setColor(P[27], -1);
        dc.fillRectangle(x, y, 14, 18);
        dc.fillRectangle(x + 14, y + 4, 4, 8);
        dc.setColor(P[4], -1);
        dc.fillRectangle(x + 2, y + 2, 10, 3);
      }

      // ---- plant
      SPR.draw(dc, SP.PLANT, 100, 250, 3, [-1, P[24], P[25], P[26]], false);
    }

    if (M) {
      // ---- people
      const fr = live && Math.floor(tt / 200) % 2 === 1;
      if (sc === 2 || sc === 4 || sc === 5) {
        const typing = live && (sc !== 4 || p < 1) && Math.floor(tt / (sc === 5 ? 120 : 220)) % 2 === 1;
        SPR.draw(dc, typing ? SP.SIT_B : SP.SIT_A, 168, 275, 5, person(P, false), false);
      } else if (sc === 1) {
        // arrives during the episode and stops at the machine
        const x = p < 1 ? Math.round(G.lerp(-70, 120, G.ease(p))) : 120;
        SPR.draw(dc, p < 1 && Math.floor(a.t / 150) % 2 === 1 ? SP.STAND_B : SP.STAND_A, x, 265, 5, person(P, false), true);
      } else if (sc === 6 && p < 1) {
        // closing time: walks out of the picture
        const x = Math.round(G.lerp(180, -80, G.easeInOut(p)));
        SPR.draw(dc, Math.floor(a.t / 150) % 2 === 1 ? SP.STAND_B : SP.STAND_A, x, 265, 5, person(P, false), true);
      } else if (sc === 8) {
        // cleaning crew mopping the floor
        const mx = Math.round(200 + 50 * Math.sin((live ? tt : 0) / 700));
        dc.setColor(P[23], -1);
        dc.fillRectangle(mx - 46, 322, 30, 33);
        SPR.draw(dc, fr ? SP.STAND_B : SP.STAND_A, mx, 265, 5, person(P, true), false);
        dc.setColor(P[4], -1);
        dc.fillRectangle(mx + 60, 300, 5, 52);
        dc.setColor(P[22], -1);
        dc.fillRectangle(mx + 46, 350, 34, 6);
      }
    }

    if (!S) return;
    // ---- caption + date
    dc.setColor(P[22], -1);
    F.px(dc, CAP[sc], 227, 372, 2, 1, 0);
    dc.setColor(G.mix(P[22], P[1], 0.45), -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 394, 2, 1, 0);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    dc.setColor(st === 3 ? 0x306230 : 0x3a3a40, -1);
    dc.drawRectangle(134 + o[0], 24 + o[1], 186, 64);
    dc.setColor(st === 3 ? 0x8bac0f : G.dim(0xff3a2a, 0.6), -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 35 + o[1], 6, 1, 2);
    dc.setColor(st === 3 ? 0x306230 : 0x4a4a52, -1);
    dc.drawRectangle(212 + o[0], 226 + o[1], 96, 66);
    dc.drawRectangle(140 + o[0], 296 + o[1], 254, 4);
    dc.setColor(st === 3 ? 0x306230 : 0x6a6a72, -1);
    F.px(dc, CAP[scene(d)], 227 + o[0], 372 + o[1], 2, 1, 0);
  },
};
