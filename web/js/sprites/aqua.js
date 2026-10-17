// Sprites for AQUA ("Aquarium"). Drawn at 4 px per sprite pixel (koi too).
// Side-view fish share one palette layout so every style / night mode can recolour them:
//  0 outline  1 body  2 light (belly)  3 dark (back / pattern)  4 fins  5 stripe  6 eye white
// Fish face RIGHT (draw flipped for left). Frames _A/_B = tail flap.
// Koi (top view) are rasterised from a smooth body shape in 8 directions x 2 tail frames:
//  0 outline  1 body  2 patch  3 fins  4 dark patch  5 eye

function blank(w, h) {
  const g = [];
  for (let y = 0; y < h; y++) g.push(new Array(w).fill("."));
  return g;
}
const rows = (g) => g.map((r) => r.join(""));
function at(g, x, y) { return y >= 0 && y < g.length && x >= 0 && x < g[0].length ? g[y][x] : "."; }
function put(g, x, y, c) { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; }
// every filled cell with an empty 4-neighbour becomes outline
function outline(g, keep) {
  const h = g.length, w = g[0].length;
  const o = g.map((r) => r.slice());
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (g[y][x] === "." || (keep && keep.includes(g[y][x]))) continue;
      if (at(g, x - 1, y) === "." || at(g, x + 1, y) === "." || at(g, x, y - 1) === "." || at(g, x, y + 1) === ".") o[y][x] = "0";
    }
  return o;
}

// side-view fish generator (facing right)
// o: w h | body: cx cy rb rf ry (egg: rb behind centre, rf in front) | tail: x0 x1 a b (half heights at joint/end), fork
// dorsal/anal: [x0, x1, height] | stripes: [[x0, x1], ...] | eye [x, y] | flap: tail bend (frame B)
function fish(o, flap) {
  const g = blank(o.w, o.h);
  const [cx, cy, rb, rf, ry] = o.body;
  const inBody = (x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const rx = dx > 0 ? rf : rb;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
  };
  // fins first (body paints over)
  const fin = (f, up) => {
    if (!f) return;
    const [x0, x1, hh] = f;
    for (let x = x0; x <= x1; x++) {
      const k = (x - x0) / Math.max(1, x1 - x0);
      const ext = Math.round(hh * (o.finShape === 1 ? 1 - Math.abs(k - 0.4) * 1.4 : 1 - k * 0.85));
      // body edge at this column
      let edge = -1;
      for (let y = 0; y < o.h; y++) if (inBody(x, y)) { edge = up ? y : edge; if (up) break; edge = y; }
      if (edge < 0) continue;
      for (let e = 1; e <= ext; e++) put(g, x, up ? edge - e : edge + e, "4");
    }
  };
  fin(o.dorsal, true);
  fin(o.anal, false);
  // tail
  if (o.tail) {
    const [x0, x1, a, b, fork] = o.tail;
    const bend = flap ? (o.bend || 1) : 0;
    for (let x = x0; x <= x1; x++) {
      const k = (x1 - x) / Math.max(1, x1 - x0); // 0 at joint, 1 at end
      const hh = a + (b - a) * k;
      const c = cy + bend * k;
      for (let y = 0; y < o.h; y++) {
        const dy = y + 0.5 - c;
        if (Math.abs(dy) <= hh) {
          if (fork && x <= x0 + fork - 1 && Math.abs(dy) < hh - 1.6) continue;
          put(g, x, y, "4");
        }
      }
    }
  }
  // body with shading
  for (let y = 0; y < o.h; y++)
    for (let x = 0; x < o.w; x++)
      if (inBody(x, y)) {
        const dy = (y + 0.5 - cy) / ry;
        put(g, x, y, dy > 0.38 ? "2" : dy < -0.5 ? "3" : "1");
      }
  // stripes (inside the body only)
  for (const [s0, s1] of o.stripes || [])
    for (let y = 0; y < o.h; y++)
      for (let x = s0; x <= s1; x++) if (inBody(x, y)) put(g, x, y, "5");
  let r = outline(g);
  // stripe borders in outline colour (clownfish look)
  if (o.stripeEdge)
    for (const [s0, s1] of o.stripes || [])
      for (let y = 0; y < o.h; y++) {
        if (inBody(s0 - 1, y) && r[y][s0 - 1] !== "0") r[y][s0 - 1] = o.stripeEdge;
        if (inBody(s1 + 1, y) && r[y][s1 + 1] !== "0") r[y][s1 + 1] = o.stripeEdge;
      }
  for (const [x, y, c] of o.pix || []) put(r, x, y, c);
  // pectoral fin (moves with the flap)
  if (o.pec) {
    const [px, py] = o.pec;
    put(r, px, py + (flap ? 1 : 0), "4");
    put(r, px - 1, py + (flap ? 1 : 0), "4");
    put(r, px - 1, py + (flap ? 2 : 1), "0");
  }
  const [ex, ey] = o.eye;
  put(r, ex, ey, "6");
  put(r, ex + 1, ey, "0");
  return { w: o.w, h: o.h, rows: rows(r) };
}

