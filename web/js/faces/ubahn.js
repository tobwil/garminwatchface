// UBAHN — "U-Bahn-Netz": your day as a metro map. Six lines leave the central station (midnight)
// and run out to their terminus (the goal): U1 steps, U2 floors, U3 intensity minutes, U4 Body
// Battery, U5 sleep score, U6 calories. Each train stands as far out as you have got; the part of a
// line already travelled is drawn in full colour, a line that reached its goal flashes its terminus.
// On every wrist raise the trains pull out of the central station. A departure board shows the time,
// the status line reports the service (disruption when stressed, a weak line when the Body Battery
// is low, night service), and the announcement ticker runs through everything else the watch knows:
// messages, phone link, weather, sun, pulse, SpO2, breathing, battery, altitude, pressure, VO2max.
// Styles: 1 Netzplan, 2 Nacht, 3 Gameboy. Mirrors watch/source/faces/Ubahn.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const HX = 227, HY = 232; // central station
const LW = 10; // line width
// line paths from the central station to the terminus
const PATHS = [
  [HX, HY, 60, HY],
  [HX, HY, 394, HY],
  [HX, HY, 167, 172, 90, 172],
  [HX, HY, 287, 172, 364, 172],
  [HX, HY, 167, 292, 90, 292],
  [HX, HY, 287, 292, 364, 292],
];
// label per line: x, y of the name, y of the value, alignment (0 left, 2 right)
const LBL = [40, 206, 248, 0, 414, 206, 248, 2, 76, 132, 142, 0, 378, 132, 142, 2, 76, 326, 306, 0, 378, 326, 306, 2];
const NAMES = ["SCHRITTE", "ETAGEN", "AKTIV-MIN", "BATTERY", "SCHLAF", "KCAL"];

function plen(pts) {
  let L = 0;
  for (let i = 2; i < pts.length; i += 2) L += Math.max(Math.abs(pts[i] - pts[i - 2]), Math.abs(pts[i + 1] - pts[i - 1]));
  return L;
}

// point at distance s (in steps along the path; diagonals count their x extent)
function pointAt(pts, s) {
  for (let i = 2; i < pts.length; i += 2) {
    const dx = pts[i] - pts[i - 2], dy = pts[i + 1] - pts[i - 1];
    const l = Math.max(Math.abs(dx), Math.abs(dy));
    if (s <= l || i === pts.length - 2) {
      const t = l > 0 ? Math.min(1, s / l) : 0;
      return [pts[i - 2] + dx * t, pts[i - 1] + dy * t];
    }
    s -= l;
  }
  return [pts[0], pts[1]];
}

// draws the path from distance a to b with width LW: straight runs as one rectangle, diagonals stepped
function path(dc, pts, a, b) {
  let s0 = 0;
  for (let i = 2; i < pts.length; i += 2) {
    const x0 = pts[i - 2], y0 = pts[i - 1], dx = pts[i] - x0, dy = pts[i + 1] - y0;
    const l = Math.max(Math.abs(dx), Math.abs(dy));
    const u0 = Math.max(a, s0) - s0, u1 = Math.min(b, s0 + l) - s0;
    if (u1 > u0) {
      const sx = Math.sign(dx), sy = Math.sign(dy);
      if (dx === 0 || dy === 0) {
        const xa = x0 + sx * u0, xb = x0 + sx * u1, ya = y0 + sy * u0, yb = y0 + sy * u1;
        dc.fillRectangle(Math.min(xa, xb) - LW / 2, Math.min(ya, yb) - LW / 2, Math.abs(xb - xa) + LW, Math.abs(yb - ya) + LW);
      } else {
        for (let u = Math.floor(u0 / 2) * 2; u <= u1; u += 2) dc.fillRectangle(x0 + sx * u - LW / 2, y0 + sy * u - LW / 2, LW, LW);
      }
    }
    s0 += l;
  }
}

// the six lines: [fraction 0..1, value text]
function lines(d) {
  const r = (v, g) => (v >= 0 && g > 0 ? G.clamp(v / g, 0, 1) : 0);
  return [
    [r(d.steps, d.stepGoal), d.steps >= 0 ? G.num(d.steps) : "--"],
    [r(d.floors, d.floorsGoal), d.floors >= 0 ? "" + d.floors : "--"],
    [r(d.imWeek, d.imGoal), d.imWeek >= 0 ? "" + d.imWeek : "--"],
    [r(d.bb, 100), d.bb >= 0 ? d.bb + "%" : "--"],
    [r(d.sleep, 100), d.sleep >= 0 ? "" + d.sleep : "--"],
    [r(d.kcal, 2500), d.kcal >= 0 ? G.num(d.kcal) : "--"],
  ];
}

