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

ORB_ITEM_NAMES = [("Red Orb", "Strawberry"), ("Blue Orb", "Cheese")]


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


# The rival is HAMZA, whichever look you pick (he still wears May's or Brendan's clothes).
# Whole-word, uppercase only, so "May I…" stays as it is.
RIVAL_RENAMES = [(r"\bMAY\b", "HAMZA"), (r"\bBRENDAN\b", "HAMZA")]

# Hamza's partner holds its G-Crystal from Route 119 on, so he can show off his favourite gimmick.
G_CRYSTAL_ACES = {"Heesh": "Heeshium G", "Heeshef": "Heeshium G",
                  "Omar": "Omarium G", "Omarauder": "Omarium G",
                  "Ahmed": "Ahmedium G", "Ahmexec": "Ahmedium G"}


def edit_rival_parties(t):
    blocks = t.split("\n=== ")
    for i, b in enumerate(blocks):
        if not b.startswith(("TRAINER_MAY_", "TRAINER_BRENDAN_")):
            continue
        b = b.replace("Name: MAY\n", "Name: HAMZA\n").replace("Name: BRENDAN\n", "Name: HAMZA\n")
        b = b.replace("Gender: Female\n", "Gender: Male\n")
        if b.startswith(("TRAINER_MAY_ROUTE_119", "TRAINER_BRENDAN_ROUTE_119",
                         "TRAINER_MAY_LILYCOVE", "TRAINER_BRENDAN_LILYCOVE")):
            b = "\n".join(l + " @ " + G_CRYSTAL_ACES[l] if l in G_CRYSTAL_ACES else l
                          for l in b.split("\n"))
        blocks[i] = b
    return "\n=== ".join(blocks)


# Route 110: after the battle Hamza also hands over the G-Power Ring and the G-Crystal for your
# starter's line (VAR_STARTER_MON: 0 Squeesh, 1 Beanito, 2 Guardpup).
ROUTE110_GIFT_OLD = """Route110_EventScript_GiveItemfinder::
	giveitem ITEM_DOWSING_MACHINE
	return
"""
ROUTE110_GIFT_NEW = """Route110_EventScript_GiveItemfinder::
	giveitem ITEM_DOWSING_MACHINE
	msgbox Route110_Text_HamzaGPowerRing, MSGBOX_DEFAULT
	giveitem ITEM_Z_POWER_RING
	switch VAR_STARTER_MON
	case 0, Route110_EventScript_GiveHeeshiumG
	case 1, Route110_EventScript_GiveOmariumG
	case 2, Route110_EventScript_GiveAhmediumG
	return

Route110_EventScript_GiveHeeshiumG::
	giveitem ITEM_HEESHIUM_G
	return

Route110_EventScript_GiveOmariumG::
	giveitem ITEM_OMARIUM_G
	return

Route110_EventScript_GiveAhmediumG::
	giveitem ITEM_AHMEDIUM_G
	return

Route110_Text_HamzaGPowerRing:
	.string "HAMZA: And now, the best gimmick!\\n"
	.string "A G-POWER RING, and a CRYSTAL!$"
"""


def edit_route110(t):
    return t.replace(ROUTE110_GIFT_OLD, ROUTE110_GIFT_NEW)


# Dad is HISHAM (the Petalburg GYM LEADER, replacing Norman).
DAD_RENAMES = [(r"\bNORMAN\b", "HISHAM")]


def edit_dad_party(t):
    return t.replace("Name: NORMAN\n", "Name: HISHAM\n")


# The gym leaders, the Elite Four (all four are MALIKs) and the Champion (Dad again). Whole words,
# uppercase, in quoted text. Battle names have a 10-letter limit, so the Elite Four's trainer class
# is "MALIK" and their battle names are their last names: "MALIK SHALLUF would like to battle!"
CAST_RENAMES = [
    ("TATE:", "HAFIZ:"),              # the Mossdeep pair speak by last name, to fit the textbox
    ("LIZA:", "ABDU:"),
    ("ROXANNE", "KAREEM"),            # gym 1, Rustboro
    ("BRAWLY", "JELAL"),              # gym 2, Dewford
    ("WATTSON", "SAMMI B"),           # gym 3, Mauville
    ("FLANNERY", "NABIL"),            # gym 4, Lavaridge
    ("WINONA", "ADAM JABER"),         # gym 6, Fortree
    ("TATE", "OMAR HAFIZ"),           # gym 7, Mossdeep (the double battle)
    ("LIZA", "MO ABDU"),
    ("JUAN", "HANY"),                 # gym 8, Sootopolis
    ("SIDNEY", "MALIK SHALLUF"),      # Elite Four
    ("PHOEBE", "MALIK EL BARASI"),
    ("GLACIA", "MALIK SHAGAN"),
    ("DRAKE", "MALIK AL BAKRI"),
    ("WALLACE", "HISHAM"),            # the Champion is Dad, again
    ("WALLY", "YASEEN"),              # Wally's role, without a starter
    ("RALTS", "HEESHUPEESHU"),        # the Pokémon Yaseen catches (placeholder: Ralts renamed)
]
CAST_RENAMES = [(r"\b%s" % re.escape(old) + (r"\b" if old[-1].isalnum() else ""), new)
                for old, new in CAST_RENAMES]

