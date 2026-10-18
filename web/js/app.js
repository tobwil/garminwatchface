// FaceLab Studio — gallery, live preview, configurator and .prg generator.
import META from "../faces.json";
import { FACES } from "./faces/index.js";
import { prepCanvas, render, INTRO_MS } from "./engine/render.js";
import { buildData, encodeCode, decodeCode, DEFAULT_CFG, SLOT_TYPES, SIM_DEFAULTS } from "./engine/model.js";
import { Assist, DUR } from "./engine/assist.js";
import { St } from "./engine/st.js";
import { Store } from "./engine/model.js";
import { patchPrg } from "./prg.js";
import { makeZip } from "./zip.js";
import { sendToWatch, usbSupported } from "./mtp.js";

const MAX_ANIM_MS = 12000;
const TAP_MS = 5000;
const $ = (id) => document.getElementById(id);
const faces = META.faces.filter((f) => FACES[f.key]);
const byKey = Object.fromEntries(faces.map((f) => [f.key, f]));

const ACCENTS = ["FF5A1F", "FC6719", "FFC83D", "E8C468", "3DDC97", "29E6FF", "4D8DFF", "8C7BFF", "FF2D55", "FF4FD8", "FFFFFF"];
const DCOLS = ["FFFFFF", "D9DEE3", "FFD24A", "29E6FF", "3DDC97", "FF8A65"];
const TAGS = [["alle", "Alle"], ["ki", "KI"], ["interaktiv", "Interaktiv"], ["versteckt", "Versteckt"], ["pixel", "Pixel"], ["klassisch", "Klassisch"], ["wild", "Wild"], ["amoled", "AMOLED"], ["rad", "Rad"], ["challenge", "Challenge"], ["daten", "Daten"], ["ohnesport", "Ohne Sport"]];
const TAG_LABEL = Object.fromEntries(TAGS);
const SIMS = [
  ["bb", "Body Battery", 0, 100, 1, ""], ["stress", "Stress", 0, 100, 1, ""], ["steps", "Schritte", 0, 25000, 100, ""],
  ["floorsWeek", "Etagen diese Woche", 0, 600, 1, ""], ["hr", "Puls", 40, 190, 1, " bpm"], ["sleep", "Schlafscore", 0, 100, 1, ""],
  ["recovH", "Erholungszeit", 0, 96, 1, " h"], ["wkBikeKm", "Rad diese Woche", 0, 600, 1, " km"], ["batt", "Akku", 0, 100, 1, " %"],
  ["temp", "Temperatur", -15, 38, 1, " °C"], ["trainDays", "Trainingstage diese Woche", 0, 7, 1, ""],
  ["glances", "Blicke auf die Uhr heute", 0, 300, 1, ""],
  // movement and trends (Live-Coach)
  ["mv10", "Schritte letzte 10 min", 0, 1500, 10, ""], ["idle", "Minuten ohne Bewegung", 0, 240, 1, " min"],
  ["hrTrend", "Puls-Trend", -60, 60, 1, " /10 min"], ["stressTrend", "Stress-Trend", -40, 40, 1, " /30 min"],
  ["bbTrend", "Body-Battery-Trend", -20, 20, 1, " /h"],
];