const CLOWN = {
  w: 16, h: 10, body: [9.4, 5.2, 6.4, 5.4, 3.7], tail: [0, 3, 1.2, 3.4, 0], bend: 1,
  dorsal: [6, 11, 2], anal: [7, 10, 1], finShape: 1, stripes: [[11, 12], [7, 7], [4, 4]], stripeEdge: "0",
  eye: [13, 4], pec: [10, 6],
};
const TANG = {
  w: 18, h: 11, body: [10, 5.5, 7.2, 6.4, 4.4], tail: [0, 4, 2.2, 4.8, 0], bend: 1,
  dorsal: [5, 13, 1], anal: [6, 12, 1], finShape: 0, eye: [14, 4],
  pix: [[6, 3, "3"], [7, 3, "3"], [8, 3, "3"], [9, 3, "3"], [10, 3, "3"], [11, 3, "3"], [5, 4, "3"], [6, 4, "3"], [7, 5, "3"], [8, 5, "3"], [9, 5, "3"], [10, 5, "3"], [11, 4, "3"], [12, 4, "3"], [8, 4, "1"], [9, 4, "1"], [10, 4, "1"], [5, 6, "3"], [4, 5, "3"]],
};
const YTANG = {
  w: 14, h: 13, body: [8, 6.5, 5.6, 5.2, 4.6], tail: [0, 2, 1.2, 3.2, 0], bend: 1,
  dorsal: [3, 11, 3], anal: [4, 10, 2], finShape: 0, eye: [11, 5], pec: [9, 7],
  pix: [[3, 6, "6"], [13, 7, "0"]],
};
const IDOL = {
  w: 16, h: 16, body: [9, 8.5, 5.8, 5.6, 5.2], tail: [0, 3, 1, 2.6, 2], bend: 1,
  anal: [6, 11, 2], finShape: 0, stripes: [[5, 6], [10, 11]], stripeEdge: "", eye: [12, 7],
  pix: [[13, 9, "4"], [14, 9, "4"], [14, 10, "0"], [13, 10, "0"], [8, 3, "0"], [7, 2, "0"], [7, 1, "0"], [6, 0, "0"], [5, 0, "0"], [8, 2, "5"], [9, 3, "5"], [3, 0, "0"], [4, 0, "0"]],
};
const PUFF = {
  w: 13, h: 11, body: [7, 5.5, 5.5, 5.4, 4.8], tail: [0, 2, 1, 2.4, 0], bend: 1,
  dorsal: [6, 7, 1], finShape: 0, eye: [10, 4], pec: [8, 6],
  pix: [[5, 3, "3"], [7, 3, "3"], [4, 5, "3"], [6, 5, "3"], [8, 4, "3"], [12, 6, "0"], [11, 6, "3"]],
};

function idolFix(s) {
  // long dorsal filament of the Moorish idol: sweeping back from the top of the head
  const g = s.rows.map((r) => r.split(""));
  const F = [[9, 3], [8, 2], [7, 2], [6, 1], [5, 1], [4, 1], [3, 0], [2, 0]];
  for (const [x, y] of F) g[y][x] = "6";
  return { w: s.w, h: s.h, rows: rows(g) };
}

// tiny schooling fish (chromis), 7x4
const MINI_A = { w: 7, h: 4, rows: [".....0.", "0.01110", "0011260", "0.0220."] };
const MINI_B = { w: 7, h: 4, rows: [".....0.", "..01110", "0011260", "0.0220."] };

