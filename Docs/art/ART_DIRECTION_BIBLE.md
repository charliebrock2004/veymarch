# VEYRMARCH
## Art Direction Bible
### What the game looks like. Not a redesign.

| Field | Value |
| --- | --- |
| Game | VEYRMARCH — The Sealed Continent |
| Style lock | Stylised-real. Grounded materials, readable silhouettes, restrained myth. |
| Creative source | `MASTER_GAME_DESIGN_BIBLE.md` |
| Tech budgets | `TECHNICAL_ARCHITECTURE_BIBLE.md` wins if a pretty idea breaks mobile. |
| This document | Visual language and asset rules for artists, Blender, Unity, and Claude. |
| Originality | No copied maps, characters, UI, or asset packs from other games. Inspiration is atmosphere only. |

Screenshots should be identifiable with the UI hidden.

---

# 1. Visual north star

A Veyrmarch frame is a lived-in medieval place with one thing wrong in it. Pale stone, dark timber, copper nails, wet moss, a human-scale figure, and a landmark you cannot reach yet. Light is directional and slightly honeyed in safe ground, colder where a seal failed. Magic is rare in the frame, not a coating.

The wrong thing is specific: a music box in the trees, a collar bell, a gate that hums, ash that is not snow, a sky that is too clean. Absurdity is a material fact, not a cartoon overlay.

| Place | First feeling | What the frame must contain |
| --- | --- | --- |
| Hearthfen | Warm, small, worth staying | Smoke, a bell, occupied yards, Tanic’s too-fine coat somewhere in the lane |
| Giant Forest | Wonder, then a nursery rhyme that curdles | Giant roots as paths, honey light, one toy-coloured object that does not belong |
| Medieval Kingdom | Order, already cracking | Wheat, pale walls, split-sun banners, wet stone, a fortress on the hill |
| Dark Mire | Pity and rot | Knee-deep dark water, green-black tile, a bell under the surface |
| Undead Wasteland | Grief, not gore-poster | Bone-ash wind, cloth, a citadel, almost no red |
| Frostlands | Austerity | Black pine, blue shadow, one warm monastery light |
| Golden Desert | Grandeur and theft | Gilt stone, hard noon, a buried lip of a street |
| Ashen Volcano | Awe, then punishment | Basalt stairs, cracked orange in the seams, no jungle of fire |
| Drowned Kingdom | Memory under pressure | Court stone, silt, caustic light, a dry throne in a wet room |
| Skylands | Vertigo | Pale bridges, too-clean stone, a long fall |
| Void | Anger given a building | Pieces of every region, assembled wrong, one stocky man with a long sword |

---

# 2. Art pillars

| Pillar | Meaning | Do | Don't |
| --- | --- | --- | --- |
| One continent | Regions are shifts of the same craft culture | Repeat pale stone, dark timber, copper fixings | A new art style per biome |
| Dense, not cluttered | A path has a grave, a pack, a visible tower | Author landmarks, scatter dressing | Empty kilometres or prop soup |
| Grounded myth | Magic reads as a material | Wax, brass, silt, ice, hard light | Neon runes on everything |
| Absurdity with teeth | Cute for four seconds, then a mechanism | Button eyes, collar, finger rite as body tells | Joke skins, meme UI |
| Readable combat | Silhouette and pose carry the tell | Wind-up in the body, shape not only colour | Particle fog as the only warning |
| Lived-in | People were here yesterday | Wear, repairs, tools down, ash, mud | Showroom buildings |
| Mobile clarity | Identity survives Low | Big shapes, limited materials, mesh tells | Micro-detail that vanishes on a phone |
| Horizon hunger | The next castle is in the shot | Impostor landmarks | Fog walls that hide the promise |
| Human scale | Doors fit people | Bosses break scale on purpose | Every sword taller than the player |
| Environmental memory | History without a plaque | Collapsed roads, scratched names, nursery fossilised into a hill | Floating lore crystals |

---

# 3. Overall style

**DECIDED: stylised-real.**

