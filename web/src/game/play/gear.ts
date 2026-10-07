import type { ItemDef } from "../data/items.ts";
import { ARMOUR_STYLES, type ArmourLook, type ArmourStyle } from "../engine/rig";

/**
 * What a character's armour looks like, from the pieces they wear, and the five-letter code
 * other players receive (head, chest, hands, legs, feet: l leather, i iron, s steel,
 * h houndhide, b Black Knight, - nothing).
 */
const ORDER = ["head", "chest", "hands", "legs", "feet"] as const;
const LETTERS = "lishb";

export function armourLook(worn: ItemDef[]): ArmourLook {
  const out: ArmourLook = {};
  for (const it of worn) {
    if (it.kind !== "armour" || !it.set) continue;
    const slot = ORDER.find((s) => s === it.slot);
    if (slot && (ARMOUR_STYLES as string[]).includes(it.set)) out[slot] = it.set as ArmourStyle;
  }
  return out;
}

export function armourCode(a: ArmourLook): string {
  return ORDER.map((s) => {
    const st = a[s];
    return st ? LETTERS[ARMOUR_STYLES.indexOf(st)] : "-";
  }).join("");
}

export function armourFromCode(code: string | undefined): ArmourLook {
  const out: ArmourLook = {};
  if (!code) return out;
  ORDER.forEach((s, i) => {
    const k = LETTERS.indexOf(code[i] ?? "-");
    if (k >= 0) out[s] = ARMOUR_STYLES[k];
  });
  return out;
}
