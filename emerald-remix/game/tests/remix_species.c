// Emerald Remix: data checks for the starter lines (non-battle tests).
// Run with: make check TESTS="Remix"
#include "global.h"
#include "data.h"
#include "event_data.h"
#include "remix.h"
#include "test/test.h"
#include "constants/opponents.h"
#include "constants/vars.h"

TEST("Remix: starters evolve at levels 16 and 36")
{
    enum Species from, to;
    u32 level;
    PARAMETRIZE { from = SPECIES_SQUEESH;  to = SPECIES_HEESH;     level = 16; }
    PARAMETRIZE { from = SPECIES_HEESH;    to = SPECIES_HEESHEF;   level = 36; }
    PARAMETRIZE { from = SPECIES_BEANITO;  to = SPECIES_OMAR;      level = 16; }
    PARAMETRIZE { from = SPECIES_OMAR;     to = SPECIES_OMARAUDER; level = 36; }
    PARAMETRIZE { from = SPECIES_GUARDPUP; to = SPECIES_AHMED;     level = 16; }
    PARAMETRIZE { from = SPECIES_AHMED;    to = SPECIES_AHMEXEC;   level = 36; }
    const struct Evolution *evo = GetSpeciesEvolutions(from);
    EXPECT_EQ(evo[0].method, EVO_LEVEL);
    EXPECT_EQ(evo[0].param, level);
    EXPECT_EQ(evo[0].targetSpecies, to);
}

TEST("Remix: starters are Hoenn Pokedex #001-009")
{
    EXPECT_EQ(SpeciesToHoennPokedexNum(SPECIES_SQUEESH), 1);
    EXPECT_EQ(SpeciesToHoennPokedexNum(SPECIES_OMARAUDER), 6);
    EXPECT_EQ(SpeciesToHoennPokedexNum(SPECIES_AHMEXEC), 9);
    EXPECT_EQ(SpeciesToHoennPokedexNum(SPECIES_TREECKO), 0);
}

TEST("Remix: Wally battles with the third starter")
{
    u32 playerPick;
    enum Species expected;
    // You pick line p, May gets p + 1 (the line that beats yours), Wally gets the one left over.
    PARAMETRIZE { playerPick = 0; expected = SPECIES_AHMEXEC; }   // you Squeesh, May Beanito
    PARAMETRIZE { playerPick = 1; expected = SPECIES_HEESHEF; }   // you Beanito, May Guardpup
    PARAMETRIZE { playerPick = 2; expected = SPECIES_OMARAUDER; } // you Guardpup, May Squeesh
    struct TrainerMon placeholder = { .species = SPECIES_HEESHEF };
    struct TrainerMon scratch;
    VarSet(VAR_STARTER_MON, playerPick);
    EXPECT_EQ(Remix_TrainerMon(GetTrainerStructFromId(TRAINER_WALLY_VR_1), &placeholder, &scratch)->species, expected);
    // Anyone else's Heesh-line Pokémon is left alone.
    EXPECT_EQ(Remix_TrainerMon(GetTrainerStructFromId(TRAINER_MAY_ROUTE_103_MUDKIP), &placeholder, &scratch)->species, SPECIES_HEESHEF);
}

