// MO — "Mo": a fluffy peach mochi seal pup lives on your time. The fur is pre-rendered
// (tools/render/mo.py); eyes, blinks, glances, the mouth and every effect are drawn live.
// Scenes (one per wrist raise, from the body state and d.wakeN, so every look is new):
//   SIT    sits on the hour or the minute digits, flippers dangling, waves hello
//   PEEK   peeks from behind the minute digits, ducks away and comes back
//   SLEEP  at night (22-6) or with an empty Body Battery: asleep across the time; on a raise he
//          yawns and slides up onto the digits so the time is free within 1.3 s; z's, thought bubble
//   HANG   hangs from the colon and swings
//   PUSH   pushes the newest minute digit into place
//   SPORT  headband and cheering after EFFORT / MOVING / AFTERBURN
// Moods come from the "now" lib: STRESS_SITTING nervous (frizz, sweat drop, fast blinks) and he
// breathes with you (4 s in, 6 s out); RESERVE tired (droopy eyes, yawns); CHARGING cosy (^^, little
// hearts); SITTING_LONG hops and points; WIND_DOWN sleepy with a nightcap; else happy.
// A speech bubble says a short line from Now after the intro. While awake: blinks at natural random
// intervals, glances, breathing bob, flipper wiggles; a new minute rises into place.
// Styles: 1 Nacht (black), 2 Dämmerung (dusk), 3 Kiesel (paper, Pebble bitmap type, pixel bubble).
// Mirrors watch/source/faces/Mo.mc.
import { G } from "../engine/gfx.js";
import { F } from "../engine/fonts.js";
import { St } from "../engine/st.js";
import { NW, NS } from "../engine/now.js";
import { Bmp, AffineTransform, FILTER_MODE_BILINEAR } from "../engine/bmp.js";
import IMG, { M as IM } from "../img/mo.js";

const SIT = 0, PEEK = 1, SLEEP = 2, HANG = 3, PUSH = 4, SPORT = 5;
const POOL = [PEEK, HANG, SIT, PUSH]; // by d.wakeN % 4
const HAPPY = 0, NERVOUS = 1, TIRED = 2, COSY = 3, HOP = 4, SLEEPY = 5, CHEER = 6;
const OPEN = 0, JOY = 1, SHUT = 2; // eye kinds: open, ^^, closed
const MW = 0, MOPEN = 1, MO_ = 2, MWOB = 3, MFLAT = 4; // mouths: "w", open, small o, wobbly, flat
const K = 12; // Kiesel: dot size of the time
const DOW = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const LOOK = [0, -1, 0.8, 0, -0.6, 1]; // glance targets
// per style: [background, digits, date, status, bubble, bubble text, z's]
const PAL = [
  [0x000000, 0xf6f3ee, 0x9e9893, 0x7c7671, 0xfff3e8, 0x3a2626, 0xb4bcff],
  [0x1a1030, 0xfff1e6, 0xe2c6c0, 0xbe9c9e, 0xffeee4, 0x40262e, 0xd8d2ff],
  [0xf1eee6, 0x161616, 0x161616, 0x5e5a54, 0xffffff, 0x161616, 0x4a52a0],
];

// ---- plan of this raise (scene, mood, side), cached per minute and raise
let cK = -1, cD = null, cR = null, cS = SIT, cM = HAPPY, cSide = 0;
// ---- time layout: text, x and advance per char, top, height, centre x
let TS = "", GX = [], GA = [], TY = 216, TH = 103, CI = 2;
// ---- body frame: centre, rotation, scale, squash
let FX = 0, FY = 0, FR = 0, FS = 1, FQX = 1, FQY = 1;
// ---- expression: eye kind, openness, lid, look x/y, mouth kind and amount
let EK = OPEN, EO = 1, LID = 0, LX = 0, LY = 0, MK = MW, MA = 0;
// ---- speech bubble lines (cached per text), the point of Mo the tail points to
let bS = "", bL = [], AX = 227, AY = 150;
let MQ = -1; // progress of a new minute rising into place (-1 none)
let TP = 999999; // ms since a tap (Mo giggles)

function plan(d) {
  const k = (d.doy * 1440 + d.mins) * 8 + (d.wakeN % 8);
  if (k === cK && d === cD) return; // (web: d is rebuilt whenever the simulation changes)
  cK = k;
  cD = d;
  NW.tick(d);
  const R = NW.judge(d);
  cR = R;
  const st = R[0];
  cSide = Math.floor(d.wakeN / 4) % 2;
  cM = HAPPY;
  if (st === NS.STRESS_SITTING) cM = NERVOUS;
  else if (st === NS.RESERVE) cM = TIRED;
  else if (st === NS.CHARGING) cM = COSY;
  else if (st === NS.SITTING_LONG) cM = HOP;
  else if (st === NS.WIND_DOWN) cM = SLEEPY;
  if (d.cfg.anim === 0) { cS = SIT; cSide = 0; cM = HAPPY; }
  else if (d.h >= 22 || d.h < 6 || (R[7] >= 0 && R[7] <= 10)) cS = SLEEP;
  else if (st === NS.EFFORT || st === NS.MOVING || st === NS.AFTERBURN) { cS = SPORT; cM = CHEER; }
  else if (cM === NERVOUS || cM === HOP) cS = SIT;
  else if (cM === TIRED || cM === SLEEPY) cS = d.wakeN % 2 === 0 ? SIT : PEEK; // no gymnastics when tired
  else cS = POOL[d.wakeN % 4];
}

// ------------------------------------------------------------ type
// text from the txt strip (left edge x, cell top y), extra spacing sp; returns the width
function txtW(s, sp) {
  let w = 0;
  for (let i = 0; i < s.length; i++) w += IM.TXT_ADV[Math.max(0, IM.TXT.indexOf(s[i]))] + sp;
  return w - sp;
}

function txt(dc, s, x, y, tint, sp, n) {
  const b = Bmp.load(IMG.txt);
  let cx = x;
  for (let i = 0; i < s.length && i < n; i++) {
    const j = Math.max(0, IM.TXT.indexOf(s[i]));
    if (j > 0) {
      dc.setClip(cx - 2, y, IM.TXT_ADV[j] + 4, IM.TXT_H);
      dc.drawBitmap2(cx - j * IM.TXT_CW - 3, y, b, { tintColor: tint });
      dc.clearClip();
    }
    cx += IM.TXT_ADV[j] + sp;
  }
}

