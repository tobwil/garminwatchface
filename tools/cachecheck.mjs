// Compares every face rendered with its static layer cache against a full render (live, after the
// intro; three times of day per style) and prints the number of differing pixels; a handful along
// slanted edges or the round rim is anti-aliasing. Also renders intro frames over the cache to catch
// errors. Usage: node tools/cachecheck.mjs [KEY ...]     (needs playwright)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const want = process.argv.slice(2);
const pw = createRequire(join(REPO, "package.json"))("playwright");
const ROOT = join(REPO, "web");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };
const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 454, height: 454 }, timezoneId: "Europe/Berlin" });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text().split("\n")[0]); });
await page.goto(`http://localhost:${port}/dev.html?face=MONO`);
await page.waitForFunction(() => document.title === "ready", null, { timeout: 10000 });
const meta = JSON.parse(await readFile(join(ROOT, "faces.json"), "utf8"));
for (const f of meta.faces) {
  if (want.length && !want.includes(f.key)) continue;
  const res = await page.evaluate(async ({ js, n }) => {
    let mod;
    try { mod = (await import("./js/faces/" + js)).default; } catch (e) { return "missing"; }
    const { prepCanvas, render, animState } = await import("./js/engine/render.js");
    const { buildData, DEFAULT_CFG } = await import("./js/engine/model.js");
    const meta = await (await fetch("faces.json")).json();
    const fm = meta.faces.find((x) => x.js === js);
    const out = [];
    if (!mod.bgKey) return "no cache";
    for (let st = 1; st <= n; st++) {
      for (const [h, m, t] of [[10, 2, 5000], [22, 41, 7300], [7, 15, 3100]]) {
        const df = fm.defaults;
        const cfg = { ...DEFAULT_CFG, ...df, accent: parseInt(df.accent, 16), dcol: parseInt(df.dcol, 16), style: st };
        const d = buildData(cfg, {}, new Date(2026, 9, 16, h, m, 20));
        const a = { ...animState(t, cfg), live: true };
        const c1 = document.createElement("canvas"), c2 = document.createElement("canvas");
        const x1 = prepCanvas(c1, 454), x2 = prepCanvas(c2, 454);
        render(x1, mod, d, a, false);
        render(x2, { ...mod, bgKey: undefined }, d, a, false);
        const p1 = x1.getImageData(0, 0, c1.width, c1.height).data, p2 = x2.getImageData(0, 0, c2.width, c2.height).data;
        let diff = 0;
        for (let i = 0; i < p1.length; i += 4) {
          if (Math.abs(p1[i] - p2[i]) + Math.abs(p1[i + 1] - p2[i + 1]) + Math.abs(p1[i + 2] - p2[i + 2]) > 24) diff++;
        }
        out.push(diff);
      }
    }
    // intro frames over the cache: only checked for errors
    for (let st = 1; st <= n; st++) {
      for (const t of [100, 300, 600, 900, 1300]) {
        const df = fm.defaults;
        const cfg = { ...DEFAULT_CFG, ...df, accent: parseInt(df.accent, 16), dcol: parseInt(df.dcol, 16), style: st };
        const d = buildData(cfg, {}, new Date(2026, 9, 16, 22, 41, 20));
        const c1 = document.createElement("canvas");
        render(prepCanvas(c1, 454), mod, d, { ...animState(t, cfg), live: true }, false);
      }
    }
    return out.join(" ");
  }, { js: f.js, n: f.styles.length });
  console.log(f.key.padEnd(9), res);
}
await browser.close();
server.close();
