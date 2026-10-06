# Known issues

| Id | Sev | Issue | Status |
| --- | --- | --- | --- |
| ENV-1 | Blocker | Unity 6.3 has never opened this repo. The Unity assemblies, the editor generator, the generated scenes, and the play-mode tests are unverified. The agent's container could not reach Unity's servers and has no licence. | Open. Needs the human: `Docs/device/PHASE3.md`. |
| ENV-2 | Blocker | No Android SDK and no phone. No frame time exists anywhere. Checkpoint 1 cannot be passed by the agent. | Open. Do not invent a number. |
| UNITY-1 | P1 | The Unity-side sources are type-checked against hand-written API declarations (`tools/unity-api-stubs`), not Unity's assemblies. A wrong signature in the declarations would hide a real compile error. | Open until the first Unity compile. |
| UNITY-2 | P2 | `RenderingSetup` creates the URP renderer and tier assets from code (`ScriptableObject.CreateInstance<UniversalRendererData>`, `UniversalRenderPipelineAsset.Create`). If URP 17.3 leaves the renderer without default resources, the scene renders pink. | Open. Fallback: Create → Rendering → URP Asset (with Universal Renderer), then assign it to `VeyrQualityAssets`. |
| UNITY-3 | P2 | Package versions in `Packages/manifest.json` (URP 17.3.0, Test Framework 1.6.0, uGUI 2.0.0, Input System 1.14.0) were chosen without access to the registry. Editor-bundled packages are corrected by the editor; Input System 1.14.0 exists and supports Unity 6. | Open until first open. |
| UNITY-4 | P3 | Active Input Handling changes need an editor restart. Until then, the EventSystem's input module may warn. | By design; documented in the setup report. |
| SIM-1 | P2 | Survival drop writes a corpse record with a 10 minute lifetime. There is no mesh and no world pickup. | Open (TD-003). |
| SIM-2 | P2 | Boss movement, animation tells, and hurtboxes are data and timers. There is no presentation. | Open. Expected until Phase 10. |
| SIM-3 | P3 | Status durations, chain multiplier, durability counts, copper mana discount, and corruption prices are tuning. The bible names the systems, not the numbers. | Logged. |
| SIM-4 | P1 | No swing recovery: a client can attack as fast as stamina allows. | Open (TD-006), Phase 7. |
| SIM-5 | P3 | AI brains are not ticked by `WorldSimulation.Step`; wolves and goblins do not act on their own yet. | Phase 6 (T021–T022). |
| WEB-1 | P3 | The browser client in `web/` re-implements the rules in TypeScript. It can drift from `Veyr.Sim`. | Logged. It is a behavioural reference, not the product. |
| NAME-1 | P3 | Art-bible mesh prefixes and architecture content ids differ. Code ids follow the architecture (`wpn_cookie_blade`). | Logged. |
| DATA-1 | P3 | Abbess Renn, Speaker Nadira, Osman, and Captain Yssa are names only. Wants were not invented. | Logged. |
