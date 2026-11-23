// The bestiary and the deeds: what a character has met, killed and done.
// Kept per character on this device (it is a record for the player, not a rule of the world).

import { CACHES, STONES } from "./explore.ts";

export type Beast = { name: string; where: string; lore: string; boss?: boolean };

export const BEASTS: Record<string, Beast> = {
  wolf: { name: "Forest Wolf", where: "Hearthfen forest", lore: "Circles before it pounces. Step aside as it crouches, then answer. Fire sends it back." },
  goblin: { name: "Goblin", where: "Hearthfen forest", lore: "Quick knife, thin skin. It stabs in a line; side-step and it has nothing left." },
  redcap: { name: "Redcap", where: "Deep forest", lore: "A slow overhead slam that shakes the ground. Roll through it and strike its back." },
  soldier: { name: "Toy Soldier", where: "The Nursery", lore: "Painted tin and a bayonet. It only knows how to march forward." },
  mouse: { name: "Clockwork Mouse", where: "The Nursery", lore: "Small, fast and in numbers. A wide swing clears them." },
  horse: { name: "Rocking Horse", where: "The Nursery", lore: "It rocks before it charges. Stand by a wall and let it meet the wall." },
  deer: { name: "Deer", where: "The King's Hunt", lore: "It runs. Venison for the pot and hide for the tanner." },
  bandit: { name: "Road Bandit", where: "The King's road", lore: "A slash and a long lunge. Block the first, punish the second." },
  deserter: { name: "Deserter", where: "The King's road", lore: "Trained with a spear and tired of it. Keep inside his reach." },
  hound: { name: "Feral Hound", where: "The King's Hunt", lore: "A wolf that once had a master. Its pounce carries its whole weight." },
  boar: { name: "Wild Boar", where: "The King's Hunt", lore: "Charges in a straight line and cannot turn. Do not be in the line." },
  blackwolf: { name: "Black Wolf", where: "The King's Hunt", lore: "Bigger, darker, patient. Three attacks and it uses all of them." },
  kennel_hound: { name: "Kennel Hound", where: "The Kennels", lore: "Bred for the hunt and fed too little. They come in pairs." },
  kennelmaster: { name: "Kennelmaster", where: "The Kennels", lore: "A long whip and a heavy boot. Close the distance; the whip is worst at its tip." },
  drowned: { name: "Drowned One", where: "The Mire", lore: "It grabs, then it slams. The water gave it back, but not all of it." },
  croc: { name: "Mire Crocodile", where: "The Mire", lore: "The bite is slow and the tail is not. Stay at its shoulder." },
  witch: { name: "Mire Witch", where: "The Mire", lore: "Her hex lands where you stood. Keep moving and close in while she casts." },
  black_guard: { name: "Black Guard", where: "The Black Keep", lore: "Shield, spear and discipline. Parry the thrust or wait out the overhand." },
  keep_knight: { name: "Keep Knight", where: "The Black Keep", lore: "A cleave that reaches further than it looks. Roll toward him, not away." },
  crypt_dead: { name: "Crypt Dead", where: "The Black Keep", lore: "Old soldiers who never left their post. They hack until they fall apart." },
  skeleton: { name: "Skeleton", where: "The Undead Wasteland", lore: "The ash road's garrison. Blunt weapons break them quickest." },
  zombie: { name: "Unburied", where: "The Undead Wasteland", lore: "Villagers nobody gave the rites. Slow, strong, and they do not flinch." },
  ghost: { name: "Ash Ghost", where: "The Undead Wasteland", lore: "Its wail lands where you were. It hates fire and it hates the dawn." },
  necromancer: { name: "Necromancer", where: "The Undead Wasteland", lore: "Soulfire from the tower tops. Kill the caster and the green lights go out." },
  undead_knight: { name: "Undead Knight", where: "The Dead Citadel", lore: "The Grave King's household. The cleave still has a knight's reach." },
  standard_bearer: { name: "The Standard Bearer", where: "The Dead Citadel", lore: "He plants the banner and the ground answers. Be elsewhere when it lands." },
  grave_confessor: { name: "The Grave Confessor", where: "The Bone Gate", lore: "While he chants, the gate stays shut. End the sermon." },
  boss_cookie: { name: "Evil Toy Penguin Caller Cookie", where: "The Nursery", lore: "It bows. Then the toys stand up.", boss: true },
  boss_boe: { name: "Boe, the Collared Hound", where: "The Kennels", lore: "He wags. The collar glows.", boss: true },
  boss_finlay: { name: "Finlay, Captain of the March", where: "The Black Keep", lore: "He is already here. He is furious you are late.", boss: true },
  boss_grave_king: { name: "The Grave King", where: "The Dead Citadel", lore: "The court kneels. The femurs creak. He stands.", boss: true },
};

