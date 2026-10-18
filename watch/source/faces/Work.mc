import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.WatchUi;

// WORK — "Arbeitstag": a calm, legible everyday face for work, from pre-rendered images
// (tools/render/work.py) and crisp anti-aliased type. Big time, the date written out, the working day
// from 7 to 19 o'clock as an engraved track: how far the day is, a glowing point for now and a marker
// for the next calendar event ("NÄCHSTER TERMIN 14:00 · IN 38 MIN"; the watch gives faces the time of
// the next event, not its title). Three glass tiles: weather, Body Battery, notifications; the watch
// battery below. Styles: 1 Graphit, 2 Navy, 3 Hell. Mirrors web/js/faces/work.js.
class FaceWork extends Face {
    const C = 227;
    const TR = 205;
    const DAYS = ["SONNTAG", "MONTAG", "DIENSTAG", "MITTWOCH", "DONNERSTAG", "FREITAG", "SAMSTAG"];
    const MONTHS = ["JANUAR", "FEBRUAR", "MÄRZ", "APRIL", "MAI", "JUNI", "JULI", "AUGUST", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DEZEMBER"];
    // [text, dim, icon] per style
    const INK = [[0xFFFFFF, 0x8A8E96, 0xE8EAEE], [0xFFFFFF, 0x8A9AB8, 0xE0E8F4], [0x2A2A2E, 0x7A7A80, 0x3A3A40]];

    hidden var _dot = null;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 10;
    }

    function reveal() as Boolean {
        return false;
    }

    hidden function img(id) as BitmapResource {
        return WatchUi.loadResource(id) as BitmapResource;
    }

    // day angle (0 = 12 o'clock, clockwise) of a time; the track runs from 7:00 (-120) to 19:00 (+120)
    hidden function ang(mins) as Float {
        return -120 + ((mins - 420) / 720.0) * 240;
    }

    // text from a glyph strip (k: 0 big, 1 mid, 2 small), one clipped glyph at a time, centred on x
    hidden function txt(dc as Dc, k as Number, s as String, x as Number, y as Number, tint as Number) as Void {
        var chars = k == 0 ? ImgWork.BIG : k == 1 ? ImgWork.MID : ImgWork.SMALL;
        var adv = k == 0 ? ImgWork.BIG_ADV : k == 1 ? ImgWork.MID_ADV : ImgWork.SMALL_ADV;
        var cw = k == 0 ? ImgWork.BIG_CW : k == 1 ? ImgWork.MID_CW : ImgWork.SMALL_CW;
        var h = k == 0 ? ImgWork.BIG_H : k == 1 ? ImgWork.MID_H : ImgWork.SMALL_H;
        var b = img(k == 0 ? Rez.Drawables.big : k == 1 ? Rez.Drawables.mid : Rez.Drawables.small);
        var cs = s.toCharArray();
        var ix = new [cs.size()];
        var w = 0;
        for (var i = 0; i < cs.size(); i++) {
            var j = chars.find(cs[i].toString());
            ix[i] = j == null ? 0 : j;
            w += adv[ix[i]];
        }
        var cx = x - w / 2;
        for (var i = 0; i < cs.size(); i++) {
            var j = ix[i] as Number;
            if (cs[i] != ' ') {
                dc.setClip(cx - 2, y, adv[j] + 4, h);
                dc.drawBitmap2(cx - j * cw - 2, y, b, {:tintColor => tint});
                dc.clearClip();
            }
            cx += adv[j];
        }
    }

    hidden function icon(dc as Dc, i as Number, x as Number, y as Number, tint as Number) as Void {
        dc.setClip(x, y, ImgWork.ICON_W, ImgWork.ICON_H);
        dc.drawBitmap2(x - i * ImgWork.ICON_W, y, img(Rez.Drawables.icons), {:tintColor => tint});
        dc.clearClip();
    }

    // "IN 38 MIN", "IN 2 STD 5 MIN", "JETZT", "MORGEN"
    hidden function until(ev as Number, now as Number) as String {
        var m = ev - now;
        if (m < 0) {
            return "MORGEN";
        }
        if (m == 0) {
            return "JETZT";
        }
        if (m < 60) {
            return "IN " + m + " MIN";
        }
        return "IN " + m / 60 + " STD" + (m % 60 > 0 ? " " + (m % 60) + " MIN" : "");
    }

