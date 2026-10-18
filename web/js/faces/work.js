// WORK — "Arbeitstag": a calm, legible everyday face for work, from pre-rendered images
// (tools/render/work.py) and crisp anti-aliased type. Big time, the date written out, the working day
// from 7 to 19 o'clock as an engraved track: how far the day is, a glowing point for now and a marker
// for the next calendar event ("NÄCHSTER TERMIN 14:00 · IN 38 MIN"; the watch gives faces the time of
// the next event, not its title). Three glass tiles: weather, Body Battery, notifications; the watch
// battery below. Styles: 1 Graphit, 2 Navy, 3 Hell. Mirrors watch/source/faces/Work.mc.
import { G } from "../engine/gfx.js";
import { St } from "../engine/st.js";
import { SE } from "../engine/season.js";
import { ARC_CW } from "../engine/dc.js";
import { Bmp, AffineTransform, BLEND_MODE_ADDITIVE, BLEND_MODE_DEFAULT, FILTER_MODE_BILINEAR } from "../engine/bmp.js";
import IMG, { M as IM } from "../img/work.js";

const C = 227;
const TR = 205;
const DAYS = ["SONNTAG", "MONTAG", "DIENSTAG", "MITTWOCH", "DONNERSTAG", "FREITAG", "SAMSTAG"];
const MONTHS = ["JANUAR", "FEBRUAR", "MÄRZ", "APRIL", "MAI", "JUNI", "JULI", "AUGUST", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DEZEMBER"];
// [text, dim, icon] per style
const INK = [[0xffffff, 0x8a8e96, 0xe8eaee], [0xffffff, 0x8a9ab8, 0xe0e8f4], [0x2a2a2e, 0x7a7a80, 0x3a3a40]];

// day angle (0 = 12 o'clock, clockwise) of a time; the track runs from 7:00 (-120) to 19:00 (+120)
function ang(mins) { return -120 + ((mins - 420) / 720) * 240; }

// text from a glyph strip (k: 0 big, 1 mid, 2 small), one clipped glyph at a time, centred on x
function txt(dc, k, s, x, y, tint) {
  const chars = k === 0 ? IM.BIG : k === 1 ? IM.MID : IM.SMALL;
  const adv = k === 0 ? IM.BIG_ADV : k === 1 ? IM.MID_ADV : IM.SMALL_ADV;
  const cw = k === 0 ? IM.BIG_CW : k === 1 ? IM.MID_CW : IM.SMALL_CW;
  const h = k === 0 ? IM.BIG_H : k === 1 ? IM.MID_H : IM.SMALL_H;
  const b = Bmp.load(k === 0 ? IMG.big : k === 1 ? IMG.mid : IMG.small);
  let w = 0;
  for (let i = 0; i < s.length; i++) w += adv[Math.max(0, chars.indexOf(s[i]))];
  let cx = Math.round(x - w / 2);
  for (let i = 0; i < s.length; i++) {
    const j = Math.max(0, chars.indexOf(s[i]));
    if (s[i] !== " ") {
      dc.setClip(cx - 2, y, adv[j] + 4, h);
      dc.drawBitmap2(cx - j * cw - 2, y, b, { tintColor: tint });
      dc.clearClip();
    }
    cx += adv[j];
  }
}

function icon(dc, i, x, y, tint) {
  dc.setClip(x, y, IM.ICON_W, IM.ICON_H);
  dc.drawBitmap2(x - i * IM.ICON_W, y, Bmp.load(IMG.icons), { tintColor: tint });
  dc.clearClip();
}

// "IN 38 MIN", "IN 2 STD 5 MIN", "JETZT", "MORGEN"
function until(ev, now) {
  const m = ev - now;
  if (m < 0) return "MORGEN";
  if (m === 0) return "JETZT";
  if (m < 60) return "IN " + m + " MIN";
  return "IN " + Math.floor(m / 60) + " STD" + (m % 60 > 0 ? " " + (m % 60) + " MIN" : "");
}

export default {
  fps: 10,
  reveal() { return false; },

  // static layer: everything; only the glow of the "now" point breathes
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = G.clamp(d.cfg.style, 1, 3);
    const ink = INK[st - 1];
    const now = d.mins;

    if (S) {
      dc.drawBitmap(0, 0, Bmp.load(IMG["base" + st]));
      // ---- the day so far on the track, the next event as a marker
      if (now > 420) {
        dc.setColor(d.accent, -1);
        dc.setPenWidth(5);
        dc.drawArc(C, C, TR, ARC_CW, 210, 90 - ang(Math.min(now, 1140)));
      }
      if (d.nextEv >= 420 && d.nextEv <= 1140 && d.nextEv >= now) {
        const e = (ang(d.nextEv) * Math.PI) / 180;
        dc.setColor(G.mix(d.accent, 0xffffff, 0.45), -1);
        dc.setPenWidth(4);
        dc.drawLine(Math.round(C + (TR - 9) * Math.sin(e)), Math.round(C - (TR - 9) * Math.cos(e)),
          Math.round(C + (TR + 9) * Math.sin(e)), Math.round(C - (TR + 9) * Math.cos(e)));
      }
      // ---- date, time
      txt(dc, 2, DAYS[d.dow] + ", " + d.day + ". " + MONTHS[d.mon - 1], C, 92, ink[1]);
      txt(dc, 0, G.timeStr(d), C, 110, ink[0]);
      // ---- the next calendar event
      if (d.nextEv >= 0) {
        txt(dc, 2, "NÄCHSTER TERMIN", C, 218, ink[1]);
        txt(dc, 1, G.hm(d.nextEv), C, 236, ink[0]);
        txt(dc, 2, until(d.nextEv, now), C, 266, d.accent);
      } else txt(dc, 2, "KEINE TERMINE", C, 236, ink[1]);
      // ---- tiles: weather, energy, notifications
      const day = d.sunrise > 0 && d.sunset > 0 ? now >= d.sunrise && now < d.sunset : now >= 420 && now < 1140;
      const wx = SE.wx(d);
      const vals = [d.temp > -99 ? d.temp + "°" : "--", d.bb >= 0 ? "" + d.bb : "--", "" + d.notif];
      const ics = [wx === 0 && !day ? 6 : wx, 7, 8];
      for (let i = 0; i < 3; i++) {
        const tx = IM.TILES[i * 2], ty = IM.TILES[i * 2 + 1];
        icon(dc, ics[i], tx - 15, ty - 30, i === 1 ? d.accent : ink[2]);
        txt(dc, 1, vals[i], tx, ty + 1, ink[0]);
      }
      // ---- the watch battery
      txt(dc, 2, "AKKU " + d.batt + " %", C, 390, d.batt <= 20 ? 0xff5a4a : ink[1]);
    }

    if (!M) return;
    // ---- now: a softly breathing point of light on the track
    if (now >= 420 && now <= 1140) {
      const e = (ang(now) * Math.PI) / 180;
      const x = Math.round(C + TR * Math.sin(e)), y = Math.round(C - TR * Math.cos(e));
      const k = 0.65 + 0.35 * Math.sin(a.t / 500);
      const t = new AffineTransform();
      t.scale(1.4, 1.4);
      t.translate(-12, -12);
      dc.setBlendMode(BLEND_MODE_ADDITIVE);
      dc.drawBitmap2(x, y, Bmp.load(IMG.dot), { transform: t, filterMode: FILTER_MODE_BILINEAR, tintColor: G.mix(0, d.accent, k) });
      dc.setBlendMode(BLEND_MODE_DEFAULT);
      dc.setColor(0xffffff, -1);
      dc.fillCircle(x, y, 3);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    txt(dc, 0, G.timeStr(d), C + o[0], 110 + o[1], 0x4a4a4a);
    if (d.nextEv >= 0) txt(dc, 2, "TERMIN " + G.hm(d.nextEv), C + o[0], 236 + o[1], 0x3a3a3a);
  },
};
