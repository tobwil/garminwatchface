import Toybox.Application;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// The assistant: a card over any design for a few seconds after a wrist raise, when it has
// something to say. In order of priority: a breathing help when stress is high (at most every 30
// minutes; one breath, 4 s in, 6 s out), the morning report on the first look between 5 and 11
// o'clock (sleep, Body Battery, resting pulse and a verdict), a birthday surprise (once an hour on
// your birthday) and the bedtime hint around your usual bedtime. Off with cfg.assist = 0 or when
// animations are off. Mirrors web/js/engine/assist.js.
module Assist {
    const DUR = [0, 10000, 7000, 6000, 5000];
    const COL = [0, 0x3AE0C0, 0xFFC84A, 0xFF5AB4, 0x8A7AFF];
    const CONF = [0xFF5AB4, 0xFFD23A, 0x3AE0FF, 0x7AFF5A, 0xFFFFFF];

    function stress2h(d as D) as Number {
        var s = 0;
        var n = 0;
        var k = d.stressHist.size();
        for (var i = k - 4 > 0 ? k - 4 : 0; i < k; i++) {
            if (d.stressHist[i] >= 0) {
                s += d.stressHist[i];
                n++;
            }
        }
        return n > 0 ? Math.round(s / n.toFloat()).toNumber() : -1;
    }

    // minutes from the bedtime (negative: before), in -720..719
    function bedRel(d as D) as Number {
        return ((d.mins - d.cfg.bed + 1440 + 720) % 1440) - 720;
    }

    function mem(k as String, def as Number) as Number {
        try {
            var v = Application.Storage.getValue(k);
            return v instanceof Number ? v : def;
        } catch (e) {
            return def;
        }
    }

    function remember(k as String, v as Number) as Void {
        try {
            Application.Storage.setValue(k, v);
        } catch (e) {
        }
    }

    // the card for this wrist raise (0 = none); remembers what it has shown
    function pick(d as D) as Number {
        var c = d.cfg;
        if (c.assist == 0 || c.anim == 0) {
            return 0;
        }
        if ((d.stress >= 70 || stress2h(d) >= 60) && d.unix - mem("abr", 0) >= 1800) {
            remember("abr", d.unix);
            return 1;
        }
        if (d.mins >= 300 && d.mins < 660 && mem("amo", -1) != d.doy) {
            remember("amo", d.doy);
            return 2;
        }
        if (c.bday == d.mon * 100 + d.day && mem("abd", -1) != d.doy * 24 + d.h) {
            remember("abd", d.doy * 24 + d.h);
            return 3;
        }
        var r = bedRel(d);
        if (r >= -45 && r <= 90) {
            return 4;
        }
        return 0;
    }

