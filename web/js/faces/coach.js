// COACH — "KI-Coach": a chat with your training coach. Every wrist raise the coach
// types a NEW message built from your data (31 templates: readiness, time of day,
// weekly goals, steps, praise), picked deterministically from d.wakeN.
// Styles: 1 Messenger, 2 Terminal, 3 Glas. Mirrors watch/source/faces/Coach.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const NT = 31; // number of templates
const QS = [
  "Wie fit bin ich?", "Bin ich startklar?",
  "Was steht an?", "Was mach ich heute?",
  "Wie läuft die Woche?", "Schaff ich mein Ziel?",
  "Genug bewegt?", "Wie viele Schritte?",
  "Sag was Nettes!", "Motivier mich!",
];
const WCH = 21; // max characters per bubble line
const LH = 20; // bubble line pitch
const T_Q = 120; // question bubble appears
const T_DOT = 560; // "Coach tippt..." starts
const T_TXT = 1500; // answer starts typing
const CPS = 30; // ms per typed character

let tapN = 0; // touch & hold: next message
let busy = true;
let cKey = "";
let cQ = "";
let cLines = null;
let cMsg = "";

function cat(i) { return i < 8 ? 0 : i < 15 ? 1 : i < 22 ? 2 : i < 26 ? 3 : 4; }

// derived numbers (shared by ok/txt)
let km = 0, kmLeft = 0, bikeOk = false, dl = 0, rem = 0, rh = 0, stl = 0;
function prep(d) {
  bikeOk = d.wkBike >= 0 && d.cfg.bikeGoal > 0;
  km = d.wkBike >= 0 ? Math.floor(d.wkBike / 1000) : 0;
  kmLeft = d.cfg.bikeGoal - km;
  dl = d.dayGoal - d.trainDays;
  rem = 7 - d.dayIdx;
  rh = d.recov >= 0 ? Math.floor((d.recov + 59) / 60) : 0;
  stl = d.stepGoal - d.steps;
}

// does template i apply to the data?
function ok(i, d) {
  const bb = d.bb, sl = d.sleep, rc = d.recov, sr = d.stress, h = d.h;
  switch (i) {
    case 0: return bb >= 65 && sl >= 70;
    case 1: return bb >= 45 && bb < 65;
    case 2: return bb >= 0 && bb < 30;
    case 3: return rc >= 360;
    case 4: return sr >= 60;
    case 5: return sl >= 0 && sl < 55;
    case 6: return rc >= 0 && rc < 180 && bb >= 60;
    case 7: return sr >= 0 && sr < 25 && bb >= 40;
    case 8: return h >= 5 && h < 11 && bb >= 50;
    case 9: return h >= 5 && h < 11;
    case 10: return h >= 11 && h < 17 && bb >= 45;
    case 11: return h >= 17 && h < 21 && bb >= 40 && bikeOk && kmLeft > 0;
    case 12: return h >= 17 && h < 21;
    case 13: return h >= 21 || h < 5;
    case 14: return h >= 11 && h < 17 && bb >= 0 && bb < 45;
    case 15: return dl > 0 && dl <= rem;
    case 16: return dl <= 0;
    case 17: return bikeOk && kmLeft <= 0;
    case 18: return bikeOk && kmLeft > 0;
    case 19: return dl > rem;
    case 20: return d.dayIdx === 0;
    case 21: return d.dayIdx >= 5;
    case 22: return d.stepGoal > 0 && d.steps >= d.stepGoal;
    case 23: return d.steps >= 0 && stl > 0 && stl <= 3000;
    case 24: return d.steps >= 0 && stl > 3000 && h >= 15;
    case 25: return d.steps >= 0 && d.steps < 2000 && h >= 10;
    case 26: return d.trainDays >= 3;
    case 28: return d.glances >= 2;
    case 29: return bb >= 70;
  }
  return true;
}

