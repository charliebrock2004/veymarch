# PROJECT_AUDIT

| Field | Value |
| --- | --- |
| Date | 2026-10-06 (takeover audit, updated after this session's work) |
| Repo | [charliebrock2004/veymarch](https://github.com/charliebrock2004/veymarch), branch `claude/lucid-rubin-95ao1j` |
| Unity | Pinned `6000.3.25f1` in `ProjectVersion.txt`. **Never opened.** No editor or licence was available to the agent. |
| Device | None available. No frame time has been measured anywhere. |
| Tests | 134 edit-mode tests pass on .NET 8 (`dotnet test sim/Veyrmarch.sln`). They have not run in Unity's test runner. |
| Verdict | Simulation and authority shape are real and tested. The Unity project is written and type-checked against declared Unity APIs, but unverified in the editor. The phone checkpoint (programme checkpoint 1) is the next gate and needs a human with Unity 6 and an Android phone. |

## What the previous agents built, and what this audit found

| Area | Previous claim | Verified state | Action taken |
| --- | --- | --- | --- |
| `Veyr.Sim` / `Veyr.Content` | 64 tests pass; Unity test runner "should pick them up". | True on .NET 8 only. **Unity 6 could not compile either package**: C# 10–12 syntax, implicit usings, `System.Text.Json`, .NET 5+ APIs. | Ported to C# 9 / .NET Standard 2.1 with no behaviour change. The .NET build now enforces Unity's limits. P0 fixed. |
| World tick | `WorldSimulation.Tick` per actor. | Clock advanced once per actor per call (two players = 40 Hz). Mob stagger and i-frames never counted down. Mob hurtbox history only written by tests. | Added `Submit` + `Step`: one tick per step, all actors updated, intents merged. |
| Movement authority | Forged speed rejected. | Only a `ClaimedSpeed` field was checked. A half stick moved at full speed. Hunter set bonus clamped away. | Position claims are validated against a speed budget, a teleport limit, a climb limit, and closed blockers. Analogue speed works. |
| Gathering | Stone knife via sim. | `TryGather("node_flint")` had no position, reach, or depletion: mine anything from anywhere, forever. | Placed node instances with reach, charges, and respawn. |
| Crafting | Bench recipe. | The client's word that a bench was there was believed. | A station of that kind must be placed and in reach; idempotent replay still works. |
| Combat | Server-authoritative. | Flank was client-claimed. Unknown ids threw `KeyNotFoundException` (a forged message could crash the authority). Staggered attackers could swing. Materials could be equipped as weapons. | All refused with reasons. Swing recovery is still missing (TD-006). |
| Saves | Atomic with fallback. | The "backup" was overwritten with the newest write, so no previous generation existed. No fsync. | Flush to disk, atomic replace, two previous generations, kill-before-rename recovery. Tests strengthened. |
| `Assets/_Project/Input/Veyr.inputactions` | Ten actions. | Touch and Gamepad schemes, no keyboard, no Sprint. | Added Sprint, gamepad bindings, and a Keyboard&Mouse scheme. |
| Browser client `web/` | "The playable build." | Builds; 6 tests pass. A separate TypeScript copy of the rules, not the production path. | Kept as a behavioural reference (master prompt §84–86). Not extended. CI builds it. |
| Unity scenes, client adapters | None, on purpose. | Correct: none existed. | Added (below). |

## What exists now

| System | Where | Status |
| --- | --- | --- |
| Rules: movement authority, inventory, crafting, gathering, combat, bosses, grants, seals, saves, day clock, schedules, quests, death modes, magic gates, building, settlements, dungeon layout | `Packages/com.veyrmarch.sim` | Implemented and tested on .NET. Most are ahead of the programme order (previous agents) and not yet wired to Unity. |
| Content catalog: slice items, recipes, nodes, bestiary, 11 bosses, 10 regions, named cast, lines, quests, spells | `Packages/com.veyrmarch.content` | Implemented as C# data. Audit clean. Tuning is unvalidated (TD-004). |
| 20 Hz world step, intents, events, blockers, scatter, world grid | `Veyr.Sim` | Implemented and tested. |
| Net contract: intents, snapshots, `ISimEndpoint`, `SessionContext` | `Packages/com.veyrmarch.net` | Implemented. No netcode package yet (Phase 13). |
| Embedded authority host (offline solo) | `Packages/com.veyrmarch.server` | Implemented and tested: fixed 20 Hz, hitch clamp, interest-filtered snapshots. |
| Client core: stick, look, flick, intents, prediction motor, orbit camera maths, frame stats and histogram, quality tiers, thermal governor, safe area, reconciler, UI strings | `Packages/com.veyrmarch.clientcore` | Implemented and tested, including a test that the client motor never trips the server's checks at 24/30/60 fps. |
| Unity client adapters, Boot composition root, session driver | `Assets/_Project/Code/{Client,App}` | Written. Type-checked against hand-written Unity API declarations. **Not compiled or run by Unity.** |
| Editor setup, URP tiers, Boot / Dev_Move / Forest_Blockout generator, validator, batch build | `Assets/_Project/Code/Editor` | Written and type-checked. **Not run.** |
| Play-mode smoke tests | `Assets/Tests/PlayMode` | Written and type-checked. **Not run.** |
| CI | `.github/workflows/ci.yml` | .NET build (including Unity compile checks), all tests, catalog audit, loop harness, web build. Not yet observed on GitHub. |
| Device script and report template | `Docs/device/PHASE3.md` | Ready for the human. |

## Contradictions and decisions

The architecture wins on authority, frame budget, tiles, destruction, and grant keys. The programme wins on order. Decisions recorded:

| Topic | Choice |
| --- | --- |
| Stone knife station | Hand and Bench both legal (previous session). |
| Iron node | `seal_cookie` plus Cookie's Pick; a copper pick fails (programme T059 over the material-table row). |
| Copper sword cost | 5 copper, 1 wood, 1 flint (not in the bible). |
| Gate | `seal_cookie` opens it; the Core does not re-lock it. |
| Movement authority | Clients move their own CharacterController and claim the result; the sim validates the claim. Matches architecture §5 ("server corrects, client predicts"). Unity-physics sweeps on the dedicated server are Phase 13. |
| Assemblies | Added `Veyr.Client.Core` (the engine-free half of `Veyr.Client`) and `Veyr.App` (the composition root, which must see Client and Server). See `ARCHITECTURE.md`. No DECIDED row changed. |
| Packages | Local packages are embedded in `Packages/` and loaded without manifest entries. |
| Scenes | Generated by editor code, never hand-written YAML. `Dev_Move` is the empty movement scene; `Forest_Blockout` is the forest performance test. |

## Earliest incomplete programme tasks

| Task | Status | Blocker |
| --- | --- | --- |
| T002 Unity 6 URP project opens | Written, not opened | Human: open in Unity 6.3 LTS, run Veyrmarch > Setup. |
| T003 Assembly layout | Written; dependency rules enforced in the .NET build | Unity compile. |
| T005 Empty test and Boot | Tests exist; Boot is generated | Unity. |
| T006 Sim clock | **Done** (edit-mode test) | — |
| T007 Boot tick display | Overlay shows the tick; play-mode test written | Unity. |
| T008–T014 Input, joystick, look, move, camera, dodge, Dev_Move, overlay | Written and logic-tested | Unity, then device. |
| T015 Android development build | Batch build entry ready | **Human with Android SDK and phone.** |
| T016 10-minute device note | Script and template ready | **Human with phone. Checkpoint 1.** |

The next legal task is T015/T016 on a real phone. Phase 4 and later Unity work waits for checkpoint 1 unless Charlie waives it in writing (programme Phase 4).
