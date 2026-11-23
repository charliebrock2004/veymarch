# Architecture pointer

The authority is `Docs/architecture/TECHNICAL_ARCHITECTURE_BIBLE.md` (a copy; see `Docs/SOURCE.md`). This page maps it onto the repository and lists where the code departs from the bible's assembly list.

## Assemblies and dependency direction

```
Veyr.Content        Packages/com.veyrmarch.content     pure C#, definitions
Veyr.Sim            Packages/com.veyrmarch.sim         pure C#, rules and authority
Veyr.Net            Packages/com.veyrmarch.net         pure C#, messages and the endpoint contract
Veyr.Server         Packages/com.veyrmarch.server      pure C# for now: embedded host, snapshots
Veyr.Client.Core    Packages/com.veyrmarch.clientcore  pure C#: input, camera, motor, frame maths
Veyr.Client         Assets/_Project/Code/Client        Unity views and adapters
Veyr.App            Assets/_Project/Code/App           Unity composition root (Boot, session, scene roots)
Veyr.Editor         Assets/_Project/Code/Editor        editor-only setup and scene generation
Veyr.Tests.*        package Tests folders, Assets/Tests/PlayMode
```

Allowed references, one way only:

- Sim → Content.
- Net → Sim.
- Server → Net, Sim.
- Client.Core → Net, Sim.
- Client → Client.Core, Net, Sim, Unity packages. **Client never references Server.**
- App → Client, Server, and everything below. It is the only place where client and authority meet, for offline play.
- Editor → App, Client.

`sim/UnityCheck.*` builds each Unity assembly with exactly its asmdef's references, so a forbidden reference fails the .NET build and CI.

## Departures from the bible's assembly list (§3.1)

| Change | Why | Status |
| --- | --- | --- |
| `Veyr.Client.Core` added | Engine-free half of `Veyr.Client`, so input, camera, and prediction maths are tested without the editor. | In use. |
| `Veyr.App` added | The composition root (§4) must see both client and server for embedded offline play. Putting it in `Veyr.Client` would break "Client may not reference Server". | In use. |
| `Veyr.Server` has `noEngineReferences` | Nothing in the embedded host needs Unity yet. The dedicated process adds Unity physics and NavMesh in Phase 13; flip the flag then. | Temporary. |
| `Veyr.Unity.Content`, `Veyr.Shared.Unity` not created | Content is C# catalog data today; no ScriptableObject authoring yet. Created when the first ScriptableObject authoring tool is needed. | Deferred. |

None of these changes a DECIDED row, so no ADR is open. `Docs/adr/` is empty.

## Runtime shape (offline solo, today)

```
Boot.unity: GameBootstrap ─loads─▶ Dev_Move / Forest_Blockout: SceneRoot
                 │                                   │ binds
                 ▼                                   ▼
          SessionDriver (persistent) ──▶ EmbeddedHost (Veyr.Server) ──▶ WorldSimulation (Veyr.Sim)
                 │ pumps events and snapshots            ▲ intents only, via ISimEndpoint
                 ▼                                       │
          LocalPlayerController, OrbitCameraRig, HUD ────┘
```

The client moves its own CharacterController for zero-latency feel and sends one intent per 20 Hz tick with the position it claims. The sim accepts the claim only within its speed budget, teleport and climb limits, and closed blockers, and the client snaps back when refused. Online play (Phase 13) replaces `EmbeddedHost` behind the same `ISimEndpoint`. The phone is never the online authority.
