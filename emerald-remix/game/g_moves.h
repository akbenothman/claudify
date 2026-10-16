    // Emerald Remix G-Moves (the game's Z-Moves, renamed): one super move per new Pokémon line, unlocked
    // by holding its G-Crystal while knowing the line's signature move (see emerald-remix/docs/G_MOVES.md).
    [MOVE_FONDUE_TSUNAMI] =
    {
        .name = COMPOUND_STRING("Fondue Tsunami"),
        .description = COMPOUND_STRING(
            "Floods the field with boiling\n"
            "toxic fondue. May burn."),
        .effect = EFFECT_HIT,
        .power = 185,
        .type = TYPE_POISON,
        .accuracy = 0,
        .pp = 1,
        .target = TARGET_SELECTED,
        .priority = 0,
        .category = DAMAGE_CATEGORY_SPECIAL,
        .additionalEffects = ADDITIONAL_EFFECTS({
            .moveEffect = MOVE_EFFECT_BURN,
            .chance = 50,
        }),
        .battleAnimScript = gBattleAnimMove_AcidDownpour,
    },

    [MOVE_BIG_BEANIE_HEIST] =
    {
        .name = COMPOUND_STRING("Big Beanie Heist"),
        .description = COMPOUND_STRING(
            "Stuffs the foe's strength into\n"
            "a beanie. Lowers its Attack."),
        .effect = EFFECT_HIT,
        .power = 180,
        .type = TYPE_DARK,
        .accuracy = 0,
        .pp = 1,
        .target = TARGET_SELECTED,
        .priority = 0,
        .category = DAMAGE_CATEGORY_PHYSICAL,
        .additionalEffects = ADDITIONAL_EFFECTS({
            .moveEffect = MOVE_EFFECT_STAT_MINUS,
            .attack = 1,
            .chance = 100,
        }),
        .battleAnimScript = gBattleAnimMove_BlackHoleEclipse,
    },

    [MOVE_HOSTILE_TAKEOVER] =
    {
        .name = COMPOUND_STRING("Hostile Takeover"),
        .description = COMPOUND_STRING(
            "The boss buys out the battle.\n"
            "The foe can't escape."),
        .effect = EFFECT_HIT,
        .power = 185,
        .type = TYPE_STEEL,
        .accuracy = 0,
        .pp = 1,
        .target = TARGET_SELECTED,
        .priority = 0,
        .category = DAMAGE_CATEGORY_PHYSICAL,
        .additionalEffects = ADDITIONAL_EFFECTS({
            .moveEffect = MOVE_EFFECT_PREVENT_ESCAPE,
            .chance = 100,
        }),
        .battleAnimScript = gBattleAnimMove_CorkscrewCrash,
    },

    [MOVE_MILKY_WAY_DELUGE] =
    {
        .name = COMPOUND_STRING("Milky Way Deluge"),
        .description = COMPOUND_STRING(
            "A downpour of starry milk.\n"
            "Restores half the damage."),
        .effect = EFFECT_HIT,
        .power = 185,
        .type = TYPE_FAIRY,
        .accuracy = 0,
        .pp = 1,
        .target = TARGET_SELECTED,
        .priority = 0,
        .category = DAMAGE_CATEGORY_SPECIAL,
        .healingMove = B_HEAL_BLOCKING >= GEN_6,
        .additionalEffects = ADDITIONAL_EFFECTS({
            .moveEffect = MOVE_EFFECT_ABSORB,
            .argument.absorbPercentage = 50,
        }),
        .battleAnimScript = gBattleAnimMove_TwinkleTackle,
    },

    [MOVE_VENI_VIDI_VICI] =
    {
        .name = COMPOUND_STRING("Veni Vidi Vici"),
        .description = COMPOUND_STRING(
            "He came, he saw, he conquered.\n"
            "Lowers the foe's Defense."),
        .effect = EFFECT_HIT,
        .power = 200,
        .type = TYPE_GRASS,
        .accuracy = 0,
        .pp = 1,
        .target = TARGET_SELECTED,
        .priority = 0,
        .category = DAMAGE_CATEGORY_PHYSICAL,
        .additionalEffects = ADDITIONAL_EFFECTS({
            .moveEffect = MOVE_EFFECT_STAT_MINUS,
            .defense = 1,
            .chance = 100,
        }),
        .battleAnimScript = gBattleAnimMove_BloomDoom,
    },

    [MOVE_SATISFYING_SWIPE] =
    {
        .name = COMPOUND_STRING("Satisfying Swipe"),
        .description = COMPOUND_STRING(
            "Red lightning claws that just\n"
            "satisfy. May paralyze."),
        .effect = EFFECT_HIT,
        .power = 195,
        .type = TYPE_DARK,
        .accuracy = 0,
        .pp = 1,
        .target = TARGET_SELECTED,
        .priority = 0,
        .category = DAMAGE_CATEGORY_PHYSICAL,
        .criticalHitStage = 2,
        .additionalEffects = ADDITIONAL_EFFECTS({
            .moveEffect = MOVE_EFFECT_PARALYSIS,
            .chance = 30,
        }),
        .battleAnimScript = gBattleAnimMove_GigavoltHavoc,
    },
