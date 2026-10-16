// Builds the FaceLab Studio into self-contained single files:
//   site/FaceLab.html   complete HTML document (open locally, host anywhere)
//   site/artifact.html  page fragment for publishing as a claude.ai Artifact
// Embeds the release .prg of every face (web/prg/<KEY>.prg) and the sideload key so the
// page can patch + sign watch faces fully offline.
// Usage: node tools/bundle.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as esbuild from "esbuild";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
execFileSync("node", [join(ROOT, "tools/gen-registry.mjs")], { stdio: "inherit" });

const meta = JSON.parse(readFileSync(join(ROOT, "web/faces.json"), "utf8"));
const prgs = {}, appIds = {};
for (const f of meta.faces) {
  const p = join(ROOT, "web/prg", f.key + ".prg");
  if (!existsSync(p)) continue;
  prgs[f.key] = readFileSync(p).toString("base64");
  appIds[f.key] = createHash("md5").update("facelab-" + f.key).digest().toString("base64");
}
const key = readFileSync(join(ROOT, "tools/keys/facelab-sideload.der")).toString("base64");
const assets = `window.FACELAB_ASSETS=${JSON.stringify({ prgs, appIds, key })};`;
// also emit a dev module so web/index.html can be served directly
writeFileSync(join(ROOT, "web/assets.js"), `export default ${JSON.stringify({ prgs, appIds, key })};\n`);

const out = await esbuild.build({
  entryPoints: [join(ROOT, "web/js/app.js")],
  bundle: true, format: "iife", minify: true, write: false, target: "es2020",
  external: ["../assets.js"], loader: { ".json": "json" },
});
const js = out.outputFiles[0].text;
const css = readFileSync(join(ROOT, "web/css/app.css"), "utf8");
const html = readFileSync(join(ROOT, "web/index.html"), "utf8");
const pick = (tag) => {
  const a = html.indexOf(`<!--FL:${tag}-->`), b = html.indexOf(`<!--FL:/${tag}-->`);
  return html.slice(a + tag.length + 10, b);
};
const head = pick("HEAD").replace(/<link rel="stylesheet" href="css\/app.css">/, `<style>${css}</style>`);
const body = pick("BODY");
const scripts = `<script>${assets}</script>\n<script>${js.replace(/<\/script/g, "<\\/script")}</script>`;

mkdirSync(join(ROOT, "site"), { recursive: true });
writeFileSync(join(ROOT, "site/FaceLab.html"),
  `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n${scripts}\n</body>\n</html>\n`);
writeFileSync(join(ROOT, "site/artifact.html"), `${head}\n${body}\n${scripts}\n`);
const kb = (s) => Math.round(Buffer.byteLength(s) / 1024);
console.log(`site/FaceLab.html  ${kb(head + body + scripts)} KB · faces with .prg: ${Object.keys(prgs).join(" ") || "none"}`);
