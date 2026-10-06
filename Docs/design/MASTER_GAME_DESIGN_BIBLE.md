# VEYRMARCH
## Master Game Design + Technical Architecture Bible
### Working title. Authoritative creative source of truth.

| Field | Decision |
| --- | --- |
| Working title | **VEYRMARCH** |
| Subtitle | The Sealed Continent |
| Genre | 3D third-person medieval fantasy action-RPG with exploration, crafting, construction, and 4-player co-op |
| Engine | Unity 6 (6000.x LTS line), Universal Render Pipeline |
| Primary platforms | iOS, Android |
| Later platform | PC (same project, input + quality tier, not a separate game) |
| Session size | 1–4 cooperative players. No PvP in v1. |
| Camera | Third-person orbit, over-shoulder combat bias, optional lock-on. Not isometric. Not first-person. |
| Tone | High-fantasy tragedy with mythic absurdity. Ridiculous bosses are in-world corruptions, not joke skins. |
| World scale | One interconnected continent. Small-to-medium, dense. Target traversable footprint roughly 4 km × 4 km of playable land plus vertical strata, streamed. Not an empty 16 km map. |
| Starting class | None. Fists only. |
| First shippable proof | Mobile vertical slice: village → forest → craft → fight → Cookie dungeon → Cookie → barrier → edge of Kingdom. |

This document is the creative and architectural source of truth. Implementation code is out of scope here. Where the brief was silent, a decision is made and marked **DECIDED**. Open items are only in the final questions section.

---

# 1. Executive game vision

VEYRMARCH is a premium mobile-first fantasy RPG that feels like a sealed continent you can walk, not a voxel toy and not a menu of biomes.

The player is an Unmarked: a person the old seals do not recognise. They wake outside Hearthfen, a living medieval village on the edge of the Giant Forest, with no weapon, no class, and no explanation beyond what the villagers will say. The continent of Veyr was locked into regions by the March-Seals after a war against the Tear — a wound at the northern sky where the Void leaks in. Each seal is held by a Warden. Some Wardens were heroes. Some were animals, toys, knights, and ordinary furious men who were rewritten when the Tear touched them.

Progression is geographic and material at the same time. You see the next castle before you can reach it. You earn the right to cross by killing the Warden, taking their blade and their pick, and using both: the blade to survive what waits, the pick to take the ore that makes the next life possible.

The game must feel authored. Procedural systems vary dungeons, camps, loot modifiers, and NPC schedules. They do not invent the continent. The continent is designed. Density beats size.

Identity pillars that must survive contact with production:

- You start with nothing and become someone by what you do.
- The horizon is a promise, not a loading screen.
- Combat is readable on a phone and still has stagger, parry, and commitment.
- Magic is a craft, not a hotbar of identical missiles.
- Settlements are places people live, not chest rooms with hats.
- Cookie, Boe, and Finster are canon. They are played straight inside a broken myth.

**DECIDED name lore.** “Veyr” is the old word for the marched boundary. “The March” is both the military road and the sequence of seals. Players may never hear the word Veyrmarch in dialogue. Villagers say “the sealed lands” and “the next gate.”

---

# 2. Design pillars

1. **Horizon hunger.** From almost every safe vantage, at least one unreachable landmark is visible. The player should ask what is over there before any quest tells them.
2. **Earn the next ground.** Region locks are physical or magical facts: fog-walls, drowned bridges, storm bands, living gates. Boss tools are the keys.
3. **No class, only evidence.** The character sheet describes what you have practised. It never asks you to pick a destiny at minute one.
4. **Absurdity with teeth.** A toy penguin can be funny for four seconds. By phase two it is a siege weapon. Comedy is the introduction, not the difficulty.
5. **Dense, not wide.** A forest path with a grave, a rumour, a wolf pack, and a visible tower beats an empty kilometre.
6. **Phone-first combat.** Every action maps to a thumb. Lock-on, context interact, and stamina are the readability layer.
7. **Authored world, procedural dressing.** Landmarks, bosses, main quests, and seal gates are handcrafted. Camps, dungeon graphs, minor loot, and NPC daily noise vary.
8. **Shared world, owned body.** World progress is the world’s. Character level, skills, and soulbound gear travel with the player. This split is non-negotiable.
9. **Stable frames over spectacle.** 30 fps locked on target devices beats 60 fps that thermal-throttles into a slideshow. Ultra is a ceiling, not the design target.
10. **Slice before continent.** No region exists in code until the previous region’s loop is playable on a device.

---

# 3. Target player experience

## 3.1 Who it is for

Primary: players who want a fantasy RPG session of 20–40 minutes on a phone, with optional longer sessions, and who will tolerate crafting if it visibly changes the next fight.

Secondary: co-op pairs and groups of up to four who share a world hosted by one of them.

Not for: competitive PvP players, players who want a pure sandbox with no authored gates, players who want a 100-hour empty explorer on day one.

## 3.2 First ten minutes

1. Main menu. No login wall before the menu music. Account is prompted when creating or joining an online world, not before hearing the theme.
2. Character creator. Body, face, hair, marks. No class. Confirm.
3. World create. Name, mode (Adventure default), seed optional, multiplayer off by default.
4. Wake on the Hearthfen palisade road at dawn. Fists. A bell. Villagers already moving.
5. Tanic is visible at the workshop lane, not forced into a cutscene. A simple prompt: hold to speak.
6. First loop without a tutorial popup stack: pick up a branch (interact), break a flint node, speak to Tanic, craft a stone knife at the communal bench if the player finds it. Combat tutorial is a wolf at the tree line, not a dummy with text.

## 3.3 Session fantasy

A good session ends with one of: a new tool tier, a gate that now answers, a settlement that survived the night, a boss phase understood, a view of a region you cannot enter yet.

## 3.4 Emotional arc of the continent

Wonder (Forest) → order and rot beneath it (Kingdom) → disgust and pity (Mire) → grief (Wasteland) → austerity (Frost) → grandeur and theft (Desert) → awe and punishment (Volcano) → drowning memory (Drowned) → vertical myth (Skylands) → anger given a face (Void / Finster).

---

# 4. Complete gameplay loop

## 4.1 Moment loop (30–90 seconds)

Read enemy or node → commit stamina → hit, dodge, or mine → recover → loot or node pop → decide to press or leave.

## 4.2 Encounter loop (3–8 minutes)

Scout → pull or avoid → fight with terrain → search the camp → find a rumour, chest, or NPC → mark the horizon landmark.

## 4.3 Region loop (hours)

Explore visible edge → gather tier materials → craft region kit → clear dungeon wings → learn boss tell → kill Warden → take Blade + Pick + Core → gate opens → new ore exists in the world → old region remains and escalates via events.

## 4.4 Macro loop

Unmarked → village trust → first seal (Cookie) → kingdom politics → mire bargain → grave oath → frost pilgrimage → desert contract → volcanic descent → drowned court → sky trial → Tear audience with Finster.

## 4.5 Failure loop

Death is a route back to a shrine or bed with a cost defined by mode (see §28). It is not a full reset of exploration. Boss attempts keep learned tells. Hardcore is the exception.

### System card — Core loop

| | |
| --- | --- |
| Purpose | Keep the player asking what is over there, and make the answer cost a craft and a fight. |
| Player-facing | Explore, gather, craft, fight, level, discover, prepare, kill, unlock, repeat. |
| Dependencies | Movement, interact, inventory, crafting bench, combat, region gates, boss loot tables. |
| Data | Region unlock flags, tool tier, player skills, discovery set. |
| Technical | Gate state is server-authoritative world data. Client may predict approach but not unlock. |
| Mobile | Loop must complete without opening more than one full-screen menu per craft. |
| Multiplayer | Gather and fight are shared space. Unlock is world-scoped; all present players see the gate fall. |
| Testing | Fresh character can reach Cookie kill and see Kingdom edge without softlock. |

---

# 5. World design

## 5.1 Continent shape

Veyr is a single landmass with a drowned southern shelf and a broken sky to the north-east. It is not ten squares.

Rough arrangement, clocked from the player’s start:

- **Giant Forest** — west-centre, lowland, Hearthfen. Starter.
- **Medieval Kingdom** — east of the forest, across the Broken Kingsbridge and the Green Gate. Rolling farmland into a walled capital, Harrenvale.
- **Dark Mire** — south of the forest/kingdom border, sunken. Entered after Kingdom seal or via a cursed fog gap that the Kingdom pick cannot clear alone — **DECIDED:** Kingdom seal (Black Knight) opens the official road; a hidden mire path exists but is lethal without rot resistance.
- **Undead Wasteland** — east of the Mire, north of the Desert approach. Dead river. Citadel visible from Kingdom walls on clear days.
- **Frostlands** — north of the Kingdom, mountain wall. Seen from Hearthfen on rare clear mornings as a white tooth.
- **Golden Desert** — south-east, beyond the waste’s salt flats.
- **Ashen Volcano** — east, the continent’s furnace, always smoking. Visible from half the map.
- **Drowned Kingdom** — far south, below the sea shelf. Surface ruins visible; true palace is under.
- **Skylands** — north-east, islands torn upward. Only reachable after volcano and drowned seals (two keys).
- **The Void / End** — not a place you walk to from a road. The Tear, above the Skylands, entered through the Celestial Gate after the Guardian falls. Interior is a castle that should not be able to stand.

## 5.2 Traversal rules

- Walk, sprint, jump, crouch, swim, climb marked surfaces, dodge.
- No flying until Skylands tools or a late mount. Early “flight” is boss-only (Boe’s ear-wings are his, not the player’s).
- Mounts are **DECIDED** as a Kingdom-tier unlock: a horse for road speed, not combat dominance. Mounts despawn in dungeons.
- Boats at Mire/Drowned. Simple buoyancy, not a sailing sim.
- Fast travel: discovered shrines, after that region’s Warden is dead. Before that, shrines are save points only. This preserves horizon hunger.

## 5.3 Time

Day length **DECIDED:** 24 real minutes = 1 game day (16 min day, 8 min night) in Adventure. Survival can set 32 real minutes. Night raises minor spawn pressure. It does not hard-lock content except blood-moon events.

## 5.4 Scale targets

| Region | Playable area (approx.) | Vertical | Handcrafted landmarks | Proc camps |
| --- | --- | --- | --- | --- |
| Giant Forest | 800 × 800 m | 120 m | 14 | 8–12 |
| Kingdom | 900 × 700 m | 160 m | 18 | 10–14 |
| Dark Mire | 700 × 600 m | 80 m + caves | 12 | 8 |
| Undead Wasteland | 800 × 700 m | 140 m | 12 | 10 |
| Frostlands | 750 × 800 m | 400 m | 12 | 8 |
| Golden Desert | 900 × 800 m | 120 m + pyramid depth | 12 | 10 |
| Ashen Volcano | 600 × 600 m | 500 m | 10 | 6 |
| Drowned Kingdom | 700 × 700 m | 200 m below | 12 | 6 |
| Skylands | 500 × 500 m islands | 600 m | 10 | 4 |
| Void | Arena-castle, not open | Interior | 1 mega-structure | 0 |

Total is intentionally not a AAA open-world footprint. Density and streaming stability are the product.

---

# 6. Region specifications

Each region uses the same contract: identity, geography, climate, weather, audio, wildlife, enemies, elites, resources, ores, structures, villages, dungeons, NPCs, hazards, secrets, quests, boss, arena, rewards, unlock, unique mechanic, VFX, performance.

## 6.1 The Giant Forest

