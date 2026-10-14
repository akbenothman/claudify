"""Paint-over: rebuild concept art as clean Gen 3-style pixel art.

Shrinking a painting gives the right pose and proportions but smudgy, noisy pixels. Drawing from
scratch gives clean pixels but toy-like shapes. This does what a pixel artist does over a downscale:

  1. every source pixel is assigned a MATERIAL (fur, mane, face, line work, ...) by rules on its
     color and position, decided per creature;
  2. the 64x64 grid takes, per cell, the cell's main material, and a shade from how light that
     material is in the cell compared with the rest of it (so the art's own lighting and fur
     direction carry over);
  3. each material has its own short ramp of 3-4 colors; isolated pixels are cleaned up;
  4. outlines: dark line work from the art where it is strong enough, the silhouette edge, and lines
     between materials, each in a dark shade of its own color (black only on the shadow side), the
     way Gen 3 sprites do it ("selective outlining").

Hand-drawn details (eyes, mouths) go on top with pixelsprite-style grids.
"""
import numpy as np
from PIL import Image

SIZE = 64


def hsv(rgb):
    f = rgb.astype(np.float32) / 255
    mx, mn = f.max(-1), f.min(-1)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, (g - b) / d % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = (mx - mn) / np.maximum(mx, 1e-6)
    return h, s, mx


def lum(rgb):
    return rgb.astype(np.float32) @ np.float32([0.299, 0.587, 0.114])


