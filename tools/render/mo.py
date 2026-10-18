#!/usr/bin/env python3
"""Pre-renders MO ("Mo"): a fluffy peach mochi seal pup who lives on the time.

The fur, shading, muzzle, blush, nose and whisker dots are baked; eyes, blinks, the mouth and all
effects are drawn live on the watch so Mo can blink, glance, yawn and cheer.
  body.png   sitting body (no limbs), centre at BODY_OX/OY
  lie.png    lying body (sleep), centre at LIE_OX/OY
  flip.png   one flipper with its soft drop shadow, turned around FLIP_PX/PY for arms and legs
  band.png   sport headband, an overlay of the sitting body (body centre at BAND_OX/OY)
  cap.png    nightcap, turned around its cuff centre CAP_PX/PY
  blob.png   soft contact shadow
  big.png    time digits (Inter Display SemiBold), white, tinted on the watch
  thin.png   always-on digits (Inter Display Light)
  txt.png    text (Inter Medium): date, status line and the speech bubble
  dusk.jpg   background of style 2 "Dämmerung"
  aod.png    sleeping Mo as a thin dim outline for the always-on screen
Usage: python3 tools/render/mo.py   (numpy + Pillow; needs the Inter / Inter Display fonts)
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from common import N, Out, dither565
from fur import (SS, E, Sprite, Style, arc_pts, blur, ell_mask, fill_poly, grid, over, paint, poly_mask, render_blob,
                 smooth, tint, to_pil)

FONT_DIRS = ["/usr/share/fonts/opentype/inter", "/usr/share/fonts/truetype/inter", "/usr/local/share/fonts",
             os.path.expanduser("~/Library/Fonts"), "/Library/Fonts", os.path.expanduser("~/.fonts")]


def inter(name):
    for d in FONT_DIRS:
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    raise SystemExit("font not found: %s (install Inter, https://rsms.me/inter)" % name)


S = 1.3  # body units -> px
BODY = Style(albedo=(1.0, 0.76, 0.60), amb=0.5, sss=(1.0, 0.40, 0.30), shadow=(0.95, 0.55, 0.62), sheen=(1, 0.96, 0.9),
             rim=(1.0, 0.78, 0.68), rim_k=0.30, fur=3.0, fur_int=2.0, dens_edge=2.4, dens_int=0.14, var=0.045,
             jit=0.32, grav=0.15, width=2)
LIMB = Style(**{**BODY.__dict__, "albedo": (1.0, 0.74, 0.58), "fur": 2.4, "dens_edge": 2.6})
PUFF = Style(**{**BODY.__dict__, "albedo": (0.97, 0.95, 0.93), "sss": (0.7, 0.7, 0.9), "shadow": (0.6, 0.62, 0.8),
                "rim": (0.85, 0.88, 1.0), "fur": 2.6, "dens_edge": 2.8})
MUZZLE = (1.0, 0.95, 0.90)
BAND = (0.93, 0.22, 0.30)
BODY_PARTS = ((0, 10, 58, 42), (0, -8, 45, 44))
LIGHT_UP = ((0, 1, 0.3), (1.0, 0.95, 0.9), 0.35)  # bounce light from the white digits below
EYE = (23, -2, 8.2, 10.2)  # eye centre x (+-), y, radii (body units)


def crop(im):
    """Crop a PIL RGBA image to its visible pixels -> (image, x0, y0)."""
    a = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(a > 3)
    x0, y0, x1, y1 = xs.min() - 1, ys.min() - 1, xs.max() + 2, ys.max() + 2
    x0, y0 = max(0, x0), max(0, y0)
    return im.crop((x0, y0, x1, y1)), x0, y0


def dither_rgba(im, amp=1.0):
    a = np.asarray(im).astype(np.float32)
    n = np.random.default_rng(97).uniform(-1, 1, a.shape[:2] + (1,)).astype(np.float32)
    a[..., :3] += n * np.array([4.0, 2.0, 4.0], np.float32) * amp
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8), "RGBA")


def muzzle(sp, dx=0, dy=0):
    return [(sp.e(dx + sx * 7.5, dy + 13.5, 10.5, 8.0), MUZZLE, 1.6 * sp.s) for sx in (-1, 1)]


def face_bake(sp, dx=0, dy=0, blush=0.42):
    """Blush, eye sockets, nose, whisker dots (the eyes and the mouth are drawn live)."""
    s, X, Y = sp.s, sp.X, sp.Y
    ex, ey, rx, ry = EYE
    for sx in (-1, 1):
        cx, cy = sp.P(dx + sx * (ex + 13), dy + ey + 14)
        tint(sp.img, X, Y, cx, cy, 9.5 * s, 5.5 * s, (1.0, 0.52, 0.58), blush)
    for sx in (-1, 1):
        cx, cy = sp.P(dx + sx * ex, dy + ey)
        ds, _ = E(cx, cy + ry * s * 0.08, rx * s * 1.28, ry * s * 1.22).field(X, Y)
        sp.img[..., :3] *= (1 - 0.07 * smooth(-2.5, 1.5, ds))[..., None]
    fill_poly(sp.img, [sp.P(dx - 4.2, dy + 6.6), sp.P(dx + 4.2, dy + 6.6), sp.P(dx, dy + 10.6)], (0.30, 0.15, 0.15))
    cx, cy = sp.P(dx - 1.2, dy + 7.6)
    m, _ = ell_mask(X, Y, cx, cy, 1.4 * s, 0.8 * s)
    paint(sp.img, m, (1, 0.9, 0.9), 0.55)
    for sx in (-1, 1):
        for (wx, wy) in ((9.5, 12.5), (12.5, 15.5), (8.0, 16.5)):
            cx, cy = sp.P(dx + sx * wx, dy + wy)
            m, _ = ell_mask(X, Y, cx, cy, 0.85 * s, 0.85 * s)
            paint(sp.img, m, (0.62, 0.40, 0.36), 0.8)


def body():
    W = 200
    sp = Sprite(W, W, W // 2, W // 2, S)
    parts = [sp.e(*p) for p in BODY_PARTS]
    b = sp.blob(parts, BODY, muzzle(sp), seed=4, extra_light=LIGHT_UP)
    face_bake(sp)
    return sp, b


def lie():
    sp = Sprite(260, 160, 128, 84, S)
    sp.blob([sp.e(6, 10, 76, 30), sp.e(-12, -2, 56, 33)], BODY, muzzle(sp, -16, -2), seed=4, k=16, extra_light=LIGHT_UP)
    sp.blob([sp.e(-44, 37, 8, 13, 8), sp.e(30, 38, 8, 12, -8)], LIMB, shadow=(0, 2, 2.5, 0.35), seed=5)
    face_bake(sp, -16, -2, 0.55)
    return sp


def flipper():
    sp = Sprite(36, 50, 18, 22, S)
    f = render_blob(36, 50, [sp.e(0, 0, 9.0, 14)], LIMB, seed=6)
    a = blur(f[..., 3], 2.2 * SS)
    a = np.roll(np.roll(a, int(2.2 * SS), 0), int(1.0 * SS), 1)
    sh = np.zeros_like(f)
    sh[..., 3] = a * 0.42
    over(sh, f)
    sp.img = sh
    return sp, sp.P(0, -14 * 0.62)


def long_arm():
    """A long flipper (hanging from the colon), pivot at its top end."""
    sp = Sprite(30, 80, 15, 38, S)
    f = render_blob(30, 80, [sp.e(0, 0, 7.5, 24)], LIMB, seed=7)
    a = blur(f[..., 3], 2.2 * SS)
    a = np.roll(np.roll(a, int(2.2 * SS), 0), int(1.0 * SS), 1)
    sh = np.zeros_like(f)
    sh[..., 3] = a * 0.42
    over(sh, f)
    sp.img = sh
    return sp, sp.P(0, -24 * 0.7)


def headband(sp, balpha, y0=-31, th=10, col=BAND, sag=6.0, half=47):
    """The concept's sport headband as an overlay of the body sprite."""
    X, Y, s = sp.X, sp.Y, sp.s
    ov = np.zeros_like(sp.img)
    cx, cy = sp.P(0, 0)
    u = (X - cx) / (half * s)
    yc = cy + (y0 - sag * u * u) * s
    m = smooth(th / 2 * s + 0.5, th / 2 * s - 0.5, np.abs(Y - yc)) * smooth(0.2, 0.6, balpha)
    shade = 0.55 + 0.5 * np.clip(1 - np.abs(u) ** 2, 0, 1) - 0.25 * np.clip(u, 0, 1)
    c = np.array(col, np.float32)[None, None] * shade[..., None]
    stripe = smooth(1.3 * s, 0.6 * s, np.abs(Y - yc)) * m
    c = c * (1 - stripe[..., None] * 0.85) + np.array([1, 0.97, 0.95]) * shade[..., None] * stripe[..., None] * 0.85
    ov[..., :3] = c
    ov[..., 3] = m
    kx, ky = sp.P(half * 0.95, y0 - sag * 0.8)
    for (tx, ty, rx, ry, a) in ((kx + 9 * s, ky - 4 * s, 9 * s, 4 * s, -30), (kx + 10 * s, ky + 5 * s, 9 * s, 3.6 * s, 20)):
        mm, _ = ell_mask(X, Y, tx, ty, rx, ry, a)
        paint(ov, mm, np.array(col) * 0.85, 1.0)
    mm, _ = ell_mask(X, Y, kx, ky, 4.5 * s, 4.5 * s)
    paint(ov, mm, np.array(col) * 0.95, 1.0)
    return ov


