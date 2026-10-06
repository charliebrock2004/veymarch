# Technical debt

| Id | Problem | Impact | Why taken | Temporary or permanent | Priority | Suggested fix |
| --- | --- | --- | --- | --- | --- | --- |
| TD-001 | Editor pin and `Packages/manifest.json` were not resolved by Unity 6.3. URP and the Input System are not listed. | First open may retarget the editor and must add URP. | No editor in this environment. | Temporary | P1 | Open in 6000.3 LTS, add URP and Input System, commit the files the editor writes. |
| TD-002 | No client adapters. | Nothing moves on screen. | Adapters reference `UnityEngine` and cannot be compiled here. | Temporary | P1 | Add `Assets/_Project/Client` after the packages compile. |
| TD-003 | Corpse record has no mesh or pickup. | The bag rule and the timed record are tested. A player cannot see or loot the body. | No scene. | Temporary | P2 | When the forest scene exists, spawn `PF_Corpse` from `CorpseMarker` and let interact return the items. |
| TD-005 | Set bonus `bow` is a resolved id only. Move and knight dodge cost are applied. | A bow does not yet gain +2 from the hunter four-piece. | No archery weapon is in the slice attack path. | Temporary | P3 | Apply the bonus in `Attacks.Resolve` when a bow moveset exists. |
| TD-004 | Combat numbers are slice tuning. | Feel is unknown. | The bible does not lock wolf HP or knife damage. | Temporary | P2 | Change catalog data after a device feel pass. Do not rewrite the resolver for a number. |
