// How well a creature is known (bestiary ranks) and what the March's people say about the marks you carry.
import type { MarkView } from "./marks.ts";

export const STUDY_AT = 10;
export const MASTER_AT = 50;
export const STUDY_NAMES = ["Unmet", "Seen", "Known", "Studied", "Mastered"];

/** 0 unmet, 1 seen, 2 known (one kill), 3 studied, 4 mastered. A boss is fully known once beaten. */
export function studyRank(kills: number, seen: boolean, boss: boolean): number {
  if (kills <= 0) return seen ? 1 : 0;
  if (boss || kills >= MASTER_AT) return 4;
  return kills >= STUDY_AT ? 3 : 2;
}

export type BeastFacts = { hp: number; fireWeak: number; loot: string[]; attacks: { name: string; tell: number }[] };

/** What the page shows beyond the lore: health, weakness and spoils once studied, its blows once mastered. */
export function studyNotes(rank: number, f: BeastFacts | undefined): string[] {
  if (!f || rank < 3) return [];
  const out = [`Health ${f.hp}.` + (f.fireWeak > 1 ? ` Fire hurts it ${Math.round((f.fireWeak - 1) * 100)}% more.` : f.fireWeak < 1 ? " Fire does little to it." : "")];
  if (f.loot.length) out.push("Carries: " + f.loot.join(", ") + ".");
  if (rank >= 4 && f.attacks.length) out.push("Blows: " + f.attacks.map((a) => `${a.name} (${a.tell.toFixed(2)}s warning)`).join(", ") + ".");
  return out;
}

export function studyNext(rank: number, kills: number): string {
  if (rank === 2) return `Studied at ${STUDY_AT} kills (${kills}/${STUDY_AT}): health, weakness and spoils.`;
  if (rank === 3) return `Mastered at ${MASTER_AT} kills (${kills}/${MASTER_AT}): every blow and its warning.`;
  return "";
}

const SAID: Record<string, [string, string, string]> = {
  beast: ["You smell of wolf. The dogs went quiet when you came up the lane.", "Hunters ask after you by name now. The woods are thinner for it.", "They say the beasts know your step and leave by the far side of the hill."],
  grave: ["There's grave-dirt under your nails. Wash before you eat.", "The dead stay down when you put them down. Not everyone manages that.", "The sexton says he sleeps sound now. He says it's on your account."],
  men: ["You watch hands, not faces. Somebody taught you that the hard way.", "Outlaws on the south road have started asking which way you went.", "There's a price on you in the Keep, I hear. A flattering one."],
  toys: ["Is that sawdust on your sleeve?", "The children say you break toys. They say it like a ghost story.", "Cookie's whole nursery knows your face. Tin remembers."],
  hand: ["Steady hands. You'd make a decent thatcher.", "I saw you turn a blade with your wrist. Didn't know that could be done.", "They say you can't be hit from the front. I say don't test it, but they say it."],
  step: ["Light on your feet, aren't you.", "You were there, and then you weren't. Unsettling in a house guest.", "Folk swear the blades pass through you. I've stopped arguing."],
  buried: ["You've the look of someone who's been dead and didn't care for it.", "How many times is it now? The shrine-keeper has stopped counting.", "The March keeps burying you and you keep coming back up. Like turnips."],
  warden: ["So it's true about the big one. I'd have run.", "Two of the great ones down. People stand a little straighter when you pass.", "There'll be a song. It'll get the details wrong, but there'll be a song."],
  maker: ["You've a maker's calluses. Good. Fighters are no use on a Tuesday.", "That's your own work you're wearing? Tidy stitching.", "Tanic says you could run the lane. He says it quietly, mind."],
  way: ["Strange mud on those boots. Not from round here.", "You've been further than anyone I know, and I know a carter.", "Is there anywhere you haven't walked? Don't answer, I'd only worry."],
};

/**
 * What a villager remarks on: the highest-ranked mark (the earliest listed wins a tie).
 * `key` changes when there is something new to say, so the same remark is not repeated to the same person.
 */
export function remark(marks: MarkView[]): { key: string; line: string } | null {
  let best: MarkView | null = null;
  for (const m of marks) if (m.rank > 0 && SAID[m.id] && (!best || m.rank > best.rank)) best = m;
  return best ? { key: `${best.id}${best.rank}`, line: SAID[best.id][best.rank - 1] } : null;
}

export const REMARK_IDS = Object.keys(SAID);

