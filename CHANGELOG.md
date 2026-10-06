# Changelog

## Unreleased

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
