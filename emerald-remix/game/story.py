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
    ("FLANNERY", "ANAS TRESH"),       # gym 4, Lavaridge (a urologist; NABIL is the Petalburg twist)
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
    "ROXANNE": "KAREEM", "BRAWLY": "JELAL", "WATTSON": "SAMMI B", "FLANNERY": "ANAS TRESH",
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
                if old == "FLANNERY":  # ANAS TRESH is a doctor
                    b = b.replace("Pic: Leader Flannery\n", "Pic: Scientist Frlg\n")
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


# The Potions are IDRIS's SOUSA, his electrolyte and protein drink: Potion = chocolate,
# Super Potion = strawberry, Hyper Potion = vanilla. Max Potion and Full Restore stay.
SOUSA = [("Super Potion", "Strawberry Sousa", "strawberry"),
         ("Hyper Potion", "Vanilla Sousa", "vanilla"),
         ("Potion", "Chocolate Sousa", "chocolate")]
_NOT_AFTER = "(?<!Max )(?<!Full )(?<!Super )(?<!Hyper )(?<!MAX )(?<!FULL )(?<!SUPER )(?<!HYPER )"
SOUSA_TEXT_RENAMES = [(r"\b%s(S?)\b" % old.upper(), new.upper() + r"\1") for old, new, _ in SOUSA[:2]]
SOUSA_TEXT_RENAMES.append((_NOT_AFTER + r"\bPOTION(S?)\b", r"CHOCOLATE SOUSA\1"))
SOUSA_TEST_RENAMES = [(r"\bSuper Potion\b", "Strawberry Sousa"), (r"\bHyper Potion\b", "Vanilla Sousa"),
                      (_NOT_AFTER + r"\bPotion\b", "Chocolate Sousa")]


def edit_sousa_items(t):
    for old, new, flavour in SOUSA:
        if 'ITEM_NAME("%s")' % new in t:  # already done
            continue
        start = t.index('        .name = ITEM_NAME("%s"),' % old)
        end = t.index("\n    },", start)
        b = t[start:end].replace('ITEM_NAME("%s")' % old, 'ITEM_NAME("%s")' % new)
        b = b.replace('            "Restores the HP of\\n"\n            "a Pokémon by\\n"\n',
                      '            "IDRIS\'s %s\\n"\n            "SOUSA. Heals HP by\\n"\n' % flavour)
        t = t[:start] + b + t[end:]
    return t

# Lines the longer name pushes past the textbox edge.
SOUSA_LINE_FIXES = [
    ("A CHOCOLATE SOUSA can be used anytime, so it's", "A SOUSA works anytime, so it's"),
    ("items like CHOCOLATE SOUSA and ANTIDOTE.", "items like SOUSA and ANTIDOTE."),
    ("I should have brought a CHOCOLATE SOUSA…", "I should have brought some SOUSA…"),
    ("one CHOCOLATE SOUSA. How much money remains?", "one CHOCOLATE SOUSA.\\lHow much money remains?"),
]


# Mauville's first house is the SAFETY ZONE office: the ROCK SMASH guy is the office manager (he still
# gives you ROCK SMASH, for "security drills"), and a guard by the door checks your ID. What they say
# moves with the story: AHMED's off to MT. CHIMNEY for a METEORITE; after it, he's not back; after
# the ending, OMAR is back at his desk.
OFFICE_GUARD = {
    "graphics_id": "OBJ_EVENT_GFX_MAGMA_MEMBER_M", "x": 2, "y": 6, "elevation": 3,
    "movement_type": "MOVEMENT_TYPE_FACE_RIGHT", "movement_range_x": 0, "movement_range_y": 0,
    "trainer_type": "TRAINER_TYPE_NONE", "trainer_sight_or_berry_tree_id": "0",
    "script": "MauvilleCity_House1_EventScript_SafetyGuard", "flag": "0",
}

