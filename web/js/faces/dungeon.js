// DUNGEON — "Dungeon": a side-view pixel JRPG battle. Every day a new monster (Sunday: the
// DRACHE boss) whose HP are today's step target; your steps are the hero's damage. Reach the
// target and it falls: chest, "SIEG!", +1 gold (once per day), victory streak, LV from gold.
// Styles: 1 Verlies, 2 Wald, 3 Lava. Mirrors watch/source/faces/Dungeon.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import S from "../sprites/dungeon.js";
import { SPR, encodeAll } from "../engine/spr.js";

const SP = encodeAll(S);
const SC = 4; // scene pixel size
const GY = 292; // ground line (feet)
const HX = 84; // hero left x
const MX = 318; // monster centre x
const NAMES = ["SCHLEIM", "SKELETT", "FLEDERMAUS", "GOBLIN", "PILZLING", "GOLEM", "DRACHE"];
const FAC = [80, 100, 130]; // difficulty (cfg.quest) in % of the step goal
// monster palettes (index 0 = outline)
const MPAL = [
  [0x0b1a10, 0x8af27e, 0x3fbf5a, 0x1f7a3c, -1, -1, -1, -1, -1, 0xffffff],
  [0x140f1e, 0xeeeadc, 0xb4ae9c, 0x6a6454, -1, 0xff3a2a, -1, -1, -1, 0xffffff, 0x8a8e9a],
  [0x120a1e, 0x9a6ad8, 0x5e3c96, 0x3a2466, -1, 0xffe040, -1, -1, -1, 0xffffff],
  [0x0e140a, 0x9ad04e, 0x5e9a30, 0x3a5a22, 0xf0c040, 0xffe040, -1, -1, -1, 0xffffff, 0x8a5a2c, 0x5a3a1c],
  [0x1a0a0a, 0xf6e8cc, 0xc8b08a, -1, -1, 0xe8402e, 0x9a1e2a, -1, -1, 0xffffff, 0x8a5a2c],
  [0x121214, 0xa09a8c, 0x726e64, 0x48443e, -1, 0x5aeaff, -1, -1, -1, -1, -1, -1, 0x6ab84a, 0x3e7a2e],
  [0x1a0606, 0xd8432c, 0x9a2418, 0x5c2a6e, 0xf2b440, 0xffe040, -1, -1, -1, 0xfff4d8],
];
const CPAL = [0x1a0f08, -1, -1, -1, 0xd08a2c, -1, -1, -1, 0xf2c040, 0xfff6c0, 0x9a5a24, 0x6a3a18];
const FPAL = [-1, 0xfff6c8, 0xffd84a, 0xff8a1e, 0xd8401a];
const COINPAL = [0x2a1a04, 0xfff6c0, 0xf2c040, 0xa8741a];
// window colours per style: top, bottom, border
const SHD = [0x16131e, 0x14281a, 0x160c0e];
const WIN = [0x2c3c9e, 0x111a56, 0xe4e8f4, 0x1e5c4c, 0x0a2a22, 0xe0f0e4, 0x6a2018, 0x260a08, 0xf4e0c0];

function leap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function dayKey(d) { return d.year * 1000 + d.doy; }
function yKey(d) { return d.doy > 1 ? d.year * 1000 + d.doy - 1 : (d.year - 1) * 1000 + (leap(d.year - 1) ? 366 : 365); }

// today's monster index (Sunday = dragon boss)
function monster(d) {
  if (d.temp >= 100) return d.temp - 100; // DEBUGTMP
  if (d.dow === 0) return 6;
  const s = G.rnd(G.rnd(d.year * 1000 + d.doy));
  return Math.floor(s / 4096) % 6;
}
function target(d, m) {
  const g = d.stepGoal > 0 ? d.stepGoal : 10000;
  const t = Math.floor((g * FAC[G.clamp(d.cfg.quest, 0, 2)] * (m === 6 ? 120 : 100)) / 100000) * 10;
  return t < 10 ? 10 : t;
}
function levelOf(gold) {
  let L = 0;
  while (((L + 1) * (L + 2)) / 2 <= gold) L++;
  return L + 1;
}
function msprite(m, f) {
  if (m === 0) return f === 1 ? SP.SLIME_B : SP.SLIME_A;
  if (m === 1) return f === 1 ? SP.SKEL_B : SP.SKEL;
  if (m === 2) return f === 1 ? SP.BAT_B : SP.BAT_A;
  if (m === 3) return f === 1 ? SP.GOBLIN_B : SP.GOBLIN;
  if (m === 4) return f === 1 ? SP.SHROOM_B : SP.SHROOM;
  if (m === 5) return f === 1 ? SP.GOLEM_B : SP.GOLEM;
  return f === 1 ? SP.DRAGON_B : SP.DRAGON;
}