function txt(i, d) {
  switch (i) {
    case 0: return "Body Battery " + d.bb + " und Schlafscore " + d.sleep + " - heute gehen Intervalle!";
    case 1: return "Body Battery " + d.bb + ". Solide! Tempo geht, nur kein Rekordversuch.";
    case 2: return "Akku bei " + d.bb + ". Heute ist Sofa-Training: Beine hoch, Wasser trinken.";
    case 3: return "Erholung noch " + rh + " h - lieber locker rollen.";
    case 4: return "Stress " + d.stress + ". Atme 4 Sekunden ein, 6 aus. Ich warte.";
    case 5: return "Schlafscore " + d.sleep + ". Heute kein Ego-Sprint, okay? Und früh ins Bett!";
    case 6: return "Voll erholt und " + d.bb + " im Akku. Du bist startklar!";
    case 7: return "Stress nur " + d.stress + ". Tiefenentspannt - perfekt für lange Grundlage.";
    case 8: return "Guten Morgen! 20 Minuten locker vor der Arbeit? Akku " + d.bb + " sagt ja.";
    case 9: return "Morgen! Erst Kaffee, dann der Plan: Heute zählt jede Treppe.";
    case 10: return "Mittagstief? 10 Minuten zügig gehen schlagen jeden Espresso.";
    case 11: return "Noch " + kmLeft + " km bis zu deinem Wochenziel. Kleine Feierabendrunde?";
    case 12: return "Feierabend! 15 Minuten locker ausrollen oder die Hüfte dehnen.";
    case 13: return "Es ist " + G.timeStr(d) + ". Bester Trainingsreiz jetzt: Schlaf. Gute Nacht!";
    case 14: return "Akku " + d.bb + " am Nachmittag: heute nur Zone 2, versprochen?";
    case 15: return d.trainDays + " von " + d.dayGoal + " Trainingstagen. Noch " + dl + " - das packst du!";
    case 16: return "Wochenziel " + d.dayGoal + " Tage: erledigt! Alles ab jetzt ist Bonus.";
    case 17: return km + " km diese Woche - Radziel geknackt! Respekt.";
    case 18: return km + " von " + d.cfg.bikeGoal + " km. Zwift heute Abend? Noch " + kmLeft + " km bis zum Ziel.";
    case 19: return "Ziel " + d.dayGoal + " Tage wird knapp. Mach heute, was geht - ohne Stress!";
    case 20: return "Montag! Frische Woche, " + d.dayGoal + " Trainingstage. Wir starten sanft.";
    case 21: return "Wochenende! Zeit für die lange Runde - mit Kuchenstopp.";
    case 22: return G.num(d.steps) + " Schritte - Ziel erreicht! Der Rest ist Kür.";
    case 23: return "Nur noch " + G.num(stl) + " Schritte. Einmal um den Block?";
    case 24: return "Noch " + G.num(stl) + " Schritte offen. Telefonate ab jetzt im Gehen!";
    case 25: return "Erst " + G.num(d.steps) + " Schritte? Steh auf, ich zähle mit.";
    case 26: return d.trainDays + " Trainingstage diese Woche. Ich bin ein bisschen stolz.";
    case 27: return "Konstanz schlägt Intensität. Heute zählt nur: dranbleiben.";
    case 28: return "Schon " + d.glances + "x heute nach mir geschaut. Ich mag dich auch.";
    case 29: return "Akku " + d.bb + "? Heute fährst du allen davon.";
  }
  return "Kette ölen, Reifen prüfen. Ein guter Coach ist auch Mechaniker.";
}

// greedy word wrap: first line w1 chars, the rest w chars
function wrap(s, w1, w) {
  const out = [];
  const n = s.length;
  let i = 0, lw = w1;
  while (i < n) {
    if (n - i <= lw) { out.push(s.substring(i)); break; }
    let cut = -1;
    for (let k = i + lw; k > i; k--) if (s.charAt(k) === " ") { cut = k; break; }
    if (cut < 0) { out.push(s.substring(i, i + lw)); i += lw; }
    else { out.push(s.substring(i, cut)); i = cut + 1; }
    lw = w;
  }
  return out;
}

// choose question + message for this raise (cached per data snapshot / raise)
function pick(d, seed, st) {
  const key = d.unix + "/" + seed + "/" + st;
  if (key === cKey && cLines !== null) return;
  cKey = key;
  prep(d);
  // candidates in a strided order (7 is coprime to 31) so consecutive raises jump between categories
  const cand = [];
  for (let k = 0; k < NT; k++) {
    const i = (k * 7) % NT;
    if (ok(i, d)) cand.push(i);
  }
  const n = cand.length;
  const i = cand[seed % n];
  cQ = QS[cat(i) * 2 + (Math.floor(seed / n) % 2)];
  cMsg = txt(i, d);
  cLines = st === 2 ? wrap(cMsg, WCH - 7, WCH) : wrap(cMsg, WCH, WCH);
}

