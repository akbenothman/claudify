#!/usr/bin/env python3
"""Lay converted sprites out on one sheet (4x scale, plus icons) to check them on a phone.

Usage: preview_sheet.py OUT.png ROW [ROW ...]   where ROW is comma-separated sprite dirs, e.g.
       preview_sheet.py sheet.png graphics/starters/squeesh,graphics/starters/heesh
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

SCALE = 4
BG = (216, 232, 240)


def flatten(path):
    """Indexed sprite -> RGB with index 0 shown as the background color."""
    im = Image.open(path)
    idx = np.asarray(im)
    rgb = np.asarray(im.convert("RGB")).copy()
    rgb[idx == 0] = BG
    return Image.fromarray(rgb)


def main():
    out, rows = sys.argv[1], [r.split(",") for r in sys.argv[2:]]
    cols = max(len(r) for r in rows)
    tile = 64 * SCALE
    sheet = Image.new("RGB", (10 + cols * (tile + 10) + 32 * 2 + 20, 10 + len(rows) * (tile + 24)), (250, 250, 245))
    d = ImageDraw.Draw(sheet)
    for r, row in enumerate(rows):
        y = 10 + r * (tile + 24)
        for c, sprite_dir in enumerate(row):
            x = 10 + c * (tile + 10)
            sheet.paste(flatten(os.path.join(sprite_dir, "front.png")).resize((tile, tile), Image.NEAREST), (x, y))
            d.text((x + 4, y + tile + 4), os.path.basename(sprite_dir.rstrip("/")), fill=(0, 0, 0))
            icon = os.path.join(sprite_dir, "icon.png")
            if os.path.exists(icon):
                frame = flatten(icon).crop((0, 0, 32, 32)).resize((64, 64), Image.NEAREST)
                sheet.paste(frame, (10 + cols * (tile + 10) + 10, y + c * 72))
    sheet.save(out)


if __name__ == "__main__":
    main()
