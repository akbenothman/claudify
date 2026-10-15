# The legendary cats

Three legendary cats take over Hoenn's weather trio. Each one **replaces the original in place**: same
species slot, same story events, same encounters. Wherever the game had Kyogre, Groudon or Rayquaza, it
now has these three, in the dialogue too. The data lives in `game/legends.py` and
`game/custom_learnsets.h`, and the sprites in `graphics/legends/`.

| | Haleeb | Ceaser | Snickers |
|---|---|---|---|
| Replaces | Kyogre | Groudon | Rayquaza |
| Look | White cloud cat with storm-cloud wings and a misty halo | Huge sleepy lion with a laurel crown, flowers in its tail | White serpent cat with red lightning claws |
| Type | Fairy / Flying | Grass / Ground | Dark / Electric |
| Ability | Drizzle (its clouds bring rain) | Drought (it brings the summer sun) | Air Lock (calms the other two's weather) |
| Category | Cloud Cat | Sun King | Storm Claw |
| HP / Atk / Def / SpA / SpD / Spe | 110 / 70 / 100 / 150 / 150 / 90 | 100 / 150 / 130 / 90 / 110 / 90 | 105 / 150 / 90 / 130 / 90 / 115 |
| Signature move (Lv 70) | **Milk Shower**: Fairy, special, 80 power; heals her by half the damage dealt ("haleeb" means milk) | **Royal Pounce**: Grass, physical, 90 power; 20% chance to lower Defense | **Storm Claw**: Dark, physical, 85 power; high critical-hit ratio, 20% chance to paralyze |
| Moves at Lv 70 (story level) | Rest, Moonblast, Roost, Milk Shower | Rest, Solar Blade, Synthesis, Royal Pounce | Rest, Crunch, Plasma Fists, Storm Claw |

Base stat totals match the originals (670, 670, 680). The weather abilities are kept on purpose. The
Sootopolis story is about Kyogre's rain and Groudon's sun until Rayquaza stops them, and the scripts,
weather and battles all assume that. Each cat's moves match its weather: Haleeb's Hurricane never misses
in rain, and Ceaser's Solar Blade needs no charging turn in sun.

## What changed in the game

- Name, types, abilities, stats, Pokédex text, size, moves (level-up and TM/tutor), sprites and menu icon
- Every line of dialogue that names them, and the `{KYOGRE}` / `{GROUDON}` text placeholders

## Still the old art (needs new images)

| Where | Size | Notes |
|---|---|---|
| Back sprites | 64×64 | **Placeholders**: the front art mirrored. Send back art and they get swapped in. |
| Story cutscenes: Kyogre and Groudon in Seafloor Cavern, Cave of Origin and Sootopolis | 32×32, 4 frames | Small overworld sprites |
| Rayquaza resting at Sky Pillar | 64×64 | Overworld sprite |
| Rayquaza flying in over Sootopolis | 64×64, 5 frames | Overworld animation |
| The big Sootopolis / Sky Pillar story scenes | full screen | `graphics/rayquaza_scene/`. These are the hardest; they can stay for a while. |
| Title screen Rayquaza | full screen | Goes with Y14 |

The Primal Kyogre/Groudon and Mega Rayquaza forms still exist in the data, but this game gives you no
way to reach them.

## How the sprites are made

They're **hand-built pixel art**, drawn in code: `graphics/legends/<name>/draw.py`, using your Gemini
art (`source_front.jpg`) as the concept. Converting the paintings down to 64×64 always came out smudgy,
so each sprite is built from shapes with Gen 3-style shading (light from the top left, 3–4 shades per
color, black outline, darker inner lines where parts overlap). Faces, claws, markings and other
details are placed pixel by pixel. The toolkit is `tools/pixelsprite.py`; `tools/build_legends.sh`
redraws all three and makes the icons.

Design changes from the concept art, so they read at 64×64:

- **Ceaser:** his mane is a deeper orange-brown than his body (same gold in the concept, which blurs
  together). He lies sphinx-style with his head up, has bold stripes instead of many thin ones, a short
  crown of big laurel leaves, and two flowers on his tail.
- **Haleeb:** she sits upright on her cloud with her wings raised in a V instead of lounging wide. Her
  wings are a bluer grey than her white body so they don't merge. Her halo is a solid glowing ring.
- **Snickers:** his body coils into a J that fills the frame. His white fur is shaded lavender (a hint
  of Dark type, and it keeps him from vanishing on light backgrounds). He has an open snarl with fangs,
  big red claws, and red zigzag markings for Electric.

Back sprites are still placeholders (the front, mirrored).
