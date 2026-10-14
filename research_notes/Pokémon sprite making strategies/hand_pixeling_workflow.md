# Hand-Pixeling Gen 3 (GBA, 64x64, 16-colour) Fakemon Battle Sprites: Workflow, Style Rules, Guides, Tools, Effort

> Research-environment caveat: the egress proxy blocked direct page fetches (pokecommunity.com, dragonflycave.com, smogon.com, hackmd.io, lospec.com, saint11.art, slynyrd.com, aseprite.org, and GitHub API all returned CONNECT 403 or "not enabled"). Every finding below comes from search-engine snippets and summaries of those pages, not from reading the full pages. Quotes are the snippet text. Treat fine details as "reported by snippet". Pages that are well regarded but could not be opened are listed in Gaps.

## Q1. What step-by-step workflow do fakemon/ROM-hack sprite artists follow? Scratch, base sprite, or downscaled drawing?

### Takeaway
The community uses three routes, ranked from most to least respected: (1) a true "scratch" sprite (sketch, then a clean 1px outline, then a flat palette, then shading from a top-left light, then outline shading, AA and cleanup); (2) a "pixel-over" of your own drawing (draw or scan the concept, place it under the canvas, trace the outline pixel by pixel); (3) a "splice" or "fusion" of existing official sprites with recolouring and reshading. Auto-downscaling a drawing is widely judged to look "blurry". Competitive venues such as Smogon CAP ban splices and pixel-overs of other people's line art.

