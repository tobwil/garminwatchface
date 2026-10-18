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
* Alpha colours (`G.argb`) do **not** blend reliably on the watch – prefer opaque `G.mix`/`G.dim` colours.

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

**Shared libraries** (`web/js/engine/<name>.js` / `watch/source/lib/<Name>.mc`): code only some designs
need is copied into a watch face only when its faces.json entry lists it, e.g. `"libs": ["insight"]`.
`IN` / `Insight` draws conclusions from the health data: `ready(d)` (readiness 0..100 plus the points each
of Body Battery, sleep, calm and recovery adds or costs), `state(d, R)` (topfit … gestresst), `worst(r)`,
`reason(d, k)`, `advice(st)`, `stress2h(d)`, `bbRate(d)`, `avg`, `delta`, `condName(cond)`.
`SE` / `Season` (`"libs": ["season"]`) lets a scene live with the year and the real weather: `season(d)`,
`event(d)` (`EV.ADVENT`, `XMAS`, `NYE`, `NEWYEAR`, `EASTER`, `HALLOWEEN`, `VALENTINE`, `BIRTHDAY` from
`d.cfg.bday`), `wx(d)` (0 clear … 5 fog), `snowy(d)`, `greeting(ev)` and pixel decorations the scene places
itself: `precip`, `fireworks`, `lights`, `balloons` (moving parts) and `snowCap`, `tree`, `pumpkin`, `eggs`,
`heart` (static layer).

`NW` / `Now` (`"libs": ["now"]`) says what is going on in the body *right now*: `judge(d)` → array `R`
(state id `NS.*` / `Now.*` in priority order EFFORT, MOVING, AFTERBURN, WIND_DOWN, STRESS_SITTING, RESERVE,
EASING, SITTING_LONG, CHARGING, CALM, plus the facts: hr, rhr, steps of 10 min, idle minutes, stress and its
change per 30 min, Body Battery and its change per hour, hr change per 10 min, peaks; thresholds in the file
header), `head(R)`, `reason(d, R)` (with the real numbers), `tip(d, R, d.wakeN)` (four variants), `trend(R, k)`
(-1/0/1 for hr, stress, Body Battery), `breathe(st)`, `COL`, `SHORT`, `wrap(s, w)`. Movement comes from
`tick(d)`, which the face calls in `draw` and `aod`: a ring of per-minute step samples (Storage key `nwR`,
written at most every 10 min); in the studio the sliders "Schritte letzte 10 min" / "Minuten ohne Bewegung"
stand in for it (`d.simMove`, web only), the trend sliders reshape the end of the histories.
**Live heart rate**: `d.hrNow()` re-reads `Activity.getActivityInfo().currentHeartRate` at most once per
second (the minute value `d.hr` stays as it is); call it only for a number that ticks while the face is
awake. The studio lets it wobble by a beat or two from second to second.

**Memory over days** (GARDEN, SAGA, WERK, DUNGEON): keep the state in `St` under a short face prefix, read
it once per static redraw into a member/module variable (Storage reads are slow), judge the previous day
when `year * 1000 + doy` changes (only if it really was yesterday, else the face waited for you) and write
only when a value changes. The web preview starts each face with a fresh store, so seed a demo state
once behind a `<prefix>Demo` key in the JS version only.

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

**SPR** (`spr.js` / `Spr.mc`) – multi-colour pixel sprites. Define sprites once in
`web/js/sprites/<name>.js` as `export default { HERO: { w: 12, h: 10, rows: ["..1122..", ...] }, ... }`
('.' transparent, '0'-'9','a'-'z' = palette index; sprite names UPPER_CASE). Run `node tools/spritegen.mjs`
→ generates `watch/source/gen/Spr<Name>.mc` (module `Spr<Name>`, ByteArray constants). List the module
in faces.json `"sprites": ["<name>"]` (the lead does that). Use:
JS `import S from "../sprites/<name>.js"; import { SPR, encodeAll } from "../engine/spr.js"; const SP = encodeAll(S);`
→ `SPR.draw(dc, SP.HERO, x, y, sc, [col0, col1, ...], flip)`;
MC `Spr.draw(dc, Spr<Name>.HERO, x, y, sc, [col0, col1, ...], flip)`. Palette entries can be `-1` (skip) so
styles recolour the same sprite. Animation frames = several sprites (HERO_A, HERO_B, …). Draws merged runs
(cheap), but keep total sprite pixels per frame reasonable.

