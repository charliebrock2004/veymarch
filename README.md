# VEYRMARCH

The Sealed Continent. A third-person medieval fantasy action RPG for iOS and Android, built in Unity 6 (URP).

## Where the project is

**Programme Phase 2, waiting on checkpoint 1: movement on a real phone.**

The simulation, the offline authority, and the client logic are built and tested: 134 tests on .NET 8. The Unity project (client adapters, Boot composition root, editor setup, and a scene generator) is written and type-checked, but **has never been opened in Unity**. The next step needs a person with Unity 6.3 LTS and an Android phone: [`Docs/device/PHASE3.md`](Docs/device/PHASE3.md).

See [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) for what is verified, [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) for what is not, and [`DEVELOPMENT_LOG.md`](DEVELOPMENT_LOG.md) for the history.

## Open it in Unity

1. Unity Hub → Add project from disk → this folder. Use Unity **6000.3.x**.
2. Menu **Veyrmarch → Setup → Run All Setup Steps**, then restart the editor once.
3. Menu **Veyrmarch → Validate Project** should report `clean`.
4. Open `Assets/_Project/Scenes/Boot.unity` and press Play: WASD, Shift sprint, Space jump, K dodge, right-mouse look. On a phone, use the on-screen controls.

## Run the tests without Unity

Needs the .NET 8 SDK.

```bash
dotnet test sim/Veyrmarch.sln     # sim, server host, client core: 134 tests
dotnet build sim/Veyrmarch.sln    # also type-checks the Unity code (see below)
dotnet run --project sim/Veyr.Check   # content audit
dotnet run --project sim/Veyr.Loop    # gather, craft, wolf loop in the sim
```

The libraries Unity shares with the tests build as `netstandard2.1` with C# 9, Unity 6's limits. The Unity-side assemblies build against hand-written declarations of the Unity API (`tools/unity-api-stubs`), with each assembly's references copied from its asmdef. That catches type errors and forbidden references, such as the client reaching into the server. It is not a Unity compile.

## Layout

| Path | What |
| --- | --- |
| `Packages/com.veyrmarch.content` | Item, recipe, actor, boss, region definitions (pure C#) |
| `Packages/com.veyrmarch.sim` | Authoritative rules and the 20 Hz world step (pure C#) |
| `Packages/com.veyrmarch.net` | Intent and snapshot contract |
| `Packages/com.veyrmarch.server` | Embedded offline authority |
| `Packages/com.veyrmarch.clientcore` | Engine-free client logic: touch, camera, prediction, frame stats, quality tiers |
| `Assets/_Project/Code` | Unity: `Client` (views and adapters), `App` (composition root), `Editor` (setup and scene generator) |
| `Assets/Tests/PlayMode` | Play-mode smoke tests |
| `sim/` | .NET solution: tests and compile checks |
| `web/` | The earlier browser prototype. A behavioural reference, not the product. |
| `Docs/` | Copies of the bibles, the device script, asset spec |

Architecture map: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## The browser prototype

`web/` is a Three.js build from a previous session that plays the Cookie slice in a browser. It re-implements the rules in TypeScript and is kept only as a reference for intended behaviour. Unity is the production target.

```bash
cd web && npm ci && npm run dev
```

## Authority

1. `Docs/design/MASTER_GAME_DESIGN_BIBLE.md`: what the game is
2. `Docs/architecture/TECHNICAL_ARCHITECTURE_BIBLE.md`: how it is built; wins on technical conflicts
3. `Docs/programme/CLAUDE_IMPLEMENTATION_PROGRAMME.md`: order and gates
4. `Docs/ops/MASTER_CLAUDE_BUILD_PROMPT.md`: how the implementing agent works
5. `Docs/art/ART_DIRECTION_BIBLE.md`: look and feel
