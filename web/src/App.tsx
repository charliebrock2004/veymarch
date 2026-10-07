import { useEffect, useMemo, useRef, useState } from "react";
import { STATION_NAMES } from "./game/data/zones";
import { RARITY_COLOR, SET_BONUS, type Rarity } from "./game/data/items";
import type { GameApi, Hud, Look, Quality } from "./game/Game";
import { Controls } from "./ui/Controls";
import { Glyph, ItemIcon } from "./ui/icons";
import { Online, PlayerKey, copyText, hasJoinLink } from "./ui/Online";
import { Realm } from "./net/realm";

const SKINS = ["#f0d8c0", "#e2c0a0", "#c8a080", "#a07858", "#6e4a32"];
const HAIRS = ["#2a2118", "#5a3a22", "#8a5a2a", "#b89a6a", "#9a3a22", "#d8d0c4"];
const COATS = ["#7a6248", "#5e6b45", "#6a3b2a", "#3c4458", "#8a7a5a", "#2e2a26"];
const STYLES = ["Tied", "Short", "Long", "Shaved"];
const BODIES = ["Slight", "Average", "Broad"];

const STATION_NAME: Record<string, string> = STATION_NAMES;

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
      <div className="vm-rotate">Turn your phone sideways for the best view.</div>
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

const DEFAULT_LOOK: Look = { body: 1, skin: 1, hair: 0, hairColor: 1, coat: 0 };

function Screens({ api, hud }: { api: GameApi; hud: Hud }) {
  // a ?join=CODE link opens straight into online play
  const [screen, setScreen] = useState<"main" | "solo" | "settings" | "online">(() => (hasJoinLink() ? "online" : "main"));
  const [creating, setCreating] = useState<"solo" | "online">("online");
  const [createErr, setCreateErr] = useState("");
  if (hud.mode === "loading") return null;
  if (hud.mode === "title")
    return screen === "online" || screen === "solo" ? (
      <Online
        key={screen}
        api={api}
        solo={screen === "solo"}
        back={() => setScreen("main")}
        newCharacter={() => {
          setCreating(screen);
          setCreateErr("");
          api.create(DEFAULT_LOOK);
        }}
      />
    ) : screen === "settings" ? (
      <Settings hud={hud} api={api} back={() => setScreen("main")} />
    ) : (
      <Main toOnline={() => setScreen("online")} toSingle={() => setScreen("solo")} toSettings={() => setScreen("settings")} />
    );
  if (hud.mode === "create")
    return (
      <Creator
        api={api}
        title="A new character"
        sub="Your character travels with you between worlds: gear, health and progress."
        confirm="Create"
        error={createErr}
        back={() => {
          api.toTitle();
          setScreen(creating);
        }}
        onConfirm={async (name, look) => {
          try {
            const realm = creating === "solo" ? await Realm.openSolo() : await Realm.open();
            if (!realm) throw new Error("Online play is not set up on this build.");
            const c = await realm.createCharacter(name, look);
            try {
              localStorage.setItem("veyrmarch.char", c.id);
            } catch {
              /* ignore */
            }
            api.toTitle();
            setScreen(creating);
          } catch (e) {
            setCreateErr(String((e as Error)?.message ?? e));
          }
        }}
      />
    );
  return <Play api={api} hud={hud} />;
}

function Main({ toOnline, toSingle, toSettings }: { toOnline: () => void; toSingle: () => void; toSettings: () => void }) {
  const standalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone);
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return (
    <div className="vm-title">
      <div className="vm-title-head">
        <div className="vm-wordmark big">VEYRMARCH</div>
        <div className="vm-tagline">The Sealed Continent</div>
      </div>
      <div className="vm-menu">
        <button className="vm-mbtn primary" onClick={toOnline}>
          Play
          <small>Your characters and worlds · play with friends</small>
        </button>
        <button className="vm-mbtn" onClick={toSingle}>
          Single Player
          <small>Your own world, saved on this device</small>
        </button>
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
        <SettingsBody hud={hud} api={api} extra={<PlayerKey />} />
      </div>
    </div>
  );
}

