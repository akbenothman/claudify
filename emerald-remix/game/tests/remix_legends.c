// Emerald Remix: the legendary cats in Kyogre's, Groudon's and Rayquaza's slots (game/legends.py).
// Run with: make check TESTS="Remix"
#include "global.h"
#include "data.h"
#include "pokemon.h"
#include "test/test.h"

TEST("Remix: legendary cats replace the weather trio")
{
    EXPECT_EQ(GetSpeciesType(SPECIES_KYOGRE, 0), TYPE_FAIRY);
    EXPECT_EQ(GetSpeciesType(SPECIES_KYOGRE, 1), TYPE_FLYING);
    EXPECT_EQ(GetSpeciesType(SPECIES_GROUDON, 0), TYPE_GRASS);
    EXPECT_EQ(GetSpeciesType(SPECIES_GROUDON, 1), TYPE_GROUND);
    EXPECT_EQ(GetSpeciesType(SPECIES_RAYQUAZA, 0), TYPE_DARK);
    EXPECT_EQ(GetSpeciesType(SPECIES_RAYQUAZA, 1), TYPE_ELECTRIC);
}

TEST("Remix: legendary cats keep the weather abilities the story relies on")
{
    EXPECT_EQ(GetSpeciesAbility(SPECIES_KYOGRE, 0), ABILITY_DRIZZLE);
    EXPECT_EQ(GetSpeciesAbility(SPECIES_GROUDON, 0), ABILITY_DROUGHT);
    EXPECT_EQ(GetSpeciesAbility(SPECIES_RAYQUAZA, 0), ABILITY_AIR_LOCK);
}
