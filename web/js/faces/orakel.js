// ORAKEL — "KI-Orakel": a glowing oracle orb. Every wrist raise it "thinks" (the swirl
// accelerates, the glow swells), then answers a question about your day — 27 question/answer
// pairs mixing your data with a pinch of chance, picked from d.wakeN. Touch & hold shakes it.
// Styles: 1 Kristall (glass sphere), 2 Nebula (galaxy vortex), 3 8-Bit (pixel crystal ball).
// Mirrors watch/source/faces/Orakel.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const CX = 227, CY = 226, R = 86;
const NT = 27;
const T_THINK = 1800; // swirl spin-up and slow-down
const T_ANS = 1650; // headline fades in
const T_DET = 1950; // detail fades in
const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
// 8-bit grid: 6 px cells, orb = 28 x 28 cells
const PS = 6, OX = CX - 84, OY = CY - 84;

// ---- precomputed geometry (small)
// Kristall particles: [radius frac, angle, y offset, speed, colour 0..2] x 30
const KP = [];
// Nebula: per particle [radius jitter, angle jitter, size jitter] x 60 arms + 30 dust [r, a, s]
const NP = [];
const ND = [];
// stars: [x, y, phase, speed] x 16
const SP = [];
// 8-bit orb runs: [i0, len, j, colour index]
const RUNS = [];
(function () {
  let s = 4242;
  for (let k = 0; k < 30; k++) {
    s = G.rnd(s); const pr = 0.2 + G.rf(s) * 0.7;
    s = G.rnd(s); const pa = G.rf(s) * 6.283;
    s = G.rnd(s); const yo = (G.rf(s) * 2 - 1) * (1 - pr) * 0.8;
    s = G.rnd(s); const pk = 0.6 + G.rf(s) * 0.8;
    KP.push(pr, pa, yo, pk / (0.4 + pr), k % 3);
  }
  for (let k = 0; k < 60; k++) {
    s = G.rnd(s); const a = (G.rf(s) * 2 - 1) * 9;
    s = G.rnd(s); const b = (G.rf(s) * 2 - 1) * 0.22;
    s = G.rnd(s); NP.push(a, b, G.rf(s));
  }
  for (let k = 0; k < 30; k++) {
    s = G.rnd(s); const r = 20 + G.rf(s) * 105;
    s = G.rnd(s); const a = G.rf(s) * 6.283;
    s = G.rnd(s); ND.push(r, a, G.rf(s));
  }
  let n = 0;
  while (n < 16) {
    s = G.rnd(s); const x = 30 + (s % 394);
    s = G.rnd(s); const y = 30 + (s % 394);
    s = G.rnd(s);
    const dx = x - 227, dy = y - 227, q = dx * dx + dy * dy;
    const ox = x - CX, oy = y - CY;
    if (q > 200 * 200 || ox * ox + oy * oy < 125 * 125) continue;
    if (y > 26 && y < 132 && x > 96 && x < 358) continue; // keep time + question clean
    if (y > 330 && y < 396 && x > 60 && x < 394) continue; // and the answer
    let near = false;
    for (let k = 0; k < SP.length; k += 4) if (Math.abs(SP[k] - x) < 40 && Math.abs(SP[k + 1] - y) < 40) near = true;
    if (near) continue;
    SP.push(OX + Math.floor((x - OX) / PS) * PS, OY + Math.floor((y - OY) / PS) * PS, G.rf(s) * 6.283, 1.2 + (s % 100) / 50);
    n++;
  }
  // pixel sphere, light from the top left. 0 outline, 1..4 body light->dark, 5 rim light, 6 glow
  for (let j = -1; j < 29; j++) {
    let cur = -1, i0 = 0;
    for (let i = -1; i <= 29; i++) {
      let c = -1;
      if (i < 29) {
        const dx = i - 13.5, dy = j - 13.5, q = dx * dx + dy * dy;
        if (q < 158) {
          const sh = Math.sqrt(q) / 12.6 * 0.55 + (dx + dy) / 25 * 0.45;
          c = sh < 0.05 ? 1 : sh < 0.3 ? 2 : sh < 0.55 ? 3 : 4;
          if (q > 112 && dx + dy > 9) c = 5;
        } else if (q < 196) c = 0;
        else if (q < 240) c = 6;
      }
      if (c !== cur) {
        if (cur >= 0) RUNS.push(i0, i - i0, j, cur);
        cur = c; i0 = i;
      }
    }
  }
})();