// deep-sea anglerfish 22x16: 0 outline 1 body 2 belly 3 back 4 fins 5 teeth 6 eye 7 lure stalk 8 lure light
const ANGLER_A = {
  w: 22, h: 16, rows: [
    "..............7777....",
    ".............7....7...",
    "............7......7..",
    "...........7......888.",
    ".......00000......888.",
    ".....00333330.....8...",
    "4...0333333330........",
    "44.03333333333360.....",
    "440311121112111000000.",
    "4401111111111110505050",
    "4401111111111110000000",
    "4402111111111110050500",
    "4.02222222222222222220",
    "...00222222222222220..",
    ".....0004400004400....",
    ".......44....44.......",
  ],
};
const ANGLER_B = {
  w: 22, h: 16, rows: [
    "..............7777....",
    ".............7....7...",
    "............7......7..",
    "...........7.......7..",
    ".......00000......888.",
    ".....00333330.....888.",
    "....0333333330....8...",
    "4..03333333333360.....",
    "440311121112111000000.",
    "4401111111111110505050",
    "4401111111111110000000",
    "4402111111111110050500",
    "4402222222222222222220",
    "4..00222222222222220..",
    ".....0004400004400....",
    "......44......44......",
  ],
};

// jellyfish 9x12: 0 rim 1 bell 2 bell light 3 tentacles
const JELLY_A = {
  w: 9, h: 12, rows: [
    "...000...",
    ".0022110.",
    "002211110",
    "021111110",
    "011111110",
    "000000000",
    ".3.3.3.3.",
    ".3..3.3..",
    "..3.3..3.",
    ".3..3..3.",
    ".3...3...",
    "..3......",
  ],
};
const JELLY_B = {
  w: 9, h: 12, rows: [
    ".........",
    "...000...",
    ".0022110.",
    "002211110",
    "0111111110".slice(0, 9),
    ".0000000.",
    "..3.3.3..",
    "..3.3.3..",
    ".3..3..3.",
    ".3.3...3.",
    "..3.3..3.",
    "...3.....",
  ],
};
// lanternfish 9x5: 6 = glowing photophores
const LANT_A = { w: 9, h: 5, rows: ["....000..", "0.033330.", "00311160", "0.06260.", ".....0..."] };
const LANT_B = { w: 9, h: 5, rows: ["....000..", "..033330.", "00311160", "0006260..", "........."].map((r) => r.slice(0, 9)) };

// treasure chest 12x9: 0 outline 1 wood 2 wood light 3 gold 4 gold light 5 dark
const CHEST_A = {
  w: 12, h: 9, rows: [
    "..00000000..",
    ".0222222220.",
    "021111111120",
    "033333333330",
    "011113411110",
    "011113311110",
    "022222222220",
    "011111111110",
    "000000000000",
  ],
};
const CHEST_B = {
  w: 12, h: 11, rows: [
    ".00000000...",
    "0222222220..",
    "0111111110..",
    "0333333330..",
    ".000000000..",
    "044434443440",
    "034343434330",
    "011113311110",
    "022222222220",
    "011111111110",
    "000000000000",
  ],
};
// diver helmet 12x13: 0 outline 1 brass 2 brass light 3 brass dark 4 glass 5 glass shine
const HELMET = {
  w: 12, h: 13, rows: [
    "....0000....",
    "..00222100..",
    ".0222211110.",
    ".0221000130.",
    "0221044503110".slice(0, 12),
    "021045440310",
    "021044440310",
    "021104403110",
    ".0311000130.",
    ".0333333330.",
    "032323232330",
    "033333333330",
    "000000000000",
  ],
};
// coral: branching (0 outline 1 coral 2 light 3 dark)
const CORAL_A = {
  w: 13, h: 14, rows: [
    "..0......0...",
    ".020....020..",
    ".010.0..010..",
    ".010020.010.0",
    ".0100100110020",
    "..01001011010.",
    "..0110101100..",
    "...01101110...",
    "....011110....",
    ".....0110.....",
    ".....0110.....",
    "....013310....",
    "...01333310...",
    "...00000000...",
  ].map((r) => r.slice(0, 13)),
};
// brain coral 11x6
const CORAL_B = {
  w: 11, h: 6, rows: [
    "...00000...",
    ".002121200.",
    "02121212120",
    "01212121210",
    "03131313130",
    "00000000000",
  ],
};
// sea fan 11x13
const CORAL_C = {
  w: 11, h: 13, rows: [
    "...0.0.0...",
    "..0101010..",
    ".010121010.",
    "0101212101.",
    "01212121210",
    "01121212110",
    ".011212110.",
    "..0112110..",
    "...01110...",
    "....010....",
    "....010....",
    "...00300...",
    "..0033300..",
  ],
};
// starfish 7x7
const STAR = { w: 7, h: 7, rows: ["...0...", "..010..", "0001000", "0121210", ".01210.", "010.010", "00...00"] };
// lily pads (top view) 0 outline 1 leaf 2 leaf light 3 vein ; flower 4 petal 5 centre
const LILY_A = {
  w: 13, h: 11, rows: [
    "....00000....",
    "..002222200..",
    ".02222222220.",
    "0222212122220",
    "0122221222210",
    "0111111......",
    "0111113111110",
    "0111131311110",
    ".01111111110.",
    "..001111100..",
    "....00000....",
  ],
};
const LILY_B = {
  w: 13, h: 11, rows: [
    "....00000....",
    "..002222200..",
    ".02224442220.",
    "0222444442220",
    "0122445442210",
    "0111444441...",
    "0111114413110",
    "0111131311110",
    ".01111111110.",
    "..001111100..",
    "....00000....",
  ],
};

