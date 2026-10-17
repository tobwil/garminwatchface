// BAKERY — "Bäckerei": a day in a small bakery, told by the clock. At night the dough rises in its
// bowl and the cat sleeps on the counter, from three o'clock the baker fires the oven and pulls tray
// after tray of rolls out of it, the shelves fill up, the shop opens and customers come in (the door
// bell rings on every wrist raise) until in the evening everything is sold and he sweeps the floor
// of the closed shop. The three data slots are chalked on the board as the day's offer.
// Styles: 1 Backstube, 2 Café, 3 Gameboy. Mirrors watch/source/faces/Bakery.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/bakery.js";

const SP = encodeAll(S);
const CT = 296; // counter top
const FL = 360; // floor line
const FEET = 384; // where people in front of the counter stand
const MAXB = 18; // pieces on the shelves
const CAP = ["DER TEIG GEHT", "BACKSTUBE", "GEÖFFNET", "GESCHLOSSEN"];

// scene: 0 night (dough rises), 1 baking, 2 shop open, 3 closed
function scene(d) {
  const m = d.mins;
  if (m >= 1320 || m < 180) return 0;
  if (m < 390) return 1;
  if (m < 1110) return 2;
  return 3;
}

// pieces of bread on the shelves now
function stock(d, sc) {
  if (sc === 1) return Math.round(MAXB * G.clamp((d.mins - 180) / 210, 0, 1));
  if (sc === 2) return Math.round(MAXB * (1 - G.clamp((d.mins - 390) / 720, 0, 1)));
  return 0;
}

// [wall, wall line, floor, floor line, brick, brick dark, oven mouth, fire, fire bright, shelf, counter top,
//  counter, counter dark, board, chalk, text, text dim, crust, crumb, crust dark, white, skin, eye, apron,
//  trousers, shoes, peel, coat, hair, dough, cat, bowl]
function pal(st, acc) {
  if (st === 2) return [0xe8dcc8, 0xd8c8b0, 0x5a4a42, 0x4a3c36, 0x7a8a8a, 0x5a6a6a, 0x1a1a1e, 0xff7a2a, 0xffd25a,
    0x6a4a3a, 0xf4f0ea, 0x3a6a6a, 0x2a4a4a, 0x2a3a34, 0xf4f0e6, 0xffffff, 0xe0e8e4, 0xc8843a, 0xf0c070, 0x8a5428,
    0xffffff, 0xf2c08a, 0x1a1a1a, acc, 0x2a2a34, 0x1a1a1a, 0x9a6a3a, 0x8a3a5a, 0x3a2a1a, 0xf4e8d0, 0x3a3a40, 0x6a8ab0];
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [c, b, b, a, b, a, a, e, e, a, e, b, a, a, e, e, c, a, e, a, e, e, a, b, a, a, a, b, a, e, a, b];
  }
  return [0xf0dcb8, 0xe0c8a0, 0x8a5a3a, 0x6a4430, 0xb05a3a, 0x8a4028, 0x2a1a14, 0xff7a2a, 0xffd25a,
    0x7a4a2a, 0xe8d0a8, 0x8a5a34, 0x5a3a20, 0x2a2a26, 0xf4f0e6, 0xffffff, 0xf0e4d0, 0xc8843a, 0xf0c070, 0x8a5428,
    0xffffff, 0xf2c08a, 0x1a1a1a, acc, 0x3a3a48, 0x1a1a1a, 0x9a6a3a, 0x3a6a9a, 0x5a3a1a, 0xf4e8d0, 0x3a3a40, 0x8aa0c0];
}

// one piece of bread of kind k (0 loaf, 1 roll, 2 croissant) at x, resting on y
function bread(dc, P, k, x, y) {
  if (k === 0) {
    dc.setColor(P[17], -1);
    dc.fillRectangle(x, y - 12, 26, 12);
    dc.fillRectangle(x + 2, y - 14, 22, 2);
    dc.setColor(P[18], -1);
    for (let i = 0; i < 3; i++) dc.fillRectangle(x + 4 + i * 7, y - 12, 4, 2);
  } else if (k === 1) {
    dc.setColor(P[17], -1);
    dc.fillRectangle(x + 2, y - 12, 16, 12);
    dc.fillRectangle(x, y - 10, 20, 8);
    dc.setColor(P[19], -1);
    dc.fillRectangle(x + 9, y - 12, 2, 8);
  } else {
    dc.setColor(P[18], -1);
    dc.fillRectangle(x + 6, y - 12, 10, 10);
    dc.setColor(P[17], -1);
    dc.fillRectangle(x, y - 8, 6, 6);
    dc.fillRectangle(x + 16, y - 8, 6, 6);
    dc.fillRectangle(x + 9, y - 12, 4, 10);
  }
}