// ------------------------------------------------------------------ storage (per viewer)
const LS = {
  get(k, d) { try { const v = localStorage.getItem("facelab." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("facelab." + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

const hexNum = (h) => parseInt(h, 16);
const hexStr = (n) => (n >>> 0).toString(16).toUpperCase().padStart(6, "0").slice(-6);

function defaultsFor(f) {
  const d = f.defaults;
  return { ...DEFAULT_CFG, ...d, accent: hexNum(d.accent), dcol: hexNum(d.dcol), slots: [...d.slots] };
}

// ------------------------------------------------------------------ state
const state = {
  key: LS.get("key", "MONO"),
  cfgs: LS.get("cfgs", {}),
  names: LS.get("names", {}),
  sim: LS.get("sim", {}),
  // personal settings shared by every design: birthday, bedtime, assistant
  personal: LS.get("personal", {}),
  filter: "alle",
  live: true,
  scrub: 600,
  aod: false,
  wakeAt: performance.now(),
  tapAt: -1,
  raises: 0,
  dirty: true,
};
if (!byKey[state.key]) state.key = faces[0].key;
const stores = {}; // per-face persistent store for St (XP etc.)

function cfgOf(key) {
  const f = byKey[key];
  const c = { ...defaultsFor(f), ...(state.cfgs[key] || {}), ...state.personal };
  c.slots = [...c.slots];
  c.style = Math.min(Math.max(1, c.style), (f.styles || ["x"]).length);
  return c;
}
const PERSONAL = ["bday", "bed", "assist"];
function setCfg(patch) {
  for (const k of PERSONAL) if (k in patch) state.personal[k] = patch[k];
  LS.set("personal", state.personal);
  state.cfgs[state.key] = { ...cfgOf(state.key), ...patch };
  LS.set("cfgs", state.cfgs);
  state.dirty = true;
  syncCode();
  refreshTile(state.key);
}

function simValues() {
  const s = { ...state.sim };
  const out = { ...s };
  out.glances = (s.glances ?? SIM_DEFAULTS.glances) + state.raises;
  out.wakeN = SIM_DEFAULTS.wakeN + state.raises;
  if (s.recovH !== undefined) out.recov = s.recovH * 60;
  if (s.wkBikeKm !== undefined) out.wkBike = s.wkBikeKm * 1000;
  return out;
}

function now() {
  const d = new Date();
  if (!state.live) d.setHours(Math.floor(state.scrub / 60), state.scrub % 60);
  return d;
}

function useStore(key) {
  if (!stores[key]) stores[key] = new Store();
  St.store = stores[key];
}

// ------------------------------------------------------------------ accent colour of the UI
function applyTheme(acc) {
  const r = (acc >> 16) & 255, g = (acc >> 8) & 255, b = acc & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const root = document.documentElement.style;
  root.setProperty("--face", "#" + hexStr(acc));
  root.setProperty("--face-on", lum > 0.6 ? "#111111" : "#ffffff");
  const dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light"
    || document.documentElement.dataset.theme === "dark";
  const k = dark ? 1 : Math.min(1, 0.55 / Math.max(lum, 0.01));
  const ink = dark ? acc : ((Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k));
  root.setProperty("--face-ink", "#" + hexStr(ink));
}

// ------------------------------------------------------------------ main preview
const screen = $("screen");
let ctx = null;
let lastDraw = 0;
let lastSec = -1;
let cachedData = null;
let cachedMinute = -1;

function sizeScreen() {
  ctx = prepCanvas(screen, screen.getBoundingClientRect().width || 360);
  state.dirty = true;
}

// clicks/taps on the preview are forwarded to the face like screen taps on the watch
function onScreenTap(ev) {
  const face = FACES[state.key];
  if (!face.tap || state.aod) return;
  const r = screen.getBoundingClientRect();
  const x = Math.round(((ev.clientX - r.left) / r.width) * 454), y = Math.round(((ev.clientY - r.top) / r.height) * 454);
  if ((x - 227) ** 2 + (y - 227) ** 2 > 227 * 227) return;
  useStore(state.key);
  if (face.tap(x, y, cachedData || dataFor(state.key, cfgOf(state.key), now()))) {
    state.tapAt = performance.now();
    state.wakeAt = state.tapAt - INTRO_MS;
    state.dirty = true;
  }
}

function wake() {
  state.raises++;
  cachedData = null;
  state.wakeAt = performance.now();
  // the assistant decides on every raise whether it has something to say
  // (not over designs that speak for themselves, and then it remembers nothing as shown)
  state.assist = FACES[state.key].speaks ? 0 : Assist.pick(dataFor(state.key, cfgOf(state.key), now()));
  state.dirty = true;
}

function dataFor(key, cfg, dt) {
  return buildData(cfg, simValues(), dt);
}

function loop(ts) {
  requestAnimationFrame(loop);
  if (!ctx) return;
  const key = state.key;
  const face = FACES[key];
  const cfg = cfgOf(key);
  const t = ts - state.wakeAt;
  const tapping = !state.aod && state.tapAt >= 0 && ts - state.tapAt < TAP_MS;
  const card = !state.aod && state.assist > 0 && t < DUR[state.assist] + 100;
  const animating = tapping || card || (!state.aod && cfg.anim > 0 && t < MAX_ANIM_MS && (t < INTRO_MS || (cfg.anim === 2 && (face.fps || 0) > 0)));
  const period = t < INTRO_MS || tapping ? 50 : 1000 / Math.max(1, face.fps || 1);
  const dt = now();
  const sec = dt.getSeconds();
  const due = state.dirty || (animating && ts - lastDraw >= period - 4) || sec !== lastSec;
  if (!due) return;
  lastDraw = ts;
  lastSec = sec;
  const minuteKey = dt.getHours() * 60 + dt.getMinutes();
  if (state.dirty || minuteKey !== cachedMinute || !cachedData) {
    cachedData = dataFor(key, cfg, dt);
    cachedMinute = minuteKey;
  }
  cachedData.s = sec;
  state.dirty = false;
  useStore(key);
  const a = { t, intro: cfg.anim === 0 ? 1 : Math.min(1, t / INTRO_MS), live: animating, ms: dt.getMilliseconds(),
    tap: state.tapAt < 0 ? 999999 : ts - state.tapAt };
  render(ctx, face, cachedData, a, state.aod, card ? state.assist : 0);
  if (!mini.hidden) {
    const m = miniCanvas.getContext("2d");
    m.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    m.drawImage(screen, 0, 0, miniCanvas.width, miniCanvas.height);
  }
}

// floating mini preview while the big watch is scrolled out of view
const mini = $("mini");
const miniCanvas = $("miniScreen");
function setupMini() {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  miniCanvas.width = miniCanvas.height = Math.round(96 * dpr);
  new IntersectionObserver((es) => {
    for (const e of es) { mini.hidden = e.isIntersecting; state.dirty = true; }
  }, { threshold: 0.15 }).observe($("watch"));
  mini.onclick = () => $("watch").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
}

// ------------------------------------------------------------------ gallery
const tiles = {};
// pre-rendered images arrive asynchronously: redraw the tiles once they are there
window.addEventListener("fl-bitmap", () => faces.forEach((f) => refreshTile(f.key)));
function buildGallery() {
  const chips = $("chips");
  chips.innerHTML = "";
  for (const [id, label] of TAGS) {
    if (id !== "alle" && !faces.some((f) => (f.tags || []).includes(id))) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(state.filter === id));
    b.onclick = () => { state.filter = id; buildGallery(); };
    chips.appendChild(b);
  }
  const g = $("gallery");
  g.innerHTML = "";
  for (const f of faces) {
    if (state.filter !== "alle" && !(f.tags || []).includes(state.filter)) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tile";
    b.setAttribute("aria-pressed", String(f.key === state.key));
    b.title = f.name;
    const c = document.createElement("canvas");
    const s = document.createElement("span");
    s.textContent = f.name;
    b.append(c, s);
    b.onclick = () => selectFace(f.key);
    b.onpointerenter = () => playTile(f.key);
    g.appendChild(b);
    tiles[f.key] = { canvas: c, btn: b, ctx: null, wake: -1 };
  }
  requestAnimationFrame(() => faces.forEach((f) => refreshTile(f.key)));
}

function drawTile(key, t) {
  const tile = tiles[key];
  if (!tile || !tile.canvas.isConnected) return;
  if (!tile.ctx) tile.ctx = prepCanvas(tile.canvas, tile.canvas.getBoundingClientRect().width || 104);
  const cfg = cfgOf(key);
  useStore(key);
  const d = dataFor(key, cfg, now());
  const a = t === undefined ? { t: 99999, intro: 1, live: false, ms: 0 } : { t, intro: Math.min(1, t / INTRO_MS), live: true, ms: Math.floor(t) % 1000 };
  render(tile.ctx, FACES[key], d, a, false);
}
function refreshTile(key) { drawTile(key); }
function playTile(key) {
  const tile = tiles[key];
  if (!tile) return;
  const start = performance.now();
  tile.wake = start;
  const step = (ts) => {
    if (tile.wake !== start) return;
    const t = ts - start;
    drawTile(key, t);
    if (t < INTRO_MS + 200) requestAnimationFrame(step);
    else drawTile(key);
  };
  requestAnimationFrame(step);
}

// ------------------------------------------------------------------ configurator
function selectFace(key) {
  state.key = key;
  state.tapAt = -1;
  LS.set("key", key);
  Object.values(tiles).forEach((t) => t.btn.setAttribute("aria-pressed", "false"));
  if (tiles[key]) tiles[key].btn.setAttribute("aria-pressed", "true");
  syncPanel();
  wake();
}

function swatchRow(el, list, current, onPick, custom) {
  el.innerHTML = "";
  const all = [...new Set([hexStr(current), ...list])];
  for (const h of all) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sw";
    b.style.background = "#" + h;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(hexNum(h) === current));
    b.setAttribute("aria-label", "Farbe #" + h);
    b.onclick = () => onPick(hexNum(h));
    el.appendChild(b);
  }
  if (custom) {
    const w = document.createElement("label");
    w.className = "sw sw-custom";
    w.title = "Eigene Farbe";
    const i = document.createElement("input");
    i.type = "color";
    i.value = "#" + hexStr(current).toLowerCase();
    i.setAttribute("aria-label", "Eigene Farbe wählen");
    i.oninput = () => onPick(hexNum(i.value.slice(1)), true);
    w.appendChild(i);
    el.appendChild(w);
  }
}

function syncPanel() {
  const f = byKey[state.key];
  const cfg = cfgOf(state.key);
  applyTheme(cfg.accent);
  $("faceName").textContent = f.name;
  $("faceBlurb").textContent = f.blurb || "";
  $("faceTags").textContent = (f.tags || []).map((t) => TAG_LABEL[t] || t).join(" · ");
  screen.style.cursor = FACES[state.key].tap ? "pointer" : "default";
  $("tapHint").hidden = !(f.tags || []).includes("interaktiv");
  // styles
  const styles = f.styles || [];
  $("fStyle").hidden = styles.length < 2;
  const seg = $("styles");
  seg.innerHTML = "";
  styles.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(cfg.style === i + 1));
    b.onclick = () => { setCfg({ style: i + 1 }); syncPanel(); wake(); };
    seg.appendChild(b);
  });
  swatchRow($("accents"), ACCENTS, cfg.accent, (c, live) => { setCfg({ accent: c }); applyTheme(c); if (!live) syncPanel(); }, true);
  swatchRow($("dcols"), DCOLS, cfg.dcol, (c, live) => { setCfg({ dcol: c }); if (!live) syncPanel(); }, true);
  const uses = f.uses || [];
  $("fSlots").hidden = !uses.includes("slots");
  for (let i = 0; i < 3; i++) $("slot" + i).value = String(cfg.slots[i]);
  $("fFtp").hidden = !uses.includes("ftp");
  $("fKg").hidden = !uses.includes("kg");
  $("fBike").hidden = !uses.includes("bike");
  $("fClimb").hidden = !uses.includes("climb");
  $("fQuest").hidden = !uses.includes("quest");
  $("fSrc").hidden = !uses.includes("src");
  $("fDays").hidden = !uses.includes("days") && !uses.includes("src");
  $("src").value = String(cfg.src ?? 0); $("days").value = String(cfg.dayGoal ?? 4);
  $("ftp").value = cfg.ftp; $("kg").value = cfg.kg; $("bike").value = cfg.bikeGoal;
  $("climb").value = String(cfg.climb); $("quest").value = String(cfg.quest); $("anim").value = String(cfg.anim);
  $("bdayD").value = String(cfg.bday ? cfg.bday % 100 : 0); $("bdayM").value = String(cfg.bday ? Math.floor(cfg.bday / 100) : 0);
  $("bed").value = String(cfg.bed ?? 1350); $("assist").value = String(cfg.assist ?? 1);
  $("fname").value = state.names[state.key] || f.name;
  syncCode();
}

