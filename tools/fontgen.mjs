// FaceLab font generator.
// Defines three procedural fonts once and emits identical data for the
// web preview (web/js/engine/fontdata.js) and the watch (watch/source/gen/FontData.mc).
//
//  - STROKE: monoline vector font (caps, digits, punctuation, umlauts).
//            Cap height = 20 units. Points are stored as bytes: x*4, (y+6)*4.
//            255 = pen up (stroke break). Bit 7 of the x byte marks a vertex that
//            needs a round joint/cap (stroke ends and corners > 35 degrees).
//  - PIXEL:  5x7 dot-matrix font incl. lowercase, 7 bytes per glyph (5 bit rows).
//  - SEG:    7-segment masks (bits a..g = 1,2,4,8,16,32,64).
//
// Run: node tools/fontgen.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------- stroke font
function arc(cx, cy, rx, ry, a0, a1) {
  const pts = [];
  const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 15));
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}
const L = (...pts) => pts;
const cat = (...parts) => parts.flat().length && parts.reduce((acc, p) => acc.concat(p), []);
const dot = (x, y) => [[x, y]];
const circ = (cx, cy, r) => arc(cx, cy, r, r, 0, 360);

// Glyph = { w: advance-relevant width, s: [stroke, stroke, ...] }
const S = {};
const g = (ch, w, ...strokes) => (S[ch] = { w, s: strokes });

// Digits — geometric, DIN-like stadium shapes. Width 11.
g("0", 11, cat(arc(5.5, 5.5, 5.5, 5.5, 180, 360), L([11, 14.5]), arc(5.5, 14.5, 5.5, 5.5, 0, 180), L([0, 5.5])));
g("1", 11, L([2.5, 4], [7, 0], [7, 20]));
g("2", 11, cat(arc(5.5, 5.5, 5.5, 5.5, 195, 380), L([0, 20], [11, 20])));
g("3", 11, cat(arc(5.5, 5, 5, 5, 205, 450), arc(5.5, 15, 5.25, 5, 270, 520)));
g("4", 11, L([8.5, 20], [8.5, 0], [0, 14], [11.5, 14]));
g("5", 11, cat(L([10.5, 0], [1.5, 0], [0.9, 8.8]), arc(5.5, 13.5, 6, 6.5, 230, 510)));
g("6", 11, L([9, 0], [1.4, 11]), circ(5.5, 14.5, 5.5));
g("7", 11, L([0, 0], [11, 0], [3.5, 20]));
g("8", 11, circ(5.5, 4.75, 4.75), circ(5.5, 14.75, 5.5));
g("9", 11, circ(5.5, 5.5, 5.5), L([9.6, 9], [2, 20]));