// persistent state -> [gold, streak, wonToday]
function sync(d, m) {
  // web preview only: seed a demo profile once
  if (St.get("dgDemo", 0) === 0) {
    St.set("dgDemo", 1);
    St.set("dgGold", 20);
    St.set("dgSer", 4);
    St.set("dgDay", yKey(d));
  }
  const today = dayKey(d);
  const won = d.steps >= target(d, m);
  let day = St.get("dgDay", -1);
  let gold = St.get("dgGold", 0);
  let ser = St.get("dgSer", 0);
  if (won && day !== today) {
    gold += 1;
    ser = day === yKey(d) ? ser + 1 : 1;
    day = today;
    St.set("dgGold", gold);
    St.set("dgSer", ser);
    St.set("dgDay", today);
  }
  if (day !== today && day !== yKey(d)) ser = 0;
  return [gold, ser, won ? 1 : 0];
}

// half chord of the display circle for a band y..y+h
function chord(y, h) {
  const dy = Math.max(Math.abs(y - 227), Math.abs(y + h - 227));
  return dy >= 227 ? 0 : Math.sqrt(227 * 227 - dy * dy);
}

// filled pixel circle made of horizontal bands (unit u)
function pxc(dc, cx, cy, r, u) {
  for (let y = -r; y < r; y += u) {
    const m = y + u / 2;
    const hw = Math.floor(Math.sqrt(Math.max(0, r * r - m * m)) / u + 0.5) * u;
    if (hw > 0) dc.fillRectangle(cx - hw, cy + y, hw * 2, u);
  }
}

// JRPG window: black rim, light border (pixel-rounded corners), banded gradient fill
function win(dc, x, y, w, h, st) {
  const c0 = WIN[(st - 1) * 3], c1 = WIN[(st - 1) * 3 + 1], cb = WIN[(st - 1) * 3 + 2];
  dc.setColor(0x000000, -1);
  dc.fillRectangle(x + 2, y, w - 4, h);
  dc.fillRectangle(x, y + 2, w, h - 4);
  dc.setColor(cb, -1);
  dc.fillRectangle(x + 4, y + 2, w - 8, h - 4);
  dc.fillRectangle(x + 2, y + 4, w - 4, h - 8);
  const ih = h - 10;
  for (let i = 0; i < 4; i++) {
    const y0 = y + 5 + Math.floor((ih * i) / 4), y1 = y + 5 + Math.floor((ih * (i + 1)) / 4);
    dc.setColor(G.mix(c0, c1, i / 3.0), -1);
    dc.fillRectangle(x + 5, y0, w - 10, y1 - y0);
  }
}

// pixel bar with highlight
function bar(dc, x, y, w, h, f, col) {
  dc.setColor(0x05060f, -1);
  dc.fillRectangle(x, y, w, h);
  const fw = Math.round((w - 2) * G.clamp(f, 0, 1));
  if (fw > 0) {
    dc.setColor(col, -1);
    dc.fillRectangle(x + 1, y + 1, fw, h - 2);
    dc.setColor(G.mix(col, 0xffffff, 0.45), -1);
    dc.fillRectangle(x + 1, y + 1, fw, 2);
  }
}

