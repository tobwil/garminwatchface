// NW — "what is going on in your body right now", shared by the live designs (LIVE). Mirrors
// watch/source/lib/Now.mc (copied into a watch face only when faces.json lists "libs": ["now"]).
//
// judge(d) combines heart rate, resting heart rate, movement, the stress and Body Battery trends and
// the time of day into ONE state, plus the facts behind it (array R, indices below). The first rule
// that matches wins (priority order):
//
//   EFFORT          Volle Belastung      hr >= 75 % hrMax now and >= 70 % 2..4 min ago (zone 3+ for minutes)
//   MOVING          In Bewegung          >= 400 steps in the last 10 min and hr >= rhr + 10 (or hr unknown)
//   AFTERBURN       Nachbrenner          30-min peak >= max(70 % hrMax, rhr + 35), hr now >= 15 below it and
//                                        still falling (-4 / 10 min) or still >= rhr + 10;
//                                        or the recovery time jumped up (>= +60 min) in the last 60 min
//   WIND_DOWN       Zeit runterzufahren  21:30 .. 3:00 and hr >= rhr + 12 or stress >= 40
//   STRESS_SITTING  Anspannung im Sitzen < 200 steps in 10 min (or unknown) and hr >= rhr + 20,
//                                        stress >= 60, or stress >= 40 and rising >= 10 / 30 min
//   RESERVE         Läuft auf Reserve    Body Battery < 20, or < 35 and falling >= 8 / h
//   EASING          Spannung lässt nach  stress of the previous 1.5 h peaked >= 50, now >= 15 lower
//   SITTING_LONG    Lange gesessen       no meaningful movement for >= 60 min (counted from 7:00, until 21:30)
//   CHARGING        Lädt gerade auf      Body Battery rising >= 3 / h and stress < 30 (or unknown)
//   CALM            Ruhig und erholt     everything else
//
// Trends (arrows): hr vs 10 min ago (+-5), stress vs the previous half hour (+-8), Body Battery vs one
// hour ago (+-3). Missing data degrades gracefully: unknown resting hr -> the lowest value of the 2-h
// history, unknown hr -> the rules use stress / Body Battery only, texts show "--"; nothing known at all
// -> CALM colours with the headline "Noch keine Werte".
//
// Movement: tick(d) samples the step counter once per minute (watch faces are redrawn every minute,
// also with the wrist down) into a ring of 11 minute slots -> steps of the last 10 min and the minutes
// since the last meaningful movement (>= 50 steps and >= 20 / min between two samples). The ring lives
// in memory and is saved to Storage ("nwR") at most every 10 min; the step reset at midnight is
// handled. The studio has no step stream: there d.simMove = [steps in 10 min, idle minutes] from the
// simulation sliders stands in for the ring (web only).
import { G } from "./gfx.js";
import { St } from "./st.js";

export const NS = {
  STRESS_SITTING: 0, MOVING: 1, EFFORT: 2, AFTERBURN: 3, CHARGING: 4,
  RESERVE: 5, EASING: 6, SITTING_LONG: 7, WIND_DOWN: 8, CALM: 9,
};
// R indices: 0 state, 1 hr, 2 rhr, 3 steps 10 min, 4 idle min, 5 stress, 6 stress change / 30 min,
// 7 Body Battery, 8 Body Battery change / h, 9 hr change / 10 min, 10 hr peak 30 min,
// 11 stress peak 1.5 h, 12 min since the recovery time jumped, 13 hrMax
const HEAD = ["Anspannung im Sitzen", "In Bewegung", "Volle Belastung", "Nachbrenner", "Lädt gerade auf",
  "Läuft auf Reserve", "Spannung lässt nach", "Lange gesessen", "Zeit runterzufahren", "Ruhig und erholt"];
// short word for the always-on screen
const SHORT = ["Anspannung", "Bewegung", "Belastung", "Nachbrenner", "Lädt", "Reserve", "Entspannt sich",
  "Sitzt lange", "Abschalten", "Ruhig"];
const COL = [0xff8a3a, 0x7ee04a, 0xff3a6a, 0xffb43a, 0x3ac8ff, 0xff4a3a, 0xb08aff, 0xffd83a, 0x7a8aff, 0x4ae0b0];
const N = 11; // ring slots (minutes): the last 10 min plus now

