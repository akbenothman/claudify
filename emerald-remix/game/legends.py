"""The legendary cats take over Hoenn's weather trio, in place.

Haleeb is Kyogre, Ceaser is Groudon and Snickers is Rayquaza: same species slots, so every story
event, static encounter and line of dialogue that uses the old ones now uses ours. Their weather
abilities stay (Haleeb's clouds bring rain, Ceaser brings the sun, Snickers calms both), which keeps
the Sootopolis story working.

Still the old art: the story cutscene sprites (Seafloor Cavern, Cave of Origin, Sootopolis, Sky
Pillar), the title screen and the opening movie.
"""
import json
import os
import re

LEGENDS = {
    # slot: our data
    "KYOGRE": dict(
        dir="haleeb", name="Haleeb", upper="HALEEB",
        stats=(110, 70, 100, 90, 150, 150),  # HP, Atk, Def, Spe, SpA, SpD
        types="MON_TYPES(TYPE_FAIRY, TYPE_FLYING)",
        abilities="{ ABILITY_DRIZZLE, ABILITY_NONE, ABILITY_NONE }",
        color="BODY_COLOR_WHITE", category="Cloud Cat", height=38, weight=2100, icon=3,
        description=[
            "Haleeb is said to have spread the clouds",
            "across the sky. It naps on them for years",
            "at a time, and wherever it sleeps, a",
            "gentle rain falls on the land below.",
        ],
        learnset="sHaleebLevelUpLearnset",
    ),
    "GROUDON": dict(
        dir="ceaser", name="Ceaser", upper="CEASER",
        stats=(100, 150, 130, 90, 90, 110),
        types="MON_TYPES(TYPE_GRASS, TYPE_GROUND)",
        abilities="{ ABILITY_DROUGHT, ABILITY_NONE, ABILITY_NONE }",
        color="BODY_COLOR_YELLOW", category="Sun King", height=32, weight=6500, icon=5,
        description=[
            "The ancient king of all land. Flowers",
            "bloom wherever Ceaser lies down, and its",
            "lazy yawn is said to bring the summer",
            "sun. It hasn't stood up in a century.",
        ],
        learnset="sCeaserLevelUpLearnset",
    ),
    "RAYQUAZA": dict(
        dir="snickers", name="Snickers", upper="SNICKERS",
        stats=(105, 150, 90, 115, 130, 90),
        types="MON_TYPES(TYPE_DARK, TYPE_ELECTRIC)",
        abilities="{ ABILITY_AIR_LOCK, ABILITY_NONE, ABILITY_NONE }",
        color="BODY_COLOR_WHITE", category="Storm Claw", height=70, weight=2065, icon=5,
        description=[
            "It slithers through thunderclouds high",
            "above the land. Its claws crackle with",
            "red lightning, and it is said to end the",
            "fights of other legends with one swipe.",
        ],
        learnset="sSnickersLevelUpLearnset",
    ),
}

FORMS = {"KYOGRE": ["KYOGRE_PRIMAL"], "GROUDON": ["GROUDON_PRIMAL"], "RAYQUAZA": ["RAYQUAZA_MEGA"]}

# TM and tutor moves (the expansion keeps only the ones this game teaches).
COMMON = ["MOVE_TOXIC", "MOVE_PROTECT", "MOVE_REST", "MOVE_SLEEP_TALK", "MOVE_SNORE", "MOVE_FACADE",
          "MOVE_SECRET_POWER", "MOVE_RETURN", "MOVE_FRUSTRATION", "MOVE_HIDDEN_POWER",
          "MOVE_DOUBLE_TEAM", "MOVE_SUBSTITUTE", "MOVE_ENDURE", "MOVE_HYPER_BEAM", "MOVE_GIGA_IMPACT",
          "MOVE_ROUND", "MOVE_SWAGGER", "MOVE_MIMIC", "MOVE_SWIFT", "MOVE_TERA_BLAST", "MOVE_CONFIDE",
          "MOVE_BODY_SLAM", "MOVE_DOUBLE_EDGE", "MOVE_TAKE_DOWN", "MOVE_ROAR", "MOVE_SCARY_FACE",
          "MOVE_ROCK_SMASH", "MOVE_STRENGTH", "MOVE_CALM_MIND", "MOVE_ANCIENT_POWER"]