export type Codex = {
  /** kills by mob kind (bosses as boss_<id>) */
  k: Record<string, number>;
  /** kinds seen up close but not yet killed */
  s: string[];
  /** zones walked */
  z: string[];
  crafts: number;
  parries: number;
  /** attacks rolled through */
  dodges: number;
  /** times fallen */
  falls: number;
  /** highest rank already announced for each mark */
  m: Record<string, number>;
  /** rumours heard (cache ids) */
  r: string[];
  /** hidden places found (cache ids) */
  f: string[];
  /** deeds done */
  d: string[];
  /** hints already shown */
  t: string[];
  /** talent ranks */
  tal?: Record<string, number>;
  /** hidden caches opened and lore stones read */
  fd?: string[];
  /** bounties: board stamp, the three picked, progress and which are paid */
  b?: { day: string; ids: string[]; n: number[]; paid: boolean[] };
  /** graves whose name has been given back to one of the dead */
  nd?: string[];
  /** ore walls broken open */
  mg?: string[];
  /** when this record was last saved (ms), to choose between the device copy and the save copy */
  at?: number;
  /** bounty boards posted so far */
  bn?: number;
};

export const freshCodex = (): Codex => ({ k: {}, s: [], z: [], crafts: 0, parries: 0, dodges: 0, falls: 0, m: {}, r: [], f: [], d: [], t: [] });

export type DeedCtx = { c: Codex; level: number; shrines: number; deaths: number; kills: number };
export type Deed = { id: string; name: string; text: string; ok: (x: DeedCtx) => boolean };

const sum = (c: Codex, kinds: string[]) => kinds.reduce((n, k) => n + (c.k[k] ?? 0), 0);
const UNDEAD = ["skeleton", "zombie", "ghost", "necromancer", "undead_knight", "standard_bearer", "grave_confessor", "crypt_dead", "drowned"];

export const DEEDS: Deed[] = [
  { id: "first_blood", name: "First Blood", text: "Kill your first foe.", ok: (x) => x.kills >= 1 },
  { id: "hunter", name: "Hunter", text: "Kill 50 foes.", ok: (x) => x.kills >= 50 },
  { id: "reaper", name: "Reaper", text: "Kill 250 foes.", ok: (x) => x.kills >= 250 },
  { id: "wolfsbane", name: "Wolfsbane", text: "Kill 15 wolves and hounds.", ok: (x) => sum(x.c, ["wolf", "hound", "blackwolf", "kennel_hound"]) >= 15 },
  { id: "gravedigger", name: "Gravedigger", text: "Put 40 of the dead back down.", ok: (x) => sum(x.c, UNDEAD) >= 40 },
  { id: "towers_dark", name: "Lights Out", text: "Kill 3 necromancers.", ok: (x) => (x.c.k.necromancer ?? 0) >= 3 },
  { id: "toy_breaker", name: "Toy Breaker", text: "Defeat Caller Cookie.", ok: (x) => !!x.c.k.boss_cookie },
  { id: "good_boy", name: "Good Boy", text: "Defeat Boe, the Collared Hound.", ok: (x) => !!x.c.k.boss_boe },
  { id: "late", name: "Fashionably Late", text: "Defeat Finlay, Captain of the March.", ok: (x) => !!x.c.k.boss_finlay },
  { id: "kingslayer", name: "Kingslayer", text: "Defeat the Grave King.", ok: (x) => !!x.c.k.boss_grave_king },
  { id: "scholar", name: "Scholar of Teeth", text: "Fill 15 bestiary pages.", ok: (x) => Object.keys(x.c.k).length >= 15 },
  { id: "naturalist", name: "Naturalist", text: "Fill every bestiary page.", ok: (x) => Object.keys(BEASTS).every((k) => !!x.c.k[k]) },
  { id: "wanderer", name: "Wanderer", text: "Walk 5 different lands.", ok: (x) => x.c.z.length >= 5 },
  { id: "cartographer", name: "Cartographer", text: "Walk every land.", ok: (x) => x.c.z.length >= 9 },
  { id: "pilgrim", name: "Pilgrim", text: "Rest at 4 shrines.", ok: (x) => x.shrines >= 4 },
  { id: "smith", name: "Maker", text: "Craft 10 things.", ok: (x) => x.c.crafts >= 10 },
  { id: "artisan", name: "Artisan", text: "Craft 40 things.", ok: (x) => x.c.crafts >= 40 },
  { id: "duelist", name: "Duelist", text: "Parry 10 blows.", ok: (x) => x.c.parries >= 10 },
  { id: "lvl10", name: "Seasoned", text: "Reach level 10.", ok: (x) => x.level >= 10 },
  { id: "lvl20", name: "Veteran", text: "Reach level 20.", ok: (x) => x.level >= 20 },
  { id: "lvl25", name: "Unmarked No Longer", text: "Reach level 25.", ok: (x) => x.level >= 25 },
  { id: "seeker", name: "Seeker", text: "Open 5 hidden caches.", ok: (x) => (x.c.fd ?? []).filter((f) => f.startsWith("c_")).length >= 5 },
  { id: "hoarder", name: "Nothing Left Buried", text: "Open every hidden cache.", ok: (x) => (x.c.fd ?? []).filter((f) => f.startsWith("c_")).length >= CACHES },
  { id: "lorekeeper", name: "Lorekeeper", text: "Read every rune stone.", ok: (x) => (x.c.fd ?? []).filter((f) => f.startsWith("s_")).length >= STONES },
  { id: "bountyman", name: "Paid in Full", text: "Claim all three bounties in one day.", ok: (x) => !!x.c.b && x.c.b.paid.length >= 3 && x.c.b.paid.every(Boolean) },
  { id: "stubborn", name: "Stubborn", text: "Fall 10 times and get back up.", ok: (x) => x.deaths >= 10 },
];

