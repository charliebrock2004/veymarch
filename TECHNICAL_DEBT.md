# Technical debt

| Id | Problem | Impact | Why taken | Temporary or permanent | Priority | Suggested fix |
| --- | --- | --- | --- | --- | --- | --- |
| TD-001 | Editor pin and `Packages/manifest.json` were not resolved by Unity 6.3. URP and the Input System are not listed. | First open may retarget the editor and must add URP. | No editor in this environment. | Temporary | P1 | Open in 6000.3 LTS, add URP and Input System, commit the files the editor writes. |
| TD-002 | No client adapters. | Nothing moves on screen. | Adapters reference `UnityEngine` and cannot be compiled here. | Temporary | P1 | Add `Assets/_Project/Client` after the packages compile. |
| TD-003 | Corpse is a bag rule, not an entity. | Survival death does not leave a timed body in the world. | Needs a scene later. The keep/drop rule is tested. | Temporary | P2 | Spawn a corpse record with a 20 minute lifetime when the world has positions that matter. |
| TD-004 | Combat numbers are slice tuning. | Feel is unknown. | The bible does not lock wolf HP or knife damage. | Temporary | P2 | Change catalog data after a device feel pass. Do not rewrite the resolver for a number. |
