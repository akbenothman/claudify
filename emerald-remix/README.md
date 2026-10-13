# Emerald Remix

A Pokémon Emerald ROM hack with new Pokémon, moves, sprites and dialogue, playable on an iPhone through the **Delta** emulator.

> This folder holds the plan. It is meant to become its own repository. See
> [Moving this into its own repo](#moving-this-into-its-own-repo).

## How it works, in one paragraph

We don't hex-edit a ROM. We build on **[pokeemerald-expansion](https://github.com/rh-hideout/pokeemerald-expansion)**
(maintained by the ROM Hacking Hideout, "RHH"), which is the community's upgraded version of
**[pret/pokeemerald](https://github.com/pret/pokeemerald)**, a full decompilation of Emerald back into C source.
We edit C, data tables, scripts and PNGs like any other software project, run `make`, and get a `.gba` file.
To share it legally, we ship a small **`.bps` patch** that people apply to their own Emerald ROM. On iPhone,
you patch it in the browser, save the `.gba` to Files, and import it into Delta.

## Docs

| File | What's in it |
|---|---|
| [ROADMAP.md](ROADMAP.md) | **Claude's roadmap:** milestones, status, what's next |
| [TODO_YOU.md](TODO_YOU.md) | **Your to-do list:** decisions, questions and art only you can supply |
| [docs/SCOPE.md](docs/SCOPE.md) | What we can change, what each change costs, the hard limits |
| [docs/TOOLCHAIN.md](docs/TOOLCHAIN.md) | Tools, build setup, repo layout |
| [docs/DELTA_IOS.md](docs/DELTA_IOS.md) | Getting the hack onto an iPhone and testing it in Delta |
| [docs/STARTERS.md](docs/STARTERS.md) | The three starter lines: Heesh, Omar, Ahmed |
| [docs/ART_PROMPTS.md](docs/ART_PROMPTS.md) | Gemini prompts and workflow for the sprite art |
| [docs/BUILDING.md](docs/BUILDING.md) | Building the game from pokeemerald-expansion, testing it headless |

## Ground rules

- **Never commit a ROM** (`*.gba`, `*.sav`) to this repo. Only source and `.bps` patches.
- Keep the repo **private** until there's a reason to change that; it's derived from Nintendo/Game Freak's game.
- Never charge money for the hack, and don't take donations for it either.
- Test on **mGBA** (desktop) every change, and on **Delta** (iPhone) at every milestone.

## Moving this into its own repo

The session that wrote this couldn't create GitHub repos. To split it out:

1. Create an empty private repo on GitHub, e.g. `emerald-remix`.
2. Ask Claude to attach it to a session. Phase 0 of the roadmap then seeds it from pokeemerald-expansion
   and copies these docs in.
