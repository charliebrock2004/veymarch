# Veyrmarch: game direction review and implementation plan

Written 22 November 2026 after playing production as a new player and reading the repository on `devin/veyrmarch-overhaul`.

**How this was researched.** The game was played from the title screen through character creation into Hearthfen, and the code, data files and design bible were read. The comparisons with other games below come from well-known, long-documented design facts about those games, not from fresh web sources: the web search tool was not connected in this session. Player numbers and sales figures are deliberately left out for that reason.

## 1. Where the game is today

| Area | State | Verdict |
| --- | --- | --- |
| Content | 9 zones, 4 bosses, 31 creatures, 17 quests, level cap 25 | Good spine, thin flesh between bosses |
| Combat | Light and heavy swings, combos, roll with invulnerability, block, timed parry, one spell, stamina | The best thing in the game. Readable and fair |
| Progression | Level gives health, stamina and power. Gear from crafting and bosses | Flat. Two level 15 characters are the same character |
| World | Authored zones behind boss gates, shrines for fast travel, day and night | Strong structure, little to find off the path |
| Tone | Caller Cookie's nursery, Boe the collared hound, Finlay furious that you are late | Distinctive. "Absurdity with teeth" is real and rare |
| First minute | Title, character, world, a long load, then "Speak to Tanic" and "make a knife" | Slow and ordinary. Nothing happens that could only happen in Veyrmarch |
| Return reasons | Deeds and bestiary | Records only. Nothing changes because you came back |
| Multiplayer | Realms with shared world. Chapter II closed online | Works, but there is nothing to do together that you cannot do alone |
| Technology | Three.js, React, TypeScript, PGlite solo saves, Supabase realms, C# sim, dormant Unity track | Sound. `Game.ts` at 4,450 lines is the main risk |

**What is repetitive.** Every foe outside a boss room is fought the same way on the tenth meeting as on the first. Zones have one route. Gathering is walk, hold, collect. After a boss dies its zone has no further use.

**What is unfinished.** Online Chapter II, interiors of Keep, Kennels and Mire, modelled characters beyond the undead, the bible's "naming the dead" mechanic, mining gates (the Pick half of "Blade, Pick, Core").

## 2. What comparable games teach

| Game | What keeps people playing | Lesson for Veyrmarch |
| --- | --- | --- |
| Valheim | Each boss hands you the tool that opens the next biome. Small world of clear goals | Already our structure. Make the boss reward change how old zones play, not only open the next |
| Elden Ring | You see something on the horizon and it is always worth walking to | "Horizon hunger" needs things off the road: one secret per zone at minimum |
| Old School RuneScape | Many independent long goals, each visible as a number that only goes up | Give players several parallel tracks they choose between. Marks do this |
| Skyrim, Kingdom Come | You get better at what you do | Fits "no class, only evidence" exactly, and nothing in the game did it until now |
| Hades | Dying moves the story forward. Characters comment on what you did | Villagers should react to your marks, deaths and kills |
| Monster Hunter | Learning one monster deeply is the game. Parts become gear | Bestiary ranks: knowledge of a creature shown as its tells, drops and weak points |
| Deep Rock Galactic | Co-op where each player brings something the others lack. No pressure to log in | Marks make two players in a realm genuinely different |
| Vampire Survivors | A full, satisfying session in 15 minutes | Phone sessions are short. Offer a complete 10 minute activity |
| Outward, Gothic | You start as nobody and the world does not care | "Unmarked" is this. Lean on it in dialogue |
| Sea of Thieves | Stories players tell each other afterwards | Shared world events that end differently each time |

**Retention without manipulation.** Nothing here uses streaks, timers that punish absence, loot boxes or daily login rewards. Every reason to return is something the player can do at any time and that is still there next week.

## 3. Unique selling point

**The strongest thing we have** is the fair, readable combat on a phone, in a world with a real sense of humour.

