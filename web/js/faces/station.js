// STATION — "Wetterstation": a pixel weather station in a meadow, and every instrument reads a real
// sensor. The cup anemometer spins at the real wind speed while the vane turns into the wind, the
// thermometer shows the temperature (today's low and high beside it), the rain gauge fills with the
// chance of rain, the barometer on the instrument hut points at the air pressure (altitude below).
// Over it all the sun travels its real arc from sunrise to sunset, at night the moon shows its phase;
// clouds, rain, snow and lightning follow the reported condition. On every wrist raise the cups spin
// up, the mercury climbs and the gauge fills. Styles: 1 Messgarten, 2 Polar, 3 Gameboy.
// Mirrors watch/source/faces/Station.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";

const GND = 300; // ground line
const AX = 84; // anemometer mast
const TX = 170; // thermometer
const RX = 250; // rain gauge
const BX = 340; // barometer / hut
const DIRS = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];

// Garmin condition -> [clouds 0..3, rain 0..3, snow 0..3, storm, fog, name]
function sky(c) {
  if (c === 0 || c === 23 || c === 39) return [0, 0, 0, false, false, "KLAR"];
  if (c === 22 || c === 1 || c === 51) return [1, 0, 0, false, false, "HEITER"];
  if (c === 2) return [2, 0, 0, false, false, "BEWÖLKT"];
  if (c === 20) return [3, 0, 0, false, false, "BEDECKT"];
  if (c === 5) return [1, 0, 0, false, false, "WINDIG"];
  if (c === 14 || c === 26 || c === 30 || c === 44 || c === 11 || c === 13) return [2, 1, 0, false, false, "NIESELN"];
  if (c === 3 || c === 24 || c === 48 || c === 49) return [3, 2, 0, false, false, "REGEN"];
  if (c === 15 || c === 25) return [3, 3, 0, false, false, "STARKREGEN"];
  if (c === 16 || c === 42 || c === 45 || c === 47 || c === 33) return [2, 0, 1, false, false, "LEICHTER SCHNEE"];
  if (c === 4 || c === 7 || c === 18 || c === 21 || c === 43 || c === 46 || c === 50 || c === 10) return [3, 0, 2, false, false, "SCHNEE"];
  if (c === 17 || c === 19) return [3, 0, 3, false, false, "SCHNEESTURM"];
  if (c === 6 || c === 12 || c === 27 || c === 31 || c === 35 || c === 40 || c === 41) return [3, 2, 0, true, false, "GEWITTER"];
  if (c === 8 || c === 9 || c === 28 || c === 38 || c === 29 || c === 32 || c === 34 || c === 36 || c === 37) return [2, 0, 0, false, true, "NEBEL"];
  return [1, 0, 0, false, false, "WETTER"];
}

function moonName(k) {
  if (k < 0.03 || k > 0.97) return "NEUMOND";
  if (Math.abs(k - 0.5) < 0.03) return "VOLLMOND";
  return k < 0.5 ? "MOND ZUNEHMEND" : "MOND ABNEHMEND";
}

function moon(dc, P, cx, cy, r, k) {
  for (let y = -r; y < r; y += 4) {
    const yy = y + 2;
    const hw = Math.floor(Math.sqrt(r * r - yy * yy) / 4) * 4;
    if (hw <= 0) continue;
    dc.setColor(P[23], -1);
    dc.fillRectangle(cx - hw, cy + y, 2 * hw, 4);
    const x0 = k < 0.5 ? Math.round(hw * Math.cos(k * 2 * Math.PI) / 4) * 4 : -hw;
    const x1 = k < 0.5 ? hw : Math.round(hw * Math.cos((k - 0.5) * 2 * Math.PI) / 4) * 4;
    if (x1 > x0) {
      dc.setColor(P[22], -1);
      dc.fillRectangle(cx + x0, cy + y, x1 - x0, 4);
    }
  }
}

