# Development log

## 2026-10-06 — T001 Repository audit

- Task: T001
- What changed: Audited an empty GitHub repository. Recorded contradictions already settled by the architecture bible and the programme. Copied the source documents into `Docs/` and marked them as copies.
- Files: `PROJECT_AUDIT.md`, `README.md`, `DEVELOPMENT_LOG.md`, `KNOWN_ISSUES.md`, `TECHNICAL_DEBT.md`, `CHANGELOG.md`, `Docs/**`
- Tests run: none. T001 requires none.
- Results: Repo had zero commits before that one.
- Performance numbers: none.
- Next legal task at the time: T002, blocked on the editor.
- Commit: `91b3449`

## 2026-10-06 — Simulation, content, and automated tests

- Task: programme rules that do not need the editor. T006, T017–T021, T030–T032, T048, T054–T061, and the content behind them. Unity tasks are not closed.
- What changed: Pure C# `Veyr.Content` and `Veyr.Sim`. Slice catalog for items, recipes, nodes, bestiary, eleven bosses, ten regions, named cast, quests, Ember, camp pieces, settlement tiers, events. World simulation for move rejection, gather, craft, combat, Cookie and Boe grants, seals, atomic saves. Console harness `Veyr.Loop`.
- Files: `Packages/com.veyrmarch.*`, `sim/**`, `tools/Veyr.Loop`, `ProjectSettings/ProjectVersion.txt`, `Packages/manifest.json`, `Assets/_Project/INTEGRATION.md`
- Tests run: `dotnet test sim/Veyr.Tests.Sim/Veyr.Tests.Sim.csproj` on .NET SDK 8.0.425.
- Results: 47 passed, 0 failed. Loop harness printed a knife id reused on replay and a wolf dying in three hits of 10.
- Performance numbers: none. No scene, no device.
- Decisions recorded:
  - Stone knife stations are Hand and Bench. The design bible names Hand. The first ten minutes and the programme also name the bench.
  - Iron nodes require `seal_cookie` and Cookie's Pick. A copper pick is rejected. That follows programme T059, not the material table row that says a copper pick mines iron.
  - Copper sword inputs (5 copper, 1 wood, 1 flint, bench) are slice tuning. The bible names the sword and does not give the counts.
  - Damage, health, and speeds are data in the catalog. They are not a feel pass.
  - Fists do not block. A shield does. Greatsword rank 4 may block clumsily.
  - The Green Gate reads `seal_cookie`. The Core is not consumed and does not re-lock the gate.
- Not done: any Unity compile, any scene, any device frame time, client adapters, NGO, corpse object in the world (the drop rule is tested; the body on the ground is not).
- Next legal task: open the repo in Unity 6.3 LTS and compile the packages. Then T002 can be marked, and client adapters can be written against a real editor.

## 2026-10-06 — Systems past the first slice, still without the editor

- Task: sim portions of combat depth, dungeon rules, magic schools, net envelopes, and content audit. Unity tasks stay open.
- What changed: Status buildup and cleanse. Enemy telegraphs (wolf pounce slower than goblin rush, elite slower still). Cookie dungeon layout with a stable seed, a trap tell, and a weight door. Loot that will not mint a second unique. Survival durability, unique dulling, greatsword versus shield, hunter move and knight dodge cost. Seven magic schools plus Open the Tear behind `seal_guardian`. Corruption tax, haunt, and rite backfire. Protocol rejection, 90 second reconnect, interest filter. Dialogue advance, corpse record, local haptics setting, catalog fingerprint. `Veyr.Check`. Input action map and prefab spec, neither opened by Unity.
- Tests run: `dotnet test sim/Veyr.Tests.Sim/Veyr.Tests.Sim.csproj` on .NET SDK 8.0.425.
- Results: 64 passed, 0 failed, after the new tests were added to the previous 47.
- Performance numbers: none. No scene, no device.
- Decisions recorded:
  - Status buildup is 30. Tick damage and durations are tuning. Campfire cleanses bleed, burn, frost, and silence.
  - A light chain is three swings inside 15 ticks. The third hit is ×1.15.
  - Durability is off in Adventure. Survival and Hardcore chip. Uniques dull to 90% and never break. Counts are 20 and 40.
  - A copper trinket multiplies lightning mana by 0.85. Cookie confuse is a 10% humanoid roll. Combat-rank sum past 24 takes a soft tax.
  - Corruption above 50 raises shop prices by 25%. At 80 a haunt may spawn. At 100 the next rite backfires for 20 and drops corruption to 80.
  - Corpse records last 10 minutes. There is still no mesh.
  - Lethal wind-up is 8 ticks when a hit could kill a fresh 80 HP player. Finster's circle is 100 ticks.
  - Slice scene ids that may ship are Boot, Forest_Blockout, Cookie_Nursery. Kingdom is data only.
