// Shared data model: config, Face-Code, complication formatting and the
// simulated sensor data used by the studio. Mirrors watch/source/Data.mc + Cfg.mc.
import { G } from "./gfx.js";
import { AST } from "./astro.js";

// Complication types (Toybox.Complications.COMPLICATION_TYPE_*) offered for data slots.
export const SLOT_TYPES = [
  [23, "B-BATT", "Body Battery"],
  [21, "ERHOLUNG", "Erholungszeit"],
  [20, "RAD/WO", "Rad-km diese Woche"],
  [19, "LAUF/WO", "Lauf-km diese Woche"],
  [25, "VO2 RAD", "VO2max Rad"],
  [24, "VO2 LAUF", "VO2max Laufen"],
  [42, "SCHLAF", "Schlafscore"],
  [22, "STRESS", "Stress"],
  [18, "PULS", "Herzfrequenz"],
  [36, "ATMUNG", "Atemfrequenz"],
  [35, "SPO2", "Pulsoximeter"],
  [2, "SCHRITTE", "Schritte"],
  [4, "ETAGEN", "Etagen"],
  [5, "INT-MIN", "Intensitätsminuten"],
  [3, "KCAL", "Kalorien"],
  [1, "AKKU", "Akku"],
  [38, "TEMP", "Temperatur"],
  [15, "HÖHE", "Höhe"],
  [16, "DRUCK", "Luftdruck"],
  [13, "AUFGANG", "Sonnenaufgang"],
  [14, "UNTERG.", "Sonnenuntergang"],
  [17, "NACHR.", "Benachrichtigungen"],
  [26, "STATUS", "Trainingsstatus"],
  [27, "5K", "Prognose 5 km"],
  [28, "10K", "Prognose 10 km"],
  [29, "HM", "Prognose Halbmarathon"],
  [30, "M", "Prognose Marathon"],
];
const SLOT_LABEL = Object.fromEntries(SLOT_TYPES.map(([t, l]) => [t, l]));

export const CLIMBS = [
  { name: "Alpe d'Huez", m: 1071, turns: 21 },
  { name: "Mont Ventoux", m: 1610, turns: 0 },
  { name: "Stelvio", m: 1808, turns: 48 },
  { name: "Everest", m: 8848, turns: 0 },
];

export const DEFAULT_CFG = {
  style: 1, accent: 0xff5a1f, dcol: 0xffffff, slots: [23, 21, 20],
  ftp: 250, kg: 75, climb: 0, quest: 1, anim: 2, bikeGoal: 150,
};

const hex6 = (n) => (n >>> 0).toString(16).toUpperCase().padStart(6, "0").slice(-6);

// FL1.<face>.<style>.<accent>.<dcol>.<s1>-<s2>-<s3>.<ftp>.<kg>.<climb>.<quest>.<anim>.<bikeGoal>
export function encodeCode(face, c) {
  return ["FL1", face, c.style, hex6(c.accent), hex6(c.dcol), c.slots.join("-"), c.ftp, c.kg, c.climb, c.quest, c.anim, c.bikeGoal].join(".");
}
export function decodeCode(s) {
  const p = (s || "").trim().toUpperCase().split(".");
  if (p.length < 12 || p[0] !== "FL1") return null;
  const n = (v, lo, hi, def) => { const x = parseInt(v, 10); return isNaN(x) ? def : G.clamp(x, lo, hi); };
  const sl = p[5].split("-").map((v) => parseInt(v, 10) || 0);
  while (sl.length < 3) sl.push(0);
  return {
    face: p[1],
    cfg: {
      style: n(p[2], 1, 9, 1), accent: parseInt(p[3], 16) || 0xff5a1f, dcol: parseInt(p[4], 16) || 0xffffff,
      slots: sl.slice(0, 3), ftp: n(p[6], 50, 600, 250), kg: n(p[7], 30, 200, 75), climb: n(p[8], 0, 3, 0),
      quest: n(p[9], 0, 2, 1), anim: n(p[10], 0, 2, 2), bikeGoal: n(p[11], 0, 2000, 150),
    },
  };
}

// Format a complication value into { lbl, val } — identical to Data.mc fmtSlot().
export function fmtSlot(type, raw, metric) {
  const lbl = SLOT_LABEL[type] || "--";
  if (raw === null || raw === undefined || raw === -1) return { lbl, val: "--", raw: -1 };
  let val;
  switch (type) {
    case 21: val = raw >= 60 ? Math.round(raw / 60) + "H" : raw + "M"; break;
    case 19: case 20: {
      const km = metric ? raw / 1000 : raw / 1609.344;
      val = km >= 100 ? "" + Math.round(km) : km.toFixed(1); break;
    }
    case 2: case 3: val = G.num(raw); break;
    case 15: val = "" + Math.round(metric ? raw : raw * 3.28084); break;
    case 16: val = "" + Math.round(raw / 100); break;
    case 13: case 14: val = G.pad2(Math.floor(raw / 3600)) + ":" + G.pad2(Math.floor((raw % 3600) / 60)); break;
    case 38: val = Math.round(metric ? raw : raw * 1.8 + 32) + "°"; break;
    case 27: case 28: case 29: case 30: val = G.race(raw); break;
    case 26: val = ("" + raw).toUpperCase(); break;
    case 1: case 35: val = Math.round(raw) + "%"; break;
    default: val = "" + Math.round(raw);
  }
  return { lbl, val, raw };
}

