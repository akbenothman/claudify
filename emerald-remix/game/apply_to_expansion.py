#!/usr/bin/env python3
"""Apply Emerald Remix's changes to a pokeemerald-expansion checkout.

Usage: apply_to_expansion.py PATH/TO/pokeemerald-expansion [--debug-scripts]

--debug-scripts fills the debug menu's Scripts 1 and 2 (debug builds only, R+START in the
overworld): Script 1 opens the starter choice, Script 2 starts a wild battle with Omarauder.

Safe to run more than once: every edit checks whether it is already there. New content lives in
files under emerald-remix/game/ that get copied in; edits to existing expansion files are kept to
one-line hooks (an #include, an enum entry, a starter swap) so upstream updates stay easy to merge.
"""
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REMIX = os.path.dirname(HERE)
SPECIES = [l.strip() for l in open(os.path.join(HERE, "species_list.txt")) if l.strip()]

# (dex name, the species it sits next to in the weight/height orders)
SIZE_NEIGHBOUR = {
    "squeesh": "RATTATA", "heesh": "RATICATE", "heeshef": "SKUNTANK",
    "beanito": "ZIGZAGOON", "omar": "LINOONE", "omarauder": "OBSTAGOON",
    "guardpup": "SNUBBULL", "ahmed": "GRANBULL", "ahmexec": "MACHAMP",
}
# Alphabetical order: insert each name before the first existing species that sorts after it.
ALPHA_BEFORE = {
    "ahmed": "AIPOM", "ahmexec": "AIPOM", "beanito": "BEARTIC", "guardpup": "GULPIN",
    "heesh": "HERACROSS", "heeshef": "HERACROSS", "omar": "OMASTAR", "omarauder": "OMASTAR",
    "squeesh": "SQUIRTLE",
}
STARTERS = ("SQUEESH", "BEANITO", "GUARDPUP")  # replace Treecko, Torchic, Mudkip in that order


def edit(path, fn):
    p = os.path.join(ROOT, path)
    old = open(p).read()
    new = fn(old)
    if new != old:
        open(p, "w").write(new)
        print("edited", path)


def insert_once(text, anchor, addition, after=True):
    if addition in text:
        return text
    if anchor not in text:
        sys.exit("anchor not found: %r" % anchor)
    i = text.index(anchor) + (len(anchor) if after else 0)
    return text[:i] + addition + text[i:]