**St**: `St.get(key, default)`, `St.set(key, value)` (persistent, values: numbers/strings/arrays), `St.shift(d)` → `[dx, dy]` AOD burn-in offset.

## Data `d` (same field names in both; unknown numbers are `-1`)
time `h m s is24 dow(0=So) day mon year doy wk dowStr("FR") monStr("OKT") unix tz(min) mins`;
activity `steps stepGoal floors floorsGoal floorsWeek imWeek imGoal kcal distM`;
week (ISO week, Monday = index 0, future days `-1`) `dayIdx` (today 0..6), `wkSteps[7] wkFloors[7] wkAct[7]` (active minutes per day),
`trainMask` (bit n = training day on weekday n), `trainDays` (count), `dayGoal` (target training days, = `d.cfg.dayGoal`),
`src` (= `d.cfg.src`: progress source for challenge faces — 0 climbed metres `floorsWeek*3`, 1 weekly bike km `wkBike/1000` vs `cfg.bikeGoal`, 2 training days vs `dayGoal`);
body `hr rhr hrMax hrHist[60 over 2h, oldest first] bb bbHist[48 over 24h] stress stressHist[48 over 24h] sleep recov(min) vo2b vo2r wkBike(m) wkRun(m) tStatus(string) p5k p10k pHM pM(sec) resp spo2`;
env `temp(°C, -99 unknown) cond wind windDeg rain hiT loT alt pres lat lon locOk sunrise sunset (minutes of day, float, -1) moon(0..1)`;
device `batt battDays charging notif phone dnd alarms metric`, calendar `nextEv` (time of the next event, minutes of day, -1 none; the title is not available);
config `d.cfg.style (1..3) d.cfg.ftp d.cfg.kg d.cfg.climb (0 Alpe 1071m/21 Kehren, 1 Ventoux 1610m, 2 Stelvio 1808m/48 Kehren, 3 Everest 8848m) d.cfg.quest (0..2) d.cfg.bikeGoal (km/Woche)`, `d.accent`, `d.dcol` (data colour);
slots: 3 user-chosen data fields – **JS** `d.slots[i].lbl / .val / .raw`, **Monkey C** `d.slots[i][:lbl] / [:val] / [:raw]` (`lbl` short German uppercase label, `val` formatted string, `raw` number or -1).
History arrays can contain `-1` gaps and may be empty on the watch – always guard.

## Animation `a`
* `a.intro` 0→1 linearly over 1.4 s after the wrist is raised (always 1.0 when animations are off
  or in the watch-face editor). Use `G.ease/easeInOut/spring/stag` to shape it.
* `a.t` ms since wake. `a.live` true while the watch is awake & animating.
* **Interaction model** (Garmin limits watch faces): every wrist raise is an "interaction" — `d.glances`
  (raises today, persisted) and `d.wakeN` (raise counter since install; use it as a seed so each look shows
  something new). Touch: only touch-and-hold (`onPress`) reaches a watch face, and only on some devices — treat
  taps as a bonus, never as the only way to use a feature.
* `a.tap` ms since the last screen tap your face accepted (999999 = none). Implement `tap(x, y, d)` (JS) /
  `function tap(x as Number, y as Number, d as D) as Boolean` (MC) and return true to accept a tap; the engine then
  renders at 20 fps for 5 s (`a.live` = true) so reveals/games can animate from `a.tap`. Keep state you need
  (e.g. game state) in instance variables or St. The web preview forwards mouse clicks as taps; `dev.html`
  takes `tap=<ms>&tx=<x>&ty=<y>`; the simulator: `SIM_TAPS="x,y,sec;..."` env for tools/simrun.sh (sec after launch).
