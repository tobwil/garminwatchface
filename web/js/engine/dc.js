// Dc — a canvas shim that mirrors the Toybox.Graphics.Dc API of Connect IQ.
// Faces are written against this subset so they port 1:1 to Monkey C.
//
// Angles for drawArc follow Garmin semantics: degrees, 0 = 3 o'clock,
// counter-clockwise positive. ARC_CCW = 0, ARC_CW = 1 (Graphics.ARC_*).

export const ARC_CCW = 0;
export const ARC_CW = 1;
export const TRANSPARENT = -1;

function css(c) {
  if (c === -1 || c == null) return null;
  const u = c >>> 0;
  const a = u > 0xffffff ? ((u >>> 24) & 255) / 255 : 1;
  const r = (u >> 16) & 255, g = (u >> 8) & 255, b = u & 255;
  return a < 1 ? `rgba(${r},${g},${b},${a.toFixed(3)})` : `rgb(${r},${g},${b})`;
}

export class Dc {
  constructor(ctx, w, h) {
    this.ctx = ctx;
    this.w = w;
    this.h = h;
    this.fg = 0xffffff;
    this.bg = 0;
    this.pen = 1;
    this.aa = true;
  }
  getWidth() { return this.w; }
  getHeight() { return this.h; }
  setAntiAlias(on) { this.aa = on; this.ctx.imageSmoothingEnabled = on; }
  setColor(fg, bg) {
    this.fg = fg;
    if (bg !== undefined) this.bg = bg;
  }
  setPenWidth(w) { this.pen = Math.max(1, w); }
  clear() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(ctx.__base || new DOMMatrix());
    const c = css(this.bg);
    if (c === null) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    else { ctx.fillStyle = c; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); }
    ctx.restore();
  }
  _fill() { const c = css(this.fg); if (c) { this.ctx.fillStyle = c; this.ctx.fill(); } }
  _stroke() {
    const c = css(this.fg);
    if (c) { const ctx = this.ctx; ctx.strokeStyle = c; ctx.lineWidth = this.pen; ctx.lineCap = "butt"; ctx.stroke(); }
  }
  fillCircle(x, y, r) { if (r <= 0) return; const c = this.ctx; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); this._fill(); }
  drawCircle(x, y, r) { if (r <= 0) return; const c = this.ctx; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); this._stroke(); }
  fillEllipse(x, y, a, b) { const c = this.ctx; c.beginPath(); c.ellipse(x, y, Math.max(0, a), Math.max(0, b), 0, 0, Math.PI * 2); this._fill(); }
  drawEllipse(x, y, a, b) { const c = this.ctx; c.beginPath(); c.ellipse(x, y, Math.max(0, a), Math.max(0, b), 0, 0, Math.PI * 2); this._stroke(); }
  drawArc(x, y, r, dir, a0, a1) {
    if (r <= 0) return;
    const c = this.ctx;
    c.beginPath();
    const s = (-a0 * Math.PI) / 180, e = (-a1 * Math.PI) / 180;
    if (Math.abs(a1 - a0) % 360 === 0 && a1 !== a0) c.arc(x, y, r, 0, Math.PI * 2);
    else c.arc(x, y, r, s, e, dir === ARC_CCW);
    this._stroke();
  }
  drawLine(x1, y1, x2, y2) { const c = this.ctx; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); this._stroke(); }
  drawPoint(x, y) { const c = css(this.fg); if (c) { this.ctx.fillStyle = c; this.ctx.fillRect(x, y, 1, 1); } }
  fillRectangle(x, y, w, h) { const c = css(this.fg); if (c) { this.ctx.fillStyle = c; this.ctx.fillRect(x, y, w, h); } }
  drawRectangle(x, y, w, h) { const c = this.ctx; c.beginPath(); c.rect(x, y, w, h); this._stroke(); }
  fillRoundedRectangle(x, y, w, h, r) { const c = this.ctx; c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); this._fill(); }
  drawRoundedRectangle(x, y, w, h, r) { const c = this.ctx; c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); this._stroke(); }
  fillPolygon(pts) {
    if (!pts.length) return;
    const c = this.ctx;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
    this._fill();
  }
  setClip(x, y, w, h) { const c = this.ctx; this.clearClip(); c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); this._clipped = true; }
  clearClip() { if (this._clipped) { this.ctx.restore(); this._clipped = false; } }
}
