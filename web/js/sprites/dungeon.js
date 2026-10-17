// Sprites for DUNGEON ("Dungeon" pixel RPG battle). Drawn at 4 px per sprite pixel
// (UI icons COIN / FIRE at 2 px). Index 0 is always the outline, so the always-on mode can
// draw pure outline silhouettes (palette [col, -1, -1, ...]).
// Hero: 0 outline 1 metal light 2 metal mid 3 metal dark 4 skin 5 cape/plume (accent)
//       6 cape dark 7 shield blue 8 gold 9 blade white a belt/leather b boots
// Monsters: 0 outline 1 light 2 mid 3 dark 4 extra 5 eyes 9 white (teeth/spots/glint)

function grid(rows, w) {
  return rows.map((r) => r.padEnd(w, ".").split(""));
}
function put(g, x, y, c) { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; }
function str(g) { return g.map((r) => r.join("")); }
function spr(rows) { return { w: rows[0].length, h: rows.length, rows }; }

const HERO = [
  "..00.......000....",
  ".0920.....05550...",
  ".0920...0555660...",
  ".0920.056600000...",
  ".0920060.0111120..",
  ".0920....01111220.",
  ".0920....02222220.",
  ".0920....03244040.",
  ".0920....03244440.",
  ".0920.....033440..",
  ".0920.050111000000",
  "088880550122088880",
  ".03322211223077770",
  ".08000560223078870",
  ".....0560a8a077770",
  "....0560333300770.",
  "....060033033000..",
  ".....0.0220220....",
  ".......0bb0bbb0...",
  ".......00000000...",
];

// breathing frame: upper body one pixel lower (row 14 dropped)
const HERO_B = ["." .repeat(18)].concat(HERO.slice(0, 14), HERO.slice(15));

// attack frame: sword arm thrust forward over the shield
function heroAtk() {
  const W = 30;
  const g = grid(HERO.map((r) => "....." + r.slice(5)), W);
  // remove the back arm + hand + pommel
  for (let x = 0; x < 9; x++) for (let y = 11; y <= 13; y++) if (g[y][x] !== "5" && g[y][x] !== "6") g[y][x] = ".";
  put(g, 6, 11, "5"); put(g, 7, 11, "5"); put(g, 6, 12, "5"); put(g, 7, 12, "6"); put(g, 5, 12, "0"); put(g, 5, 11, "0");
  put(g, 6, 13, "5"); put(g, 7, 13, "6"); put(g, 5, 13, "0");
  // arm from the shoulder to the fist in front of the shield
  for (let x = 9; x <= 17; x++) { put(g, x, 10, "0"); put(g, x, 11, x < 12 ? "1" : "2"); put(g, x, 12, "3"); put(g, x, 13, "0"); }
  put(g, 18, 10, "0"); put(g, 18, 11, "3"); put(g, 18, 12, "3"); put(g, 18, 13, "0");
  // crossguard
  for (let y = 9; y <= 14; y++) put(g, 19, y, y === 9 || y === 14 ? "0" : "8");
  put(g, 20, 9, "0"); put(g, 20, 14, "0"); put(g, 20, 10, "0"); put(g, 20, 13, "0");
  // blade
  for (let x = 20; x <= 28; x++) { put(g, x, 10, "0"); put(g, x, 11, "9"); put(g, x, 12, "2"); put(g, x, 13, "0"); }
  put(g, 29, 11, "0"); put(g, 29, 12, "0"); put(g, 28, 10, "."); put(g, 28, 13, ".");
  put(g, 28, 11, "0"); put(g, 28, 12, "0");
  return str(g);
}

const SLIME_A = [
  "......0000......",
  "....00111100....",
  "...0111111120...",
  "..019911111120..",
  ".01991111111220.",
  ".01101101111220.",
  "011101101111220.",
  "0111111111112220",
  "0111000011122220",
  "0211111111222230",
  ".03322222222330.",
  "..000000000000..",
];
const SLIME_B = [
  "................",
  "................",
  ".....000000.....",
  "...0011111100...",
  "..019911111120..",
  ".01991011011220.",
  "0111101101112220",
  "0111111111112220",
  "0111100001122230",
  "0222111111222330",
  "0033322222233300",
  ".00000000000000.",
];

