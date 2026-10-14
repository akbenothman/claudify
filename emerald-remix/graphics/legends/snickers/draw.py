"""Snickers, hand-built at 64x64 (concept: source_front.jpg). Run: python3 draw.py"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "tools"))
from pixelsprite import Sprite  # noqa: E402

s = Sprite({
    "outline": (32, 16, 40),
    "f0": (112, 104, 152), "f1": (168, 168, 208), "f2": (216, 216, 240), "f3": (248, 248, 248),
    "c0": (200, 96, 56), "c1": (240, 160, 104), "c2": (248, 208, 160),
    "r0": (144, 16, 40), "r1": (232, 48, 48), "y": (248, 216, 96),
})
FUR = ["f0", "f1", "f2", "f3"]
FACE = ["c0", "c1", "c2"]
CONTRAST = (0.34, 0.5, 0.64)


def spikes(cx, cy, r_out, r_in, n, squash=1.0, turn=0):
    pts = []
    for i in range(2 * n):
        a = math.radians(i * 180 / n + turn)
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a) * squash))
    return pts


# Tail rising on the right, ending in a big fluffy plume
s.shape(s.curve([(46, 44), (53, 34), (57, 24), (56, 14), (51, 7), (44, 5)], [11, 10, 10, 9, 6, 3]), FUR, bands=CONTRAST)
# The long coiled body: down from the neck, along the bottom, up into the tail
s.shape(s.curve([(24, 30), (17, 44), (24, 56), (40, 57), (49, 46)], [13, 15, 14, 13, 12]),
        FUR, soft=3, bands=CONTRAST)
# Fur tufts along the back of the coil
for x, y, a in [(9, 42, 200), (56, 45, 330), (60, 30, 345), (61, 18, 0), (56, 8, 315), (48, 3, 280)]:
    r = math.radians(a)
    tip = (x + 5 * math.cos(r), y + 5 * math.sin(r))
    s.shape(s.polygon([(x - 3 * math.sin(r), y + 3 * math.cos(r)), tip,
                       (x + 3 * math.sin(r), y - 3 * math.cos(r))]), FUR[:3], line="f1")
# Back arm
s.shape(s.curve([(32, 50), (28, 56), (26, 59)], [6, 5, 5]), FUR, bands=CONTRAST)
# Neck ruff behind the head: a spiky collar, a shade darker so it reads
s.shape(s.polygon(spikes(21, 27, 16, 11, 9, 0.85, 10)), ["f0", "f1", "f2"], soft=4)
# Head and face mask
s.shape(s.ellipse(15, 17, 12, 11), FUR, soft=3, bands=CONTRAST)
s.shape(s.polygon([(14, 27), (19, 25), (26, 24), (30, 22), (29, 27), (32, 29), (26, 30), (27, 33), (21, 31), (16, 33)]), FUR[1:], line="f1")
# Front arm reaching forward, in front of everything
s.shape(s.curve([(22, 38), (13, 46), (8, 51)], [8, 7, 6]), FUR, bands=CONTRAST)
s.shape(s.ellipse(7, 53, 5, 3.5), FUR, bands=CONTRAST)
s.shape(s.ellipse(27, 59, 4.5, 3), FUR, bands=CONTRAST)

s.outline()

# Big red claws, curving down from the paws
s.grid(1, 55, [
    ".rr.rr.rr.",
    "rRR.rR.rR.",
    "RRk.Rk.Rk.",
    "Rk..k..k..",
    "k.........",
], {"r": "r1", "R": "r0", "k": "outline"})
s.grid(22, 61, [
    ".rr.rr.rr",
    "rRk.Rk.Rk",
    "Rk..k..k.",
], {"r": "r1", "R": "r0", "k": "outline"})
# The head, pixel by pixel: big ears with red insides, cream-orange mask with red stripes, brows
# slanting down to the middle over glowing red eyes, snout to the left, open snarl with two fangs
L = {"K": "outline", "p": "c2", "o": "c1", "n": "c0", "r": "r1", "R": "r0", "y": "y", "W": "f3", "g": "f2"}
HEAD = [
    "...K...................K......",
    "..KoK.................KoK.....",
    "..KRoK...............KoRK.....",
    "..KRRoK.............KoRRK.....",
    "..KRRooK...........KooRRK.....",
    "..KRRoooKKKKKKKKKKKoooRRK.....",
    "..KRooopppppppppppppooRRK.....",
    "..KoooppprpppprpppprppooK.....",
    ".KoooppprpppprpppprpppooK.....",
    ".KoooppppppppppppppppppoonK...",
    ".KKKoppppppppppppppppKKKonK...",
    ".KooKKKppppppppppppKKKoooonK..",
    ".KoKyrrKKppppppppKKrryKoonK...",
    ".KoKRRrrKppppppppKrrRRKoonK...",
    ".KooKKKKoppppppppoKKKKooonK...",
    ".KoooooooppppppppooooooonK....",
    "KKooooooppppppppppoooooonK....",
    "KKKoooopppppppppppooooonK.....",
    "KKKKooopppppppppppoooonK......",
    ".KWWKKKKKKKKKKKKKpoonnK.......",
    ".KWRRRRRRRRRRRRWKoonK.........",
    "..KWRRRRRRRRRRWKonnK..........",
    "...KKRRRRRRRRKKnnK............",
    ".....KKKKKKKKKKK..............",
]
s.grid(0, 1, HEAD, L)
# Red lightning down the body
s.grid(15, 40, ["r..", ".r.", "rr.", ".r.", "..r"], {"r": "r1"})
s.grid(34, 50, ["rr.r", ".rr.", "...r"], {"r": "r1"})
s.grid(50, 26, ["r.", ".r", "rr", ".r"], {"r": "r1"})

s.save(os.path.join(HERE, "front.png"), os.path.join(HERE, "normal.pal"), os.path.join(HERE, "preview.png"))
