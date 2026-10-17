// MAP — "Schatzkarte": a sea chart on old parchment. The weekly goal (climbed metres, bike km or
// training days, see d.src) sails the ship from the harbour past Möwenriff, Nebelinsel and
// Schildkrötenbucht to the red X on Treasure Island; the route already sailed is inked in red. On
// every wrist raise the ship covers the last stretch of its voyage; at the goal it lies at anchor and
// the chest opens. A sea serpent lurks on the chart, the three data slots fill the log book.
// Styles: 1 Pergament, 2 Nacht, 3 Gameboy. Mirrors watch/source/faces/Map.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { SPR, encodeAll } from "../engine/spr.js";
import S from "../sprites/map.js";

const SP = encodeAll(S);
// route: harbour -> X
const WP = [100, 316, 156, 300, 200, 262, 168, 222, 212, 186, 268, 200, 318, 178, 350, 152];
// islands: x, y, half width, half height, palm (1/0)
const ISL = [236, 262, 22, 12, 1, 130, 214, 18, 10, 0, 292, 226, 24, 12, 1];
const NAMES = ["MÖWENRIFF", "NEBELINSEL", "SCHILDKRÖTE"];
const XX = 360, XY = 140; // the X

const CUM = [0];
for (let i = 2; i < WP.length; i += 2) {
  const dx = WP[i] - WP[i - 2], dy = WP[i + 1] - WP[i - 1];
  CUM.push(CUM[CUM.length - 1] + Math.sqrt(dx * dx + dy * dy));
}
const TOT = CUM[CUM.length - 1];

function at(f) {
  const L = G.clamp(f, 0, 1) * TOT;
  let i = 1;
  while (i < CUM.length - 1 && CUM[i] < L) i++;
  const t = (L - CUM[i - 1]) / Math.max(1, CUM[i] - CUM[i - 1]);
  return [WP[(i - 1) * 2] + (WP[i * 2] - WP[(i - 1) * 2]) * t, WP[(i - 1) * 2 + 1] + (WP[i * 2 + 1] - WP[(i - 1) * 2 + 1]) * t];
}

// weekly progress: [value, goal, label]
function stage(d) {
  if (d.src === 0) {
    const v = d.floorsWeek > 0 ? d.floorsWeek * 3 : 0;
    return [v, 1071, "HM " + v + "/1071"];
  }
  if (d.src === 2) {
    const v = d.trainDays > 0 ? d.trainDays : 0;
    const g = d.dayGoal > 0 ? d.dayGoal : 4;
    return [v, g, "TAGE " + v + "/" + g];
  }
  const km = d.wkBike > 0 ? Math.floor(d.wkBike / 1000) : 0;
  const g = d.cfg.bikeGoal > 0 ? d.cfg.bikeGoal : 150;
  return [km, g, "KM " + km + "/" + g];
}

function frac(sg) { return sg[1] > 0 ? G.clamp(sg[0] / sg[1], 0, 1) : 0; }

function caption(f) {
  if (f >= 1) return "SCHATZ GEFUNDEN!";
  if (f < 0.04) return "LEINEN LOS!";
  if (f < 0.3) return "KURS " + NAMES[0];
  if (f < 0.55) return "KURS " + NAMES[1];
  if (f < 0.8) return "KURS " + NAMES[2];
  return "LAND IN SICHT!";
}

// [parchment, parchment dark, burn, ink, ink faint, red ink, sea mark, sand, green, house, roof, text,
//  hull, sail, flag, wood, iron, gold, note, serpent]
function pal(st, acc) {
  if (st === 2) return [0x14223a, 0x0e1a2e, 0x060c18, 0xd8e4f4, 0x5a6e8a, acc, 0x3a5070, 0x8a8a6a, 0x4a7a5a, 0xc8b898,
    0x8a3a2a, 0xe8f0ff, 0x8a6a4a, 0xe8e4d8, acc, 0x8a5a2a, 0x5a5a6a, 0xffd23a, 0x1e2e4a, 0x5a8a6a];
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [e, c, b, a, b, a, b, c, b, c, a, a, a, e, a, b, a, e, c, b];
  }
  return [0xe8d4a4, 0xd8c08a, 0x8a5a2a, 0x3a2a1a, 0xa88a5a, acc, 0xb89a68, 0xf0dca0, 0x6a8a3a, 0xf0e6d0,
    0x9a3a2a, 0x3a2a1a, 0x6a4024, 0xf8f0e0, acc, 0x8a5a2a, 0x4a4a52, 0xffc83a, 0xf4e8c8, 0x4a7a5a];
}