let _r = null; // [last minute, last steps, total, last move, last recovery, recovery jump, saved, s10, stamps x N, totals x N]

function v(n) { return n >= 0 ? "" + n : "--"; }

export const NW = {
  HEAD, SHORT, COL,

  // feed the movement ring (call it from draw and aod; cheap when the minute was sampled already)
  tick(d) {
    const now = Math.floor(d.unix / 60);
    if (_r === null) {
      const s = St.get("nwR", null);
      if (s !== null && s.length === 8 + 2 * N) _r = s;
      else {
        _r = [-1, 0, 0, -1, -1, -1, -1, -1];
        for (let i = 0; i < 2 * N; i++) _r.push(-1);
      }
    }
    if (now === _r[0] || d.steps < 0) return;
    let inc = 0;
    let gap = 1;
    if (_r[0] >= 0 && now > _r[0]) {
      gap = now - _r[0];
      inc = d.steps >= _r[1] ? d.steps - _r[1] : d.steps; // steps reset at midnight
    }
    if (_r[3] < 0) _r[3] = now;
    if (inc >= 50 && inc >= 20 * gap) _r[3] = now;
    _r[2] += inc;
    // recovery time jumped up (an activity was saved)
    if (d.recov >= 0) {
      if (_r[4] >= 0 && d.recov >= _r[4] + 60) _r[5] = now;
      _r[4] = d.recov;
    }
    const k = now % N;
    _r[8 + k] = now;
    _r[8 + N + k] = _r[2];
    // steps of the last 10 min: since the oldest sample in the window (after a longer gap: the steps
    // of the gap, prorated)
    let o = -1;
    for (let i = 0; i < N; i++) {
      const t = _r[8 + i];
      if (t >= now - 10 && t < now && (o < 0 || t < _r[8 + o])) o = i;
    }
    if (o >= 0) _r[7] = _r[2] - _r[8 + N + o];
    else _r[7] = _r[0] >= 0 ? Math.round((inc * 10) / gap) : -1;
    _r[0] = now;
    _r[1] = d.steps;
    if (_r[6] < 0 || now - _r[6] >= 10 || now < _r[6]) {
      _r[6] = now;
      St.set("nwR", _r);
    }
  },

  // [steps in the last 10 min, minutes since the last movement, minutes since the recovery jump]
  move(d) {
    if (d.simMove) return [d.simMove[0], d.simMove[1], -1]; // studio simulation (web only)
    if (_r === null || _r[0] < 0) return [-1, -1, -1];
    const now = Math.floor(d.unix / 60);
    return [_r[7], _r[3] >= 0 ? now - _r[3] : -1, _r[5] >= 0 ? now - _r[5] : -1];
  },

  // the resting heart rate, else the lowest value of the 2-h history
  rhr(d) {
    if (d.rhr > 0) return d.rhr;
    let m = -1;
    for (let i = 0; i < d.hrHist.length; i++) if (d.hrHist[i] >= 35 && (m < 0 || d.hrHist[i] < m)) m = d.hrHist[i];
    return m;
  },

  judge(d) {
    const H = d.hrHist, n = H.length, S = d.stressHist, ns = S.length, B = d.bbHist, nb = B.length;
    const hr = d.hr > 0 ? d.hr : -1;
    const rhr = NW.rhr(d);
    const hx = d.hrMax > 100 ? d.hrMax : 190;
    const mv = NW.move(d);
    const st = d.stress >= 0 ? d.stress : -1;
    const bb = d.bb >= 0 ? d.bb : -1;
    const stD = st >= 0 && ns >= 2 && S[ns - 2] >= 0 ? st - S[ns - 2] : 0;
    const bbD = bb >= 0 && nb >= 3 && B[nb - 3] >= 0 ? bb - B[nb - 3] : 0;
    const hrD = hr > 0 && n >= 6 && H[n - 6] > 0 ? hr - H[n - 6] : 0;
    let pk = -1;
    for (let i = n - 15; i < n - 1; i++) if (i >= 0 && H[i] > pk) pk = H[i];
    let sm = -1;
    for (let i = ns - 4; i < ns - 1; i++) if (i >= 0 && S[i] > sm) sm = S[i];
    const up = hr > 0 && rhr > 0 ? hr - rhr : -999;
    const still = mv[0] < 0 || mv[0] < 200;
    const idle = mv[1] >= 0 ? Math.min(mv[1], d.mins - 420) : -1;
    let s = NS.CALM;
    if (hr > 0 && hr >= 0.75 * hx && (n < 2 || H[n - 2] < 0 || H[n - 2] >= 0.7 * hx)) s = NS.EFFORT;
    else if (mv[0] >= 400 && (up === -999 || up >= 10)) s = NS.MOVING;
    else if ((hr > 0 && pk >= Math.max(0.7 * hx, rhr + 35) && hr <= pk - 15 && (hrD <= -4 || up >= 10))
      || (mv[2] >= 0 && mv[2] <= 60)) s = NS.AFTERBURN;
    else if ((d.mins >= 1290 || d.mins < 180) && (up >= 12 || st >= 40)) s = NS.WIND_DOWN;
    else if (still && (up >= 20 || st >= 60 || (st >= 40 && stD >= 10))) s = NS.STRESS_SITTING;
    else if (bb >= 0 && (bb < 20 || (bb < 35 && bbD <= -8))) s = NS.RESERVE;
    else if (st >= 0 && sm >= 50 && st <= sm - 15) s = NS.EASING;
    else if (idle >= 60 && d.mins < 1290) s = NS.SITTING_LONG;
    else if (bb >= 0 && bbD >= 3 && st < 30) s = NS.CHARGING;
    return [s, hr, rhr, mv[0], mv[1], st, stD, bb, bbD, hrD, pk, sm, mv[2], hx];
  },

  // nothing measured yet (no pulse, stress or Body Battery)
  blind(R) { return R[1] < 0 && R[5] < 0 && R[7] < 0; },

  // the headline of the state
  head(R) { return NW.blind(R) ? "Noch keine Werte" : HEAD[R[0]]; },

  // trend arrows -1 / 0 / 1 of hr, stress, Body Battery
  trend(R, k) {
    const x = k === 0 ? R[9] : k === 1 ? R[6] : R[8];
    const t = k === 0 ? 5 : k === 1 ? 8 : 3;
    return x >= t ? 1 : x <= -t ? -1 : 0;
  },

  // a breathing exercise fits this state
  breathe(s) { return s === NS.STRESS_SITTING || s === NS.WIND_DOWN || s === NS.SITTING_LONG || s === NS.RESERVE; },

  // the reason with the real numbers
  reason(d, R) {
    const hr = R[1], up = R[1] > 0 && R[2] > 0 ? R[1] - R[2] : -1;
    switch (R[0]) {
      case NS.STRESS_SITTING:
        if (up >= 20) return "Puls " + hr + ", " + up + " über Ruhe - im Sitzen.";
        return "Stress " + v(R[5]) + (R[6] >= 8 ? " und steigt" : "") + ", kaum Bewegung.";
      case NS.MOVING: return G.num(R[3]) + " Schritte in 10 min, Puls " + v(hr) + ".";
      case NS.EFFORT: return "Puls " + hr + " = " + Math.round((100 * hr) / R[13]) + "% vom Maximum.";
      case NS.AFTERBURN:
        if (R[10] > hr && hr > 0) return "Puls von " + R[10] + " auf " + hr + " gefallen.";
        return "Erholungszeit eben hochgesprungen.";
      case NS.CHARGING: return "Body Battery " + R[7] + "%, plus " + R[8] + " pro Std.";
      case NS.RESERVE: return "Body Battery nur " + R[7] + "%" + (R[8] <= -3 ? ", -" + -R[8] + " pro Std." : ".");
      case NS.EASING: return "Stress von " + R[11] + " auf " + R[5] + " gesunken.";
      case NS.SITTING_LONG: return "Kaum Schritte seit " + (R[4] < 120 ? R[4] + " min." : G.hm(R[4]) + " h.");
      case NS.WIND_DOWN:
        if (up >= 12) return "Schon " + G.timeStr(d) + ", Puls noch " + up + " über Ruhe.";
        return "Schon " + G.timeStr(d) + " und Stress noch " + R[5] + ".";
    }
    if (NW.blind(R)) return "Puls, Stress und Akku fehlen noch.";
    return "Puls " + v(hr) + ", Stress " + v(R[5]) + ", Akku " + (R[7] >= 0 ? R[7] + "%." : "--.");
  },

  // a tip in a few words; k picks one of four variants (use d.wakeN: new tip on every raise)
  tip(d, R, k) {
    const i = k % 4;
    switch (R[0]) {
      case NS.STRESS_SITTING:
        if (i === 0) return "Puh, ganz schön angespannt. Kurz durchatmen?";
        if (i === 1) return "4 s ein, 6 s aus. Dreimal. Wirkt.";
        if (i === 2) return R[1] > 0 && R[2] > 0 && R[1] - R[2] >= 20 ? "Oder sitzt du auf dem Rad? Dann: weiter!" : "Kurz aufstehen, Fenster auf, tief atmen.";
        return "Schultern runter, Kiefer locker. Besser?";
      case NS.MOVING:
        if (i === 0) return "Läuft! Genau so weitermachen.";
        if (i === 1) return "Schöner Rhythmus - die Beine danken's.";
        if (i === 2) return "Bewegung ist Medizin. Dosis passt!";
        return "Heute schon " + G.num(Math.max(0, d.steps)) + " Schritte. Weiter!";
      case NS.EFFORT:
        if (i === 0) return "Sieht nach Training aus. Stark!";
        if (i === 1) return "Zone " + (R[1] >= 0.9 * R[13] ? 5 : R[1] >= 0.8 * R[13] ? 4 : 3) + " - Kurbel rund, Kopf frei!";
        if (i === 2) return "Volle Kanne! Atmen nicht vergessen.";
        return "Gib Gas - danach ist Pause Pflicht.";
      case NS.AFTERBURN:
        if (i === 0) return "Starke Einheit! Jetzt Wasser und Futter.";
        if (i === 1) return "Schön auslaufen lassen - verdient!";
        if (i === 2) return "Dein Körper repariert schon. Lass ihn.";
        return "Protein, Wasser, Füße hoch.";
      case NS.CHARGING:
        if (i === 0) return "Läuft! Dein Akku tankt +" + R[8] + " pro Std.";
        if (i === 1) return "Weiter so: ruhig bleiben, laden lassen.";
        if (i === 2) return "Pause ist auch Training.";
        return "Akku lädt - du machst alles richtig.";
      case NS.RESERVE:
        if (i === 0) return "Heute lieber Sofa als Sprint.";
        if (i === 1) return "Früh ins Bett wäre ein Geschenk.";
        if (i === 2) return "Snack, Wasser, kurz Augen zu.";
        return "Kein Rekordtag - und das ist okay.";
      case NS.EASING:
        if (i === 0) return "Sehr gut - das Runterkommen klappt.";
        if (i === 1) return "Merkst du's? Die Schultern sinken.";
        if (i === 2) return "Weiter so, schön locker bleiben.";
        return "Durchatmen wirkt. Siehst du ja.";
      case NS.SITTING_LONG:
        if (i === 0) return "Sitzfleisch-Alarm! Kleine Runde?";
        if (i === 1) return "Einmal zur Kaffeemaschine und zurück?";
        if (i === 2) return "Aufstehen, strecken, 100 Schritte. Los!";
        return "Deine Beine fragen, ob du noch da bist.";
      case NS.WIND_DOWN:
        if (i === 0) return "Bildschirm aus, Licht runter, Atem lang.";
        if (i === 1) return "Wer jetzt runterfährt, fährt morgen besser.";
        if (i === 2) return "Tee statt Serie? Nur so ein Gedanke.";
        return "4 ein, 6 aus - dein Einschlaf-Trick.";
    }
    if (NW.blind(R)) return "Trag mich ein paar Minuten, dann weiß ich mehr.";
    if (i === 0) return "Alles im grünen Bereich. Schön!";
    if (i === 1) return "Ruhig und klar - gute Zeit für Fokus.";
    if (i === 2) return "So darf's bleiben.";
    return "Bereit für alles, was heute kommt.";
  },

  // greedy word wrap to lines of at most w characters
  wrap(s, w) {
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
  },
};
