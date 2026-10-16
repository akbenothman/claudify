"""Story-wide renames: the orbs, the rival and Dad (see docs/PLOT.md).

The Red Orb and Blue Orb become a STRAWBERRY and a CHEESE (Heesh's favourite foods). The Strawberry
wakes Haleeb, the Cheese wakes Ceaser.
"""
import re

# Orbs -> snacks. Whole words only, longest first, inside quoted text only.
ORB_RENAMES = [
    (r"\bRED ORB\b", "STRAWBERRY"),
    (r"\bBLUE ORB\b", "CHEESE"),
    (r"\bORBS\b", "TREATS"),
    (r"\bORB\b", "TREAT"),
]

ORB_ITEMS = {
    'ITEM_NAME("Red Orb")': 'ITEM_NAME("Strawberry")',
    'ITEM_NAME("Blue Orb")': 'ITEM_NAME("Cheese")',
    '"A red, glowing orb\\n"\n            "said to contain an\\n"\n            "ancient power."':
        '"A giant, glowing\\n"\n            "strawberry that\\n"\n            "wakes HALEEB."',
    '"A blue, glowing orb\\n"\n            "said to contain an\\n"\n            "ancient power."':
        '"A giant, glowing\\n"\n            "wheel of cheese\\n"\n            "that wakes CEASER."',
}


def regex_in_strings(pattern, new, text):
    """Apply a regex replacement only inside "quoted" text on each line."""
    out = []
    for line in text.split("\n"):
        if '"' in line:
            parts = line.split('"')
            parts[1::2] = [re.sub(pattern, new, p) for p in parts[1::2]]
            line = '"'.join(parts)
        out.append(line)
    return "\n".join(out)


def edit_items(t):
    for old, new in ORB_ITEMS.items():
        t = t.replace(old, new)
    return t