**The biggest unused opportunity** is the bible's own third pillar: *no class, only evidence*. The fiction calls the player "Unmarked". Until this review nothing in the game marked them.

**Signature mechanic: the March marks you.** There are no classes and no skill points. The game watches what you actually do and marks you for it. Parry often and your parry window widens. Die often and you get harder to kill. Kill the dead and you hit the dead harder. Your character sheet is a record of how you really played, and no two are alike.

**One-line pitch.** *A fantasy RPG with no classes: play in your browser, and the world turns you into whatever you keep doing.*

## 4. Three creative directions

| Direction | What it is | For | Against |
| --- | --- | --- | --- |
| A. The March Marks You | Evidence-based character growth, world and villagers that react to your marks, co-op built on differing marks | Unique, cheap to extend, already matches the lore, works solo and online | Needs many small hooks across combat code |
| B. The Living Frontier | Rebuild Hearthfen as you clear zones, settlers arrive, world events | Strong return reason, visible change | Large art cost. Many games do it |
| C. The Toybox Souls-like | Lean fully into Cookie-style absurd bosses, a boss every 20 minutes, boss rush | Plays to the best content | Bosses are the most expensive thing to make. Little replay once learned |

**Recommendation: A, with the cheapest parts of B and C attached.** A is the only one a player could not get elsewhere, and it turns existing systems (codex, bestiary, deeds) into gameplay instead of needing new art.

## 5. Ideas (40)

Scores are 1 to 5. For difficulty, time and performance cost, 1 is easiest, shortest and cheapest. Priority: P0 now, P1 next, P2 later, P3 ambitious.

