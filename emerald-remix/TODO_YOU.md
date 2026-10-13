# Your to-do list

These are the decisions and art only you can supply. Answer in any order, as briefly as you like. "Default"
is what Claude will do if you'd rather not decide. Claude's side of the work is in [ROADMAP.md](ROADMAP.md),
which points back to these numbers.

Mark one done by changing `[ ]` to `[x]` and writing your answer underneath.

---

## Needed now (blocks M1/M2)

- [ ] **Y1. Create an empty private GitHub repo** (e.g. `emerald-remix`) and tell Claude the name.
      The project moves there from its current folder.
- [ ] **Y2. Upload your clean Pokémon Emerald (USA) ROM**, dumped from your own cartridge. Claude uses it
      only to make the `.bps` patch you'll apply on your phone; it never goes in the repo.
- [ ] **Y3. Your rival.** Keep May/Brendan as they are, rename them, or make the rival one of your friends?
      *Default: keep May/Brendan, rewrite some of their lines to mention the new starters.*
- [ ] **Y4. Back sprites for all 9 starters** in Gemini, using the back-sprite prompt in
      [docs/ART_PROMPTS.md](docs/ART_PROMPTS.md). Upload them here like the fronts.
- [ ] **Y5. Shiny colors.** One line per evolution line.
      *Default: Heesh line white fur + gold jersey; Omar line red beanie; Ahmed line white suit.*

## Characters and story

- [ ] **Y6. New characters?** Who are they (friends, inside jokes, rivals), where do they show up, and do
      they battle? A rough list is enough, e.g. "X runs the Slateport market and sells stolen goods".
- [ ] **Y7. Safety Zone.** Should Ahmexec's company exist in the world (a building, guards, a boss
      fight)? *Default: a small Safety Zone office in Mauville with one trainer battle.*
- [ ] **Y8. The villains.** Keep Team Aqua and Team Magma, rename them, or replace them with something
      else? *Default: keep them.*
- [ ] **Y9. Main plot changes.** Same story as Emerald with new jokes and dialogue, or a different goal
      or ending? *Default: same story, new dialogue.*
- [ ] **Y10. Gym leaders and Elite Four.** Keep the originals, swap any for your own characters, or
      change their types? *Default: keep them, new teams.*

## Pokémon

- [ ] **Y11. Wild Pokémon.** Which real Pokémon (any generation) do you want to find, and roughly where?
      Favorites, must-haves, any to remove? *Default: Claude mixes Gen 4–9 into every route, keeping
      each area's feel.*
- [ ] **Y12. More original Pokémon?** Names and ideas, like you did for the starters. Each one needs
      art from you. *Default: none until v0.2.*

## Title screen and intro

- [ ] **Y13. The hack's name** (shown on the title screen and in the patch). *Default: "Emerald Remix".*
- [ ] **Y14. Title screen.** Keep Rayquaza, or put one of the starters (e.g. Omarauder) on it? A new logo
      means one Gemini image from you. *Default: new name on the logo, Rayquaza stays.*
- [ ] **Y15. Professor Birch's intro.** He shows off Lotad during the opening speech; use one of the
      starters instead? *Default: Squeesh.*

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
