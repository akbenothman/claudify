// Emerald Remix: tests for the starter lines and their signature moves.
// Run with: make check TESTS="Remix"
#include "global.h"
#include "test/battle.h"

SINGLE_BATTLE_TEST("Remix: Toxic Fondue can burn the target")
{
    GIVEN {
        ASSUME(MoveHasAdditionalEffectWithChance(MOVE_TOXIC_FONDUE, MOVE_EFFECT_BURN, 30) == TRUE);
        ASSUME(GetMoveType(MOVE_TOXIC_FONDUE) == TYPE_POISON);
        ASSUME(GetMoveCategory(MOVE_TOXIC_FONDUE) == DAMAGE_CATEGORY_SPECIAL);
        PLAYER(SPECIES_HEESHEF);
        OPPONENT(SPECIES_WOBBUFFET);
    } WHEN {
        TURN { MOVE(player, MOVE_TOXIC_FONDUE); }
    } SCENE {
        ANIMATION(ANIM_TYPE_MOVE, MOVE_TOXIC_FONDUE, player);
        HP_BAR(opponent);
        ANIMATION(ANIM_TYPE_STATUS, B_ANIM_STATUS_BRN, opponent);
        STATUS_ICON(opponent, burn: TRUE);
    }
}

SINGLE_BATTLE_TEST("Remix: Sticky Fingers steals the target's held item")
{
    GIVEN {
        ASSUME(GetMoveEffect(MOVE_STICKY_FINGERS) == EFFECT_STEAL_ITEM);
        PLAYER(SPECIES_OMARAUDER);
        OPPONENT(SPECIES_WOBBUFFET) { Item(ITEM_HYPER_POTION); }
    } WHEN {
        TURN { MOVE(player, MOVE_STICKY_FINGERS); }
    } SCENE {
        ANIMATION(ANIM_TYPE_MOVE, MOVE_STICKY_FINGERS, player);
        HP_BAR(opponent);
        ANIMATION(ANIM_TYPE_GENERAL, B_ANIM_ITEM_STEAL, opponent);
    } THEN {
        EXPECT_EQ(player->item, ITEM_HYPER_POTION);
        EXPECT_EQ(opponent->item, ITEM_NONE);
    }
}

SINGLE_BATTLE_TEST("Remix: Lockdown stops the target from escaping")
{
    GIVEN {
        ASSUME(MoveHasAdditionalEffectWithChance(MOVE_LOCKDOWN, MOVE_EFFECT_PREVENT_ESCAPE, 100) == TRUE);
        PLAYER(SPECIES_AHMEXEC);
        OPPONENT(SPECIES_WOBBUFFET);
    } WHEN {
        TURN { MOVE(player, MOVE_LOCKDOWN); }
    } SCENE {
        ANIMATION(ANIM_TYPE_MOVE, MOVE_LOCKDOWN, player);
        HP_BAR(opponent);
    } THEN {
        EXPECT(opponent->volatiles.escapePrevention);
    }
}

// The type triangle: each final form's STAB hits the next one super-effectively.
SINGLE_BATTLE_TEST("Remix: the starter triangle runs Omarauder > Heeshef > Ahmexec > Omarauder")
{
    enum Species attacker, defender;
    enum Move move;
    bool32 quadruple;
    // Ground is 4x on Poison/Fire, which the expansion calls "extremely effective".
    PARAMETRIZE { attacker = SPECIES_OMARAUDER; move = MOVE_EARTHQUAKE;   defender = SPECIES_HEESHEF;   quadruple = TRUE; }
    PARAMETRIZE { attacker = SPECIES_HEESHEF;   move = MOVE_FLAMETHROWER; defender = SPECIES_AHMEXEC;   quadruple = FALSE; }
    PARAMETRIZE { attacker = SPECIES_AHMEXEC;   move = MOVE_CLOSE_COMBAT; defender = SPECIES_OMARAUDER; quadruple = FALSE; }
    GIVEN {
        PLAYER(attacker);
        OPPONENT(defender);
    } WHEN {
        TURN { MOVE(player, move); }
    } SCENE {
        ANIMATION(ANIM_TYPE_MOVE, move, player);
        HP_BAR(opponent);
        if (quadruple)
            MESSAGE("It's extremely effective!");
        else
            MESSAGE("It's super effective!");
    }
}