// the time: layout of the chars for the scene and style (x of each char, advances, top)
function lay(d, sc, st) {
  TS = G.timeStr(d);
  CI = TS.indexOf(":");
  GX = []; GA = [];
  let w = 0;
  for (let i = 0; i < TS.length; i++) {
    const a = st === 3 ? (TS[i] === ":" ? 3 * K : 6 * K) : IM.BIG_ADV[TS[i] === ":" ? 10 : TS.charCodeAt(i) - 48] - 3;
    GA.push(a);
    w += a;
  }
  w -= st === 3 ? K : -3;
  TY = sc === HANG ? 140 : 216;
  TH = st === 3 ? 7 * K : IM.BIG_H - IM.BIG_TOP - 6;
  let x = Math.round((sc === PUSH ? 203 : 227) - w / 2);
  for (let i = 0; i < TS.length; i++) { GX.push(x); x += GA[i]; }
  if (st !== 3) for (let i = 0; i < TS.length; i++) GA[i] += 3; // inked width
}

// char i of the time at x, y (top); nothing below yb (a digit rising out of its slot)
function digit(dc, i, x, y, st, col, yb) {
  const ch = TS[i];
  if (st === 3) {
    dc.setColor(col, -1);
    dc.setClip(x - 1, y - 1, 6 * K, yb - y + 1);
    if (ch === ":") {
      dc.fillRectangle(x + K, y + 2 * K, K, K);
      dc.fillRectangle(x + K, y + 5 * K, K, K);
    } else F.px(dc, ch, x, y, K, 0, 0);
    dc.clearClip();
    return;
  }
  const j = ch === ":" ? 10 : ch.charCodeAt(0) - 48;
  dc.setClip(x - 3, y - IM.BIG_TOP, IM.BIG_ADV[j] + 6, Math.min(IM.BIG_H, yb - y + IM.BIG_TOP));
  dc.drawBitmap2(x - j * IM.BIG_CW - 3, y - IM.BIG_TOP, Bmp.load(IMG.big), { tintColor: col });
  dc.clearClip();
}

// solid silhouette of char i in the background colour (Mo behind the digits)
function hull(dc, i, x, y, st) {
  const ch = TS[i];
  if (ch === ":") return;
  if (st === 3) {
    dc.setColor(PAL[2][0], -1);
    dc.fillRectangle(x - 1, y - 1, 5 * K + 2, 7 * K + 2);
    return;
  }
  const j = ch.charCodeAt(0) - 48;
  dc.setClip(x - 3, y - IM.BIG_TOP, IM.BIG_ADV[j] + 6, IM.BIG_H);
  dc.drawBitmap2(x - j * IM.BIG_CW - 3, y - IM.BIG_TOP, Bmp.load(IMG.hull), { tintColor: st === 2 ? IM.DUSK_MID : 0x000000 });
  dc.clearClip();
}

// background of a rectangle (cropped overlays over Mo)
function bgRect(dc, x, y, w, h, st) {
  if (st === 2) {
    dc.setClip(x, y, w, h);
    dc.drawBitmap(0, 0, Bmp.load(IMG.dusk));
    dc.clearClip();
  } else {
    dc.setColor(PAL[st - 1][0], -1);
    dc.fillRectangle(x, y, w, h);
  }
}

// soft contact shadow centred on x, y, w px wide, clipped to the digits (from yc down)
function shadow(dc, x, y, w, yc) {
  const t = new AffineTransform();
  t.scale(w / IM.BLOB_W, w / IM.BLOB_W);
  t.translate(-IM.BLOB_W / 2, -IM.BLOB_H / 2);
  dc.setClip(0, yc, 454, 60);
  dc.drawBitmap2(x, y, Bmp.load(IMG.blob), { transform: t, filterMode: FILTER_MODE_BILINEAR });
  dc.clearClip();
}

// ------------------------------------------------------------ Mo's body frame
function frame(x, y, r, s, qx, qy) { FX = x; FY = y; FR = r; FS = s; FQX = qx; FQY = qy; }
function bx(lx, ly) { const u = lx * IM.S * FS * FQX, v = ly * IM.S * FS * FQY; return FX + u * Math.cos(FR) - v * Math.sin(FR); }
function by(lx, ly) { const u = lx * IM.S * FS * FQX, v = ly * IM.S * FS * FQY; return FY + u * Math.sin(FR) + v * Math.cos(FR); }

// a body bitmap (or overlay) whose body centre is at ox, oy
function body(dc, b, ox, oy) {
  if (FR === 0 && FS * FQX === 1 && FS * FQY === 1) {
    dc.drawBitmap(Math.round(FX - ox), Math.round(FY - oy), b);
    return;
  }
  const t = new AffineTransform();
  t.rotate(FR);
  t.scale(FS * FQX, FS * FQY);
  t.translate(-ox, -oy);
  dc.drawBitmap2(FX, FY, b, { transform: t, filterMode: FILTER_MODE_BILINEAR });
}

// a flipper turned around its pivot at body point lx, ly (deg: 0 = hanging down)
function limb(dc, lx, ly, deg, s) {
  const t = new AffineTransform();
  t.rotate(FR + (deg * Math.PI) / 180);
  t.scale(FS * s, FS * s);
  t.translate(-IM.FLIP_PX, -IM.FLIP_PY);
  dc.drawBitmap2(bx(lx, ly), by(lx, ly), Bmp.load(IMG.flip), { transform: t, filterMode: FILTER_MODE_BILINEAR });
}

// a long arm (hanging), turned around its shoulder at body point lx, ly
function arm(dc, lx, ly, deg) {
  const t = new AffineTransform();
  t.rotate(FR + (deg * Math.PI) / 180);
  t.scale(FS, FS);
  t.translate(-IM.ARM_PX, -IM.ARM_PY);
  dc.drawBitmap2(bx(lx, ly), by(lx, ly), Bmp.load(IMG.arm), { transform: t, filterMode: FILTER_MODE_BILINEAR });
}

// the nightcap, cuff centre at body point lx, ly
function cap(dc, lx, ly, deg, s) {
  const t = new AffineTransform();
  t.rotate(FR + (deg * Math.PI) / 180);
  t.scale(FS * s, FS * s);
  t.translate(-IM.CAP_PX, -IM.CAP_PY);
  dc.drawBitmap2(bx(lx, ly), by(lx, ly), Bmp.load(IMG.cap), { transform: t, filterMode: FILTER_MODE_BILINEAR });
}