// service status line
function status(d, L) {
  if (d.mins >= 60 && d.mins < 270) return "BETRIEBSRUHE";
  if (d.stress >= 60) return "STÖRUNG: STRESS " + d.stress;
  if (d.bb >= 0 && d.bb < 25) return "U4 FÄHRT VERKÜRZT";
  let n = 0;
  for (const l of L) if (l[0] >= 1) n++;
  return n === 0 ? "NORMALBETRIEB" : n === 1 ? "1 LINIE AM ZIEL" : n + " LINIEN AM ZIEL";
}

// the announcement ticker: urgent announcements first (messages, lost phone link, stress, low Body
// Battery, low watch battery), then the rest of the network report rotated by the raise counter, so
// every look starts with something new. Watch faces only get the number of notifications, not their text.
const FUN = ["ZURÜCKBLEIBEN BITTE!", "VORSICHT AN DER BAHNSTEIGKANTE", "BITTE LASSEN SIE ZUERST AUSSTEIGEN",
  "ROLLTREPPE DEFEKT - DIE TREPPE ZÄHLT ALS ETAGE", "BITTE HALTEN SIE SICH FEST", "NÄCHSTER HALT: DEIN ZIEL",
  "DIESER ZUG ENDET UM MITTERNACHT"];

function ticker(d) {
  const pri = [], t = [];
  const n = Math.max(0, d.notif);
  if (n > 0) pri.push("ACHTUNG: " + n + (n === 1 ? " NEUE NACHRICHT" : " NEUE NACHRICHTEN") + " - BITTE HANDY PRÜFEN");
  if (!d.phone) pri.push("FUNKLOCH IM TUNNEL - HANDY NICHT ERREICHBAR");
  if (d.stress >= 60) pri.push("STÖRUNG IM BETRIEBSABLAUF: STRESS " + d.stress + " - BITTE TIEF DURCHATMEN");
  if (d.bb >= 0 && d.bb < 25) pri.push("U4 FÄHRT MIT RESERVESTROM (" + d.bb + "%) - BITTE PAUSE EINLEGEN");
  if (d.batt < 20) pri.push("UHRAKKU " + d.batt + "% - BITTE BALD LADEN");
  const sg = d.stepGoal > 0 ? d.stepGoal : 10000, fg = d.floorsGoal > 0 ? d.floorsGoal : 10, ig = d.imGoal > 0 ? d.imGoal : 150;
  const st = Math.max(0, d.steps), fl = Math.max(0, d.floors), im = Math.max(0, d.imWeek);
  t.push(st >= sg ? "U1 HAT DIE ENDSTATION ERREICHT - ALLE AUSSTEIGEN!" : "U1: NOCH " + G.num(sg - st) + " SCHRITTE BIS ZUR ENDSTATION");
  t.push(fl >= fg ? "U2 AM ZIEL - ALLE ETAGEN BEDIENT" : "U2: NOCH " + (fg - fl) + " ETAGEN - TREPPE STATT ROLLTREPPE!");
  t.push(im >= ig ? "U3: WOCHENZIEL GESCHAFFT" : "U3: NOCH " + (ig - im) + " AKTIVMINUTEN DIESE WOCHE");
  if (d.bb >= 70) t.push("U4 VOLL GELADEN (" + d.bb + "%) - FREIE FAHRT");
  if (d.sleep >= 0) t.push(d.sleep < 60 ? "U5 HEUTE VERSPÄTET: SCHLAF NUR " + d.sleep : "U5 PÜNKTLICH: SCHLAF " + d.sleep);
  if (d.hr > 0) t.push(d.hr >= 100 ? "PULS " + d.hr + " - ACHTUNG, SCHNELLZUG!" : "PULS " + d.hr + " - DER ZUG ROLLT RUHIG");
  if (d.glances > 0) t.push("SIE HABEN HEUTE " + d.glances + " MAL AUF DIE UHR GESCHAUT");
  if (d.temp > -99) t.push("AUSSEN " + d.temp + "°" + (d.rain >= 50 ? " - REGEN " + d.rain + "%, SCHIRM MITNEHMEN!" : d.rain >= 0 ? ", REGEN " + d.rain + "%" : ""));
  if (d.sunrise > 0) t.push(d.mins < d.sunset ? "LETZTE SONNE UM " + G.hm(d.sunset) : "SONNENAUFGANG UM " + G.hm(d.sunrise));
  if (d.spo2 > 0) t.push("SAUERSTOFF " + d.spo2 + "%" + (d.resp > 0 ? ", " + d.resp + " ATEMZÜGE/MIN" : ""));
  if (d.batt >= 20) t.push("UHRAKKU " + d.batt + "%" + (d.battDays > 0 ? " - REICHT NOCH " + d.battDays + " TAGE" : ""));
  if (d.alt >= 0 && d.pres > 0) t.push("HÖHE " + Math.round(d.alt) + " M, " + Math.round(d.pres / 100) + " HPA");
  t.push(FUN[Math.abs(d.wakeN) % FUN.length]);
  const r = Math.abs(d.wakeN) % t.length;
  const all = pri.concat(t.slice(r), t.slice(0, r));
  return "+++ " + all.join(" +++ ") + " +++ ";
}