- **Identity:** Old green, wet bark, honey light, toy-horror under the cute. The first lie of the game is that this is safe.
- **Geography:** Giant roots as bridges, a village in a clearing (Hearthfen), a river to the east that becomes the broken bridge, Cookie’s Castle grown into a hillside like a nursery that fossilised.
- **Climate:** Temperate, damp, mild.
- **Weather:** Drizzle, sun shafts, rare pollen haze. No lethal weather.
- **Ambient:** Wind in high leaves, woodpeckers, distant smith hammer from the village, a music-box motif that is diegetic near the castle.
- **Music:** Folk strings, low woodwind. Castle approach adds a warped lullaby.
- **Wildlife:** Deer (huntable), boar, rabbits, songbirds, bees. Deer flee. Boar charge if crowded.
- **Enemies:** Wolves, boars (aggressive variant), giant spiders, goblin scouts, bandit knifemen, forest spirits (night), young bears.
- **Elites:** Grove Matron spider, Redcap bandit captain, Mossback bear.
- **Resources:** Wood, fibre, resin, berries, mushrooms, flint, bone, feathers, honey.
- **Ores:** Surface copper in creek stones. No iron nodes until the copper pick exists; iron veins are visible but ping “too green” if struck early.
- **Structures:** Hearthfen, forester huts, ruined shrine, goblin stilt camp, giant tree hollow, Cookie’s Castle.
- **Villages:** Hearthfen only. Population ~18 named or role NPCs, 12 of them scheduled.
- **Dungeons:** Root Warrens (short), Bandit Hollow (short), Cookie’s Castle (long, first real dungeon).
- **NPCs:** Tanic, Mara the smith, Old Penn the beekeeper, Sera the hunter, Captain Bramble (village guard, anxious), children who repeat the penguin rhyme.
- **Hazards:** Spider silk slow, fall from roots, night spirits that drain a little stamina.
- **Secrets:** Toy soldier cache under the mill; Tanic’s locked chest that cannot open until Kingdom; a grave with the player’s unset name scratched out.
- **Quests:** See §19. First quests are local and optional except the gate rumour.
- **Boss:** Evil Toy Penguin Caller Cookie.
- **Arena:** Nursery courtyard inside the castle, oversized toys as pillars, a broken music box in the centre.
- **Rewards:** Cookie’s Blade, Cookie’s Pickaxe, Cookie’s Core. Guaranteed.
- **Unlock:** Green Gate at Kingsbridge. The Core is socketed into the gate, or carried nearby — **DECIDED:** carrying the Core or having it in the world stash unlocks the gate for the world. It is not consumed.
- **Unique mechanic:** Toy Aggro. Some forest objects (dolls, blocks) animate if Cookie is alive and the player is near the castle.
- **VFX:** Sawdust blood, button eyes, wind-up sparks. Mobile: cap simultaneous toy fragments at 24.
- **Performance:** Hero region. Highest foliage density budget. Impostor trees beyond 40 m on Low.

## 6.2 The Medieval Kingdom

- **Identity:** Stone, wheat, banners, law that is already cracking. Beautiful and bureaucratic.
- **Geography:** Farm grid gone to seed at the edges, Harrenvale on a hill, Royal Fortress above it, river traffic.
- **Climate:** Temperate, clearer than the forest.
- **Weather:** Rain, fog mornings, festival flags in wind.
- **Ambient:** Carts, market, bells, armour drills.
- **Music:** Brass and choir fragments. Fortress is martial and hollow.
- **Wildlife:** Oxen, sheep, hawks, castle hounds (neutral if not wanted).
- **Enemies:** Bandits, deserter knights, thieves, corrupt guards in the lower ward at night, feral hounds.
- **Elites:** Tax Knight, Banner Captain, Hedge Witch (road).
- **Resources:** Wheat, flax, leather, limestone, coal outcrops.
- **Ores:** Iron in quarries and the fortress undercroft. Copper still present.
- **Structures:** Harrenvale, mills, abbey, market, gallows, watchtowers, Royal Fortress.
- **Villages:** Harrenvale (town), two hamlets (Millcross, South Bend).
- **Dungeons:** Fortress dungeons, smuggler crypt, abbey catacomb (optional).
- **NPCs:** Queen-Regent Ilda (absent, spoken of), Castellan Voss, Sister Maree, blacksmith Holt, Boe’s former keeper Elspeth who will not admit the dog is hers until late.
- **Hazards:** Guard arrest if you draw steel in the market before trust. Not a fail state — a fine or a cell with a quest exit.
- **Secrets:** Royal ledger naming Finster as a disgraced captain. Boe’s red collar tag in Elspeth’s drawer.
- **Quests:** Tax revolt, missing patrol, fortress key.
- **Boss:** The Black Knight.
- **Arena:** Fortress throne bridge, rain, narrow footing.
- **Rewards:** Knightfall Greatsword, Royal Pickaxe, Knight’s Oath (key item).
- **Unlock:** North road to Frostlands watch-fort, and the Mire causeway seal. Royal Pickaxe mines frost-adjacent iron variants and the first mire-crust nodes, but not Mire Crystal proper.
- **Unique mechanic:** Law. Witnessed crimes change guard behaviour until pardoned or paid.
- **VFX:** Banner cloth, wet stone. Mobile: cloth on key NPCs only.
- **Performance:** Many NPCs. Use schedule LOD: full sim within 60 m, waypoint puppets beyond.

## 6.3 The Dark Mire

- **Identity:** Green-black water, chapel bells underwater, sweetness of rot.
- **Geography:** Sunk cathedral district, boardwalks, witch pools, a river that flows the wrong way at dusk.
- **Climate:** Humid, cold-damp.
- **Weather:** Fog, spore rain, will-o’-wisps.
- **Ambient:** Insects, bubbles, distant choir reversed.
- **Music:** Low strings, wet percussion.
- **Wildlife:** Herons, leeches, bog fish. Herons are ambient until blood moon.
- **Enemies:** Witches, bog crocs, giant midges, drowned farmers, poison toads, mire lurkers.
- **Elites:** Bell Witch, Cathedral Verger.
- **Resources:** Peat, bog iron, herbs (rotcap, widowsveil), reeds.
- **Ores:** Mire Crystal in cathedral geodes. Requires Rotbreaker or better. Grave-adjacent nodes visible, unmineable.
- **Structures:** Stilt hamlet Drear, witch huts, Sunken Witch Cathedral.
- **Villages:** Drear, population small, suspicious.
- **Dungeons:** Cathedral (long), Leech Cistern (medium).
- **NPCs:** Mother Phem, the still-living sacristan; Corrin the boatman.
- **Hazards:** Poison water, slow sink mud, curse fog that hides UI markers — not the whole HUD, only world markers, so combat stays readable.
- **Secrets:** A clean bell that silences a witch patrol if rung.
- **Quests:** Recover choir names, escort Corrin, cathedral descent.
- **Boss:** Mire Mother.
- **Arena:** Nave flooded to the knees, hanging censers.
- **Rewards:** Mire Staff, Rotbreaker Pickaxe, Mother’s Veil.
- **Unlock:** Dead River gate into the Undead Wasteland. Veil grants rot resistance used later in volcano ash as a cross-system, not only mire.
- **Unique mechanic:** Knee-deep combat. Movement slowed, dodge shortened, jump attacks more valuable.
- **VFX:** Spore motes. Mobile: 2D cards beyond 25 m.
- **Performance:** Water shader LOD. Reflections off on Low/Medium.

## 6.4 The Undead Wasteland

- **Identity:** Ash snow that is not snow. Silence with bone wind.
- **Geography:** Dead river, rib-like bridges, Dead Citadel on a mesa, villages of the unburied.
- **Climate:** Dry cold.
- **Weather:** Ash fall, still air, rare soul lightning.
- **Ambient:** Cloth, distant marching, no birds.
- **Music:** Choir of few voices, drum.
- **Wildlife:** Carrion birds, bone hares (neutral, eerie). No healthy predators.
- **Enemies:** Skeletons, zombies, ghosts, necromancers, undead knights, soul leeches.
- **Elites:** Standard Bearer, Grave Confessor.
- **Resources:** Bone, grave dust, tallow, ruined banners.
- **Ores:** Grave Iron. Requires Soulbreaker. Sunstone specks in noble tombs, unmineable until Pharaoh tools — visible on purpose.
- **Structures:** Dead villages, catacombs, necromancer towers, Dead Citadel.
- **Villages:** None living. One camp of last rites priests, mobile, not a settlement you own at first.
- **Dungeons:** Citadel (long), three tomb wings (medium).
- **NPCs:** Brother Caldus, a living priest; the Bound Choir (quest ghosts).
- **Hazards:** Soul drain fields, crumbling floors.
- **Secrets:** Finster’s discarded captain’s seal in a mass grave.
- **Quests:** Name the dead, silence the towers, citadel ascent.
- **Boss:** Grave King.
- **Arena:** Throne of femurs, circling spectral court.
- **Rewards:** Grave King’s Blade, Soulbreaker Pickaxe, Crown Shard.
- **Unlock:** Salt road to the Golden Desert, and the frost pilgrimage gate if Kingdom is already open (both seals required for the high Frostlands — **DECIDED:** Frost foothills open after Kingdom; the Wyrm’s mountain opens after Grave King or a hidden frost trial, so players are not hard-railroaded, but the Wyrm arena door needs Soulbreaker to crack the ice lock).
- **Unique mechanic:** Naming. Some undead de-aggro if their grave is marked. Optional, not required.
- **VFX:** Soul wisps. Mobile: no screen-space ghosts on Low; use meshes.
- **Performance:** Many cheap skeleton rigs, shared animation banks.

## 6.5 The Frostlands

- **Identity:** Blue shadow, black pine, a mountain that hums.
- **Geography:** Foothills, frozen lake, monastery, Wyrm peak.
- **Climate:** Hard cold.
- **Weather:** Snow, whiteout, aurora at night.
- **Ambient:** Wind, ice crack, monastery bell.
- **Music:** Solo voice, then low horn near the peak.
- **Wildlife:** Hares, elk, frost owls.
- **Enemies:** Frost wolves, yeti, ice spiders, ice elementals, frozen undead.
- **Elites:** Avalanche Yeti, Prior of the Frozen Bell.
- **Resources:** Winter fur, ice shards, frost herbs.
- **Ores:** Froststeel in high caves. Requires Frostbite Pickaxe to mine the true veins; Royal Pickaxe can chip foothill scraps only.
- **Structures:** Monastery of the Last Fire, ice caves, watch-fort, Wyrm crater.
- **Villages:** One monastery-village, Kinrest.
- **Dungeons:** Ice cloister (medium), Wyrm approach caves (long).
- **NPCs:** Abbess Renn, hunter Kett.
- **Hazards:** Cold meter. Campfires and froststeel armour slow it. Whiteout reduces camera distance slightly, never removes combat UI.
- **Secrets:** A summer flower under the ice, quest item for Tanic.
- **Quests:** Relight the bells, escort the elk herd (world event tie-in), climb.
- **Boss:** Frost Wyrm.
- **Arena:** Open crater, wind lanes that push the player, cover from ice spines.
- **Rewards:** Wyrmfang (spear), Frostbite Pickaxe, Wyrm Heart.
- **Unlock:** High pass toward volcano’s western ash road. Heart is a crafting catalyst, not a gate key. Gate key is the pick’s ability to break the frost-iron portcullis.
- **Unique mechanic:** Wind lanes. Position matters more than DPS.
- **VFX:** Snow cards, breath. Mobile: breath on player and boss only.
- **Performance:** Whiteout is a fog volume, not a particle storm, on Medium and below.

## 6.6 The Golden Desert

