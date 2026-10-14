"""Ceaser, hand-built at 64x64 (concept: source_front.jpg). Run: python3 draw.py"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "tools"))
from pixelsprite import Sprite  # noqa: E402

s = Sprite({
    "outline": (40, 24, 8),
    "g0": (160, 104, 40), "g1": (208, 152, 64), "g2": (240, 192, 96), "g3": (248, 224, 152),
    "m0": (112, 56, 24), "m1": (168, 96, 40), "m2": (208, 136, 56),
    "cream": (248, 232, 192),
    "k0": (40, 40, 56), "k1": (88, 88, 104),
    "l0": (48, 112, 40), "l1": (112, 176, 72),
    "eye": (232, 136, 24), "pink": (240, 128, 160),
})
BODY = ["g0", "g1", "g2", "g3"]
MANE = ["m0", "m1", "m2"]

# Tail curling up behind the back, black tuft at the tip
s.shape(s.curve([(50, 48), (58, 41), (60, 30), (56, 20)], [7, 6, 5, 5]), BODY[:3])
s.shape(s.polygon([(51, 22), (49, 15), (52, 9), (55, 13), (58, 6), (61, 13), (60, 20), (56, 23)]), ["k0", "k1"])
# Body lying down, haunch at the back
s.shape(s.ellipse(40, 48, 20, 12), BODY)
s.shape(s.ellipse(50, 50, 10, 9), BODY, line="g1")
# Mane: a big jagged ruff
pts = []
for i in range(22):
    a = math.radians(i * 360 / 22 - 90)
    r = 21 if i % 2 == 0 else 16.5
    pts.append((24 + r * math.cos(a) * 1.02, 30 + r * math.sin(a)))
s.shape(s.polygon(pts), MANE, soft=4)
# Front legs and paws
s.shape(s.ellipse(17, 52, 5, 7), BODY, line="g1")
s.shape(s.ellipse(29, 53, 5, 7), BODY, line="g1")
s.shape(s.ellipse(13, 58, 7, 4), BODY)
s.shape(s.ellipse(27, 59, 7, 4), BODY)
# Ears
s.shape(s.ellipse(12, 19, 3.5, 3.5), BODY[1:])
s.shape(s.ellipse(32, 18, 3.5, 3.5), BODY[1:])
# Head and muzzle
s.shape(s.ellipse(22, 31, 11, 11), BODY, soft=3)
s.shape(s.ellipse(20, 37, 7, 5), ["g2", "cream"], soft=2)
# Laurel crown: leaves across the top of the mane
for cx, cy, ang in [(11, 15, 65), (15, 11, 45), (20, 9, 20), (25, 8, -5), (30, 9, -30), (35, 12, -50)]:
    s.shape(s.ellipse(cx, cy, 3.6, 1.6, ang), ["l0", "l1"], line="l0", soft=1)
# Body stripes
for x in (40, 46, 52):
    s.fill(s.polygon([(x, 37), (x + 2, 37), (x + 1, 44)]), "m0")

s.outline()

# Face details, by hand: forehead stripes, calm half-closed eyes, nose, mouth
s.grid(13, 21, [
    "....m.m.m.....",
    "....m.m.m.....",
    "...m..m..m....",
    "..............",
    "..............",
    "..............",
    "kkkk.....kkkk.",
    "eKes.....eKes.",
    ".kk.......kk..",
], {"k": "outline", "m": "m0", "e": "eye", "K": "outline", "s": "g3"})
s.grid(17, 32, [
    "kkkk",
    ".kk.",
    "..k.",
    "kk.kk",
], {"k": "outline"})
s.px(18, 32, "k1")
# flowers on the tail
for fx, fy in [(57, 31), (58, 24)]:
    s.grid(fx - 1, fy - 1, [".p.", "pcp", ".p."], {"p": "pink", "c": "g3"})

s.save(os.path.join(HERE, "front.png"), os.path.join(HERE, "normal.pal"), os.path.join(HERE, "preview.png"))
