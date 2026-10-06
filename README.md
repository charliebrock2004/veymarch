# VEYRMARCH

The Sealed Continent. Unity 6 LTS, URP, is the production engine. This repository is not a web game.

## What runs here

The rules live in `Veyr.Sim` and do not reference Unity. They are tested with the .NET 8 SDK.

```bash
dotnet test sim/Veyr.Tests.Sim/Veyr.Tests.Sim.csproj
dotnet run --project sim/Veyr.Loop/Veyr.Loop.csproj
dotnet run --project sim/Veyr.Check/Veyr.Check.csproj
```

The loop harness wakes a body, gathers flint and wood, crafts one stone knife, kills a wolf, and returns to the pad. `Veyr.Check` audits the catalog and prints a content fingerprint. Neither is a client.

## What does not run here

Unity has not opened this project. There is no phone build, no frame time, and no scene test. See `Assets/_Project/INTEGRATION.md`.

## Authority

1. `Docs/design/MASTER_GAME_DESIGN_BIBLE.md`
2. `Docs/architecture/TECHNICAL_ARCHITECTURE_BIBLE.md`
3. `Docs/programme/CLAUDE_IMPLEMENTATION_PROGRAMME.md`
4. `Docs/ops/MASTER_CLAUDE_BUILD_PROMPT.md`
5. `Docs/art/ART_DIRECTION_BIBLE.md`

`PROJECT_AUDIT.md` records conflicts. Architecture wins on technical matters. The programme wins on order.

## Current phase

Simulation and content for the slice are implemented and covered by automated tests. Unity integration is blocked, not done. Prefab names and the input map are prepared in `Docs/assets/SLICE_PREFAB_SPEC.md` and `Assets/_Project/Input/Veyr.inputactions`.