// Caps
g("A", 12, L([0, 20], [6, 0], [12, 20]), L([2.1, 13], [9.9, 13]));
g("B", 11, cat(L([0, 10], [0, 0], [5.5, 0]), arc(5.5, 5, 4.5, 5, 270, 450), L([0, 10])), cat(L([0, 10], [6, 10]), arc(6, 15, 5, 5, 270, 450), L([0, 20], [0, 10])));
g("C", 11.5, cat(arc(6, 6, 6, 6, 330, 180), L([0, 14]), arc(6, 14, 6, 6, 180, 30)));
g("D", 11, cat(L([0, 0], [5, 0]), arc(5, 6, 6, 6, 270, 360), L([11, 14]), arc(5, 14, 6, 6, 0, 90), L([0, 20], [0, 0])));
g("E", 10.5, L([10.5, 0], [0, 0], [0, 20], [10.5, 20]), L([0, 10], [8, 10]));
g("F", 10.5, L([10.5, 0], [0, 0], [0, 20]), L([0, 10], [8, 10]));
g("G", 12, cat(arc(6, 6, 6, 6, 330, 180), L([0, 14]), arc(6, 14, 6, 6, 180, 0), L([12, 11], [7, 11])));
g("H", 11, L([0, 0], [0, 20]), L([11, 0], [11, 20]), L([0, 10], [11, 10]));
g("I", 0, L([0, 0], [0, 20]));
g("J", 9.5, cat(L([9.5, 0], [9.5, 15]), arc(4.75, 15, 4.75, 5, 0, 180)));
g("K", 11, L([0, 0], [0, 20]), L([11, 0], [0, 13]), L([3.8, 9.2], [11.5, 20]));
g("L", 10, L([0, 0], [0, 20], [10, 20]));
g("M", 14, L([0, 20], [0, 0], [7, 14], [14, 0], [14, 20]));
g("N", 11, L([0, 20], [0, 0], [11, 20], [11, 0]));
g("O", 12, cat(arc(6, 6, 6, 6, 180, 360), L([12, 14]), arc(6, 14, 6, 6, 0, 180), L([0, 6])));
g("P", 11, cat(L([0, 20], [0, 0], [5.5, 0]), arc(5.5, 5.5, 5.5, 5.5, 270, 450), L([0, 11])));
g("Q", 12, cat(arc(6, 6, 6, 6, 180, 360), L([12, 14]), arc(6, 14, 6, 6, 0, 180), L([0, 6])), L([7.5, 15], [12.5, 21]));
g("R", 11.5, cat(L([0, 20], [0, 0], [5.5, 0]), arc(5.5, 5.5, 5.5, 5.5, 270, 450), L([0, 11])), L([5, 11], [11.5, 20]));
g("S", 11, cat(arc(5.5, 5, 5.25, 5, 330, 90), arc(5.5, 15, 5.5, 5, 270, 510)));
g("T", 12, L([0, 0], [12, 0]), L([6, 0], [6, 20]));
g("U", 11, cat(L([0, 0], [0, 14.5]), arc(5.5, 14.5, 5.5, 5.5, 180, 0), L([11, 0])));
g("V", 12, L([0, 0], [6, 20], [12, 0]));
g("W", 16, L([0, 0], [4, 20], [8, 5], [12, 20], [16, 0]));
g("X", 11, L([0, 0], [11, 20]), L([11, 0], [0, 20]));
g("Y", 12, L([0, 0], [6, 10], [12, 0]), L([6, 10], [6, 20]));
g("Z", 11, L([0, 0], [11, 0], [0, 20], [11, 20]));
// Umlauts (dots above cap line, y < 0 allowed down to -6)
const withDots = (base, x1, x2) => ({ w: S[base].w, s: [...S[base].s, dot(x1, -4), dot(x2, -4)] });
S["Ä"] = withDots("A", 3.5, 8.5);
S["Ö"] = withDots("O", 3.5, 8.5);
S["Ü"] = withDots("U", 3, 8);
// Punctuation & symbols
g(" ", 5);
g(".", 0, dot(0, 20));
g(",", 1.5, L([1.5, 18.5], [0, 23]));
g(":", 0, dot(0, 6), dot(0, 15));
g(";", 1.5, dot(1.5, 6), L([1.5, 14.5], [0, 19]));
g("-", 7, L([0, 11], [7, 11]));
g("+", 9, L([0, 10], [9, 10]), L([4.5, 5.5], [4.5, 14.5]));
g("=", 9, L([0, 7.5], [9, 7.5]), L([0, 12.5], [9, 12.5]));
g("/", 8, L([0, 20], [8, 0]));
g("%", 13, circ(2.6, 3.6, 2.6), circ(10.4, 16.4, 2.6), L([0.8, 20], [12.2, 0]));
g("°", 6, circ(3, 3, 3));
g("!", 0, L([0, 0], [0, 13.5]), dot(0, 20));
g("?", 10, cat(arc(5, 5, 5, 5, 180, 450), L([5, 13.5])), dot(5, 20));
g("'", 0, L([0, 0], [0, 5]));
g("#", 11, L([3.5, 2], [2.5, 18]), L([8.5, 2], [7.5, 18]), L([0, 7], [11, 7]), L([0, 13], [11, 13]));
g("<", 9, L([9, 3], [0, 10], [9, 17]));
g(">", 9, L([0, 3], [9, 10], [0, 17]));
g("(", 4, arc(9, 10, 9, 12, 140, 220));
g(")", 4, arc(-5, 10, 9, 12, 40, -40));
g("_", 10, L([0, 21], [10, 21]));
g("*", 9, L([4.5, 2], [4.5, 12]), L([0.2, 4.5], [8.8, 9.5]), L([0.2, 9.5], [8.8, 4.5]));
g("^", 10, L([0, 9], [5, 2], [10, 9]), L([5, 2], [5, 20]));   // up arrow
g("|", 0, L([0, -2], [0, 22]));
g("@", 13, cat(arc(3.5, 5.5, 3.3, 3.3, 150, 360), arc(9.5, 5.5, 3.3, 3.3, 180, 390), L([6.5, 16]), L([0.5, 7.3])));  // heart

