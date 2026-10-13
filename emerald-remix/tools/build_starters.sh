#!/bin/sh
# Rebuild every starter sprite from its Gemini source, then re-apply the hand touch-ups.
set -e
cd "$(dirname "$0")/.."
S=graphics/starters
for spec in squeesh:1 heesh:2 heeshef:3 beanito:1 omar:2 omarauder:3 guardpup:1 ahmed:2 ahmexec:3; do
    name=${spec%:*}; stage=${spec#*:}
    extra=""
    case $name in
        ahmexec) extra="--recolor 180-260:28:0.55" ;;  # match Ahmed's tan/brown fur
        omar|omarauder) extra="--lift-darks 0.7 --dark-tint 0,4,18" ;;  # readable blue-black instead of a black blob
    esac
    python3 tools/convert_sprite.py "$S/$name/source_front.jpg" "$S/$name" --stage "$stage" $extra
    if [ -f "$S/$name/touchup_front.txt" ]; then
        python3 tools/touchup.py "$S/$name/front.png" "$S/$name/touchup_front.txt" "$S/$name/normal.pal"
        cp "$S/$name/normal.pal" "$S/$name/shiny.pal"
    fi
done
python3 tools/preview_sheet.py $S/preview_sheet.png \
    $S/squeesh,$S/heesh,$S/heeshef $S/beanito,$S/omar,$S/omarauder $S/guardpup,$S/ahmed,$S/ahmexec
