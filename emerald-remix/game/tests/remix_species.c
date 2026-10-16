// Emerald Remix: data checks for the starter lines (non-battle tests).
// Run with: make check TESTS="Remix"
#include "global.h"
#include "data.h"
#include "event_data.h"
#include "test/test.h"
#include "constants/opponents.h"

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

