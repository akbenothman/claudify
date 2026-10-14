#!/bin/sh
# Ceaser: converted from the pixel-style AI art (source_front_v3.jpg). Its fake pixels are uneven,
# so it's shrunk normally; the tail is tucked behind his back first so he fits the square, and the
# laurel greens and black tail tuft get their own palette slots.
set -e
D=$(dirname "$0")
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
python3 tools/prep_art.py $D/source_front_v3.jpg $TMP/art.png move:985,40,1375,675:-330,0
python3 tools/convert_sprite.py $TMP/art.png $D --stage 3 --no-icon --zoom 1.25 --colors 15 \
    --add-color 56,128,40 --add-color 128,192,72 --add-color 40,40,40 >/dev/null