- **Identity:** Gold light, theft, monuments to kings who hired gods and did not pay.
- **Geography:** Dunes, salt edge from the waste, buried city lips, the pyramid.
- **Climate:** Hot day, cold night.
- **Weather:** Heat shimmer, sandstorms, clear star nights.
- **Ambient:** Wind hiss, distant chime, cloth.
- **Music:** Frame drum, low oud-like original motif (original composition, no cultural pastiche of a real liturgy).
- **Wildlife:** Lizards, vultures, desert foxes.
- **Enemies:** Scorpions, sandworms (rare), mummies, desert bandits, sand spirits.
- **Elites:** Tomb Taxman, Sun Priest revenant.
- **Resources:** Glass sand, dates, linen, scorpion chitin.
- **Ores:** Sunstone in pyramid reliquaries and noon-only surface blooms. Requires Sunbreaker.
- **Structures:** Caravan towns, buried streets, pyramid, bandit forts.
- **Villages:** Qess, a living caravan-town.
- **Dungeons:** Pyramid (long), two tomb stacks (medium).
- **NPCs:** Speaker Nadira, well-keeper Osman, a thief who knows a Finster drinking song.
- **Hazards:** Heat meter by day, sandstorm navigation.
- **Secrets:** A map that shows the Drowned shelf from above — foreshadow.
- **Quests:** Water rights, tomb names, pyramid contract.
- **Boss:** Sand Pharaoh.
- **Arena:** Shifting platform ring inside the pyramid, light beams as safe lanes.
- **Rewards:** Pharaoh’s Blade, Sunbreaker Pickaxe, Solar Cartouche.
- **Unlock:** Ash road into the volcano’s basalt gate. Cartouche is used in a door, not consumed.
- **Unique mechanic:** Light lanes. Standing in sun heals the Pharaoh and hurts shadow-school players; standing in shadow does the reverse. Readable telegraphs.
- **VFX:** Sand ribbons. Mobile: ribbon impostors.
- **Performance:** Dune meshes are low; detail is in the pyramid interior, which is a streamed subscene.

## 6.7 The Ashen Volcano

- **Identity:** Industry of the earth. Beautiful and unsurvivable without kit.
- **Geography:** Basalt stairs, obsidian bridges, caldera, titan’s forge-pit.
- **Climate:** Extreme heat, ash.
- **Weather:** Ashfall, eruption tremors (scripted, not constant physics).
- **Ambient:** Roar, cracking crust, metal ping from ore.
- **Music:** Anvil rhythm, choir buried under bass.
- **Wildlife:** Almost none. Ash moths around vents.
- **Enemies:** Fire demons, lava lizards, fire elementals, volcanic beasts, ash cultists.
- **Elites:** Forge Impaler, Caldera Warden.
- **Resources:** Obsidian, sulphur, ashcloth.
- **Ores:** Infernal Ore. Requires Magma Drill (boss tool) or a crafted infernal pick after the first clear.
- **Structures:** Cult forges, obsidian forts, titan stair.
- **Villages:** None permanent. A camp of fire-proofed miners appears after the Titan falls.
- **Dungeons:** Forge stacks (medium), Titan approach (long).
- **NPCs:** Smith-exile Varga, who will move to a player settlement if hired.
- **Hazards:** Lava instant-down on deep contact, heat meter, falling ash that limits sight.
- **Secrets:** A cooled tunnel to the drowned shelf’s back door. Late shortcut.
- **Quests:** Cool the bridge, free Varga’s crew, descend.
- **Boss:** Infernal Titan.
- **Arena:** Caldera platform with sinking tiles.
- **Rewards:** Infernal Greatsword, Magma Drill, Titan Nail.
- **Unlock:** Coastal stairs to the Drowned surface ruins. Drill also breaks abyssal crust previews but not Abyssal Crystal.
- **Unique mechanic:** Sinking tiles. Stand still and you lose the floor.
- **VFX:** Heat distortion on High/Ultra only. Low uses a simple grade.
- **Performance:** Lava is scrolling shader, not fluid sim.

## 6.8 The Drowned Kingdom

- **Identity:** A court that refused to surface. Beauty under pressure.
- **Geography:** Surface ship-grave, shelf ruins, Sunken Palace below.
- **Climate:** Sea cold, dark below.
- **Weather:** Storms above, still dark below.
- **Ambient:** Hull creak, whale-distant, bells.
- **Music:** Piano-like glass tones, then pressure drums.
- **Wildlife:** Fish schools, gulls above.
- **Enemies:** Drowned warriors, sharks in open water, sea serpents (rare), abyssal eels, giant jellyfish.
- **Elites:** Admiral of the Shelf, Choir Jelly.
- **Resources:** Coral, pearls, driftwood, sailor cloth.
- **Ores:** Abyssal Crystal in palace trenches. Requires Abyssal Drill.
- **Structures:** Wreck villages, lighthouse, Sunken Palace.
- **Villages:** Brinehold, a surface salvage town.
- **Dungeons:** Palace (long), two wreck interiors (short).
- **NPCs:** Captain Yssa, a diver priest.
- **Hazards:** Breath meter. Surface pockets and crafted lungs extend it. Combat underwater is slower; lock-on stays.
- **Secrets:** The Queen’s dry diary, which names the Tear and a blonde captain.
- **Quests:** Raise a bell, map wrecks, enter the palace.
- **Boss:** Drowned Queen.
- **Arena:** Throne room with rising water phases. Phase 3 is fully submerged with air globes.
- **Rewards:** Tidebreaker (sword), Abyssal Drill, Queen’s Lung.
- **Unlock:** Sky-lift ruins. The Lung is equipment. The drill breaks the sky-anchor chains that hold the first island down — visual, physical.
- **Unique mechanic:** Breath as a second stamina. Mismanage it and you surface-panic, not instant die, unless you are deep.
- **VFX:** Caustics on High+. Low uses tinted fog.
- **Performance:** Underwater is a lighting state, not a second engine. Palace is instanced from the open shelf.

## 6.9 The Skylands

- **Identity:** Broken cathedrals in clear air. Vertigo as a region.
- **Geography:** Chain of islands, bridges of hard light, Floating Castle at the end.
- **Climate:** Thin, cold, bright.
- **Weather:** Crosswinds, brief lightning, clear most of the time.
- **Ambient:** Flags, distant thunder, choir in wind.
- **Music:** High voices, no bass until the castle.
- **Wildlife:** Sky eels, cliff goats.
- **Enemies:** Gale beasts, storm elementals, celestial guardians (lesser), fallen choir knights.
- **Elites:** Bridge Seraph, Storm Prior.
- **Resources:** Cloud iron scraps, light petals, skystone chips.
- **Ores:** Celestium in the castle vault and on the highest island, noon and night only. Requires Starforged Pickaxe.
- **Structures:** Hermit platforms, fallen bridges, Floating Castle.
- **Villages:** One monastery-platform, Aerie.
- **Dungeons:** Castle (long), two bridge-keeps (short).
- **NPCs:** Warden-Acolyte Liss, who knows Tanic’s old name and will not say it until the Guardian is dead.
- **Hazards:** Fall. Updrafts save you if you have the island blessing or a crafted glider (Kingdom engineering + wyrm leather — **DECIDED** glider unlocks here as a tool, not earlier).
- **Secrets:** Tanic’s portrait in a sky chapel, younger, armoured.
- **Quests:** Relight bridges, Liss’s vow, castle ascent.
- **Boss:** Celestial Guardian.
- **Arena:** Vertical. Platforms fall and reform. Lock-on is mandatory-friendly; free camera still allowed.
- **Rewards:** Celestial Blade, Starforged Pickaxe, Sky Key.
- **Unlock:** The Tear opens. Void is entered, not walked.
- **Unique mechanic:** Vertical stamina. Jumps and glides share a sky meter.
- **VFX:** Hard-light bridges. Mobile: unlit additive planes.
- **Performance:** Islands stream one at a time plus the nearest neighbour. No full archipelago resident.

## 6.10 The Void / End

- **Identity:** A castle assembled from memories of the others. Anger as architecture.
- **Geography:** Not geography. A throne approach, a courtyard, a finger-marked hall, Finster’s keep.
- **Climate:** None. Pressure.
- **Weather:** None. Flicker of other regions’ skies as phase tells.
- **Ambient:** Breathing that is not yours. Armour.
- **Music:** All previous boss motifs ruined, then a single furious march.
- **Wildlife:** None.
- **Enemies:** Corrupted knights, memory beasts (cookie-shard adds, hound shades — echoes, not repeats of the full bosses), void shards.
- **Elites:** The Twice-Knight.
- **Resources:** None gatherable except drops.
- **Ores:** Voidstone only from Finster and the Tear heart. Not a farm node.
- **Structures:** The Final Castle.
- **Villages:** None.
- **Dungeons:** The castle is the dungeon.
- **NPCs:** None living. Tanic may appear as a projection if his quest is complete. He does not fight Finster for you.
- **Hazards:** The finger rite. Arena denial zones.
- **Secrets:** If Tanic’s quest is done, a third phase branch where Finster hesitates — still a fight, slightly altered tells.
- **Quests:** The audience. No side quests here.
- **Boss:** Finster.
- **Arena:** Courtyard that loses pieces of floor each phase. Last phase is a stone ring.
- **Rewards:** Finster’s Longsword, Voidstone, Tear Closed (world state). No pickaxe — the world is done. Crafting the Void kit uses his sword as a station, once.
- **Unlock:** Endgame. Regions remain. Blood moons intensify. New Game Plus is a later phase, not slice one.
- **Unique mechanic:** “Smell my fingers.” A five-second rite. See boss section.
- **VFX:** Restrained. The spectacle is the man and the sword. Mobile must not hide tells behind particles.
- **Performance:** Small resident set. Highest animation budget in the game lives here.

---

# 7. World progression map

```
Hearthfen (fists)
  → Forest tools (wood/flint/bone/copper)
    → Cookie (Giant Forest castle)
      → Cookie's Blade + Pick + Core
        → Green Gate
          → Kingdom (iron)
            → Black Knight
              → Knightfall + Royal Pick
                → Frost foothills AND Mire causeway
                  → Mire Mother → Rotbreaker → Dead River
                    → Grave King → Soulbreaker → Desert salt road
                      → also ice-lock on Wyrm door
                        → Frost Wyrm → Frostbite → ash road west (alternate)
                  → Sand Pharaoh → Sunbreaker → volcano gate
                    → Infernal Titan → Magma Drill → drowned stairs
                      → Drowned Queen → Abyssal Drill → sky chains
                        → Celestial Guardian → Starforged + Sky Key
                          → Tear
                            → Finster
```

Hidden branches, not required for the critical path:

- Lethal early Mire skim without Rotbreaker (secrets only).
- Frost foothills after Kingdom, Wyrm door still locked.
- Volcano back-tunnel to Drowned after Titan, shortens surface storm run.
- Tanic revelations at Kingdom ledger, Wasteland seal, Sky chapel, Tear projection.

World flags (authoritative):

| Flag | Set by | Effect |
| --- | --- | --- |
| `seal_cookie` | Cookie death | Green Gate passable, iron nodes arm, Kingdom spawns enable |
| `seal_knight` | Black Knight death | Mire causeway, frost foothills, law quests advance |
| `seal_mire` | Mire Mother death | Dead River gate, rot resistance craft |
| `seal_grave` | Grave King death | Desert road, Wyrm ice-lock vulnerable |
| `seal_wyrm` | Frost Wyrm death | West ash road, cold immunity crafts |
| `seal_pharaoh` | Pharaoh death | Volcano gate |
| `seal_titan` | Titan death | Drowned stairs, miner camp |
| `seal_queen` | Queen death | Sky chains breakable |
| `seal_guardian` | Guardian death | Tear entrance |
| `seal_finster` | Finster death | End state, void crafting, epilogue |

---

# 8. Character system

## 8.1 Creator

Sliders and presets, not a photo mode.

