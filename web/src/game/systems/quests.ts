import { QUESTS, QUEST_BY_ID, type QuestDef, type QuestStep } from "../data/quests.ts";
import { ZONES, type ZoneId } from "../data/zones.ts";

/**
 * The client's view of quests: which step you are on, whether it looks done from here, and what
 * to show. The server decides; this only knows when it is worth asking (vm_quest 'step').
 */

export type QuestState = { s: number; b: number; done: boolean };
export type QuestBook = Record<string, QuestState>;

/** What the client can see of the world when judging a step. */
export type QuestCtx = {
  level: number;
  zone: ZoneId;
  x: number;
  z: number;
  count: (item: string) => number;
  charFlag: (f: string) => boolean;
  worldFlag: (f: string) => boolean;
  kills: (kind: string) => number;
  /** paid for this boss in this world (its flag is set and the reward came) */
  boss: (id: string) => boolean;
};

export const isActive = (book: QuestBook, id: string) => !!book[id] && !book[id].done;
export const isDone = (book: QuestBook, id: string) => !!book[id]?.done;

export function stepOf(book: QuestBook, q: QuestDef): QuestStep | null {
  const st = book[q.id];
  if (!st || st.done) return null;
  return q.steps[st.s] ?? null;
}

export function canStart(book: QuestBook, q: QuestDef, level: number) {
  return !book[q.id] && q.requires.every((r) => isDone(book, r)) && level >= q.level;
}

const anyCount = (ctx: QuestCtx, item: string) => item.split("|").reduce((n, id) => Math.max(n, ctx.count(id)), 0);

/** True when a step looks satisfied from here (talk and give steps are judged at the NPC). */
export function looksDone(step: QuestStep, st: QuestState, ctx: QuestCtx): boolean {
  switch (step.k) {
    case "talk":
    case "give":
      return false;
    case "cflag":
      return ctx.charFlag(step.flag!);
    case "have":
      return anyCount(ctx, step.item!) >= (step.n ?? 1);
    case "kill":
      return ctx.kills(step.kind!) - st.b >= (step.n ?? 1);
    case "reach":
      if (ctx.zone !== step.zone) return false;
      if (step.x === undefined || step.z === undefined) return true;
      return Math.hypot(ctx.x - (ZONES[step.zone!].ox + step.x), ctx.z - step.z) < (step.r ?? 10);
    case "flag":
      return ctx.worldFlag(step.flag!);
    case "boss":
      return ctx.boss(step.boss!);
    case "level":
      return ctx.level >= (step.n ?? 1);
  }
}

/** A later state-based step already holds (a veteran is not sent back): the server accepts it too. */
export function aheadDone(q: QuestDef, st: QuestState, ctx: QuestCtx): boolean {
  for (let i = st.s + 1; i < q.steps.length; i++) {
    const s = q.steps[i];
    if ((s.k === "flag" || s.k === "boss" || s.k === "cflag" || s.k === "level") && looksDone(s, st, ctx)) return true;
  }
  return false;
}

/** Quests worth asking the server to advance right now. */
export function readyToStep(book: QuestBook, ctx: QuestCtx): string[] {
  const out: string[] = [];
  for (const q of QUESTS) {
    const st = book[q.id];
    if (!st || st.done) continue;
    const step = q.steps[st.s];
    if (step && (looksDone(step, st, ctx) || aheadDone(q, st, ctx))) out.push(q.id);
  }
  return out;
}

/** Main-road quests with nothing to say start by themselves once the road before is walked. */
export function autoStarts(book: QuestBook, level: number): string[] {
  return QUESTS.filter((q) => q.main && q.offer.length === 0 && canStart(book, q, level)).map((q) => q.id);
}

