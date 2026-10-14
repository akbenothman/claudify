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
        omar) extra="--lift-darks 0.7 --dark-tint 0,4,18" ;;  # readable blue-black instead of a black blob
        # Just enough lift to show the hood patches; head enlarged so the original face survives
        omarauder) extra="--lift-darks 0.85 --enlarge 640,170,945,350:1.5" ;;
    esac
    # Bigger Pokémon get bigger sprites: middle stages fill the frame, final forms are drawn a bit
    # larger than it and lose some of their feet at the bottom edge, for more detail.
    case $stage in 1) zoom=1.0 ;; 2) zoom=1.1 ;; 3) zoom=1.15 ;; esac
    python3 tools/convert_sprite.py "$S/$name/source_front.jpg" "$S/$name" --stage "$stage" --zoom $zoom $extra
    if [ -f "$S/$name/touchup_front.txt" ]; then
        python3 tools/touchup.py "$S/$name/front.png" "$S/$name/touchup_front.txt" "$S/$name/normal.pal"
        cp "$S/$name/normal.pal" "$S/$name/shiny.pal"
    fi
    # Back sprite: drawn with the finished front palette. Same color fixes as the front, but not the
    # head enlargement (its coordinates are for the front image).
    if [ -f "$S/$name/source_back.jpg" ]; then
        back_extra=$(echo "$extra" | sed 's/--enlarge [^ ]*//')
        # Back sprites are zoomed 1.3x: the bottom is cut off, but the battle textbox hides it anyway.
        back_zoom=1.3
        case $name in
            beanito|omarauder) back_extra="$back_extra --mirror" ;;  # face right, toward the opponent
            # his back art's jersey is blue; match the front's orange. Less zoom keeps his ladle in frame.
            heeshef) back_extra="$back_extra --recolor 195-260:24"; back_zoom=1.2 ;;
        esac
        python3 tools/convert_sprite.py "$S/$name/source_back.jpg" "$S/$name" --stage "$stage" --back --zoom $back_zoom $back_extra
    fi
done
python3 tools/preview_sheet.py $S/preview_sheet.png \
    $S/squeesh,$S/heesh,$S/heeshef $S/beanito,$S/omar,$S/omarauder $S/guardpup,$S/ahmed,$S/ahmexec