// ------------------------------------------------------------ face (live)
// eyes and mouth; fx, fy = face offset in body units (lying pose: -16, -2)
function face(dc, fx, fy) {
  const k = IM.S * FS;
  const rx = IM.EYE[2] * k, ry = IM.EYE[3] * k;
  dc.setPenWidth(Math.max(2, Math.round(1.9 * FS)));
  for (let sx = -1; sx <= 1; sx += 2) {
    const cx = bx(fx + sx * IM.EYE[0], fy + IM.EYE[1]) + LX * 2.6 * FS;
    const cy = by(fx + sx * IM.EYE[0], fy + IM.EYE[1]) + LY * 2 * FS;
    if (EK === JOY) {
      dc.setColor(0x2a1416, -1);
      dc.setPenWidth(Math.max(2, Math.round(3 * FS)));
      dc.drawArc(cx, cy + ry * 0.35, rx * 0.9, 0, 25, 155);
    } else if (EK === SHUT || EO < 0.22) {
      dc.setColor(0x2a1416, -1);
      dc.setPenWidth(Math.max(2, Math.round(2.6 * FS)));
      dc.drawArc(cx, cy - ry * 0.25, rx * 0.95, 0, 205, 335);
    } else {
      const h = ry * EO;
      if (LID > 0) { lids(dc, cx, cy, rx, h); continue; }
      dc.setColor(0x2e2940, -1);
      dc.fillEllipse(cx, cy, rx, h);
      dc.setColor(0x0b0812, -1);
      dc.fillEllipse(cx, cy - h * 0.1, rx * 0.93, h * 0.86);
      if (EO > 0.45) {
        dc.setColor(0xffffff, -1);
        dc.fillEllipse(cx - rx * 0.3 + LX * 1.2, cy - h * 0.38, rx * 0.34, h * 0.3);
        dc.fillCircle(cx + rx * 0.36, cy + h * 0.38, Math.max(1.5, rx * 0.15));
      }
    }
  }
  // mouth
  const mx = bx(fx, fy + 10.6), my = by(fx, fy + 10.6);
  dc.setColor(0x3a1a1a, -1);
  dc.setPenWidth(Math.max(2, Math.round(1.8 * FS)));
  if (MK === MW) {
    const r = 3.1 * k;
    dc.drawArc(mx - r, my, r, 0, 185, 360);
    dc.drawArc(mx + r, my, r, 0, 180, 355);
  } else if (MK === MOPEN) {
    const w = 5.2 * k * (0.55 + 0.45 * MA), h = 6.4 * k * MA + 1.5;
    dc.setColor(0x5a1420, -1);
    dc.fillEllipse(mx, my + h * 0.55, w, h);
    if (MA > 0.35) {
      dc.setColor(0xff7480, -1);
      dc.fillEllipse(mx, my + h * 1.05, w * 0.6, h * 0.42);
    }
  } else if (MK === MO_) {
    dc.setColor(0x5a1420, -1);
    dc.fillEllipse(mx, my + 2.5 * k, 2.1 * k, 2.3 * k);
  } else if (MK === MWOB) {
    let x0 = mx - 6 * k, y0 = my + 2.4 * k;
    for (let i = 1; i <= 6; i++) {
      const x1 = mx - 6 * k + i * 2 * k, y1 = my + 2.4 * k + (i % 2 === 0 ? 1 : -1) * 1.1 * k;
      dc.drawLine(x0, y0, x1, y1);
      x0 = x1; y0 = y1;
    }
  } else {
    dc.drawArc(mx, my + 5.6 * k, 3.2 * k, 0, 45, 135); // a small pout
  }
}

// heavy-lidded eye: the part of the eye below a curved lid line (as a polygon), a small highlight
// and a lash line along the lid
function lids(dc, cx, cy, rx, h) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const u = -1 + i / 4, e = h * Math.sqrt(Math.max(0, 1 - u * u));
    pts.push([cx + u * rx, Math.min(cy + e, Math.max(cy - e, cy - h * (1 - 2 * LID) + h * 0.25 * (1 - u * u)))]);
  }
  for (let i = 7; i >= 1; i--) {
    const u = -1 + i / 4;
    pts.push([cx + u * rx, cy + h * Math.sqrt(1 - u * u)]);
  }
  dc.setColor(0x0b0812, -1);
  dc.fillPolygon(pts);
  dc.setColor(0xffffff, -1);
  dc.fillCircle(cx + rx * 0.36, cy + h * 0.38, Math.max(1.5, rx * 0.15));
  dc.setColor(0x6a3a30, -1);
  dc.setPenWidth(2);
  for (let i = 1; i < 8; i++) dc.drawLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
}

// ------------------------------------------------------------ effects
function drop(dc, x, y, s) {
  dc.setColor(0x8fd0ff, -1);
  dc.fillCircle(x, y, 4 * s);
  dc.fillPolygon([[x - 3.7 * s, y - 1.4 * s], [x, y - 9.5 * s], [x + 3.7 * s, y - 1.4 * s]]);
  dc.setColor(0xffffff, -1);
  dc.fillCircle(x - 1.4 * s, y - 0.6 * s, 1.3 * s);
}

function spark(dc, x, y, r, col) {
  const q = r * 0.25;
  dc.setColor(col, -1);
  dc.fillPolygon([[x, y - r], [x + q, y - q], [x + r, y], [x + q, y + q], [x, y + r], [x - q, y + q], [x - r, y], [x - q, y - q]]);
}

function heart(dc, x, y, r, col) {
  dc.setColor(col, -1);
  dc.fillCircle(x - r * 0.5, y, r * 0.55);
  dc.fillCircle(x + r * 0.5, y, r * 0.55);
  dc.fillPolygon([[x - r * 1.04, y + r * 0.15], [x + r * 1.04, y + r * 0.15], [x, y + r * 1.15]]);
}

// nervous fur: little zigzag tufts standing up around the head (flicker with t)
function frizz(dc, t, st) {
  dc.setColor(st === 3 ? 0xd88a68 : 0xffcfb0, -1);
  dc.setPenWidth(2);
  for (let i = 0; i < 7; i++) {
    const a = ((-160 + i * 23.3 + 6 * G.noise(t / 160 + i * 3.1)) * Math.PI) / 180;
    const c = Math.cos(a), s = Math.sin(a);
    const r0 = 47 + (i % 2) * 4;
    let x0 = bx(c * r0, -10 + s * r0 * 0.98), y0 = by(c * r0, -10 + s * r0 * 0.98);
    for (let j = 1; j <= 3; j++) {
      const rr = r0 + j * 3.2, o = (j % 2 === 0 ? 2.2 : -2.2);
      const x1 = bx(c * rr - s * o, -10 + s * rr + c * o), y1 = by(c * rr - s * o, -10 + s * rr + c * o);
      dc.drawLine(x0, y0, x1, y1);
      x0 = x1; y0 = y1;
    }
  }
}