def nightcap():
    """Floppy striped nightcap with a fluffy cuff and pompom; pivot = cuff centre."""
    sp = Sprite(150, 116, 52, 90, S)
    X, Y, s = sp.X, sp.Y, sp.s
    # cone: from the cuff (-27..27, 0) up to the tip that flops over to the right
    def P(x, y):
        return sp.P(x, y)
    L = [P(-27, -2), P(-24, -22), P(-14, -40), P(2, -52), P(20, -56), P(38, -50), P(50, -38), P(54, -26)]
    R = [P(56, -22), P(48, -32), P(36, -40), P(22, -38), P(14, -26), P(20, -10), P(27, -2)]
    m = poly_mask(sp.img.shape, L + R)
    m = blur(m, 0.5 * SS)
    cx, cy = P(0, 0)
    u = (X - cx) / (30 * s)
    v = (Y - cy) / (60 * s)
    base = np.array([0.27, 0.33, 0.62], np.float32)
    light = np.clip(0.75 - 0.45 * u + 0.25 * v, 0.35, 1.2)
    col = base[None, None] * light[..., None]
    # soft stripes along the cone
    t = np.sqrt((X - P(-27, 0)[0]) ** 2 + (Y - P(-27, 0)[1]) ** 2) / s
    band_t = (np.sin(t * 0.42) > 0.55).astype(np.float32)
    band_t = blur(band_t, 0.6 * SS)
    col = col * (1 - 0.8 * band_t[..., None]) + np.array([0.88, 0.88, 0.97], np.float32)[None, None] * (light * 0.85)[..., None] * (0.8 * band_t)[..., None]
    # fold shadow along the flop
    fold = np.exp(-(((X - P(30, -36)[0]) ** 2 + (Y - P(30, -36)[1]) ** 2) / (2 * (12 * s) ** 2)))
    col *= (1 - 0.35 * fold)[..., None]
    sp.img[..., :3] = col
    sp.img[..., 3] = m
    sp.blob([sp.e(0, 0, 30, 8.5)], PUFF, seed=11, k=6)
    sp.blob([sp.e(57, -18, 9.5, 9.5)], PUFF, seed=12, shadow=(1, 1.5, 2, 0.3))
    return sp


