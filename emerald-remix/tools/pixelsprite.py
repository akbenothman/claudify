"""A tiny toolkit for drawing Gen 3-style Pokémon sprites by hand, in code.

A sprite is built back to front from shapes (ellipses, polygons, thick curves). Each shape has a
material: a ramp of colors from dark to light. Shading is worked out from the shape's form (light
comes from the top left, like the real sprites), then:
  - the whole silhouette gets a black outline,
  - where one shape sits in front of another, the front shape gets a dark inner line (selective
    outlining, so parts read separately),
  - and details (eyes, mouths, markings) are placed pixel by pixel with Sprite.grid / Sprite.px.

Each sprite's drawing lives in graphics/legends/<name>/draw.py and writes front.png + normal.pal.
"""
import math

import numpy as np
from PIL import Image

SIZE = 64
LIGHT = np.array([-0.55, -0.65, 0.52])  # from the top left, a bit toward the viewer
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def _blur(a, r):
    """Box-blur a float image a few times (close to a Gaussian)."""
    out = a.astype(np.float32)
    k = 2 * r + 1
    for _ in range(3):
        p = np.pad(out, r, mode="edge")
        c = np.cumsum(np.cumsum(p, 0), 1)
        c = np.pad(c, ((1, 0), (1, 0)))
        out = (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)
    return out


