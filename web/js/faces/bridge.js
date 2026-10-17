// BRIDGE — "Kommandobrücke": you are the captain on the bridge of a pixel starship, and every
// instrument is one of the watch's sensors. Shields = Body Battery, energy = watch battery (and days
// left), the reactor core pulses with your heart rate, life support breathes with your respiration
// rate, O2 = SpO2, the alert level follows stress (red alert flashes the bridge), comms blink for
// messages or report a lost link to the phone. On the main screen the moon shows its real phase and
// the stars stream past at warp speed set by your pulse. Below: navigation (steps, distance), orbit
// (altitude, air pressure) and the outside sensor (weather); the stardate is year.day. On every wrist
// raise the ship powers up system by system and jumps out of warp, the captain points ahead.
// Styles: 1 Raumschiff, 2 Bernstein (amber CRT), 3 Gameboy. Mirrors watch/source/faces/Bridge.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/bridge.js";

const SP = encodeAll(S);
const WIN = 196; // bottom of the main screen
const MX = 352, MY = 112, MR = 26; // the moon on the screen

function alert(d) {
  if (d.stress >= 60) return 2;
  if (d.stress >= 40 || (d.bb >= 0 && d.bb < 20)) return 1;
  return 0;
}

function moon(dc, P, cx, cy, r, k) {
  for (let y = -r; y < r; y += 4) {
    const yy = y + 2;
    const hw = Math.floor(Math.sqrt(r * r - yy * yy) / 4) * 4;
    if (hw <= 0) continue;
    dc.setColor(P[24], -1);
    dc.fillRectangle(cx - hw, cy + y, 2 * hw, 4);
    const x0 = k < 0.5 ? Math.round(hw * Math.cos(k * 2 * Math.PI) / 4) * 4 : -hw;
    const x1 = k < 0.5 ? hw : Math.round(hw * Math.cos((k - 0.5) * 2 * Math.PI) / 4) * 4;
    if (x1 > x0) {
      dc.setColor(P[23], -1);
      dc.fillRectangle(cx + x0, cy + y, x1 - x0, 4);
    }
  }
}

// segmented bar: n of 10 segments lit
function bar(dc, P, x, y, f, on) {
  const n = Math.round(G.clamp(f, 0, 1) * 10);
  for (let i = 0; i < 10; i++) {
    dc.setColor(i < n ? on : P[9], -1);
    dc.fillRectangle(x + i * 12, y, 10, 12);
  }
}

// [space, star, hull, hull light, console, console light, panel, label, value, bar off, shield, energy,
//  reactor, alert green, alert yellow, alert red, comms, time, chair, armrest, hair, uniform, skin,
//  moon lit, moon dark, strip text]
function pal(st, acc) {
  if (st === 2) {
    const a = 0xffb02a, b = 0x8a5a14, c = 0x3a2408, k = 0x0a0602;
    return [k, a, c, b, 0x1a1006, c, k, b, a, c, a, a, a, b, a, a, a, a, c, b, b, a, b, a, c, a];
  }
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [a, e, b, c, b, c, a, c, e, b, e, e, e, c, e, e, e, e, a, b, a, c, e, e, b, e];
  }
  return [0x04060e, 0xffffff, 0x2a3040, 0x4a5468, 0x1e2230, 0x3a4256, 0x0a0e18, 0x7a8aa8, 0xffffff, 0x1e2a3a,
    0x3ad8ff, 0x5aff8a, 0xff8a2a, 0x3aff6a, 0xffd23a, 0xff3a3a, 0x6a8aff, 0xffffff, 0x2a2a34, 0x4a4a58,
    0x5a3a24, acc, 0xf2c08a, 0xf4f0d8, 0x2a2a38, 0xd8e4ff];
}