| Category | Options (v1 slice / full) |
| --- | --- |
| Body | Height, bulk, shoulder, hip. 3 presets + fine sliders. No extreme that breaks armour fit. |
| Skin | 12 tones, plus undertone. Scar slots. |
| Face | Brow, eyes, nose, jaw, mouth. Preset faces as starting points. |
| Eyes | Colour, shape. Heterochromia toggle. |
| Hair | 10 styles slice, 25 full. Colour, highlight. |
| Facial hair | None / stubble / beard styles. |
| Marks | Scars, tattoos (geometric original set), dirt. |
| Voice | 3 body-pitches for efforts only. No spoken dialogue in v1. |
| Clothing | Start naked of armour: simple cloth. Cosmetic only until gear replaces it. |

**DECIDED:** Gender presentation is a cosmetic cluster (body preset, voice pitch, hair). It has no stat effect.

## 8.2 Identity

- Character id is account-bound (or device-bound offline).
- Name is unique per account, not globally.
- Appearance can be edited at mirrors in settlements for a small gold cost after the first free confirm. Not in combat.

## 8.3 Starting state

- Fists: 4 damage, fast, no stagger.
- Cloth: 0 defence.
- 80 health, 60 stamina, 0 mana until a Focus action (first spell or staff) awakens the pool.
- No class id. Ever.

### System card — Character

| | |
| --- | --- |
| Purpose | A body the player owns, with no destiny picked up front. |
| Player-facing | Creator, mirror edits, persistent look under armour. |
| Dependencies | UI, save, equipment mesh binding. |
| Data | Appearance blob, name, voice id, account id. |
| Technical | Appearance is compact JSON (< 4 KB). Armour uses bone offsets, not unique bodies per piece. |
| Mobile | Creator must work with one thumb and a preview that does not drop frames on Low. |
| Multiplayer | Replicate appearance id; clients resolve meshes locally. Do not sync slider streams. |
| Testing | Two extremes of height wear the same chest piece without clipping that blocks readability. |

---

# 9. Progression system

## 9.1 Character level

Level 1–50 for the full game. Slice caps at 12.

XP from: combat, mining new node types (first-time bonus), crafting first of a recipe, discovering landmarks, quests, bosses (large).

XP curve is front-loaded. Level is a gate for some crafts, not a replacement for tools. A level 20 with a flint pick still cannot mine Grave Iron.

## 9.2 Attributes (soft, from use and from level picks)

Each level grants 1 attribute point. Use also grants tiny permanent practice, capped, so a pure miner is not identical to a pure swordsman even with the same spend.

| Attribute | Effect |
| --- | --- |
| Vitality | Health |
| Endurance | Stamina, carry |
| Strength | Heavy weapon scaling, mining speed slightly |
| Dexterity | Light weapon, bow, crit |
| Focus | Mana, spell power |
| Will | Status resist, forbidden corruption cap |
| Fortune | Rare find, not damage |

## 9.3 Power is three layers

1. Tool tier (can you interact with this node / gate).
2. Weapon and armour tier (can you survive the next camp).
3. Skill rank (how well you use it).

A cookie pick and no sword skill still opens the gate. It does not make you safe.

## 9.4 World level vs character level

World tier is seal-based. Enemies do not scale to the player inside a fresh region. They have a region band. Optional world setting: Veteran, +1 band. This avoids empty over-levelled forests and impossible co-op gaps.

Co-op gap rule: a level 40 in the Forest does not one-shot story wolves into non-existence for a level 2 friend — **DECIDED:** region damage floor and ceiling. Overlevel damage against region-trivial mobs is soft-capped. Bosses are not soft-capped.

---

# 10. Skill trees

No classes. Eleven combat-and-craft disciplines. Each has ranks 0–10 (slice: 0–4). Rank rises by use and by spending skill points from levels and books.

## 10.1 Combat

| Skill | Identity | Rank 3 fantasy | Rank 8 fantasy |
| --- | --- | --- | --- |
| Sword | Balanced, parry-friendly | Riposte window longer | Blade oath: next hit after parry is elemental of the weapon |
| Greatsword | Commitment, stagger | Hyper-armour on heavy | Shockwave on charged heavy |
| Axe | Wood and flesh, armour chip | Fell trees in one less tick | Bleed on chop |
| Hammer | Posture break, mining kinship | Guard damage up | Slam creates short stone slow |
| Spear | Range, thrust | Vault poke | Line pierce |
| Dagger | Backstab, fast | Crit from flank | Smoke step (short) |
| Archery | Pull, weak points | Moving shot | Pin (slow) |
| Defence | Block, posture | Shield bash | Aura that shares block with ally in co-op |
| Magic | School access | Second school slot | Third school, higher corruption tolerance |

You can rank all of them. Soft cap: total combat rank sum has a soft tax past 24 so “everything at 10” is a long endgame, not the default.

## 10.2 Gathering

Mining, woodcutting, fishing, farming. Each rank speeds the action, reveals node quality, and unlocks recipes. Mining rank does **not** bypass pickaxe tier. It makes the legal node faster and safer.

## 10.3 Crafting

Blacksmithing, alchemy, cooking, enchanting. Rank gates quality bands and set crafts. Boss uniques are craft-finishers: you receive them whole, then enchanting can socket, not reroll the unique effect.

## 10.4 Construction

Building (placement, beauty, housing score), Engineering (bridges, lifts, traps, glider, drills maintenance).

### System card — Skills

| | |
| --- | --- |
| Purpose | Identity from behaviour. |
| Player-facing | Ranks, a few active techniques, no class select. |
| Dependencies | XP, combat events, crafting events. |
| Data | Rank int per skill, unlocked technique ids. |
| Technical | Server validates rank-ups. Client predicts the float. |
| Mobile | Skill screen is a list, not a giant canvas web. |
| Multiplayer | Personal. A friend’s smith rank does not craft on your bench unless they are present and you permit. |
| Testing | Fists-only player can still reach rank 1 sword by using a crafted sword, and cannot gain sword rank from fists. |

---

# 11. Combat system

## 11.1 Actions

| Action | Input (mobile) | Stamina | Notes |
| --- | --- | --- | --- |
| Light | Right face button | Low | Chains up to 3 |
| Heavy | Hold light | Med | Hyper-armour only if skill allows |
| Dodge | Right flick or dedicated button | Med | i-frames 0.25 s at 30 fps (about 7 frames). Tuned in feel tests. |
| Jump | Left of combat cluster | Low | Light jump attack if attacking in air |
| Block | Hold shield button | Drain on hit | Requires shield or greatsword rank 4 (clumsy) |
| Parry | Tap block in window | Low | On success, stagger attacker |
| Ability | Skill button | Med / mana | One slotted combat art |
| Item | Quick slot | 0 | Potion, food |
| Lock-on | Tap right stick / button | 0 | Soft lock nearest, tap to cycle |
| Interact | Context button | 0 | Gather, talk, revive |

## 11.2 Posture and stagger

Every actor has posture. Heavy hits, hammers, and parries damage posture. At 0, stagger for 1.2 s. Bosses have super-armour windows where posture damage is stored and applied after the attack.

## 11.3 Damage model

`final = (base + scaling) * weaponSkillMod * elementalMod * postureMod * difficultyMod - defence`

Defence is diminishing, not flat immunity. Elemental resistance is separate.

Crit: dex and dagger raise chance. Crit is a posture hit plus damage, not a random screen flash only.

## 11.4 Status

Bleed, poison, burn, frost, shock, rot, curse, silence. Each has a build-up bar, a duration, and a cleanse (potion, spell, campfire for some).

## 11.5 Hit reactions

Light flinch, heavy stagger, launch (rare, hammers and bosses), knockback (Boe, explosions). Player launch is short so mobile camera does not vomit.

## 11.6 Lock-on

Default on when an enemy is in the forward cone and the player attacks. Can be disabled in settings. Camera collision pulls in; it never goes inside the body.

## 11.7 Animation requirements

- Readable wind-up > 0.35 s on any attack that can kill a fresh player.
- Distinct silhouettes per weapon family.
- Hitstop 40–80 ms on heavy connects. Off on Low as an option, on by default — it is feel, not VFX.
- Boss tells use body, not only particles.

### System card — Combat

| | |
| --- | --- |
| Purpose | Deeper than mining-with-a-sword. Readable on a 6-inch screen. |
| Player-facing | Light, heavy, dodge, block, parry, art, item, lock-on. |
| Dependencies | Animation, stamina, equipment, status, AI. |
| Data | Move set id, stamina costs, hitboxes, status tables. |
| Technical | Server authoritative hit detection for multiplayer. Client prediction for own movement. Rewind buffer ~200 ms for melee fairness. |
| Mobile | Thumb cluster. No piano. Context button replaces five prompts. |
| Multiplayer | Friendly fire off by default. Boss aggro table shared. Revive downed state, not instant corpse run. |
| Testing | Hitboxes on device, not only editor. Parry window feel test with 3 players. |

---

# 12. Magic system

## 12.1 Resource

Mana pool from Focus. Regen slow in combat, fast at shrines. Staves reduce cost. Forbidden magic also spends Corruption, a personal bar 0–100.

## 12.2 Schools

| School | Fantasy | Strength | Weakness | Status | Environmental |
| --- | --- | --- | --- | --- | --- |
| Fire | Direct, forge | Flesh, ice, undead tallow | Wet, mire water | Burn | Lights camps, melts thin ice |
| Ice | Control | Water, desert noon beasts | Fire bosses | Frost slow | Freezes small water, builds platforms that melt |
| Lightning | Burst | Armoured metal, wet | Earth-grounded | Shock | Strikes rods, opens some gates |
| Earth | Armour, stone | Flying if grounded, cookie constructs | Air, sky | Slow | Raises cover, mining synergy |
| Shadow | Single-target, evade | Living, light-lane pharaoh adds | Holy | Curse | Dims local lights |
| Holy | Undead, cleanse | Ghosts, rot | Forbidden, some beasts | — | Calms minor undead, harms Grave King |
| Forbidden | High power, personal cost | Almost all | Self | Corruption | Warps local props, angers settlements if witnessed |

## 12.3 Spell progression

Each school: cantrip (free-ish), two arts, one rite (long cast). Unlocked by rank, trainer, or boss core.

Examples (original):

- Fire: Ember, Hearthlash, Kiln Wall, Cinder Rite.
- Ice: Rime, Glass Spear, Hoarfrost Ring, Still Rite.
- Lightning: Spark, Rod Bolt, Arc Step, Storm Rite.
- Earth: Pebble, Bulwark, Grave of Stone, Root Rite.
- Shadow: Dim, Needle, Step-Aside, Name-Eater (single target mute).
- Holy: Gleam, Turn, Sanctuary, Bell Rite.
- Forbidden: Whisper, Debt Bolt, Second Skin, Open the Tear (endgame, unusable before Guardian seal).

## 12.4 Forbidden risk

Corruption above 50: visual veins, NPC fear, shop prices up in lawful towns. Above 80: a personal haunt can spawn. At 100: a forced backfire on next rite (self-damage, short charm). Cleansed at abbeys for gold and a quest, or by holy rites at half efficiency. It is not a moral cutscene. It is a build tax.

## 12.5 Boss interactions

Cookie is weak to fire (wax, cloth) and resistant to shadow (he is already a kind of puppet-curse). Boe is weak to earth-stun and resistant to fear. Black Knight resists physical during shield phase, weak to lightning. Mire Mother weak to fire and holy. Grave King weak to holy and fire, resists shadow. Wyrm weak to fire and lightning, resists ice. Pharaoh weak to shadow while in sun-phase. Titan weak to ice and water flasks. Queen weak to lightning. Guardian weak to forbidden and earth. Finster resists magic during sword phases and is briefly weak after the finger rite is dodged.

