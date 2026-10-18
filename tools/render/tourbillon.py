#!/usr/bin/env python3
"""Pre-renders TOURB ("Tourbillon"): a skeletonised hand-finished movement.

tplate.jpg: chapter ring, main plate with perlage, wheel wells, bridges with Côtes de Genève and
polished bevels (anglage), their shadows, rubies in gold chatons, blued screws, engravings.
Moving parts (drawn rotated every frame): wheel1/wheel2 (gilded wheels, with shadows), cage (the
tourbillon carriage), balance (balance wheel with weights), and ov1/ov2/ovt: crops of the bridges
over each moving part, drawn on top so the wheels run *under* the bridges. Hands: openworked
dauphines (hour/minute) with shadows, cap; res (power reserve hand).
Usage: python3 tools/render/tourbillon.py
"""
import math

import numpy as np
from PIL import Image, ImageFilter

from common import AVENIR, C, DIDOT, N, SS, Out, dither565, down, grid, polar, smooth

LIGHT = math.radians(-35)
LX, LY = math.sin(LIGHT), -math.cos(LIGHT)
W1 = (150.0, 200.0, 54.0)  # third wheel x, y, r
W2 = (306.0, 186.0, 42.0)  # fourth wheel
TB = (227.0, 330.0, 58.0)  # tourbillon cage
BARREL = (227.0, 108.0, 36.0)
RING = 194.0

PLATE = np.array([0.74, 0.76, 0.80], np.float32)  # rhodium bridges
BASE = np.array([0.17, 0.175, 0.19], np.float32)  # ruthenium main plate
GOLD = np.array([0.88, 0.70, 0.38], np.float32)
BLUE = np.array([0.10, 0.22, 0.66], np.float32)


def seg_dist(x, y, ax, ay, bx, by):
    px, py, dx, dy = x - ax, y - ay, bx - ax, by - ay
    t = np.clip((px * dx + py * dy) / (dx * dx + dy * dy), 0, 1)
    return np.sqrt((px - dx * t) ** 2 + (py - dy * t) ** 2)


def bridges_sdf(x, y):
    """Signed distance to the bridges (negative inside)."""
    d = seg_dist(x, y, 52, 160, W1[0], W1[1]) - 12
    d = np.minimum(d, seg_dist(x, y, W1[0], W1[1], C, C) - 10)
    d = np.minimum(d, seg_dist(x, y, C, C, W2[0], W2[1]) - 10)
    d = np.minimum(d, seg_dist(x, y, W2[0], W2[1], 400, 150) - 12)
    for (cx, cy) in ((W1[0], W1[1]), (W2[0], W2[1]), (C, C)):
        d = np.minimum(d, np.sqrt((x - cx) ** 2 + (y - cy) ** 2) - 14)
    # tourbillon bridge: one arm from the centre, a ring over the cage pivot
    d = np.minimum(d, seg_dist(x, y, C, 250, TB[0], TB[1]) - 8)
    d = np.minimum(d, np.sqrt((x - TB[0]) ** 2 + (y - TB[1]) ** 2) - 13)
    return d


def normal_from(h):
    gy, gx = np.gradient(h)
    nx, ny = -gx * SS, -gy * SS
    nz = np.ones_like(nx)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return nx / l, ny / l, nz / l


def shade(nx, ny, nz, spec=40, amb=0.35):
    d = np.clip(nx * LX * 0.6 + ny * LY * 0.6 + nz * 0.8, 0, 1)
    return amb + 0.6 * d, np.power(d, spec)


def perlage(x, y, sp=7.0):
    """Circular graining: overlapping fish-scale grains on a staggered grid."""
    best = np.full(x.shape, 1e9, np.float32)
    val = np.zeros_like(x)
    for oy in (0, 0.5):
        for ox in (0, 0.5):
            cx = (np.floor(x / sp - ox) + 0.5 + ox) * sp
            cy = (np.floor(y / sp - oy) + 0.5 + oy) * sp
            dd = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
            ring = 0.5 + 0.5 * np.cos(dd * 2 * math.pi / 2.0)
            lit = 0.5 + 0.5 * np.cos(np.arctan2(x - cx, -(y - cy)) - LIGHT)
            v = 0.62 + 0.75 * ring * np.exp(-dd / 3.2) * (0.4 + 0.6 * lit)
            take = dd < best
            best = np.where(take, dd, best)
            val = np.where(take, v, val)
    return val