Not photoreal. Phones cannot hold skin pores, and photoreal fantasy collapses into grey noise. Not chibi, not Fortnite, not voxel. Forms are simplified in the mid-frequencies: real proportions, slightly larger hands and weapon reads, cleaner edges, believable wear.

| Axis | Rule |
| --- | --- |
| Shape | Soft nature, hard architecture. Bosses may break the rule once. |
| Proportions | Human 7–7.5 heads. Tanic 8. Finster stocky 6.5. Cookie is a toy, not a person. |
| Stylisation | 30% simplification, 70% material truth |
| Surface | Macro wear yes. Pore-level no. |
| Textures | Painted-photo hybrid. Tileable trim sheets plus unique hero masks. |
| Materials | Rough wood, honed-not-mirror metal, damp stone. Few full-metal shines. |
| Density | Authored landmarks, seeded dressing. See §33. |
| Architecture | Timber and pale stone first. Region materials are dressings on that grammar. |
| Light | One sun, few fires. Shape from value, not from fill spam. |

---

# 4. Colour language

Shared world dyes, so a traveller still looks like Veyrmarch in the desert.

| Role | Colour | Use |
| --- | --- | --- |
| Primary | Bone stone `#E4D7C3`, soot timber `#3C342C`, moss `#5E6B45` | Buildings, paths, trees |
| Secondary | Copper `#B87333`, iron `#6E7378`, wool undyed `#CDBBA6` | Fixings, tools, clothes |
| Accent | Split-sun gold `#D7A441`, seal green `#7C8C62` | Banners, gates, rare cloth |
| Danger | Dried blood `#7A2E2A` used sparingly, sulphur `#C46A2A` only in volcano | Tells, not UI chrome |
| UI | Ink `#1C1916`, parchment `#E7DCC8`, copper line | Panels. Not blue sci-fi |

Magic is a family, not a rainbow kit:

| School | Colour | Rule |
| --- | --- | --- |
| Fire | Ember `#E07A3D` | Small, hot core, not a flamethrower cloud |
| Ice | Glass blue `#C5D7E2` | Hard edges |
| Lightning | Pale gold-white | Short, branching, thin |
| Earth | Stone and root | Meshes more than particles |
| Shadow | Desaturated local light | Dim, do not paint the screen black |
| Holy | Warm white, bell-metal | Clean, small |
| Forbidden | Vein purple-black `#3A2A3A` | Personal, on the body, not the sky |

Region palettes are accent shifts on the primary set.

| Region | Shift |
| --- | --- |
| Forest | Honey green, wet bark, toy red as a foreign note |
| Kingdom | Wheat, banner gold, more pale stone |
| Mire | Green-black water, copper gone verdigris |
| Waste | Bone ash, no healthy green |
| Frost | Blue shadow, black pine, one orange fire |
| Desert | Noon gold, linen, hard blue sky |
| Volcano | Basalt, seam orange |
| Drowned | Slate, silt olive, pale court stone |
| Sky | Washed stone, hard light, almost no dirt |
| Void | All of the above, wrong saturation, one angry steel |

Bosses may introduce one personal colour. Cookie: nursery red and brass. Boe: black coat, red collar. Finster: no new colour. He is the kingdom’s black armour, dirtier.

---

# 5. Lighting

Mood is value structure. Safe places have a warm practical. Seals have a cooler rim that does not match the sun.

| State | Mood | Mobile |
| --- | --- | --- |
| Day | Honey in forest, clearer in kingdom | One directional, baked village |
| Dawn / dusk | Long shadow, bell silhouettes | Same sun, grade change |
| Night | Blue ambient, practical fires | Player light plus 2 fires on Low |
| Fog | Depth, not blindness | Exponential fog. Markers may hide. Combat UI does not. |
| Rain | Darker stone, no screen flood | Streak cards on High only |
| Storm | Distant | Skybox and fog, not a particle wall |
| Magic | Local to the cast | No scene-wide bloom required |
| Boss arena | Readable floor, rim on the boss | Boss is a light priority. Crowd lights are fakes. |
| Dungeon | Pools of practical light, dark gaps | Baked. Tell lights are meshes. |
| Underground | Cool, low | Same |
| Skylands | Hard, thin, few shadows | Bright grade, cheap |
| Void | Familiar skies flickering as phase language | Grade swaps, not new engines |

