# VEYRMARCH
## Claude Implementation Programme
### Build order and operating rules. Not code.

| Field | Value |
| --- | --- |
| Game | VEYRMARCH — The Sealed Continent |
| Creative truth | `MASTER_GAME_DESIGN_BIBLE.md` |
| Engineering truth | `TECHNICAL_ARCHITECTURE_BIBLE.md` |
| This document | What to build, in what order, and when to stop |
| Engine | Unity 6 / 6000.x LTS, URP |
| First proof | A capsule on a phone inside 33 ms, then a wolf, then Cookie |

This programme does not modify either bible. It does not claim any system is implemented.

---

# 0. Source of truth and conflict register

Hierarchy:

1. `MASTER_GAME_DESIGN_BIBLE.md` — creative and gameplay truth.
2. `TECHNICAL_ARCHITECTURE_BIBLE.md` — engineering truth. Wins on technical conflicts.
3. `CLAUDE_IMPLEMENTATION_PROGRAMME.md` — order, gates, and session rules.
4. Code — current implementation. If code disagrees with 1–3, the code is wrong until an ADR says otherwise.

If Claude finds a better solution: stop, write `Docs/adr/ADR-XXX.md`, propose, wait. Do not silently redesign.

## Conflicts already resolved

| Topic | Design bible | Architecture bible | Programme follows |
| --- | --- | --- | --- |
| Who is authority | Listen-server on the phone, dedicated later | Embedded sim offline, dedicated process online. Phone is never authority. | Architecture. C1. |
| Frame budget | "< 150 ms GPU at 30 fps" | 33.3 ms total frame at 30 fps | Architecture. The 150 ms figure is withdrawn. |
| World representation | 4 km, 64 m chunks | 128 m terrain tiles, 64 m object chunks, region packs | Architecture. |
| Destruction | Partial destruction | Damage states, support graph, TTL magic props. No terrain deformation. | Architecture. Experience preserved. |
| Net stack | NGO, revisit FishNet if feel fails | NGO pending a combat spike | Architecture. Spike is a hard gate before Cookie content is locked. |
| Boss weapons | Guaranteed | Soulbound. Picks may be stashed. Unique grant row. | Architecture. |
| Multiplayer timing | In the slice description | Solo device slice first. Co-op after Cookie is fun. Sim API shaped like a server from Phase 4. | Both. Authority shape early. Network playtest late. |
| Vercel | Site and portal, not sim | Same | Do not deploy a game server to Vercel. |

Offline solo on an embedded server is the approved path for the first device build. Cloud accounts are not required to beat Cookie locally.

---

# 1. Development philosophy

- Build from the inside out: player, world, loop, combat, dungeon, Cookie, progression, multiplayer playtest, persistence proof, building, settlements, regions, polish.
- A compiling project is not a working game.
- One bounded milestone per session. Stop at the exit.
- No future system before the current proof. No continent before the gate. No shop. No Kubernetes. No ECS gameplay.
- Rules live in `Veyr.Sim`. Views are adapters. No god manager.
- Do not delete working behaviour to make a new task easier.
- Do not leave a placeholder and call it done.
- Measure frame time, memory, and save integrity. Do not guess.
- Multiplayer authority is in the sim from the first inventory. Remote clients come after the solo slice.
- Persistence is proven on local files before large content, and on a kill-mid-write before cloud.
- Mobile hardware is a gate, not a finale.
- Content is data on a stable machine. Cookie is the machine's first content pack.

---

# 2. Claude operating contract

Before any milestone Claude will:

1. Read both bibles and this programme.
2. Inspect the repo. Do not assume it matches the docs.
3. Read `DEVELOPMENT_LOG.md` and `KNOWN_ISSUES.md` if they exist.
4. Work on one task id.
5. Keep rules out of MonoBehaviours.
6. Run the tests that task names.
7. Compile. Editor console must have no new errors.
8. Verify the scene or prefab named in the task actually loads.
9. Where the task says network or save, test that path.
10. Where the task says device, do not mark it done from the editor.
11. Commit one coherent change. No "massive implementation" commit.
12. Update the log, known issues, and changelog line.
13. Stop. Report with the template in §38.
14. Never claim success without the gates that task requires.

Forbidden: building the whole game in one operation, disabling tests to go green, client-authoritative loot, a player-hosted online world, a 4 km terrain, a silent architecture change.

---

# 3. Repository inspection

First implementation session produces `PROJECT_AUDIT.md` before feature code.

Audit:

- File tree, Git history, Unity version, `Packages/manifest.json`, `ProjectSettings/`
- Scenes, scripts, prefabs, tests, build scenes, iOS/Android settings
- Any backend, env files, docs
- Whether assemblies named in the architecture exist

If the repo is empty or has no Unity project: initialise to the architecture layout. Do not import asset-store packs. Do not create region scenes.

`PROJECT_AUDIT.md` ends with: match, gap, or contradiction against the architecture, and the next legal task.

---

# 4. Master development phases

Order is the architecture order, not the sample list in the brief. Remote multiplayer is after the device slice. The sim is authoritative before inventory exists.

| Phase | Name | Proof |
| --- | --- | --- |
| 0 | Audit and foundation | Repo matches the assembly plan. Tests run. |
| 1 | Bootstrap and sim tick | Boot scene, 20 Hz tick, no errors. |
| 2 | Body, camera, touch | Capsule moves and looks on device. |
| 3 | First mobile build | 20 min editor-equivalent scene on a phone, frame overlay. |
| 4 | Embedded authority | Speed hack rejected. Intents only. |
| 5 | Interact, inventory, gather, craft | Stone knife exists because the sim said so. |
| 6 | First playable loop | Wake, gather, craft, wolf dies, return to village pad. |
| 7 | Combat spike | Parry notes at artificial latency. Hit rewind stub. |
| 8 | Hearthfen and Tanic | Schedules, talk, day cycle. |
| 9 | Dungeon subscene | Enter, rooms, leave, overworld unloads. |
| 10 | Cookie | Three phases, kill, rewards. |
| 11 | Seal, gate, local save | Gate blocks, then opens. Kill mid-write recovers. |
| 12 | True vertical slice | Device session recorded. Stop for human. |
| 13 | Dedicated process, 2 players | Join, fight, loot, disconnect. |
| 14 | 3–4 players and bad networks | Caps hold. Finster-style circles not required yet. |
| 15 | Accounts and cloud snapshot | Optional. Needs human vendor approval. |
| 16 | Camp building | Bedroll, fire, bench. Server validated. |
| 17 | Magic cantrip | One spell, server cast, TTL prop cap. |
| 18 | Boe and Kingdom edge content | Second boss on the same machine. Iron loop starts. |
| 19 | Settlements | Camp → village only. Not a city. |
| 20 | Region packs | One region at a time, after the previous seal is fun. |
| 21 | Remaining bosses | Data on the Cookie machine. |
| 22 | World events | One event type, then more. |
| 23 | Optimisation | Measured, not guessed. |
| 24 | Polish and release candidate | Store builds. No new pillars. |

---

# 5. Phase specifications

## Phase 0 — Audit and foundation

- Objective: a Unity 6 URP project whose folders and assemblies match the architecture, with an empty test assembly that passes.
- Player experience: none.
- Systems: repo layout, asmdefs, Git ignore, LFS tracking for binary types, `Docs/` stubs.
- Required before start: Unity 6 LTS available.
- Files: `Assets/_Project/`, `Assets/Tests/`, `Packages/manifest.json`, `ProjectSettings/`, `.gitignore`, `.gitattributes`, `Docs/`.
- Scenes: `Boot.unity` empty.
- Prefabs: none.
- Data: none.
- Services: none.
- Networking: none.
- Persistence: none.
- Mobile: IL2CPP/ARM64 noted, not built yet.
- Tests: one edit-mode test that asserts true.
- Performance: boot scene opens.
- Acceptance: audit written. No `Resources/` dump. Asmdefs have no cycles.
- Done: Gate A–C, J. Commit.
- Risks: wrong Unity version. Stop if not 6000.x.
- Next: Phase 1.

