// DRIVETRAIN — chainring + 12-speed cassette as a clock. Hour = cog (1..12, accent),
// minutes = crank arm angle; the chain runs to the current cog. Weekly bike km on a rolling odometer.
// Styles: 1 Carbon, 2 Chrom, 3 Neon. Mirrors watch/source/faces/Gear.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";

const RX = 180, RY = 262, RR = 98; // chainring
const KX = 354, KY = 262;          // cassette
const CASS = [10, 11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 33];
const NT = 50;
const RAD = Math.PI / 180;
const CV = 0.045; // chain speed px/ms while pedalling

function cogR(i) { return 17 + i * 3.9; }

// chain loop (travel order): ring wrap, bottom run, cog wrap, top run.
// segments stride 7: [type, a, b, c, d, e, len]; type 0 line (a,b)->(c,d); 1 arc centre (a,b) r c, start d, sweep e
function chain(cog) {
  const r1 = RR + 3, r2 = cogR(cog) + 3;
  const D = KX - RX;
  const al = Math.asin((r1 - r2) / D) / RAD;
  const g = [];
  let l = r1 * (180 + 2 * al) * RAD;
  g.push(1, RX, RY, r1, 360 + al, -(180 + 2 * al), l);
  const b0x = G.ptX(RX, r1, 180 - al), b0y = G.ptY(RY, r1, 180 - al);
  const b1x = G.ptX(KX, r2, 180 - al), b1y = G.ptY(KY, r2, 180 - al);
  g.push(0, b0x, b0y, b1x, b1y, 0, Math.sqrt((b1x - b0x) * (b1x - b0x) + (b1y - b0y) * (b1y - b0y)));
  l = r2 * (180 - 2 * al) * RAD;
  g.push(1, KX, KY, r2, 180 - al, -(180 - 2 * al), l);
  const t0x = G.ptX(KX, r2, al), t0y = G.ptY(KY, r2, al);
  const t1x = G.ptX(RX, r1, al), t1y = G.ptY(RY, r1, al);
  g.push(0, t0x, t0y, t1x, t1y, 0, Math.sqrt((t1x - t0x) * (t1x - t0x) + (t1y - t0y) * (t1y - t0y)));
  return g;
}

function part(dc, g, k, t0, t1, ox, oy) {
  const i = k * 7;
  if (g[i] === 0) {
    dc.drawLine(G.lerp(g[i + 1], g[i + 3], t0) + ox, G.lerp(g[i + 2], g[i + 4], t0) + oy, G.lerp(g[i + 1], g[i + 3], t1) + ox, G.lerp(g[i + 2], g[i + 4], t1) + oy);
  } else {
    const a = g[i + 4] + g[i + 5] * t0, b = g[i + 4] + g[i + 5] * t1;
    G.arcC(dc, g[i + 1] + ox, g[i + 2] + oy, g[i + 3], Math.min(a, b), Math.max(a, b));
  }
}

function chainLen(g) { return g[6] + g[13] + g[20] + g[27]; }

// dashes (links) along the loop, [s0,s1] visible window
function links(dc, g, off, P, Dl, s1) {
  const L = chainLen(g);
  let s = -(off % P);
  let k = 0, acc = 0;
  for (; s < Math.min(L, s1); s += P) {
    const a = Math.max(s, 0), b = Math.min(s + Dl, L, s1);
    if (b <= a) continue;
    while (k < 3 && acc + g[k * 7 + 6] <= a) { acc += g[k * 7 + 6]; k++; }
    const ln = g[k * 7 + 6];
    part(dc, g, k, (a - acc) / ln, G.clamp((b - acc) / ln, 0, 1), 0, 0);
  }
}

// n radial lines r1..r2 starting at clock angle a0 (incremental rotation, no per-tooth trig)
function teeth(dc, cx, cy, r1, r2, n, a0) {
  const stp = (2 * Math.PI) / n, cs = Math.cos(stp), sn = Math.sin(stp);
  let x = Math.sin(a0 * RAD), y = -Math.cos(a0 * RAD);
  for (let i = 0; i < n; i++) {
    dc.drawLine(cx + x * r1, cy + y * r1, cx + x * r2, cy + y * r2);
    const nx = x * cs - y * sn;
    y = x * sn + y * cs;
    x = nx;
  }
}

function hour12(d) { return d.h % 12 === 0 ? 12 : d.h % 12; }