No volumetric fog on Low or Medium. If a tell needs light, it also needs a shape.

---

# 6. Material language

Roughness stays high. Metalness is reserved for copper, blade edges, brass, and boss mechanisms. Nothing is automotive clearcoat.

| Material | Look | Roughness | Notes |
| --- | --- | --- | --- |
| Wood | Open grain, water stain, axe scars | 0.7–0.9 | Scale 1–2 m on buildings |
| Stone | Pale, lichen in joints, not marble showroom | 0.8 | Shared trim sheet |
| Copper | Warm, fingerprints, green in the mire | 0.4–0.6 | The civilisation metal |
| Iron | Dark, oil, edge hone | 0.45 | Reliable, not magical |
| Froststeel | Blue-white, fine frost in recesses | 0.35 | Cold, not chrome |
| Mire crystal | Green-black glass, internal flaw | 0.15 | Used small |
| Grave iron | Black, pale filigree, cloth caught in it | 0.5 | Looks mourned |
| Sunstone | Gold core, stone skin | 0.3 on the core | Daylit only in lore; always a core in art |
| Infernal | Cracked, orange in the crack only | 0.6 | Not a lava skin |
| Abyssal | Deep blue-violet, wet | 0.2 | Pressure, not neon |
| Celestium | Pale gold-white, too clean | 0.25 | Hard light, little dirt |
| Voidstone | Drinks light, no specular | 0.9 | A hole in the shader, used tiny |

Wear: edge rub on metal, dirt at hems, mud on boots, repaired patches. Unique items get engraving and one mechanism. They do not all glow.

---

# 7. Environment art

Terrain is authored tiles with a shared material family. Rocks are kits, 3–5 silhouettes per region, recolored only within the region shift. Trees are specific species, not one pine everywhere. Grass is cards up close and a tint further out. Flowers are local and rare. Water is a plane: forest tea-brown, mire black-green, sea slate, not tropical turquoise.

Roads are worn earth then laid stone as the kingdom approaches. Bridges are timber then stone. Ruins keep the same mouldings as living buildings, broken. Camps use the region’s cheap materials. Castles are the culture’s best masonry, not a generic grey castle pack.

Procedural dressing may scatter rocks, grass, and camp clutter. It may not move a landmark, a gate, or a boss approach.

---

# 8. Giant Forest

This is the first impression. Giant roots are the roads. Trunks read at 40 m on Low. Canopy breaks so honey shafts hit the path. Understorey is fern and rot, not a jungle wall.

Rivers are narrow and copper-stoned. A waterfall is a landmark, placed. Ruins are a shrine and a mill, timber gone soft. Wildlife is deer-scale and boar-scale, not monsters in the safe lane. Goblin camps are stilted, bone tools, stolen village cloth. Cookie’s castle is a nursery that fossilised into the hill: painted wood, oversized blocks, a music box, then brass and stitching when you are close.

If the forest is only green noise, the art direction has failed.

---

# 9. Region direction

## Medieval Kingdom
Wheat, pale walls, split-sun banners, market cloth, rain on stone. Farms are real grids gone ragged at the edge. Harrenvale climbs a hill. The fortress is black plate architecture: lawful, hollow. Knights read as people in armour, not spikes. Elites wear office, not horns.

## Dark Mire
Boardwalks, stilts, green-black tile from the drowned cathedral. Fog sits at the waist. Witches are parishioners gone wrong, not Halloween hats. The Mother is a choir shape with censers.

## Undead Wasteland
Ash snow, rib bridges, cloth. Skeletons share a kit but carry jobs: rake, notary, standard. Little blood. The citadel is a roll-call hall.

## Frostlands
Black pine, blue shadow, ice as architecture. Monastery fire is the only warmth. The wyrm is a frozen breath, not a western dragon poster. Spines are cover.