// [sky top day, low day, top dusk, low dusk, top night, low night, grey top, grey low, cloud, cloud shade,
//  ground, ground dark, snow, metal, metal dark, white, glass, mercury, water, text, text dim, sun, moon lit,
//  moon dark, drop, needle, star]
function pal(st, acc) {
  if (st === 2) return [0x5a8ac8, 0xd0e8f8, 0x4a4a8a, 0xf0a8a0, 0x040818, 0x101c3a, 0x7a8696, 0xb8c0c8, 0xffffff,
    0xc8d0dc, 0xe8f0f8, 0xc0cce0, 0xffffff, 0x8a94a4, 0x4a5464, 0xf4f8fc, 0xd8ecff, 0xe03a3a, 0x3a8ae8, 0x1a2a4a,
    0x4a5a7a, 0xfff2b0, 0xf4f0d8, 0x3a3a48, 0x8ac8ff, acc, 0xffffff];
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [c, e, b, c, a, b, b, c, e, c, b, a, e, a, a, e, e, a, a, a, a, e, e, b, a, a, e];
  }
  return [0x3a8ad8, 0xa8d8ff, 0x5a4a9a, 0xff9a6a, 0x060a20, 0x141c44, 0x7a8696, 0xaeb6c0, 0xffffff, 0xd0d8e4,
    0x4a9a3a, 0x3a7a2a, 0xf4f8fc, 0x9aa4b4, 0x4a5464, 0xf4f4f0, 0xe8f4ff, 0xe03a3a, 0x3a8ae8, 0xffffff, 0xd8e8d0,
    0xfff2b0, 0xf4f0d8, 0x3a3a48, 0x8ac8ff, acc, 0xffffff];
}

