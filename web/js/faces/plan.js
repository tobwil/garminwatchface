// PLAN — "Was geht heute?": the watch's training advice for today, as a little scene. It weighs your
// state (Body Battery, sleep, stress, recovery), the recovery time, the week's training days against
// your goal, the weather outside and the time of day, and suggests: rest day on the sofa, relaxing
// (a breathing guide at six breaths a minute), a walk, an easy ride, an endurance ride, intervals –
// on the indoor trainer when it rains, freezes or is too hot – or, late at night, sleep. Below the
// reasons in plain words. On every wrist raise the scene comes to life (the cranks turn).
// Styles: 1 Hell, 2 Nacht, 3 Akzent. Mirrors watch/source/faces/Plan.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { AST } from "../engine/astro.js";
import { SPR, encodeAll } from "../engine/spr.js";
import { IN } from "../engine/insight.js";
import S from "../sprites/plan.js";

const SP = encodeAll(S);
const GY = 316; // floor / road line of the scene
// activities: 0 rest, 1 relax, 2 walk, 3 easy ride, 4 endurance, 5 intervals, 6 indoor trainer, 7 sleep
const TITLE = ["RUHETAG", "ENTSPANNEN", "SPAZIERGANG", "LOCKER RADELN", "GRUNDLAGE", "INTERVALLE", "ROLLE DRINNEN", "SCHLAFEN"];
const SUB = ["SOFA, TEE, FRÜH INS BETT", "10 MIN ATMEN ODER YOGA", "30 MIN AN DER LUFT", "60 MIN, ZONE 1-2", "90 MIN, ZONE 2",
  "5 X 4 MIN HART", "", "MORGEN GEHT'S WEITER"];
const RIDE = ["", "", "", "60 MIN LOCKER", "90 MIN ZONE 2", "5 X 4 MIN HART"];

// bad weather for being outside: rain chance, frost, heat or a storm
function badWeather(d) {
  return d.rain >= 60 || (d.temp > -99 && (d.temp < 1 || d.temp > 32)) || IN.condName(d.cond) === "GEWITTER";
}

// [activity, outdoor activity it replaces (for the indoor trainer)]
function advise(d) {
  const r = IN.ready(d);
  const st = IN.state(d, r[0]);
  const m = d.mins;
  if (m >= 1320 || m < 330) return [7, 7];
  if (st === 3 || d.recov > 2160) return [0, 0];
  if (st === 4) return [1, 1];
  const done = d.trainDays >= (d.dayGoal > 0 ? d.dayGoal : 4);
  let a = 2;
  if (m >= 1200 || st === 2) a = 2;
  else if (st === 1) a = done ? 3 : 4;
  else a = d.recov >= 0 && d.recov < 720 && !done ? 5 : 4;
  if (badWeather(d)) return a === 2 ? [1, 2] : [6, a];
  return [a, a];
}

// [bg top, bg low, floor, wall line, ink, dim, title, shirt, skin, eye, trousers, shoes, hair, mug, frame,
//  sofa, blanket]
function pal(st, acc) {
  if (st === 2) return [0x0a0e1e, 0x1a2244, 0x16182a, 0x22263a, 0xffffff, 0x8a92b0, acc, acc, 0xf2c08a, 0x1a1a1a,
    0x2a2a3a, 0x141414, 0x5a3a1a, 0xf4f0e6, 0xd8d8e8, 0x5a3a6a, 0x3a5a9a];
  if (st === 3) return [G.mix(acc, 0, 0.75), G.mix(acc, 0, 0.45), G.mix(acc, 0, 0.82), G.mix(acc, 0, 0.6), 0xffffff,
    G.mix(acc, 0xffffff, 0.55), 0xffffff, 0xffffff, 0xf2c08a, 0x1a1a1a, 0x1a1a22, 0x111111, 0x3a2a1a, 0xffffff, 0xffffff, G.mix(acc, 0, 0.5), G.mix(acc, 0xffffff, 0.3)];
  return [0x6ab4f0, 0xd0ecff, 0x6a7a4a, 0xd8c8b0, 0x1a1a22, 0x4a4a58, 0xc0392b, acc, 0xf2c08a, 0x1a1a1a, 0x2a2a3a,
    0x141414, 0x5a3a1a, 0xffffff, 0x2a2a30, 0x8a4a3a, 0x3a6aaa];
}