/** What an NPC has for you: a quest to offer, a step that is about them, or nothing. */
export function npcBusiness(book: QuestBook, npc: string, level: number, ctx: QuestCtx):
  | { kind: "offer"; quest: QuestDef }
  | { kind: "step"; quest: QuestDef; step: QuestStep; ready: boolean }
  | null {
  for (const q of QUESTS) {
    const st = book[q.id];
    if (!st || st.done) continue;
    const step = q.steps[st.s];
    if (!step || step.npc !== npc || (step.k !== "talk" && step.k !== "give")) continue;
    const ready = step.k === "talk" || anyCount(ctx, step.item!) >= (step.n ?? 1);
    return { kind: "step", quest: q, step, ready };
  }
  for (const q of QUESTS) if (q.giver === npc && q.offer.length && canStart(book, q, level)) return { kind: "offer", quest: q };
  return null;
}

/** The quest the HUD follows: the first live main quest, else the first live side quest. */
export function tracked(book: QuestBook): QuestDef | null {
  for (const q of QUESTS) if (q.main && isActive(book, q.id)) return q;
  for (const q of QUESTS) if (isActive(book, q.id)) return q;
  return null;
}

/**
 * What to do when no quest is live: the main road's next quest that starts by itself (its
 * first step still open), else a quest giver worth seeing now, else the level the next one
 * needs.
 */
export type NextWork =
  | { kind: "auto"; quest: QuestDef; step: QuestStep }
  | { kind: "talk"; quest: QuestDef }
  | { kind: "level"; quest: QuestDef };

export function nextWork(book: QuestBook, ctx: QuestCtx, giverZone: (npc: string) => ZoneId | null = () => null): NextWork | null {
  const open = QUESTS.filter((q) => !book[q.id] && q.requires.every((r) => isDone(book, r)));
  if (!open.length) return null;
  const here = (q: QuestDef) => giverZone(q.giver) === ctx.zone;
  // work you can take now: the main road first, then whoever is nearby; otherwise the lowest level away
  const rank = (q: QuestDef) => (ctx.level >= q.level ? [0, Number(!q.main), Number(!here(q)), q.level] : [1, q.level, Number(!q.main), Number(!here(q))]);
  const sorted = open
    .map((q, i) => ({ q, r: [...rank(q), i] }))
    .sort((a, b) => {
      for (let k = 0; k < a.r.length; k++) if (a.r[k] !== b.r[k]) return a.r[k] - b.r[k];
      return 0;
    });
  const q = sorted[0].q;
  if (ctx.level < q.level) return { kind: "level", quest: q };
  if (q.main && q.offer.length === 0) {
    const fresh: QuestState = { s: 0, b: 0, done: false };
    const step = q.steps.find((s) => !looksDone(s, fresh, ctx)) ?? q.steps[q.steps.length - 1];
    return { kind: "auto", quest: q, step };
  }
  return { kind: "talk", quest: q };
}

export type JournalEntry = { id: string; name: string; main: boolean; done: boolean; step: string; sub: string; progress: string; stepN: number; steps: number };

export function journal(book: QuestBook, ctx: QuestCtx): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const q of QUESTS) {
    const st = book[q.id];
    if (!st) continue;
    const step = q.steps[Math.min(st.s, q.steps.length - 1)];
    out.push({
      id: q.id, name: q.name, main: q.main, done: st.done, stepN: Math.min(st.s + 1, q.steps.length), steps: q.steps.length,
      step: st.done ? "Done" : step.text, sub: st.done ? "" : step.sub, progress: st.done ? "" : progressText(step, st, ctx),
    });
  }
  // live first, the main road first among them
  return out.sort((a, b) => Number(a.done) - Number(b.done) || Number(b.main) - Number(a.main));
}

export function progressText(step: QuestStep, st: QuestState, ctx: QuestCtx): string {
  const n = step.n ?? 1;
  if (step.k === "kill") return `${Math.min(n, Math.max(0, ctx.kills(step.kind!) - st.b))}/${n}`;
  if ((step.k === "have" || step.k === "give") && n > 1) return `${Math.min(n, anyCount(ctx, step.item!))}/${n}`;
  return "";
}

export { QUEST_BY_ID };
