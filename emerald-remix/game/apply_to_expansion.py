#!/usr/bin/env python3
"""Apply Emerald Remix's changes to a pokeemerald-expansion checkout.

Usage: apply_to_expansion.py PATH/TO/pokeemerald-expansion [--debug-scripts]

--debug-scripts fills the debug menu's Scripts 1-8 (debug builds only, R+START in the overworld):
1 the starter choice; 2 a wild Omarauder; 3 Hamza's Route 103 battle for your starter; 4 a level-70
Mewtwo and Hamada's Mt. Chimney battle; 5 the three final forms at level 50 and a wild
battle; 6 the three legendary cats at level 70 and a wild Haleeb; 7 a warp into the Safety Zone
office in Mauville; 8 Mom's speech and the ending at Mt. Pyre.

Safe to run more than once: every edit checks whether it is already there. New content lives in
files under emerald-remix/game/ that get copied in; edits to existing expansion files are kept to
one-line hooks (an #include, an enum entry, a starter swap) so upstream updates stay easy to merge.
"""
import os
import re
import shutil
import sys

import g_moves
import legends
import story
import villains

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


def apply_text_overrides(path):
    """Replace labelled text blocks in game files with the ones in a game/text/*.inc file.

    Several labels in a row share the text that follows them (the May and Brendan versions of a scene).
    """
    target = None
    blocks = {}
    for line in open(path, encoding="utf-8"):
        if line.startswith("@@ file:"):
            target = line.split(":", 1)[1].strip()
            continue
        if line.startswith("@") or not line.strip():
            continue
        if not line.startswith(("\t", " ")):
            items = blocks.setdefault(target, [])
            if items and not items[-1][1]:  # another label for the same text
                items[-1][0].append(line.strip())
            else:
                items.append([[line.strip()], ""])
        else:
            blocks[target][-1][1] += line
    for target, items in blocks.items():
        def replace(t, items=items):
            for labels, body in items:
                for label in labels:
                    start = 0 if t.startswith(label + "\n") else t.index("\n" + label + "\n") + 1
                    end = t.index('$"\n', start) + 3
                    t = t[:start] + label + "\n" + body + t[end:]
            return t
        edit(target, replace)