## Golden Desert
Linen, gilt stone, buried streets. Noon is a hard key light. Pharaoh is a wrapped king on a barge, lanes of light in the arena. Bandits are sun-bleached kingdom deserters, visually related.

## Ashen Volcano
Basalt stairs, obsidian bridges, orange only in cracks. Cult forges are industry. The titan is the caldera standing up, tiled, not a lava blob.

## Drowned Kingdom
Surface wrecks, then court stone under silt. Jellyfish are lanterns. The Queen is a dry silhouette in a wet room. No cartoon mermaid.

## Skylands
Too-clean pale stone, hard-light bridges as simple planes. Guardian is a person-shaped lock with a real sword. Fall is the scenery.

## Void
Familiar mouldings from other regions, joined wrong. Empty courtyard. Finster is a stocky blonde captain in black field armour, helm off in phase 2. Spectacle is the man and the sword. Particles must not hide the hand tell.

---

# 10. World transitions

No biome cubes.

| Edge | How it changes |
| --- | --- |
| Forest → Kingdom | Roots thin, stumps, wheat volunteers, a timber bridge, then stone road and a banner |
| Forest / Kingdom → Mire | Soil darkens, reeds, boardwalk, tile fragments in the mud, fog lowers |
| Mire → Waste | Water dies, reeds bleach, ash replaces mud, bells stop |
| Kingdom → Frost | Walls keep their moulding, roofs steepen, pines replace broadleaf, breath appears |
| Waste → Desert | Ash becomes salt, then sand, linen replaces wool, stone gains gilt |
| Desert → Volcano | Sand crusts to basalt, heat shimmer, orange seams |
| Volcano → Drowned shelf | Basalt stairs meet wreck timber and silt |
| Sky | Chains and lifted kingdom stone, dirt falls off |
| Void | Not a landscape fade. A door. Interior quotes the other regions. |

Gates are objects in these transitions, not the transitions themselves.

---

# 11. Character art

Player is a working body, 7–7.5 heads, slightly larger hands so grips read on a phone. Faces are sculpted presets plus blend shapes, not a photo face. Skin has tone and a simple subsurface fake, not pores. Hair is cards and shells, 10 styles in the slice. Scars and tattoos are decals from an original set. Cloth is the start. Armour replaces it and must share sockets.

Silhouette test: sword, greatsword, spear, and staff must separate at 30 pixels tall. Capes are short or off on Low. No floating weapons. Sheathe on the hip or back with a socket.

Animation readability beats flourish. Attacks wind up in the shoulder and hip.

---

# 12. NPC art

Occupation is costume and prop, not a cartoon body.

| Role | Read |
| --- | --- |
| Farmer | Straw, hoe, mud hem |
| Smith | Leather apron, copper studs, one burn scar |
| Merchant | Pack, better cloth, still dusty |
| Hunter | Bow, fur trim, quieter colours |
| Fisher | Oilskin, net |
| Miner | Lamp, grit |
| Builder | Chalk line, nail pouch |
| Guard | Kingdom or village kit, tired |
| Mage | One focus, not a robe covered in runes |
| Priest | Wool, bell motif |
| Alchemist | Stains, glass |
| Innkeeper | Apron, keys |
| Noble | Cleaner cloth, same dyes |
| Knight | Plate, human proportions |
| Traveller | Mixed region dust |
| Child | Smaller rig, simple. Optional in slice. No combat sexualisation. Ever. |

Shared villager rig. Faces from a small preset bank so Hearthfen is not one clone.

---

# 13. Tanic

Long, 8 heads, narrow shoulders, pale skin, long brown hair tied poorly, grey-green eyes. Clothes are village wool cut too well: a workshop coat with a hidden military hem stitch. No armour in the forest. Hands are clean for a villager. That is the tell.

Palette: soot, undyed wool, one copper pin. Idle: he watches the tree line, not the player. Walk is unhurried. When shown Finster’s name later, the animation is a stop, not a speech. Silhouette: hair and coat length. Recognisable from behind at 20 m.

Do not make him a mentor archetype with a staff and a beard.

---

# 14. Player equipment

