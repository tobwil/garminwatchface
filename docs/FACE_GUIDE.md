# FaceLab – Face Authoring Guide

Every watch face design exists **twice, with identical logic**:

| | Web preview (studio) | Watch (Connect IQ, Monkey C) |
|---|---|---|
| file | `web/js/faces/<key>.js` | `watch/source/faces/<Name>.mc` |
| form | `export default { fps, draw(dc,d,a), aod(dc,d), tap?(x,y,d) }` | `class Face<Name> extends Face { fps(), draw(dc,d,a), aod(dc,d), tap?(x,y,d) }` |

The JS version is the visual reference shown on the website; the Monkey C version is a
**line-by-line port** of it (same structure, same numbers, same helper calls). Keep them in sync.
Use `web/js/faces/mono.js` + `watch/source/faces/Mono.mc` as the reference example.

Metadata (name, styles, uses, defaults) lives in `web/faces.json` (already filled in – do not edit;
report needed changes instead).

## Screen & canvas
* 454 × 454 px round AMOLED (Forerunner 970). Centre (227, 227), radius 227. Black background is
  already cleared before `draw`. Anything outside the circle is invisible.
* Anti-aliasing is on. Colours are `0xRRGGBB` numbers. `-1` = transparent.
* Alpha colours: `G.argb(alpha0to254, 0xRRGGBB)` (works on the FR970; use sparingly).

## Draw API (subset of Toybox.Graphics.Dc — use ONLY these)
`setColor(fg, bg)` (always pass `-1` as bg), `setPenWidth(w)`, `fillCircle(x,y,r)`, `drawCircle`,
`fillEllipse(x,y,a,b)`, `drawEllipse`, `drawArc(x,y,r,dir,a0,a1)` (Garmin degrees: 0=3 o'clock,
CCW positive; dir 0=CCW, 1=CW – prefer `G.arcC`), `drawLine`, `drawPoint`, `fillRectangle(x,y,w,h)`,
`drawRectangle`, `fillRoundedRectangle(x,y,w,h,r)`, `drawRoundedRectangle`, `fillPolygon([[x,y],...])`,
`setClip(x,y,w,h)`, `clearClip()`. **No `drawText`, no bitmaps** – text goes through `F`.
In Monkey C use the literal `-1` for transparent and `Graphics.ARC_CLOCKWISE` etc. as needed.

## Helpers (identical in both languages)
**G** (`gfx.js` / `Gfx.mc`) – clock angles are degrees, 0 = 12 o'clock, clockwise:
`clamp, lerp, ease (out-cubic), easeInOut, spring (back-out), stag(p,i,step,dur)`,
`ptX(cx,r,deg), ptY(cy,r,deg)`, `arcC(dc,cx,cy,r,a0,a1)` (clockwise a0→a1), `ring(dc,cx,cy,r,w,frac,col,track)`,
`capArc(dc,cx,cy,r,w,a0,a1)`, `tick(dc,cx,cy,r1,r2,deg)`, `hand(dc,cx,cy,deg,len,back,w,tipW)`,
`rgb(r,g,b), mix(c1,c2,t), dim(c,f), argb(a,c), hsv(h,s,v)`,
`rnd(seed)` (Park–Miller next seed), `rf(seed)` (0..1), `noise(x)` (-1..1 smooth),
`pad2(n), num(n)` ("12.345"), `hm(min)` ("2:05"), `race(sec)`, `hour(d)`, `timeStr(d)`, `fix1(v)` ("3.4").

**F** (`fonts.js` / `Fonts.mc`) – procedural fonts, identical pixels on web and watch:
* `F.st(dc, txt, x, y, h, pen, just, prog, slant)` monoline vector text. `y` = vertical centre,
  `h` = cap height px, `pen` = stroke width, `just` 0 left / 1 centre / 2 right, `prog` 0..1 draws
  partially (write-on animation; pass `1.0` for full), `slant` italic shear (0 = upright, 0.2 italic).
  Returns width. Uppercase only (auto-converted). Glyphs: `A–Z 0–9 Ä Ö Ü` and `. , : ; - + = / % ° ! ? ' # < > ( ) _ * ^(up arrow) | @(heart)` and space.
  **Cost**: every stroke is several line draws – keep big pens/long texts reasonable.
* `F.stW(txt, h)` width.
* `F.px(dc, txt, x, y, sc, just, gap)` 5×7 dot-matrix, `y` = top, `sc` = dot size px, `gap` inner gap
  (0 = solid, 1 = LED look). Has lowercase, umlauts, ß, `$ [ ] ~ @(heart) ^(arrow)` and `\u007f` (full block).
  Width `F.pxW(txt, sc)` = len*6*sc − sc.
* `F.seg(dc, txt, x, y, h, th, just, onCol, offCol)` seven-segment (digits, `-`, `:`, `.`, some letters).

**AST** (`astro.js` / `Astro.mc`): `elev(doy, minOfDay, lat, lon, tz)` sun elevation°, `cross(doy, lat, lon, tz, elevDeg, rising)` → local minute or -1, `noon(doy, lon, tz)`, `moon(unix)` phase 0..1 (0 new, .5 full), `illum(phase)`.

**St**: `St.get(key, default)`, `St.set(key, value)` (persistent, values: numbers/strings/arrays), `St.shift(d)` → `[dx, dy]` AOD burn-in offset.

