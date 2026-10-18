import Toybox.Lang;
import Toybox.Math;

// Now — "what is going on in your body right now", shared by the live designs (LIVE). Copied into a
// watch face only when faces.json lists "libs": ["now"]. Mirrors web/js/engine/now.js.
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
// handled. (The studio has no step stream: there the simulation sliders stand in for the ring.)
module Now {
    const STRESS_SITTING = 0;
    const MOVING = 1;
    const EFFORT = 2;
    const AFTERBURN = 3;
    const CHARGING = 4;
    const RESERVE = 5;
    const EASING = 6;
    const SITTING_LONG = 7;
    const WIND_DOWN = 8;
    const CALM = 9;
    // R indices: 0 state, 1 hr, 2 rhr, 3 steps 10 min, 4 idle min, 5 stress, 6 stress change / 30 min,
    // 7 Body Battery, 8 Body Battery change / h, 9 hr change / 10 min, 10 hr peak 30 min,
    // 11 stress peak 1.5 h, 12 min since the recovery time jumped, 13 hrMax
    const HEAD = ["Anspannung im Sitzen", "In Bewegung", "Volle Belastung", "Nachbrenner", "Lädt gerade auf",
        "Läuft auf Reserve", "Spannung lässt nach", "Lange gesessen", "Zeit runterzufahren", "Ruhig und erholt"];
    // short word for the always-on screen
    const SHORT = ["Anspannung", "Bewegung", "Belastung", "Nachbrenner", "Lädt", "Reserve", "Entspannt sich",
        "Sitzt lange", "Abschalten", "Ruhig"];
    const COL = [0xFF8A3A, 0x7EE04A, 0xFF3A6A, 0xFFB43A, 0x3AC8FF, 0xFF4A3A, 0xB08AFF, 0xFFD83A, 0x7A8AFF, 0x4AE0B0];
    const N = 11; // ring slots (minutes): the last 10 min plus now

    // [last minute, last steps, total, last move, last recovery, recovery jump, saved, s10, stamps x N, totals x N]
    var _r as Array<Number>? = null;

    function v(n as Number) as String {
        return n >= 0 ? "" + n : "--";
    }

    // feed the movement ring (call it from draw and aod; cheap when the minute was sampled already)
    function tick(d as D) as Void {
        var now = d.unix / 60;
        if (_r == null) {
            var s = St.get("nwR", null);
            if (s != null && s instanceof Array && (s as Array).size() == 8 + 2 * N) {
                _r = s as Array<Number>;
            } else {
                var r = [-1, 0, 0, -1, -1, -1, -1, -1] as Array<Number>;
                for (var i = 0; i < 2 * N; i++) {
                    r.add(-1);
                }
                _r = r;
            }
        }
        var r = _r as Array<Number>;
        if (now == r[0] || d.steps < 0) {
            return;
        }
        var inc = 0;
        var gap = 1;
        if (r[0] >= 0 && now > r[0]) {
            gap = now - r[0];
            inc = d.steps >= r[1] ? d.steps - r[1] : d.steps; // steps reset at midnight
        }
        if (r[3] < 0) {
            r[3] = now;
        }
        if (inc >= 50 && inc >= 20 * gap) {
            r[3] = now;
        }
        r[2] += inc;
        // recovery time jumped up (an activity was saved)
        if (d.recov >= 0) {
            if (r[4] >= 0 && d.recov >= r[4] + 60) {
                r[5] = now;
            }
            r[4] = d.recov;
        }
        var k = now % N;
        r[8 + k] = now;
        r[8 + N + k] = r[2];
        // steps of the last 10 min: since the oldest sample in the window (after a longer gap: the steps
        // of the gap, prorated)
        var o = -1;
        for (var i = 0; i < N; i++) {
            var t = r[8 + i];
            if (t >= now - 10 && t < now && (o < 0 || t < r[8 + o])) {
                o = i;
            }
        }
        if (o >= 0) {
            r[7] = r[2] - r[8 + N + o];
        } else {
            r[7] = r[0] >= 0 ? Math.round(inc * 10 / gap.toFloat()).toNumber() : -1;
        }
        r[0] = now;
        r[1] = d.steps;
        if (r[6] < 0 || now - r[6] >= 10 || now < r[6]) {
            r[6] = now;
            St.set("nwR", r);
        }
    }