function zs(dc, x, y, t, col) {
  for (let i = 0; i < 3; i++) {
    let q = t / 2600 + i / 3;
    q -= Math.floor(q);
    const h = 9 + q * 12;
    dc.setColor(G.mix(col, cbg, q * q), -1);
    F.st(dc, "Z", x - q * 34 + 4 * Math.sin(q * 6), y - q * 50, h, 2, 1, 1.0, 0);
  }
}

// ------------------------------------------------------------ idle life (pure functions of t)
// blink: closure 0..1 at time t (ms of the idle window), intervals iv .. 2.4 iv, seeded
function blink(t, seed, iv) {
  if (t < 0) return 0;
  let s = G.rnd(seed * 31 + 7);
  let at = 700 + (s % 900);
  for (let i = 0; i < 30 && at <= t; i++) {
    const dt = t - at;
    if (dt < 180) return 1 - Math.abs(dt - 90) / 90;
    s = G.rnd(s);
    at += iv + Math.floor(G.rf(s) * iv * 1.4);
  }
  return 0;
}

// eye direction -1..1: holds a target for 1.2..3 s, glides 220 ms to the next
function glance(t, seed) {
  if (t < 0) return 0;
  let s = G.rnd(seed * 17 + 3);
  let at = 0, prev = 0, cur = 0;
  for (let i = 0; i < 20; i++) {
    s = G.rnd(s);
    const nx = at + 1200 + (s % 1800);
    if (t < nx) break;
    prev = cur;
    s = G.rnd(s);
    cur = LOOK[s % 6];
    at = nx;
  }
  return G.lerp(prev, cur, G.easeInOut((t - at) / 220));
}

// breathing guide 0..1: 4 s in, 6 s out
function breath(t) {
  const ph = t % 10000;
  return ph < 4000 ? G.easeInOut(ph / 4000) : 1 - G.easeInOut((ph - 4000) / 6000);
}

// a bump 0..1..0 over [a, b]
function win(t, a, b) { return t < a || t > b ? 0 : Math.sin((Math.PI * (t - a)) / (b - a)); }

// expression for the mood (tt = idle ms or -1 when still), seed = d.wakeN
function expr(tt, seed) {
  EK = OPEN; EO = 1; LID = 0; LY = 0; MK = MW; MA = 0;
  LX = glance(tt, seed);
  let iv = 1900;
  if (cM === NERVOUS) { iv = 750; MK = MWOB; }
  else if (cM === TIRED) { LID = 0.3; MK = MFLAT; iv = 2600; }
  else if (cM === SLEEPY) { LID = 0.36; MK = MO_; iv = 2800; }
  else if (cM === COSY) { EK = JOY; }
  else if (cM === HOP) { MK = MOPEN; MA = 0.35; }
  else if (cM === CHEER) { EK = JOY; MK = MOPEN; MA = 0.75; }
  EO = 1 - blink(tt, seed, iv);
  if (cM === COSY && win(tt, 2200, 3600) + win(tt, 6500, 7600) > 0) EK = OPEN; // peeks out of the cosy smile
  // yawns (tired, sleepy)
  const yw = cM === TIRED ? win(tt, 4800, 6400) : cM === SLEEPY ? win(tt, 1500, 3000) : 0;
  if (yw > 0) { MK = MOPEN; MA = yw; if (yw > 0.3) EK = SHUT; }
  // happy: a short ^^ smile now and then
  if (cM === HAPPY && (win(tt, 0, 1300) > 0 || win(tt, 5200, 6000) > 0)) EK = JOY;
  // a new minute: he looks at it, then smiles
  if (MQ >= 0 && MQ < 1.6 && cS !== SLEEP) { LX = 1; LY = 0.3; if (MQ > 0.9) EK = JOY; }
  // tapped: giggles
  if (TP < 1500) { EK = JOY; MK = MOPEN; MA = 0.6; }
}

// ------------------------------------------------------------ Mo (sitting body)
// arms: angle of the left / right flipper (deg, 0 = hanging), legs: extra swing of each leg
function moSit(dc, d, aL, aR, lL, lR, tt) {
  const band = cS === SPORT;
  // raised arms are long and come from behind the body; resting flippers lie in front
  if (aL > 90) arm(dc, -42, -2, aL);
  if (aR < -90) arm(dc, 42, -2, aR);
  body(dc, Bmp.load(IMG.body), IM.BODY_OX, IM.BODY_OY);
  if (band) body(dc, Bmp.load(IMG.band), IM.BAND_OX, IM.BAND_OY);
  limb(dc, -15.5, 47.5, 10 + lL, 1);
  limb(dc, 16.2, 49.5, -12 + lR, 1);
  face(dc, 0, 0);
  if (aL <= 90) limb(dc, -44.9, 18.3, aL, 0.95);
  if (aR >= -90) limb(dc, 44.9, 18.3, aR, 0.95);
  if (cM === SLEEPY) cap(dc, 2, -40, -8, 1);
  moodFx(dc, tt);
}

function moodFx(dc, tt) {
  const t = tt < 0 ? 0 : tt;
  if (cM === NERVOUS) {
    frizz(dc, t, cST);
    const q = (t % 1800) / 1800;
    drop(dc, bx(44, -30 + q * 10), by(44, -30 + q * 10), FS);
  } else if (cM === CHEER) {
    for (let i = 0; i < 3; i++) {
      const tw = tt < 0 ? 0.8 : 0.55 + 0.45 * Math.sin(t / 220 + i * 2.1);
      spark(dc, bx([-80, 66, -86][i], [-60, -56, -26][i]), by([-80, 66, -86][i], [-60, -56, -26][i]), [6, 4.5, 3.5][i] * tw * FS, 0xffe07a);
    }
    if (cR[0] !== NS.MOVING) drop(dc, bx(42, -26), by(42, -26), FS);
  } else if (cM === COSY && tt >= 0) {
    const q = (t % 3400) / 3400;
    if (q < 0.8) heart(dc, bx(34 + 8 * Math.sin(q * 7), -50 - q * 46), by(34 + 8 * Math.sin(q * 7), -50 - q * 46), (4 + q * 3) * FS, G.mix(0xff6f8e, cbg, q * q));
  }
  if (TP < 1500) {
    const q = TP / 1500;
    heart(dc, bx(-6 * Math.sin(q * 9), -64 - q * 44), by(-6 * Math.sin(q * 9), -64 - q * 44), (5 + q * 3) * FS, G.mix(0xff6f8e, cbg, q * q));
  }
}