Weapons are tools that became arms. Blades have thickness. Grips are wrapped. Picks are picks, with a readable head. Bows are wood and sinew until late tiers. Shields are wood then iron, kite or round, not tower doors. Staffs are wood with one focus.

Armour layers: cloth, leather, plate on the kingdom grammar. Helmets must leave a readable face or a strong visor shape. Capes are optional and short. Glow is off by default. A unique may have one motivated glint: Cookie’s glass eye, sunstone core, voidstone drinking light.

No oversized nonsense unless the boss weapon’s fantasy is weight, and even then the player must still read.

---

# 15. Rarity visual language

| Rarity | Read |
| --- | --- |
| Common | Village craft, tool marks |
| Uncommon | Cleaner forge, one stamp |
| Rare | Region material appears |
| Epic | Engraving, better silhouette |
| Legendary | A mechanism or set colour |
| Mythic | One impossible material, tiny VFX |
| Unique | Named shape. Cookie’s blade is painted wood and brass, not a gold sword. Smacko is a fast sword with a collar-bell guard. Finster’s sword is a captain’s long blade, plain and angry. |

Colour tags in UI may help. The mesh must still differ if the UI is off.

---

# 16. Bosses

Framework: one silhouette, one material trick, one arena relationship, one body tell. Phase 1 may be comic. Phase 2 must be a weapon.

| Boss | First read | Threat read | Arena |
| --- | --- | --- | --- |
| Cookie | Plush penguin, caller coat, button eyes | Brass armature, stitching, music box | Nursery courtyard, oversized toys as pillars |
| Boe | Black cocker, red collar, real dog | Ears as leather wings in phase 3 | Kennel cave, thrown stick |
| Black Knight | Human in black plate, kite shield, salute | Bridge footing, no plume | Rain, throne bridge |
| Mire Mother | Choir veil, censers | Flooded nave | Bells, waist water |
| Grave King | Crown and roll-call | Bone court | Femur throne, little gore |
| Frost Wyrm | Frozen breath, spines | Wind lanes | Open crater |
| Sand Pharaoh | Wrapped king, barge | Light and shadow lanes | Pyramid ring |
| Infernal Titan | Caldera standing | Sinking tiles | Heat in seams only |
| Drowned Queen | Dry face, wet room | Rising water | Court stone |
| Celestial Guardian | Hard-light person, real sword | Falling platforms | Pale, vertical |
| Finster | Blonde, stocky, captain’s black armour, long sword | The raised hand and soured circle | Courtyard that loses floor |

Cookie’s nursery red is the only saturated toy colour in the forest, so it is the foreign note. Boe stays a dog until the wings. Finster is not a demon form. Anger is the animation.

---

# 17. Mobs and creatures

Ecology first. Wolves are wolves. Spiders are orchard-fat, not crystal aliens. Goblins are small people with stolen cloth and bone tools. Undead keep their job in the silhouette. Desert foxes are not hostile set dressing. Sandworms are rare and large. Fire moths are small. Sharks stay in open water.

No palette swaps as new species. A frost wolf is longer-coated and pale, with a different head shape, not a blue wolf texture. Shared rigs are allowed if the silhouette changes.

Readable at Low: a hostile has ears, a weapon, or a posture that a deer does not.

---

# 18. Architecture

Base grammar: pale stone plinth, dark timber frame, copper nails, steep forest roofs, steeper frost roofs, tile only where a culture could fire it.

| Type | Rule |
| --- | --- |
| Hearthfen | Low, repaired, palisade, no planned square |
| Villages | Same grammar, more wear |
| Towns | Stone ground floor, timber above, banners |
| Castles | Thicker stone, same moulding, darker |
| Farms | Timber, thatch, mud |
| Mills | Wheel, flour dust |
| Taverns | Wider door, hanging mark |
| Smiths | Open yard, coal |
| Churches | Bell, not a gothic kitbash |
| Witch huts | Parish craft, sunk |
| Necromancer towers | Kingdom stone, cloth, bone screens |
| Desert | Gilt stone, shade courts |
| Volcanic | Basalt blocks, forge industry |
| Drowned | The same court, silted |
| Sky | Kingdom stone, too clean |
| Void | Those mouldings, wrong joints |
| Goblin | Stilts, stolen doors |
| Bandit | Kingdom leftovers |

