#!/usr/bin/env python3
"""Pre-renders WORK ("Arbeitstag"): a calm, legible everyday face for the office.

base1..3.jpg: Graphit, Navy, Hell — a finely brushed dial, the working day as an engraved track from 7
to 19 o'clock with hour ticks and numbers, three glass tiles at the bottom.
big/mid/small: glyph strips (Avenir Next Demi Bold / Demi Bold / Medium), white, tinted on the watch.
icons: weather (sun, cloud, rain, snow, storm, fog, moon), energy, bell, calendar, battery.
dot: soft glow for the head of the day progress.
Usage: python3 tools/render/work.py
"""
import math

import numpy as np
from PIL import Image

from common import AVENIR, C, N, SS, Out, bloom, dither565, down, font, glyph_strip, grid, mask_draw, polar, smooth

LIGHT = math.radians(-35)
TR = 205  # day track radius
A0, A1 = -120.0, 120.0  # 7:00 .. 19:00
STYLES = {
    1: dict(bg=(0.085, 0.09, 0.10), hl=(0.20, 0.21, 0.23), ink=(0.62, 0.64, 0.68), tile=(0.13, 0.135, 0.15)),
    2: dict(bg=(0.04, 0.07, 0.15), hl=(0.12, 0.20, 0.38), ink=(0.58, 0.66, 0.80), tile=(0.07, 0.11, 0.22)),
    3: dict(bg=(0.86, 0.85, 0.82), hl=(0.97, 0.96, 0.93), ink=(0.38, 0.38, 0.40), tile=(0.93, 0.92, 0.89)),
}
TILES = [(117, 346), (227, 346), (337, 346)]  # tile centres
TILE_W, TILE_H = 96, 64


def ang(mins):
    return A0 + (mins - 420) / 720 * (A1 - A0)


def base(style):
    p = STYLES[style]
    bg, hl, ink, tile = (np.array(p[k], np.float32) for k in ("bg", "hl", "ink", "tile"))
    light = style == 3
    x, y = grid()
    r, th = polar(x, y)
    # finely brushed (vertical grain) with a broad soft sheen from the light
    grain = np.random.default_rng(3).normal(0, 1, x.shape[1]).astype(np.float32)
    g = np.convolve(grain, np.ones(5) / 5, "same")[None, :] * 0.012
    sheen = np.exp(-(((x - 150) ** 2 + (y - 110) ** 2) / (2 * 210 ** 2)))
    img = bg[None, None, :] + (hl - bg)[None, None, :] * (0.55 * sheen)[..., None] + g[..., None]
    # engraved day track: a groove with a lit lower edge
    a = np.degrees(th)
    on = (a >= A0 - 1) & (a <= A1 + 1)
    groove = smooth(TR + 6, TR + 4.5, r) * smooth(TR - 6, TR - 4.5, r) * on
    img = img * (1 - 0.45 * groove[..., None]) if not light else img * (1 - 0.12 * groove[..., None])
    lip = smooth(TR + 6.5, TR + 5.5, r) * smooth(TR + 4.5, TR + 5.5, r) * on
    img += (lip * (0.10 + 0.25 * np.clip(np.cos(th - LIGHT - math.pi), 0, 1)))[..., None] * (0.6 if light else 1)
    # hour ticks 7..19 and numbers
    def fn(dr, s):
        for h in range(7, 20):
            aa = math.radians(ang(h * 60))
            r0, r1 = (TR - 16, TR - 9) if h % 2 == 0 else (TR - 13, TR - 9)
            dr.line([((C + r0 * math.sin(aa)) * s, (C - r0 * math.cos(aa)) * s), ((C + r1 * math.sin(aa)) * s, (C - r1 * math.cos(aa)) * s)],
                    fill=255, width=int(1.6 * s))
            if h % 2 == 0:
                rr = TR - 28
                dr.text(((C + rr * math.sin(aa)) * s, (C - rr * math.cos(aa)) * s), str(h), font=font(AVENIR, 13, 5), fill=255, anchor="mm")
    m = mask_draw(N, N, fn)
    img = img * (1 - m[..., None]) + ink[None, None, :] * m[..., None]
    # three glass tiles with a soft top highlight and a hairline edge
    for (tx, ty) in TILES:
        dx = np.maximum(np.abs(x - tx) - (TILE_W / 2 - 14), 0)
        dy = np.maximum(np.abs(y - ty) - (TILE_H / 2 - 14), 0)
        d = np.sqrt(dx * dx + dy * dy) - 14
        inside = smooth(0.6, -0.6, d)
        edge = smooth(1.2, 0.2, np.abs(d + 0.6))
        top = np.clip(1 - (y - (ty - TILE_H / 2)) / TILE_H, 0, 1)
        col = tile[None, None, :] + (hl - tile)[None, None, :] * (0.25 * top)[..., None]
        img = img * (1 - inside[..., None]) + col * inside[..., None]
        img += (edge * (0.05 if not light else -0.06) * (0.6 + 0.4 * top))[..., None]
    img *= smooth(227.5, 225.5, r)[..., None]
    return dither565(down(np.clip(img, 0, 1)))