// ------------------------------------------------------------ persistence
export class Store {
  constructor() { this.m = new Map(); }
  get(k, def) { return this.m.has(k) ? this.m.get(k) : def; }
  set(k, v) { this.m.set(k, v); }
}

// ------------------------------------------------------------ simulation
export const SIM_DEFAULTS = {
  bb: 68, stress: 28, steps: 7420, stepGoal: 10000, floors: 9, floorsGoal: 10, floorsWeek: 41,
  imWeek: 95, imGoal: 150, kcal: 1840, hr: 64, rhr: 48, sleep: 82, recov: 840, vo2b: 54, vo2r: 52,
  wkBike: 87400, wkRun: 21300, tStatus: "Produktiv", p5k: 1236, p10k: 2580, pHM: 5760, pM: 12300,
  resp: 14, spo2: 97, temp: 14, cond: 1, wind: 4.2, windDeg: 250, rain: 20, hiT: 17, loT: 8,
  batt: 76, battDays: 9, notif: 3, phone: true, alt: 212, pres: 101520,
  lat: 50.11, lon: 8.68, metric: true, is24: true,
};

const DOW = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
const MON = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];

function isoWeek(dt) {
  const t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}

// Build the data object `d` exactly like the watch's Data.refresh() would.
export function buildData(cfg, sim, now) {
  const dt = now || new Date();
  const s = { ...SIM_DEFAULTS, ...sim };
  const tz = -dt.getTimezoneOffset();
  const doy = Math.floor((Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) - Date.UTC(dt.getFullYear(), 0, 0)) / 86400000);
  const unix = Math.floor(dt.getTime() / 1000);
  const mins = dt.getHours() * 60 + dt.getMinutes();

  // histories: deterministic wiggles around current values
  const hist = (n, base, amp, seed, lo, hi) => {
    const a = [];
    for (let i = 0; i < n; i++) a.push(Math.round(G.clamp(base + G.noise(seed + i * 0.37) * amp * (i / n + 0.3), lo, hi)));
    a[n - 1] = base;
    return a;
  };
  const d = {
    h: dt.getHours(), m: dt.getMinutes(), s: dt.getSeconds(), is24: s.is24,
    dow: dt.getDay(), day: dt.getDate(), mon: dt.getMonth() + 1, year: dt.getFullYear(), doy, wk: isoWeek(dt),
    dowStr: DOW[dt.getDay()], monStr: MON[dt.getMonth()], unix, tz, mins,
    steps: s.steps, stepGoal: s.stepGoal, floors: s.floors, floorsGoal: s.floorsGoal, floorsWeek: s.floorsWeek,
    imWeek: s.imWeek, imGoal: s.imGoal, kcal: s.kcal, distM: Math.round(s.steps * 0.78),
    hr: s.hr, rhr: s.rhr, hrMax: 188,
    hrHist: hist(60, s.hr, 22, 3.1, 40, 180),
    bb: s.bb, bbHist: hist(48, s.bb, 25, 9.7, 5, 100),
    stress: s.stress, stressHist: hist(48, s.stress, 30, 17.2, 0, 100),
    sleep: s.sleep, recov: s.recov, vo2b: s.vo2b, vo2r: s.vo2r, wkBike: s.wkBike, wkRun: s.wkRun, tStatus: s.tStatus,
    p5k: s.p5k, p10k: s.p10k, pHM: s.pHM, pM: s.pM, resp: s.resp, spo2: s.spo2,
    temp: s.temp, cond: s.cond, wind: s.wind, windDeg: s.windDeg, rain: s.rain, hiT: s.hiT, loT: s.loT,
    batt: s.batt, battDays: s.battDays, charging: false, notif: s.notif, phone: s.phone, dnd: false, alarms: 1,
    alt: s.alt, pres: s.pres, metric: s.metric,
    lat: s.lat, lon: s.lon, locOk: true,
    cfg: { ...cfg },
    accent: cfg.accent, dcol: cfg.dcol,
  };
  d.sunrise = AST.cross(doy, d.lat, d.lon, tz, -0.833, true);
  d.sunset = AST.cross(doy, d.lat, d.lon, tz, -0.833, false);
  d.moon = AST.moon(unix);
  const rawFor = {
    1: d.batt, 2: d.steps, 3: d.kcal, 4: d.floors, 5: d.imWeek, 13: d.sunrise * 60, 14: d.sunset * 60, 15: d.alt,
    16: d.pres, 17: d.notif, 18: d.hr, 19: d.wkRun, 20: d.wkBike, 21: d.recov, 22: d.stress, 23: d.bb, 24: d.vo2r,
    25: d.vo2b, 26: d.tStatus, 27: d.p5k, 28: d.p10k, 29: d.pHM, 30: d.pM, 35: d.spo2, 36: d.resp, 38: d.temp, 42: d.sleep,
  };
  d.slots = cfg.slots.map((t) => fmtSlot(t, rawFor[t] === undefined ? -1 : rawFor[t], d.metric));
  return d;
}
