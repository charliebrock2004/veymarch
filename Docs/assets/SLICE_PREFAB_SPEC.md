# Slice prefab spec

Not imported by an editor. Prefab ids are the names the client adapters should use. No meshes are in the repo.

Palette from the art bible: bone stone `#E4D7C3`, soot timber `#3C342C`, moss `#5E6B45`, ink `#1C1916`, parchment `#E7DCC8`. Cookie nursery red is the only saturated toy colour in the forest. Metalness only on copper, blade edges, brass, and boss mechanisms.

## Player

| Prefab | Clips | Notes |
| --- | --- | --- |
| `PF_Player` | idle, walk, sprint, dodge, light_1, light_2, light_3, heavy, hit, death, block | Human 7–7.5 heads. Not a Rigidbody. Capsule. |
| `PF_CameraRig` | none | Orbit, collision pull-in, never inside the capsule. |

Touch writes `PlayerIntent`. The action map is `Assets/_Project/Input/Veyr.inputactions`. Gamepad bindings exist. Touch scheme exists and is driven by the on-screen stick, not by these bindings.

## Forest slice

| Prefab | Required | Notes |
| --- | --- | --- |
| `PF_HearthfenPad` | spawn marker | Road spawn. Fists, no sword. |
| `PF_Tree_Wood` | node `node_wood` | Brown grain, not a monster tree. |
| `PF_Flint` | node `node_flint` | Dark glass chips in the creek. |
| `PF_Bench` | piece `piece_bench` | Communal bench past the smith. |
| `PF_Campfire` | piece `piece_fire` | Cleanses bleed, burn, frost, silence in sim. |
| `PF_Bedroll` | piece `piece_bedroll` | |
| `PF_Npc_Tanic` | route lane 05:00–18:00, workshop after | 8 heads, long brown hair, workshop coat, one copper pin. No armour in the forest. Idle watches the tree line. |
| `PF_Mob_Wolf` | verb `pounce`, telegraph 10 ticks | Bramble wolf. Not a blue recolour. |
| `PF_Mob_Goblin` | verb `rush`, telegraph 6 ticks | Stitch goblin. Different timing from the wolf. |
| `PF_GreenGate` | reads `seal_cookie` | Body cannot pass until the seal. Core does not re-lock it. |

## Cookie castle

Subscene. Overworld unloads. Target under 8 active rooms.

| Prefab | Notes |
| --- | --- |
| `PF_Dungeon_Entrance` | Castle door in the hill. |
| `PF_Room_TrapBell` | Mesh tell before damage. Sim tell is 16 ticks, then 12 damage. |
| `PF_Room_Weight` | One verb: weight. Opens the boss door in sim. |
| `PF_Cookie` | Plush penguin, caller coat, button eyes, brass beak. Bow before the spin. Spin wind-up 10 ticks. Nursery red and brass. |
| `PF_MusicBox` | Phase 3 climb. Safe side must read with particles off. |

Rewards already in the catalog: `wpn_cookie_blade`, `wpn_cookie_pick`, `key_cookie_core`. Soulbound. Grant key format is in the sim.

## Not in the player scene list

`SliceBuild.PlayerScenes` is Boot, Forest_Blockout, Cookie_Nursery. Kingdom, Harrenvale, and later regions stay data-only until their pack.

## Animation bar

Any attack that can drop a fresh 80 HP player needs a wind-up of at least 8 ticks (0.40 s). Finster's rite circle is 100 ticks. The line id is `finster.rite.line`.