## Phase 1 — Bootstrap and sim tick

- Objective: composition root and a 20 Hz `WorldSimulation` with no Unity reference in `Veyr.Sim`.
- Player experience: boot to a debug screen with tick count.
- Systems: `SessionContext`, sim clock.
- Required: Phase 0.
- Files: `Veyr.Sim`, `Veyr.Client` boot adapter.
- Scenes: Boot.
- Prefabs: none.
- Data: none.
- Services: in-process sim host stub.
- Networking: none.
- Persistence: none.
- Mobile: not required this phase.
- Tests: tick advances 20 steps in 1 simulated second.
- Performance: no per-tick alloc in the empty sim. Test can count allocations later.
- Acceptance: domain reload does not duplicate the tick.
- Done: A–D.
- Risks: sim accidentally references `UnityEngine`.
- Next: Phase 2.

## Phase 2 — Body, camera, touch

- Objective: third-person orbit, joystick, look drag, jump, sprint, dodge input (dodge may not i-frame yet).
- Player experience: walk a grey blockout.
- Systems: input actions `Touch`, CharacterController adapter, camera collision.
- Required: Phase 1.
- Files: `Input/Veyr.inputactions`, player prefab, camera rig.
- Scenes: `Dev_Move.unity`.
- Prefabs: `PF_Player`, `PF_CameraRig`.
- Data: move speeds in a def, not magic numbers in Update.
- Services: none.
- Networking: input produces `PlayerIntent`, not direct transform authority in gameplay code.
- Persistence: none.
- Mobile: safe area on debug HUD.
- Tests: intent mapping edit-mode. Play-mode: player moves when intent injected.
- Performance: no GC alloc in move loop after warmup.
- Acceptance: camera does not enter the capsule. Dodge is a button or flick, both mapped.
- Done: A–E.
- Risks: Rigidbody instead of CharacterController. Do not.
- Next: Phase 3.

## Phase 3 — First mobile build

- Objective: Android development build on a real device. iOS if signing exists. Editor does not count.
- Player experience: walk the blockout on a phone for 10 minutes.
- Systems: frame-time overlay, quality tier Low/Medium.
- Required: Phase 2. Android SDK. iOS signing is optional and human-owned.
- Files: build scenes list, overlay.
- Scenes: Dev_Move.
- Prefabs: existing.
- Data: quality tiers.
- Services: none.
- Networking: none.
- Persistence: none.
- Mobile: this is the phase.
- Tests: manual script in `Docs/device/PHASE3.md` filled in.
- Performance: median frame ≤ 33 ms on the mid device in an empty scene. If not, stop.
- Acceptance: overlay screenshot or log attached to the dev log.
- Done: A, B, E, H, I.
- Risks: signing. Android is enough to pass. iOS is a known gap until Charlie signs.
- Next: Phase 4.

## Phase 4 — Embedded authority

- Objective: movement is an intent the sim accepts or rejects. A speed above cap does not stick.
- Player experience: same walk, now corrected.
- Systems: sim movement, rejection event.
- Required: Phase 3 passed or explicitly waived in writing by Charlie. Default is not waived.
- Files: `Veyr.Sim` movement, server adapter.
- Scenes: Dev_Move.
- Prefabs: player gains a network-ready component stub, unused remotely.
- Data: speed cap def.
- Services: embedded `WorldSimulation`.
- Networking: message types defined. No Relay.
- Persistence: none.
- Mobile: still runs on device.
- Tests: forged speed intent rejected.
- Performance: tick still 20 Hz.
- Acceptance: client cannot set position by writing a field the sim ignores.
- Done: A–E.
- Risks: prediction feels bad. Cosmetic prediction allowed. Authority stays server.
- Next: Phase 5.

## Phase 5 — Interact, inventory, gather, craft

- Objective: flint, wood, stone become a knife via a transaction.
- Player experience: pick up, open a simple grid, craft at a bench.
- Systems: inventory, item defs, stations, gather nodes.
- Required: Phase 4.
- Files: `Content/Items`, `Veyr.Sim` inventory and craft.
- Scenes: `Dev_Loop.unity`.
- Prefabs: node, bench, dropped item.
- Data: stone knife recipe.
- Services: none.
- Networking: craft is a sim transaction even offline.
- Persistence: not yet, but item ids exist.
- Mobile: one inventory screen, context interact.
- Tests: craft consumes inputs. Double-submit does not create two knives.
- Performance: no per-frame inventory scan.
- Acceptance: fists cannot craft the knife without materials.
- Done: A–E, G for the transaction test.
- Risks: ScriptableObject used as the live inventory. Forbidden.
- Next: Phase 6.

## Phase 6 — First playable loop

- Objective: the early fantasy in one scene. Not Cookie.
- Player experience: launch, skip full creator (debug body), wake on a village pad, move, gather, craft knife, kill or be killed by a wolf using a stub hit, return.
- Systems: wolf with server health, equip knife, respawn at pad.
- Required: Phase 5.
- Files: wolf prefab, pad spawn.
- Scenes: Dev_Loop promoted toward Forest blockout.
- Prefabs: wolf, pad.
- Data: wolf def, knife damage.
- Services: none.
- Networking: still embedded.
- Persistence: position not required yet.
- Mobile: playable on device, 10 min.
- Tests: wolf dies from knife hits. Fists are weaker.
- Performance: 30 fps in the blockout with 1 wolf.
- Acceptance: a person who has not read the code can do the loop.
- Done: A–E, H.
- Risks: tutorial popups. Do not add a popup stack.
- Next: Phase 7.

## Phase 7 — Combat spike

- Objective: light, heavy, dodge i-frames, block, parry window, hit rewind buffer, one goblin.
- Player experience: fights feel committed. Notes on 150 ms artificial delay.
- Systems: combat resolver in sim, hurtbox history.
- Required: Phase 6.
- Files: combat defs, weapon moveset.
- Scenes: `Dev_Combat.unity`.
- Prefabs: goblin.
- Data: stamina costs.
- Services: none.
- Networking: delay injection in dev.
- Persistence: none.
- Mobile: hit readability at Low.
- Tests: parry window math. Range slack rejection. Stamina reject.
- Performance: hitstop allowed. No particle-only tells.
- Acceptance: written spike note in `Docs/adr/` or `Docs/combat/SPIKE.md`. If parry is unacceptable, stop and propose FishNet. Do not start Cookie content lock.
- Done: A–E plus spike note.
- Risks: this can overturn NGO. That is a human gate.
- Next: Phase 8 if spike says continue.

## Phase 8 — Hearthfen and Tanic

- Objective: 6 puppet villagers, Tanic route, talk, day cycle 24 real minutes.
- Player experience: village feels occupied. Tanic gives practical lines only.
- Systems: schedule table, dialogue keys, time of day.
- Required: Phase 7 continue decision.
- Files: dialogue table, NPC prefabs.
- Scenes: `Region_Forest` blockout with Hearthfen pads.
- Prefabs: Tanic, villager puppet.
- Data: schedule, line keys.
- Services: none.
- Networking: Tanic state is sim state.
- Persistence: none yet.
- Mobile: full-sim NPC cap enforced at 12 even if only 6 exist.
- Tests: Tanic is at the smith lane at the scripted hour.
- Performance: puppets beyond 60 m.
- Acceptance: no quest arrow.
- Done: A–E.
- Risks: unique AI script per villager. Use one schedule runner.
- Next: Phase 9.

## Phase 9 — Dungeon subscene

