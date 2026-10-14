#!/bin/sh
# Rebuild the legendary sprites in graphics/legends/. Each one is hand-built pixel art, drawn in
# code: graphics/legends/<name>/draw.py (shapes + hand-placed pixels, see tools/pixelsprite.py),
# using the Gemini art (source_front.jpg) as the concept. This script runs each drawing, then makes
# the menu icon, the 2-frame front sheet, and a placeholder back sprite (the front, mirrored) until
# a real back is drawn.
set -e
cd "$(dirname "$0")/.."
G=graphics/legends
for name in snickers ceaser haleeb; do
    python3 $G/$name/draw.py
    python3 - $G/$name <<'PY'
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, "tools")
import convert_sprite
d = sys.argv[1]
im = Image.open(os.path.join(d, "front.png"))
a = np.asarray(im)
pal = np.asarray(im.getpalette()[:48], np.uint8).reshape(16, 3)
if not os.path.exists(os.path.join(d, "back_drawn")):
    back = Image.fromarray(a[:, ::-1].copy(), "P")
    back.putpalette(im.getpalette())
    back.save(os.path.join(d, "back.png"))
rgb = pal[a].astype(np.float32)
n = convert_sprite.make_icon(rgb, a > 0, d)
print("%s  (icon palette %d)" % (d, n))
PY
    cp $G/$name/normal.pal $G/$name/shiny.pal
    # They replace Kyogre/Groudon/Rayquaza, whose front pics are 2-frame sheets (64x128).
    python3 tools/two_frames.py $G/$name/front.png $G/$name/anim_front.png
done
python3 tools/preview_sheet.py $G/preview_sheet.png $G/snickers,$G/ceaser,$G/haleeb
