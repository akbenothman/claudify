#!/usr/bin/env python3
"""Apply hand-placed pixel edits to an indexed sprite.

Usage: touchup.py SPRITE.png EDITS.txt [PALETTE.pal]

EDITS.txt holds one edit per line ('#' starts a comment):
  row Y X0 i i i ...   set pixels (X0, Y), (X0+1, Y), ... to palette indices; '_' leaves one alone
  px X Y i             set one pixel
  remap A B            every pixel using index A now uses index B (frees slot A)
  color I R G B        change palette slot I (also written to PALETTE.pal if given)
"""
import sys

import numpy as np
from PIL import Image


def main():
    sprite, edits = sys.argv[1], sys.argv[2]
    pal_file = sys.argv[3] if len(sys.argv) > 3 else None
    im = Image.open(sprite)
    pal = im.getpalette()
    a = np.asarray(im).copy()
    for line in open(edits):
        line = line.split("#")[0].split()
        if not line:
            continue
        op, args = line[0], line[1:]
        if op == "row":
            y, x0, vals = int(args[0]), int(args[1]), args[2:]
            for i, v in enumerate(vals):
                if v != "_":
                    a[y, x0 + i] = int(v)
        elif op == "px":
            a[int(args[1]), int(args[0])] = int(args[2])
        elif op == "remap":
            a[a == int(args[0])] = int(args[1])
        elif op == "color":
            i = int(args[0])
            pal[i * 3:i * 3 + 3] = [int(v) for v in args[1:4]]
        else:
            sys.exit("unknown edit: " + op)
    out = Image.fromarray(a, "P")
    out.putpalette(pal)
    out.save(sprite)
    if pal_file:
        with open(pal_file, "w") as f:
            f.write("JASC-PAL\n0100\n16\n")
            for i in range(16):
                f.write("%d %d %d\n" % tuple(pal[i * 3:i * 3 + 3]))


if __name__ == "__main__":
    main()
