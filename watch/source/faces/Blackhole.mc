import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// HOLE — "Schwarzes Loch": a black hole in the style of Gargantua, made for AMOLED. A flat accretion
// disk circles the hole; behind it the light of the far side is bent over and under the hole, a thin
// photon ring hugs the event horizon. Particles orbit at Keplerian speed (fast inside, slow outside,
// quicker with a higher pulse) and the side flying towards you glows brighter (Doppler beaming). On
// every wrist raise the matter spirals in. Below: the steps to the event horizon (the step goal).
// Styles: 1 Gargantua, 2 Quasar, 3 Akzent. Mirrors web/js/faces/blackhole.js.
class FaceBlackhole extends Face {
    const CX = 227;
    const CY = 230;
    const RH = 52;
    const FL = 0.2;
    const NP = 70;
    const LR = [92, 84, 76, 68];
    const LT = [0.6, 0.35, 0.15, 0.0];
    const LB = [-0.55, -0.25, 0.2, 0.7];

    // cos / sin every 5 degrees, the orbit radius, speed factor and start angle of every particle
    hidden var _cos as Array<Float>;
    hidden var _sin as Array<Float>;
    hidden var _pr as Array<Number>;
    hidden var _pw as Array<Float>;
    hidden var _pa as Array<Float>;

    function initialize() {
        Face.initialize();
        _cos = new [72] as Array<Float>;
        _sin = new [72] as Array<Float>;
        for (var i = 0; i < 72; i++) {
            _cos[i] = Math.cos(i * 5 * Math.PI / 180).toFloat();
            _sin[i] = Math.sin(i * 5 * Math.PI / 180).toFloat();
        }
        _pr = new [NP] as Array<Number>;
        _pw = new [NP] as Array<Float>;
        _pa = new [NP] as Array<Float>;
        for (var i = 0; i < NP; i++) {
            var r0 = 66 + (G.rnd(i * 7 + 1) % 136);
            _pr[i] = r0;
            _pw[i] = (0.0011 * Math.pow(100.0 / r0, 1.5)).toFloat();
            _pa[i] = ((G.rnd(i * 13 + 5) % 360) * Math.PI / 180).toFloat();
        }
    }

    function fps() as Number {
        return 12;
    }

    // [hot, warm, cool, ring, text, text dim, star]
    hidden function pal(st as Number, acc as Number) as Array<Number> {
        if (st == 2) {
            return [0xE8F4FF, 0x6A9AFF, 0x6A2AD8, 0xFFFFFF, 0xD8E4FF, 0x6A7AA8, 0xB8C8FF] as Array<Number>;
        }
        if (st == 3) {
            return [G.mix(acc, 0xFFFFFF, 0.75), acc, G.mix(acc, 0, 0.55), 0xFFFFFF, G.mix(acc, 0xFFFFFF, 0.6), G.mix(acc, 0, 0.4), 0xD8D8E8] as Array<Number>;
        }
        return [0xFFF6E0, 0xFFA83A, 0xC8401A, 0xFFFFFF, 0xFFE8C8, 0xA87A5A, 0xD8D8E8] as Array<Number>;
    }

    // colour of disk matter at radius r (hot inside), brightened on the approaching side
    hidden function heat(P as Array<Number>, r, bright) as Number {
        var t = G.clamp((r - RH) / 150.0, 0, 1);
        var c = t < 0.4 ? G.mix(P[0], P[1], t / 0.4) : G.mix(P[1], P[2], (t - 0.4) / 0.6);
        return bright >= 0 ? G.mix(c, 0xFFFFFF, bright * 0.35) : G.mix(c, 0x000000, -bright * 0.55);
    }

    // one sector of a disk band: the ring between radii r1 and r2 from angle a0 (degrees, a multiple
    // of 5) over 30 degrees, flattened into the disk plane
    hidden function sector(dc as Dc, r1 as Number, r2 as Number, a0 as Number) as Void {
        var i0 = a0 / 5;
        var i1 = (i0 + 3) % 72;
        var i2 = (i0 + 6) % 72;
        i0 = i0 % 72;
        dc.fillPolygon([
            [CX + _cos[i0] * r2, CY + _sin[i0] * r2 * FL], [CX + _cos[i1] * r2, CY + _sin[i1] * r2 * FL],
            [CX + _cos[i2] * r2, CY + _sin[i2] * r2 * FL], [CX + _cos[i2] * r1, CY + _sin[i2] * r1 * FL],
            [CX + _cos[i1] * r1, CY + _sin[i1] * r1 * FL], [CX + _cos[i0] * r1, CY + _sin[i0] * r1 * FL]
        ]);
    }

    // one half of the disk (back: 180..360, front: 0..180) in bands and sectors, the side flying
    // towards you (left) brighter
    hidden function half(dc as Dc, P as Array<Number>, from as Number, dim) as Void {
        for (var r = 66; r < 206; r += 20) {
            for (var a0 = from; a0 < from + 180; a0 += 30) {
                dc.setColor(heat(P, r + 6, -_cos[((a0 + 15) / 5) % 72] * 0.6 - dim), -1);
                sector(dc, r, r + 21, a0);
            }
        }
    }

