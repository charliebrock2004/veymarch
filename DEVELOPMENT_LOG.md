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