def cotes(x, y):
    """Côtes de Genève: diagonal stripes, each a brushed arc catching the light."""
    s = (x * 0.7071 + y * 0.7071)
    t = (-x * 0.7071 + y * 0.7071)
    u = np.mod(s, 9.0) / 9.0
    fine = rng_streak(t)
    return 0.80 + 0.09 * np.cos((u - 0.5) * 2 * math.pi + t / 55) + 0.03 * fine


_STREAK = np.random.default_rng(5).normal(0, 1, 4096).astype(np.float32)


def rng_streak(t):
    return _STREAK[(np.abs(t * 6).astype(np.int64)) % 4096]


def plate():
    x, y = grid()
    r, th = polar(x, y)
    img = np.zeros(x.shape + (3,), np.float32)
    # main plate with perlage, wheel wells deeper and darker
    pl = perlage(x, y)
    img[...] = BASE * pl[..., None]
    for (cx, cy, rr) in (W1, W2, TB, BARREL):
        dw = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        well = smooth(rr + 7, rr + 5, dw)
        rim = smooth(rr + 5, rr + 7, dw) * smooth(rr + 9, rr + 7, dw)
        # openwork: the screen is truly black through the movement, a hint of depth at the edge
        img = img * (1 - well[..., None]) + (0.03 * smooth(rr - 6, rr + 5, dw))[..., None] * well[..., None]
        # polished well edge catches the light on the far side
        lit = np.clip(np.cos(np.arctan2(x - cx, -(y - cy)) - LIGHT - math.pi), 0, 1)
        img += (rim * (0.12 + 0.6 * lit))[..., None]
    # ratchet wheel in the open barrel well (polished steel, sunray brushed)
    dd = np.sqrt((x - BARREL[0]) ** 2 + (y - BARREL[1]) ** 2)
    ta = np.arctan2(x - BARREL[0], -(y - BARREL[1]))
    tooth = 33 + 1.6 * np.abs(np.mod(ta * 40 / (2 * math.pi), 1) - 0.5) * 2
    m = smooth(tooth + 0.5, tooth - 0.5, dd)
    sun = 0.75 + 0.25 * np.power(np.clip(np.cos(2 * (ta - LIGHT)), 0, 1), 2)
    img = img * (1 - m[..., None]) + (np.array([0.82, 0.84, 0.88], np.float32) * sun[..., None]) * m[..., None]
    hub = smooth(7.5, 6.5, dd)
    img = img * (1 - hub[..., None]) + (BLUE * 0.9) * hub[..., None]
    # bridges: Côtes de Genève on top, polished bevels, shadows on the plate
    sd = bridges_sdf(x, y)
    inside = sd < 0
    sh = Image.fromarray(((sd < 0) * 255).astype(np.uint8)).transform(
        (x.shape[1], x.shape[0]), Image.AFFINE, (1, 0, -3 * SS, 0, 1, -4.5 * SS)).filter(ImageFilter.GaussianBlur(2.5 * SS))
    shadow = np.asarray(sh).astype(np.float32) / 255
    img *= (1 - 0.7 * shadow * (~inside))[..., None]
    bev = np.clip(-sd / 2.6, 0, 1)
    hgt = np.sqrt(np.clip(1 - (1 - bev) ** 2, 0, 1))
    nx, ny, nz = normal_from(hgt)
    diff, spec = shade(nx, ny, nz, 30, 0.15)
    top = PLATE * cotes(x, y)[..., None]
    edge = (bev < 1) & inside
    # anglage: mirror-polished chamfers, dark where they face away, flashing where they catch the light
    col = np.where(edge[..., None], (np.array([0.9, 0.92, 0.95], np.float32) * (diff * 0.9)[..., None] + spec[..., None] * 1.2), top)
    img = np.where(inside[..., None], col, img)
    # rubies in gold chatons, blued screws
    def jewel(cx, cy, rr):
        dd = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        ch = smooth(rr + 3.5, rr + 2.5, dd)
        ru = smooth(rr + 0.5, rr - 0.5, dd)
        nxx, nyy = (x - cx) / (rr + 3), (y - cy) / (rr + 3)
        dg, sg = shade(nxx * 0.8, nyy * 0.8, np.sqrt(np.clip(1 - nxx ** 2 - nyy ** 2, 0.1, 1)), 30)
        gold = GOLD * dg[..., None] + sg[..., None] * 0.8
        ruby = np.array([0.62, 0.03, 0.10], np.float32) * (0.6 + 0.6 * (1 - dd / rr))[..., None]
        hl = smooth(1.6, 0.4, np.sqrt((x - cx + 1.5) ** 2 + (y - cy + 1.5) ** 2))
        out = np.where((ru > 0.5)[..., None], ruby + hl[..., None] * 0.9, gold)
        return ch, out
    for (cx, cy, rr) in ((W1[0], W1[1], 4), (W2[0], W2[1], 3.5), (C, C, 4), (TB[0], TB[1], 3.5), (88, 168, 3), (366, 160, 3)):
        m, col = jewel(cx, cy, rr)
        img = img * (1 - m[..., None]) + col * m[..., None]
    for (cx, cy) in ((64, 160), (390, 150), (C, 262), (BARREL[0] - 50, BARREL[1] + 18), (BARREL[0] + 50, BARREL[1] + 18)):
        dd = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
        m = smooth(4.6, 3.8, dd)
        nxx, nyy = (x - cx) / 5, (y - cy) / 5
        dg, sg = shade(nxx, nyy, np.sqrt(np.clip(1 - nxx ** 2 - nyy ** 2, 0.1, 1)), 25)
        col = BLUE * (dg * 1.2)[..., None] + sg[..., None] * np.array([0.5, 0.7, 1.0], np.float32)
        slot = (np.abs((x - cx) * 0.7 + (y - cy) * 0.7) < 0.7) & (dd < 3.6)
        col = np.where(slot[..., None], col * 0.25, col)
        img = img * (1 - m[..., None]) + col * m[..., None]
    # chapter ring: anthracite, satin, bevelled towards the movement
    ring = smooth(RING - 0.5, RING + 0.5, r)
    sat = 0.10 + 0.03 * np.power(np.clip(np.cos(2 * (th - LIGHT)), 0, 1), 2)
    rc = np.full(x.shape + (3,), 1.0, np.float32) * sat[..., None]
    lip = smooth(RING + 3, RING, r) * ring
    rc += (lip * 0.35 * np.clip(np.cos(th - LIGHT - math.pi), 0, 1))[..., None]
    img = img * (1 - ring[..., None]) + rc * ring[..., None]
    img *= (1 - 0.6 * smooth(RING - 8, RING, r) * (1 - ring))[..., None]  # depth below the ring
    # minute track and numerals
    ang = (th / (2 * math.pi)) * 60 % 60
    dmin = np.abs(ang - np.round(ang)) * (2 * math.pi * r / 60)
    five = np.round(ang) % 5 == 0
    tk = (r > 212) & (r < 219 + five * 2) & (dmin < np.where(five, 1.2, 0.55))
    img[tk] = img[tk] * 0.1 + 0.9 * 0.92
    from PIL import ImageDraw, ImageFont
    txt = Image.new("L", (N * SS, N * SS), 0)
    dr = ImageDraw.Draw(txt)
    f = ImageFont.truetype(DIDOT, int(19 * SS), index=1)
    for h, lab in ((0, "XII"), (3, "III"), (6, "VI"), (9, "IX"), (1, "I"), (2, "II"), (4, "IV"), (5, "V"), (7, "VII"), (8, "VIII"), (10, "X"), (11, "XI")):
        a = math.radians(h * 30)
        px, py = C + 203 * math.sin(a), C - 203 * math.cos(a)
        dr.text((px * SS, py * SS), lab, font=ImageFont.truetype(DIDOT, int((15 if len(lab) > 2 else 17) * SS), index=1), fill=235, anchor="mm")
    fs = ImageFont.truetype(AVENIR, int(6.5 * SS), index=0)
    dr.text((112 * SS, 312 * SS), "F A C E L A B", font=fs, fill=170, anchor="mm")
    dr.text((112 * SS, 324 * SS), "MANUFAKTUR", font=fs, fill=130, anchor="mm")
    dr.text((342 * SS, 312 * SS), "TOURBILLON", font=fs, fill=170, anchor="mm")
    dr.text((342 * SS, 324 * SS), "21 RUBIS", font=fs, fill=130, anchor="mm")
    # power reserve scale engraved on the plate beside the barrel
    for i in range(7):
        a = math.radians(40 + i * 15)
        r0, r1 = 46, 52 if i % 3 == 0 else 49
        dr.line([((BARREL[0] + r0 * math.sin(a)) * SS, (BARREL[1] - r0 * math.cos(a)) * SS),
                 ((BARREL[0] + r1 * math.sin(a)) * SS, (BARREL[1] - r1 * math.cos(a)) * SS)], fill=200, width=int(1.2 * SS))
    t = np.asarray(txt).astype(np.float32) / 255
    img = img * (1 - t[..., None] * 0.9) + t[..., None] * 0.95 * 0.9
    img *= smooth(227.5, 225.5, r)[..., None]
    return dither565(down(np.clip(img, 0, 1)))


