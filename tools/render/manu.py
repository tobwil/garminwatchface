#!/usr/bin/env python3
"""Pre-renders the photo-real parts of MANU ("Manufaktur") with numpy + Pillow, 3x supersampled.

Writes web/img/MANU/*.png|jpg (copied into the watch resources by tools/build.py) and
web/js/img/manu.js (the same images as data URIs for the studio). Fonts: macOS system fonts
(Didot, Avenir Next); the rendered images are committed, so the build never needs this script.

Geometry shared with web/js/faces/manu.js and watch/source/faces/Manu.mc:
  hands point to 12, pivot at (w / 2, PAD + length); see HANDS below.
Usage: python3 tools/render/manu.py
"""
import base64
import io
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
OUT = os.path.join(ROOT, "web", "img", "MANU")
SS = 3  # supersampling
N = 454
C = 227.0
LIGHT = math.radians(-35)  # light from the upper left (screen angle, 0 = 12 o'clock, clockwise)
rng = np.random.default_rng(970)

DIDOT = "/System/Library/Fonts/Supplemental/Didot.ttc"
AVENIR = "/System/Library/Fonts/Avenir Next.ttc"

# dial styles: base colour (centre), sunburst highlight colour
STYLES = {
    1: ((0x10, 0x24, 0x52), (0x7a, 0x9a, 0xe0)),  # Mitternacht: deep navy
    2: ((0x30, 0x31, 0x34), (0xb8, 0xbc, 0xc4)),  # Fumé: graphite smoked to black
    3: ((0x0c, 0x3a, 0x2c), (0x6a, 0xc0, 0x98)),  # Racing: British racing green
}
SUBS = [(135.0, 227.0), (319.0, 227.0)]  # Body Battery, steps
SUB_R = 44.0
PR = (227.0, 146.0)  # power reserve pivot
DATE = (227.0, 322.0, 40.0, 26.0)  # date window centre x, y, w, h


def grid(n=N * SS):
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    x = (x + 0.5) / SS
    y = (y + 0.5) / SS
    return x, y