/** Shown once each, the first time the moment comes up. */
export const TIPS: Record<string, string> = {
  fight: "Tap to strike, hold for a heavy blow. Roll through an attack as it lands.",
  block: "Hold block to guard. Raise it just as the blow lands to parry.",
  hurt: "Low health. Drink a draught from the bag, or rest at a shrine.",
  node: "Ore, trees and herbs can be gathered. Better picks and axes cut richer ones.",
  shrine: "Shrines heal you, set where you wake, and let you travel between them.",
  station: "Benches, forges and pots craft gear from what you gather. Open the bag beside one.",
  level: "Each level raises health and stamina. The journal lists your quests, bestiary and deeds.",
  find: "Something glints off the road. Caches hold supplies and coin; rune stones tell the land's story.",
  talent: "You have a talent point. Open the journal and choose where your strength goes.",
  back: "Blows to a foe's back, or to one that is reeling, cut deeper.",
  elite: "A named foe. They hit harder, drop better, and some gates wait on them.",
  radar: "The minimap shows foes in red, people in gold, shrines in blue and your goal as a diamond.",
};

const KEY = "veyrmarch.codex.";

/**
 * Single player keeps each character's codex in the world database as well as in local storage,
 * so a backup of the save carries it. The database copies are read once when the save opens
 * (`primeCodex`) and written through `sink`; whichever copy was written last is the one used.
 */
const primed = new Map<string, string>();
let sink: ((id: string, json: string) => void) | null = null;

export function primeCodex(rows: Iterable<[string, string]>, write: ((id: string, json: string) => void) | null) {
  primed.clear();
  for (const [id, json] of rows) primed.set(id, json);
  sink = write;
}

function parse(raw: string | null | undefined): Partial<Codex> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Codex>;
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

/** Of two copies of a codex, the one saved last; a copy with no stamp predates stamps and loses to one that has it. */
export function newerCodex(a: string | null | undefined, b: string | null | undefined): string | null {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa) return pb ? b! : null;
  if (!pb) return a!;
  return (pb.at ?? 0) > (pa.at ?? 0) ? b! : a!;
}

export function loadCodex(id: string): Codex {
  let local: string | null = null;
  try {
    local = localStorage.getItem(KEY + id);
  } catch {
    /* private mode: only the save's copy, if any */
  }
  const got = parse(newerCodex(local, primed.get(id)));
  return got ? { ...freshCodex(), ...got } : freshCodex();
}

export function saveCodex(id: string, c: Codex) {
  c.at = Date.now();
  const json = JSON.stringify(c);
  try {
    localStorage.setItem(KEY + id, json);
  } catch {
    /* private mode */
  }
  if (sink) {
    primed.set(id, json);
    sink(id, json);
  }
}
