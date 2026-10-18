#!/usr/bin/env python3
"""Pre-renders DEEP ("Tiefer Raum"): a space-telescope view for the AMOLED screen.

sky1..3.jpg: nebulae from domain-warped fractal noise in three palettes (Hubble: teal, gold and red
emission; Webb: amber dust and blue gas; Orion: magenta and blue), dark dust lanes, a dense star field
with colour temperatures and a few bright stars with six-pointed diffraction spikes.
star.png: one diffraction-spiked star (white, tinted and drawn additively to twinkle).
streak.png: a shooting star. big/small: glyph strips (Avenir Next Ultra Light / Medium).
Usage: python3 tools/render/deep.py
"""
import math

import numpy as np
from PIL import Image, ImageFilter

from common import AVENIR, C, N, Out, dither565, glyph_strip, rng

S2 = 2  # supersampling for the sky (the nebula is soft; stars are drawn at their own scale)
TW = [(318, 96), (104, 150), (372, 300), (150, 352), (262, 70), (60, 262)]  # twinkling stars


def noise(size, cells, seed):
    r = np.random.default_rng(seed).random((cells, cells)).astype(np.float32)
    im = Image.fromarray((r * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC)
    return np.asarray(im).astype(np.float32) / 255


def fbm(size, seed, oct=6, base=3):
    out = np.zeros((size, size), np.float32)
    amp, tot = 1.0, 0.0
    for i in range(oct):
        out += noise(size, base * 2 ** i, seed + i * 17) * amp
        tot += amp
        amp *= 0.55
    return out / tot


def warp(f, dx, dy, k):
    h, w = f.shape
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    xs = np.clip(x + (dx - 0.5) * k, 0, w - 1.001)
    ys = np.clip(y + (dy - 0.5) * k, 0, h - 1.001)
    x0, y0 = xs.astype(np.int32), ys.astype(np.int32)
    fx, fy = xs - x0, ys - y0
    a = f[y0, x0] * (1 - fx) + f[y0, x0 + 1] * fx
    b = f[y0 + 1, x0] * (1 - fx) + f[y0 + 1, x0 + 1] * fx
    return a * (1 - fy) + b * fy


PALETTES = {
    1: ((0.15, 0.75, 0.80), (1.00, 0.72, 0.30), (0.95, 0.20, 0.18)),  # Hubble
    2: ((1.00, 0.62, 0.22), (0.30, 0.55, 1.00), (0.95, 0.85, 0.65)),  # Webb
    3: ((0.95, 0.25, 0.65), (0.25, 0.45, 1.00), (0.75, 0.55, 1.00)),  # Orion
}


def sky(style, seed=11):
    m = 160  # margin: the warp pulls from outside, crop it away afterwards
    n = N * S2 + 2 * m
    g1, g2, g3 = (np.array(c, np.float32) for c in PALETTES[style])
    wx, wy = fbm(n, seed + 1, 5, 2), fbm(n, seed + 2, 5, 2)
    gas = warp(fbm(n, seed + 3, 7, 3), wx, wy, 220)
    gas2 = warp(fbm(n, seed + 4, 7, 4), wy, wx, 160)
    dust = warp(fbm(n, seed + 5, 7, 3), wx, wy, 120)
    y, x = (np.mgrid[0:n, 0:n].astype(np.float32) - m) / S2
    # the nebula lies along a diagonal band with a bright core off-centre
    band = np.exp(-(((x - C) * 0.55 - (y - C) * 0.84 + 30) / 115) ** 2)
    core = np.exp(-(((x - 300) ** 2 + (y - 150) ** 2) / (2 * 70 ** 2)))
    a = np.clip((gas - 0.42) * 3.0, 0, 1) ** 1.9 * (0.12 + 1.0 * band)
    b = np.clip((gas2 - 0.47) * 3.4, 0, 1) ** 2.2 * (0.08 + band)
    # glowing filaments: ridges of the warped noise
    fil = (1 - np.abs(2 * warp(fbm(n, seed + 8, 7, 5), wx, wy, 260) - 1)) ** 9 * (0.15 + band)
    img = a[..., None] * g1 * 0.95 + b[..., None] * g2 * 0.85 + fil[..., None] * (g1 * 0.5 + g2 * 0.5 + 0.25) * 0.65
    img += (core ** 1.5)[..., None] * g3 * 0.55 * (0.6 + 0.6 * gas)[..., None]
    img += (core ** 4)[..., None] * 0.35
    # dark dust lanes cut through the glow
    lanes = np.clip((dust - 0.48) * 4.5, 0, 1)
    img *= (1 - 0.92 * lanes * (0.4 + 0.6 * band))[..., None]
    # keep the middle calmer for the time
    calm = np.exp(-(((x - C) / 160) ** 2 + ((y - 205) / 82) ** 2))
    img *= (1 - 0.62 * calm)[..., None]
    img = img[m:m + N * S2, m:m + N * S2]
    im = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8), "RGB").resize((N, N), Image.LANCZOS)
    img = np.asarray(im).astype(np.float32) / 255
    img = stars(img, seed)
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    rr = np.sqrt((xx - C) ** 2 + (yy - C) ** 2)
    img *= np.clip((227.5 - rr) / 2, 0, 1)[..., None]
    return dither565(Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8), "RGB"), 0.6)