    // draws card `mode` at time t (ms since the raise)
    function draw(dc as Dc, d as D, mode as Number, t as Number) as Void {
        var C = COL[mode];
        var dur = DUR[mode];
        var inn = G.ease(G.clamp(t / 300.0, 0, 1));
        var out = G.ease(G.clamp((t - dur + 400) / 400.0, 0, 1));
        var oy = Math.round((1 - inn) * 40 + out * 260).toNumber();
        var x = 77;
        var y = 127 + oy;
        var w = 300;
        var h = 200;
        if (mode == 3) {
            // confetti over the whole screen
            for (var i = 0; i < 30; i++) {
                var s = G.rnd(i * 71 + 9);
                dc.setColor(CONF[s % 5], -1);
                dc.fillRectangle(20 + ((s >> 3) % 414), ((s % 400) + (t * (0.08 + (s % 5) * 0.02)).toNumber()) % 454, 6, 4);
            }
        }
        dc.setColor(0x0C1018, -1);
        dc.fillRoundedRectangle(x, y, w, h, 24);
        dc.setColor(C, -1);
        dc.setPenWidth(3);
        dc.drawRoundedRectangle(x, y, w, h, 24);
        // time left
        dc.setColor(G.mix(C, 0, 0.6), -1);
        dc.fillRectangle(x + 40, y + h - 16, w - 80, 4);
        dc.setColor(C, -1);
        dc.fillRectangle(x + 40, y + h - 16, Math.round((w - 80) * (1 - G.clamp(t / dur.toFloat(), 0, 1))).toNumber(), 4);
        if (mode == 1) {
            var s = d.stress >= 0 ? d.stress : stress2h(d);
            dc.setColor(0xFFFFFF, -1);
            F.px(dc, "STRESS " + s + " - ATME MIT", 227, y + 16, 2, 1, 0);
            var inhale = t < 4000;
            var r = inhale ? 18 + 40 * G.easeInOut(t / 4000.0) : 58 - 40 * G.easeInOut(G.clamp((t - 4000) / 6000.0, 0, 1));
            dc.setColor(G.mix(C, 0, 0.55), -1);
            dc.fillCircle(227, y + 104, Math.round(r).toNumber() + 6);
            dc.setColor(C, -1);
            dc.fillCircle(227, y + 104, Math.round(r).toNumber());
            dc.setColor(0x0C1018, -1);
            F.px(dc, inhale ? "EIN" : "AUS", 227, y + 97, 2, 1, 0);
        } else if (mode == 2) {
            dc.setColor(C, -1);
            F.px(dc, "GUTEN MORGEN", 227, y + 18, 3, 1, 0);
            dc.setColor(0xFFFFFF, -1);
            F.px(dc, "SCHLAF " + (d.sleep >= 0 ? "" + d.sleep : "--") + "  AKKU " + (d.bb >= 0 ? d.bb + "%" : "--"), 227, y + 62, 2, 1, 0);
            F.px(dc, "RUHEPULS " + (d.rhr > 0 ? "" + d.rhr : "--"), 227, y + 86, 2, 1, 0);
            var v = d.sleep >= 75 && d.bb >= 60 ? "AUSGERUHT IN DEN TAG" : d.sleep >= 0 && d.sleep < 50 ? "KURZE NACHT, SACHTE!" : "SOLIDE NACHT";
            dc.setColor(C, -1);
            F.px(dc, v, 227, y + 130, 2, 1, 0);
        } else if (mode == 3) {
            dc.setColor(C, -1);
            F.px(dc, "ALLES GUTE", 227, y + 22, 3, 1, 0);
            dc.setColor(0xFFFFFF, -1);
            F.px(dc, "ZUM GEBURTSTAG!", 227, y + 56, 2, 1, 0);
            // a cake with flickering candles
            dc.setColor(0xF4E0C0, -1);
            dc.fillRectangle(187, y + 120, 80, 40);
            dc.setColor(C, -1);
            dc.fillRectangle(187, y + 132, 80, 6);
            for (var i = 0; i < 3; i++) {
                dc.setColor(0xFFFFFF, -1);
                dc.fillRectangle(203 + i * 22, y + 100, 4, 20);
                dc.setColor((t / 120 + i) % 2 == 0 ? 0xFFD23A : 0xFF8A2A, -1);
                dc.fillRectangle(202 + i * 22, y + 92, 6, 8);
            }
        } else if (mode == 4) {
            var r = bedRel(d);
            dc.setColor(C, -1);
            F.px(dc, "SCHLAFENSZEIT " + G.hm(d.cfg.bed), 227, y + 22, 2, 1, 0);
            dc.setColor(0xFFFFFF, -1);
            F.px(dc, r < 0 ? "NOCH " + (-r) + " MIN" : r <= 30 ? "ZEIT FÜRS BETT" : "SCHON " + r + " MIN DRÜBER", 227, y + 64, 3, 1, 0);
            dc.setColor(0xA8A8C8, -1);
            F.px(dc, "AUFSTEHEN " + G.hm((d.cfg.bed + 480) % 1440) + " (8 STD)", 227, y + 112, 2, 1, 0);
            dc.setColor(C, -1);
            dc.fillCircle(227, y + 150, 12);
            dc.setColor(0x0C1018, -1);
            dc.fillCircle(233, y + 146, 11);
        }
    }
}
