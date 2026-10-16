import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;

// DRIVETRAIN — chainring + 12-speed cassette as a clock. Hour = cog (1..12, accent),
// minutes = crank arm angle; the chain runs to the current cog. Weekly bike km on a rolling odometer.
// Styles: 1 Carbon, 2 Chrom, 3 Neon. Mirrors web/js/faces/gear.js.
class FaceGear extends Face {
    const RX = 180;
    const RY = 262;
    const RR = 98;
    const KX = 354;
    const KY = 262;
    const CASS = [10, 11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 33];
    const NT = 50;
    const RAD = 0.017453292519943295;
    const CV = 0.045;
    const POW = [10000, 1000, 100, 10, 1];

    function initialize() {
        Face.initialize();
    }

    function fps() as Number {
        return 15;
    }

    hidden function cogR(i) {
        return 17 + i * 3.9;
    }

    // chain loop (travel order): ring wrap, bottom run, cog wrap, top run.
    // segments stride 7: [type, a, b, c, d, e, len]; type 0 line (a,b)->(c,d); 1 arc centre (a,b) r c, start d, sweep e
    hidden function chain(cog) as Array {
        var r1 = RR + 3.0;
        var r2 = cogR(cog) + 3.0;
        var D = (KX - RX).toFloat();
        var al = Math.asin((r1 - r2) / D) / RAD;
        var g = new [28];
        g[0] = 1; g[1] = RX; g[2] = RY; g[3] = r1; g[4] = 360 + al; g[5] = -(180 + 2 * al); g[6] = r1 * (180 + 2 * al) * RAD;
        var b0x = G.ptX(RX, r1, 180 - al);
        var b0y = G.ptY(RY, r1, 180 - al);
        var b1x = G.ptX(KX, r2, 180 - al);
        var b1y = G.ptY(KY, r2, 180 - al);
        g[7] = 0; g[8] = b0x; g[9] = b0y; g[10] = b1x; g[11] = b1y; g[12] = 0;
        g[13] = Math.sqrt((b1x - b0x) * (b1x - b0x) + (b1y - b0y) * (b1y - b0y));
        g[14] = 1; g[15] = KX; g[16] = KY; g[17] = r2; g[18] = 180 - al; g[19] = -(180 - 2 * al); g[20] = r2 * (180 - 2 * al) * RAD;
        var t0x = G.ptX(KX, r2, al);
        var t0y = G.ptY(KY, r2, al);
        var t1x = G.ptX(RX, r1, al);
        var t1y = G.ptY(RY, r1, al);
        g[21] = 0; g[22] = t0x; g[23] = t0y; g[24] = t1x; g[25] = t1y; g[26] = 0;
        g[27] = Math.sqrt((t1x - t0x) * (t1x - t0x) + (t1y - t0y) * (t1y - t0y));
        return g;
    }

    hidden function part(dc as Dc, g as Array, k, t0, t1, ox, oy) as Void {
        var i = k * 7;
        if (g[i] == 0) {
            dc.drawLine(G.lerp(g[i + 1], g[i + 3], t0) + ox, G.lerp(g[i + 2], g[i + 4], t0) + oy,
                        G.lerp(g[i + 1], g[i + 3], t1) + ox, G.lerp(g[i + 2], g[i + 4], t1) + oy);
        } else {
            var a = g[i + 4] + g[i + 5] * t0;
            var b = g[i + 4] + g[i + 5] * t1;
            G.arcC(dc, g[i + 1] + ox, g[i + 2] + oy, g[i + 3], a < b ? a : b, a < b ? b : a);
        }
    }

    hidden function chainLen(g as Array) {
        return g[6] + g[13] + g[20] + g[27];
    }

    // dashes (links) along the loop, visible up to s1
    hidden function links(dc as Dc, g as Array, off, P, Dl, s1) as Void {
        var L = chainLen(g);
        var s = -(off - P * Math.floor(off / P));
        var k = 0;
        var acc = 0.0;
        var end = L < s1 ? L : s1;
        for (; s < end; s += P) {
            var a = s > 0 ? s : 0.0;
            var b = s + Dl;
            if (b > end) {
                b = end;
            }
            if (b <= a) {
                continue;
            }
            while (k < 3 && acc + g[k * 7 + 6] <= a) {
                acc += g[k * 7 + 6];
                k++;
            }
            var ln = g[k * 7 + 6];
            part(dc, g, k, (a - acc) / ln, G.clamp((b - acc) / ln, 0.0, 1.0), 0, 0);
        }
    }