def temp_color(t):
    """0 = cool red, 1 = hot blue-white."""
    return np.array([1.0 - 0.25 * t, 0.78 + 0.18 * t, 0.55 + 0.45 * t], np.float32)


def stars(img, seed):
    r = np.random.default_rng(seed + 99)
    h, w = img.shape[:2]
    out = img.copy()
    for i in range(4200):
        x, y = r.random() * w, r.random() * h
        b = r.pareto(2.2) * 0.12
        if b < 0.03:
            continue
        col = temp_color(r.random()) * min(1.0, b)
        s = 0.55 + min(1.4, b * 0.8)
        x0, x1, y0, y1 = int(x - 3), int(x + 4), int(y - 3), int(y + 4)
        if x0 < 0 or y0 < 0 or x1 >= w or y1 >= h:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        psf = np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * (s * 0.6) ** 2))
        out[y0:y1, x0:x1] += psf[..., None] * col
    # a few bright stars with diffraction spikes
    sp = spiked(64)
    spa = np.asarray(sp).astype(np.float32) / 255
    for (x, y) in [(84, 120), (390, 220), (210, 392), (330, 360)]:
        k = 0.8 + 0.4 * r.random()
        col = temp_color(r.random())
        x0, y0 = x - 32, y - 32
        reg = out[y0:y0 + 64, x0:x0 + 64]
        reg += spa[..., None] * col * k
    return np.clip(out, 0, 1)


def spiked(size):
    """A star with the six-pointed diffraction pattern of a segmented mirror (+ two short ones)."""
    n = size * 3
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    x = (xx + 0.5) / 3 - size / 2
    y = (yy + 0.5) / 3 - size / 2
    d = np.sqrt(x * x + y * y) + 1e-3
    a = np.arctan2(y, x)
    v = np.exp(-(d / 1.3) ** 2) + 0.35 * np.exp(-d / 4.5)
    for k in range(6):
        ak = k * math.pi / 3 + math.pi / 2
        dev = np.abs(np.sin(a - ak)) * d
        along = np.cos(a - ak) > 0
        v += along * np.exp(-(dev / 0.55) ** 2) * np.exp(-d / (size * 0.22)) * 0.9
    for k in (0, 1):
        ak = k * math.pi
        dev = np.abs(np.sin(a - ak)) * d
        along = np.cos(a - ak) > 0
        v += along * np.exp(-(dev / 0.45) ** 2) * np.exp(-d / (size * 0.09)) * 0.5
    v = np.clip(v, 0, 1)
    im = Image.fromarray((v * 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)
    return im


def streak():
    w, h = 120, 9
    n_w, n_h = w * 3, h * 3
    yy, xx = np.mgrid[0:n_h, 0:n_w].astype(np.float32)
    x = (xx + 0.5) / 3
    y = (yy + 0.5) / 3 - h / 2
    t = x / w
    v = np.exp(-(y / (0.6 + 1.6 * t)) ** 2) * t ** 2.2
    v += np.exp(-((x - w + 3) ** 2 + y ** 2) / 6) * 1.2
    v = np.clip(v, 0, 1)
    im = Image.fromarray((v * 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)
    return Image.merge("RGB", (im, im, im))


def main():
    o = Out("DEEP", "deep")
    for st in PALETTES:
        o.save("sky%d" % st, sky(st), "jpg")
    o.save("star", Image.merge("RGB", [spiked(48)] * 3), "jpg")
    o.save("streak", streak(), "jpg")
    big, cw, adv = glyph_strip("0123456789:", AVENIR, 104, 100, idx=10, glow=((3, 0.35), (10, 0.2)))
    o.save("big", big)
    o.const("BIG", "0123456789:")
    o.const("BIG_CW", cw)
    o.const("BIG_H", 100)
    o.const("BIG_ADV", adv)
    chars = " 0123456789.:-/%ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ"
    small, scw, sadv = glyph_strip(chars, AVENIR, 15, 20, idx=5)
    o.save("small", small)
    o.const("SMALL", chars)
    o.const("SMALL_CW", scw)
    o.const("SMALL_H", 20)
    o.const("SMALL_ADV", sadv)
    o.const("TW", [v for p in TW for v in p])
    o.write()


if __name__ == "__main__":
    main()