function torch(dc, x, y, t, k) {
  const n = G.noise(t / 160.0 + k * 3.7);
  const fr = n > 0.3 ? SP.FL_B : n < -0.3 ? SP.FL_C : SP.FL_A;
  dc.setColor(0x4a4a56, -1);
  dc.fillRectangle(x - 10, y + 28, 20, 4);
  dc.fillRectangle(x - 6, y + 32, 12, 4);
  dc.setColor(0x2a2a32, -1);
  dc.fillRectangle(x - 2, y + 36, 4, 20);
  SPR.draw(dc, fr, x - 10, y, 4, FPAL, false);
}

function bgVerlies(dc, t, live) {
  const base = 0x2a2636, mort = 0x14121b, hil = 0x37324a;
  dc.setColor(base, -1);
  dc.fillRectangle(0, 0, 454, GY - 4);
  // torch glow (warm bricks), flickering radius
  for (let k = 0; k < 2; k++) {
    const tx = k === 0 ? 40 : 414;
    const fl = live ? Math.round(G.noise(t / 210.0 + k * 5.1) * 1.4) * 4 : 0;
    dc.setColor(G.mix(base, 0x7a4220, 0.22), -1);
    pxc(dc, tx, 228, 64 + fl, 8);
    dc.setColor(G.mix(base, 0x8a4a22, 0.42), -1);
    pxc(dc, tx, 228, 40 + fl, 8);
  }
  // bricks 36x16 + 4 mortar
  for (let r = 0; r < 15; r++) {
    const y = r * 20 - 8;
    if (y >= GY - 4) break;
    const hc = chord(y, 20);
    if (hc <= 0) continue;
    const xa = Math.floor(227 - hc), xb = Math.ceil(227 + hc);
    const hb = Math.min(y + 20, GY - 4);
    dc.setColor(hil, -1);
    if (y + 4 <= hb) dc.fillRectangle(xa, y, xb - xa, 4);
    dc.setColor(mort, -1);
    if (y + 20 <= GY - 4) dc.fillRectangle(xa, y + 16, xb - xa, 4);
    // joints (skip the ones hidden behind the time window)
    const hid = y >= 48 && y + 20 <= 126;
    for (let x = (r % 2) * 20 + 6; x < xb; x += 40) {
      if (x + 4 < xa || (hid && x > 92 && x < 358)) continue;
      dc.fillRectangle(x, y, 4, hb - y > 16 ? 16 : hb - y);
    }
  }
  // floor flagstones
  dc.setColor(0x1b1824, -1);
  dc.fillRectangle(0, GY - 4, 454, 454 - GY + 4);
  dc.setColor(0x3c3650, -1);
  dc.fillRectangle(0, GY - 4, 454, 4);
  dc.setColor(0x100e16, -1);
  dc.fillRectangle(0, GY + 6, 454, 4);
  dc.fillRectangle(0, 396, 454, 4);
  dc.fillRectangle(0, 424, 454, 4);
  for (let i = 0; i < 6; i++) {
    dc.fillRectangle(30 + i * 80, GY, 4, 6);
    dc.fillRectangle(10 + i * 96, 400, 4, 24);
  }
  torch(dc, 40, 196, live ? t : 0, 0);
  torch(dc, 414, 196, live ? t + 700 : 0, 1);
}

function pine(dc, x, base, h, col) {
  dc.setColor(col, -1);
  const n = Math.floor(h / 12);
  for (let k = 0; k < n; k++) {
    const hw = Math.floor(((h * 0.36) * (n - k)) / n / 4) * 4 + 4;
    dc.fillRectangle(x - hw, base - (k + 1) * 12, hw * 2, 12);
  }
  dc.fillRectangle(x - 4, base - 12 * n - 8, 8, 8);
}