let tapN = 0;
let busy = true;
let cKey = "";
let cQ = null, cH = "", cD = null, cAod = "";

// derived numbers
let dl = 0, rem = 0, rh = 0, kmLeft = 0, bikeOk = false, stl = 0, kmh = 0;
function prep(d) {
  dl = d.dayGoal - d.trainDays;
  rem = 7 - d.dayIdx;
  rh = d.recov >= 0 ? Math.floor((d.recov + 59) / 60) : 0;
  bikeOk = d.wkBike >= 0 && d.cfg.bikeGoal > 0;
  kmLeft = d.cfg.bikeGoal - (d.wkBike >= 0 ? Math.floor(d.wkBike / 1000) : 0);
  stl = d.stepGoal - d.steps;
  kmh = d.wind >= 0 ? Math.round(d.wind * 3.6) : -1;
}

function ok(i, d) {
  const bb = d.bb, h = d.h;
  switch (i) {
    case 0: return bb >= 55 && d.recov < 360;
    case 1: return d.recov >= 360;
    case 2: return bb >= 0 && bb < 35 && d.recov < 360;
    case 3: return dl > 0 && dl <= rem;
    case 4: return dl <= 0;
    case 5: return dl > rem;
    case 6: return h >= 20 || h < 5;
    case 7: return h >= 5 && h < 20 && bb >= 0 && bb < 40;
    case 8: return h >= 5 && h < 14 && bb >= 40;
    case 9: return bikeOk && kmLeft > 0;
    case 10: return d.sleep >= 0 && d.sleep < 60;
    case 11: return d.sleep >= 75;
    case 12: return d.stress >= 50;
    case 13: return d.stress >= 0 && d.stress < 50;
    case 14: return d.steps >= 0 && stl > 0;
    case 15: return d.stepGoal > 0 && d.steps >= d.stepGoal;
    case 16: return d.rain >= 0;
    case 17: return d.sunset >= 0;
    case 24: return kmh >= 0;
    case 26: return d.glances >= 2;
  }
  return true;
}

function ques(i) {
  if (i < 3) return "Soll ich heute trainieren?";
  if (i < 6) return "Schaffe ich mein Wochenziel?";
  if (i < 9) return "Kaffee oder Schlaf?";
  switch (i) {
    case 9: return "Wie weit fahre ich heute?";
    case 10: case 11: return "Werde ich heute müde?";
    case 12: case 13: return "Bin ich gestresst?";
    case 14: case 15: return "Schaffe ich meine Schritte?";
    case 16: return "Regnet es heute?";
    case 17: return "Wann wird es dunkel?";
    case 18: return "Was ist der Sinn des Lebens?";
    case 19: return "Was bringt der Tag?";
    case 20: return "Gewinne ich den Zwift-Sprint?";
    case 21: return "Brauche ich ein neues Rad?";
    case 22: return "Wird heute ein guter Tag?";
    case 23: return "Pause oder Pizza?";
    case 24: return "Wird es windig?";
    case 25: return "Wer ist der Schnellste?";
  }
  return "Schaue ich zu oft auf die Uhr?";
}

// suggested ride length (km) for "Wie weit fahre ich heute?"
function rideKm() { return G.clamp(Math.floor((Math.floor(kmLeft / rem) + 4) / 5) * 5, 20, 90); }

function head(i, d) {
  switch (i) {
    case 0: case 3: case 10: case 14: case 22: return "JA.";
    case 1: case 2: return "NEIN.";
    case 4: return "LÄNGST.";
    case 5: return "KNAPP.";
    case 6: return "SCHLAF.";
    case 7: case 8: return "KAFFEE.";
    case 9: return rideKm() + " KM";
    case 11: return "NÖ.";
    case 12: return "LEIDER.";
    case 13: return "ZEN.";
    case 15: return "SCHON!";
    case 16: return d.rain >= 50 ? "JA." : "NEIN.";
    case 17: return G.hm(d.sunset);
    case 18: return "42.";
    case 19: return "BERGE.";
    case 20: return "JEIN.";
    case 21: return "N+1";
    case 23: return "BEIDES.";
    case 24: return kmh >= 20 ? "JA." : "NEIN.";
    case 25: return "DU.";
  }
  return "JA.";
}