def part(size, fn):
    """Render a moving part (RGBA, centred) with fn(x, y) -> (rgb, alpha) at supersampled res."""
    n = size * SS
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    x = (xx + 0.5) / SS - size / 2
    y = (yy + 0.5) / SS - size / 2
    rgb, a = fn(x, y)
    return down(np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1))


def wheel(rr, teeth, spokes):
    def fn(x, y):
        d = np.sqrt(x * x + y * y)
        a = np.arctan2(x, -y)
        tp = np.mod(a * teeth / (2 * math.pi), 1)
        tooth = rr + 1.6 * np.clip(1.6 - np.abs(tp - 0.5) * 4, 0, 1)
        rim = (d < tooth) & (d > rr - 5)
        hub = d < 8
        sp = np.zeros_like(d, bool)
        for k in range(spokes):
            ak = k * 2 * math.pi / spokes
            # gently curved spokes
            bend = ak + 0.35 * (d / rr)
            ux, uy = np.sin(bend), -np.cos(bend)
            across = np.abs(x * (-uy) + y * ux)
            along = x * ux + y * uy
            sp |= (across < 2.2) & (along > 0) & (d < rr - 3)
        m = rim | hub | sp
        # circular graining (soleillage) on the gilded wheel + rounded edges
        sun = 0.78 + 0.22 * np.power(np.clip(np.cos(2 * (a - LIGHT)), 0, 1), 3)
        col = GOLD[None, None, :] * sun[..., None]
        pin = d < 4.5
        col = np.where(pin[..., None], np.array([0.85, 0.87, 0.9], np.float32) * (0.7 + 0.3 * (1 - d / 4.5))[..., None], col)
        alpha = m.astype(np.float32)
        return col, alpha
    return part(int(2 * rr + 8), fn)