## Data `d` (same field names in both; unknown numbers are `-1`)
time `h m s is24 dow(0=So) day mon year doy wk dowStr("FR") monStr("OKT") unix tz(min) mins`;
activity `steps stepGoal floors floorsGoal floorsWeek imWeek imGoal kcal distM`;
body `hr rhr hrMax hrHist[60 over 2h, oldest first] bb bbHist[48 over 24h] stress stressHist[48 over 24h] sleep recov(min) vo2b vo2r wkBike(m) wkRun(m) tStatus(string) p5k p10k pHM pM(sec) resp spo2`;
env `temp(°C, -99 unknown) cond wind windDeg rain hiT loT alt pres lat lon locOk sunrise sunset (minutes of day, float, -1) moon(0..1)`;
device `batt battDays charging notif phone dnd alarms metric`;
config `d.cfg.style (1..3) d.cfg.ftp d.cfg.kg d.cfg.climb (0 Alpe 1071m/21 Kehren, 1 Ventoux 1610m, 2 Stelvio 1808m/48 Kehren, 3 Everest 8848m) d.cfg.quest (0..2) d.cfg.bikeGoal (km/Woche)`, `d.accent`, `d.dcol` (data colour);
slots: 3 user-chosen data fields – **JS** `d.slots[i].lbl / .val / .raw`, **Monkey C** `d.slots[i][:lbl] / [:val] / [:raw]` (`lbl` short German uppercase label, `val` formatted string, `raw` number or -1).
History arrays can contain `-1` gaps and may be empty on the watch – always guard.

## Animation `a`
* `a.intro` 0→1 linearly over 1.4 s after the wrist is raised (always 1.0 when animations are off
  or in the watch-face editor). Use `G.ease/easeInOut/spring/stag` to shape it.
* `a.t` ms since wake. `a.live` true while the watch is awake & animating.
* `fps()` = ambient frame rate after the intro (0 = static; max 20). Ambient motion must be a pure
  function of `a.t` + data (no per-frame state).
* The frame at `intro = 1, live = false` must look complete and beautiful (that's what most people see).

## Always-on (`aod`)
AMOLED low-power mode: black, **< 10 % of pixels lit**, no animation, thin strokes, dimmed colours,
apply `St.shift(d)` offsets to everything. Make it a recognisable, elegant echo of the face.

## Monkey C pitfalls (read!)
* **Integer division**: `7 / 2 == 3`. Write `7 / 2.0` or `x.toFloat()` whenever you need fractions.
* `%` only on integers: `(x.toNumber() % 60)`. Use `Math.floor()` / `.toNumber()` to convert.
* `has` is a reserved word (also `me`, `self`, `hidden`, `native`, `module`…) – don't use as names.
* No closures/lambdas, no `const` inside functions, no `let`. Arrays: `new [n]` or literals; `arr.size()`.
  Strings: `s.length()`, `s.substring(a, b)`, `s.toUpper()`, `n.format("%02d")`, `"" + n`.
* Constructor must call `Face.initialize();`. Class name = `cls` in faces.json.
* Typecheck is "gradual": you may leave locals untyped. Function signatures like
  `function draw(dc as Dc, d as D, a as A) as Void` must match the base class.
* Avoid allocating big arrays per frame; precompute static geometry once (e.g. in `initialize`)
  only if it is small. Memory budget for one face: keep `usedMemory` < 90 KB (engine ≈ 43 KB).
* **Drawing cost**: filled rectangles/circles are cheap; every stroke-font line is ~5× more expensive
  (digits are long polylines – "3.3" ≈ 70 lines). Use the pixel font for small/secondary text when a
  face is heavy. Helper functions for `aod` must not rely on `this` in JS.
* Per-frame cost: the debug build prints `dt=<ms>` (draw time in the simulator). Aim for ≤ 60 ms
  while animating (the simulator is slow, but the watchdog also limits work per frame).
* Math: `Math.sin/cos/sqrt/atan2/floor/round/pow`, `Math.PI`. `.abs()` on numbers.

## Workflow & verification (mandatory)
1. Write the JS face, render it:
   `node tools/shot.mjs <outdir> KEY:1 KEY:2 KEY:3` (final frame),
   `node tools/shot.mjs <outdir> KEY:1 --q "t=500&live=1"` (mid-intro), `--q "aod=1"` (AOD),
   other data: `--q "h=21&m=47&sim={\"bb\":12,\"stress\":80}"` (URL-encode if needed). Look at the PNGs (Read tool).
2. Port to Monkey C, compile: `python3 tools/build.py KEY` (must print `OK`; fix all errors).
3. Run in the real Garmin simulator: `FL_DEBUG=1 python3 tools/build.py KEY && tools/simrun.sh dist/KEY.prg <out.png> 16 > <log.txt>; cat <log.txt>`
   (**redirect to a file, do not pipe**; one simulator is shared, calls queue automatically ~20–60 s).
   The log shows `mem <used>/<total> ... dt=<ms>` and any crash (e.g. "Error: ...", "Unhandled Exception").
   Compare the screenshot with the web render; they must match closely. The simulator's own clock/data
   differ from the web defaults – that's fine. Note: the screenshot is a 454 px square crop – corners show the watch bezel.
4. Iterate until both look excellent. Finish with a non-debug `python3 tools/build.py KEY` → `OK`.

## Rules
* Only create/edit your own face files (`web/js/faces/<key>.js`, `watch/source/faces/<Name>.mc`).
  Do **not** edit engine files, `faces.json`, tools, or other faces. Need a helper? Put it in your face
  file (as a private function/method in both languages).
* No git commits. Scratch files go to your scratch dir, never into the repo.
* All visible text in **German** (short, uppercase for the stroke font).
* Quality bar: premium, original, legible at a glance on the wrist. Text ≥ 16 px cap height for the
  stroke font, pixel font scale ≥ 2. Respect the round shape (nothing important near the edge corners).