// glass background colour at height y (vertical gradient)
function glassBg(y) {
  return G.mix(0x2a1550, 0x0b3a4a, G.clamp((y - 40) / 380, 0, 1));
}

// three bouncing dots
function dots(dc, x, y, ms, col) {
  for (let k = 0; k < 3; k++) {
    const ph = (ms / 1000) * 6.0 - k * 0.7;
    const b = Math.max(0, Math.sin(ph));
    dc.setColor(G.mix(G.dim(col, 0.45), col, b), -1);
    dc.fillCircle(x + k * 14, y - b * 6, 4);
  }
}

function seedOf(d) { const s = d.wakeN + tapN; return s < 0 ? 0 : s; }

export default {
  get fps() { return busy ? 20 : 6; },

  tap(x, y, d) {
    tapN++;
    return true;
  },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = st === 2 ? 0x3bff6a : d.accent;
    const p = a.intro;
    const live = a.live;
    const ms = live ? (a.tap < a.t ? a.tap : a.t) : 99999;
    pick(d, seedOf(d), st);
    const lines = cLines;
    const nl = lines.length;
    let nch = 0;
    for (let k = 0; k < nl; k++) nch += lines[k].length;
    const tEnd = T_TXT + nch * CPS;
    busy = ms < tEnd + 100;
    const typing = ms >= T_DOT && ms < T_TXT;
    // characters typed so far
    const shown = ms < T_TXT ? 0 : Math.floor((ms - T_TXT) / CPS);
    const qp = G.ease((ms - T_Q) / 320);

    // ---- background
    if (st === 3) {
      for (let k = 0; k < 19; k++) {
        dc.setColor(glassBg(k * 24 + 12), -1);
        dc.fillRectangle(0, k * 24, 454, 24);
      }
      // soft bokeh blobs drifting slowly
      const tt = live ? a.t / 1000 : 0;
      for (let b = 0; b < 3; b++) {
        const bx = 227 + (b - 1) * 120 + Math.sin(tt * 0.5 + b * 2.1) * 18;
        const by = 150 + b * 90 + Math.cos(tt * 0.4 + b) * 14;
        const bc = b === 1 ? 0xd65db1 : acc;
        for (let r = 0; r < 6; r++) {
          dc.setColor(G.mix(glassBg(by), bc, 0.06 + r * 0.045), -1);
          dc.fillCircle(bx, by, 80 - r * 12);
        }
      }
    }

    // ---- time
    const ts = G.timeStr(d);
    if (st === 2) {
      const tw = F.pxW(ts, 6);
      dc.setColor(G.dim(acc, 0.22), -1);
      F.px(dc, ts, 227 - tw / 2 - 2, 38, 6, 0, -4);
      dc.setColor(acc, -1);
      F.px(dc, ts, 227 - tw / 2, 40, 6, 0, 0);
    } else {
      dc.setColor(0xffffff, -1);
      F.st(dc, ts, 227, 66, 48, st === 3 ? 3 : 5, 1, G.ease(p * 1.3), 0);
    }

    // ---- header: pulsing presence dot + "Coach online / tippt..."
    const hp = G.ease(p * 1.5 - 0.2);
    if (hp > 0) {
      const sub = typing ? "tippt..." : "online";
      const head = st === 2 ? "coach.ki" : "COACH";
      const hw = F.pxW(head + " online", 2) + 16;
      const hx = 227 - hw / 2;
      const hy = 102;
      const onC = st === 2 ? acc : 0x34d27b;
      const pulse = live && !busy ? (a.t % 1400) / 1400 : 1;
      if (pulse < 1) {
        dc.setColor(G.dim(onC, (1 - pulse) * 0.6), -1);
        dc.fillCircle(hx + 5, hy + 7, 5 + pulse * 6);
      }
      dc.setColor(G.dim(onC, hp), -1);
      dc.fillCircle(hx + 5, hy + 7, 5);
      dc.setColor(G.dim(st === 2 ? acc : 0xffffff, hp), -1);
      F.px(dc, head, hx + 16, hy, 2, 0, 0);
      dc.setColor(G.dim(st === 2 ? acc : 0x9aa3ad, hp * 0.8), -1);
      F.px(dc, sub, hx + 16 + F.pxW(head + " ", 2) + 2, hy, 2, 0, 0);
    }

    // ---- conversation
    if (st === 2) {
      // terminal transcript
      const x0 = 70;
      let y = 132 + Math.floor((206 - (30 + nl * LH + LH)) / 2);
      const dimC = G.dim(acc, 0.55);
      if (qp > 0) {
        dc.setColor(G.dim(acc, 0.55 * qp), -1);
        F.px(dc, ">", x0, y, 2, 0, 0);
        dc.setColor(G.dim(acc, qp), -1);
        F.px(dc, cQ, x0 + 24, y, 2, 0, 0);
      }
      y += 30;
      if (ms >= T_DOT) {
        dc.setColor(dimC, -1);
        F.px(dc, "coach:", x0, y, 2, 0, 0);
        if (typing) {
          dots(dc, x0 + 92, y + 7, ms - T_DOT, acc);
        } else {
          let left = shown, cx = -1, cy = -1;
          for (let k = 0; k < nl; k++) {
            const lx = k === 0 ? x0 + 84 : x0;
            const ly = y + k * LH;
            let s = lines[k];
            if (left < s.length) { s = s.substring(0, left); cx = lx + left * 12; cy = ly; }
            left -= lines[k].length;
            dc.setColor(acc, -1);
            if (s.length > 0) F.px(dc, s, lx, ly, 2, 0, 0);
            if (cy >= 0) break;
          }
          if (cy < 0) { cx = x0; cy = y + nl * LH; }
          if (busy || !live || Math.floor(a.t / 500) % 2 === 0) {
            dc.setColor(acc, -1);
            dc.fillRectangle(cx, cy - 1, 10, 16);
          }
        }
      }
    } else {
      // bubbles
      const bh = nl * LH - 6 + 24; // final coach bubble height
      const top = 132 + Math.floor((206 - (30 + 12 + bh)) / 2);
      // question (user, right)
      if (qp > 0) {
        const qw = F.pxW(cQ, 2) + 24;
        const qx = 372 - qw;
        const qy = top + (1 - qp) * 14;
        let qc;
        if (st === 3) {
          qc = G.mix(glassBg(qy + 15), acc, 0.55 * qp);
        } else qc = G.dim(acc, qp);
        dc.setColor(qc, -1);
        dc.fillRoundedRectangle(qx, qy, qw, 30, 14);
        dc.fillPolygon([[qx + qw - 16, qy + 20], [qx + qw + 6, qy + 31], [qx + qw - 4, qy + 14]]);
        if (st === 3) {
          dc.setColor(G.mix(qc, 0xffffff, 0.35), -1);
          dc.setPenWidth(1);
          dc.drawRoundedRectangle(qx, qy, qw, 30, 14);
        }
        dc.setColor(G.dim(0xffffff, qp), -1);
        F.px(dc, cQ, qx + 12, qy + 8, 2, 0, 0);
      }
      // coach (left) with avatar
      if (ms >= T_DOT) {
        const by = top + 42;
        let bw, h;
        if (typing) { bw = 74; h = 30; }
        else {
          // grow with the typed text (width of the widest typed line, rows typed so far)
          let left = shown, rows = 1, mw = 0;
          for (let k = 0; k < nl; k++) {
            const len = lines[k].length;
            const n = left < len ? left : len;
            if (n > 0) { rows = k + 1; mw = Math.max(mw, n * 12 - 2); }
            left -= len;
          }
          bw = Math.max(74, mw + 24);
          h = rows * LH - 6 + 24;
        }
        const bx = 76;
        let bc, tc;
        if (st === 3) { bc = G.mix(glassBg(by + h / 2), 0xffffff, 0.16); tc = 0xffffff; }
        else { bc = 0x262b33; tc = 0xf2f4f7; }
        // avatar
        const ay = by + h - 13;
        dc.setColor(st === 3 ? G.mix(acc, 0xffffff, 0.25) : acc, -1);
        dc.fillCircle(52, ay, 14);
        dc.setColor(0xffffff, -1);
        F.px(dc, "C", 52, ay - 7, 2, 1, 0);
        // bubble + tail
        dc.setColor(bc, -1);
        dc.fillRoundedRectangle(bx, by, bw, h, 14);
        dc.fillPolygon([[bx + 16, by + h - 4], [bx - 6, by + h + 1], [bx + 4, by + h - 16]]);
        if (st === 3) {
          dc.setColor(G.mix(bc, 0xffffff, 0.3), -1);
          dc.setPenWidth(1);
          dc.drawRoundedRectangle(bx, by, bw, h, 14);
          dc.setColor(G.mix(bc, 0xffffff, 0.55), -1);
          dc.fillRectangle(bx + 14, by + 1, bw - 28, 1);
        }
        if (typing) {
          dots(dc, bx + 23, by + 15, ms - T_DOT, st === 3 ? 0xffffff : 0xaab4c0);
        } else {
          let left = shown;
          dc.setColor(tc, -1);
          for (let k = 0; k < nl && left > 0; k++) {
            let s = lines[k];
            if (left < s.length) s = s.substring(0, left);
            left -= lines[k].length;
            F.px(dc, s, bx + 12, by + 12 + k * LH, 2, 0, 0);
          }
        }
      }
    }

    // ---- slot chips
    let lb = [], tw = 0, n = 0;
    for (let k = 0; k < 3; k++) {
      lb.push(d.slots[k].lbl);
      if (lb[k]) n++;
    }
    let ws = [];
    for (let pass = 0; pass < 2; pass++) {
      tw = n > 1 ? (n - 1) * 8 : 0; // gaps between the chips; empty slots take no space
      ws = [];
      for (let k = 0; k < 3; k++) {
        if (!lb[k]) { ws.push(0); continue; }
        const w = Math.max(F.pxW(lb[k], 2), F.pxW(d.slots[k].val, 2)) + 16;
        ws.push(w);
        tw += w;
      }
      if (tw <= 300) break;
      for (let k = 0; k < 3; k++) if (lb[k].length > 6) lb[k] = lb[k].substring(0, 6);
    }
    let x = 227 - tw / 2;
    for (let k = 0; k < 3; k++) {
      if (!lb[k]) continue;
      const sp = G.stag(p, k, 0.1, 0.5);
      const w = ws[k];
      if (sp > 0) {
        const y = 352 + (1 - G.ease(sp)) * 10;
        if (st === 2) {
          dc.setColor(G.dim(acc, 0.35 * sp), -1);
          dc.setPenWidth(1);
          dc.drawRectangle(x, y, w, 40);
          dc.setColor(G.dim(acc, 0.55 * sp), -1);
          F.px(dc, lb[k], x + w / 2, y + 5, 2, 1, 0);
          dc.setColor(G.dim(acc, sp), -1);
          F.px(dc, d.slots[k].val, x + w / 2, y + 21, 2, 1, 0);
        } else {
          const cc = st === 3 ? G.mix(glassBg(y + 20), 0xffffff, 0.13 * sp) : G.dim(0x1b1f25, sp);
          dc.setColor(cc, -1);
          dc.fillRoundedRectangle(x, y, w, 40, 12);
          if (st === 3) {
            dc.setColor(G.mix(cc, 0xffffff, 0.25), -1);
            dc.setPenWidth(1);
            dc.drawRoundedRectangle(x, y, w, 40, 12);
          }
          dc.setColor(G.dim(st === 3 ? 0xc9c3e6 : 0x8a94a0, sp), -1);
          F.px(dc, lb[k], x + w / 2, y + 5, 2, 1, 0);
          dc.setColor(G.dim(st === 3 ? 0xffffff : d.dcol, sp), -1);
          F.px(dc, d.slots[k].val, x + w / 2, y + 21, 2, 1, 0);
        }
      }
      x += w + 8;
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    pick(d, seedOf(d), st);
    const ts = G.timeStr(d);
    const fg = st === 2 ? 0x3bff6a : d.accent;
    if (st === 2) {
      dc.setColor(G.dim(fg, 0.5), -1);
      F.px(dc, ts, 227 + o[0], 150 + o[1], 6, 1, 1);
    } else {
      dc.setColor(0x8a8a8a, -1);
      F.st(dc, ts, 227 + o[0], 186 + o[1], 64, 2, 1, 1.0, 0);
    }
    // first words of the last message, cut at a word boundary
    const ml = wrap(cMsg, 20, 20);
    const m = ml.length > 1 ? ml[0] + "..." : ml[0];
    dc.setColor(G.dim(fg, 0.55), -1);
    dc.fillCircle(227 + o[0] - F.pxW(m, 2) / 2 - 12, 263 + o[1], 4);
    dc.setColor(0x6a6a6a, -1);
    F.px(dc, m, 227 + o[0] + 6, 256 + o[1], 2, 1, 0);
  },
};
