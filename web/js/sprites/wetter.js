// Sprites for WETTER ("Wetterfenster"). Drawn at 4 px per sprite pixel (icons at 2 px).
// Every sprite documents its palette indices; faces recolour them per style / weather / daylight.

function S(rows) {
  const w = Math.max(...rows.map((r) => r.length));
  return { w, h: rows.length, rows: rows.map((r) => r.padEnd(w, ".")) };
}
function flipV(def) { return { w: def.w, h: def.h, rows: [...def.rows].reverse() }; }

// ---- big tree, generated: ragged ellipse crown lit from the upper left, trunk with root flare.
// lean = 0 / 1 / 2 shears the crown to the right (wind)
const TW = 30, TH = 32;
function tgrid() { const g = []; for (let y = 0; y < TH; y++) g.push(new Array(TW).fill(".")); return g; }
function tput(g, x, y, c) { if (y >= 0 && y < TH && x >= 0 && x < TW) g[y][x] = c; }
function tline(g, x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx - dy;
  for (;;) {
    tput(g, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 > -dy) { e -= dy; x0 += sx; }
    if (e2 < dx) { e += dx; y0 += sy; }
  }
}
function th(x, y) { return ((x * 92837111) ^ (y * 689287499)) >>> 0; }
function tree(lean, noCrown) {
  const g = tgrid();
  // trunk + root flare + branches into the crown
  for (let y = 16; y < TH; y++) { tput(g, 13, y, "0"); tput(g, 14, y, "1"); tput(g, 15, y, "0"); }
  tput(g, 12, TH - 1, "0"); tput(g, 16, TH - 1, "0"); tput(g, 11, TH - 1, "0");
  tline(g, 13, 20, 8, 15, "0"); tline(g, 15, 19, 21, 14, "1"); tline(g, 14, 16, 14 + lean, 10, "0");
  if (noCrown) return { w: TW, h: TH, rows: g.map((r) => r.join("")) };
  // crown: overlapping clumps, each lit from the upper left
  const CL = [[14, 9, 7.2], [8, 12, 5.6], [21, 11.5, 5.8], [10, 5.5, 5.2], [19, 5, 5.4], [14, 3.5, 4.6], [5, 15, 3.6], [24, 15.5, 3.4]];
  for (let y = 0; y < 22; y++) {
    const sh = Math.round(lean * 2.2 * Math.pow(Math.max(0, 1 - y / 21), 1.3));
    for (let x = 0; x < TW; x++) {
      let best = 9, lit = 0;
      for (const c of CL) {
        const dx = (x - c[0]) / c[2], dy = (y - c[1]) / c[2];
        const r = dx * dx + dy * dy;
        if (r < best) { best = r; lit = -dx * 0.6 - dy * 0.8; }
      }
      const h = th(x, y) % 100;
      if (best > 1.0 - (h < 25 ? 0.22 : 0)) continue;
      let c = lit > 0.42 ? "4" : lit > -0.25 ? "3" : "2";
      if (y > 15 && c === "4") c = "3";
      if (y > 17) c = "2";
      tput(g, x + sh, y, c);
    }
  }
  return { w: TW, h: TH, rows: g.map((r) => r.join("")) };
}
function bareTree() {
  const g = tgrid();
  for (let y = 12; y < TH; y++) { tput(g, 13, y, "0"); tput(g, 14, y, "1"); tput(g, 15, y, "0"); }
  tput(g, 12, TH - 1, "0"); tput(g, 16, TH - 1, "0");
  const br = [[14, 20, 5, 9], [14, 18, 24, 7], [14, 14, 10, 3], [14, 13, 19, 1], [14, 12, 14, 0], [8, 12, 3, 5], [21, 10, 27, 6],
    [11, 6, 7, 1], [17, 4, 22, 0], [6, 10, 2, 9], [23, 9, 26, 2]];
  for (const b of br) tline(g, b[0], b[1], b[2], b[3], "0");
  return { w: TW, h: TH, rows: g.map((r) => r.join("")) };
}

