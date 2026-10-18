"""Fluffy-creature renderer for the avatar faces (tools/render/mo.py): soft blob bodies (smooth-union
ellipses) with wrap / subsurface shading, fur strands (interior texture + furry silhouette) and small
painting helpers. Ported from the approved avatar concept. All work happens at SS x supersampling
inside a sprite canvas; coordinates are final pixels."""
import math

import numpy as np
from PIL import Image, ImageDraw

SS = 3
L_DIR = np.array([-0.42, -0.55, 0.72], np.float32)
L_DIR /= np.linalg.norm(L_DIR)


def smooth(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def grid(w, h):
    y, x = np.mgrid[0:h * SS, 0:w * SS].astype(np.float32)
    return (x + 0.5) / SS, (y + 0.5) / SS


class E:
    """Ellipse part (final px). R = roundness radius of its height profile (default: min radius)."""

    def __init__(self, cx, cy, rx, ry, ang=0.0, R=None, z=0.0):
        self.cx, self.cy, self.rx, self.ry, self.ang = cx, cy, rx, ry, ang
        self.R = R if R else min(rx, ry)
        self.z = z

    def field(self, X, Y):
        a = math.radians(self.ang)
        ca, sa = math.cos(a), math.sin(a)
        dx, dy = X - self.cx, Y - self.cy
        xr, yr = dx * ca + dy * sa, -dx * sa + dy * ca
        u, v = xr / self.rx, yr / self.ry
        s = np.sqrt(u * u + v * v) + 1e-6
        g = np.sqrt((u / self.rx) ** 2 + (v / self.ry) ** 2) / s + 1e-6
        d = (1 - s) / g  # approx. signed distance, positive inside
        d = np.minimum(d, min(self.rx, self.ry))
        t = np.clip(d / self.R, 0, 1)
        h = self.R * np.sqrt(1 - (1 - t) ** 2) + self.z * smooth(0, 3, d)
        return d, h


def smax(a, b, k):
    h = np.maximum(k - np.abs(a - b), 0) / k
    return np.maximum(a, b) + h * h * k * 0.25


def blur(a, r):
    """Gaussian-ish blur (3 box passes, sigma ~ r) of a float array."""
    a = a.astype(np.float32)
    w = max(1, int(round(math.sqrt(4 * r * r + 1)))) // 2 * 2 + 1
    for ax in (0, 1):
        for _ in range(3):
            pad = [(0, 0), (0, 0)]
            pad[ax] = (w // 2 + 1, w // 2)
            p = np.pad(a, pad, mode="edge")
            c = np.cumsum(p, axis=ax, dtype=np.float64)
            a = ((c[w:] - c[:-w]) / w).astype(np.float32) if ax == 0 else ((c[:, w:] - c[:, :-w]) / w).astype(np.float32)
    return a


class Style:
    def __init__(self, **kw):
        self.albedo = (0.9, 0.9, 0.9)
        self.sss = (0.8, 0.4, 0.35)       # colour that bleeds into the shadow side (subsurface warmth)
        self.shadow = (0.25, 0.2, 0.3)    # tint of the deepest shadow
        self.sheen = (1.0, 1.0, 1.0)      # fur sheen on the lit rim
        self.rim = (0.6, 0.7, 1.0)        # back rim light (lower right)
        self.rim_k = 0.35
        self.fur = 4.0                    # silhouette strand length (px)
        self.fur_int = 2.5                # interior strand length
        self.dens_edge = 1.6
        self.dens_int = 0.10
        self.jit = 0.35                   # angle jitter (rad)
        self.grav = 0.35                  # how much fur droops
        self.width = 2                    # strand width (SS px)
        self.var = 0.12                   # strand brightness variation
        self.amb = 0.42
        self.__dict__.update(kw)


def render_blob(W, H, parts, st, patches=(), k=8.0, seed=1, extra_light=None):
    """parts: list of E (smooth-unioned). patches: (E, colour, softness px) albedo overrides.
    Returns an RGBA float array (H*SS, W*SS, 4)."""
    rng = np.random.default_rng(seed)
    X, Y = grid(W, H)
    d = h = None
    for p in parts:
        di, hi = p.field(X, Y)
        if d is None:
            d, h = di, hi
        else:
            d, h = smax(d, di, k), smax(h, hi, k)
    hy, hx = np.gradient(h * SS)
    nx, ny, nz = -hx, -hy, np.ones_like(h)
    n = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx, ny, nz = nx / n, ny / n, nz / n
    alb = np.empty(d.shape + (3,), np.float32)
    alb[:] = st.albedo
    for pe, col, soft in patches:
        pd, _ = pe.field(X, Y)
        m = smooth(-soft, soft, pd)[..., None]
        alb = alb * (1 - m) + np.array(col, np.float32) * m
    alb = alb ** 2.2  # light in linear space
    ndl = nx * L_DIR[0] + ny * L_DIR[1] + nz * L_DIR[2]
    diff = np.clip((ndl + 0.7) / 1.7, 0, 1) ** 1.3
    sss = np.array(st.sss, np.float32)
    shd = np.array(st.shadow, np.float32)
    term = np.clip(1 - np.abs(ndl + 0.1) * 2.0, 0, 1)  # terminator band
    col = alb * (st.amb + (1.0 - st.amb) * diff[..., None])
    s_ = ((1 - diff) * 0.6)[..., None]
    col = col * (1 - s_) + col * shd * s_ / max(1e-3, float(np.mean(shd))) * 0.6
    col += sss * (term * 0.18)[..., None] * alb
    occ = blur((d > 0).astype(np.float32), 9 * SS)  # ambient occlusion: concave regions
    col *= (0.75 + 0.25 * np.clip(0.55 + 0.9 * occ, 0, 1))[..., None]
    fres = (1 - np.clip(nz, 0, 1)) ** 2.2
    lit_side = np.clip(-nx * 0.7 - ny * 0.7, 0, 1)
    back = np.clip(nx * 0.6 + ny * 0.3 + 0.2, 0, 1)
    col += np.array(st.sheen, np.float32) * (fres * lit_side * 0.35)[..., None]
    col += np.array(st.rim, np.float32) * (fres * back * st.rim_k)[..., None]
    if extra_light is not None:  # e.g. bounce light from white digits below: (dir xyz, colour, k)
        dl, cl, kk = extra_light
        dl = np.array(dl, np.float32) / np.linalg.norm(dl)
        e = np.clip(nx * dl[0] + ny * dl[1] + nz * dl[2], 0, 1) ** 2
        col += np.array(cl, np.float32) * (e * kk)[..., None] * alb
    col = np.clip(col, 0, 1) ** (1 / 2.2)

    # ---- strands
    img = np.zeros(d.shape + (4,), np.float32)
    img[..., :3] = col
    img[..., 3] = smooth(-0.6, 0.9, d)  # base silhouette (covered by the edge fur)
    pil = Image.fromarray(np.clip(img * 255 + 0.5, 0, 255).astype(np.uint8), "RGBA")
    dr = ImageDraw.Draw(pil)
    gy, gx = np.gradient(d)
    gl = np.sqrt(gx * gx + gy * gy) + 1e-6
    ox, oy = -gx / gl, -gy / gl  # outward

    def strands(idx, length, jit, edge):
        ys, xs = np.unravel_index(idx, d.shape)
        nn = len(xs)
        dxo, dyo = ox[ys, xs], oy[ys, xs]
        if not edge:  # interior fur lies down along the surface: mostly outward + gravity
            dxo, dyo = dxo * 0.8, dyo * 0.8 + 0.6
        dyo = dyo + st.grav
        ang = np.arctan2(dyo, dxo) + rng.normal(0, jit, nn)
        L = length * rng.uniform(0.55, 1.25, nn) * SS
        curl = rng.normal(0, 0.25, nn)
        var = 1 + rng.normal(0, st.var, nn)
        rc = col[ys, xs]
        lit = np.clip(-np.cos(ang) * 0.6 - np.sin(ang) * 0.8, 0, 1)  # strand pointing to the light
        bk = np.clip(np.cos(ang) * 0.7 + np.sin(ang) * 0.3, 0, 1)
        for i in rng.permutation(nn):
            x0, y0, a, l = xs[i], ys[i], ang[i], L[i]
            xm, ym = x0 + math.cos(a) * l * 0.5, y0 + math.sin(a) * l * 0.5
            a2 = a + curl[i]
            x1, y1 = xm + math.cos(a2) * l * 0.5, ym + math.sin(a2) * l * 0.5
            c0 = rc[i] * var[i]
            if edge:
                c1 = c0 * 1.06 + np.array(st.sheen) * 0.18 * lit[i] + np.array(st.rim) * st.rim_k * 0.6 * bk[i]
            else:
                c1 = c0 * 1.04
            c0 = tuple(int(min(255, max(0, v * 255))) for v in c0) + (255,)
            c1 = tuple(int(min(255, max(0, v * 255))) for v in c1) + (255,)
            dr.line([(x0, y0), (xm, ym)], fill=c0, width=st.width)
            dr.line([(xm, ym), (x1, y1)], fill=c1, width=max(1, st.width - 1))

    flat_d = d.ravel()
    inner = np.flatnonzero(flat_d > st.fur_int * 0.5)
    n_int = int(len(inner) * st.dens_int / SS)
    if n_int:
        strands(rng.choice(inner, n_int, replace=False), st.fur_int, st.jit, False)
    band = np.flatnonzero((flat_d > 0.2) & (flat_d < 2.2))
    n_edge = int(len(band) * st.dens_edge / SS / 2.0)
    if n_edge:
        strands(rng.choice(band, n_edge, replace=True), st.fur, st.jit * 0.8, True)
    return np.asarray(pil, np.float32) / 255


def over(dst, src, ox=0, oy=0):
    """Alpha-composite src RGBA (SS) onto dst RGBA/RGB (SS) at the final-px offset (ox, oy)."""
    H, W = src.shape[:2]
    x0, y0 = int(round(ox * SS)), int(round(oy * SS))
    dx0, dy0 = max(0, x0), max(0, y0)
    dx1, dy1 = min(dst.shape[1], x0 + W), min(dst.shape[0], y0 + H)
    if dx1 <= dx0 or dy1 <= dy0:
        return dst
    s = src[dy0 - y0:dy1 - y0, dx0 - x0:dx1 - x0]
    a = s[..., 3:4]
    t = dst[dy0:dy1, dx0:dx1]
    t[..., :3] = t[..., :3] * (1 - a) + s[..., :3] * a
    if dst.shape[2] == 4:
        t[..., 3:4] = t[..., 3:4] * (1 - a) + a
    return dst


def ell_mask(X, Y, cx, cy, rx, ry, ang=0.0, soft=0.6):
    d, _ = E(cx, cy, rx, ry, ang).field(X, Y)
    return smooth(-soft, soft, d), d


def tint(img, X, Y, cx, cy, rx, ry, col, k, ang=0.0):
    """Soft gaussian blush / tint on an RGBA sprite (colour only, alpha kept)."""
    a = math.radians(ang)
    dx, dy = X - cx, Y - cy
    xr, yr = dx * math.cos(a) + dy * math.sin(a), -dx * math.sin(a) + dy * math.cos(a)
    g = np.exp(-((xr / rx) ** 2 + (yr / ry) ** 2) * 2.0) * k
    img[..., :3] = img[..., :3] * (1 - g[..., None]) + np.array(col, np.float32) * g[..., None]
    return img


def paint(img, mask, col, alpha=1.0):
    m = (mask * alpha)[..., None]
    img[..., :3] = img[..., :3] * (1 - m) + np.array(col, np.float32) * m
    if img.shape[2] == 4:
        img[..., 3:4] = np.maximum(img[..., 3:4], m)
    return img


def poly_mask(shape, pts):
    L = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(L).polygon([(x * SS, y * SS) for x, y in pts], fill=255)
    return np.asarray(L, np.float32) / 255


def fill_poly(img, pts, col, alpha=1.0):
    return paint(img, poly_mask(img.shape, pts), col, alpha)


def stroke(img, pts, width, col, alpha=1.0):
    L = Image.new("L", (img.shape[1], img.shape[0]), 0)
    dr = ImageDraw.Draw(L)
    P = [(x * SS, y * SS) for x, y in pts]
    dr.line(P, fill=255, width=max(1, int(width * SS)), joint="curve")
    r = width * SS / 2
    for p in (P[0], P[-1]):
        dr.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=255)
    return paint(img, np.asarray(L, np.float32) / 255, col, alpha)


def arc_pts(cx, cy, rx, ry, a0, a1, n=24):
    return [(cx + math.cos(math.radians(a)) * rx, cy + math.sin(math.radians(a)) * ry) for a in np.linspace(a0, a1, n)]


class Sprite:
    """RGBA sprite canvas (SS); body-local coordinates: (0,0) = body centre at (ox, oy), scale s."""

    def __init__(self, W, H, ox, oy, s=1.0):
        self.W, self.H, self.ox, self.oy, self.s = W, H, ox, oy, s
        self.img = np.zeros((H * SS, W * SS, 4), np.float32)
        self.X, self.Y = grid(W, H)

    def P(self, x, y):
        return self.ox + x * self.s, self.oy + y * self.s

    def e(self, x, y, rx, ry, ang=0.0, R=None, z=0.0):
        cx, cy = self.P(x, y)
        return E(cx, cy, rx * self.s, ry * self.s, ang, R * self.s if R else None, z)

    def blob(self, parts, st, patches=(), shadow=None, seed=1, k=8.0, extra_light=None):
        b = render_blob(self.W, self.H, parts, st, patches, k * self.s, seed, extra_light)
        if shadow is not None:  # soft shadow of the new part on what is already there
            dx, dy, r, kk = shadow
            a = blur(b[..., 3], r * SS * self.s)
            a = np.roll(np.roll(a, int(dy * SS * self.s), 0), int(dx * SS * self.s), 1)
            self.img[..., :3] *= (1 - kk * a)[..., None]
        over(self.img, b)
        return b


def to_pil(a):
    """float RGBA/RGB (SS) -> PIL image at 1/SS (colour un-premultiplied over transparent stays exact)."""
    if a.shape[2] == 4:
        # resample premultiplied (float channels), then divide: no dark fringes at the soft fur edge
        size = (a.shape[1] // SS, a.shape[0] // SS)
        al = np.clip(a[..., 3], 0, 1)

        def rs(ch):
            return np.asarray(Image.fromarray(ch.astype(np.float32), "F").resize(size, Image.BOX))
        A = np.clip(rs(al), 0, 1)
        out = np.zeros(A.shape + (4,), np.float32)
        for c in range(3):
            out[..., c] = np.where(A > 0.002, rs(np.clip(a[..., c], 0, 1) * al) / np.maximum(A, 1e-4), 0)
        out[..., 3] = A
        return Image.fromarray(np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8), "RGBA")
    b = np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8)
    im = Image.fromarray(b, "RGB")
    return im.resize((im.width // SS, im.height // SS), Image.LANCZOS)