// a cyclist from the side: wheels, frame and a rider whose legs follow the crank angle a
function bike(dc, P, cx, gy, a, trainer) {
  const ry = gy - 24, rx = cx - 40, fx = cx + 40;
  dc.setColor(P[14], -1);
  dc.setPenWidth(4);
  dc.drawCircle(rx, ry, 22);
  dc.drawCircle(fx, ry, 22);
  const bx = cx - 4, by = gy - 22, sx = cx - 16, sy = gy - 60, hx = cx + 26, hy = gy - 58;
  dc.drawLine(rx, ry, bx, by);
  dc.drawLine(rx, ry, sx, sy);
  dc.drawLine(bx, by, sx, sy);
  dc.drawLine(sx, sy, hx, hy);
  dc.drawLine(bx, by, hx, hy);
  dc.drawLine(hx, hy, fx, ry);
  if (trainer) {
    dc.fillPolygon([[rx - 4, ry], [rx + 4, ry], [rx + 22, gy], [rx - 22, gy]]);
  }
  // legs: hip -> knee -> foot on the pedal
  const px = Math.cos(a) * 13, py = Math.sin(a) * 13;
  const hipx = sx + 2, hipy = sy - 6;
  dc.setColor(P[10], -1);
  dc.setPenWidth(8);
  for (const sgn of [-1, 1]) {
    const ftx = bx + sgn * px, fty = by + sgn * py;
    const kx = (hipx + ftx) / 2 + 12, ky = (hipy + fty) / 2 - 4;
    dc.drawLine(hipx, hipy, kx, ky);
    dc.drawLine(kx, ky, ftx, fty);
  }
  // body, arm, head with helmet
  dc.setColor(P[7], -1);
  dc.setPenWidth(14);
  dc.drawLine(hipx, hipy, cx + 12, gy - 84);
  dc.setColor(P[8], -1);
  dc.setPenWidth(6);
  dc.drawLine(cx + 12, gy - 82, hx + 2, hy - 2);
  dc.fillCircle(cx + 24, gy - 96, 9);
  dc.setColor(P[7], -1);
  dc.fillRectangle(cx + 14, gy - 108, 22, 8);
}

