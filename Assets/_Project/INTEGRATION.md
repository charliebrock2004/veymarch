# Unity integration

**Status: written, type-checked, never opened in Unity.** Follow `Docs/device/PHASE3.md` for the first open, setup, and the phone checkpoint.

## On first open

1. Open the repository folder with Unity 6.3 LTS (6000.3.x). Accept a different 6000.3 patch if the Hub offers one.
2. Answer **Yes** if asked to enable the new input backends.
3. Run **Veyrmarch → Setup → Run All Setup Steps**, then restart the editor once.
4. Run **Veyrmarch → Validate Project**. It should say `clean`.
5. Run every EditMode and PlayMode test in the Test Runner.
6. Commit the `.meta` files and everything the setup generated.

## Where things are

| What | Path |
| --- | --- |
| Rules (pure C#, no `UnityEngine`) | `Packages/com.veyrmarch.sim`, `com.veyrmarch.content` |
| Net contract, embedded host, client core (pure C#) | `Packages/com.veyrmarch.net`, `com.veyrmarch.server`, `com.veyrmarch.clientcore` |
| Unity views and adapters | `Assets/_Project/Code/Client` (`Veyr.Client`) |
| Composition root | `Assets/_Project/Code/App` (`Veyr.App`) |
| Editor setup and scene generator | `Assets/_Project/Code/Editor` (`Veyr.Editor`) |
| Input map | `Assets/_Project/Input/Veyr.inputactions` |
| Generated after setup | `Assets/_Project/Scenes`, `Prefabs`, `Settings/Rendering`, `Art/Materials`, `Generated/<scene>` |
| Play-mode tests | `Assets/Tests/PlayMode` |

## Rules for changing this layer

- Rules live in `Veyr.Sim`. A MonoBehaviour reads snapshots and events and sends intents. It never sets health, items, seals, or damage.
- `Veyr.Client` must not reference `Veyr.Server`. Only `Veyr.App` sees both.
- Do not add `UnityEngine` to the packages under `Packages/com.veyrmarch.*`. The .NET build fails if you do.
- One MonoBehaviour or ScriptableObject per file, file named after the class. Unity cannot bind a component otherwise.
- Do not hand-edit generated scenes for structural changes. Change `SceneBuilder` and regenerate, so the next region is built the same way.
- `tools/unity-api-stubs` declares the Unity API these files use, so CI can type-check them. If you use a new Unity member, declare it there with Unity's real signature. If Unity disagrees with the stub, Unity is right: fix both.
