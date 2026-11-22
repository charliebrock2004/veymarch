# Veyrmarch overhaul: what changed, how it was checked, what is left

Branch `devin/veyrmarch-overhaul`. Web game only (`web/`); the Unity track was not opened or built.

## Gameplay

| System | What it does | Where |
| --- | --- | --- |
| Talents | Four trees (Might, Guard, Ember, Way). One point per level, more ranks than points. Journal > Talents | `web/src/game/data/talents.ts` |
| Critical blows | 5% base chance, x1.75, own sound, flash and number | `Game.ts`, `engine/audio.ts` |
| Openings | Blows from behind and on reeling foes hit harder | `Game.ts` |
| Pack behaviour | Foes alert neighbours, take turns attacking, cowards retreat when hurt | `Game.ts` |
| Hidden finds | 22 caches and rune stones across the outdoor zones | `web/src/game/data/explore.ts` |
| Bounties | A standing board of three. No daily reset: a new board goes up when all three are paid | `explore.ts`, Journal > Bounties |
| Boss reveal | Camera sweeps to the boss on first sight, with a name card and a line of speech | `Game.ts`, `play/bosses/*` |

Marks, bestiary ranks, rumours and Places came from the parallel direction work (`GAME_DIRECTION.md`) and are merged with the above.

**Open design conflict.** `GAME_DIRECTION.md` says "no classes and no skill points". Talents are skill points. Both are in the game; the owner has been asked which to keep.

## Graphics

- One animated water shader (ripples, Fresnel sky reflection, sun glitter, bank foam) on the creek, Mire and Kingdom marsh: `engine/kit.ts`.
- Player travel gear: straps, satchel, pouch, bracers, wraps, boots.
- Rim lighting on characters and bosses; brighter Black Keep palette, fog and floor so Finlay reads as a figure.
- Modelled (CC0) player, villagers, animals, skeletons and Grave King from the parallel work.

## Save compatibility

All new state is optional fields on the existing local codex (`tal`, `fd`, `b`, `bn`). Old saves load unchanged. Rewards in single player are written to the device's own world database.

## How it was checked

- `npx tsc --noEmit`, `npm test` (67 pass), `npm run build`.
- `web/scripts/play.mjs` (headless Chromium): character creation, all 22 finds placed, a cache and a stone collected, talents spent in the Journal, bounty board shown. Run at 1024x576 and 390x844.
- `web/scripts/qa.mjs`: a wolf fought to death with real swings, dodge, a bounty filled and claimed in the Journal, then a page reload confirming talents, bounty board and position come back.
- `web/scripts/boss.mjs`: reveal sequence for Boe, Finlay and the Grave King.

## Not checked

- Sound by ear, a physical gamepad, real phones and tablets, frame rate on real graphics hardware (the test browser renders in software and is very slow outdoors).
- Full boss fights to the kill, crafting, fast travel and the quest chain were not replayed end to end after these changes.
- A recurring `ErrnoError` appears in the headless browser console. It predates this work and play continues; cause not found.

## Honest standing

The look is a stylised low-poly game with good lighting and water. It is not near a AAA title. Biggest remaining gaps: building and terrain detail, Keep/Kennel/Mire interiors, animation blending on the hand-built characters, `Game.ts` size (about 4,900 lines).
