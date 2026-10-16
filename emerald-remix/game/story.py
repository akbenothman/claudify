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


# Wally is written out: no catching tutorial, no Mauville or Victory Road battles. His house in
# Petalburg is IZZO's (Dad's friend), who still gives you HM SURF after you beat Dad.
GYM_TUTORIAL_OLD = """	msgbox PetalburgCity_Gym_Text_DadYoureHereWithYourPokemon, MSGBOX_DEFAULT
	closemessage
	switch VAR_FACING
	case DIR_SOUTH, PetalburgCity_Gym_EventScript_BeginWallyTutorialSouth
	case DIR_NORTH, PetalburgCity_Gym_EventScript_BeginWallyTutorialNorth
	case DIR_WEST, PetalburgCity_Gym_EventScript_BeginWallyTutorialWest
	case DIR_EAST, PetalburgCity_Gym_EventScript_BeginWallyTutorialEast
	end
"""
# Straight to Dad's advice, leaving the same state the tutorial did.
GYM_TUTORIAL_NEW = """	msgbox PetalburgCity_Gym_Text_DadYoureHereWithYourPokemon, MSGBOX_DEFAULT
	msgbox PetalburgCity_Gym_Text_DadGoCollectBadges, MSGBOX_DEFAULT
	setflag FLAG_HIDE_PETALBURG_CITY_WALLYS_MOM
	setvar VAR_PETALBURG_GYM_STATE, 2
	setvar VAR_PETALBURG_CITY_STATE, 3
	setflag FLAG_HIDE_LITTLEROOT_TOWN_BIRCHS_LAB_RIVAL
	special InitBirchState
	release
	end
"""


def edit_petalburg_gym(t):
    return t.replace(GYM_TUTORIAL_OLD, GYM_TUTORIAL_NEW)


NEW_GAME_ANCHOR = "\tsetflag FLAG_HIDE_VICTORY_ROAD_EXIT_WALLY\n"
NEW_GAME_WALLY = """	setflag FLAG_HIDE_PETALBURG_CITY_WALLYS_MOM
	setflag FLAG_HIDE_MAUVILLE_CITY_WALLY
	setflag FLAG_HIDE_MAUVILLE_CITY_WALLYS_UNCLE
	setflag FLAG_DEFEATED_WALLY_MAUVILLE
	setvar VAR_VICTORY_ROAD_1F_STATE, 3
"""


def edit_new_game(t):
    if NEW_GAME_WALLY in t:
        return t
    return t.replace(NEW_GAME_ANCHOR, NEW_GAME_ANCHOR + NEW_GAME_WALLY, 1)


def edit_hall_of_fame(t):
    # Wally doesn't come back to Victory Road after the credits either.
    return t.replace("\tclearflag FLAG_HIDE_VICTORY_ROAD_EXIT_WALLY\n", "")
