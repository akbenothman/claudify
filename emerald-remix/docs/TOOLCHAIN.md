# Toolchain

## Base project

**[rh-hideout/pokeemerald-expansion](https://github.com/rh-hideout/pokeemerald-expansion)** is built on top of
[pret/pokeemerald](https://github.com/pret/pokeemerald). We chose it over vanilla pokeemerald because Gen 4–9 species,
moves and abilities, modern mechanics, followers, a debug menu, a battle test framework and a `make release`
target all come for free. To start it, clone it with full history; their README warns against "Download ZIP"
because that breaks future upstream merges.

```sh
git clone https://github.com/rh-hideout/pokeemerald-expansion emerald-remix
cd emerald-remix
git remote rename origin upstream
git remote add origin git@github.com:<you>/emerald-remix.git
git checkout -b main <latest-release-tag>   # build off a tagged release, not master
git push -u origin main
```

Pulling RHH fixes later is `git fetch upstream && git merge <newer-release-tag>`.

## Tools

| Tool | Use |
|---|---|
| `arm-none-eabi-gcc` (devkitARM or distro package), `make`, `libpng` | Building. See the expansion's `INSTALL.md` (Linux, macOS, WSL) |
| **[Porymap](https://github.com/huderlem/porymap)** | Map editor: layouts, NPCs, warps, wild encounters |
| **[Poryscript](https://github.com/huderlem/poryscript)** | Readable scripting language for events and dialogue that compiles to the game's script format |
| **mGBA** | Desktop emulator with a debugger, memory viewer, and save states. Use it for daily testing |
| **Aseprite / LibreSprite / GraphicsGale** | Pixel art. Export **indexed PNG, 16 colors** |
| **[Flips](https://github.com/Alcaro/Flips)** | Makes the `.bps` patch (`flips --create clean.gba remix.gba remix.bps`) |
| **[ROM Patcher JS](https://www.marcrobledo.com/RomPatcher.js/)** | Applies the patch in a browser, including Safari on iPhone |

## Where things live in the source

| You want to change | Look in |
|---|---|
| Game rules / features | `include/config/*.h` |
| Species stats, types, abilities, Dex | `src/data/pokemon/species_info/` |
| Learnsets | `src/data/pokemon/` (level-up / TM / tutor tables) |
| Sprites | `graphics/pokemon/<species>/` (`front.png`, `back.png`, `icon.png`, `footprint.png`, `normal.pal`, `shiny.pal`) |
| Moves | `src/data/moves_info.h`, battle scripts in `data/battle_scripts_*.s`, animations in `data/battle_anim_scripts.s` |
| Trainers | `src/data/trainers.party` |
| Wild encounters | `src/data/wild_encounters.json` (or Porymap) |
| Maps & map scripts/dialogue | `data/maps/<MapName>/` (`map.json`, `scripts.inc` or `scripts.pory`) |
| Battle tests | `test/` (`make check`) |

Exact paths move between expansion versions. Check the version we pin.

## CI

GitHub Actions on every push runs `make release` and `make check`. It then builds the `.bps` patch against a clean
ROM stored as a **repository secret** (base64), and uploads only the patch as an artifact. The ROM is never
committed and never published.