function det(i, d) {
  switch (i) {
    case 0: return "Deine Body Battery sagt " + d.bb + ".";
    case 1: return "Erholung: noch " + rh + " h. Geduld.";
    case 2: return "Akku " + d.bb + ". Die Kugel sieht ein Sofa.";
    case 3: return "Mit " + d.trainDays + " von " + d.dayGoal + " Tagen? Die Sterne sagen: " + DAYS[(d.dayIdx + 1) % 7] + "!";
    case 4: return d.trainDays + " von " + d.dayGoal + " Tagen. Die Kugel verneigt sich.";
    case 5: return "Noch " + dl + " Tage, " + rem + " bleiben. Wunder gibt es.";
    case 6: return "Es ist " + G.timeStr(d) + ". Die Kugel gähnt schon.";
    case 7: return "Akku " + d.bb + ". Einen Doppelten, bitte.";
    case 8: return "Und danach raus aufs Rad!";
    case 9: {
      const r = kmLeft - rideKm();
      return r > 0 ? "Dann fehlen noch " + r + " km zum Wochenziel." : "Damit ist dein Wochenziel voll!";
    }
    case 10: return "Schlafscore " + d.sleep + ". Ich sehe Gähnen.";
    case 11: return "Schlafscore " + d.sleep + ". Du strahlst ja richtig.";
    case 12: return "Stress " + d.stress + ". Atme 4 ein, 6 aus. Ich atme mit.";
    case 13: return "Stress " + d.stress + ". Ruhig wie ein Bergsee.";
    case 14: return "Noch " + G.num(stl) + " Schritte. Die Kugel glaubt an dich.";
    case 15: return G.num(d.steps) + " Schritte. Die Prophezeiung ist erfüllt.";
    case 16: return "Regenrisiko " + d.rain + "%. " + (d.rain >= 50 ? "Zwift wartet." : "Ab aufs Rad!");
    case 17: return d.mins < d.sunset ? "Bis dahin passt noch eine Runde." : "Schon passiert. Licht ans Rad!";
    case 18: return "Die Frage war nur zu schwierig.";
    case 19: return "Frag mich nach dem nächsten Anstieg.";
    case 20: return "Nur wenn du zuerst antrittst.";
    case 21: return "Die richtige Zahl Räder ist immer n+1.";
    case 22: return "Die Sterne stehen auf Rückenwind.";
    case 23: return "Die Kugel urteilt nicht.";
    case 24: return kmh + " km/h. " + (kmh >= 20 ? "Windschatten suchen!" : "Kaum Gegenwind.");
    case 25: return "Zumindest an diesem Handgelenk.";
  }
  return d.glances + " Blicke heute. Die Kugel fühlt sich geehrt.";
}

// greedy word wrap, w chars per line
function wrap(s, w) {
  const out = [];
  const n = s.length;
  let i = 0;
  while (i < n) {
    if (n - i <= w) { out.push(s.substring(i)); break; }
    let cut = -1;
    for (let k = i + w; k > i; k--) if (s.charAt(k) === " ") { cut = k; break; }
    if (cut < 0) { out.push(s.substring(i, i + w)); i += w; }
    else { out.push(s.substring(i, cut)); i = cut + 1; }
  }
  return out;
}

function pick(d, seed) {
  const key = d.unix + "/" + seed;
  if (key === cKey && cQ !== null) return;
  cKey = key;
  prep(d);
  const cand = [];
  for (let k = 0; k < NT; k++) {
    const i = (k * 7) % NT;
    if (ok(i, d)) cand.push(i);
  }
  const i = cand[seed % cand.length];
  cQ = wrap(ques(i), 26);
  cH = head(i, d);
  cD = wrap(det(i, d), 26);
  cAod = cH;
}

function seedOf(d) { const s = d.wakeN + tapN; return s < 0 ? 0 : s; }