    // n radial lines r1..r2 starting at clock angle a0 (incremental rotation, no per-tooth trig)
    hidden function teeth(dc as Dc, cx, cy, r1, r2, n, a0) as Void {
        var stp = 2 * Math.PI / n;
        var cs = Math.cos(stp);
        var sn = Math.sin(stp);
        var x = Math.sin(a0 * RAD);
        var y = -Math.cos(a0 * RAD);
        for (var i = 0; i < n; i++) {
            dc.drawLine(cx + x * r1, cy + y * r1, cx + x * r2, cy + y * r2);
            var nx = x * cs - y * sn;
            y = x * sn + y * cs;
            x = nx;
        }
    }

    hidden function hour12(d as D) {
        return d.h % 12 == 0 ? 12 : d.h % 12;
    }

    function draw(dc as Dc, d as D, a as A) as Void {
        var st = d.cfg.style;
        var acc = d.accent;
        var p = a.intro;
        var neon = st == 3;
        var chrom = st == 2;
        var h12 = hour12(d);
        var cog = h12 - 1;
        var mDeg = d.m * 6;
        // ring assembly rotation (spring into place) and pedalling teeth phase
        var rot = mDeg - (1 - G.spring(p)) * 140;
        var tph = a.live ? -(a.t * CV / RR) / RAD : 0.0;

        // palette
        var cBody = neon ? -1 : (chrom ? 0x8D9299 : 0x2B2D31);
        var cTooth = neon ? G.dim(acc, 0.85) : (chrom ? 0xB9BEC5 : 0x3C3F44);
        var cCog = neon ? G.dim(acc, 0.45) : (chrom ? 0x80858C : 0x3A3C40);
        var cHi = chrom ? 0xF2F4F7 : 0x55585E;

        // ---- time + date
        dc.setColor(0x8A8A8A, -1);
        F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 20, 2, 1, 0);
        dc.setColor(0xFFFFFF, -1);
        F.st(dc, G.timeStr(d), 227, 76, 62, 7, 1, G.easeInOut(p * 1.3), 0);

        // ---- minute index ring around the chainring
        var ip = G.ease(p * 1.6);
        dc.setPenWidth(2);
        for (var i = 0; i < 12; i++) {
            if (i / 12.0 > ip) {
                break;
            }
            dc.setColor(i == 0 ? 0x9A9A9A : 0x4A4A4A, -1);
            G.tick(dc, RX, RY, RR + 13, RR + (i % 3 == 0 ? 21 : 17), i * 30);
        }

        // ---- cassette
        if (!neon) {
            dc.setColor(chrom ? 0x1A1B1D : 0x0F1012, -1);
            dc.fillCircle(KX, KY, cogR(11) + 3);
        }
        for (var i = 0; i < 12; i++) {
            if (i == cog) {
                continue;
            }
            dc.setPenWidth(neon ? 1 : 2);
            dc.setColor(G.dim(cCog, (i % 2 == 0 ? 0.6 : 0.85) + 0.15 * i / 11.0), -1);
            dc.drawCircle(KX, KY, cogR(i));
        }
        // highlighted cog with its real teeth
        var cr = cogR(cog);
        var cn = CASS[cog];
        if (!neon) {
            dc.setColor(G.dim(acc, 0.3), -1);
            dc.setPenWidth(5);
            dc.drawCircle(KX, KY, cr - 1);
        }
        dc.setColor(acc, -1);
        dc.setPenWidth(3);
        dc.drawCircle(KX, KY, cr);
        dc.setPenWidth(3);
        var cph = a.live ? -(a.t * CV / (cr + 3)) / RAD : 0.0;
        teeth(dc, KX, KY, cr, cr + 4, cn, cph);
        if (chrom) {
            dc.setColor(0xE6E9ED, -1);
            dc.setPenWidth(2);
            G.arcC(dc, KX, KY, cogR(11) + 1, 290, 340);
        }
        // lockring
        dc.setColor(neon ? acc : (chrom ? 0xC9CDD2 : 0x4A4D52), -1);
        dc.setPenWidth(2);
        dc.drawCircle(KX, KY, 9);
        dc.fillCircle(KX, KY, 4);