export default {
  fps: 12,

  // static layer: hull, screen with the moon, consoles with their readouts, captain, strip; the stars,
  // the reactor pulse, life support, the alert and comms lamps move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const al = alert(d);

    if (S) {
      // ---- main screen: space, the moon
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 0, 454, WIN);
      moon(dc, P, MX, MY, MR, d.moon >= 0 ? d.moon : 0.5);
      // ---- hull: window struts and the console deck
      dc.setColor(P[2], -1);
      dc.fillRectangle(0, WIN, 454, 258);
      dc.fillPolygon([[0, 0], [70, 0], [30, WIN], [0, WIN]]);
      dc.fillPolygon([[384, 0], [454, 0], [454, WIN], [424, WIN]]);
      dc.setColor(P[3], -1);
      dc.fillRectangle(0, WIN, 454, 4);
      dc.fillRectangle(0, 346, 454, 2);

      // ---- time and stardate
      dc.setColor(P[17], -1);
      F.px(dc, G.timeStr(d), 227, 22, 5, 1, 0);
      dc.setColor(P[7], -1);
      F.px(dc, "STERNZEIT " + d.year + "." + G.pad2(Math.floor(d.doy / 10)) + (d.doy % 10), 227, 66, 1, 1, 0);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 78, 1, 1, 0);

      // ---- alert level on the screen
      const ac = [P[13], P[14], P[15]][al];
      dc.setColor(ac, -1);
      F.px(dc, ["ALARMSTUFE GRÜN", "ALARMSTUFE GELB", "ROTER ALARM"][al], 227, 176, 2, 1, 0);

      // ---- left console: shields, energy, O2
      dc.setColor(P[4], -1);
      dc.fillRectangle(26, 210, 150, 128);
      dc.setColor(P[5], -1);
      dc.fillRectangle(26, 210, 150, 3);
      const sp = (k) => G.stag(p, k, 0.08, 0.5);
      dc.setColor(P[7], -1);
      F.px(dc, "SCHILDE", 36, 218, 1, 0, 0);
      bar(dc, P, 36, 228, d.bb >= 0 ? d.bb / 100 : 0, P[10]);
      dc.setColor(P[8], -1);
      F.px(dc, d.bb >= 0 ? d.bb + "%" : "--", 166, 216, 1, 2, 0);
      dc.setColor(P[7], -1);
      F.px(dc, "ENERGIE", 36, 250, 1, 0, 0);
      bar(dc, P, 36, 260, d.batt / 100, P[11]);
      dc.setColor(P[8], -1);
      F.px(dc, d.batt + "%" + (d.battDays > 0 ? " " + d.battDays + "T" : ""), 166, 248, 1, 2, 0);
      dc.setColor(P[7], -1);
      F.px(dc, "O2", 36, 284, 1, 0, 0);
      dc.setColor(P[8], -1);
      F.px(dc, d.spo2 > 0 ? d.spo2 + "%" : "--", 36, 294, 2, 0, 0);
      dc.setColor(P[7], -1);
      F.px(dc, "ATMUNG", 100, 284, 1, 0, 0);
      dc.setColor(P[8], -1);
      F.px(dc, d.resp > 0 ? "" + d.resp : "--", 100, 294, 2, 0, 0);

      // ---- right console: reactor, stress, comms
      dc.setColor(P[4], -1);
      dc.fillRectangle(278, 210, 150, 128);
      dc.setColor(P[5], -1);
      dc.fillRectangle(278, 210, 150, 3);
      dc.setColor(P[7], -1);
      F.px(dc, "REAKTOR", 288, 218, 1, 0, 0);
      dc.setColor(P[8], -1);
      F.px(dc, d.hr > 0 ? "" + d.hr : "--", 340, 230, 3, 0, 0);
      dc.setColor(P[7], -1);
      F.px(dc, "BPM" + (d.rhr > 0 ? " RUHE " + d.rhr : ""), 340, 254, 1, 0, 0);
      F.px(dc, "STRESS", 288, 284, 1, 0, 0);
      dc.setColor(P[8], -1);
      F.px(dc, d.stress >= 0 ? "" + d.stress : "--", 288, 294, 2, 0, 0);
      dc.setColor(P[7], -1);
      F.px(dc, "FUNK", 356, 284, 1, 0, 0);
      dc.setColor(P[8], -1);
      F.px(dc, d.phone ? Math.max(0, d.notif) + " MSG" : "OFF", 356, 294, 2, 0, 0);
      if (d.vo2r > 0 || d.vo2b > 0) {
        dc.setColor(P[7], -1);
        F.px(dc, "VO2 " + Math.max(d.vo2r, d.vo2b), 288, 320, 1, 0, 0);
      }
      if (d.sleep >= 0) {
        dc.setColor(P[7], -1);
        F.px(dc, "SCHLAF " + d.sleep, 36, 320, 1, 0, 0);
      }

      // ---- strip: navigation, orbit, outside sensor
      const km10 = Math.round(d.distM / 100);
      const km = d.distM >= 0 ? Math.floor(km10 / 10) + "," + (km10 % 10) : "--";
      dc.setColor(P[25], -1);
      F.px(dc, "NAV " + G.num(Math.max(0, d.steps)) + " SCHR " + km + " KM", 227, 356, 2, 1, 0);
      F.px(dc, "ORBIT " + (d.alt >= 0 ? Math.round(d.alt) + "M " : "") + (d.pres > 0 ? Math.round(d.pres / 100) + "HPA" : ""), 227, 378, 2, 1, 0);
      F.px(dc, d.temp > -99 ? "AUSSEN " + d.temp + "°" + (d.rain >= 0 ? " R" + d.rain + "%" : "") : "AUSSEN --", 227, 400, 2, 1, 0);
    }

    if (!M) return;
    // ---- stars stream past at warp speed (faster with a higher pulse, a jump on every raise)
    const warp = 1 + (d.hr > 0 ? G.clamp((d.hr - 50) / 60, 0, 2) : 0) + (p < 1 ? (1 - p) * 8 : 0);
    dc.setColor(P[1], -1);
    for (let i = 0; i < 26; i++) {
      const ang = G.rnd(i * 97 + 3) % 360 * Math.PI / 180;
      const ph = ((G.rnd(i * 31 + 7) % 1000) / 1000 + tt * 0.00008 * warp) % 1;
      const r = 16 + ph * 230;
      const x = Math.round(227 + Math.cos(ang) * r * 1.3), y = Math.round(126 + Math.sin(ang) * r * 0.5);
      if (y < 4 || y > WIN - 26 || x < 40 || x > 414 || (y < 92 && x > 120 && x < 334)) continue;
      const dx = x - MX, dy = y - MY;
      if (dx * dx + dy * dy < MR * MR) continue;
      const len = Math.min(16, 1 + Math.round(ph * 4 * warp));
      dc.fillRectangle(x, y, ph > 0.5 ? len : 2, 2);
    }
    // ---- reactor core pulses with the heart rate
    const beat = d.hr > 0 ? 60000 / d.hr : 1000;
    const pulse = live ? Math.max(0, 1 - (tt % beat) / (beat * 0.45)) : 0.6;
    const on = G.stag(p, 3, 0.08, 0.5) > 0;
    const rc = G.mix(P[4], P[12], on ? 0.35 + pulse * 0.65 : 0.1);
    dc.setColor(rc, -1);
    dc.fillRectangle(292, 230, 36, 36);
    dc.setColor(G.mix(rc, 0xffffff, pulse * 0.5), -1);
    dc.fillRectangle(300, 238, 20, 20);
    // ---- life support breathes with the respiration rate
    const br = d.resp > 0 ? 60000 / d.resp : 4000;
    const bf = live ? 0.5 - 0.5 * Math.cos((tt % br) / br * 2 * Math.PI) : 0.5;
    dc.setColor(P[9], -1);
    dc.fillRectangle(150, 284, 16, 30);
    dc.setColor(P[10], -1);
    const bh = Math.round(4 + bf * 26);
    dc.fillRectangle(150, 314 - bh, 16, bh);
    // ---- alert lamps (flash in red alert), comms lamp blinks for messages
    const flash = al === 2 && live && Math.floor(tt / 300) % 2 === 0;
    dc.setColor(al === 2 ? (flash ? P[15] : P[2]) : al === 1 ? P[14] : P[13], -1);
    dc.fillRectangle(34, 204, 20, 4);
    dc.fillRectangle(400, 204, 20, 4);
    if (flash) {
      dc.setColor(P[15], -1);
      dc.fillRectangle(30, WIN - 4, 394, 4);
    }
    dc.setColor(!d.phone ? P[15] : d.notif > 0 && (!live || Math.floor(tt / 400) % 2 === 0) ? P[16] : P[9], -1);
    dc.fillRectangle(408, 286, 10, 10);
    // ---- the captain points ahead when the ship drops out of warp
    SPR.draw(dc, p > 0.15 && p < 0.85 ? SP.POINT : SP.CAPTAIN, 195, 270, 4, [-1, P[18], P[19], P[20], P[21], P[22]], false);
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    dc.setColor(st === 3 ? 0x306230 : 0x2a3040, -1);
    dc.fillRectangle(o[0], WIN + o[1], 454, 2);
    dc.drawRectangle(26 + o[0], 210 + o[1], 150, 128);
    dc.drawRectangle(278 + o[0], 210 + o[1], 150, 128);
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a9a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 22 + o[1], 5, 1, 1);
  },
};
