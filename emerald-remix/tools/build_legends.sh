#!/bin/sh
# Rebuild the legendary sprites in graphics/legends/ from their Gemini art.
# These are wide creatures: --crop frames the part that matters, --enlarge gives them a big Gen 3 head.
set -e
cd "$(dirname "$0")/.."
G=graphics/legends
conv() { name=$1; shift; python3 tools/convert_sprite.py $G/$name/source_front.jpg $G/$name --stage 3 "$@"; }
conv snickers --crop=-250,-300,900,740 --enlarge 100,60,480,390:1.6 --contrast 3 --line-share 0.35
conv lion --crop=60,-300,1240,720 --clear 0,560,1408,768:55-110 --enlarge 200,120,590,470:1.6 --zoom 1.15
conv haleeb --crop=330,-300,1150,768 --enlarge 680,50,1050,310:1.35
for d in $G/*/; do
    [ -f $d/touchup_front.txt ] && python3 tools/touchup.py $d/front.png $d/touchup_front.txt $d/normal.pal
    cp $d/normal.pal $d/shiny.pal
done
python3 tools/preview_sheet.py $G/preview_sheet.png $G/snickers,$G/lion,$G/haleeb