TEACHABLE = {
    "KYOGRE": COMMON + ["MOVE_FLY", "MOVE_AERIAL_ACE", "MOVE_AIR_SLASH", "MOVE_HURRICANE",
                        "MOVE_ROOST", "MOVE_TAILWIND", "MOVE_DAZZLING_GLEAM", "MOVE_MOONBLAST",
                        "MOVE_DRAINING_KISS", "MOVE_MISTY_TERRAIN", "MOVE_RAIN_DANCE", "MOVE_WEATHER_BALL",
                        "MOVE_ICE_BEAM", "MOVE_BLIZZARD", "MOVE_ICY_WIND", "MOVE_SURF", "MOVE_WATER_PULSE",
                        "MOVE_THUNDERBOLT", "MOVE_THUNDER", "MOVE_THUNDER_WAVE", "MOVE_PSYCHIC",
                        "MOVE_SHADOW_BALL", "MOVE_SAFEGUARD", "MOVE_LIGHT_SCREEN", "MOVE_REFLECT",
                        "MOVE_HEAL_BELL", "MOVE_HELPING_HAND", "MOVE_YAWN", "MOVE_PSYCH_UP"],
    "GROUDON": COMMON + ["MOVE_EARTHQUAKE", "MOVE_BULLDOZE", "MOVE_DIG", "MOVE_HIGH_HORSEPOWER",
                         "MOVE_STOMPING_TANTRUM", "MOVE_SOLAR_BEAM", "MOVE_SOLAR_BLADE",
                         "MOVE_GIGA_DRAIN", "MOVE_ENERGY_BALL", "MOVE_SEED_BOMB", "MOVE_LEAF_BLADE",
                         "MOVE_BULLET_SEED", "MOVE_GRASS_KNOT", "MOVE_GRASSY_TERRAIN", "MOVE_SUNNY_DAY",
                         "MOVE_ROCK_SLIDE", "MOVE_ROCK_TOMB", "MOVE_STONE_EDGE", "MOVE_BRICK_BREAK",
                         "MOVE_BULK_UP", "MOVE_CRUNCH", "MOVE_FIRE_FANG", "MOVE_THUNDER_FANG",
                         "MOVE_IRON_TAIL", "MOVE_IRON_HEAD", "MOVE_SWORDS_DANCE", "MOVE_FLAMETHROWER",
                         "MOVE_WILL_O_WISP", "MOVE_HEAVY_SLAM"],
    "RAYQUAZA": COMMON + ["MOVE_THUNDERBOLT", "MOVE_THUNDER", "MOVE_THUNDER_WAVE", "MOVE_THUNDER_PUNCH",
                          "MOVE_THUNDER_FANG", "MOVE_WILD_CHARGE", "MOVE_VOLT_SWITCH", "MOVE_CHARGE_BEAM",
                          "MOVE_ELECTRIC_TERRAIN", "MOVE_SHOCK_WAVE", "MOVE_CRUNCH", "MOVE_DARK_PULSE",
                          "MOVE_THIEF", "MOVE_KNOCK_OFF", "MOVE_SNARL", "MOVE_FOUL_PLAY", "MOVE_TAUNT",
                          "MOVE_TORMENT", "MOVE_NASTY_PLOT", "MOVE_SWORDS_DANCE", "MOVE_X_SCISSOR",
                          "MOVE_SHADOW_CLAW", "MOVE_AERIAL_ACE", "MOVE_BRICK_BREAK", "MOVE_IRON_TAIL",
                          "MOVE_FIRE_FANG", "MOVE_ICE_FANG", "MOVE_FLAMETHROWER", "MOVE_ICE_BEAM",
                          "MOVE_EARTHQUAKE", "MOVE_DRAGON_CLAW", "MOVE_OUTRAGE", "MOVE_RAIN_DANCE",
                          "MOVE_SUNNY_DAY"],
}


def set_field(block, field, value):
    pat = re.compile(r"^(        \.%s\s*=\s*).*?,$" % re.escape(field), re.M)
    if not pat.search(block):
        raise SystemExit("legends: no .%s field" % field)
    return pat.sub(lambda m: m.group(1) + value + ",", block, count=1)


def species_block(t, slot):
    start = t.index("    [SPECIES_%s] =\n    {\n" % slot)
    end = t.index("\n    },\n", start) + len("\n    },\n")
    return start, end


def edit_species(t):
    for slot, d in LEGENDS.items():
        start, end = species_block(t, slot)
        b = t[start:end]
        for field, v in zip(("baseHP", "baseAttack", "baseDefense", "baseSpeed", "baseSpAttack",
                             "baseSpDefense"), d["stats"]):
            b = set_field(b, field, str(v))
        b = set_field(b, "types", d["types"])
        b = set_field(b, "abilities", d["abilities"])
        b = set_field(b, "bodyColor", d["color"])
        b = set_field(b, "speciesName", '_("%s")' % d["name"])
        b = set_field(b, "categoryName", '_("%s")' % d["category"])
        b = set_field(b, "height", str(d["height"]))
        b = set_field(b, "weight", str(d["weight"]))
        b = set_field(b, "frontPicSize", "MON_COORDS_SIZE(64, 64)")
        b = set_field(b, "frontPicYOffset", "0")
        b = set_field(b, "backPicSize", "MON_COORDS_SIZE(64, 64)")
        b = set_field(b, "backPicYOffset", "6")
        b = set_field(b, "iconPalIndex", str(d["icon"]))
        b = set_field(b, "levelUpLearnset", d["learnset"])
        ds = b.index("        .description = COMPOUND_STRING(\n")
        de = b.index("),\n", ds) + 3
        lines = "".join('            "%s\\n"\n' % l for l in d["description"][:-1])
        lines += '            "%s"),\n' % d["description"][-1]
        b = b[:ds] + "        .description = COMPOUND_STRING(\n" + lines + b[de:]
        t = t[:start] + b + t[end:]
        # Their Primal/Mega forms can't be reached in this game, but share the name so it never shows.
        for form in FORMS[slot]:
            start, end = species_block(t, form)
            t = t[:start] + set_field(t[start:end], "speciesName", '_("%s")' % d["name"]) + t[end:]
    return t


def edit_learnables(t):
    data = json.loads(t)
    for slot, moves in TEACHABLE.items():
        data[slot] = sorted(set(moves))
    return json.dumps(data, indent=2, ensure_ascii=False)


def copy_graphics(remix, root, copy):
    for slot, d in LEGENDS.items():
        src = os.path.join(remix, "graphics", "legends", d["dir"])
        dst = os.path.join(root, "graphics", "pokemon", slot.lower())
        for f in ("anim_front.png", "back.png", "normal.pal", "shiny.pal", "icon.png"):
            copy(os.path.join(src, f), os.path.join(dst, f))


# Names in text: the {KYOGRE}/{GROUDON} placeholders and every line that names them.
RENAMES = [(old, new) for slot, d in LEGENDS.items()
           for old, new in ((slot, d["upper"]), (slot.title(), d["name"]))]