function encodeStroke() {
  const chars = Object.keys(S);
  const bytes = [];
  const offs = [];
  const widths = [];
  for (const ch of chars) {
    offs.push(bytes.length);
    widths.push(Math.round(S[ch].w * 4));
    S[ch].s.forEach((stroke, si) => {
      if (si > 0) bytes.push(255);
      stroke.forEach(([x, y], i) => {
        const bx = Math.round(x * 4);
        const by = Math.round((y + 6) * 4);
        if (bx < 0 || bx > 127 || by < 0 || by > 254) throw new Error(`glyph ${ch} out of range ${x},${y}`);
        let joint = i === 0 || i === stroke.length - 1;
        if (!joint) {
          const [px, py] = stroke[i - 1], [nx, ny] = stroke[i + 1];
          const a1 = Math.atan2(y - py, x - px), a2 = Math.atan2(ny - y, nx - x);
          let da = Math.abs(a2 - a1) * 180 / Math.PI;
          if (da > 180) da = 360 - da;
          joint = da > 35;
        }
        bytes.push(bx | (joint ? 128 : 0), by);
      });
    });
  }
  offs.push(bytes.length);
  return { chars, bytes, offs, widths };
}

// ----------------------------------------------------------------- pixel font
const PX = {
  "0": "0E 11 13 15 19 11 0E", "1": "04 0C 04 04 04 04 0E", "2": "0E 11 01 02 04 08 1F", "3": "1F 02 04 02 01 11 0E",
  "4": "02 06 0A 12 1F 02 02", "5": "1F 10 1E 01 01 11 0E", "6": "06 08 10 1E 11 11 0E", "7": "1F 01 02 04 08 08 08",
  "8": "0E 11 11 0E 11 11 0E", "9": "0E 11 11 0F 01 02 0C",
  A: "0E 11 11 11 1F 11 11", B: "1E 11 11 1E 11 11 1E", C: "0E 11 10 10 10 11 0E", D: "1C 12 11 11 11 12 1C",
  E: "1F 10 10 1E 10 10 1F", F: "1F 10 10 1E 10 10 10", G: "0E 11 10 17 11 11 0F", H: "11 11 11 1F 11 11 11",
  I: "0E 04 04 04 04 04 0E", J: "07 02 02 02 02 12 0C", K: "11 12 14 18 14 12 11", L: "10 10 10 10 10 10 1F",
  M: "11 1B 15 15 11 11 11", N: "11 11 19 15 13 11 11", O: "0E 11 11 11 11 11 0E", P: "1E 11 11 1E 10 10 10",
  Q: "0E 11 11 11 15 12 0D", R: "1E 11 11 1E 14 12 11", S: "0F 10 10 0E 01 01 1E", T: "1F 04 04 04 04 04 04",
  U: "11 11 11 11 11 11 0E", V: "11 11 11 11 11 0A 04", W: "11 11 11 15 15 15 0A", X: "11 11 0A 04 0A 11 11",
  Y: "11 11 11 0A 04 04 04", Z: "1F 01 02 04 08 10 1F",
  a: "00 00 0E 01 0F 11 0F", b: "10 10 16 19 11 11 1E", c: "00 00 0E 10 10 11 0E", d: "01 01 0D 13 11 11 0F",
  e: "00 00 0E 11 1F 10 0E", f: "06 09 08 1C 08 08 08", g: "00 0F 11 11 0F 01 0E", h: "10 10 16 19 11 11 11",
  i: "04 00 0C 04 04 04 0E", j: "02 00 06 02 02 12 0C", k: "10 10 12 14 18 14 12", l: "0C 04 04 04 04 04 0E",
  m: "00 00 1A 15 15 11 11", n: "00 00 16 19 11 11 11", o: "00 00 0E 11 11 11 0E", p: "00 00 1E 11 1E 10 10",
  q: "00 00 0D 13 0F 01 01", r: "00 00 16 19 10 10 10", s: "00 00 0E 10 0E 01 1E", t: "08 08 1C 08 08 09 06",
  u: "00 00 11 11 11 13 0D", v: "00 00 11 11 11 0A 04", w: "00 00 11 11 15 15 0A", x: "00 00 11 0A 04 0A 11",
  y: "00 00 11 11 0F 01 0E", z: "00 00 1F 02 04 08 1F",
  " ": "00 00 00 00 00 00 00", ".": "00 00 00 00 00 0C 0C", ",": "00 00 00 00 0C 04 08", ":": "00 0C 0C 00 0C 0C 00",
  ";": "00 0C 0C 00 0C 04 08", "-": "00 00 00 1F 00 00 00", "+": "00 04 04 1F 04 04 00", "=": "00 00 1F 00 1F 00 00",
  "/": "00 01 02 04 08 10 00", "%": "18 19 02 04 08 13 03", "°": "0C 12 12 0C 00 00 00", "!": "04 04 04 04 04 00 04",
  "?": "0E 11 01 02 04 00 04", "$": "04 0F 14 0E 05 1E 04", ">": "08 04 02 01 02 04 08", "<": "02 04 08 10 08 04 02",
  "_": "00 00 00 00 00 00 1F", "[": "0E 08 08 08 08 08 0E", "]": "0E 02 02 02 02 02 0E", "(": "02 04 08 08 08 04 02",
  ")": "08 04 02 02 02 04 08", "#": "0A 0A 1F 0A 1F 0A 0A", "*": "00 04 15 0E 15 04 00", "'": "0C 04 08 00 00 00 00",
  "|": "04 04 04 04 04 04 04", "~": "00 00 08 15 02 00 00", "@": "00 0A 1F 1F 0E 04 00", "^": "04 0E 15 04 04 04 04",
  "Ä": "0A 00 0E 11 1F 11 11", "Ö": "0A 00 0E 11 11 11 0E", "Ü": "0A 00 11 11 11 11 0E",
  "ä": "0A 00 0E 01 0F 11 0F", "ö": "0A 00 0E 11 11 11 0E", "ü": "0A 00 11 11 11 13 0D", "ß": "0E 11 11 16 11 11 16",
  "\u007f": "1F 1F 1F 1F 1F 1F 1F", // full block (cursor)
};