// [map, band, LED, LED dim, map text, map text dim, station, station ring, U1..U6, hub]
function pal(st, acc) {
  if (st === 2) return [0x0a0c14, 0x000000, 0xffb02a, 0x6a4a14, 0xe8e8f0, 0x8a8a9a, 0x0a0c14, 0xe8e8f0,
    0xff3a4a, 0xff9a2a, 0x3ae07a, 0xffe03a, 0xb46aff, 0x3ab4ff, acc];
  if (st === 3) {
    const a = 0x0f380f, b = 0x306230, c = 0x8bac0f, e = 0x9bbc0f;
    return [e, a, e, b, a, b, e, a, a, b, a, b, a, b, a];
  }
  return [0xf4f2ec, 0x14161c, 0xffb02a, 0x5a4214, 0x1a1a22, 0x6a6a72, 0xffffff, 0x1a1a22,
    0xe3242b, 0xf08a00, 0x00a650, 0xf2c500, 0x8c3fa0, 0x0078c8, acc];
}

export default {
  fps: 10,

  // static layer: bands, board, map with lines, stations and labels, status; the trains, the
  // flashing termini and the ticker move
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const P = pal(st, d.accent);
    const p = a.intro;
    const live = a.live;
    const tt = live ? a.t : 0;
    const L = lines(d);

    if (S) {
      // ---- map and the two dark bands (departure board, announcements)
      dc.setColor(P[0], -1);
      dc.fillRectangle(0, 106, 454, 244);
      dc.setColor(P[1], -1);
      dc.fillRectangle(0, 0, 454, 106);
      dc.fillRectangle(0, 350, 454, 104);
      dc.setColor(P[14], -1);
      dc.fillRectangle(0, 104, 454, 2);
      dc.fillRectangle(0, 350, 454, 2);

      // ---- departure board
      dc.setColor(P[3], -1);
      F.px(dc, "U-BAHN  HBF", 227, 18, 1, 1, 0);
      dc.setColor(P[2], -1);
      F.px(dc, G.timeStr(d), 227, 32, 5, 1, 0);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr + (d.temp > -99 ? "  " + d.temp + "°" : ""), 227, 78, 2, 1, 0);

      // ---- lines: faded beyond the train, full colour where it has been
      for (let k = 0; k < 6; k++) {
        const pts = PATHS[k], len = plen(pts);
        dc.setColor(G.mix(P[8 + k], P[0], 0.7), -1);
        path(dc, pts, 0, len);
        dc.setColor(P[8 + k], -1);
        path(dc, pts, 0, len * L[k][0]);
      }
      // ---- stations, termini with their line badge and the metric
      for (let k = 0; k < 6; k++) {
        const pts = PATHS[k], len = plen(pts);
        for (let j = 1; j <= 3; j++) {
          const q = pointAt(pts, (len * j) / 4);
          dc.setColor(P[7], -1);
          dc.fillRectangle(Math.round(q[0]) - 6, Math.round(q[1]) - 6, 12, 12);
          dc.setColor(P[6], -1);
          dc.fillRectangle(Math.round(q[0]) - 3, Math.round(q[1]) - 3, 6, 6);
        }
        const tx = pts[pts.length - 2], ty = pts[pts.length - 1];
        dc.setColor(P[7], -1);
        dc.fillRectangle(tx - 17, ty - 11, 34, 22);
        dc.setColor(P[8 + k], -1);
        dc.fillRectangle(tx - 15, ty - 9, 30, 18);
        dc.setColor(st === 3 ? P[6] : 0xffffff, -1);
        F.px(dc, "U" + (k + 1), tx, ty - 6, 2, 1, 0);
        const lx = LBL[k * 4], al = LBL[k * 4 + 3];
        dc.setColor(P[5], -1);
        F.px(dc, NAMES[k], lx, LBL[k * 4 + 1], 1, al, 0);
        dc.setColor(P[4], -1);
        F.px(dc, L[k][1], lx, LBL[k * 4 + 2], 2, al, 0);
      }
      // ---- central station
      dc.setColor(P[7], -1);
      dc.fillRectangle(HX - 16, HY - 16, 32, 32);
      dc.setColor(P[6], -1);
      dc.fillRectangle(HX - 12, HY - 12, 24, 24);
      dc.setColor(P[14], -1);
      dc.fillRectangle(HX - 6, HY - 6, 12, 12);

      // ---- service status
      dc.setColor(P[2], -1);
      F.px(dc, status(d, L), 227, 394, 2, 1, 0);
    }

    if (!M) return;
    // ---- trains pull out of the central station on every raise
    for (let k = 0; k < 6; k++) {
      const pts = PATHS[k], len = plen(pts);
      // a train at its goal waits just before the terminus badge
      const f = L[k][0] * G.ease(G.stag(p, k, 0.06, 0.6));
      const q = pointAt(pts, Math.min(len * f, len - 26));
      const x = Math.round(q[0]), y = Math.round(q[1]);
      dc.setColor(P[7], -1);
      dc.fillRectangle(x - 9, y - 9, 18, 18);
      dc.setColor(P[8 + k], -1);
      dc.fillRectangle(x - 6, y - 6, 12, 12);
      dc.setColor(P[6], -1);
      dc.fillRectangle(x - 2, y - 4, 4, 4);
      // a line at its goal flashes its terminus
      if (L[k][0] >= 1 && p >= 1 && live && Math.floor(tt / 500) % 2 === 0) {
        const tx = pts[pts.length - 2], ty = pts[pts.length - 1];
        dc.setColor(P[14], -1);
        dc.fillRectangle(tx - 19, ty - 13, 38, 2);
        dc.fillRectangle(tx - 19, ty + 11, 38, 2);
      }
    }
    // ---- announcement ticker (only the visible characters are drawn)
    const txt = ticker(d);
    const cw = 12, view = 21;
    const off = live ? Math.floor(tt / 22) % (txt.length * cw) : 0;
    const i0 = Math.floor(off / cw);
    let vis = "";
    for (let i = 0; i < view + 1; i++) vis += txt[(i0 + i) % txt.length];
    dc.setColor(P[2], -1);
    F.px(dc, vis, 227 - (view * cw) / 2 - (off % cw), 366, 2, 0, 0);
    dc.setColor(P[1], -1);
    dc.fillRectangle(0, 362, 96, 22);
    dc.fillRectangle(358, 362, 96, 22);
    // a bell rings beside the ticker while messages are waiting
    if (d.notif > 0 && (!live || Math.floor(tt / 400) % 2 === 0)) {
      dc.setColor(P[2], -1);
      dc.fillRectangle(78, 364, 8, 4);
      dc.fillRectangle(76, 368, 12, 8);
      dc.fillRectangle(74, 376, 16, 3);
      dc.fillRectangle(80, 380, 4, 3);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    dc.setColor(st === 3 ? 0x306230 : 0x3a3a42, -1);
    for (let k = 0; k < 6; k++) {
      const pts = PATHS[k], len = plen(pts);
      for (let s = 0; s <= len; s += 12) {
        const q = pointAt(pts, s);
        dc.fillRectangle(Math.round(q[0]) - 1 + o[0], Math.round(q[1]) - 1 + o[1], 3, 3);
      }
    }
    dc.setColor(st === 3 ? 0x8bac0f : G.dim(0xffb02a, 0.6), -1);
    F.px(dc, G.timeStr(d), 227 + o[0], 32 + o[1], 5, 1, 1);
  },
};