Player building pieces must be the same grammar, rougher.

---

# 19. Hearthfen

A clearing, not a town. Palisade of uneven stakes. One lane. Smith yard. Mill. Beehives. A bell on a timber frame. Mud and plank paths. Smoke from three chimneys. Gardens, not lawns. Children optional. Signs are carved or painted marks, not modern type.

Tanic is at the workshop lane, coat too fine, chest locked. Mara’s forge is the warm practical light. Night is shutters and one watch fire. The player should want to come back. It must not look like a tutorial zone made of cubes.

Layout target: readable loop in 60 seconds, forest edge always visible, castle hill visible from the bell.

---

# 20. Dungeons

Same materials as the surface, older and closer. Cookie’s castle keeps nursery paint in the first rooms and loses it as brass shows through. Lighting is practical: slits, braziers, the music box. Traps are visible mechanisms. Puzzles are bells, weights, or toy blocks, not glowing runes. Boss rooms are the architecture’s purpose, not a floating platform in a void, except the Void itself.

Outdoor and indoor must share a material. A dungeon that could be from another game is a fail.

---

# 21. VFX

Small, shaped, short. Hits are a spark and a brief hitstop, not a blast. Parry is a metal flash with a shape. Dodge is foot dust. Crit is a sharper hit, not a new colour explosion.

Magic VFX match §4 and are optional on Low if a mesh tell exists. Weapon trails are thin and off on Low. Boss attacks telegraph with the body. Cookie’s eye beam is a thin brass line. Finster’s circle is a sour stain on the floor with a shape icon, scent only on High.

Cap: architecture limits. If a frame needs more than the cap, cut the effect, not the tell.

---

# 22. UI visual language

Ink and parchment panels, copper hairline, split-sun mark used once. Type is a readable serif for titles and a plain sans for combat numbers. Health is a solid bar, not an ornate frame that hides the value. Stamina is thinner. Mana appears only after it exists. Boss bar is a name and a bar, phase marks as ticks.

Inventory is a grid. Rarity is a corner material chip plus a word, not a full-screen glow. Damage numbers default off. Safe areas respected. No fantasy clutter behind the joystick.

It should feel made in Veyr. It must be readable in sun on a phone.

---

# 23. Animation

Player: responsive, weight in the hips, readable wind-ups over 0.35 s on lethal attacks. NPCs: loops of work, not combat idles in the village. Mobs: one verb each. Bosses: phase language in the body. Gather and mine: contact frame matches the node pop. Build: a place gesture, not a cinematic. Death: short. Hit react: flinch or stagger, no long ragdoll on Low.

Swimming and climbing are later and must reuse the same body. Idle for Tanic is watchfulness. Idle for Boe phase 1 is a tail wag. That wag is the lie.

---

# 24. Camera

Third-person orbit. Explore distance about 4–6 m. Combat bias closer, over the shoulder, so the weapon reads. FOV around 60 on a phone, slightly higher only if the user sets it. Lock-on frames the target’s torso and the tell. Indoor camera pulls in. It never enters the body. Bosses get a slightly wider frame so floor tells stay visible. Mounts and gliders are later; do not design the slice camera around them.

Mobile: the character stays in the left-centre so the right thumb has room. Shake is optional and off in accessibility.

---

# 25. Audio-visual relationship

A tell is a pose, a shape, and a sound together. Cookie’s box is diegetic before it is a score cue. Bells are objects. Finster’s line is voice plus subtitle plus the hand. Music ducks when a tell plays. Low quality may drop a music layer, not the tell sound. Do not design a VFX that only works if the score swells.

---

# 26. Mobile visual quality

Identity on Low is silhouette, palette, and landmark. Detail is what scales.