    // [steps in the last 10 min, minutes since the last movement, minutes since the recovery jump]
    function move(d as D) as Array<Number> {
        if (_r == null || (_r as Array<Number>)[0] < 0) {
            return [-1, -1, -1] as Array<Number>;
        }
        var r = _r as Array<Number>;
        var now = d.unix / 60;
        return [r[7], r[3] >= 0 ? now - r[3] : -1, r[5] >= 0 ? now - r[5] : -1] as Array<Number>;
    }

    // the resting heart rate, else the lowest value of the 2-h history
    function rhr(d as D) as Number {
        if (d.rhr > 0) {
            return d.rhr;
        }
        var m = -1;
        for (var i = 0; i < d.hrHist.size(); i++) {
            if (d.hrHist[i] >= 35 && (m < 0 || d.hrHist[i] < m)) {
                m = d.hrHist[i];
            }
        }
        return m;
    }

    function judge(d as D) as Array<Number> {
        var H = d.hrHist;
        var n = H.size();
        var S = d.stressHist;
        var ns = S.size();
        var B = d.bbHist;
        var nb = B.size();
        var hr = d.hr > 0 ? d.hr : -1;
        var rh = rhr(d);
        var hx = d.hrMax > 100 ? d.hrMax : 190;
        var mv = move(d);
        var st = d.stress >= 0 ? d.stress : -1;
        var bb = d.bb >= 0 ? d.bb : -1;
        var stD = st >= 0 && ns >= 2 && S[ns - 2] >= 0 ? st - S[ns - 2] : 0;
        var bbD = bb >= 0 && nb >= 3 && B[nb - 3] >= 0 ? bb - B[nb - 3] : 0;
        var hrD = hr > 0 && n >= 6 && H[n - 6] > 0 ? hr - H[n - 6] : 0;
        var pk = -1;
        for (var i = n - 15; i < n - 1; i++) {
            if (i >= 0 && H[i] > pk) {
                pk = H[i];
            }
        }
        var sm = -1;
        for (var i = ns - 4; i < ns - 1; i++) {
            if (i >= 0 && S[i] > sm) {
                sm = S[i];
            }
        }
        var up = hr > 0 && rh > 0 ? hr - rh : -999;
        var still = mv[0] < 0 || mv[0] < 200;
        var idle = mv[1] >= 0 ? (mv[1] < d.mins - 420 ? mv[1] : d.mins - 420) : -1;
        var pkMin = 0.7 * hx > rh + 35 ? 0.7 * hx : rh + 35;
        var s = CALM;
        if (hr > 0 && hr >= 0.75 * hx && (n < 2 || H[n - 2] < 0 || H[n - 2] >= 0.7 * hx)) {
            s = EFFORT;
        } else if (mv[0] >= 400 && (up == -999 || up >= 10)) {
            s = MOVING;
        } else if ((hr > 0 && pk >= pkMin && hr <= pk - 15 && (hrD <= -4 || up >= 10))
            || (mv[2] >= 0 && mv[2] <= 60)) {
            s = AFTERBURN;
        } else if ((d.mins >= 1290 || d.mins < 180) && (up >= 12 || st >= 40)) {
            s = WIND_DOWN;
        } else if (still && (up >= 20 || st >= 60 || (st >= 40 && stD >= 10))) {
            s = STRESS_SITTING;
        } else if (bb >= 0 && (bb < 20 || (bb < 35 && bbD <= -8))) {
            s = RESERVE;
        } else if (st >= 0 && sm >= 50 && st <= sm - 15) {
            s = EASING;
        } else if (idle >= 60 && d.mins < 1290) {
            s = SITTING_LONG;
        } else if (bb >= 0 && bbD >= 3 && st < 30) {
            s = CHARGING;
        }
        return [s, hr, rh, mv[0], mv[1], st, stD, bb, bbD, hrD, pk, sm, mv[2], hx] as Array<Number>;
    }

