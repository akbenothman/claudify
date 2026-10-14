#!/bin/sh
# Snickers: converted from the pixel-style AI art (source_front_v3.jpg), tail squeezed in so he fits
# the square, head enlarged; red and cream get their own palette slots; the face is redrawn by hand
# (paint_front.txt) because it blurs when shrunk.
set -e
D=$(dirname "$0")
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
python3 tools/recompose.py $D/source_front_v3.jpg $TMP/art.png despeck:2500 squash:960,0,1408,768:0.45 squash:480,0,1408,768:0.75
python3 tools/convert_sprite.py $TMP/art.png $D --stage 3 --no-icon --crop=-300,-300,1408,768 --zoom 1.2 \
    --enlarge 100,60,480,390:1.25 --colors 15 --add-color 232,56,64 --add-color 144,24,40 --add-color 248,184,136 >/dev/null
python3 tools/paint.py $D/front.png $D/paint_front.txt $D/normal.pal
