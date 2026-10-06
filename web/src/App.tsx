import { useEffect, useMemo, useRef, useState } from "react";
import type { GameApi, Hud, Look, Quality } from "./game/Game";
import { Controls } from "./ui/Controls";
import { Glyph, ItemIcon } from "./ui/icons";

const SKINS = ["#f0d8c0", "#e2c0a0", "#c8a080", "#a07858", "#6e4a32"];
const HAIRS = ["#2a2118", "#5a3a22", "#8a5a2a", "#b89a6a", "#9a3a22", "#d8d0c4"];
const COATS = ["#7a6248", "#5e6b45", "#6a3b2a", "#3c4458", "#8a7a5a", "#2e2a26"];
const STYLES = ["Tied", "Short", "Long", "Shaved"];
const BODIES = ["Slight", "Average", "Broad"];

const STATION_NAME: Record<string, string> = { hand: "By hand", bench: "Workbench", forge: "Mara's Forge" };

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<GameApi | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    let dispose: (() => void) | null = null;
    import("./game/Game")
      .then(({ mountGame }) => {
        if (!alive || !canvas.current || !overlay.current) return;
        try {
          const g = mountGame(canvas.current, overlay.current);
          const off = g.subscribe(setHud);
          setApi(g);
          dispose = () => {
            off();
            g.dispose();
          };
        } catch (e) {
          setError(String((e as Error)?.message ?? e));
        }
      })
      .catch((e) => setError(String(e)));
    return () => {
      alive = false;
      dispose?.();
    };
  }, []);

  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", stop);
    document.addEventListener("dblclick", stop);
    const tm = (e: TouchEvent) => {
      if ((e.target as HTMLElement)?.closest?.(".vm-scroll")) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", tm, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("dblclick", stop);
      document.removeEventListener("touchmove", tm);
    };
  }, []);

  return (
    <div className="vm-root">
      <canvas ref={canvas} className="vm-canvas" />
      <div ref={overlay} className="vm-overlay" />
      {error && <div className="vm-error">This device could not start WebGL: {error}</div>}
      {api && hud && <Screens api={api} hud={hud} />}
      {(!hud || hud.mode === "loading") && !error && <Loading progress={hud?.loading ?? 0} />}
      <div className="vm-fade" style={{ opacity: hud?.fade ?? 0 }} />
    </div>
  );
}

function Loading({ progress }: { progress: number }) {
  return (
    <div className="vm-loading">
      <div className="vm-wordmark">VEYRMARCH</div>
      <div className="vm-tagline">The Sealed Continent</div>
      <div className="vm-progress">
        <i style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="vm-hint">Raising Hearthfen…</div>
    </div>
  );
}

function Screens({ api, hud }: { api: GameApi; hud: Hud }) {
  const [screen, setScreen] = useState<"main" | "slots" | "settings">("main");
  const [pendingSlot, setPendingSlot] = useState(0);
  if (hud.mode === "loading") return null;
  if (hud.mode === "title")
    return screen === "slots" ? (
      <Slots hud={hud} api={api} back={() => setScreen("main")} onNew={(s) => { setPendingSlot(s); api.create({ body: 1, skin: 1, hair: 0, hairColor: 1, coat: 0 }); setScreen("main"); }} />
    ) : screen === "settings" ? (
      <Settings hud={hud} api={api} back={() => setScreen("main")} />
    ) : (
      <Title hud={hud} api={api} toSlots={() => setScreen("slots")} toSettings={() => setScreen("settings")} onNew={(s) => { setPendingSlot(s); api.create({ body: 1, skin: 1, hair: 0, hairColor: 1, coat: 0 }); }} />
    );
  if (hud.mode === "create") return <Creator api={api} slot={pendingSlot} back={() => api.toTitle()} />;
  return <Play api={api} hud={hud} />;
}