// ---- koi (top view), rasterised from a smooth body along a direction
// dir 0..7 = 0deg (right), 45 (down-right), 90 (down), ... (screen y down). frame 1 = tail bent.
function koi(dir, frame) {
  const S = 17;
  const g = blank(S, S);
  const ang = (dir * Math.PI) / 4;
  const ux = Math.cos(ang), uy = Math.sin(ang); // head direction
  const px = -uy, py = ux; // across
  const c = (S - 1) / 2;
  const bend = frame ? 0.55 : -0.55;
  const L = 6.4;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x - c, dy = y - c;
      const a = dx * ux + dy * uy - 0.6; // along body (+ = head)
      let b = dx * px + dy * py; // across
      if (a < 0) b -= (bend * (a * a)) / 26; // tail bend
      let v = ".";
      if (a > -L && a < L) {
        const t = (a + L) / (2 * L); // 0 tail .. 1 head
        const wdt = 2.75 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.8) + 0.2;
        if (Math.abs(b) <= wdt) {
          v = "1";
          if ((t > 0.6 && t < 0.84 && b > -1.6) || (t > 0.3 && t < 0.48 && b < 1.0)) v = "2";
          if (t > 0.86 && t < 0.95 && Math.abs(b) < 0.9) v = "2";
        }
      }
      const ab = Math.abs(b);
      // tail fan with a notch
      if (v === "." && a <= -L + 0.8 && a > -L - 2.8 && ab < 0.4 + (-L + 0.8 - a) * 0.75 && !(a < -L - 1.9 && ab < 0.8)) v = "3";
      // pectoral fins
      if (v === "." && a > 1.0 && a < 3.0 && ab > 2.2 && (a - 2.0) * (a - 2.0) / 1.2 + (ab - 2.9) * (ab - 2.9) / 0.8 < 1) v = "3";
      g[y][x] = v;
    }
  const r = outline(g, ["3"]);
  const ex = c + ux * 5.2, ey = c + uy * 5.2;
  for (const sgn of [-1, 1]) {
    const x = Math.round(ex + px * sgn * 1.25), y = Math.round(ey + py * sgn * 1.25);
    if (r[y] && r[y][x] && r[y][x] !== ".") r[y][x] = "5";
  }
  return { w: S, h: S, rows: rows(r) };
}

const OUT = {
  CLOWN_A: fish(CLOWN, false), CLOWN_B: fish(CLOWN, true),
  TANG_A: fish(TANG, false), TANG_B: fish(TANG, true),
  YTANG_A: fish(YTANG, false), YTANG_B: fish(YTANG, true),
  IDOL_A: idolFix(fish(IDOL, false)), IDOL_B: idolFix(fish(IDOL, true)),
  PUFF_A: fish(PUFF, false), PUFF_B: fish(PUFF, true),
  MINI_A, MINI_B, ANGLER_A, ANGLER_B, JELLY_A, JELLY_B, LANT_A, LANT_B,
  CHEST_A, CHEST_B, HELMET, CORAL_A, CORAL_B, CORAL_C, STAR, LILY_A, LILY_B,
};
for (let d = 0; d < 8; d++) for (let f = 0; f < 2; f++) OUT["KOI_" + d + (f ? "B" : "A")] = koi(d, f);
export default OUT;
