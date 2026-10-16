// F — procedural fonts (stroke / pixel / segment). Mirrors watch/source/Fonts.mc.
import { FONTDATA as FD } from "./fontdata.js";

const GAP = 22; // inter-glyph gap in quarter units (5.5 units)

function glyph(code, map) {
  if (code > 255) return -1;
  return map[code] - 1;
}

function strokeAdvance(code) {
  const i = glyph(code, FD.strokeMap);
  if (i < 0) return 20 + GAP;
  return FD.strokeW[i] + GAP;
}

export const F = {
  // Width of stroke text with cap height h (px).
  stW(txt, h) {
    let w = 0;
    for (let k = 0; k < txt.length; k++) w += strokeAdvance(txt.toUpperCase().charCodeAt(k));
    if (txt.length > 0) w -= GAP;
    return (w * h) / 80;
  },

  // Stroke text, vertically centred on y. just: 0 left, 1 centre, 2 right.
  // prog in 0..1 draws the text partially (write-on animation). slant: italic shear.
  st(dc, txt, x, y, h, pen, just, prog, slant) {
    txt = txt.toUpperCase();
    const s = h / 80; // quarter-units -> px
    const w = F.stW(txt, h);
    let ox = just === 1 ? x - w / 2 : just === 2 ? x - w : x;
    const oy = y - (h / 2) - 24 * s; // y byte offset: (gy+6)*4
    const r = pen / 2;
    let budget = Infinity;
    if (prog < 1) {
      let total = 0;
      for (let k = 0; k < txt.length; k++) total += F._glyphLen(txt.charCodeAt(k));
      budget = Math.max(0, prog) * total;
      if (budget <= 0) return w;
    }
    const big = pen >= 3;
    dc.setPenWidth(pen);
    for (let k = 0; k < txt.length && budget > 0; k++) {
      const code = txt.charCodeAt(k);
      const gi = glyph(code, FD.strokeMap);
      if (gi >= 0) {
        const a = FD.strokeOffs[gi], b = FD.strokeOffs[gi + 1];
        let px = null, py = null, lgx = 0, lgy = 0, single = true;
        for (let i = a; i < b && budget > 0; i += 2) {
          const xb = FD.strokeData[i];
          if (xb === 255) {
            if (single && px !== null) dc.fillCircle(px, py, pen * 0.72);
            px = null; single = true; i -= 1; continue;
          }
          const gx = xb & 127, gy = FD.strokeData[i + 1];
          const nx = ox + gx * s + (slant ? (80 - gy) * s * slant : 0);
          const ny = oy + gy * s;
          if (px !== null) {
            single = false;
            const seg = Math.hypot(gx - lgx, gy - lgy);
            let tx = nx, ty = ny;
            if (seg > budget) { const f = budget / seg; tx = px + (nx - px) * f; ty = py + (ny - py) * f; }
            budget -= seg;
            dc.drawLine(px, py, tx, ty);
            if (big && (xb & 128 || budget < 0)) dc.fillCircle(tx, ty, r);
          } else if (big && i + 2 < b && FD.strokeData[i + 2] !== 255) {
            dc.fillCircle(nx, ny, r);
          }
          px = nx; py = ny; lgx = gx; lgy = gy;
        }
        if (single && px !== null && budget > 0) dc.fillCircle(px, py, pen * 0.72);
        ox += (FD.strokeW[gi] + GAP) * s;
      } else {
        ox += (20 + GAP) * s;
      }
    }
    return w;
  },

  _glyphLen(code) {
    const gi = glyph(code, FD.strokeMap);
    if (gi < 0) return 0;
    let len = 0;
    const a = FD.strokeOffs[gi], b = FD.strokeOffs[gi + 1];
    let px = -1, py = -1;
    for (let i = a; i < b; i += 2) {
      if (FD.strokeData[i] === 255) { px = -1; i -= 1; continue; }
      const gx = FD.strokeData[i] & 127;
      if (px >= 0) len += Math.hypot(gx - px, FD.strokeData[i + 1] - py);
      px = gx; py = FD.strokeData[i + 1];
    }
    return len;
  },

  // 5x7 dot-matrix text. y = top. sc = pixel size. gap = spacing inside a dot cell.
  pxW(txt, sc) { return txt.length > 0 ? txt.length * 6 * sc - sc : 0; },
  px(dc, txt, x, y, sc, just, gap) {
    const w = F.pxW(txt, sc);
    let ox = just === 1 ? x - w / 2 : just === 2 ? x - w : x;
    ox = Math.round(ox);
    const d = sc - gap;
    for (let k = 0; k < txt.length; k++) {
      const gi = glyph(txt.charCodeAt(k), FD.pxMap);
      if (gi >= 0) {
        for (let row = 0; row < 7; row++) {
          const bits = FD.pxData[gi * 7 + row];
          if (bits === 0) continue;
          if (gap === 0) {
            // merge horizontal runs of dots into one rectangle (fewer draw calls)
            let col = 0;
            while (col < 5) {
              if (bits & (16 >> col)) {
                let end = col + 1;
                while (end < 5 && (bits & (16 >> end))) end++;
                dc.fillRectangle(ox + col * sc, y + row * sc, (end - col) * sc, sc);
                col = end;
              } else col++;
            }
          } else {
            for (let col = 0; col < 5; col++) {
              if (bits & (16 >> col)) dc.fillRectangle(ox + col * sc, y + row * sc, d, d);
            }
          }
        }
      }
      ox += 6 * sc;
    }
    return w;
  },

  // Seven segment text. y = top, h = digit height, th = segment thickness.
  // Lit segments use the current colour; off segments use offCol (-1 = none).
  segW(txt, h) {
    let w = 0;
    for (let k = 0; k < txt.length; k++) w += (txt[k] === ":" || txt[k] === ".") ? h * 0.22 : h * 0.62;
    return w - h * 0.1;
  },
  seg(dc, txt, x, y, h, th, just, onCol, offCol) {
    txt = txt.toUpperCase();
    const w = F.segW(txt, h);
    let ox = just === 1 ? x - w / 2 : just === 2 ? x - w : x;
    for (let k = 0; k < txt.length; k++) {
      const ch = txt[k];
      if (ch === ":" || ch === ".") {
        dc.setColor(onCol, -1);
        const r = th * 0.6;
        if (ch === ":") { dc.fillCircle(ox + h * 0.06, y + h * 0.3, r); dc.fillCircle(ox + h * 0.06, y + h * 0.7, r); }
        else dc.fillCircle(ox + h * 0.06, y + h - r, r);
        ox += h * 0.22;
        continue;
      }
      const gi = glyph(ch.charCodeAt(0), FD.segMap);
      const m = gi >= 0 ? FD.segData[gi] : 0;
      F._digit(dc, ox, y, h * 0.52, h, th, m, onCol, offCol);
      ox += h * 0.62;
    }
    return w;
  },
  _digit(dc, x, y, w, h, t, m, on, off) {
    const t2 = t / 2, g = t * 0.18, hm = y + h / 2;
    // segment polygons (horizontal: a,g,d ; vertical: b,c,e,f)
    const hs = (yy) => [[x + t2 + g, yy], [x + t + g, yy - t2], [x + w - t - g, yy - t2], [x + w - t2 - g, yy], [x + w - t - g, yy + t2], [x + t + g, yy + t2]];
    const vs = (xx, y0, y1) => [[xx, y0 + t2 + g], [xx + t2, y0 + t + g], [xx + t2, y1 - t - g], [xx, y1 - t2 - g], [xx - t2, y1 - t - g], [xx - t2, y0 + t + g]];
    const segs = [hs(y + t2), vs(x + w - t2, y + t2, hm), vs(x + w - t2, hm, y + h - t2), hs(y + h - t2), vs(x + t2, hm, y + h - t2), vs(x + t2, y + t2, hm), hs(hm)];
    for (let i = 0; i < 7; i++) {
      const lit = (m >> i) & 1;
      if (!lit && off === -1) continue;
      dc.setColor(lit ? on : off, -1);
      dc.fillPolygon(segs[i]);
    }
  },
};