// -------------------------------------------------------------- segment font
// a=top, b=upper right, c=lower right, d=bottom, e=lower left, f=upper left, g=middle
const SEG = {
  "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc",
  "8": "abcdefg", "9": "abcdfg", "-": "g", " ": "", A: "abcefg", B: "cdefg", C: "adef", D: "bcdeg", E: "adefg",
  F: "aefg", G: "acdef", H: "bcefg", L: "def", O: "cdeg", P: "abefg", R: "eg", T: "defg", U: "bcdef", N: "ceg",
  Y: "bcdfg", _: "d", "°": "abfg",
};
const segMask = (s) => [...s].reduce((m, c) => m | (1 << "abcdefg".indexOf(c)), 0);

// -------------------------------------------------------------- char map
// Maps a Latin-1 code (0..255) to glyph index + 1 for each font (0 = missing).
function charMap(chars) {
  const m = new Array(256).fill(0);
  chars.forEach((ch, i) => {
    const c = ch.charCodeAt(0);
    if (c > 255) throw new Error("non latin1 " + ch);
    m[c] = i + 1;
  });
  return m;
}

const stroke = encodeStroke();
const pxChars = Object.keys(PX);
const pxBytes = pxChars.flatMap((c) => PX[c].split(" ").map((h) => parseInt(h, 16)));
const segChars = Object.keys(SEG);
const segBytes = segChars.map((c) => segMask(SEG[c]));

const out = {
  strokeChars: stroke.chars.join(""),
  strokeMap: charMap(stroke.chars),
  strokeData: stroke.bytes,
  strokeOffs: stroke.offs,
  strokeW: stroke.widths,
  pxMap: charMap(pxChars),
  pxData: pxBytes,
  segMap: charMap(segChars),
  segData: segBytes,
};

// ---- web
const js = `// GENERATED by tools/fontgen.mjs — do not edit.
export const FONTDATA = {
  strokeMap: new Uint8Array(${JSON.stringify(out.strokeMap)}),
  strokeData: new Uint8Array(${JSON.stringify(out.strokeData)}),
  strokeOffs: ${JSON.stringify(out.strokeOffs)},
  strokeW: ${JSON.stringify(out.strokeW)},
  pxMap: new Uint8Array(${JSON.stringify(out.pxMap)}),
  pxData: new Uint8Array(${JSON.stringify(out.pxData)}),
  segMap: new Uint8Array(${JSON.stringify(out.segMap)}),
  segData: new Uint8Array(${JSON.stringify(out.segData)}),
};
`;
writeFileSync(join(ROOT, "web/js/engine/fontdata.js"), js);

// ---- watch
const ba = (arr) => {
  const lines = [];
  for (let i = 0; i < arr.length; i += 24) lines.push("        " + arr.slice(i, i + 24).join(","));
  return "[\n" + lines.join(",\n") + "\n    ]b";
};
const na = (arr) => "[" + arr.join(",") + "]";
const mc = `// GENERATED by tools/fontgen.mjs — do not edit.
import Toybox.Lang;

module FontData {
    const STROKE_MAP = ${ba(out.strokeMap)};
    const STROKE_DATA = ${ba(out.strokeData)};
    const STROKE_OFFS = ${na(out.strokeOffs)};
    const STROKE_W = ${ba(out.strokeW)};
    const PX_MAP = ${ba(out.pxMap)};
    const PX_DATA = ${ba(out.pxData)};
    const SEG_MAP = ${ba(out.segMap)};
    const SEG_DATA = ${ba(out.segData)};
}
`;
writeFileSync(join(ROOT, "watch/source/gen/FontData.mc"), mc);
console.log(`stroke: ${stroke.chars.length} glyphs, ${stroke.bytes.length} bytes; pixel: ${pxChars.length}; seg: ${segChars.length}`);