class PaintOver:
    def __init__(self, src, box, materials, line_share=0.3, size=SIZE, bottom_pad=0):
        """src: green-screen image path; box: (x0, y0, x1, y1) of the source to fit into the sprite;
        materials: list of (name, ramp [dark..light rgb], line rgb). Material 0 is LINE WORK."""
        im = np.asarray(Image.open(src).convert("RGB"))
        x0, y0, x1, y1 = box
        self.rgb = im[y0:y1, x0:x1].astype(np.float32)
        g = self.rgb
        self.solid = (g[..., 1] - np.maximum(g[..., 0], g[..., 2])) <= 60
        self.h, self.s, self.v = hsv(g)
        self.L = lum(g)
        H, W = self.solid.shape
        yy, xx = np.mgrid[0:H, 0:W]
        self.x, self.y = xx, yy
        self.materials = materials
        self.mat = np.full(self.solid.shape, -1, int)
        self.size = size
        self.line_share = line_share
        self.bottom_pad = bottom_pad

    def assign(self, name, where):
        """Pixels where `where` is true (and solid) get material `name`. Later calls win."""
        k = [m[0] for m in self.materials].index(name)
        self.mat[where & self.solid] = k

    def ellipse(self, cx, cy, rx, ry):
        return ((self.x - cx) / rx) ** 2 + ((self.y - cy) / ry) ** 2 <= 1

    def render(self, bands=None, dither=True, clean=2, fit="max", form=0.7, soft=3):
        """fit='max' fits the whole box; fit='height' fills the height (wider parts get trimmed)."""
        H, W = self.solid.shape
        scale = (self.size - self.bottom_pad) / (H if fit == "height" else max(H, W))
        oh, ow = round(H * scale), round(W * scale)
        ye = np.linspace(0, H, oh + 1).round().astype(int)
        xe = np.linspace(0, W, ow + 1).round().astype(int)
        nm = len(self.materials)
        # Each material's own lightness range, so its whole ramp gets used.
        lo, hi = np.zeros(nm), np.ones(nm)
        for k in range(nm):
            sel = self.mat == k
            if sel.sum() > 50:
                lo[k], hi[k] = np.percentile(self.L[sel], [6, 94])
        mat = np.full((oh, ow), -1, int)
        val = np.zeros((oh, ow), np.float32)
        for j in range(oh):
            for i in range(ow):
                m = self.mat[ye[j]:ye[j + 1], xe[i]:xe[i + 1]].ravel()
                Lc = self.L[ye[j]:ye[j + 1], xe[i]:xe[i + 1]].ravel()
                on = m >= 0
                if on.sum() * 2 < m.size:
                    continue
                counts = np.bincount(m[on], minlength=nm)
                if counts[0] >= self.line_share * m.size:
                    mat[j, i] = 0
                    continue
                counts[0] = 0
                k = int(counts.argmax())
                mat[j, i] = k
                v = (np.mean(Lc[m == k]) - lo[k]) / max(hi[k] - lo[k], 1)
                val[j, i] = np.clip(v, 0, 1)
        # Clean up: a pixel whose material differs from most of its neighbours takes theirs.
        for _ in range(clean):
            new = mat.copy()
            for j in range(oh):
                for i in range(ow):
                    if mat[j, i] <= 0:
                        continue
                    nb = mat[max(j - 1, 0):j + 2, max(i - 1, 0):i + 2].ravel()
                    nb = nb[nb > 0]
                    c = np.bincount(nb, minlength=nm)
                    if c[mat[j, i]] <= 2 and c.max() >= 5:
                        new[j, i] = int(c.argmax())
            mat = new
        # Shade from each part's form (light from the top left), mixed with a little of the art's
        # own lighting so fur direction still shows. Pure art lighting is what makes conversions noisy.
        if form > 0:
            import sys as _s, os as _o
            _s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
            from pixelsprite import _blur, LIGHT
            fv = np.zeros_like(val)
            for k in range(1, nm):
                m = mat == k
                if not m.any():
                    continue
                hgt = _blur(m.astype(np.float32), soft)
                gy, gx = np.gradient(hgt)
                n = np.dstack([-gx * 6, -gy * 6, np.ones_like(hgt)])
                n /= np.linalg.norm(n, axis=-1, keepdims=True)
                l = (n @ LIGHT + 1) / 2
                ys = np.nonzero(m.any(1))[0]
                l -= 0.15 * np.clip((np.arange(oh)[:, None] - ys.min()) / max(ys.max() - ys.min(), 1), 0, 1)
                fv[m] = np.clip((l[m] - 0.35) / 0.5, 0, 1)
            val = form * fv + (1 - form) * val
        # Shade levels, with a light 2x2 dither where a value sits right on a band edge.
        lvl = np.zeros((oh, ow), int)
        bayer = np.array([[0.25, 0.75], [1.0, 0.5]]) - 0.625
        for j in range(oh):
            for i in range(ow):
                k = mat[j, i]
                if k < 0:
                    continue
                ramp = self.materials[k][1]
                n = len(ramp)
                cuts = bands.get(self.materials[k][0]) if bands else None
                if cuts is None:
                    cuts = np.linspace(0, 1, n + 1)[1:-1]
                v = val[j, i] + (0.08 * bayer[j % 2, i % 2] if dither else 0)
                lvl[j, i] = int(np.digitize(v, cuts))
        # Smooth shade levels a little: lone pixels join their neighbours.
        for j in range(1, oh - 1):
            for i in range(1, ow - 1):
                k = mat[j, i]
                if k <= 0:
                    continue
                nb = [lvl[j + dj, i + di] for dj, di in ((-1, 0), (1, 0), (0, -1), (0, 1)) if mat[j + dj, i + di] == k]
                if len(nb) == 4 and all(n != lvl[j, i] for n in nb):
                    lvl[j, i] = max(set(nb), key=nb.count)
        self.mat_s, self.lvl_s = mat, lvl
        return mat, lvl

    def compose(self, mat, lvl, outline_black=(32, 24, 24)):
        """Colors, outlines, placed on a 64x64 canvas (bottom centred). Returns the palette-indexed
        image as an RGB array (alpha in a mask) for further hand edits."""
        oh, ow = mat.shape
        rgb = np.zeros((oh, ow, 3), np.uint8)
        on = mat >= 0
        for j in range(oh):
            for i in range(ow):
                k = mat[j, i]
                if k < 0:
                    continue
                name, ramp, line = self.materials[k][:3]
                rgb[j, i] = ramp[min(lvl[j, i], len(ramp) - 1)] if k > 0 else line
        # Silhouette edge: the edge pixels themselves become the material's line color (sel-out),
        # black on the lower right (shadow side).
        def nb_off(dj, di):
            out = np.zeros_like(on)
            out[max(dj, 0):oh + min(dj, 0), max(di, 0):ow + min(di, 0)] = ~on[max(-dj, 0):oh + min(-dj, 0), max(-di, 0):ow + min(-di, 0)]
            return out
        pad = np.pad(on, 1)
        edge = on & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
        shadow = on & (nb_off(-1, 0) | nb_off(0, -1))  # empty below or right of the pixel
        for j, i in zip(*np.nonzero(edge)):
            k = mat[j, i]
            line = self.materials[k][2]
            rgb[j, i] = outline_black if shadow[j, i] else line
        # Lines between materials: a material marked `border` draws its line color where it meets
        # a different one (e.g. the mane against the body), so parts read separately.
        for j in range(oh):
            for i in range(ow):
                k = mat[j, i]
                if k <= 0 or edge[j, i] or not (len(self.materials[k]) > 3 and self.materials[k][3]):
                    continue
                for dj, di in ((1, 0), (0, 1), (-1, 0), (0, -1)):
                    jj, ii = j + dj, i + di
                    if 0 <= jj < oh and 0 <= ii < ow and mat[jj, ii] > 0 and mat[jj, ii] != k \
                            and not (len(self.materials[mat[jj, ii]]) > 3 and self.materials[mat[jj, ii]][3] and mat[jj, ii] > k):
                        rgb[j, i] = self.materials[k][2]
                        break
        if ow > SIZE:  # trim evenly from both sides
            cut = (ow - SIZE) // 2
            rgb, on, ow = rgb[:, cut:cut + SIZE], on[:, cut:cut + SIZE], SIZE
        canvas = np.zeros((SIZE, SIZE, 3), np.uint8)
        mask = np.zeros((SIZE, SIZE), bool)
        y = SIZE - oh - self.bottom_pad // 2
        x = (SIZE - ow) // 2
        canvas[y:y + oh, x:x + ow] = rgb
        mask[y:y + oh, x:x + ow] = on
        return canvas, mask, (x, y)


def save(canvas, mask, png, pal_path, preview=None):
    """Index the RGB result (15 colors max) and write the sprite, its palette and a preview."""
    cols = sorted({tuple(c) for c in canvas[mask].tolist()})
    assert len(cols) <= 15, "%d colors; a GBA sprite has 15" % len(cols)
    idx = np.zeros(mask.shape, np.uint8)
    lookup = {c: i + 1 for i, c in enumerate(cols)}
    for j, i in zip(*np.nonzero(mask)):
        idx[j, i] = lookup[tuple(canvas[j, i])]
    im = Image.fromarray(idx, "P")
    flat = [0, 255, 0] + [v for c in cols for v in c]
    im.putpalette(flat + [0] * (768 - len(flat)))
    im.save(png)
    with open(pal_path, "w") as f:
        f.write("JASC-PAL\n0100\n16\n0 255 0\n")
        for c in cols + [(0, 0, 0)] * (15 - len(cols)):
            f.write("%d %d %d\n" % c)
    if preview:
        prev = canvas.copy()
        prev[~mask] = (216, 232, 240)
        Image.fromarray(prev).resize((512, 512), Image.NEAREST).save(preview)
