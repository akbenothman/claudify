#!/usr/bin/env python3
"""Hand-paint pixels onto an indexed sprite using named colors instead of palette numbers.

Usage: paint.py SPRITE.png EDITS.txt [PALETTE.pal]

Palette numbers change every time a sprite is re-converted, so hand edits written as numbers break.
Here edits name their colors. Each named color uses the closest palette entry; if none is close, two
near-identical palette entries are merged to make room for it (the sprite has only 15 colors).

EDITS.txt ('#' starts a comment):
  color NAME R G B          define a color
  grid X0 Y0                the lines after it, up to 'end', are rows of space-separated color names
  ...                       starting at (X0, Y0); '_' leaves a pixel alone
  end
  px X Y NAME               one pixel
  swap R G B NAME           every pixel of the palette entry closest to R,G,B becomes NAME
"""
import sys

import numpy as np
from PIL import Image

CLOSE = 20  # a palette entry within this distance counts as the named color


def main():
    sprite, edits = sys.argv[1], sys.argv[2]
    pal_file = sys.argv[3] if len(sys.argv) > 3 else None
    im = Image.open(sprite)
    a = np.asarray(im).copy()
    pal = np.asarray(im.getpalette()[:48], int).reshape(16, 3)
    names = {}

    def dist(i, c):
        return float(np.sqrt(((pal[i] - c) ** 2).sum()))

    def slot_for(c):
        c = np.asarray(c, int)
        used = [i for i in range(1, 16)]
        best = min(used, key=lambda i: dist(i, c))
        if dist(best, c) <= CLOSE:
            return best
        # Free a slot: merge the two closest colors that aren't already spoken for.
        taken = set(names.values())
        pairs = [(float(np.sqrt(((pal[i] - pal[j]) ** 2).sum())), i, j)
                 for i in range(1, 16) for j in range(i + 1, 16) if j not in taken]
        _, keep, drop = min(pairs)
        a[a == drop] = keep
        pal[drop] = c
        return drop

    lines = open(edits).read().split("\n")
    i = 0
    while i < len(lines):
        t = lines[i].split("#")[0].split()
        i += 1
        if not t:
            continue
        op = t[0]
        if op == "color":
            names[t[1]] = slot_for(tuple(map(int, t[2:5])))
        elif op == "grid":
            x0, y0 = int(t[1]), int(t[2])
            y = y0
            while lines[i].split("#")[0].strip() != "end":
                for x, tok in enumerate(lines[i].split("#")[0].split()):
                    if tok != "_":
                        a[y, x0 + x] = names[tok]
                y += 1
                i += 1
            i += 1
        elif op == "px":
            a[int(t[2]), int(t[1])] = names[t[3]]
        elif op == "swap":
            src = min(range(1, 16), key=lambda k: dist(k, np.asarray(list(map(int, t[1:4])))))
            a[a == src] = names[t[4]]
        else:
            sys.exit("unknown edit: " + op)
    out = Image.fromarray(a, "P")
    out.putpalette([int(v) for v in pal.ravel()] + [0] * (768 - 48))
    out.save(sprite)
    if pal_file:
        with open(pal_file, "w") as f:
            f.write("JASC-PAL\n0100\n16\n")
            for c in pal:
                f.write("%d %d %d\n" % tuple(c))


if __name__ == "__main__":
    main()