- Objective: Cookie castle entrance loads a subscene, overworld unloads to a stub, exit returns.
- Player experience: fade under 3 s in editor. Rooms exist. One trap with a mesh tell. One weight or bell puzzle. One mini-boss or elite.
- Systems: dungeon flow, seed stored in memory.
- Required: Phase 8.
- Files: dungeon scene, room prefabs.
- Scenes: `Dungeon_Cookie`.
- Prefabs: trap, chest.
- Data: room list. Slice can be hand-placed first. Generator after the hand-placed one works.
- Services: none.
- Networking: seed field ready for world save.
- Persistence: not required to disk yet.
- Mobile: memory note before and after load.
- Tests: enter and exit does not duplicate the player.
- Performance: resident does not grow without bound on repeat enter.
- Acceptance: layout is the same on second enter in the session.
- Done: A–E.
- Risks: leaving the overworld loaded. Do not.
- Next: Phase 10.

## Phase 10 — Cookie

- Objective: boss machine plus Cookie content. Three phases. Kill grants items in sim memory.
- Player experience: bow, then dangerous, then music-box phase. Fire weakness if fire exists; otherwise a documented melee stagger weakness is acceptable until Phase 17, and the design weakness is a content flag not a blocker.
- Systems: `BossController` states Idle, Intro, Phase, Transition, Dead, Reset.
- Required: Phase 9. Spike continue.
- Files: boss def, arena.
- Scenes: arena inside dungeon.
- Prefabs: Cookie, toy add.
- Data: phase table, loot table ids.
- Services: none.
- Networking: phase replicated as data even in embedded mode.
- Persistence: grant key in memory.
- Mobile: tells readable with particles off.
- Tests: wipe resets phase. Second kill does not mint a second grant key in memory.
- Performance: add cap.
- Acceptance: defeat is possible with the copper or stone kit the slice allows. Design says Cookie’s pick is the drop, not a craft.
- Done: A–E.
- Risks: comic phase too long. Cap phase 1 at 20 s of waddle.
- Next: Phase 11.

## Phase 11 — Seal, gate, local save

- Objective: Core opens the Green Gate. Transactional local save. Unique grant survives restart.
- Player experience: blocked bridge, kill Cookie, gate opens, Kingdom vista, reload, still open, still holding the blade.
- Systems: world seals, local snapshot, birth keys.
- Required: Phase 10.
- Files: save writer, gate prefab, vista.
- Scenes: forest edge.
- Prefabs: gate.
- Data: `seal_cookie`.
- Services: local persistence.
- Networking: seal is world data.
- Persistence: this phase.
- Mobile: save works after app kill.
- Tests: kill process mid-write loads previous or completed file, never a torn file. Double grant returns same id.
- Performance: save hitch < 200 ms on device.
- Acceptance: Adventure rules. Durability off.
- Done: A–E, G, H.
- Risks: one giant save object. Forbidden. Character and world files are separate.
- Next: Phase 12.

## Phase 12 — True vertical slice

- Objective: the loop in §9 of this programme on a phone for 20 minutes at about 30 fps.
- Player experience: a short game, not a tech demo.
- Systems: menu stub, reduced creator, world create local, Adventure.
- Required: Phase 11.
- Files: menu scene, device report.
- Scenes: Boot, Forest, Dungeon_Cookie.
- Prefabs: as built.
- Data: content manifest hash.
- Services: local only.
- Networking: still embedded.
- Persistence: required.
- Mobile: required.
- Tests: fresh character reaches the gate without a softlock. Checklist signed in the log.
- Performance: Medium resident warning 1.2 GB. Frame median ≤ 33 ms in village. Spikes logged, not ignored.
- Acceptance: human watches or receives the device report before Phase 13.
- Done: all gates that apply. Stop.
- Risks: calling it done from the editor.
- Next: Phase 13 only after Charlie accepts the slice note.

## Phase 13 — Dedicated process, 2 players

- Objective: headless or second-editor server. Two clients. Phone is not the server.
- Player experience: a friend joins the forest, sees the gate state, does not receive Cookie’s Blade if they missed the kill.
- Systems: NGO, Unity Transport, world lock local-only is fine. Relay optional.
- Required: Phase 12 accepted. Spike still says NGO.
- Files: `Veyr.Server`, `Veyr.Net`.
- Scenes: server boot.
- Prefabs: network player.
- Data: protocol version.
- Services: one server process.
- Networking: this phase.
- Persistence: server writes the same local schema.
- Mobile: one phone client plus editor is enough to start. Two phones before Phase 14 closes.
- Tests: join, leave, rejoin 90 s, loot race, host process kill.
- Performance: uplink note.
- Acceptance: forged `GrantItem` RPC does not exist or is ignored.
- Done: A–G.
- Risks: listen-server shortcut. Reject the PR.
- Next: Phase 14.

## Phase 14 — 3–4 players and bad networks

- Objective: caps, interest management, artificial loss and latency.
- Player experience: four clients in the forest do not sim four regions.
- Systems: relevancy, regroup warning.
- Required: Phase 13.
- Files: interest manager.
- Scenes: existing.
- Prefabs: existing.
- Data: radii from the architecture.
- Services: none new.
- Networking: loss 5%, RTT 150 ms profiles.
- Persistence: disconnect during loot.
- Mobile: bandwidth log.
- Tests: listed in §11 and §22.
- Performance: server tick < 50 ms at 4 players in one region.
- Acceptance: personal circles are not required until Finster. Shared aggro is.
- Done: A–G.
- Risks: bandwidth blow-up. Drop send rate in explore.
- Next: Phase 15 or 16. Building may proceed in parallel only if it does not fork the sim. Default is serial: 16 after 14.

## Phase 15 — Accounts and cloud snapshot

- Objective: guest token, refresh, snapshot upload. Vendor must be approved.
- Player experience: reinstall with link restores a character. Guest-only loss is explained in UI.
- Systems: API, Postgres, object storage. Not in the slice critical path.
- Required: human approval of vendor and cost.
- Files: `server-api/` or equivalent, not inside the Unity sim.
- Scenes: none.
- Prefabs: none.
- Data: schema version.
- Services: API, DB, bucket.
- Networking: HTTPS for meta, game port for sim.
- Persistence: cloud.
- Mobile: keychain refresh token.
- Tests: duplicate birth key at API. World lock.
- Performance: cold start < 20 s.
- Acceptance: Vercel is not in the sim path.
- Done: A–G plus a staging env.
- Risks: cost. Stop if the chosen host has no sleep-on-empty story.
- Next: Phase 16 if not already done.

## Phase 16 — Camp building

- Objective: bedroll, fire, bench. Server validates cost and overlap.
- Player experience: place a camp, relog, it remains.
- Systems: piece graph, permissions stub (owner).
- Required: Phase 11 minimum. Co-op rules if Phase 13 exists.
- Files: piece defs.
- Scenes: forest plot.
- Prefabs: three pieces.
- Data: caps.
- Services: none.
- Networking: `TryPlace` only.
- Persistence: pieces in world snapshot.
- Mobile: ghost preview, snap, undo 10.
- Tests: place without materials fails. Two clients cannot overlap-write.
- Performance: piece cap.
- Acceptance: no terrain reshape.
- Done: A–G.
- Risks: physics collapse. Do not build it.
- Next: Phase 17.

## Phase 17 — Magic cantrip

- Objective: Ember or equivalent. Mana, server cast, VFX local, TTL fire patch cap 8.
- Player experience: one spell slot. Cookie weakness becomes real.
- Systems: spell def, effect entity.
- Required: combat machine.
- Files: spell def.
- Scenes: combat dev.
- Prefabs: vfx.
- Data: school enum.
- Services: none.
- Networking: cast intent, confirm event.
- Persistence: known spells on character.
- Mobile: no 12-button bar.
- Tests: cooldown and cost. Client cannot set mana.
- Performance: VFX culled on Low.
- Acceptance: environmental effect expires and is not in the save.
- Done: A–E.
- Risks: second engine for spells. Reject.
- Next: Phase 18.

## Phase 18 — Boe and Kingdom start

