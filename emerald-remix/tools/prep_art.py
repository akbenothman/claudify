#!/usr/bin/env python3
"""Prepare AI art on a plain (white) background for convert_sprite.py.

Usage: prep_art.py SOURCE OUT.png [move:X0,Y0,X1,Y1:DX,DY ...]

Cuts the creature out (flood-fills the background from the image edges, so white inside the creature
stays), drops loose specks, and can move parts (e.g. tuck a long tail behind the body, pasted behind)
so the creature fits a square sprite. Writes a transparent PNG, so green details like leaves survive
(a green-screen key would delete them).
"""
import sys

import numpy as np
from PIL import Image, ImageDraw

KEY = (255, 0, 255)


def main():
    src, out, edits = sys.argv[1], sys.argv[2], sys.argv[3:]
    im = Image.open(src).convert("RGB")
    w, h = im.size
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w - 1, h // 2), (w // 2, h - 1), (0, h // 2)]:
        if im.getpixel(seed) != KEY:
            ImageDraw.floodfill(im, seed, KEY, thresh=40)
    a = np.asarray(im)
    rgba = np.dstack([a, np.where((a == KEY).all(-1), 0, 255).astype(np.uint8)])
    img = Image.fromarray(rgba, "RGBA")
    for e in edits:
        op, box, delta = e.split(":")
        assert op == "move", e
        x0, y0, x1, y1 = map(int, box.split(","))
        dx, dy = map(int, delta.split(","))
        part = img.crop((x0, y0, x1, y1))
        arr = np.asarray(img).copy()
        arr[y0:y1, x0:x1, 3] = 0
        under = Image.new("RGBA", img.size, (0, 0, 0, 0))
        under.paste(part, (x0 + dx, y0 + dy))
        img = Image.alpha_composite(under, Image.fromarray(arr, "RGBA"))
    # Keep only big pieces: compression leaves specks along the old background edge.
    arr = np.asarray(img).copy()
    on = arr[..., 3] > 0
    lab = np.zeros(on.shape, int)
    sizes = [0]
    n = 0
    for y, x in zip(*np.nonzero(on)):
        if lab[y, x]:
            continue
        n += 1
        stack, count = [(y, x)], 0
        lab[y, x] = n
        while stack:
            cy, cx = stack.pop()
            count += 1
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < on.shape[0] and 0 <= nx < on.shape[1] and on[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n
                    stack.append((ny, nx))
        sizes.append(count)
    sizes = np.asarray(sizes)
    arr[..., 3] = np.where(sizes[lab] >= 2000, arr[..., 3], 0)
    Image.fromarray(arr, "RGBA").save(out)


if __name__ == "__main__":
    main()
