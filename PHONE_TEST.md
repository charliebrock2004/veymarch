# VEYRMARCH — manual phone test

The agent that builds this game cannot reach Supabase or Vercel from its container, so the
online game has only been tested with two headless browsers against the local realm. This is
the test only real phones can do. It takes about 40 minutes with two people. Write down
anything odd with the time it happened; a screenshot helps.

## Before you start

- Two phones (iPhone Safari or Android Chrome), both on the internet. Landscape, sound on.
  Mobile data on one phone and Wi-Fi on the other is a good test; a school or office network
  that blocks `*.supabase.co` will stop online play.
- The production link: **https://veyrmarch.vercel.app** on both phones. Do not use a link with a
  long hash in it (`veyrmarch-xxxxxxxx-charlie-brock.vercel.app`): those are single deployments,
  protected by Vercel login, and a friend's phone gets a Vercel sign-in page instead of the game.
- Close any old VEYRMARCH tab first, or pull down to reload: a tab left open from before a new
  deployment is running the old build.
- Optional: Add to Home Screen on iPhone for full screen (Share → Add to Home Screen).

## 1. Single Player (one phone, 5 minutes)

1. Open the link. The title screen appears with music. Tap **Single Player**.
2. Make a character. You wake in Hearthfen. Walk with the left thumb, look by dragging right.
3. Talk to Tanic, pick up flint and wood, craft the knife (Bag → Craft).
4. Kill a wolf. A `+XP` number floats up; the XP bar under your health fills.
5. Pause → Quit to title, then Single Player again: your character, items and level are still there.
6. Open Single Player in a second tab: it should say Single Player is already open.

Pass if: nothing freezes, the save survives, the music changes between the village and the forest.

## 2. Create and join a world (two phones, 10 minutes)

Phone A:
1. Open https://veyrmarch.vercel.app. Tap **Play**.
2. New Character → Create → **Continue** (or Continue on an existing character).
3. **Create World** → Create. A six-letter code shows. Write it down.
4. **Enter World**. You are in Hearthfen; the party list shows only you.

Phone B:
1. Open https://veyrmarch.vercel.app. Tap **Play**.
2. New Character → Create → **Continue**.
3. **Join World** → type the code (lower case and spaces are fine) → **Join**.
4. "Looking for that world…" then you are in the same place as Phone A.

Then check, writing pass or fail for each:

- [ ] Both are in the same world (same code in Pause, both names in the party list).
- [ ] Phone A sees Phone B's character, with a nameplate and the right clothes.
- [ ] Phone B sees Phone A's character.
- [ ] Walking on one phone moves the character on the other within about a second.
- [ ] Combat: hit a wolf together. Both see its health drop and it dies once; whoever loots
      gets the loot once.
- [ ] World state: one player opens a door or gathers a node; the other sees it changed.
- [ ] Disconnect: Phone B locks its screen for 30 seconds. Phone A sees B stop and then vanish
      within about half a minute, and keeps playing; enemies keep moving.
- [ ] Reconnect: Phone B unlocks. Within a few seconds B sees A again and A sees B, with no
      second copy of B standing where B was.
- [ ] Leave and rejoin: Phone B Pause → Leave, then Play → Continue → the world is in the Worlds
      list (no code needed) → Enter. Only one B appears on Phone A.
- [ ] Wrong code: Phone B types a code that does not exist. It says "No world has that code"
      and stays on the code screen; nothing spins forever.
- [ ] No screen ever spins for more than about 20 seconds: a stalled network shows "The realm is
      not answering" with Try again.

If Phone B never gets past the title or "Reaching the realm…": note the phone model, iOS or
Android version and browser, and whether the address bar shows exactly `veyrmarch.vercel.app`.

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