| | Low | Medium | High |
| --- | --- | --- | --- |
| Shadows | Off or one blob | One cascade | Two |
| Foliage | Impostors sooner | Cards plus a few meshes | More meshes |
| Textures | 512–1k | 1k | 1–2k heroes |
| VFX | Mesh tells, few particles | Modest | Trails, simple volumetrics |
| Water | Opaque plane | Normal | Reflection in hero interiors only |
| Post | Grade | Grade | Bloom, no blur required |
| Draw | 100 m | 160 m | 160 m plus impostors |

If Low loses the honey shaft, the toy red, or the boss tell, it is not an acceptable Low.

---

# 27. 3D asset budgets

Architecture numbers win. These match them.

| Asset | LOD0 tris | LOD1 | Texture |
| --- | --- | --- | --- |
| Player | 12–18k | 6k | 1–2k |
| NPC | 6–8k | 3k | 1k atlas |
| Small creature | 3–6k | 1.5k | 1k |
| Large creature | 8–12k | 4k | 1k |
| Boss | 15–25k | 8k | 2k |
| Weapon | 1–3k | — | 1k |
| Building piece | 0.5–2k | 0.3k | Atlas |
| Large building | 4–8k modular | 2k | Atlas |
| Prop | 0.2–1k | card or none | Atlas |
| Tree | 1–2k plus card | card | Atlas |
| Rock | 0.3–1k | lower | Atlas |

Materials: one lit shader, one foliage, one water, one vfx. Hero bosses may have a second material. Not a unique shader per prop.

---

# 28. Asset naming

`{type}_{region}_{name}_{variant}`

Prefixes: `CHR_` player, `NPC_`, `MOB_`, `BOSS_`, `WPN_`, `ARM_`, `TOL_` tools, `ENV_`, `PROP_`, `BLD_`, `VFX_`, `UI_`, `MAT_`, `TEX_`, `SFX_`, `MUS_`, `ANM_`.

Examples: `NPC_forest_tanic`, `BOSS_forest_cookie`, `WPN_cookie_blade`, `BLD_hearthfen_smith`, `ENV_forest_root_bridge_a`.

No spaces. No `final_final`. Unity prefabs mirror the name with `PF_`.

---

# 29. Blender pipeline

Metres. +Y forward or the project’s agreed export axis, documented once, then never changed. Origin at the contact point for props, pelvis for characters. Apply scale. UVs for trim sheets. LOD0 then LOD1 as a mesh, not an automatic hope. Collider is a separate simple mesh named `_COL`. Rig is the shared humanoid unless the boss needs its own. Export FBX, no cameras, no lights. Unity import: no Materials if using the project shader, scale 1, animation compression on. Mobile check: in a forest tile on Medium, draw and memory noted.

Automation worth having: naming lint, missing LOD warning, missing collider warning. Not worth having: unattended AI mesh into the build.

---

# 30. AI asset generation

AI may make mood boards, silhouette thumbs, trim ideas, and greyblock variations. It may not ship.

Before production, an asset passes style review against this bible, technical review against the budgets, licence review, and a phone screenshot beside Hearthfen. Reject extra fingers, melted ornaments, random glow, and anything that looks like another game’s landmark. A pretty generation is a reference, not a file in `Prefabs/`.

---

# 31. Asset licensing

Every production asset has a row: source, author, licence, commercial use, modifications, attribution. Unknown licence does not enter. Generated images used as texture source need a licence note too. No ripped game assets. No unclear marketplace downloads.

---

# 32. Art quality gates

An asset is not in the slice until: it matches the palette, silhouette reads at phone size, topology and UVs are clean enough, it uses the project shader, LOD exists if it is large, collider exists if you can hit it, it is inside budget, scale is 1 m = 1 m, name matches §28, licence row exists, and it does not embarrass the asset beside it.

---

# 33. Environment density

Paths: readable 2 m clear. Verges: grass and one prop every few metres. Forest interior: trunks every 6–10 m, not a wall. Clearings: empty on purpose. Landmarks: one per view. Camps: one focal prop and clutter cap. Do not fill every surface. Empty is allowed if it is a composed empty, like the Void courtyard or a wheat field.

---

# 34. Visual storytelling

