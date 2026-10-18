// Bitmaps for the canvas shim, mirroring what the watch does with pre-rendered images:
// WatchUi.loadResource(Rez.Drawables.x) -> Bmp.load(src), Graphics.AffineTransform -> AffineTransform,
// and (in dc.js) dc.drawBitmap / dc.drawBitmap2 with :transform, :tintColor, :filterMode and the
// source rectangle, plus dc.setBlendMode. Images are data URIs (web/js/img/<face>.js, written by
// tools/render/<face>.py together with the watch resources), so the bundled studio stays one file.
// Until every image has loaded, the static layer is not cached (render.js) and a "fl-bitmap" event
// tells the studio to redraw.

export const BLEND_MODE_DEFAULT = 0;
export const BLEND_MODE_SOURCE = 1;
export const BLEND_MODE_MULTIPLY = 2;
export const BLEND_MODE_ADDITIVE = 3;
export const FILTER_MODE_POINT = 0;
export const FILTER_MODE_BILINEAR = 1;

const cache = new Map();
let pending = 0;

class Bitmap {
  constructor(src) {
    this.el = new Image();
    this.ok = false;
    this.tints = new Map();
    pending++;
    this.el.onload = () => {
      this.ok = true;
      pending--;
      if (typeof window !== "undefined") window.dispatchEvent(new Event("fl-bitmap"));
    };
    this.el.onerror = () => { pending--; };
    this.el.src = src;
  }
  getWidth() { return this.el.naturalWidth; }
  getHeight() { return this.el.naturalHeight; }
  // the image multiplied with a colour (alpha kept), cached per colour
  tinted(c) {
    let cv = this.tints.get(c);
    if (cv) return cv;
    cv = document.createElement("canvas");
    cv.width = this.getWidth();
    cv.height = this.getHeight();
    const x = cv.getContext("2d");
    x.drawImage(this.el, 0, 0);
    x.globalCompositeOperation = "multiply";
    x.fillStyle = "#" + (c & 0xffffff).toString(16).padStart(6, "0");
    x.fillRect(0, 0, cv.width, cv.height);
    x.globalCompositeOperation = "destination-in";
    x.drawImage(this.el, 0, 0);
    this.tints.set(c, cv);
    return cv;
  }
}

export const Bmp = {
  load(src) {
    let b = cache.get(src);
    if (!b) { b = new Bitmap(src); cache.set(src, b); }
    return b;
  },
  pending() { return pending; },
};

// Graphics.AffineTransform: [m00 m01 m02; m10 m11 m12]; every operation post-multiplies (concatenate),
// so the last call acts first on the source image.
export class AffineTransform {
  constructor() { this.m = [1, 0, 0, 0, 1, 0]; }
  concatenate(x) {
    const a = this.m, b = x.m;
    this.m = [a[0] * b[0] + a[1] * b[3], a[0] * b[1] + a[1] * b[4], a[0] * b[2] + a[1] * b[5] + a[2],
      a[3] * b[0] + a[4] * b[3], a[3] * b[1] + a[4] * b[4], a[3] * b[2] + a[4] * b[5] + a[5]];
  }
  rotate(th) { const t = new AffineTransform(); t.m = [Math.cos(th), -Math.sin(th), 0, Math.sin(th), Math.cos(th), 0]; this.concatenate(t); }
  scale(sx, sy) { const t = new AffineTransform(); t.m = [sx, 0, 0, 0, sy, 0]; this.concatenate(t); }
  translate(tx, ty) { const t = new AffineTransform(); t.m = [1, 0, tx, 0, 1, ty]; this.concatenate(t); }
  setToRotation(th) { this.m = [1, 0, 0, 0, 1, 0]; this.rotate(th); }
  getMatrix() { return this.m.slice(); }
}
