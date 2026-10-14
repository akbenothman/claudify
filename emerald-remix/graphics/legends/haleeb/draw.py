"""Haleeb, hand-built at 64x64 (concept: source_front.jpg). Run: python3 draw.py"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "tools"))
from pixelsprite import Sprite  # noqa: E402

s = Sprite({
    "outline": (40, 48, 80),
    "w0": (160, 168, 208), "w1": (208, 216, 240), "w2": (248, 248, 248),
    "b0": (104, 128, 176), "b1": (152, 176, 216), "b2": (200, 216, 240),
    "o0": (200, 120, 72), "o1": (240, 168, 112), "o2": (248, 216, 168),
    "eye": (56, 144, 224), "glow": (160, 224, 248), "pink": (232, 136, 144),
})
WHITE = ["w0", "w1", "w2"]
WING = ["b0", "b1", "b2"]
POINT = ["o0", "o1", "o2"]

# Wings raised in a V behind her, three layers of feathers each
s.shape(s.polygon([(30, 32), (14, 18), (2, 4), (6, 16), (1, 14), (8, 25), (3, 26), (14, 33), (22, 38)]), WING)
s.shape(s.polygon([(29, 30), (16, 16), (8, 6), (12, 17), (10, 22), (18, 30), (24, 35)]), WING, line="b0")
s.shape(s.polygon([(36, 30), (50, 16), (62, 2), (59, 15), (63, 13), (56, 25), (61, 26), (50, 33), (42, 38)]), WING)
s.shape(s.polygon([(37, 29), (48, 16), (56, 6), (53, 17), (55, 22), (46, 30), (40, 35)]), WING, line="b0")
# Cloud she sits on
for cx, cy, rx, ry in [(14, 57, 9, 6), (27, 59, 10, 5), (41, 58, 11, 6), (53, 56, 9, 6), (33, 54, 9, 5)]:
    s.shape(s.ellipse(cx, cy, rx, ry), WHITE, line="w0")
# Tail around the front of the cloud, cream tip
s.shape(s.curve([(44, 50), (46, 58), (34, 61), (18, 59), (9, 52)], [5, 5, 4, 4, 4]), WHITE)
s.shape(s.ellipse(9, 50, 3, 4, 20), POINT)
# Body, sitting upright
s.shape(s.ellipse(35, 44, 11, 10), WHITE, soft=4)
s.shape(s.ellipse(30, 44, 6, 7), ["w1", "w2"], soft=2, line="w1")  # chest
# Front legs and paws
s.shape(s.ellipse(28, 51, 3, 5), WHITE, line="w0")
s.shape(s.ellipse(36, 52, 3, 5), WHITE, line="w0")
s.shape(s.ellipse(27, 56, 3, 2.2), POINT)
s.shape(s.ellipse(36, 57, 3, 2.2), POINT)
# Ears, head, face mask
s.shape(s.polygon([(17, 18), (15, 6), (25, 12)]), POINT)
s.shape(s.polygon([(32, 12), (40, 5), (41, 18)]), POINT)
s.shape(s.ellipse(28, 21, 12, 10), WHITE, soft=3)
s.shape(s.ellipse(26, 23, 8, 5.5), ["o1", "o2"], soft=2, line="o1", bands=(0.62,))
s.outline()

# Cloud swirl markings on the body
s.grid(36, 38, [
    ".gg.",
    "g..g",
    "g.g.",
    ".g..",
], {"g": "glow"})
s.grid(40, 46, ["gg.", "..g", "gg."], {"g": "glow"})
# Calm, slightly sleepy eyes with a glint, pink nose, small cat mouth
s.grid(19, 19, [
    "kkkkk....kkkkk",
    "keege....egeek",
    ".eee......eee.",
    "..............",
], {"k": "outline", "e": "eye", "g": "glow"})
s.grid(23, 23, [
    "..pp.",
    "k.k.k",
    ".k.k.",
], {"k": "outline", "p": "pink"})
# Ear insides
s.px(18, 12, "pink"); s.px(19, 13, "pink"); s.px(38, 10, "pink"); s.px(38, 11, "pink")
# Halo of mist floating above her head (no outline, it glows)
s.grid(18, 1, [
    "....bbbbbbbbbb....",
    "..bbgggggggggggbb.",
    ".bg............gb.",
    "..bbgggggggggggbb.",
    "....bbbbbbbbbb....",
], {"g": "glow", "b": "b1", "2": "b2"})

s.save(os.path.join(HERE, "front.png"), os.path.join(HERE, "normal.pal"), os.path.join(HERE, "preview.png"))
