"""G-Moves: the game's Z-Moves, renamed, with a signature one for every new Pokémon line.

A Pokémon holding its line's G-Crystal that knows the line's signature move can turn it into the
G-Move once per battle, if you carry the G-Power Ring (the renamed Z-Power Ring). The moves are in
game/g_moves.h; see docs/G_MOVES.md.
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

# (crystal item, item name, icon, who, signature move, G-Move, species that can use it)
LINES = [
    ("ITEM_HEESHIUM_G", "Heeshium G", "PoisoniumZ", "Heesh's", "Toxic Fondue",
     "MOVE_TOXIC_FONDUE", "MOVE_FONDUE_TSUNAMI", ["SQUEESH", "HEESH", "HEESHEF"]),
    ("ITEM_OMARIUM_G", "Omarium G", "DarkiniumZ", "Omar's", "Sticky Fingers",
     "MOVE_STICKY_FINGERS", "MOVE_BIG_BEANIE_HEIST", ["BEANITO", "OMAR", "OMARAUDER"]),
    ("ITEM_AHMEDIUM_G", "Ahmedium G", "SteeliumZ", "Ahmed's", "Lockdown",
     "MOVE_LOCKDOWN", "MOVE_HOSTILE_TAKEOVER", ["GUARDPUP", "AHMED", "AHMEXEC"]),
    ("ITEM_HALEEBIUM_G", "Haleebium G", "FairiumZ", "Haleeb's", "Milk Shower",
     "MOVE_MILK_SHOWER", "MOVE_MILKY_WAY_DELUGE", ["KYOGRE"]),
    ("ITEM_CEASERIUM_G", "Ceaserium G", "GrassiumZ", "Ceaser's", "Royal Pounce",
     "MOVE_ROYAL_POUNCE", "MOVE_VENI_VIDI_VICI", ["GROUDON"]),
    ("ITEM_SNICKERSIUM_G", "Snickersium G", "ElectriumZ", "Snickers's", "Storm Claw",
     "MOVE_STORM_CLAW", "MOVE_SATISFYING_SWIPE", ["RAYQUAZA"]),
]

G_MOVES = [line[6] for line in LINES]
MARK = "    // Emerald Remix G-Moves\n"


def edit_move_ids(t):
    """G-Move IDs go at the end of the Z-Move range, so the game treats them as Z-Moves."""
    anchor = "    MOVE_SOUL_STEALING_7_STAR_STRIKE,\n"
    if MARK in t:  # replace what an earlier run added
        start = t.index(MARK)
        t = t[:start] + t[t.index("    LAST_Z_MOVE =", start):]
    block = MARK + "".join("    %s,\n" % m for m in G_MOVES)
    t = t.replace(anchor, anchor + block, 1)
    return re.sub(r"    LAST_Z_MOVE = MOVE_\w+,", "    LAST_Z_MOVE = %s," % G_MOVES[-1], t)


def edit_signature_table(t):
    anchor = "static const struct SignatureZMove sSignatureZMoves[] =\n{\n"
    rows = "".join("    {SPECIES_%s, %s, %s, %s}, // Emerald Remix\n" % (sp, item, move, gmove)
                   for item, _, _, _, _, move, gmove, species in LINES for sp in species)
    t = "\n".join(l for l in t.split("\n") if "// Emerald Remix" not in l or "SPECIES_" not in l)
    return t.replace(anchor, anchor + rows, 1)


def edit_item_ids(t):
    if "ITEM_HEESHIUM_G" in t:
        return t
    anchor = "    ITEM_GLIMMORANITE = 873,\n"
    ids = "".join("    %s = %d,\n" % (line[0], 874 + i) for i, line in enumerate(LINES))
    return t.replace(anchor, anchor + "\n    // Emerald Remix G-Crystals\n" + ids, 1)


def item_entry(item, name, icon, who, move):
    return """
    [%s] =
    {
        .name = ITEM_NAME("%s"),
        .price = 0,
        .holdEffect = HOLD_EFFECT_Z_CRYSTAL,
        .description = COMPOUND_STRING(
            "Upgrades %s\\n"
            "%s\\n"
            "to a G-Move."),
        .pocket = POCKET_ITEMS,
        .sortType = ITEM_TYPE_Z_CRYSTAL,
        .type = ITEM_USE_BAG_MENU,
        .fieldUseFunc = ItemUseOutOfBattle_CannotUse,
        .secondaryId = 255,  // signature G-Move
        .iconPic = gItemIcon_%s,
        .iconPalette = gItemIconPalette_%s,
    },
""" % (item, name, who, move, icon, icon)


def edit_items(t):
    if "[ITEM_HEESHIUM_G]" not in t:
        end = t.rindex("\n};")
        entries = "".join(item_entry(item, name, icon, who, move)
                          for item, name, icon, who, move, _, _, _ in LINES)
        t = t[:end] + "\n    // Emerald Remix G-Crystals" + entries.rstrip("\n") + t[end:]
    # The Z-Power Ring is the G-Power Ring
    return t.replace('ITEM_NAME("Z-Power Ring")', 'ITEM_NAME("G-Power Ring")').replace(
        '"to use Z-Power."', '"to use G-Power."')


# Battle text: "Heeshef surrounded itself with its G-Power!"
RENAMES = [("Z-Power", "G-Power"), ("Z-Move", "G-Move"), ("Z-POWER", "G-POWER"), ("Z-MOVE", "G-MOVE")]