def main():
    # 1. Files we own: copy them in.
    for name in SPECIES:
        src = os.path.join(REMIX, "graphics", "starters", name)
        dst = os.path.join(ROOT, "graphics", "pokemon", name)
        os.makedirs(dst, exist_ok=True)
        for f in ("front.png", "back.png", "normal.pal", "shiny.pal", "icon.png"):
            shutil.copy(os.path.join(src, f), os.path.join(dst, f))
    for f, dst in (("custom_families.h", "src/data/pokemon/species_info/custom_families.h"),
                   ("custom_learnsets.h", "src/data/pokemon/custom_learnsets.h"),
                   ("pokemon_custom_gfx.h", "src/data/graphics/pokemon_custom.h")):
        shutil.copy(os.path.join(HERE, f), os.path.join(ROOT, dst))

    # TM/tutor compatibility: the expansion generates teachable lists from all_learnables.json.
    def learnables(t):
        if '"%s":' % SPECIES[0].upper() in t:
            return t
        ours = open(os.path.join(HERE, "custom_learnables.json")).read().strip()
        return "{\n" + ours[2:].rstrip("}").rstrip() + ",\n" + t[2:]
    edit("src/data/pokemon/all_learnables.json", learnables)

    # 2. Species IDs, in the slot the expansion reserves for custom species.
    ids = "".join("    SPECIES_%s,\n" % n.upper() for n in SPECIES)
    edit("include/constants/species.h", lambda t: insert_once(
        t, "    // Add any custom species between here and SPECIES_CUSTOM_END\n", ids))

    # 3. Hook our data files in.
    edit("src/data/pokemon/species_info.h", lambda t: insert_once(
        t, '    #include "species_info/gen_9_families.h"\n',
        '    #include "species_info/custom_families.h" // Emerald Remix\n'))
    edit("src/pokemon.c", lambda t: insert_once(
        insert_once(t, '#include "data/graphics/pokemon.h"\n',
                    '#include "data/graphics/pokemon_custom.h" // Emerald Remix\n'),
        '#include "data/pokemon/egg_moves.h"\n',
        '#include "data/pokemon/custom_learnsets.h" // Emerald Remix\n'))

    # 4. Pokédex: National and Hoenn numbers, and the sort orders.
    nat = "".join("    NATIONAL_DEX_%s,\n" % n.upper() for n in SPECIES)
    hoenn = "".join(" \\\n    F(%s)" % n.upper() for n in SPECIES)
    last = SPECIES[-1].upper()

    def dex(t):
        t = insert_once(t, "    NATIONAL_DEX_PECHARUNT,\n", nat)
        t = t.replace("#define NATIONAL_DEX_COUNT  NATIONAL_DEX_PECHARUNT",
                      "#define NATIONAL_DEX_COUNT  NATIONAL_DEX_%s" % last)
        # The Hoenn dex is an X-macro list ending in F(DEOXYS); append ours after it.
        t = insert_once(t, "    F(DEOXYS)", hoenn)
        t = t.replace("#define HOENN_DEX_COUNT (HOENN_DEX_DEOXYS + 1)",
                      "#define HOENN_DEX_COUNT (HOENN_DEX_%s + 1)" % last)
        return t
    edit("include/constants/pokedex.h", dex)

    def orders(t):
        a, rest = t.split("const u16 gPokedexOrder_Weight[]", 1)
        w, h = rest.split("const u16 gPokedexOrder_Height[]", 1)
        for n in SPECIES:
            entry = "    NATIONAL_DEX_%s,\n" % n.upper()
            a = insert_once(a, "    NATIONAL_DEX_%s,\n" % ALPHA_BEFORE[n], entry, after=False)
            w = insert_once(w, "    NATIONAL_DEX_%s,\n" % SIZE_NEIGHBOUR[n], entry)
            h = insert_once(h, "    NATIONAL_DEX_%s,\n" % SIZE_NEIGHBOUR[n], entry)
        return a + "const u16 gPokedexOrder_Weight[]" + w + "const u16 gPokedexOrder_Height[]" + h
    edit("src/data/pokemon/pokedex_orders.h", orders)

    # 5. Signature moves, in the slot the expansion reserves for custom moves.
    def move_ids(t):
        t = insert_once(t, "    // Add any custom moves here, not further down!\n",
                        "    MOVE_TOXIC_FONDUE = MOVES_COUNT_GEN9,\n    MOVE_STICKY_FINGERS,\n"
                        "    MOVE_LOCKDOWN,\n    MOVES_COUNT_REMIX,\n")
        return t.replace("    MOVES_COUNT = MOVES_COUNT_GEN9,", "    MOVES_COUNT = MOVES_COUNT_REMIX,")
    edit("include/constants/moves.h", move_ids)
    moves = open(os.path.join(HERE, "custom_moves.h")).read()

    def move_info(t):
        if "[MOVE_TOXIC_FONDUE]" in t:
            return t
        end = t.rindex("\n};")
        return t[:end] + "\n" + moves.rstrip("\n") + t[end:]
    edit("src/data/moves_info.h", move_info)

    # 6. The starters Birch offers.
    def starters(t):
        for old, new in zip(("SPECIES_TREECKO)", "SPECIES_TORCHIC)", "SPECIES_MUDKIP )"),
                            STARTERS):
            t = t.replace(": " + old, ": SPECIES_%s)" % new)
        return t
    edit("src/starter_choose.c", starters)

    if DEBUG_SCRIPTS:
        def debug_scripts(t):
            t = t.replace("Debug_EventScript_Script_1::\n\trelease\n\tend\n",
                          "Debug_EventScript_Script_1::\n\tspecial ChooseStarter\n"
                          "\trelease\n\tend\n")
            return t.replace("Debug_EventScript_Script_2::\n\trelease\n\tend\n",
                             "Debug_EventScript_Script_2::\n\tsetwildbattle SPECIES_OMARAUDER, 20\n"
                             "\tdowildbattle\n\trelease\n\tend\n")
        edit("data/scripts/debug.inc", debug_scripts)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--debug-scripts"]
    if len(args) != 1:
        sys.exit(__doc__)
    ROOT = args[0]
    DEBUG_SCRIPTS = "--debug-scripts" in sys.argv
    main()