        // ---- chain
        var cg = chain(cog);
        var L = chainLen(cg);
        var cp = G.ease(G.clamp((p - 0.1) / 0.6, 0.0, 1.0));
        var off = (a.t % 2000000) * CV;
        if (cp > 0) {
            var vis = L * cp;
            var acc0 = 0.0;
            dc.setColor(neon ? G.dim(acc, 0.25) : (chrom ? 0x3B3E43 : G.dim(acc, 0.35)), -1);
            dc.setPenWidth(neon ? 7 : 8);
            for (var k = 0; k < 4; k++) {
                var ln = cg[k * 7 + 6];
                if (acc0 < vis) {
                    part(dc, cg, k, 0.0, G.clamp((vis - acc0) / ln, 0.0, 1.0), 0, 0);
                }
                acc0 += ln;
            }
            dc.setColor(neon ? acc : (chrom ? 0xDFE2E6 : acc), -1);
            dc.setPenWidth(neon ? 3 : 5);
            links(dc, cg, off, 10.0, 6.0, vis);
        }

        // ---- chainring
        var tr = rot + tph;
        if (!neon) {
            dc.setColor(cBody, -1);
            dc.setPenWidth(12);
            dc.drawCircle(RX, RY, RR - 6);
        } else {
            dc.setColor(G.dim(acc, 0.3), -1);
            dc.setPenWidth(5);
            dc.drawCircle(RX, RY, RR - 2);
            dc.setColor(acc, -1);
            dc.setPenWidth(2);
            dc.drawCircle(RX, RY, RR - 2);
            dc.drawCircle(RX, RY, RR - 12);
        }
        // teeth: short thick radial lines
        dc.setColor(cTooth, -1);
        dc.setPenWidth(neon ? 2 : 5);
        teeth(dc, RX, RY, RR - 1, RR + 5, NT, tr);
        if (st == 1) {
            // carbon weave hint on the ring band
            dc.setPenWidth(4);
            dc.setColor(0x3C3F45, -1);
            for (var i = 0; i < 12; i++) {
                G.arcC(dc, RX, RY, RR - 9, i * 30 + rot, i * 30 + rot + 15);
                G.arcC(dc, RX, RY, RR - 4, i * 30 + rot + 15, i * 30 + rot + 30);
            }
        }
        if (chrom) {
            // specular highlight top-left, shade bottom-right
            dc.setColor(cHi, -1);
            dc.setPenWidth(2);
            G.arcC(dc, RX, RY, RR - 1, 285, 350);
            G.arcC(dc, RX, RY, RR - 11, 290, 340);
            dc.setColor(0x4B4F55, -1);
            G.arcC(dc, RX, RY, RR - 1, 110, 170);
        }
        // spider: 5 arms
        for (var i = 0; i < 5; i++) {
            var ang = rot + 36 + i * 72;
            if (neon) {
                dc.setColor(acc, -1);
                dc.setPenWidth(2);
                var s = Math.sin(ang * RAD);
                var c = Math.cos(ang * RAD);
                dc.drawLine(RX + c * 6 + s * 16, RY + s * 6 - c * 16, RX + c * 4 + s * (RR - 12), RY + s * 4 - c * (RR - 12));
                dc.drawLine(RX - c * 6 + s * 16, RY - s * 6 - c * 16, RX - c * 4 + s * (RR - 12), RY - s * 4 - c * (RR - 12));
            } else {
                dc.setColor(chrom ? 0x9FA4AB : 0x34373C, -1);
                G.hand(dc, RX, RY, ang, RR - 8, 0, 18, 10);
                if (chrom) {
                    dc.setColor(0xE4E7EB, -1);
                    dc.setPenWidth(1);
                    G.tick(dc, RX, RY, 22, RR - 12, ang - 3);
                }
            }
            // chainring bolt
            dc.setColor(neon ? acc : (chrom ? 0xD5D8DC : 0x5A5D62), -1);
            dc.fillCircle(G.ptX(RX, RR - 13, ang), G.ptY(RY, RR - 13, ang), 3);
        }

