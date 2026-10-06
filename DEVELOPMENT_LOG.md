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

