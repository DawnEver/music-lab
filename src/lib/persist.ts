/**
 * One way to keep something across sessions.
 *
 * Every store used to carry its own try/catch around localStorage, its own
 * key prefix and its own JSON reviver. They are the same problem: read a
 * value that may be absent, corrupt, or written by an older version of the
 * app. Declaring the value once gives every store the same failure
 * behaviour (fall back to the default, never throw) and one place to
 * migrate keys.
 */

const PREFIX = "ml.";

export interface Stored<T> {
  read(): T;
  write(value: T): void;
}

function rawRead(key: string, legacyKey?: string): string | null {
  try {
    const current = window.localStorage.getItem(PREFIX + key);
    if (current !== null) return current;
    if (!legacyKey) return null;
    // Adopt the value written by an earlier version, then forget the old
    // key. Legacy adoption retires in v3.0 — compatibility needs a date.
    const legacy = window.localStorage.getItem(legacyKey);
    if (legacy === null) return null;
    window.localStorage.setItem(PREFIX + key, legacy);
    window.localStorage.removeItem(legacyKey);
    return legacy;
  } catch (_) {
    return null;
  }
}

function rawWrite(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch (_) {
    // Persistence is best-effort: private mode and quota errors are not
    // the user's problem.
  }
}

/** A plain string value. */
export function storedString(key: string, fallback: string, legacyKey?: string): Stored<string> {
  return {
    read: () => rawRead(key, legacyKey) ?? fallback,
    write: (value) => rawWrite(key, value)
  };
}

/**
 * A structured value. `revive` receives whatever JSON.parse produced — it
 * must validate, because the stored shape may predate the current one.
 */
export function storedJson<T>(
  key: string,
  fallback: () => T,
  revive: (raw: unknown, base: T) => T,
  legacyKey?: string
): Stored<T> {
  return {
    read() {
      const raw = rawRead(key, legacyKey);
      const base = fallback();
      if (raw === null) return base;
      try {
        return revive(JSON.parse(raw), base);
      } catch (_) {
        return base;
      }
    },
    write(value) {
      try {
        rawWrite(key, JSON.stringify(value));
      } catch (_) {
        // Unserialisable state is a programming error, not a user-facing one.
      }
    }
  };
}
