/**
 * Naming the dead. The Grave King forbade burial, so the dead of the Wasteland forgot who they were.
 * A few graves still carry a name. Take one up, say it to one of the walking dead, and it lies down for good.
 * Single-player worlds only; the names given back are kept with the codex on this device.
 */
import type { Find } from "./explore.ts";

export type Grave = Find & { kind: "grave"; name: string; said: string };

export const GRAVES: Grave[] = [
  { id: "g_waste_maren", zone: "waste", kind: "grave", x: -28, z: -112, name: "Maren Holt", text: "\"Maren Holt, miller's daughter. She carried water to the wall until there was no wall.\"", said: "It stops with its arms half raised, as if it had been carrying something." },
  { id: "g_waste_osric", zone: "waste", kind: "grave", x: 46, z: -52, name: "Osric Vane", text: "\"Osric Vane, serjeant. He was told to hold the ford. Nobody told him he could stop.\"", said: "It straightens, the way a man does when he is finally relieved." },
  { id: "g_waste_tam", zone: "waste", kind: "grave", x: -72, z: -6, name: "Tam Greel", text: "\"Tam Greel, aged eleven. Drummer. Kept time to the end.\"", said: "It was very small, under all that." },
  { id: "g_waste_ysolde", zone: "waste", kind: "grave", x: 84, z: 12, name: "Ysolde Marr", text: "\"Ysolde Marr, who dug every grave in this row but her own.\"", said: "It looks at the row of stones, and seems to count them." },
  { id: "g_waste_brann", zone: "waste", kind: "grave", x: -36, z: 70, name: "Brann Dace", text: "\"Brann Dace. Owed money in three towns. Paid in full here.\"", said: "It laughs, or the wind does. Then nothing." },
  { id: "g_waste_edda", zone: "waste", kind: "grave", x: 30, z: 108, name: "Edda Thorne", text: "\"Edda Thorne, last to leave the Citadel gate. She was not leaving.\"", said: "It turns once toward the Citadel, and lets go." },
];

/** The dead who can still be told who they were: the rank and file, not their captains or what calls them. */
export const NAMEABLE = ["skeleton", "zombie", "undead_knight", "crypt_dead", "drowned"];
export const canName = (kind: string) => NAMEABLE.includes(kind);

/** Crowns left on the grave by whoever is glad of it, and a larger thanks when the last name is given back. */
export const NAME_CROWNS = 40;
export const NAME_ALL: [string, number][] = [["coin_crown", 300], ["cons_last_rites", 2]];

export const laid = (nd: string[] | undefined, id: string) => !!nd?.includes(id);
export const namesLeft = (nd: string[] | undefined) => GRAVES.filter((g) => !laid(nd, g.id)).length;

/** What the stone offers as you stand at it. */
export function graveLabel(g: Grave, nd: string[] | undefined, carried: string): string | null {
  if (laid(nd, g.id)) return null;
  if (carried === g.id) return null;
  return `Take up the name: ${g.name}`;
}
