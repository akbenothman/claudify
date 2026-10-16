# Your to-do list

These are the decisions and art only you can supply. Answer in any order, as briefly as you like. "Default"
is what Claude will do if you'd rather not decide. Claude's side of the work is in [ROADMAP.md](ROADMAP.md),
which points back to these numbers.

Mark one done by changing `[ ]` to `[x]` and writing your answer underneath.

## Your big goals

From your notes, these are the changes you want the finished game to have. Each one links to the questions
below that Claude needs answered to build it.

| Goal | Questions | Rough size |
|---|---|---|
| At least 10 new Pokémon lines | Y12 | ~30 Pokémon of art from you (front + back each); 1–2 hrs of Claude's work per line |
| Some Digimon | Y20 | Built exactly like the new Pokémon lines |
| New gym leaders, each with a new ace Pokémon | Y10, Y12 | 8 characters, 8 aces, rebuilt teams |
| New Elite Four, Champion and villain-team leaders | Y8, Y10 | 7–9 characters |
| Every NPC and character swapped out | Y3, Y6 | Names and dialogue are cheap; new trainer *sprites* need art |
| New city and town names | Y19 | Cheap: about 16 towns plus their signs and dialogue |
| All important dialogue rewritten | Y9, Y21 | Scenes you can't skip: intro, rivals, gyms, villains, ending |

---

## Needed now (blocks M1/M2)

- [ ] **Y1. Create an empty private GitHub repo** (e.g. `emerald-remix`) and tell Claude the name.
      The project moves there from its current folder.
- [ ] **Y2. Upload your clean Pokémon Emerald (USA) ROM**, dumped from your own cartridge. Claude uses it
      only to make the `.bps` patch you'll apply on your phone; it never goes in the repo.
- [x] **Y3. Your rival.** **Hamza** replaces May/Brendan and has the starter that beats yours. **Yaseen**
      takes Wally's place, without a starter (he catches a Heeshupeeshu). Hamza still wears May's or Brendan's sprite (May's when you play as the boy).
- [x] **Y4. Back sprites for all 9 starters** in Gemini, using the back-sprite prompt in
      [docs/ART_PROMPTS.md](docs/ART_PROMPTS.md). Upload them here like the fronts.
- [ ] **Y5. Shiny colors.** One line per evolution line.
      *Default: Heesh line white fur + gold jersey; Omar line red beanie; Ahmed line white suit.*

## Characters and story

- [ ] **Y6. The new cast.** Started: **Professor Mo** is in the game. The full checklist of who and what
      can be replaced is [docs/REPLACE_LIST.md](docs/REPLACE_LIST.md). You want to swap out every character. Start with the ones players meet most:
      Mom, Steven, Mr. Briney, and the named NPCs in each town.
      For each: a name, one line about who they are, and whether they look different. *Different looks
      need a Gemini sprite each; a new name and new lines with the old look cost nothing.*
- [ ] **Y7. Safety Zone.** Should Ahmexec's company exist in the world (a building, guards, a boss
      fight)? *Default: a small Safety Zone office in Mauville with one trainer battle.*
- [x] **Y8. The villains.** Ahmed's Safety Zone vs Omar's Team Beanie, feuding over money (in the game; see [docs/PLOT.md](docs/PLOT.md)). Still open: three admin names.
- [ ] **Y9. Main plot.** *Draft ready in [docs/PLOT.md](docs/PLOT.md); edit it or answer its questions.* Same story beats as Emerald with your characters and jokes, or a different goal
      or ending? *Default: same beats, new characters and dialogue.*
- [x] **Y10. Gym leaders, Elite Four and Champion: names.** Kareem, Jelal, Sammi B, Nabil, Hisham,
      Adam Jaber, Omar Hafiz & Mo Abdu, Hany; the four Maliks; Hisham as Champion. Still open: their
      types, aces and teams (they use the originals' for now).
- [ ] **Y19. Town and city names.** You want them all renamed. Is there a theme (New York neighborhoods,
      places from your lives, food)? Give some names, and Claude fills in the rest.
      *Default: NYC-inspired names drafted by Claude for you to approve.*
- [ ] **Y21. Dialogue tone.** For the scenes you can't skip: how should it sound (funny, roasting each
      other, serious with jokes)? Any running jokes or catchphrases to include?

## Pokémon

- [ ] **Y11. Wild Pokémon.** Which real Pokémon (any generation) do you want to find, and roughly where?
      Favorites, must-haves, any to remove? *Default: Claude mixes Gen 4–9 into every route, keeping
      each area's feel.*
- [ ] **Y12. At least 10 new Pokémon lines.** For each: a name, a concept (like your starter notes:
      animal, personality, quirks, type) and how many stages. Claude turns them into full designs and Gemini
      prompts, same as the starters. Mark which ones are gym leader aces.
- [x] **Y22. The three legendary cats.** Snickers (claws) replaces Rayquaza, Haleeb (clouds) replaces
      Kyogre, Ceaser (the lion) replaces Groudon. Claude picked their types, keeping the weather
      abilities: see [docs/LEGENDS.md](docs/LEGENDS.md). Change anything you like.
- [ ] **Y23. Back sprites for Snickers, Haleeb and Ceaser** (they use their mirrored fronts for now).
      Ask Gemini for a compact pose seen from behind that fills a square.
- [ ] **Y20. Digimon.** Which ones, and should they appear as wild Pokémon, gym aces, or special
      encounters? Claude makes them Gen 3-style creatures from your Gemini art, like the new lines.
      *Note: Digimon belong to Bandai, so they're in the same gray area as the hack itself. That's fine
      for a free game shared with friends; just don't publish it widely.*

## Title screen and intro

- [ ] **Y13. The hack's name** (shown on the title screen and in the patch). *Default: "Emerald Remix".*
- [ ] **Y14. Title screen.** Keep Rayquaza (now Snickers), or put one of the starters (e.g. Omarauder) on it? A new logo
      means one Gemini image from you. *Default: new name on the logo, Rayquaza stays.*
- [x] **Y15. The professor's intro.** Professor Mo shows off his Omar (and explains why his Ahmed is in
      time-out).

## How the game plays

- [ ] **Y16. Difficulty and features.** Pick any:
      - Battle mechanics: classic Gen 3, or modern (physical/special split by move, Fairy type, newer abilities)?
        *Default: modern. The starters' designs already assume Fairy exists.*
      - Difficulty: normal, harder trainers, or level caps?
      - Pokémon following you on the overworld? (Needs a small overworld sprite per Pokémon.)
      - Quality of life: running shoes from the start, faster text, EXP Share, no HM moves?
        *Default: all on.*

## Testing

- [ ] **Y17. Play the build on Delta** once the patch exists (M2) and tell Claude anything that looks
      or feels off.
- [ ] **Y18. Friends as playtesters.** Who, and do they have iPhones or Android?