    // static layer: everything; only the glow of the "now" point breathes
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var st = G.clamp(d.cfg.style, 1, 3);
        var ink = INK[st - 1];
        var now = d.mins;

        if (S) {
            dc.drawBitmap(0, 0, img([Rez.Drawables.base1, Rez.Drawables.base2, Rez.Drawables.base3][st - 1]));
            // ---- the day so far on the track, the next event as a marker
            if (now > 420) {
                dc.setColor(d.accent, -1);
                dc.setPenWidth(5);
                dc.drawArc(C, C, TR, Graphics.ARC_CLOCKWISE, 210, 90 - ang(now < 1140 ? now : 1140));
            }
            if (d.nextEv >= 420 && d.nextEv <= 1140 && d.nextEv >= now) {
                var e = ang(d.nextEv) * Math.PI / 180.0;
                dc.setColor(G.mix(d.accent, 0xFFFFFF, 0.45), -1);
                dc.setPenWidth(4);
                dc.drawLine(Math.round(C + (TR - 9) * Math.sin(e)).toNumber(), Math.round(C - (TR - 9) * Math.cos(e)).toNumber(),
                    Math.round(C + (TR + 9) * Math.sin(e)).toNumber(), Math.round(C - (TR + 9) * Math.cos(e)).toNumber());
            }
            // ---- date, time
            txt(dc, 2, DAYS[d.dow] + ", " + d.day + ". " + MONTHS[d.mon - 1], C, 92, ink[1]);
            txt(dc, 0, G.timeStr(d), C, 110, ink[0]);
            // ---- the next calendar event
            if (d.nextEv >= 0) {
                txt(dc, 2, "NÄCHSTER TERMIN", C, 218, ink[1]);
                txt(dc, 1, G.hm(d.nextEv), C, 236, ink[0]);
                txt(dc, 2, until(d.nextEv, now), C, 266, d.accent);
            } else {
                txt(dc, 2, "KEINE TERMINE", C, 236, ink[1]);
            }
            // ---- tiles: weather, energy, notifications
            var day = d.sunrise > 0 && d.sunset > 0 ? now >= d.sunrise && now < d.sunset : now >= 420 && now < 1140;
            var wx = Season.wx(d);
            var vals = [d.temp > -99 ? d.temp + "°" : "--", d.bb >= 0 ? d.bb.toString() : "--", d.notif.toString()];
            var ics = [wx == 0 && !day ? 6 : wx, 7, 8];
            for (var i = 0; i < 3; i++) {
                var tx = ImgWork.TILES[i * 2];
                var ty = ImgWork.TILES[i * 2 + 1];
                icon(dc, ics[i], tx - 15, ty - 30, i == 1 ? d.accent : ink[2]);
                txt(dc, 1, vals[i], tx, ty + 1, ink[0]);
            }
            // ---- the watch battery
            txt(dc, 2, "AKKU " + d.batt + " %", C, 390, d.batt <= 20 ? 0xFF5A4A : ink[1]);
        }

        if (!M) {
            return;
        }
        // ---- now: a softly breathing point of light on the track
        if (now >= 420 && now <= 1140) {
            if (_dot == null) {
                _dot = img(Rez.Drawables.dot);
            }
            var e = ang(now) * Math.PI / 180.0;
            var x = Math.round(C + TR * Math.sin(e)).toNumber();
            var y = Math.round(C - TR * Math.cos(e)).toNumber();
            var k = 0.65 + 0.35 * Math.sin(a.t / 500.0);
            var t = new Graphics.AffineTransform();
            t.scale(1.4, 1.4);
            t.translate(-12.0, -12.0);
            dc.setBlendMode(Graphics.BLEND_MODE_ADDITIVE);
            dc.drawBitmap2(x, y, _dot, {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR, :tintColor => G.mix(0, d.accent, k)});
            dc.setBlendMode(Graphics.BLEND_MODE_DEFAULT);
            dc.setColor(0xFFFFFF, -1);
            dc.fillCircle(x, y, 3);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        txt(dc, 0, G.timeStr(d), C + o[0], 110 + o[1], 0x4A4A4A);
        if (d.nextEv >= 0) {
            txt(dc, 2, "TERMIN " + G.hm(d.nextEv), C + o[0], 236 + o[1], 0x3A3A3A);
        }
    }
}