        // ---- crank arm at the minute angle
        if (neon) {
            dc.setColor(G.dim(acc, 0.35), -1);
            dc.setPenWidth(12);
            G.tick(dc, RX, RY, 0, RR - 8, rot);
            dc.setColor(acc, -1);
            dc.setPenWidth(4);
            G.tick(dc, RX, RY, 0, RR - 8, rot);
        } else {
            dc.setColor(0x000000, -1);
            G.hand(dc, RX, RY, rot, RR - 4, 16, 32, 24);
            dc.setColor(chrom ? 0xC3C7CD : 0x2A2C30, -1);
            G.hand(dc, RX, RY, rot, RR - 6, 14, 26, 18);
            dc.setColor(chrom ? 0xF5F6F8 : 0x50545A, -1);
            dc.setPenWidth(2);
            G.tick(dc, RX, RY, 6, RR - 14, rot - 4);
            if (st == 1) {
                // carbon weave on the crank: short alternating slashes
                dc.setPenWidth(2);
                for (var k = 0; k < 7; k++) {
                    var rr = 14 + k * 9;
                    dc.setColor(k % 2 == 0 ? 0x3A3D43 : 0x18191B, -1);
                    G.tick(dc, G.ptX(RX, rr, rot), G.ptY(RY, rr, rot), -6, 6, rot + 90 + (k % 2 == 0 ? 30 : -30));
                }
            }
        }
        // hub + pedal axle
        dc.setColor(neon ? 0x000000 : (chrom ? 0x7A7F86 : 0x0C0C0D), -1);
        dc.fillCircle(RX, RY, 15);
        dc.setColor(neon ? acc : (chrom ? 0xE8EBEF : 0x4D5056), -1);
        dc.setPenWidth(2);
        dc.drawCircle(RX, RY, 15);
        dc.fillCircle(RX, RY, 5);
        var px = G.ptX(RX, RR - 18, rot);
        var py = G.ptY(RY, RR - 18, rot);
        dc.setColor(acc, -1);
        dc.fillCircle(px, py, 9);
        dc.setColor(0x000000, -1);
        dc.fillCircle(px, py, 4);
        // minute pointer outside the teeth
        dc.setColor(acc, -1);
        dc.fillPolygon([
            [G.ptX(RX, RR + 7, rot), G.ptY(RY, RR + 7, rot)],
            [G.ptX(RX, RR + 19, rot - 4.5), G.ptY(RY, RR + 19, rot - 4.5)],
            [G.ptX(RX, RR + 19, rot + 4.5), G.ptY(RY, RR + 19, rot + 4.5)]
        ]);

        // ---- gear readout above the cassette: GANG n / 50x17
        var gp = G.ease(p * 1.5 - 0.3);
        if (gp > 0) {
            dc.setColor(G.dim(0x8A8A8A, gp), -1);
            F.px(dc, "GANG " + h12, KX + 4, 142, 2, 1, 0);
            var t1 = "50";
            var t2 = "" + CASS[cog];
            var w1 = F.stW(t1, 22);
            var w2 = F.stW(t2, 22);
            var x0 = KX + 4 - (w1 + w2 + 16) / 2.0;
            dc.setColor(G.dim(0xFFFFFF, gp), -1);
            F.st(dc, t1, x0, 176, 22, 3, 0, 1.0, 0);
            dc.setColor(G.dim(acc, gp), -1);
            F.st(dc, t2, x0 + w1 + 16, 176, 22, 3, 0, 1.0, 0);
            dc.setPenWidth(2);
            dc.drawLine(x0 + w1 + 4, 172, x0 + w1 + 12, 180);
            dc.drawLine(x0 + w1 + 12, 172, x0 + w1 + 4, 180);
        }

        // ---- slot (bottom right, under the cassette)
        var si = d.cfg.slots[0] == 20 ? 1 : 0;
        var sl = d.slots[si];
        var sp = G.ease(p * 1.5 - 0.4);
        dc.setColor(G.dim(0x8A8A8A, sp), -1);
        F.px(dc, sl[:lbl] as String, 360, 342, 2, 1, 0);
        dc.setColor(G.dim(d.dcol, sp), -1);
        F.st(dc, sl[:val] as String, 360, 372, 20, 3, 1, 1.0, 0);

