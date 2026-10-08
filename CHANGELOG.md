# Changelog

## Unreleased

### Phase 2: the RPG (web, in progress)

- Zones on one coordinate line (Hearthfen, Cookie's Castle, the Medieval Kingdom, the King's Hunting Grounds, the Royal Kennels, the Dark Mire, the Black Keep), each its own download, built the first time someone goes there; one world runner per zone.
- XP and levels (to 20) with health, stamina and strike power; crowns, shops that buy and sell; armour slots (head, chest, hands, legs, feet, shield, trinket) with set bonuses; rarity from Common to Unique; weapon families (dagger, sword, axe, mace, spear, greatsword) with their own speed and reach; eight crafting stations.
- Data-driven quests (main road and side work) with a journal and tracked objective; KINGDOM UNLOCKED when the Green Gate opens.
- Shrines and fast travel between discovered shrines; waking at the last shrine you rested at.
- Every boss (Cookie, Boe, Finlay) shares one interface: one runner simulates the fight, the server prices every blow against one pool whose size grows with the number of fighters, and personal hazards (Finlay's finger rite) are judged on each player's own client.
- Server: per-boss health pools, quests, shops, travel, XP on kills and quests, zone-aware heartbeats; the live schema upgrades in place from the first Realms release.
- Visible armour: helmets, chest pieces, gauntlets, legs and boots drawn on the character (leather, iron, steel, houndhide, Black Knight), also on other players.
- Music: a procedural theme for every place and every boss (title, Hearthfen, the forest, the castle, the Kingsroad, Harrenvale, Blackwood, the kennels, the Mire, the Keep, Cookie, Boe, Finlay, the finger rite, the ending), crossfaded, with combat layers that rise when foes close in.
- The chapter ends after the Black Keep with TO BE CONTINUED.
- Content: Harrenvale (walls, market cross shrine, smithy, armoury, tavern, church, Old Tower, Voss's hall, the Royal Fortress on its ridge), Millcross, bandits, the quarry and the causeway chain; Blackwood and its ruined lodge; the Royal Kennels (trap run, secret nook, cart-and-plates puzzle with a solo solution, the Kennelmaster, the bell gate); the Dark Mire and Drear on stilts; the Black Keep (winch, armoury, crypt, throne room, the broken ring). Seventeen Kingdom townsfolk with routes and lines, Drear's villagers.
- Thirteen new foes, from bandits to keep knights; the Hound Bell keeps hounds calm until you strike them.
- Boe: Elspeth's black cocker spaniel with the red collar, three phases (play, the collar, ear-wings). Finlay: guard and riposte, helm off, "Smell my fingers" with a circle under each player.
- Item modifiers (Keen, Heavy, Balanced, Sturdy, of the Fleet): sometimes on crafted gear, set by the enchanter.
- Server hardening: loot and gathering need you near; waking after a fall only at the bedroll, a known shrine or a dungeon's front door; no buy-craft-sell loops; old-save imports limited; no double soulbound crafts.

### Realms multiplayer (web)

- Create a world, get a six-letter code, share it; friends join with their own characters. Up to four players. Worlds and characters persist on the server (Supabase Postgres); leaving or closing a phone does not end the world.
- Player profile separate from world saves: characters (look, inventory, equipment, Ember, kills, deaths, time) belong to a device key and travel between worlds; world progress (day, clock, doors, Green Gate, Cookie, gathered nodes, dead enemies) belongs to the world.
- Server-authoritative functions for identity, membership, inventory changes, loot (once per enemy per respawn), crafting stations, caches, world flags, and Cookie's shared health pool with the three uniques granted exactly once per fighter.
- Live play over Supabase Realtime: smoothed remote players with their saved look, weapon and a quiet nameplate; shared enemies run by one client and mirrored on the others; one Cookie for everyone; revive downed friends; party list and world code in the HUD and pause menu; reconnect and runner hand-over.
- Title flow: Play → My Characters → Worlds (Play / Join World / Create World), Single Player kept as it was. Existing single player saves are copied once into the online profile.
- Local realm (`npm run realm`) running the same SQL in PGlite for development and two-browser tests.

### Realms hardening (review fixes)

- Inventory changes lock the character row; a take that cannot be fully paid raises, so parallel crafts, trades or bandages can no longer duplicate items.
- Old local saves import only early-game gear, from `slotN:` sources, at most three per device key.
- Cookie hits must come from the castle courtyard; Ember damage needs Ember and is throttled.
- Seats free up when a player leaves, is removed by the world's maker, or deletes their character; joining locks the world, so a fifth player cannot slip in. Makers can delete worlds; guests can leave them.
- Zone changes (overworld ↔ castle) are accepted only at a door.
- A phone waking up or reconnecting listens before it takes over the world, so it no longer rewinds enemies or resets Cookie.
- Cookie always falls on the world runner, even if the world flag arrives before the killing blow; slow motion, sounds, camera shake and combat music only play for players near the action.
- Single Player pauses behind menus again, the bedroll skips the night, and only one tab can open it at a time.
- Reward screen shows once per character (even if downed or in a menu when Cookie falls); interrupted gathers and revives no longer fire from a distance.
- Settings → Player key asks before replacing a key with characters on it and offers Switch back. A `?join=` link is used once.

### Web build (current playable milestone)

- `web/` is now a real game for phones: procedural world (Hearthfen, Giant Forest, Cookie's Castle, Kingsbridge, Green Gate, Kingdom vista), animated characters, villagers on routes, combat with telegraphs, Cookie in three phases, crafting at stations, barter, three save slots, character creator, touch controls, day and night, synthesised sound. Deployed to Vercel production.

### Fixed

- `Veyr.Sim` and `Veyr.Content` now compile under Unity 6's C# 9 / .NET Standard 2.1. They did not before.
- The world clock advanced once per actor per call; it now advances once per step for any number of players.
- Forged requests: gathering from anywhere, crafting at an imaginary bench, client-claimed flank, unknown ids crashing the sim, swinging while staggered, equipping materials.
- Saves now flush to disk and keep two previous generations; the old backup was a copy of the newest write.

### Added

- 20 Hz world step with an intent queue, movement-claim validation (speed budget, teleport, climb, gate blockers), and a sim event log.
- `Veyr.Net` contract, `Veyr.Server` embedded offline authority, `Veyr.Client.Core` (touch stick, look, dodge flick, prediction motor, orbit camera maths, frame stats, quality tiers, thermal step-down, safe area).
- Unity client and composition adapters, editor setup (player settings, URP tiers), generated Boot / Dev_Move / Forest_Blockout scenes, play-mode smoke tests. Not yet opened in Unity.
- Unity API declarations and per-assembly compile checks so CI type-checks the Unity code and enforces assembly boundaries.
- CI workflow, device checkpoint script (`Docs/device/PHASE3.md`), `ARCHITECTURE.md`.
- Repository audit and copies of the design, architecture, programme, art, and operating documents.
- `Veyr.Content` slice catalog and `Veyr.Sim` rules: clock, movement authority, inventory, crafting, gathering, combat, skills, bosses, grants, seals, saves, day clock, schedules, quests, death modes, Ember, building, settlements, dungeon seeds.
- Deeper sim: status and cleanse, enemy telegraph timing, dungeon trap and weight door, loot uniqueness, durability, armour sets, magic-school gates, corruption, net envelopes, dialogue, corpse records, content audit.
- 64 automated tests on .NET 8. Headless loop harness and `Veyr.Check`.
- Input action map and a slice prefab spec. Neither has been opened by Unity.