### System card — Magic

| | |
| --- | --- |
| Purpose | A major craft with identity, not a damage type swap. |
| Player-facing | Schools, staves, corruption, environmental tricks. |
| Dependencies | Mana, animation casts, status, world props. |
| Data | Spell id, school, cost, cast time, hit profile. |
| Technical | Casts are server-confirmed. VFX client-side. |
| Mobile | One spell slot early, three later. No 12-button bar. |
| Multiplayer | Friendly fire off. Sanctuary heals allies. Forbidden haunt is personal. |
| Testing | Each school has one puzzle and one combat use before it ships. |

---

# 13. Equipment system

## 13.1 Weapon families

| Family | Speed | Stamina | Stagger | Range | Role |
| --- | --- | --- | --- | --- | --- |
| Sword | Med | Med | Med | Med | Default, parry |
| Greatsword | Slow | High | High | Med | Commitment |
| Axe | Med | Med | Med | Short | Chip armour, wood |
| Hammer | Slow | High | Very high | Short | Posture |
| Spear | Med | Low | Low | Long | Safe poke |
| Dagger | Fast | Low | Low | Short | Crit, backstab |
| Bow | Draw | Med | Low | Long | Pull, weak point |
| Crossbow | Reload | Low | Med | Long | Burst, slow reload |
| Shield | — | Block | Bash | Short | Defence skill |
| Staff | Cast | Mana | Low | Cast | School focus, weak melee |

## 13.2 Weapon fields

Base damage, attack speed, stamina use, crit chance, crit mult, elemental damage, stagger, knockback, durability, rarity, modifiers, enchantment sockets (0–3), unique ability.

Durability **DECIDED:** on in Survival and Hardcore, off in Adventure (equipment chips visually but does not break). Repair at benches. Boss uniques degrade slower and never break; they dull (–10% until repaired).

## 13.3 Armour

Slots: head, chest, hands, legs, cloak, trinket.

Fields: defence, elemental resists, move mod, stamina mod, magic mod, set bonus (2/4), special.

Example set directions (not stat clones):

- Hunter’s Hide: move up, defence down, bow bonus.
- Knight Plate: defence up, dodge cost up.
- Mire Weave: rot resist, mana up, physical down.
- Grave Cerement: soul resist, holy power, feared by living NPCs.
- Sun Mail: heat resist, fire power, noisy (stealth down).
- Infernal Scale: fire immune to minor, frost weakness.
- Tide Cloak: breath, lightning resist.
- Celestial Veil: fall reduce, magic up, physical down.
- Finster Plate (unique): no set, high all-round, cannot socket forbidden.

## 13.4 Rarity

Common, Uncommon, Rare, Epic, Legendary, Mythic, Unique.

Unique is named and un-rerollable. Boss signature items are Unique.

### System card — Equipment

| | |
| --- | --- |
| Purpose | Make tiers feel different, not just larger numbers. |
| Player-facing | Wear, compare, repair, socket. |
| Dependencies | Inventory, skills, crafting, animation sets. |
| Data | Item def, instance mods, durability, owner. |
| Technical | Item instances have ids. Mods are rolled server-side. |
| Mobile | Compare is a single overlay, not a spreadsheet. |
| Multiplayer | Trade by consent drop or trade window. No theft from player inventory. |
| Testing | Each family has a distinct hitbox and a reason to exist in one region. |

---

# 14. Material progression

Tier rule: a material changes a verb, not only a number.

| Tier | Material | Found | Pick required | Verb it adds | Used for | Look | Rarity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Wood | Forest trees | Fists / axe | Craft handles, arrows, first camp | Tools, building, fuel | Brown grain | Common |
| 0 | Stone | Outcrops | Fists | Crude edges, furnaces | Walls, knives | Grey | Common |
| 0 | Flint | River, forest | Fists | Sparks, first blades | Knives, arrows | Dark glass | Common |
| 0 | Bone | Hunts | Fists | Barbs, needles | Daggers, charms | Ivory | Common |
| 1 | Copper | Forest creeks, kingdom scraps | Stone pick | First metal cast, conductive | Weapons, pots, rods | Orange metal | Common |
| 2 | Iron | Kingdom quarries | Copper pick | True edges, armour plates | Arms, tools, structures | Dark grey | Common |
| 3 | Cookie materials | Cookie, castle toys | Cookie’s Pick (drops whole) | Toy-horror edge, music-box procs | Cookie’s Blade line, charms | Painted wood, brass, glass eye | Unique source |
| 4 | Froststeel | Frost caves | Frostbite Pick for veins; Royal Pick for scraps | Cold on hit, anti-heat crafts | Frost kit | Blue-white metal | Uncommon |
| 5 | Mire Crystal | Cathedral geodes | Rotbreaker | Rot resist, spell focus | Staves, veils | Green-black glass | Rare |
| 6 | Grave Iron | Wasteland crypts | Soulbreaker | Soul edge, undead command charms | Grave kit | Black, pale filigree | Rare |
| 7 | Sunstone | Desert noon blooms, pyramid | Sunbreaker | Light lanes, heat crafts | Sun kit | Gold inner fire | Rare |
| 8 | Infernal Ore | Volcano veins | Magma Drill | Heat immunity crafts, heavy blades | Infernal kit | Cracked orange | Epic |
| 9 | Abyssal Crystal | Palace trenches | Abyssal Drill | Breath, pressure, tide edge | Tide kit | Deep blue-violet | Epic |
| 10 | Celestium | Sky vaults | Starforged | Fall reduce, hard light | Sky kit | Pale gold-white | Legendary |
| 11 | Voidstone | Finster / Tear only | None (drop) | End crafts, anti-magic window | Finster finishers | Absorbs light | Mythic |

Boss materials outside the ladder: Cookie’s Core, Knight’s Oath, Mother’s Veil, Crown Shard, Wyrm Heart, Solar Cartouche, Titan Nail, Queen’s Lung, Sky Key. These are keys and catalysts. They are not smelted into generic bars.

Special properties must show in combat or traversal:

- Copper: lightning spells cheaper if you wear a copper trinket.
- Iron: no magic bonus. The point is reliability.
- Cookie: small chance to confuse humanoids (music-box).
- Froststeel: slows heat meter.
- Mire Crystal: spells apply a short resist shred.
- Grave Iron: extra vs undead, living NPC distrust if worn in towns.
- Sunstone: stronger in daylight.
- Infernal: burn aura that also hurts you without ashcloth.
- Abyssal: bonus underwater, penalty in desert noon.
- Celestium: bonus while airborne or on sky islands.
- Voidstone: brief magic immunity on parry, corrupts if used in forbidden casts.

---

# 15. Crafting system

## 15.1 Stations

Hand (flint knife), campfire (food), communal bench (tier 0–1), forge (metal), alchemy table, cook pot, enchanter, engineer bench, sky forge (late).

## 15.2 Recipe knowledge

Recipes unlock by: doing the thing once near a station, reading a note, NPC teach, boss core. No giant hidden recipe list at start.

## 15.3 Example critical recipes

- Stone knife: 2 flint, 1 wood. Hand.
- Stone pick: 3 flint, 2 wood, 1 fibre.
- Copper pick: 4 copper, 2 wood, stone pick (upgrade path, consumes).
- Iron sword: 6 iron, 2 wood, 1 leather. Forge. Smith rank 2.
- Cookie’s Blade: not crafted first time. Drop. Repair: cookie brass + iron.
- Rot tonic: widowsveil, water, bone. Alchemy.

## 15.4 Quality

Station tier + skill rank = quality band (rough, sound, fine, master). Quality is a modifier, not a new item id. Uniques ignore quality.

## 15.5 Inventory philosophy

Stacks. Materials stack high. Equipment does not. Junk converts to grit at benches (sell-equivalent) to avoid bloat. Quest items are soulbound and hidden from sell.

### System card — Crafting

| | |
| --- | --- |
| Purpose | Turn the horizon into a shopping list the player chose. |
| Player-facing | Stations, recipes, upgrades, repair. |
| Dependencies | Inventory, skills, stations, recipes. |
| Data | Recipe def, station tag, skill gate, inputs, output. |
| Technical | Craft is a server transaction. No client-only item birth. |
| Mobile | One-tap craft from a pinned recipe. Batch x5. |
| Multiplayer | Shared chest crafting if permission allows. Job owner is the crafter present. |
| Testing | Upgrade path stone → copper → iron cannot skip. Cookie pick is not craftable before kill. |

---

# 16. Building system

## 16.1 Fantasy

Camps, houses, workshops, walls, towers, bridges, storage, decoration, eventually a small castle. Not a voxel world. Piece-based, snap-based.

## 16.2 Pieces

Foundations, floors, walls, roofs, doors, stairs, fences, gates, workstations, beds, lights, banners, bridges, traps (engineering).

Snap grid 1 m. Rotation 90°, with a fine 15° mode for decoration that does not affect structural links.

## 16.3 Structural logic (lightweight)

A piece needs a support path to ground or a legal anchor. Bridges need two anchors. No full physics destruction sim. If support is removed, pieces enter “unstable” and fall as a batch after a warning. This is deterministic and server-checked.

## 16.4 Terrain

Pieces conform to a limited set of foundation stilts. You cannot reshape the continent. You can clear saplings and place on legal plots: wilderness plots (small), settlement plots (large), and rented town plots.

## 16.5 Permissions

Owner, friend-build, friend-interact, visitor. In co-op, host defaults to friend-build for the party, changeable.

## 16.6 Performance

Build pieces are instanced. Cap per settlement plotted in §17. Decorative lights limited. No arbitrary mesh import in v1.

### System card — Building

| | |
| --- | --- |
| Purpose | Player-authored places that matter to NPCs. |
| Player-facing | Snap pieces, stations, walls, a home. |
| Dependencies | Inventory, plots, permissions, structural graph. |
| Data | Piece graph, owner, plot id. |
| Technical | Graph stored compactly. Load with the chunk, not the whole world. |
| Mobile | Ghost preview, snap magnet, undo last 10. |
| Multiplayer | Lock a piece while someone places. No overlapping writes. |
| Testing | Bridge without anchors cannot confirm. Cap enforced. |

---

# 17. Settlement system

## 17.1 Tiers

| Tier | Name | Requires | Unlocks |
| --- | --- | --- | --- |
| 0 | Camp | Bedroll, fire | Sleep, cook |
| 1 | Village | 4 beds, well, bench, palisade, food stock | Farmers, basic trader |
| 2 | Town | Smith, shrine, warehouse, 8 population, happiness > 50 | Guards, alchemy, tax chest |
| 3 | City | Walls, hall, barracks, market, 16 population | Specialist NPCs, raid tier 2 |

## 17.2 Needs

Food, water, beds, safety, work. Happiness falls if raids succeed or food hits zero. NPCs leave at low happiness; they do not die off-screen without an event.

## 17.3 Defence

Player-built walls plus hired guards. Raids are events (§26), not constant. Rebuilding is part of the loop.

## 17.4 Ownership

A world has a settlement charter per plot. Host is default lord. Can grant. In offline, the character is lord.

## 17.5 Multiplayer

Build permissions as §16. NPC assignment is world state. Who paid for a building is logged but the building belongs to the settlement.

---

# 18. NPC architecture

## 18.1 Simulation

Three bands:

1. **Near (0–60 m):** full schedule, dialogue, reactions.
2. **Far (60–200 m):** waypoint puppet, no dialogue load.
3. **Abstract:** settlement ledger only (food, jobs). Not individual agents.

## 18.2 Schedules

Work, eat, sleep, worship, travel between two points, flee, trade. Interrupted by combat, weather, events.

## 18.3 Types

