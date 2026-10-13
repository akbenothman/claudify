# Roadmap

Estimates are **hours of focused work by one hobbyist working with Claude**. Claude writes most of the code,
data, scripts and dialogue. The person does the art, playtesting, and taste calls.
At **~8 hrs/week**, divide the hours by 8 to get weeks.

The plan is built so **every phase ends with a playable, complete game**. You can stop after any phase and still
have something finished to play on Delta.

---

## Phase 0: Foundation (6–12 hrs, about 1 week)

Goal: an unmodified build of pokeemerald-expansion running on your iPhone.

> **Status:** the game builds from pokeemerald-expansion 1.17.1 with the nine new starters, their
> signature moves and Pokédex entries, verified in an emulator. See [docs/BUILDING.md](docs/BUILDING.md).
> Still open: the GitHub repo, CI, the `.bps` patch, testing on Delta, and the config pass.

- [ ] Create the GitHub repo and seed it from `rh-hideout/pokeemerald-expansion`. Keep the full history and
      add RHH as the `upstream` remote so we can pull their bug fixes later.
- [x] Install the toolchain (see [TOOLCHAIN.md](docs/TOOLCHAIN.md)): `arm-none-eabi-gcc`, `make`, `libpng`, Porymap, mGBA.
- [x] The game builds and boots in mGBA (debug build; `make release` still to check).
- [x] **Starters in the game:** Squeesh, Beanito and Guardpup replace Treecko, Torchic and Mudkip, and all nine
      species, their Dex entries and their three signature moves are in.
- [ ] Add a GitHub Actions workflow that builds every push and attaches a `.bps` patch as an artifact.
- [ ] Patch your own Emerald ROM, import it into Delta, play 15 minutes, save, quit, and reload. Check that the
      save and the clock both work (see [DELTA_IOS.md](docs/DELTA_IOS.md)).
- [ ] Go through `include/config/*.h` and pick our settings: Gen-3 or Gen-9 battle mechanics, physical/special
      split, EXP share, running indoors, followers on/off, etc. This is the cheapest high-impact step in the project.

**Exit:** You can play the base hack on your phone, and CI builds a patch on every push.

## Phase 1: Design doc (4–8 hrs)

Before we build anything, write down what the game *is*. Content creep kills most ROM hacks.

- [ ] One-paragraph pitch: what's different, and why someone would replay Emerald for it.
- [ ] Pokémon list: which real Pokémon from Gen 4–9 appear (cheap), and how many original "fakemon" (expensive).
- [ ] Move list: new moves, and for each one whether it reuses an existing effect.
- [ ] Story changes: which characters get rewritten dialogue, and any new scenes.
- [ ] Encounter tables per route, plus gym leader and Elite Four teams.
- [ ] Decide which tier we're targeting (see [SCOPE.md](docs/SCOPE.md#three-sizes-of-project)).

**Exit:** `docs/DESIGN.md` exists, and we've agreed on a tier.

## Phase 2: Remix: "Emerald, but ours" (40–80 hrs, about 1–2.5 months)

Everything here uses assets that already exist. No new art needed.

- [ ] **Wild encounters**: rewrite `src/data/wild_encounters.json` (or edit in Porymap) to mix in Gen 4–9 Pokémon.
- [ ] **Trainers**: rebuild every gym leader, rival, Aqua/Magma admin and Elite Four team. The expansion's
      Showdown-style `trainers.party` format makes this fast.
- [ ] **Learnsets / TMs / tutors**: adjust them for the new roster.
- [ ] **Dialogue pass 1**: rewrite major NPCs (rival, Birch, gym leaders, Archie/Maxie, Steven, Wally).
      Roughly 150–300 text boxes.
- [ ] **Items & shops**: place new items, change shop stock.
- [ ] **Balance playthrough**: play from start to credits on Delta and keep a bug/balance log.

**Exit (v0.1):** A complete, balanced, rewritten-dialogue Emerald with a new Pokémon roster. You could release this on its own.

## Phase 3: Originals: new Pokémon, moves, sprites (80–200 hrs, about 2.5–6 months)

This is the phase where art is the bottleneck. Do a single fakemon all the way through first,
then run the rest in batches.

- [ ] **Pipeline test**: one original Pokémon end to end. That means its species data, front/back/icon/footprint
      sprites, normal and shiny palettes, Pokédex entry, cry (reuse one), learnset, evolution, and a spot on a
      route. **Time this** and use it to re-estimate the rest.
- [ ] **Fakemon batch 1**: 5–10 species, including their evolution lines.
- [ ] **New moves batch 1**: 10–20 moves. Most reuse existing effects and animations (cheap). Pick 3–5 to get
      custom effects and animations (expensive).
- [ ] **(Optional) new ability or two**: C code in the battle engine.
- [ ] **(Optional) follower sprites** for the new species, if followers are on.
- [ ] Battle tests: the expansion has a test framework (`make check`). Write tests for every new move effect.

**Exit (v0.2):** The new Pokémon and moves show up throughout the game and have been tested in real battles.

## Phase 4: Story & world additions (40–150 hrs, optional)

- [ ] **Dialogue pass 2**: rewrite the remaining NPCs, signs, and flavor text.
- [ ] **New side areas**: 1–3 new maps (a cave, an island, a post-game zone) built in Porymap from existing tilesets.
- [ ] **New events**: a few scripted scenes or quests, written in Poryscript.
- [ ] **New trainer sprites / overworld sprites** if new characters are introduced.
- [ ] **Title screen / intro** tweaks.

**Exit (v0.3):** The game has things to do that the original never had.

## Phase 5: Polish & release (15–30 hrs)

- [ ] 2–3 outside playtesters on Delta, plus at least one on a different emulator (mGBA, or My Boy! on Android).
- [ ] Fix-it list from the testers.
- [ ] Release notes, a `.bps` patch, and the clean-ROM checksum people need to match.
- [ ] Tag `v1.0`.

---

## Totals

| Stop after | Hours | At 8 hrs/week | At 15 hrs/week |
|---|---|---|---|
| Phase 2 (Remix) | ~50–100 | 1.5–3 months | 1–1.5 months |
| Phase 3 (+ originals) | ~130–300 | 4–9 months | 2–5 months |
| Phase 5 (full v1.0) | ~185–480 | 6–14 months | 3–8 months |

The biggest variable is **how many original sprites you draw, and how fast**. Everything else is mostly work
Claude can do quickly.