function SettingsBody({ hud, api, extra }: { hud: Hud; api: GameApi; extra?: React.ReactNode }) {
  return (
    <div className="vm-settings vm-scroll">
      {extra}
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

function Creator({ api, back, onConfirm, title = "The Unmarked", sub = "No class, no mark. The seals do not know you.", confirm = "Wake in Hearthfen", error = "" }: {
  api: GameApi; back: () => void; onConfirm: (name: string, look: Look) => void | Promise<void>; title?: string; sub?: string; confirm?: string; error?: string;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [look, setLook] = useState<Look>({ body: 1, skin: 1, hair: 0, hairColor: 1, coat: 0 });
  const set = (p: Partial<Look>) => {
    const next = { ...look, ...p };
    setLook(next);
    api.preview(next);
  };
  return (
    <div className="vm-creator">
      <div className="vm-creator-panel vm-scroll">
        <h2>{title}</h2>
        <p className="vm-sub">{sub}</p>
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
          <button
            className="vm-mbtn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(name, look);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "…" : confirm}
          </button>
        </div>
        {error && <p className="vm-err">{error}</p>}
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
  const [hint, setHint] = useState(() => {
    try {
      return localStorage.getItem("veyrmarch.hint") !== "1";
    } catch {
      return true;
    }
  });
  const closeHint = () => {
    setHint(false);
    try {
      localStorage.setItem("veyrmarch.hint", "1");
    } catch {
      /* private mode */
    }
  };
  useEffect(() => {
    if (!hint || hud.mode !== "play") return;
    const t = setTimeout(closeHint, 12000);
    return () => clearTimeout(t);
  }, [hint, hud.mode]);
  const hurt = performance.now() - hud.hurtAt < 500;
  const low = hud.hp / hud.maxHp < 0.3;
  const showControls = hud.mode === "play";
  return (
    <>
      <div className={`vm-vignette ${hurt ? "hurt" : ""} ${low ? "low" : ""}`} />
      {showControls && <Controls api={api} hud={hud} />}
      <div className="vm-hud">
        <div className="vm-vitals">
          <div className="vm-name">
            {hud.name}
            <span className="vm-lvl">Lv {hud.level}</span>
          </div>
          <Bar v={hud.hp} max={hud.maxHp} kind="hp" />
          <Bar v={hud.stam} max={hud.maxStam} kind="stam" />
          {hud.ember && <Bar v={hud.mana} max={hud.maxMana} kind="mana" />}
          <div className="vm-xp" title={`${hud.xp - hud.xpLo} / ${hud.xpHi - hud.xpLo} XP`}>
            <i style={{ width: `${hud.xpHi > hud.xpLo ? Math.min(100, ((hud.xp - hud.xpLo) / (hud.xpHi - hud.xpLo)) * 100) : 100}%` }} />
          </div>
          <div className="vm-weapon">
            <ItemIcon id={hud.weaponId} size={22} />
            <span>{hud.weapon}</span>
            <em className="vm-crowns">{hud.crowns}<ItemIcon id="coin_crown" size={16} /></em>
          </div>
          {hud.online && !hud.online.solo && <Party hud={hud} />}
        </div>
        {hud.boss ? (
          <div className="vm-boss">
            <div className="vm-boss-name">{hud.boss.name}</div>
            <div className="vm-boss-bar">
              <i style={{ width: `${(hud.boss.hp / hud.boss.max) * 100}%` }} />
              <span className="pip" style={{ left: "66%" }} />
              <span className="pip" style={{ left: "33%" }} />
            </div>
            <div className="vm-boss-phase">{hud.boss.phaseName}</div>
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
          {hud.online && (
            <button className="vm-icon" onClick={() => api.journal()} aria-label="Journal">
              <Glyph name="book" size={24} />
            </button>
          )}
          <button className="vm-icon" onClick={() => api.press("bag")} aria-label="Bag">
            <Glyph name="bag" size={24} />
          </button>
          <button className="vm-icon" onClick={() => api.press("pause")} aria-label="Menu">
            <Glyph name="menu" size={24} />
          </button>
        </div>
      </div>
      {hud.bossLine && (
        <div className="vm-bossline" key={hud.bossLine.at}>
          “{hud.bossLine.text}”
        </div>
      )}
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
      {hint && hud.mode === "play" && (
        <div className="vm-hint-overlay" onPointerDown={closeHint}>
          <div className="vm-hint-left">
            <b>Move</b>
            <span>Left thumb anywhere. Push to the edge to run.</span>
          </div>
          <div className="vm-hint-mid">
            <b>Look</b>
            <span>Drag with your right thumb.</span>
          </div>
          <div className="vm-hint-right">
            <span><Glyph name="sword" size={18} /> Tap to strike, hold for a heavy blow</span>
            <span><Glyph name="dodge" size={18} /> Roll through attacks</span>
            <span><Glyph name="shield" size={18} /> Hold to block; time it to parry</span>
            <span><Glyph name="hand" size={18} /> Gold button: talk, gather, enter</span>
          </div>
          <div className="vm-hint-tap">Tap to begin</div>
        </div>
      )}
      {hud.mode === "bag" && <Bag api={api} hud={hud} />}
      {hud.mode === "talk" && hud.talk && <Talk api={api} hud={hud} />}
      {hud.mode === "shop" && hud.shop && <Shop api={api} hud={hud} />}
      {hud.mode === "journal" && <Journal api={api} hud={hud} />}
      {hud.banner && hud.mode !== "title" && (
        <div className="vm-banner" key={hud.banner.at}>
          <div>{hud.banner.title}</div>
          <small>{hud.banner.sub}</small>
        </div>
      )}
      {hud.mode === "dead" && (
        <div className="vm-dead">
          <div className="vm-dead-title">You fall</div>
          <p>{hud.online && hud.online.players.some((p) => !p.me && !p.away && !p.dead) ? "A friend can reach you and pull you up. Or wake at the shrine." : "The forest keeps what it takes. Not you. Not yet."}</p>
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
            {hud.online && !hud.online.solo && <WorldCodeRow hud={hud} />}
            <SettingsBody hud={hud} api={api} />
            <div className="vm-row">
              <button className="vm-mbtn primary" onClick={() => api.press("resume")}>
                Resume
              </button>
              {hud.online && (
                <button className="vm-mbtn" onClick={() => api.journal()}>
                  Journal
                </button>
              )}
              <button className="vm-mbtn" onClick={() => api.toTitle()}>
                {hud.online && !hud.online.solo ? "Leave world" : "Save and quit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Other players in the world: name, health, where they are. */
function Party({ hud }: { hud: Hud }) {
  const o = hud.online!;
  const others = o.players.filter((p) => !p.me);
  return (
    <div className="vm-party">
      <div className="vm-party-head">
        <span>{o.world}</span>
        <em>{o.status === "connected" ? o.code : "Reconnecting…"}</em>
      </div>
      {others.length === 0 && <div className="vm-party-empty">Alone here. Share code {o.code}.</div>}
      {others.map((p, i) => (
        <div key={i} className={`vm-party-row ${p.dead ? "down" : ""} ${p.away ? "away" : ""}`}>
          <span>{p.name}</span>
          <small>{p.away ? "away" : p.dead ? "down" : p.zone}</small>
          <i>
            <b style={{ width: `${Math.max(0, Math.min(100, (p.hp / p.max) * 100))}%` }} />
          </i>
        </div>
      ))}
    </div>
  );
}

function WorldCodeRow({ hud }: { hud: Hud }) {
  const o = hud.online!;
  const [copied, setCopied] = useState(false);
  return (
    <div className="vm-coderow">
      <div>
        <label>{o.world} · Day {o.day}</label>
        <b>{o.code}</b>
      </div>
      <button className="vm-mbtn small" onClick={async () => setCopied(await copyText(o.code))}>
        {copied ? "Copied" : "Copy code"}
      </button>
    </div>
  );
}

function Bag({ api, hud }: { api: GameApi; hud: Hud }) {
  const [tab, setTab] = useState<"bag" | "craft">(hud.station !== "hand" ? "craft" : "bag");
  const [sel, setSel] = useState<string | null>(null);
  const items = hud.items.filter((i) => i.id !== "arm_cloth");
  const selected = items.find((i) => i.uid === sel) ?? null;
  const main = hud.items.find((i) => i.equipped && i.slot === "main");
  const worn = (slot: string) => hud.items.find((i) => i.equipped && i.slot === slot);
  const sets = Object.entries(SET_BONUS).filter(([k, b]) => hud.items.filter((i) => i.equipped && i.set === k).length >= b.pieces);
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
            <div className="vm-gear vm-scroll">
              <div className="vm-slots">
                {SLOTS.map(([slot, label]) => {
                  const it = slot === "main" ? main : worn(slot);
                  return (
                    <button key={slot} className={`vm-gslot ${it && sel === it.uid ? "on" : ""}`} onClick={() => it && setSel(it.uid)} title={label}>
                      <label>{label}</label>
                      {it ? <ItemIcon id={it.id} size={30} /> : slot === "main" ? <ItemIcon id="wpn_fists" size={30} /> : <div className="vm-empty" />}
                    </button>
                  );
                })}
              </div>
              <div className="vm-stats">
                <span>Level {hud.level} · {hud.xp - hud.xpLo}/{Math.max(1, hud.xpHi - hud.xpLo)} XP</span>
                <span>Health {hud.hp}/{hud.maxHp}</span>
                <span>Damage {main?.dmg ?? 4} · Defence {hud.defence}</span>
                <span>Crowns {hud.crowns}</span>
                {sets.map(([k, b]) => (
                  <span key={k} className="vm-setbonus">{b.name}: {b.text}</span>
                ))}
              </div>
            </div>
            <div className="vm-grid vm-scroll">
              {items.length === 0 && <p className="vm-sub">Empty. Gather flint and wood in the forest.</p>}
              {items.map((i) => (
                <button key={i.uid} className={`vm-item ${sel === i.uid ? "on" : ""} ${i.equipped ? "eq" : ""}`} style={{ borderColor: i.rarity !== "common" ? RARITY_COLOR[i.rarity as Rarity] : undefined }} onClick={() => setSel(i.uid)}>
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
                  <h3 style={{ color: RARITY_COLOR[selected.rarity as Rarity] }}>{selected.name}</h3>
                  <p className="vm-rarity">{selected.rarity} · tier {selected.tier}</p>
                  <p>{selected.desc}</p>
                  {selected.dmg > 0 && <p className="vm-sub">Damage {selected.dmg}</p>}
                  {selected.def > 0 && <p className="vm-sub">Defence {selected.def}</p>}
                  {selected.passive && <p className="vm-passive">{selected.passive}</p>}
                  {selected.set && SET_BONUS[selected.set] && <p className="vm-sub">Set: {SET_BONUS[selected.set].name}, {SET_BONUS[selected.set].pieces} pieces. {SET_BONUS[selected.set].text}</p>}
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

const SLOTS: [string, string][] = [["main", "Main"], ["off", "Off"], ["head", "Head"], ["chest", "Chest"], ["hands", "Hands"], ["legs", "Legs"], ["feet", "Feet"], ["trinket", "Trinket"]];

function Shop({ api, hud }: { api: GameApi; hud: Hud }) {
  const sh = hud.shop!;
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  return (
    <div className="vm-panel-screen">
      <div className="vm-panel bag">
        <div className="vm-panel-head">
          <div className="vm-tabs">
            <button className={tab === "buy" ? "on" : ""} onClick={() => setTab("buy")}>
              Buy
            </button>
            {sh.buys && (
              <button className={tab === "sell" ? "on" : ""} onClick={() => setTab("sell")}>
                Sell
              </button>
            )}
          </div>
          <h2 className="vm-shopname">{sh.name}</h2>
          <span className="vm-crowns big">{hud.crowns}<ItemIcon id="coin_crown" size={20} /></span>
          <button className="vm-icon" onClick={() => api.press("close")} aria-label="Close">
            <Glyph name="close" size={22} />
          </button>
        </div>
        <div className="vm-crafts vm-scroll">
          {tab === "buy"
            ? sh.stock.map((it) => (
                <div key={it.id} className={`vm-craft ${it.ok ? "ok" : ""}`}>
                  <ItemIcon id={it.id} size={40} />
                  <div className="vm-craft-text">
                    <b>{it.name}</b>
                    <span>{it.price} crowns</span>
                  </div>
                  <button className="vm-mbtn small primary" disabled={!it.ok} onClick={() => api.buy(it.id, 1)}>
                    Buy
                  </button>
                </div>
              ))
            : sh.sell.length === 0
              ? <p className="vm-sub">Nothing they want. Equipped and soulbound things stay with you.</p>
              : sh.sell.map((it) => (
                  <div key={it.uid} className="vm-craft ok">
                    <ItemIcon id={it.id} size={40} />
                    <div className="vm-craft-text">
                      <b>{it.name}{it.count > 1 ? ` ×${it.count}` : ""}</b>
                      <span>{it.price} crowns each</span>
                    </div>
                    <button className="vm-mbtn small" onClick={() => api.sell(it.uid, 1)}>
                      Sell
                    </button>
                    {it.count > 1 && (
                      <button className="vm-mbtn small" onClick={() => api.sell(it.uid, it.count)}>
                        All
                      </button>
                    )}
                  </div>
                ))}
        </div>
      </div>
    </div>
  );
}

function Journal({ api, hud }: { api: GameApi; hud: Hud }) {
  const live = hud.journal.filter((j) => !j.done);
  const done = hud.journal.filter((j) => j.done);
  return (
    <div className="vm-panel-screen">
      <div className="vm-panel wide">
        <div className="vm-panel-head">
          <h2>Journal</h2>
          <button className="vm-icon" onClick={() => api.press("close")} aria-label="Close">
            <Glyph name="close" size={22} />
          </button>
        </div>
        <div className="vm-journal vm-scroll">
          {live.length === 0 && <p className="vm-sub">No open quests. People in towns have work; talk to them.</p>}
          {live.map((j) => (
            <div key={j.id} className={`vm-quest ${j.main ? "main" : ""}`}>
              <b>{j.name}</b>
              <span>
                {j.step} {j.progress && <em>{j.progress}</em>}
              </span>
              <small>{j.sub} · step {j.stepN} of {j.steps}</small>
            </div>
          ))}
          {done.length > 0 && <h3>Done</h3>}
          {done.map((j) => (
            <div key={j.id} className="vm-quest done">
              <b>{j.name}</b>
            </div>
          ))}
        </div>
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
        {t.shop && done && !t.more && (
          <div className="vm-trades" onClick={(e) => e.stopPropagation()}>
            <button className="vm-mbtn small primary" onClick={() => api.openShop(t.shop!)}>
              Trade
            </button>
          </div>
        )}
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
      <div className="vm-reward-title">{hud.rewardText?.title ?? "Victory"}</div>
      <div className="vm-reward-sub">{hud.rewardText?.sub ?? ""}</div>
      <div className="vm-reward-items">
        {hud.reward!.map((r, i) => (
          <div className="vm-reward-card" key={r.id} style={{ animationDelay: `${0.3 + i * 0.35}s` }}>
            <ItemIcon id={r.id} size={64} />
            <b>{r.name}</b>
            <span>{r.desc}</span>
          </div>
        ))}
      </div>
      {hud.rewardText?.seal && <div className="vm-seal">{hud.rewardText.seal}</div>}
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
