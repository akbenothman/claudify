#!/usr/bin/env python3
"""Rearrange a green-screen creature so it fits a square sprite, and flatten its texture.

Gen 3 sprites fill a square frame. Concept art often doesn't (long tails, spread wings), and shrinking a
wide picture to 64x64 leaves every part tiny. This moves parts closer together first, so the creature
can be drawn bigger. It also flattens painterly texture (fur strokes) into clean areas of color, which
would otherwise turn into noise at 64x64.

Usage: recompose.py SOURCE OUT.png [EDIT ...]

EDITs, applied in order (coordinates are source pixels):
  erase:X0,Y0,X1,Y1[:H0-H1]     remove a box (only hues H0-H1 if given), e.g. grass under the creature
  move:X0,Y0,X1,Y1:DX,DY[:front] cut the creature inside a box and paste it DX,DY away. By default the
                                moved part goes behind what's already there (a tail tucked behind a
                                body); ':front' puts it on top
  scale:X0,Y0,X1,Y1:S[:front]   scale the part inside a box by S around the box centre (e.g. 0.8 to
                                shrink a wing), pasted behind unless ':front'
  delines:K                     paint over dark lines thinner than K pixels (fur strokes, whiskers) with
                                the colors around them. The sprite converter redraws the outline, and
                                eyes are best placed by hand afterwards
  squash:X0,Y0,X1,Y1:SX         squeeze a box sideways by SX, keeping its left edge in place, so a long
                                tail stays attached but takes less room
  despeck:N                     remove loose bits smaller than N pixels (sparks, crumbs, stray grass)
  flatten:SP,SR                 mean-shift filter (spatial radius SP, color radius SR), e.g. 12,28:
                                merges fur strokes into flat color while keeping outlines
"""
import sys

import numpy as np
from PIL import Image

GREEN = np.array([0, 255, 0], np.uint8)


def solid_mask(rgb):
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    return (g - np.maximum(r, b)) <= 60


def hue(rgb):
    f = rgb.astype(np.float32)
    mx, mn = f.max(-1), f.min(-1)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, (g - b) / d % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, (mx - mn) / np.maximum(mx, 1)


def box(spec):
    return tuple(int(v) for v in spec.split(","))


def paste(rgb, solid, part, pmask, x, y, front):
    h, w = pmask.shape
    H, W = solid.shape
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    if x0 >= x1 or y0 >= y1:
        return
    pm = pmask[y0 - y:y1 - y, x0 - x:x1 - x]
    if not front:
        pm = pm & ~solid[y0:y1, x0:x1]
    rgb[y0:y1, x0:x1][pm] = part[y0 - y:y1 - y, x0 - x:x1 - x][pm]
    solid[y0:y1, x0:x1] |= pm


def main():
    src, out, edits = sys.argv[1], sys.argv[2], sys.argv[3:]
    rgb = np.asarray(Image.open(src).convert("RGB")).copy()
    # Room to move parts past the original edges.
    pad = 200
    rgb = np.pad(rgb, ((pad, pad), (pad, pad), (0, 0)))
    rgb[:pad] = rgb[-pad:] = rgb[:, :pad] = rgb[:, -pad:] = GREEN
    solid = solid_mask(rgb)
    for e in edits:
        op, _, rest = e.partition(":")
        if op == "flatten":
            import cv2  # only needed for this step: pip install opencv-python-headless
            sp, sr = map(int, rest.split(","))
            flat = cv2.pyrMeanShiftFiltering(np.ascontiguousarray(rgb[..., ::-1]), sp, sr)[..., ::-1]
            rgb = np.where(solid[..., None], flat, GREEN).astype(np.uint8)
            solid = solid_mask(rgb)
            continue
        if op == "despeck":
            import cv2
            n, lab, stats, _ = cv2.connectedComponentsWithStats(solid.astype(np.uint8), connectivity=8)
            small = stats[:, cv2.CC_STAT_AREA] < int(rest)
            small[0] = False
            gone = small[lab] & solid
            rgb[gone] = GREEN
            solid &= ~gone
            continue
        if op == "delines":
            import cv2
            k = int(rest)
            lum = rgb.astype(np.float32) @ np.float32([0.299, 0.587, 0.114])
            dark = ((lum < 70) & solid).astype(np.uint8)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
            thick = cv2.dilate(cv2.erode(dark, kernel), kernel)
            # Only lines inside the creature: keep a band along the silhouette edge.
            inner = cv2.erode(solid.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
            thin = (dark & ~thick.astype(bool) & inner.astype(bool)).astype(np.uint8)
            bgr = np.ascontiguousarray(rgb[..., ::-1])
            rgb = cv2.inpaint(bgr, cv2.dilate(thin, np.ones((3, 3), np.uint8)), 5, cv2.INPAINT_TELEA)[..., ::-1].copy()
            rgb[~solid] = GREEN
            continue
        parts = rest.split(":")
        x0, y0, x1, y1 = (v + pad for v in box(parts[0]))
        if op == "erase":
            m = np.zeros_like(solid)
            m[y0:y1, x0:x1] = True
            if len(parts) > 1:
                lo, hi = map(float, parts[1].split("-"))
                h, s = hue(rgb)
                m &= (h >= lo) & (h <= hi) & (s > 0.15)
            rgb[m & solid] = GREEN
            solid &= ~m
        elif op == "squash":
            sx = float(parts[1])
            part = rgb[y0:y1, x0:x1].copy()
            pmask = solid[y0:y1, x0:x1].copy()
            rgb[y0:y1, x0:x1][pmask] = GREEN
            solid[y0:y1, x0:x1] &= ~pmask
            w = max(1, round((x1 - x0) * sx))
            part = np.asarray(Image.fromarray(part).resize((w, y1 - y0), Image.LANCZOS))
            pmask = np.asarray(Image.fromarray(pmask.astype(np.uint8) * 255).resize((w, y1 - y0), Image.BILINEAR)) > 127
            paste(rgb, solid, part, pmask, x0, y0, True)
        elif op in ("move", "scale"):
            front = parts[-1] == "front"
            part = rgb[y0:y1, x0:x1].copy()
            pmask = solid[y0:y1, x0:x1].copy()
            rgb[y0:y1, x0:x1][pmask] = GREEN
            solid[y0:y1, x0:x1] &= ~pmask
            if op == "move":
                dx, dy = map(int, parts[1].split(","))
                paste(rgb, solid, part, pmask, x0 + dx, y0 + dy, front)
            else:
                s = float(parts[1])
                w, h = round((x1 - x0) * s), round((y1 - y0) * s)
                part = np.asarray(Image.fromarray(part).resize((w, h), Image.LANCZOS))
                pmask = np.asarray(Image.fromarray(pmask.astype(np.uint8) * 255).resize((w, h), Image.BILINEAR)) > 127
                cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
                paste(rgb, solid, part, pmask, cx - w // 2, cy - h // 2, front)
        else:
            sys.exit("unknown edit: " + e)
    # Same size as the source, so later steps can keep using source coordinates.
    Image.fromarray(rgb[pad:-pad, pad:-pad]).save(out)


if __name__ == "__main__":
    main()
