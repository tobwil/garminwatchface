// SE — the year and the real weather for the story designs (FARM, CAMP, POST, BAKERY, OFFICE, LIGHT,
// TRAIN): the season, the special days (Advent, Christmas, New Year's Eve with fireworks, New Year,
// Easter, Halloween, Valentine's Day and your birthday) and the reported weather, plus small pixel
// decorations the scenes place at their own spots. Mirrors watch/source/lib/Season.mc (copied into a
// watch face only with "libs": ["season"]).
import { G } from "./gfx.js";

export const EV = { NONE: 0, ADVENT: 1, XMAS: 2, NYE: 3, NEWYEAR: 4, EASTER: 5, HALLOWEEN: 6, VALENTINE: 7, BIRTHDAY: 8 };
const BULB = [0xff3a3a, 0xffd23a, 0x3ae07a, 0x3ab4ff, 0xff8ad8];

// day of the year of Easter Sunday (anonymous Gregorian algorithm)
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, dd = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - dd - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mon = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return doyOf(y, mon, day);
}

function doyOf(y, mon, day) {
  const D = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return D[mon - 1] + day + (leap && mon > 2 ? 1 : 0);
}

export const SE = {
  // 0 winter, 1 spring, 2 summer, 3 autumn
  season(d) { return d.mon === 12 || d.mon <= 2 ? 0 : d.mon <= 5 ? 1 : d.mon <= 8 ? 2 : 3; },

  // the special day (EV.*)
  event(d) {
    const md = d.mon * 100 + d.day;
    if (d.cfg.bday > 0 && d.cfg.bday === md) return EV.BIRTHDAY;
    if ((md === 1231 && d.mins >= 1080) || (md === 101 && d.mins < 120)) return EV.NYE;
    if (md >= 1224 && md <= 1226) return EV.XMAS;
    if (md >= 1201 && md <= 1223) return EV.ADVENT;
    if (md === 101) return EV.NEWYEAR;
    const e = easter(d.year);
    if (d.doy >= e - 2 && d.doy <= e + 1) return EV.EASTER;
    if (md === 1031) return EV.HALLOWEEN;
    if (md === 214) return EV.VALENTINE;
    return EV.NONE;
  },

  // reported weather: 0 clear, 1 clouds, 2 rain, 3 snow, 4 storm, 5 fog
  wx(d) {
    const c = d.cond;
    if (c < 0 || c === 0 || c === 23 || c === 39 || c === 22 || c === 1 || c === 51) return 0;
    if (c === 2 || c === 20 || c === 5) return 1;
    if (c === 6 || c === 12 || c === 27 || c === 31 || c === 35 || c === 40 || c === 41) return 4;
    if (c === 4 || c === 7 || c === 16 || c === 17 || c === 18 || c === 19 || c === 21 || c === 33 || c === 42 || c === 43 || c === 45 || c === 46 || c === 47 || c === 50 || c === 10) return 3;
    if (c === 8 || c === 9 || c === 28 || c === 29 || c === 32 || c === 34 || c === 36 || c === 37 || c === 38) return 5;
    return 2;
  },

  // lying snow: it snows, or it is winter and freezing
  snowy(d) { return SE.wx(d) === 3 || (SE.season(d) === 0 && d.temp > -99 && d.temp <= 0); },

  // falling rain or snow inside a box (moving part)
  precip(dc, d, x, y, w, h, t) {
    const k = SE.wx(d);
    if (k !== 2 && k !== 3 && k !== 4) return;
    const snow = k === 3, n = Math.round((w * h) / (snow ? 2600 : 1800));
    dc.setColor(snow ? 0xffffff : 0x9ac8ff, -1);
    for (let i = 0; i < n; i++) {
      const px = x + ((i * 83 + Math.floor(t / (snow ? 60 : 16))) % w);
      const py = y + ((i * 47 + Math.floor(t / (snow ? 22 : 5))) % h);
      if (snow) dc.fillRectangle(px + Math.round(Math.sin(t / 500 + i) * 3), py, 4, 4);
      else dc.fillRectangle(px, py, 2, 10);
    }
    if (k === 4 && Math.floor(t / 90) % 31 === 0) {
      dc.setColor(0xffffff, -1);
      for (let i = 0; i < 5; i++) dc.fillRectangle(x + w * 0.7 - (i % 2) * 10 - i * 3, y + i * 16, 5, 16);
    }
  },

  // a snow cap along the top of a roof or wall
  snowCap(dc, x, y, w) {
    dc.setColor(0xf4f8ff, -1);
    dc.fillRectangle(x, y - 6, w, 7);
    for (let i = 0; i < w; i += 14) dc.fillRectangle(x + i + 2, y - 10, 9, 4);
  },

  // a string of fairy lights sagging from (x0, y0) to (x1, y1), blinking (moving part)
  lights(dc, x0, y0, x1, y1, t) {
    const n = Math.max(3, Math.round(Math.abs(x1 - x0) / 18));
    dc.setColor(0x2a3a2a, -1);
    for (let i = 0; i <= n * 3; i++) {
      const f = i / (n * 3);
      dc.fillRectangle(Math.round(G.lerp(x0, x1, f)), Math.round(G.lerp(y0, y1, f) + Math.sin(f * Math.PI) * 10), 2, 2);
    }
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const on = (Math.floor(t / 500) + i) % 3 !== 0;
      dc.setColor(on ? BULB[i % 5] : G.mix(BULB[i % 5], 0, 0.6), -1);
      dc.fillRectangle(Math.round(G.lerp(x0, x1, f)) - 3, Math.round(G.lerp(y0, y1, f) + Math.sin(f * Math.PI) * 10) + 2, 6, 7);
    }
  },

  // a little Christmas tree standing on (x, y), size s (1, 2, ...)
  tree(dc, x, y, s) {
    dc.setColor(0x5a3a1e, -1);
    dc.fillRectangle(x - 2 * s, y - 6 * s, 4 * s, 6 * s);
    dc.setColor(0x1e7a3a, -1);
    for (let i = 0; i < 4; i++) dc.fillRectangle(x - (14 - i * 3) * s, y - (12 + i * 8) * s, (28 - i * 6) * s, 8 * s);
    dc.setColor(0xffd23a, -1);
    dc.fillRectangle(x - 3 * s, y - 50 * s, 6 * s, 6 * s);
    dc.setColor(0xff3a3a, -1);
    dc.fillRectangle(x - 8 * s, y - 20 * s, 3 * s, 3 * s);
    dc.fillRectangle(x + 5 * s, y - 30 * s, 3 * s, 3 * s);
  },

  // a carved pumpkin standing on (x, y), size s
  pumpkin(dc, x, y, s) {
    dc.setColor(0xf07a1a, -1);
    dc.fillRectangle(x - 10 * s, y - 14 * s, 20 * s, 14 * s);
    dc.fillRectangle(x - 12 * s, y - 11 * s, 24 * s, 8 * s);
    dc.setColor(0x3a7a2a, -1);
    dc.fillRectangle(x - s, y - 18 * s, 3 * s, 4 * s);
    dc.setColor(0xffe05a, -1);
    dc.fillRectangle(x - 6 * s, y - 10 * s, 3 * s, 3 * s);
    dc.fillRectangle(x + 3 * s, y - 10 * s, 3 * s, 3 * s);
    dc.fillRectangle(x - 5 * s, y - 5 * s, 10 * s, 2 * s);
  },

  // three Easter eggs lying on (x, y)
  eggs(dc, x, y) {
    const C = [0xff7aa8, 0x7ad8ff, 0xffe05a];
    for (let i = 0; i < 3; i++) {
      dc.setColor(C[i], -1);
      dc.fillRectangle(x + i * 16, y - 12, 10, 12);
      dc.fillRectangle(x + i * 16 + 2, y - 14, 6, 2);
      dc.setColor(0xffffff, -1);
      dc.fillRectangle(x + i * 16, y - 7, 10, 2);
    }
  },

  // a heart around (x, y), size s
  heart(dc, x, y, s) {
    dc.setColor(0xff3a6a, -1);
    dc.fillRectangle(x - 6 * s, y - 4 * s, 5 * s, 4 * s);
    dc.fillRectangle(x + s, y - 4 * s, 5 * s, 4 * s);
    dc.fillRectangle(x - 6 * s, y, 12 * s, 3 * s);
    dc.fillRectangle(x - 4 * s, y + 3 * s, 8 * s, 2 * s);
    dc.fillRectangle(x - 2 * s, y + 5 * s, 4 * s, 2 * s);
  },

  // birthday balloons tied at (x, y), swaying (moving part)
  balloons(dc, x, y, t) {
    const C = [0xff5ab4, 0x3ab4ff, 0xffd23a];
    for (let i = 0; i < 3; i++) {
      const bx = x - 18 + i * 18 + Math.round(Math.sin(t / 600 + i) * 4), by = y - 64 - (i % 2) * 12;
      dc.setColor(0xd8d8d8, -1);
      dc.fillRectangle(bx, by + 12, 1, y - by - 12);
      dc.setColor(C[i], -1);
      dc.fillRectangle(bx - 8, by - 10, 16, 20);
      dc.fillRectangle(bx - 6, by - 13, 12, 26);
    }
  },

  // a few fireworks bursting in the box (moving part)
  fireworks(dc, x, y, w, h, t) {
    for (let b = 0; b < 2; b++) {
      const per = 1600, k = Math.floor((t + b * 800) / per), age = ((t + b * 800) % per) / per;
      const cx = x + (G.rnd(k * 7 + b) % w), cy = y + (G.rnd(k * 11 + b) % h);
      const R = 34 * G.ease(age);
      dc.setColor(G.mix(BULB[G.rnd(k * 13 + b) % 5], 0, age * 0.9), -1);
      for (let i = 0; i < 12; i++) {
        const an = (i * 2 * Math.PI) / 12;
        dc.fillRectangle(Math.round(cx + Math.cos(an) * R), Math.round(cy + Math.sin(an) * R + age * age * 18), 4, 4);
      }
    }
  },

  // a short greeting for the special day ("" for none)
  greeting(ev) {
    return ["", "FROHEN ADVENT", "FROHE WEIHNACHTEN", "GUTEN RUTSCH!", "FROHES NEUES!", "FROHE OSTERN",
      "HALLOWEEN", "VALENTINSTAG", "ALLES GUTE!"][ev];
  },
};
