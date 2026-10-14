# Sprite prompts: Snickers, Haleeb, Ceaser

How to get real pixel-art sprites out of AI image tools, with copy-paste prompts. Background on why
(and what other options exist) is in the research report, `reports/Pokémon sprite making strategies.md`.

## What to upload with every prompt

1. **Your concept image** (`graphics/legends/<name>/source_front.jpg`), so the design stays the same.
2. **The style sheet** for that Pokémon from [`docs/style_refs/`](style_refs/): real Gen 3 sprites
   blown up 8×. AI tools copy a style much better from an example than from words.
   - Ceaser: `ceaser_front_style.png` (Entei, Raikou), backs: `ceaser_back_style.png`
   - Haleeb: `haleeb_front_style.png` (Absol, Altaria, Lugia), backs: `haleeb_back_style.png`
   - Snickers: `snickers_front_style.png` (Rayquaza, Seviper, Zangoose), backs: `snickers_back_style.png`

Make the **front first**. For the back, upload the finished front instead of the concept, so the
colors match (front and back share one palette in the game).

## Which tool

| Tool | Cost | Pixel art | Use it for |
|---|---|---|---|
| **PixelLab** (pixellab.ai) | Free trial (about 40 images), then about $12/month | Real pixels at the size you pick | **Best free start.** Set size 64×64, no background, your concept as the reference/init image |
| **Retro Diffusion** (retrodiffusion.ai) | Small free starter credit, then cents per image | Real pixels, can lock the palette | Second opinion; good palette control |
| **Gemini** (what you have) | Free | Fake: drawn big, has to be snapped to a grid | Fine for trying ideas; use the long prompts below |
| **ChatGPT** (free tier now, Plus later) | Free: a few images a day. Plus: about $20/month | Fake, but follows instructions and edits best | Iterating: "same image, only change X" |
| **Microsoft Designer / Bing Image Creator** | Free | Fake | Extra free attempts |
| **Higgsfield** | Paid subscription | Fake; it's a general image/video platform | Not built for sprites. For this job, ChatGPT Plus or a month of PixelLab is the better buy |
| **LibreSprite / Pixelorama** | Free | — | Fixing stray pixels yourself, if you want to |

Whatever you get, send it to Claude. Real pixel art imports with every pixel kept exactly
(`convert_sprite.py --pixel-art`); fake pixel art gets snapped to a 64×64 grid and cleaned up.

---

## Prompts for pixel-art tools (PixelLab, Retro Diffusion)

These tools want short prompts. Settings: **size 64×64**, **transparent/no background**, **reference
or init image = your concept**, style image = the style sheet if the tool has a slot for it.

**Ceaser, front**
> Pokémon Ruby Sapphire Emerald battle sprite, legendary lion, facing left, three-quarter view, lying
> down like a sphinx with head raised, huge spiky orange-brown mane, golden body with dark tiger stripes,
> green laurel leaf crown, calm half-closed amber eyes, black-tipped tail curled up behind, two small
> flowers on the tail, black outline, 15 colors, top-left lighting

**Haleeb, front**
> Pokémon Ruby Sapphire Emerald battle sprite, legendary white cat, facing left, sitting upright on a
> small round cloud, large feathered pale blue-grey wings raised behind her in a V, cream-orange ears,
> face mask, paws and tail tip, sleepy half-closed pale blue eyes, glowing mist halo above her head,
> black outline, 15 colors, top-left lighting

**Snickers, front**
> Pokémon Ruby Sapphire Emerald battle sprite, legendary serpent cat, facing left, long white furry
> body coiled in an S shape filling the frame like Rayquaza, big cat head at top left with pointed ears,
> cream-orange face with red stripes, glowing red eyes, snarling with fangs, two front paws with big
> red claws, red lightning markings, fluffy tail tip, black outline, 15 colors, top-left lighting

**Backs** (upload the finished front as the reference)
> Same Pokémon, Pokémon Ruby Sapphire Emerald BACK battle sprite, seen from behind and slightly above,
> turned slightly to the right, showing the back of the [mane / wings / coiled body], same colors,
> black outline, 64×64

---

## Prompts for chat image tools (Gemini, ChatGPT, Designer, Higgsfield)

These draw big, smooth pictures unless told very precisely. Paste the style block, then the
Pokémon's line. Upload the concept and the style sheet with it.

**Style block (start every prompt with this)**
> Make a Pokémon Ruby/Sapphire/Emerald (Game Boy Advance) battle sprite of the creature in my first
> image, in exactly the pixel-art style of the sprites in my second image. It must be real pixel art:
> a 64×64 pixel sprite shown enlarged 8 times to 512×512, so every pixel is a sharp 8×8 square on a
> perfect grid. No blur, no anti-aliasing, no gradients, no texture, at most 15 colors. Black 1-pixel
> outline, flat colors with 2–3 shades each, light from the top left. Facing left. The creature fills
> most of the square. Plain white background, nothing else in the image.

**Ceaser**
> A legendary lion lying down like a sphinx with his head raised: huge spiky orange-brown mane (darker
> than his golden body), a few bold dark stripes, a crown of green laurel leaves, calm half-closed amber
> eyes, black-tipped tail curled up behind his back with two small flowers.

**Haleeb**
> A legendary white cat sitting upright on a small round cloud, big feathered pale blue-grey wings
> raised behind her in a V (bluer than her white fur so they stand out), cream-orange ears, face mask,
> paws and tail tip, sleepy half-closed pale blue eyes, a glowing ring of mist floating above her head.

**Snickers**
> A legendary white serpent cat, his long furry body coiled in an S shape that fills the square like
> Rayquaza's sprite, a big cat head at top left with pointed ears, cream-orange face with red stripes,
> glowing red eyes and a fanged snarl, two front paws reaching forward with big red claws, red
> lightning zigzags on his body.

**Back sprite** (upload the finished front instead of the concept)
> Now the BACK battle sprite of this exact Pokémon, in the same pixel style and the same colors: seen
> from behind and slightly above, turned slightly to the right, showing the back of its head and
> [mane / wings / coiled body]. Same 64×64 pixel grid enlarged 8 times, white background.

---

## Fix-up prompts (any tool that edits)

Change one thing at a time; keep the rest.

- "Same image, but make the pixels bigger and blockier: it should be a 64×64 sprite enlarged 8×."
- "Same image, fewer colors: at most 15, no soft shading."
- "Same image, more compact pose, so it fills the square instead of being wide."
- "Same image, bigger head and bigger eyes."
- "Same image, remove the background and anything that isn't the creature."
- "Same image, mirror it so it faces left."