def cage():
    rr = TB[2] - 6

    def fn(x, y):
        d = np.sqrt(x * x + y * y)
        a = np.arctan2(x, -y)
        ring = (d < rr) & (d > rr - 4)
        arms = np.zeros_like(d, bool)
        for k in range(3):
            ak = k * 2 * math.pi / 3
            ux, uy = math.sin(ak), -math.cos(ak)
            across = np.abs(x * (-uy) + y * ux)
            along = x * ux + y * uy
            w = 3.2 + 2.5 * (along / rr)
            arms |= (across < w) & (along > 0) & (d < rr)
        hubm = d < 9
        m = ring | arms | hubm
        # polished steel with a light-dependent sheen
        sh = 0.55 + 0.4 * np.power(np.clip(np.cos(a - LIGHT), 0, 1), 2)
        col = np.array([0.86, 0.88, 0.92], np.float32) * sh[..., None]
        jw = d < 3.2
        col = np.where(jw[..., None], np.array([0.7, 0.05, 0.12], np.float32), col)
        # hairspring: a fine blued spiral below the arms
        rs = 6 + (np.mod(a, 2 * math.pi) / (2 * math.pi)) * 2.2
        spir = np.zeros_like(d, bool)
        for k in range(8):
            spir |= np.abs(d - (rs + k * 2.2)) < 0.45
        spir &= (d > 9) & (d < 26) & ~m
        col = np.where(spir[..., None], BLUE * 1.4, col)
        alpha = (m | spir).astype(np.float32)
        return col, alpha
    return part(int(2 * TB[2]), fn)


def balance():
    rr = 30.0

    def fn(x, y):
        d = np.sqrt(x * x + y * y)
        a = np.arctan2(x, -y)
        rim = (d < rr) & (d > rr - 3.2)
        arms = np.zeros_like(d, bool)
        for k in range(3):
            ak = k * 2 * math.pi / 3 + 0.5
            ux, uy = math.sin(ak), -math.cos(ak)
            arms |= (np.abs(x * (-uy) + y * ux) < 1.6) & (x * ux + y * uy > 0) & (d < rr)
        wts = np.zeros_like(d, bool)
        for k in range(8):
            ak = k * 2 * math.pi / 8
            wx, wy = (rr + 0.5) * math.sin(ak), -(rr + 0.5) * math.cos(ak)
            wts |= (x - wx) ** 2 + (y - wy) ** 2 < 2.3 ** 2
        m = rim | arms | wts
        sh = 0.7 + 0.3 * np.power(np.clip(np.cos(a - LIGHT), 0, 1), 2)
        col = GOLD * 1.05 * sh[..., None]
        return col, m.astype(np.float32)
    return part(int(2 * rr + 8), fn)


