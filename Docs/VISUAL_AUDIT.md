# Veyrmarch — Graphics and Artwork Audit and Roadmap

Audited build: branch `devin/veyrmarch-overhaul`, commit `707cc91`, live at veyrmarch.vercel.app.

How it was audited: the rendering code in `web/src/game` was read, and the title screen, character creator, bag, journal, pause menu and all nine zones were screenshotted at 1280x720 on High quality in a headless Chrome using software rendering. Frame rate, loading time on real hardware, phone and tablet layouts, audio and gamepad were not measured. No web research was done for this document; the tools and asset libraries named in section 6 are from prior knowledge and their licences must be re-checked before use.

## 1. Verdict

Veyrmarch looks like a tidy low-poly browser game with a good colour sense and strong 2D key art. It does not look like a modern commercial 3D game, and no amount of tuning the current approach will get it there, for one reason: **every 3D object in the game is built in code from boxes, cylinders, cones and spheres, shaded with the cheapest lighting model three.js has, and animated by hand-written poses.** There are no modelled meshes, no image textures on the world, no normal maps except on water, no reflections and no captured animation.

A GTA 6 level of fidelity is not reachable in a browser by a small team: that game depends on thousands of artist-years of scanned and sculpted assets, motion capture and console-only rendering features. The reachable target is a different one, and it is still a very large jump: **a stylised, painterly, physically lit world on the level of Valheim, Tunic, Sea of Thieves or Genshin Impact's environments**, which get their quality from lighting, atmosphere, silhouette and animation rather than raw polygon count. Everything below is aimed at that.

## 2. What the game is built on

| Area | Current state | Where |
|---|---|---|
| Engine | three.js 0.186, WebGL2, React 19 UI, Vite | `web/package.json` |
| Materials | 69 uses of `MeshLambertMaterial`, 0 PBR materials; a procedural "painted" noise shader on top | `engine/materials.ts`, `engine/kit.ts` |
| Textures | All drawn at runtime on a 2D canvas (256 to 512 px); no image textures, no normal or roughness maps on land | `engine/textures.ts` |
| Models | All procedural primitives merged into batches; no glTF loader in the project | `engine/rig.ts`, `world/props.ts`, `world/zones/*` |
| Animation | Hand-written procedural poses per bone; no animation clips | `engine/rig.ts` |
| Lighting | One hemisphere light, one directional sun, a few point lights; no image-based lighting | `Game.ts` near line 258 |
| Shadows | One 2048 px shadow map (1024 on Medium) covering about 68 m around the player; nothing beyond it casts a shadow | `Game.ts` near line 2398 |
| Post-processing | Bloom, colour grade, vignette, sharpen, sun shafts; High quality only for the full chain. No ambient occlusion, no depth of field, no motion blur, no anti-aliasing after post | `engine/post.ts` |
| Sky and weather | Gradient dome with sun, moon, stars, two cloud layers; per-zone particles | `engine/sky.ts`, `engine/particles.ts` |
| Water | Flat transparent Phong plane with a scrolling normal map; no reflection, refraction, depth colour or shore foam | `world/overworld.ts`, `zones/kingdom.ts`, `zones/mire.ts` |
| 2D art | 12 painted WebP images (key art, 9 zone paintings, panel texture), 1.4 MB total | `web/public/art` |
| UI | Leather-and-brass CSS theme, SVG item icons drawn in code | `styles.css`, `ui/icons.tsx` |
| Bundle | Main game chunk about 1 MB (290 kB gzipped) | build output |

## 3. Scores

Scored against a modern commercial stylised 3D game, not against other browser games.

| Category | Score | Why |
|---|---|---|
| Art direction and colour | 6/10 | Consistent palette and mood per zone; the 2D paintings promise far more than the 3D delivers |
| 2D key art and zone paintings | 7/10 | The strongest asset in the game |
| UI, menus, HUD | 6/10 | Coherent theme; panels are sparse, icons are simple vector shapes, little motion |
| Lighting and shadows | 4/10 | Good time-of-day colour; flat ambient, no occlusion, no bounce, interiors are black voids lit by a few points |
| Sky, weather, atmosphere | 5/10 | Pleasant sky; fog is a single uniform density, clouds are flat layers |
| Terrain and ground | 3/10 | Vertex-coloured mesh with one small detail texture; no material blending, no close-up detail |
| Vegetation | 4/10 | Trees read well at distance; grass is sparse spiky clumps; no undergrowth variety near the camera |
| Buildings and props | 3/10 | Boxes with painted-on detail; no bevels, wear or silhouette breakup |
| Characters, NPCs, enemies | 2/10 | Capsule-and-box mannequins; faces are a few shapes; the player is the weakest thing on screen and is always on screen |
| Animation | 2/10 | Stiff procedural poses; no weight, anticipation or blending |
| Water | 3/10 | Flat tinted sheet |
| Effects and combat feedback | 4/10 | Hit flash and particles exist; no trails, decals, dust or impact lighting |
| Camera and cinematics | 3/10 | Functional follow camera; no cutscenes, boss intros or depth of field |
| Performance headroom | Not measured | The game auto-lowered quality in the software-rendered test browser; real devices were not profiled |

