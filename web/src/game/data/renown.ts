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
