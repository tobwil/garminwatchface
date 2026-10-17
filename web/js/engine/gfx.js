// G — shared drawing & math helpers. Mirrors watch/source/Gfx.mc 1:1.
// Clock angles: 0 = 12 o'clock, clockwise, in degrees.
import { ARC_CW } from "./dc.js";

const RAD = Math.PI / 180;

export const G = {
  clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  ease(t) { t = G.clamp(t, 0, 1); const u = 1 - t; return 1 - u * u * u; },
  easeInOut(t) { t = G.clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  // overshooting ease ("back out")
  spring(t) { t = G.clamp(t, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  // 0..1 staggered sub-progress: element i of n starting at i*step
  stag(p, i, step, dur) { return G.clamp((p - i * step) / dur, 0, 1); },

  ptX(cx, r, deg) { return cx + r * Math.sin(deg * RAD); },
  ptY(cy, r, deg) { return cy - r * Math.cos(deg * RAD); },

  // Arc in clock degrees from a0 to a1 (clockwise, a1 > a0).
  arcC(dc, cx, cy, r, a0, a1) {
    if (a1 - a0 >= 359.9) { dc.drawCircle(cx, cy, r); return; }
    if (a1 - a0 < 0.4) return;
    // whole degrees, normalised, like the watch (see Gfx.mc)
    const s = Math.round(90 - a0), e = Math.round(90 - a1);
    if (s === e) return;
    dc.drawArc(cx, cy, r, ARC_CW, ((s % 360) + 360) % 360, ((e % 360) + 360) % 360);
  },

  // Progress ring from 12 o'clock (or `start`) clockwise. Rounded caps.
  ring(dc, cx, cy, r, w, frac, col, track) {
    frac = G.clamp(frac, 0, 1);
    dc.setPenWidth(w);
    if (track !== -1) { dc.setColor(track, -1); dc.drawCircle(cx, cy, r); }
    if (frac <= 0.001) return;
    dc.setColor(col, -1);
    G.arcC(dc, cx, cy, r, 0, frac * 360);
    if (frac < 0.999) {
      dc.fillCircle(cx, cy - r, w / 2);
      dc.fillCircle(G.ptX(cx, r, frac * 360), G.ptY(cy, r, frac * 360), w / 2);
    }
  },

  // Rounded arc segment between clock angles with caps.
  capArc(dc, cx, cy, r, w, a0, a1) {
    if (a1 - a0 < 0.4) return;
    dc.setPenWidth(w);
    G.arcC(dc, cx, cy, r, a0, a1);
    dc.fillCircle(G.ptX(cx, r, a0), G.ptY(cy, r, a0), w / 2);
    dc.fillCircle(G.ptX(cx, r, a1), G.ptY(cy, r, a1), w / 2);
  },

  tick(dc, cx, cy, r1, r2, deg) {
    dc.drawLine(G.ptX(cx, r1, deg), G.ptY(cy, r1, deg), G.ptX(cx, r2, deg), G.ptY(cy, r2, deg));
  },

  // Tapered hand polygon. len forward, back behind centre, w base width, tip width tw.
  hand(dc, cx, cy, deg, len, back, w, tw) {
    const s = Math.sin(deg * RAD), c = Math.cos(deg * RAD);
    const px = c, py = s; // perpendicular
    const tx = cx + s * len, ty = cy - c * len;
    const bx = cx - s * back, by = cy + c * back;
    dc.fillPolygon([
      [bx - px * w / 2, by - py * w / 2],
      [tx - px * tw / 2, ty - py * tw / 2],
      [tx + px * tw / 2, ty + py * tw / 2],
      [bx + px * w / 2, by + py * w / 2],
    ]);
  },

  // ---- colour
  rgb(r, g, b) { return ((G.clamp(r | 0, 0, 255) << 16) | (G.clamp(g | 0, 0, 255) << 8) | G.clamp(b | 0, 0, 255)); },
  mix(c1, c2, t) {
    t = G.clamp(t, 0, 1);
    const r = ((c1 >> 16) & 255) + ((((c2 >> 16) & 255) - ((c1 >> 16) & 255)) * t);
    const g = ((c1 >> 8) & 255) + ((((c2 >> 8) & 255) - ((c1 >> 8) & 255)) * t);
    const b = (c1 & 255) + (((c2 & 255) - (c1 & 255)) * t);
    return G.rgb(r, g, b);
  },
  dim(c, f) { return G.mix(0, c, f); },
  // alpha colour (a: 0..254). Use sparingly; degrades to opaque on devices without blending.
  argb(a, c) { return (((G.clamp(a | 0, 1, 254) << 24) | (c & 0xffffff)) >>> 0) | 0; },
  hsv(h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return G.rgb((r + m) * 255, (g + m) * 255, (b + m) * 255);
  },

  // ---- deterministic randomness (Park–Miller)
  rnd(seed) { const s = seed % 2147483647; return (Math.abs(s === 0 ? 1 : s) * 16807) % 2147483647; },
  rf(seed) { return seed / 2147483647; },
  // smooth pseudo-noise in [-1,1]
  noise(x) { return (Math.sin(x * 1.7) + Math.sin(x * 3.1 + 1.3) * 0.5 + Math.sin(x * 5.3 + 4.1) * 0.25) / 1.75; },

  // ---- formatting
  pad2(n) { n = Math.floor(n); return n < 10 ? "0" + n : "" + n; },
  // German thousands separator
  num(n) {
    n = Math.round(n);
    const neg = n < 0; n = Math.abs(n);
    let s = "" + n, out = "";
    while (s.length > 3) { out = "." + s.substring(s.length - 3) + out; s = s.substring(0, s.length - 3); }
    return (neg ? "-" : "") + s + out;
  },
  hm(min) { min = Math.max(0, Math.round(min)); return Math.floor(min / 60) + ":" + G.pad2(min % 60); },
  // race time seconds -> "h:mm:ss" or "mm:ss"
  race(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h > 0 ? h + ":" + G.pad2(m) + ":" + G.pad2(s) : m + ":" + G.pad2(s);
  },
  fix1(v) { return v.toFixed(1); },
  hour(d) { return d.is24 ? d.h : (d.h % 12 === 0 ? 12 : d.h % 12); },
  timeStr(d) { return (d.is24 ? G.pad2(d.h) : "" + G.hour(d)) + ":" + G.pad2(d.m); },
};
