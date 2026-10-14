#!/bin/sh
# Ceaser: converted from the cleaner AI art (source_front_v2.jpg), tail tucked behind his back,
# laurel greens and the black tail tuft given their own palette slots, eyes sharpened by hand.
set -e
D=$(dirname "$0")
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
python3 tools/prep_art.py $D/source_front_v2.jpg $TMP/art.png move:725,20,1015,500:-250,0
python3 tools/convert_sprite.py $TMP/art.png $D --stage 3 --no-icon --zoom 1.2 --colors 15 \
    --add-color 56,128,40 --add-color 128,192,72 --add-color 56,56,64 >/dev/null
python3 tools/paint.py $D/front.png $D/paint_front.txt $D/normal.pal
