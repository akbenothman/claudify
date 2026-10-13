#!/usr/bin/env python3
"""Check that dialogue lines fit in Emerald's text box, using the game's real font widths.

Usage: text_width.py EXPANSION_DIR FILE.inc [FILE.inc ...]

Measures every line of every .string in pixels with the normal font. Placeholders are measured at
their longest realistic size ({PLAYER} and {RIVAL}: 7 wide letters, {STR_VAR_n}: a 10-letter name).
Prints lines over the limit and exits non-zero if there are any.
"""
import re
import sys

LIMIT = 208  # pixels; the widest lines in the original game's dialogue are about this wide
PLACEHOLDER_WIDTH = {"PLAYER": 7 * 6, "RIVAL": 7 * 6, "STR_VAR_1": 10 * 6, "STR_VAR_2": 10 * 6,
                     "STR_VAR_3": 10 * 6, "KUN": 0}


def load_font(root):
    widths = re.search(r"gFontNormalLatinGlyphWidths\[\] = \{(.*?)\};",
                       open(root + "/src/fonts.c").read(), re.S).group(1)
    widths = [int(w) for w in re.findall(r"\d+", widths)]
    chars = {}
    for line in open(root + "/charmap.txt", encoding="utf-8"):
        m = re.match(r"'(.|\\')'\s*=\s*([0-9A-F]{2})\s*$", line)
        if m:
            ch = m.group(1).replace("\\'", "'")
            chars.setdefault(ch, int(m.group(2), 16))
    return lambda ch: widths[chars[ch]] if ch in chars and chars[ch] < len(widths) else 6


def lines_of(path):
    text = ""
    for line in open(path, encoding="utf-8"):
        m = re.match(r'\s*\.string "(.*)"\s*$', line)
        if m:
            text += m.group(1)
        elif text:
            yield text
            text = ""
    if text:
        yield text


def width(line, glyph):
    total = 0
    for token in re.findall(r"\{([A-Z_0-9]+)\}|(.)", line):
        name, ch = token
        total += PLACEHOLDER_WIDTH.get(name, 0) if name else glyph(ch)
    return total


def main():
    root, files = sys.argv[1], sys.argv[2:]
    glyph = load_font(root)
    bad = 0
    for path in files:
        for text in lines_of(path):
            for line in re.split(r"\\[npl]|\$", text):
                w = width(line, glyph)
                if w > LIMIT:
                    bad += 1
                    print("%s: %dpx > %dpx: %s" % (path, w, LIMIT, line))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
