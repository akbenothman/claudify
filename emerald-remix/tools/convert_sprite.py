#!/usr/bin/env python3
"""Turn a green-screen image (e.g. from Gemini) into GBA Pokémon sprite files.

Writes into OUT_DIR:
  front.png  (or back.png)  64x64, 4bpp indexed, index 0 = transparent
  normal.pal                JASC palette, 16 colors
  shiny.pal                 placeholder copy of normal.pal (only if missing)
  icon.png                  32x64 (two 32x32 frames) on one of the shared icon palettes
  preview.png               8x upscale of the sprite, for eyeballing on a phone

How it keeps detail: colors are chosen at full resolution first (k-means, weighted toward
vivid colors so small things like a strawberry keep their own color), then the image is shrunk
by taking the most common color in each block instead of averaging, so nothing turns to mush.
Dark line work wins a block when it covers enough of it, which keeps outlines and facial
features. Finally, stray single pixels are cleaned up.

Usage:
  convert_sprite.py SOURCE OUT_DIR --stage {1,2,3} [--back] [--no-icon]
                    [--recolor HUE_FROM-HUE_TO:NEW_HUE[:SAT]] ...
"""
import argparse
import colorsys
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ICON_PAL_DIR = os.path.join(HERE, "icon_palettes")

# How big the creature may be inside the 64x64 frame, per evolution stage.
STAGE_FIT = {1: 50, 2: 58, 3: 64}
# Back sprites are the player's own Pokémon, seen up close; the battle textbox covers their lower edge.
BACK_FIT = {1: 56, 2: 62, 3: 64}
TRANSPARENT = (0, 255, 0)
LINE_SHARE = 0.25 # a block becomes outline color if at least this much of it is line work
CONTRAST = 1.5    # how strongly small high-contrast details (eyes, glints) beat the block's main color


