#!/usr/bin/env python3
"""Apply hand-placed pixel edits to an indexed sprite.

Usage: touchup.py SPRITE.png EDITS.txt [PALETTE.pal]

EDITS.txt holds one edit per line ('#' starts a comment):
  row Y X0 i i i ...   set pixels (X0, Y), (X0+1, Y), ... to palette indices; '_' leaves one alone
  px X Y i             set one pixel
  remap A B            every pixel using index A now uses index B (frees slot A)
  rremap X0 Y0 X1 Y1 A B [even|odd]
                       same, but only inside the box (inclusive), optionally only even/odd columns
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
        elif op == "rremap":
            x0, y0, x1, y1, src, dst = map(int, args[:6])
            box = a[y0:y1 + 1, x0:x1 + 1]
            hit = box == src
            if len(args) > 6:
                cols = np.arange(x0, x1 + 1) % 2 == (0 if args[6] == "even" else 1)
                hit &= cols[None, :]
            box[hit] = dst
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
