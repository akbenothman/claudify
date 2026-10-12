# What we can change, and what it costs

## The short version

On top of pokeemerald-expansion, **almost anything gameplay-side is fair game**: Pokémon, moves, abilities, items,
trainers, maps, dialogue, story events, and battle mechanics. The engine already includes **every species through
Gen 9** (1,000+), plus their moves, abilities, Mega Evolution, Z-Moves, a Gen 5+ damage formula, followers, and
lots of quality-of-life features, all switchable in config files. A lot of "new stuff" is just turning on
what already exists.

The real limits are **art time** and **a handful of hardware constraints**, not code.

## Cost per change

Ballpark hours for one person working with Claude. "Art" is the part that's on you (or an artist). Claude can
draft placeholder sprites, but not polished pixel art.

| Change | Code/data | Art | Notes |
|---|---|---|---|
| Change a config option (mechanics, QoL) | 0.1–0.5 h | none | `include/config/*.h` |
| Put an existing Gen 4–9 Pokémon on a route | 0.1 h | none | Sprites already in the expansion |
| Rebuild one trainer's team | 0.1–0.3 h | none | `trainers.party` (Showdown format) |
| Rewrite one NPC's dialogue | 0.1–0.5 h | none | ~2 lines × ~36 characters per text box |
| Rebalance a species (stats/types/learnset) | 0.2–0.5 h | none | |
| **New original Pokémon (fakemon)** | 1–2 h | **4–15 h** | Front + back sprite 64×64, icon 32×32 (2 frames), footprint 16×16, 16-color palette + shiny palette, Dex text. A follower sprite adds 2–6 h |
| New move that reuses an existing effect + animation | 0.3–1 h | none | |
| New move with a **new effect** | 2–6 h | none | C in the battle engine, plus a battle test |
| New move animation | 2–10 h | 0–4 h | Animation scripting is fiddly |
| New ability | 2–8 h | none | |
| New type | 6–15 h | 1–2 h | Touches a lot of tables and UI |
| New map (existing tileset) | 2–6 h | none | Porymap: layout, warps, encounters, NPCs |
| New tileset / building style | 2 h | 10–40 h | Hardware palette and tile-count limits apply |
| New scripted event / quest | 1–6 h | none | Poryscript |
| New trainer class sprite | 0.5 h | 3–8 h | |
| New region | — | — | Hundreds of hours. Out of scope |

## Three sizes of project

| Tier | What you get | Hours | Calendar (8 h/wk) |
|---|---|---|---|
| **1. Remix** *(recommended start)* | Gen 1–9 roster, new teams, rebalanced, modern mechanics, major dialogue rewritten | 50–100 | 1.5–3 months |
| **2. Custom** *(recommended target)* | Tier 1 + 10–20 original Pokémon, 15–30 new moves (a few with custom effects), 1–3 new areas, rewritten story beats | 150–350 | 5–10 months |
| **3. Total conversion** | New region, new story, new tilesets | 1,000–3,000+ | 2–5 years. Most of these never finish |

## Hard limits (the GBA says no)

- **ROM size: 32 MB max.** The expansion with all species fits, and dozens of new species with full art still fit.
  This is not a practical problem for Tier 1–2.
- **Save data: 128 KB of flash.** New *persistent* state (flags, variables, new storage features) has to fit
  in the save blocks. The expansion frees up some space, but a feature like "a second PC box system" is a
  real engineering task. One-off event flags are fine.
- **Sprites: 16 colors per palette** (15 plus transparent), at fixed sizes. Detailed Gen 8/9-style art has to be
  re-pixeled by hand. You can't just downscale it.
- **Tilesets:** a limited number of tiles and palettes per primary/secondary tileset. New towns are easiest when
  they reuse existing tilesets.
- **Text:** small text boxes and a limited character set. Long scenes become many boxes.
- **Audio:** new music is possible (MIDI → the GBA's sound engine) but takes a lot of skill. Plan on reusing
  existing tracks.

## What Claude is good at vs. what's on you

| Claude handles well | On you |
|---|---|
| Species/move/trainer/learnset data | Final pixel art and palettes |
| C code: new move effects, abilities, mechanics | Deciding the vision: which Pokémon, what story |
| Poryscript events and all dialogue drafts | Playtesting on the phone and judging feel/difficulty |
| Balancing passes, encounter tables | Approving dialogue tone |
| Converting/indexing PNGs, palette fixes | |
| Build, CI, patch generation, battle tests | |

## Legal / sharing

- Distribute only a **`.bps` patch**, never a `.gba` file. Players supply their own Emerald ROM.
- Don't charge for it, and don't monetize it. Nintendo has taken down monetized and high-profile fan
  games before; small free patch-only hacks are the long-standing community norm, but the risk is never zero.