def blob_shadow():
    w, h = 130, 34
    X, Y = grid(w, h)
    d = ((X - w / 2) / (w / 2 - 6)) ** 2 + ((Y - h / 2) / (h / 2 - 4)) ** 2
    a = np.exp(-d * 2.6) * 0.75
    img = np.zeros(X.shape + (4,), np.float32)
    img[..., 3] = a
    return to_pil(img)


def strip(chars, path, px, cell_h, base, pad=3):
    """Glyphs (white on transparent) in cells of equal width, baseline at `base` px of the cell."""
    f = ImageFont.truetype(path, int(px * SS))
    tmp = ImageDraw.Draw(Image.new("L", (10, 10)))
    adv = [max(1, int(round(tmp.textlength(ch, font=f) / SS))) for ch in chars]
    cw = max(adv) + 2 * pad
    im = Image.new("L", (cw * len(chars) * SS, cell_h * SS), 0)
    dr = ImageDraw.Draw(im)
    for i, ch in enumerate(chars):
        dr.text(((i * cw + pad) * SS, base * SS), ch, font=f, fill=255, anchor="ls")
    a = np.asarray(im).astype(np.float32) / 255
    rgba = np.ones(a.shape + (4,), np.float32)
    rgba[..., 3] = a
    out = to_pil(rgba)
    top = f.getbbox("0", anchor="ls")[1] / SS  # cap top relative to the baseline (negative)
    return out, cw, adv, int(round(base + top))