Farmers, smiths, merchants, hunters, fishers, miners, builders, guards, mages, priests, alchemists, innkeepers, travellers, nobles, knights, bandits. Bandits are factions, not settlement NPCs, unless reformed by quest.

## 18.4 Tanic

Appearance: long slender build, long brown hair, pale skin, workshop clothes that are slightly too fine.

Role: lives in Hearthfen. Guides crafting, exploration, bosses, oddities. Never a quest-arrow machine.

Secret: Tanic was a March-Warden adjutant before the Tear. He knew Finster as a captain. He hid in the forest because he failed to hold a minor seal. He is not the villain. He is ashamed. Reveals:

1. Forest: practical help only. One line too precise about the castle.
2. Kingdom ledger: he goes quiet if shown Finster’s name.
3. Wasteland seal: admits he served the March.
4. Sky chapel portrait: his younger face. Liss knows.
5. Tear: projection. Warns about the finger rite in plain language. Does not spoil the line, but tells you to move when the air sweetens.

He can die in Hardcore worlds if the village falls and the player never built a refuge. That is a world consequence, not a cutscene kill in Adventure.

## 18.5 Named cast (additional)

Mara (Hearthfen smith), Sera (hunter), Old Penn, Bramble, Elspeth (Boe’s keeper), Castellan Voss, Sister Maree, Holt, Mother Phem, Corrin, Brother Caldus, Abbess Renn, Speaker Nadira, Osman, Varga, Captain Yssa, Liss. Each has a want, a fear, and a relationship to one other named NPC.

### System card — NPC

| | |
| --- | --- |
| Purpose | A place that lives when you are not the centre. |
| Player-facing | Schedules, talk, trade, flee, rumour. |
| Dependencies | Time, settlement ledger, event system, nav. |
| Data | NPC def, schedule, relationship flags, shop table. |
| Technical | Authoritative position for quest-critical NPCs. Puppets for the rest. |
| Mobile | Cap full-sim NPCs at 12 nearby. |
| Multiplayer | Dialogue state per player for personal quests; world state for seals. |
| Testing | Tanic is findable at dawn and dusk on his route. He does not fall through the smithy. |

---

# 19. Quest system

## 19.1 Types

Main (seal road), NPC (personal), dynamic (event-born), boss (preparation), exploration (landmark), hidden (no log until found), settlement (charter).

## 19.2 Rules

- No “kill 10 wolves” unless the wolves are a specific pack with a reason.
- Journal is short. Rumours can be wrong.
- Main path can be followed with zero side quests, slower and poorer.

## 19.3 Slice main quests

1. A name in the village (optional talk with Tanic).
2. The rhyme about the castle (children, or a grave).
3. Tools enough to enter the castle.
4. Cookie.
5. The gate that answers.

## 19.4 Full main beats

One per seal, plus Tanic’s five reveals, plus the audience with Finster. Side quests are region-specific and finishable. No infinite radiant board in v1. A small job board exists in towns after trust, capped at 3, and jobs are location-based (a real camp), not abstract counters.

---

# 20. Mob / enemy architecture

## 20.1 Tiers

Ambient wildlife, hostile, elite, rare, mini-boss, boss. Rare has a world cooldown so it stays special.

## 20.2 Ecology

Wolves hunt boar and flee bears. Bears avoid spider groves. Goblins scavenge wolf kills. Bandits camp near roads, not deep webs. Undead do not “eat”; they cluster at bells and graves. Desert foxes steal scraps and are not hostile. Sandworms surface if the player sprints on dune crests. Fire moths gather before eruptions. Sharks stay in open water, not in the palace (eels instead).

## 20.3 Expanded roster (original, not palette swaps)

Forest: bramble wolf, tusk boar, orchard spider, stitch goblin, road knife, lantern spirit, moss bear, root shambler.

Kingdom: deserter, banner thief, tax hound, wall archer, cellar ghoul (pre-undead foreshadow), tournament shade.

Mire: bell witch, silt croc, choir midge, peat hulk, widow toad, verger.

Undead: rake skeleton, drowned-walker (distinct from wasteland zombie), veil ghost, bone notary, oath knight, soul lamprey.

Frost: pale wolf, ridge yeti, glass spider, rime elemental, frozen pilgrim.

Desert: gilt scorpion, dune worm, linen mummy, sun bandit, salt spirit.

Volcano: cinder imp, crust lizard, kiln elemental, slag beast, ash cantor.

Drowned: shelf shark, tide knight, lantern jelly, abyssal eel, hull crawler.

Sky: gale ray, storm wisp, bridge seraph, fallen chorister.

Void: memory knight, button-eyed remnant, hound shade, tear leach.

Each has one behaviour verb that is not “walk and swing”: pounce, net, tax (disarm attempt), sink, name-call, whiteout dash, light-lane, tile-break, breath-steal, updraft, echo-attack.

### System card — Mobs

| | |
| --- | --- |
| Purpose | Regions that hunt differently. |
| Player-facing | Readable families, elites, rares. |
| Dependencies | AI, animation, spawn tables, ecology. |
| Data | Archetype, stats, loot, spawn rules. |
| Technical | Pool mobs. Interest management: only simulate in loaded chunks. |
| Mobile | Active AI cap per loaded area, ~15 hostile. |
| Multiplayer | Aggro table shared. Leash to region. |
| Testing | Each region’s signature verb is visible in a 10-second fight. |

---

# 21. Boss architecture

## 21.1 Contract

Every major boss has: lore, intro, look, arena, music, 2–3 phases, tells, weakness, strategy, co-op behaviour, guaranteed rewards, a world consequence.

## 21.2 Rules

- First phase can be comic. Second cannot be unfair.
- Tells are body-readable at Low quality.
- Adds are few and have a job (pressure, interrupt), not filler.
- Co-op: HP +40% per extra player, not double mechanics. One extra punish for four players (a split-target tell).
- Loot: signature items guaranteed, one per participating player who is alive or downed-but-not-released. Materials personal-rolled. No ninja loot.
- On wipe: boss resets. Checkpoints at arena door, not mid-phase, in Adventure. Survival same. Hardcore still resets boss, character is dead.

## 21.3 Mini-bosses

Region elites with names and a one-phase kit. Respawn on a long timer. Not seal keys.

---

# 22. Complete boss roster

## 22.1 Evil Toy Penguin Caller Cookie

- **Lore:** A nursery idol from a border fort, wound up to amuse children during the March. The Tear’s first leak hit the fort. The idol kept the children quiet by making everything else a toy. It still thinks it is calling them in.
- **Intro:** Music box. A plump penguin in a caller’s coat, button eyes, brass beak. It bows. Then the toys stand up.
- **Look:** Plush over a brass armature. Cute at distance. Close up, stitching splits over gears.
- **Arena:** Castle nursery courtyard.
- **Music:** Lullaby → broken clock march.
- **Phases:**
  1. Waddle, peck, call toys. Comic.
  2. Coat opens, armature extends, spin attack, button-eye beams.
  3. Climbs the music box, arena toys become hazards, enraged call.
- **Attacks:** Peck, slide, call (adds), spin, eye-beam, wind-up slam (long tell).
- **Weakness:** Fire. Back-stitch (flank heavy) staggers.
- **Strategy:** Burn toys, dodge the bow (it bows before spin), do not stand in the box’s shadow in phase 3.
- **Co-op:** Adds pick different players. Beam splits only at 3+ players.
- **Rewards:** Cookie’s Blade (sword, confuse proc), Cookie’s Pickaxe (mines iron, and toy-brass nodes), Cookie’s Core (gate).
- **Consequence:** Forest toys go still. Green Gate opens. Children stop rhyming, then invent a new rhyme. Kingdom bells can be heard.

## 22.2 Boe

- **Lore:** Elspeth’s cocker spaniel. Black coat, red collar. Followed a hunting party into a forest dungeon and was collared by a lesser leak. He still wants to play. Play has become impact.
- **Intro:** Tail wag, happy bark, approaches for a pat. If the player sheathes, he licks (small heal, false safety). If the player waits too long or strikes, the collar glows.
- **Look:** Real dog, not a monster mesh, until phase 3 when ears harden into leather wings. Keep him recognisable.
- **Arena:** Forest dungeon kennel-cave, roots, a thrown stick that becomes a hazard.
- **Music:** Warm folk, then percussion on the collar bell.
- **Phases:**
  1. Charge, nip, lick (interrupt cast, short slow).
  2. Knockback pounce, collar pulse.
  3. Ear-wings, short flights, dive.
- **Weakness:** Earth stun, loud bells (quest item from Hearthfen makes phase 1 longer and safer).
- **Strategy:** Do not greed the lick. Dodge lateral to charge. In phase 3, attack on landing only.
- **Rewards:** Smacko Sword (fast sword, knockback on charged, silly name, serious numbers for forest-end / kingdom-start).
- **Consequence:** Elspeth’s dialogue changes. The collar can be returned for a trinket that calms hounds. Optional, not a seal.

Boe is a major optional-but-featured boss. He does not gate the Kingdom. He gates a personal quest and a strong early sword. **DECIDED** so the critical path stays Cookie → Knight, while Boe is the emotional early secret.

## 22.3 The Black Knight

- **Lore:** Harrenvale’s champion, oath-bound to hold the fortress until a captain returned. The captain was Finster. He did not return. The knight kept the oath past reason.
- **Intro:** Shield down, formal salute, then the doors bar.
- **Look:** Black plate, no plume, sword and kite shield. Human proportions.
- **Arena:** Throne bridge in rain.
- **Phases:** Shield law (blocks, counters), sword law (no shield, faster), broken oath (both, arena edges fall).
- **Weakness:** Lightning, guard break, parry on the salute.
- **Rewards:** Knightfall Greatsword, Royal Pickaxe.
- **Consequence:** Fortress opens to the player faction. Law system starts recognising you.

## 22.4 Mire Mother

- **Lore:** The cathedral’s last choir-mother, who sank the bells to drown a leak and drowned her choir with them.
- **Intro:** A hymn from under the water. She rises with censers for hands.
- **Arena:** Flooded nave.
- **Phases:** Knee-water, censer swing, full drown (platforms).
- **Weakness:** Fire, holy.
- **Rewards:** Mire Staff, Rotbreaker Pickaxe.
- **Consequence:** Fog road clears. Drear will trade.

## 22.5 Grave King

- **Lore:** The king who ordered the March and died in it. He still takes roll.
- **Intro:** Names. If the player has marked graves, he hesitates one beat.
- **Arena:** Dead Citadel court.
- **Phases:** Court of bones, personal duel, mass call.
- **Weakness:** Holy, fire. Naming graves before the fight reduces add count.
- **Rewards:** Grave King’s Blade, Soulbreaker Pickaxe.
- **Consequence:** Dead River still. Priests will camp.

## 22.6 Frost Wyrm

- **Lore:** The mountain’s old heat, frozen mid-breath, still guarding a pass it no longer understands.
- **Intro:** The crater inhales.
- **Arena:** Open crater, wind lanes.
- **Phases:** Ground, breath lanes, low flight.
- **Weakness:** Fire, lightning. Ice heals it.
- **Rewards:** Wyrmfang, Frostbite Pickaxe.
- **Consequence:** Whiteouts ease. Kinrest opens the high road.

## 22.7 Sand Pharaoh

- **Lore:** A contract-king who bought a sun and could not bury it.
- **Intro:** The tomb lights a lane. A wrapped king on a stone barge.
- **Arena:** Pyramid ring, sun and shadow.
- **Phases:** Sun king, shadow king, both (split).
- **Weakness:** Opposite lane.
- **Rewards:** Pharaoh’s Blade, Sunbreaker Pickaxe.
- **Consequence:** Noon blooms become mineable. Qess shares water.

## 22.8 Infernal Titan

