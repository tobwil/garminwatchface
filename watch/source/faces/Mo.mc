import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.WatchUi;

// MO — "Mo": a fluffy peach mochi seal pup lives on your time. The fur is pre-rendered
// (tools/render/mo.py); eyes, blinks, glances, the mouth and every effect are drawn live.
// Scenes (one per wrist raise, from the body state and d.wakeN, so every look is new):
//   SIT    sits on the hour or the minute digits, flippers dangling, waves hello
//   PEEK   peeks from behind the minute digits, ducks away and comes back
//   SLEEP  at night (22-6) or with an empty Body Battery: asleep across the time; on a raise he
//          yawns and slides up onto the digits so the time is free within 1.3 s; z's, thought bubble
//   HANG   hangs from the colon and swings
//   PUSH   stomps the newest minute digit into place
//   SPORT  headband and cheering after EFFORT / MOVING / AFTERBURN
// Moods come from the "now" lib: STRESS_SITTING nervous (frizz, sweat drop, fast blinks) and he
// breathes with you (4 s in, 6 s out); RESERVE tired (droopy eyes, yawns); CHARGING cosy (^^, little
// hearts); SITTING_LONG hops and points; WIND_DOWN sleepy with a nightcap; else happy.
// A speech bubble says a short line from Now after the intro. While awake: blinks at natural random
// intervals, glances, breathing bob, flipper wiggles; a new minute rises into place.
// Styles: 1 Nacht (black), 2 Dämmerung (dusk), 3 Kiesel (paper, Pebble bitmap type, pixel bubble).
// Only the images of the current scene are loaded (members), the rest is released.
// Mirrors web/js/faces/mo.js.
class FaceMo extends Face {
    const SIT = 0;
    const PEEK = 1;
    const SLEEP = 2;
    const HANG = 3;
    const PUSH = 4;
    const SPORT = 5;
    const POOL = [1, 3, 0, 4]; // PEEK, HANG, SIT, PUSH by d.wakeN % 4
    const HAPPY = 0;
    const NERVOUS = 1;
    const TIRED = 2;
    const COSY = 3;
    const HOP = 4;
    const SLEEPY = 5;
    const CHEER = 6;
    const OPEN = 0; // eye kinds: open, ^^, closed
    const JOY = 1;
    const SHUT = 2;
    const MW = 0; // mouths: "w", open, small o, wobbly, flat
    const MOPEN = 1;
    const MO_ = 2;
    const MWOB = 3;
    const MFLAT = 4;
    const K = 12; // Kiesel: dot size of the time
    const DOW = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const LOOK = [0, -1, 0.8, 0, -0.6, 1]; // glance targets
    const SPX = [-80, 66, -86];
    const SPY = [-60, -56, -26];
    const SPR = [6, 4.5, 3.5];
    // per style: [background, digits, date, status, bubble, bubble text, z's]
    const PAL = [
        [0x000000, 0xF6F3EE, 0x9E9893, 0x7C7671, 0xFFF3E8, 0x3A2626, 0xB4BCFF],
        [0x1A1030, 0xFFF1E6, 0xE2C6C0, 0xBE9C9E, 0xFFEEE4, 0x40262E, 0xD8D2FF],
        [0xF1EEE6, 0x161616, 0x161616, 0x5E5A54, 0xFFFFFF, 0x161616, 0x4A52A0]
    ];

