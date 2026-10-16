// Renders faces from the web engine to PNG (for previews and watch-vs-web comparisons).
// Usage: node tools/shot.mjs <outdir> <FACE>[:style] ... [--q "h=10&m=2&live=1&t=600"]
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require(join(process.execPath, "../../lib/node_modules/playwright")); }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "web");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".prg": "application/octet-stream" };

const args = process.argv.slice(2);
const out = args.shift();
let extra = "";
const faces = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--q") extra = args[++i];
  else faces.push(args[i]);
}

const server = createServer(async (req, res) => {
  try {
    const p = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    const body = await readFile(p);
    res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
await mkdir(out, { recursive: true });
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 454, height: 454 }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text()); });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
for (const f of faces) {
  const [key, style] = f.split(":");
  const url = `http://localhost:${port}/dev.html?face=${key}${style ? "&style=" + style : ""}${extra ? "&" + extra : ""}`;
  await page.goto(url);
  await page.waitForFunction(() => document.title === "ready", null, { timeout: 10000 }).catch(() => console.log("timeout", f));
  const file = join(out, `${key}${style ? "-" + style : ""}.png`);
  await (await page.$("#c")).screenshot({ path: file });
  console.log(file);
}
await browser.close();
server.close();