export default {
  fps: 12,

  // static layer: sky, sun arc with sun / moon, clouds, meadow, masts, thermometer, gauge, hut,
  // barometer, labels; the cups, the vane, mercury and water during the raise, rain, snow and lightning move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const W = sky(d.cond);
    const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const k = el > 6 ? 0 : el > -6 ? 1 : 2;
    const grey = W[0] >= 3 && k === 0;
    const snowy = st === 2 || W[2] > 0;
    const temp = d.temp > -99 ? d.temp : 0;
    const rain = d.rain >= 0 ? d.rain : 0;
    const grow = G.ease(G.clamp(p / 0.8, 0, 1)); // instruments rise on the raise

    if (S) {
      // ---- sky
      const top = grey ? P[6] : P[k * 2], low = grey ? P[7] : P[k * 2 + 1];
      for (let i = 0; i < 6; i++) {
        dc.setColor(G.mix(top, low, i / 5), -1);
        dc.fillRectangle(0, i * 50, 454, 50);
      }
      if (k === 2 && W[0] < 3) {
        dc.setColor(P[26], -1);
        for (let i = 0; i < 24; i++) dc.fillRectangle(30 + ((i * 101 + 17) % 394), 90 + ((i * 47 + 11) % 150), 2, 2);
      }
      // ---- sun arc from sunrise to sunset, the sun on it (or the moon at night)
      const sr = d.sunrise > 0 ? d.sunrise : 390, ss = d.sunset > 0 ? d.sunset : 1140;
      dc.setColor(G.mix(low, 0xffffff, 0.35), -1);
      for (let i = 0; i <= 40; i++) {
        const an = Math.PI * (1 - i / 40);
        dc.fillRectangle(Math.round(227 + Math.cos(an) * 170) - 1, Math.round(GND - 10 - Math.sin(an) * 170) - 1, 2, 2);
      }
      if (d.mins >= sr && d.mins <= ss) {
        const an = Math.PI * (1 - (d.mins - sr) / Math.max(1, ss - sr));
        dc.setColor(P[21], -1);
        dc.fillCircle(Math.round(227 + Math.cos(an) * 170), Math.round(GND - 10 - Math.sin(an) * 170), 12);
      } else {
        moon(dc, P, 360, 104, 18, d.moon >= 0 ? d.moon : 0.5);
      }
      dc.setColor(P[20], -1);
      F.px(dc, G.hm(sr), 50, GND - 22, 1, 1, 0);
      F.px(dc, G.hm(ss), 404, GND - 22, 1, 1, 0);
      // ---- clouds by condition
      const CL = [130, 112, 300, 96, 210, 130];
      for (let i = 0; i < Math.min(3, W[0]); i++) {
        const x = CL[i * 2], y = CL[i * 2 + 1];
        dc.setColor(G.mix(P[8], 0x404858, W[1] > 1 || W[3] ? 0.45 : k === 2 ? 0.6 : 0), -1);
        dc.fillRectangle(x - 36, y, 72, 16);
        dc.fillRectangle(x - 22, y - 12, 40, 12);
        dc.setColor(G.mix(P[9], 0x303848, W[1] > 1 || W[3] ? 0.45 : k === 2 ? 0.6 : 0), -1);
        dc.fillRectangle(x - 36, y + 12, 72, 4);
      }
      if (W[4]) {
        dc.setColor(G.mix(low, 0xffffff, 0.4), -1);
        for (let y = 200; y < GND; y += 14) dc.fillRectangle(0, y, 454, 6);
      }

      // ---- meadow
      const gc = snowy ? P[12] : P[10];
      dc.setColor(k === 2 ? G.mix(gc, 0x050814, 0.6) : gc, -1);
      dc.fillRectangle(0, GND, 454, 154);
      dc.setColor(k === 2 ? G.mix(P[11], 0x050814, 0.6) : P[11], -1);
      for (let x = 0; x < 454; x += 14) dc.fillRectangle(x + ((x / 14) % 3) * 4, GND + 6 + ((x * 13) % 40), 4, 2);

      // ---- anemometer mast
      dc.setColor(P[14], -1);
      dc.fillRectangle(AX - 2, 162, 4, GND - 162);
      // ---- thermometer with scale -20..40
      dc.setColor(P[13], -1);
      dc.fillRectangle(TX - 22, 128, 44, GND - 128);
      dc.setColor(P[16], -1);
      dc.fillRectangle(TX - 6, 136, 12, 140);
      dc.fillCircle(TX, 284, 10);
      dc.setColor(P[14], -1);
      for (let t = -20; t <= 40; t += 10) {
        const y = 270 - Math.round(((t + 20) / 60) * 130);
        dc.fillRectangle(TX - 18, y, 8, 2);
        F.px(dc, "" + t, TX + 14, y - 3, 1, 0, 0);
      }
      // ---- rain gauge
      dc.setColor(P[13], -1);
      dc.fillRectangle(RX - 22, 214, 44, 8);
      dc.fillRectangle(RX - 16, 222, 32, 6);
      dc.setColor(P[16], -1);
      dc.fillRectangle(RX - 12, 228, 24, GND - 228);
      dc.setColor(P[14], -1);
      for (let i = 1; i < 5; i++) dc.fillRectangle(RX + 6, GND - i * 14, 6, 2);
      // ---- instrument hut with the barometer above
      dc.setColor(P[14], -1);
      dc.fillRectangle(BX - 32, 262, 4, GND - 262);
      dc.fillRectangle(BX + 28, 262, 4, GND - 262);
      dc.fillRectangle(BX - 2, 186, 4, 20);
      dc.setColor(P[15], -1);
      dc.fillRectangle(BX - 40, 204, 80, 60);
      dc.setColor(G.mix(P[15], P[14], 0.35), -1);
      for (let y = 212; y < 260; y += 8) dc.fillRectangle(BX - 34, y, 68, 3);
      dc.setColor(P[13], -1);
      dc.fillCircle(BX, 156, 32);
      dc.setColor(P[15], -1);
      dc.fillCircle(BX, 156, 27);
      dc.setColor(P[14], -1);
      for (let i = 0; i <= 8; i++) {
        const an = (-120 + i * 30) * Math.PI / 180;
        dc.fillRectangle(Math.round(BX + Math.sin(an) * 22) - 1, Math.round(156 - Math.cos(an) * 22) - 1, 3, 3);
      }
      const pr = d.pres > 0 ? d.pres / 100 : 1013;
      const pa = (-120 + G.clamp((pr - 970) / 80, 0, 1) * 240) * Math.PI / 180;
      dc.setColor(P[25], -1);
      for (let r = 0; r < 20; r += 2) dc.fillRectangle(Math.round(BX + Math.sin(pa) * r) - 2, Math.round(156 - Math.cos(pa) * r) - 2, 4, 4);
      dc.setColor(P[14], -1);
      dc.fillRectangle(BX - 3, 153, 6, 6);

      // ---- readings under the instruments
      const txt = snowy && k < 2 ? 0x1a2a4a : P[19], dim = snowy && k < 2 ? 0x4a5a7a : P[20];
      dc.setColor(txt, -1);
      const wd = d.wind >= 0 ? Math.round(d.wind) + " M/S" : "--";
      const dir = DIRS[Math.round(((d.windDeg % 360) + 360) % 360 / 45) % 8];
      F.px(dc, wd, AX, 314, 2, 1, 0);
      F.px(dc, d.temp > -99 ? d.temp + "°" : "--", TX, 314, 2, 1, 0);
      F.px(dc, d.rain >= 0 ? rain + "%" : "--", RX, 314, 2, 1, 0);
      F.px(dc, d.pres > 0 ? Math.round(pr) + "" : "--", BX, 314, 2, 1, 0);
      dc.setColor(dim, -1);
      F.px(dc, "WIND " + dir, AX, 334, 1, 1, 0);
      F.px(dc, d.hiT > -99 ? d.loT + "-" + d.hiT + "°" : "TEMP", TX, 334, 1, 1, 0);
      F.px(dc, "REGEN", RX, 334, 1, 1, 0);
      F.px(dc, "HPA" + (d.alt >= 0 ? " " + Math.round(d.alt) + "M" : ""), BX, 334, 1, 1, 0);

      // ---- time, condition, moon
      dc.setColor(0x000000, -1);
      F.px(dc, G.timeStr(d), 229, 26, 5, 1, 0);
      dc.setColor(st === 3 ? 0x0f380f : 0xffffff, -1);
      F.px(dc, G.timeStr(d), 227, 24, 5, 1, 0);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 68, 1, 1, 0);
      dc.setColor(txt, -1);
      F.px(dc, W[5], 227, 362, 2, 1, 0);
      dc.setColor(dim, -1);
      F.px(dc, moonName(d.moon >= 0 ? d.moon : 0.5), 227, 384, 2, 1, 0);
    }

    if (!M) return;
    // ---- mercury and rain water (climb on every raise)
    const ty = Math.round(((G.clamp(temp, -20, 40) + 20) / 60) * 130 * grow);
    dc.setColor(P[17], -1);
    dc.fillRectangle(TX - 3, 272 - ty, 6, ty + 4);
    dc.fillCircle(TX, 284, 7);
    const wh = Math.round((rain / 100) * (GND - 232) * grow);
    dc.setColor(P[18], -1);
    dc.fillRectangle(RX - 10, GND - wh, 20, wh);
    // ---- cup anemometer spins with the wind (spins up on the raise), vane turns into the wind
    const ws = d.wind >= 0 ? d.wind : 2;
    const rot = (live ? tt : 0) * (0.0015 + ws * 0.0009) + (p < 1 ? (1 - p) * 6 : 0);
    dc.setColor(P[14], -1);
    dc.fillRectangle(AX - 3, 154, 6, 10);
    for (let i = 0; i < 3; i++) {
      const an = rot + (i * 2 * Math.PI) / 3;
      const x = Math.round(AX + Math.cos(an) * 30), z = Math.sin(an);
      const n = Math.max(1, Math.round(Math.abs(x - AX) / 4));
      dc.setColor(P[14], -1);
      for (let j = 1; j <= n; j++) dc.fillRectangle(Math.round(AX + ((x - AX) * j) / n) - 1, 157, 3, 2);
      dc.setColor(z > 0 ? P[13] : P[25], -1);
      dc.fillRectangle(x - 6, 152, 12, 10);
    }
    const wa = ((d.windDeg + (live ? Math.sin(tt / 600) * 8 : 0)) * Math.PI) / 180;
    const vx = Math.round(Math.sin(wa) * 34);
    dc.setColor(P[14], -1);
    dc.fillRectangle(AX - Math.abs(vx), 206, 2 * Math.abs(vx) + 1, 3);
    dc.setColor(P[25], -1);
    dc.fillRectangle(AX + vx - 4, 202, 8, 10);
    dc.setColor(P[13], -1);
    dc.fillRectangle(AX - vx - 6, 200, 12, 14);
    // ---- rain, snow, lightning
    if (W[1] > 0 || W[2] > 0) {
      const n = (W[1] + W[2]) * 10;
      dc.setColor(W[2] > 0 ? P[12] : P[24], -1);
      for (let i = 0; i < n; i++) {
        const sp = W[2] > 0 ? 18 : 5;
        const x = (i * 83 + Math.floor(tt / (sp * 3))) % 440 + 6;
        const y = (i * 47 + Math.floor(tt / sp)) % (GND - 120) + 120;
        dc.fillRectangle(x, y, W[2] > 0 ? 4 : 2, W[2] > 0 ? 4 : 10);
      }
    }
    if (W[3] && live && Math.floor(tt / 90) % 37 === 0) {
      dc.setColor(0xffffff, -1);
      for (let i = 0; i < 6; i++) dc.fillRectangle(300 - (i % 2) * 10 - i * 4, 130 + i * 14, 6, 14);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const c = st === 3 ? 0x306230 : 0x3a3a42;
    dc.setColor(c, -1);
    dc.fillRectangle(o[0], GND + o[1], 454, 2);
    dc.drawRectangle(TX - 6 + o[0], 136 + o[1], 12, 140);
    dc.drawRectangle(BX - 40 + o[0], 204 + o[1], 80, 60);
    dc.fillRectangle(AX - 1 + o[0], 162 + o[1], 2, GND - 162);
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 24 + o[1], 5, 1, 1);
    if (d.temp > -99) F.px(dc, d.temp + "°", TX + o[0], 314 + o[1], 2, 1, 1);
  },
};