/** Hidden places (the one-time caches, bar your own chest at home) and the rumour that points at each. Keyed by cache id. */
export type Rumour = { zone: string; name: string; line: string };
export const RUMOURS: Record<string, Rumour> = {
  hollow: { zone: "over", name: "The giant's hollow", line: "The biggest tree in the deep forest is hollow at the root. North, past the creek, where the redcaps are. Things get hidden in there." },
  mill_loft: { zone: "kingdom", name: "The mill loft", line: "In the Kingdom there's a mill out west whose miller never came back for his savings. Try the loft." },
  bandit_strongbox: { zone: "kingdom", name: "The bandits' strongbox", line: "The outlaws east of the Kingsroad keep what they take in one box. They're poor guards of it." },
  lodge_cellar: { zone: "hunt", name: "The lodge cellar", line: "The king's hunting lodge had a cellar, south-west in the Blackwood. The huntsmen left in a hurry." },
  kennel_secret: { zone: "kennel", name: "The kennelmaster's store", line: "The kennelmaster kept his good steel where the hounds couldn't get it. Somewhere off the main run." },
  drear_reliquary: { zone: "mire", name: "The drowned reliquary", line: "There was a chapel in the Mire before the water came. Its reliquary is still dry, they say, off to the north-west." },
  armoury_rack: { zone: "keep", name: "The armoury rack", line: "The Black Keep's armoury was never emptied. Nobody was left to give the order." },
  crypt_tomb: { zone: "keep", name: "The crypt tomb", line: "Under the Keep, at the far end of the crypt, one tomb was sealed with the pay chest inside. Soldiers talk." },
  mass_grave: { zone: "waste", name: "The mass grave", line: "Out west on the ash they buried a whole company with its purse. Nobody dug it up. Nobody wanted to." },
  tower_reliquary: { zone: "waste", name: "The watchtower reliquary", line: "There's a broken tower south-east on the Wasteland. Whatever the priests carried up there never came down." },
  ossuary_coffer: { zone: "citadel", name: "The ossuary coffer", line: "In the Dead Citadel the bones are stacked to the ceiling, and behind them there's a coffer. That's the story, anyway." },
};

/** The next rumour worth telling: not yet heard, not yet found, this land's first and otherwise in the order of the road. */
export function nextRumour(zone: string, heard: string[], found: (id: string) => boolean): string | null {
  const open = Object.keys(RUMOURS).filter((id) => !heard.includes(id) && !found(id));
  return open.find((id) => RUMOURS[id].zone === zone) ?? open[0] ?? null;
}

export type PlaceView = { id: string; name: string; line: string; heard: boolean; found: boolean };
export function placesView(heard: string[], found: (id: string) => boolean): PlaceView[] {
  return Object.entries(RUMOURS).map(([id, r]) => ({ id, name: r.name, line: r.line, heard: heard.includes(id), found: found(id) }));
}

/** What the March calls you: a name earned from your strongest mark. Ties go to the order the marks are listed in. */
const TITLES: Record<string, [string, string, string]> = {
  beast: ["Wolf-Reeker", "Beast-Blooded", "Terror of the Tree Line"],
  grave: ["Grave-Dirty", "Gravewise", "The Sexton's Rest"],
  men: ["Hand-Watcher", "Manhunter", "The Price on the South Road"],
  toys: ["Sawdust-Sleeved", "Nursery-Wise", "Breaker of Tin"],
  hand: ["Steady-Handed", "Still Hand", "Unstruck from the Front"],
  step: ["Light-Footed", "Ghoststep", "The One Blades Pass Through"],
  buried: ["Once-Buried", "Much-Buried", "The Turnip"],
  warden: ["Giant-Feller", "Warden's Bane", "The One in the Song"],
  maker: ["Callus-Handed", "Maker's Hands", "Master of the Lane"],
  way: ["Strange-Mudded", "Wayfarer", "Walker of Every Road"],
};
export const UNMARKED = "the Unmarked";
export const TITLE_IDS = Object.keys(TITLES);

export function epithet(marks: MarkView[]): string {
  let best: MarkView | null = null;
  for (const m of marks) if (m.rank > 0 && TITLES[m.id] && (!best || m.rank > best.rank)) best = m;
  return best ? TITLES[best.id][best.rank - 1] : UNMARKED;
}

export type Card = { title: string; lines: [string, string][] };
/** The character card: your earned name and the record behind it. */
export function cardView(marks: MarkView[], r: { level: number; kills: number; deaths: number; bosses: number; lands: number; places: number; placesOf: number; dodges: number; parries: number }): Card {
  const ranks = marks.reduce((n, m) => n + m.rank, 0);
  return {
    title: epithet(marks),
    lines: [
      ["Level", String(r.level)],
      ["Mark ranks", `${ranks}/${marks.length * 3}`],
      ["Foes felled", String(r.kills)],
      ["Great ones felled", String(r.bosses)],
      ["Times buried", String(r.deaths)],
      ["Blows turned", String(r.parries)],
      ["Blows slipped", String(r.dodges)],
      ["Lands walked", String(r.lands)],
      ["Hidden places", `${r.places}/${r.placesOf}`],
    ],
  };
}
