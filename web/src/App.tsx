import { Backpack, Flame, Hand, Shield, Swords } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { GameApi, Hud } from "./game/Game";

const empty: Hud = {
  ready: false,
  mode: "boot",
  name: "",
  hp: 80,
  maxHp: 80,
  stam: 60,
  maxStam: 60,
  mana: 0,
  maxMana: 0,
  weapon: "Fists",
  prompt: "",
  quest: "",
  talk: "",
  talkName: "",
  toast: "",
  banner: "",
  hour: 8,
  night: false,
  place: "Hearthfen",
  ember: false,
  boss: "",
  bossHp: 0,
  bossMax: 1,
  items: [],
  crafts: [],
  floaters: [],
  hasSave: false,
  seal: false,
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiRef = useRef<GameApi | null>(null);
  const [hud, setHud] = useState<Hud>(empty);
  const [charName, setCharName] = useState("");
  const [hair, setHair] = useState<"tied" | "short">("tied");
  const stick = useRef({ id: -1, x: 0, y: 0, ox: 0, oy: 0 });
  const queued = useRef<boolean | null>(null);

  const nameRef = useRef(charName);
  const hairRef = useRef(hair);
  nameRef.current = charName;
  hairRef.current = hair;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let api: GameApi | null = null;
    void import("./game/Game").then(({ mountGame }) => {
      if (dead) return;
      const game = mountGame(canvas);
      api = game;
      apiRef.current = game;
      game.subscribe(setHud);
      if (queued.current !== null) {
        game.start({ name: nameRef.current, hair: hairRef.current, cont: queued.current });
        queued.current = null;
      }
    });
    return () => {
      dead = true;
      api?.dispose();
      apiRef.current = null;
    };
  }, []);

  const playing = hud.mode === "play" || hud.mode === "inventory" || hud.mode === "talk" || hud.mode === "dead";

  function begin(cont: boolean) {
    if (!apiRef.current) {
      queued.current = cont;
      return;
    }
    apiRef.current.start({ name: charName, hair, cont });
  }

  function onStickDown(e: ReactPointerEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    stick.current = { id: e.pointerId, x: 0, y: 0, ox: r.left + r.width / 2, oy: r.top + r.height / 2 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onStickMove(e: ReactPointerEvent) {
    if (stick.current.id !== e.pointerId) return;
    const dx = e.clientX - stick.current.ox;
    const dy = e.clientY - stick.current.oy;
    const len = Math.hypot(dx, dy) || 1;
    const cap = 42;
    const m = Math.min(1, len / cap);
    apiRef.current?.setStick((dx / len) * m, (dy / len) * m);
  }
  function onStickUp(e: ReactPointerEvent) {
    if (stick.current.id !== e.pointerId) return;
    stick.current.id = -1;
    apiRef.current?.setStick(0, 0);
  }

  const hpPct = Math.max(0, (hud.hp / hud.maxHp) * 100);
  const stPct = Math.max(0, (hud.stam / hud.maxStam) * 100);

  return (
    <main className="fixed inset-0 overflow-hidden bg-ink text-parchment select-none touch-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {hud.floaters.map((f) => (
        <span key={f.id} className="pointer-events-none absolute font-display text-parchment" style={{ left: f.x, top: f.y }}>
          {f.text}
        </span>
      ))}

      {playing && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-lg leading-none">{hud.place}</p>
              <p className="text-sm text-muted">{hud.weapon} · {formatHour(hud.hour)}{hud.night ? " · night" : ""}</p>
            </div>
            {hud.seal && <p className="text-sm text-copper">Gate open</p>}
          </div>
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-soot">
            <div className="h-full bg-nursery" style={{ width: `${hpPct}%` }} />
          </div>
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-soot">
            <div className="h-full bg-moss" style={{ width: `${stPct}%` }} />
          </div>
          {hud.maxMana > 0 && (
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-soot">
              <div className="h-full bg-copper" style={{ width: `${(hud.mana / hud.maxMana) * 100}%` }} />
            </div>
          )}
          {hud.boss && (
            <div>
              <p className="text-sm">{hud.boss}</p>
              <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-soot">
                <div className="h-full bg-bone" style={{ width: `${(hud.bossHp / hud.bossMax) * 100}%` }} />
              </div>
            </div>
          )}
          <p className="max-w-sm text-sm leading-snug text-bone">{hud.quest}</p>
        </div>
      )}

      {hud.toast && playing && (
        <p className="pointer-events-none absolute top-36 left-1/2 w-[min(90%,22rem)] -translate-x-1/2 rounded-panel bg-soot/90 px-3 py-2 text-center text-sm">
          {hud.toast}
        </p>
      )}
      {hud.banner && (
        <div className="pointer-events-auto absolute top-48 left-1/2 w-[min(92%,24rem)] -translate-x-1/2 rounded-panel border border-copper bg-ink/95 p-4">
          <p className="font-display text-lg leading-snug">{hud.banner}</p>
          <button type="button" className="mt-3 min-h-11 rounded-md bg-copper px-4 text-ink" onClick={() => apiRef.current?.press("close")}>
            Onward
          </button>
        </div>
      )}

      {hud.mode === "talk" && (
        <div className="absolute inset-x-4 bottom-36 rounded-panel bg-parchment p-4 text-ink">
          <p className="font-display text-lg">{hud.talkName}</p>
          <p className="mt-1 leading-relaxed">{hud.talk}</p>
          <button type="button" className="mt-3 min-h-11 w-full rounded-md bg-ink text-parchment" onClick={() => apiRef.current?.press("talk")}>
            Continue
          </button>
        </div>
      )}

      {hud.mode === "dead" && (
        <div className="absolute inset-x-4 bottom-40 rounded-panel bg-ink/95 p-4">
          <p className="font-display text-2xl">Down</p>
          <p className="mt-1 text-sm text-muted">Adventure keeps what you carry. Cookie, if still wound, starts the bow again.</p>
          <button type="button" className="mt-3 min-h-12 w-full rounded-md bg-parchment text-ink" onClick={() => apiRef.current?.press("wake")}>
            Wake at the pad
          </button>
        </div>
      )}

      {hud.mode === "inventory" && (
        <div className="absolute inset-x-3 bottom-28 top-28 overflow-auto rounded-panel bg-parchment p-4 text-ink">
          <div className="flex items-center justify-between">
            <p className="font-display text-xl">Pack</p>
            <button type="button" className="min-h-11 rounded-md bg-ink px-3 text-parchment" onClick={() => apiRef.current?.press("close")}>
              Close
            </button>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {hud.items.map((it) => (
              <li key={it.uid} className="flex items-center justify-between gap-2 border-b border-soot/20 pb-2">
                <span>{it.name}{it.count > 1 ? ` ×${it.count}` : ""}{it.equipped ? " · worn" : ""}</span>
                <button
                  type="button"
                  className="min-h-11 rounded-md bg-soot px-3 text-parchment"
                  onClick={() => (it.kind === "consumable" ? apiRef.current?.useUid(it.uid) : apiRef.current?.equipUid(it.uid))}
                >
                  {it.kind === "consumable" ? "Use" : it.kind === "weapon" || it.kind === "armour" ? "Wear" : "Keep"}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 font-display text-lg">Craft</p>
          <ul className="mt-2 flex flex-col gap-2">
            {hud.crafts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="text-sm">
                  {c.name}
                  <span className="block text-muted">{c.station === "bench" ? "Bench · " : "Hand · "}{c.hint}</span>
                </span>
                <button type="button" disabled={!c.ok} className="min-h-11 rounded-md bg-copper px-3 text-ink disabled:opacity-40" onClick={() => apiRef.current?.craft(c.id)}>
                  Make
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(hud.mode === "menu" || hud.mode === "boot") && (
        <div className="absolute inset-0 flex items-end justify-center bg-ink/45 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:items-center">
          <div className="w-full max-w-md rounded-panel bg-parchment p-5 text-ink">
            <p className="font-display text-4xl leading-none">VEYRMARCH</p>
            <p className="mt-2 leading-relaxed">The sealed continent. No class. A knife, a castle, a toy that still thinks it is calling the children in.</p>
            <label className="mt-4 block text-sm text-soot">
              Name
              <input
                value={charName}
                onChange={(e) => setCharName(e.target.value)}
                maxLength={18}
                placeholder="Walker"
                className="mt-1 min-h-11 w-full rounded-md border border-soot bg-bone px-3"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button type="button" className={`min-h-11 flex-1 rounded-md ${hair === "tied" ? "bg-ink text-parchment" : "bg-bone"}`} onClick={() => setHair("tied")}>Tied hair</button>
              <button type="button" className={`min-h-11 flex-1 rounded-md ${hair === "short" ? "bg-ink text-parchment" : "bg-bone"}`} onClick={() => setHair("short")}>Short hair</button>
            </div>
            <button type="button" className="mt-4 min-h-12 w-full rounded-md bg-nursery text-parchment" onClick={() => begin(false)}>
              Start
            </button>
            {hud.hasSave && (
              <button type="button" className="mt-2 min-h-12 w-full rounded-md bg-ink text-parchment" onClick={() => begin(true)}>
                Continue
              </button>
            )}
            <p className="mt-3 text-sm text-soot">Stick to walk. Full stick sprints. Strike, dodge, use. Keys: WASD, Shift sprint, J strike, K dodge, E use, I pack.</p>
          </div>
        </div>
      )}

      {hud.mode === "play" && (
        <>
          <div
            className="absolute top-28 right-4 bottom-44 left-4"
            onPointerDown={(e) => {
              const id = e.pointerId;
              const startX = e.clientX;
              const move = (ev: PointerEvent) => {
                if (ev.pointerId !== id) return;
                apiRef.current?.look(ev.clientX - startX);
              };
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          />
          <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 flex items-end gap-3">
            <div
              className="relative h-28 w-28 rounded-full border border-bone/50 bg-ink/50"
              onPointerDown={onStickDown}
              onPointerMove={onStickMove}
              onPointerUp={onStickUp}
              onPointerCancel={onStickUp}
            >
              <span className="pointer-events-none absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bone/80" />
            </div>
          </div>
          <div className="absolute right-3 bottom-[max(1rem,env(safe-area-inset-bottom))] grid grid-cols-2 gap-2">
            <Action label="Dodge" onClick={() => apiRef.current?.press("dodge")} icon={<Hand className="h-5 w-5" />} />
            <Action label={hud.prompt || "Use"} onClick={() => apiRef.current?.press("interact")} icon={<Hand className="h-5 w-5" />} />
            <Action label="Block" onPointerDown={() => apiRef.current?.press("blockDown")} onPointerUp={() => apiRef.current?.press("blockUp")} icon={<Shield className="h-5 w-5" />} />
            <Action label="Pack" onClick={() => apiRef.current?.press("bag")} icon={<Backpack className="h-5 w-5" />} />
            {hud.ember && <Action label="Ember" onClick={() => apiRef.current?.press("ember")} icon={<Flame className="h-5 w-5" />} />}
            <button
              type="button"
              className="col-span-2 flex min-h-14 items-center justify-center gap-2 rounded-panel bg-nursery text-parchment"
              onPointerDown={(e) => {
                e.preventDefault();
                apiRef.current?.press("attackDown");
              }}
              onPointerUp={() => apiRef.current?.press("attackUp")}
              onPointerLeave={() => apiRef.current?.press("attackUp")}
            >
              <Swords className="h-5 w-5" />
              Strike
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function Action({
  label,
  icon,
  onClick,
  onPointerDown,
  onPointerUp,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-h-12 min-w-16 flex-col items-center justify-center rounded-panel bg-ink/80 px-2 text-xs text-parchment"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {icon}
      {label}
    </button>
  );
}

function formatHour(h: number) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h % 1) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