const SKEL = [
  "....000000....",
  "...01111110...",
  "..0111111120..",
  "..0100110010..",
  "..0150115010..",
  "..0111111120..",
  "...01090910...",
  "....001100....",
  "0.....010.....",
  "00..0011100...",
  "0a00101110100.",
  "0a0.0011100.0.",
  "0a0.0101010.0.",
  "0a00..0110..00",
  "0a0..011110...",
  "000..0.00.0...",
  ".0...0.00.0...",
  ".....010.010..",
  "....0110.0110.",
  "....0000.0000.",
];

// ---- primitive painter for the bigger monsters (outline is added automatically)
function blank(w, h) { const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill(".")); return g; }
function rect(g, x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, c); }
function ell(g, cx, cy, rx, ry, c) {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    if (dx * dx + dy * dy <= 1.0) put(g, x, y, c);
  }
}
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
function poly(g, pts, c) {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    const px = x + 0.5, py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) put(g, x, y, c);
  }
}
function outline(g) {
  const h = g.length, w = g[0].length;
  const o = g.map((r) => r.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g[y][x] !== ".") continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [ax, ay] of n) {
      const v = g[y + ay] && g[y + ay][x + ax];
      if (v && v !== "." && v !== "0") { o[y][x] = "0"; break; }
    }
  }
  return o;
}
// mirror the left half onto the right half
function mirror(g) {
  const w = g[0].length;
  for (const r of g) for (let x = 0; x < w / 2; x++) r[w - 1 - x] = r[x];
  return g;
}

function bat(up) {
  const g = blank(22, 13);
  if (up) {
    poly(g, [[9, 5], [3, 0], [1, 1], [1, 7], [3, 6], [4, 8], [6, 7], [8, 9]], "2");
    line(g, 9, 5, 3, 1, "3"); line(g, 3, 1, 1, 6, "3");
  } else {
    poly(g, [[9, 4], [3, 6], [1, 11], [3, 10], [5, 12], [7, 10], [9, 10]], "2");
    line(g, 9, 5, 3, 7, "3"); line(g, 3, 7, 1, 10, "3");
  }
  mirror(g);
  ell(g, 10.5, 6.5, 3.2, 3.0, "1");
  rect(g, 8, 2, 8, 3, "1"); rect(g, 13, 2, 13, 3, "1");
  put(g, 9, 6, "5"); put(g, 12, 6, "5");
  put(g, 9, 8, "9"); put(g, 12, 8, "9"); put(g, 10, 8, "3"); put(g, 11, 8, "3");
  rect(g, 9, 9, 12, 9, "2");
  return str(outline(g));
}

function goblin() {
  const g = blank(18, 19);
  // ears
  poly(g, [[6, 4], [0, 2], [2, 5], [6, 7]], "1");
  poly(g, [[12, 4], [18, 2], [16, 5], [12, 7]], "1");
  line(g, 1, 3, 5, 5, "2"); line(g, 16, 3, 12, 5, "2");
  ell(g, 9, 5, 4.6, 4.2, "1");
  rect(g, 6, 8, 12, 9, "1");
  // brow, eyes, nose, grin
  rect(g, 6, 3, 8, 3, "2"); rect(g, 10, 3, 12, 3, "2");
  put(g, 7, 4, "5"); put(g, 11, 4, "5"); put(g, 8, 4, "0"); put(g, 10, 4, "0");
  rect(g, 9, 5, 9, 6, "2");
  rect(g, 6, 8, 12, 8, "0"); put(g, 7, 8, "9"); put(g, 11, 8, "9");
  put(g, 6, 7, "0"); put(g, 12, 7, "0");
  // body: tunic + belt
  rect(g, 6, 11, 12, 15, "a"); rect(g, 6, 13, 12, 13, "b"); put(g, 9, 13, "4");
  rect(g, 6, 11, 12, 11, "4");
  // arms
  rect(g, 4, 11, 5, 14, "1"); rect(g, 13, 11, 14, 14, "1");
  rect(g, 3, 13, 4, 14, "2");
  // legs
  rect(g, 7, 16, 8, 17, "2"); rect(g, 10, 16, 11, 17, "2");
  rect(g, 6, 17, 8, 17, "3"); rect(g, 10, 17, 12, 17, "3");
  // club
  line(g, 3, 14, 1, 8, "a"); line(g, 2, 14, 0, 9, "a");
  ell(g, 1, 7.5, 1.6, 1.8, "b"); put(g, 0, 6, "4");
  return str(outline(g));
}