OFFICE_GUARD_SCRIPT = """
MauvilleCity_House1_EventScript_SafetyGuard::
	lock
	faceplayer
	goto_if_ge VAR_MT_PYRE_STATE, 3, MauvilleCity_House1_EventScript_SafetyGuardEnding
	goto_if_set FLAG_DEFEATED_EVIL_TEAM_MT_CHIMNEY, MauvilleCity_House1_EventScript_SafetyGuardAfterChimney
	msgbox MauvilleCity_House1_Text_SafetyGuardID, MSGBOX_DEFAULT
	release
	end

MauvilleCity_House1_EventScript_SafetyGuardAfterChimney::
	msgbox MauvilleCity_House1_Text_SafetyGuardAfterChimney, MSGBOX_DEFAULT
	release
	end

MauvilleCity_House1_EventScript_SafetyGuardEnding::
	msgbox MauvilleCity_House1_Text_SafetyGuardEnding, MSGBOX_DEFAULT
	release
	end

MauvilleCity_House1_Text_SafetyGuardID:
	.string "Welcome to SAFETY ZONE.\\n"
	.string "Can I see some ID?\\p"
	.string "… … … … … …\\p"
	.string "That's a POKéDEX. Fine, you're in.\\p"
	.string "The BOSS isn't here. AHMED took a\\n"
	.string "team to MT. CHIMNEY.\\p"
	.string "Something about a METEORITE and\\n"
	.string "making our own sunshine.\\p"
	.string "That empty desk? OMAR's.\\n"
	.string "Don't touch it. It's evidence.$"

MauvilleCity_House1_Text_SafetyGuardAfterChimney:
	.string "Can I see some ID?\\n"
	.string "…Oh. It's you.\\p"
	.string "You beat the BOSS at MT. CHIMNEY?\\p"
	.string "He came back, changed the WI-FI\\n"
	.string "password too, and left again.\\p"
	.string "Now none of us can log in.$"

MauvilleCity_House1_Text_SafetyGuardEnding:
	.string "Can I see some ID?\\n"
	.string "Just kidding. You're a legend here.\\p"
	.string "OMAR's back at his desk!\\p"
	.string "He's doing “thinking work.”\\n"
	.string "AHMED says it counts. For now.$"
"""


def edit_office_map(t):
    import json
    m = json.loads(t)
    if not any(o["script"] == OFFICE_GUARD["script"] for o in m["object_events"]):
        m["object_events"].append(OFFICE_GUARD)
    return json.dumps(m, indent=2) + "\n"


def edit_office_script(t):
    return t if "SafetyGuard::" in t else t.rstrip("\n") + "\n" + OFFICE_GUARD_SCRIPT


# The game is POKéMON INTO THE MOVERSE: the banner under the title-screen logo (drawn by
# tools/make_title.py) and PROF. MO's welcome. RUNNING SHOES from the start, and MOM gives you the
# EXP. SHARE (modern style: a key item that shares EXP with the whole party) when you get your
# starter. ZAABY gives a LUCKY EGG instead of the EXP. SHARE.
NEW_GAME_SHOES = "\tsetflag FLAG_SYS_B_DASH\n\tsetflag FLAG_RECEIVED_RUNNING_SHOES\n"


def edit_new_game_shoes(t):
    if NEW_GAME_SHOES in t:
        return t
    anchor = "\tsetflag FLAG_HIDE_VICTORY_ROAD_EXIT_WALLY\n"
    return t.replace(anchor, anchor + NEW_GAME_SHOES, 1)


MOM_GIFT_OLD = """	msgbox LittlerootTown_Text_WearTheseRunningShoes, MSGBOX_DEFAULT
	playfanfare MUS_OBTAIN_ITEM
	message LittlerootTown_Text_SwitchShoesWithRunningShoes
	waitfanfare
	setflag FLAG_RECEIVED_RUNNING_SHOES
"""
MOM_GIFT_NEW = """	msgbox LittlerootTown_Text_WearTheseRunningShoes, MSGBOX_DEFAULT
	giveitem ITEM_EXP_SHARE
	setflag FLAG_RECEIVED_RUNNING_SHOES
"""


def edit_mom_gift(t):
    return t.replace(MOM_GIFT_OLD, MOM_GIFT_NEW)