let cbg = 0, cST = 1; // background colour for fades, style

// ------------------------------------------------------------ scenes
// seat point on the digits, legs swing, waving / pointing / cheering arms
function sceneSit(dc, d, a, tt) {
  const p = a.intro;
  const x = cSide === 0 ? (GX[0] + GX[CI - 1] + GA[CI - 1]) / 2 : (GX[CI + 1] + GX[TS.length - 1] + GA[TS.length - 1]) / 2;
  const sx = Math.round(x) + (cSide === 0 ? 16 : -10), sy = TY + 1;
  // drop in from above, squash on landing
  let dy = 0, qx = 1, qy = 1;
  if (p < 0.5) dy = -260 * (1 - Math.pow(p / 0.5, 2));
  else if (p < 0.78) { const q = Math.sin((Math.PI * (p - 0.5)) / 0.28); qy = 1 - 0.13 * q; qx = 1 + 0.09 * q; }
  let s = 1;
  if (cM === NERVOUS && tt >= 0) s = 1 + 0.07 * breath(tt);
  else if (tt >= 0) qy = 1 + 0.012 * Math.sin(tt / 520);
  if (cM === HOP && tt >= 0) dy = -Math.round(13 * Math.abs(Math.sin((Math.PI * tt) / 950)));
  if (cS === SPORT && tt >= 0 && cR[0] === NS.EFFORT) dy = -Math.round(8 * Math.abs(Math.sin((Math.PI * tt) / 700)));
  if (dy > -150) shadow(dc, sx, TY + 3, 120 + dy * 0.5, TY); // contact shadow, grows as he lands
  frame(sx, sy + dy - 44 * IM.S * s * qy, 0, s, qx, qy);
  expr(tt, d.wakeN);
  if (p < 0.5) { EK = OPEN; EO = 1; MK = MOPEN; MA = 0.55; LY = -1; }
  else if (p < 0.85) { EK = SHUT; MK = MW; }
  // legs: swing (decays to rest at the end of the intro), then dangle while awake
  let sw = p >= 0.5 && p < 1 ? 16 * (1 - p) * 2 * Math.sin((p - 0.5) * 26) : 0;
  if (tt >= 0) sw = 13 * Math.sin(tt / 210);
  if (cM === HOP && tt >= 0) sw = 10 * Math.sin(tt / 150);
  // arms
  let aL = 28, aR = -28;
  if (p < 0.5) { aL = 120; aR = -120; }
  if (cS === SPORT) {
    aL = 140;
    if (tt >= 0 && cR[0] !== NS.AFTERBURN) {
      aL = 140 + 18 * Math.sin(tt / 140);
      aR = -140 + 18 * Math.sin(tt / 140 + 3.1);
    }
  } else if (cM === HOP) aR = -122 - (tt >= 0 ? 8 * Math.sin(tt / 120) : 0);
  else if (cM === HAPPY && tt >= 0 && tt < 1500) aR = -150 + 20 * Math.sin(tt / 95); // waves hello
  else if (tt >= 0) aL = 28 + 12 * win(tt % 7000, 3600, 4300) * Math.sin(tt / 60); // flipper wiggle
  AX = FX; AY = FY - dy; // the bubble stays put while he hops
  moSit(dc, d, aL, aR, sw, -sw, tt);
}

// rises from behind the minute digits, paws on the edge, ducks away and comes back
function scenePeek(dc, d, a, tt, st) {
  const p = a.intro;
  const i3 = CI + 1, i4 = TS.length - 1;
  const ex = GX[i3] + GA[i3] + 4, ey = TY - 9;
  let dy = 120 * (1 - G.spring(G.clamp((p - 0.12) / 0.6, 0, 1)));
  if (tt >= 0) {
    const c = tt % 8000;
    if (c > 4800 && c < 7000) { // after the bubble: ducks away and comes back
      dy = c < 5200 ? 120 * G.easeInOut((c - 4800) / 400) : c < 6100 ? 120 : 120 * (1 - G.spring((c - 6100) / 900));
    }
  }
  const r = (12 * Math.PI) / 180;
  // anchor = body point (0, 12) turned by 12 deg
  const ax = -Math.sin(r) * 12 * IM.S * 0.95, ay = Math.cos(r) * 12 * IM.S * 0.95;
  frame(ex - ax, ey - ay + dy, r, 0.95, 1, 1);
  expr(tt, d.wakeN);
  LX = tt >= 0 ? LX : -0.6;
  LID = 0;
  AX = FX; AY = FY - dy; // the bubble stays put while he ducks
  dc.setClip(0, 0, 454, TY + TH);
  body(dc, Bmp.load(IMG.body), IM.BODY_OX, IM.BODY_OY);
  face(dc, 0, 0);
  if (cM === SLEEPY) cap(dc, 2, -40, -8, 1);
  moodFx(dc, tt);
  dc.clearClip();
  // the digits in front of him: a plate in the background colour (the upper edge follows the solid
  // silhouettes of the digits), then the digits
  bgRect(dc, GX[i3] - 6, TY + 24, GX[i4] + GA[i4] - GX[i3] + 12, TH - 22, st);
  hull(dc, i3, GX[i3], TY, st);
  hull(dc, i4, GX[i4], TY, st);
  digit(dc, i3, GX[i3], TY, st, PAL[st - 1][1], 999);
  digit(dc, i4, GX[i4], TY, st, PAL[st - 1][1], 999);
  // paws on the edge
  if (dy < 26) {
    const k = 1 - dy / 26;
    frame(0, 0, 0, 1, 1, 1);
    limb(dc, (GX[i3] + GA[i3] - 24) / IM.S, (TY - 7 + dy * 0.6) / IM.S, -12, 0.72 * k + 0.01);
    limb(dc, (GX[i4] + 24) / IM.S, (TY - 6 + dy * 0.6) / IM.S, 14, 0.72 * k + 0.01);
  }
}