- Not done: any Unity compile, any scene, any device frame time, NGO, a visible corpse, bow four-piece damage.

## 2026-10-06 — Playable browser client

- Task: a game you can open on a phone. Unity stays out of this build. No Unity scene was created. No Unity task was marked done.
- What changed: `web/` is a Vite + React + Three.js client. It plays Hearthfen, the forest, gather, craft, combat, the nursery castle, the weight door, Cookie, the three unique rewards, the Green Gate, and the wheat road to a shut fortress. Touch stick, strike, dodge, block, use, pack. Saves in localStorage.
- Tests run: rules unit tests in the client; a browser pass that walked, turned, gathered, crafted a knife, killed a wolf, entered the castle, opened the weight door, killed Cookie once, and stood on the Harrenvale road with the gate open.
- Results: that loop completed. Walk speed read 4.2. Holding A while moving forward increased yaw. Holding D decreased it.
- Decisions recorded (browser slice, not catalog changes):
  - Wolf bite is 12, not the catalog 4, so the telegraph is worth a dodge.
  - Bandage heals 28.
  - Stump shield can also be crafted: 3 wood + 1 fibre at the bench. It is also a world pickup.
  - Ember's mana pool is 20.
  - The browser steps at 1/60. The sim's conceptual rate is still 20 Hz.
  - The nursery is offset to x=400 so it does not sit inside the forest.
  - Keyboard sprint is Shift. A full stick sprints. Walking with WASD does not.
  - Light chain matches the sim: three swings inside 0.75 s, third hit ×1.15.
- Not done: Unity, a second player, the rest of the kingdom, a public URL until Vercel is linked.



## 2026-10-06 — Port Veyr.Sim and Veyr.Content to Unity's compiler (P0)

- Task: T003 prerequisite. Found during the takeover audit: the sim and content packages could not compile in Unity 6. They used C# 10–12 (`required`, collection expressions, file-scoped namespaces, `record struct`, raw strings), .NET 8 implicit usings, and .NET 5+ APIs (`System.Text.Json`, `SHA256.HashData`, `Convert.ToHexString`, `File.Move` overwrite, `IReadOnlySet`, `Enum.GetValues<T>`). The earlier "64 tests pass" was true on .NET 8 only.
- What changed: All runtime and test sources rewritten to C# 9 / .NET Standard 2.1 with no behaviour change. `IsExternalInit` polyfill per assembly. In-house `JsonNode` / `JsonWriter` replaces `System.Text.Json` (explicit field writes, IL2CPP-safe, exact `ulong` seeds). `Hex.Sha256` replaces the .NET 5 hashing helpers; the catalog fingerprint is byte-identical.
- Save store: temp file is flushed with `Flush(true)` before the rename. The rename uses `File.Replace`. Two previous generations are kept as `.1` and `.2` (the bible asks for previous snapshots retained). Before, `.bak` was overwritten with the new file on every write, so no previous copy existed. Read order: current, finished temp (kill before rename), `.1`, `.2`.
- Tests changed: `TornSaveFallsBackAndAFinishedTempIsKept` now writes two generations and also covers kill-before-rename and a torn temp. `CookieGrantsOnceOpensTheGateAndSurvivesReload` saves the character twice (immediate unique save plus the dirty-timer save) before tearing the file. Neither test was weakened: the old version only passed because the backup was a copy of the newest write.
- Build enforcement: `sim/Directory.Build.props` builds the Unity-shared libraries as `netstandard2.1`, C# 9, implicit usings off, nullable off (files opt in with `#nullable enable` as in Unity), warnings as errors. `sim/Veyr.Tests.UnityCheck` compiles the test sources against NUnit 3.5, the version Unity's `com.unity.ext.nunit` forks.
- `global.json` accepts any 8.0 SDK feature band (was pinned to 8.0.425, which this container does not have).
- Test asmdef uses the current Test Framework form (`UNITY_INCLUDE_TESTS`, `nunit.framework.dll`, TestRunner references) instead of the deprecated `optionalUnityReferences`.
- Tests run: `dotnet test sim/Veyr.Tests.Sim` → 64 passed, 0 failed. `dotnet build sim/Veyr.Tests.UnityCheck` → 0 errors. `Veyr.Loop` exit 0, `Veyr.Check` audit clean, fingerprint `82FC867A…6E06`.
- Not verified: a real Unity compile. This build reproduces Unity's language version and API surface; it is not the Unity compiler.
- Next legal task: 20 Hz world step (T006/T007 sim side).