    // static layer: stars, the disk, the lensed arcs, the horizon and its photon ring, texts; the
    // orbiting particles move
    function bgKey(d as D) as Number {
        return minuteKey(d);
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var S = !a.bg; // draw the static parts
        var M = !a.so; // draw the moving parts
        var P = pal(d.cfg.style, d.accent);
        var p = a.intro;
        var live = a.live;
        var tt = live ? a.t : 0;

        if (S) {
            dc.setColor(0x000000, -1);
            dc.fillRectangle(0, 0, 454, 454);
            dc.setColor(G.mix(P[6], 0, 0.45), -1);
            for (var i = 0; i < 40; i++) {
                dc.fillRectangle(20 + ((i * 101 + 17) % 414), 20 + ((i * 59 + 11) % 414), 2, 2);
            }
            // ---- back half of the disk (the horizon is drawn over it)
            half(dc, P, 180, 0.3);
            // ---- light of the far side bent over and under the hole
            for (var l = 0; l < 4; l++) {
                var r = LR[l];
                dc.setColor(heat(P, RH + 150 * LT[l], LB[l]), -1);
                var pts = [];
                for (var deg = 190; deg <= 350; deg += 20) {
                    var i = deg / 5;
                    pts.add([CX + _cos[i] * r, CY + _sin[i] * r * 0.9]);
                }
                for (var deg = 350; deg >= 190; deg -= 20) {
                    var i = deg / 5;
                    pts.add([CX + _cos[i] * (RH + 2), CY + _sin[i] * (RH + 2) * 0.9]);
                }
                dc.fillPolygon(pts);
            }
            dc.setColor(heat(P, 70, 0.2), -1);
            for (var deg = 20; deg <= 160; deg += 8) {
                var an = deg * Math.PI / 180;
                dc.fillRectangle(Math.round(CX + Math.cos(an) * (RH + 8)).toNumber() - 1, Math.round(CY + Math.sin(an) * (RH + 8) * 0.9).toNumber() - 1, 3, 3);
            }
            // ---- the horizon and its photon ring
            dc.setColor(P[3], -1);
            dc.fillCircle(CX, CY, RH + 3);
            dc.setColor(0x000000, -1);
            dc.fillCircle(CX, CY, RH);
            // ---- front half of the disk, over the hole
            half(dc, P, 0, 0);
            // ---- time, date, the way to the event horizon
            dc.setColor(P[4], -1);
            F.st(dc, G.timeStr(d), 227, 74, 54, 4, 1, 1.0, 0);
            dc.setColor(P[5], -1);
            F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 112, 2, 1, 0);
            var sg = d.stepGoal > 0 ? d.stepGoal : 10000;
            var st = d.steps > 0 ? d.steps : 0;
            dc.setColor(P[4], -1);
            F.px(dc, st >= sg ? "SINGULARITÄT ERREICHT" : "EREIGNISHORIZONT IN", 227, 324, 2, 1, 0);
            if (st < sg) {
                F.px(dc, G.num(sg - st) + " SCHRITTEN", 227, 346, 2, 1, 0);
            }
            dc.setColor(P[5], -1);
            F.px(dc, (d.hr > 0 ? "" + d.hr : "--") + " BPM  STRESS " + (d.stress >= 0 ? "" + d.stress : "--"), 227, 372, 2, 1, 0);
        }

        if (!M) {
            return;
        }
        // ---- matter orbiting at Keplerian speed; it spirals in on every raise
        var spd = 1 + (d.hr > 0 ? G.clamp((d.hr - 60) / 60.0, 0, 1.5) : 0);
        var e = G.ease(G.clamp(p / 0.9, 0, 1));
        for (var i = 0; i < NP; i++) {
            var r0 = _pr[i];
            var r = r0 * (1 + (1 - e) * 1.4);
            var an = _pa[i] + tt * _pw[i] * spd + (1 - e) * 3;
            var ca = Math.cos(an);
            var sa = Math.sin(an);
            var x = CX + ca * r;
            var y = CY + sa * r * FL;
            if (sa < 0 && (x - CX) * (x - CX) + (y - CY) * (y - CY) < (RH + 4) * (RH + 4)) {
                continue;
            }
            var b = -ca;
            dc.setColor(G.mix(heat(P, r0, b > 0 ? b : b * 0.6), 0xFFFFFF, 0.55), -1);
            var s = r0 < 110 ? 4 : 3;
            dc.fillRectangle(Math.round(x).toNumber() - 1, Math.round(y).toNumber() - 1, s, s);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var P = pal(d.cfg.style, d.accent);
        dc.setColor(G.mix(P[1], 0, 0.55), -1);
        dc.setPenWidth(2);
        dc.drawCircle(CX + o[0], CY + o[1], RH + 3);
        dc.setColor(0x8A8A8A, -1);
        F.st(dc, G.timeStr(d), 227 + o[0], 74 + o[1], 54, 3, 1, 1.0, 0);
    }
}
