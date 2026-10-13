#!/usr/bin/env python3
"""Turn a green-screen image (e.g. from Gemini) into GBA Pokémon sprite files.

Writes into OUT_DIR:
  front.png  (or back.png)  64x64, 4bpp indexed, index 0 = transparent
  normal.pal                JASC palette, 16 colors
  icon.png                  32x64 (two 32x32 frames) on one of the shared icon palettes
  preview.png               8x upscale of the sprite, for eyeballing on a phone

Usage:
  convert_sprite.py SOURCE OUT_DIR --stage {1,2,3} [--back] [--no-outline] [--no-icon]
"""
import argparse
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ICON_PAL_DIR = os.path.join(HERE, "icon_palettes")

# How big the creature is allowed to be inside the 64x64 frame, per evolution stage.
STAGE_FIT = {1: 44, 2: 56, 3: 64}
TRANSPARENT = (0, 255, 0)


def green_mask(rgb):
    """1.0 where a pixel is creature, 0.0 where it is green screen."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    greenness = g - np.maximum(r, b)
    # Hard green -> background; soft ramp across anti-aliased edges.
    return np.clip((110 - greenness) / 50, 0, 1)


def to_gba_color(c):
    """GBA colors are 15-bit, so snap each channel to a multiple of 8."""
    return tuple(int(min(248, round(v / 8) * 8)) for v in c)


def read_jasc(path):
    lines = open(path).read().split()
    n = int(lines[2])
    vals = list(map(int, lines[3:3 + n * 3]))
    return [tuple(vals[i:i + 3]) for i in range(0, n * 3, 3)]


def write_jasc(path, colors):
    colors = list(colors) + [(0, 0, 0)] * (16 - len(colors))
    with open(path, "w") as f:
        f.write("JASC-PAL\n0100\n16\n")
        for c in colors:
            f.write("%d %d %d\n" % c)


def cut_out(src):
    """Return (premultiplied rgb, mask) cropped tight around the creature."""
    rgb = np.asarray(Image.open(src).convert("RGB"), dtype=np.float32)
    mask = green_mask(rgb)
    ys, xs = np.where(mask > 0.5)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb, mask = rgb[y0:y1, x0:x1], mask[y0:y1, x0:x1]
    return rgb * mask[..., None], mask


def shrink(premul, mask, fit):
    """Box-downsample so the longest side is `fit` px, without green fringing."""
    h, w = mask.shape
    scale = fit / max(h, w)
    size = (max(1, round(w * scale)), max(1, round(h * scale)))
    chans = [Image.fromarray(premul[..., i]).resize(size, Image.BOX) for i in range(3)]
    m = np.asarray(Image.fromarray(mask).resize(size, Image.BOX), dtype=np.float32)
    rgb = np.stack([np.asarray(c, dtype=np.float32) for c in chans], -1)
    rgb = rgb / np.maximum(m, 1e-6)[..., None]
    return np.clip(rgb, 0, 255), m > 0.5


def place(rgb, solid, box):
    """Center horizontally, sit on the bottom edge of a box x box canvas."""
    h, w = solid.shape
    canvas = np.zeros((box, box, 3), np.float32)
    on = np.zeros((box, box), bool)
    x, y = (box - w) // 2, box - h
    canvas[y:y + h, x:x + w] = rgb
    on[y:y + h, x:x + w] = solid
    return canvas, on


def edge_pixels(on):
    """Opaque pixels that touch transparency (4-neighbour)."""
    pad = np.pad(on, 1)
    neighbours_off = (~pad[:-2, 1:-1]) | (~pad[2:, 1:-1]) | (~pad[1:-1, :-2]) | (~pad[1:-1, 2:])
    return on & neighbours_off


def quantize(rgb, on, ncolors):
    """Pick `ncolors` colors for the opaque pixels; return (palette, index map)."""
    pixels = rgb[on].astype(np.uint8)
    strip = Image.fromarray(pixels.reshape(1, -1, 3), "RGB")
    q = strip.quantize(colors=ncolors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = q.getpalette()[: ncolors * 3]
    palette = [to_gba_color(pal[i:i + 3]) for i in range(0, len(pal), 3)]
    idx = np.zeros(on.shape, np.uint8)
    idx[on] = np.asarray(q, np.uint8).reshape(-1) + 1  # +1: index 0 is transparent
    return palette, idx


def save_indexed(path, idx, palette):
    im = Image.fromarray(idx, "P")
    flat = [c for col in [TRANSPARENT] + palette for c in col]
    im.putpalette(flat + [0] * (768 - len(flat)))
    im.save(path)


def make_sprite(src, out_dir, stage, back, outline):
    premul, mask = cut_out(src)
    rgb, solid = shrink(premul, mask, STAGE_FIT[stage])
    rgb, on = place(rgb, solid, 64)
    palette, idx = quantize(rgb, on, 15)
    palette = palette + [(0, 0, 0)] * (15 - len(palette))
    if outline:
        # Gen 3 sprites have a crisp dark outline; downscaling softens it, so redraw it.
        darkest = 1 + min(range(15), key=lambda i: sum(palette[i]))
        idx[edge_pixels(on)] = darkest
    name = "back.png" if back else "front.png"
    save_indexed(os.path.join(out_dir, name), idx, palette)
    if not back:
        write_jasc(os.path.join(out_dir, "normal.pal"), [TRANSPARENT] + palette)
        shiny = os.path.join(out_dir, "shiny.pal")
        if not os.path.exists(shiny):  # placeholder until a real shiny is picked
            write_jasc(shiny, [TRANSPARENT] + palette)
    preview = Image.fromarray(idx, "P")
    preview.putpalette([c for col in [(255, 255, 255)] + palette for c in col])
    preview.convert("RGB").resize((512, 512), Image.NEAREST).save(
        os.path.join(out_dir, "preview_back.png" if back else "preview.png"))
    return palette


def make_icon(src, out_dir):
    """32x64 icon: frame 2 is frame 1 nudged up a pixel. Picks the closest shared icon palette."""
    premul, mask = cut_out(src)
    rgb, solid = shrink(premul, mask, 28)
    rgb, on = place(rgb, solid, 32)
    best = None
    for n in range(6):
        pal = read_jasc(os.path.join(ICON_PAL_DIR, "pal%d.pal" % n))[1:]
        p = np.asarray(pal, np.float32)
        d = ((rgb[on][:, None, :] - p[None]) ** 2).sum(-1)
        err = d.min(1).sum()
        if best is None or err < best[0]:
            best = (err, n, pal, d.argmin(1))
    _, n, pal, nearest = best
    frame = np.zeros((32, 32), np.uint8)
    frame[on] = nearest + 1
    frame[edge_pixels(on)] = 1 + min(range(15), key=lambda i: sum(pal[i]))
    up = np.zeros_like(frame)
    up[:-1] = frame[1:]
    save_indexed(os.path.join(out_dir, "icon.png"), np.vstack([frame, up]), pal)
    return n


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source")
    ap.add_argument("out_dir")
    ap.add_argument("--stage", type=int, choices=(1, 2, 3), required=True)
    ap.add_argument("--back", action="store_true", help="source is a back sprite")
    ap.add_argument("--no-outline", dest="outline", action="store_false")
    ap.add_argument("--no-icon", dest="icon", action="store_false")
    a = ap.parse_args()
    os.makedirs(a.out_dir, exist_ok=True)
    make_sprite(a.source, a.out_dir, a.stage, a.back, a.outline)
    msg = a.out_dir
    if a.icon and not a.back:
        msg += "  (icon palette %d)" % make_icon(a.source, a.out_dir)
    print(msg)


if __name__ == "__main__":
    main()