## 2026-10-06 — T006/T007 sim side: 20 Hz world step and movement authority

- Task: T006 (sim clock), the sim half of T007, and the authority shape Phase 2 needs ("input produces `PlayerIntent`, not direct transform authority").
- Found: `WorldSimulation.Tick(intent, actor)` advanced the world clock once per actor, so two players made the world run at 40 Hz. Mob stagger and i-frames never counted down because only the ticked player was updated. Hurtbox history for mobs was only written by hand from tests. A half-pushed stick moved at full speed. The hunter set's 1.05 move bonus was clamped away.
- What changed:
  - `Submit(actor, intent)` queues per player; two intents before a step merge (newest movement, buttons kept). `Step()` records every actor's pose for rewind, applies players in join order, ticks statuses for every actor and every boss, then advances the clock and day once. `Tick` and `TryMove` are now Submit plus Step, so tests and harnesses use the same path.
  - Position claims: a client that moves its own CharacterController sends where it ended. `Movement.ValidateClaim` keeps a per-body budget refilled at the cap (dodge speed during the dodge burst), banks at most 0.5 s, and borrows the 0.15 m slack instead of granting it every tick. It refuses NaN, a jump over 6 m ("teleport"), a fall faster than terminal, sustained climb beyond the jump apex ("climb"), and any path through a closed blocker.
  - `WorldGeometry` blockers: ground-plane walls the sim enforces whatever the client's physics does. A gate blocker opens through `WorldFlags.GateOpen`. A body inside a blocker may always leave.
  - `SimEventLog`: Dodged, MoveRejected (with the authoritative position), Hit, Parried, Killed, Respawned, ItemGranted, SealSet, Rejected. Hosts drain it; it caps at 4096 so a host that never drains cannot leak.
  - `ActorBody` gains Y, Yaw, SpawnY, DodgeTicks, MoveBank, Ascent, LastSeq. `MoveTuning` gains dodge, jump, gravity, terminal fall, slack, and bank values.
- Tests run: `dotnet test sim/Veyr.Tests.Sim` → 81 passed (64 existing, 17 new in `WorldStepTests`). `Veyr.Tests.UnityCheck` → 0 errors.
- A test caught the first version of the budget letting a sustained 9 m/s claim through (slack refilled every tick). Fixed before commit.
- Not done: AI in the step (Phase 6), Unity physics sweep on a dedicated server (Phase 13).
- Next legal task: repair the gather, craft-station, and flank authority holes.

## 2026-10-06 — Repair sim authority holes (gather, station, flank, forged ids)

- Task: repair of existing sim code against architecture §7.2, §8, and §40. Found in the takeover audit.
- Found:
  - `TryGather(actor, "node_flint")` took a node *type*, with no position, reach, or depletion. A client could mine anything from anywhere, forever.
  - `TryCraft(..., StationId.Bench, ...)` believed the client's claim that a bench was there. Programme micro-milestone 5.5 (bench range check) was not met.
  - `TryAttack(..., flank, ...)` took flank from the client, so any client could claim the +20 posture flank bonus.
  - An unknown target, recipe, or actor id threw `KeyNotFoundException`, so a forged message could crash the authority.
  - A staggered attacker could still swing. A material or key could be equipped as the main-hand weapon.