function bgWald(dc, t, live) {
  const sky = [0x060a1e, 0x0a1230, 0x0e1a40, 0x14244e, 0x1a2e58];
  for (let i = 0; i < 5; i++) {
    dc.setColor(sky[i], -1);
    dc.fillRectangle(0, i * 56, 454, 56);
  }
  // moon + stars
  dc.setColor(0xe8ecd0, -1);
  pxc(dc, 60, 112, 20, 4);
  dc.setColor(0x0a1230, -1);
  pxc(dc, 70, 106, 16, 4);
  for (let i = 0; i < 9; i++) {
    let s = G.rnd(i * 977 + 31);
    const sx = 30 + (s % 394);
    s = G.rnd(s);
    const sy = 130 + (s % 70);
    const tw = live ? Math.floor(t / 300 + i * 3) % 7 : 1;
    dc.setColor(tw === 0 ? 0x5a6a8a : 0xc8d4ff, -1);
    dc.fillRectangle(sx - (sx % 4), sy - (sy % 4), 4, 4);
  }
  // far pines + near pines
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 52 + ((i * 37) % 20);
    pine(dc, x, GY - 2, 70 + ((i * 53) % 46), 0x16443c);
  }
  for (let i = 0; i < 5; i++) {
    const x = 50 + i * 90 + ((i * 29) % 30);
    pine(dc, x, GY - 2, 50 + ((i * 41) % 30), 0x0e302c);
  }
  pine(dc, 12, GY + 4, 190, 0x06161a);
  pine(dc, 442, GY + 4, 180, 0x06161a);
  // ground
  dc.setColor(0x16301e, -1);
  dc.fillRectangle(0, GY - 4, 454, 454 - GY + 4);
  dc.setColor(0x2e6a34, -1);
  dc.fillRectangle(0, GY - 4, 454, 8);
  dc.setColor(0x3e8a40, -1);
  for (let i = 0; i < 12; i++) {
    const x = 12 + i * 38 + ((i * 17) % 12);
    dc.fillRectangle(x, GY - 8, 4, 4);
    dc.fillRectangle(x + 8, GY - 12, 4, 8);
  }
  dc.setColor(0x10241a, -1);
  dc.fillRectangle(0, GY + 12, 454, 4);
  dc.fillRectangle(0, 404, 454, 4);
  fireflies(dc, t, live);
}

function fireflies(dc, t, live) {
  for (let i = 0; i < 7; i++) {
    const tt = live ? t / 1000.0 : 0;
    const x = Math.floor((40 + i * 58 + G.noise(tt * 0.5 + i * 2.1) * 26) / 4) * 4;
    const y = Math.floor((228 + ((i * 37) % 50) + G.noise(tt * 0.6 + i * 4.3) * 18) / 4) * 4;
    const on = live ? G.noise(tt * 1.3 + i * 1.7) > -0.2 : i % 3 !== 1;
    if (!on) continue;
    dc.setColor(0x3a5a14, -1);
    dc.fillRectangle(x - 4, y - 4, 12, 12);
    dc.setColor(0xd8ff6a, -1);
    dc.fillRectangle(x, y, 4, 4);
  }
}

