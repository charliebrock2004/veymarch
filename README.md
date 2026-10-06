# VEYRMARCH

The Sealed Continent.

The playable build right now is the browser game in `web/`. Open it on a phone. Unity 6 remains the production engine later and is not required to play.

```bash
cd web
npm install
npm run dev
```

Production build: `npm run build` in `web/`. Static files land in `web/dist`. Vercel should use `web` as the root directory (Vite). A repo-root `vercel.json` also builds `web/` if the project root stays at the repository root.

Save is local to the browser (`localStorage`). There is no account.

## What the browser slice contains

Hearthfen, the giant forest, gathering, a stone knife, wolves, the nursery castle, the weight door, Cookie, Cookie's Blade / Pickaxe / Core, the Green Gate, and the wheat road up to a shut fortress. Touch controls are on screen. WASD, Shift to sprint, J strike, K dodge, E use, I pack.

## Rules that still live in C#

`Veyr.Sim` does not reference Unity. It is not the thing you play. Tests:

```bash
dotnet test sim/Veyr.Tests.Sim/Veyr.Tests.Sim.csproj
```

Unity has not opened this project. There is no phone binary. Do not treat Unity tasks as done.

## Authority

1. `Docs/design/MASTER_GAME_DESIGN_BIBLE.md`
2. `Docs/architecture/TECHNICAL_ARCHITECTURE_BIBLE.md`
3. `Docs/programme/CLAUDE_IMPLEMENTATION_PROGRAMME.md`
4. `Docs/ops/MASTER_CLAUDE_BUILD_PROMPT.md`
5. `Docs/art/ART_DIRECTION_BIBLE.md`