- Objective: Boe on the boss machine. Iron nodes legal after Cookie’s pick. Kingdom vista becomes a walkable edge, not the whole region.
- Player experience: optional dog fight, Smacko, bridge you can cross.
- Systems: none new if the machine holds.
- Required: Phase 12. Co-op nice-to-have.
- Files: Boe content, iron node def.
- Scenes: kennel dungeon, kingdom edge tile.
- Prefabs: Boe.
- Data: loot, no seal.
- Services: none.
- Networking: same grant rules.
- Persistence: Boe optional kill flag on character or world. **DECIDED here:** Boe defeat is world-visible (he is gone) and Smacko is personal.
- Mobile: dog readable at Low.
- Tests: Boe does not set `seal_cookie` or open a new seal.
- Performance: dungeon budget.
- Acceptance: critical path still Cookie → gate without Boe.
- Done: A–E, G.
- Risks: photo-real private dog reference. Stop for Charlie if assets require a private photo.
- Next: Phase 19 or first kingdom package.

## Phase 19 — Settlements

- Objective: camp to village. Happiness ledger. No city.
- Player experience: beds, well, palisade, one farmer arrives from data.
- Systems: settlement ledger, raid not required yet.
- Required: Phase 16.
- Files: settlement defs.
- Scenes: plot.
- Prefabs: well, bed.
- Data: tier table from the design bible.
- Services: none.
- Networking: ledger is world state.
- Persistence: world snapshot.
- Mobile: NPC cap.
- Tests: missing food does not spawn the farmer.
- Performance: abstract band for off-screen.
- Acceptance: Hearthfen is not replaced by the player village.
- Done: A–E, G.
- Risks: full social sim. Reject.
- Next: Phase 20.

## Phase 20 — Region packs

- Objective: one region package at a time, starting with Kingdom through Black Knight.
- Player experience: new verb, new ore, new boss, new gate.
- Systems: addressable group per region. Remote catalog only when the build size demands it. Human approves CDN.
- Required: slice accepted, boss machine stable.
- Files: `Content/Regions/<name>`.
- Scenes: region tiles.
- Prefabs: kit.
- Data: seal row.
- Services: none.
- Networking: same.
- Persistence: migration if schema changes.
- Mobile: tile budgets. Horizon impostor for the next region.
- Tests: previous seal still loads.
- Performance: device pass per region before the next starts.
- Acceptance: not a palette swap. The region’s unique mechanic exists (law, knee-water, naming, wind, light lanes, sinking tiles, breath, vertical, rite).
- Done: region checklist.
- Risks: building all ten. Forbidden.
- Next: next region or Phase 21 for that region’s boss.

## Phase 21 — Remaining bosses

- Objective: each Warden is content on the Cookie machine.
- Player experience: as the design bible.
- Systems: only if a verb cannot be expressed in data. That is an ADR.
- Required: Phase 20 for that region.
- Files: boss def, arena, loot.
- Scenes: arena.
- Prefabs: boss.
- Data: phases.
- Services: none.
- Networking: HP +40% per extra player. Personal grant.
- Persistence: seal immediate.
- Mobile: mesh tell.
- Tests: wipe, grant, co-op grant set.
- Performance: arena-local.
- Acceptance: pipeline in §15.
- Done: per boss.
- Risks: Finster rite latency. Test at 150 ms before calling it done.
- Next: Phase 22 when two regions exist.

## Phase 22 — World events

- Objective: one event (bandit raid or blood moon) with a telegraph ≥ 1 min.
- Player experience: the village reacts.
- Systems: scheduler, cap one major event per game day.
- Required: settlement or Hearthfen flags.
- Files: event def.
- Scenes: existing.
- Prefabs: raider.
- Data: table.
- Services: none.
- Networking: world flag.
- Persistence: event state.
- Mobile: spawn budget inside AI cap.
- Tests: two events do not stack.
- Performance: AI cap holds.
- Acceptance: reward does not skip a tier.
- Done: A–E.
- Risks: radiant quest board. Do not add one.
- Next: Phase 23 when content is in.

## Phase 23 — Optimisation

- Objective: hit budgets in the architecture table on the device matrix.
- Player experience: same game, stable frames.
- Systems: LOD, instancing, quality ladder, thermal step-down.
- Required: a representative build.
- Files: quality assets, overlays.
- Scenes: forest and worst dungeon.
- Prefabs: LOD variants.
- Data: tier table.
- Services: none.
- Networking: bandwidth pass if co-op exists.
- Persistence: save hitch recheck.
- Mobile: required.
- Tests: before/after frame log.
- Performance: this phase.
- Acceptance: no tell removed. If a particle was the tell, add a mesh.
- Done: I plus device matrix note.
- Risks: optimising editor FPS. Reject.
- Next: Phase 24.

## Phase 24 — Polish and release candidate

- Objective: store builds, crash reporting, opt-out analytics, migration from previous slice saves.
- Player experience: menu music, creator, settings, subtitles.
- Systems: Sentry or Cloud Diagnostics, analytics wrapper.
- Required: human approval for any paid SDK and for analytics fields.
- Files: store config, changelog.
- Scenes: final boot.
- Prefabs: UI pass.
- Data: localisation keys.
- Services: crash, analytics.
- Networking: version gate.
- Persistence: migration test.
- Mobile: release build, not development build.
- Tests: upgrade from last beta save.
- Performance: release numbers, not dev.
- Acceptance: no critical P0. Known P1 listed.
- Done: release checklist.
- Risks: silent stat change. Forbidden without content version.
- Next: launch process owned by Charlie, not by an agent.

---

# 6. Micro-milestones

Phases are too big to implement in one sitting. Sessions implement micro-milestones. Each must be verifiable alone.

- 0.1 Audit. 0.2 Asmdefs. 0.3 Ignore and LFS. 0.4 Empty test. 0.5 Boot scene opens.
- 1.1 Sim clock test. 1.2 Boot shows tick. 1.3 No duplicate tick on reload.
- 2.1 Input actions. 2.2 Joystick. 2.3 Look. 2.4 Jump. 2.5 Sprint. 2.6 Dodge input. 2.7 Camera orbit. 2.8 Camera collision. 2.9 Player prefab. 2.10 Safe area.
- 3.1 Android build. 3.2 Overlay. 3.3 10 min device note.
- 4.1 Intent struct. 4.2 Sim accepts move. 4.3 Rejects speed. 4.4 Correction applied.
- 5.1 Item def. 5.2 Inventory add/remove. 5.3 Node gather. 5.4 Recipe. 5.5 Bench range check. 5.6 Double-submit test.
- 6.1 Spawn pad. 6.2 Wolf health. 6.3 Knife equip. 6.4 Loop checklist.
- 7.1 Light attack. 7.2 Heavy. 7.3 Dodge i-frame. 7.4 Block. 7.5 Parry math. 7.6 Rewind buffer. 7.7 Goblin. 7.8 Latency note.
- 8.1 Clock. 8.2 Puppet schedule. 8.3 Tanic route. 8.4 Dialogue keys. 8.5 Six villagers.
- 9.1 Load subscene. 9.2 Unload overworld. 9.3 Trap. 9.4 Puzzle. 9.5 Elite. 9.6 Exit.
- 10.1 State machine. 10.2 Phase 1. 10.3 Phase 2. 10.4 Phase 3. 10.5 Adds. 10.6 Grant in memory. 10.7 Wipe reset.
- 11.1 World file. 11.2 Character file. 11.3 Atomic write. 11.4 Gate collider. 11.5 Seal set. 11.6 Reload. 11.7 App kill.
- 12.1 Menu. 12.2 Reduced creator. 12.3 World create. 12.4 Fresh run. 12.5 Device 20 min. 12.6 Stop report.
- 13.1 Server build. 13.2 Two clients. 13.3 Join leave. 13.4 Rejoin. 13.5 Loot rule. 13.6 Process kill.
- 14.1 Third client. 14.2 Fourth. 14.3 Loss profile. 14.4 Interest cap.
- 15.1 Vendor ADR approved. 15.2 Guest token. 15.3 Snapshot upload. 15.4 Lock row.
- 16.1 Place piece. 16.2 Reject overlap. 16.3 Save piece. 16.4 Undo.
- 17.1 Spell def. 17.2 Cast confirm. 17.3 TTL. 17.4 Slot UI.
- 18.1 Boe phases. 18.2 Smacko grant. 18.3 No seal. 18.4 Iron node. 18.5 Edge walk.
- 19.1 Ledger. 19.2 Tier gate. 19.3 Farmer spawn rule.

