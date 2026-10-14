#!/bin/sh
# Rebuild the legendary sprites in graphics/legends/ from their Gemini art.
# Needs OpenCV for the texture clean-up: pip install opencv-python-headless
#
# Each one goes through four steps:
#   1. tools/recompose.py  rearranges the wide concept art into a square pose (tail tucked, wings in)
#                          and flattens fur texture into clean areas of color
#   2. convert_sprite.py   shrinks it to 64x64 with a big Gen 3 head and few colors (clean shading)
#   3. tools/paint.py      hand-drawn face, crown, halo etc. from paint_front.txt
#   4. a placeholder back sprite (the front, mirrored) until real back art exists
set -e
cd "$(dirname "$0")/.."
G=graphics/legends
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

build() {
    name=$1; recompose=$2; shift 2
    python3 tools/recompose.py $G/$name/source_front.jpg $TMP/$name.png $recompose
    python3 tools/convert_sprite.py $TMP/$name.png $G/$name --stage 3 "$@"
    python3 tools/paint.py $G/$name/front.png $G/$name/paint_front.txt $G/$name/normal.pal
    python3 tools/convert_sprite.py $TMP/$name.png $G/$name --stage 3 --back --mirror "$@" >/dev/null
    cp $G/$name/normal.pal $G/$name/shiny.pal
    # They replace Kyogre/Groudon/Rayquaza, whose front pics are 2-frame sheets (64x128).
    python3 tools/two_frames.py $G/$name/front.png $G/$name/anim_front.png
}

build ceaser "erase:0,540,1408,768:50-150 erase:0,705,1408,768 erase:0,420,150,620 move:990,40,1360,640:-300,0 erase:1080,0,1408,768 delines:7 flatten:10,24" \
    --crop=-300,-300,1250,710 --enlarge 200,120,590,470:1.5 --zoom 1.1 --colors 9
build haleeb "move:1035,0,1408,378:-180,30 move:470,0,690,352:330,30 move:0,0,470,378:330,30 erase:0,380,300,768 erase:1180,380,1408,768 flatten:6,16" \
    --crop=-300,-300,1300,768 --enlarge 760,150,930,300:1.3 --zoom 1.1 --colors 12
build snickers "despeck:2500 squash:960,0,1408,768:0.45 squash:480,0,1408,768:0.75 flatten:6,16" \
    --crop=-300,-300,1408,768 --enlarge 100,60,480,390:1.7 --colors 12

python3 tools/preview_sheet.py $G/preview_sheet.png $G/snickers,$G/ceaser,$G/haleeb