# Lines the longer names push past the textbox edge, reworded to fit.
CAST_LINE_FIXES = [
    ("Registered GYM LEADERS OMAR HAFIZ & MO ABDU", "Registered HAFIZ & ABDU"),
    ("MO ABDU AND OMAR HAFIZ'S CERTIFIED TRAINERS:", "HAFIZ AND ABDU'S CERTIFIED TRAINERS:"),
    ("ELITE FOUR, MALIK AL BAKRI the DRAGON master!", "MALIK AL BAKRI, the DRAGON master!"),
    ("Together with my HEESHUPEESHU, I'm going", "With my HEESHUPEESHU, I'm going"),
    ("OMAR HAFIZ: ", "HAFIZ: "),
    ("MO ABDU: ", "ABDU: "),
    ("MALIK AL BAKRI: That voice…", "AL BAKRI: That voice…"),
    ("That HEESHUPEESHU we caught together?", "The HEESHUPEESHU we caught together?"),
]

# Trainer names in battle (10 letters at most).
CAST_PARTY_NAMES = {
    "ROXANNE": "KAREEM", "BRAWLY": "JELAL", "WATTSON": "SAMMI B", "FLANNERY": "NABIL",
    "WINONA": "ADAM JABER", "TATE&LIZA": "HAFIZ&ABDU", "JUAN": "HANY",
    "SIDNEY": "SHALLUF", "PHOEBE": "EL BARASI", "GLACIA": "SHAGAN", "DRAKE": "AL BAKRI",
    "WALLACE": "HISHAM", "WALLY": "YASEEN",
}
NOW_MALE = ("ROXANNE", "FLANNERY", "WINONA", "TATE&LIZA", "PHOEBE", "GLACIA")


def edit_cast_parties(t):
    blocks = t.split("\n=== ")
    for i, b in enumerate(blocks):
        for old, new in CAST_PARTY_NAMES.items():
            if "\nName: %s\n" % old in b:
                b = b.replace("\nName: %s\n" % old, "\nName: %s\n" % new)
                if old in NOW_MALE:
                    b = b.replace("Gender: Female\n", "Gender: Male\n")
        blocks[i] = b
    return "\n=== ".join(blocks)


def edit_class_names(t):
    return t.replace('[TRAINER_CLASS_ELITE_FOUR] = { _("ELITE FOUR")', '[TRAINER_CLASS_ELITE_FOUR] = { _("MALIK")')


# Heeshupeeshu, the Pokémon Yaseen catches on Route 102. A placeholder for now: Ralts, renamed in
# place, so the catching tutorial, Route 102's wild Pokémon and Yaseen's teams all use it.
# It's a single-stage Pokémon: it doesn't evolve, and it gets Gardevoir's stats and moves.
HEESHUPEESHU_STATS = (68, 65, 65, 80, 125, 115)  # HP, Atk, Def, Spe, SpA, SpD (Gardevoir's)
HEESHUPEESHU_NAMES = [("Ralts", "Heeshupeeshu"), ("RALTS", "HEESHUPEESHU")]


def edit_heeshupeeshu(t, species_block, set_field):
    start, end = species_block(t, "RALTS")
    b = set_field(t[start:end], "speciesName", '_("Heeshupeeshu")')
    b = set_field(b, "categoryName", '_("Mystery")')
    for field, v in zip(("baseHP", "baseAttack", "baseDefense", "baseSpeed", "baseSpAttack",
                         "baseSpDefense"), HEESHUPEESHU_STATS):
        b = set_field(b, field, str(v))
    b = set_field(b, "levelUpLearnset", "sGardevoirLevelUpLearnset")
    b = set_field(b, "teachableLearnset", "sGardevoirTeachableLearnset")
    b = re.sub(r"\n        \.evolutions = EVOLUTION\(.*?\),\n", "\n", b)
    ds = b.index("        .description = COMPOUND_STRING(\n")
    de = b.index("),\n", ds) + 3
    b = b[:ds] + ('        .description = COMPOUND_STRING(\n'
                  '            "YASEEN\'s partner, the first POKéMON\\n"\n'
                  '            "he ever caught. Nobody knows what it\\n"\n'
                  '            "really looks like yet, not even\\n"\n'
                  '            "HEESHUPEESHU."),\n') + b[de:]
    return t[:start] + b + t[end:]