Later phases use the same pattern: one verb, one test, stop.

---

# 7. First playable build

This is Phase 6, not the vertical slice.

The player can launch, enter a debug world, wake on the Hearthfen pad, move, look, interact, gather wood and flint, craft a stone knife, fight a wolf, and walk back to the pad.

No creator required. No Cookie. No multiplayer. No cloud. It exists so nobody spends months before a loop exists.

Exit: device or editor play-mode checklist in the log. Device preferred. Editor allowed only if Phase 3 already passed and this build is the same project.

---

# 8. First mobile build

Phase 3. As soon as movement exists. Not after Cookie.

Prove touch, camera, rendering, a debug UI, load of Boot, memory, and frame time on a mid Android. iOS when signing exists.

If this fails, content work stops.

---

# 9. The true vertical slice

Phase 12. Must include:

Character (reduced creator) → Hearthfen with Tanic and puppets → forest → gather wood, flint, stone, copper → craft knife, stone pick, copper pick, copper sword → equip → combat vs wolf, goblin, one elite → Cookie dungeon with a trap, a puzzle, rooms → Cookie, three phases → Cookie’s Blade, Cookie’s Pickaxe, Cookie’s Core → blade usable, pick mines iron at the edge → Green Gate blocks then opens → Kingdom fields visible and the bridge walkable to the gate line.

It must feel like a short game: menu music can be a placeholder tone until polish, but the village must be occupied and the boss must have a tell.

Not in the slice: full creator, all schools, settlements above a campfire, co-op playtest, other bosses, hunger, shop.

---

# 10. Cookie boss milestone

Discover the castle from the village rumour or by walking. Enter. Fight a goblin room. Trigger a telegraphed trap. Complete one puzzle. Beat or sneak past one elite. Reach the nursery arena. See the bow. Survive phase 2 spin. Survive phase 3 box. Defeat. Receive the three rewards in a sim transaction. Equip the blade. Equip the pick. Mine an iron node that previously rejected the copper pick. Return. Gate that previously blocked now opens. Save. Kill the app. Relaunch. Rewards and seal remain. A second defeat does not create a second blade.

Co-op variant of this milestone is Phase 13, not Phase 10.

---

# 11. Multiplayer vertical slice

After Phase 12 is accepted.

2 players first (Phase 13). Then 3, then 4 (Phase 14).

Tests: join, leave, rejoin within 90 s, rejoin after 90 s at shrine, shared combat, personal boss loot, missed boss does not grant the blade, shared seal, inventory not visible to the other client, chest permission, NPC talk does not desync Tanic’s stage if it is personal, downed revive, death by mode, save, disconnect, reconnect, disconnect during grant, server process kill, speed intent rejected, no player-hosted online world.

Building tests wait until Phase 16 unless a piece exists.

---

# 12. Persistence milestone

Local proof is Phase 11, before more regions.

Cloud proof is Phase 15, before a public playtest.

Scripted test: join, gather, craft, place bench if building exists, kill wolf, kill Cookie, receive loot, leave, stop server, start server, reconnect. Seal set. Item id unchanged. No duplicate. Bench present if it had been placed. Character level unchanged by the restart except what was saved.

---

# 13. Building milestone

Stages: one piece (bedroll) → camp (bedroll, fire, bench) → saved camp → co-op place → village ledger → one arriving worker. City, raids, and blueprints are later grouped tasks, not this milestone.

---

# 14. Content expansion

Order after the slice:

1. Kingdom + Black Knight + law stub + iron.
2. Mire + Mire Mother + knee-deep move.
3. Wasteland + Grave King + naming flag.
4. Frost foothills, then Wyrm when the ice lock exists.
5. Desert + Pharaoh + light lanes.
6. Volcano + Titan + sinking tiles.
7. Drowned + Queen + breath meter.
8. Skylands + Guardian + vertical meter.
9. Void + Finster + rite.

Each pack is a phase-20 cycle. Do not start the next pack until the previous boss grant and seal survive a reload on device.

Each pack must add the unique mechanic in the design bible. A recolored forest is a failed pack.

---

# 15. Boss pipeline

For every boss after the machine exists:

1. Def: id, phases, attacks, tells, weaknesses, loot, seal or none.
2. Arena prefab, mesh tells.
3. Animation ids hooked to attack ids.
4. Audio stubs allowed. Missing voice is not a fail. Missing tell is a fail.
5. VFX optional on Low.
6. Damage and status from the sim.
7. +40% HP per extra player, split mechanic only if the def says so.
8. Grant key and seal write immediate.
9. Tests: wipe, double grant, solo kill.
10. Device pass in that arena before the next boss starts.

Cookie is the template. A boss that needs a new movement mode (swim, fly) is an ADR, not a quiet special case.

---

# 16. NPC pipeline

One `ScheduleAgent`. Roles are data: station id, hours, dialogue set, flee flag, shop table id.

Add a role by adding a def and a prefab variant, not a new script. Named story NPCs (Tanic, Mara, Elspeth, Voss, and the rest in the design bible) are defs with extra flags.

Quest-critical NPCs have server positions. Others may be puppets.

---

# 17. Content authoring pipeline

| Content | Author as | Runtime | Server |
| --- | --- | --- | --- |
| Items, recipes, spells, loot, bosses, quests | ScriptableObject | exported JSON manifest | loads manifest, not Unity assets |
| Dialog lines | string table keys | table | sends line id |
| Buildings | piece def + prefab | prefab client, def server | validates def id |
| Dungeon rooms | prefabs + graph def | client scene | seed and state |
| Regions | scenes + tile prefabs | Addressables | bounds and seal ids |
| World events | event def | client presentation | scheduler |
| Accounts, grants, seals | — | — | Postgres rows |
| Scatter | seed + density def | client rebuild | not stored per tree |

Add content without a core rewrite. A new unique verb that the sim cannot express requires an ADR and a sim change on purpose.

---

# 18. AI coding rules

Must not: giant files, god classes, duplicate systems, client loot, hardcoded boss stats in a scene, silent architecture edits, deleted tests, warning suppression, ignored errors, editor-only "mobile", fake multiplayer, local UI inventory in online play, trusted client rewards, placeholder called complete, new frameworks, rewrites of working systems for style.

Must: reuse the sim, keep classes on one reason, test the rule, name things as the architecture names them, document authority, small commits, stop at the task.

File size guideline: if a file passes about 400 lines, split by responsibility before adding a feature. Not a hard crash. A drift smell.

---

# 19. Code quality gates

| Gate | Meaning |
| --- | --- |
| A | Compiles, player and server targets that exist |
| B | No new console errors in the tested scene |
| C | Edit-mode tests pass |
| D | Play-mode tests for this task pass |
| E | The player-facing check was actually done |
| F | Network checks done if the task is networked |
| G | Save/load checks done if the task persists |
| H | Device build if the task says mobile |
| I | Frame or memory number recorded if the task has a budget |
| J | Log, issues, changelog updated |

A milestone is incomplete if its required gates are missing. Phases name their gates in §5.

---

# 20. Performance gates

| When | Measure |
| --- | --- |
| Phase 3 | Frame time, load, memory on empty scene |
| Phase 6 | Frame time with wolf |
| Phase 9 | Memory across dungeon enter/exit |
| Phase 12 | 20 min forest, resident, AI count, save hitch |
| Phase 13+ | Uplink, server tick |
| Every region pack | Device frame in that region before the next |
| Phase 23 | Full matrix |

Do not wait for polish to discover the forest is too heavy. The forest is the test.

---

# 21. Mobile device test matrix