// ---- half-timbered house for the postcard, generated
function fachwerk() {
  const W = 22, H = 22, g = [];
  for (let y = 0; y < H; y++) g.push(new Array(W).fill("."));
  const set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  // gable: roof bands along the slopes, plaster + timber inside
  for (let r = 0; r < 10; r++) {
    const c0 = 10 - r, c1 = 11 + r;
    for (let x = c0; x <= c1; x++) {
      const e = Math.min(x - c0, c1 - x);
      set(x, r, e === 0 ? "1" : e <= 2 ? "0" : "2");
    }
  }
  for (let r = 3; r < 10; r++) { set(10, r, "3"); set(11, r, "3"); }
  for (let x = 6; x <= 15; x++) set(x, 6, "3");
  set(8, 8, "3"); set(7, 9, "3"); set(13, 8, "3"); set(14, 9, "3");
  set(9, 4, "4"); set(12, 4, "4");
  // chimney on the right slope
  for (let r = 1; r <= 5; r++) { set(15, r, "6"); set(16, r, "6"); }
  // eave
  for (let x = 0; x < W; x++) set(x, 10, "1");
  // walls: plaster with timber frame
  for (let y = 11; y < H; y++) for (let x = 1; x <= 20; x++) set(x, y, "2");
  for (let y = 11; y < H; y++) { set(1, y, "3"); set(20, y, "3"); set(7, y, "3"); set(14, y, "3"); }
  for (let x = 1; x <= 20; x++) { set(x, 11, "3"); set(x, 16, "3"); set(x, H - 1, "3"); }
  for (let k = 0; k < 4; k++) { set(2 + k, 15 - k, "3"); set(19 - k, 15 - k, "3"); }
  // upper windows with flower boxes, lower windows + door
  for (let y = 12; y <= 14; y++) for (let x = 9; x <= 12; x++) set(x, y, "4");
  for (let x = 9; x <= 12; x++) set(x, 15, "8");
  for (let y = 17; y <= 19; y++) { set(3, y, "4"); set(4, y, "4"); set(5, y, "4"); set(16, y, "4"); set(17, y, "4"); set(18, y, "4"); }
  for (let y = 17; y <= 20; y++) for (let x = 9; x <= 12; x++) set(x, y, "5");
  set(11, 19, "8");
  return { w: W, h: H, rows: g.map((r) => r.join("")) };
}

// split / trim a generated tree: "crown" = leaves only, "trunk" = trunk + branches only, "all" = trimmed
// (trimming keeps the top-left origin of the 30 x 32 tree grid: crown at 0,0, trunk at TRUNK_X, TRUNK_Y)
function crop(def, part) {
  const rows = def.rows.map((r) => r.split("").map((c) => {
    const leaf = c === "2" || c === "3" || c === "4";
    if (part === "crown") return leaf ? c : ".";
    if (part === "trunk") return leaf ? "." : c;
    return c;
  }));
  let y1 = rows.length - 1, x0 = 0, x1 = rows[0].length - 1, y0 = 0;
  if (part === "crown") { while (rows[y1].every((c) => c === ".")) y1--; }
  if (part === "trunk") { x0 = 8; x1 = 21; y0 = 13; }
  if (part === "all") { while (rows[y0].every((c) => c === ".")) y0++; }
  const out = [];
  for (let y = y0; y <= y1; y++) out.push(rows[y].slice(x0, x1 + 1).join(""));
  return { w: x1 - x0 + 1, h: out.length, rows: out };
}