# Yaseen's later teams had Gardevoir; Heeshupeeshu doesn't evolve, so it's Heeshupeeshu all the way.
def edit_yaseen_parties(t):
    blocks = t.split("\n=== ")
    for i, b in enumerate(blocks):
        if b.startswith("TRAINER_WALLY_"):
            blocks[i] = b.replace("\nGardevoir\n", "\nRalts\n")
    return "\n=== ".join(blocks)


# Hisham's Champion team: all three starters fully evolved, and a Heeshupeeshu. Two more to come.
def champion_mon(species, level, moves):
    return "%s\nLevel: %d\nIVs: 31 HP / 31 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe\n%s" % (
        species, level, "".join("- %s\n" % m for m in moves))


HISHAM_CHAMPION_TEAM = [
    champion_mon("Heeshef", 58, ["Toxic Fondue", "Flamethrower", "Sludge Bomb", "Crunch"]),
    champion_mon("Omarauder", 58, ["Sticky Fingers", "Earthquake", "Sucker Punch", "Night Slash"]),
    champion_mon("Ahmexec", 58, ["Lockdown", "Close Combat", "Iron Head", "Bullet Punch"]),
    champion_mon("Ralts", 60, ["Moonblast", "Psychic", "Shadow Ball", "Calm Mind"]),  # Heeshupeeshu, his ace
]


def edit_champion_party(t):
    blocks = t.split("\n=== ")
    for i, b in enumerate(blocks):
        if b.startswith("TRAINER_WALLACE ==="):
            top = b[:b.index("\n\n") + 2].replace("Pic: Champion Wallace\n", "Pic: Leader Norman\n")
            blocks[i] = top + "\n".join(HISHAM_CHAMPION_TEAM)
    return "\n=== ".join(blocks)


# TAHA (replaces Steven): A Song of Ice and Fire (the books are better than the show), waiting for a
# PIRATE SOULS game, and MUAH. The villain admins: KROOMA and YAHYA wake HALEEB with Omar (Matt and
# Shelly); HAMADA (Tabitha) and KHALI IBRAHIM (Tabitha's Magma Hideout battle) work for Ahmed.
# Their scenes are in game/text/admins.inc.
ADMIN_RENAMES = [(r"\bMR\. STONE\b", "ZAABY"), (r"\bSTEVEN STONE\b", "TAHA"), (r"\bSTEVEN\b", "TAHA"), (r"\bMATT\b", "KROOMA"),
                 (r"\bSHELLY\b", "YAHYA"), (r"\bTABITHA\b", "HAMADA")]


def edit_admin_parties(t):
    blocks = t.split("\n=== ")
    for i, b in enumerate(blocks):
        # Each boss's real number one, in place of the last grunt in each team's base.
        if b.startswith("TRAINER_GRUNT_SEAFLOOR_CAVERN_5 ==="):
            b = b.replace("\nName: GRUNT\n", "\nName: IDRIS\n").replace("Class: Team Aqua\n", "Class: Aqua Admin\n")
        if b.startswith("TRAINER_GRUNT_MAGMA_HIDEOUT_13 ==="):
            b = b.replace("\nName: GRUNT\n", "\nName: MOSTAFA\n").replace("Class: Team Magma\n", "Class: Magma Admin\n")
        if b.startswith("TRAINER_TABITHA_MAGMA_HIDEOUT ==="):
            b = b.replace("\nName: TABITHA\n", "\nName: K. IBRAHIM\n")
        for old, new in (("STEVEN", "TAHA"), ("MATT", "KROOMA"), ("SHELLY", "YAHYA"), ("TABITHA", "HAMADA")):
            if "\nName: %s\n" % old in b:
                b = b.replace("\nName: %s\n" % old, "\nName: %s\n" % new).replace("Gender: Female\n", "Gender: Male\n")
        blocks[i] = b
    return "\n=== ".join(blocks)