function syncCode() {
  $("code").textContent = encodeCode(state.key, cfgOf(state.key));
}

function bindInputs() {
  const slotOpts = SLOT_TYPES.map(([t, , name]) => `<option value="${t}">${name}</option>`).join("");
  for (let i = 0; i < 3; i++) {
    const s = $("slot" + i);
    s.innerHTML = slotOpts;
    s.onchange = () => { const c = cfgOf(state.key); c.slots[i] = +s.value; setCfg({ slots: c.slots }); };
  }
  const num = (id, key, lo, hi) => {
    $(id).onchange = () => { const v = Math.round(+$(id).value); const cl = Math.min(hi, Math.max(lo, isNaN(v) ? lo : v)); $(id).value = cl; setCfg({ [key]: cl }); };
  };
  num("ftp", "ftp", 100, 450); num("kg", "kg", 40, 150); num("bike", "bikeGoal", 0, 1000);
  $("climb").onchange = () => setCfg({ climb: +$("climb").value });
  $("quest").onchange = () => setCfg({ quest: +$("quest").value });
  $("src").onchange = () => { setCfg({ src: +$("src").value }); wake(); };
  $("days").onchange = () => setCfg({ dayGoal: +$("days").value });
  $("anim").onchange = () => { setCfg({ anim: +$("anim").value }); wake(); };
  const bday = () => {
    const dd = +$("bdayD").value, mm = +$("bdayM").value;
    setCfg({ bday: dd && mm ? mm * 100 + dd : 0 });
  };
  $("bdayD").onchange = bday;
  $("bdayM").onchange = bday;
  $("bed").onchange = () => setCfg({ bed: +$("bed").value });
  $("assist").onchange = () => { setCfg({ assist: +$("assist").value }); wake(); };
  $("fname").oninput = () => { state.names[state.key] = $("fname").value; LS.set("names", state.names); };

  $("wake").onclick = () => { state.aod = false; $("aod").checked = false; $("aodBadge").hidden = true; wake(); };
  $("aod").onchange = () => { state.aod = $("aod").checked; $("aodBadge").hidden = !state.aod; state.dirty = true; if (!state.aod) wake(); };
  $("live").onchange = () => { state.live = $("live").checked; $("scrubWrap").classList.toggle("off", state.live); state.dirty = true; };
  $("scrub").oninput = () => {
    state.scrub = +$("scrub").value;
    $("scrubOut").textContent = String(Math.floor(state.scrub / 60)).padStart(2, "0") + ":" + String(state.scrub % 60).padStart(2, "0");
    if (state.live) { state.live = false; $("live").checked = false; $("scrubWrap").classList.remove("off"); }
    state.dirty = true;
  };
  $("scrubWrap").classList.toggle("off", state.live);
  const sn = new Date();
  state.scrub = sn.getHours() * 60 + sn.getMinutes();
  $("scrub").value = state.scrub;
  $("scrubOut").textContent = String(sn.getHours()).padStart(2, "0") + ":" + String(sn.getMinutes()).padStart(2, "0");

  $("surprise").onclick = () => {
    const f = faces[Math.floor(Math.random() * faces.length)];
    const acc = hexNum(ACCENTS[Math.floor(Math.random() * ACCENTS.length)]);
    state.key = f.key;
    setCfg({ accent: acc, style: 1 + Math.floor(Math.random() * (f.styles || [1]).length) });
    selectFace(f.key);
  };

  $("copy").onclick = async () => {
    const txt = $("code").textContent;
    try { await navigator.clipboard.writeText(txt); $("copy").textContent = "Kopiert"; }
    catch { const r = document.createRange(); r.selectNodeContents($("code")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $("copy").textContent = "Markiert"; }
    setTimeout(() => ($("copy").textContent = "Kopieren"), 1600);
  };
  $("load").onclick = () => {
    const r = decodeCode($("codeIn").value);
    const err = $("codeErr");
    if (!r || !byKey[r.face]) {
      err.textContent = "Dieser Code passt nicht. Ein Face-Code beginnt mit FL1. und hat mindestens 12 durch Punkte getrennte Teile.";
      err.hidden = false;
      return;
    }
    err.hidden = true;
    state.cfgs[r.face] = r.cfg;
    for (const k of PERSONAL) state.personal[k] = r.cfg[k];
    LS.set("personal", state.personal);
    LS.set("cfgs", state.cfgs);
    selectFace(r.face);
    refreshTile(r.face);
  };

  // simulator sliders
  const sim = $("sim");
  sim.innerHTML = "";
  // the trends start at the values of the default histories
  const d0 = buildData(DEFAULT_CFG, {}, new Date());
  const defaults = { ...SIM_DEFAULTS, recovH: Math.round(SIM_DEFAULTS.recov / 60), wkBikeKm: Math.round(SIM_DEFAULTS.wkBike / 1000),
    hrTrend: d0.hr - d0.hrHist[54], stressTrend: d0.stress - d0.stressHist[46], bbTrend: d0.bb - d0.bbHist[45] };
  for (const [k, label, lo, hi, step, unit] of SIMS) {
    const row = document.createElement("div");
    row.className = "sim-row";
    const id = "sim_" + k;
    const v = state.sim[k] ?? defaults[k];
    row.innerHTML = `<label for="${id}">${label}</label><output id="${id}_o">${v}${unit}</output><input type="range" id="${id}" min="${lo}" max="${hi}" step="${step}" value="${v}">`;
    sim.appendChild(row);
    const inp = row.querySelector("input");
    inp.oninput = () => {
      state.sim[k] = +inp.value;
      row.querySelector("output").textContent = inp.value + unit;
      LS.set("sim", state.sim);
      state.dirty = true;
    };
    inp.onchange = () => faces.forEach((f) => refreshTile(f.key));
  }

  $("download").onclick = generate;
  if (usbSupported()) $("usbSend").onclick = sendUsb;
  else {
    $("usbSend").disabled = true;
    $("usbHint").textContent = "Direkt-Übertragung per USB geht in Chrome, Edge oder Brave – hier bitte die ZIP nutzen.";
  }
}

// ------------------------------------------------------------------ .prg generation
let assets = null;
async function loadAssets() {
  if (assets) return assets;
  if (window.FACELAB_ASSETS) assets = window.FACELAB_ASSETS;
  else assets = (await import("../assets.js")).default;
  return assets;
}
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function sha6(s) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...h.slice(0, 3)].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function readme(f, name, code, file) {
  return [
    `FaceLab – ${name}`,
    `Design: ${f.name}`,
    `Face-Code: ${code}`,
    "",
    "So kommt das Watchface auf deine Forerunner 970:",
    "1. Uhr per USB-Kabel mit dem Computer verbinden.",
    "   (Mac: vorher OpenMTP oder Android File Transfer installieren.)",
    `2. Die Datei ${file} in den Ordner GARMIN/APPS auf der Uhr kopieren.`,
    "3. Uhr trennen. Sie installiert das Watchface beim Trennen.",
    "4. Auf der Uhr das aktuelle Watchface lange gedrückt halten (oder Menü > Watchface),",
    `   zu \"${name}\" blättern und auswählen.`,
    "",
    "Anpassen direkt an der Uhr: Watchface lange drücken > Anpassen",
    "(Variante, Akzentfarbe, Datenfelder) bzw. > Einstellungen (FTP, Gewicht, Ziele, Animation).",
    "",
    "Update: Mit gleichem Namen neu erzeugen und die Datei ersetzen – das Watchface übernimmt die neue Konfiguration.",
    "Neuer Name = zusätzliches Watchface, das parallel auf der Uhr bleibt.",
    "Entfernen: Datei wieder aus GARMIN/APPS löschen oder in der Watchface-Liste löschen.",
    "",
  ].join("\r\n");
}