- What changed: `NodeInstance` and `StationInstance` placed in the world with positions. Gathering takes an instance id and checks actor, life, reach (2.5 m plus a 2.5 m vertical allowance), and charges, then the existing seal and tier gates. Nodes have charges (default 3) and a respawn timer (default 90 s) restored in `Step`. Station crafts need a placed station of that kind in reach; the reach check runs after the idempotency replay, so a retried craft after walking away still returns the same item. Flank is `Reach.Flank` from the target's yaw. Unknown ids and self-targeting are refused. Every refusal writes a `Rejected` event with a reason.
- Tests run: `dotnet test sim/Veyr.Tests.Sim` → 93 passed (12 new in `AuthorityTests`). `Veyr.Tests.UnityCheck` → 0 errors. `Veyr.Loop` exit 0.
- Existing tests updated to place nodes and stations instead of naming node types; their assertions are unchanged.
- Not done, logged as debt: swing recovery. The sim has no per-weapon attack interval, so a client can swing as fast as stamina allows (architecture §7.2 "cooldown skip"). It belongs to the Phase 7 combat spike (T027–T028) with the moveset timing.
- Next legal task: `Veyr.Net`, `Veyr.Server` embedded host, and the pure client core.

## 2026-10-06 — T007/T009–T012 pure halves: net contract, embedded host, client core