function Title({ hud, api, toSlots, toSettings, onNew }: { hud: Hud; api: GameApi; toSlots: () => void; toSettings: () => void; onNew: (s: number) => void }) {
  const latest = hud.slots.filter(Boolean).sort((a, b) => (b!.time ?? 0) - (a!.time ?? 0))[0];
  const free = hud.slots.findIndex((s) => !s);
  const standalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone);
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return (
    <div className="vm-title">
      <div className="vm-title-head">
        <div className="vm-wordmark big">VEYRMARCH</div>
        <div className="vm-tagline">The Sealed Continent</div>
      </div>
      <div className="vm-menu">
        {latest && (
          <button className="vm-mbtn primary" onClick={() => api.continueGame(latest.slot)}>
            Continue
            <small>
              {latest.name} · {latest.progress}
            </small>
          </button>
        )}
        <button className={`vm-mbtn ${latest ? "" : "primary"}`} onClick={() => (free >= 0 ? onNew(free) : toSlots())}>
          New Character
        </button>
        {hud.slots.some(Boolean) && (
          <button className="vm-mbtn" onClick={toSlots}>
            Characters
          </button>
        )}
        <button className="vm-mbtn" onClick={toSettings}>
          Settings
        </button>
      </div>
      <div className="vm-title-foot">
        {ios && !standalone ? "For full screen: Share → Add to Home Screen. Play in landscape." : "Best played in landscape."}
      </div>
    </div>
  );
}