Exact models are **OPEN**. Classes are not.

| Class | Role | Slice target |
| --- | --- | --- |
| Older supported iPhone | Minimum iOS, about A14-class or the floor Charlie names | Low, 30 fps village |
| Modern iPhone | High | High optional 60 if cool |
| Older Android | Minimum, 4 GB RAM class | Low |
| Mid Android | The gate device | Medium, 30 fps |
| High Android | Ultra/High | Must step down when hot |

Phase 3 and Phase 12 require the mid Android at minimum. iOS joins when signing exists. PC is not a substitute.

---

# 22. Network testing

From Phase 13:

- RTT 80, 150, 250 ms
- Loss 0, 2, 5%
- Jitter
- Disconnect at boss 50% HP
- Reconnect inside and outside 90 s
- Server kill
- Two clients craft the same chest
- Grant retry

250 ms may feel bad. Log it. Do not silently change authority to hide it.

---

# 23. Save testing

Automated in sim, then one device kill:

- Normal save
- Rapid save
- Kill mid-write
- Duplicate grant
- Reconnect
- Schema migration v1 to v2 stub
- Bad checksum falls back
- Partial JSON rejected

World and character files separate in every test.

---

# 24. Git workflow

Branches: `slice/<task-id>-<short>`. Commits: `slice: T012 add stone knife transaction`. One task, one branch, one merge to main when gates pass. Tags: `slice-phase-3`, `slice-phase-12`, `alpha-kingdom`. Rollback: revert commit. Do not force-push main. No binary in Git without LFS.

Avoid a commit message that says the game was implemented.

---

# 25. Documentation workflow

Keep updated:

- `README.md` — how to open, how to run tests, what phase is current
- `ARCHITECTURE.md` — pointer to the technical bible plus any ADR index
- `DEVELOPMENT_LOG.md`
- `KNOWN_ISSUES.md`
- `CHANGELOG.md`
- `PROJECT_AUDIT.md` after session 1
- `TECHNICAL_DEBT.md` when debt is taken
- `Docs/adr/` when a decision is proposed

Do not fork the bibles inside the game repo without saying they are copies. The artifacts copies remain the authority until Charlie moves them.

---

# 26. Development log

Every milestone appends:

Date, task id, what changed, files, tests run, results, performance numbers, known issues, next legal task.

No log line, no done.

---

# 27. Bug management

| Sev | Meaning | Rule |
| --- | --- | --- |
| P0 | Crash, save loss, duped unique, seal desync, unplayable control | Stop feature work. Fix or get a human waiver. |
| P1 | Boss softlock, missing grant, dungeon cannot exit | Fix before the phase closes. |
| P2 | Bad LOD, wrong line, minor hitch | Log. Do not pretend it is gone. |
| P3 | Polish | Backlog. |

Save corruption and multiplayer item duplication are always P0.

---

# 28. Development checkpoints

Claude stops and reports at each:

1. Mobile move (Phase 3).
2. Gather and craft (Phase 5).
3. First playable (Phase 6).
4. Combat spike note (Phase 7).
5. Dungeon enter/exit (Phase 9).
6. Cookie kill (Phase 10).
7. Gate and save (Phase 11).
8. Vertical slice device report (Phase 12). Human accept.
9. 2-player (Phase 13).
10. 4-player fault test (Phase 14).
11. Cloud persistence (Phase 15), if approved.
12. Camp persists (Phase 16).
13. Village tier (Phase 19).
14. Kingdom seal (first region pack).
15. Feature-complete critical path (Finster).
16. Release candidate.

---

# 29. Stop conditions

Stop and ask if: an ADR is required, a bible conflict appears that §0 does not cover, a paid service is needed, cost may exceed the prototype band, authority is unclear, a save path can duplicate or lose a unique, frame time is over budget on the gate device in a slice scene, a task needs a rewrite of a finished system, requirements contradict, Unity version is not 6, or the combat spike says NGO is wrong.

Do not guess silently.

---

# 30. Human approval gates

Charlie must approve:

- Any paid service, host vendor, auth vendor, analytics SDK, crash SDK with a bill
- NGO → FishNet or Fusion
- Postgres schema that is not the architecture’s core tables
- Removing a seal, a boss, or fists-start
- Monetisation or a shop
- Analytics fields beyond the architecture list
- Private photo reference for Boe
- iOS signing and store accounts
- Starting Phase 13 before he has seen the Phase 12 note
- Public worlds, Kubernetes, Vercel-as-sim (the last is a no)

---

# 31. Definition of done

Code exists, compiles, tests exist and pass, the gameplay check was performed, network and save checks passed if in scope, mobile check passed if in scope, performance number recorded if budgeted, no open P0, docs updated, commit exists, log line exists.

A feature without a test is not done. A feature tested only in the editor is not a mobile done.

---

# 32. Final release roadmap

| Stage | Means |
| --- | --- |
| Prototype | Phase 6 loop on a phone |
| Vertical slice | Phase 12 accepted |
| Multiplayer alpha | Phase 14, private invites |
| Content alpha | Kingdom and Mire seals live, saves migrate |
| Feature complete | Finster seal, all regions playable, known P1 listed |
| Beta | External players, crash reporting on, economy sinks present |
| Performance/polish | Phase 23–24 |
| Release candidate | Store builds, migration from beta, no P0 |
| Launch | Charlie ships. Agent does not press release alone. |

---

# 33. What Claude should build first

Session 1 only:

1. Inspect the repository.
2. Write `PROJECT_AUDIT.md`.
3. If empty, create the Unity 6 URP project and the assembly layout from the architecture.
4. Git baseline, ignore, LFS attributes.
5. One edit-mode test that passes.
6. Boot scene that opens.
7. README with the phase pointer.
8. Commit.
9. Stop.

Do not add a player. Do not add Cookie. Do not add a backend.

Session 2 starts at task T006.

---

# 34. First 20 Claude tasks

### T001 — Repository audit
- Objective: `PROJECT_AUDIT.md` with version, packages, gaps.
- Dependencies: none.
- Files: `PROJECT_AUDIT.md`.
- Acceptance: contradictions with the architecture listed.
- Tests: none.
- Done: file exists, no code claimed.

### T002 — Unity 6 URP project
- Objective: project opens on 6000.x, URP asset assigned.
- Dependencies: T001.
- Files: `ProjectSettings/`, `Packages/manifest.json`.
- Acceptance: version recorded. Stop if not Unity 6.
- Tests: open Boot.
- Done: A, J.

### T003 — Assembly layout
- Objective: asmdefs from the architecture, no cycles.
- Dependencies: T002.
- Files: `Assets/_Project/**/*.asmdef`.
- Acceptance: `Veyr.Sim` has no Unity reference.
- Tests: compile.
- Done: A.

### T004 — Git baseline
- Objective: ignore Library, LFS for png/fbx/wav/unity binary patterns as needed.
- Dependencies: T002.
- Files: `.gitignore`, `.gitattributes`.
- Acceptance: Library not staged.
- Tests: none.
- Done: commit.

### T005 — Empty test and Boot
- Objective: edit-mode test passes. Boot scene in build list.
- Dependencies: T003.
- Files: `Assets/Tests/EditMode/`, `Assets/_Project/Scenes/Boot.unity`.
- Acceptance: test runner green.
- Tests: the new test.
- Done: A, C, J. Stop session.

### T006 — Sim clock
- Objective: 20 ticks equal 1 simulated second.
- Dependencies: T005.
- Files: `Veyr.Sim` clock.
- Acceptance: test proves it.
- Tests: edit-mode.
- Done: C.

### T007 — Boot tick display
- Objective: Boot shows tick via adapter, not via sim referencing UI.
- Dependencies: T006.
- Files: client adapter.
- Acceptance: domain reload does not double the clock.
- Tests: play-mode smoke.
- Done: A, B, D.

