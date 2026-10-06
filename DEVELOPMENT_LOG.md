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