def rename_in_strings(old, new, files):
    """Rename text only inside "quoted" text, never in labels or code."""
    for path in files:
        def fix(t):
            out = []
            for line in t.split("\n"):
                if old in line and '"' in line:
                    parts = line.split('"')
                    parts[1::2] = [p.replace(old, new) for p in parts[1::2]]
                    line = '"'.join(parts)
                out.append(line)
            return "\n".join(out)
        edit(path, fix)


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
    for f in os.listdir(os.path.join(HERE, "tests")):  # run with: make check TESTS="Remix"
        shutil.copy(os.path.join(HERE, "tests", f), os.path.join(ROOT, "test", f))

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
    vanilla_starters = ("TREECKO", "GROVYLE", "SCEPTILE", "TORCHIC", "COMBUSKEN", "BLAZIKEN",
                        "MUDKIP", "MARSHTOMP", "SWAMPERT")
    last = SPECIES[-1].upper()

    def dex(t):
        t = insert_once(t, "    NATIONAL_DEX_PECHARUNT,\n", nat)
        t = t.replace("#define NATIONAL_DEX_COUNT  NATIONAL_DEX_PECHARUNT",
                      "#define NATIONAL_DEX_COUNT  NATIONAL_DEX_%s" % last)
        # Our starters take Hoenn #001-009 from Treecko..Swampert, like the originals did. The old
        # starters can't be obtained any more, so leaving them in the Hoenn dex would make the
        # dex diploma impossible.
        old = "".join("    F(%s) \\\n" % n for n in vanilla_starters)
        new = "".join("    F(%s) \\\n" % n.upper() for n in SPECIES)
        return t.replace("#define FOREACH_SPECIES_IN_HOENN_DEX_ORDER(F) \\\n" + old,
                         "#define FOREACH_SPECIES_IN_HOENN_DEX_ORDER(F) \\\n" + new)
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

    # 5. Signature moves, in the slot the expansion reserves for custom moves. Every [MOVE_X] in
    # game/custom_moves.h gets an ID, in file order.
    moves = open(os.path.join(HERE, "custom_moves.h")).read()
    names = re.findall(r"^    \[(MOVE_[A-Z0-9_]+)\] =", moves, re.M)
    block = "    %s = MOVES_COUNT_GEN9,\n" % names[0] + "".join("    %s,\n" % n for n in names[1:]) \
        + "    MOVES_COUNT_REMIX,\n"

    def move_ids(t):
        anchor = "    // Add any custom moves here, not further down!\n"
        if "    MOVES_COUNT_REMIX,\n" in t:  # replace what an earlier run added
            start = t.index(anchor) + len(anchor)
            t = t[:start] + t[t.index("    MOVES_COUNT_REMIX,\n", start) + len("    MOVES_COUNT_REMIX,\n"):]
        t = insert_once(t, anchor, block)
        return t.replace("    MOVES_COUNT = MOVES_COUNT_GEN9,", "    MOVES_COUNT = MOVES_COUNT_REMIX,")
    edit("include/constants/moves.h", move_ids)

    def move_info(t):
        begin = "    // Emerald Remix signature moves (see"
        if begin in t:  # replace what an earlier run appended
            t = t[:t.index(begin)].rstrip("\n") + t[t.rindex("\n};"):]
        end = t.rindex("\n};")
        g = open(os.path.join(HERE, "g_moves.h")).read()
        return t[:end] + "\n" + moves.rstrip("\n") + "\n\n" + g.rstrip("\n") + t[end:]
    edit("src/data/moves_info.h", move_info)

    # 5b. G-Moves: the Z-Moves renamed, with a signature one per new line (game/g_moves.py).
    edit("include/constants/moves.h", g_moves.edit_move_ids)
    edit("src/battle_z_move.c", g_moves.edit_signature_table)
    edit("include/constants/items.h", g_moves.edit_item_ids)
    edit("src/data/items.h", g_moves.edit_items)

    # The Sheer Force test hard-codes every move Sheer Force should boost; ours with secondary effects
    # (a burn chance, can't-escape, a Defense drop, paralysis) belong on it, like Lava Plume.
    for name in ("MOVE_TOXIC_FONDUE", "MOVE_LOCKDOWN", "MOVE_ROYAL_POUNCE", "MOVE_STORM_CLAW"):
        edit("test/battle/ability/sheer_force.c", lambda t, name=name: insert_once(
            t, "static inline bool32 IsMoveSheerForceBoosted(enum Move move)\n{\n    switch (move) {\n",
            "        case %s: // Emerald Remix\n" % name))

    # 6. The starters Birch offers.
    def starters(t):
        for old, new in zip(("SPECIES_TREECKO)", "SPECIES_TORCHIC)", "SPECIES_MUDKIP )"),
                            STARTERS):
            t = t.replace(": " + old, ": SPECIES_%s)" % new)
        return t
    edit("src/starter_choose.c", starters)

    # 7. The rival gets the starter that beats yours, like in the original. Our type triangle runs
    # the same way round as Grass/Fire/Water, so it's a straight swap, stage for stage.
    swap = {"Treecko": "Squeesh", "Grovyle": "Heesh", "Sceptile": "Heeshef",
            "Torchic": "Beanito", "Combusken": "Omar", "Blaziken": "Omarauder",
            "Mudkip": "Guardpup", "Marshtomp": "Ahmed", "Swampert": "Ahmexec"}

    def rival(t):
        blocks = t.split("\n=== ")
        for i, b in enumerate(blocks):
            if b.startswith(("TRAINER_MAY_", "TRAINER_BRENDAN_")):
                blocks[i] = "\n".join(swap.get(l, l) for l in b.split("\n"))
        return "\n=== ".join(blocks)
    edit("src/data/trainers.party", rival)

    # 8. The Petalburg Pokémon Center NPC who explains your starter's type.
    texts = open(os.path.join(HERE, "petalburg_type_text.inc")).read()

    def petalburg(t):
        for label in ("TreeckoIsGrassType", "TorchicIsFireType", "MudkipIsWaterType"):
            head = "PetalburgCity_PokemonCenter_1F_Text_%s:\n" % label
            start, new_start = t.index(head), texts.index(head)
            end = t.index('$"\n', start) + 3
            new_end = texts.index('$"\n', new_start) + 3
            t = t[:start] + texts[new_start:new_end] + t[end:]
        return t
    edit("data/maps/PetalburgCity_PokemonCenter_1F/scripts.inc", petalburg)

    # 9. Characters. Rewritten scenes live in game/text/*.inc; names are renamed everywhere they're shown.
    for f in sorted(os.listdir(os.path.join(HERE, "text"))):
        apply_text_overrides(os.path.join(HERE, "text", f))
    text_files = [os.path.relpath(os.path.join(d, f), ROOT)
                  for d, _, fs in os.walk(os.path.join(ROOT, "data")) for f in fs if f.endswith(".inc")]
    text_files += ["src/strings.c", "src/pokenav_match_call_data.c", "src/battle_message.c",
                   "src/field_screen_effect.c"]
    rename_in_strings("PROF. BIRCH", "PROF. MO", text_files)
    rename_in_strings("My name is BIRCH", "My name is MO", ["data/text/birch_speech.inc"])
    # Professor Mo shows off his Omar in the intro instead of Lotad.
    edit("src/main_menu.c", lambda t: t.replace("SPECIES_LOTAD", "SPECIES_OMAR"))

    # 9b. The legendary cats take over Kyogre, Groudon and Rayquaza (game/legends.py).
    legends.copy_graphics(REMIX, ROOT, shutil.copy)
    edit("src/data/pokemon/species_info/gen_3_families.h", legends.edit_species)
    edit("src/data/pokemon/all_learnables.json", legends.edit_learnables)
    # The expansion's own battle tests expect the old names in battle messages.
    test_files = [os.path.relpath(os.path.join(d, f), ROOT)
                  for d, _, fs in os.walk(os.path.join(ROOT, "test")) for f in fs if f.endswith(".c")]
    for old, new in legends.RENAMES:
        rename_in_strings(old, new, text_files + test_files + ["src/data/battle_environment.h"])
    # One test sends Kyogre out onto Toxic Spikes and Sticky Web. Haleeb is Flying, so it floats over both.
    def primal_test(t):
        start = t.index('"Primal Reversion and other switch-in effects trigger for all battlers if multiple fainted')
        end = t.index("\n}\n", start)
        body = t[start:end].replace(
            "        EXPECT_EQ(opponentLeft->status1, STATUS1_POISON);\n",
            "        EXPECT_EQ(opponentLeft->status1, 0); // Emerald Remix: Haleeb (Kyogre) is Flying, so it floats over hazards\n").replace(
            "        EXPECT_EQ(opponentLeft->statStages[STAT_SPEED], DEFAULT_STAT_STAGE - 1);\n",
            "        EXPECT_EQ(opponentLeft->statStages[STAT_SPEED], DEFAULT_STAT_STAGE); // Emerald Remix: same\n")
        return t[:start] + body + t[end:]
    edit("test/battle/form_change/primal_reversion.c", primal_test)

    # 9c. The villains: Ahmed's Safety Zone and Omar's Team Beanie (game/villains.py).
    edit("src/data/trainers.party", villains.edit_parties)
    edit("src/battle_main.c", villains.edit_class_names)
    for old, new in villains.RENAMES + villains.LINE_FIXES:
        rename_in_strings(old, new, text_files)

    # G-Moves in battle text and in the tests that check it
    test_headers = [os.path.relpath(os.path.join(d, f), ROOT)  # e.g. the test trainers' slide text
                    for d, _, fs in os.walk(os.path.join(ROOT, "test")) for f in fs if f.endswith(".h")]
    for old, new in g_moves.RENAMES:
        rename_in_strings(old, new, ["src/battle_message.c"] + test_files + test_headers)

    # 9d. HAMZA is the rival (game/story.py, game/text/rival.inc).
    edit("src/data/trainers.party", story.edit_rival_parties)
    edit("data/maps/Route110/scripts.inc", story.edit_route110)
    for pattern, new in story.RIVAL_RENAMES:
        for path in text_files:
            edit(path, lambda t, p=pattern, n=new: story.regex_in_strings(p, n, t))

    # 9e. Dad is HISHAM (game/story.py, game/text/family.inc).
    edit("src/data/trainers.party", story.edit_dad_party)
    for pattern, new in story.DAD_RENAMES:
        for path in text_files:
            edit(path, lambda t, p=pattern, n=new: story.regex_in_strings(p, n, t))

    # 9g. The gym leaders, the Elite Four MALIKs, Hisham as Champion and Yaseen in Wally's place,
    # with Heeshupeeshu (game/story.py, game/text/champion.inc).
    edit("src/data/trainers.party", story.edit_cast_parties)
    edit("src/battle_main.c", story.edit_class_names)
    edit("src/data/pokemon/species_info/gen_3_families.h",
         lambda t: story.edit_heeshupeeshu(t, legends.species_block, legends.set_field))
    for pattern, new in story.CAST_RENAMES:
        for path in text_files:
            edit(path, lambda t, p=pattern, n=new: story.regex_in_strings(p, n, t))
    for old, new in story.HEESHUPEESHU_NAMES:
        rename_in_strings(old, new, text_files + test_files)
    for old, new in story.CAST_LINE_FIXES:
        rename_in_strings(old, new, text_files)
    edit("src/data/trainers.party", story.edit_yaseen_parties)
    edit("src/data/trainers.party", story.edit_champion_party)

    # 9h. Taha (Steven) and the villain admins (game/story.py, game/text/admins.inc).
    edit("src/data/trainers.party", story.edit_admin_parties)
    edit("src/field_specials.c", lambda t: t.replace('_("STEVEN")', '_("TAHA")'))  # tag-battle partner

    # 9j. The SAFETY ZONE office in Mauville (game/story.py, game/text/ending.inc).
    edit("data/maps/MauvilleCity_House1/map.json", story.edit_office_map)
    edit("data/maps/MauvilleCity_House1/scripts.inc", story.edit_office_script)

    # 9k. POKéMON INTO THE MOVERSE: title banner, running shoes from the start, MOM's EXP. SHARE.
    shutil.copy(os.path.join(REMIX, "graphics", "title", "moverse_version.png"),
                os.path.join(ROOT, "graphics", "title_screen", "emerald_version.png"))
    edit("data/scripts/new_game.inc", story.edit_new_game_shoes)
    edit("data/maps/LittlerootTown/scripts.inc", story.edit_mom_gift)
    edit("data/maps/RustboroCity_DevonCorp_3F/scripts.inc", story.edit_zaaby_gift)
    edit("include/config/item.h", story.edit_exp_share_config)

    # 9i. The Potions are IDRIS's SOUSA (game/story.py).
    edit("src/data/items.h", story.edit_sousa_items)
    for pattern, new in story.SOUSA_TEXT_RENAMES:
        for path in text_files:
            edit(path, lambda t, p=pattern, n=new: story.regex_in_strings(p, n, t))
    for old, new in story.SOUSA_LINE_FIXES:
        rename_in_strings(old, new, text_files)
    for pattern, new in story.SOUSA_TEST_RENAMES:
        for path in test_files:
            edit(path, lambda t, p=pattern, n=new: story.regex_in_strings(p, n, t))
    for pattern, new in story.ADMIN_RENAMES:
        for path in text_files:
            edit(path, lambda t, p=pattern, n=new: story.regex_in_strings(p, n, t))

    # 9f. The orbs become a STRAWBERRY and a CHEESE (game/story.py).
    edit("src/data/items.h", story.edit_items)
    for old, new in story.ORB_ITEM_NAMES:  # battle messages the tests check
        rename_in_strings(old, new, test_files)
    for pattern, new in story.ORB_RENAMES:
        for path in text_files:
            edit(path, lambda t, p=pattern, n=new: story.regex_in_strings(p, n, t))

    # 10. The debug menu's "give starters" shortcut hands out ours.
    edit("data/scripts/debug.inc", lambda t: t.replace("givemon SPECIES_TREECKO,", "givemon SPECIES_SQUEESH,")
         .replace("givemon SPECIES_TORCHIC,", "givemon SPECIES_BEANITO,")
         .replace("givemon SPECIES_MUDKIP,", "givemon SPECIES_GUARDPUP,"))

    if DEBUG_SCRIPTS:
        def debug_scripts(t):
            t = t.replace("Debug_EventScript_Script_1::\n\trelease\n\tend\n",
                          "Debug_EventScript_Script_1::\n\tspecial ChooseStarter\n"
                          "\trelease\n\tend\n")
            t = t.replace("Debug_EventScript_Script_2::\n\trelease\n\tend\n",
                          "Debug_EventScript_Script_2::\n\tsetwildbattle SPECIES_OMARAUDER, 20\n"
                          "\tdowildbattle\n\trelease\n\tend\n")
            rival = "".join(
                "Debug_EventScript_Rival%s::\n\ttrainerbattle_no_intro TRAINER_MAY_ROUTE_103_%s, "
                "Debug_Text_RivalDefeated\n\trelease\n\tend\n\n" % (s.title(), s) for s in ("TREECKO", "TORCHIC", "MUDKIP"))
            t = t.replace("Debug_EventScript_Script_5::\n\trelease\n\tend\n",
                          "Debug_EventScript_Script_5::\n\tgivemon SPECIES_HEESHEF, 50\n"
                          "\tgivemon SPECIES_OMARAUDER, 50\n\tgivemon SPECIES_AHMEXEC, 50\n"
                          "\tsetwildbattle SPECIES_ZIGZAGOON, 2\n\tdowildbattle\n\trelease\n\tend\n")
            t = t.replace("Debug_EventScript_Script_8::\n\trelease\n\tend\n",
                          "Debug_EventScript_Script_8::\n\tmsgbox LittlerootTown_Text_WearTheseRunningShoes, MSGBOX_DEFAULT\n"
                          "\tmsgbox MtPyre_Summit_Text_MaxieSilence, MSGBOX_DEFAULT\n\trelease\n\tend\n")
            t = t.replace("Debug_EventScript_Script_7::\n\trelease\n\tend\n",
                          "Debug_EventScript_Script_7::\n\twarp MAP_MAUVILLE_CITY_HOUSE1, 4, 6\n"
                          "\twaitstate\n\trelease\n\tend\n")
            t = t.replace("Debug_EventScript_Script_6::\n\trelease\n\tend\n",
                          "Debug_EventScript_Script_6::\n\tgivemon SPECIES_RAYQUAZA, 70\n"
                          "\tgivemon SPECIES_GROUDON, 70\n\tgivemon SPECIES_KYOGRE, 70\n"
                          "\tsetwildbattle SPECIES_KYOGRE, 70\n\tdowildbattle\n\trelease\n\tend\n")
            t = t.replace("Debug_EventScript_Script_4::\n\trelease\n\tend\n",
                          "Debug_EventScript_Script_4::\n\tgivemon SPECIES_MEWTWO, 70, move1=MOVE_SHADOW_BALL, move2=MOVE_NONE, move3=MOVE_NONE, move4=MOVE_NONE\n"
                          "\ttrainerbattle_no_intro TRAINER_TABITHA_MT_CHIMNEY, Debug_Text_RivalDefeated\n"
                          "\trelease\n\tend\n")
            return t.replace("Debug_EventScript_Script_3::\n\trelease\n\tend\n",
                             "Debug_EventScript_Script_3::\n\tswitch VAR_STARTER_MON\n"
                             "\tcase 0, Debug_EventScript_RivalTreecko\n\tcase 1, Debug_EventScript_RivalTorchic\n"
                             "\tcase 2, Debug_EventScript_RivalMudkip\n\trelease\n\tend\n\n" + rival +
                             "Debug_Text_RivalDefeated:\n\t.string \"Debug: rival defeated.$\"\n")
        edit("data/scripts/debug.inc", debug_scripts)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--debug-scripts"]
    if len(args) != 1:
        sys.exit(__doc__)
    ROOT = args[0]
    DEBUG_SCRIPTS = "--debug-scripts" in sys.argv
    main()
