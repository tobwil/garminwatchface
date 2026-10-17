// Sprites for CITY ("Pixel City"). Drawn at 4 px per sprite pixel.
// S-Bahn: 0 roof/bogies, 1 upper body (ochre), 2 lower body (red), 3 windows, 4 doors, 5 head light

function car(head) {
  const W = 24, rows = [];
  for (let r = 0; r < 7; r++) {
    let s = "";
    for (let c = 0; c < W; c++) {
      let ch = ".";
      const door = (c >= 7 && c <= 8) || (c >= 15 && c <= 16);
      if (r === 0) ch = c >= 1 && c <= (head ? 20 : 22) ? "0" : ".";
      else if (r === 1) ch = head && c === 23 ? "." : "1";
      else if (r === 2 || r === 3) {
        if (door) ch = "4";
        else if (head && c >= 21) ch = c === 23 && r === 2 ? "1" : "3";
        else ch = c % 4 === 1 || c % 4 === 2 ? "3" : "1";
      } else if (r === 4) ch = door ? "4" : head && c === 23 ? "5" : "2";
      else if (r === 5) ch = door ? "4" : "2";
      else ch = (c >= 3 && c <= 5) || (c >= 18 && c <= 20) ? "0" : ".";
      s += ch;
    }
    rows.push(s);
  }
  return { w: W, h: 7, rows };
}

export default {
  TRAIN_HEAD: car(true),
  TRAIN_CAR: car(false),
  // water tank on stilts: 0 wood/outline, 1 tank, 2 band
  TANK: {
    w: 7, h: 9, rows: [
      "..000..",
      ".00000.",
      "0111110",
      "0222220",
      "0111110",
      "0222220",
      "0000000",
      ".0...0.",
      ".0...0.",
    ],
  },
  // 0 rim, 1 face, 2 highlight
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
  // plane seen from the side: 0 body, 1 window line
  PLANE: {
    w: 9, h: 3, rows: [
      "0........",
      "001111100",
      "..00.....",
    ],
  },
};