// rows y0..y1-1 of a sprite, trimmed left/right; the left offset is printed by tools (see DIO_X)
function band(def, y0, y1) {
  const rows = def.rows.slice(y0, Math.min(y1, def.h));
  let x0 = def.w, x1 = 0;
  for (const r of rows) for (let x = 0; x < r.length; x++) if (r[x] !== ".") { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  return { w: x1 - x0 + 1, h: rows.length, rows: rows.map((r) => r.slice(x0, x1 + 1)), x0 };
}

// ---- tiny voxel renderer for the isometric diorama (style 3). A unit voxel is drawn as a 4x4 cell
// cube (top diamond, left and right face); x runs to the lower right, y to the lower left, z up.
// Palette: 0 grass, 1 grass light, 2 earth left, 3 earth right, 4 roof, 5 roof right, 6 wall left,
// 7 wall right, 8 window, 9 door, a chimney, b rock dark, c roof step, d path, e leaves, f leaves dark,
// g trunk, h rock, i flowers, j water
const VW = 60, VH = 76, OX = 28, OY = 26;
function voxGrid() {
  const g = [];
  for (let y = 0; y < VH; y++) g.push(new Array(VW).fill("."));
  return g;
}
function cube(g, x, y, z, top, left, right) {
  const sx = OX + (x - y) * 2, sy = OY + (x + y) - z * 2;
  const put = (cx, cy, c) => { if (cy >= 0 && cy < VH && cx >= 0 && cx < VW && c !== null) g[cy][cx] = c; };
  put(sx + 1, sy, top); put(sx + 2, sy, top);
  put(sx, sy + 1, top); put(sx + 1, sy + 1, top); put(sx + 2, sy + 1, top); put(sx + 3, sy + 1, top);
  put(sx, sy + 2, left); put(sx + 1, sy + 2, left); put(sx + 2, sy + 2, right); put(sx + 3, sy + 2, right);
  put(sx + 1, sy + 3, left); put(sx + 2, sy + 3, right);
}
function render(vox) {
  vox.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]) || a[2] - b[2]);
  const g = voxGrid();
  for (const v of vox) cube(g, v[0], v[1], v[2], v[3], v[4], v[5]);
  // trim empty rows/cols
  let y0 = 0, y1 = VH - 1, x0 = 0, x1 = VW - 1;
  const rowE = (y) => g[y].every((c) => c === ".");
  const colE = (x) => g.every((r) => r[x] === ".");
  while (rowE(y0)) y0++;
  while (rowE(y1)) y1--;
  while (colE(x0)) x0++;
  while (colE(x1)) x1--;
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, rows: g.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1).join("")) };
}
function hash(x, y) { return ((x * 73856093) ^ (y * 19349663)) & 1023; }
function vox() {
  const v = [];
  const N = 12;
  const inIsland = (x, y) => !((x === 0 || x === N - 1) && (y === 0 || y === N - 1));
  const path = (x, y) => x === 4 && y >= 6;
  const pond = (x, y) => (x === 8 || x === 9) && (y === 8 || y === 9);
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
    if (!inIsland(x, y)) continue;
    v.push([x, y, 0, "2", "2", "3"]);
    let top = (hash(x, y) & 7) === 0 ? "1" : "0";
    if (path(x, y)) top = "d";
    if (pond(x, y)) top = "j";
    if ((x === 1 && y === 8) || (x === 9 && y === 4) || (x === 2 && y === 10) || (x === 7 && y === 10)) top = "i";
    v.push([x, y, 1, top, "2", "3"]);
  }
  // floating rock underneath, tapering down
  for (let z = -1; z >= -8; z--) {
    const m = Math.floor(-z * 0.6);
    for (let x = m; x < N - m; x++) for (let y = m; y < N - m; y++) {
      if ((hash(x * 3 - z, y + z) & 3) === 0 && (x === m || y === m || x === N - m - 1 || y === N - m - 1)) continue;
      v.push([x, y, z, "h", "h", "b"]);
    }
  }
  // cottage: walls x 2..6, y 2..5, z 2..5
  for (let x = 2; x <= 6; x++) for (let y = 2; y <= 5; y++) for (let z = 2; z <= 5; z++) {
    let L = "6", Rf = "7";
    if (y === 5 && (z === 3 || z === 4) && (x === 2 || x === 6)) L = "8";
    if (y === 5 && x === 4 && z <= 3) L = "9";
    if (x === 6 && (z === 3 || z === 4) && y === 3) Rf = "8";
    v.push([x, y, z, "6", L, Rf]);
  }
  // gable roof along x: steps down toward +y / -y
  const roof = [[6, 1, 6], [7, 2, 5], [8, 3, 4]]; // z, y0, y1
  for (const r of roof) for (let x = 1; x <= 7; x++) for (let y = r[1]; y <= r[2]; y++) v.push([x, y, r[0], "4", "c", "5"]);
  // chimney
  for (let z = 8; z <= 10; z++) v.push([3, 3, z, "a", "a", "b"]);
  return render(v);
}

// tree for the diorama (drawn separately so it can sway): f = frame 0/1
function voxTree(f) {
  const v = [];
  for (let z = 2; z <= 3; z++) v.push([1, 1, z, "g", "g", "g"]);
  const L = [[0, 0, 4], [1, 0, 4], [2, 0, 4], [0, 1, 4], [1, 1, 4], [2, 1, 4], [0, 2, 4], [1, 2, 4], [2, 2, 4],
    [0, 1, 5], [1, 0, 5], [1, 1, 5], [1, 2, 5], [2, 1, 5], [1, 1, 6]];
  for (const l of L) {
    const dx = f === 1 && l[2] >= 5 ? 1 : 0;
    v.push([l[0] + dx, l[1] - dx, l[2], "e", "e", "f"]);
  }
  return render(v);
}

const DIO = vox(false);

