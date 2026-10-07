import { registerBoss } from "../bossapi";

/**
 * Bosses beyond Cookie. Each loads with its zone (see Game.ensureZone).
 * registerBoss("boe", () => import("./boe").then((m) => m.createBoe));
 * registerBoss("finlay", () => import("./finlay").then((m) => m.createFinlay));
 */
export const BOSS_MODULES = registerBoss;
