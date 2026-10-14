"""Haleeb, hand-built at 64x64 (concept: source_front.jpg). Run: python3 draw.py"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "tools"))
from pixelsprite import Sprite  # noqa: E402

s = Sprite({
    "K": (40, 48, 88),
    "v": (176, 184, 216), "w": (224, 228, 244), "W": (248, 248, 248),
    "x": (104, 128, 176), "y": (152, 176, 216), "z": (200, 216, 240),
    "n": (208, 120, 72), "o": (240, 168, 112), "p": (248, 216, 168),
    "E": (48, 128, 216), "g": (160, 224, 248), "r": (232, 136, 144),
})
WHITE = ["v", "w", "W"]
WING = ["x", "y", "z"]
SAME = {ch: ch for ch in "KvwWxyznopEgr"}


def wing(root, angles, lengths, width, flip):
    """A wing: a fan of long feathers from the shoulder, drawn outer (primaries) to inner."""
    rx, ry = root
    for ang, ln in zip(angles, lengths):
        a = math.radians(ang)
        dx, dy = math.cos(a) * (-1 if flip else 1), -math.sin(a)
        tip = (rx + dx * ln, ry + dy * ln)
        mid = (rx + dx * ln * 0.55, ry + dy * ln * 0.55)
        s.shape(s.curve([root, mid, tip], [width, width, 2]), WING, line="x", soft=1)


# Wings raised in a V behind her: long primaries, then shorter rows over them
for flip, root in ((True, (27, 33)), (False, (37, 33))):
    wing(root, [62, 52, 42, 32, 22], [30, 30, 28, 25, 21], 6, flip)
    wing(root, [58, 46, 34, 24], [21, 21, 19, 16], 6, flip)
    wing(root, [52, 38, 26], [13, 12, 11], 7, flip)
# Cloud she sits on
for cx, cy, rx, ry in [(13, 57, 9, 6), (26, 59, 10, 5), (40, 59, 11, 5), (52, 56, 9, 6), (32, 55, 9, 4)]:
    s.shape(s.ellipse(cx, cy, rx, ry), ["y", "z", "W"], line="y")
# Tail curling round the front of the cloud, cream tip
s.shape(s.curve([(42, 51), (46, 58), (34, 61), (19, 59), (10, 53)], [5, 5, 4, 4, 4]), WHITE, line="v")
s.shape(s.ellipse(9, 51, 3, 4, 20), ["n", "o", "p"])
# Body, sitting upright and slim; fluffy chest
s.shape(s.ellipse(40, 49, 9, 8), WHITE, soft=3)   # haunch
s.shape(s.ellipse(31, 42, 9, 9), WHITE, soft=3, line="v")   # chest
s.shape(s.polygon([(24, 38), (35, 37), (37, 44), (34, 49), (31, 46), (29, 50), (26, 46), (23, 49), (23, 43)]), ["w", "W"], line="v")
# Front legs and cream paws
s.shape(s.ellipse(29, 52, 2.5, 5), WHITE, line="v")
s.shape(s.ellipse(36, 53, 2.5, 5), WHITE, line="v")
s.shape(s.ellipse(29, 57, 3, 2), ["n", "o", "p"])
s.shape(s.ellipse(36, 58, 3, 2), ["n", "o", "p"])

# Neck and shoulders joining the head to the body
s.shape(s.ellipse(31, 33, 7, 5), WHITE, line="v")
s.outline("K")
# Head and face, pixel by pixel: Siamese mask, sleepy blue eyes with a glint, pink nose, small smile
FACE = [
    "...K..............K...",
    "..KnK............KnK..",
    "..KonK..........KnoK..",
    ".KoopnK........KnpooK.",
    ".KooppnKKKKKKKKnppooK.",
    ".KoowwwwWWWWWWwwwwooK.",
    "KvwwwwwwWWWWWWwwwwwwvK",
    "KvwwpppwwwWWwwwpppwwvK",
    "KvwpoooopwwwwpoooopwvK",
    "KvpoKKKKKopoKKKKKopwvK",
    "KvpKEEEgKoooKEEEgKpwvK",
    "KvpoKEEKoooooKEEKopwvK",
    "KvwpooooooooooooopwwvK",
    ".KvwpoooorroooooopwvK.",
    ".KvwwpoooKKooooopwwvK.",
    "..KvwwpoKooKoppwwwvK..",
    "...KvvwwppppppwwvvK...",
    ".....KKvvwwwwvvKK.....",
    ".......KKKKKKKK.......",
]
s.grid(20, 11, FACE, SAME)
# Swirl markings on the body
s.grid(41, 45, [".gg.", "g..g", "g.g.", ".g.."], SAME)
# Halo of mist above her head
s.grid(22, 3, [
    "...xxxxxxxxxxx...",
    ".xxgggggggggggxx.",
    "xg.............gx",
    ".xxgggggggggggxx.",
    "...xxxxxxxxxxx...",
], SAME)

s.save(os.path.join(HERE, "front.png"), os.path.join(HERE, "normal.pal"), os.path.join(HERE, "preview.png"))