// asleep across the time; a raise: he yawns and slides up onto the digits
function sceneSleep(dc, d, a, tt) {
  const p = a.intro;
  const sx = GX[CI] + GA[CI] / 2, sy = TY + 1;
  const q = G.easeInOut(G.clamp((p - 0.38) / 0.5, 0, 1));
  const dy = 58 * (1 - q);
  const rot = 0.13 * Math.sin(Math.PI * q);
  const yawn = win(p, 0.08, 0.5);
  let qy = 1 + 0.03 * yawn, qx = 1 + 0.05 * yawn;
  if (tt >= 0) qy = 1 + 0.028 * Math.sin(tt / 640);
  frame(sx, sy + dy - 34 * IM.S * qy, rot, 1, qx, qy);
  AX = FX; AY = FY;
  EK = SHUT; EO = 0; LID = 0; LX = 0; LY = 0; MK = MO_; MA = 0;
  if (yawn > 0) { MK = MOPEN; MA = yawn; }
  if (tt >= 0 && win(tt, 5200, 5800) > 0.2) MK = MW; // smiles in his sleep
  body(dc, Bmp.load(IMG.lie), IM.LIE_OX, IM.LIE_OY);
  face(dc, -16, -2);
  if (d.h >= 21 || d.h < 6) cap(dc, -24, -28, -24, 0.74);
  if (p >= 0.85 || tt >= 0) zs(dc, bx(-62, -30), by(-62, -30), tt < 0 ? 900 : tt, PAL[d.cfg.style - 1][6]);
}

// hangs from the colon by one flipper and swings, the other flipper waves
function sceneHang(dc, d, a, tt, st) {
  const p = a.intro;
  const gx = GX[CI] + GA[CI] / 2;
  const gy = st === 3 ? TY + 5 * K + K / 2 : TY - IM.BIG_TOP + IM.BIG_DOT;
  let ph = 0.5 * Math.pow(1 - p, 1.5) * Math.cos(2 * Math.PI * 1.6 * p);
  if (tt >= 0) ph = 0.09 * Math.sin(tt / 330);
  // the hand at body point (-50.6, -66.9) holds the dot; at rest the body hangs tilted by 0.647 rad
  const r = 0.647 + ph;
  const hx = -50.6 * IM.S, hy = -66.9 * IM.S;
  frame(gx - (hx * Math.cos(r) - hy * Math.sin(r)), gy - (hx * Math.sin(r) + hy * Math.cos(r)), r, 1, 1, 1);
  AX = FX; AY = FY;
  expr(tt, d.wakeN);
  if (p < 0.75) { EK = JOY; MK = MOPEN; MA = 0.6; }
  LY = tt >= 0 ? LY : -0.3;
  arm(dc, -34, -34, 153.2);
  body(dc, Bmp.load(IMG.body), IM.BODY_OX, IM.BODY_OY);
  const kick = tt >= 0 ? 12 * Math.sin(tt / 260) : -ph * 40;
  limb(dc, -15.5, 47.5, 10 - 37 + kick, 1);
  limb(dc, 16.2, 49.5, -12 - 37 - kick, 1);
  face(dc, 0, 0);
  moodFx(dc, tt);
  limb(dc, 44.9, 18.3, tt >= 0 ? -60 + 25 * Math.sin(tt / 110) * win(tt % 5000, 0, 1600) : -50, 0.95);
}

// stomps the newest minute digit down into place (on the raise, and on a new minute while awake)
function scenePush(dc, d, a, tt, st, mq) {
  const p = a.intro;
  const i = TS.length - 1;
  const R0 = 46; // how far the new digit sticks out
  let off = 0, dy = 0, qy = 1, qx = 1;
  if (mq >= 0) {
    off = Math.round(R0 * (1 - G.ease(G.clamp((mq - 0.35) / 0.5, 0, 1))));
    dy = -Math.round(30 * win(mq, 0, 0.4));
  } else if (p < 1) {
    off = p < 0.38 ? R0 : p < 0.5 ? Math.round(R0 * (1 - 0.5 * G.ease((p - 0.38) / 0.12))) : p < 0.72 ? R0 / 2
      : Math.round((R0 / 2) * (1 - G.ease((p - 0.72) / 0.1)));
    if (p < 0.38) dy = -Math.round(260 * (1 - Math.pow(p / 0.38, 2)));
    dy -= Math.round(30 * win(p, 0.52, 0.72));
    const sq = win(p, 0.38, 0.5) + win(p, 0.72, 0.84);
    qy = 1 - 0.14 * sq; qx = 1 + 0.1 * sq;
  } else if (tt >= 0) {
    const c = tt % 6500;
    dy = -Math.round(18 * win(c, 3000, 3450));
    off = -Math.round(3 * win(c, 3420, 3600));
  }
  if (off !== 0) {
    bgRect(dc, GX[i] - 4, TY - R0 - 8, GA[i] + 8, TH + R0 + 12, st);
    digit(dc, i, GX[i], TY - off, st, PAL[st - 1][1], 999);
  }
  const sx = Math.round(GX[i] + GA[i] / 2) - 6, sy = TY - off + 1;
  if (dy > -40) shadow(dc, sx, sy + 2, 110 + dy, sy);
  frame(sx, sy + dy - 44 * IM.S * qy, 0, 1, qx, qy);
  AX = FX; AY = FY - dy;
  expr(tt, d.wakeN);
  const busy = (mq >= 0 && mq < 0.9) || (mq < 0 && p < 0.84);
  if (busy) { EK = win(p, 0.38, 0.5) + win(p, 0.72, 0.84) > 0 ? SHUT : OPEN; MK = MWOB; LY = 1; }
  else if (mq < 0 && p < 1) { EK = JOY; MK = MOPEN; MA = 0.7; }
  let aL = 28, aR = -28;
  if (busy) { aL = 120; aR = -120; } else if (mq < 0 && p < 1) { aL = 145; aR = -145; }
  else if (tt >= 0 && tt < 1300) { aL = 145 + 14 * Math.sin(tt / 90); aR = -145 - 14 * Math.sin(tt / 90); }
  const sw = tt >= 0 ? 12 * Math.sin(tt / 230) : 0;
  moSit(dc, d, aL, aR, sw + (dy < -4 ? 30 : 0), -sw - (dy < -4 ? 30 : 0), tt);
}