* `a.ms` ms since the clock second last changed (0..999) – use `d.s + a.ms/1000` for sweeping seconds hands.
* `fps()` = ambient frame rate after the intro (0 = static; max 20). Ambient motion must be a pure
  function of `a.t` + data (no per-frame state).
* The frame at `intro = 1, live = false` must look complete and beautiful (that's what most people see).

## Static layer cache (performance — use it)
The watch is 10–15× slower than the simulator: a full-screen scene easily costs 200–400 ms per frame on
the device, which stutters badly. So every face splits its drawing into a **static layer** (rendered once
into a cached bitmap) and the **moving parts** (drawn over the cached bitmap every frame).
* `bgKey(d)` returns a number that changes whenever the static layer must be redrawn; usually
  `d.doy * 1440 + d.mins` (JS) / `minuteKey(d)` (MC). Return `-1` (MC) / omit it (JS) to opt out.
* In `draw` start with `const S = !a.bg, M = !a.so;` (MC: `var S = !a.bg; var M = !a.so;`) and wrap
  everything static in `if (S)` and everything that moves in `if (M)`. `a.so` = the engine is rendering the
  static layer only, `a.bg` = the static layer is already on screen. Static things must not depend on
  `a.t`, `a.intro` or `a.live` (the layer is reused for a whole minute); things that change during the
  intro are moving parts. Draw order matters: moving parts are always drawn after the whole static layer.
* The engine renders the static layer in its own timer callback (separate watchdog budget) and paints the
  full frame without it until it is ready. During the intro it reveals the cached layer like a CRT
  switching on; return `false` from `reveal()` if the face has its own reveal.
* Faces whose shared preamble is heavy (game logic) should opt out instead of running it twice.
* Check with `node tools/cachecheck.mjs KEY`: the cached render must match a full render (only edge
  anti-aliasing may differ).

## Pre-rendered images (photo-real faces)

For high-end looks (WORK, MANU, COCKPIT, TOURB, DEEP) the parts are rendered offline and only
composited on the watch. `tools/render/<face>.py` (numpy + Pillow, 3x supersampled, RGB565-dithered,
helpers in `tools/render/common.py`) writes `web/img/<KEY>/<id>.png|jpg` (copied into the watch
resources by `tools/build.py`, kept compressed in the .prg), `web/js/img/<face>.js` (the same images as
data URIs plus metrics `M`) and `watch/source/gen/Img<Face>.mc` (the metrics for Monkey C). The images
are committed, so building never needs the renderer.

* Load: JS `Bmp.load(IMG.x)` (bmp.js) / MC `WatchUi.loadResource(Rez.Drawables.x)`. Images needed in
  every frame stay in member variables; big ones (dials, 454x454) are loaded per static redraw only.
* Draw: `dc.drawBitmap(x, y, b)`, `dc.drawBitmap2(x, y, b, {transform, tintColor, filterMode})` with
  `AffineTransform` (`rotate(rad)`, `translate`, `scale`; the last call acts first on the image): turning
  a hand around its pivot = `rotate(a)`, then `translate(-pivotX, -pivotY)`, drawn at the pivot's screen
  position, `FILTER_MODE_BILINEAR`. Omit `tintColor` (MC) instead of passing -1. `tintColor` multiplies.
* `dc.setBlendMode(BLEND_MODE_ADDITIVE)` adds light (glows, lume, backlight; black = no change), always
  reset to `BLEND_MODE_DEFAULT`.
* Source rectangles of `drawBitmap2` do not work reliably on the watch: draw glyphs or wheel cells through
  `setClip` + `drawBitmap` with an offset instead (glyph strips: `common.glyph_strip`).
* Moving parts that run *under* other parts (wheels under bridges) get a cropped overlay of what lies
  above them, drawn right after them.
* Return `reveal() false` (no CRT reveal) — a photo-real face should simply be there.

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
   other data: `--q "h=21&m=47&sim={\"bb\":12,\"stress\":80}"` (URL-encode if needed), config overrides
   `cfg={\"src\":2,\"dayGoal\":5}`, another date `date=2026-10-18`. Look at the PNGs (Read tool).
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