export default {
  fps: 8,

  // static layer: wall, oven, board, shelves with their stock, counter, floor, texts; the baker, the
  // customer, the fire, the tray, the bell, the dough, the cat and the broom move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const sc = scene(d);
    const n = stock(d, sc);
    const fire = sc === 1;

    if (S) {
      // ---- tiled wall, floor
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 0, 454, FL);
      dc.setColor(P[1], -1);
      for (let y = 20; y < FL; y += 24) dc.fillRectangle(0, y, 454, 2);
      for (let y = 20; y < FL; y += 24) for (let x = (y / 24) % 2 === 0 ? 0 : 24; x < 454; x += 48) dc.fillRectangle(x, y, 2, 24);
      dc.setColor(P[2], -1);
      dc.fillRectangle(0, FL, 454, 454 - FL);
      dc.setColor(P[3], -1);
      for (let x = 0; x < 454; x += 36) dc.fillRectangle(x, FL, 2, 94);
      dc.fillRectangle(0, FL + 30, 454, 2);

      // ---- the oven: brick vault with its mouth
      dc.setColor(P[4], -1);
      dc.fillRectangle(20, 176, 150, CT - 176);
      dc.fillRectangle(32, 160, 126, 16);
      dc.fillRectangle(52, 148, 86, 12);
      dc.setColor(P[5], -1);
      for (let y = 182; y < CT; y += 14) for (let x = 20 + ((y / 14) % 2) * 12; x < 170; x += 24) dc.fillRectangle(x, y, 2, 12);
      for (let y = 180; y < CT; y += 14) dc.fillRectangle(20, y, 150, 2);
      dc.setColor(P[6], -1);
      dc.fillRectangle(52, 214, 86, 52);
      dc.fillRectangle(64, 206, 62, 8);
      dc.setColor(P[5], -1);
      dc.fillRectangle(80, 120, 30, 28);

      // ---- chalk board with the day's offer (the data slots)
      dc.setColor(P[9], -1);
      dc.fillRectangle(150, 94, 154, 82);
      dc.setColor(P[13], -1);
      dc.fillRectangle(154, 98, 146, 74);
      dc.setColor(P[14], -1);
      F.px(dc, "ANGEBOT", 227, 102, 2, 1, 0);
      for (let i = 0; i < 3; i++) {
        const s = d.slots[i];
        if (!s.lbl || G.stag(p, i, 0.1, 0.4) <= 0) continue;
        let lb = s.lbl;
        while (lb.length > 2 && F.pxW(lb, 2) > 118 - F.pxW(s.val, 2)) lb = lb.substring(0, lb.length - 1);
        dc.setColor(G.mix(P[14], P[13], 0.3), -1);
        F.px(dc, lb, 162, 122 + i * 16, 2, 0, 0);
        dc.setColor(P[14], -1);
        F.px(dc, s.val, 292, 122 + i * 16, 2, 2, 0);
      }

      // ---- shelves with today's stock
      for (let r = 0; r < 3; r++) {
        const y = 212 + r * 30;
        dc.setColor(P[9], -1);
        dc.fillRectangle(290, y, 140, 6);
        for (let i = 0; i < 6; i++) {
          if (r * 6 + i < n) bread(dc, P, r, 294 + i * 22, y);
        }
      }
      dc.setColor(P[9], -1);
      dc.fillRectangle(290, 186, 4, 92);
      dc.fillRectangle(426, 186, 4, 92);

      // ---- counter
      dc.setColor(P[10], -1);
      dc.fillRectangle(0, CT, 454, 10);
      dc.setColor(P[11], -1);
      dc.fillRectangle(0, CT + 10, 454, FL - CT - 10);
      dc.setColor(P[12], -1);
      for (let x = 30; x < 454; x += 60) dc.fillRectangle(x, CT + 16, 44, FL - CT - 22);
      dc.setColor(P[11], -1);
      for (let x = 30; x < 454; x += 60) dc.fillRectangle(x + 4, CT + 20, 36, FL - CT - 30);
      // closed: sign on the counter
      if (sc === 3 || sc === 0) {
        dc.setColor(0xf4f0e6, -1);
        dc.fillRectangle(306, CT - 30, 112, 26);
        dc.setColor(0xc0392b, -1);
        F.px(dc, "ZU", 362, CT - 24, 2, 1, 0);
      }

      // ---- time, date, caption
      dc.setColor(G.mix(P[0], 0, 0.6), -1);
      F.px(dc, G.timeStr(d), 229, 26, 5, 1, 0);
      dc.setColor(st === 3 ? 0x0f380f : 0x3a2414, -1);
      F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 68, 2, 1, 0);
      dc.setColor(P[15], -1);
      F.px(dc, CAP[sc], 227, 398, 2, 1, 0);
      const sub = sc === 0 ? "BACKSTART 3:00" : sc === 1 ? "OFEN 230°" : sc === 2 ? n + " STÜCK DA" : "ALLES VERKAUFT!";
      dc.setColor(P[16], -1);
      F.px(dc, sub, 227, 418, 2, 1, 0);
    }

    if (!M) return;
    const bp = [-1, P[20], P[21], P[22], P[23], P[24], P[20], P[25]];
    // fire in the oven while baking, embers otherwise
    if (fire) {
      for (let i = 0; i < 8; i++) {
        const h = 8 + (G.rnd(i * 13 + Math.floor(tt / 110)) % 22);
        dc.setColor(i % 2 === 0 ? P[7] : P[8], -1);
        dc.fillRectangle(58 + i * 10, 264 - h, 8, h);
      }
    }
    if (sc === 0) {
      // the dough rises in its bowl, the cat sleeps on the counter
      const rise = G.clamp(((d.mins + 120) % 1440) / 300, 0, 1);
      const w = 50 + Math.round(rise * 10), h = 8 + Math.round(rise * 16) + (live ? Math.round(Math.sin(tt / 700) * 2) : 0);
      dc.setColor(P[29], -1);
      dc.fillRectangle(212 - w / 2, CT - 18 - h, w, h + 4);
      dc.fillRectangle(212 - w / 2 + 6, CT - 22 - h, w - 12, 4);
      dc.setColor(P[31], -1);
      dc.fillRectangle(182, CT - 18, 60, 18);
      SPR.draw(dc, SP.CAT, 60, CT - 20, 4, [-1, P[30], G.mix(P[30], 0xffffff, 0.3)], false);
      dc.setColor(P[16], -1);
      const ph = (Math.floor(tt) % 1500) / 1500;
      F.px(dc, "Z", 104 + Math.round(ph * 18), CT - 34 - Math.round(ph * 40), ph > 0.5 ? 3 : 2, 1, 0);
    } else if (sc === 1) {
      // pulls a tray of fresh rolls out of the oven on every raise
      const out = p < 1 ? G.ease(G.clamp((p - 0.3) / 0.6, 0, 1)) : 1;
      SPR.draw(dc, SP.PEEL_UP, 180, CT - 60, 5, bp, false);
      const tx = Math.round(G.lerp(70, 238, out));
      dc.setColor(P[26], -1);
      dc.fillRectangle(Math.min(tx + 60, 236), CT - 34, Math.max(0, 238 - Math.min(tx + 60, 236)), 4);
      dc.fillRectangle(tx, CT - 36, 64, 6);
      for (let i = 0; i < 3; i++) bread(dc, P, 1, tx + 2 + i * 20, CT - 36);
      if (out > 0.9) {
        dc.setColor(G.mix(P[0], 0xffffff, 0.5), -1);
        for (let i = 0; i < 3; i++) dc.fillRectangle(tx + 10 + i * 20, CT - 56 - ((Math.floor(tt / 160) + i) % 3) * 6, 4, 4);
      }
    } else if (sc === 2) {
      // the baker serves; on every raise a customer comes in (the bell rings), buys and leaves
      SPR.draw(dc, SP.BAKER_UP, 200, CT - 60, 5, bp, false);
      if (p < 1) {
        const cp = [-1, P[27], P[21], P[22], P[24], P[25], P[28], P[17]];
        const cx = p < 0.4 ? Math.round(G.lerp(-70, 150, G.ease(p / 0.4))) : p < 0.7 ? 150 : Math.round(G.lerp(150, -80, G.easeInOut((p - 0.7) / 0.3)));
        const walking = p < 0.4 || p >= 0.7;
        SPR.draw(dc, walking && Math.floor(a.t / 140) % 2 === 1 ? SP.CUST_B : SP.CUST_A, cx, FEET - 90, 5, cp, p >= 0.7);
        if (p < 0.25) {
          dc.setColor(P[15], -1);
          F.px(dc, "KLING!", 70, 196, 2, 1, 0);
        }
      }
    } else {
      // closed: sweeping in front of the counter
      const x = 150 + Math.round(60 * Math.sin(tt / 1400));
      SPR.draw(dc, SP.BAKER, x, FEET - 90, 5, bp, false);
      const sw = live ? Math.round(Math.sin(tt / 180) * 8) : 0;
      dc.setColor(P[26], -1);
      for (let i = 0; i < 8; i++) dc.fillRectangle(x + 50 + Math.round(i * (sw + 8) / 8), FEET - 50 + i * 5, 3, 5);
      dc.setColor(P[19], -1);
      dc.fillRectangle(x + 46 + sw + 8, FEET - 6, 20, 6);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const c = st === 3 ? 0x306230 : 0x3a3a42;
    dc.setColor(c, -1);
    dc.drawRectangle(20 + o[0], 176 + o[1], 150, CT - 176);
    dc.fillRectangle(o[0], CT + o[1], 454, 2);
    dc.setColor(G.dim(0xff7a2a, 0.4), -1);
    if (scene(d) === 1) dc.fillRectangle(60 + o[0], 250 + o[1], 70, 4);
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
  },
};