**Overall: 4/10.** The gap to the benchmark is almost entirely in four places: characters, animation, materials and lighting.

## 4. What looks poor, by area

- **Player and NPCs.** Tube limbs, a helmet-shaped head, no cloth, no hair volume, no hands worth the name. Seen from behind for the whole game.
- **Enemies.** Goblins, wolves and undead share the same primitive kit; bosses are scaled-up versions with a glow.
- **Interiors (Castle, Kennels, Keep, Citadel).** Long box corridors with one brick texture and near-black ambient light. The Citadel now has ribs and niches but walls are still flat planes.
- **Hearthfen.** The best zone. Cottages are convincing at distance; up close the walls are flat and the ground is a single smooth sheet.
- **Kingdom.** Castle and wheat fields read as toy models; no mid-distance detail between the player and the skyline.
- **Wasteland.** Improved in the last pass, but the horizon is a fog wall and the ground is one material.
- **Mire.** Dead trees and fog work; the water is a flat sheet and the reeds are sparse.
- **Bag and Journal.** Large empty panels, text-only detail pane, no item illustration or character preview.
- **Title screen.** Strong painting, but static: no motion, parallax or particles.

## 5. Visual direction: "Painted Dusk"

- **Identity.** A sealed, dying fairytale continent seen in the last warm hour of the day. Hand-painted surfaces, physically believable light.
- **Palette.** Warm key light (amber 0xffc890), cool shadow (violet-blue 0x3a3050), neutrals of bone, soot and moss, accents of copper and gold. One signature colour per zone: honey green (Hearthfen), wheat gold (Kingdom), cold teal (Mire), rain grey (Keep), ash rose (Wasteland), corpse green (Citadel).
- **Lighting rule.** Every scene has one warm source and one cool fill, and nothing is lit by ambient alone. Interiors are lit by visible fires and windows with real falloff.
- **Material standard.** PBR (`MeshStandardMaterial`) with albedo, normal and packed roughness/occlusion maps at 1024 px for props and 2048 px for terrain sets, hand-painted or stylised, compressed to KTX2.
- **Model standard.** Characters 8 to 15 thousand triangles with a shared humanoid skeleton; props 300 to 3,000; everything with three levels of detail; bevelled edges, no perfect boxes.
- **UI standard.** Keep leather and brass; add painted item illustrations, a 3D character preview, and motion on every state change.

## 6. Roadmap

Ordered by visual impact per unit of work. "New assets" says whether art must be made or sourced.

### Quick wins (days each, no new asset pipeline)

| # | Change | Why it falls short now | Result | Files | Approach | New assets |
|---|---|---|---|---|---|---|
| Q1 | Ambient occlusion | Objects float; corners and undersides are as bright as open ground | Contact shadows under props, depth in foliage and interiors | `engine/post.ts` | Add an SSAO/GTAO pass after the render pass on High, half resolution on Medium | No |
| Q2 | Image-based lighting | Hemisphere light gives flat, directionless fill | Sky-coloured bounce that changes with time of day and zone | `Game.ts`, `engine/sky.ts` | Render the sky dome to a small cube map with `PMREMGenerator` on zone or hour change; set `scene.environment` | No |
| Q3 | Height and distance fog | One uniform fog density | Mist pooling in valleys, clear air above, aerial perspective on the horizon | `engine/kit.ts` shader chunk, `Game.ts` | Replace `FogExp2` with a custom fog chunk using world height and sun direction for in-scatter colour | No |
| Q4 | Cascaded shadows | Shadows stop about 68 m from the player | Shadowed mid-distance: trees, walls and towers stay grounded | `Game.ts` | three.js CSM helper with 3 cascades on High, 2 on Medium | No |
| Q5 | Anti-aliasing after post | Edges shimmer once the composer is on | Clean edges on foliage and rooflines | `engine/post.ts` | SMAA or FXAA pass at the end of the chain | No |
| Q6 | Water shader | Flat tinted sheet | Depth-tinted water with shore foam, fresnel sky reflection and ripples | `world/overworld.ts`, `zones/kingdom.ts`, `zones/mire.ts` | One shared `ShaderMaterial` reading scene depth; planar reflection on High only | No |
| Q7 | Dense grass and ground cover | Sparse clumps on bare ground | Continuous meadow near the camera, flowers and clover patches | `engine/kit.ts`, `world/overworld.ts` | GPU-instanced blade field in a ring around the player, faded with distance, coloured from the terrain | No |
| Q8 | Combat and movement effects | Hits lack weight | Weapon trails, impact sparks, dust on landing and rolling, short hit-stop and camera shake | `engine/fx.ts`, `engine/particles.ts`, `Game.ts` | Ribbon mesh for trails, pooled sprite bursts | No |
| Q9 | Living title screen | Static painting | Slow parallax, drifting embers and mist, light flicker | `App.tsx`, `styles.css` | Split the key art into 3 layers, CSS transforms and a small canvas particle layer | Layered key art |
| Q10 | Bag and Journal redesign | Empty panels | Item illustration, stat bars, rotating character preview | `App.tsx`, `styles.css`, `ui/icons.tsx` | Second small renderer or render-to-texture of the player rig | Painted item illustrations |