def overlay(full, cx, cy, rr):
    """The bridges over a moving part, cropped to its square: alpha = bridge mask."""
    x0, y0 = int(cx - rr - 4), int(cy - rr - 4)
    size = int(2 * rr + 8)
    x, y = grid(size, size)
    x += x0
    y += y0
    sd = bridges_sdf(x, y)
    a = smooth(0.5, -0.5, sd)
    im = full.crop((x0, y0, x0 + size, y0 + size)).convert("RGB")
    a8 = Image.fromarray((a * 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)
    im.putalpha(a8)
    return im, x0, y0


def hand(L, tail, hw, openwork=True):
    PAD = 6
    w = int(math.ceil(hw * 2 + PAD * 2))
    w += w % 2
    h = int(L + tail + PAD * 2)
    n_w, n_h = w * SS, h * SS
    yy, xx = np.mgrid[0:n_h, 0:n_w].astype(np.float32)
    x = (xx + 0.5) / SS - w / 2
    y = PAD + L - (yy + 0.5) / SS
    t = np.clip(y / L, -1, 1)
    half = np.where(y >= 0, np.where(t < 0.2, hw * (0.5 + 0.5 * t / 0.2), hw * (1 - (t - 0.2) / 0.8)), hw * 0.5)
    inside = (y > -tail) & (y < L) & (np.abs(x) < half)
    hollow = (y > L * 0.16) & (y < L * 0.80) & (np.abs(x) < half - 2.2) if openwork else np.zeros_like(inside)
    boss = (x ** 2 + y ** 2) < (hw + 1.5) ** 2
    m = (inside & ~hollow) | boss
    u = x / np.maximum(half, 0.1)
    # heat-blued steel: one facet catches the light
    col = np.where((u < 0)[..., None], BLUE * 1.9 + 0.08, BLUE * 0.85)
    col = np.where((np.abs(u) > 0.82)[..., None], col * 1.35 + 0.1, col)
    col = np.where(boss[..., None], np.array([0.85, 0.87, 0.9], np.float32), col)
    img = np.concatenate([col, m.astype(np.float32)[..., None]], -1)
    out = down(img)
    pad = Image.new("RGBA", (out.width + 12, out.height + 12), (0, 0, 0, 0))
    pad.paste(out, (6, 6))
    return pad, 6 + PAD + L


def shadow_of(im, blur=2.4, alpha=0.6):
    a = im.split()[3].filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * alpha))
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.putalpha(a)
    return out


def main():
    o = Out("TOURB", "tourb")
    pl = plate()
    o.save("tplate", pl, "jpg")
    for name, (cx, cy, rr), teeth, sp in (("wheel1", W1, 72, 5), ("wheel2", W2, 60, 4)):
        wim = wheel(rr, teeth, sp)
        o.save(name, wim)
        o.save(name + "_s", shadow_of(wim, 2.2, 0.55))
        ov, x0, y0 = overlay(pl, cx, cy, rr)
        o.save("ov" + name[-1], ov)
        o.const("OV%s" % name[-1], [x0, y0])
    o.save("cage", cage())
    o.save("balance", balance())
    ovt, x0, y0 = overlay(pl, TB[0], TB[1], TB[2])
    o.save("ovt", ovt)
    o.const("OVT", [x0, y0])
    hr, pv = hand(108, 18, 8.5)
    o.save("hour", hr)
    o.save("hour_s", shadow_of(hr))
    o.const("HOUR_PV", pv)
    mn, pv = hand(178, 22, 6.5)
    o.save("minute", mn)
    o.save("minute_s", shadow_of(mn))
    o.const("MINUTE_PV", pv)
    rs, pv = hand(44, 8, 2.4, False)
    o.save("res", rs)
    o.const("RES_PV", pv)
    o.const("W1", [int(W1[0]), int(W1[1])])
    o.const("W2", [int(W2[0]), int(W2[1])])
    o.const("TB", [int(TB[0]), int(TB[1])])
    o.const("BARREL", [int(BARREL[0]), int(BARREL[1])])
    o.write()


if __name__ == "__main__":
    main()
