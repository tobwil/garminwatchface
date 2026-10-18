// INNEN — "Innenwetter": your state as the weather over a little landscape, with you standing in it.
// Top fit is sunshine (you cheer), solid is fair weather, tired is cloudy, a short night is fog,
// exhausted is rain (you hold an umbrella), stress is a thunderstorm, and while the Body Battery is
// clearly charging a rainbow appears. Day and night follow the real sun. The caption says why, and
// compares with the real weather outside. Styles: 1 Wiese, 2 Pastell, 3 Gameboy.
// Mirrors watch/source/faces/Innen.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import { SPR, encodeAll } from "../engine/spr.js";
import { IN } from "../engine/insight.js";
import S from "../sprites/innen.js";

const SP = encodeAll(S);
const GND = 300;
const WN = ["SONNIG", "HEITER", "BEWÖLKT", "NEBEL", "REGEN", "GEWITTER", "REGENBOGEN"];
const CL = [96, 120, 300, 92, 200, 150, 360, 168]; // cloud spots
const RB = [0xff3a3a, 0xffa02a, 0xffe03a, 0x3ae07a, 0x3a8aff, 0x8a5aff];

// inner weather: 0 sunny, 1 fair, 2 cloudy, 3 fog, 4 rain, 5 storm, 6 rainbow
function weather(d) {
  const r = IN.ready(d);
  const st = IN.state(d, r[0]);
  if (st === 4) return 5;
  if (IN.bbRate(d) >= 6) return 6;
  if (st === 3) return 4;
  if (d.sleep >= 0 && d.sleep < 50) return 3;
  if (st === 2) return 2;
  return st === 1 ? 1 : 0;
}

function why(d, w) {
  const r = IN.ready(d);
  if (w === 0) return "AKKU " + d.bb + "%, AUSGERUHT";
  if (w === 1) return "SOLIDE FORM (" + r[0] + ")";
  if (w === 3) return "SCHLAF NUR " + d.sleep;
  if (w === 5) return "STRESS " + IN.stress2h(d) + " SEIT 2 STD";
  if (w === 6) return "AKKU LÄDT +" + IN.bbRate(d) + "/STD";
  const k = IN.worst(r);
  return k >= 0 ? IN.reason(d, k) : "ETWAS MÜDE";
}

// [sky top day, sky low day, sky top grey, sky low grey, sky top night, sky low night, hill far, hill near,
//  cloud, cloud dark, rain, sun, text, text dim, shirt, skin, eye, trousers, shoes, hair, umbrella, star]
function pal(st, acc) {
  if (st === 2) return [0x8ac8f0, 0xf0e0f0, 0xa8a8c0, 0xd8d0e0, 0x1a1a3a, 0x3a2a5a, 0x9ad8b0, 0x7ac89a, 0xffffff,
    0xc8c0d8, 0x8ab8ff, 0xffe08a, 0x2a2a4a, 0x5a5a7a, acc, 0xf2c08a, 0x1a1a1a, 0x5a6a9a, 0x3a2a2a, 0x5a3a2a, 0xff7aa8, 0xffffff];
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [c, e, b, c, a, b, b, a, e, c, a, e, a, b, a, e, a, a, a, a, b, e];
  }
  return [0x2a7ad8, 0x9ad4ff, 0x5a6878, 0x9aa4b0, 0x060a20, 0x18204a, 0x3a8a3a, 0x2a6a2a, 0xffffff, 0xb0b8c4,
    0x8ac8ff, 0xfff2a0, 0xffffff, 0xe8f0e8, acc, 0xf2c08a, 0x1a1a1a, 0x3a4a6a, 0x2a2a2a, 0x5a3a1a, 0xff4a6a, 0xffffff];
}