        // ---- odometer: weekly bike km, 4 digits + tenths
        odo(dc, d, a);
    }

    hidden function odo(dc as Dc, d as D, a as A) as Void {
        var p = a.intro;
        var acc = d.accent;
        var km = d.wkBike >= 0 ? d.wkBike / 1000.0 : -1.0;
        var v = km >= 0 ? Math.round(km * 10).toNumber() : -1;
        var tw = 26;
        var th = 36;
        var gap = 4;
        var x0 = 227 - (5 * tw + 4 * gap) / 2;
        var y0 = 378;
        for (var i = 0; i < 5; i++) {
            var x = x0 + i * (tw + gap);
            var last = i == 4;
            dc.setColor(last ? G.dim(acc, 0.22) : 0x1C1D20, -1);
            dc.fillRoundedRectangle(x, y0, tw, th, 4);
            var col = last ? acc : 0xF2F2F2;
            if (v < 0) {
                dc.setColor(0x555555, -1);
                dc.fillRectangle(x + 8, y0 + th / 2 - 1, tw - 16, 3);
                continue;
            }
            var dig = (v / POW[i]) % 10;
            // roll: digits spin from 0 up to their value, staggered
            var rp = G.ease(G.stag(p, i, 0.08, 0.6));
            var pos = dig * rp;
            var lo = Math.floor(pos).toNumber();
            var fr = pos - lo;
            dc.setClip(x, y0 + 2, tw, th - 4);
            dc.setColor(col, -1);
            F.st(dc, "" + (lo % 10), x + tw / 2.0, y0 + th / 2.0 - fr * th, 22, 3, 1, 1.0, 0);
            if (fr > 0.01) {
                F.st(dc, "" + ((lo + 1) % 10), x + tw / 2.0, y0 + th / 2.0 + (1 - fr) * th, 22, 3, 1, 1.0, 0);
            }
            dc.clearClip();
        }
        // decimal point + unit
        dc.setColor(acc, -1);
        dc.fillCircle(x0 + 4 * (tw + gap) - gap / 2, y0 + th - 4, 2);
        dc.setColor(0x9A9A9A, -1);
        F.px(dc, "KM", x0 + 5 * (tw + gap) + 2, y0 + th / 2 - 7, 2, 0, 0);
        // weekly goal bar
        var goal = d.cfg.bikeGoal;
        var f = km >= 0 && goal > 0 ? G.clamp(km / goal, 0.0, 1.0) : 0.0;
        var bw = 5 * tw + 4 * gap;
        dc.setColor(0x262626, -1);
        dc.fillRoundedRectangle(x0, y0 + th + 7, bw, 4, 2);
        if (f > 0) {
            dc.setColor(acc, -1);
            var fw = bw * f * G.ease(p * 1.4 - 0.3);
            dc.fillRoundedRectangle(x0, y0 + th + 7, fw < 4 ? 4 : fw, 4, 2);
        }
    }

    function aod(dc as Dc, d as D) as Void {
        var o = St.shift(d);
        var ox = o[0];
        var oy = o[1];
        var cog = hour12(d) - 1;
        var rot = d.m * 6;
        dc.setColor(0x8A8A8A, -1);
        F.st(dc, G.timeStr(d), 227 + ox, 80 + oy, 62, 3, 1, 1.0, 0);
        dc.setPenWidth(1);
        dc.setColor(0x3C3C3C, -1);
        dc.drawCircle(RX + ox, RY + oy, RR);
        dc.drawCircle(RX + ox, RY + oy, RR - 12);
        dc.drawCircle(KX + ox, KY + oy, cogR(0));
        dc.drawCircle(KX + ox, KY + oy, cogR(11));
        dc.setColor(G.dim(d.accent, 0.6), -1);
        dc.setPenWidth(2);
        dc.drawCircle(KX + ox, KY + oy, cogR(cog));
        var cg = chain(cog);
        dc.setPenWidth(1);
        part(dc, cg, 1, 0.0, 1.0, ox, oy);
        part(dc, cg, 3, 0.0, 1.0, ox, oy);
        dc.setPenWidth(3);
        G.tick(dc, RX + ox, RY + oy, 0, RR - 10, rot);
        dc.setColor(0x777777, -1);
        dc.fillCircle(G.ptX(RX + ox, RR - 18, rot), G.ptY(RY + oy, RR - 18, rot), 4);
    }
}