    // nothing measured yet (no pulse, stress or Body Battery)
    function blind(R as Array<Number>) as Boolean {
        return R[1] < 0 && R[5] < 0 && R[7] < 0;
    }

    // the headline of the state
    function head(R as Array<Number>) as String {
        return blind(R) ? "Noch keine Werte" : HEAD[R[0]];
    }

    // trend arrows -1 / 0 / 1 of hr, stress, Body Battery
    function trend(R as Array<Number>, k as Number) as Number {
        var x = k == 0 ? R[9] : (k == 1 ? R[6] : R[8]);
        var t = k == 0 ? 5 : (k == 1 ? 8 : 3);
        return x >= t ? 1 : (x <= -t ? -1 : 0);
    }

    // a breathing exercise fits this state
    function breathe(s as Number) as Boolean {
        return s == STRESS_SITTING || s == WIND_DOWN || s == SITTING_LONG || s == RESERVE;
    }

    // the reason with the real numbers
    function reason(d as D, R as Array<Number>) as String {
        var hr = R[1];
        var up = R[1] > 0 && R[2] > 0 ? R[1] - R[2] : -1;
        switch (R[0]) {
            case STRESS_SITTING:
                if (up >= 20) {
                    return "Puls " + hr + ", " + up + " über Ruhe - im Sitzen.";
                }
                return "Stress " + v(R[5]) + (R[6] >= 8 ? " und steigt" : "") + ", kaum Bewegung.";
            case MOVING:
                return G.num(R[3]) + " Schritte in 10 min, Puls " + v(hr) + ".";
            case EFFORT:
                return "Puls " + hr + " = " + Math.round(100.0 * hr / R[13]).toNumber() + "% vom Maximum.";
            case AFTERBURN:
                if (R[10] > hr && hr > 0) {
                    return "Puls von " + R[10] + " auf " + hr + " gefallen.";
                }
                return "Erholungszeit eben hochgesprungen.";
            case CHARGING:
                return "Body Battery " + R[7] + "%, plus " + R[8] + " pro Std.";
            case RESERVE:
                return "Body Battery nur " + R[7] + "%" + (R[8] <= -3 ? ", -" + -R[8] + " pro Std." : ".");
            case EASING:
                return "Stress von " + R[11] + " auf " + R[5] + " gesunken.";
            case SITTING_LONG:
                return "Kaum Schritte seit " + (R[4] < 120 ? R[4] + " min." : G.hm(R[4]) + " h.");
            case WIND_DOWN:
                if (up >= 12) {
                    return "Schon " + G.timeStr(d) + ", Puls noch " + up + " über Ruhe.";
                }
                return "Schon " + G.timeStr(d) + " und Stress noch " + R[5] + ".";
        }
        if (blind(R)) {
            return "Puls, Stress und Akku fehlen noch.";
        }
        return "Puls " + v(hr) + ", Stress " + v(R[5]) + ", Akku " + (R[7] >= 0 ? R[7] + "%." : "--.");
    }

