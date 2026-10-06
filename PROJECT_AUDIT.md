# PROJECT_AUDIT

| Field | Value |
| --- | --- |
| Date | 2026-10-06 |
| Repo | [charliebrock2004/veymarch](https://github.com/charliebrock2004/veymarch) |
| Task | T001 |
| Verdict | Empty repository. No Unity project. Earliest incomplete implementation task is T002, and it is blocked. |

## What was inspected

- GitHub repo `charliebrock2004/veymarch`. Created 2026-10-06. Public. No commits, no default branch, no files. Size 0.
- This session's machine: Debian 12, x86_64, git 2.39.5. No Unity editor, no Unity Hub, no `dotnet`, no Docker, no Android SDK, no connected phone.
- Documents read: design bible, architecture bible, implementation programme, art bible, operating prompt. Copies are under `Docs/`. See `Docs/SOURCE.md`.

## What exists

Nothing implemented. No `ProjectSettings/`, no `Packages/manifest.json`, no assemblies, no scenes, no scripts, no tests, no prefabs, no backend, no env files.

## What is missing

Everything in programme phases 0–12. The next legal task is T002: a Unity 6 LTS URP project that opens on 6000.x.

Unity 6.3 LTS (`6000.3.x`, supported through December 2027) is the line to install. Unity 6.0 LTS support ends October 2026. Do not pin 6.0. Do not start on a non-LTS update release unless Charlie overrides it.

## Unity check

The operating prompt says: confirm Unity is 6000.x, and if it is not, stop.

There is no editor here, so there is no 6000.x project to open. T002 is not done. No scene was claimed to compile. No test was claimed green.

## Earliest incomplete task

T001 is this file. T002 is next and blocked until a Unity 6.3 LTS editor can open the repo. T015 (Android device) will block later even after the editor exists. Do not fake that log.

## Contradictions

Programme section 0 already settles the first seven. Restated so they are not relitigated. Architecture wins on technical matters. The programme wins on order.

| Topic | Design bible | Architecture / programme | Follow |
| --- | --- | --- | --- |
| Online authority | Listen-server on a player's phone, Unity Relay | Embedded sim offline. Dedicated process online. Phone is never the authority. Relay is fallback only. | Architecture C1 |
| Frame budget | "< 150 ms GPU" at 30 fps | 33.3 ms whole frame. GPU about 16–20 ms on Medium. | Architecture C2 |
| Land | About 4 km, 64 m chunks, sim 3×3 | 128 m terrain tiles, 64 m object chunks, one active region set, neighbours as impostors | Architecture C3 |
| Destruction | Partially destructible read | Damage states, support graph, TTL props. No terrain deformation, no PhysX collapse. | Architecture C4 |
| Net play start | Slice text and design phase 3 | Solo device slice first. Sim is authoritative from the first inventory. Remote clients after the slice is accepted. | Programme |
| Boss weapons | Guaranteed | Soulbound, unique grant row, retry returns the same id | Architecture, preserves the guarantee |
| Build order inside the slice | Design "Implementation order" puts a save stub before the bench, and a wolf beside the first controller | Programme: foundation, sim tick, touch movement, device frame proof, then authority, then the knife | Programme |
| Phase numbers | Design phase 0 is movement plus a wolf | Programme phase 0 is the repo. The wolf is Phase 6. | Programme |

Recorded interpretations, not new design:

- The Green Gate stays open from `seal_cookie` on the world. Cookie’s Core is the guaranteed key item and is not consumed. Moving the Core does not re-lock the gate. A late joiner sees the open gate and does not receive Cookie’s Blade.
- Fists do not block. A shield does. Greatsword rank 4 may block clumsily, because the design bible says so. The programme’s T030 line that mentions only the shield is narrower than the design bible. Implement the design rule when that task is reached.
- Code and content ids follow the architecture examples (`wpn_cookie_blade`, `seal_cookie`). The art bible’s `NPC_` / `BOSS_` / `WPN_` prefixes are for DCC source files. Prefabs use `PF_` plus the content id. First production mesh import is the time to confirm this, not T002.

Not contradictions: fists start, no class, Adventure default, hunger off unless custom, Vercel is not the simulation, Cookie is three phases, Boe is optional and sets no seal, Hearthfen is not replaced by the player’s village.

## Next legal task

T002. Stop until Unity 6.3 LTS is available to open and compile the project. Do not invent a substitute engine.
