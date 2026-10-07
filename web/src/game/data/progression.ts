/**
 * Experience, levels and what a level gives you. Shared with the server: the server owns a
 * character's experience and computes the level from LEVEL_XP (seeded into vm_config).
 */

export const LEVEL_CAP = 20;

/** Experience needed to go from level L to L+1, for L = 1..19. */
const STEP = [100, 160, 230, 310, 400, 500, 610, 730, 860, 1000, 1150, 1310, 1480, 1660, 1850, 2050, 2260, 2480, 2710];

/** Total experience at the start of each level: LEVEL_XP[L - 1] for level L. */
export const LEVEL_XP: number[] = (() => {
  const out = [0];
  for (const s of STEP) out.push(out[out.length - 1] + s);
  return out;
})();

export function levelOf(xp: number): number {
  let l = 1;
  while (l < LEVEL_CAP && xp >= LEVEL_XP[l]) l++;
  return l;
}

/** Progress inside the current level, 0..1 (1 at the cap). */
export function levelProgress(xp: number): number {
  const l = levelOf(xp);
  if (l >= LEVEL_CAP) return 1;
  return (xp - LEVEL_XP[l - 1]) / (LEVEL_XP[l] - LEVEL_XP[l - 1]);
}

/** What a level is worth. The server uses the same health formula. */
export function statsFor(level: number) {
  const l = Math.max(1, Math.min(LEVEL_CAP, level));
  return {
    maxHp: 100 + 9 * (l - 1),
    maxStam: 100 + 3 * (l - 1),
    /** multiplies weapon damage */
    power: 1 + 0.03 * (l - 1),
    /** extra breath for Ember, once learned */
    mana: 30 + 2 * (l - 1),
  };
}

/** Damage a hit loses to armour: defence / (defence + 60). Sixty defence halves a blow. */
export function armourCut(defence: number): number {
  return defence <= 0 ? 0 : defence / (defence + 60);
}

/** Experience for a kill, by foe kind. */
export const MOB_XP: Record<string, number> = {
  wolf: 12, goblin: 14, redcap: 45, soldier: 10, mouse: 4, horse: 35, deer: 5,
  bandit: 24, deserter: 46, hound: 22, boar: 26,
  blackwolf: 34, kennel_hound: 36, kennelmaster: 220,
  drowned: 48, croc: 62, witch: 80,
  black_guard: 70, keep_knight: 110, crypt_dead: 60,
};