- Task: the parts of T007 (boot tick via adapter), T009 (joystick and look), T010 (move model), T011 (camera maths), T012 (dodge button and flick), and T014 (frame numbers) that do not need `UnityEngine`. The MonoBehaviours that wrap them are the next commit.
- New assemblies (all `noEngineReferences`, all built here under Unity's C# 9 / .NET Standard 2.1 limits):
  - `Veyr.Net` (`Packages/com.veyrmarch.net`): `IntentMessage`, `ActorSnapshot`, `WorldSnapshot`, `ISimEndpoint`, `SessionContext`, protocol version. Plain structs; no netcode package until Phase 13.
  - `Veyr.Server` (`Packages/com.veyrmarch.server`): `EmbeddedHost`, the offline authority. Fixed 20 Hz steps from real time, at most 5 per frame, with dropped time counted. Intents are bound to the host's actor, never read from the message. Interest-filtered snapshots reuse one list. `LocalSession.Start` builds world, body, host, and context.
  - `Veyr.Client.Core` (`Packages/com.veyrmarch.clientcore`): floating `VirtualStick` (follows the thumb past the rim, dead zone, rim = sprint), `LookDrag` (degrees per screen height, invert), dodge flick (fast short swipe; the camera turn the flick caused is handed back to undo), `HoldOrToggle` (accessibility sprint/block), `IntentMath` (camera-relative stick), `IntentSender` (one send per tick, taps latched between ticks), `PredictionMotor` (walk/sprint/dodge/jump from the sim's `MoveTuning`), `OrbitRig` (profiles explore 5 m, combat 4 m, indoor 3 m, boss 7 m, FOV 60, body left of centre, pull in at once, ease out, lift over the head rather than into the body), `FrameStats`, `QualityProfile` Low/Medium/High (720/900/1080p, shadows 0/1/2 cascades, draw 100/160/160 m), `QualityChooser`, `ThermalGovernor` (40 ms for 10 s steps down once, never up), `SafeArea`, `Reconciler`.
- Sim: the move budget now refills every tick for every living player, so a late packet may cover two ticks. `LocalSettings` gains the accessibility and control options from design §33 and architecture §39 (text and UI scale, subtitles, hold/toggle sprint and block, flick, sensitivity, invert, shake, flash, tell window clamp 1–1.25, control offset, overlay), schema still 1 with defaults.
- Tests run: `dotnet test sim/Veyrmarch.sln` → `Veyr.Tests.Sim` 94 passed, `Veyr.Tests.Core` 35 passed. `Veyr.Tests.UnityCheck` (all three test folders, NUnit 3.5) → 0 errors.
- Notable test: `PredictionAgreesWithAuthorityTests` runs the client motor at 24, 30, and 60 fps for 12 s with sprinting, dodging, and jumping, sends claims through the host, and asserts the sim refused none. A 14 m/s motor is refused and snapped back.
- Assembly note: `Veyr.Client.Core` is an addition to the architecture's assembly list. It is the engine-free half of `Veyr.Client`, split out so it can be tested without the editor. `Veyr.Server` is engine-free for now; the dedicated Unity process adds its adapter in Phase 13.
- Next legal task: Unity project files, `Veyr.Client` and `Veyr.App` adapters, and the editor scene builder.

## 2026-10-06 — T002/T003/T008–T012/T014 Unity runtime adapters (not yet opened in Unity)

- Task: the Unity half of Phase 1–2: assemblies `Veyr.Client` and `Veyr.App`, package manifest, input map, and thin MonoBehaviours around the tested core.
- What changed:
  - `Packages/manifest.json` declares URP 17.3.0, Input System 1.14.0, Test Framework 1.6.0, uGUI 2.0.0 and the modules used. The local `com.veyrmarch.*` folders are embedded packages and are no longer listed as `file:` dependencies (Unity loads embedded packages from `Packages/` on its own). `testables` lists the three tested packages. URP, Test Framework, and uGUI are editor-bundled packages; if 6000.3 bundles a different patch, Package Manager uses its own.
  - `Veyr.Client` (`Assets/_Project/Code/Client`): `TouchControls`/`TouchZone`/`TouchButton` (uGUI pointer events into `VirtualStick` and `LookDrag`), `PlayerInputReader` (touch plus the action map; hold-light becomes heavy at 0.35 s; scripted-input hook for tests and soaks), `LocalPlayerController` (CharacterController driven by `PredictionMotor`, one claim per tick, snap on refusal, smooth small drift), `OrbitCameraRig` (sphere cast that ignores the player's colliders, profile blending, body fade), `QualityService` (runtime copy of the tier's URP asset, render scale to 720/900/1080p, 30 fps cap, draw distance per layer with a `Landmark` layer to the horizon, thermal step-down), `FrameOverlay` (frame, median, p95, run median, CPU/GPU from FrameTimingManager, memory, tier, tick), `DeviceLog` (CSV per second plus a whole-run summary on pause and quit, in persistentDataPath/device_logs), `SafeAreaFitter`, `VitalsHud`, `LocalisedLabel`, `SettingsService`, `SessionEvents`.
  - `Veyr.App` (`Assets/_Project/Code/App`): `GameBootstrap` (Boot composition root), `SessionDriver` (persistent, advances the embedded host after the player has sent, pauses on suspend), `SceneRoot` (explicit references per scene; a scene played without Boot reuses or creates a dev session).
  - Input map: `Sprint` action added (design §33 hold-or-toggle), gamepad bindings for Block, Ability, LockOn, QuickItem, Sprint; a Keyboard&Mouse scheme for editor play.
  - `Veyr.Client.Core` gains `FrameHistogram` (whole-session median without storing frames), `UiText` (interface strings by key), `QualityProfile.HorizonDistance`. `Veyr.Sim` gains `Scatter` (seeded jittered grid) and `WorldGrid` (64 m chunks, 128 m tiles). `Veyr.Net` gains `IHostDiagnostics`.
- Compile check without Unity: `tools/unity-api-stubs` declares the slice of the Unity API these files use, written to match Unity's signatures. `sim/UnityCheck.Client` and `sim/UnityCheck.App` compile the real sources against them under C# 9 / .NET Standard 2.1, with references copied from each asmdef, so `Veyr.Client` cannot reach `Veyr.Server`. A deliberate typo was caught; the real sources build with 0 errors and 0 warnings. This is a type check against a hand-written API, not a Unity compile.
- Tests run: `dotnet test sim/Veyrmarch.sln` → 98 + 36 passed. `dotnet build sim/Veyrmarch.sln` → 0 errors, 0 warnings.
- Not verified: anything at runtime in Unity. Behaviour of CharacterController, uGUI raycasts, URP asset switching, FrameTimingManager on a phone. ENV-1 stays open.

## 2026-10-06 — T005/T013 editor setup and scene generator, play-mode smoke tests

- Task: T002 (project settings), T005 (Boot scene in the build list), T013 (Dev_Move scene), the play-mode half of T007/T010/T011. Scenes are generated by editor code instead of hand-written YAML, because a `.unity` file nobody opened would be a fake.
- What changed (`Assets/_Project/Code/Editor`, assembly `Veyr.Editor`):
  - `VeyrSetup`: menu Veyrmarch > Setup (run all, or steps 1–3) and Veyrmarch > Validate Project. Batch entries `Veyr.EditorTools.VeyrSetup.BatchSetup` and `BatchBuildAndroid` with exit codes.
  - `ProjectSetup`: company and product, bundle id `com.veyrmarch.slice`, landscape only, linear colour, IL2CPP and ARM64 on Android, Vulkan then GLES3, iOS 15, frame timing stats on, Active Input Handling = Both, layer 8 = `Landmark`. Idempotent.
  - `RenderingSetup`: one Universal renderer and three URP assets (Low: no shadows, no MSAA; Medium: one cascade 35 m; High: two cascades 50 m, MSAA 2x, soft shadows), the `VeyrQualityAssets` set, Medium as the default pipeline. URP fields without public setters are set through their serialized names with a warning if one is missing.
  - `SceneBuilder` + `HudBuilder` + `MeshKit` + `Palette`: Boot.unity (bootstrap, ink background) and Dev_Move.unity. Dev_Move is the grey forest blockout for the first phone test: six 128 m ground tiles, the Hearthfen pad and spawn, a road north, about a thousand seeded trees (seed 7, 7.5 m spacing, clearing at the pad) combined into one trunk mesh and one canopy mesh per 64 m chunk, three giant trees, a giant root arch over the road and a climbable root ramp, Cookie's castle hill with one nursery-red tower and a frost peak on the Landmark layer, a camera course (L wall, 1.6 m corridor, 2.6 m low arch, 20° and 35° ramps, 0.3 m stairs, 1 m ledge, pillar), and edge walls. Honey sun, trilight ambient, exponential fog in the art-bible palette. The HUD: stick zone left, look zone right, combat cluster bottom-right, Use bottom-centre, vitals and overlay top-left, all inside the safe area. PF_Player, PF_CameraRig, PF_Hud saved as prefabs.
  - `ProjectValidator`: Unity 6 version, scenes and build order, input actions and schemes, tier assets and default pipeline, Landmark layer, input handling, IL2CPP, ARM64, landscape, frame timing stats, no `Assets/Resources`.
- `Assets/Tests/PlayMode` (`Veyr.Tests.Play`): Boot loads and binds Dev_Move with one player and one session and about 20 ticks per real second; a scripted stick walks over 4 m with no server snaps and the sim body within 0.6 m; the camera stays out of the capsule while orbiting against a wall; reloading Dev_Move keeps one session.
- Found by review before commit: the icosphere winding faced inward, and the stair treads rose 0.6 m (over the 0.4 m step offset). Both fixed. Boot had no AudioListener.
- Compile check: `sim/UnityCheck.Editor` and `sim/UnityCheck.Play` build the sources against the API declarations and NUnit 3.5 with 0 errors and 0 warnings.
- Not verified: none of this has run. The generator, the scenes it makes, and the play-mode tests need the Unity 6 editor (ENV-1).

## 2026-10-06 — Split Dev_Move and Forest_Blockout; review fixes

- Task: T013 and the Phase 3 device note need an empty-scene frame number ("median ≤ 33 ms on the mid device in an empty scene"), and the bibles say the forest is the performance test. One scene could not serve both.
- What changed: the generator now writes `Dev_Move` (ground, pad, road, camera course, horizon landmarks) and `Forest_Blockout` (the same plus the seeded forest, giant trees, root arch and ramp). `Forest_Blockout` is the name already listed in `SliceBuild.PlayerScenes`. Build list: Boot, Dev_Move, Forest_Blockout. A developer "Next test" button (top-right) ends the session and loads the other scene, so one phone build measures both.
- Review fixes before any run: gamepad look had the pitch sign opposite to touch and mouse. Generated meshes for both scenes shared one folder and were deleted and recreated per build, which would have broken the first scene's mesh references; each scene now has its own folder under `Assets/_Project/Generated/`.
- Tests run: `dotnet build sim/Veyrmarch.sln` → 0 errors, 0 warnings. `dotnet test` → 98 + 36 passed.

## 2026-10-06 — Documentation, CI, and the checkpoint 1 stop

- Task: T001 audit refresh, T004 (ignore and LFS already present), documentation gate J, and the stop at checkpoint 1.
- What changed: `PROJECT_AUDIT.md` rewritten from verified state. `ARCHITECTURE.md` added (assembly map, dependency rules, departures from §3.1). `README.md` now points at Unity as the product and the browser build as a reference. `KNOWN_ISSUES.md`, `TECHNICAL_DEBT.md` (TD-002 removed: the client adapters landed in 5690b65 and 861edbc; TD-008 to TD-013 added), `CHANGELOG.md`, `Assets/_Project/INTEGRATION.md`, and `Docs/assets/SLICE_PREFAB_SPEC.md` updated. `Docs/device/PHASE3.md` is the human's script for first open, setup, the phone build, the 10-minute walk, and the report table.
- CI: `.github/workflows/ci.yml` runs the .NET build (shared libraries under Unity's limits, Unity assemblies against the API declarations), all edit-mode tests, the content audit, the loop harness, and the web build. The same commands were run locally in Release: 0 errors, 0 warnings, 98 + 36 tests passed, audit clean, loop exit 0.
- Performance numbers: none. No device.
- Next legal task: T015/T016 on a mid Android phone by a human (checkpoint 1). The agent stops here. Phase 4+ Unity work waits for the checkpoint report or a written waiver from Charlie.

## 2026-10-06 — Web build becomes the playable milestone

- Task: Charlie changed tonight's priority: a playable VEYRMARCH on Vercel, opened on an iPhone. Unity work is paused at checkpoint 1, not removed.
- What changed: `web/` rebuilt from a box prototype into a procedural Three.js game with a React interface. Terrain, Hearthfen, the Giant Forest, Cookie's hill and castle interior, the Broken Kingsbridge, the Green Gate, and a Kingdom vista. Skinned procedural characters with code-driven poses. Villagers on routes. Combat with soft lock, hit-stop, parry, roll i-frames, stamina, Ember. Seven enemy types with ground telegraphs. Cookie in three phases with an intro, back-stitch, fire weakness, a death sequence and the three uniques. Touch stick, drag-to-look, thumb buttons, safe areas, no page zoom or scroll. Three save slots, character creator, bag and crafting by station (hand, workbench, forge), barter, day and night, synthesised audio. Automatic graphics step-down below ~24 fps.
- Files: `web/src/game/**`, `web/src/ui/**`, `web/src/App.tsx`, `web/src/styles.css`, `web/index.html`, `web/public/**`, `README.md`.
- Tests run: `npm test` in `web/` (9 rules tests, all pass), `npm run build`. Scripted browser playthroughs in headless Chromium with software WebGL at 844×390 with touch: talk to Tanic, gather, craft the knife, learn Ember, kill a wolf, enter the castle, solve the weight door, kill the rocking horse, open the nursery, defeat Cookie through all three phases, receive Blade, Pickaxe and Core plus `seal_cookie`, leave, open the Green Gate, reach Castellan Voss and the ending. Touch stick, button taps, bag, pause, death and wake, save then reload and Continue.
- Results: the full loop completes. Bugs found and fixed on the way: Cookie launched out of the arena when back-stitched mid-slam; a zero-length boss state divided by zero; several meshes rendered black for lack of a colour attribute; bandages did not stack; a gather and dodge race in the test exposed only harness timing.
- Performance numbers: draw calls per frame from `renderer.info`, measured in the browser: 74 to 195 depending on view (928 before batching). About 0.8 million triangles in the densest forest view. No phone frame time yet: the agent has no iPhone, and software WebGL frame times mean nothing.
- Decisions recorded:
  - Cookie has 280 health in the browser (the sim has 180). Phone players have no lock-on and the fight should last long enough to see all three phases.
  - Copper sword, copper pick and a new iron sword are forged at Mara's forge, not the bench.
  - Cookie takes half damage while perched on the music box, except from fire. The slam's dizzy landing is the punish window.
- Deployment: production deployment `dpl_DqGs6MED73e7C9VFri2DydCfN31B` built READY from this branch and is aliased to `veyrmarch.vercel.app`. The agent could not load the URL: the container's network policy blocks `*.vercel.app` and the Vercel connector's page fetch was refused for the team scope.
- Next: Charlie plays it on an iPhone (checkpoint). Then tune feel and frame rate from that report.