def green_mask(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (g - np.maximum(r, b)) > 60


def to_gba(c):
    """GBA colors are 15-bit, so snap each channel to a multiple of 8."""
    return tuple(int(min(248, round(v / 8) * 8)) for v in c)


def read_jasc(path):
    vals = open(path).read().split()
    n = int(vals[2])
    nums = list(map(int, vals[3:3 + n * 3]))
    return [tuple(nums[i:i + 3]) for i in range(0, n * 3, 3)]


def write_jasc(path, colors):
    colors = list(colors) + [(0, 0, 0)] * (16 - len(colors))
    with open(path, "w") as f:
        f.write("JASC-PAL\n0100\n16\n")
        for c in colors:
            f.write("%d %d %d\n" % c)


def lift_darks(rgb, solid, gamma, tint):
    """Brighten dark fills so black-clothed creatures keep readable shading, as Gen 3 does for dark
    Pokémon. Line work (near-black) stays black. Dark neutral fills get a cool `tint` (R,G,B added
    at full strength for the darkest fills, fading out by mid-grey) so black cloth reads as blue-black."""
    lum = rgb @ np.asarray([0.299, 0.587, 0.114], np.float32)
    fill = solid & (lum > 28)
    target = 255 * (lum / 255) ** gamma
    k = np.where(fill, target / np.maximum(lum, 1), 1)
    out = rgb * k[..., None]
    sat = (rgb.max(-1) - rgb.min(-1)) / np.maximum(rgb.max(-1), 1)
    w = fill & (sat < 0.25)
    strength = np.clip((110 - lum) / 80, 0, 1) * w
    out += strength[..., None] * np.asarray(tint, np.float32)
    return np.clip(out, 0, 255)


def enlarge(rgb, spec):
    """'X0,Y0,X1,Y1:SCALE' scales the oval inside that box (source pixels) up from its bottom centre.

    Real Gen 3 sprites give Pokémon slightly oversized heads so the face survives at 64x64; doing
    the same to the source lets the converter keep the artist's own eyes and mouth."""
    box, scale = spec.split(":")
    x0, y0, x1, y1 = map(int, box.split(","))
    scale = float(scale)
    crop = rgb[y0:y1, x0:x1]
    h, w = crop.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    oval = ((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2 <= 1
    keep = oval & ~green_mask(crop)
    nw, nh = round(w * scale), round(h * scale)
    big = np.stack([np.asarray(Image.fromarray(crop[..., c]).resize((nw, nh), Image.LANCZOS)) for c in range(3)], -1)
    bigmask = np.asarray(Image.fromarray(keep.astype(np.float32)).resize((nw, nh), Image.BILINEAR)) > 0.5
    px, py = round((x0 + x1) / 2 - nw / 2), y1 - nh
    out = rgb.copy()
    region = out[py:py + nh, px:px + nw]
    region[bigmask] = np.clip(big, 0, 255)[bigmask]
    return out


PAD = 300


def shift_box(spec, d):
    """Move the 'X0,Y0,X1,Y1' box at the start of a spec by d pixels right and down."""
    box, sep, rest = spec.partition(":")
    return ",".join(str(int(v) + d) for v in box.split(",")) + sep + rest


def clear(rgb, solid, spec):
    """'X0,Y0,X1,Y1[:HUE_FROM-HUE_TO]' erases source pixels inside the box (only those in the hue
    range, if given), e.g. a grass patch drawn under the creature."""
    box, _, hues = spec.partition(":")
    x0, y0, x1, y1 = map(int, box.split(","))
    hit = np.zeros_like(solid)
    hit[y0:y1, x0:x1] = True
    if hues:
        lo, hi = map(float, hues.split("-"))
        mx, mn = rgb.max(-1), rgb.min(-1)
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        d = np.maximum(mx - mn, 1e-6)
        h = np.where(mx == r, (g - b) / d % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
        hit &= (h >= lo) & (h <= hi) & ((mx - mn) / np.maximum(mx, 1) > 0.15)
    return solid & ~hit


def load(src, recolors, lift=None, tint=(0, 0, 0), enlarges=(), crop=None, clears=()):
    im = Image.open(src)
    rgb = np.asarray(im.convert("RGB"), dtype=np.float32)
    if "A" in im.convert("RGBA").getbands() and im.mode in ("RGBA", "LA", "P"):
        # Transparent PNG (most pixel-art tools): see-through pixels are background.
        alpha = np.asarray(im.convert("RGBA"))[..., 3]
        rgb[alpha < 128] = TRANSPARENT
    if enlarges:
        # Pad with green so an enlarged head near the edge isn't cut off, and shift every box to match.
        rgb = np.pad(rgb, ((PAD, PAD), (PAD, PAD), (0, 0)))
        rgb[:PAD] = rgb[-PAD:] = rgb[:, :PAD] = rgb[:, -PAD:] = TRANSPARENT
        enlarges = [shift_box(s, PAD) for s in enlarges]
        crop = crop and shift_box(crop, PAD)
        clears = [shift_box(s, PAD) for s in clears]
    for spec in enlarges:
        rgb = enlarge(rgb, spec)
    solid = ~green_mask(rgb)
    if crop:
        # Keep only what's inside the box: frames a wide creature (wings, a long tail) so the
        # important part fills the sprite instead of shrinking everything.
        x0, y0, x1, y1 = map(int, crop.split(","))
        keep = np.zeros_like(solid)
        keep[y0:y1, x0:x1] = True
        solid &= keep
    for spec in clears:
        solid = clear(rgb, solid, spec)
    # Green spill on edge pixels: pull green down to the other channels.
    spill = solid & (rgb[..., 1] > np.maximum(rgb[..., 0], rgb[..., 2]) + 20)
    rgb[spill, 1] = np.maximum(rgb[spill, 0], rgb[spill, 2])
    ys, xs = np.where(solid)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb, solid = rgb[y0:y1, x0:x1], solid[y0:y1, x0:x1]
    for spec in recolors:
        rgb = recolor(rgb, solid, spec)
    if lift:
        rgb = lift_darks(rgb, solid, lift, tint)
    return rgb, solid


def recolor(rgb, solid, spec):
    """'200-250:30:0.45' moves pixels with hue 200-250° to hue 30° (optionally setting saturation)."""
    parts = spec.split(":")
    lo, hi = map(float, parts[0].split("-"))
    new_h = float(parts[1]) / 360
    new_s = float(parts[2]) if len(parts) > 2 else None
    out = rgb.copy()
    flat = rgb[solid] / 255
    res = []
    for r, g, b in flat:
        h, l, s = colorsys.rgb_to_hls(r, g, b)
        if s > 0.12 and lo <= h * 360 <= hi:
            r, g, b = colorsys.hls_to_rgb(new_h, l, new_s if new_s is not None else s)
        res.append((r, g, b))
    out[solid] = np.asarray(res) * 255
    return out


def detect_grid(rgb, solid, max_scale=16):
    """Find the pixel size of upscaled pixel art: color changes all fall on a regular grid.

    Returns (scale, x offset, y offset). The largest scale whose grid lines catch most of the color
    changes wins (its divisors match too, its multiples don't)."""
    best = (1, 0, 0)
    found = {}
    for axis in (0, 1):
        d = np.abs(np.diff(rgb, axis=1 - axis)).sum(-1) > 60
        both = solid[:, 1:] & solid[:, :-1] if axis == 0 else solid[1:] & solid[:-1]
        pos = np.nonzero(d & both)[1 - axis] + 1
        found[axis] = pos
    for s in range(max_scale, 1, -1):
        offs, ok = [], True
        for axis in (0, 1):
            pos = found[axis]
            if len(pos) < 20:
                ok = False
                break
            counts = np.bincount(pos % s, minlength=s)
            if counts.max() < 0.7 * len(pos):
                ok = False
                break
            offs.append(int(counts.argmax()))
        if ok:
            return s, offs[0], offs[1]
    return best


def unscale_pixel_art(rgb, solid):
    """Turn upscaled pixel art back into its real pixels: each grid cell's most common color."""
    s, ox, oy = detect_grid(rgb, solid)
    h, w = solid.shape
    xs = list(range(ox - s if ox else 0, w, s))
    ys = list(range(oy - s if oy else 0, h, s))
    out = np.zeros((len(ys), len(xs), 3), np.float32)
    on = np.zeros((len(ys), len(xs)), bool)
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            cell_s = solid[max(y, 0):y + s, max(x, 0):x + s]
            if cell_s.mean() < 0.5:
                continue
            # The middle of the cell: compression smears colors at cell edges.
            m = s // 4
            core = rgb[max(y, 0) + m:y + s - m, max(x, 0) + m:x + s - m].reshape(-1, 3)
            out[j, i] = np.median(core, axis=0)
            on[j, i] = True
    ys_on, xs_on = np.nonzero(on)
    y0, y1, x0, x1 = ys_on.min(), ys_on.max() + 1, xs_on.min(), xs_on.max() + 1
    return out[y0:y1, x0:x1], on[y0:y1, x0:x1], s


def pixel_art_palette(pixels, tol=28):
    """The colors a pixel artist used. JPEG noise makes near-copies of each color, so colors within
    `tol` of a more common one count as that one."""
    vals, counts = np.unique(pixels.astype(int) // 4 * 4, axis=0, return_counts=True)
    centers, weight = [], []
    for i in np.argsort(-counts):
        c = vals[i]
        d = [np.abs(c - k).sum() for k in centers]
        if d and min(d) <= tol:
            weight[int(np.argmin(d))] += counts[i]
        else:
            centers.append(c)
            weight.append(counts[i])
    # A color used only once or twice is noise unless nothing else is near it.
    keep = [c for c, w in zip(centers, weight) if w >= 3] or centers
    return sorted({to_gba(c) for c in keep})


def kmeans_palette(pixels, k, iters=25, seed=1):
    """Weighted k-means; vivid pixels count extra so small saturated details get a color."""
    rng = np.random.default_rng(seed)
    if len(pixels) > 80000:
        pixels = pixels[rng.choice(len(pixels), 80000, replace=False)]
    mx, mn = pixels.max(1), pixels.min(1)
    sat = (mx - mn) / np.maximum(mx, 1)
    w = 1 + 4 * sat ** 2
    # k-means++ seeding
    centers = [pixels[rng.choice(len(pixels), p=w / w.sum())]]
    for _ in range(k - 1):
        d = ((pixels[:, None] - np.asarray(centers)[None]) ** 2).sum(-1).min(1) * w
        centers.append(pixels[rng.choice(len(pixels), p=d / d.sum())])
    c = np.asarray(centers)
    for _ in range(iters):
        lab = ((pixels[:, None] - c[None]) ** 2).sum(-1).argmin(1)
        for j in range(k):
            sel = lab == j
            if sel.any():
                c[j] = (pixels[sel] * w[sel, None]).sum(0) / w[sel].sum()
    pal = []
    for col in c:
        g = to_gba(col)
        if g not in pal:
            pal.append(g)
    return pal


def nearest(pixels, pal):
    p = np.asarray(pal, np.float32)
    return ((pixels[:, None] - p[None]) ** 2).sum(-1).argmin(1)


def shrink(labels, rgb, fit, line_label, pal, method):
    """Shrink a label map (-1 = transparent) so its long side is `fit`.

    hybrid:   each block takes its average color snapped to the palette (keeps shading), but line
              work wins when it covers LINE_SHARE of the block, and a small high-contrast detail
              (an eye, a glint) wins when it stands out from the average.
    majority: each block takes its most common color, with a boost for high-contrast colors.
    """
    h, w = labels.shape
    scale = fit / max(h, w)
    ow, oh = max(1, round(w * scale)), max(1, round(h * scale))
    ye = np.linspace(0, h, oh + 1).round().astype(int)
    xe = np.linspace(0, w, ow + 1).round().astype(int)
    n = labels.max() + 2
    cols = np.asarray(pal, np.float32)
    out = np.full((oh, ow), -1, int)
    for y in range(oh):
        for x in range(ow):
            ys = slice(ye[y], max(ye[y + 1], ye[y] + 1))
            xs = slice(xe[x], max(xe[x + 1], xe[x] + 1))
            block = labels[ys, xs].ravel()
            counts = np.bincount(block + 1, minlength=n)
            total = counts.sum()
            if counts[0] * 2 > total:
                continue
            if counts[line_label + 1] >= LINE_SHARE * total:
                out[y, x] = line_label
                continue
            c = counts[1:].astype(np.float32)
            if method == "majority":
                mean = (cols[: len(c)] * c[:, None]).sum(0) / c.sum()
                contrast = np.sqrt(((cols[: len(c)] - mean) ** 2).sum(1)) / 255
                out[y, x] = (c * (1 + CONTRAST * contrast)).argmax()
                continue
            opaque = block >= 0
            avg = rgb[ys, xs].reshape(-1, 3)[opaque].mean(0)
            choice = int(((cols - avg) ** 2).sum(1).argmin())
            # A detail that covers a fair part of the block and differs strongly from the average wins.
            dist = np.sqrt(((cols[: len(c)] - avg) ** 2).sum(1)) / 255
            score = (c / c.sum()) * dist
            j = int(score.argmax())
            if c[j] / c.sum() >= 0.18 and dist[j] > 0.3:
                choice = j
            out[y, x] = choice
    return out


def despeckle(lab, protect):
    """Replace lone pixels that disagree with 3+ matching neighbours."""
    out = lab.copy()
    h, w = lab.shape
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            v = lab[y, x]
            if v < 0 or v == protect:
                continue
            nb = [lab[y - 1, x], lab[y + 1, x], lab[y, x - 1], lab[y, x + 1]]
            if v in nb:
                continue
            vals, cnt = np.unique(nb, return_counts=True)
            if cnt.max() >= 3 and vals[cnt.argmax()] >= 0:
                out[y, x] = vals[cnt.argmax()]
    return out


def outline(lab, line_label):
    on = lab >= 0
    pad = np.pad(on, 1)
    edge = on & ((~pad[:-2, 1:-1]) | (~pad[2:, 1:-1]) | (~pad[1:-1, :-2]) | (~pad[1:-1, 2:]))
    lab = lab.copy()
    lab[edge] = line_label
    return lab


def place(lab, box):
    """Center horizontally, sit on the bottom edge of a box x box canvas.

    A zoomed creature can be bigger than the box: it's cut off at the bottom (its feet, or for a back
    sprite the part the battle textbox hides anyway) and evenly at the sides, never at the top."""
    h, w = lab.shape
    if h > box:
        lab = lab[:box]
        h = box
    if w > box:
        cut = (w - box) // 2
        lab = lab[:, cut:cut + box]
        w = box
    canvas = np.full((box, box), -1, int)
    x = (box - w) // 2
    canvas[box - h:, x:x + w] = lab
    return canvas


def build(rgb, solid, fit, box, ncolors, method="hybrid", pal=None, pixel_art=False):
    if pal is None:
        exact = pixel_art_palette(rgb[solid]) if pixel_art else []
        pal = exact if 0 < len(exact) <= ncolors else kmeans_palette(rgb[solid], ncolors)
    labels = np.full(solid.shape, -1, int)
    labels[solid] = nearest(rgb[solid], pal)
    line = min(range(len(pal)), key=lambda i: sum(pal[i]))
    if pixel_art and max(solid.shape) <= box:
        return place(labels, box), pal, line  # already real pixels: keep every one as drawn
    small = shrink(labels, rgb, fit, line, pal, method)
    if method == "majority":
        small = despeckle(small, line)
    small = outline(small, line)
    return place(small, box), pal, line


def save_indexed(path, lab, pal):
    idx = (lab + 1).astype(np.uint8)
    im = Image.fromarray(idx, "P")
    flat = [c for col in [TRANSPARENT] + list(pal) for c in col]
    im.putpalette(flat + [0] * (768 - len(flat)))
    im.save(path)


def make_sprite(rgb, solid, out_dir, stage, back, method="hybrid", zoom=1.0, colors=15, pixel_art=False):
    if back:
        # Front and back sprites share one palette in the game, so the back is drawn with the
        # finished front's colors (convert the front, and do its touch-ups, first).
        pal = read_jasc(os.path.join(out_dir, "normal.pal"))[1:16]
        lab, pal, _ = build(rgb, solid, round(BACK_FIT[stage] * zoom), 64, 15, method, pal, pixel_art)
    else:
        lab, pal, _ = build(rgb, solid, round(STAGE_FIT[stage] * zoom), 64, colors, method, None, pixel_art)
    save_indexed(os.path.join(out_dir, "back.png" if back else "front.png"), lab, pal)
    if not back:
        write_jasc(os.path.join(out_dir, "normal.pal"), [TRANSPARENT] + pal)
        shiny = os.path.join(out_dir, "shiny.pal")
        if not os.path.exists(shiny):
            write_jasc(shiny, [TRANSPARENT] + pal)
    prev = np.asarray([(255, 255, 255)] + pal, np.uint8)[lab + 1]
    Image.fromarray(prev).resize((512, 512), Image.NEAREST).save(
        os.path.join(out_dir, "preview_back.png" if back else "preview.png"))


def make_icon(rgb, solid, out_dir):
    """32x64 icon: frame 2 is frame 1 nudged up a pixel. Uses the closest shared icon palette."""
    lab, pal, line = build(rgb, solid, 28, 32, 15)
    on = lab >= 0
    cols = np.asarray(pal, np.float32)[lab[on]]
    best = None
    for n in range(6):
        ipal = read_jasc(os.path.join(ICON_PAL_DIR, "pal%d.pal" % n))[1:]
        p = np.asarray(ipal, np.float32)
        d = ((cols[:, None] - p[None]) ** 2).sum(-1)
        err = d.min(1).sum()
        if best is None or err < best[0]:
            best = (err, n, ipal, d.argmin(1))
    _, n, ipal, near = best
    frame = np.full(lab.shape, -1, int)
    frame[on] = near
    frame[lab == line] = min(range(len(ipal)), key=lambda i: sum(ipal[i]))
    up = np.full_like(frame, -1)
    up[:-1] = frame[1:]
    save_indexed(os.path.join(out_dir, "icon.png"), np.vstack([frame, up]), ipal)
    return n


def main():
    global LINE_SHARE, CONTRAST
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source")
    ap.add_argument("out_dir")
    ap.add_argument("--stage", type=int, choices=(1, 2, 3), required=True)
    ap.add_argument("--back", action="store_true", help="source is a back sprite (uses the front's normal.pal)")
    ap.add_argument("--mirror", action="store_true", help="flip the source left-right first")
    ap.add_argument("--zoom", type=float, default=1.0,
                    help="draw the creature this much bigger; what doesn't fit is cut off at the bottom")
    ap.add_argument("--no-icon", dest="icon", action="store_false")
    ap.add_argument("--enlarge", action="append", default=[], metavar="X0,Y0,X1,Y1:SCALE",
                    help="enlarge an oval region of the source (e.g. the head) before converting")
    ap.add_argument("--pixel-art", action="store_true",
                    help="the source is real pixel art (any upscale, e.g. a 512x512 export of a 64x64 "
                         "sprite): find its pixel grid and keep every pixel exactly as drawn")
    ap.add_argument("--colors", type=int, default=15,
                    help="colors to pick (max 15); fewer gives cleaner, flatter shading and leaves free "
                         "slots for hand-painted details (tools/paint.py)")
    ap.add_argument("--crop", metavar="X0,Y0,X1,Y1", help="keep only this box of the source")
    ap.add_argument("--clear", action="append", default=[], metavar="X0,Y0,X1,Y1[:H0-H1]",
                    help="erase a box of the source, optionally only one hue range (e.g. a grass patch)")
    ap.add_argument("--lift-darks", type=float, metavar="GAMMA",
                    help="brighten dark fills (e.g. 0.7) so black-clothed designs keep shading")
    ap.add_argument("--dark-tint", default="0,0,0", metavar="R,G,B",
                    help="color added to dark neutral fills with --lift-darks, e.g. 0,6,24 for blue-black")
    ap.add_argument("--recolor", action="append", default=[],
                    help="HUE_FROM-HUE_TO:NEW_HUE[:SAT], e.g. 190-250:30:0.5 turns blue-grey into brown")
    ap.add_argument("--method", choices=("hybrid", "majority"), default="hybrid")
    ap.add_argument("--line-share", type=float, default=LINE_SHARE)
    ap.add_argument("--contrast", type=float, default=CONTRAST)
    a = ap.parse_args()
    LINE_SHARE, CONTRAST = a.line_share, a.contrast
    os.makedirs(a.out_dir, exist_ok=True)
    rgb, solid = load(a.source, a.recolor, a.lift_darks, tuple(map(int, a.dark_tint.split(","))), a.enlarge,
                      a.crop, a.clear)
    if a.mirror:
        rgb, solid = rgb[:, ::-1].copy(), solid[:, ::-1].copy()
    if a.pixel_art:
        rgb, solid, scale = unscale_pixel_art(rgb, solid)
        print("pixel art: %dx upscale, %dx%d real pixels" % (scale, solid.shape[1], solid.shape[0]))
    make_sprite(rgb, solid, a.out_dir, a.stage, a.back, a.method, a.zoom, a.colors, a.pixel_art)
    msg = a.out_dir
    if a.icon and not a.back:
        msg += "  (icon palette %d)" % make_icon(rgb, solid, a.out_dir)
    print(msg)


if __name__ == "__main__":
    main()