### Major overhauls (weeks each)

| # | Change | Why it falls short now | Result | Files | Approach | New assets |
|---|---|---|---|---|---|---|
| M1 | Asset pipeline | No way to load a modelled mesh | glTF models and compressed textures load, cache and stream per zone | new `engine/assets.ts`, `vite.config`, `web/public/models` | `GLTFLoader` with Draco or Meshopt and KTX2; per-zone manifests; loading progress on the existing loading screen | No |
| M2 | PBR materials | Lambert has no roughness, metal or normal response | Wet stone, dull cloth, bright steel all read differently | `engine/materials.ts`, `engine/kit.ts`, every `put(...)` call site via the shared material table | Swap the shared material table to `MeshStandardMaterial`; port the `painted` and `windy` shader hooks; keep Lambert on Low quality | Texture sets |
| M3 | Characters | The biggest single weakness | Modelled, skinned player with real armour pieces per equipment slot; distinct NPCs and enemies | `engine/rig.ts`, `play/mobs.ts`, `play/npcs.ts`, character creator in `App.tsx` | Shared humanoid skeleton; modular body, hair and armour meshes mapped to existing item ids; keep the current rig as the Low quality fallback | Player, about 12 NPC variants, about 30 creatures, 3 bosses |
| M4 | Animation | Hand-written poses | Blended idle, walk, run, roll, attack chains, hit reactions, deaths | `engine/rig.ts`, `Game.ts` combat timing | `AnimationMixer` with clips retargeted to the shared skeleton; drive hit windows from clip events so combat timing does not change | About 40 clips |
| M5 | Terrain | One smooth sheet with one detail texture | Blended grass, dirt, rock and path materials with close-up normal detail and scattered stones | `engine/terrain.ts`, each zone's `sample` function | Splat-map shader with 4 layers, triplanar on steep faces; existing vertex colours become the splat weights | 4 terrain sets per biome |
| M6 | Buildings and props kit | Boxes | Modular walls, roofs, doors, windows and clutter with bevels and wear | `world/props.ts`, `world/zones/*` | Replace builders one at a time behind the same function signatures so layouts and collision stay unchanged | About 80 kit pieces |
| M7 | Interior lighting | Black voids | Baked or probe-lit halls with shafts through windows and warm pools at fires | `world/dungeon.ts`, `zones/keep.ts`, `zones/kennel.ts`, `zones/citadel.ts` | Light probes or baked lightmaps per interior; clustered point lights for torches | Lightmaps |
| M8 | Cinematics | None | Boss introductions, zone arrival fly-ins, depth of field in dialogue | `Game.ts` camera code, `engine/post.ts` | Scripted camera rails stored with zone data; bokeh pass on High | No |
| M9 | Level of detail and streaming | Whole zone built at load | Stable frame rate with the denser world above | `engine/kit.ts`, zone builders | Chunked instancing with LOD swaps and impostors for distant trees | LOD meshes |

### Sources to evaluate (licences to be confirmed before use)

- three.js examples: cascaded shadow maps, SSAO/GTAO, SMAA, Sky, Water, KTX2 and Draco loaders (MIT).
- pmndrs `postprocessing` and `n8ao` for a cheaper combined effect chain (MIT).
- Poly Haven and ambientCG for CC0 texture sets and HDRIs.
- Quaternius and Kenney for CC0 stylised models to prototype with before commissioning original art.
- Mixamo for humanoid animation clips.
- Original characters, bosses and kit pieces must be commissioned or generated; nothing may be taken from GTA or any other commercial game.

## 7. Proposed order

1. Q1 to Q5 together: lighting, occlusion, fog, shadows, anti-aliasing. Largest change for the least risk; no assets.
2. Q6 to Q8: water, grass, combat effects.
3. M1 and M2: asset pipeline and PBR materials. Everything after depends on these.
4. M3 and M4: the player first, then enemies and bosses, then NPCs.
5. M5 and M6, one zone at a time, starting with Hearthfen.
6. Q9, Q10, M7, M8: menus, interiors, cinematics.
7. M9 throughout, as density rises.

Constraints for every step: saves in `localStorage` keep their format; collision, layouts and combat timing stay as they are; Low quality keeps the current renderer path as a fallback for phones; each step ships behind the existing quality setting and is profiled on a real phone before it becomes a default.

## 8. Decisions needed

- **Art source for M3 to M6.** Commissioned, AI-generated, or CC0 stock adapted to the style. This sets cost and timeline more than anything else.
- **Minimum device.** The heavier the target phone restriction, the more of this stays High-only.
- **Download size.** Modelled assets will move the game from about 2 MB to tens of MB; streaming per zone keeps first load small.