async function buildPrg() {
  const a = await loadAssets();
  const f = byKey[state.key];
  const cfg = cfgOf(state.key);
  const code = encodeCode(state.key, cfg);
  const name = ($("fname").value || f.name).trim().slice(0, 22) || f.name;
  const tag = await sha6(state.key + "|" + name);
  const prg = await patchPrg(b64(a.prgs[state.key]), {
    code, name, baseName: f.name, baseAppId: b64(a.appIds[state.key]), uniqueSeed: state.key + "|" + name,
  }, b64(a.key).buffer);
  return { f, code, name, tag, prg, file: `FL_${state.key}_${tag}.prg` };
}

async function sendUsb() {
  const btn = $("usbSend");
  const st = $("dlStatus");
  st.className = "status";
  btn.disabled = true;
  st.textContent = "Watchface wird gebaut und signiert …";
  try {
    const { prg, file, name } = await buildPrg();
    await sendToWatch(file, prg, (m) => { st.textContent = m; });
    st.textContent = `Auf der Uhr: ${name}. Jetzt das USB-Kabel abziehen – die Uhr installiert das Watchface beim Trennen.`;
    st.classList.add("ok");
  } catch (e) {
    const code = e && e.code;
    st.classList.add("bad");
    st.textContent = code === "declined" ? "Keine Uhr ausgewählt. Ist sie per USB angeschlossen und entsperrt?"
      : code === "busy" ? "Die Uhr ist von einem anderen Programm belegt (Garmin Express, OpenMTP, Android File Transfer, Fotos/Digitale Bilder). Programm schließen, Uhr kurz ab- und wieder anstecken, nochmal versuchen."
      : "Übertragung fehlgeschlagen: " + (e && e.message ? e.message : e) + " – Uhr ab- und wieder anstecken und nochmal versuchen.";
  } finally {
    btn.disabled = false;
  }
}