def smooth(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def down(img):
    """float HxWxC (0..1) supersampled -> 8-bit PIL image at 1/SS."""
    a = np.clip(img * 255 + 0.5, 0, 255).astype(np.uint8)
    mode = "RGBA" if a.shape[2] == 4 else "RGB"
    im = Image.fromarray(a, mode)
    return im.resize((im.width // SS, im.height // SS), Image.LANCZOS)


def dither565(im):
    """Adds a little noise so the 16-bit AMOLED (RGB565) shows no banding in the dark gradients."""
    a = np.asarray(im).astype(np.float32)
    n = rng.uniform(-1, 1, a.shape[:2] + (1,)).astype(np.float32)
    a[..., :3] = a[..., :3] + n * np.array([4.0, 2.0, 4.0], np.float32)
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8), im.mode)


def polar(x, y, cx=C, cy=C):
    dx, dy = x - cx, y - cy
    r = np.sqrt(dx * dx + dy * dy)
    th = np.arctan2(dx, -dy)  # 0 = 12 o'clock, clockwise
    return r, th


def text_layer(items):
    """items: (text, font path, size px, x, y, anchor, rgba, tracking) -> RGBA float layer (supersampled)."""
    im = Image.new("RGBA", (N * SS, N * SS), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    for txt, fp, size, x, y, anchor, col, track, idx in items:
        f = ImageFont.truetype(fp, int(size * SS), index=idx)
        if track:
            # letter-spaced: draw char by char around the centre
            ws = [dr.textlength(ch, font=f) for ch in txt]
            tot = sum(ws) + track * SS * (len(txt) - 1)
            cx = x * SS - tot / 2
            for ch, w in zip(txt, ws):
                dr.text((cx, y * SS), ch, font=f, fill=col, anchor="lm")
                cx += w + track * SS
        else:
            dr.text((x * SS, y * SS), txt, font=f, fill=col, anchor=anchor)
    return np.asarray(im).astype(np.float32) / 255


def over(dst, rgba):
    a = rgba[..., 3:4]
    dst[..., :3] = dst[..., :3] * (1 - a) + rgba[..., :3] * a
    return dst


def steel(nx, ny, nz):
    """Polished steel lit from LIGHT: soft environment plus a sharp highlight."""
    lx, ly, lz = math.sin(LIGHT) * 0.6, -math.cos(LIGHT) * 0.6, 0.8
    d = np.clip(nx * lx + ny * ly + nz * lz, 0, 1)
    env = 0.32 + 0.55 * d
    spec = np.power(d, 40) * 0.9
    v = np.clip(env + spec, 0, 1)
    return np.stack([v * 0.97, v * 0.98, v * 1.0], -1)


# ------------------------------------------------------------------ the dial
def dial(style):
    base, hl = STYLES[style]
    base = np.array(base, np.float32) / 255
    hl = np.array(hl, np.float32) / 255
    x, y = grid()
    r, th = polar(x, y)
    # brushed sunburst: fine radial streaks + the bow-tie reflection of the light
    bins = 2600
    streak = rng.normal(0, 1, bins).astype(np.float32)
    streak = np.convolve(np.concatenate([streak[-3:], streak, streak[:3]]), np.ones(3) / 3, "same")[3:-3]
    idx = ((th / (2 * math.pi) + 0.5) * bins).astype(np.int32) % bins
    s = streak[idx] * 0.035
    bow = np.power(np.clip(np.cos(2 * (th - LIGHT)), 0, 1), 3)
    fume = 1 - 0.62 * smooth(0.35, 1.0, r / 222)
    col = base[None, None, :] * (fume[..., None] * (0.82 + s[..., None]))
    col += hl[None, None, :] * (bow * 0.42 * (0.5 + 0.5 * fume) * (1 + 4 * s))[..., None]
    img = np.concatenate([col, np.ones_like(r)[..., None]], -1)

    # sub-dials: snailed (concentric) finish, slightly recessed
    for (sx, sy) in SUBS:
        rs, ts = polar(x, y, sx, sy)
        m = smooth(SUB_R + 0.6, SUB_R - 0.6, rs)
        snail = 0.5 + 0.5 * np.sin(rs * 2 * math.pi / 1.6)
        ring = base * 0.78 + hl * 0.10
        sub = ring[None, None, :] * (0.86 + 0.16 * snail[..., None])
        sub += hl[None, None, :] * (0.10 * np.power(np.clip(np.cos(ts - LIGHT - math.pi), 0, 1), 2) * (rs / SUB_R))[..., None]
        # inner shadow at the top edge, a fine bright bevel at the bottom
        edge = smooth(SUB_R - 5, SUB_R, rs)
        sub *= (1 - 0.5 * edge * np.clip(-np.cos(ts - LIGHT), 0, 1))[..., None]
        sub += (0.35 * edge * np.clip(np.cos(ts - LIGHT - math.pi), 0, 1) * smooth(SUB_R - 1.5, SUB_R, rs))[..., None]
        img[..., :3] = img[..., :3] * (1 - m[..., None]) + sub * m[..., None]

    # date window: white disc behind a bevelled opening
    dx, dy, dw, dh = DATE
    inx = (np.abs(x - dx) < dw / 2) & (np.abs(y - dy) < dh / 2)
    frame = (np.abs(x - dx) < dw / 2 + 1.8) & (np.abs(y - dy) < dh / 2 + 1.8) & ~inx
    img[frame, :3] = steel(np.zeros_like(x[frame]), np.sign(y[frame] - dy) * 0.7, np.ones_like(x[frame]) * 0.7)[..., :3] * 0.75
    img[inx, :3] = np.array([0.93, 0.92, 0.89], np.float32) * (1 - 0.25 * smooth(dy - dh / 2 + 4, dy - dh / 2, y[inx]))[..., None]

    # printed minute track
    ticks = np.zeros_like(r)
    ang = (th / (2 * math.pi)) * 60 % 60
    dmin = np.abs(ang - np.round(ang)) * (2 * math.pi * r / 60)
    five = (np.round(ang) % 5 == 0)
    ticks = np.where((r > 204) & (r < 212 + five * 3) & (dmin < np.where(five, 1.1, 0.6)), 1.0, 0.0)
    ticks += np.where((np.abs(r - 204) < 0.5), 0.7, 0.0)
    img[..., :3] = img[..., :3] * (1 - 0.88 * ticks[..., None]) + 0.92 * ticks[..., None]

    # sub-dial scales: 10 ticks over 300 degrees, the power reserve fan
    for (sx, sy) in SUBS:
        rs, ts = polar(x, y, sx, sy)
        a = (np.degrees(ts) + 150) % 360  # 0..300 is the scale
        k = a / 30
        dd = np.abs(k - np.round(k)) * math.radians(30) * rs
        on = (a <= 300.5) & (rs > SUB_R - 10 - (np.round(k) % 5 == 0) * 4) & (rs < SUB_R - 4) & (dd < 0.7)
        img[on, :3] = img[on, :3] * 0.15 + 0.85 * 0.95
    rs, ts = polar(x, y, *PR)
    a = np.degrees(ts)
    k = (a + 60) / 15
    dd = np.abs(k - np.round(k)) * math.radians(15) * rs
    on = (np.abs(a) <= 60.5) & (rs > 30) & (rs < 36 + (np.round(k) % 4 == 0) * 3) & (dd < 0.7)
    img[on, :3] = img[on, :3] * 0.15 + 0.85 * 0.95
    arc = (np.abs(a) <= 60) & (np.abs(rs - 30) < 0.5)
    img[arc, :3] = img[arc, :3] * 0.3 + 0.7 * 0.95

    # applied hour indices: faceted polished steel with lume, and their shadows
    ind = indices_layer(x, y, r, th)
    img = over(img, ind)

    # print: logo, power reserve and sub-dial labels
    W = (240, 240, 236, 255)
    Wd = (220, 222, 226, 235)
    items = [
        ("FACELAB", DIDOT, 21, C, 84, "mm", W, 3.2, 0),
        ("MANUFAKTUR", AVENIR, 7.5, C, 102, "mm", Wd, 2.2, 0),
        ("RESERVE", AVENIR, 6.5, PR[0], PR[1] + 12, "mm", Wd, 1.6, 0),
        ("ENERGIE", AVENIR, 6, SUBS[0][0], SUBS[0][1] + 33, "mm", Wd, 1.2, 0),
        ("SCHRITTE", AVENIR, 6, SUBS[1][0], SUBS[1][1] + 33, "mm", Wd, 1.2, 0),
        ("AUTOMATIC", AVENIR, 7, C, 360, "mm", Wd, 2.6, 0),
        ("FR · 970", AVENIR, 6.5, C, 374, "mm", (200, 204, 210, 200), 2.0, 0),
    ]
    for (sx, sy) in SUBS:
        for i, lab in ((2.5, "25"), (5, "50"), (7.5, "75")):
            ang = math.radians(-150 + i * 30)
            items.append((lab, AVENIR, 7, sx + math.sin(ang) * (SUB_R - 19), sy - math.cos(ang) * (SUB_R - 19), "mm", Wd, 0, 0))
    img = over(img, text_layer(items))

    # depth under the crystal: inner shadow towards the edge, a faint gloss from the light
    img[..., :3] *= (1 - 0.55 * smooth(212, 226, r))[..., None]
    gl = np.clip(1 - ((x - 120) ** 2 + (y - 90) ** 2) / (230 ** 2), 0, 1)
    img[..., :3] += (0.035 * gl)[..., None]
    img[..., :3] *= smooth(227.5, 225.5, r)[..., None]  # round mask (AMOLED black outside)
    return dither565(down(img[..., :3]))


def indices_layer(x, y, r, th):
    """RGBA layer: 12 applied indices (double at 12) with drop shadows."""
    lay = np.zeros(x.shape + (4,), np.float32)
    shadow = np.zeros_like(r)
    bars = []
    for h in range(12):
        ang = h * math.pi / 6
        if h == 0:
            bars += [(ang, -5.5, 4.6), (ang, 5.5, 4.6)]
        elif h in (3, 9):
            bars.append((ang, 0, 6.0))
        else:
            bars.append((ang, 0, 5.2))
    r0, r1 = 168.0, 200.0
    for ang, off, hw in bars:
        ux, uy = math.sin(ang), -math.cos(ang)  # radial
        vx, vy = -uy, ux  # across
        # bar-local coordinates
        px, py = x - C, y - C
        along = px * ux + py * uy
        across = px * vx + py * vy - off
        inside = (along > r0) & (along < r1) & (np.abs(across) < hw)
        # shadow: the same bar shifted away from the light
        sx, sy = px - 2.5, py - 3.5
        sal = sx * ux + sy * uy
        sac = sx * vx + sy * vy - off
        shadow = np.maximum(shadow, ((sal > r0) & (sal < r1) & (np.abs(sac) < hw)).astype(np.float32))
        u = across / hw  # -1..1
        # roof-shaped cross-section with chamfered ends
        endd = np.minimum(along - r0, r1 - along)
        nx_l = np.clip(u, -1, 1) * 0.75
        ny_l = np.where(endd < 2.5, np.sign((along - (r0 + r1) / 2)) * 0.7, 0.0)
        nxw = nx_l * vx + ny_l * ux
        nyw = nx_l * vy + ny_l * uy
        nz = np.sqrt(np.clip(1 - nxw ** 2 - nyw ** 2, 0.05, 1))
        col = steel(nxw, nyw, nz)
        # lume insert along the middle
        lume = (np.abs(u) < 0.42) & (along > r0 + 4) & (along < r1 - 4)
        col = np.where(lume[..., None], np.array([0.86, 0.9, 0.8], np.float32)[None, None, :] * (0.9 + 0.1 * col[..., :1]), col)
        lay[inside, :3] = col[inside]
        lay[inside, 3] = 1
    sh = Image.fromarray((shadow * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2 * SS))
    sh = np.asarray(sh).astype(np.float32) / 255 * 0.7
    out = np.zeros_like(lay)
    out[..., 3] = sh
    a = lay[..., 3:4]
    out[..., :3] = lay[..., :3]
    out[..., 3] = np.maximum(lay[..., 3], sh)
    out[..., :3] = lay[..., :3] * a  # shadow pixels stay black
    out[..., :3] = np.where(a > 0, lay[..., :3], 0)
    return out


# ------------------------------------------------------------------ hands
PAD = 6
HANDS = {
    # name: (length, tail, half width, kind)
    "hour": (112, 20, 8.5, "dauphine"),
    "minute": (186, 24, 6.5, "dauphine"),
    "second": (198, 46, 1.4, "lance"),
    "sub": (34, 8, 2.6, "baton"),
    "res": (28, 6, 2.2, "baton"),
}


def hand(name, lume_only=False):
    L, tail, hw, kind = HANDS[name]
    w = int(math.ceil(hw * 2 + PAD * 2 + (14 if kind == "lance" else 0)))
    w += w % 2
    h = L + tail + PAD * 2
    n_w, n_h = w * SS, h * SS
    yy, xx = np.mgrid[0:n_h, 0:n_w].astype(np.float32)
    x = (xx + 0.5) / SS - w / 2
    y = PAD + L - (yy + 0.5) / SS  # distance from the pivot towards the tip
    img = np.zeros((n_h, n_w, 4), np.float32)
    if kind == "dauphine":
        # widest at 22 %, pointed tip, faceted along the centre ridge
        t = np.clip(y / L, -1, 1)
        half = np.where(y >= 0, np.where(t < 0.22, hw * (0.55 + 0.45 * t / 0.22), hw * (1 - (t - 0.22) / 0.78)), hw * 0.55)
        inside = (y > -tail) & (y < L) & (np.abs(x) < half)
        u = x / np.maximum(half, 0.1)
        nx = np.where(u < 0, -0.55, 0.55)
        col = steel(nx, np.zeros_like(nx) - 0.15, np.full_like(nx, 0.8))
        # polished bevel line on the edge
        col = np.where((np.abs(u) > 0.86)[..., None], col * 1.15, col)
        lume = (np.abs(u) < 0.5) & (y > L * 0.12) & (y < L * 0.86)
        lc = np.array([0.88, 0.92, 0.82], np.float32)
        col = np.where(lume[..., None], lc[None, None, :] * (0.85 + 0.15 * (u > 0)[..., None]), col)
        boss = (x ** 2 + y ** 2) < (hw + 2.5) ** 2
        inside = inside | boss
        if lume_only:
            img[lume, :3] = 1
            img[lume, 3] = 1
        else:
            img[inside, :3] = np.clip(col[inside], 0, 1)
            img[inside, 3] = 1
    elif kind == "lance":
        # light grey metal (the face tints it with the accent colour), counterweight disc
        inside = (np.abs(x) < hw * (1 - 0.5 * np.clip(y / L, 0, 1))) & (y > -tail) & (y < L)
        disc = (x ** 2 + (y + tail * 0.72) ** 2) < 6.5 ** 2
        boss = (x ** 2 + y ** 2) < 4.5 ** 2
        tipd = (x ** 2 + (y - L * 0.80) ** 2) < 3.2 ** 2
        allm = inside | disc | boss | tipd
        g = 0.82 + 0.18 * np.clip(-x / 6, -1, 1)
        img[allm, :3] = g[allm][..., None]
        img[allm, 3] = 1
    else:
        inside = (np.abs(x) < hw) & (y > -tail) & (y < L) & ~((y > L - hw) & (np.abs(x) > (L - y)))
        boss = (x ** 2 + y ** 2) < (hw + 2.2) ** 2
        allm = inside | boss
        col = steel(np.where(x < 0, -0.5, 0.5), np.zeros_like(x), np.full_like(x, 0.85))
        img[allm, :3] = col[allm]
        img[allm, 3] = 1
    return down(img), (w, h)


def shadow_of(im, blur=2.4, alpha=0.6):
    a = im.split()[3].filter(ImageFilter.GaussianBlur(blur))
    a = a.point(lambda v: int(v * alpha))
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.putalpha(a)
    return out


def pad_img(im, p):
    out = Image.new("RGBA", (im.width + 2 * p, im.height + 2 * p), (0, 0, 0, 0))
    out.paste(im, (p, p))
    return out


def cap():
    n = 22 * SS
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    x = (xx + 0.5) / SS - 11
    y = (yy + 0.5) / SS - 11
    rr = np.sqrt(x * x + y * y)
    m = smooth(9.5, 8.5, rr)
    nz = np.sqrt(np.clip(1 - (rr / 10) ** 2, 0.05, 1))
    col = steel(x / 10, y / 10, nz)
    img = np.concatenate([col, m[..., None]], -1)
    return down(img)


def glow():
    """A soft lume glow (white; tinted on the watch), drawn additively."""
    n = 40 * SS
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    x = (xx + 0.5) / SS - 20
    y = (yy + 0.5) / SS - 20
    rr = np.sqrt(x * x + y * y) / 20
    v = np.exp(-(rr * 3.2) ** 2) * 0.9 + np.exp(-(rr * 9) ** 2) * 0.4
    v = np.clip(v, 0, 1)
    img = np.stack([v, v, v, np.ones_like(v)], -1)
    return down(img).convert("RGB")


def date_strip():
    """Date wheel: 1..31 in black on the warm white disc, one cell per day (36 x 24 px)."""
    w, h = 36, 24
    im = Image.new("RGB", (w * SS, h * 31 * SS), (237, 235, 227))
    dr = ImageDraw.Draw(im)
    f = ImageFont.truetype(AVENIR, int(17 * SS), index=5)
    for d in range(1, 32):
        dr.text((w * SS / 2, (d - 0.5) * h * SS + SS), str(d), font=f, fill=(24, 24, 28), anchor="mm")
    return im.resize((w, h * 31), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {}

    def save(name, im, fmt):
        p = os.path.join(OUT, name + "." + fmt)
        if fmt == "jpg":
            im.convert("RGB").save(p, quality=93, subsampling=0, optimize=True)
        else:
            im.save(p, optimize=True)
        files[name] = (fmt, p)

    for st in STYLES:
        save("dial%d" % st, dial(st), "jpg")
    for name in HANDS:
        im, _ = hand(name)
        im = pad_img(im, 6)
        save(name, im, "png")
        save(name + "_s", shadow_of(im, 2.6 if name != "second" else 2.0, 0.62), "png")
    for name in ("hour", "minute"):
        im, _ = hand(name, True)
        save(name + "_l", pad_img(im, 6).filter(ImageFilter.GaussianBlur(0.6)), "png")
    save("cap", cap(), "png")
    save("glow", glow(), "png")
    save("date", date_strip(), "png")

    lines = ["// GENERATED by tools/render/manu.py — do not edit. Pre-rendered images of MANU as data URIs.",
             "export default {"]
    for name, (fmt, p) in files.items():
        mime = "image/jpeg" if fmt == "jpg" else "image/png"
        b = base64.b64encode(open(p, "rb").read()).decode()
        lines.append('  %s: "data:%s;base64,%s",' % (name, mime, b))
    lines.append("};")
    os.makedirs(os.path.join(ROOT, "web", "js", "img"), exist_ok=True)
    open(os.path.join(ROOT, "web", "js", "img", "manu.js"), "w").write("\n".join(lines) + "\n")
    for name, (fmt, p) in files.items():
        im = Image.open(p)
        print("%-10s %4d x %-4d %6d bytes" % (name, im.width, im.height, os.path.getsize(p)))


if __name__ == "__main__":
    main()