    // ---- plan of this raise (scene, mood, side), cached per minute and raise
    hidden var cK = -1;
    hidden var cR = [9, -1, -1, -1, -1, -1, 0, -1, 0, 0, -1, -1, -1, 190] as Array<Number>;
    hidden var cS = 0;
    hidden var cM = 0;
    hidden var cSide = 0;
    // ---- time layout: text, x and advance per char, top, height, colon index
    hidden var TS = "";
    hidden var TC = [] as Array<Char>;
    hidden var GX = [] as Array<Number>;
    hidden var GA = [] as Array<Number>;
    hidden var TY = 216;
    hidden var TH = 103;
    hidden var CI = 2;
    hidden var _lk = "";
    // ---- body frame: centre, rotation, scale, squash
    hidden var FX = 0.0;
    hidden var FY = 0.0;
    hidden var FR = 0.0;
    hidden var FS = 1.0;
    hidden var FQX = 1.0;
    hidden var FQY = 1.0;
    // ---- expression: eye kind, openness, lid, look x/y, mouth kind and amount
    hidden var EK = 0;
    hidden var EO = 1.0;
    hidden var LID = 0.0;
    hidden var LX = 0.0;
    hidden var LY = 0.0;
    hidden var MK = 0;
    hidden var MA = 0.0;
    // ---- speech bubble lines (cached per text), the point of Mo the tail points to
    hidden var bS = "";
    hidden var bL = [] as Array<String>;
    hidden var AX = 227.0;
    hidden var AY = 150.0;
    hidden var MQ = -1.0; // progress of a new minute rising into place (-1 none)
    hidden var TP = 999999; // ms since a tap (Mo giggles)
    hidden var cbg = 0; // background colour for fades
    hidden var cST = 1; // style
    // ---- images (only those of the current scene stay loaded)
    hidden var _iS = -1;
    hidden var _body = null;
    hidden var _lie = null;
    hidden var _flip = null;
    hidden var _arm = null;
    hidden var _band = null;
    hidden var _cap = null;
    hidden var _blob = null;
    hidden var _big = null;
    hidden var _hull = null;
    hidden var _txt = null;
    hidden var _dusk = null;
    hidden var _thin = null;
    hidden var _aod = null;

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 15;
    }

    function reveal() as Boolean {
        return false;
    }

    // Mo is the assistant here: his bubble, breathing exercise and bedtime nap replace the cards
    function speaks() as Boolean {
        return true;
    }

    hidden function img(id) as BitmapResource {
        return WatchUi.loadResource(id) as BitmapResource;
    }

    // images by name, loaded on first use
    hidden function bm(k as Number) as BitmapResource {
        if (k == 0) { if (_body == null) { _body = img(Rez.Drawables.body); } return _body; }
        if (k == 1) { if (_lie == null) { _lie = img(Rez.Drawables.lie); } return _lie; }
        if (k == 2) { if (_flip == null) { _flip = img(Rez.Drawables.flip); } return _flip; }
        if (k == 3) { if (_arm == null) { _arm = img(Rez.Drawables.arm); } return _arm; }
        if (k == 4) { if (_band == null) { _band = img(Rez.Drawables.band); } return _band; }
        if (k == 5) { if (_cap == null) { _cap = img(Rez.Drawables.cap); } return _cap; }
        if (k == 6) { if (_blob == null) { _blob = img(Rez.Drawables.blob); } return _blob; }
        if (k == 7) { if (_big == null) { _big = img(Rez.Drawables.big); } return _big; }
        if (k == 8) { if (_hull == null) { _hull = img(Rez.Drawables.hull); } return _hull; }
        if (k == 9) { if (_txt == null) { _txt = img(Rez.Drawables.txt); } return _txt; }
        if (k == 10) { if (_dusk == null) { _dusk = img(Rez.Drawables.dusk); } return _dusk; }
        if (k == 11) { if (_thin == null) { _thin = img(Rez.Drawables.thin); } return _thin; }
        if (_aod == null) { _aod = img(Rez.Drawables.aod); }
        return _aod;
    }

    // a new scene (or the always-on screen, s = -2): release the images it does not need
    hidden function release(s as Number) as Void {
        if (s == _iS) {
            return;
        }
        _iS = s;
        if (s != SIT && s != SPORT && s != PEEK && s != HANG && s != PUSH) { _body = null; _flip = null; _arm = null; }
        if (s != SLEEP) { _lie = null; }
        if (s != SPORT) { _band = null; }
        if (s != PEEK) { _hull = null; }
        _cap = null;
        if (s == -2) { _big = null; _blob = null; _dusk = null; }
        else { _thin = null; _aod = null; }
    }

    hidden function plan(d as D) as Void {
        var k = (d.doy * 1440 + d.mins) * 8 + (d.wakeN % 8);
        if (k == cK) {
            return;
        }
        cK = k;
        Now.tick(d);
        var R = Now.judge(d);
        cR = R;
        var st = R[0];
        cSide = (d.wakeN / 4) % 2;
        cM = HAPPY;
        if (st == Now.STRESS_SITTING) { cM = NERVOUS; }
        else if (st == Now.RESERVE) { cM = TIRED; }
        else if (st == Now.CHARGING) { cM = COSY; }
        else if (st == Now.SITTING_LONG) { cM = HOP; }
        else if (st == Now.WIND_DOWN) { cM = SLEEPY; }
        if (d.cfg.anim == 0) { cS = SIT; cSide = 0; cM = HAPPY; }
        else if (d.h >= 22 || d.h < 6 || (R[7] >= 0 && R[7] <= 10)) { cS = SLEEP; }
        else if (st == Now.EFFORT || st == Now.MOVING || st == Now.AFTERBURN) { cS = SPORT; cM = CHEER; }
        else if (cM == NERVOUS || cM == HOP) { cS = SIT; }
        else if (cM == TIRED || cM == SLEEPY) { cS = d.wakeN % 2 == 0 ? SIT : PEEK; } // no gymnastics when tired
        else { cS = POOL[d.wakeN % 4]; }
    }

    // ------------------------------------------------------------ type
    hidden function tIdx(c as Char) as Number {
        var j = ImgMo.TXT.find(c.toString());
        return j == null ? 0 : j;
    }

    // text from the txt strip (left edge x, cell top y), extra spacing sp; returns the width
    hidden function txtW(s as String, sp) {
        var cs = s.toCharArray();
        var w = 0;
        for (var i = 0; i < cs.size(); i++) {
            w += ImgMo.TXT_ADV[tIdx(cs[i])] + sp;
        }
        return w - sp;
    }

    hidden function txt(dc as Dc, s as String, x, y, tint as Number, sp, n as Number) as Void {
        var b = bm(9);
        var cs = s.toCharArray();
        var cx = x;
        for (var i = 0; i < cs.size() && i < n; i++) {
            var j = tIdx(cs[i]);
            if (j > 0) {
                dc.setClip(cx - 2, y, ImgMo.TXT_ADV[j] + 4, ImgMo.TXT_H);
                dc.drawBitmap2(cx - j * ImgMo.TXT_CW - 3, y, b, {:tintColor => tint});
                dc.clearClip();
            }
            cx += ImgMo.TXT_ADV[j] + sp;
        }
    }

    // the time: layout of the chars for the scene and style (x of each char, advances, top)
    hidden function lay(d as D, sc as Number, st as Number) as Void {
        TS = G.timeStr(d);
        var key = TS + sc + st;
        if (key.equals(_lk)) {
            return;
        }
        _lk = key;
        TC = TS.toCharArray();
        var n = TC.size();
        CI = TS.find(":");
        if (CI == null) {
            CI = 2;
        }
        GX = new [n] as Array<Number>;
        GA = new [n] as Array<Number>;
        var w = 0;
        for (var i = 0; i < n; i++) {
            var a = st == 3 ? (TC[i] == ':' ? 3 * K : 6 * K) : ImgMo.BIG_ADV[TC[i] == ':' ? 10 : TC[i].toNumber() - 48] - 3;
            GA[i] = a;
            w += a;
        }
        w -= st == 3 ? K : -3;
        TY = sc == HANG ? 140 : 216;
        TH = st == 3 ? 7 * K : ImgMo.BIG_H - ImgMo.BIG_TOP - 6;
        var x = Math.round((sc == PUSH ? 203 : 227) - w / 2.0).toNumber();
        for (var i = 0; i < n; i++) {
            GX[i] = x;
            x += GA[i];
        }
        if (st != 3) {
            for (var i = 0; i < n; i++) {
                GA[i] += 3; // inked width
            }
        }
    }

    // char i of the time at x, y (top); nothing below yb (a digit rising out of its slot)
    hidden function digit(dc as Dc, i as Number, x, y, st as Number, col as Number, yb) as Void {
        var ch = TC[i];
        if (st == 3) {
            dc.setColor(col, -1);
            dc.setClip(x - 1, y - 1, 6 * K, yb - y + 1);
            if (ch == ':') {
                dc.fillRectangle(x + K, y + 2 * K, K, K);
                dc.fillRectangle(x + K, y + 5 * K, K, K);
            } else {
                F.px(dc, ch.toString(), x, y, K, 0, 0);
            }
            dc.clearClip();
            return;
        }
        var j = ch == ':' ? 10 : ch.toNumber() - 48;
        var h = yb - y + ImgMo.BIG_TOP;
        dc.setClip(x - 3, y - ImgMo.BIG_TOP, ImgMo.BIG_ADV[j] + 6, h < ImgMo.BIG_H ? h : ImgMo.BIG_H);
        dc.drawBitmap2(x - j * ImgMo.BIG_CW - 3, y - ImgMo.BIG_TOP, bm(7), {:tintColor => col});
        dc.clearClip();
    }

    // solid silhouette of char i in the background colour (Mo behind the digits)
    hidden function hull(dc as Dc, i as Number, x, y, st as Number) as Void {
        var ch = TC[i];
        if (ch == ':') {
            return;
        }
        if (st == 3) {
            dc.setColor(PAL[2][0], -1);
            dc.fillRectangle(x - 1, y - 1, 5 * K + 2, 7 * K + 2);
            return;
        }
        var j = ch.toNumber() - 48;
        dc.setClip(x - 3, y - ImgMo.BIG_TOP, ImgMo.BIG_ADV[j] + 6, ImgMo.BIG_H);
        dc.drawBitmap2(x - j * ImgMo.BIG_CW - 3, y - ImgMo.BIG_TOP, bm(8), {:tintColor => st == 2 ? ImgMo.DUSK_MID : 0x000000});
        dc.clearClip();
    }

    // background of a rectangle (cropped overlays over Mo)
    hidden function bgRect(dc as Dc, x, y, w, h, st as Number) as Void {
        if (st == 2) {
            dc.setClip(x, y, w, h);
            dc.drawBitmap(0, 0, bm(10));
            dc.clearClip();
        } else {
            dc.setColor(PAL[st - 1][0], -1);
            dc.fillRectangle(x, y, w, h);
        }
    }

    // soft contact shadow centred on x, y, w px wide, clipped to the digits (from yc down)
    hidden function shadow(dc as Dc, x, y, w, yc) as Void {
        var t = new Graphics.AffineTransform();
        var k = (w / ImgMo.BLOB_W.toFloat()).toFloat();
        t.scale(k, k);
        t.translate(-ImgMo.BLOB_W / 2.0, -ImgMo.BLOB_H / 2.0);
        dc.setClip(0, yc, 454, 60);
        dc.drawBitmap2(x, y, bm(6), {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR});
        dc.clearClip();
    }

    // ------------------------------------------------------------ Mo's body frame
    hidden function frame(x, y, r, s, qx, qy) as Void {
        FX = x.toFloat();
        FY = y.toFloat();
        FR = r.toFloat();
        FS = s.toFloat();
        FQX = qx.toFloat();
        FQY = qy.toFloat();
    }

    hidden function bx(lx, ly) as Float {
        var u = lx * ImgMo.S * FS * FQX;
        var v = ly * ImgMo.S * FS * FQY;
        return (FX + u * Math.cos(FR) - v * Math.sin(FR)).toFloat();
    }

    hidden function by(lx, ly) as Float {
        var u = lx * ImgMo.S * FS * FQX;
        var v = ly * ImgMo.S * FS * FQY;
        return (FY + u * Math.sin(FR) + v * Math.cos(FR)).toFloat();
    }

    // a body bitmap (or overlay) whose body centre is at ox, oy
    hidden function body(dc as Dc, b as BitmapResource, ox, oy) as Void {
        if (FR == 0.0 && FS * FQX == 1.0 && FS * FQY == 1.0) {
            dc.drawBitmap(Math.round(FX - ox).toNumber(), Math.round(FY - oy).toNumber(), b);
            return;
        }
        var t = new Graphics.AffineTransform();
        t.rotate(FR);
        t.scale(FS * FQX, FS * FQY);
        t.translate(-ox.toFloat(), -oy.toFloat());
        dc.drawBitmap2(FX, FY, b, {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR});
    }

    // a bitmap turned around its pivot px, py at body point lx, ly (deg: 0 = hanging down)
    hidden function turn(dc as Dc, b as BitmapResource, px, py, lx, ly, deg, s) as Void {
        var t = new Graphics.AffineTransform();
        t.rotate((FR + deg * Math.PI / 180.0).toFloat());
        t.scale((FS * s).toFloat(), (FS * s).toFloat());
        t.translate(-px.toFloat(), -py.toFloat());
        dc.drawBitmap2(bx(lx, ly), by(lx, ly), b, {:transform => t, :filterMode => Graphics.FILTER_MODE_BILINEAR});
    }

    // a flipper turned around its pivot at body point lx, ly
    hidden function limb(dc as Dc, lx, ly, deg, s) as Void {
        turn(dc, bm(2), ImgMo.FLIP_PX, ImgMo.FLIP_PY, lx, ly, deg, s);
    }

    // a long arm (hanging, raised), turned around its shoulder at body point lx, ly
    hidden function arm(dc as Dc, lx, ly, deg) as Void {
        turn(dc, bm(3), ImgMo.ARM_PX, ImgMo.ARM_PY, lx, ly, deg, 1);
    }

    // the nightcap, cuff centre at body point lx, ly
    hidden function cap(dc as Dc, lx, ly, deg, s) as Void {
        turn(dc, bm(5), ImgMo.CAP_PX, ImgMo.CAP_PY, lx, ly, deg, s);
    }

    // ------------------------------------------------------------ face (live)
    // eyes and mouth; fx, fy = face offset in body units (lying pose: -16, -2)
    hidden function face(dc as Dc, fx, fy) as Void {
        var k = ImgMo.S * FS;
        var rx = ImgMo.EYE[2] * k;
        var ry = ImgMo.EYE[3] * k;
        dc.setPenWidth(pen(1.9 * FS));
        for (var sx = -1; sx <= 1; sx += 2) {
            var cx = bx(fx + sx * ImgMo.EYE[0], fy + ImgMo.EYE[1]) + LX * 2.6 * FS;
            var cy = by(fx + sx * ImgMo.EYE[0], fy + ImgMo.EYE[1]) + LY * 2 * FS;
            if (EK == JOY) {
                dc.setColor(0x2A1416, -1);
                dc.setPenWidth(pen(3 * FS));
                dc.drawArc(cx, cy + ry * 0.35, rx * 0.9, Graphics.ARC_COUNTER_CLOCKWISE, 25, 155);
            } else if (EK == SHUT || EO < 0.22) {
                dc.setColor(0x2A1416, -1);
                dc.setPenWidth(pen(2.6 * FS));
                dc.drawArc(cx, cy - ry * 0.25, rx * 0.95, Graphics.ARC_COUNTER_CLOCKWISE, 205, 335);
            } else {
                var h = ry * EO;
                if (LID > 0) {
                    lids(dc, cx, cy, rx, h);
                    continue;
                }
                dc.setColor(0x2E2940, -1);
                dc.fillEllipse(cx, cy, rx, h);
                dc.setColor(0x0B0812, -1);
                dc.fillEllipse(cx, cy - h * 0.1, rx * 0.93, h * 0.86);
                if (EO > 0.45) {
                    dc.setColor(0xFFFFFF, -1);
                    dc.fillEllipse(cx - rx * 0.3 + LX * 1.2, cy - h * 0.38, rx * 0.34, h * 0.3);
                    dc.fillCircle(cx + rx * 0.36, cy + h * 0.38, rx * 0.15 > 1.5 ? rx * 0.15 : 1.5);
                }
            }
        }
        // mouth
        var mx = bx(fx, fy + 10.6);
        var my = by(fx, fy + 10.6);
        dc.setColor(0x3A1A1A, -1);
        dc.setPenWidth(pen(1.8 * FS));
        if (MK == MW) {
            var r = 3.1 * k;
            dc.drawArc(mx - r, my, r, Graphics.ARC_COUNTER_CLOCKWISE, 185, 360);
            dc.drawArc(mx + r, my, r, Graphics.ARC_COUNTER_CLOCKWISE, 180, 355);
        } else if (MK == MOPEN) {
            var w = 5.2 * k * (0.55 + 0.45 * MA);
            var h = 6.4 * k * MA + 1.5;
            dc.setColor(0x5A1420, -1);
            dc.fillEllipse(mx, my + h * 0.55, w, h);
            if (MA > 0.35) {
                dc.setColor(0xFF7480, -1);
                dc.fillEllipse(mx, my + h * 1.05, w * 0.6, h * 0.42);
            }
        } else if (MK == MO_) {
            dc.setColor(0x5A1420, -1);
            dc.fillEllipse(mx, my + 2.5 * k, 2.1 * k, 2.3 * k);
        } else if (MK == MWOB) {
            var x0 = mx - 6 * k;
            var y0 = my + 2.4 * k;
            for (var i = 1; i <= 6; i++) {
                var x1 = mx - 6 * k + i * 2 * k;
                var y1 = my + 2.4 * k + (i % 2 == 0 ? 1 : -1) * 1.1 * k;
                dc.drawLine(x0, y0, x1, y1);
                x0 = x1;
                y0 = y1;
            }
        } else {
            dc.drawArc(mx, my + 5.6 * k, 3.2 * k, Graphics.ARC_COUNTER_CLOCKWISE, 45, 135); // a small pout
        }
    }

    // heavy-lidded eye: the part of the eye below a curved lid line (as a polygon), a small highlight
    // and a lash line along the lid
    hidden function lids(dc as Dc, cx, cy, rx, h) as Void {
        var pts = new [16];
        for (var i = 0; i <= 8; i++) {
            var u = -1 + i / 4.0;
            var q = 1 - u * u;
            var e = h * Math.sqrt(q > 0 ? q : 0);
            var y = cy - h * (1 - 2 * LID) + h * 0.25 * q;
            y = y < cy - e ? cy - e : y;
            pts[i] = [cx + u * rx, y > cy + e ? cy + e : y];
        }
        for (var i = 7; i >= 1; i--) {
            var u = -1 + i / 4.0;
            pts[16 - i] = [cx + u * rx, cy + h * Math.sqrt(1 - u * u)];
        }
        dc.setColor(0x0B0812, -1);
        dc.fillPolygon(pts);
        dc.setColor(0xFFFFFF, -1);
        dc.fillCircle(cx + rx * 0.36, cy + h * 0.38, rx * 0.15 > 1.5 ? rx * 0.15 : 1.5);
        dc.setColor(0x6A3A30, -1);
        dc.setPenWidth(2);
        for (var i = 1; i < 8; i++) {
            dc.drawLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
        }
    }

    hidden function pen(w) as Number {
        var n = Math.round(w).toNumber();
        return n < 2 ? 2 : n;
    }

    // ------------------------------------------------------------ effects
    hidden function drop(dc as Dc, x, y, s) as Void {
        dc.setColor(0x8FD0FF, -1);
        dc.fillCircle(x, y, 4 * s);
        dc.fillPolygon([[x - 3.7 * s, y - 1.4 * s], [x, y - 9.5 * s], [x + 3.7 * s, y - 1.4 * s]]);
        dc.setColor(0xFFFFFF, -1);
        dc.fillCircle(x - 1.4 * s, y - 0.6 * s, 1.3 * s);
    }

    hidden function spark(dc as Dc, x, y, r, col as Number) as Void {
        var q = r * 0.25;
        dc.setColor(col, -1);
        dc.fillPolygon([[x, y - r], [x + q, y - q], [x + r, y], [x + q, y + q], [x, y + r], [x - q, y + q], [x - r, y], [x - q, y - q]]);
    }

    hidden function heart(dc as Dc, x, y, r, col as Number) as Void {
        dc.setColor(col, -1);
        dc.fillCircle(x - r * 0.5, y, r * 0.55);
        dc.fillCircle(x + r * 0.5, y, r * 0.55);
        dc.fillPolygon([[x - r * 1.04, y + r * 0.15], [x + r * 1.04, y + r * 0.15], [x, y + r * 1.15]]);
    }

    // nervous fur: little zigzag tufts standing up around the head (flicker with t)
    hidden function frizz(dc as Dc, t, st as Number) as Void {
        dc.setColor(st == 3 ? 0xD88A68 : 0xFFCFB0, -1);
        dc.setPenWidth(2);
        for (var i = 0; i < 7; i++) {
            var a = (-160 + i * 23.3 + 6 * G.noise(t / 160.0 + i * 3.1)) * Math.PI / 180.0;
            var c = Math.cos(a);
            var s = Math.sin(a);
            var r0 = 47 + (i % 2) * 4;
            var x0 = bx(c * r0, -10 + s * r0 * 0.98);
            var y0 = by(c * r0, -10 + s * r0 * 0.98);
            for (var j = 1; j <= 3; j++) {
                var rr = r0 + j * 3.2;
                var o = j % 2 == 0 ? 2.2 : -2.2;
                var x1 = bx(c * rr - s * o, -10 + s * rr + c * o);
                var y1 = by(c * rr - s * o, -10 + s * rr + c * o);
                dc.drawLine(x0, y0, x1, y1);
                x0 = x1;
                y0 = y1;
            }
        }
    }

    hidden function zs(dc as Dc, x, y, t, col as Number) as Void {
        for (var i = 0; i < 3; i++) {
            var q = t / 2600.0 + i / 3.0;
            q -= Math.floor(q);
            var h = 9 + q * 12;
            dc.setColor(G.mix(col, cbg, q * q), -1);
            F.st(dc, "Z", x - q * 34 + 4 * Math.sin(q * 6), y - q * 50, h, 2, 1, 1.0, 0);
        }
    }

    // ------------------------------------------------------------ idle life (pure functions of t)
    // blink: closure 0..1 at time t (ms of the idle window), intervals iv .. 2.4 iv, seeded
    hidden function blink(t, seed, iv) as Float {
        if (t < 0) {
            return 0.0;
        }
        var s = G.rnd(seed * 31 + 7);
        var at = 700 + (s % 900);
        for (var i = 0; i < 30 && at <= t; i++) {
            var dt = t - at;
            if (dt < 180) {
                return (1 - (dt - 90).abs() / 90.0).toFloat();
            }
            s = G.rnd(s);
            at += iv + Math.floor(G.rf(s) * iv * 1.4).toNumber();
        }
        return 0.0;
    }

    // eye direction -1..1: holds a target for 1.2..3 s, glides 220 ms to the next
    hidden function glance(t, seed) as Float {
        if (t < 0) {
            return 0.0;
        }
        var s = G.rnd(seed * 17 + 3);
        var at = 0;
        var prev = 0;
        var cur = 0;
        for (var i = 0; i < 20; i++) {
            s = G.rnd(s);
            var nx = at + 1200 + (s % 1800);
            if (t < nx) {
                break;
            }
            prev = cur;
            s = G.rnd(s);
            cur = LOOK[s % 6];
            at = nx;
        }
        return G.lerp(prev, cur, G.easeInOut((t - at) / 220.0)).toFloat();
    }

    // breathing guide 0..1: 4 s in, 6 s out
    hidden function breath(t) as Float {
        var ph = t % 10000;
        return (ph < 4000 ? G.easeInOut(ph / 4000.0) : 1 - G.easeInOut((ph - 4000) / 6000.0)).toFloat();
    }

    // a bump 0..1..0 over [a, b]
    hidden function win(t, a, b) as Float {
        return t < a || t > b ? 0.0 : Math.sin(Math.PI * (t - a) / (b - a)).toFloat();
    }

    // expression for the mood (tt = idle ms or -1 when still), seed = d.wakeN
    hidden function expr(tt, seed) as Void {
        EK = OPEN;
        EO = 1.0;
        LID = 0.0;
        LY = 0.0;
        MK = MW;
        MA = 0.0;
        LX = glance(tt, seed);
        var iv = 1900;
        if (cM == NERVOUS) { iv = 750; MK = MWOB; }
        else if (cM == TIRED) { LID = 0.3; MK = MFLAT; iv = 2600; }
        else if (cM == SLEEPY) { LID = 0.36; MK = MO_; iv = 2800; }
        else if (cM == COSY) { EK = JOY; }
        else if (cM == HOP) { MK = MOPEN; MA = 0.35; }
        else if (cM == CHEER) { EK = JOY; MK = MOPEN; MA = 0.75; }
        EO = 1 - blink(tt, seed, iv);
        if (cM == COSY && win(tt, 2200, 3600) + win(tt, 6500, 7600) > 0) {
            EK = OPEN; // peeks out of the cosy smile
        }
        // yawns (tired, sleepy)
        var yw = cM == TIRED ? win(tt, 4800, 6400) : cM == SLEEPY ? win(tt, 1500, 3000) : 0.0;
        if (yw > 0) {
            MK = MOPEN;
            MA = yw;
            if (yw > 0.3) {
                EK = SHUT;
            }
        }
        // happy: a short ^^ smile now and then
        if (cM == HAPPY && (win(tt, 0, 1300) > 0 || win(tt, 5200, 6000) > 0)) {
            EK = JOY;
        }
        // a new minute: he looks at it, then smiles
        if (MQ >= 0 && MQ < 1.6 && cS != SLEEP) {
            LX = 1.0;
            LY = 0.3;
            if (MQ > 0.9) {
                EK = JOY;
            }
        }
        // tapped: giggles
        if (TP < 1500) {
            EK = JOY;
            MK = MOPEN;
            MA = 0.6;
        }
    }

    // ------------------------------------------------------------ Mo (sitting body)
    // arms: angle of the left / right flipper (deg, 0 = hanging), legs: extra swing of each leg
    hidden function moSit(dc as Dc, aL, aR, lL, lR, tt) as Void {
        // raised arms are long and come from behind the body; resting flippers lie in front
        if (aL > 90) {
            arm(dc, -42, -2, aL);
        }
        if (aR < -90) {
            arm(dc, 42, -2, aR);
        }
        body(dc, bm(0), ImgMo.BODY_OX, ImgMo.BODY_OY);
        if (cS == SPORT) {
            body(dc, bm(4), ImgMo.BAND_OX, ImgMo.BAND_OY);
        }
        limb(dc, -15.5, 47.5, 10 + lL, 1);
        limb(dc, 16.2, 49.5, -12 + lR, 1);
        face(dc, 0, 0);
        if (aL <= 90) {
            limb(dc, -44.9, 18.3, aL, 0.95);
        }
        if (aR >= -90) {
            limb(dc, 44.9, 18.3, aR, 0.95);
        }
        if (cM == SLEEPY) {
            cap(dc, 2, -40, -8, 1);
        }
        moodFx(dc, tt);
    }

    hidden function moodFx(dc as Dc, tt) as Void {
        var t = tt < 0 ? 0 : tt;
        if (cM == NERVOUS) {
            frizz(dc, t, cST);
            var q = (t % 1800) / 1800.0;
            drop(dc, bx(44, -30 + q * 10), by(44, -30 + q * 10), FS);
        } else if (cM == CHEER) {
            for (var i = 0; i < 3; i++) {
                var tw = tt < 0 ? 0.8 : 0.55 + 0.45 * Math.sin(t / 220.0 + i * 2.1);
                spark(dc, bx(SPX[i], SPY[i]), by(SPX[i], SPY[i]), SPR[i] * tw * FS, 0xFFE07A);
            }
            if (cR[0] != Now.MOVING) {
                drop(dc, bx(42, -26), by(42, -26), FS);
            }
        } else if (cM == COSY && tt >= 0) {
            var q = (t % 3400) / 3400.0;
            if (q < 0.8) {
                heart(dc, bx(34 + 8 * Math.sin(q * 7), -50 - q * 46), by(34 + 8 * Math.sin(q * 7), -50 - q * 46), (4 + q * 3) * FS, G.mix(0xFF6F8E, cbg, q * q));
            }
        }
        if (TP < 1500) {
            var q = TP / 1500.0;
            heart(dc, bx(-6 * Math.sin(q * 9), -64 - q * 44), by(-6 * Math.sin(q * 9), -64 - q * 44), (5 + q * 3) * FS, G.mix(0xFF6F8E, cbg, q * q));
        }
    }

    // ------------------------------------------------------------ scenes
    // centre x of the seat on the hour (side 0) or the minute digits
    hidden function seatX() as Number {
        var n = TC.size();
        var x = cSide == 0 ? (GX[0] + GX[CI - 1] + GA[CI - 1]) / 2.0 : (GX[CI + 1] + GX[n - 1] + GA[n - 1]) / 2.0;
        return Math.round(x).toNumber() + (cSide == 0 ? 16 : -10);
    }

    // seat point on the digits, legs swing, waving / pointing / cheering arms
    hidden function sceneSit(dc as Dc, d as D, a as A, tt) as Void {
        var p = a.intro;
        var sx = seatX();
        var sy = TY + 1;
        // drop in from above, squash on landing
        var dy = 0.0;
        var qx = 1.0;
        var qy = 1.0;
        if (p < 0.5) {
            dy = -260 * (1 - Math.pow(p / 0.5, 2));
        } else if (p < 0.78) {
            var q = Math.sin(Math.PI * (p - 0.5) / 0.28);
            qy = 1 - 0.13 * q;
            qx = 1 + 0.09 * q;
        }
        var s = 1.0;
        if (cM == NERVOUS && tt >= 0) {
            s = 1 + 0.07 * breath(tt);
        } else if (tt >= 0) {
            qy = 1 + 0.012 * Math.sin(tt / 520.0);
        }
        if (cM == HOP && tt >= 0) {
            dy = -Math.round(13 * Math.sin(Math.PI * tt / 950.0).abs());
        }
        if (cS == SPORT && tt >= 0 && cR[0] == Now.EFFORT) {
            dy = -Math.round(8 * Math.sin(Math.PI * tt / 700.0).abs());
        }
        if (dy > -150) {
            shadow(dc, sx, TY + 3, 120 + dy * 0.5, TY); // contact shadow, grows as he lands
        }
        frame(sx, sy + dy - 44 * ImgMo.S * s * qy, 0, s, qx, qy);
        expr(tt, d.wakeN);
        if (p < 0.5) { EK = OPEN; EO = 1.0; MK = MOPEN; MA = 0.55; LY = -1.0; }
        else if (p < 0.85) { EK = SHUT; MK = MW; }
        // legs: swing (decays to rest at the end of the intro), then dangle while awake
        var sw = p >= 0.5 && p < 1 ? 16 * (1 - p) * 2 * Math.sin((p - 0.5) * 26) : 0.0;
        if (tt >= 0) {
            sw = 13 * Math.sin(tt / 210.0);
        }
        if (cM == HOP && tt >= 0) {
            sw = 10 * Math.sin(tt / 150.0);
        }
        // arms
        var aL = 28.0;
        var aR = -28.0;
        if (p < 0.5) {
            aL = 120.0;
            aR = -120.0;
        }
        if (cS == SPORT) {
            aL = 140.0;
            if (tt >= 0 && cR[0] != Now.AFTERBURN) {
                aL = 140 + 18 * Math.sin(tt / 140.0);
                aR = -140 + 18 * Math.sin(tt / 140.0 + 3.1);
            }
        } else if (cM == HOP) {
            aR = -122 - (tt >= 0 ? 8 * Math.sin(tt / 120.0) : 0);
        } else if (cM == HAPPY && tt >= 0 && tt < 1500) {
            aR = -150 + 20 * Math.sin(tt / 95.0); // waves hello
        } else if (tt >= 0) {
            aL = 28 + 12 * win(tt % 7000, 3600, 4300) * Math.sin(tt / 60.0); // flipper wiggle
        }
        AX = FX;
        AY = FY - dy; // the bubble stays put while he hops
        moSit(dc, aL, aR, sw, -sw, tt);
    }

    // rises from behind the minute digits, paws on the edge, ducks away and comes back
    hidden function scenePeek(dc as Dc, d as D, a as A, tt, st as Number) as Void {
        var p = a.intro;
        var i3 = CI + 1;
        var i4 = TC.size() - 1;
        var ex = GX[i3] + GA[i3] + 4;
        var ey = TY - 9;
        var dy = 120 * (1 - G.spring(G.clamp((p - 0.12) / 0.6, 0.0, 1.0)));
        if (tt >= 0) {
            var c = tt % 8000;
            if (c > 4800 && c < 7000) { // after the bubble: ducks away and comes back
                dy = c < 5200 ? 120 * G.easeInOut((c - 4800) / 400.0) : c < 6100 ? 120 : 120 * (1 - G.spring((c - 6100) / 900.0));
            }
        }
        var r = 12 * Math.PI / 180.0;
        // anchor = body point (0, 12) turned by 12 deg
        var ax = -Math.sin(r) * 12 * ImgMo.S * 0.95;
        var ay = Math.cos(r) * 12 * ImgMo.S * 0.95;
        frame(ex - ax, ey - ay + dy, r, 0.95, 1, 1);
        expr(tt, d.wakeN);
        LX = tt >= 0 ? LX : -0.6;
        LID = 0.0;
        AX = FX;
        AY = FY - dy; // the bubble stays put while he ducks
        dc.setClip(0, 0, 454, TY + TH);
        body(dc, bm(0), ImgMo.BODY_OX, ImgMo.BODY_OY);
        face(dc, 0, 0);
        if (cM == SLEEPY) {
            cap(dc, 2, -40, -8, 1);
        }
        moodFx(dc, tt);
        dc.clearClip();
        // the digits in front of him: a plate in the background colour (the upper edge follows the solid
        // silhouettes of the digits), then the digits
        bgRect(dc, GX[i3] - 6, TY + 24, GX[i4] + GA[i4] - GX[i3] + 12, TH - 22, st);
        hull(dc, i3, GX[i3], TY, st);
        hull(dc, i4, GX[i4], TY, st);
        digit(dc, i3, GX[i3], TY, st, PAL[st - 1][1], 999);
        digit(dc, i4, GX[i4], TY, st, PAL[st - 1][1], 999);
        // paws on the edge
        if (dy < 26) {
            var k = 1 - dy / 26.0;
            frame(0, 0, 0, 1, 1, 1);
            limb(dc, (GX[i3] + GA[i3] - 24) / ImgMo.S, (TY - 7 + dy * 0.6) / ImgMo.S, -12, 0.72 * k + 0.01);
            limb(dc, (GX[i4] + 24) / ImgMo.S, (TY - 6 + dy * 0.6) / ImgMo.S, 14, 0.72 * k + 0.01);
        }
    }

    // asleep across the time; a raise: he yawns and slides up onto the digits
    hidden function sceneSleep(dc as Dc, d as D, a as A, tt) as Void {
        var p = a.intro;
        var sx = GX[CI] + GA[CI] / 2.0;
        var sy = TY + 1;
        var q = G.easeInOut(G.clamp((p - 0.38) / 0.5, 0.0, 1.0));
        var dy = 58 * (1 - q);
        var rot = 0.13 * Math.sin(Math.PI * q);
        var yawn = win(p, 0.08, 0.5);
        var qy = 1 + 0.03 * yawn;
        var qx = 1 + 0.05 * yawn;
        if (tt >= 0) {
            qy = 1 + 0.028 * Math.sin(tt / 640.0);
        }
        frame(sx, sy + dy - 34 * ImgMo.S * qy, rot, 1, qx, qy);
        AX = FX;
        AY = FY;
        EK = SHUT;
        EO = 0.0;
        LID = 0.0;
        LX = 0.0;
        LY = 0.0;
        MK = MO_;
        MA = 0.0;
        if (yawn > 0) {
            MK = MOPEN;
            MA = yawn;
        }
        if (tt >= 0 && win(tt, 5200, 5800) > 0.2) {
            MK = MW; // smiles in his sleep
        }
        body(dc, bm(1), ImgMo.LIE_OX, ImgMo.LIE_OY);
        face(dc, -16, -2);
        if (d.h >= 21 || d.h < 6) {
            cap(dc, -24, -28, -24, 0.74);
        }
        if (p >= 0.85 || tt >= 0) {
            zs(dc, bx(-62, -30), by(-62, -30), tt < 0 ? 900 : tt, PAL[d.cfg.style - 1][6]);
        }
    }

    // hangs from the colon by one flipper and swings, the other flipper waves
    hidden function sceneHang(dc as Dc, d as D, a as A, tt, st as Number) as Void {
        var p = a.intro;
        var gx = GX[CI] + GA[CI] / 2.0;
        var gy = st == 3 ? TY + 5 * K + K / 2.0 : TY - ImgMo.BIG_TOP + ImgMo.BIG_DOT;
        var ph = 0.5 * Math.pow(1 - p, 1.5) * Math.cos(2 * Math.PI * 1.6 * p);
        if (tt >= 0) {
            ph = 0.09 * Math.sin(tt / 330.0);
        }
        // the hand at body point (-50.6, -66.9) holds the dot; at rest the body hangs tilted by 0.647 rad
        var r = 0.647 + ph;
        var hx = -50.6 * ImgMo.S;
        var hy = -66.9 * ImgMo.S;
        frame(gx - (hx * Math.cos(r) - hy * Math.sin(r)), gy - (hx * Math.sin(r) + hy * Math.cos(r)), r, 1, 1, 1);
        AX = FX;
        AY = FY;
        expr(tt, d.wakeN);
        if (p < 0.75) { EK = JOY; MK = MOPEN; MA = 0.6; }
        LY = tt >= 0 ? LY : -0.3;
        arm(dc, -34, -34, 153.2);
        body(dc, bm(0), ImgMo.BODY_OX, ImgMo.BODY_OY);
        var kick = tt >= 0 ? 12 * Math.sin(tt / 260.0) : -ph * 40;
        limb(dc, -15.5, 47.5, 10 - 37 + kick, 1);
        limb(dc, 16.2, 49.5, -12 - 37 - kick, 1);
        face(dc, 0, 0);
        moodFx(dc, tt);
        limb(dc, 44.9, 18.3, tt >= 0 ? -60 + 25 * Math.sin(tt / 110.0) * win(tt % 5000, 0, 1600) : -50, 0.95);
    }

    // stomps the newest minute digit down into place (on the raise, and on a new minute while awake)
    hidden function scenePush(dc as Dc, d as D, a as A, tt, st as Number, mq) as Void {
        var p = a.intro;
        var i = TC.size() - 1;
        var R0 = 46; // how far the new digit sticks out
        var off = 0;
        var dy = 0;
        var qy = 1.0;
        var qx = 1.0;
        if (mq >= 0) {
            off = Math.round(R0 * (1 - G.ease(G.clamp((mq - 0.35) / 0.5, 0.0, 1.0)))).toNumber();
            dy = -Math.round(30 * win(mq, 0, 0.4)).toNumber();
        } else if (p < 1) {
            off = p < 0.38 ? R0 : p < 0.5 ? Math.round(R0 * (1 - 0.5 * G.ease((p - 0.38) / 0.12))).toNumber() : p < 0.72 ? R0 / 2
                : Math.round((R0 / 2) * (1 - G.ease((p - 0.72) / 0.1))).toNumber();
            if (p < 0.38) {
                dy = -Math.round(260 * (1 - Math.pow(p / 0.38, 2))).toNumber();
            }
            dy -= Math.round(30 * win(p, 0.52, 0.72)).toNumber();
            var sq = win(p, 0.38, 0.5) + win(p, 0.72, 0.84);
            qy = 1 - 0.14 * sq;
            qx = 1 + 0.1 * sq;
        } else if (tt >= 0) {
            var c = tt % 6500;
            dy = -Math.round(18 * win(c, 3000, 3450)).toNumber();
            off = -Math.round(3 * win(c, 3420, 3600)).toNumber();
        }
        if (off != 0) {
            bgRect(dc, GX[i] - 4, TY - R0 - 8, GA[i] + 8, TH + R0 + 12, st);
            digit(dc, i, GX[i], TY - off, st, PAL[st - 1][1], 999);
        }
        var sx = Math.round(GX[i] + GA[i] / 2.0).toNumber() - 6;
        var sy = TY - off + 1;
        if (dy > -40) {
            shadow(dc, sx, sy + 2, 110 + dy, sy);
        }
        frame(sx, sy + dy - 44 * ImgMo.S * qy, 0, 1, qx, qy);
        AX = FX;
        AY = FY - dy;
        expr(tt, d.wakeN);
        var busy = (mq >= 0 && mq < 0.9) || (mq < 0 && p < 0.84);
        if (busy) {
            EK = win(p, 0.38, 0.5) + win(p, 0.72, 0.84) > 0 ? SHUT : OPEN;
            MK = MWOB;
            LY = 1.0;
        } else if (mq < 0 && p < 1) {
            EK = JOY;
            MK = MOPEN;
            MA = 0.7;
        }
        var aL = 28.0;
        var aR = -28.0;
        if (busy) {
            aL = 120.0;
            aR = -120.0;
        } else if (mq < 0 && p < 1) {
            aL = 145.0;
            aR = -145.0;
        } else if (tt >= 0 && tt < 1300) {
            aL = 145 + 14 * Math.sin(tt / 90.0);
            aR = -145 - 14 * Math.sin(tt / 90.0);
        }
        var sw = tt >= 0 ? 12 * Math.sin(tt / 230.0) : 0.0;
        moSit(dc, aL, aR, sw + (dy < -4 ? 30 : 0), -sw - (dy < -4 ? 30 : 0), tt);
    }

    // ------------------------------------------------------------ speech bubble
    // lines of the bubble (cached): the tip of Now in two lines, else its first sentence, else the headline
    hidden function say(d as D, wr as Number) as Void {
        var tip = Now.tip(d, cR, d.wakeN);
        var key = tip + wr;
        if (key.equals(bS)) {
            return;
        }
        bS = key;
        var L = Now.wrap(tip, wr);
        if (L.size() > 2 && cS != HANG && cST != 3) {
            L = Now.wrap(tip, wr + 3); // a little wider
        }
        if (L.size() > 2) {
            var cs = tip.toCharArray();
            var e = -1;
            for (var i = 4; i < cs.size() - 1; i++) {
                var c = cs[i];
                if ((c == '.' || c == '!' || c == '?') && cs[i + 1] == ' ') {
                    e = i;
                    break;
                }
            }
            if (e > 0) {
                L = Now.wrap(tip.substring(0, e + 1), wr);
            }
        }
        if (L.size() > 2) {
            L = Now.wrap(Now.head(cR), wr);
        }
        bL = L;
    }

    // bubble at box x, y (w x h) with the tail tip at tx, ty; k = pop 0..1, n = chars typed so far;
    // think: a thought bubble (two dots instead of the tail)
    hidden function bubble(dc as Dc, x, y, w, h, tx, ty, k, n, st as Number, think as Boolean) as Void {
        var P = PAL[st - 1];
        var X = Math.round(tx + (x - tx) * k).toNumber();
        var Y = Math.round(ty + (y - ty) * k).toNumber();
        var W = Math.round(w * k).toNumber();
        var H = Math.round(h * k).toNumber();
        if (W < 6 || H < 6) {
            return;
        }
        var bx0 = G.clamp(tx, X + 14, X + W - 14);
        if (st == 3) {
            dc.setColor(0x161616, -1);
            dc.fillRectangle(X - 2, Y - 2, W + 4, H + 4);
            if (!think) {
                for (var i = 0; i < 4; i++) {
                    dc.fillRectangle(bx0 - 6 + i * 2 + (tx > bx0 ? i * 2 : 0), Y + H, 10 - i * 2, 4 + i * 3);
                }
            }
            dc.setColor(P[4], -1);
            dc.fillRectangle(X, Y, W, H);
        } else {
            dc.setColor(P[4], -1);
            dc.fillRoundedRectangle(X, Y, W, H, H / 2 < 14 ? H / 2 : 14);
            if (!think) {
                if (ty > Y + H) {
                    dc.fillPolygon([[bx0 - 8, Y + H - 2], [bx0 + 8, Y + H - 2], [tx, ty]]);
                } else if (tx < X) {
                    dc.fillPolygon([[X + 2, Y + H / 2 - 8], [X + 2, Y + H / 2 + 8], [tx, ty]]);
                } else {
                    dc.fillPolygon([[X + W - 2, Y + H / 2 - 8], [X + W - 2, Y + H / 2 + 8], [tx, ty]]);
                }
            }
        }
        if (think) {
            dc.setColor(st == 3 ? 0x161616 : P[4], -1);
            dc.fillCircle(G.lerp(bx0, tx, 0.45), G.lerp(Y + H + 4, ty, 0.45), 5 * k);
            dc.fillCircle(tx, ty, 3 * k);
        }
        if (k < 0.98) {
            return;
        }
        var left = n;
        for (var i = 0; i < bL.size() && left > 0; i++) {
            var s = bL[i];
            if (st == 3) {
                dc.setColor(P[5], -1);
                F.px(dc, s.length() > left ? s.substring(0, left) : s, x + 10, y + 9 + i * 20, 2, 0, 0);
            } else {
                txt(dc, s, Math.round(x + w / 2.0 - txtW(s, 0) / 2.0).toNumber(), y + 6 + i * 21, P[5], 0, left);
            }
            left -= s.length();
        }
    }

    // where the bubble goes for the scene
    hidden function speak(dc as Dc, d as D, tt, st as Number, over as String) as Void {
        if (over.equals("")) {
            say(d, cS == HANG ? (st == 3 ? 12 : 15) : st == 3 ? 15 : 18);
        } else {
            bL = [over];
            bS = "";
        }
        var w = 0;
        for (var i = 0; i < bL.size(); i++) {
            var lw = st == 3 ? F.pxW(bL[i], 2) : txtW(bL[i], 0);
            if (lw > w) {
                w = lw;
            }
        }
        w += 22;
        var h = bL.size() * (st == 3 ? 20 : 21) + (st == 3 ? 14 : 12);
        var x;
        var y;
        var tx;
        var ty;
        if (cS == SLEEP) {
            x = AX + 22; y = AY - 40 - h; tx = AX + 24; ty = AY - 30;
        } else if (cS == HANG && st == 3) {
            x = AX - 74 - w; y = AY - 40; tx = AX - 58; ty = AY - 22;
        } else if (cS == HANG) {
            x = AX + 64; y = AY - 34; tx = AX + 52; ty = AY - 16;
        } else {
            var right = AX < 227;
            x = right ? AX + 66 : AX - 66 - w;
            y = AY - 100;
            tx = right ? AX + 52 : AX - 52;
            ty = AY - 48;
        }
        // keep the box inside the round screen
        for (var i = 0; i < 24; i++) {
            var out = false;
            for (var c = 0; c < 4; c++) {
                var cx = c % 2 == 0 ? x : x + w;
                var cy = c < 2 ? y : y + h;
                if ((cx - 227) * (cx - 227) + (cy - 227) * (cy - 227) > 216 * 216) {
                    out = true;
                }
            }
            if (!out) {
                break;
            }
            x += x + w / 2.0 < 227 ? 4 : -4;
            y += y + h / 2.0 < 227 ? 4 : -4;
        }
        x = Math.round(x).toNumber();
        y = Math.round(y).toNumber();
        var T0 = 300;
        var T1 = over.equals("") ? 4300 : 99999;
        var k = G.spring(G.clamp((tt - T0) / 260.0, 0.0, 1.0));
        if (tt > T1) {
            k = 1 - G.ease((tt - T1) / 220.0);
        }
        if (k <= 0) {
            return;
        }
        var n = over.equals("") ? Math.floor((tt - T0 - 200) / 28.0).toNumber() : 99;
        bubble(dc, x, y, w, h, Math.round(tx).toNumber(), Math.round(ty).toNumber(), k, n, st, cS == SLEEP);
    }

    // heart that beats with the pulse: 1 on the beat, 0.5 on the second knock, else 0
    hidden function beat(t as Number, bpm as Number) as Float {
        var per = 60000 / (bpm > 30 ? bpm : 60);
        var ph = (t % per) / per.toFloat();
        return ph < 0.14 ? 1.0 : ph >= 0.2 && ph < 0.3 ? 0.5 : 0.0;
    }

    // static layer: background, time, contact shadow, date, battery. Keyed by the minute and the plan
    // of this raise (scene and side depend on the state and d.wakeN).
    function bgKey(d as D) as Number {
        plan(d);
        return ((d.doy * 1440 + d.mins) * 6 + cS) * 2 + cSide;
    }

    // touch (and hold): Mo giggles and a heart floats up
    function tap(x as Number, y as Number, d as D) as Boolean {
        return true;
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var st = G.clamp(d.cfg.style, 1, 3);
        var P = PAL[st - 1];
        plan(d);
        release(cS);
        lay(d, cS, st);
        cbg = st == 2 ? 0x24163A : P[0];
        cST = st;
        var dy = cS == HANG ? TY - 66 : TY + TH + 22; // date line (status 26 below, or above for HANG)
        var sy = cS == HANG ? dy - 26 : dy + 27;
        if (S) {
            if (st == 2) {
                dc.drawBitmap(0, 0, bm(10));
            } else if (st == 3) {
                dc.setColor(P[0], -1);
                dc.fillRectangle(0, 0, 454, 454);
            }
            for (var i = 0; i < TC.size(); i++) {
                digit(dc, i, GX[i], TY, st, P[1], 999);
            }
            if (cS == SLEEP) {
                shadow(dc, GX[CI] + GA[CI] / 2.0, TY + 3, 210, TY);
            }
            // date, battery
            if (st == 3) {
                var ds = DOW[d.dow] + " " + d.day + "." + d.mon + ".";
                dc.setColor(P[2], -1);
                F.px(dc, ds, 227, dy, 3, 1, 0);
                dc.setColor(P[3], -1);
                F.px(dc, d.batt + "%", 239, sy + 4, 2, 0, 0);
            } else {
                var ds = d.dowStr + " " + d.day + ". " + d.monStr;
                txt(dc, ds, Math.round(227 - txtW(ds, 1.5) / 2.0).toNumber(), dy, P[2], 1.5, 99);
                dc.setColor(P[3], -1);
                dc.setPenWidth(2);
                dc.drawRoundedRectangle(239, sy + 7, 19, 11, 3);
                dc.fillRectangle(258, sy + 10, 2, 5);
                var bw = Math.round(13 * G.clamp(d.batt, 0, 100) / 100.0).toNumber();
                dc.fillRectangle(242, sy + 10, bw < 1 ? 1 : bw, 5);
                txt(dc, d.batt + " %", 265, sy, P[3], 0, 99);
            }
        }

        if (!M) {
            return;
        }
        var tt = a.live && a.t > 1400 ? a.t - 1400 : -1;
        // ---- live pulse with a beating heart (left of the centre)
        var hr = d.hrNow();
        var hs = hr > 0 ? "" + hr : "--";
        var b = a.live ? beat(a.t, hr) : 0.0;
        var hc = st == 3 ? 0x161616 : 0xFF6F8E;
        if (st == 3) {
            dc.setColor(P[3], -1);
            F.px(dc, hs, 215 - F.pxW(hs, 2), sy + 4, 2, 0, 0);
            heart(dc, 215 - F.pxW(hs, 2) - 12, sy + 8, 4.5 + b, hc);
        } else {
            var w = txtW(hs, 0);
            txt(dc, hs, 215 - w, sy, P[3], 0, 99);
            heart(dc, 215 - w - 11, sy + 11, 5 + b * 1.2, hc);
        }
        // ---- a new minute rises into place while awake (ms since the minute changed)
        var since = d.s * 1000 + a.ms;
        var mq = -1.0;
        if (a.live && a.t - since > 1400 && since < 1600) {
            mq = since / 1300.0;
        }
        if (mq >= 0 && cS != PUSH && mq < 1) {
            var i = TC.size() - 1;
            var o = Math.round(TH * (1 - G.spring(mq))).toNumber();
            bgRect(dc, GX[i] - 3, TY, GA[i] + 6, TH + 2, st);
            digit(dc, i, GX[i], TY + o, st, P[1], TY + TH + 2);
        }
        // ---- Mo
        MQ = mq;
        TP = a.tap;
        if (cS == SIT || cS == SPORT) {
            sceneSit(dc, d, a, tt);
        } else if (cS == PEEK) {
            scenePeek(dc, d, a, tt, st);
        } else if (cS == SLEEP) {
            sceneSleep(dc, d, a, tt);
        } else if (cS == HANG) {
            sceneHang(dc, d, a, tt, st);
        } else {
            scenePush(dc, d, a, tt, st, mq >= 0 && mq < 1 ? mq : -1);
        }
        // ---- speech bubble (after the intro, a few seconds), then the breathing guide when tense
        if (tt >= 0) {
            if (cM == NERVOUS && tt > 4600) {
                speak(dc, d, tt, st, tt % 10000 < 4000 ? "Einatmen ..." : "Ausatmen ...");
            } else {
                speak(dc, d, tt, st, "");
            }
        }
    }

    function aod(dc as Dc, d as D) as Void {
        release(-2);
        var o = St.shift(d);
        var st = G.clamp(d.cfg.style, 1, 3);
        var t = G.timeStr(d);
        var cs = t.toCharArray();
        var w = 0;
        for (var i = 0; i < cs.size(); i++) {
            w += st == 3 ? (cs[i] == ':' ? 30 : 60) : ImgMo.THIN_ADV[cs[i] == ':' ? 10 : cs[i].toNumber() - 48];
        }
        var x = Math.round(227 - w / 2.0).toNumber() + o[0];
        var y = 196 + o[1];
        var cx = 227;
        for (var i = 0; i < cs.size(); i++) {
            var ch = cs[i];
            if (ch == ':') {
                cx = x + (st == 3 ? 15 : ImgMo.THIN_ADV[10] / 2);
            }
            if (st == 3) {
                dc.setColor(0x5A5A5A, -1);
                if (ch == ':') {
                    dc.fillRectangle(x + 10, y + 20, 10, 10);
                    dc.fillRectangle(x + 10, y + 50, 10, 10);
                } else {
                    F.px(dc, ch.toString(), x, y, 10, 0, 1);
                }
                x += ch == ':' ? 30 : 60;
            } else {
                var j = ch == ':' ? 10 : ch.toNumber() - 48;
                dc.setClip(x - 3, y - ImgMo.THIN_TOP, ImgMo.THIN_ADV[j] + 6, ImgMo.THIN_H);
                dc.drawBitmap2(x - j * ImgMo.THIN_CW - 3, y - ImgMo.THIN_TOP, bm(11), {:tintColor => 0x8A8580});
                dc.clearClip();
                x += ImgMo.THIN_ADV[j];
            }
        }
        // sleeping Mo (thin outline) on the time, a small z
        dc.drawBitmap(cx - ImgMo.AOD_OX, y + 1 - Math.round(34 * ImgMo.S * 0.8).toNumber() - ImgMo.AOD_OY, bm(12));
        dc.setColor(0x3C4170, -1);
        F.st(dc, "Z", cx + 52, y - 74, 12, 2, 1, 1.0, 0);
        dc.setColor(0x5A5652, -1);
        var ds = st == 3 ? DOW[d.dow] + " " + d.day + "." + d.mon + "." : d.dowStr + " " + d.day + ". " + d.monStr;
        if (st == 3) {
            F.px(dc, ds, 227 + o[0], 300 + o[1], 2, 1, 0);
        } else {
            txt(dc, ds, Math.round(227 - txtW(ds, 1.5) / 2.0).toNumber() + o[0], 296 + o[1], 0x6A6560, 1.5, 99);
        }
    }
}
