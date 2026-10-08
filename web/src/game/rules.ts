import { ITEMS, RECIPES, type ItemDef, type RecipeDef } from "./content.ts";

export type Stack = { uid: string; def: string; count: number; equipped: boolean; /** a modifier (data/items.ts MODIFIERS) */ mod?: string | null };

export function item(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error("unknown item " + id);
  return d;
}

export function countOf(items: readonly Stack[], def: string): number {
  let n = 0;
  for (const s of items) if (s.def === def) n += s.count;
  return n;
}

export function addItem(items: Stack[], def: string, n: number, uid: () => string): Stack[] {
  const d = item(def);
  const next = items.map((s) => ({ ...s }));
  if (d.stack > 1) {
    const stack = next.find((s) => s.def === def && s.count < d.stack);
    if (stack) {
      const room = d.stack - stack.count;
      const take = Math.min(room, n);
      stack.count += take;
      n -= take;
      if (n <= 0) return next;
    }
  }
  if (d.soulbound && next.some((s) => s.def === def)) return next;
  while (n > 0) {
    const take = Math.min(n, Math.max(1, d.stack));
    next.push({ uid: uid(), def, count: take, equipped: false });
    n -= take;
  }
  return next;
}

export function consume(items: Stack[], def: string, n: number): Stack[] | null {
  if (countOf(items, def) < n) return null;
  const next = items.map((s) => ({ ...s }));
  let left = n;
  for (const s of next) {
    if (s.def !== def || left <= 0) continue;
    const take = Math.min(s.count, left);
    s.count -= take;
    left -= take;
  }
  return next.filter((s) => s.count > 0);
}

export function tryCraft(
  items: Stack[],
  recipeId: string,
  station: "hand" | "bench" | "forge",
  uid: () => string,
): { items: Stack[]; ok: boolean; reason: string; made?: string } {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return { items, ok: false, reason: "recipe" };
  if (recipe.station !== "hand" && station !== recipe.station) return { items, ok: false, reason: "station" };
  let next = items.map((s) => ({ ...s }));
  for (const input of recipe.inputs) {
    const consumed = consume(next, input.id, input.n);
    if (!consumed) return { items, ok: false, reason: "materials" };
    next = consumed;
  }
  const had = countOf(next, recipe.out);
  next = addItem(next, recipe.out, 1, uid);
  if (countOf(next, recipe.out) === had && item(recipe.out).soulbound) {
    return { items: next, ok: true, reason: "owned", made: recipe.out };
  }
  return { items: next, ok: true, reason: "", made: recipe.out };
}

export function equipped(items: readonly Stack[], slot: "main" | "off"): Stack | undefined {
  return items.find((s) => s.equipped && item(s.def).slot === slot);
}

export function equip(items: Stack[], uid: string): Stack[] {
  const target = items.find((s) => s.uid === uid);
  if (!target) return items;
  const d = item(target.def);
  if (d.slot === "none" && d.kind !== "consumable") return items;
  return items.map((s) => {
    if (s.uid === uid) return { ...s, equipped: d.kind !== "consumable" };
    if (d.slot !== "none" && item(s.def).slot === d.slot) return { ...s, equipped: false };
    return { ...s };
  });
}

/** Faithful slice formula: skill, heavy, weakness, block, then diminishing defence. Minimum 1 if it connects. */
export function strikeDamage(opts: {
  weapon: ItemDef;
  heavy: boolean;
  skillRank: number;
  weakness: boolean;
  blocking: boolean;
  shield: boolean;
  defence: number;
  defenceK?: number;
}): number {
  let raw = opts.weapon.damage * (opts.heavy ? 1.6 : 1);
  raw *= 1 + 0.05 * opts.skillRank;
  if (opts.weakness) raw *= 1.25;
  if (opts.blocking && opts.shield) raw *= 0.35;
  else if (opts.blocking) raw = raw;
  const k = opts.defenceK ?? 40;
  if (!opts.blocking && opts.defence > 0) {
    raw *= 1 - opts.defence / (opts.defence + k);
  }
  return Math.max(1, Math.round(raw));
}

export function grantUniques(items: Stack[], ids: string[], uid: () => string): { items: Stack[]; minted: string[] } {
  let next = items;
  const minted: string[] = [];
  for (const id of ids) {
    if (countOf(next, id) > 0) continue;
    next = addItem(next, id, 1, uid);
    minted.push(id);
  }
  return { items: next, minted };
}

export function gateOpen(seals: readonly string[]): boolean {
  return seals.includes("seal_cookie");
}

export function canMine(nodeTier: number, needSeal: string | null, toolTier: number, seals: readonly string[]): string {
  if (needSeal && !seals.includes(needSeal)) return "sealed";
  if (toolTier < nodeTier) return "tier";
  return "";
}

export function recipeHint(recipe: RecipeDef, items: readonly Stack[]): string {
  return recipe.inputs
    .map((i) => `${item(i.id).name} ${countOf(items, i.id)}/${i.n}`)
    .join(" · ");
}