| # | Idea | Experience | Visual | Difficulty | Time | Perf cost | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Marks**: ten evidence-earned traits with three ranks each | 5 | 2 | 2 | 1 | 1 | **Done** |
| 2 | Marks visible on the body: scars, grave-dust, a wolf-pelt collar | 4 | 5 | 3 | 3 | 1 | P1 |
| 3 | Villagers greet you by your marks and deaths | 4 | 1 | 2 | 2 | 1 | P0 |
| 4 | Cold open: start in a fight you lose, wake Unmarked in Hearthfen | 5 | 4 | 3 | 2 | 1 | P0 |
| 5 | One hidden place per zone (cave, grave, treehouse) with a named reward | 5 | 4 | 3 | 3 | 1 | P0 |
| 6 | Bestiary ranks: 1, 10, 50 kills reveal tells, drops, weak point | 4 | 2 | 2 | 2 | 1 | P0 |
| 7 | Naming the dead: carry a grave marker, a named undead stops fighting | 5 | 3 | 3 | 3 | 1 | P1 |
| 8 | Mining gates: Pick opens ore walls into side areas of old zones | 4 | 3 | 3 | 3 | 1 | P1 |
| 9 | Boss rematches at shrines with a harder phase and a cosmetic reward | 4 | 2 | 2 | 2 | 1 | P1 |
| 10 | The Long Night: an optional 10 minute wave defence of Hearthfen | 4 | 3 | 3 | 3 | 2 | P1 |
| 11 | Weapon-family marks (sword, mace, spear) unlocking one move each | 5 | 3 | 3 | 3 | 1 | P1 |
| 12 | Perfect-dodge slow motion for half a second | 4 | 4 | 2 | 1 | 1 | P0 |
| 13 | Finishers on staggered foes | 4 | 5 | 4 | 3 | 1 | P2 |
| 14 | Hearthfen rebuilds: each boss kill adds a building and a trader | 5 | 5 | 4 | 4 | 2 | P2 |
| 15 | A trophy hall where every boss leaves an object | 3 | 4 | 2 | 2 | 1 | P1 |
| 16 | Weather that matters: rain douses fire, fog hides you | 3 | 4 | 3 | 3 | 1 | P2 |
| 17 | Night-only foes and night-only plants | 4 | 3 | 2 | 2 | 1 | P1 |
| 18 | Fishing in creek, moat and mire | 3 | 3 | 3 | 3 | 1 | P2 |
| 19 | Cooking with timed buffs that name their recipe giver | 3 | 1 | 2 | 2 | 1 | P2 |
| 20 | Photo mode with one-tap share image | 3 | 5 | 2 | 2 | 1 | P1 |
| 21 | Character card: a shareable picture of your marks and deeds | 4 | 4 | 2 | 2 | 1 | P1 |
| 22 | Ghost notes: short messages left at shrines for other players | 4 | 2 | 3 | 3 | 1 | P2 |
| 23 | Bloodstains: see how the last player died here | 4 | 4 | 3 | 3 | 1 | P2 |
| 24 | Realm bosses that need two different marks to open | 5 | 3 | 4 | 4 | 2 | P3 |
| 25 | Hard mode "Unshriven": no map markers, one life per zone | 3 | 1 | 2 | 2 | 1 | P2 |
| 26 | New Game Plus that keeps marks and remixes spawns | 4 | 2 | 3 | 3 | 1 | P2 |
| 27 | Weekly seeded challenge, same for everyone, no rewards lost by skipping | 3 | 1 | 3 | 3 | 1 | P3 |
| 28 | Companion hound earned from Boe's kennel | 5 | 5 | 4 | 4 | 2 | P2 |
| 29 | Mount for the long roads of the Kingdom | 3 | 4 | 4 | 4 | 2 | P3 |
| 30 | Rumours: villagers point at something visible on the horizon | 4 | 2 | 2 | 2 | 1 | P0 |
| 31 | Lore stones that read differently once you carry the right mark | 4 | 2 | 2 | 2 | 1 | P1 |
| 32 | Enemy factions that fight each other (goblins against wolves) | 4 | 4 | 3 | 3 | 2 | P2 |
| 33 | Elite roamers with names, which remember killing you | 5 | 3 | 3 | 3 | 1 | P1 |
| 34 | Player house in Hearthfen with storage and trophies | 3 | 4 | 3 | 3 | 1 | P2 |
| 35 | Transmog: keep the look of any gear you have owned | 3 | 4 | 2 | 2 | 1 | P2 |
| 36 | Chapter III: the bible's next region, with a boss built around marks | 5 | 5 | 5 | 5 | 3 | P3 |
| 37 | Music that layers in instruments as a fight escalates | 3 | 1 | 3 | 2 | 1 | P2 |
| 38 | Loading replaced by a playable campfire scene | 3 | 4 | 4 | 3 | 1 | P2 |
| 39 | Installable app with offline solo play | 4 | 1 | 2 | 2 | 1 | P0 |
| 40 | Villagers voiced by generated speech, cached as audio files | 3 | 1 | 3 | 3 | 1 | P3 |

## 6. Goals for the player

| Horizon | Goal | Where it shows |
| --- | --- | --- |
| Next minute | Kill this, gather that | Objective line |
| This session | Next mark rank, next bestiary rank | Journal, with progress bars |
| This week | Kill the zone's warden, find its hidden place | Map and rumours |
| Long term | All marks at rank III, every deed, every page | Journal totals, character card |
| Mastery | Rematches, Unshriven mode, weekly seed | Shrines |
| Social | Realm bosses, ghost notes, shared cards | Realms |

## 7. Technical review