def icons():
    cw, ch = 30, 30

    def fn(dr, s):
        def o(i):
            return i * cw * s

        W = int(2.2 * s)
        # 0 sun
        dr.ellipse([o(0) + 9 * s, 9 * s, o(0) + 21 * s, 21 * s], outline=255, width=W)
        for k in range(8):
            a = k * math.pi / 4
            dr.line([o(0) + (15 + 9 * math.cos(a)) * s, (15 + 9 * math.sin(a)) * s, o(0) + (15 + 12.5 * math.cos(a)) * s, (15 + 12.5 * math.sin(a)) * s], fill=255, width=W)

        def cloud(i, dy=0):
            dr.ellipse([o(i) + 5 * s, (12 + dy) * s, o(i) + 15 * s, (22 + dy) * s], fill=255)
            dr.ellipse([o(i) + 10 * s, (7 + dy) * s, o(i) + 23 * s, (20 + dy) * s], fill=255)
            dr.rounded_rectangle([o(i) + 5 * s, (16 + dy) * s, o(i) + 26 * s, (22 + dy) * s], radius=3 * s, fill=255)
        cloud(1, 1)
        cloud(2, -3)
        for k in range(3):
            dr.line([o(2) + (9 + k * 6) * s, 22 * s, o(2) + (7 + k * 6) * s, 27 * s], fill=255, width=W)
        cloud(3, -3)
        for k in range(3):
            dr.ellipse([o(3) + (8 + k * 6) * s, 23 * s, o(3) + (11 + k * 6) * s, 26 * s], fill=255)
        cloud(4, -4)
        dr.polygon([(o(4) + 15 * s, 19 * s), (o(4) + 11 * s, 25 * s), (o(4) + 15 * s, 25 * s), (o(4) + 13 * s, 30 * s), (o(4) + 20 * s, 23 * s),
                    (o(4) + 16 * s, 23 * s), (o(4) + 18 * s, 19 * s)], fill=255)
        for k in range(4):
            dr.line([o(5) + 5 * s, (8 + k * 5) * s, o(5) + 25 * s, (8 + k * 5) * s], fill=255, width=W)
        dr.ellipse([o(6) + 7 * s, 6 * s, o(6) + 24 * s, 23 * s], fill=255)
        dr.ellipse([o(6) + 12 * s, 3 * s, o(6) + 28 * s, 19 * s], fill=0)
        # 7 energy (battery with a bolt), 8 bell, 9 calendar, 10 watch battery
        dr.rounded_rectangle([o(7) + 4 * s, 9 * s, o(7) + 24 * s, 21 * s], radius=2 * s, outline=255, width=W)
        dr.rectangle([o(7) + 24 * s, 13 * s, o(7) + 27 * s, 17 * s], fill=255)
        dr.polygon([(o(7) + 15 * s, 10 * s), (o(7) + 10 * s, 16 * s), (o(7) + 14 * s, 16 * s), (o(7) + 13 * s, 20 * s), (o(7) + 18 * s, 14 * s),
                    (o(7) + 14 * s, 14 * s)], fill=255)
        dr.pieslice([o(8) + 7 * s, 5 * s, o(8) + 23 * s, 25 * s], 180, 360, fill=255)
        dr.rectangle([o(8) + 7 * s, 15 * s, o(8) + 23 * s, 21 * s], fill=255)
        dr.rectangle([o(8) + 5 * s, 21 * s, o(8) + 25 * s, 23 * s], fill=255)
        dr.ellipse([o(8) + 12.5 * s, 23 * s, o(8) + 17.5 * s, 28 * s], fill=255)
        dr.rounded_rectangle([o(9) + 5 * s, 7 * s, o(9) + 25 * s, 25 * s], radius=3 * s, outline=255, width=W)
        dr.rectangle([o(9) + 5 * s, 7 * s, o(9) + 25 * s, 12 * s], fill=255)
        for k in range(2):
            dr.line([o(9) + (10 + k * 10) * s, 4 * s, o(9) + (10 + k * 10) * s, 9 * s], fill=255, width=W)
        dr.rounded_rectangle([o(10) + 4 * s, 10 * s, o(10) + 23 * s, 20 * s], radius=2 * s, outline=255, width=W)
        dr.rectangle([o(10) + 23 * s, 13 * s, o(10) + 26 * s, 17 * s], fill=255)
        dr.rectangle([o(10) + 7 * s, 13 * s, o(10) + 15 * s, 17 * s], fill=255)
    m = mask_draw(cw * 11, ch, fn)
    return down(np.stack([np.ones_like(m), np.ones_like(m), np.ones_like(m), m], -1)), cw, ch


def dot():
    n = 24
    x, y = grid(n, n)
    d = np.sqrt((x - 12) ** 2 + (y - 12) ** 2)
    v = np.clip(np.exp(-(d / 4.2) ** 2) + 0.35 * np.exp(-(d / 9) ** 2), 0, 1)
    return down(np.stack([v, v, v], -1))


def main():
    o = Out("WORK", "work")
    for st in STYLES:
        o.save("base%d" % st, base(st), "jpg")
    big, cw, adv = glyph_strip("0123456789:", AVENIR, 100, 100, idx=2)
    o.save("big", big)
    o.const("BIG", "0123456789:")
    o.const("BIG_CW", cw)
    o.const("BIG_H", 100)
    o.const("BIG_ADV", adv)
    chars = " 0123456789.,:-/%°ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ"
    mid, mcw, madv = glyph_strip(chars, AVENIR, 23, 28, idx=2)
    o.save("mid", mid)
    o.const("MID", chars)
    o.const("MID_CW", mcw)
    o.const("MID_H", 28)
    o.const("MID_ADV", madv)
    small, scw, sadv = glyph_strip(chars, AVENIR, 13.5, 18, idx=5)
    o.save("small", small)
    o.const("SMALL", chars)
    o.const("SMALL_CW", scw)
    o.const("SMALL_H", 18)
    o.const("SMALL_ADV", sadv)
    ic, icw, ich = icons()
    o.save("icons", ic)
    o.const("ICON_W", icw)
    o.const("ICON_H", ich)
    o.save("dot", dot(), "jpg")
    o.const("TILES", [v for t in TILES for v in t])
    o.write()


if __name__ == "__main__":
    main()