function Slots({ hud, api, back, onNew }: { hud: Hud; api: GameApi; back: () => void; onNew: (s: number) => void }) {
  const [confirm, setConfirm] = useState(-1);
  return (
    <div className="vm-panel-screen">
      <div className="vm-panel wide">
        <div className="vm-panel-head">
          <h2>Characters</h2>
          <button className="vm-icon" onClick={back} aria-label="Back">
            <Glyph name="close" size={22} />
          </button>
        </div>
        <div className="vm-slots">
          {hud.slots.map((s, i) =>
            s ? (
              <div className="vm-slot" key={i}>
                <div className="vm-slot-name">{s.name}</div>
                <div className="vm-slot-meta">
                  {s.progress} · {s.place} · {fmtTime(s.time)}
                </div>
                <div className="vm-slot-actions">
                  <button className="vm-mbtn small primary" onClick={() => api.continueGame(i)}>
                    Play
                  </button>
                  {confirm === i ? (
                    <button className="vm-mbtn small danger" onClick={() => { api.deleteSlot(i); setConfirm(-1); }}>
                      Really delete
                    </button>
                  ) : (
                    <button className="vm-mbtn small" onClick={() => setConfirm(i)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button className="vm-slot empty" key={i} onClick={() => onNew(i)}>
                <span>+ New character</span>
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function Settings({ hud, api, back }: { hud: Hud; api: GameApi; back: () => void }) {
  return (
    <div className="vm-panel-screen">
      <div className="vm-panel">
        <div className="vm-panel-head">
          <h2>Settings</h2>
          <button className="vm-icon" onClick={back} aria-label="Back">
            <Glyph name="close" size={22} />
          </button>
        </div>
        <SettingsBody hud={hud} api={api} />
      </div>
    </div>
  );
}

function SettingsBody({ hud, api }: { hud: Hud; api: GameApi }) {
  return (
    <div className="vm-settings">
      <div className="vm-field">
        <label>Graphics</label>
        <div className="vm-seg">
          {(["low", "medium", "high"] as Quality[]).map((q) => (
            <button key={q} className={hud.quality === q ? "on" : ""} onClick={() => api.setQuality(q)}>
              {q[0].toUpperCase() + q.slice(1)}
            </button>
          ))}
        </div>
        <p>Low drops shadows and grass for older phones. {hud.fps ? `Now ${hud.fps} fps.` : ""}</p>
      </div>
      <div className="vm-field">
        <label>Sound</label>
        <div className="vm-seg">
          <button className={!hud.muted ? "on" : ""} onClick={() => api.setMuted(false)}>
            On
          </button>
          <button className={hud.muted ? "on" : ""} onClick={() => api.setMuted(true)}>
            Off
          </button>
        </div>
      </div>
      <div className="vm-field">
        <label>Controls</label>
        <p>
          Touch: left thumb moves (push to the edge to run), right thumb drags the view. Tap the sword for quick strikes, hold it for a heavy blow. Roll with the arrow. Hold the shield to block; block just as a blow lands to parry.
        </p>
        <p>Keyboard: WASD move, Shift run, mouse drag look, J or click attack (hold for heavy), Space roll, F block, Q Ember, E interact, H bandage, I bag, Esc pause.</p>
      </div>
    </div>
  );
}

function Creator({ api, slot, back }: { api: GameApi; slot: number; back: () => void }) {
  const [name, setName] = useState("");
  const [look, setLook] = useState<Look>({ body: 1, skin: 1, hair: 0, hairColor: 1, coat: 0 });
  const set = (p: Partial<Look>) => {
    const next = { ...look, ...p };
    setLook(next);
    api.preview(next);
  };
  return (
    <div className="vm-creator">
      <div className="vm-creator-panel vm-scroll">
        <h2>The Unmarked</h2>
        <p className="vm-sub">No class, no mark. The seals do not know you.</p>
        <div className="vm-field">
          <label>Name</label>
          <input value={name} maxLength={18} placeholder="Walker" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="vm-field">
          <label>Build</label>
          <div className="vm-seg">
            {BODIES.map((b, i) => (
              <button key={b} className={look.body === i ? "on" : ""} onClick={() => set({ body: i as 0 | 1 | 2 })}>
                {b}
              </button>
            ))}
          </div>
        </div>
        <div className="vm-field">
          <label>Skin</label>
          <div className="vm-swatches">
            {SKINS.map((c, i) => (
              <button key={c} className={look.skin === i ? "on" : ""} style={{ background: c }} onClick={() => set({ skin: i })} aria-label={"skin " + i} />
            ))}
          </div>
        </div>
        <div className="vm-field">
          <label>Hair</label>
          <div className="vm-seg">
            {STYLES.map((s, i) => (
              <button key={s} className={look.hair === i ? "on" : ""} onClick={() => set({ hair: i as 0 | 1 | 2 | 3 })}>
                {s}
              </button>
            ))}
          </div>
          <div className="vm-swatches">
            {HAIRS.map((c, i) => (
              <button key={c} className={look.hairColor === i ? "on" : ""} style={{ background: c }} onClick={() => set({ hairColor: i })} aria-label={"hair colour " + i} />
            ))}
          </div>
        </div>
        <div className="vm-field">
          <label>Coat</label>
          <div className="vm-swatches">
            {COATS.map((c, i) => (
              <button key={c} className={look.coat === i ? "on" : ""} style={{ background: c }} onClick={() => set({ coat: i })} aria-label={"coat " + i} />
            ))}
          </div>
        </div>
        <div className="vm-creator-actions">
          <button className="vm-mbtn" onClick={back}>
            Back
          </button>
          <button className="vm-mbtn primary" onClick={() => api.newGame(slot, name, look)}>
            Wake in Hearthfen
          </button>
        </div>
      </div>
    </div>
  );
}

function Compass({ hud }: { hud: Hud }) {
  const span = Math.PI * 0.9;
  const marks = useMemo(() => [["N", 0], ["E", Math.PI / 2], ["S", Math.PI], ["W", -Math.PI / 2]] as const, []);
  return (
    <div className="vm-compass">
      {marks.map(([l, a]) => {
        const rel = Math.atan2(Math.sin(a - hud.camYaw), Math.cos(a - hud.camYaw));
        if (Math.abs(rel) > span / 2) return null;
        return (
          <span key={l} className="vm-cmark" style={{ left: `${50 - (rel / span) * 100}%` }}>
            {l}
          </span>
        );
      })}
      {hud.bearing !== null && (
        <span className={`vm-cobj ${Math.abs(hud.bearing) > span / 2 ? "edge" : ""}`} style={{ left: `${50 - (Math.max(-span / 2, Math.min(span / 2, hud.bearing)) / span) * 100}%` }}>
          ◆<small>{hud.dist > 3 ? `${Math.round(hud.dist)}m` : ""}</small>
        </span>
      )}
    </div>
  );
}

function Bar({ v, max, kind }: { v: number; max: number; kind: string }) {
  return (
    <div className={`vm-vbar ${kind}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} />
    </div>
  );
}

function Play({ api, hud }: { api: GameApi; hud: Hud }) {
  const [toast, setToast] = useState("");
  const [title, setTitle] = useState<{ a: string; b: string; at: number } | null>(null);
  useEffect(() => {
    if (!hud.toast) return;
    setToast(hud.toast);
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [hud.toastId, hud.toast]);
  useEffect(() => {
    if (!hud.placeAt) return;
    setTitle({ a: hud.place, b: hud.placeSub, at: hud.placeAt });
    const t = setTimeout(() => setTitle(null), 3600);
    return () => clearTimeout(t);
  }, [hud.placeAt, hud.place, hud.placeSub]);
  const hurt = performance.now() - hud.hurtAt < 500;
  const low = hud.hp / hud.maxHp < 0.3;
  const showControls = hud.mode === "play";
  return (
    <>
      <div className={`vm-vignette ${hurt ? "hurt" : ""} ${low ? "low" : ""}`} />
      {showControls && <Controls api={api} hud={hud} />}
      <div className="vm-hud">
        <div className="vm-vitals">
          <div className="vm-name">{hud.name}</div>
          <Bar v={hud.hp} max={hud.maxHp} kind="hp" />
          <Bar v={hud.stam} max={hud.maxStam} kind="stam" />
          {hud.ember && <Bar v={hud.mana} max={hud.maxMana} kind="mana" />}
          <div className="vm-weapon">
            <ItemIcon id={hud.weaponId} size={22} />
            <span>{hud.weapon}</span>
          </div>
        </div>
        {hud.boss ? (
          <div className="vm-boss">
            <div className="vm-boss-name">{hud.boss.name}</div>
            <div className="vm-boss-bar">
              <i style={{ width: `${(hud.boss.hp / hud.boss.max) * 100}%` }} />
              <span className="pip" style={{ left: "66%" }} />
              <span className="pip" style={{ left: "33%" }} />
            </div>
            <div className="vm-boss-phase">{["", "Peck and call", "The coat opens", "The music box"][hud.boss.phase]}</div>
          </div>
        ) : (
          <div className="vm-top">
            <Compass hud={hud} />
            {hud.objective && (
              <div className="vm-objective">
                <b>{hud.objective}</b>
                <span>{hud.objectiveSub}</span>
              </div>
            )}
          </div>
        )}
        <div className="vm-topright">
          <button className="vm-icon" onClick={() => api.press("bag")} aria-label="Bag">
            <Glyph name="bag" size={24} />
          </button>
          <button className="vm-icon" onClick={() => api.press("pause")} aria-label="Menu">
            <Glyph name="menu" size={24} />
          </button>
        </div>
      </div>
      {title && (
        <div className="vm-region" key={title.at}>
          <div>{title.a}</div>
          <small>{title.b}</small>
        </div>
      )}
      {toast && hud.mode === "play" && (
        <div className="vm-toast" key={hud.toastId}>
          {toast}
        </div>
      )}
      {hud.mode === "bag" && <Bag api={api} hud={hud} />}
      {hud.mode === "talk" && hud.talk && <Talk api={api} hud={hud} />}
      {hud.mode === "dead" && (
        <div className="vm-dead">
          <div className="vm-dead-title">You fall</div>
          <p>The forest keeps what it takes. Not you. Not yet.</p>
          <button className="vm-mbtn primary" onClick={() => api.press("wake")}>
            Wake
          </button>
        </div>
      )}
      {hud.mode === "reward" && hud.reward && <Reward api={api} hud={hud} />}
      {hud.mode === "end" && <Ending api={api} hud={hud} />}
      {hud.mode === "pause" && (
        <div className="vm-panel-screen">
          <div className="vm-panel">
            <div className="vm-panel-head">
              <h2>Paused</h2>
              <button className="vm-icon" onClick={() => api.press("resume")} aria-label="Resume">
                <Glyph name="close" size={22} />
              </button>
            </div>
            <SettingsBody hud={hud} api={api} />
            <div className="vm-row">
              <button className="vm-mbtn primary" onClick={() => api.press("resume")}>
                Resume
              </button>
              <button className="vm-mbtn" onClick={() => api.toTitle()}>
                Save and quit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Bag({ api, hud }: { api: GameApi; hud: Hud }) {
  const [tab, setTab] = useState<"bag" | "craft">(hud.station !== "hand" ? "craft" : "bag");
  const [sel, setSel] = useState<string | null>(null);
  const items = hud.items.filter((i) => i.id !== "arm_cloth");
  const selected = items.find((i) => i.uid === sel) ?? null;
  const main = hud.items.find((i) => i.equipped && i.slot === "main");
  const off = hud.items.find((i) => i.equipped && i.slot === "off");
  return (
    <div className="vm-panel-screen">
      <div className="vm-panel bag">
        <div className="vm-panel-head">
          <div className="vm-tabs">
            <button className={tab === "bag" ? "on" : ""} onClick={() => setTab("bag")}>
              Bag
            </button>
            <button className={tab === "craft" ? "on" : ""} onClick={() => setTab("craft")}>
              Craft {hud.station !== "hand" && <em>· {STATION_NAME[hud.station]}</em>}
            </button>
          </div>
          <button className="vm-icon" onClick={() => api.press("close")} aria-label="Close">
            <Glyph name="close" size={22} />
          </button>
        </div>
        {tab === "bag" ? (
          <div className="vm-bag">
            <div className="vm-gear">
              <div className="vm-gslot">
                <label>Main hand</label>
                <ItemIcon id={main?.id ?? "wpn_fists"} size={40} />
                <span>{main?.name ?? "Fists"}</span>
              </div>
              <div className="vm-gslot">
                <label>Off hand</label>
                {off ? <ItemIcon id={off.id} size={40} /> : <div className="vm-empty" />}
                <span>{off?.name ?? "Empty"}</span>
              </div>
              <div className="vm-stats">
                <span>Health {hud.hp}/{hud.maxHp}</span>
                <span>Damage {main?.dmg ?? 4}</span>
              </div>
            </div>
            <div className="vm-grid vm-scroll">
              {items.length === 0 && <p className="vm-sub">Empty. Gather flint and wood in the forest.</p>}
              {items.map((i) => (
                <button key={i.uid} className={`vm-item ${sel === i.uid ? "on" : ""} ${i.equipped ? "eq" : ""}`} onClick={() => setSel(i.uid)}>
                  <ItemIcon id={i.id} size={38} />
                  {i.count > 1 && <b>{i.count}</b>}
                  {i.equipped && <em>E</em>}
                </button>
              ))}
            </div>
            <div className="vm-detail">
              {selected ? (
                <>
                  <ItemIcon id={selected.id} size={56} />
                  <h3>{selected.name}</h3>
                  <p>{selected.desc}</p>
                  {selected.dmg > 0 && <p className="vm-sub">Damage {selected.dmg}</p>}
                  {selected.kind === "consumable" && (
                    <button className="vm-mbtn primary small" onClick={() => api.use(selected.uid)}>
                      Use
                    </button>
                  )}
                  {selected.slot !== "none" && !selected.equipped && (
                    <button className="vm-mbtn primary small" onClick={() => api.equip(selected.uid)}>
                      Equip
                    </button>
                  )}
                  {selected.equipped && <p className="vm-sub">Equipped</p>}
                </>
              ) : (
                <p className="vm-sub">Tap an item.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="vm-crafts vm-scroll">
            {hud.crafts.map((c) => (
              <div key={c.id} className={`vm-craft ${c.ok ? "ok" : ""}`}>
                <ItemIcon id={c.out} size={40} />
                <div className="vm-craft-text">
                  <b>{c.name}</b>
                  <span>{c.have}</span>
                  <em className={c.can ? "" : "need"}>{STATION_NAME[c.station]}</em>
                </div>
                <button className="vm-mbtn small primary" disabled={!c.ok} onClick={() => api.craft(c.id)}>
                  Craft
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Talk({ api, hud }: { api: GameApi; hud: Hud }) {
  const t = hud.talk!;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    const id = setInterval(() => setShown((n) => (n >= t.text.length ? n : n + 2)), 16);
    return () => clearInterval(id);
  }, [t.text]);
  const done = shown >= t.text.length;
  return (
    <div className="vm-talk-wrap" onPointerDown={() => (done ? api.press("talk") : setShown(t.text.length))}>
      <div className="vm-talk" onPointerDown={(e) => e.stopPropagation()} onClick={() => (done ? api.press("talk") : setShown(t.text.length))}>
        {t.name && (
          <div className="vm-talk-name">
            {t.name}
            {t.role && <small>{t.role}</small>}
          </div>
        )}
        <p>{t.text.slice(0, shown)}</p>
        {t.trades.length > 0 && done && (
          <div className="vm-trades" onClick={(e) => e.stopPropagation()}>
            {t.trades.map((tr) => (
              <button key={tr.id} className="vm-mbtn small" disabled={!tr.ok} onClick={() => api.trade(tr.id)}>
                {tr.label}
              </button>
            ))}
          </div>
        )}
        <div className="vm-talk-more">{done ? (t.more ? "Tap to continue" : "Tap to close") : ""}</div>
      </div>
    </div>
  );
}

function Reward({ api, hud }: { api: GameApi; hud: Hud }) {
  return (
    <div className="vm-reward">
      <div className="vm-reward-title">Cookie is defeated</div>
      <div className="vm-reward-sub">The music box winds down. The toys go still.</div>
      <div className="vm-reward-items">
        {hud.reward!.map((r, i) => (
          <div className="vm-reward-card" key={r.id} style={{ animationDelay: `${0.3 + i * 0.35}s` }}>
            <ItemIcon id={r.id} size={64} />
            <b>{r.name}</b>
            <span>{r.desc}</span>
          </div>
        ))}
      </div>
      <div className="vm-seal">
        <span>Seal broken</span> The Green Gate answers the Core.
      </div>
      <button className="vm-mbtn primary" onClick={() => api.press("rewardClose")}>
        Take them
      </button>
    </div>
  );
}

function Ending({ api, hud }: { api: GameApi; hud: Hud }) {
  return (
    <div className="vm-panel-screen">
      <div className="vm-panel ending">
        <div className="vm-wordmark">The Edge of the Kingdom</div>
        <p>
          Wheat to the walls of Harrenvale, and a fortress that is not yours. Not yet. The first seal is broken; the continent knows your name now, whether it likes it or not.
        </p>
        <div className="vm-endstats">
          <div>
            <b>{fmtTime(hud.stats.time)}</b>
            <span>played</span>
          </div>
          <div>
            <b>{hud.stats.kills}</b>
            <span>foes</span>
          </div>
          <div>
            <b>{hud.stats.deaths}</b>
            <span>falls</span>
          </div>
        </div>
        <p className="vm-sub">End of the VEYRMARCH slice. The Kingdom, the Black Knight and the rest of the continent come next.</p>
        <div className="vm-row">
          <button className="vm-mbtn primary" onClick={() => api.press("endClose")}>
            Keep exploring
          </button>
          <button className="vm-mbtn" onClick={() => api.toTitle()}>
            Title
          </button>
        </div>
      </div>
    </div>
  );
}
