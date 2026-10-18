#!/usr/bin/env python3
"""Pre-renders COCKPIT ("Cockpit"): a backlit sports-car instrument cluster.

Layers: cbase.jpg (chrome bezel, dark face, unlit printing, TFT glass), clight.jpg (the backlit
scale: white glow on black, drawn additively and tinted with the backlight colour), cred.jpg (the red
redline, additive), needle/nglow (tip-only needle and its glow), seg (one LED segment of the fuel and
temperature bars), icons (telltales), big/small (glyph strips for the TFT).
Usage: python3 tools/render/cockpit.py
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from common import (AVENIR, C, DIN, N, SS, Out, bloom, dither565, down, font, glyph_strip, grid, mask_draw,
                    polar, smooth)

LIGHT = math.radians(-35)
TFT_R = 118
NUM_R = 174
SEG_R = 186


def ang(v):
    """heart rate 0..200 -> degrees (0 = 12 o'clock, clockwise)."""
    return -135 + v / 200 * 270


def pt(r, deg, cx=C, cy=C):
    a = math.radians(deg)
    return cx + r * math.sin(a), cy - r * math.cos(a)


def base():
    x, y = grid()
    r, th = polar(x, y)
    img = np.zeros(x.shape + (3,), np.float32)
    # dark face with a faint radial sheen and a fine concentric groove texture
    face = 0.045 + 0.03 * (1 - smooth(0, 210, r)) + 0.006 * np.sin(r * 2 * math.pi / 2.2)
    img[...] = face[..., None] * np.array([0.95, 0.98, 1.05], np.float32)
    # chrome bezel at the edge: environment reflections from the light
    bz = smooth(213, 215, r) * smooth(227.5, 226, r)
    env = 0.22 + 0.62 * np.power(np.clip(np.cos(th - LIGHT), 0, 1), 2.5) + 0.12 * np.sin(th * 3 + 1) ** 2
    env += 0.35 * np.power(np.clip(np.cos(th - LIGHT - math.pi), 0, 1), 8)
    edge = 1 - 0.35 * np.abs((r - 220.5) / 6.5)
    chrome = np.clip(env * edge, 0, 1)
    img = img * (1 - bz[..., None]) + (chrome[..., None] * np.array([0.92, 0.95, 1.0], np.float32)) * bz[..., None]
    # inner bevel shadow below the bezel
    img *= (1 - 0.6 * smooth(205, 213, r) * (1 - bz))[..., None]
    # TFT: chrome ring and dark glass with a diagonal reflection
    ring = smooth(TFT_R - 0.5, TFT_R + 0.5, r) * smooth(TFT_R + 5.5, TFT_R + 4.5, r)
    envr = 0.25 + 0.6 * np.power(np.clip(np.cos(th - LIGHT), 0, 1), 3)
    img = img * (1 - ring[..., None]) + (envr[..., None] * 0.95) * ring[..., None]
    glass = smooth(TFT_R + 0.5, TFT_R - 0.5, r)
    refl = np.clip(1 - np.abs((x - C) * 0.7 + (y - C) * 0.7 + 40) / 60, 0, 1) * 0.035
    tft = (0.012 + refl)[..., None] * np.array([0.9, 0.95, 1.1], np.float32)
    img = img * (1 - glass[..., None]) + tft * glass[..., None]
    # unlit printing: the scale is faintly visible when the backlight is off
    img += (scale_mask() * 0.10)[..., None]
    img *= smooth(227.5, 225.5, r)[..., None]
    return dither565(down(np.clip(img, 0, 1)))


def scale_mask(red=False):
    """White scale (ticks, numerals, labels, icons) as a supersampled mask."""
    def fn(dr, s):
        for v in range(0, 201, 5):
            if (v >= 170) != red:
                continue
            major = v % 10 == 0
            r0, r1 = (194, 208) if major else (200, 208)
            w = 3.2 if major else 1.6
            a = math.radians(ang(v))
            ux, uy = math.sin(a), -math.cos(a)
            vx, vy = -uy, ux
            p = [(C + ux * r0 + vx * w / 2, C + uy * r0 + vy * w / 2), (C + ux * r1 + vx * w / 2, C + uy * r1 + vy * w / 2),
                 (C + ux * r1 - vx * w / 2, C + uy * r1 - vy * w / 2), (C + ux * r0 - vx * w / 2, C + uy * r0 - vy * w / 2)]
            dr.polygon([(px * s, py * s) for px, py in p], fill=255)
        f = font(DIN, 30)
        for v in range(0, 201, 20):
            if (v >= 180) != red:
                continue
            px, py = pt(NUM_R, ang(v))
            dr.text((px * s, py * s), str(v // 10), font=f, fill=255, anchor="mm")
        if red:
            # the redline band
            for i in range(60):
                a0 = ang(170 + i * 0.5)
                px, py = pt(211, a0)
                dr.ellipse([(px - 1.8) * s, (py - 1.8) * s, (px + 1.8) * s, (py + 1.8) * s], fill=255)
            return
        fs = font(AVENIR, 8.5, 5)
        dr.text((C * s, 96 * s), "x10 BPM", font=fs, fill=255, anchor="mm")
        # fuel pump (Body Battery) and thermometer (stress) icons
        px, py = pt(158, 203)
        dr.rectangle([(px - 5) * s, (py - 7) * s, (px + 3) * s, (py + 7) * s], fill=255)
        dr.rectangle([(px - 3) * s, (py - 5) * s, (px + 1) * s, (py - 1) * s], fill=0)
        dr.line([(px + 3) * s, (py - 3) * s, (px + 7) * s, (py + 1) * s, (px + 7) * s, (py + 6) * s], fill=255, width=int(1.6 * s))
        px, py = pt(158, 157)
        dr.rounded_rectangle([(px - 1.8) * s, (py - 8) * s, (px + 1.8) * s, (py + 3) * s], radius=2 * s, fill=255)
        dr.ellipse([(px - 4) * s, (py + 1) * s, (px + 4) * s, (py + 9) * s], fill=255)
        for k in range(3):
            dr.line([(px + 3) * s, (py - 6 + k * 3) * s, (px + 6) * s, (py - 6 + k * 3) * s], fill=255, width=int(1.2 * s))
    return mask_draw(N, N, fn)


def light(red=False):
    m = scale_mask(red)
    g = bloom(m, ((2.5, 0.6), (9, 0.4), (22, 0.25)))
    if red:
        g = np.stack([g, g * 0.16, g * 0.1], -1)
    else:
        g = np.stack([g, g, g], -1)
    return down(g)


def needle():
    """Tip-only needle from r 128 to 212 (pointing to 12), bitmap top = r 222."""
    w, top, bot = 24, 222, 118
    h = top - bot

    def fn(dr, s):
        cx = w / 2
        dr.polygon([((cx - 3.2) * s, (top - 128) * s), ((cx + 3.2) * s, (top - 128) * s), ((cx + 1.2) * s, (top - 212) * s),
                    ((cx - 1.2) * s, (top - 212) * s)], fill=255)
    m = mask_draw(w, h, fn)
    core = np.clip(m, 0, 1)
    hot = np.asarray(Image.fromarray((core * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255
    rgba = np.zeros(m.shape + (4,), np.float32)
    rgba[..., 0] = 1
    rgba[..., 1] = 0.55 + 0.45 * hot
    rgba[..., 2] = 0.45 + 0.55 * hot
    rgba[..., 3] = core
    g = bloom(core, ((3, 0.8), (8, 0.5)))
    glow = np.stack([g, g, g], -1)
    return down(rgba), down(glow), top


def seg():
    w, h = 10, 20

    def fn(dr, s):
        dr.rounded_rectangle([2 * s, 3 * s, 8 * s, 17 * s], radius=1.5 * s, fill=255)
    m = bloom(mask_draw(w, h, fn), ((1.5, 0.5),))
    rgba = np.stack([np.ones_like(m), np.ones_like(m), np.ones_like(m), m], -1)
    return down(rgba)


def icons():
    """Telltales, white (tinted on the watch): battery, message, bluetooth, engine check, heart."""
    cw, ch = 30, 26

    def fn(dr, s):
        def R(x0, y0, x1, y1, i, fill=255):
            dr.rectangle([(i * cw + x0) * s, y0 * s, (i * cw + x1) * s, y1 * s], fill=fill)
        # battery
        R(5, 8, 23, 20, 0)
        R(7, 10, 21, 18, 0, 0)
        R(23, 11, 26, 17, 0)
        R(9, 12, 13, 16, 0)
        # message
        o = cw
        dr.rectangle([(o + 4) * s, 7 * s, (o + 26) * s, 20 * s], outline=255, width=int(2 * s))
        dr.line([(o + 4) * s, 7 * s, (o + 15) * s, 15 * s, (o + 26) * s, 7 * s], fill=255, width=int(2 * s))
        # bluetooth rune
        o = 2 * cw
        pts = [(o + 9, 8), (o + 21, 18), (o + 15, 23), (o + 15, 3), (o + 21, 8), (o + 9, 18)]
        dr.line([(px * s, py * s) for px, py in pts], fill=255, width=int(2 * s), joint="curve")
        # engine
        o = 3 * cw
        dr.polygon([((o + 6) * s, 9 * s), ((o + 20) * s, 9 * s), ((o + 24) * s, 13 * s), ((o + 27) * s, 13 * s),
                    ((o + 27) * s, 19 * s), ((o + 24) * s, 19 * s), ((o + 21) * s, 22 * s), ((o + 9) * s, 22 * s),
                    ((o + 6) * s, 18 * s), ((o + 3) * s, 18 * s), ((o + 3) * s, 13 * s), ((o + 6) * s, 13 * s)], fill=255)
        dr.rectangle([(o + 10) * s, 5 * s, (o + 16) * s, 9 * s], fill=255)
        # heart
        o = 4 * cw
        dr.ellipse([(o + 6) * s, 6 * s, (o + 15) * s, 15 * s], fill=255)
        dr.ellipse([(o + 14) * s, 6 * s, (o + 23) * s, 15 * s], fill=255)
        dr.polygon([((o + 6.5) * s, 12 * s), ((o + 22.5) * s, 12 * s), ((o + 14.5) * s, 22 * s)], fill=255)
    m = bloom(mask_draw(cw * 5, ch, fn), ((2, 0.5),))
    return down(np.stack([np.ones_like(m), np.ones_like(m), np.ones_like(m), m], -1)), cw, ch


def main():
    o = Out("COCKPIT", "cockpit")
    o.save("cbase", base(), "jpg")
    o.save("clight", light(), "jpg")
    red = light(True)
    box = red.getbbox()
    o.save("cred", red.crop(box), "jpg")
    o.const("RED_X", box[0])
    o.const("RED_Y", box[1])
    nd, ng, top = needle()
    o.save("needle", nd)
    o.save("nglow", ng.convert("RGB"), "jpg")
    o.const("NEEDLE_PV", top)
    o.save("seg", seg())
    ic, icw, ich = icons()
    o.save("icons", ic)
    o.const("ICON_W", icw)
    o.const("ICON_H", ich)
    big, bcw, badv = glyph_strip("0123456789:", DIN, 84, 76, glow=((2, 0.35),))
    o.save("big", big)
    o.const("BIG", '"0123456789:"'.strip('"'))
    o.const("BIG_CW", bcw)
    o.const("BIG_H", 76)
    o.const("BIG_ADV", badv)
    chars = " 0123456789.:-/%ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ"
    small, scw, sadv = glyph_strip(chars, DIN, 21, 22)
    o.save("small", small)
    o.const("SMALL", chars)
    o.const("SMALL_CW", scw)
    o.const("SMALL_H", 22)
    o.const("SMALL_ADV", sadv)
    o.write()


if __name__ == "__main__":
    main()