    // a tip in a few words; k picks one of four variants (use d.wakeN: new tip on every raise)
    function tip(d as D, R as Array<Number>, k as Number) as String {
        var i = k % 4;
        switch (R[0]) {
            case STRESS_SITTING:
                if (i == 0) { return "Puh, ganz schön angespannt. Kurz durchatmen?"; }
                if (i == 1) { return "4 s ein, 6 s aus. Dreimal. Wirkt."; }
                if (i == 2) {
                    return R[1] > 0 && R[2] > 0 && R[1] - R[2] >= 20 ? "Oder sitzt du auf dem Rad? Dann: weiter!" : "Kurz aufstehen, Fenster auf, tief atmen.";
                }
                return "Schultern runter, Kiefer locker. Besser?";
            case MOVING:
                if (i == 0) { return "Läuft! Genau so weitermachen."; }
                if (i == 1) { return "Schöner Rhythmus - die Beine danken's."; }
                if (i == 2) { return "Bewegung ist Medizin. Dosis passt!"; }
                return "Heute schon " + G.num(d.steps > 0 ? d.steps : 0) + " Schritte. Weiter!";
            case EFFORT:
                if (i == 0) { return "Sieht nach Training aus. Stark!"; }
                if (i == 1) { return "Zone " + (R[1] >= 0.9 * R[13] ? 5 : (R[1] >= 0.8 * R[13] ? 4 : 3)) + " - Kurbel rund, Kopf frei!"; }
                if (i == 2) { return "Volle Kanne! Atmen nicht vergessen."; }
                return "Gib Gas - danach ist Pause Pflicht.";
            case AFTERBURN:
                if (i == 0) { return "Starke Einheit! Jetzt Wasser und Futter."; }
                if (i == 1) { return "Schön auslaufen lassen - verdient!"; }
                if (i == 2) { return "Dein Körper repariert schon. Lass ihn."; }
                return "Protein, Wasser, Füße hoch.";
            case CHARGING:
                if (i == 0) { return "Läuft! Dein Akku tankt +" + R[8] + " pro Std."; }
                if (i == 1) { return "Weiter so: ruhig bleiben, laden lassen."; }
                if (i == 2) { return "Pause ist auch Training."; }
                return "Akku lädt - du machst alles richtig.";
            case RESERVE:
                if (i == 0) { return "Heute lieber Sofa als Sprint."; }
                if (i == 1) { return "Früh ins Bett wäre ein Geschenk."; }
                if (i == 2) { return "Snack, Wasser, kurz Augen zu."; }
                return "Kein Rekordtag - und das ist okay.";
            case EASING:
                if (i == 0) { return "Sehr gut - das Runterkommen klappt."; }
                if (i == 1) { return "Merkst du's? Die Schultern sinken."; }
                if (i == 2) { return "Weiter so, schön locker bleiben."; }
                return "Durchatmen wirkt. Siehst du ja.";
            case SITTING_LONG:
                if (i == 0) { return "Sitzfleisch-Alarm! Kleine Runde?"; }
                if (i == 1) { return "Einmal zur Kaffeemaschine und zurück?"; }
                if (i == 2) { return "Aufstehen, strecken, 100 Schritte. Los!"; }
                return "Deine Beine fragen, ob du noch da bist.";
            case WIND_DOWN:
                if (i == 0) { return "Bildschirm aus, Licht runter, Atem lang."; }
                if (i == 1) { return "Wer jetzt runterfährt, fährt morgen besser."; }
                if (i == 2) { return "Tee statt Serie? Nur so ein Gedanke."; }
                return "4 ein, 6 aus - dein Einschlaf-Trick.";
        }
        if (blind(R)) {
            return "Trag mich ein paar Minuten, dann weiß ich mehr.";
        }
        if (i == 0) { return "Alles im grünen Bereich. Schön!"; }
        if (i == 1) { return "Ruhig und klar - gute Zeit für Fokus."; }
        if (i == 2) { return "So darf's bleiben."; }
        return "Bereit für alles, was heute kommt.";
    }

    // greedy word wrap to lines of at most w characters
    function wrap(s as String, w as Number) as Array<String> {
        var out = [] as Array<String>;
        var cs = s.toCharArray();
        var n = cs.size();
        var i = 0;
        while (i < n) {
            if (n - i <= w) {
                out.add(s.substring(i, n) as String);
                break;
            }
            var cut = -1;
            for (var k = i + w; k > i; k--) {
                if (cs[k] == ' ') {
                    cut = k;
                    break;
                }
            }
            if (cut < 0) {
                out.add(s.substring(i, i + w) as String);
                i += w;
            } else {
                out.add(s.substring(i, cut) as String);
                i = cut + 1;
            }
        }
        return out;
    }
}