export default {
  fps: 15,

  // static layer: cached, redrawn when the minute changes
  bgKey(d) { return d.doy * 1440 + d.mins; },

  draw(dc, d, a) {
    const st = d.cfg.style;
    const acc = d.accent;
    const p = a.intro;
    const neon = st === 3, chrom = st === 2;
    const h12 = hour12(d);
    const cog = h12 - 1;
    const mDeg = d.m * 6;
    // ring assembly rotation (spring into place) and pedalling teeth phase
    const rot = mDeg - (1 - G.spring(p)) * 140;
    const tph = a.live ? -(a.t * CV / RR) / RAD : 0;

    // palette
    const cBody = neon ? -1 : chrom ? 0x8d9299 : 0x2b2d31;
    const cTooth = neon ? G.dim(acc, 0.85) : chrom ? 0xb9bec5 : 0x3c3f44;
    const cCog = neon ? G.dim(acc, 0.45) : chrom ? 0x80858c : 0x3a3c40;
    const cHi = chrom ? 0xf2f4f7 : 0x55585e;

    if (!a.bg) {
      // ---- time + date
      dc.setColor(0x8a8a8a, -1);
      F.px(dc, d.dowStr + " " + d.day + ". " + d.monStr, 227, 20, 2, 1, 0);
      dc.setColor(0xffffff, -1);
      F.st(dc, G.timeStr(d), 227, 76, 62, 7, 1, G.easeInOut(p * 1.3), 0);

      // ---- minute index ring around the chainring
      const ip = G.ease(p * 1.6);
      dc.setPenWidth(2);
      for (let i = 0; i < 12; i++) {
        if (i / 12 > ip) break;
        dc.setColor(i === 0 ? 0x9a9a9a : 0x4a4a4a, -1);
        G.tick(dc, RX, RY, RR + 13, RR + (i % 3 === 0 ? 21 : 17), i * 30);
      }

      // ---- cassette
      if (!neon) {
        dc.setColor(chrom ? 0x1a1b1d : 0x0f1012, -1);
        dc.fillCircle(KX, KY, cogR(11) + 3);
      }
      for (let i = 0; i < 12; i++) {
        const r = cogR(i);
        const on = i === cog;
        if (on) continue;
        dc.setPenWidth(neon ? 1 : 2);
        dc.setColor(G.dim(cCog, (i % 2 === 0 ? 0.6 : 0.85) + 0.15 * i / 11), -1);
        dc.drawCircle(KX, KY, r);
      }
    }
    if (a.so) return;
    // highlighted cog with its real teeth
    {
      const r = cogR(cog), n = CASS[cog];
      if (!neon) {
        dc.setColor(G.dim(acc, 0.3), -1);
        dc.setPenWidth(5);
        dc.drawCircle(KX, KY, r - 1);
      }
      dc.setColor(acc, -1);
      dc.setPenWidth(3);
      dc.drawCircle(KX, KY, r);
      dc.setPenWidth(3);
      const cph = a.live ? -(a.t * CV / (r + 3)) / RAD : 0;
      teeth(dc, KX, KY, r, r + 4, n, cph);
    }
    if (chrom) {
      dc.setColor(0xe6e9ed, -1);
      dc.setPenWidth(2);
      G.arcC(dc, KX, KY, cogR(11) + 1, 290, 340);
    }
    // lockring
    dc.setColor(neon ? acc : chrom ? 0xc9cdd2 : 0x4a4d52, -1);
    dc.setPenWidth(2);
    dc.drawCircle(KX, KY, 9);
    dc.fillCircle(KX, KY, 4);

    // ---- chain
    const cg = chain(cog);
    const L = chainLen(cg);
    const cp = G.ease(G.clamp((p - 0.1) / 0.6, 0, 1));
    const off = a.t * CV;
    if (cp > 0) {
      const vis = L * cp;
      let acc0 = 0;
      dc.setColor(neon ? G.dim(acc, 0.25) : chrom ? 0x3b3e43 : G.dim(acc, 0.35), -1);
      dc.setPenWidth(neon ? 7 : 8);
      for (let k = 0; k < 4; k++) {
        const ln = cg[k * 7 + 6];
        if (acc0 < vis) part(dc, cg, k, 0, G.clamp((vis - acc0) / ln, 0, 1), 0, 0);
        acc0 += ln;
      }
      dc.setColor(neon ? acc : chrom ? 0xdfe2e6 : acc, -1);
      dc.setPenWidth(neon ? 3 : 5);
      links(dc, cg, off, 10, 6, vis);
    }

    // ---- chainring
    const tr = rot + tph;
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
    if (st === 1) {
      // carbon weave hint on the ring band
      dc.setPenWidth(4);
      dc.setColor(0x3c3f45, -1);
      for (let i = 0; i < 12; i++) {
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
      dc.setColor(0x4b4f55, -1);
      G.arcC(dc, RX, RY, RR - 1, 110, 170);
    }
    // spider: 5 arms
    for (let i = 0; i < 5; i++) {
      const ang = rot + 36 + i * 72;
      if (neon) {
        dc.setColor(acc, -1);
        dc.setPenWidth(2);
        const s = Math.sin(ang * RAD), c = Math.cos(ang * RAD);
        dc.drawLine(RX + c * 6 + s * 16, RY + s * 6 - c * 16, RX + c * 4 + s * (RR - 12), RY + s * 4 - c * (RR - 12));
        dc.drawLine(RX - c * 6 + s * 16, RY - s * 6 - c * 16, RX - c * 4 + s * (RR - 12), RY - s * 4 - c * (RR - 12));
      } else {
        dc.setColor(chrom ? 0x9fa4ab : 0x34373c, -1);
        G.hand(dc, RX, RY, ang, RR - 8, 0, 18, 10);
        if (chrom) {
          dc.setColor(0xe4e7eb, -1);
          dc.setPenWidth(1);
          G.tick(dc, RX, RY, 22, RR - 12, ang - 3);
        }
      }
      // chainring bolt
      dc.setColor(neon ? acc : chrom ? 0xd5d8dc : 0x5a5d62, -1);
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
      dc.setColor(chrom ? 0xc3c7cd : 0x2a2c30, -1);
      G.hand(dc, RX, RY, rot, RR - 6, 14, 26, 18);
      dc.setColor(chrom ? 0xf5f6f8 : 0x50545a, -1);
      dc.setPenWidth(2);
      G.tick(dc, RX, RY, 6, RR - 14, rot - 4);
      if (st === 1) {
        // carbon weave on the crank: short alternating slashes
        dc.setPenWidth(2);
        for (let k = 0; k < 7; k++) {
          const rr = 14 + k * 9;
          dc.setColor(k % 2 === 0 ? 0x3a3d43 : 0x18191b, -1);
          G.tick(dc, G.ptX(RX, rr, rot), G.ptY(RY, rr, rot), -6, 6, rot + 90 + (k % 2 === 0 ? 30 : -30));
        }
      }
    }
    // hub + pedal axle
    dc.setColor(neon ? 0x000000 : chrom ? 0x7a7f86 : 0x0c0c0d, -1);
    dc.fillCircle(RX, RY, 15);
    dc.setColor(neon ? acc : chrom ? 0xe8ebef : 0x4d5056, -1);
    dc.setPenWidth(2);
    dc.drawCircle(RX, RY, 15);
    dc.fillCircle(RX, RY, 5);
    const px = G.ptX(RX, RR - 18, rot), py = G.ptY(RY, RR - 18, rot);
    dc.setColor(acc, -1);
    dc.fillCircle(px, py, 9);
    dc.setColor(0x000000, -1);
    dc.fillCircle(px, py, 4);
    // minute pointer outside the teeth
    dc.setColor(acc, -1);
    const pa = rot;
    dc.fillPolygon([
      [G.ptX(RX, RR + 7, pa), G.ptY(RY, RR + 7, pa)],
      [G.ptX(RX, RR + 19, pa - 4.5), G.ptY(RY, RR + 19, pa - 4.5)],
      [G.ptX(RX, RR + 19, pa + 4.5), G.ptY(RY, RR + 19, pa + 4.5)],
    ]);

    // ---- gear readout above the cassette: GANG n / 50x17
    const gp = G.ease(p * 1.5 - 0.3);
    if (gp > 0) {
      dc.setColor(G.dim(0x8a8a8a, gp), -1);
      F.px(dc, "GANG " + h12, KX + 4, 142, 2, 1, 0);
      const t1 = "50", t2 = "" + CASS[cog];
      const w1 = F.stW(t1, 22), w2 = F.stW(t2, 22);
      const x0 = KX + 4 - (w1 + w2 + 16) / 2;
      dc.setColor(G.dim(0xffffff, gp), -1);
      F.st(dc, t1, x0, 176, 22, 3, 0, 1.0, 0);
      dc.setColor(G.dim(acc, gp), -1);
      F.st(dc, t2, x0 + w1 + 16, 176, 22, 3, 0, 1.0, 0);
      dc.setPenWidth(2);
      dc.drawLine(x0 + w1 + 4, 172, x0 + w1 + 12, 180);
      dc.drawLine(x0 + w1 + 12, 172, x0 + w1 + 4, 180);
    }

    // ---- slot (bottom right, under the cassette)
    const si = d.cfg.slots[0] === 20 ? 1 : 0;
    const sl = d.slots[si];
    const sp = G.ease(p * 1.5 - 0.4);
    dc.setColor(G.dim(0x8a8a8a, sp), -1);
    F.px(dc, sl.lbl, 360, 342, 2, 1, 0);
    dc.setColor(G.dim(d.dcol, sp), -1);
    F.st(dc, sl.val, 360, 372, 20, 3, 1, 1.0, 0);

    // ---- odometer: weekly bike km, 4 digits + tenths
    this.odo(dc, d, a);
  },

  odo(dc, d, a) {
    const p = a.intro;
    const acc = d.accent;
    const km = d.wkBike >= 0 ? d.wkBike / 1000 : -1;
    const v = km >= 0 ? Math.round(km * 10) : -1;
    const tw = 26, th = 36, gap = 4;
    const x0 = 227 - (5 * tw + 4 * gap) / 2, y0 = 378;
    for (let i = 0; i < 5; i++) {
      const x = x0 + i * (tw + gap);
      const last = i === 4;
      dc.setColor(last ? G.dim(acc, 0.22) : 0x1c1d20, -1);
      dc.fillRoundedRectangle(x, y0, tw, th, 4);
      const col = last ? acc : 0xf2f2f2;
      if (v < 0) {
        dc.setColor(0x555555, -1);
        dc.fillRectangle(x + 8, y0 + th / 2 - 1, tw - 16, 3);
        continue;
      }
      const dig = Math.floor(v / Math.pow(10, 4 - i)) % 10;
      // roll: digits spin from 0 up to their value, staggered
      const rp = G.ease(G.stag(p, i, 0.08, 0.6));
      const pos = dig * rp + (1 - rp) * 0;
      const lo = Math.floor(pos), fr = pos - lo;
      dc.setClip(x, y0 + 2, tw, th - 4);
      dc.setColor(col, -1);
      F.st(dc, "" + (lo % 10), x + tw / 2, y0 + th / 2 - fr * th, 22, 3, 1, 1.0, 0);
      if (fr > 0.01) F.st(dc, "" + ((lo + 1) % 10), x + tw / 2, y0 + th / 2 + (1 - fr) * th, 22, 3, 1, 1.0, 0);
      dc.clearClip();
    }
    // decimal point + unit
    dc.setColor(acc, -1);
    dc.fillCircle(x0 + 4 * (tw + gap) - gap / 2, y0 + th - 4, 2);
    dc.setColor(0x9a9a9a, -1);
    F.px(dc, "KM", x0 + 5 * (tw + gap) + 2, y0 + th / 2 - 7, 2, 0, 0);
    // weekly goal bar
    const goal = d.cfg.bikeGoal;
    const f = km >= 0 && goal > 0 ? G.clamp(km / goal, 0, 1) : 0;
    const bw = 5 * tw + 4 * gap;
    dc.setColor(0x262626, -1);
    dc.fillRoundedRectangle(x0, y0 + th + 7, bw, 4, 2);
    if (f > 0) {
      dc.setColor(acc, -1);
      dc.fillRoundedRectangle(x0, y0 + th + 7, Math.max(4, bw * f * G.ease(p * 1.4 - 0.3)), 4, 2);
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const ox = o[0], oy = o[1];
    const cog = hour12(d) - 1;
    const rot = d.m * 6;
    dc.setColor(0x8a8a8a, -1);
    F.st(dc, G.timeStr(d), 227 + ox, 80 + oy, 62, 3, 1, 1.0, 0);
    dc.setPenWidth(1);
    dc.setColor(0x3c3c3c, -1);
    dc.drawCircle(RX + ox, RY + oy, RR);
    dc.drawCircle(RX + ox, RY + oy, RR - 12);
    dc.drawCircle(KX + ox, KY + oy, cogR(0));
    dc.drawCircle(KX + ox, KY + oy, cogR(11));
    dc.setColor(G.dim(d.accent, 0.6), -1);
    dc.setPenWidth(2);
    dc.drawCircle(KX + ox, KY + oy, cogR(cog));
    const cg = chain(cog);
    dc.setPenWidth(1);
    part(dc, cg, 1, 0, 1, ox, oy);
    part(dc, cg, 3, 0, 1, ox, oy);
    dc.setPenWidth(3);
    G.tick(dc, RX + ox, RY + oy, 0, RR - 10, rot);
    dc.setColor(0x777777, -1);
    dc.fillCircle(G.ptX(RX + ox, RR - 18, rot), G.ptY(RY + oy, RR - 18, rot), 4);
  },
};