// twinkling background stars
function stars(dc, t, pix, col) {
  const sc = [G.dim(col, 0.25), G.dim(col, 0.5), G.dim(col, 0.75), col];
  for (let k = 0; k < SP.length; k += 4) {
    const b = 0.5 + 0.5 * Math.sin(t * 0.001 * SP[k + 3] + SP[k + 2]);
    const x = SP[k], y = SP[k + 1];
    dc.setColor(sc[Math.floor(b * 3.99)], -1);
    if (pix) {
      dc.fillRectangle(x, y, PS, PS);
      if (b > 0.8) {
        dc.setColor(sc[1], -1);
        dc.fillRectangle(x - PS, y, PS, PS); dc.fillRectangle(x + PS, y, PS, PS);
        dc.fillRectangle(x, y - PS, PS, PS); dc.fillRectangle(x, y + PS, PS, PS);
      }
    } else {
      dc.fillCircle(x + 3, y + 3, 1 + b * 1.2);
      if (b > 0.85) {
        dc.fillRectangle(x + 3 - 5, y + 3, 11, 1);
        dc.fillRectangle(x + 3, y + 3 - 5, 1, 11);
      }
    }
  }
}

// centred stroke headline with a dark halo
function headline(dc, txt, x, y, h, col, halo) {
  dc.setColor(halo, -1);
  F.st(dc, txt, x, y, h, 9, 1, 1.0, 0);
  dc.setColor(col, -1);
  F.st(dc, txt, x, y, h, 3, 1, 1.0, 0);
}