export default {
  fps: 10,

  // static layer: backdrop, furniture, titles and reasons; the person, the bike, steam, rain on the
  // window, the breathing guide and the Zzz move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const [act, base] = advise(d);
    const outdoor = act >= 2 && act <= 5;
    const el = AST.elev(d.doy, d.mins, d.lat, d.lon, d.tz);
    const r = IN.ready(d);
    const pp = [-1, P[7], P[8], P[9], P[10], P[11], P[12], P[13]];

    if (S) {
      // ---- backdrop: sky and road outside, a room inside
      const night = el < -6 && st === 1;
      for (let i = 0; i < 10; i++) {
        dc.setColor(outdoor ? G.mix(night ? 0x0a1030 : P[0], night ? 0x2a3060 : P[1], i / 9) : G.mix(P[3], P[1], 0.3 + i / 30), -1);
        dc.fillRectangle(0, i * 32, 454, 32);
      }
      dc.setColor(outdoor ? P[2] : G.mix(P[15], P[3], 0.45), -1);
      dc.fillRectangle(0, GY, 454, 454 - GY);
      if (outdoor) {
        dc.setColor(G.mix(P[2], 0xffffff, 0.2), -1);
        for (let x = 0; x < 454; x += 40) dc.fillRectangle(x, GY + 10, 22, 3);
        dc.setColor(G.mix(P[2], 0, 0.25), -1);
        for (const tx of [70, 380]) {
          dc.fillRectangle(tx - 4, GY - 60, 8, 60);
          dc.fillCircle(tx, GY - 76, 26);
        }
      } else {
        // a window: rain outside when that is why you stay in
        dc.setColor(P[3], -1);
        dc.fillRectangle(300, 150, 96, 80);
        dc.setColor(badWeather(d) ? 0x6a7a8a : el > -6 ? 0x9ad4ff : 0x10183a, -1);
        dc.fillRectangle(306, 156, 84, 68);
        dc.setColor(P[3], -1);
        dc.fillRectangle(346, 156, 4, 68);
      }
      if (act === 0) {
        dc.setColor(P[15], -1);
        dc.fillRectangle(110, GY - 56, 170, 40);
        dc.fillRectangle(100, GY - 90, 28, 74);
        dc.fillRectangle(262, GY - 90, 28, 74);
        dc.fillRectangle(118, GY - 16, 10, 16);
        dc.fillRectangle(262, GY - 16, 10, 16);
      } else if (act === 7) {
        dc.setColor(P[15], -1);
        dc.fillRectangle(90, GY - 50, 260, 34);
        dc.fillRectangle(90, GY - 92, 14, 92);
        dc.setColor(0xf4f0e6, -1);
        dc.fillRectangle(108, GY - 66, 60, 18);
        dc.setColor(P[16], -1);
        dc.fillRectangle(150, GY - 70, 196, 26);
        dc.setColor(P[8], -1);
        dc.fillCircle(132, GY - 74, 14);
        dc.setColor(P[12], -1);
        dc.fillRectangle(118, GY - 90, 30, 10);
      } else if (act === 1) {
        dc.setColor(P[16], -1);
        dc.fillRectangle(160, GY - 8, 140, 8);
      }
      // ---- time, today's advice, the reasons
      dc.setColor(P[4], -1);
      F.st(dc, G.timeStr(d), 227, 30, 34, 5, 1, 1, 0);
      dc.setColor(P[5], -1);
      F.px(dc, "HEUTE  " + d.dowStr + " " + d.day + ". " + d.monStr, 227, 54, 1, 1, 0);
      dc.setColor(st === 1 ? P[6] : P[4], -1);
      F.px(dc, TITLE[act], 227, 76, 3, 1, 0);
      dc.setColor(P[4], -1);
      const sub = act === 6 ? RIDE[base] : SUB[act];
      F.px(dc, sub, 227, 340, 2, 1, 0);
      dc.setColor(P[5], -1);
      const rec = d.recov < 0 ? "" : d.recov < 60 ? "ERHOLT" : "ERHOLUNG " + Math.round(d.recov / 60) + " STD";
      F.px(dc, "FORM " + (r[0] >= 0 ? r[0] : "--") + (rec ? ", " + rec : ""), 227, 364, 2, 1, 0);
      const wx = d.temp > -99 ? d.temp + "°" + (d.rain >= 0 ? " REGEN " + d.rain + "%" : "") : "";
      F.px(dc, "WOCHE " + d.trainDays + "/" + (d.dayGoal > 0 ? d.dayGoal : 4) + (wx ? ", " + wx : ""), 227, 386, 2, 1, 0);
    }

    if (!M) return;
    const go = G.ease(G.clamp(p / 0.6, 0, 1));
    if (act === 3 || act === 4 || act === 5 || act === 6) {
      // ---- riding: the cranks turn, faster for intervals; outside the road rushes past
      const spd = act === 5 ? 0.012 : act === 3 ? 0.005 : 0.008;
      const x = act === 6 ? 200 : Math.round(G.lerp(-120, 220, go));
      bike(dc, P, x, GY, (live ? tt : a.t) * spd, act === 6);
      if (act !== 6 && live) {
        dc.setColor(G.mix(P[1], 0xffffff, 0.5), -1);
        const off = Math.floor(tt * spd * 40) % 454;
        for (let i = 0; i < 4; i++) dc.fillRectangle(((454 - off) + i * 120) % 454, GY - 30 - i * 18, 40, 2);
      }
      if (act === 5) {
        dc.setColor(0x8ac8ff, -1);
        dc.fillRectangle(x + 40, GY - 100 + (Math.floor(tt / 120) % 3) * 6, 4, 6);
      }
      if (act === 6) {
        // a fan blowing
        dc.setColor(P[14], -1);
        dc.fillRectangle(70, GY - 70, 8, 70);
        dc.drawCircle(74, GY - 84, 22);
        const fa = tt / 40;
        for (let i = 0; i < 3; i++) {
          const an = fa + (i * 2 * Math.PI) / 3;
          dc.fillRectangle(Math.round(74 + Math.cos(an) * 12) - 3, Math.round(GY - 84 + Math.sin(an) * 12) - 3, 6, 6);
        }
      }
    } else if (act === 2) {
      const x = Math.round(G.lerp(-60, 196, go));
      SPR.draw(dc, Math.floor(a.t / 220) % 2 ? SP.WALK_B : SP.WALK_A, x, GY - 90, 5, pp, false);
    } else if (act === 0) {
      SPR.draw(dc, SP.SOFA, 160, GY - 96, 5, pp, false);
      // steam from the mug
      dc.setColor(0xffffff, -1);
      const fr = Math.floor(tt / 200);
      for (let i = 0; i < 3; i++) dc.fillRectangle(214 + ((i + fr) % 2) * 4, GY - 70 - i * 10 - (fr % 3) * 2, 4, 4);
    } else if (act === 1) {
      // a breathing guide: six breaths a minute
      const b = 0.5 - 0.5 * Math.cos(((tt % 10000) / 10000) * 2 * Math.PI);
      dc.setColor(G.mix(P[16], 0xffffff, 0.4), -1);
      dc.setPenWidth(3);
      dc.drawCircle(230, GY - 66, 40 + Math.round(b * 30));
      SPR.draw(dc, SP.MED, 196, GY - 68, 5, pp, false);
      dc.setColor(P[4], -1);
      if (live) F.px(dc, tt % 10000 < 5000 ? "EIN" : "AUS", 230, GY - 150, 2, 1, 0);
    } else if (act === 7) {
      dc.setColor(P[4], -1);
      const ph = (Math.floor(tt) % 1500) / 1500;
      F.px(dc, "Z", 160 + Math.round(ph * 24), GY - 110 - Math.round(ph * 50), ph > 0.5 ? 3 : 2, 1, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const [act] = advise(d);
    dc.setColor(0x8a8a8a, -1);
    F.st(dc, G.timeStr(d), 227 + o[0], 30 + o[1], 34, 3, 1, 1, 0);
    dc.setColor(0x5a5a62, -1);
    F.px(dc, TITLE[act], 227 + o[0], 76 + o[1], 3, 1, 1);
  },
};