- **Lore:** The forge that woke when the seals diverted heat into the east.
- **Intro:** The caldera stands up.
- **Arena:** Sinking tiles.
- **Phases:** Limb, core, eruption.
- **Weakness:** Ice, water.
- **Rewards:** Infernal Greatsword, Magma Drill.
- **Consequence:** Ash road stable. Varga’s crew freed.

## 22.9 Drowned Queen

- **Lore:** She closed the sea doors on a leak and crowned herself in the dark so the surface would forget.
- **Intro:** A dry voice in a wet room. The doors shut.
- **Arena:** Throne, rising water.
- **Phases:** Dry duel, waist water, full submersion with air globes.
- **Weakness:** Lightning.
- **Rewards:** Tidebreaker, Abyssal Drill.
- **Consequence:** Shelf storms calm. Sky chains visible.

## 22.10 Celestial Guardian

- **Lore:** Not a person. The March’s lock given a body. It does not hate you. It is the door.
- **Intro:** Islands align. A figure of hard light with a real sword.
- **Arena:** Falling platforms, vertical.
- **Phases:** Bridge, air, core.
- **Weakness:** Earth, forbidden.
- **Rewards:** Celestial Blade, Starforged Pickaxe, Sky Key.
- **Consequence:** Tear opens.

## 22.11 Finster (final)

- **Lore:** Blonde, stocky, a captain of the March who was left holding a minor seal while better men wrote the history. The Tear did not make him a monster first. It made him angrier. He walked into the Void wearing the black armour of a man who expected to be obeyed. He is not possessed in the simple sense. He is the part of the war that never stood down.
- **Intro:** The castle is empty. He is already in the courtyard, sword down, furious that you are late.
- **Look:** Blonde hair visible at the helm, stocky build, black knight armour distinct from the Black Knight (field captain, not champion plate), long sword, no shield. Face visible in phase 2. Anger is the animation, not a speech.
- **Arena:** Courtyard, then broken ring.
- **Music:** March, ruined motifs, then almost no music in the rite.
- **Phases:**
  1. Master swordsman. Parries the player. No magic.
  2. Helm off. Faster. Uses the room.
  3. The rite, then a last stand. If Tanic’s quest is done, he has one slower tell — still lethal.
- **Signature:** He says “Smell my fingers.” The line is diegetic, short, angry, not a meme popup. Audio and subtitle. A sweet-rot scent VFX on High only; on all settings, his hand rises and the ground under a telegraph circle sours (colour, not fog that hides him). The player has five seconds. Correct response: leave the circle (dodge out). Wrong: heavy stagger + corruption + damage. In co-op, each player gets a personal circle, staggered by half a second so it is not a shared wipe by latency. The line plays once per phase 3 entry, and again if the fight lasts more than 45 seconds in phase 3.
- **Weakness:** Parry after the rite. Magic during sword phases is mostly resisted.
- **Strategy:** Treat him as a duel. Do not greed. The rite is a movement check, not a DPS check.
- **Rewards:** Finster’s Longsword (unique greatsword-speed hybrid, anti-magic on parry), Voidstone, world epilogue.
- **Consequence:** Tear quiets. Tanic, if alive, returns to Hearthfen and will finally give his old name. Endgame events unlock.

## 22.12 Additional bosses

Mini / optional:

- Grove Matron (forest spider queen).
- Redcap Captain.
- The Tax Knight (kingdom, optional gate to a vault).
- Bell Witch (mire, not the Mother).
- Standard Bearer (waste).
- Avalanche Yeti.
- Tomb Taxman.
- Caldera Warden.
- Admiral of the Shelf.
- Bridge Seraph.
- The Twice-Knight (void antechamber).
- Hidden: the Quiet Child, a toy in Cookie’s Castle that is only hostile if you burn the nursery before the boss. Drops a cosmetic. Easy to miss. Not required.

---

# 23. Dungeon architecture

## 23.1 Model

Handcrafted skeletons + semi-procedural graphs.

- **Skeleton:** entrance, boss room, landmark rooms (fixed).
- **Graph:** 6–14 rooms for short, 15–28 for long, picked from a room kit tagged by region.
- **Constraints:** critical path length min/max, at least one loop, at least one secret door, trap budget, no room that requires a school the player cannot have yet.

## 23.2 Content

Rooms, corridors, traps (telegraphed), puzzles (one verb: bell, light, weight, name), secrets, chests, mini-boss chance, lore props.

## 23.3 Mobile

Dungeons are subscenes. The open world unloads to a stub. Target < 8 active rooms. No procedural mesh combine at runtime; kits are pre-authored prefabs.

## 23.4 Multiplayer

Seed is world-fixed when the dungeon is first opened, so a friend joining mid-run sees the same layout. Reset on boss kill or on a world timer for optional wings.

---

# 24. Structure generation

Civilisation, ancient, dangerous, and natural structures from the brief are kits:

- Handcrafted hero buildings (Hearthfen, Harrenvale, each boss castle).
- Kit variation for huts, camps, ruins, towers: palette, damage state, prop scatter, banner faction.
- Spawns respect region masks and road distance.
- No structure may block a seal road. Generator has a nav reservation.

Natural landmarks (falls, giant trees, cliffs, valleys, lakes) are placed, not rolled, so the horizon stays art-directed.

---

# 25. Loot architecture

| Rarity | Sources | Mods |
| --- | --- | --- |
| Common | Nodes, mobs | 0 |
| Uncommon | Camps | 1 |
| Rare | Elites, chests | 1–2 |
| Epic | Mini-bosses | 2 |
| Legendary | Region caches | 2 + theme |
| Mythic | Endgame events | 3 |
| Unique | Bosses, hidden | Fixed |

Boss signature loot is guaranteed and soulbound on pickup. Duplicates in co-op are personal, not contested.

Mods: sharp, guarded, warm, quiet, lucky, rotten, bright, heavy. Themed to region. No mod that only adds +1 damage with no verb.

Cosmetics drop from secrets and events, not from the boss guarantee, so the guarantee stays mechanical.

Inventory bloat: grit conversion, material auto-stack, equipment cap warning at 40, stash in settlements.

---

# 26. World event system

Events: goblin push, bandit raid, wyrm-shadow (a flyover, not the boss), magic storm, meteor (ore), undead night, travelling merchant, village emergency, blood moon, rare spawn, dungeon unseal, anomaly (a region’s sky in the wrong place — foreshadow of the Tear).

Rules:

- One major event per game day max.
- Settlement raids target plots with low safety.
- Events have a telegraph (bell, rumour, sky) of at least one minute.
- Rewards are materials and reputation, not power that skips a tier.
- Multiplayer: event state is world state. Late joiners see it if the chunk is loaded.

---

# 27. Economy

Gold from sales, quests, and light mob drops. Sinks: repairs, fast travel after unlock, mirror, bounties, settlement upkeep, corruption cleanse.

Vendors buy grit and goods at worse rates than players want, so crafting stays primary. No auction house in v1. Player trade is direct.

Regional currencies are not used. One coin. Barter items exist for quests (honey, bells, water rights) so quests are not all gold.

---

# 28. Death system

| Mode | On death | Corpse | Boss | Notes |
| --- | --- | --- | --- | --- |
| Adventure | Respawn at bed or shrine. Keep inventory. | None | Resets | Default. Durability off. |
| Survival | Respawn. Drop carried materials and unequipped gear at corpse. Equipped stays. | Recover or it decays in 20 min | Resets | Durability on. |
| Hardcore | Character dead. World remains for co-op partners. | Lootable by party once | Resets | New character can inherit world if permitted, not gear. |
| Custom | Toggles: drop, durability, map reveal, enemy band, friendly fire, hunger. | As set | As set | Hunger off by default even in Survival. **DECIDED:** hunger is a custom toggle, not a pillar. |

Downed state in co-op: 30 s, ally revive, or bleed out to the mode’s death.

---

# 29. Multiplayer architecture

## 29.1 Model

**DECIDED:** host-authoritative listen server for 4 players, with Unity Relay (or equivalent) so the host need not port-forward. Dedicated small instances are a later ops upgrade, same simulation code.

Not Vercel. Vercel may host the site, account portal, news, and admin APIs. Simulation runs in the Unity host or a dedicated Unity process.

## 29.2 What syncs

- Host owns: mob AI, boss state, world flags, chest contents, building graph, NPC critical positions, event state.
- Each client owns input. Host validates movement with a speed cap and a rewind buffer for hits.
- Character sheet is account data. Host can read it for the session; writes to progression go through the save service so a dirty host cannot mint levels.

## 29.3 Join, leave, reconnect

Invite code or friend lobby. Reconnect within 90 s restores the body at last stable position. After that, shrine spawn. World does not roll back.

## 29.4 Loot and bosses

Personal guaranteed uniques. Shared world unlock on any qualifying kill if at least one player is in the arena. Offline progress on a world requires the host’s save; clients do not fork the world.

## 29.5 Permissions

Build, chest, kick, seal-start (host or charter lord).

### System card — Multiplayer

| | |
| --- | --- |
| Purpose | Four friends on one continent. |
| Player-facing | Host, join, revive, shared gates, personal loot. |
| Dependencies | NGO or FishNet, relay, lobby, save service. |
| Data | Session id, world id, player ids, interest set. |
| Technical | Interest management by chunk. Snapshot interpolation for remote players. |
| Mobile | Bandwidth budget ~50 KB/s up per client target, lower in exploration. |
| Multiplayer | This is the system. |
| Testing | Host kill mid-boss, rejoin, duplicate-item attempt, two players crafting the same chest. |

---

# 30. Save architecture

Two documents:

1. **Character save** (account): appearance, skills, inventory, personal quests, soulbound ids.
2. **World save** (world id): seed, seals, dungeon seeds, buildings, settlement ledgers, NPC critical flags, chests, events.

Writes are transactional: write temp, fsync, swap, keep previous. Schema version on both. Migrations explicit.

Cloud backup when online. Conflict: server timestamp plus vector of seal flags; never merge inventories blindly. If conflict, keep both and ask.

Anti-duplication: item instance ids, craft transactions, loot transactions with idempotency keys.

Offline play is first-class. Online account binds when available.

---

# 31. Mobile UX

- Left joystick, camera drag on right look-zone, combat cluster bottom-right.
- Context button bottom-centre.
- Dodge as a flick or button (setting).
- One-handed mode: combat cluster lowers, joystick stays left, look is gyro-optional off by default.
- Haptics: hit, parry, rite warning (distinct).
- Controller support from slice one, same actions.
- UI safe areas, scalable type, no tiny crit text required to play.
- Graphics: Low / Medium / High / Ultra. Auto by device tier, overridable. Dynamic resolution and foliage killer if thermals rise. Target: hold 30 fps. 60 optional on High devices that stay cool.

---

# 32. UI architecture

Menu flow: Boot → Main (Continue, New, Join, Settings) → Character → World → Load → HUD.

HUD: health, stamina, mana if awakened, corruption if any, quick item, context prompt, boss bar, subtle damage numbers (off by default — **DECIDED** off, option on).

No permanent quest arrow. Optional ping on the seal gate after the rhyme is heard.

Inventory is a grid with a loadout column. Crafting is a station UI, not the inventory.

---

# 33. Accessibility

- Subtitles always available. The Finster line is subtitled.
- Colourblind modes for sun/shadow lanes and tell circles (shapes, not only colour).
- Hold-to-toggle for sprint and block.
- Reduced camera shake, reduced flash.
- Text scale.
- No timing puzzle that cannot be slowed in accessibility (boss tells scale slightly, not to trivial).
- One-button interact.

---

# 34. Audio / music direction

Original score. Folk for Hearthfen, martial for Kingdom, wet choir for Mire, few voices for the dead, horn for frost, frame drum for desert, anvil for volcano, glass tones for drowned, high voices for sky, ruined march for Finster.