export default {
  fps: 10,

  // static layer: sky, rainbow, hills, texts; sun, clouds, rain, fog, lightning and you move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const w = weather(d);
    const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const night = el < -6;
    const grey = w >= 2 && w <= 5;
    const dim = night && st !== 3 ? 0.55 : 0;

    if (S) {
      // ---- sky: day / grey / night
      const top = night ? P[4] : grey ? P[2] : P[0], low = night ? P[5] : grey ? P[3] : P[1];
      for (let i = 0; i < 10; i++) {
        dc.setColor(G.mix(top, low, i / 9), -1);
        dc.fillRectangle(0, i * 30, 454, 30);
      }
      if (night && w <= 1) {
        dc.setColor(P[21], -1);
        for (let i = 0; i < 26; i++) {
          const r = G.rnd(i * 7919 + 13);
          dc.fillRectangle(30 + (r % 394), 90 + ((r >> 9) % 170), 2, 2);
        }
      }
      // ---- rainbow while the battery charges
      if (w === 6) {
        for (let i = 0; i < 6; i++) {
          dc.setColor(night ? G.mix(RB[i], 0, 0.5) : RB[i], -1);
          dc.setPenWidth(8);
          G.arcC(dc, 227, GND + 20, 190 - i * 8, -78, 78);
        }
      }
      // ---- hills
      dc.setColor(G.mix(P[6], 0x050814, dim), -1);
      for (let x = 0; x < 454; x += 4) {
        const h = 40 + Math.round(22 * Math.sin(x / 70 + 1) + 10 * Math.sin(x / 27));
        dc.fillRectangle(x, GND - h + 20, 4, h);
      }
      dc.setColor(G.mix(P[7], 0x050814, dim), -1);
      dc.fillRectangle(0, GND, 454, 154);
      // ---- time, inner weather, the reason, the weather outside
      if (st !== 2) {
        dc.setColor(0x000000, -1);
        F.st(dc, G.timeStr(d), 229, 40, 44, 6, 1, 1, 0);
      }
      dc.setColor(P[12], -1);
      F.st(dc, G.timeStr(d), 227, 38, 44, 6, 1, 1, 0);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 70, 2, 1, 0);
      F.px(dc, "INNEN: " + (night && w <= 1 ? "STERNKLAR" : WN[w]), 227, 362, 2, 1, 0);
      dc.setColor(P[13], -1);
      F.px(dc, why(d, w), 227, 384, 2, 1, 0);
      const cn = IN.condName(d.cond);
      if (d.temp > -99) F.px(dc, "DRAUSSEN: " + d.temp + "°" + (cn ? " " + cn : ""), 227, 406, 2, 1, 0);
    }

    if (!M) return;
    // ---- sun (rays turn slowly), clouds drifting in, fog, rain and lightning
    if ((w <= 1 || w === 6) && !night) {
      const sx = 120, sy = 140;
      dc.setColor(P[11], -1);
      dc.fillCircle(sx, sy, 26);
      for (let i = 0; i < 8; i++) {
        const an = (i * 45 + tt / 60) * Math.PI / 180;
        dc.fillRectangle(Math.round(sx + Math.cos(an) * 40) - 3, Math.round(sy + Math.sin(an) * 40) - 3, 6, 6);
      }
    }
    const nc = [0, 2, 3, 3, 4, 4, 1][w];
    const cin = G.ease(G.clamp(p / 0.7, 0, 1));
    const dark = w >= 4 && w <= 5 ? 0.45 : night ? 0.6 : 0;
    for (let i = 0; i < nc; i++) {
      const x = Math.round(CL[i * 2] + (1 - cin) * (i % 2 === 0 ? -260 : 260) + Math.sin(tt / 3000 + i) * 12);
      const y = CL[i * 2 + 1];
      dc.setColor(G.mix(P[8], 0x303848, dark), -1);
      dc.fillRectangle(x - 44, y, 88, 20);
      dc.fillRectangle(x - 26, y - 16, 50, 16);
      dc.setColor(G.mix(P[9], 0x202838, dark), -1);
      dc.fillRectangle(x - 44, y + 14, 88, 6);
    }
    if (w === 3) {
      dc.setColor(G.mix(P[3], 0xffffff, 0.35), -1);
      for (let i = 0; i < 5; i++) {
        const fx = Math.round(((tt / 40 + i * 97) % 560) - 100);
        dc.fillRectangle(fx, 200 + i * 22, 220, 8);
      }
    }
    if ((w === 4 || w === 5) && p > 0.3) {
      dc.setColor(G.mix(P[10], 0, night ? 0.4 : 0), -1);
      for (let i = 0; i < 34; i++) {
        const x = (i * 83 + Math.floor(tt / 14)) % 440 + 6;
        const y = (i * 47 + Math.floor(tt / 5)) % (GND - 140) + 150;
        dc.fillRectangle(x, y, 2, 10);
      }
    }
    if (w === 5 && live && Math.floor(tt / 90) % 29 === 0) {
      dc.setColor(0xffffff, -1);
      for (let i = 0; i < 7; i++) dc.fillRectangle(330 - (i % 2) * 12 - i * 3, 136 + i * 18, 6, 18);
    }
    // ---- you: cheering in the sun, under an umbrella in the rain
    const pp = [-1, P[14], P[15], P[16], P[17], P[18], P[19]];
    const hop = w === 0 && live ? Math.abs(Math.round(Math.sin(tt / 240) * 8)) : 0;
    SPR.draw(dc, w === 0 || w === 6 ? SP.CHEER : SP.STAND, 300, GND - 56 - hop, 4, pp, false);
    if (w === 4 || w === 5) {
      dc.setColor(P[20], -1);
      dc.fillRectangle(296, GND - 82, 56, 8);
      dc.fillRectangle(306, GND - 90, 36, 8);
      dc.fillRectangle(322, GND - 74, 4, 22);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    dc.setColor(st === 3 ? 0x306230 : 0x3a3a42, -1);
    dc.fillRectangle(o[0], GND + o[1], 454, 2);
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a8a, -1);
    F.st(dc, G.timeStr(d), 227 + o[0], 38 + o[1], 44, 3, 1, 1, 0);
    F.px(dc, "INNEN: " + WN[weather(d)], 227 + o[0], 362 + o[1], 2, 1, 0);
  },
};
