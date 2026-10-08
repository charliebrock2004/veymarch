/**
 * The player key a device keeps in local storage, and its one-time registration.
 *
 * Registration is shared by every Realm on the page that uses the same storage key: the title
 * screen, a remounted Online panel and the character creator each open their own Realm, and
 * each used to register on its own when the device had no key yet. Two registrations that
 * cross gave one phone two players; whichever answered last won local storage, while the
 * screen kept using the other, so a world made then belonged to a key the device had lost.
 */

export type Ident = { id: string; secret: string };

export type KeyStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };

/** One registration in flight per storage key, for the whole page. */
const pending = new Map<string, Promise<Ident>>();
/** Keys registered on this page, for when storage is blocked and cannot hold them. */
const memory = new Map<string, Ident>();

export function readIdent(store: KeyStore | null, key: string): Ident | null {
  try {
    const raw = store?.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Ident;
    return v.id && v.secret ? v : null;
  } catch {
    return null;
  }
}

export function writeIdent(store: KeyStore | null, key: string, v: Ident) {
  memory.set(key, v);
  try {
    store?.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode: the key lives for this session only */
  }
}

/**
 * The device's key: the stored one, the one another caller is registering right now, or a new
 * registration. `stale` is a key the server no longer knows; it is dropped, but only if it is
 * still the current one (another caller may already have replaced it).
 */
export function ensureIdent(store: KeyStore | null, key: string, register: (secret: string) => Promise<string>, stale?: Ident): Promise<Ident> {
  const same = (a: Ident | null | undefined) => !!a && !!stale && a.id === stale.id && a.secret === stale.secret;
  let have = readIdent(store, key) ?? memory.get(key) ?? null;
  if (same(have)) {
    memory.delete(key);
    have = null;
  }
  if (have) return Promise.resolve(have);
  let p = pending.get(key);
  if (!p) {
    p = (async () => {
      const secret = randomSecret();
      const id = await register(secret);
      const v = { id, secret };
      writeIdent(store, key, v);
      return v;
    })().finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}

export function randomSecret() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