// ------------------------------------------------------------ speech bubble
// lines of the bubble (cached): the tip of Now in two lines, else its first sentence, else the headline
function say(d, wr) {
  const tip = NW.tip(d, cR, d.wakeN);
  const key = tip + wr;
  if (key === bS) return;
  bS = key;
  let L = NW.wrap(tip, wr);
  if (L.length > 2 && cS !== HANG && cST !== 3) L = NW.wrap(tip, wr + 3); // a little wider
  if (L.length > 2) {
    let e = -1;
    for (let i = 4; i < tip.length - 1; i++) {
      const c = tip[i];
      if ((c === "." || c === "!" || c === "?") && tip[i + 1] === " ") { e = i; break; }
    }
    if (e > 0) L = NW.wrap(tip.substring(0, e + 1), wr);
  }
  if (L.length > 2) L = NW.wrap(NW.head(cR), wr);
  bL = L;
}

// bubble at box x, y (w x h) with the tail tip at tx, ty; k = pop 0..1, n = chars typed so far;
// think: a thought bubble (two dots instead of the tail)
function bubble(dc, x, y, w, h, tx, ty, k, n, st, think) {
  const P = PAL[st - 1];
  const X = Math.round(tx + (x - tx) * k), Y = Math.round(ty + (y - ty) * k);
  const W = Math.round(w * k), H = Math.round(h * k);
  if (W < 6 || H < 6) return;
  const bx0 = G.clamp(tx, X + 14, X + W - 14);
  if (st === 3) {
    dc.setColor(0x161616, -1);
    dc.fillRectangle(X - 2, Y - 2, W + 4, H + 4);
    if (!think) for (let i = 0; i < 4; i++) dc.fillRectangle(bx0 - 6 + i * 2 + (tx > bx0 ? i * 2 : 0), Y + H, 10 - i * 2, 4 + i * 3);
    dc.setColor(P[4], -1);
    dc.fillRectangle(X, Y, W, H);
  } else {
    dc.setColor(P[4], -1);
    dc.fillRoundedRectangle(X, Y, W, H, Math.min(14, H / 2));
    if (!think) {
      if (ty > Y + H) dc.fillPolygon([[bx0 - 8, Y + H - 2], [bx0 + 8, Y + H - 2], [tx, ty]]);
      else if (tx < X) dc.fillPolygon([[X + 2, Y + H / 2 - 8], [X + 2, Y + H / 2 + 8], [tx, ty]]);
      else dc.fillPolygon([[X + W - 2, Y + H / 2 - 8], [X + W - 2, Y + H / 2 + 8], [tx, ty]]);
    }
  }
  if (think) {
    dc.setColor(st === 3 ? 0x161616 : P[4], -1);
    dc.fillCircle(G.lerp(bx0, tx, 0.45), G.lerp(Y + H + 4, ty, 0.45), 5 * k);
    dc.fillCircle(tx, ty, 3 * k);
  }
  if (k < 0.98) return;
  let left = n;
  for (let i = 0; i < bL.length && left > 0; i++) {
    const s = bL[i];
    if (st === 3) {
      dc.setColor(P[5], -1);
      F.px(dc, s.length > left ? s.substring(0, left) : s, x + 10, y + 9 + i * 20, 2, 0, 0);
    } else txt(dc, s, Math.round(x + w / 2 - txtW(s, 0) / 2), y + 6 + i * 21, P[5], 0, left);
    left -= s.length;
  }
}

// where the bubble goes for the scene: [box x, y, tail x, y, wrap, side (0 right of Mo, 1 left)]
function speak(dc, d, tt, st, txtOverride) {
  if (txtOverride === "") say(d, cS === HANG ? (st === 3 ? 12 : 15) : st === 3 ? 15 : 18);
  else { bL = [txtOverride]; bS = ""; }
  let w = 0;
  for (let i = 0; i < bL.length; i++) w = Math.max(w, st === 3 ? F.pxW(bL[i], 2) : txtW(bL[i], 0));
  w += 22;
  const h = bL.length * (st === 3 ? 20 : 21) + (st === 3 ? 14 : 12);
  let x, y, tx, ty;
  if (cS === SLEEP) { x = AX + 22; y = AY - 40 - h; tx = AX + 24; ty = AY - 30; }
  else if (cS === HANG && st === 3) { x = AX - 74 - w; y = AY - 40; tx = AX - 58; ty = AY - 22; }
  else if (cS === HANG) { x = AX + 64; y = AY - 34; tx = AX + 52; ty = AY - 16; }
  else {
    const right = AX < 227;
    x = right ? AX + 66 : AX - 66 - w;
    y = AY - 100;
    tx = right ? AX + 52 : AX - 52;
    ty = AY - 48;
  }
  // keep the box inside the round screen
  for (let i = 0; i < 24; i++) {
    let out = false;
    for (let c = 0; c < 4; c++) {
      const cx = c % 2 === 0 ? x : x + w, cy = c < 2 ? y : y + h;
      if ((cx - 227) * (cx - 227) + (cy - 227) * (cy - 227) > 216 * 216) out = true;
    }
    if (!out) break;
    x += x + w / 2 < 227 ? 4 : -4;
    y += y + h / 2 < 227 ? 4 : -4;
  }
  x = Math.round(x); y = Math.round(y);
  const T0 = 300, T1 = txtOverride === "" ? 4300 : 99999;
  let k = G.spring(G.clamp((tt - T0) / 260, 0, 1));
  if (tt > T1) k = 1 - G.ease((tt - T1) / 220);
  if (k <= 0) return;
  const n = txtOverride === "" ? Math.floor((tt - T0 - 200) / 28) : 99;
  bubble(dc, x, y, w, h, Math.round(tx), Math.round(ty), k, n, st, cS === SLEEP);
}

// heart that beats with the pulse: 1 on the beat, 0.5 on the second knock, else 0
function beat(t, bpm) {
  const per = Math.floor(60000 / (bpm > 30 ? bpm : 60));
  const ph = (t % per) / per;
  return ph < 0.14 ? 1 : ph >= 0.2 && ph < 0.3 ? 0.5 : 0;
}

