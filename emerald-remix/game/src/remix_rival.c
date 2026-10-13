// Emerald Remix: Wally, the second rival, battles with the third starter: the one neither you
// nor May picked. In trainers.party his teams list a Heesh-line Pokémon as a placeholder; it's
// swapped for the same stage of the leftover line before the party is generated, so moves, stats
// and name all match the real species.
#include "global.h"
#include "data.h"
#include "event_data.h"
#include "remix.h"
#include "constants/opponents.h"
#include "constants/species.h"
#include "constants/vars.h"

// Same order as Birch's bag: VAR_STARTER_MON is the index of the player's pick.
static const u16 sStarterLines[3][3] =
{
    { SPECIES_SQUEESH,  SPECIES_HEESH, SPECIES_HEESHEF },
    { SPECIES_BEANITO,  SPECIES_OMAR,  SPECIES_OMARAUDER },
    { SPECIES_GUARDPUP, SPECIES_AHMED, SPECIES_AHMEXEC },
};

static const u16 sWallyTrainers[] =
{
    TRAINER_WALLY_MAUVILLE,
    TRAINER_WALLY_VR_1,
    TRAINER_WALLY_VR_2,
    TRAINER_WALLY_VR_3,
    TRAINER_WALLY_VR_4,
    TRAINER_WALLY_VR_5,
};

static bool32 IsWally(const struct Trainer *trainer)
{
    for (u32 i = 0; i < ARRAY_COUNT(sWallyTrainers); i++)
    {
        if (trainer == GetTrainerStructFromId(sWallyTrainers[i]))
            return TRUE;
    }
    return FALSE;
}

const struct TrainerMon *Remix_TrainerMon(const struct Trainer *trainer, const struct TrainerMon *mon, struct TrainerMon *scratch)
{
    if (!IsWally(trainer))
        return mon;
    for (u32 stage = 0; stage < 3; stage++)
    {
        if (mon->species != sStarterLines[0][stage])
            continue;
        // The player has line p, May has the line that beats it (p + 1), Wally gets the last one.
        u32 thirdLine = (VarGet(VAR_STARTER_MON) + 2) % 3;
        *scratch = *mon;
        scratch->species = sStarterLines[thirdLine][stage];
        return scratch;
    }
    return mon;
}