| Topic | Finding | Action |
| --- | --- | --- |
| `Game.ts` | 4,450 lines, one closure. Every feature touches it | Split by system as each is next edited. No big-bang rewrite |
| Bundle | Game chunk 1.16 MB (336 KB compressed), solo database 684 KB | Acceptable. Load solo database only when single player is chosen (already split) |
| Load time | Fresh world took well over 30 seconds in a software-rendered browser | Measure on a real phone before optimising. Show the campfire scene instead of a bar |
| Models | KayKit CC0 packs are in use for undead | Continue with KayKit Adventurers for players and villagers, Quaternius for animals. Both CC0, no cost |
| Animation | glTF clips with a procedural fallback | Keep. Mixamo is free but its licence forbids redistributing raw files, so bake into the game's own glTF |
| Physics | Hand-written height and circle checks | Enough. Rapier (Apache 2.0) only if finishers or ragdolls are built |
| Pathfinding | Straight-line chase | `three-pathfinding` (MIT) when interiors get complex |
| Textures | PNG | Convert to KTX2 with Basis for roughly a quarter of the GPU memory on phones |
| Renderer | WebGL through Three.js | WebGPU is not yet safe as the only path on phones. Revisit in a year |
| Saves | PGlite in IndexedDB solo, Supabase online, codex in localStorage | Codex and marks should move into the save proper so they follow the player between devices |
| Offline | No service worker | Add one so solo play works without a connection |
| Unity track | Present, not buildable here, not shipping | Decide whether to keep paying its upkeep. Recommendation: freeze it |
| AI for assets | Painted key art already generated | Use for item icons, zone cards and concept sheets. Do not use for rigged characters yet: results still need hand cleanup |
| AI for speech | None | Pre-generate villager lines to audio files at build time. No runtime cost |
| AI at runtime | None | Not recommended. Cost per player and latency are both wrong for a free browser game |
| Tests | 57 web tests, C# sim tests | Add a headless smoke test that enters a world and swings once |

## 8. The ten changes with the highest return

1. Marks (shipped in this stage).
2. Cold open that starts with a fight.
3. Villagers who react to marks, deaths and kills.
4. One hidden place per zone.
5. Bestiary ranks.
6. Perfect-dodge slow motion.
7. Rumours pointing at the horizon.
8. Marks visible on the body.
9. Named roaming elites that remember you.
10. Installable, offline-capable solo play.

## 9. Stages

| Stage | Contents | State |
| --- | --- | --- |
| 1 | Marks: data, combat hooks, Journal tab, banner, tests | Built |
| 2 | Villager reactions, perfect-dodge slow motion, bestiary ranks | Built |
| 3 | Rumours and a Places journal for the 11 hidden caches; cold open on the Kingsroad | Built |
| 4 | Character card with earned title, charms on the body for each mark, trophy rack in Hearthfen | Built |
| 5 | Boss rematches and naming the dead (built); mining gates | Part built |
| 6 | Offline install, codex moved into the save, online Chapter II | Needs the realm database migration |

## 10. Stage 1 as built

Ten marks, three ranks each, earned from what the codex already records plus two new counters (attacks rolled through, falls).

| Mark | Earned by | Ranks at | Gives |
| --- | --- | --- | --- |
| Beast-Blooded | Killing beasts | 20, 80, 200 | 8, 14, 20% harder strikes on beasts |
| Gravewise | Killing the dead | 20, 80, 200 | 8, 14, 20% on the dead |
| Manhunter | Killing goblins, outlaws, soldiers | 20, 80, 200 | 8, 14, 20% on men and goblins |
| Nursery-Wise | Breaking toys | 15, 50, 120 | 8, 14, 20% on toys |
| Still Hand | Parries | 8, 35, 100 | Parry window 30, 60, 90 ms wider |
| Ghoststep | Rolling through attacks | 12, 50, 150 | Roll costs 15, 25, 35% less stamina |
| Much-Buried | Dying | 3, 10, 25 | Take 3, 6, 9% less damage |
| Warden's Bane | Bosses killed | 1, 2, 4 | Heavy blows 6, 12, 18% harder |
| Maker's Hands | Crafting | 8, 30, 80 | Food and draughts heal 10, 20, 30% more |
| Wayfarer | Lands walked | 3, 6, 9 | Running in a fight costs 15, 30, 45% less |

Existing characters keep everything: marks are computed from the record they already have, and ranks they have already earned are granted quietly on first load rather than as a run of banners.
