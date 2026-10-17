// LIGHT — "Leuchtturm": a lighthouse on the rocks and its keeper, told by the real sun. By day he
// fishes from the rocks and waves at the sailing ship that passes on every wrist raise; at dusk he
// climbs the tower (the windows light up one after another) and lights the lamp; at night the beam
// sweeps the sea while a ship's lights pass safely, his cottage window glowing below; at dawn he
// puts the light out. The three data slots are on the sea weather panel.
// Styles: 1 Küste, 2 Sturm (rain and high waves), 3 Gameboy. Mirrors watch/source/faces/Light.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/light.js";

const SP = encodeAll(S);
const HZ = 250; // horizon
const TX = 300; // tower centre
const LY = 98; // lamp centre
const CAP = ["AUF DEM FELSEN", "LICHT AN!", "NACHTWACHE", "LICHT AUS"];

// phase: 0 day, 1 dusk, 2 night, 3 dawn
function phase(d, el) {
  if (el > 4) return 0;
  if (el < -6) return 2;
  return d.mins < 720 ? 3 : 1;
}

// [sky top day, sky low day, sky top dusk, sky low dusk, sky top night, sky low night, sea far, sea near,
//  wave, rock, rock dark, tower white, tower red, lantern frame, glass, lamp, rail, cottage, roof, window lit,
//  door, text, text dim, panel, panel text, sweater, skin, eye, trousers, boots, cap, beard, hull, sail, gull,
//  star, moon, moon dark]
function pal(st, acc) {
  if (st === 2) return [0x3a4a5a, 0x8a9aa8, 0x3a3a5a, 0x8a6a7a, 0x05080e, 0x101826, 0x2a3a4a, 0x1a2a3a, 0xc8d8e8,
    0x3a3a40, 0x26262c, 0xe8e8e8, 0xb02a24, 0x1a1a1e, 0x2a3a48, acc, 0x1a1a1e, 0xb8a890, 0x4a3a34, 0xffd27a,
    0x3a2a1e, 0xffffff, 0xd8e0e8, 0x101820, 0xffffff, 0x2a3a5a, 0xf2c08a, 0x1a1a1a, 0x2a2a34, 0x1a1a1a, 0x1a1a24,
    0xd8d8d8, 0x5a3a2a, 0xe8e8e0, 0xffffff, 0xffffff, 0xf4f0d8, 0x3a3a48];
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [c, e, b, c, a, a, b, b, e, a, a, e, b, a, a, e, a, c, a, e, a, a, e, a, e, b, e, a, a, a, a, e, a, e, a, e, e, b];
  }
  return [0x3a8ad8, 0xa8d8ff, 0x5a4a9a, 0xff9a6a, 0x060a20, 0x141c44, 0x2a6aa8, 0x1e5a94, 0xe8f4ff,
    0x6a6058, 0x4a423c, 0xf4f4f4, 0xd8302a, 0x2a2a30, 0x2a3a48, acc, 0x2a2a30, 0xf0e6d0, 0x8a3a2a, 0xffd27a,
    0x4a2a1a, 0xffffff, 0xe8f4ff, 0x101820, 0xffffff, 0x2a4a8a, 0xf2c08a, 0x1a1a1a, 0x3a3a48, 0x1a1a1a, 0x1a2a4a,
    0xe8e8e8, 0x6a3a24, 0xf8f4e8, 0xffffff, 0xffffff, 0xf4f0d8, 0x3a3a48];
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
  fps: 10,

  // static layer: sky, sea, rocks, tower, cottage, panel, texts; the beam, the lamp, the tower
  // windows, the keeper, ships, gulls, waves and rain move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const ph = phase(d, el);
    const k = ph === 0 ? 0 : ph === 2 ? 2 : 1;
    const nf = st === 3 ? 0 : [0, 0.3, 0.6][k];
    const dk = (c) => G.mix(c, 0x050814, nf);

    if (S) {
      // ---- sky, moon / sun, stars
      for (let i = 0; i < 5; i++) {
        dc.setColor(G.mix(P[k * 2], P[k * 2 + 1], i / 4), -1);
        dc.fillRectangle(0, i * 50, 454, 50);
      }
      if (k === 2 && st !== 2) {
        dc.setColor(P[35], -1);
        for (let i = 0; i < 26; i++) dc.fillRectangle(30 + ((i * 101 + 17) % 394), 20 + ((i * 47 + 11) % 210), i % 6 === 0 ? 4 : 2, i % 6 === 0 ? 4 : 2);
      }
      if (el < 0 && st !== 2) moon(dc, P, 96, 92, 18, d.moon >= 0 ? d.moon : 0.5);
      if (el > -4 && st !== 2) {
        dc.setColor(st === 3 ? 0x9bbc0f : 0xfff6d0, -1);
        dc.fillCircle(150, HZ - 10 - Math.round(G.clamp(el, -4, 40) * 4), 14);
      }

      // ---- sea
      dc.setColor(dk(P[6]), -1);
      dc.fillRectangle(0, HZ, 454, 60);
      dc.setColor(dk(P[7]), -1);
      dc.fillRectangle(0, HZ + 60, 454, 454 - HZ - 60);

      // ---- rocks, tower, gallery, cottage
      dc.setColor(dk(P[10]), -1);
      dc.fillRectangle(236, 318, 218, 60);
      dc.setColor(dk(P[9]), -1);
      dc.fillRectangle(250, 304, 204, 30);
      dc.fillRectangle(222, 336, 60, 24);
      dc.fillRectangle(300, 296, 154, 12);
      for (let y = 124; y < 312; y += 4) {
        const hw = Math.round(G.lerp(18, 30, (y - 124) / 188) / 2) * 2;
        const band = Math.floor((y - 124) / 32) % 2 === 1;
        dc.setColor(dk(band ? P[12] : P[11]), -1);
        dc.fillRectangle(TX - hw, y, 2 * hw, 4);
      }
      dc.setColor(dk(P[13]), -1);
      dc.fillRectangle(TX - 28, 118, 56, 8);
      dc.fillRectangle(TX - 18, 74, 36, 6);
      dc.fillRectangle(TX - 10, 64, 20, 10);
      dc.fillRectangle(TX - 18, 80, 4, 38);
      dc.fillRectangle(TX + 14, 80, 4, 38);
      dc.setColor(dk(P[16]), -1);
      dc.fillRectangle(TX - 28, 108, 2, 10);
      dc.fillRectangle(TX + 26, 108, 2, 10);
      dc.fillRectangle(TX - 28, 108, 56, 2);
      // cottage
      dc.setColor(dk(P[18]), -1);
      dc.fillPolygon([[338, 262], [382, 236], [426, 262]]);
      dc.setColor(dk(P[17]), -1);
      dc.fillRectangle(344, 262, 76, 42);
      dc.setColor(dk(P[20]), -1);
      dc.fillRectangle(356, 270, 18, 34);
      dc.setColor(k > 0 ? P[19] : dk(P[14]), -1);
      dc.fillRectangle(388, 272, 20, 14);

      // ---- sea weather panel with the data slots
      dc.setColor(P[23], -1);
      dc.fillRectangle(40, 128, 176, 74);
      dc.setColor(P[15], -1);
      F.px(dc, "SEEWETTER", 128, 132, 1, 1, 0);
      for (let i = 0; i < 3; i++) {
        const s = d.slots[i];
        if (!s.lbl || G.stag(p, i, 0.1, 0.4) <= 0) continue;
        let lb = s.lbl;
        while (lb.length > 2 && F.pxW(lb, 2) > 156 - F.pxW(s.val, 2)) lb = lb.substring(0, lb.length - 1);
        dc.setColor(G.mix(P[24], P[23], 0.35), -1);
        F.px(dc, lb, 48, 146 + i * 18, 2, 0, 0);
        dc.setColor(P[24], -1);
        F.px(dc, s.val, 208, 146 + i * 18, 2, 2, 0);
      }

      // ---- time, date, caption
      dc.setColor(0x000000, -1);
      F.px(dc, G.timeStr(d), 222, 26, 5, 1, 0);
      dc.setColor(st === 3 ? 0x0f380f : P[21], -1);
      F.px(dc, G.timeStr(d), 220, 24, 5, 1, 0);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 206, 68, 2, 1, 0);
      dc.setColor(P[21], -1);
      F.px(dc, CAP[ph], 200, 392, 2, 1, 0);
      const ss = d.sunset > 0 ? d.sunset : 1140, sr = d.sunrise > 0 ? d.sunrise : 390;
      dc.setColor(P[22], -1);
      F.px(dc, ph === 0 ? "LICHT UM " + G.hm(ss) : ph === 2 ? "BIS " + G.hm(sr) : G.hm(ph === 1 ? ss : sr), 200, 412, 2, 1, 0);
    }

    if (!M) return;
    const kp = [-1, dk(P[25]), P[26], P[27], dk(P[28]), P[29], dk(P[30]), P[31]];
    // ---- waves roll in (higher in the storm)
    const storm = st === 2;
    dc.setColor(dk(P[8]), -1);
    for (let i = 0; i < 14; i++) {
      const wy = HZ + 14 + ((i * 37) % 100);
      const wx = ((i * 151 + Math.floor(tt / (storm ? 18 : 40))) % 520) - 40;
      if (wx + 26 > 222 && wy >= 290) continue; // not on the rocks
      dc.fillRectangle(wx, wy, storm ? 26 : 16, 2);
      if (storm) dc.fillRectangle(wx + 6, wy - 2, 12, 2);
    }
    // ---- the lamp, the tower windows and the beam
    const lampOn = ph === 2 || (ph === 1 && p >= 0.8) || (ph === 3 && p < 0.5);
    const winOn = ph === 1 && p < 1 ? Math.floor(G.clamp(p / 0.8, 0, 1) * 3) : 0;
    dc.setColor(P[19], -1);
    for (let w = 0; w < winOn; w++) dc.fillRectangle(TX - 4, 276 - w * 56, 8, 14);
    dc.setColor(lampOn ? P[15] : dk(P[14]), -1);
    dc.fillRectangle(TX - 14, 80, 28, 38);
    if (lampOn) {
      const ang = tt / 700;
      const c = Math.cos(ang), len = Math.round(Math.abs(c) * 300);
      const dir = c < 0 ? -1 : 1;
      if (len > 12) {
        dc.setColor(G.mix(P[k * 2 + 1], P[15], 0.45), -1);
        dc.fillPolygon([[TX, LY - 4], [TX + dir * len, LY - 18], [TX + dir * len, LY + 14], [TX, LY + 4]]);
      }
      // glare when it points at us
      if (Math.abs(Math.sin(ang)) > 0.97) {
        dc.setColor(0xffffff, -1);
        dc.fillRectangle(TX - 20, LY - 4, 40, 8);
        dc.fillRectangle(TX - 4, LY - 20, 8, 40);
      }
    }
    // ---- rain in the storm
    if (storm) {
      dc.setColor(G.mix(P[1], 0xffffff, 0.3), -1);
      for (let i = 0; i < 24; i++) {
        const rx = (i * 97 + Math.floor(tt / 8)) % 470 - 10, ry = (i * 61 + Math.floor(tt / 4)) % 400;
        dc.fillRectangle(rx, ry, 2, 10);
      }
    }
    // ---- the story
    if (ph === 0) {
      // fishing from the rocks; a ship sails by on every raise, he waves
      const sx = p < 1 ? Math.round(G.lerp(-60, 300, p)) : -100;
      if (p < 1) SPR.draw(dc, SP.SHIP, sx, HZ - 34, 3, [-1, P[32], P[33], P[15]], false);
      const wv = p > 0.2 && p < 0.9 && Math.floor(a.t / 200) % 2 === 0;
      SPR.draw(dc, wv ? SP.WAVE : SP.KEEPER, 244, 298 - 36, 2, kp, true);
      if (!wv) {
        dc.setColor(dk(P[13]), -1);
        for (let i = 0; i < 8; i++) dc.fillRectangle(238 - i * 6, 280 - i * 4, 6, 2);
        dc.setColor(P[22], -1);
        dc.fillRectangle(190, 248 + (live ? Math.floor(tt / 500) % 2 * 2 : 0), 2, 26);
      }
      // gulls
      for (let i = 0; i < 2; i++) {
        const gx = (i * 211 + Math.floor(tt / 30)) % 560 - 60, gy = 160 + i * 30 + Math.round(6 * Math.sin(tt / 300 + i));
        SPR.draw(dc, Math.floor(tt / 240 + i) % 2 === 0 ? SP.GULL_A : SP.GULL_B, gx, gy, 3, [-1, P[34]], false);
      }
    } else if (ph === 1 || ph === 3) {
      // on the gallery: climbs up and lights the lamp / puts it out at dawn
      if (ph === 3 || p >= 0.8) SPR.draw(dc, ph === 3 ? SP.WAVE : SP.KEEPER, TX - 56, 120 - 36, 2, kp, false);
    } else {
      // a ship's lights pass safely in the night
      const sx = ((Math.floor(tt / 40) + 380) % 600) - 80;
      dc.setColor(0xff3a2a, -1);
      dc.fillRectangle(sx, HZ + 6, 4, 4);
      dc.setColor(0x3aff6a, -1);
      dc.fillRectangle(sx + 30, HZ + 6, 4, 4);
      dc.setColor(0xffe08a, -1);
      dc.fillRectangle(sx + 14, HZ - 2, 4, 4);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const c = st === 3 ? 0x306230 : 0x3a3a42;
    dc.setColor(c, -1);
    dc.drawRectangle(TX - 15 + o[0], 124 + o[1], 30, 188);
    dc.fillRectangle(TX - 28 + o[0], 118 + o[1], 56, 4);
    dc.fillRectangle(o[0], HZ + o[1], 454, 2);
    dc.setColor(G.dim(d.accent, 0.5), -1);
    dc.fillRectangle(TX - 8 + o[0], 88 + o[1], 16, 20);
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 220 + o[0], 24 + o[1], 5, 1, 1);
  },
};
