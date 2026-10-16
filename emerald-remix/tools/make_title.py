#!/usr/bin/env python3
"""Draw the "INTO THE MOVERSE" banner that replaces "EMERALD VERSION" under the title-screen logo.

Usage: make_title.py ORIGINAL_emerald_version.png OUT.png
Keeps the original's size (128x32) and 16-color palette: white letters, a dark outline and a gray
shadow, like the original. Font: Inter Display (SIL Open Font License).
"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT = "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf"
TRANSPARENT, OUTLINE, SHADOW, FILL = 0, 4, 2, 15  # palette indexes in the original


def text_mask(text, size, width):
    font = ImageFont.truetype(FONT, size)
    l, t, r, b = font.getbbox(text)
    m = Image.new("L", (r - l + 4, b - t + 4), 0)
    ImageDraw.Draw(m).text((2 - l, 2 - t), text, font=font, fill=255)
    m = m.point(lambda v: 255 if v > 110 else 0)
    if m.width > width:
        m = m.resize((width, m.height), Image.NEAREST)
    return m


def main(src, out):
    orig = Image.open(src)
    w, h = orig.size
    mask = Image.new("L", (w, h), 0)
    top = text_mask("INTO THE", 10, w - 8)
    big = text_mask("MOVERSE", 18, w - 4)
    mask.paste(top, ((w - top.width) // 2, 0), top)
    mask.paste(big, ((w - big.width) // 2, h - big.height - 1), big)
    outline = mask.filter(ImageFilter.MaxFilter(3))
    img = Image.new("P", (w, h), TRANSPARENT)
    img.putpalette(orig.getpalette())
    px, mo, mf = img.load(), outline.load(), mask.load()
    for y in range(h):
        for x in range(w):
            if mf[x, y]:
                # gray shadow on the lower part of each letter, like the original's shading
                below = y + 1 < h and not mf[x, y + 1]
                px[x, y] = SHADOW if below else FILL
            elif mo[x, y]:
                px[x, y] = OUTLINE
    img.save(out, transparency=TRANSPARENT)


if __name__ == "__main__":
    main(*sys.argv[1:3])
