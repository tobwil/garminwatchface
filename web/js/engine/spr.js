// SPR — palette-indexed pixel sprites. Mirrors watch/source/Spr.mc.
// A sprite definition is { w, h, rows: ["..1122..", ...] }: '.' = transparent,
// '0'-'9' and 'a'-'z' = palette index 0..35. Encoded form (shared with the watch,
// see tools/spritegen.mjs): [w, h, px0, px1, ...] with 255 = transparent.

const IDX = "0123456789abcdefghijklmnopqrstuvwxyz";

export function encodeSprite(def) {
  const out = new Uint8Array(2 + def.w * def.h);
  out[0] = def.w;
  out[1] = def.h;
  for (let y = 0; y < def.h; y++) {
    const row = def.rows[y] || "";
    for (let x = 0; x < def.w; x++) {
      const c = row[x] || ".";
      const i = IDX.indexOf(c);
      out[2 + y * def.w + x] = i < 0 ? 255 : i;
    }
  }
  return out;
}

// Encode every sprite of a sprite module once ({name: def} -> {name: Uint8Array}).
export function encodeAll(mod) {
  const out = {};
  for (const k of Object.keys(mod)) out[k] = encodeSprite(mod[k]);
  return out;
}

export const SPR = {
  // Draw sprite s at (x, y) (top-left) with pixel size sc. pal = array of colours
  // (index -> 0xRRGGBB, -1 skips that index). flip = mirror horizontally.
  draw(dc, s, x, y, sc, pal, flip) {
    const w = s[0], h = s[1];
    for (let row = 0; row < h; row++) {
      const base = 2 + row * w;
      let col = 0;
      while (col < w) {
        const v = s[base + (flip ? w - 1 - col : col)];
        let end = col + 1;
        while (end < w && s[base + (flip ? w - 1 - end : end)] === v) end++;
        if (v !== 255) {
          const c = pal[v];
          if (c !== undefined && c !== -1) {
            dc.setColor(c, -1);
            dc.fillRectangle(x + col * sc, y + row * sc, (end - col) * sc, sc);
          }
        }
        col = end;
      }
    }
  },
  w(s, sc) { return s[0] * sc; },
  h(s, sc) { return s[1] * sc; },
};
