# PROJECT_AUDIT

| Field | Value |
| --- | --- |
| Date | 2026-10-06 |
| Repo | [charliebrock2004/veymarch](https://github.com/charliebrock2004/veymarch) |
| Verdict | Rules and slice content exist and are tested with `dotnet test`. Unity has not compiled anything. |

## What exists

- Docs copies of the four bibles and the operating prompt.
- `Packages/com.veyrmarch.content` and `Packages/com.veyrmarch.sim` with `noEngineReferences`.
- `sim/Veyrmarch.sln` so the same sources build on .NET 8.
- 47 passing edit-mode-style tests in `Packages/com.veyrmarch.sim/Tests`.
- `tools/Veyr.Loop`, a console harness. Not a client.
- `ProjectSettings/ProjectVersion.txt` naming 6000.3.25f1. Unlaunched.

## What is not done

T002 is not done. No scene, no URP confirmation, no input asset, no CharacterController, no device build.

## Contradictions

Unchanged from the first audit. Architecture wins on authority, frame budget, tiles, destruction, and grant keys. The programme wins on order.

Recorded while implementing:

| Topic | Choice |
| --- | --- |
| Stone knife station | Hand and Bench both legal |
| Iron node | `seal_cookie` plus Cookie's Pick. Copper pick fails. Programme T059 over the material-table copper row |
| Copper sword cost | 5 copper, 1 wood, 1 flint. Counts are not in the bible |
| Gate | `seal_cookie` opens it. The Core does not re-lock it |

## Next legal task

Open the project in Unity 6.3 LTS. If the packages compile, mark T002 and add client adapters. Do not claim a phone result from the editor.