export default {
  get fps() { return busy ? 20 : 15; },

  tap(x, y, d) {
    tapN++;
    return true;
  },

  // static layer: stars and time; question, orb and answer are the episode
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const live = a.live;
    const ms = live ? (a.tap < a.t ? a.tap : a.t) : 99999;
    const t = live ? a.t : 0;
    busy = ms < T_DET + 700;
    pick(d, seedOf(d));
    // thinking: swirl phase (spin-up and down), glow bump, answer reveal
    const tp = G.clamp(ms / T_THINK, 0, 1);
    const ph = ms * 0.0006 + 10 * G.easeInOut(tp);
    const think = Math.sin(Math.PI * tp);
    const rev = G.clamp((ms - T_ANS) / 500, 0, 1);
    const rd = G.clamp((ms - T_DET) / 500, 0, 1);
    // touch & hold: shake
    let cx = CX;
    if (live && a.tap < 700) cx = CX + Math.sin(a.tap * 0.06) * 12 * (1 - a.tap / 700);

    const pale = G.mix(acc, 0xffffff, 0.6);
    if (S) {
      stars(dc, t, st === 3, st === 3 ? 0xcdb8ff : 0xdcd4ff);

      // ---- time (always legible)
      const ts = G.timeStr(d);
      if (st === 3) {
        dc.setColor(0x3a2470, -1);
        F.px(dc, ts, 230, 37, 5, 1, 0);
        dc.setColor(0xf2eaff, -1);
        F.px(dc, ts, 227, 34, 5, 1, 0);
      } else {
        dc.setColor(0xf2eeff, -1);
        F.st(dc, ts, 227, 56, 40, 3, 1, G.ease(p * 1.4), 0);
      }
    }

    if (!M) return;
    // ---- question
    const qa = G.clamp((ms - 80) / 400, 0, 1);
    if (qa > 0) {
      dc.setColor(G.dim(G.mix(acc, 0xffffff, 0.45), 0.85 * qa), -1);
      const q0 = cQ.length > 1 ? 88 : 96;
      for (let k = 0; k < cQ.length; k++) F.px(dc, cQ[k], 227, q0 + k * 18, 2, 1, 0);
    }

    // ---- orb
    if (st === 1) {
      // halo
      for (let g = 0; g < 4; g++) {
        dc.setColor(G.dim(acc, (0.05 + g * 0.045) * (1 + 0.9 * think)), -1);
        dc.fillCircle(cx, CY, R + 18 - g * 4);
      }
      const body = 0x150b33;
      dc.setColor(body, -1);
      dc.fillCircle(cx, CY, R);
      // nebula clouds
      const NC = [0x7b3fe4, 0x2f5bff, 0xd04fc0];
      for (let b = 0; b < 3; b++) {
        const an = ph * 0.35 + b * 2.094;
        const bx = cx + Math.cos(an) * 26, by = CY + Math.sin(an) * 16;
        for (let l = 0; l < 4; l++) {
          dc.setColor(G.mix(body, NC[b], (0.2 + l * 0.13) * (0.85 + 0.4 * think) * (1 - 0.2 * rev)), -1);
          dc.fillCircle(bx, by, 46 - l * 10);
        }
      }
      // swirling particles (depth: front ones bigger and brighter)
      // palette: 3 colours x 4 depth levels (computed once per frame, not per particle)
      const PC = [0xc9b2ff, 0x8fb4ff, 0xff9ee8];
      const pp = [];
      for (let c = 0; c < 12; c++) pp.push(G.mix(body, PC[Math.floor(c / 4)], (0.35 + 0.7 * ((c % 4) + 0.5) / 4) * (1 - 0.4 * rev)));
      for (let k = 0; k < KP.length; k += 5) {
        const an = KP[k + 1] + ph * KP[k + 3];
        const pr = KP[k] * (R - 6);
        const dep = Math.sin(an);
        const x = cx + Math.cos(an) * pr;
        const y = CY + KP[k + 2] * R + dep * pr * 0.38;
        dc.setColor(pp[KP[k + 4] * 4 + Math.floor((dep + 1) * 1.99)], -1);
        dc.fillCircle(x, y, 1.4 + (dep + 1) * 0.9 + think * 0.8);
      }
      if (rev > 0) headline(dc, cH, cx, CY + 2, 30, G.mix(body, 0xffffff, rev), G.mix(body, 0x0c0620, rev));
      // glass: rim, specular highlights, caustic
      dc.setPenWidth(2);
      dc.setColor(G.mix(G.dim(acc, 0.7), 0xffffff, 0.25), -1);
      dc.drawCircle(cx, CY, R);
      dc.setColor(G.mix(body, 0xffffff, 0.28), -1);
      dc.fillEllipse(cx - 38, CY - 46, 20, 11);
      dc.setColor(G.mix(body, 0xffffff, 0.85), -1);
      dc.fillEllipse(cx - 42, CY - 50, 8, 4);
      dc.setColor(G.mix(body, pale, 0.45), -1);
      G.arcC(dc, cx, CY, R - 7, 140, 205);
      // stand: cup + foot
      const sy = CY + R;
      dc.setColor(0x4a3318, -1);
      dc.fillPolygon([[cx - 60, sy - 22], [cx + 60, sy - 22], [cx + 40, sy + 4], [cx - 40, sy + 4]]);
      dc.setColor(0x5e4220, -1);
      dc.fillPolygon([[cx - 60, sy - 22], [cx - 20, sy - 22], [cx - 14, sy + 4], [cx - 40, sy + 4]]);
      dc.setColor(0xd2a462, -1);
      dc.fillRectangle(cx - 60, sy - 23, 120, 2);
      dc.setColor(0x6e4d26, -1);
      dc.fillRectangle(cx - 52, sy - 10, 104, 1);
      dc.setColor(0x2e1f0f, -1);
      dc.fillRectangle(cx - 28, sy + 4, 56, 8);
      dc.setColor(0x3c2a16, -1);
      dc.fillRoundedRectangle(cx - 70, sy + 11, 140, 14, 6);
      dc.setColor(0xa57a44, -1);
      dc.fillRectangle(cx - 64, sy + 11, 128, 2);
    } else if (st === 2) {
      // galaxy vortex: two spiral arms + dust; the core collapses into an eye when answering
      const AC = [0xffe6ff, 0xff8fd8, acc, 0x4fc3ff];
      // faint gas clouds
      const GC = [acc, 0xff6fc8, 0x3f8fff];
      for (let b = 0; b < 3; b++) {
        const an = ph * 0.3 + b * 2.094;
        const bx = cx + Math.cos(an) * 64, by = CY + Math.sin(an) * 40;
        for (let l = 0; l < 4; l++) {
          dc.setColor(G.dim(GC[b], 0.035 + l * 0.03 + think * 0.04), -1);
          dc.fillCircle(bx, by, 58 - l * 13);
        }
      }
      // palette: 8 colour bins along the arm x 4 depth levels (once per frame)
      const pp = [];
      const mul = 0.75 + 0.25 * think;
      for (let b = 0; b < 8; b++) {
        const ci = (b + 0.5) / 8 * 2.99;
        const c = G.mix(AC[Math.floor(ci)], AC[Math.floor(ci) + 1], ci - Math.floor(ci));
        for (let l = 0; l < 4; l++) pp.push(G.dim(c, (0.3 + 0.7 * l / 3) * mul));
      }
      const trail = think > 0.05 ? 1 : 0;
      const ph2 = ph * 1.2, szm = 1 + think * 0.3;
      for (let k = 0; k < 48; k++) {
        const u = Math.floor(k / 2) / 23;
        let r = 14 + u * 108 + NP[k * 3];
        r += (70 - 0.55 * r) * rev; // the vortex opens into an eye
        const an = (k % 2) * 3.1416 + u * 4.2 + NP[k * 3 + 1] + ph2;
        const b4 = Math.floor(u * 7.99) * 4;
        const sz = (4.0 - u * 2.4 + NP[k * 3 + 2]) * szm;
        if (trail === 0) {
          const sn = Math.sin(an);
          dc.setColor(pp[b4 + Math.floor((sn + 1) * 1.99)], -1);
          dc.fillCircle(cx + Math.cos(an) * r, CY + sn * r * 0.62, sz);
          continue;
        }
        // comet trail against the spin direction while thinking
        for (let q = trail; q >= 0; q--) {
          const aq = an - q * 0.2;
          const sn = Math.sin(aq);
          let l = Math.floor((sn + 1) * 1.99) - q;
          if (l < 0) l = 0;
          dc.setColor(pp[b4 + l], -1);
          dc.fillCircle(cx + Math.cos(aq) * r, CY + sn * r * 0.62, sz * (1 - q * 0.25));
        }
      }
      const dc0 = G.dim(0xb8a8ff, 0.4), dc1 = G.dim(0xb8a8ff, 0.75);
      for (let k = 0; k < 60; k += 3) {
        let r = ND[k];
        r += (72 - 0.55 * r) * rev;
        const an = ND[k + 1] + ph * (40 / r);
        dc.setColor(ND[k + 2] > 0.5 ? dc1 : dc0, -1);
        dc.fillCircle(cx + Math.cos(an) * r, CY + Math.sin(an) * r * 0.62, 1.2);
      }
      // core
      const cs = (1 - rev) * (0.7 + 0.5 * think);
      if (cs > 0.02) {
        for (let l = 0; l < 5; l++) {
          dc.setColor(G.mix(G.dim(acc, 0.35), 0xffffff, l / 4), -1);
          dc.fillCircle(cx, CY, (34 - l * 6) * cs);
        }
      }
      if (rev > 0) {
        dc.setPenWidth(1);
        dc.setColor(G.dim(acc, 0.55 * rev), -1);
        dc.drawEllipse(cx, CY, 74, 45);
        const hv = G.clamp((rev - 0.4) / 0.6, 0, 1);
        if (hv > 0) {
          dc.setColor(G.dim(0xffffff, hv), -1);
          F.st(dc, cH, cx, CY + 1, 30, 3, 1, 1.0, 0);
        }
      }
    } else {
      // 8-bit crystal ball
      const ox = Math.round(cx - CX) + OX;
      const glow = G.dim(acc, 0.22 + 0.4 * think);
      const pal = [0x1b0f3a, G.mix(0x8a63ff, 0xd8c8ff, think * 0.5), 0x6a3fe0, 0x4b28b0, 0x321a7c, 0x9f7bff, glow];
      for (let k = 0; k < RUNS.length; k += 4) {
        dc.setColor(pal[RUNS[k + 3]], -1);
        dc.fillRectangle(ox + RUNS[k] * PS, OY + RUNS[k + 2] * PS, RUNS[k + 1] * PS, PS);
      }
      // mist sparks swirling inside (snapped to the grid)
      for (let k = 0; k < 15 * 5; k += 5) {
        const an = KP[k + 1] + ph * KP[k + 3];
        const pr = KP[k] * 10.5;
        const dep = Math.sin(an);
        const ci = Math.floor(13.5 + Math.cos(an) * pr);
        const cj = Math.floor(13.5 + KP[k + 2] * 11 + dep * pr * 0.4);
        dc.setColor(rev > 0.5 ? (dep > 0 ? 0x8f6bf0 : 0x5c36c8) : (dep > 0 ? 0xe2d4ff : 0xa585ff), -1);
        dc.fillRectangle(ox + ci * PS, OY + cj * PS, PS, PS);
      }
      // highlight
      dc.setColor(0xf4eeff, -1);
      dc.fillRectangle(ox + 7 * PS, OY + 5 * PS, 2 * PS, PS);
      dc.fillRectangle(ox + 5 * PS, OY + 6 * PS, 2 * PS, PS);
      dc.fillRectangle(ox + 5 * PS, OY + 7 * PS, PS, PS);
      dc.fillRectangle(ox + 10 * PS, OY + 4 * PS, PS, PS);
      if (rev > 0) {
        const sc = F.pxW(cH, 4) <= 150 ? 4 : 3;
        const hy = CY - Math.floor(7 * sc / 2);
        dc.setColor(0x1b0f3a, -1);
        F.px(dc, cH, cx + sc, hy + sc, sc, 1, 0);
        dc.setColor(G.mix(0x4b28b0, 0xffffff, rev), -1);
        F.px(dc, cH, cx, hy, sc, 1, 0);
      }
      // pixel stand (gold)
      const SG = [0xffd27a, 0xd89a3a, 0x8a5a1c, 0x4e300c];
      const ST = [24, 6, 16, 1, 25, 5, 18, 2, 26, 7, 14, 3, 27, 9, 10, 2, 28, 6, 16, 1, 29, 5, 18, 2, 30, 5, 18, 3];
      for (let k = 0; k < ST.length; k += 4) {
        dc.setColor(SG[ST[k + 3]], -1);
        dc.fillRectangle(ox + ST[k + 1] * PS, OY + ST[k] * PS, ST[k + 2] * PS, PS);
      }
      dc.setColor(SG[0], -1);
      dc.fillRectangle(ox + 7 * PS, OY + 25 * PS, PS * 3, PS);
      dc.fillRectangle(ox + 6 * PS, OY + 29 * PS, PS * 2, PS);
    }

    // ---- detail answer below the orb
    if (rd > 0) {
      dc.setColor(G.mix(0x000000, st === 3 ? 0xe9dcff : 0xece6ff, rd), -1);
      const y0 = cD.length > 1 ? 348 : 356;
      for (let k = 0; k < cD.length && k < 2; k++) F.px(dc, cD[k], 227, y0 + k * 19, 2, 1, 0);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = d.cfg.style;
    pick(d, seedOf(d));
    const ts = G.timeStr(d);
    const x = CX + o[0], y = CY + o[1];
    if (st === 3) {
      dc.setColor(G.dim(d.accent, 0.45), -1);
      for (let k = 0; k < RUNS.length; k += 4) {
        if (RUNS[k + 3] === 0) dc.fillRectangle(x - 84 + RUNS[k] * PS, y - 84 + RUNS[k + 2] * PS, RUNS[k + 1] * PS, PS);
      }
      dc.setColor(0x8a8a8a, -1);
      F.px(dc, ts, x, y - 22, 4, 1, 0);
      dc.setColor(G.dim(d.accent, 0.5), -1);
      F.px(dc, cH, x, y + 18, 2, 1, 0);
    } else {
      dc.setPenWidth(2);
      dc.setColor(G.dim(d.accent, 0.5), -1);
      dc.drawCircle(x, y, R);
      dc.setColor(G.dim(d.accent, 0.3), -1);
      dc.fillEllipse(x - 40, y - 48, 7, 4);
      dc.setColor(0x8a8a8a, -1);
      F.st(dc, ts, x, y - 6, 38, 2, 1, 1.0, 0);
      dc.setColor(G.dim(d.accent, 0.5), -1);
      F.px(dc, cH, x, y + 28, 2, 1, 0);
    }
  },
};
