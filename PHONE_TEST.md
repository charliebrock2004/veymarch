# VEYRMARCH — manual phone test

The agent that builds this game cannot reach Supabase or Vercel from its container, so the
online game has only been tested with two headless browsers against the local realm. This is
the test only real phones can do. It takes about 40 minutes with two people. Write down
anything odd with the time it happened; a screenshot helps.

## Before you start

- Two phones (iPhone Safari or Android Chrome), both on the internet. Landscape, sound on.
- The production link from the latest deployment (Vercel → project `veymarch` → Production).
- Optional: Add to Home Screen on iPhone for full screen (Share → Add to Home Screen).

## 1. Single Player (one phone, 5 minutes)

1. Open the link. The title screen appears with music. Tap **Single Player**.
2. Make a character. You wake in Hearthfen. Walk with the left thumb, look by dragging right.
3. Talk to Tanic, pick up flint and wood, craft the knife (Bag → Craft).
4. Kill a wolf. A `+XP` number floats up; the XP bar under your health fills.
5. Pause → Quit to title, then Single Player again: your character, items and level are still there.
6. Open Single Player in a second tab: it should say Single Player is already open.

Pass if: nothing freezes, the save survives, the music changes between the village and the forest.

## 2. Create and join a world (two phones, 5 minutes)

1. Phone A: **Play** → New Character → Create → Continue → **Create World**. A six-letter code shows.
2. Phone B: **Play** → New Character → Create → Continue → **Join World** → type the code.
3. Both: you see each other with the right clothes, a quiet nameplate, and smooth movement.
4. Phone A locks the screen for 20 seconds, then unlocks. Enemies pause for a few seconds at
   most, then carry on; nobody is thrown back in time.

Pass if: both are in the same world, each sees the other move, the code works first time.

## 3. Fight together (10 minutes)

1. Fight wolves together. Each kill gives loot and XP to whoever looted; nobody gets the same
   kill twice.
2. Let one player go down. The other holds Revive next to them.
3. Enter Cookie's Castle together, solve the weight door, silence the rocking horse, fight
   Cookie. Her health bar should be larger than in Single Player (shared pool for two).
4. When Cookie falls, both get the reward screen once, each with their own Blade, Pickaxe and Core.

Pass if: one Cookie for both, she dies once, both are paid once.

## 4. The Kingdom and beyond (15 minutes)

1. Open the Green Gate. KINGDOM UNLOCKED appears. Walk east along the Kingsroad into Harrenvale.
2. Talk to Castellan Voss and the shopkeepers. Buy something with crowns, sell something back.
3. Rest at a shrine (the market cross), then open the map and fast travel to Hearthfen and back.
4. Equip armour (Bag → tap the piece). It shows on your character, and the other phone sees it too.
5. If you have time: the Hunting Grounds, the Kennels (Boe), the Mire, the Black Keep (Finlay).
   Finlay's "Smell my fingers" puts a circle under each player: walk out of yours within 5 seconds.

## 5. Persistence (5 minutes)

1. Both leave the world (Pause → Leave). Phone A opens the world again alone: day, doors,
   Cookie and the gate are as you left them.
2. Phone B rejoins later from the Worlds list (no code needed the second time).

## What to report

For each section: pass or fail, the phone model and browser, roughly how smooth it felt
(smooth / a little choppy / slideshow), and anything strange. Settings → Graphics lets you try
Low if it is choppy.