export default {
  fps: 15,
  reveal() { return false; },
  // Mo leads a breathing exercise himself when you are tense
  breathes: true,

  // static layer: background, time, contact shadow, date, battery. Keyed by the minute and the plan
  // of this raise (scene and side depend on the state and d.wakeN).
  bgKey(d) {
    plan(d);
    return ((d.doy * 1440 + d.mins) * 6 + cS) * 2 + cSide;
  },

  // touch (and hold): Mo giggles and a heart floats up
  tap(x, y, d) { return true; },

  draw(dc, d, a) {
    const S = !a.bg, M = !a.so; // draw the static / the moving parts
    const st = G.clamp(d.cfg.style, 1, 3);
    const P = PAL[st - 1];
    plan(d);
    lay(d, cS, st);
    cbg = st === 2 ? 0x24163a : P[0];
    cST = st;
    const dy = cS === HANG ? TY - 66 : TY + TH + 22; // date line (status 26 below, or above for HANG)
    const sy = cS === HANG ? dy - 26 : dy + 27;
    if (S) {
      if (st === 2) dc.drawBitmap(0, 0, Bmp.load(IMG.dusk));
      else if (st === 3) { dc.setColor(P[0], -1); dc.fillRectangle(0, 0, 454, 454); }
      for (let i = 0; i < TS.length; i++) digit(dc, i, GX[i], TY, st, P[1], 999);
      if (cS === SLEEP) shadow(dc, GX[CI] + GA[CI] / 2, TY + 3, 210, TY);
      // date, battery
      if (st === 3) {
        const ds = DOW[d.dow] + " " + d.day + "." + d.mon + ".";
        dc.setColor(P[2], -1);
        F.px(dc, ds, 227, dy, 3, 1, 0);
        dc.setColor(P[3], -1);
        F.px(dc, d.batt + "%", 239, sy + 4, 2, 0, 0);
      } else {
        const ds = d.dowStr + " " + d.day + ". " + d.monStr;
        txt(dc, ds, Math.round(227 - txtW(ds, 1.5) / 2), dy, P[2], 1.5, 99);
        dc.setColor(P[3], -1);
        dc.setPenWidth(2);
        dc.drawRoundedRectangle(239, sy + 7, 19, 11, 3);
        dc.fillRectangle(258, sy + 10, 2, 5);
        dc.fillRectangle(242, sy + 10, Math.max(1, Math.round((13 * G.clamp(d.batt, 0, 100)) / 100)), 5);
        txt(dc, d.batt + " %", 265, sy, P[3], 0, 99);
      }
    }

    if (!M) return;
    const tt = a.live && a.t > 1400 ? a.t - 1400 : -1;
    // ---- live pulse with a beating heart (left of the centre)
    const hr = d.hrNow();
    const hs = hr > 0 ? "" + hr : "--";
    const b = a.live ? beat(a.t, hr) : 0;
    const hc = st === 3 ? 0x161616 : 0xff6f8e;
    if (st === 3) {
      dc.setColor(P[3], -1);
      F.px(dc, hs, 215 - F.pxW(hs, 2), sy + 4, 2, 0, 0);
      heart(dc, 215 - F.pxW(hs, 2) - 12, sy + 8, 4.5 + b, hc);
    } else {
      const w = txtW(hs, 0);
      txt(dc, hs, 215 - w, sy, P[3], 0, 99);
      heart(dc, 215 - w - 11, sy + 11, 5 + b * 1.2, hc);
    }
    // ---- a new minute rises into place while awake (ms since the minute changed)
    const since = d.s * 1000 + a.ms;
    let mq = -1;
    if (a.live && a.t - since > 1400 && since < 1600) mq = since / 1300;
    if (mq >= 0 && cS !== PUSH && mq < 1) {
      const i = TS.length - 1;
      const o = Math.round(TH * (1 - G.spring(mq)));
      bgRect(dc, GX[i] - 3, TY, GA[i] + 6, TH + 2, st);
      digit(dc, i, GX[i], TY + o, st, P[1], TY + TH + 2);
    }
    // ---- Mo
    MQ = mq;
    TP = a.tap;
    if (cS === SIT || cS === SPORT) sceneSit(dc, d, a, tt);
    else if (cS === PEEK) scenePeek(dc, d, a, tt, st);
    else if (cS === SLEEP) sceneSleep(dc, d, a, tt);
    else if (cS === HANG) sceneHang(dc, d, a, tt, st);
    else scenePush(dc, d, a, tt, st, mq >= 0 && mq < 1 ? mq : -1);
    // ---- speech bubble (after the intro, a few seconds), then the breathing guide when tense
    if (tt >= 0) {
      if (cM === NERVOUS && tt > 4600) speak(dc, d, tt, st, tt % 10000 < 4000 ? "Einatmen ..." : "Ausatmen ...");
      else speak(dc, d, tt, st, "");
    }
  },

  aod(dc, d) {
    const o = St.shift(d);
    const st = G.clamp(d.cfg.style, 1, 3);
    const t = G.timeStr(d);
    let w = 0;
    for (let i = 0; i < t.length; i++) w += st === 3 ? (t[i] === ":" ? 30 : 60) : IM.THIN_ADV[t[i] === ":" ? 10 : t.charCodeAt(i) - 48];
    let x = Math.round(227 - w / 2) + o[0];
    const y = 196 + o[1];
    let cx = 227;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === ":") cx = x + (st === 3 ? 15 : IM.THIN_ADV[10] / 2);
      if (st === 3) {
        dc.setColor(0x5a5a5a, -1);
        if (ch === ":") { dc.fillRectangle(x + 10, y + 20, 10, 10); dc.fillRectangle(x + 10, y + 50, 10, 10); }
        else F.px(dc, ch, x, y, 10, 0, 1);
        x += ch === ":" ? 30 : 60;
      } else {
        const j = ch === ":" ? 10 : ch.charCodeAt(0) - 48;
        dc.setClip(x - 3, y - IM.THIN_TOP, IM.THIN_ADV[j] + 6, IM.THIN_H);
        dc.drawBitmap2(x - j * IM.THIN_CW - 3, y - IM.THIN_TOP, Bmp.load(IMG.thin), { tintColor: 0x8a8580 });
        dc.clearClip();
        x += IM.THIN_ADV[j];
      }
    }
    // sleeping Mo (thin outline) on the time, a small z
    dc.drawBitmap(cx - IM.AOD_OX, y + 1 - Math.round(34 * IM.S * 0.8) - IM.AOD_OY, Bmp.load(IMG.aod));
    dc.setColor(0x3c4170, -1);
    F.st(dc, "Z", cx + 52, y - 74, 12, 2, 1, 1.0, 0);
    dc.setColor(0x5a5652, -1);
    const ds = st === 3 ? DOW[d.dow] + " " + d.day + "." + d.mon + "." : d.dowStr + " " + d.day + ". " + d.monStr;
    if (st === 3) F.px(dc, ds, 227 + o[0], 300 + o[1], 2, 1, 0);
    else txt(dc, ds, Math.round(227 - txtW(ds, 1.5) / 2) + o[0], 296 + o[1], 0x6a6560, 1.5, 99);
  },
};
