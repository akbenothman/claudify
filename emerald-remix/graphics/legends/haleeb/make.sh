#!/bin/sh
# Haleeb: converted from the pixel-style AI art (source_front_v3.jpg), wings pulled in so she fits
# the square; the blue swirls and cream-orange points get their own palette slots.
set -e
D=$(dirname "$0")
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
python3 tools/recompose.py $D/source_front_v3.jpg $TMP/art.png move:1035,0,1408,378:-180,30 \
    move:470,0,690,352:330,30 move:0,0,470,378:330,30 erase:0,380,300,768 erase:1180,380,1408,768 despeck:800
python3 tools/convert_sprite.py $TMP/art.png $D --stage 3 --no-icon --crop=-300,-300,1300,768 --zoom 1.25 \
    --enlarge 760,40,1030,300:1.0 --colors 15 --add-color 48,120,216 --add-color 232,136,48 >/dev/null
