# G-Moves

G-Moves are the game's Z-Moves under a new name: a one-time super move per battle. Every new Pokémon
line has its own. To use one, a Pokémon needs to:

1. know its line's signature move,
2. hold its line's **G-Crystal**,
3. and you need the **G-Power Ring** (the renamed Z-Power Ring) in your bag.

Then pick the move in battle and press START to power it up. All the battle text says G-Power and
G-Move instead of Z-Power and Z-Move.

| Line | G-Crystal | Signature move | G-Move | Type | Power | Extra |
|---|---|---|---|---|---|---|
| Squeesh → Heesh → Heeshef | Heeshium G | Toxic Fondue | **Fondue Tsunami** | Poison, special | 185 | 50% burn |
| Beanito → Omar → Omarauder | Omarium G | Sticky Fingers | **Big Beanie Heist** | Dark, physical | 180 | Lowers Attack |
| Guardpup → Ahmed → Ahmexec | Ahmedium G | Lockdown | **Hostile Takeover** | Steel, physical | 185 | Foe can't escape |
| Haleeb | Haleebium G | Milk Shower | **Milky Way Deluge** | Fairy, special | 185 | Heals 50% of damage |
| Ceaser | Ceaserium G | Royal Pounce | **Veni Vidi Vici** | Grass, physical | 200 | Lowers Defense |
| Snickers | Snickersium G | Storm Claw | **Satisfying Swipe** | Dark, physical | 195 | High crit, 30% paralysis |

All the regular Z-Moves (Breakneck Blitz, etc.) still work too, as G-Moves, with the usual type crystals.

## Where they are

- Moves: `game/g_moves.h`. Crystals and the renames: `game/g_moves.py`.
- In the story, **Hamza** (your rival, who never stops talking about gimmicks) gives you the G-Power
  Ring and your starter's G-Crystal on Route 110. The legends' crystals are debug-only for now.
- Tests: `game/tests/remix_starters.c` ("Remix: G-Crystals turn each signature move into its G-Move").
