import { useEffect, useState } from "react";
import type { GameApi } from "../game/Game";
import { importLegacySolo, importLocalSaves } from "../net/migrate";
import { Realm, normalizeCode, type CharacterJson, type EnterJson, type Profile, type WorldCard } from "../net/realm";
import { Glyph } from "./icons";

/**
 * Online play: My Characters → Worlds → Create World (shows the code) / Join World (enter a code).
 * Characters and worlds live on the realm server; this screen only reads and asks.
 */

type Phase = "loading" | "chars" | "worlds" | "newworld" | "code" | "join" | "busy" | "nobackend" | "error";

const CHAR_KEY = "veyrmarch.char";
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older iOS: a hidden field and execCommand
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    el.remove();
    return ok;
  }
}

const errText = (e: unknown) => {
  const m = String((e as Error)?.message ?? e);
  if (/Failed to fetch|NetworkError|Load failed|not running|abort/i.test(m)) return "The realm is not answering. Check your connection and try again.";
  return m;
};

/**
 * A ?join=CODE link, read once and taken off the address bar: a reload or a bookmark opens the
 * title screen, and once used the code stops steering Continue to Join World.
 */
let joinLink = (() => {
  try {
    const q = new URLSearchParams(location.search).get("join");
    if (q) history.replaceState(history.state, "", location.pathname + location.hash);
    return normalizeCode(q ?? "");
  } catch {
    return "";
  }
})();
export const hasJoinLink = () => joinLink.length === 6;

function hourText(h: number) {
  return h >= 20.5 || h < 5.5 ? "night" : h < 7.5 ? "dawn" : h < 17.5 ? "day" : "dusk";
}