def edit_zaaby_gift(t):
    return t.replace("\tgiveitem ITEM_EXP_SHARE\n", "\tgiveitem ITEM_LUCKY_EGG\n")


def edit_exp_share_config(t):
    # The modern EXP. SHARE remembers whether it's on in a save flag; 0x20 is unused in Emerald.
    t = t.replace("#define I_EXP_SHARE_FLAG        0 ", "#define I_EXP_SHARE_FLAG        FLAG_UNUSED_0x020 ")
    return t.replace("#define I_EXP_SHARE_ITEM        GEN_5", "#define I_EXP_SHARE_ITEM        GEN_6")


def edit_lavaridge_gym_map(t):
    # ANAS TRESH, the urologist, wears a lab coat in the overworld too.
    return t.replace('"graphics_id": "OBJ_EVENT_GFX_FLANNERY"', '"graphics_id": "OBJ_EVENT_GFX_SCIENTIST_1"')


# MR. BRINEY is IZZO (game/text/izzo.inc).
IZZO_RENAMES = [(r"\bMR\. BRINEY\b", "IZZO"), (r"\bCAPT\. BRINEY\b", "IZZO"),
                (r"\bCAPTAIN BRINEY\b", "CAPTAIN IZZO"), (r"\bBRINEY\b", "IZZO")]

# Beating OMAR HAFIZ and MO ABDU (gym 7) finishes the MOVERSE: MOSTAFA fell at the Magma Hideout, and
# PROF. MO doesn't battle. Right after the badge, the game says so, and MO ABDU finally talks.
MOVERSE_OLD = """	call MossdeepCity_Gym_EventScript_GiveCalmMind
	closemessage
	delay 30
	playfanfare MUS_REGISTER_MATCH_CALL
"""
MOVERSE_NEW = """	call MossdeepCity_Gym_EventScript_GiveCalmMind
	closemessage
	delay 30
	playfanfare MUS_OBTAIN_BADGE
	message MossdeepCity_Gym_Text_MoverseDefeated
	waitfanfare
	msgbox MossdeepCity_Gym_Text_AbduSpeaks, MSGBOX_DEFAULT
	closemessage
	delay 30
	playfanfare MUS_REGISTER_MATCH_CALL
"""
MOVERSE_TEXT = """
MossdeepCity_Gym_Text_MoverseDefeated:
	.string "{PLAYER} defeated the MOVERSE!$"

MossdeepCity_Gym_Text_AbduSpeaks:
	.string "HAFIZ: … … …\\p"
	.string "ABDU: …MOSTAFA. And now us.\\n"
	.string "That was the whole MOVERSE.\\p"
	.string "Except PROF. MO. He doesn't battle.\\n"
	.string "He eats.\\p"
	.string "HISHAM is waiting for you at the\\n"
	.string "POKéMON LEAGUE. Your mother was right.\\p"
	.string "HAFIZ: … … …\\p"
	.string "ABDU: We're still MO's friends.$"
"""


def edit_mossdeep_gym(t):
    if "MossdeepCity_Gym_Text_MoverseDefeated" in t:
        return t
    return t.replace(MOVERSE_OLD, MOVERSE_NEW).rstrip("\n") + "\n" + MOVERSE_TEXT


# The postgame and the BATTLE FRONTIER are cut: set this to False and re-apply (to a clean checkout)
# to bring them back. Nothing is deleted: every cut line stays in the game's scripts as a comment
# starting with POSTGAME_CUT_MARK, so they're easy to find too.
CUT_POSTGAME = True
POSTGAME_CUT_MARK = "@ Emerald Remix postgame cut: "

