# Claude's roadmap

This is **the work Claude does**: code, data, scripts, sprite conversion, testing. The decisions and
art that come from you are in **[TODO_YOU.md](TODO_YOU.md)**. When an item here waits on one of
yours, it says so with its number, e.g. *(waits on Y3)*.

Every milestone ends with a game that builds, boots and has been played through in an emulator.

---

## M1: Starters, done properly ← **we are here**

Make the three starter lines feel like they were always part of Emerald.

- [x] 9 species: stats, types, abilities, Pokédex text, sprites, icons, level-up moves, TM/tutor moves
- [x] Signature moves at level 26: Toxic Fondue, Sticky Fingers, Lockdown
- [x] Squeesh, Beanito and Guardpup are the three choices in Birch's bag
- [x] **Rival gets the starter that beats yours** in all 30 rival battles (Squeesh → rival Beanito,
      Beanito → rival Guardpup, Guardpup → rival Squeesh), stage for stage
- [x] Starters are **Hoenn Pokédex #001–009** (the old starters can't be caught, so leaving them in the
      Hoenn dex would have made the Pokédex diploma impossible)
- [x] Petalburg Pokémon Center NPC explains your starter's real types
- [x] **Second rival: Wally battles with the third starter**, the one neither you nor May has, in his
      Mauville fight (Lv 15 next to his Ralts) and at Victory Road and its rematches (final form, in place of
      Delcatty). A small hook (`game/src/remix_rival.c`) picks the line at battle time, so it costs no extra
      trainer slots. Those are scarce: only 9 are left before the save file runs out of trainer flags
- [x] Automated tests: signature moves, the type triangle, evolution levels, Pokédex numbers. The
      expansion's full suite (5,868 tests) also passes with our changes
- [x] Played each starter through the first rival battle in the emulator: all three win by just using
      their first move every turn, like the original. Two balance fixes came out of it: Guardpup now gets
      Intimidate on evolving (Inner Focus before that), and Beanito learns Sand Attack at 9 instead of 4
- [ ] Balance check: each starter against the rival and gyms 1–4 (notes below)
- [x] Real back sprites from your Gemini art, drawn with each Pokémon's front palette (the game shares one
      palette between them), checked in battle
- [x] Bigger sprites: evolved forms are zoomed and cut off at the bottom like Gen 3's big Pokémon, backs
      fill the frame, faces redrawn on the new sizes
- [ ] Shiny colors *(waits on Y5)*
- [ ] Menu icons cleaned up by hand

**Early balance notes** (to verify in play):

| Starter | Roxanne (Rock) | Brawly (Fighting) | Wattson (Electric) | Flannery (Fire) |
|---|---|---|---|---|
| Squeesh / Heesh | Hard: Poison and Fire are both resisted | Easy: Poison resists Fighting | Even | Easy: Fire resists Fire |
| Beanito / Omar | Even | **Hard: Dark is weak to Fighting** | Even | Even |
| Guardpup / Ahmed | **Easy: Fighting beats Rock** | Even | Even | Even (Ahmexec is weak to it later) |

Vanilla Emerald has the same kind of spread (Torchic struggles with Roxanne), so this is fine as long as
each route has a Pokémon that covers the hard gym.

## M2: Playable on your phone

- [ ] Your own GitHub repo, with this project and the expansion checkout *(waits on Y1)*
- [ ] CI: build on every push and run the tests. **Workflow written and its steps checked locally**
      ([ci/build.yml](ci/build.yml)); it goes live once the repo exists. It also makes the `.bps` patch
      if your ROM is stored as a repository secret
- [ ] `.bps` patch against your clean ROM *(waits on Y2)*
- [ ] On Delta: start a game, save, quit, reload; check the clock (berries, tides)
- [x] `make release` build (turns off the debug menu): builds and boots
- [ ] Config pass: battle mechanics generation, EXP share, running shoes, followers *(waits on Y16)*

## M3: Remix: "Emerald, but ours" (v0.1)

Uses art that already exists, so it moves fast once the decisions are in.

- [ ] New wild Pokémon on every route *(waits on Y11)*
- [ ] **New town and city names** everywhere: map names, signs, dialogue, Fly menu *(waits on Y19)*
- [ ] Rebuilt teams for gym leaders, rivals, villain admins, Elite Four and Champion
- [ ] **Important dialogue rewritten**: everything you can't skip (intro, rivals, gyms, villains, Elite
      Four, ending) *(waits on Y9, Y21)*
- [ ] Title screen and intro *(waits on Y13–Y15)*
- [ ] Items and shops
- [ ] Full playthrough in the emulator, then on Delta, with a bug/balance log

## M4: Originals (v0.2)

- [ ] **At least 10 new Pokémon lines** through the same pipeline as the starters: design doc, Gemini
      prompts, conversion, data, Pokédex, placement in the world *(waits on Y12, plus art)*
- [ ] **Legendary cat trio** (Snickers, Haleeb, and the lion): front sprites converted; species data, back
      sprites and placement next *(waits on Y22, plus back art)*
- [ ] **Digimon**, built the same way *(waits on Y20, plus art)*
- [ ] **New aces for the gym leaders**, taken from the new lines and Digimon *(waits on Y10)*
- [ ] More custom moves, with a test for each
- [ ] Overworld follower sprites, if followers are on

## M5: Story and world (v0.3)

- [x] Tooling for the cast swap: rewritten scenes live in `game/text/*.inc`, names are renamed everywhere
      they appear in text, and `tools/text_width.py` checks every line fits the textbox
- [x] **Professor Mo** replaces Professor Birch: name everywhere, intro speech (with his Omar), Route 101
      rescue, the lab scenes, and the Champion ending
- [ ] **The whole cast swapped**: every named NPC, the gym leaders, Elite Four, Champion and the villain
      team's leaders get new names, lines and (where you supply art) new looks *(waits on Y3, Y6, Y8, Y10)*
- [ ] New events and scenes in Poryscript *(waits on Y6–Y9)*
- [ ] 1–3 new areas built from existing tilesets
- [ ] New trainer sprites for new characters (Gemini, same conversion pipeline as the Pokémon)

## M6: Release (v1.0)

- [ ] 2–3 friends playtest on their phones
- [ ] Fix list, release notes, final `.bps`

---

## Time estimates

| Milestone | Claude's part | Your part |
|---|---|---|
| M1 | nearly done | 9 back sprites in Gemini, about 2–4 hrs |
| M2 | a few hours | Create repo, upload ROM, test on phone: about 1 hr |
| M3 | 30–60 hrs | Answer TODO_YOU questions, playtest: 10–20 hrs |
| M4 | 1–2 hrs per line; 15–25 hrs for 10+ lines and Digimon | Art: ~30–40 Pokémon in Gemini, about 1 hr each with fixes |
| M5 | 20–80 hrs | Story decisions, playtest |
| M6 | a few hours | Playtest with friends |

How it's built: [docs/BUILDING.md](docs/BUILDING.md). What's possible: [docs/SCOPE.md](docs/SCOPE.md).
