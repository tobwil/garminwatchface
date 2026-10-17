// Renders the README media from the web engine:
//   docs/media/<KEY>.webp        intro + a few seconds of ambient animation (default style)
//   docs/media/styles/<KEY>.webp the three styles side by side
//   docs/media/overview.webp     all designs in one grid
//   docs/media/day/<KEY>.webp    24 h time-lapse of the designs that change with the time of day
// Frames are rendered in one page so stateful faces animate exactly like in the studio.
// Usage: node tools/media.mjs [KEY ...]      (needs playwright and python3 + Pillow)
//        node tools/media.mjs --day          only the time-lapses
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require(join(process.execPath, "../../lib/node_modules/playwright")); }

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(REPO, "web");
const OUT = join(REPO, "docs", "media");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };

const ANIM_PX = 220;     // size of the animations
const QUALITY = 72;      // WebP quality
const STYLE_PX = 220;    // size of one face in the style strips
const STEP = 100;        // ms between animation frames
const END = 4500;        // ms of animation
const HOLD = 1500;       // extra ms the last frame is shown
const DAY = ["SUN", "RIDER", "STERNE", "WETTER", "AQUA", "ORBIT", "SKELETT", "BUDDY", "CITY", "SYNTH"];
const DAY_STYLE = { CITY: 3 }; // time-lapse style where the default one ignores the sun
const DAY_STEP = 15;     // minutes of the day between time-lapse frames
const DAY_MS = 90;       // ms per time-lapse frame

const meta = JSON.parse(await readFile(join(ROOT, "faces.json"), "utf8"));
const dayOnly = process.argv.includes("--day");
const want = process.argv.slice(2).filter((a) => a !== "--day");
const faces = dayOnly ? [] : meta.faces.filter((f) => !want.length || want.includes(f.key));
const dayFaces = DAY.filter((k) => !want.length || want.includes(k));

const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    const body = await readFile(p);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const browser = await pw.chromium.launch();
// German local time, so sunrise, sunset and night match a watch in Germany
const page = await browser.newPage({ viewport: { width: 454, height: 454 }, deviceScaleFactor: 1, timezoneId: "Europe/Berlin" });
page.on("pageerror", (e) => console.log("pageerror:", e.message));

// renders frames of one face in the page; returns PNG data URLs with a round alpha mask.
// times: animation time (ms since the wrist raise) per frame; secs: clock time per frame
// (seconds since midnight, default 10:02:30 plus the animation time)
async function frames(key, style, times, secs) {
  secs = secs || times.map((t) => 36150 + Math.floor(t / 1000));
  await page.goto(`http://localhost:${port}/dev.html?face=${key}&style=${style}&t=0&live=1`);
  await page.waitForFunction(() => document.title === "ready", null, { timeout: 10000 });
  return page.evaluate(async ({ key, style, times, secs }) => {
    const { prepCanvas, render, animState } = await import("./js/engine/render.js");
    const { buildData, DEFAULT_CFG } = await import("./js/engine/model.js");
    const meta = await (await fetch("faces.json")).json();
    const fm = meta.faces.find((f) => f.key === key);
    const face = (await import("./js/faces/" + fm.js)).default;
    const df = fm.defaults;
    const cfg = { ...DEFAULT_CFG, ...df, accent: parseInt(df.accent, 16), dcol: parseInt(df.dcol, 16), style };
    const canvas = document.getElementById("c");
    const ctx = prepCanvas(canvas, 454);
    const out = document.createElement("canvas");
    out.width = out.height = 454;
    const o = out.getContext("2d");
    const res = [];
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      const now = new Date(2026, 9, 16, 0, 0, secs[i]);
      const d = buildData(cfg, {}, now);
      render(ctx, face, d, { ...animState(t, cfg), live: true }, false);
      o.clearRect(0, 0, 454, 454);
      o.save();
      o.beginPath();
      o.arc(227, 227, 227, 0, Math.PI * 2);
      o.clip();
      o.drawImage(canvas, 0, 0, 454, 454);
      o.restore();
      res.push(out.toDataURL("image/png"));
    }
    return res;
  }, { key, style, times, secs });
}