def _shift(a, dy, dx, fill):
    """Shift an array by (dy, dx) without wrapping around the edges."""
    out = np.full_like(a, fill)
    h, w = a.shape
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = a[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


class Sprite:
    def __init__(self, palette):
        """palette: dict name -> (r, g, b); 15 colors at most. 'outline' is the black line color."""
        assert len(palette) <= 15, "a GBA sprite has 15 colors"
        self.names = list(palette)
        self.colors = [tuple(palette[n]) for n in self.names]
        self.idx = {n: i + 1 for i, n in enumerate(self.names)}
        self.pix = np.zeros((SIZE, SIZE), int)       # palette index, 0 = transparent
        self.owner = np.full((SIZE, SIZE), -1, int)  # which shape drew each pixel
        self.layers = []                              # (mask, material, outline_name)
        yy, xx = np.mgrid[0:SIZE, 0:SIZE]
        self.x = xx + 0.5
        self.y = yy + 0.5

    # ---- masks -------------------------------------------------------------------------------
    def ellipse(self, cx, cy, rx, ry, angle=0):
        a = math.radians(angle)
        dx, dy = self.x - cx, self.y - cy
        u = dx * math.cos(a) + dy * math.sin(a)
        v = -dx * math.sin(a) + dy * math.cos(a)
        return (u / rx) ** 2 + (v / ry) ** 2 <= 1

    def polygon(self, pts):
        inside = np.zeros((SIZE, SIZE), bool)
        n = len(pts)
        for i in range(n):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % n]
            cond = (y1 > self.y) != (y2 > self.y)
            xint = (x2 - x1) * (self.y - y1) / ((y2 - y1) + 1e-9) + x1
            inside ^= cond & (self.x < xint)
        return inside

    def curve(self, pts, widths):
        """A thick curve through control points (Catmull-Rom), width varying along it."""
        pts = np.asarray(pts, float)
        widths = np.asarray(widths, float)
        mask = np.zeros((SIZE, SIZE), bool)
        P = np.vstack([pts[0], pts, pts[-1]])
        W = np.concatenate([[widths[0]], widths, [widths[-1]]])
        for i in range(1, len(P) - 2):
            for t in np.linspace(0, 1, 24, endpoint=False):
                t2, t3 = t * t, t * t * t
                p = 0.5 * ((2 * P[i]) + (-P[i - 1] + P[i + 1]) * t
                           + (2 * P[i - 1] - 5 * P[i] + 4 * P[i + 1] - P[i + 2]) * t2
                           + (-P[i - 1] + 3 * P[i] - 3 * P[i + 1] + P[i + 2]) * t3)
                w = W[i] + (W[i + 1] - W[i]) * t
                mask |= (self.x - p[0]) ** 2 + (self.y - p[1]) ** 2 <= (w / 2) ** 2
        return mask

    # ---- drawing -----------------------------------------------------------------------------
    def shape(self, mask, ramp, line=None, soft=3, bands=(0.28, 0.62, 0.88), flat=False):
        """Fill a mask with a ramp (names from dark to light), shaded by its form.

        line: color name for this shape's inner outline where it overlaps earlier shapes
        (defaults to the darkest ramp color). bands: lightness cut points between ramp steps."""
        mask = mask.copy()
        if flat or len(ramp) == 1:
            level = np.zeros((SIZE, SIZE), int)
        else:
            h = _blur(mask.astype(np.float32), soft)
            gy, gx = np.gradient(h)
            n = np.dstack([-gx * 6, -gy * 6, np.ones_like(h)])
            n /= np.linalg.norm(n, axis=-1, keepdims=True)
            lum = (n @ LIGHT + 1) / 2
            # Ambient falloff toward the bottom of the shape, like Gen 3 sprites.
            ys = np.where(mask.any(1))[0]
            if len(ys):
                top, bot = ys.min(), ys.max() + 1
                lum -= 0.18 * np.clip((self.y - top) / max(bot - top, 1), 0, 1)
            cuts = list(bands)[: len(ramp) - 1]
            level = np.digitize(lum, cuts)
            level = np.clip(level, 0, len(ramp) - 1)
        k = len(self.layers)
        layer_px = np.array([self.idx[ramp[l]] for l in range(len(ramp))])[level]
        self.pix[mask] = layer_px[mask]
        self.owner[mask] = k
        self.layers.append((mask, ramp, line or ramp[0]))
        return mask

    def fill(self, mask, name):
        """Flat color, no shading (markings, gems, eye whites)."""
        self.pix[mask] = self.idx[name]

    def px(self, x, y, name):
        if 0 <= x < SIZE and 0 <= y < SIZE:
            self.pix[y, x] = self.idx[name] if name != "_clear" else 0
            if name == "_clear":
                self.owner[y, x] = -1

    def grid(self, x0, y0, rows, legend):
        """rows: strings, one char per pixel; legend maps chars to color names ('.' = leave)."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != "." and ch != " ":
                    self.px(x0 + i, y0 + j, legend[ch])

    def outline(self, outer="outline", inner=True):
        """Black around the whole silhouette; dark inner lines where a shape is in front of another."""
        opaque = self.pix > 0
        out = np.zeros_like(opaque)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            out |= _shift(opaque, dy, dx, False)
        edge = out & ~opaque
        if inner:
            # A pixel of shape k next to an earlier (behind) shape j < k becomes k's line color.
            o = self.owner
            lines = np.zeros_like(opaque)
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nb = _shift(o, dy, dx, -1)
                lines |= (o >= 0) & (nb >= 0) & (nb < o)
            for k, (_, _, ln) in enumerate(self.layers):
                if ln is None:
                    continue
                sel = lines & (o == k)
                self.pix[sel] = self.idx[ln]
        # outer line drawn last, outside the silhouette
        self.pix[edge] = self.idx[outer]
        self.owner[edge] = 999

    def save(self, png, pal_path, preview=None):
        im = Image.fromarray(self.pix.astype(np.uint8), "P")
        flat = [0, 255, 0] + [c for col in self.colors for c in col]
        im.putpalette(flat + [0] * (768 - len(flat)))
        im.save(png)
        with open(pal_path, "w") as f:
            f.write("JASC-PAL\n0100\n16\n0 255 0\n")
            for c in self.colors + [(0, 0, 0)] * (15 - len(self.colors)):
                f.write("%d %d %d\n" % tuple(c))
        if preview:
            cols = np.asarray([(216, 232, 240)] + self.colors, np.uint8)
            Image.fromarray(cols[self.pix]).resize((512, 512), Image.NEAREST).save(preview)