def hull(big, cw):
    """Solid silhouettes of the digits (each row filled from the first to the last ink): drawn in the
    background colour in front of Mo when he is behind the digits."""
    a = np.asarray(big)[..., 3].astype(np.float32) / 255
    out = np.zeros_like(a)
    for j in range(10):
        sub = a[:, j * cw:(j + 1) * cw]
        for r in range(sub.shape[0]):
            xs = np.flatnonzero(sub[r] > 0.5)
            if len(xs):
                out[r, j * cw + xs[0]:j * cw + xs[-1] + 1] = 1
        out[:, j * cw:(j + 1) * cw] = np.maximum(out[:, j * cw:(j + 1) * cw], sub)
    out = np.clip(blur(out, 0.5) * 1.6, 0, 1)
    rgba = np.ones(a.shape + (4,), np.uint8) * 255
    rgba[..., 3] = (out * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def dusk():
    x, y = grid(N, N)
    v = y / N
    stops = [(0.0, (0.035, 0.03, 0.10)), (0.35, (0.08, 0.05, 0.17)), (0.62, (0.20, 0.08, 0.20)),
             (0.85, (0.36, 0.14, 0.20)), (1.0, (0.46, 0.20, 0.20))]
    img = np.zeros(x.shape + (3,), np.float32)
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        t = np.clip((v - a) / (b - a), 0, 1)
        t = t * t * (3 - 2 * t)
        sel = (v >= a) & (v <= b)
        img[sel] = (np.array(ca) * (1 - t[..., None]) + np.array(cb) * t[..., None])[sel]
    # warm glow of the set sun below the horizon, cool haze up left
    g = np.exp(-(((x - 300) / 210) ** 2 + ((y - 520) / 150) ** 2))
    img += np.array([0.30, 0.14, 0.06]) * g[..., None]
    h = np.exp(-(((x - 120) / 160) ** 2 + ((y - 60) / 120) ** 2))
    img += np.array([0.02, 0.03, 0.08]) * h[..., None]
    # stars in the upper sky
    rng = np.random.default_rng(18)
    st = np.zeros(x.shape, np.float32)
    for _ in range(46):
        sx, sy = rng.uniform(40, 414), rng.uniform(30, 190)
        r = rng.uniform(0.45, 0.95)
        k = rng.uniform(0.25, 0.85) * (1 - sy / 260)
        st += k * np.exp(-((x - sx) ** 2 + (y - sy) ** 2) / (2 * r * r))
    img += np.clip(st, 0, 1)[..., None] * np.array([0.9, 0.9, 1.0])
    r = np.sqrt((x - 227) ** 2 + (y - 227) ** 2)
    img *= (1 - 0.35 * smooth(170, 227, r))[..., None]
    img *= smooth(227.5, 225.5, r)[..., None]
    return dither565(to_pil(np.clip(img, 0, 1)))


def aod_outline(lie_img):
    """Thin dim outline of the lying Mo plus the closed eyes and the nose (always-on screen)."""
    a = lie_img[..., 3]
    sil = (blur(a, 2.0 * SS) > 0.5).astype(np.float32)  # smooth silhouette (no fur noise)
    m = blur(sil, 0.5 * SS)
    er = blur((blur(sil, 1.0 * SS) > 0.97).astype(np.float32), 0.5 * SS)
    ov = np.zeros(a.shape + (4,), np.float32)
    ov[..., :3] = (0.62, 0.40, 0.33)
    ov[..., 3] = np.clip((m - er) * 1.6, 0, 1)
    return ov


def aod_face(ov, sp):
    """Closed eyes (arcs) and the nose of the lying Mo on the always-on outline."""
    from fur import stroke
    ex, ey = EYE[0], EYE[1]
    for sx in (-1, 1):
        pts = [sp.P(-16 + sx * ex + math.cos(t) * 8.4, -2 + ey + 1 + math.sin(t) * 4.2) for t in np.linspace(0.15, math.pi - 0.15, 14)]
        stroke(ov, pts, 1.6, (0.62, 0.40, 0.33))
    fill_poly(ov, [sp.P(-20.2, 4.6), sp.P(-11.8, 4.6), sp.P(-16, 8.6)], (0.62, 0.40, 0.33))
    return ov


def main():
    o = Out("MO", "mo")
    o.const("S", S)
    o.const("EYE", list(EYE))

    sp, b = body()
    im, x0, y0 = crop(dither_rgba(to_pil(sp.img)))
    o.save("body", im)
    o.const("BODY_OX", sp.ox - x0)
    o.const("BODY_OY", sp.oy - y0)
    o.const("BODY_W", im.width)
    o.const("BODY_H", im.height)
    # fur colour just above the eyes (the live eyelids of a tired Mo)
    arr = np.asarray(im).astype(np.float32)
    cx, cy = sp.ox - x0, sp.oy - y0
    pts = [arr[int(cy + (EYE[1] - EYE[3] * k) * S), int(cx + sx * EYE[0] * S) + dx, :3] for sx in (-1, 1) for dx in (-3, 0, 3)
           for k in (1.05, 1.25, 1.45)]
    c = np.mean(pts, 0)
    o.const("EYE_FUR", int(c[0]) << 16 | int(c[1]) << 8 | int(c[2]))

    ov = headband(sp, b[..., 3])
    im, x1, y1 = crop(dither_rgba(to_pil(ov)))
    o.save("band", im)
    o.const("BAND_OX", sp.ox - x1)
    o.const("BAND_OY", sp.oy - y1)

    ls = lie()
    im, x0, y0 = crop(dither_rgba(to_pil(ls.img)))
    o.save("lie", im)
    o.const("LIE_OX", ls.ox - x0)
    o.const("LIE_OY", ls.oy - y0)
    o.const("LIE_W", im.width)

    al = aod_face(aod_outline(ls.img), ls)
    im = to_pil(al)
    im, ax, ay = crop(im)
    im = im.resize((int(im.width * 0.8), int(im.height * 0.8)), Image.LANCZOS)
    o.save("aod", im)
    o.const("AOD_OX", round((ls.ox - ax) * 0.8))
    o.const("AOD_OY", round((ls.oy - ay) * 0.8))

    fs, piv = flipper()
    im, x0, y0 = crop(dither_rgba(to_pil(fs.img)))
    o.save("flip", im)
    o.const("FLIP_PX", round(piv[0] - x0, 1))
    o.const("FLIP_PY", round(piv[1] - y0, 1))

    ar, piv = long_arm()
    im, x0, y0 = crop(dither_rgba(to_pil(ar.img)))
    o.save("arm", im)
    o.const("ARM_PX", round(piv[0] - x0, 1))
    o.const("ARM_PY", round(piv[1] - y0, 1))

    cs = nightcap()
    im, x0, y0 = crop(dither_rgba(to_pil(cs.img)))
    o.save("cap", im)
    o.const("CAP_PX", round(cs.ox - x0, 1))
    o.const("CAP_PY", round(cs.oy - y0, 1))

    o.save("blob", blob_shadow())
    o.const("BLOB_W", 130)
    o.const("BLOB_H", 34)

    big, cw, adv, top = strip("0123456789:", inter("InterDisplay-SemiBold.otf"), 140, 114, 108)
    o.save("big", big)
    o.const("BIG_CW", cw)
    o.const("BIG_H", 114)
    o.const("BIG_TOP", top)
    o.const("BIG_ADV", adv)
    a = np.asarray(big)[:, 10 * cw:11 * cw, 3].max(1) > 128  # rows of the colon's dots
    rows = np.flatnonzero(a)
    o.const("BIG_DOT", int(round(rows[rows > rows.mean()].mean())))  # centre of the lower dot (cell px)
    o.save("hull", hull(big, cw))
    thin, cw, adv, top = strip("0123456789:", inter("InterDisplay-Light.otf"), 112, 92, 87)
    o.save("thin", thin)
    o.const("THIN_CW", cw)
    o.const("THIN_H", 92)
    o.const("THIN_TOP", top)
    o.const("THIN_ADV", adv)
    chars = (" !%'()+,-./0123456789:=?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüß")
    txt, cw, adv, top = strip(chars, inter("Inter-Medium.otf"), 17, 24, 18)
    o.save("txt", txt)
    o.const("TXT", chars)
    o.const("TXT_CW", cw)
    o.const("TXT_H", 24)
    o.const("TXT_TOP", top)
    o.const("TXT_ADV", adv)

    dk = dusk()
    o.save("dusk", dk, "jpg")
    c = np.asarray(dk).astype(np.float32)[230:320, 120:334].mean((0, 1))
    o.const("DUSK_MID", int(c[0]) << 16 | int(c[1]) << 8 | int(c[2]))  # the sky behind the digits
    o.write()


if __name__ == "__main__":
    main()