export function Online({ api, back, newCharacter, solo = false }: { api: GameApi; back: () => void; newCharacter: () => void; solo?: boolean }) {
  const [realm, setRealm] = useState<Realm | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [charId, setCharId] = useState<string | null>(() => ls.get(CHAR_KEY));
  const [err, setErr] = useState("");
  const [made, setMade] = useState<WorldCard | null>(null);
  const [code, setCode] = useState(() => (solo ? "" : joinLink));
  const [worldName, setWorldName] = useState("");
  const [busyText, setBusyText] = useState("");
  const [confirmDel, setConfirmDel] = useState("");
  const [copied, setCopied] = useState(false);
  const [imported, setImported] = useState(0);

  const load = async (r: Realm) => {
    let p = await r.profile();
    const n = solo ? await importLegacySolo(r) : await importLocalSaves(r);
    if (n) {
      p = await r.profile();
      setImported(n);
    }
    setProfile(p);
    return p;
  };

  const [alive] = useState(() => ({ on: true }));
  /** Opens the realm (or this device's own world database) and reads the profile; also "Try again". */
  const start = async () => {
    setPhase("loading");
    let r = realm;
    if (!r) {
      try {
        r = solo ? await Realm.openSolo() : await Realm.open();
      } catch (e) {
        if (!alive.on) return;
        setErr(errText(e));
        return setPhase("error");
      }
      if (!alive.on) return;
      if (!r) return setPhase("nobackend");
      setRealm(r);
    }
    try {
      await load(r);
      if (alive.on) setPhase("chars");
    } catch (e) {
      if (!alive.on) return;
      setErr(errText(e));
      setPhase("error");
    }
  };

  useEffect(() => {
    alive.on = true;
    void start();
    return () => {
      alive.on = false;
    };
  }, []);

  const char = profile?.characters.find((c) => c.id === charId) ?? null;

  const pick = (c: CharacterJson) => {
    setCharId(c.id);
    ls.set(CHAR_KEY, c.id);
    setErr("");
    setPhase(code.length === 6 ? "join" : "worlds");
  };

  const enter = async (label: string, go: () => Promise<EnterJson>, from: Phase) => {
    if (!realm) return;
    setBusyText(label);
    setErr("");
    setPhase("busy");
    try {
      const e = await go();
      if (from === "join") {
        joinLink = "";
        setCode("");
      }
      setBusyText(`Joining ${e.world.name}…`);
      api.startOnline(realm, e);
    } catch (e) {
      setErr(errText(e));
      setPhase(from);
    }
  };

  const createWorld = async () => {
    if (!realm || !char) return;
    setBusyText("Raising a new world…");
    setPhase("busy");
    try {
      const w = await realm.createWorld(worldName.trim() || `${char.name}'s Realm`);
      if (solo) return void enter(`Entering ${w.name}…`, () => realm.enter(w.id, char.id), "newworld");
      setMade(w);
      setCopied(false);
      setPhase("code");
      setProfile(await realm.profile());
    } catch (e) {
      setErr(errText(e));
      setPhase("newworld");
    }
  };

  /** Delete a world you made, or leave one you joined. */
  const dropWorld = async (w: WorldCard) => {
    if (!realm) return;
    try {
      setProfile(w.mine ? await realm.deleteWorld(w.id) : await realm.leaveWorld(w.id));
      setConfirmDel("");
    } catch (e) {
      setErr(errText(e));
    }
  };

  const del = async (id: string) => {
    if (!realm) return;
    try {
      setProfile(await realm.deleteCharacter(id));
      setConfirmDel("");
    } catch (e) {
      setErr(errText(e));
    }
  };

  const head = (title: string, onBack: () => void) => (
    <div className="vm-panel-head">
      <h2>{title}</h2>
      <button className="vm-icon" onClick={onBack} aria-label="Back">
        <Glyph name="close" size={22} />
      </button>
    </div>
  );

  let body: React.ReactNode = null;
  if (phase === "loading" || phase === "busy")
    body = (
      <>
        {head(phase === "busy" ? "" : "Play", back)}
        <div className="vm-wait">{phase === "busy" ? busyText : solo ? "Opening your worlds on this device…" : "Reaching the realm…"}</div>
      </>
    );
  else if (phase === "nobackend")
    body = (
      <>
        {head("Play", back)}
        <p className="vm-sub">Online worlds are not set up on this build. Single Player still works, and keeps your saves on this device.</p>
        <div className="vm-row">
          <button className="vm-mbtn" onClick={back}>
            Back
          </button>
        </div>
      </>
    );
  else if (phase === "error")
    body = (
      <>
        {head("Play", back)}
        <p className="vm-err">{err}</p>
        <div className="vm-row">
          <button className="vm-mbtn" onClick={back}>
            Back
          </button>
          <button className="vm-mbtn primary" onClick={() => void start()}>
            Try again
          </button>
        </div>
      </>
    );
  else if (phase === "chars")
    body = (
      <>
        {head("My Characters", back)}
        {imported > 0 && (
          <p className="vm-note">
            {solo
              ? `Brought ${imported} saved game${imported > 1 ? "s" : ""} into Single Player: each character keeps its gear, and its world keeps its progress.`
              : `Copied ${imported} character${imported > 1 ? "s" : ""} from this device's single player saves. Those saves are untouched.`}
          </p>
        )}
        <div className="vm-cards vm-scroll">
          {profile?.characters.length === 0 && <p className="vm-sub">No characters yet. Make one; it can visit any world.</p>}
          {profile?.characters.map((c) => (
            <div key={c.id} className={`vm-card ${c.id === charId ? "last" : ""}`}>
              <div className="vm-card-main">
                <b>{c.name}</b>
                <span>
                  Level {c.level} · {c.weapon} · {c.place ?? "Hearthfen"}
                </span>
              </div>
              <div className="vm-card-actions">
                <button className="vm-mbtn small primary" onClick={() => pick(c)}>
                  Continue
                </button>
                {confirmDel === c.id ? (
                  <button className="vm-mbtn small danger" onClick={() => del(c.id)}>
                    Really delete
                  </button>
                ) : (
                  <button className="vm-mbtn small" onClick={() => setConfirmDel(c.id)} aria-label={"Delete " + c.name}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {err && <p className="vm-err">{err}</p>}
        <div className="vm-row">
          <button className="vm-mbtn primary" disabled={(profile?.characters.length ?? 0) >= 6} onClick={newCharacter}>
            New Character
          </button>
        </div>
      </>
    );
  else if (phase === "worlds" && char)
    body = (
      <>
        {head(solo ? "Your Worlds" : "Worlds", () => setPhase("chars"))}
        <p className="vm-sub">
          Playing as <b className="vm-gold">{char.name}</b>, level {char.level}.
        </p>
        <div className="vm-cards vm-scroll">
          {profile?.worlds.length === 0 && <p className="vm-sub">{solo ? "No world yet. Start one: it lives on this device and plays offline." : "No worlds yet. Create one and give the code to your friends, or join theirs."}</p>}
          {profile?.worlds.map((w) => (
            <div key={w.id} className="vm-card">
              <div className="vm-card-main">
                <b>
                  {w.name} {!solo && <code>{w.code}</code>}
                </b>
                <span>
                  {solo ? "" : `${w.players}/${w.max} players${w.online ? ` · ${w.online} here now` : ""} · `}Day {w.day}, {hourText(w.hour)}
                  {w.cookie ? " · Cookie defeated" : ""}
                </span>
              </div>
              <div className="vm-card-actions">
                <button className="vm-mbtn small primary" onClick={() => enter(`Entering ${w.name}…`, () => realm!.enter(w.id, char.id), "worlds")}>
                  Play
                </button>
                {confirmDel === w.id ? (
                  <button className="vm-mbtn small danger" onClick={() => dropWorld(w)}>
                    {w.mine ? "Really delete" : "Really leave"}
                  </button>
                ) : (
                  <button className="vm-mbtn small" onClick={() => setConfirmDel(w.id)} aria-label={(w.mine ? "Delete " : "Leave ") + w.name}>
                    {w.mine ? "Delete" : "Leave"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {err && <p className="vm-err">{err}</p>}
        <div className="vm-row">
          {!solo && (
            <button className="vm-mbtn" onClick={() => { setErr(""); setPhase("join"); }}>
              Join World
            </button>
          )}
          <button className="vm-mbtn primary" onClick={() => { setErr(""); setWorldName(solo ? `${char.name}'s Hearthfen` : `${char.name}'s Realm`); setPhase("newworld"); }}>
            {solo ? "New World" : "Create World"}
          </button>
        </div>
      </>
    );
  else if (phase === "newworld" && char)
    body = (
      <>
        {head(solo ? "New World" : "Create World", () => setPhase("worlds"))}
        <div className="vm-field">
          <label>World name</label>
          <input value={worldName} maxLength={32} onChange={(e) => setWorldName(e.target.value)} placeholder={`${char.name}'s Realm`} />
          <p>{solo ? "A world of your own on this device: Hearthfen, the forest and Cookie's Castle, with its own day and night. Works offline." : "A persistent world: Hearthfen, the forest and Cookie's Castle, with its own day and night. Up to four players. It stays when you leave."}</p>
        </div>
        {err && <p className="vm-err">{err}</p>}
        <div className="vm-row">
          <button className="vm-mbtn" onClick={() => setPhase("worlds")}>
            Back
          </button>
          <button className="vm-mbtn primary" onClick={createWorld}>
            Create
          </button>
        </div>
      </>
    );
  else if (phase === "code" && made && char) {
    const link = `${location.origin}/?join=${made.code}`;
    body = (
      <>
        {head(made.name, () => setPhase("worlds"))}
        <div className="vm-bigcode">
          <label>Your World Code</label>
          <b>{made.code}</b>
          <span>Give this code to your friends.</span>
        </div>
        <div className="vm-row center">
          <button className="vm-mbtn" onClick={async () => setCopied(await copyText(made.code))}>
            {copied ? "Copied" : "Copy Code"}
          </button>
          {typeof navigator.share === "function" && (
            <button className="vm-mbtn" onClick={() => navigator.share({ title: "VEYRMARCH", text: `Join my VEYRMARCH world. Code: ${made.code}`, url: link }).catch(() => {})}>
              Share
            </button>
          )}
          <button className="vm-mbtn primary" onClick={() => enter(`Entering ${made.name}…`, () => realm!.enter(made.id, char.id), "code")}>
            Enter World
          </button>
        </div>
      </>
    );
  } else if (phase === "join" && char)
    body = (
      <>
        {head("Join World", () => setPhase("worlds"))}
        <div className="vm-field">
          <label>Enter world code</label>
          <input
            className="vm-codein"
            value={code}
            maxLength={8}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="K7X4P2"
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && code.length === 6 && enter("Looking for that world…", () => realm!.join(code, char.id), "join")}
          />
          <p>
            Six letters and numbers, from the friend who made the world. You join as <b className="vm-gold">{char.name}</b>.
          </p>
        </div>
        {err && <p className="vm-err">{err}</p>}
        <div className="vm-row">
          <button className="vm-mbtn" onClick={() => setPhase("worlds")}>
            Back
          </button>
          <button className="vm-mbtn primary" disabled={code.length !== 6} onClick={() => enter("Looking for that world…", () => realm!.join(code, char.id), "join")}>
            Join
          </button>
        </div>
      </>
    );
  else body = <>{head("Play", back)}</>;

  return (
    <div className="vm-panel-screen">
      <div className="vm-panel wide vm-online">{body}</div>
    </div>
  );
}

/** Settings: copy this device's player key to another device, or use one from elsewhere. */
export function PlayerKey() {
  const [realm, setRealm] = useState<Realm | null>(null);
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("");
  /** Switching away from a key that has characters or worlds asks first. */
  const [confirm, setConfirm] = useState(false);
  const [prev, setPrev] = useState("");
  useEffect(() => {
    let alive = true;
    Realm.open()
      .then((r) => {
        if (!alive) return;
        setRealm(r);
        setKey(r?.deviceKey ?? "");
        setPrev(r?.previousKey ?? "");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!realm) return null;
  const switchTo = async (k: string) => {
    try {
      await realm.useDeviceKey(k);
      setKey(realm.deviceKey);
      setPrev(realm.previousKey);
      setPaste("");
      setConfirm(false);
      setMsg("This device now plays as that key. Your previous key is kept here: Switch back undoes this.");
    } catch (e) {
      setMsg(errText(e));
    }
  };
  const tryUse = async () => {
    if (paste.trim() === key) return setMsg("That is already this device's key.");
    if (key && !confirm) {
      // only ask when the current key has something to lose
      try {
        const p = await realm.profile();
        if (p.characters.length || p.worlds.length) {
          setConfirm(true);
          setMsg(`This device's key has ${p.characters.length} character(s) and ${p.worlds.length} world(s). Copy it first if you want them back later.`);
          return;
        }
      } catch {
        /* cannot tell: ask anyway */
        setConfirm(true);
        setMsg("Copy this device's key first if you want its characters back later.");
        return;
      }
    }
    await switchTo(paste);
  };
  return (
    <div className="vm-field">
      <label>Player key</label>
      <p>Your online characters belong to this key. Copy it to play them on another phone or computer, and keep it somewhere safe.</p>
      {key ? (
        <div className="vm-row start">
          <button className="vm-mbtn small" onClick={() => setShow(!show)}>
            {show ? "Hide" : "Show"}
          </button>
          <button className="vm-mbtn small" onClick={async () => setMsg((await copyText(key)) ? "Copied." : "Could not copy.")}>
            Copy key
          </button>
        </div>
      ) : (
        <p>No key yet: it is made the first time you press Play.</p>
      )}
      {show && <code className="vm-key">{key}</code>}
      <input value={paste} placeholder="Paste a key from another device" autoComplete="off" autoCorrect="off" spellCheck={false} onChange={(e) => (setPaste(e.target.value), setConfirm(false))} />
      <div className="vm-row start">
        <button className={`vm-mbtn small ${confirm ? "danger" : ""}`} disabled={!paste.trim()} onClick={() => void tryUse()}>
          {confirm ? "Switch anyway" : "Use this key"}
        </button>
        {prev && prev !== key && (
          <button className="vm-mbtn small" onClick={() => void switchTo(prev)}>
            Switch back
          </button>
        )}
      </div>
      {msg && <p>{msg}</p>}
    </div>
  );
}