function bgLava(dc, t, live) {
  // back wall: warmer towards the lava glow
  const wall = [0x110607, 0x170808, 0x1f0a0a, 0x2a0e0c, 0x3a140e];
  for (let i = 0; i < 5; i++) {
    dc.setColor(wall[i], -1);
    dc.fillRectangle(0, i * 54 - 8, 454, 54);
  }
  // hanging stalactites
  dc.setColor(0x0c0405, -1);
  const T = [227, 126, 6, 196, 126, 3, 262, 126, 4, 62, 84, 6, 392, 84, 6, 40, 140, 3, 416, 140, 3];
  for (let i = 0; i < T.length; i += 3) {
    for (let k = 0; k < T[i + 2]; k++) {
      const w = (T[i + 2] - k) * 8;
      dc.fillRectangle(T[i] - w / 2, T[i + 1] + k * 10, w, 10);
    }
  }
  // rock crags along the lava
  const C = [24, 7, 92, 4, 176, 3, 236, 5, 300, 3, 372, 6, 440, 8];
  for (let i = 0; i < C.length; i += 2) {
    const n = C[i + 1];
    for (let k = 0; k < n; k++) {
      const w = (n - k) * 12 + 8;
      dc.setColor(k === n - 1 ? 0x4a1c12 : 0x1c0a0a, -1);
      dc.fillRectangle(C[i] - w / 2, 262 - (k + 1) * 12, w, 12);
    }
  }
  // glowing cracks
  const gl = live ? 0.55 + 0.45 * G.noise(t / 380.0) : 0.7;
  dc.setColor(G.mix(0x5a1a08, 0xe0601a, gl), -1);
  const V = [20, 226, 24, 234, 28, 242, 368, 214, 372, 222, 376, 230, 380, 238, 440, 182, 436, 190, 440, 198, 88, 226, 92, 234];
  for (let i = 0; i < V.length; i += 2) dc.fillRectangle(V[i], V[i + 1], 4, 8);
  // lava lake behind the ledge
  dc.setColor(0xd8400c, -1);
  dc.fillRectangle(0, 262, 454, 30);
  dc.setColor(0xff8a1e, -1);
  dc.fillRectangle(0, 262, 454, 8);
  dc.setColor(0xffd060, -1);
  for (let i = 0; i < 9; i++) {
    const x = (i * 52 + (live ? Math.floor(t / 90) * 4 : 0)) % 470 - 8;
    dc.fillRectangle(x, 262, 16, 4);
  }
  dc.setColor(0x8a1a06, -1);
  dc.fillRectangle(0, 280, 454, 4);
  // bubbles
  for (let i = 0; i < 4; i++) {
    const ph = live ? ((t + i * 530) % 2100) / 2100.0 : 0.3 + i * 0.15;
    const bx = 40 + i * 112 + ((i * 41) % 30);
    const r = 4 + Math.floor(ph * 3) * 4;
    if (ph < 0.85) {
      dc.setColor(0xffb040, -1);
      pxc(dc, bx, 266, r, 4);
      dc.setColor(0xfff0a0, -1);
      dc.fillRectangle(bx - 4, 262 - r + 4, 4, 4);
    } else {
      dc.setColor(0xffd060, -1);
      dc.fillRectangle(bx - 12, 250, 4, 4);
      dc.fillRectangle(bx + 8, 246, 4, 4);
      dc.fillRectangle(bx - 2, 240, 4, 4);
    }
  }
  // embers
  if (live) {
    dc.setColor(0xff9a3a, -1);
    for (let i = 0; i < 6; i++) {
      const ph = ((t + i * 977) % 3000) / 3000.0;
      const x = 60 + i * 64 + Math.floor(G.noise(i * 3.1 + t / 700.0) * 5) * 4;
      const y = 262 - Math.floor(ph * 120 / 4) * 4;
      dc.fillRectangle(x, y, 4, 4);
    }
  }
  // basalt ledge
  dc.setColor(0x1a1012, -1);
  dc.fillRectangle(0, GY - 4, 454, 454 - GY + 4);
  dc.setColor(0x4a2a24, -1);
  dc.fillRectangle(0, GY - 4, 454, 4);
  dc.setColor(0x2c1a1a, -1);
  for (let i = 0; i < 7; i++) dc.fillRectangle(14 + i * 68, GY + 4, 28, 4);
  dc.fillRectangle(0, 404, 454, 4);
}