# What becoming CHAMPION unlocks (data/scripts/hall_of_fame.inc). Kept: the save warp, the CHAMPION
# flag, the ELITE FOUR reset, and hiding HAMZA/YASEEN. Cut: the S.S. TIDAL (the only way to the
# BATTLE FRONTIER and the event islands), event legendaries, BELDUM, the ferry-ticket visit, the
# SAFARI ZONE expansion, the fossil maniac's desert underpass, the motel designers, the fan club
# update and the Johto-starter dex upgrade.
HALL_OF_FAME_CUTS = [
    "\tcall EverGrandeCity_HallOfFame_EventScript_ResetDefeatedEventLegendaries\n",
    "\tcall_if_eq VAR_FOSSIL_MANIAC_STATE, 0, EverGrandeCity_HallOfFame_EventScript_SetDesertUnderpassCommentReady\n",
    "\tclearflag FLAG_HIDE_LILYCOVE_MOTEL_GAME_DESIGNERS\n",
    "\tsetflag FLAG_HIDE_SLATEPORT_CITY_STERNS_SHIPYARD_MR_BRINEY\n",
    "\tclearflag FLAG_HIDE_SS_TIDAL_CORRIDOR_MR_BRINEY\n",
    "\tclearflag FLAG_HIDE_MOSSDEEP_CITY_STEVENS_HOUSE_INVISIBLE_NINJA_BOY\n",
    "\tsetvar VAR_STEVENS_HOUSE_STATE, 2\n",
    "\tclearflag FLAG_HIDE_VICTORY_ROAD_EXIT_WALLY\n",
    "\tclearflag FLAG_HIDE_SLATEPORT_CITY_HARBOR_SS_TIDAL\n",
    "\tclearflag FLAG_HIDE_LILYCOVE_HARBOR_SSTIDAL\n",
    "\tsetflag FLAG_HIDE_SAFARI_ZONE_SOUTH_CONSTRUCTION_WORKERS\n",
    "\tclearflag FLAG_HIDE_SAFARI_ZONE_SOUTH_EAST_EXPANSION\n",
    "\tspecial UpdateTrainerFanClubGameClear\n",
    "\tcall_if_unset FLAG_RECEIVED_SS_TICKET, EverGrandeCity_HallOfFame_EventScript_ReadyReceiveSSTicketEvent\n",
    "\tcall_if_unset FLAG_RECEIVED_BELDUM, EverGrandeCity_HallOfFame_EventScript_ShowStevensHouseBeldum\n",
    "\tcall_if_eq VAR_DEX_UPGRADE_JOHTO_STARTER_STATE, 0, EverGrandeCity_HallOfFame_EventScript_ReadyDexUpgradeEvent\n",
]


def edit_hall_of_fame_cut(t):
    for line in HALL_OF_FAME_CUTS:
        t = t.replace(line, POSTGAME_CUT_MARK + line.lstrip("\t"))
    return t


def edit_postgame_gates(t):
    """Everywhere a script checks whether you're CHAMPION: never take the postgame branch.

    `goto/call_if_set FLAG_SYS_GAME_CLEAR, X` (postgame only) is commented out; `goto/call_if_unset
    FLAG_SYS_GAME_CLEAR, X` (the "not yet" branch) becomes an unconditional goto/call, with the
    original kept as a comment above it.
    """
    out = []
    for line in t.split("\n"):
        s = line.strip()
        cmd = s.split(None, 1)[0] if s else ""
        if ("FLAG_SYS_GAME_CLEAR" in s and cmd in ("goto_if_set", "call_if_set", "goto_if_unset", "call_if_unset")
                and s.count(",") == 1):
            target = s.split(",", 1)[1].strip()
            if cmd in ("goto_if_set", "call_if_set"):
                line = POSTGAME_CUT_MARK + s
            elif cmd in ("goto_if_unset", "call_if_unset"):
                line = "%s%s\n\t%s %s" % (POSTGAME_CUT_MARK, s, cmd.split("_")[0], target)
        out.append(line)
    return "\n".join(out)


# Files with CHAMPION checks to cut. The PC's HALL OF FAME viewer stays.
POSTGAME_GATE_SKIP = ("data/scripts/pc.inc", "data/scripts/hall_of_fame.inc")


def edit_rematch_cut(t):
    # Gym leader rematches start after you're CHAMPION; with the postgame cut, they never do.
    return t.replace("    if (!FlagGet(FLAG_SYS_GAME_CLEAR))\n",
                     "    if (TRUE) // Emerald Remix postgame cut: was if (!FlagGet(FLAG_SYS_GAME_CLEAR))\n")
