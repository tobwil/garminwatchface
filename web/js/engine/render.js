// Renders a face onto a canvas exactly like FaceView.onUpdate() on the watch.
import { Dc } from "./dc.js";
import { defaultAod } from "./st.js";

export const SIZE = 454;
export const INTRO_MS = 1400;

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

// a = { t, intro, live }
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
    else face.draw(dc, d, a);
  } catch (e) {
    console.error(e);
  }
  dc.clearClip();
  ctx.restore();
}

export function animState(t, cfg) {
  const intro = cfg.anim === 0 ? 1 : Math.max(0, Math.min(1, t / INTRO_MS));
  return { t, intro, live: cfg.anim > 0 };
}