Diegetic motifs: Cookie’s music box, cathedral bells, Finster’s armour.

SFX priority over music in combat. Sidechain the score when a tell plays.

Mobile: compressed banks, no more than two music layers on Low.

---

# 35. Visual / art direction

Premium stylised-real. Readable shapes, rich materials, cinematic light, not photogrammetry sludge and not voxel.

Original architecture: Veyr stone is pale with dark timber and copper nails. Kingdom adds banners of a split sun. Mire is green-black tile. Waste is bone-ash. Frost is black pine and blue ice. Desert is gilt stone. Volcano is basalt and cracked light. Drowned is smooth court stone under silt. Sky is pale and too clean. Void is all of these, wrong.

Lighting: baked where static, mixed for hero areas, realtime only for player, boss, and key fires on Low.

Water: planar plus normal on Low, planar reflections on High.

Armour and weapons are hero assets. Enemies can share bodies with swapped kits if the silhouette changes.

Do not copy Elden Ring, Minecraft, or Terraria assets, UI, or characters. Inspiration is atmosphere and loop, not content.

---

# 36. Asset pipeline

- DCC: humanoid rig standard, weapon sockets, NPC shared rigs.
- Textures: ASTC, budgets per tier (character 1k–2k, environment 512–1k atlases, hero 2k).
- Addressables by region and by dungeon kit.
- Naming: `reg_forest_tree_a`, `wpn_cookie_blade`, `boss_finster_phase2`.
- Source control for binary via Git LFS or plastic. No loose FBX in Resources/.
- Style guide page before full production: one village, one weapon, one armour, one mob, one boss.

---

# 37. World generation

Hybrid.

- Continent mesh and landmarks: authored.
- Foliage, rock scatter, minor camps, dungeon graphs, loot mods, some NPC names: seeded.
- Seed stored on the world. Same seed, same scatter.
- Streaming chunks ~64 m. Sim only in the 3×3 around players. In co-op, union of interest, capped so four players spreading to four regions force a warning and a sim LOD drop, not four full regions.

---

# 38. Performance architecture

Targets:

| Tier | Device class | Resolution | FPS | Notes |
| --- | --- | --- | --- | --- |
| Low | Older phones | 720p dynamic | 30 | No volumetrics, impostor foliage |
| Medium | Mid | 900p | 30 | Limited shadows |
| High | Recent | 1080p | 30–60 | Shadows, simple volumetrics |
| Ultra | Top / later PC | native | 60 | Extra lights, reflections |

Budgets (Medium, open world): < 150 ms GPU frame at 30, draw calls aggressively instanced, < 1.5 GB resident warning, AI ≤ 15, full NPC ≤ 12.

Tools: pooling, occlusion, LOD, texture compression, animation culling, physics layers (no full destructible), interest management, addressables, thermal profiler in the slice.

Frame stability beats effects. If a boss tell depends on a particle, it also has a mesh tell.

---

# 39. Networking architecture

**DECIDED stack for v1:** Unity 6 + URP + Netcode for GameObjects + Unity Transport + Lobby/Relay. Prediction limited to the local player. Host authority for world.

Revisit FishNet only if NGO prediction or tick rate blocks combat feel in the slice. Do not start on ECS.

Tick: 20 sim ticks/s. Interpolation for remotes. Client-side VFX.

Anti-speed: host rejects moves above cap. Hits validated on host with short rewind.

---

# 40. Backend architecture

| Concern | Where |
| --- | --- |
| Realtime sim | Unity host or later dedicated Unity |
| Accounts | Auth service (Unity Authentication or equivalent) |
| Character cloud save | Cloud save + own schema service |
| World cloud backup | Blob store, versioned |
| Lobby / relay | Unity Gaming Services or equivalent |
| Website, news, account portal, admin | Vercel acceptable |
| Live config | Remote config for event rates, not for boss stats in a way that breaks saves without a migration |
| Analytics | Event pipeline, batched |

Vercel is not the game server.

---

# 41. Security / anti-cheat

Co-op, not competitive. Threats are duplication, fake boss kills, and malicious hosts.

- Item birth only via host transactions with ids.
- Seal flags set only by boss death events the host witnessed with a living boss entity.
- Clients do not send “I killed Cookie.”
- Malicious host can still lie. Mitigation: optional dedicated host later; for listen servers, cloud checkpoint of seals after verified session summaries. v1 accepts some host trust and logs anomalies.
- No kernel anti-cheat. Not worth it for 4-player PvE.

---

# 42. Testing strategy

- Vertical slice on a physical mid Android and a recent iPhone before any second region.
- Combat feel tests recorded, not described.
- Save corruption tests: kill app mid-write.
- Multiplayer: host drop, duplicate craft, loot race, dungeon seed mismatch.
- Soak: 30 min forest roam for thermal.
- Accessibility pass on Finster rite (subtitle, shape tell, 5 s timer under latency).

---

# 43. Analytics strategy

Funnel: menu → create → first craft → first kill → castle door → Cookie attempt → Cookie kill → gate.

Not a surveillance product. No selling data. Events are design tools: where people quit, which boss phase wipes, device tier vs fps.

Opt-out in settings.

---

# 44. Live update strategy

Addressables for region packs so the store build stays smaller. Slice ships Forest + Kingdom edge. Later regions as content packs only after the slice is fun.

Config for event frequency. Boss tuning via versioned data, not silent nerfs that strand saves. Migrations documented.

---

# 45. Development phases

| Phase | Goal | Exit |
| --- | --- | --- |
| 0 | Style guide, movement, camera, one wolf | Feels like the game for 60 seconds on device |
| 1 | Vertical slice through Cookie and the gate | Playable on device, save/load, no softlock |
| 2 | Inventory, equipment, skills, Boe, Kingdom start | Iron loop |
| 3 | Multiplayer 2 then 4 | Host drop recovered |
| 4 | Kingdom + Black Knight | Second seal |
| 5 | Mire, Waste | Two more seals |
| 6 | Frost, Desert | |
| 7 | Volcano, Drowned | |
| 8 | Sky, Void, Finster | Critical path complete |
| 9 | Settlements depth, events, endgame | Live-ready |

Phases are sequential for the critical path. Art can pipeline ahead. Code does not skip the slice.

---

# 46. Vertical slice definition

Must include:

- Menu, creator (reduced but real), world create, Adventure mode.
- Hearthfen with Tanic, Mara, 6 scheduled villagers.
- Forest gather: wood, flint, stone, copper.
- Craft: knife, pick, campfire, copper sword.
- Combat: wolf, goblin, one elite.
- Cookie’s Castle dungeon (shortened but multi-room).
- Cookie, 3 phases, guaranteed loot.
- Green Gate opens.
- Camera sees Kingdom fields. Player can step onto the bridge and is stopped by a real gate, then not stopped after the Core.
- Save and load.
- Low and Medium graphics.
- Runs 20 minutes at ~30 fps on a mid phone.

Does not include: full creator, all schools, settlements above camp, co-op (unless phase 3 pulled forward), other bosses.

---

# 47. Technical dependencies

Unity 6, URP, Input System, Addressables, NGO, Transport, Lobby, Relay, Authentication, Cloud Save (or replacements), a nav solution that works with chunks, a save library or custom transactional writer, audio middleware optional (Unity audio acceptable for slice).

Art dependency: one approved humanoid, one wolf, Cookie, village kit, forest kit, gate.

Design dependency: this bible, then a data schema doc, then a slice board.

---

# 48. Risks

1. Scope disguised as a slice. Ten regions in the first milestone.
2. Combat feel dies on touch controls.
3. Host authority exploits and save duplication.
4. Open-world streaming on mid phones.
5. Tonal whiplash: Cookie and Finster feel like different games.
6. NPC schedules cost more than the feature.
7. Underwater and sky become second engines.
8. Co-op camera and lock-on in vertical arenas.
9. Thermal throttling in the forest, the prettiest area.
10. Building system eats a year.

---

# 49. Mitigations

1. Slice exit criteria are device-based, not feature-count-based.
2. Phase 0 is only movement and a wolf. Kill the project’s controls early if they fail.
3. Transactional items, idempotent loot, seal events not client RPCs.
4. Chunk size and resident caps in the slice, not later.
5. Shared motif work: music box becomes a ruined march quote. Button-eye and finger rite are both “a body part used wrong.”
6. Puppet band by default. Full sim only near.
7. Underwater and sky are lighting and movement states inside the same controller.
8. Guardian arena prototyped as soon as lock-on exists, with grey boxes.
9. Forest is the perf test, not the last biome.
10. Building in slice is campfire + bench + bed only.

---

# 50. Acceptance criteria

The game is on-bible if:

- A new player can start with fists and reach Cookie’s kill on a phone without a class select.
- The Green Gate is a visible, diegetic lock that opens from Cookie’s Core.
- Kingdom is visible before it is reachable.
- Weapon families are not stat clones.
- At least one school of magic changes the environment.
- Tanic has a secret that is revealed in stages and is not required to finish Cookie.
- Finster’s rite lasts about five seconds, is subtitled, has a non-colour tell, and is dangerous.
- 4-player co-op does not fork world seals.
- Saves survive an app kill mid-write.
- Low settings still communicate every boss tell.
- No copyrighted asset, map, or character is used.
- Vercel is not simulating the world.

---

# Implementation order for Claude

Build in this order. Do not skip ahead because a later system is more interesting.

1. Unity 6 URP project, mobile orientation, input map (joystick, camera, light, dodge, interact), third-person controller, camera collision.
2. Graphics tiers and a frame budget overlay. Prove 30 fps with a grey forest blockout on device.
3. One humanoid, fists, one wolf, hit detection, stamina, dodge i-frames, lock-on.
4. Save stub: player position and health, transactional.
5. Interact + inventory grid + wood/flint/stone nodes.
6. Hand craft and bench: knife, stone pick.
7. Hearthfen blockout, day/night, 6 NPC puppets on loops, Tanic dialogue tree (practical only).
8. Copper node, copper pick, copper sword, equipment slots, one armour piece.
9. Goblin + elite. Camp chest. Loot table with instance ids.
10. Cookie’s Castle as a handcrafted short dungeon. Loading as subscene.
11. Cookie boss, 3 phases, tells, rewards guaranteed.
12. Green Gate world flag. Kingdom vista. Gate mesh that actually blocks, then opens.
13. Death and shrine respawn, Adventure rules.
14. Menu, creator (reduced), world create.
15. Only then: skill ranks, magic cantrip (fire), Boe, durability toggle, co-op host with two players, Kingdom proper.

Data before polish. Prefabs and ScriptableObjects for items, spells, bosses, and seals so later regions are content, not new engines.

---

# Questions / decisions still required

These cannot be responsibly inferred.

1. Final title. VEYRMARCH is a working title. Confirm or replace before any public art.
2. Account requirement: fully offline forever, or online account required only for co-op? Bible assumes offline solo is valid.
3. Monetisation. None specified. Do not invent gacha. Decide before live ops: premium, or premium plus cosmetic-only.
4. Voice. Bible assumes no spoken dialogue in v1, efforts only, subtitles for Finster. Confirm if a VO budget exists.
5. ESRB/PEGI tone line for the finger rite and rot content, if this is a store release with an age rating target.
6. Whether Boe’s real-dog likeness must match a specific living dog reference, or a stylised cocker is enough. Affects art pipeline and privacy of reference photos.

---

# Document control

| | |
| --- | --- |
| Status | Creative source of truth, pre-production |
| Engine decision | Unity 6, URP, NGO + Relay for v1 |
| Out of scope here | Production code, asset creation, store page |
| Next companion docs | Data schema, slice task board, art style guide, control map |