function golem() {
  const g = blank(22, 22);
  // arms + fists
  rect(g, 1, 8, 4, 14, "1"); ell(g, 2.5, 16, 2.4, 2.2, "2");
  rect(g, 5, 6, 10, 15, "1");
  rect(g, 8, 1, 10, 6, "1");
  mirror(g);
  rect(g, 16, 8, 17, 14, "2"); rect(g, 13, 6, 15, 15, "2");
  rect(g, 6, 15, 15, 15, "2");
  // legs
  rect(g, 6, 16, 9, 20, "1"); rect(g, 12, 16, 15, 20, "2");
  rect(g, 6, 20, 9, 20, "3"); rect(g, 12, 20, 15, 20, "3");
  // head detail: brow + glowing eyes
  rect(g, 8, 2, 13, 2, "2"); put(g, 9, 3, "5"); put(g, 12, 3, "5");
  rect(g, 9, 5, 12, 5, "3");
  // chest rune + cracks
  rect(g, 10, 9, 11, 11, "5"); put(g, 9, 10, "5"); put(g, 12, 10, "5");
  line(g, 6, 7, 7, 9, "3"); line(g, 14, 12, 15, 14, "3"); line(g, 2, 10, 3, 12, "3");
  // moss
  rect(g, 1, 7, 4, 7, "c"); put(g, 1, 8, "d"); put(g, 4, 8, "c"); rect(g, 8, 0, 11, 0, "c"); put(g, 10, 1, "d");
  rect(g, 17, 7, 20, 7, "c"); put(g, 20, 8, "d"); rect(g, 5, 6, 6, 6, "d");
  return str(outline(g));
}

function dragon() {
  const g = blank(30, 25);
  // wing (behind)
  poly(g, [[14, 13], [19, 1], [29, 4], [27, 6], [26, 11], [23, 9], [22, 13], [19, 11], [17, 14]], "3");
  line(g, 15, 12, 19, 1, "2"); line(g, 19, 1, 28, 4, "2"); line(g, 19, 2, 23, 9, "2"); line(g, 19, 2, 26, 10, "2");
  // tail
  line(g, 20, 19, 25, 21, "1"); line(g, 20, 20, 25, 22, "1"); line(g, 25, 21, 28, 17, "1"); line(g, 26, 21, 29, 18, "1");
  poly(g, [[27, 17], [29, 13], [30, 18]], "4");
  // body + belly
  ell(g, 16, 17.5, 6.5, 4.6, "1");
  ell(g, 13, 19, 3.6, 3.2, "4");
  // neck
  poly(g, [[8, 9], [12, 8], [16, 14], [11, 17]], "1");
  // head + snout + horns
  ell(g, 7, 7, 4.2, 3.4, "1");
  rect(g, 1, 7, 5, 9, "1");
  rect(g, 1, 9, 5, 9, "2");
  line(g, 9, 4, 12, 1, "9"); line(g, 8, 4, 11, 1, "9");
  put(g, 6, 3, "9"); put(g, 5, 2, "9");
  // eye, nostril, teeth
  put(g, 7, 6, "5"); put(g, 8, 6, "0"); put(g, 2, 7, "0");
  put(g, 2, 10, "9"); put(g, 4, 10, "9"); rect(g, 1, 10, 5, 10, "0"); put(g, 2, 10, "9"); put(g, 4, 10, "9");
  rect(g, 2, 11, 6, 11, "2");
  // belly stripes
  rect(g, 11, 18, 15, 18, "2"); rect(g, 11, 20, 15, 20, "2");
  // legs + claws
  rect(g, 11, 21, 13, 23, "2"); rect(g, 18, 21, 20, 23, "2");
  put(g, 10, 23, "9"); put(g, 12, 23, "9"); put(g, 17, 23, "9"); put(g, 19, 23, "9");
  // back spikes
  put(g, 12, 7, "4"); put(g, 14, 10, "4"); put(g, 17, 12, "4"); put(g, 20, 13, "4");
  return str(outline(g));
}