### Cited Findings
- Pokébip's tutorial describes the usual order as concept, then line art, then colouring. It notes that the line art is not final and can still change during colouring — [Pokébip, Réaliser un sprite d'après un dessin](https://www.pokebip.com/page/fanarts/tutos/pixel-art/sprite) (via search summary)
- Smogon's pixel-over guide defines a pixel-over as "spriting over an existing piece of artwork". It says "the first step is to outline all features of the sprite" and that "no matter how good the shading is, if the outline is flawed then the entire sprite will look shoddy" — [Smogon, Spriting Update (Guide: Pixel Overs)](https://www.smogon.com/smog/issue10/spriting)
- Another Smogon guide suggests sketching poses on a digital canvas or on paper, scanning them, and then pixeling over them — [Smogon, An Introduction to Spriting](https://www.smogon.com/smog/issue8/spriting) / [Splash's Miniature Guide to Spriting](https://www.smogon.com/forums/threads/splashs-miniature-guide-to-spriting.3532512/) (the snippet did not say which of the two pages this came from)
- Smogon CAP rules (CAP 36): sprites "must be scratch sprites that are completely original works by the spriter. Fusions of other sprites or pixel-overs of other artist's lineart (including the main design) are not allowed." CAP 18 adds that a pixel-over with "a few pixels" changed "won't cut it" as scratch — [CAP 36 Sprite Submissions](https://www.smogon.com/forums/threads/cap-36-part-12-sprite-submissions-transformation.3766594/); [CAP 18 Sprite Submissions](https://www.smogon.com/forums/threads/cap-18-sprite-submissions.3505233/)
- Smogon's "[Guide] The Pixel Art" covers the splice/recolour route: cut a sprite out and place it in another, build a palette and reshade to recolour, and resize. It starts from MS Paint and the Pokémon Showdown sprite index — [Smogon, [Guide] The Pixel Art](https://www.smogon.com/forums/threads/guide-the-pixel-art.3551567/)
- Splice/fusion tutorials warn that "interfering with a pokémon's anatomy can sometimes result in shading that needs adjustment". Missing parts must be completed "while respecting the curves and shading" — [PokéCommunity thread (search snippet)](https://www.pokecommunity.com/threads/censors-sprites-must-keep-practicing.203318/latest); [Pokébip, Tutorial de fusions](https://www.pokebip.com/page/trucage/tuto_fusion)
- "Spriting Made Easy" (Instructables) teaches recolouring and combining parts from existing Pokémon sprites. This is the beginner's splice route — [Instructables](https://www.instructables.com/Spriting-Made-Easy)
- Dragonfly Cave's guide advises against keeping an original outline when revamping, especially its manual anti-aliasing dots on the outer edge. Its method: colour the whole outline black pixel by pixel, then recolour it with the Pencil, not the Paint Bucket, because the bucket "can inadvertently fill areas that should be a different hue" — [Dragonfly Cave Spriting Guide](https://www.dragonflycave.com/spriting-guide/)
- In community critique, artists are told to use official sprites as reference for shapes such as wings — [PokéCommunity, Elgyem's Sprite Scrapyard](https://www.pokecommunity.com/threads/elgyems-sprite-scrapyard.277555/page-2)
- Downscaling: in a GBA conversion project, commenters said downscaled sprites "look really blurry". Gen IV/V sprites had to be resized to match Gen III relative size even when they already fit 64x64 — [PokéCommunity, The 493 GBA Project](https://www.pokecommunity.com/threads/the-493-gba-project.237375/)
- ROM-hack insertion step: front and back sprites should total no more than 16 colours so they don't use completely different palettes. Advanced Pokemon Sprite Editor is used to import the sprite and sync palettes — [PokéCommunity thread 211085](https://www.pokecommunity.com/threads/211085)
- Splicing guidance: the Pokémon Trash "faire un scratch" tutorial and Pokébip's "Tutorial pour scratcher un sprite" are French-language scratch guides — [Pokémon Trash](https://www.pokemontrash.com/graphisme-pokemon/faire-scratch); [Pokébip](https://www.pokebip.com/page__trucage__tuto_sprite.html)

### Inferences
- A practical reconstructed pipeline that is consistent with all the sources above:
  1. Concept sketch at large size.
  2. Pick the body-size bucket (see Q2: about 40, 48, 56 or 64 px) and block a silhouette at that size, facing left, on a 64x64 canvas.
  3. Draw a 1px outline (pixel-over the sketch or freehand), then smooth the curves.
  4. Fill flat base colours and build ramps of about 3 shades plus an outline tone per material, staying at 15 colours or fewer plus 1 transparent.
  5. Shade from a top-left light.
  6. Shade the outline: black on the shadow side, darkest ramp shade on the lit side.
  7. Add sparse internal AA and remove stray pixels.
  8. Draw the back sprite with the same palette.
  9. Do an indexed-colour check and export.
- For a non-artist working with AI tooling, the "pixel-over of a downscaled drawing" route is the closest analogue. The sources say the downscale must then be manually re-outlined and re-shaded, because a raw downscale reads as blurry.

### Gaps
- Could not open PokéCommunity's "Spriting Tutorials - Pokemon and Trainer" thread (t=176686) or Dragonfly Cave's full guide. Their step lists are reconstructed from snippets only.
- No source found that explicitly documents official Game Freak production workflow for Gen 3.

## Q2. Concrete style rules of Gen 3 (R/S/E) sprites

### Takeaway
Gen 3 battle sprites use these conventions:
- A 64x64 canvas with 16 palette slots (one is transparent).
- The body is drawn in roughly 40/48/56/64 px boxes by size class.
- The Pokémon faces left and is lit from the top-left.
- Outlines are coloured or shaded: black where they meet shadow, the darkest ramp shade where they meet lit areas. They are never all black.
- About 3 shades plus an outline tone per material.
- No pillow shading or banding, minimal internal AA, and no external AA against the transparent background.
- Front and back sprites share one palette.
Sources conflict on dithering: one says Gen 3 uses "a large amount", while fan rule sets say to use it sparingly.

### Cited Findings
**Canvas and size usage**
- Gen 3 front and back sprites are both 64x64. Gen 4 is 80x80. Gen 1/2 is 56x56. Emerald animations use variable sizes — [PokéBase](https://pokemondb.net/pokebase/418580/what-are-the-dimensions-all-the-sizes-the-gen-battle-sprites); [Bulbapedia User:G50/Sprites](https://bulbapedia.bulbagarden.net/wiki/User:G50/Sprites/Normal_Front)
- Bulbagarden Archives lists the R/S back sprites as 64 × 64 files of about 540 bytes — [Bulbagarden Archives, Ruby and Sapphire back sprites](https://archives.bulbagarden.net/wiki/Category:Ruby_and_Sapphire_back_sprites)
- Within the 64x64 canvas, a PokéCommunity analysis found R/S figures fall into "40x40, 48x48, 56x56, and 64x64 (even though, technically, they're all 64x64), give or take a row/column of pixels". This is the size-class system for small, medium, large and legendary Pokémon — [PokéCommunity, Sprite Sizes](https://www.pokecommunity.com/threads/sprite-sizes.340457/)
- Pokébip lists the 3G canvas as 64x64 and advises matching official sprite sizes and never mixing pixel scales — [Pokébip, Généralités sur la réalisation d'un sprite](https://www.pokebip.com/page/fanarts/tutos/pixel-art/basiquessprite)
- DS-era contrast: 80x80 through HG/SS, according to a scratch tutorial — [Pokébip scratch tutorial](https://www.pokebip.com/page__trucage__tuto_sprite.html). For Gen 5 (96x96), some large Pokémon "needed a bit more space" than the 80x80 standard — [PokéBase](https://pokemondb.net/pokebase/418580/what-are-the-dimensions-all-the-sizes-the-gen-battle-sprites). Smogon CAP caps sprites at 96x96 — [Smogon CAP Sprite Submissions](https://www.smogon.com/cap/process/events/sprite_submissions)
- Treecko's B/W sprite is smaller than its R/S/E sprite, so later sprites are not drawn at the same scale as Gen 3 — [PokéCommunity, The 493 GBA Project](https://www.pokecommunity.com/threads/the-493-gba-project.237375/)

**Palette**
- "A Pokémon sprite always has 16 colours at most, counting black" — [Pokébip blog, Créer un sprite Pokémon](https://www.pokebip.com/espace-membre/blogs/426288/article/297142)
- GBA colour is 15-bit, and a Gen 3 sprite tool warns above 15 non-transparent colours — [flinkerflitzer, pokemon gen 3 trainer (itch.io)](https://flinkerflitzer.itch.io/pokemon-gen-3-trainer)
- Front and back sprites share one palette of 16 or fewer colours — [PokéCommunity thread 211085](https://www.pokecommunity.com/threads/211085). CAP rules also require that all front and back sprites use the same palette — [Smogon CAP Sprite Submissions](https://www.smogon.com/cap/process/events/sprite_submissions)

**Light direction and facing**
- Light comes from the top-left. "A typical pokemon sprite has the light coming from the left and above", so the left side is lighter and the right darker, and each body part is shaded as its own form — [PokéCommunity (snippet)](https://www.pokecommunity.com/threads/censors-sprites-must-keep-practicing.203318/latest). "Most GBA Pokemon and trainer sprites seem to be illuminated by a light source somewhere to the left and above them" — [PokéCommunity Spriting Tutorials t=176686](https://www.pokecommunity.com/showthread.php?t=176686)
- Pokébip: the light source is at the top left, and a Pokémon always looks to the left — [Pokébip scratch tutorial](https://www.pokebip.com/page__trucage__tuto_sprite.html); [Pokébip basics](https://www.pokebip.com/page/fanarts/tutos/pixel-art/basiquessprite)

**Outlines (coloured outline / sel-out)**
- Dragonfly Cave: "The 'outline shadows' are always black (or ever-so-slightly off-black) on Pokémon sprites". Example sprites have "colored outlines, getting darker the farther they are from the light source" — [Dragonfly Cave Spriting Guide](https://www.dragonflycave.com/spriting-guide/)
- Pokémon Infinite Fusion (PIF) staff guidelines: "Outlines should never be all black or all colored in". Shade them with black where they meet shadows and with the darkest shade where they meet main colours and highlights. Keep lines smooth, especially curves — [PIF: Spriting Guidelines (HackMD)](https://hackmd.io/@PIF-Staff/SpritingGuidelines)
- Pokébip: avoid fully black outlines. Use lighter outline tones on lit parts and keep black for the darkest zones — [Pokébip scratch tutorial](https://www.pokebip.com/page__trucage__tuto_sprite.html)
- CAP: "a complete, unbroken, distinguishable outline one pixel wide … clearly distinguishable from the adjacent interior colors" — [Smogon CAP Sprite Submissions](https://www.smogon.com/cap/process/events/sprite_submissions)
- General sel-out definition: a shaded outline that takes light separately from the sprite's own shading. The options are none, black, or selective. Learners should practise with a black outline first — [imonk, pixel tutorial: selective outlines (itch.io)](https://itch.io/t/2422252/pixel-tutorial-selective-outlines). Lospec says to use a darker shade of the object's own colour while keeping contrast with the background — [Lospec, Pixel Art Outlines Part 2: Using Color](https://lospec.com/articles/pixel-art-outlines-part-2-using-color)

**Shades per material**
- PIF: "Each color should have no more than four shades in most cases: a highlight, a main shade, a shadow shade and a darker outline color. Having too many shades can make sprites look blurry or as if the files have been saved wrong." — [PIF Spriting Guidelines](https://hackmd.io/@PIF-Staff/SpritingGuidelines)
- CAP recommends 15 or fewer unique colours, may be exceeded for complex designs, with cel-shading. One rule set says "8-bit truecolor … does NOT mean 256 color mode" — [Smogon CAP Sprite Submissions](https://www.smogon.com/cap/process/events/sprite_submissions) (rules vary per CAP)

**Dithering** (conflicting sources)
- One source summary says "in Pokemon's generation three … there is a large amount of dithering present" — [search snippet; source page among PokéCommunity/Dragonfly Cave results](https://www.pokecommunity.com/showthread.php?t=176686) (attribution uncertain)
- CAP rules allow dithering "sparingly" — [Smogon CAP](https://www.smogon.com/cap/process/events/sprite_submissions)
- General guide: "The most common mistake is simply using too much dithering. If dithering is covering half your sprite, it'd probably just be better if you added a new color" — [Pixel Joint, The Pixel Art Tutorial](https://pixeljoint.com/forum/forum_posts.asp?TID=11299) (likely source, via snippet)

**Anti-aliasing**
- PIF: AA means "adding an extra shade and placing small amounts of pixels (usually single pixels, sometimes a couple more) in the corners where the two colors intersect. It shouldn't be a full outline between the two shades." — [PIF Spriting Guidelines](https://hackmd.io/@PIF-Staff/SpritingGuidelines)
- Dragonfly Cave: use a 1px pencil, bucket and selection tools with AA off, and avoid anything anti-aliased (automatic) on a sprite — [Dragonfly Cave](https://www.dragonflycave.com/spriting-guide/). "There is such a thing as too much anti-aliasing" — [Logbook Project, Jiinchu's "Darkness"](https://the-logbook-project.blogspot.com/2013/04/pixel-art-lessons-jiinchus-darkness.html)

**Pillow shading and banding (mistakes)**
- Pillow shading is shading parallel to the edges, getting lighter toward the centre. It "looks terrible" and "must be avoided at all times". Instead, "choose a light source direction, make that the lightest point, and shade outwards from there" — [Logbook Project](https://the-logbook-project.blogspot.com/2013/04/pixel-art-lessons-jiinchus-darkness.html); [Dragonfly Cave](https://www.dragonflycave.com/spriting-guide/)
- Pokébip lexicon: pillow shading (shadows follow the outline, lightest area in the centre) gives no volume because it ignores the light source — [Pokébip, Lexique du pixel-art](https://www.pokebip.com/page/fanarts/tutos/pixel-art/lexique)
- Banding is "a common pixel art mistake where colors of different values line up in parallel bands". Break it up with clusters or dithering — [Pixnote glossary](https://pixnote.net/en/learn/glossary/)

**Overworld and FR/LG contrast**
- FR/LG trainer and overworld sprites have a more subdued palette, large round heads, and a higher top-down view than R/S/E. One guide gives 32x32 as a good restriction for Gen 3 overworld mons — [PokéCommunity, overworld guide](https://www.pokecommunity.com/threads/a-comprehensive-guide-to-making-good-overworld-sprites.351295/)

**Reception**
- Opinions differ. One forum user called Gen 3 "the worst sprites of any generation … lazy looking", citing weak shading. Others prefer it as the retro look — [Smogon (snippet)](https://www.smogon.com/forums/goto/post?id=7159851); [PokéCommunity, which old gen had the best sprites](https://www.pokecommunity.com/threads/which-old-gen-had-the-best-series-of-sprites.536419/)

### Inferences
- Rule set for an AI or a non-artist:
  - Canvas 64x64, index 0 transparent, 15 or fewer visible colours shared by front and back.
  - Body box about 40 px (baby or basic), 48–56 (middle stage), 56–64 (final or legendary).
  - Faces left, 3/4 view. Light top-left.
  - Per material: highlight, base, shadow, plus a dark outline tone. Black only on outline segments in shadow (bottom and right) and in the deepest crevices.
  - No soft AA against the transparent background. Internal AA only as single pixels in corners.
  - Avoid banding, pillow shading and orphan pixels.
- Building materials so ramps share colours (for example, using the darkest shadow of one material as an outline tone) is the usual way to stay within 15 colours. This follows from the 15-colour cap combined with the 4-shades-per-material rule: about 3–4 materials maximum.
- Back sprites (from general knowledge; not verified in this session): Gen 3 back sprites show the Pokémon from behind and slightly above, are usually larger or cropped at the bottom edge, share the front palette, and have less facial detail.
- Eyes (from general knowledge; not verified in this session): at this scale eyes are typically 2–4 px clusters with a 1px white or light highlight on the upper-left (toward the light). The dark pupil touches the outline.

### Gaps
- No source found that measured legendary vs small Pokémon pixel dimensions precisely, beyond the 40/48/56/64 buckets.
- No sourced tutorial specific to eye and face construction at 64x64 was found.
- No sourced, explicit description of Gen 3 back-sprite conventions (camera angle, cropping) was found.
- The dithering conflict is unresolved: "large amount" in Gen 3 vs "sparingly" in fan rule sets. Direct inspection of Spriters Resource or Bulbagarden Archives sprites would settle it.
- The full PIF guidelines sections on dithering and pillow shading were cut off in the snippets.

## Q3. Which tutorials and guides are well regarded?

### Takeaway
Pokémon-specific:
- Dragonfly Cave Spriting Guide
- PIF (Infinite Fusion) staff Spriting Guidelines on HackMD
- PokéCommunity "Spriting Tutorials – Pokemon and Trainer"
- Smogon's Smog spriting articles and CAP sprite rules
- Pokébip's French tutorials

General pixel art:
- Saint11 (Pedro Medeiros) tutorials, best for low resolution
- Slynyrd Pixelblog, best for higher resolution
- Lospec articles
- Pixel Joint's "The Pixel Art Tutorial"
- imonk's tutorials

### Cited Findings
- Dragonfly Cave Spriting Guide (outline recolouring, outline shadows, tools without AA) — [dragonflycave.com/spriting-guide](https://www.dragonflycave.com/spriting-guide/)
- PIF: Spriting Guidelines (staff HackMD) — [hackmd.io/@PIF-Staff/SpritingGuidelines](https://hackmd.io/@PIF-Staff/SpritingGuidelines)
- PokéCommunity Spriting Tutorials – Pokemon and Trainer — [pokecommunity t=176686](https://www.pokecommunity.com/showthread.php?t=176686)
- Smogon: Intro to Spriting, Pixel Overs guide, Splash's Miniature Guide, CAP sprite rules — [Smog issue 8](https://www.smogon.com/smog/issue8/spriting); [Smog issue 10](https://www.smogon.com/smog/issue10/spriting); [Splash's guide](https://www.smogon.com/forums/threads/splashs-miniature-guide-to-spriting.3532512/); [CAP rules](https://www.smogon.com/cap/process/events/sprite_submissions)
- Pokébip (FR): basics, sprite from a drawing, lexicon, scratch tutorial — [basics](https://www.pokebip.com/page/fanarts/tutos/pixel-art/basiquessprite); [from drawing](https://www.pokebip.com/page/fanarts/tutos/pixel-art/sprite); [lexicon](https://www.pokebip.com/page/fanarts/tutos/pixel-art/lexique)
- Serebii forums Sprite Tutorial Thread — [forums.serebii.net](https://forums.serebii.net/threads/sprite-tutorial-thread.640895/)
- Community recommendation: Slynyrd's Pixelblog catalogue has "lots of higher-resolution pixel art tutorials". Saint11's blog is a "lower-resolution site with many useful tutorials" — [Aseprite community thread](https://community.aseprite.org/t/my-first-pixel-art-so-far-not-sure-what-to-do-for-the-shading/15347); [saint11.art/blog/pixel-art-tutorials](https://saint11.art/blog/pixel-art-tutorials/)
- Lospec outline articles — [Lospec Outlines Part 2](https://lospec.com/articles/pixel-art-outlines-part-2-using-color)
- imonk selective outline and tortoise shading tutorials — [selout](https://itch.io/t/2422252/pixel-tutorial-selective-outlines); [tortoise](https://itch.io/t/2087708/pixel-tutorial-tortoise)
- Pixel Joint "The Pixel Art Tutorial" — [pixeljoint.com](https://pixeljoint.com/forum/forum_posts.asp?TID=11299)
- Video series: Anthroyd's Gen III ROM hacking videos cover sprite indexing and palette editing — referenced in [PokéCommunity search results](https://www.pokecommunity.com/threads/369646)

### Inferences
- For Gen 3 accuracy, read the PIF guidelines, Dragonfly Cave and the PokéCommunity tutorials first. Saint11 and Slynyrd are best for general fundamentals (ramps, clusters, AA).

### Gaps
- Could not confirm specific Slynyrd or Saint11 page titles relevant to outlines or sprites, because those sites were blocked.
- PIF sprites are 96x96 fusions (Gen 5-ish scale), not 64x64. Their shading rules transfer, but their size does not. This is from general knowledge; the PIF canvas size was not confirmed in snippets.

## Q4. Tools: price, licensing, features that matter

### Takeaway
- Aseprite ($19.99 one-time) is the de facto standard.
- LibreSprite (free fork of old Aseprite), Pixelorama (free and open source; paid on Steam) and GraphicsGale (freeware since 2017) are the free alternatives.
- The features that matter are indexed-colour mode, palette management, a shading ink or mode, a pixel-perfect pencil with AA off, and layers or onion skin for front and back sprites and animation.
- ROM insertion needs separate tools such as Advanced Pokemon Sprite Editor.

### Cited Findings
- Aseprite costs $19.99 USD one-time on the official site, Steam and itch.io. The Steam base price was unchanged through June 2026 — [Steambase price tracker](https://steambase.io/games/aseprite/price); [Gappsy review](https://gappsy.com/tools/aseprite/)
- On 2026-06-30 Aseprite added website accounts (download with your purchase email) and a new payment processor with local pricing — [Aseprite blog, 2026-06-30](https://blog.aseprite.org/2026/06/30/new-website-account/)
- The Aseprite FAQ says purchases include updates up to v1.9. The latest blog version seen was v1.3.18 — [Aseprite community FAQ](https://community.aseprite.org/faq) (exact current version unconfirmed)
- Aseprite Shading ink: pick a gradient of palette colours, and left or right clicks shift a pixel along it — [Aseprite docs: Shading](https://www.aseprite.org/docs/shading/)
- LibreSprite is a fork of Aseprite with RGBA, Indexed (palettes up to 256 colours) and Grayscale modes, plus "pixel-art specific tools like filled Contour, Polygon, Shading mode" — [MyNixOS libresprite](https://mynixos.com/nixpkgs/package/libresprite)
- Pixelorama is open source and "completely free". v1.1.10 was released on PortableApps on 2026-06-08. The Steam version is paid, and free builds come via itch.io — [PortableApps Pixelorama 1.1.10](https://portableapps.com/node/80848); [itch.io devlog v1.1.6](https://orama-interactive.itch.io/pixelorama/devlog/1099914/pixelorama-v116-is-out)
- GraphicsGale (HUMANBALANCE) "became a freeware" on 2017-06-18. The official site shows v2.10.01, while mirrors list 2.08.21 — [graphicsgale.com](https://graphicsgale.com/us); [GameDev.net](https://www.gamedev.net/news/graphicsgale-goes-freeware-r146/); [MajorGeeks](https://www.majorgeeks.com/files/details/graphicsgale.html)
- GraphicsGale tutorials use 8-bit (256-colour) indexed documents — [Pinnguaq, Getting Started with GraphicsGale](https://pinnguaq.com/learn/pixel-art/pixel-art-1-getting-started-with-graphicsgale)
- Smogon's beginner guide starts from MS Paint — [Smogon, [Guide] The Pixel Art](https://www.smogon.com/forums/threads/guide-the-pixel-art.3551567/)
- Insertion and palette sync for GBA ROMs: Advanced Pokemon Sprite Editor — [PokéCommunity 211085](https://www.pokecommunity.com/threads/211085)

### Inferences
- Indexed mode with a 16-entry palette (entry 0 transparent) is the single most important feature. It enforces the GBA limit and lets an AI assistant validate a PNG programmatically (colour count of 16 or fewer, front and back palettes identical).
- Paint.NET (free, Windows) can work for pixel-by-pixel editing but has no native indexed palette workflow. This is from general knowledge; not verified this session.
- Aseprite's source is available and it can be compiled for free. LibreSprite is GPL. This is from general knowledge; not verified this session.

### Gaps
- Current exact versions of Aseprite and LibreSprite as of Oct 2026 are unverified (GitHub and the official sites were blocked).
- Pixelorama's indexed-mode support and shading-mode features were not confirmed.
- No sourced information on Paint.NET was gathered.

## Q5. Time per sprite; beginner difficulty

### Takeaway
No reliable published figure exists for a Gen 3 fakemon front sprite. Anecdotes:
- A beginner's first simple sprite takes 1–2 hours.
- Professional VS/battle sprites can take "a few days" including queue time.
- Animation multiplies the time.
Community gatekeeping (CAP and PIF rules, critique threads) shows that reaching "acceptable" quality needs feedback loops on outline smoothness and shading direction.

### Cited Findings
- A newcomer reported "a good hour or two" for a first sprite including animation. Another made a simple waving cherry in about 10 minutes. Characters with 8–12 animation frames are "very time-consuming" — [Steam Aseprite discussion](https://steamcommunity.com/app/431730/discussions/0/597392317408651120)
- One sprite artist's commission sheet is based on time. A VS sprite "could take a few days, or maybe a week depending on availability" — [apophyll.carrd.co](https://apophyll.carrd.co/)
- A different commission page offers custom Pokémon-style pixel sprites, which shows that a commission market exists — [redhaering.carrd.co](https://redhaering.carrd.co/)
- A Bulbagarden user describes long-term attempts at Gen V style pixel-overs as a learning process — [Bulbagarden, Gen V sprites pixel-over](https://bulbagarden.net/threads/my-attempt-at-generation-v-sprites-pixel-over-artstyle.63274/)
- Critique threads such as "Censors sprites – must keep practicing" and "Elgyem's Sprite Scrapyard" show repeated feedback on shading and anatomy as the norm — [PokéCommunity](https://www.pokecommunity.com/threads/censors-sprites-must-keep-practicing.203318/latest); [Elgyem's](https://www.pokecommunity.com/threads/elgyems-sprite-scrapyard.277555/page-2)

### Inferences
- These estimates are extrapolated from the sources above and are not sourced figures. A skilled artist likely needs a few hours for a static 64x64 front sprite plus back sprite. A beginner needs many hours per sprite and probably dozens of sprites with critique before outlines and shading pass community standards such as the PIF and CAP rules.
- The most common beginner failures named in the guides are jagged outlines, all-black outlines, pillow shading, too many shades ("blurry"), and over-dithering. An AI assistant could check most of these automatically: colour count, outline continuity, and orphan pixels.

### Gaps
- No time-tracking data was found specifically for Gen 3 fakemon sprites. Timelapse videos by known spriters would be the best source but were not reachable.
