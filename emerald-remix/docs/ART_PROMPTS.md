# Gemini Art Prompts

Copy-paste prompts for making the starter art with Gemini. Designs are in [STARTERS.md](STARTERS.md).

## Workflow (read this first)

Gemini can't output a true GBA sprite: an exact 64×64 image with 16 colors. So we work in three steps:

1. **Concept**: get a clean, high-quality character design you love. Iterate here, since it's the cheap part.
2. **Pixel version**: give Gemini the approved concept image and ask for it in Gen 3 pixel style.
3. **Convert**: a script (Claude will write it) shrinks it to 64×64, cuts it down to 15 colors + transparent, and
   writes the `.pal` files. Then you fix stray pixels by hand in Aseprite/LibreSprite (about 30–60 minutes per sprite).

**Tips for keeping a consistent look**
- Do all of one line in **one Gemini chat**, and upload the previous stage's image with each new prompt:
  *"This is the previous evolution. Keep the same face, colors and style."*
- When something's off, ask for **one change at a time** ("make the hat smaller", "same image but facing left").
- Don't ask for real logos (like the Knicks logo). Image generators tend to refuse or garble them, and at 64×64
  pixels a logo can't be read anyway. **Orange and blue with a number** reads as a Knicks jersey.
- Ask for a **flat solid bright-green background**. It makes cutting the creature out easy, and none of our
  designs use that green.

---

## Step 1: Concept prompts

**Paste this style block at the start of every concept prompt:**

> Official Pokémon-style creature design in the style of Ken Sugimori's Generation 3 artwork (Pokémon Ruby/Sapphire/Emerald).
> Full body, single character, centered, simple clean shapes, bold dark outline, flat cel shading, limited color palette,
> cute and readable silhouette. Plain flat solid bright green background (#00FF00). No text, no logos, no watermark.

### Heeshlet
> [style block] A tiny baby sewer rat Pokémon named Heeshlet. Grey-brown fur, big round ears with pink insides, pink nose,
> long thin pink tail, huge shiny black eyes. It wears an oversized orange and blue basketball jersey that hangs on it like a dress.
> It is hugging a big red strawberry almost as big as its head. Cheese crumbs on its cheeks. Sitting on its back legs. Cute and mischievous.

### Heesh
> [style block] The evolved form of the attached rat Pokémon, named Heesh. Medium-sized rat standing on two legs, grey-brown fur,
> big ears, long pink tail with a small green-purple flame on the tip like a stove burner. Wears a fitted orange and blue basketball
> jersey with a big number on the front, and a white chef's hat tilted to one side. Holds a wedge of yellow cheese, a strawberry
> tucked behind one ear. Confident, cheeky expression.

### Heeshef
> [style block] The final evolution of the attached rat Pokémon, named Heeshef — the head chef of the sewers. Tall, confident rat
> standing proudly, grey-brown fur. Huge tall white chef's hat, orange and blue basketball jersey worn under a white chef's apron
> with purple stains. Holds a ladle like a royal scepter, a whole wheel of cheese under one arm. Long tail ending in a big purple
> flame. Smug, powerful expression. Looks like a boss.

### Omarlet
> [style block] A small baby raccoon Pokémon named Omarlet. Scruffy grey fur smudged with dirt, black bandit mask around its eyes,
> ringed striped tail. A dark beanie hat pulled down so low it almost covers its eyes. A little cloud of dust floats around it.
> It holds a stolen soft pretzel in its paws. Sneaky but cute expression.

### Omar
> [style block] The evolved form of the attached raccoon Pokémon, named Omar. A taller raccoon standing on two legs, scruffy grey fur,
> black bandit mask, ringed tail. Wears a slouchy dark beanie and an open hoodie with a mud stain. Has a tourist backpack overflowing
> with stolen souvenirs: a tiny Statue of Liberty, a foam finger, a hot dog. One hand hidden behind its back. Sly grin.

### Omarauder
> [style block] The final evolution of the attached raccoon Pokémon, named Omarauder — the king of city thieves. Big, burly raccoon,
> dark grey fur, black bandit mask, glowing yellow eyes, wide toothy grin. Tall patched beanie, long brown coat with pockets stuffed
> with stolen goods. Its arms are covered in hardened brown mud that looks like armor. A loot sack slung over one shoulder.
> Mud dripping at its feet. Intimidating but fun.

### Ahmedlet
> [style block] A short stocky bulldog puppy Pokémon named Ahmedlet, dressed as a rookie security guard. Tan and white fur,
> droopy jowls, small underbite. Wears an oversized navy blue security guard cap that is too big for it, a navy shirt with a yellow
> "security" style shield patch (no readable text), a small flashlight and a walkie-talkie on its belt. Serious face, trying hard
> to look tough. Adorable.

### Ahmed
> [style block] The evolved form of the attached bulldog Pokémon, named Ahmed — head of security. Muscular bulldog standing on two legs,
> tan and white fur, droopy jowls, underbite. Black tactical vest with a gold badge, earpiece with a coiled wire, dark sunglasses,
> spiked collar peeking out. Arms crossed, standing tall and serious.

### Ahmexec
> [style block] The final evolution of the attached bulldog Pokémon, named Ahmexec — the boss of a security company. Big broad
> bulldog standing tall, tan and white fur, strong jaw, underbite. Wears a sharp black business suit, white shirt, black tie,
> a gold shield-shaped pin on the lapel, shiny steel cufflinks, steel-plated knuckles. Holds a steel briefcase. Sunglasses pushed
> up on top of its head. Calm, powerful, rich-boss energy.

---

## Step 2: Pixel sprite prompts

Upload the approved concept image, then:

**Front sprite**
> Redraw this exact character as a Pokémon Emerald (Game Boy Advance, Generation 3) front battle sprite. Pixel art on a 64×64 pixel grid,
> with every pixel a crisp visible square — no anti-aliasing, no blur, no gradients. At most 15 colors. Dark outline, 2–3 shades per color.
> The character faces LEFT in a three-quarter view, full body, standing on the bottom of the frame. Flat solid bright green (#00FF00)
> background. Keep the design, colors and accessories identical.

Add this line for **stage 1** Pokémon: *"It is small and only fills about half of the 64×64 frame."*
Add this line for **stage 3** Pokémon: *"It is large and fills almost the whole 64×64 frame."*

**Back sprite**
> Same character, same pixel art style, 64×64 grid, at most 15 colors, now as a Generation 3 BACK battle sprite: seen from behind
> and slightly above, its back facing the viewer, turned slightly to the right, as if the player's Pokémon is facing an opponent.
> Show the back of the [hat / jersey / suit] clearly. Flat solid bright green (#00FF00) background.

**Party icon**
> Same character as a tiny 32×32 pixel art menu icon in Pokémon Emerald style: chibi, big head, simple, bold outline,
> about 8 colors, facing left. Flat solid bright green (#00FF00) background. Then draw a second frame next to it where it
> is bouncing up 1–2 pixels.

**Shiny version**: you don't need to draw it. Pick alternate colors and Claude makes `shiny.pal`. Ideas:
Heesh line: white fur and a gold jersey. Omar line: a red beanie and brown fur. Ahmed line: a white suit and black fur.

---

## When you have images

Drop them in `graphics/starters/<name>/` (any size, PNG), named `front.png`, `back.png` and `icon.png`. Claude converts them
to proper GBA format and hooks them into the game.