### T008 — Input actions
- Objective: Move, Look, Light, Dodge, Jump, Interact, Block, Ability, LockOn, QuickItem.
- Dependencies: T007.
- Files: `Veyr.inputactions`.
- Acceptance: Touch scheme exists. Gamepad scheme exists empty-ok.
- Tests: binding asset loads.
- Done: A.

### T009 — Joystick and look
- Objective: on-screen stick and look zone drive intents.
- Dependencies: T008.
- Files: UI prefab, input reader.
- Acceptance: safe area. No alloc per frame after warmup, or a logged exception with a debt id.
- Tests: intent values in play-mode.
- Done: E.

### T010 — CharacterController move
- Objective: walk, gravity, jump, sprint.
- Dependencies: T009.
- Files: `PF_Player`.
- Acceptance: not a Rigidbody pawn.
- Tests: injected intent moves the body.
- Done: D, E.

### T011 — Camera
- Objective: orbit, collision pull-in, over-shoulder offset.
- Dependencies: T010.
- Files: `PF_CameraRig`.
- Acceptance: camera never inside the capsule in a wall test.
- Tests: play-mode wall.
- Done: E.

### T012 — Dodge input
- Objective: button and flick both emit Dodge. No i-frames yet.
- Dependencies: T010.
- Files: input, player.
- Acceptance: both paths in the test note.
- Tests: manual plus intent test.
- Done: E.

### T013 — Dev_Move scene
- Objective: grey ground, player, camera, overlay stub.
- Dependencies: T011.
- Files: scene.
- Acceptance: scene in build settings only if needed for device. Boot can load it additive in dev.
- Tests: opens with no errors.
- Done: B.

### T014 — Frame overlay
- Objective: frame ms and quality tier on screen.
- Dependencies: T013.
- Files: overlay.
- Acceptance: visible number.
- Tests: play-mode.
- Done: E.

### T015 — Android development build
- Objective: installs on a device.
- Dependencies: T014. SDK present, else stop and ask.
- Files: build note.
- Acceptance: log line with device name.
- Tests: manual.
- Done: H. If no device, stop. Do not fake.

### T016 — 10 minute device note
- Objective: walk for 10 minutes. Record median frame.
- Dependencies: T015.
- Files: `Docs/device/PHASE3.md`.
- Acceptance: number written. If median > 33 ms in the empty scene, stop.
- Tests: device.
- Done: I, J. Checkpoint 1.

### T017 — PlayerIntent and sim move
- Objective: sim integrates movement. Client sends intent.
- Dependencies: T016 passed.
- Files: sim, adapter.
- Acceptance: position comes from sim state.
- Tests: edit-mode move step.
- Done: C, E.

### T018 — Speed rejection
- Objective: intent above cap ignored.
- Dependencies: T017.
- Files: sim.
- Acceptance: test.
- Tests: edit-mode.
- Done: C. Checkpoint authority shape.

### T019 — Item definition and inventory
- Objective: add, remove, stack. Instances have ids.
- Dependencies: T018.
- Files: sim inventory, item def.
- Acceptance: SO is not the bag.
- Tests: stack and reject overflow.
- Done: C.

### T020 — Gather node and stone knife
- Objective: wood + flint + bench → one knife. Double submit → one knife.
- Dependencies: T019.
- Files: recipe, node, bench.
- Acceptance: tests named in the log.
- Tests: craft transaction.
- Done: C, E. Stop. Next session is the wolf, not Cookie.

---

# 35. First 100 tasks

T001–T020 are above. T021–T100 take the project to the Cookie vertical slice. Format: id, name, depends, done-when.

## First playable (Phase 6)

- T021 Wolf def and health in sim. Depends T020. Done when a test deals damage and kills.
- T022 Wolf prefab and server adapter. Depends T021. Done when it dies in play-mode.
- T023 Equip knife changes damage. Depends T022. Done when fists and knife differ in a test.
- T024 Respawn at pad. Depends T023. Done when health 0 returns the body to the pad in Adventure stub.
- T025 Dev loop scene dressing, village pad, tree line. Depends T024. Done when the loop checklist passes.
- T026 Device 10 min of the loop. Depends T025. Done when the log has frame ms. Checkpoint 3.

## Combat spike (Phase 7)

- T027 Light attack hits wolf. Depends T026. Done when hit is sim-confirmed.
- T028 Heavy attack, higher stamina. Depends T027. Done when insufficient stamina rejects.
- T029 Dodge i-frames. Depends T028. Done when a test hit inside the window misses.
- T030 Block with a stump shield or fists-block off. Depends T029. Done when block reduces damage only if the action is legal. Design: block needs a shield. Fists do not block. Test that.
- T031 Parry window math. Depends T030. Done when the unit test matches the tuned window.
- T032 Hurtbox history 200 ms. Depends T031. Done when a delayed hit uses the buffer.
- T033 Goblin archetype, different verb (net or rush). Depends T032. Done when it is not a wolf clone.
- T034 Artificial 150 ms note. Depends T033. Done when `Docs/combat/SPIKE.md` says continue or stop. Checkpoint 4. If stop, no T035.

## Village (Phase 8)

- T035 Day clock 24 min. Depends T034 continue. Done when hour advances in a test.
- T036 Schedule runner. Depends T035. Done when a puppet changes station.
- T037 Tanic prefab and route. Depends T036. Done when he is at the lane at the scripted hour.
- T038 Dialogue key UI, no arrow. Depends T037. Done when a line id shows English from a table.
- T039 Five other puppets. Depends T036. Done when cap code exists even if count is 6.
- T040 Forest blockout scene replaces Dev_Loop as the main dev scene. Depends T039. Done when Boot can enter it.

## Dungeon (Phase 9)

- T041 Castle entrance volume. Depends T040. Done when overlap raises a prompt.
- T042 Subscene load and overworld unload. Depends T041. Done when player is not duplicated.
- T043 Three hand-placed rooms and a corridor. Depends T042. Done when nav or walk links exist.
- T044 Trap with a mesh tell. Depends T043. Done when standing in it after the tell deals sim damage.
- T045 One puzzle (weight or bell). Depends T044. Done when the door opens from sim state.
- T046 Elite in a room. Depends T043. Done when it uses a different attack timing from the wolf.
- T047 Exit returns to forest at the door. Depends T042. Done when memory does not climb on five repeats. Checkpoint 5.

## Cookie (Phase 10)

- T048 Boss state machine in sim. Depends T047. Done when transitions are tested without a scene.
- T049 Arena prefab and music-box placeholder. Depends T048. Done when the room loads.
- T050 Cookie phase 1 waddle and peck. Depends T049. Done when the bow is visible before the spin.
- T051 Phase 2 spin with a body tell. Depends T050. Done when particles-off still shows the tell.
- T052 Phase 3 box hazard. Depends T051. Done when the safe side is learnable.
- T053 Toy adds, cap. Depends T052. Done when cap holds.
- T054 In-memory grant of blade, pick, core. Depends T053. Done when double kill does not mint a second key.
- T055 Wipe resets to intro. Depends T054. Done when seal is not set on wipe.
- T056 Equip blade and pick after kill. Depends T054. Done when moveset id changes.

## Seal and save (Phase 11)

- T057 Separate character and world save models. Depends T056. Done when two files or two records exist.
- T058 Atomic write and checksum. Depends T057. Done when mid-write test loads previous.
- T059 Iron node rejects copper pick and accepts Cookie pick. Depends T056. Done when a test proves the tier gate.
- T060 Green Gate collider. Depends T058. Done when the body cannot pass.
- T061 `seal_cookie` on kill opens the gate. Depends T060. Done when reload keeps it open.
- T062 Kingdom vista impostor beyond the gate. Depends T061. Done when it is visible before unlock.
- T063 App-kill test on device. Depends T061. Done when the log records survival of the blade. Checkpoint 7.

## Slice shell (Phase 12)