async function generate() {
  const btn = $("download");
  const st = $("dlStatus");
  st.className = "status";
  btn.disabled = true;
  st.textContent = "Watchface wird gebaut und signiert …";
  try {
    const { f, code, name, tag, prg, file } = await buildPrg();
    const zip = makeZip([{ name: file, data: prg }, { name: "ANLEITUNG.txt", data: readme(f, name, code, file) }]);
    const zipName = `FaceLab-${name.replace(/[^A-Za-z0-9ÄÖÜäöüß_-]+/g, "-")}-${tag}.zip`;
    const blob = new Blob([zip], { type: "application/zip" });
    const dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
    if (dl) {
      await dl.save({ filename: zipName, data: blob });
      st.textContent = `Gespeichert: ${zipName}`;
    } else {
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = url;
      el.download = zipName;
      document.body.appendChild(el);
      el.click();
      el.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      st.textContent = `Fertig: ${zipName}`;
    }
    st.classList.add("ok");
  } catch (e) {
    const code = e && e.code;
    st.classList.add("bad");
    st.textContent = code === "declined" ? "Speichern abgebrochen."
      : code === "rate_limited" ? "Es ist schon ein Speichern-Dialog offen. Bitte kurz warten."
      : code === "extension_not_enabled" || code === "rejected_extension" ? "ZIP-Downloads sind in dieser Ansicht gesperrt. Öffne das Studio im Browser auf claude.ai oder nutze die lokale Datei FaceLab.html."
      : code === "unavailable" || code === "not_granted" ? "Speichern ist in dieser Ansicht nicht möglich. Öffne das Studio im Browser auf claude.ai."
      : "Das hat nicht geklappt: " + (e && e.message ? e.message : e);
  } finally {
    btn.disabled = false;
  }
}

// ------------------------------------------------------------------ boot
function boot() {
  bindInputs();
  buildGallery();
  syncPanel();
  sizeScreen();
  setupMini();
  screen.addEventListener("click", onScreenTap);
  new ResizeObserver(sizeScreen).observe(screen);
  setInterval(() => faces.forEach((f) => refreshTile(f.key)), 60000);
  requestAnimationFrame(loop);
  $("stageNote").textContent = "Die Vorschau nutzt exakt denselben Zeichen-Code wie die Uhr. Animationen laufen nach dem Handgelenk-Heben etwa 12 Sekunden.";
}
boot();