// breathing frame: everything above row `cut` one pixel lower (row `cut` dropped)
function breathe(rows, cut) {
  return [".".repeat(rows[0].length)].concat(rows.slice(0, cut), rows.slice(cut + 1));
}

const BAT_A = bat(true);
const BAT_B = bat(false);
const GOBLIN = goblin();
const GOLEM = golem();
const DRAGON = dragon();

const SHROOM = [
  "......00000.....",
  "....005595500...",
  "...05599555950..",
  "..0555555555560.",
  ".059955595555560",
  ".055555599556660",
  "0555955555566660",
  "0666666666666660",
  ".0000111111000..",
  "....01111110....",
  "....01011010....",
  "....01011010....",
  "....01111110....",
  "....01100110....",
  "....01111120....",
  "....01111220....",
  "...0aa0000aa0...",
  "...0000..0000...",
];

const CHEST_C = [
  "..0000000000..",
  ".044444444440.",
  "04aaaaaaaaaa40",
  "0aaaaaaaaaaaa0",
  "08888888888880",
  "0aaaaa88aaaaa0",
  "0bbbbb00bbbbb0",
  "0aaaaaaaaaaaa0",
  "0bbbbbbbbbbbb0",
  "08aaaaaaaaaa80",
  "00000000000000",
];
const CHEST_O = [
  "..0000000000..",
  ".044444444440.",
  "04aaaaaaaaaa40",
  "0aaaaaaaaaaaa0",
  "08888888888880",
  "0b9898989898b0",
  "08989898989890",
  "08888888888880",
  "0aaaaa88aaaaa0",
  "0bbbbb00bbbbb0",
  "0aaaaaaaaaaaa0",
  "0bbbbbbbbbbbb0",
  "08aaaaaaaaaa80",
  "00000000000000",
];

// torch flame frames (no outline): 1 white-yellow core 2 yellow 3 orange 4 red
const FL_A = [
  "..4..",
  ".434.",
  ".434.",
  "43234",
  "43234",
  "32123",
  ".321.",
];
const FL_B = [
  "...4.",
  "..43.",
  ".4334",
  ".4324",
  "43224",
  "32123",
  ".321.",
];
const FL_C = [
  ".4...",
  ".34..",
  "4334.",
  "4234.",
  "42234",
  "32123",
  ".321.",
];

const COIN = [
  ".0000.",
  "011220",
  "012230",
  "012230",
  "012230",
  "022330",
  ".0000.",
];

export default {
  HERO_A: spr(HERO),
  HERO_B: spr(HERO_B),
  HERO_ATK: spr(heroAtk()),
  SLIME_A: spr(SLIME_A),
  SLIME_B: spr(SLIME_B),
  SKEL: spr(SKEL),
  SKEL_B: spr(breathe(SKEL, 13)),
  BAT_A: spr(BAT_A),
  BAT_B: spr(BAT_B),
  GOBLIN: spr(GOBLIN),
  GOBLIN_B: spr(breathe(GOBLIN, 14)),
  SHROOM: spr(SHROOM),
  SHROOM_B: spr(breathe(SHROOM, 12)),
  GOLEM: spr(GOLEM),
  GOLEM_B: spr(breathe(GOLEM, 13)),
  DRAGON: spr(DRAGON),
  DRAGON_B: spr(breathe(DRAGON, 19)),
  CHEST_C: spr(CHEST_C),
  CHEST_O: spr(CHEST_O),
  FL_A: spr(FL_A),
  FL_B: spr(FL_B),
  FL_C: spr(FL_C),
  COIN: spr(COIN),
};