export default {
  fps: 8,

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const live = a.live && p >= 1;
    const t = a.t;
    const m = monster(d);
    const tg = target(d, m);
    const S3 = sync(d, m);
    const gold = S3[0], ser = S3[1], won = S3[2] === 1;
    const rem = won ? 0 : tg - d.steps;
    const rf = G.clamp(rem / tg, 0, 1);

    // ---------------- background
    if (st === 2) bgWald(dc, t, live);
    else if (st === 3) bgLava(dc, t, live);
    else bgVerlies(dc, t, live);

    // ---------------- monster / chest
    const ms = msprite(m, 0);
    const mw = ms[0] * SC, mh = ms[1] * SC;
    let mf = 0, mdy = 0, mdx = 0;
    if (live) {
      if (m === 0) mf = Math.floor(t / 400) % 2;
      else if (m === 2) { mf = Math.floor(t / 125) % 2; mdy = Math.floor(t / 250) % 2 === 0 ? 0 : 4; }
      else mf = Math.floor(t / 600) % 2;
    }
    const hov = m === 2 ? 44 : 0;
    // ground shadows
    dc.setColor(SHD[st - 1], -1);
    dc.fillRectangle(HX + 20, GY - 4, 48, 4);
    if (!won || p < 0.72) dc.fillRectangle(MX - mw / 2 + (m === 2 ? 24 : 8), GY - 4, mw - (m === 2 ? 48 : 16), 4);
    else dc.fillRectangle(MX - 24, GY - 4, 48, 4);
    const mvis = p >= 0.22 && (!won || p < 0.62 || (p < 0.74 && Math.floor(p * 50) % 2 === 0));
    if (mvis) {
      const flash = (p >= 0.22 && p < 0.27) || (p >= 0.3 && p < 0.33) || (p >= 0.48 && p < 0.52);
      if (p >= 0.48 && p < 0.62) mdx = Math.floor(p * 60) % 2 === 0 ? 4 : -4;
      const pal = flash ? [0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff] : MPAL[m];
      SPR.draw(dc, msprite(m, mf), MX - mw / 2 + mdx, GY - mh - hov + mdy, SC, pal, false);
    }
    if (won && p >= 0.72) {
      const cp = G.spring(G.stag(p, 1, 0.72, 0.14));
      const open = p >= 0.86;
      const cs = open ? SP.CHEST_O : SP.CHEST_C;
      SPR.draw(dc, cs, MX - 28, GY - cs[1] * SC - Math.round((1 - cp) * 60 / 4) * 4, SC, CPAL, false);
      // coins popping out
      if (open && p < 1) {
        const q = (p - 0.86) / 0.14;
        dc.setColor(0xf2c040, -1);
        for (let i = 0; i < 3; i++) {
          const cx = MX - 4 + (i - 1) * Math.round(q * 9) * 4;
          const cy = GY - 60 - Math.round((q * 4 - q * q * 3.2) * (i === 1 ? 9 : 6)) * 4;
          dc.fillRectangle(cx, cy, 8, 8);
        }
      }
      // sparkles
      if (p >= 1) {
        for (let i = 0; i < 3; i++) {
          const ph = live ? Math.floor(t / 180 + i * 3) % 8 : i === 1 ? 2 : 7;
          if (ph > 3) continue;
          const sx = MX - 36 + i * 32, sy = GY - 76 + ((i * 20) % 28);
          const r = ph === 1 || ph === 2 ? 8 : 4;
          dc.setColor(ph === 1 || ph === 2 ? 0xffffff : 0xfff0a0, -1);
          dc.fillRectangle(sx - 2, sy - r, 4, r * 2);
          dc.fillRectangle(sx - r, sy - 2, r * 2, 4);
        }
      }
    }

    // ---------------- hero
    let hx = HX, hs = SP.HERO_A;
    if (p >= 0.36 && p < 0.46) hx = HX + Math.round(G.easeInOut((p - 0.36) / 0.1) * 28) * 4;
    else if (p >= 0.46 && p < 0.6) { hx = HX + 112; hs = SP.HERO_ATK; }
    else if (p >= 0.6 && p < 0.72) hx = HX + Math.round((1 - G.easeInOut((p - 0.6) / 0.12)) * 28) * 4;
    else if (live && Math.floor(t / 500) % 2 === 1) hs = SP.HERO_B;
    const HPAL = [0x140f1e, 0xdfe6f2, 0x9aa6c2, 0x56607e, 0xf2c294, acc, G.dim(acc, 0.55), 0x3866d0, 0xf2c040, 0xffffff, 0x8a5a2c, 0x4a2e1e];
    SPR.draw(dc, hs, hx, GY - hs[1] * SC, SC, HPAL, false);
    // slash streak
    if (p >= 0.47 && p < 0.57) {
      const sp = (p - 0.47) / 0.1;
      for (let k = 0; k < 12; k++) {
        if (k > sp * 15) break;
        const sx = MX + 48 - k * 8, sy = GY - 108 + k * 8;
        dc.setColor(k > sp * 15 - 4 ? 0xffffff : G.mix(acc, 0xffffff, 0.35), -1);
        dc.fillRectangle(sx, sy, 8, 8);
        dc.setColor(G.mix(acc, 0xffffff, 0.6), -1);
        dc.fillRectangle(sx + 8, sy - 4, 4, 4);
      }
    }
    // victory banner
    if (won && p >= 0.8) {
      const vs = G.spring(G.stag(p, 1, 0.8, 0.15));
      const sc = Math.max(1, Math.round(4 * vs));
      dc.setColor(0x3a1a00, -1);
      F.px(dc, "SIEG!", 230, 236 - 3 * sc, sc, 1, 0);
      dc.setColor(0xffd040, -1);
      F.px(dc, "SIEG!", 227, 233 - 3 * sc, sc, 1, 0);
    }

    // ---------------- time window + date tag
    win(dc, 92, 48, 270, 78, st);
    const ts = G.timeStr(d);
    dc.setColor(WIN[(st - 1) * 3 + 1] === 0x111a56 ? 0x0a0e30 : G.dim(WIN[(st - 1) * 3 + 1], 0.6), -1);
    F.px(dc, ts, 231, 63, 8, 1, 0);
    dc.setColor(0xffffff, -1);
    F.px(dc, ts, 227, 59, 8, 1, 0);
    const ds = d.dowStr + " " + d.day + ". " + d.monStr;
    const dw = F.pxW(ds, 2) + 20;
    win(dc, 227 - dw / 2, 116, dw, 24, st);
    dc.setColor(0xd8dce8, -1);
    F.px(dc, ds, 227, 121, 2, 1, 0);

    // ---------------- hero status
    win(dc, 50, 142, 136, 62, st);
    dc.setColor(0xffffff, -1);
    F.px(dc, "HELD", 60, 151, 2, 0, 0);
    dc.setColor(0xffd040, -1);
    F.px(dc, "LV" + levelOf(gold), 176, 151, 2, 2, 0);
    const hp = d.bb, mp = d.stress >= 0 ? 100 - d.stress : -1;
    const bp = G.ease(G.stag(p, 1, 0.3, 0.4));
    dc.setColor(0xa8b0c8, -1);
    F.px(dc, "HP", 60, 168, 2, 0, 0);
    F.px(dc, "MP", 60, 184, 2, 0, 0);
    bar(dc, 86, 170, 50, 10, (hp < 0 ? 0 : hp / 100.0) * bp, hp < 25 ? 0xff5a3a : 0x48d860);
    bar(dc, 86, 186, 50, 10, (mp < 0 ? 0 : mp / 100.0) * bp, 0x4a9aff);
    dc.setColor(0xffffff, -1);
    F.px(dc, hp < 0 ? "--" : "" + hp, 176, 168, 2, 2, 0);
    F.px(dc, mp < 0 ? "--" : "" + mp, 176, 184, 2, 2, 0);

    // ---------------- monster status
    win(dc, 268, 142, 136, 62, st);
    dc.setColor(m === 6 ? 0xff6a4a : 0xffffff, -1);
    F.px(dc, NAMES[m], 336, 151, 2, 1, 0);
    const hf = G.lerp(1, rf, G.easeInOut(G.stag(p, 1, 0.5, 0.3)));
    bar(dc, 278, 170, 116, 10, hf, hf > 0.5 ? 0x48d860 : hf > 0.25 ? 0xf0c040 : 0xff4a3d);
    if (won && p >= 0.75) {
      dc.setColor(0x60e070, -1);
      F.px(dc, "BESIEGT", 336, 185, 2, 1, 0);
    } else {
      dc.setColor(0xa8b0c8, -1);
      F.px(dc, m === 6 ? "BOSS" : "HP", 278, 185, 2, 0, 0);
      dc.setColor(0xffffff, -1);
      F.px(dc, G.num(Math.round(tg * hf)), 394, 185, 2, 2, 0);
    }

    // ---------------- battle log
    win(dc, 76, 302, 302, 84, st);
    let l1, l2;
    if (won) { l1 = NAMES[m] + " besiegt!"; l2 = "Beute: +1 Gold"; }
    else {
      l1 = NAMES[m] + (rf > 0.75 ? " erscheint!" : rf > 0.25 ? " greift an!" : " wankt!");
      l2 = "Noch " + G.num(rem) + " Schritte";
    }
    const n1 = Math.floor(l1.length * G.stag(p, 1, 0.55, 0.22));
    const n2 = Math.floor(l2.length * G.stag(p, 1, 0.75, 0.22));
    dc.setColor(0xffffff, -1);
    if (n1 > 0) F.px(dc, l1.substring(0, n1), 90, 312, 2, 0, 0);
    dc.setColor(won ? 0xffd040 : 0xd8dce8, -1);
    if (n2 > 0) F.px(dc, l2.substring(0, n2), 90, 333, 2, 0, 0);
    // footer: gold + streak + cursor
    dc.setColor(G.mix(WIN[(st - 1) * 3 + 1], 0xffffff, 0.25), -1);
    dc.fillRectangle(88, 354, 278, 2);
    SPR.draw(dc, SP.COIN, 100, 361, 2, COINPAL, false);
    dc.setColor(0xffd040, -1);
    F.px(dc, gold + " Gold", 116, 361, 2, 0, 0);
    SPR.draw(dc, SP.FL_A, 216, 361, 2, FPAL, false);
    dc.setColor(ser > 0 ? 0xffffff : 0x8890a8, -1);
    F.px(dc, ser + (ser === 1 ? " Sieg" : " Siege"), 232, 361, 2, 0, 0);
    if (p >= 1 && (!live || Math.floor(t / 500) % 2 === 0)) {
      dc.setColor(acc, -1);
      dc.fillRectangle(350, 364, 10, 2);
      dc.fillRectangle(352, 366, 6, 2);
      dc.fillRectangle(354, 368, 2, 2);
    }

    // damage number
    if (p >= 0.53 && p < 0.94) {
      const dp = G.stag(p, 1, 0.53, 0.16);
      const sc = Math.max(1, Math.round(1 + 3 * G.spring(dp)));
      const ds = d.steps > 0 ? "-" + d.steps : "VERFEHLT";
      const dy = GY - mh / 2 - hov - 24 - Math.round(G.ease((p - 0.5) / 0.44) * 5) * 4;
      dc.setColor(0x000000, -1);
      F.px(dc, ds, MX + 3, dy + 3, sc, 1, 0);
      dc.setColor(d.steps > 0 ? 0xffffff : 0xa0a0a0, -1);
      F.px(dc, ds, MX, dy, sc, 1, 0);
    }

    // ---------------- intro: battle wipe (horizontal bars)
    if (p < 0.3) {
      dc.setColor(0x000000, -1);
      for (let i = 0; i < 10; i++) {
        const e = G.easeInOut(G.stag(p, i, 0.012, 0.16));
        const w = Math.round(454 * (1 - e));
        if (w <= 0) continue;
        dc.fillRectangle(i % 2 === 0 ? 0 : 454 - w, i * 46, w, 46);
      }
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const m = monster(d);
    const won = d.steps >= target(d, m);
    dc.setColor(0x8a8e9e, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 70 + o[1], 8, 1, 2);
    dc.setColor(0x6a6e7e, -1);
    F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227 + o[0], 140 + o[1], 2, 1, 0);
    const out = [0x4a5468, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
    SPR.draw(dc, SP.HERO_A, HX + o[0], GY - 80 + o[1], SC, out, false);
    if (won) {
      out[0] = 0x6a5a2a;
      SPR.draw(dc, SP.CHEST_C, MX - 28 + o[0], GY - 44 + o[1], SC, out, false);
    } else {
      const ms = msprite(m, 0);
      out[0] = G.dim(m === 6 ? 0xff4a3d : d.accent, 0.45);
      SPR.draw(dc, ms, MX - (ms[0] * SC) / 2 + o[0], GY - ms[1] * SC - (m === 2 ? 44 : 0) + o[1], SC, out, false);
    }
    dc.setColor(0x2a2c36, -1);
    for (let x = 60; x < 400; x += 12) dc.fillRectangle(x + o[0], GY + 4 + o[1], 4, 4);
    dc.setColor(won ? 0x8a7430 : 0x6a6e7e, -1);
    F.px(dc, won ? "SIEG!" : "Noch " + G.num(target(d, m) - d.steps), 227 + o[0], 322 + o[1], 2, 1, 0);
  },
};
