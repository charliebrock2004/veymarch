# VEYRMARCH

The Sealed Continent. A third-person medieval fantasy action RPG for iOS and Android, built in Unity 6 (URP).

## Where the project is

**Current milestone: the web build in `web/`, playable on an iPhone through Vercel, alone or with up to three friends in a persistent world.** Hearthfen, the Giant Forest, Cookie's Castle, Cookie, the Green Gate, and the edge of the Kingdom, with touch controls. See [The web build](#the-web-build) and [Playing together](#playing-together-realms).

**Unity track: Programme Phase 2, waiting on checkpoint 1 (movement on a real phone).** Paused, not abandoned.

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
| `web/` | The web build: Vite, React, Three.js. The current playable milestone (deployed to Vercel). |
| `Docs/` | Copies of the bibles, the device script, asset spec |

Architecture map: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## The web build

`web/` is the playable slice in a browser: Three.js for the world, React for the interface, no downloads beyond the page (every texture, mesh, animation and sound is generated in code). It re-implements the slice rules in TypeScript (`web/src/game/rules.ts`, tested) and borrows the sim's tuning where it exists.

```bash
cd web && npm ci && npm run dev      # http://localhost:5173
npm test                             # rules tests + server rules tests (PGlite)
npm run realm                        # local realm server for online play (open with ?realm=local)
npm run build                        # production bundle in web/dist
```

Vercel builds `web/` using the root `vercel.json`. On an iPhone, open the URL in Safari, rotate to landscape, and use Share → Add to Home Screen for full screen.

| Path | What |
| --- | --- |
| `web/src/game/Game.ts` | Game loop, player, camera, combat, quests, saves |
| `web/src/game/play/` | Enemies (`mobs.ts`), Cookie (`boss.ts`), villagers (`npcs.ts`), held items |
| `web/src/game/world/` | Map layout, Hearthfen and the forest (`overworld.ts`), the castle interior (`dungeon.ts`), building kit, collision |
| `web/src/game/engine/` | Terrain, sky, instanced vegetation, skinned procedural characters, particles, telegraphs, synthesised audio |
| `web/src/App.tsx`, `web/src/ui/` | Title, character creator, HUD, touch controls, bag and crafting, dialogue |

## Playing together (Realms)

Worlds work like Minecraft Realms: a world lives on the server, not on anyone's phone.

1. **Play → My Characters → New Character.** Characters belong to your player profile and travel between worlds with their gear and progress. The first time you press Play, characters from this device's single player saves are copied in once (the local saves are left alone).
2. **Continue → Worlds → Create World.** You get a six-letter code such as `K7X4P2` (no O, 0, I or 1). Copy or share it.
3. Your friend: **Play → their character → Join World**, types the code, **Join**. Up to four players per world.
4. Leave whenever you like. The world, its day and night, opened doors, defeated bosses, and every character's inventory stay on the server. Come back through **Play → Worlds → Play**.

What is shared: positions and animations (about 10 updates a second, smoothed), enemies (one player's phone runs them and the others mirror it; if that phone goes quiet the next one takes over within a few seconds), Cookie's single health pool, world progress (the weight door, the nursery, the Green Gate, Cookie's defeat), gathering nodes, the bell. Downed players can be pulled up by a friend standing next to them.

What the server decides (`web/server/schema.sql`, all `vm_*` functions): who you are (a device key; copy it in Settings → Player key to play the same characters on another device), world membership and the four-player cap, every item that enters or leaves an inventory (gathering, crafting, trading, caches, loot), loot once per enemy per respawn, Cookie's health and the damage each blow does, and the Blade, Pickaxe and Core exactly once per character who fought. Position is checked against a speed limit on each save.

The backend is a Supabase project (Postgres + Realtime). The browser needs two public values at build time, set as Vercel environment variables:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the project's publishable key (`sb_publishable_…`), public by design |

Without them the game still builds and Single Player works; Play says online play is not set up. To change the server: edit `web/server/schema.sql` (keep it idempotent), run `npm run seed` after changing `content.ts`, test with `npm test`, then apply both files to the project.

Local development without Supabase: `npm run realm` starts the same SQL in an in-process Postgres (PGlite) plus a WebSocket relay on port 8787; open the game with `?realm=local` (or `?realm=ws://host:8787`). Two browser windows on that URL can create and join a world. `?realm=supabase` switches back.

| Path | What |
| --- | --- |
| `web/server/schema.sql`, `seed.sql`, `gen-seed.mjs` | Tables and the authoritative functions; seed generated from `content.ts` |
| `web/server/rpc.test.mjs`, `db.mjs`, `dev-server.mjs` | Server rules tests (PGlite), local realm |
| `web/src/net/` | Device key and typed calls (`realm.ts`), Supabase and local transports, the world room (`room.ts`), save import |
| `web/src/game/play/remote.ts` | Other players: interpolation, weapon, nameplate |
| `web/src/ui/Online.tsx` | My Characters, Worlds, Create World, Join World, player key |

## Authority

1. `Docs/design/MASTER_GAME_DESIGN_BIBLE.md`: what the game is
2. `Docs/architecture/TECHNICAL_ARCHITECTURE_BIBLE.md`: how it is built; wins on technical conflicts
3. `Docs/programme/CLAUDE_IMPLEMENTATION_PROGRAMME.md`: order and gates
4. `Docs/ops/MASTER_CLAUDE_BUILD_PROMPT.md`: how the implementing agent works
5. `Docs/art/ART_DIRECTION_BIBLE.md`: look and feel