export default {
  // ---- cat seen from behind, sitting on the sill, looking out
  // 0 outline, 1 fur, 2 fur light (lit side), 3 stripes
  CAT: S([
    "..0.......0....",
    "..00.....00....",
    "..010...010....",
    "..0110001110...",
    ".011111111110..",
    ".012111113110..",
    ".012111111110..",
    ".011111111110..",
    "..0111111110...",
    "...01111110....",
    "..0121111110...",
    ".012131113110..",
    ".012111111110..",
    "01213111131110.",
    "01211111111110.",
    "01213111131110.",
    "01211111111110.",
    "00000000000000.",
  ]),
  // tail hanging over the sill edge, three swish frames (0 outline, 1 fur, 3 stripe)
  TAIL_A: S([
    "010..",
    "0110.",
    ".010.",
    ".0130",
    ".0110",
    ".0130",
    ".0110",
    ".010.",
    "..0..",
  ]),
  TAIL_B: S([
    "010...",
    "0110..",
    ".0110.",
    "..0130",
    "..0110",
    "..0130",
    "..0110",
    "...010",
    "...00.",
  ]),
  TAIL_C: S([
    "..010",
    ".0110",
    ".010.",
    "0130.",
    "0110.",
    "0130.",
    "0110.",
    "010..",
    "00...",
  ]),
  // sleeping cat, curled up (night): 0 outline, 1 fur, 2 light, 3 stripes
  CAT_SLEEP: S([
    "..0....0..............",
    ".010..010.............",
    ".0110.0110..000000....",
    ".0111111110011111100..",
    "011111111111113111310.",
    "012100100111111111110.",
    "011111111113111311110.",
    ".0112222211111111130..",
    "..000000000000000000..",
  ]),

  // ---- potted geranium: 0 outline, 1 leaf, 2 leaf light, 3 flower, 4 flower light, 5 pot, 6 pot shade
  PLANT: S([
    "....343..34.....",
    "...34443.443....",
    "..3443..3443.43.",
    "...33.2..33.444.",
    "..12.1221.1.433.",
    ".1221122212.2...",
    "122211222112221.",
    ".11221122211221.",
    "..1112112211111.",
    "...111111.111...",
    "...0000000000...",
    "...5555555556...",
    "....55555556....",
    "....55555556....",
    ".....555556.....",
    ".....000000.....",
  ]),
  // steaming mug (cold days): 0 outline, 1 mug, 2 tea
  MUG: S([
    "0000000.",
    "0222220.",
    "01111100",
    "01111101",
    "01111100",
    "0111110.",
    ".00000..",
  ]),

  // ---- sky
  // sun: 0 core, 1 rim, 2 rays
  SUN: S([
    "....2....",
    ".2.....2.",
    "...111...",
    "..10001..",
    "2.10001.2",
    "..10001..",
    "...111...",
    ".2.....2.",
    "....2....",
  ]),
  // moon phases (0 lit, 1 crater): full, gibbous, half, crescent; flip = waning
  MOON_F: S([
    "..000..",
    ".00010.",
    "0100000",
    "0000110",
    "0010000",
    ".00000.",
    "..000..",
  ]),
  MOON_G: S([
    "...00..",
    "..0010.",
    ".100000",
    ".000110",
    ".010000",
    "..0000.",
    "...00..",
  ]),
  MOON_H: S([
    "...00..",
    "...010.",
    "...0000",
    "...0110",
    "...0000",
    "...000.",
    "...00..",
  ]),
  MOON_C: S([
    "....0..",
    ".....0.",
    ".....00",
    ".....00",
    ".....00",
    ".....0.",
    "....0..",
  ]),
  // clouds: 0 light top, 1 body, 2 shade
  CLOUD_A: S([
    "......000.........",
    "....0011100..00...",
    "..00111111100110..",
    ".0111111111111110.",
    "011111111111111110",
    "122111111111111221",
    ".2222222222222222.",
  ]),
  CLOUD_B: S([
    "...000....",
    ".0011100..",
    "011111110.",
    "1111111111",
    ".22222222.",
  ]),
  // lightning bolt: 0 core, 1 glow
  BOLT: S([
    "..1100",
    "..100.",
    ".1001.",
    ".100..",
    "10001.",
    "1000.1",
    "..100.",
    "..10..",
    ".100..",
    ".10...",
    "10....",
    "0.....",
  ]),

  // ---- outside: big tree (0 trunk dark, 1 trunk light, 2 leaves dark, 3 leaves mid, 4 leaves light):
  // crown and trunk separately (the crown leans with the wind), plus the bare winter tree
  TREE_CROWN: crop(tree(0), "crown"),
  TREE_BARE: crop(bareTree(), "all"),
  // neighbourhood skyline behind the window: 0 roof, 1 wall, 2 window, 3 chimney/dark, 4 roof edge (snow)
  TOWN: S([
    "..........3...........................3.........",
    "....44....3..........444..............3...4444..",
    "...4004..44444......40004............4444400004.",
    "..400004400000044..4000004..444.....4000000000004",
    ".40000004000000004400000004400044..40000000000000",
    "40000000040000000040000000040000044000000000000000",
    "11111111111112111111111211111111111111121111111111",
    "11211211111111111211111111111211121111111111211211",
    "11111111111211111111211111211111111112111111111111",
    "11211211111111111111111111111111121111111111211211",
    "11111111111111111111111111111111111111111111111111",
  ]),
  // thermometer: 0 frame, 1 tube, 2 bulb (red), 3 tick marks
  THERMO: S([
    ".000.",
    "30103",
    ".010.",
    "30103",
    ".010.",
    "30103",
    ".010.",
    "30103",
    ".010.",
    "30103",
    ".010.",
    "30103",
    "00200",
    "02220",
    "02220",
    ".000.",
  ]),
  // frost crystals in a pane corner (top left; flip for top right): 0 ice, 1 bright
  FROST: S([
    "0100.0.0..",
    "100.010...",
    "00.0.0..0.",
    "0.010....",
    ".0.0.0...",
    "0..0.....",
    ".0.......",
    "0........",
  ]),

  // ---- small icons at 2 px: 0 main, 1 accent
  ARROW_UP: S([
    "..0..",
    ".000.",
    "00000",
    "..0..",
    "..0..",
  ]),
  ARROW_DN: S([
    "..0..",
    "..0..",
    "00000",
    ".000.",
    "..0..",
  ]),
  UMBRELLA: S([
    "...0...",
    ".00000.",
    "0000000",
    "1.1.1.1",
    "...0...",
    "...0...",
    ".0.0...",
    "..0....",
  ]),

  // ---- postcard (style 2): half-timbered house (Fachwerk), gable front. 0 roof, 1 roof edge/dark,
  // 2 plaster, 3 timber, 4 window, 5 door, 6 chimney, 8 flower box
  HOUSE2: fachwerk(),
  // weather icons for the stamp (0 sun/main, 1 cloud, 2 cloud shade, 3 drops/flakes, 4 bolt)
  ICON_SUN: S([
    "...0......",
    "0..0..0...",
    ".0.....0..",
    "...000....",
    "..00000.00",
    "00000000..",
    "..00000...",
    "...000....",
    ".0.....0..",
    "0..0..0...",
  ]),
  ICON_MOON: S([
    "...0000...",
    ".000......",
    "000.....3.",
    "000.......",
    "000...3...",
    "000.......",
    "0000......",
    ".00000..3.",
    "...0000...",
    "..........",
  ]),
  ICON_CLOUD: S([
    "...00.....",
    "..0..111..",
    ".0.11111..",
    "..1111111.",
    ".111111111",
    "1111111111",
    ".22222222.",
    "..........",
    "..........",
    "..........",
  ]),
  ICON_RAIN: S([
    "....111...",
    "..111111..",
    ".11111111.",
    "1111111111",
    ".22222222.",
    "..........",
    ".3..3..3..",
    "3..3..3...",
    "..........",
    ".3..3..3..",
  ]),
  ICON_SNOW: S([
    "....111...",
    "..111111..",
    ".11111111.",
    "1111111111",
    ".22222222.",
    "..........",
    ".3...3..3.",
    "...3...3..",
    ".3...3....",
    "...3...3..",
  ]),
  ICON_STORM: S([
    "....111...",
    "..111111..",
    ".11111111.",
    "1111111111",
    ".22224222.",
    "....44....",
    "...44.....",
    "..4444....",
    "....44....",
    "...4......",
  ]),
  ICON_FOG: S([
    "..........",
    "....111...",
    "..111111..",
    ".11111111.",
    "..........",
    "3333333...",
    "..........",
    "..33333333",
    "..........",
    "33333333..",
  ]),

  // ---- diorama (style 3): voxel cottage on a floating island, see vox() below
  // split into three horizontal bands trimmed to their content (cheaper to draw than one big box);
  // band x offsets in cells: see DIO_X in the face
  DIO_A: band(DIO, 0, 8),
  DIO_B: band(DIO, 8, 16),
  DIO_C: band(DIO, 16, 24),
  DIO_D: band(DIO, 24, 32),
  DIO_E: band(DIO, 32, 40),
  DIO_F: band(DIO, 40, 99),
  DIO_TREE_A: voxTree(0),
  DIO_TREE_B: voxTree(1),
};