export default {
  fps: 8,

  // static layer: parchment, harbour, islands, X, route, compass, log book, texts; the ship, the chest,
  // the serpent and the sparkle move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const sg = stage(d);
    const f = frac(sg);

    if (S) {
      // ---- parchment with burnt edge and wave marks
      dc.setColor(P[2], -1);
      dc.fillCircle(227, 227, 227);
      dc.setColor(P[1], -1);
      for (let y = -220; y < 220; y += 4) {
        const hw = Math.floor(Math.sqrt(220 * 220 - (y + 2) * (y + 2)) / 4) * 4 - ((y / 4) % 3 === 0 ? 4 : 0);
        dc.fillRectangle(227 - hw, 227 + y, 2 * hw, 4);
      }
      dc.setColor(P[0], -1);
      for (let y = -206; y < 206; y += 4) {
        const hw = Math.floor(Math.sqrt(206 * 206 - (y + 2) * (y + 2)) / 4) * 4 - ((y / 4) % 2 === 0 ? 4 : 0);
        dc.fillRectangle(227 - hw, 227 + y, 2 * hw, 4);
      }
      dc.setColor(P[6], -1);
      for (let i = 0; i < 22; i++) {
        const wx = 60 + ((i * 131 + 7) % 330), wy = 110 + ((i * 71 + 13) % 250);
        dc.fillRectangle(wx, wy, 6, 2);
        dc.fillRectangle(wx + 6, wy - 2, 6, 2);
        dc.fillRectangle(wx + 12, wy, 6, 2);
      }

      // ---- harbour
      dc.setColor(P[7], -1);
      dc.fillRectangle(40, 318, 70, 40);
      dc.fillRectangle(52, 310, 50, 8);
      dc.setColor(P[15], -1);
      dc.fillRectangle(96, 324, 26, 4);
      for (let i = 0; i < 3; i++) {
        dc.setColor(P[9], -1);
        dc.fillRectangle(52 + i * 16, 324, 12, 12);
        dc.setColor(P[10], -1);
        dc.fillRectangle(50 + i * 16, 318, 16, 6);
      }

      // ---- islands, treasure island with the X
      for (let i = 0; i < ISL.length; i += 5) {
        const x = ISL[i], y = ISL[i + 1], w = ISL[i + 2], h = ISL[i + 3];
        dc.setColor(P[7], -1);
        dc.fillRectangle(x - w, y - h + 4, 2 * w, 2 * h - 8);
        dc.fillRectangle(x - w + 6, y - h, 2 * w - 12, 2 * h);
        dc.setColor(P[8], -1);
        dc.fillRectangle(x - w + 10, y - h + 4, 2 * w - 20, h);
        if (ISL[i + 4]) SPR.draw(dc, SP.PALM, x - 6, y - h - 22, 3, [-1, P[8], P[12]], false);
      }
      dc.setColor(P[7], -1);
      dc.fillRectangle(XX - 40, XY - 18, 80, 38);
      dc.fillRectangle(XX - 30, XY - 26, 60, 54);
      dc.setColor(P[8], -1);
      dc.fillRectangle(XX - 26, XY - 22, 20, 14);
      dc.fillRectangle(XX + 12, XY + 8, 18, 12);
      SPR.draw(dc, SP.PALM, XX + 14, XY - 50, 3, [-1, P[8], P[12]], false);
      dc.setColor(P[5], -1);
      for (let i = 0; i < 5; i++) {
        dc.fillRectangle(XX - 10 + i * 4, XY - 10 + i * 4, 4, 4);
        dc.fillRectangle(XX + 6 - i * 4, XY - 10 + i * 4, 4, 4);
      }

      // ---- route: sailed part in red ink, the rest dashed
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const done = t <= f;
        if (!done && i % 3 === 2) continue;
        const q = at(t);
        dc.setColor(done ? P[5] : P[4], -1);
        dc.fillRectangle(Math.floor(q[0] / 2) * 2, Math.floor(q[1] / 2) * 2, done ? 4 : 2, done ? 4 : 2);
      }

      // ---- compass rose
      const cx = 372, cy = 318;
      dc.setColor(P[4], -1);
      for (let i = -24; i <= 24; i += 4) {
        const w = 6 - Math.round(Math.abs(i) / 6);
        dc.fillRectangle(cx - w / 2, cy + i, w, 4);
        dc.fillRectangle(cx + i, cy - w / 2, 4, w);
      }
      dc.setColor(P[5], -1);
      dc.fillRectangle(cx - 2, cy - 24, 4, 16);
      dc.setColor(P[3], -1);
      F.px(dc, "N", cx, cy - 40, 2, 1, 0);

      // ---- log book with the data slots
      dc.setColor(P[18], -1);
      dc.fillRectangle(52, 96, 158, 74);
      dc.setColor(P[4], -1);
      dc.drawRectangle(52, 96, 158, 74);
      dc.setColor(P[3], -1);
      F.px(dc, "LOGBUCH", 131, 100, 1, 1, 0);
      for (let i = 0; i < 3; i++) {
        const s = d.slots[i];
        if (!s.lbl || G.stag(p, i, 0.1, 0.4) <= 0) continue;
        let lb = s.lbl;
        while (lb.length > 2 && F.pxW(lb, 2) > 128 - F.pxW(s.val, 2)) lb = lb.substring(0, lb.length - 1);
        dc.setColor(P[4], -1);
        F.px(dc, lb, 60, 114 + i * 18, 2, 0, 0);
        dc.setColor(P[3], -1);
        F.px(dc, s.val, 202, 114 + i * 18, 2, 2, 0);
      }

      // ---- time, date, voyage
      dc.setColor(P[3], -1);
      F.px(dc, G.timeStr(d), 227, 26, 5, 1, 0);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 70, 2, 1, 0);
      dc.setColor(P[5], -1);
      F.px(dc, caption(f), 227, 380, 2, 1, 0);
      dc.setColor(P[3], -1);
      F.px(dc, sg[2], 227, 400, 2, 1, 0);
    }

    if (!M) return;
    // ---- the sea serpent shows its humps
    const sb = live ? Math.floor(tt / 500) % 2 : 0;
    dc.setColor(P[19], -1);
    for (let i = 0; i < 3; i++) {
      const hx = 268 + i * 18, hy = 290 - (i === 1 ? 4 : 0) - sb * 2;
      dc.fillRectangle(hx, hy, 12, 6);
      dc.fillRectangle(hx + 2, hy - 4, 8, 4);
    }
    dc.fillRectangle(320, 278 - sb * 2, 8, 12);
    dc.fillRectangle(320, 278 - sb * 2, 14, 6);

    // ---- the ship sails the last stretch on every raise
    const f0 = f >= 1 ? 1 : Math.max(0, f - 0.12);
    const fr = f >= 1 ? 1 : G.lerp(f0, f, G.easeInOut(G.clamp((p - 0.2) / 0.8, 0, 1)));
    const q = fr >= 1 ? [XX - 50, XY + 30] : at(fr);
    const bob = live ? Math.floor(tt / 400) % 2 * 2 : 0;
    SPR.draw(dc, SP.SHIP, Math.round(q[0]) - 24, Math.round(q[1]) - 36 + bob, 3, [-1, P[12], P[13], P[14]], false);

    // ---- at the goal the chest opens
    if (f >= 1) {
      const open = p > 0.6;
      SPR.draw(dc, open ? SP.CHEST_O : SP.CHEST_C, XX - 18, XY - 50, 3, [-1, P[15], P[16], P[17]], false);
      if (open && (!live || Math.floor(tt / 250) % 2 === 0)) {
        dc.setColor(P[17], -1);
        dc.fillRectangle(XX - 26, XY - 60, 4, 4);
        dc.fillRectangle(XX + 20, XY - 56, 4, 4);
        dc.fillRectangle(XX - 2, XY - 70, 4, 4);
      }
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    const c = st === 3 ? 0x306230 : 0x4a4236;
    const f = frac(stage(d));
    dc.setColor(c, -1);
    for (let i = 0; i <= 30; i += 2) {
      const q = at(i / 30);
      dc.fillRectangle(Math.round(q[0]) + o[0], Math.round(q[1]) + o[1], 2, 2);
    }
    const q = at(f);
    dc.setColor(G.dim(d.accent, 0.6), -1);
    dc.fillRectangle(Math.round(q[0]) - 4 + o[0], Math.round(q[1]) - 4 + o[1], 8, 8);
    dc.fillRectangle(XX - 6 + o[0], XY - 6 + o[1], 4, 4);
    dc.fillRectangle(XX + 2 + o[0], XY + 2 + o[1], 4, 4);
    dc.setColor(st === 3 ? 0x8bac0f : 0x8a8a8a, -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 26 + o[1], 5, 1, 1);
  },
};
