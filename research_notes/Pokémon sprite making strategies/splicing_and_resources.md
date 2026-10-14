# Pokémon Sprite Splicing/Editing and Free Fakemon Sprite Resources for ROM Hacks

Method note: the research proxy blocked direct fetches of pokecommunity.com, eeveeexpo.com, infinitefusion.fandom.com, hackmd.io and dragonflycave.com (organization policy, 403 / DNS failure). Findings from those sites come from search-engine snippets of the pages, not full-page reads, so the details should be checked on the pages themselves. The pokeemerald-expansion details were read directly from the repository's raw files on GitHub (master branch, fetched 2026-10-14).

## 1. How splices/fusions are made, and what makes a good or bad splice

### Takeaway
A splice is made by taking a "base" body sprite, cutting and pasting parts (head, tail, wings, markings) from other official sprites, then redrawing the seams, giving everything one light source, and recoloring the result to a single consistent palette. Bad splices look "stamped on": the shading, light direction or palette steps don't match between parts. The most-cited modern ruleset, Pokémon Infinite Fusion's, works the same way: the body Pokémon is the base and the head Pokémon's features and colors go on top.

### Cited Findings
- Older fan tutorials (mid-2000s, MS Paint era) all use the same basic method. You pick a base sprite to keep, move features over from another sprite, erase the parts that end up covered, redraw the missing pixels with the dropper and pencil, then recolor and clean up. The Geocities "EST" tutorial (2005) uses a Mew + Pikachu example with Mew as the body that is kept. — [EST splice tutorial (Geocities)](https://www.geocities.ws/ftb2k/splice.html)
- The PokeCharms tutorial (a Spoink + Aipom walkthrough) picks a round, easy-to-work-with body as the base. It cuts each feature out cleanly so no stray pixels remain and changes the background color while working on faces. — [Toasta's tutorial on the basics of spriting (PokeCharms)](https://pokecharms.com/threads/toastas-tutorial-on-the-basics-of-spriting.965/)
- Tip: splicing is easier with Pokémon of similar size and shape. Save a copy before editing, and never save as JPG. — [EST splice tutorial](https://www.geocities.ws/ftb2k/splice.html); [Paint.NET forum thread on splices/revamps](https://forums.getpaint.net/topic/8120-pokemon-sprites-splices-revamps-and-all-that-jazz/)
- Dragonfly Cave Spriting Guide (from a search snippet):
  - Don't use the same body part twice, because perfect symmetry or identical major parts "immediately makes a sprite look fake".
  - Flip parts when they face the wrong way for the new body, then fix the light-source direction on the flipped part.
  - Recolor to one consistent color scheme and edit the shading so matching colors match.
  - Early on, getting parts placed correctly matters more than closing every gap.
  - Scaling pixel art with paint tools "always looks terrible".
  - Size limits by generation: Advance (GBA) sprites are 64x64 at most, Gen 4 sprites are 80x80, and Gen 5 sprites are up to 96x96.
  - Source: [Dragonfly Cave Spriting Guide](https://www.dragonflycave.com/spriting-guide/)
- The "Splice Advice" blog suggests marking the light source with a dot and shading toward it so seams blend. To fix mismatched colors, it suggests shifting a part one step down in the palette. — [Splice Advice (tumblr)](https://thatsplicingadvice.tumblr.com/)
- Typical critiques of weak splices: one says a splice looked "copy paste layer looking" where "you can totally see the stamp on" and should match coloring and shading overall; another says to "change ALL of the shading not just the stripes". — [PokéCommunity "My first try with sprite splicing"](https://www.pokecommunity.com/threads/my-first-try-with-sprite-splicing-did-i-say-that-right.163400/); [Serebii "PkMn Splicez"](https://forums.serebii.net/threads/pkmn-splicez.445368/)
- Infinite Fusion (PIF) pixel-art guidance, as described in search snippets of the PIF staff HackMD guide and the wiki:
  - Start from the unfused base sprites, even when drawing from scratch, "to get the correct colors". Download them from InfiniteDex or FusionDex, not from the game folder, whose colors are often wrong.
  - The body Pokémon's sprite is the base. The head Pokémon's features are added and colored to match the head Pokémon.
  - Both Pokémon must stay recognizable.
  - Draw with the pencil tool with anti-aliasing off, and avoid half-pixels and stray pixels.
  - Style must match Black/White (Gen 5).
  - Canvas is 288x288, and the sprite must not sit too low on it.
  - No AI "in any stage of spriting".
  - Sources: [PIF: Spriting Guidelines (HackMD)](https://hackmd.io/@PIF-Staff/SpritingGuidelines); [Infinite Fusion Wiki – Custom Sprites](https://infinitefusion.fandom.com/wiki/Custom_Sprites)
- Expansion's own tutorial for adding a new Pokémon tells you to copy an existing species' graphics folder (e.g. Mew's) and edit `anim_front.png` and `back.png`. It recommends Aseprite or the free LibreSprite, indexed mode limited to 15 colors, a 2-color black/white footprint, and an icon that uses one of 6 predefined icon palettes. This edit-an-existing-sprite workflow is the starting point a ROM-hack splice would use. — [pokeemerald-expansion docs/tutorials/how_to_new_pokemon.md](https://github.com/rh-hideout/pokeemerald-expansion/blob/master/docs/tutorials/how_to_new_pokemon.md)

### Inferences
- A good splice comes from: similar-sized source sprites; a body base whose pose suits the parts added; redrawn seams, not just pasted ones; one light direction (top-left in official sprites); one shared palette; and a single consistent outline. A splice usually reads as bad when the parts keep their original palettes or shading, an outline is doubled at a seam, or a part is mirrored without re-lighting it.
- For a GBA hack, the 15-color limit (plus transparency) does the palette unification for you. Everything has to fit one 16-slot palette, so the source sprites' colors must be merged.

### Gaps
- I found no reliable source for typical time per splice. Neither Infinite Fusion's community nor the tutorials give an hours figure. My unsourced impression is that a simple splice takes tens of minutes and a polished fusion takes hours, but nothing I found confirms this.
- I couldn't read the full PIF HackMD guideline page or the full Dragonfly Cave guide (proxy blocked), so finer rules (outline color rules, self-fusions) are unverified.

## 2. Communities doing this and their norms

### Takeaway
Pokémon Infinite Fusion runs the largest splice/fusion operation by far: hundreds of thousands of custom sprites from thousands of artists, organized on its Discord with a gated "Spriter" role. Smogon's CAP is the opposite: it bans fusions and pixel-overs and requires scratch sprites. Relic Castle was taken down by DMCA in March 2024. Eevee Expo and PokéCommunity remain the main hubs for Essentials and decomp resources.

### Cited Findings
- **Infinite Fusion (PIF)**
  - Custom sprites replace the auto-generated fusions (originally from Japeal's Fusion Generator). Sprites are made on the Discord, and anything posted to #sprite-gallery goes into the sprite packs and the game. — [Infinite Fusion Wiki – Custom Sprites](https://infinitefusion.fandom.com/wiki/Custom_Sprites)
  - To get the Spriter role, you post three sprites to #spritework for feedback, then apply in #apply-for-spriter. — [Infinite Fusion Wiki – Custom Sprites](https://infinitefusion.fandom.com/wiki/Custom_Sprites)
  - There is no official website. Updates come only through the Discord or the PokéCommunity thread. — [Infinite Fusion Wiki main page](https://infinitefusion.fandom.com/wiki/Pok%C3%A9mon_Infinite_Fusion_Wiki)
  - Sprite counts conflict:
    - Infinite Dex FAQ: 261,901 custom sprites. [Infinite Dex FAQ](https://infinitefusiondex.com/faq)
    - FusionDex: "over 200,000 custom sprites" from "over 6,000 artists". [FusionDex](https://www.fusiondex.org/)
    - Fandom fan-game wiki: "over 15,000", clearly an old figure. [Pokémon Fan Game Wiki](https://pokemon-fan-game.fandom.com/wiki/Pok%C3%A9mon_Infinite_Fusion)
    - Infinite Dex also says thousands of sprites are made each month. [Infinite Dex FAQ](https://infinitefusiondex.com/faq)
  - Reuse norm, per a search snippet of the PIF guide: base sprites may be used without explicit permission, but fusion sprites may not be reused without explicit permission. — [PIF: Spriting Guidelines (HackMD)](https://hackmd.io/@PIF-Staff/SpritingGuidelines)
  - A Reddit thread says an artist who left the Discord may have asked for their sprites to be removed, and that using such a sprite anyway "would go against their wishes". — [r/PokemonInfiniteFusion thread (via redlib)](https://redlib.hbubli.cc/r/PokemonInfiniteFusion/comments/1kx0lpp/sprite_help_pls)
- **Smogon Create-A-Pokémon (CAP)**
  - Sprites must be original scratch work: "no fusions of other sprites or pixel-overs of other artists' lineart". Editing another spriter's submission needs that spriter's permission. — [CAP 9 Prevo Sprite Submissions](https://www.smogon.com/forums/threads/cap-9-prevo-sprite-submissions.3676907); [CAP 30 Part 13 Sprite Submissions](https://www.smogon.com/forums/threads/cap-30-part-13-cap30b-sprite-submissions.3693778)
  - Specs vary by CAP:
    - Transparent PNG, checked against several background colors.
    - Size: max 96x96 in CAP 27; CAP 31 recommended ≤80x80, with 96x96 as the hard maximum.
    - A complete, unbroken outline 1 pixel wide.
    - About 15–16 colors, with front and back sharing one palette.
    - Cel-shading, with dithering used sparingly.
    - No move or environment effects.
    - A final submission needs front and back sprites and must be labeled "Final Submission".
    - Sources (search summary of the threads): [CAP 27 Sprite Submissions](https://www.smogon.com/forums/goto/post?id=8469091); [CAP 26 Sprite Submissions](https://www.smogon.com/forums/goto/post?id=8139713)
  - Smogon also hosts "The Gen 4-Style Gen 5 and Beyond Backsprite Resource": free to use with credit to the spriters, non-profit only. — [Smogon thread](https://www.smogon.com/forums/threads/the-gen-4-style-gen-5-and-beyond-backsprite-resource.3687625/)
- **Relic Castle**
  - Went offline without warning after a reported DMCA notice. Relic Castle's Twitter announced it on March 21, 2024.
  - The Discord stayed up. Staff pointed people to the Wayback Machine and said they had no plans for a successor.
  - Sources: [VGC](https://videogameschronicle.com/news/pokemon-fan-game-repository-taken-down-by-a-reported-dmca-notice); [Kotaku](https://kotaku.com/pokemon-fan-games-relic-castle-shutdown-dmca-reason-1851359618); [80.lv](https://80.lv/articles/website-hosting-pok-mon-fan-games-has-been-taken-down/)
  - The articles' wording is that Relic Castle "never hosted any of these files directly"; games were downloaded from Mediafire and Google Drive. — [80.lv](https://80.lv/articles/website-hosting-pok-mon-fan-games-has-been-taken-down/)
- **Eevee Expo**
  - Has a "Battlers" resource category with several free fakemon packs, listed in section 3. — [Eevee Expo "sprites" tag](https://eeveeexpo.com/tags/sprites/)
- **PokéCommunity**
  - Has Graphics resource threads (e.g. the Earthretha pack, "Pokemon Fakemon Shop (Free)") and long-running splice/fakemon threads. — [Earthretha Fakemon Pack](https://www.pokecommunity.com/threads/earthretha-fakemon-pack.527306/); [Pokemon Fakemon Shop (Free)](https://www.pokecommunity.com/threads/pokemon-fakemon-shop-free.401179/)
  - It also hosts decomp sprite resources such as "Animated FRLG Sprites v1.1 (64x64) for pokeemerald". — [PokéCommunity thread](https://www.pokecommunity.com/threads/animated-frlg-sprites-v1-1-64x64-for-pokeemerald.540028/)

### Inferences
- Norms differ by venue. PIF accepts and encourages edits of official sprites (splicing is the medium itself) but protects each fusion artist's work. CAP accepts no splices at all. Essentials/decomp resource sites accept edits of official sprites in packs, as long as the original artists are credited.
- After Relic Castle's takedown, Eevee Expo and PokéCommunity are the practical places to find Essentials and decomp resources.

### Gaps
- I couldn't verify a current PIF "sprite guidelines" page directly, or check the Discord's exact current submission channels. The Discord structure may have changed.
- I didn't find specific material on The Spriters Resource's policy toward custom/edited sprites, on DeviantArt norms, or on r/PokemonROMhacks splice norms.

## 3. Free-to-use fakemon sprite packs and their terms

### Takeaway
Several free, credit-required fakemon packs exist. Almost all are Gen 4/5 DS-style and built for Pokémon Essentials:
- Fakemon Festival Pack (115 fakemon, Eevee Expo)
- Mikitari's Free Fakemon Pack (80+, Gen 4 style)
- Earthretha Fakemon Pack (Gen 4 style)

itch.io adds CC0/CC-BY generic monster packs, such as the 64x64 Openmon sets. I found no free pack explicitly in Gen 3 GBA style, and none explicitly themed as legendary-style big cats, serpents or winged beasts. Those would have to be found by browsing the packs.

### Cited Findings
- **Fakemon Festival Pack (Eevee Expo, NocTurn et al.)**
  - "Free to Use!"; 115 fakemon, all with front sprites, sized for Gen 5-style games. Some sections are Gen 4-sized.
  - Contributors also made back sprites, shinies and icons for some entries.
  - Latest version noted is v5.2.
  - Terms: add "Fakemon Festival Pack" to your credits and also credit the artists whose designs the sprites were based on.
  - Sources: [Eevee Expo resource 654](https://eeveeexpo.com/resources/654/); [discussion thread](https://www.eeveeexpo.com/threads/3777/)
- **Free Fakemon Pack (Eevee Expo, Mikitari)**
  - 80+ fakemon in Gen 4 style, with back sprites and static icons.
  - Terms: "feel free to use in any project".
  - Source: [Eevee Expo resource 1517](https://eeveeexpo.com/resources/1517/)
- **Earthretha Fakemon Pack (PokéCommunity / Eevee Expo, NanaelJustice)**
  - Gen 4-styled fakemon with front, back, shiny and icons. Some entries are incomplete.
  - Updated to the Essentials v20.1 format.
  - Most sprites are made from scratch, but some icons are edits of official game icons.
  - Terms: "Everything in this pack is free to use and edit with credits! Remember to add Earthretha Fakemon Pack somewhere in the credits too!"
  - Sources: [PokéCommunity thread](https://www.pokecommunity.com/threads/earthretha-fakemon-pack.527306/); [Eevee Expo thread](https://eeveeexpo.com/threads/5586/)
- **Fakemon Festival Pack GBC (Eevee Expo, Neoxaivus)**
  - Game Boy Color style.
  - Terms: credit to those who made them.
  - Source: [Eevee Expo thread 8764](https://eeveeexpo.com/threads/8764/)
- **Openmon Monster Sprites (itch.io, Screen Smith)**
  - 64x64 front sprites of "Openmon" fakemon. Set 3 has 17 battle sprites under CC0, so no attribution is needed.
  - Sets 1, 2, 3 and 5 exist. Each set's license should be checked individually.
  - Sources: [Openmon Set 3](https://screensmith.itch.io/openmon-monster-sprites-set-3); [Openmon assets collection](https://itch.io/c/4240964/openmon-assets)
- **Foxune's Fakemon Starter Pack (itch.io)**
  - Terms: free for commercial and non-commercial use with credit to "Foxune", following the terms on Foxune's profile.
  - Source: [foxune.itch.io](https://foxune.itch.io/taming-monster-graphics-sample)
- **Catchimon packs (itch.io, "Asset Alliance" creators)**
  - Several creators offer free tiers of paid bundles.
  - Terms: commercial and non-commercial use allowed, credit appreciated. Redistributing or reselling the assets is prohibited.
  - Sources: [Catchimon 14-15-16](https://snoblin.itch.io/catchimon-14-15-16); [Catchimon 19-20-21 free tier](https://beowulf.itch.io/catchimon-19-20-21/devlog/984452/free-tier-)
- **WorthyPie "9000+ Pixel Art Fakemon Pack"**
  - Monster-taming assets; attribution "optional but very much appreciated".
  - Search results also described a large itch.io fakemon collection under CC-BY 4.0. I'm not certain whether that was this pack.
  - Source: [worthypie.itch.io](https://worthypie.itch.io/pixel-art-fakemon-pack-monster-taming-rpg-assets)
- **Other itch.io options**
  - Several are paid: Astropeacho's "Fakemons (64x64) front" at $2, and the "Aaron Sprites" Generation 3 series at $4.99 with small free "Freebies" packs.
  - itch.io tag pages to browse: [free assets tagged pokemon](https://itch.io/game-assets/free/tag-pokemon); [fakemon + sprites](https://itch.io/game-assets/tag-fakemon/tag-sprites)
  - Source: [Astropeacho's collection](https://itch.io/c/4341386/astropeachos-collection)
- **Smogon Gen 4-style Gen 5+ backsprites**
  - Official-Pokémon backsprites, not fakemon. Free with credit, non-profit only.
  - Source: [Smogon](https://www.smogon.com/forums/threads/the-gen-4-style-gen-5-and-beyond-backsprite-resource.3687625/)

### Inferences
- For a private, free hack shared with friends, all the packs above are usable as long as you credit them. None found forbids non-commercial fan use. The Smogon backsprites and CC0 Openmon carry the fewest restrictions.
- Because nearly all fakemon packs are Gen 4/5-sized, a pokeemerald-expansion user has to crop or redraw them down to 64x64 (see section 5). Openmon's native 64x64 is the exception.
- To find legendary-style big cats, serpents or winged beasts, open the Fakemon Festival Pack (115 designs) and the Mikitari/Earthretha packs and pick by eye. I couldn't verify their exact contents.

### Gaps
- I couldn't read the full pack pages (proxy blocked), so exact creature lists, last-update dates, and whether any pack is abandoned are unverified. Earthretha's Essentials v20.1 update suggests activity around 2022–2023, but that is not confirmed.
- I found no free pack explicitly in Gen 3 GBA style.

## 4. Crediting norms and etiquette

### Takeaway
The near-universal norm is to credit every artist (and pack name) whose sprites you use or edit, ask permission before using or editing anyone's custom work unless a pack says it's free to use, never claim edits as your own, and keep it non-profit. Official base sprites are treated as freely editable.

### Cited Findings
- Packs require crediting the pack name plus the underlying designers. For example, Fakemon Festival asks for credit to the original artists its sprites are based on. — [Fakemon Festival Pack](https://eeveeexpo.com/resources/654/)
- One PokéCommunity sprite-game thread (search snippet): finished fakemon "may be used for hacks". Users "don't have to credit all people that worked on a fake, but a link to this thread as credit is asked". — [Fakemon Sprite Game v2 (PokéCommunity)](https://www.pokecommunity.com/threads/fakemon-sprite-game-v2.223773/)
- A fakemon artist in a PokéCommunity survey would share designs "so long as I am personally asked for my permission, appropriate credit is given, and no one profits from my art". — [Should Fakemon Be Shared? (PokéCommunity)](https://www.pokecommunity.com/threads/should-fakemon-be-shared.398695/)
- Another sprite artist: using sprites not designed by them needs the original designer's consent. — [tnguye3's fakemon sprites (PokéCommunity)](https://www.pokecommunity.com/threads/tnguye3s-fakemon-sprites.233978/)
- PokéFarm Q requires asking before making edits and gives a credit format, e.g. "Mega Mightyena Q (c) Pokéfarm Q, recolored by me". — [PokéFarm Q Sprite Permission Request Thread](https://pokefarm.com/forum/thread/171641/Sprite-Permission-Request-Thread/1)
- PIF: base sprites may be used without permission, but fusion sprites need explicit permission. Using a sprite from an artist who asked for removal goes against their wishes. — [PIF HackMD](https://hackmd.io/@PIF-Staff/SpritingGuidelines); [r/PokemonInfiniteFusion](https://redlib.hbubli.cc/r/PokemonInfiniteFusion/comments/1kx0lpp/sprite_help_pls)
- CAP: modifying another spriter's work requires that spriter's permission. — [CAP 9 Prevo Sprite Submissions](https://www.smogon.com/forums/threads/cap-9-prevo-sprite-submissions.3676907)
- Legal background: Relic Castle's shutdown shows that Nintendo/TPC enforcement can hit fan-game hubs even when they host no files. — [VGC](https://videogameschronicle.com/news/pokemon-fan-game-repository-taken-down-by-a-reported-dmca-notice)

### Inferences
- In practice, include a credits file or screen listing each pack and artist, plus a credit for edited Infinite Fusion or other custom sprites, and only use those with permission. Keep the hack free and low-profile. "Free to use" licenses on fan sites don't change Nintendo's rights over Pokémon-derived content.

### Gaps
- No single universal standard exists. Norms come from each pack's or community's own rules.

## 5. Using Gen 4/5 DS-style sprites in pokeemerald-expansion; conversion

### Takeaway
Yes. pokeemerald-expansion uses Gen 4/5-style Pokémon sprites by default, and a config flag (`P_GBA_STYLE_SPECIES_GFX`) switches back to GBA-style ones. Battle sprites are still 64x64 4bpp images with one 16-color palette (15 colors plus transparency). DS-native 80x80 (Gen 4) and 96x96 (Gen 5) sprites must be cropped or redrawn to fit, not scaled, and indexed to 15 colors.

### Cited Findings
- `include/config/pokemon.h`:
  - `#define P_GBA_STYLE_SPECIES_GFX FALSE // By default, Pokémon sprites use Gen 4/5's style. This config can revert them back to GBA-style. NOTE: B_ENEMY_MON_SHADOW_STYLE is disabled when using these sprites for now.`
  - Similar flags exist for icons (`P_GBA_STYLE_SPECIES_ICONS`) and footprints (`P_GBA_STYLE_SPECIES_FOOTPRINTS`).
  - `P_TWO_FRAME_FRONT_SPRITES TRUE` keeps Emerald's two-frame front sprites.
  - Source: [pokeemerald-expansion include/config/pokemon.h](https://github.com/rh-hideout/pokeemerald-expansion/blob/master/include/config/pokemon.h)
- The new-Pokémon tutorial: "Make sure that you are using the indexed mode and you have limited yourself to 15 colors!" Colors go in `normal.pal` and `shiny.pal`. `anim_front.png` holds two frames (a species with only one frame, like Pecharunt, uses `front.png`). Icons use one of 6 predefined palettes. — [how_to_new_pokemon.md](https://github.com/rh-hideout/pokeemerald-expansion/blob/master/docs/tutorials/how_to_new_pokemon.md)
- Sizes: GBA sprites are at most 64x64, Gen 4 sprites 80x80, Gen 5 up to 96x96. Scaling pixel art with paint tools looks bad. — [Dragonfly Cave Spriting Guide](https://www.dragonflycave.com/spriting-guide/)
- A PokéCommunity thread experimented in the other direction, putting 80x80 DS sprites into Emerald. The author reported brief cut-off moments during animations, partly because of the GBA's per-scanline sprite limits. — [Pokemon Emerald 80x80 Sprites (PokéCommunity)](https://www.pokecommunity.com/threads/pokemon-emerald-80x80-sprites.448488/)
- Community resource "Animated FRLG Sprites v1.1 (64x64) for pokeemerald" shows ready-made 64x64 conversions being shared. — [PokéCommunity](https://www.pokecommunity.com/threads/animated-frlg-sprites-v1-1-64x64-for-pokeemerald.540028/)
- One itch.io developer recommends Porypal to convert exported PNGs to the 4bpp image plus separate palette the decomps expect. They hadn't tested it with expansion. — [itch.io post](https://itch.io/post/14160151)

### Inferences
- The expansion's default "Gen 4/5 style" sprites are DS-style artwork already fitted into 64x64. So DS-style fakemon packs (Fakemon Festival, Mikitari, Earthretha) match the default look in style but need resizing.
  - Most Gen 4 sprites leave empty space around the creature, so cropping 80x80 to 64x64 (16 px off the margins) often works without redrawing. Large Gen 5-sized (96x96) creatures, such as legendary beasts, will usually need a hand-done downsize or redraw.
  - Each sprite then needs reducing to 15 colors plus transparency in a shared normal/shiny palette, making a 2-frame `anim_front.png`, a back sprite (packs often lack these), and fitting the icon to one of the 6 icon palettes.
- Mixing GBA-style and DS-style sprites in one hack works technically, but the styles will clash visually. Pick one: the default Gen 4/5 style, or `P_GBA_STYLE_SPECIES_GFX TRUE`.

### Gaps
- I found no official expansion doc describing how its own Gen 4/5 sprites were downsized, or any recommended DS→64x64 workflow. The crop-vs-redraw guidance above is inferred.
- I couldn't verify how many of the free packs' sprites already fit inside 64x64.
