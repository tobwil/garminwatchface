// Renders a face onto a canvas exactly like FaceView.onUpdate() on the watch.
import { Dc } from "./dc.js";
import { defaultAod } from "./st.js";
import { G } from "./gfx.js";

export const SIZE = 454;
export const INTRO_MS = 1400;
export const REVEAL = 0.4; // share of the intro that reveals the cached static layer
const band = (r) => Math.max(2, Math.round(227 * r));


export function prepCanvas(canvas, px) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const w = Math.round(px * dpr);
  if (canvas.width !== w) { canvas.width = w; canvas.height = w; }
  const ctx = canvas.getContext("2d");
  const sc = w / SIZE;
  const base = new DOMMatrix([sc, 0, 0, sc, 0, 0]);
  ctx.__base = base;
  ctx.setTransform(base);
  return ctx;
}

// Static layer cache (mirrors FaceView.staticLayer): per face and canvas size, the layer drawn by
// face.bg() is kept until face.bgKey() (or style/colours/units) changes.
const bgCache = new WeakMap();

function staticLayer(ctx, face, d, k) {
  const w = ctx.canvas.width;
  const key = [k, d.cfg.style, d.accent, d.dcol, d.metric].join("|");
  let m = bgCache.get(face);
  if (!m) { m = new Map(); bgCache.set(face, m); }
  let c = m.get(w);
  if (!c) {
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = w;
    c = { cv, key: null };
    m.set(w, c);
  }
  if (c.key !== key) {
    const o = c.cv.getContext("2d");
    o.setTransform(ctx.__base);
    o.fillStyle = "#000";
    o.fillRect(0, 0, SIZE, SIZE);
    const bdc = new Dc(o, SIZE, SIZE);
    bdc.setColor(0, 0);
    if (face.aa) bdc.setAntiAlias(face.aa());
    if (face.bg) face.bg(bdc, d);
    else face.draw(bdc, d, { t: 0, intro: 1, live: false, ms: 0, tap: 999999, bg: false, so: true });
    c.key = key;
  }
  return c.cv;
}

// a = { t, intro, live }; a.bg is set here when the cached static layer was drawn
export function render(ctx, face, d, a, aod) {
  ctx.save();
  ctx.setTransform(ctx.__base);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
  ctx.clip();
  const dc = new Dc(ctx, SIZE, SIZE);
  dc.setColor(0, 0);
  try {
    if (aod) { if (face.aod) face.aod(dc, d); else defaultAod(dc, d); }
    else {
      let aa = { ...a, bg: false, so: false };
      if (face.aa) dc.setAntiAlias(face.aa());
      // static layer from the cache; during the intro it is revealed like an old CRT switching
      // on: a band opens from the centre, the moving layer is clipped to it (mirrors FaceView)
      let rv = 1;
      if (face.bgKey) {
        const k = face.bgKey(d);
        if (k >= 0) {
          const cv = staticLayer(ctx, face, d, k);
          rv = face.reveal && !face.reveal() ? 1 : G.ease(G.clamp(a.intro / REVEAL, 0, 1));
          if (rv < 1) dc.setClip(0, 227 - band(rv), SIZE, 2 * band(rv));
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(cv, 0, 0);
          ctx.restore();
          aa = { ...a, bg: true, so: false };
        }
      }
      face.draw(dc, d, aa);
      if (rv < 1) {
        dc.clearClip();
        const h = band(rv);
        dc.setColor(G.dim(G.mix(0xffffff, d.accent, 0.35), 1 - rv * 0.6), -1);
        dc.fillRectangle(0, 226 - h, SIZE, 2);
        dc.fillRectangle(0, 226 + h, SIZE, 2);
      }
    }
  } catch (e) {
    console.error(e);
  }
  dc.clearClip();
  ctx.restore();
}

export function animState(t, cfg) {
  const intro = cfg.anim === 0 ? 1 : Math.max(0, Math.min(1, t / INTRO_MS));
  return { t, intro, live: cfg.anim > 0, ms: Math.floor(t) % 1000, tap: 999999 };
}
