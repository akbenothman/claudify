#!/usr/bin/env python3
"""Make a 64x128 two-frame front sheet from a 64x64 sprite: frame 2 is frame 1 nudged up a pixel.

Usage: two_frames.py FRONT.png OUT.png"""
import sys

import numpy as np
from PIL import Image

im = Image.open(sys.argv[1])
a = np.asarray(im)
up = np.zeros_like(a)
up[:-1] = a[1:]
out = Image.fromarray(np.vstack([a, up]), "P")
out.putpalette(im.getpalette())
out.save(sys.argv[2])
