# Unity integration

Not verified. No Unity editor has opened this folder.

The simulation and content live in local packages:

- `Packages/com.veyrmarch.content` — definitions. `noEngineReferences`.
- `Packages/com.veyrmarch.sim` — rules. `noEngineReferences`.

`dotnet test sim/Veyr.Tests.Sim` runs the same test sources Unity's editor test runner should pick up later (`Veyr.Tests.Sim.asmdef`, Edit Mode, Test Assemblies).

Do not add `UnityEngine` to those packages. Client adapters (tick, CharacterController, camera, uGUI) belong in `Assets/_Project/Client` and are not written yet, because they cannot be compiled here.

`ProjectSettings/ProjectVersion.txt` names Unity 6.3 LTS patch `6000.3.25f1`. That pin was not launched. If Hub has a different 6000.3 patch, retarget and commit the file the editor writes.

URP and the Input System are not in `Packages/manifest.json` yet. Add them from Package Manager on first open. Do not invent a second engine.

`Assets/_Project/Input/Veyr.inputactions` names the ten player actions and Touch plus Gamepad schemes. It has not been imported. If the editor rejects a binding path, fix the asset in the editor and commit that file. Do not treat this copy as proof the asset loaded.

`Docs/assets/SLICE_PREFAB_SPEC.md` is the prefab and clip list for the first scenes. No `.unity` scene is in the repo on purpose. An unopened scene file would be a fake.