- T064 Main menu scene, continue and new. Depends T063. Done when Boot can reach it.
- T065 Reduced creator writes an appearance blob. Depends T064. Done when blob < 4 KB and has no class field.
- T066 Local world create, Adventure default. Depends T065. Done when mode is stored on the world.
- T067 Spawn at Hearthfen road, fists, no sword. Depends T066. Done when a fresh world has empty equipment.
- T068 Fresh-run checklist script. Depends T067. Done when a tester can follow it to the gate.
- T069 Low and Medium quality assets hooked. Depends T068. Done when a toggle changes shadow or resolution.
- T070 20 min device session. Depends T069. Done when median frame and resident are in the log.
- T071 Slice report and stop. Depends T070. Done when the report template is filled and no Phase 13 branch is opened by the agent. Checkpoint 8.

## Hardening before calling the slice honest

- T072 P0 sweep. Depends T071. Done when known P0s are fixed or waived by Charlie.
- T073 Save migration stub v1. Depends T072. Done when a version field exists.
- T074 Content manifest hash. Depends T073. Done when mismatch is logged.
- T075 Subtitle widget for one boss line id. Depends T074. Done when it can show a key. Finster clip not required.
- T076 Haptics toggle, default on, mute works. Depends T074. Done when a setting persists locally.
- T077 Colourblind shape on the Cookie spin tell. Depends T075. Done when the tell is not colour-only.
- T078 Known issues file matches the slice. Depends T072. Done when every P1 is listed.

## Co-op preparation, still not a public server

These tasks are specified now so the slice does not paint itself into a corner. They execute only after T071 is accepted.

- T079 Protocol version on the sim messages. Depends T071 accepted. Done when mismatch is detectable.
- T080 Server build target, headless define. Depends T079. Done when a server build compiles.
- T081 Two-client editor join on embedded-or-process. Depends T080. Done when both see the wolf.
- T082 Join does not grant Cookie’s Blade. Depends T081. Done when a late client has no unique.
- T083 Shared seal visible to the late client. Depends T082. Done when the gate is open for them.
- T084 Reconnect inside 90 s. Depends T083. Done when position restores.
- T085 Reconnect after 90 s at shrine. Depends T084. Done when they are not in the arena.
- T086 Process kill recovery from last save. Depends T085. Done when the seal survives.
- T087 Speed intent still rejected remotely. Depends T081. Done when a test or note proves it.
- T088 Interest radius hides a far goblin. Depends T081. Done when updates stop past the radius.
- T089 Third client smoke. Depends T088. Done when tick time is logged.
- T090 Fourth client smoke and regroup warning if split. Depends T089. Done when the warning exists. Checkpoint 10.

## Camp and content lock for the slice

- T091 Bedroll place transaction. Depends T071. Can run after T063 if co-op is waiting on Charlie. Done when cost is consumed.
- T092 Fire and bench place. Depends T091. Done when three pieces save.
- T093 Undo last place. Depends T092. Done when the item returns.
- T094 Overlap reject. Depends T092. Done when a test fails the second piece.
- T095 Co-op place lock if T081 exists. Depends T094 and T081. Done when two places cannot occupy one cell.
- T096 Ember def behind a flag, not in the fresh inventory. Depends T071. Done when a test cast spends mana.
- T097 TTL fire patch expires. Depends T096. Done when it is absent from the save.
- T098 Slice content manifest lists only forest and cookie. Depends T074. Done when kingdom scenes are not in the player build.
- T099 Anti-drift note: implementation vs both bibles, one page. Depends T071. Done when gaps are listed.
- T100 Stop. Archive the slice tag `slice-phase-12`. Depends T070 and T099. Done when the tag exists and the next legal task is either co-op (T079) or camp (T091), chosen by Charlie.

---

# 36. Long-term task map

Grouped. Not task-level.

- Kingdom pack: tiles, Harrenvale puppets, law stub, iron, fortress, Black Knight, `seal_knight`, frost foothill vista, mire causeway.
- Boe pack: kennel, three phases, Smacko, Elspeth lines, no seal.
- Mire pack: knee-deep, cathedral, Mire Mother, Rotbreaker, `seal_mire`.
- Waste pack: naming flags, Grave King, Soulbreaker, `seal_grave`.
- Frost pack: cold meter, Wyrm, Frostbite, `seal_wyrm`.
- Desert pack: heat, light lanes, Pharaoh, Sunbreaker, `seal_pharaoh`.
- Volcano pack: sinking tiles, Titan, drill, `seal_titan`.
- Drowned pack: breath, Queen, abyssal drill, `seal_queen`.
- Sky pack: glide, Guardian, star pick, `seal_guardian`.
- Void pack: Finster, rite at 150 ms, voidstone, `seal_finster`.
- Magic schools after Ember: one school per pack, not all at once.
- Settlements: village, then town. City after two regions.
- Events: one raid, then blood moon, then the rest.
- Economy sinks: repair, mirror, cleanse. No auction house.
- Polish: VO only if approved, localisation pass, store page, age-rating copy.
- Optimisation: per region device pass, thermal ladder.
- Release: migration, crash SDK, analytics opt-out, RC tag.

---

# 37. Claude session template

```
VEYRMARCH SESSION

Read:
- MASTER_GAME_DESIGN_BIBLE.md
- TECHNICAL_ARCHITECTURE_BIBLE.md
- CLAUDE_IMPLEMENTATION_PROGRAMME.md
- DEVELOPMENT_LOG.md
- KNOWN_ISSUES.md

Current phase:
Current task id:
Objective:
Dependencies already true:
Files to inspect:
Allowed files to edit:
Acceptance criteria:
Tests required:
Performance requirement:
Stop conditions:
Do not:

Report with the milestone template.
Stop when the task's gates pass.
```

---

# 38. Claude report template

```
VEYRMARCH REPORT

Task:
Completed:
Files changed:
Tests run and results:
Build result:
Performance numbers:
Device or editor:
Known issues:
Architecture changes proposed (ADR path or none):
Not completed:
Not tested:
Next legal task:
Commit:
```

---

# 39. Anti-drift system

Compare implementation to both bibles:

- After Phase 6, Phase 12, Phase 14, each region seal, feature-complete, and RC.
- Also every 20 tasks (T020, T040, T060, T080, T100).

The compare note lists: pillars violated, authority leaks, scope that jumped ahead, and debt ids. A violated pillar is a P1 until fixed or waived.

---

# 40. Architecture review gates

Before Phase 13, before the Kingdom pack, before cloud, before Finster:

- Dependency graph still one-way
- No new god class
- Frame numbers from a device
- Network authority sample (one forged message)
- Save kill-mid-write still passes
- Test list still green
- Debt file current

Fail the review and the next pack does not start.

---

# 41. Technical debt

`TECHNICAL_DEBT.md` rows: id, problem, impact, why taken, temporary or permanent, priority, suggested fix.

Taking debt requires a log line. Deleting the row requires the fix commit. Agents may not clear debt by silence.

---

# 42. Final programme summary

| Item | Value |
| --- | --- |
| Phases | 25 (0–24) |
| First 100 tasks | T001–T100, slice tag at T100 |
| First playable | T026 / Phase 6 |
| First mobile | T016 / Phase 3 |
| True vertical slice | T071 / Phase 12 |
| First multiplayer | T081 / Phase 13, after human accept |
| First persistence | T063 local, T015-cloud only after vendor approval |
| First settlement | Phase 19, after camp T092 |
| Alpha | Phase 14 plus Kingdom seal |
| Beta | external, crash reporting, two regions minimum |
| Release | Phase 24 RC, Charlie ships |

Critical risks: melee at 150 ms RTT, forest thermals, unique duplication, agent scope skip, iOS listen-server revival.

Open questions: auth vendor, game host vendor, iOS signing owner, Boe photo reference, monetisation (do not build), final title, voice, age-rating copy.

Human approval gates: §30.

First Claude session: T001–T005 only. Audit, project, assemblies, Git, Boot, one test. Then stop.

---

# Programme status

This is a roadmap. Nothing in it is implemented by this file.

Recommended next step: hand Claude the session template with task T001, and do not let that session continue into a player or a boss.