Show the March without a codex. Scratched-out names. A nursery fossilised into a hill. A ledger stain. A collar tag in a drawer. Ash that replaced snow. A sky chapel portrait of a younger Tanic. A captain’s seal in a mass grave. Player building should look newer and rougher than these, so the old world stays older.

---

# 35. Do / don't

| Do | Don't |
| --- | --- |
| Pale stone, dark timber, copper | Greybox kits from five games |
| Wear and repairs | Clean plastic |
| One foreign colour in the forest | Rainbow loot glow |
| Body tells | Particle-only attacks |
| Human-scale doors | Giant nonsense swords by default |
| Honey light and a toy note | Generic dark fantasy sludge |
| Region shifts | Biome cubes |
| Original landmarks | Copied castles or bosses |
| Low-setting silhouettes | Detail that only exists on Ultra |

---

# 36. Visual consistency checklist

- Does it look like Veyrmarch with the UI off?
- Would it sit in Hearthfen without a style break, or is the break intentional and regional?
- Is the scale believable next to the player?
- Does it use the material language?
- Does Low still show its silhouette and tell?
- LODs, collider, name, licence?
- Does it look worse or better beside Tanic and the smith? If worse, it is not done.

---

# 37. Art development order

1. Style sheet: stone, timber, copper, one tree, one villager, one sword.
2. Player blockout, then a real cloth body.
3. Hearthfen lane: smith, bell, palisade, Tanic.
4. Forest path and one giant root.
5. Flint, wood, stone, knife, pick.
6. Wolf and goblin.
7. Dungeon rooms.
8. Cookie and the nursery arena.
9. Cookie’s blade and pick.
10. Gate and kingdom vista impostor.

Not before that: desert, void, Finster beauty shots, cape physics, full creator hair set.

---

# 38. Visual vertical slice

A person who has not read the docs should say it is a grounded medieval fantasy with something nursery-wrong in the woods. The slice contains a readable player, a warm occupied Hearthfen, Tanic, a honey forest, a wolf, a goblin, a dungeon that becomes a fossilised nursery, Cookie cute then brass, two unique weapons that are not generic legendaries, and a gate with fields beyond. Placeholder textures are allowed only if they use the palette. A greybox with a penguin pasted on is not the slice.

---

# 39. Art pipeline for Claude

When asked for visual content, Claude inspects existing materials and prefabs first, reuses the shader and trim sheet, stays in the region palette, names to §28, stays inside §27, adds LOD and collider, places it in a forest or village shot, checks it on Low, and writes the licence row. Claude does not invent a new style, download random packs, or call an AI image a production asset. If a look is not in this bible, stop and propose, do not generate a parallel aesthetic.

---

# 40. Final art director checklist

Style locked to stylised-real. World shares stone, timber, copper. Characters are human-scale. NPCs read by job. Creatures belong to a place. Bosses have one silhouette and one tell. Weapons are physical. Armour layers. Architecture evolves. Materials are rough. Lighting is one sun plus practicals. VFX is spare. UI is ink and parchment. Animation is readable. Low settings keep the identity. Budgets match the architecture. Licences are tracked. Nothing looks like a different game beside Hearthfen.

---

# Art direction status

| Area | Status |
| --- | --- |
| Visual identity | READY |
| Mobile art strategy | READY |
| Asset pipeline | READY as rules, not as tools installed |
| Character direction | READY |
| Environment direction | READY |
| Boss direction | READY |

Open art decisions:

- Final title lockup and split-sun mark, after the name is confirmed.
- Whether Boe must match a private dog photo. Stylised black cocker is the default.
- Voice and face close-ups if a VO budget appears.
- Exact hex values may be tuned on the first style sheet. The relationships are locked.

Recommended first art assets:

1. Style sheet: stone, timber, copper, moss.
2. Player cloth body.
3. Tanic.
4. Hearthfen smith and bell.
5. One giant-forest tree and root bridge.
6. Wolf.
7. Stone knife.
8. Cookie silhouette.

Recommended next step: make the style sheet in-engine on a 10 m patch before any character polish. If that patch does not look like one place, do not model the castle.
