"""Ceaser, hand-built at 64x64 (concept: source_front.jpg). Run: python3 draw.py"""
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "tools"))
from pixelsprite import Sprite  # noqa: E402

s = Sprite({
    "K": (40, 24, 16),
    "1": (112, 48, 16), "2": (160, 80, 32), "3": (200, 120, 48), "4": (232, 168, 80),
    "a": (184, 128, 48), "b": (224, 168, 80), "c": (248, 208, 128),
    "d": (224, 192, 144), "e": (248, 232, 200),
    "t": (48, 48, 64), "u": (96, 96, 112),
    "L": (56, 120, 40), "l": (128, 184, 72),
    "o": (232, 128, 24),
})
BODY = ["a", "b", "c"]
MANE = ["1", "2", "3", "4"]
SAME = {ch: ch for ch in "K1234abcdetuLlo"}

# --- shapes, back to front --------------------------------------------------------------------
# Tail rising behind the back, black flame-shaped tuft
s.shape(s.curve([(50, 48), (58, 41), (61, 30), (57, 21)], [7, 6, 5, 5]), BODY, line="a")
s.shape(s.polygon([(52, 23), (50, 15), (53, 11), (55, 14), (57, 5), (60, 12), (63, 9), (63, 19), (58, 25)]), ["t", "u"], line="K")
# Body lying down, haunch at the back
s.shape(s.ellipse(41, 48, 21, 12), BODY, soft=4)
s.shape(s.ellipse(51, 49, 10, 10), BODY, line="a")
# Mane: big spiky ruff, uneven clumps, reaching down over the chest
pts = []
radii = [21, 16, 20.5, 15.5, 22, 16, 20, 15.5, 21.5, 16, 21, 15, 22, 16.5, 20.5, 15.5, 21.5, 16, 20.5, 15.5]
for i, r in enumerate(radii):
    a = math.radians(i * 360 / len(radii) - 95)
    pts.append((21 + r * math.cos(a) * 0.98, 31 + r * math.sin(a) * 1.05))
s.shape(s.polygon(pts), MANE, soft=5, bands=(0.32, 0.6, 0.86))
# Front legs and big paws
s.shape(s.ellipse(15, 53, 5, 7), BODY, line="a")
s.shape(s.ellipse(28, 54, 5, 7), BODY, line="a")
s.shape(s.ellipse(12, 59, 7, 4), BODY, line="a")
s.shape(s.ellipse(27, 60, 7, 3.5), BODY, line="a")
# Ears peeking out of the mane
s.shape(s.polygon([(8, 21), (8, 12), (15, 17)]), ["2", "3"], line="K")
s.shape(s.polygon([(27, 16), (34, 11), (34, 21)]), ["2", "3"], line="K")
# Laurel crown: big leaves along the top of the mane
for cx, cy, ang in [(9, 15, 60), (13, 11, 40), (18, 9, 15), (24, 8, -10), (29, 10, -35), (34, 13, -55)]:
    s.shape(s.ellipse(cx, cy, 3.8, 1.7, ang), ["L", "l"], line="L", soft=1)

s.outline("K")

# --- by hand ----------------------------------------------------------------------------------
# Fur strands in the mane: short dark streaks pointing outward, light ones on the lit (upper left) side
rnd = random.Random(7)
for _ in range(75):
    a = rnd.uniform(0, 2 * math.pi)
    r0 = rnd.uniform(11.5, 18)
    for t in range(rnd.randint(2, 3)):
        x = round(21 + (r0 + t) * math.cos(a) * 0.98)
        y = round(31 + (r0 + t) * math.sin(a) * 1.05)
        if 0 <= x < 64 and 0 <= y < 64 and s.pix[y, x] in (s.idx["2"], s.idx["3"], s.idx["4"]):
            lit = math.cos(a) + math.sin(a) < -0.6
            s.px(x, y, "4" if lit else "1")
# Bold stripes on the back, toe lines on the paws
for x0, y0 in [(39, 37), (44, 37), (49, 38)]:
    s.grid(x0, y0, ["1.", "11", ".1", ".1"], SAME)
s.grid(8, 60, ["K...K...K"], SAME)
s.grid(24, 61, ["..K...K..."], SAME)

# The face, pixel by pixel: heavy brow, dark-lined amber eyes, forehead stripes, broad muzzle with
# a dark nose pad, whisker dots, firm mouth.
s.grid(11, 20, [
    "......KKKKKKKK......",
    "....KKcccccccccKK...",
    "...KcccbcccccbcccK..",
    "..KccccbccbcccbcccK.",
    "..KbcccccbccbcccccbK",
    ".KbKKKcccccccccKKKbK",
    ".KKooKKccccccKKooKKK",
    ".KbKKbbccccccbbKKbbK",
    ".KbbbbbcccccccbbbbbK",
    ".KbbbbbccddcccbbbbaK",
    "KbbbbbbcddddcbbbbbaK",
    "KbbbdddKKKKKKdddbbaK",
    "KbbdddeKttttKedddbaK",
    "KbdddeeeKttKeeedddaK",
    "KbddeaeaeKKeaeaeddaK",
    "KbddeeeeeKeeeeeeddaK",
    ".KddeeeKKKKKeeeddaK.",
    ".KaddeeeeeeeeeddaK..",
    "..KaaddeeeeeddaaK...",
    "...KKaaddddaaKK.....",
    ".....KKKKKKKK.......",
], SAME)
# Eye glints
s.px(14, 26, "e"); s.px(28, 26, "e")
# Two white flowers on the tail
for fx, fy in [(60, 34), (61, 27)]:
    s.grid(fx - 1, fy - 1, [".e.", "e3e", ".e."], SAME)

s.save(os.path.join(HERE, "front.png"), os.path.join(HERE, "normal.pal"), os.path.join(HERE, "preview.png"))
