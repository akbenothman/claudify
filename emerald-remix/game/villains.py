"""The villains: Ahmed's Safety Zone vs Omar's Team Beanie (see docs/PLOT.md).

They replace Team Magma and Team Aqua in place: the same events, maps and battles, with new names,
new team names and new teams for the bosses. Ahmed wants Ceaser's endless sun (outdoor events, more
security contracts); Omar wants Haleeb's endless rain (empty streets, and a flooded Safety Zone HQ).

Still the old look: trainer sprites (Maxie, Archie, the admins, grunts) and most of the dialogue,
which mentions the land and the sea, until the scenes are rewritten.
"""

# Names in text, everywhere they're shown (quoted text only, never code or labels).
RENAMES = [
    ("TEAM MAGMA", "SAFETY ZONE"),
    ("Team Magma", "Safety Zone"),
    ("TEAM AQUA", "TEAM BEANIE"),
    ("Team Aqua", "Team Beanie"),
    ("MAXIE", "AHMED"),
    ("Maxie", "Ahmed"),
    ("ARCHIE", "OMAR"),
    ("Archie", "Omar"),
]

# Lines the longer names push past the textbox edge, reworded to fit.
LINE_FIXES = [
    ("TEAM BEANIE's uniform or SAFETY ZONE's?", "TEAM BEANIE's look or SAFETY ZONE's?"),
    ("But being on TEAM BEANIE, I know I'll get", "But on TEAM BEANIE, I know I'll get"),
    ("Then might TEAM BEANIE's goal to expand", "So might TEAM BEANIE's goal to expand"),
]

# Trainer class names shown in battle ("SAFETY BOSS AHMED would like to battle!").
CLASS_NAMES = {
    '_("TEAM MAGMA")': '_("SAFETY ZONE")',
    '_("MAGMA LEADER")': '_("SAFETY BOSS")',
    '_("MAGMA ADMIN")': '_("SAFETY ADMIN")',
    '_("TEAM AQUA")': '_("TEAM BEANIE")',
    '_("AQUA LEADER")': '_("BEANIE BOSS")',
    '_("AQUA ADMIN")': '_("BEANIE ADMIN")',
}


def mon(species, level, ivs=18):
    return "%s\nLevel: %d\nIVs: %d HP / %d Atk / %d Def / %d SpA / %d SpD / %d Spe\n" % (
        species, level, ivs, ivs, ivs, ivs, ivs, ivs)


# The bosses' teams. Ahmed: security dogs, security cameras and his own line, ace Ahmexec.
# Omar: thieves, ace Omarauder. Same levels as the battles they replace.
TEAMS = {
    "TRAINER_MAXIE_MT_CHIMNEY": [mon("Growlithe", 24), mon("Magnemite", 24), mon("Ahmed", 25)],
    "TRAINER_MAXIE_MAGMA_HIDEOUT": [mon("Arcanine", 37), mon("Magneton", 38), mon("Ahmexec", 39)],
    "TRAINER_MAXIE_MOSSDEEP": [mon("Arcanine", 42), mon("Magneton", 43), mon("Ahmexec", 44)],
    "TRAINER_ARCHIE": [mon("Honchkrow", 41), mon("Weavile", 41), mon("Omarauder", 43)],
}


def edit_parties(t):
    """Swap the bosses' Pokémon and rename the villains' trainer entries."""
    blocks = t.split("\n=== ")
    for i, b in enumerate(blocks):
        head = b.split(" ===", 1)[0]
        if head in TEAMS:
            # keep the header lines (up to the first blank line), replace the Pokémon
            top = b[:b.index("\n\n") + 2]
            blocks[i] = top + "\n".join(TEAMS[head])
        for old, new in (("Name: MAXIE", "Name: AHMED"), ("Name: ARCHIE", "Name: OMAR")):
            blocks[i] = blocks[i].replace(old + "\n", new + "\n")
    return "\n=== ".join(blocks)


def edit_class_names(t):
    for old, new in CLASS_NAMES.items():
        t = t.replace(old, new)
    return t