const png = (url) => Buffer.from(url.split(",")[1], "base64");
await mkdir(join(OUT, "styles"), { recursive: true });
await mkdir(join(OUT, "day"), { recursive: true });
const work = join(tmpdir(), "facelab-media");

// writes frames (PNG data URLs) as an animated WebP; the last frame is shown `hold` ms longer
async function anim(fr, out, step, hold) {
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });
  const names = [];
  for (let i = 0; i < fr.length; i++) {
    names.push(join(work, `f${String(i).padStart(3, "0")}.png`));
    await writeFile(names[names.length - 1], png(fr[i]));
  }
  execFileSync("python3", ["-c", `
import sys
from PIL import Image
px, step, hold, out, files = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5:]
ims = [Image.open(f).convert("RGBA").resize((px, px), Image.LANCZOS) for f in files]
dur = [step] * len(ims)
dur[-1] += hold
ims[0].save(out, save_all=True, append_images=ims[1:], duration=dur, loop=0, quality=${QUALITY}, method=6)
`, String(ANIM_PX), String(step), String(hold), out, ...names]);
}

for (const f of faces) {
  const style = f.defaults.style || 1;
  // ---- animation (animated WebP: much smaller than GIF, with real alpha)
  const times = [];
  for (let t = 0; t <= END; t += STEP) times.push(t);
  const fr = await frames(f.key, style, times);
  await anim(fr, join(OUT, `${f.key}.webp`), STEP, HOLD);

  // ---- three styles side by side (final frame of each style)
  const strip = [];
  for (let s = 1; s <= f.styles.length; s++) {
    const [u] = await frames(f.key, s, [99999]);
    const p = join(work, `s${s}.png`);
    await writeFile(p, png(u));
    strip.push(p);
  }
  execFileSync("python3", ["-c", `
import sys
from PIL import Image
px, out, files = int(sys.argv[1]), sys.argv[2], sys.argv[3:]
gap = px // 16
im = Image.new("RGBA", (len(files) * px + (len(files) - 1) * gap, px), (0, 0, 0, 0))
for i, f in enumerate(files):
    im.alpha_composite(Image.open(f).convert("RGBA").resize((px, px), Image.LANCZOS), (i * (px + gap), 0))
im.save(out, quality=85, method=6)
`, String(STYLE_PX), join(OUT, "styles", `${f.key}.webp`), ...strip]);
  console.log(f.key);
}

// ---- 24 h time-lapses (intro finished, ambient animation keeps running)
for (const k of dayFaces) {
  const f = meta.faces.find((x) => x.key === k);
  const secs = [], times = [];
  for (let m = 0; m < 24 * 60; m += DAY_STEP) {
    secs.push(m * 60);
    times.push(20000 + times.length * DAY_MS);
  }
  await anim(await frames(k, DAY_STYLE[k] || f.defaults.style || 1, times, secs), join(OUT, "day", `${k}.webp`), DAY_MS, 0);
  console.log("day", k);
}

// ---- overview grid of all designs (default style, final frame)
if (!want.length && !dayOnly) {
  const files = [];
  for (const f of meta.faces) {
    const [u] = await frames(f.key, f.defaults.style || 1, [99999]);
    const p = join(work, `o_${f.key}.png`);
    await writeFile(p, png(u));
    files.push(p);
  }
  execFileSync("python3", ["-c", `
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
cols, px, gap = 8, 150, 10
rows = (len(files) + cols - 1) // cols
im = Image.new("RGBA", (cols * px + (cols - 1) * gap, rows * px + (rows - 1) * gap), (0, 0, 0, 0))
for i, f in enumerate(files):
    im.alpha_composite(Image.open(f).convert("RGBA").resize((px, px), Image.LANCZOS), ((i % cols) * (px + gap), (i // cols) * (px + gap)))
im.save(out, quality=85, method=6)
`, join(OUT, "overview.webp"), ...files]);
  console.log("overview");
}
await rm(work, { recursive: true, force: true });
await browser.close();
server.close();
