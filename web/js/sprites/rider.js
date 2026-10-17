// Sprites for RIDER ("Pixel Rider"). Drawn at 4 px per sprite pixel.
// Rider palette indices:
//  0 tyre/outline  1 jersey  2 skin (near leg, arms)  3 helmet  4 bike frame  5 shorts
//  6 rims/spokes   7 jersey shade  8 far leg (darker)  9 shoes  a saddle/bar tape
// The four rider frames are composed below from a body template, two wheel states
// (spokes "+" / "x") and four crank positions (near leg + far leg, half a turn apart).

const W = 20, H = 16;

function blank(w, h) {
  const g = [];
  for (let y = 0; y < h; y++) g.push(new Array(w).fill("."));
  return g;
}
function stamp(g, rows, ox, oy) {
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const c = rows[y][x];
      if (c !== "." && g[oy + y] && oy + y >= 0 && ox + x >= 0 && ox + x < g[0].length) g[oy + y][ox + x] = c;
    }
}
function put(g, x, y, c) { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; }
function line(g, x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx - dy;
  for (;;) {
    put(g, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 > -dy) { e -= dy; x0 += sx; }
    if (e2 < dx) { e += dx; y0 += sy; }
  }
}
const rows = (g) => g.map((r) => r.join(""));

const WHEEL = [
  "..000..",
  ".0...0.",
  "0.....0",
  "0.....0",
  "0.....0",
  ".0...0.",
  "..000..",
];
const SPOKE_A = [
  ".......",
  "...6...",
  "...6...",
  ".66666.",
  "...6...",
  "...6...",
  ".......",
];
const SPOKE_B = [
  ".......",
  ".......",
  "..6.6..",
  "...6...",
  "..6.6..",
  ".......",
  ".......",
];
// frame + body (no legs, no wheels)
const BODY = [
  "....................",
  ".............333....",
  "............33333...",
  ".........1111322....",
  ".......111111112....",
  "......7777777.1.....",
  "......5555.....2....",
  "......aaa.....4aa...",
  ".......444444.4.a...",
  ".......4......4.....",
  "......4.4......4....",
  ".....4...4......4...",
  "....4444444......4..",
  "....................",
  "....................",
  "....................",
];
// crank: bottom bracket (9,12), pedal positions for frames 0..3 (front, down, back, up)
const BB = [9, 12];
const PED = [[11, 12], [9, 14], [7, 12], [9, 10]];
const KNEE = [[11, 8], [10, 9], [10, 8], [11, 7]];
const HIP = [8, 6];

function leg(g, k, skin, shorts) {
  const kn = KNEE[k], pd = PED[k];
  line(g, HIP[0], HIP[1], kn[0], kn[1], shorts);
  line(g, kn[0], kn[1], pd[0], pd[1] - 1, skin);
  put(g, kn[0], kn[1], skin);
  put(g, pd[0] - 1, pd[1], "9");
  put(g, pd[0], pd[1], "9");
}

function frame(k) {
  const g = blank(W, H);
  stamp(g, WHEEL, 0, 9);
  stamp(g, WHEEL, 13, 9);
  const sp = k % 2 === 0 ? SPOKE_A : SPOKE_B;
  stamp(g, sp, 0, 9);
  stamp(g, sp, 13, 9);
  leg(g, (k + 2) % 4, "8", "5");
  stamp(g, BODY, 0, 0);
  // crank arm towards the near pedal
  put(g, BB[0], BB[1], "0");
  leg(g, k, "2", "5");
  return { w: W, h: H, rows: rows(g) };
}

const F0 = frame(0), F1 = frame(1), F2 = frame(2), F3 = frame(3);

// neon glow: union of all frames, dilated by one pixel (single palette index 0)
function glow() {
  const g = blank(W + 2, H + 2);
  for (const f of [F0, F1, F2, F3])
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (f.rows[y][x] !== ".")
          for (let dy = 0; dy <= 2; dy++) for (let dx = 0; dx <= 2; dx++) if (dx === 1 || dy === 1) put(g, x + dx, y + dy, "0");
  return { w: W + 2, h: H + 2, rows: rows(g) };
}

export default {
  RIDER_0: F0,
  RIDER_1: F1,
  RIDER_2: F2,
  RIDER_3: F3,
  RIDER_GLOW: glow(),
  // 0 rim/edge, 1 face, 2 highlight
  SUN: {
    w: 8, h: 8, rows: [
      "..0000..",
      ".011110.",
      "01122110",
      "01211110",
      "01111110",
      "01111110",
      ".011110.",
      "..0000..",
    ],
  },
  // 0 lit face, 1 crater
  MOON: {
    w: 7, h: 7, rows: [
      "..000..",
      ".00010.",
      "0100000",
      "0000110",
      "0010000",
      ".00000.",
      "..000..",
    ],
  },
  // shadow mask for the moon phase (0 = dark part), crescent
  MOON_C: {
    w: 7, h: 7, rows: [
      "..00...",
      ".00....",
      "000....",
      "000....",
      "000....",
      ".00....",
      "..00...",
    ],
  },
  // 0 fill, 1 shade
  CLOUD_A: {
    w: 14, h: 5, rows: [
      ".....000......",
      "...0000000.00.",
      ".000000000000.",
      "00000000000000",
      ".111111111111.",
    ],
  },
  CLOUD_B: {
    w: 9, h: 4, rows: [
      "...000...",
      ".0000000.",
      "000000000",
      ".1111111.",
    ],
  },
  // 0 needles, 1 needles light, 2 trunk
  PINE: {
    w: 5, h: 8, rows: [
      "..0..",
      "..0..",
      ".010.",
      ".000.",
      "01000",
      "00000",
      "..2..",
      "..2..",
    ],
  },
  // HUD: finish flag (0 pole, 1 dark, 2 light)
  FLAG: {
    w: 6, h: 9, rows: [
      "012121",
      "021212",
      "012121",
      "021212",
      "0.....",
      "0.....",
      "0.....",
      "0.....",
      "0.....",
    ],
  },
  // HUD: mini rider marker (0 tyre, 1 jersey, 3 helmet, 4 frame)
  MINI: {
    w: 9, h: 7, rows: [
      ".....33..",
      "...1113..",
      "..11.....",
      "...4444..",
      ".00.4.00.",
      "0..00...0",
      ".00...00.",
    ],
  },
};
