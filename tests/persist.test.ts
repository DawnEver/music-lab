import { describe, expect, it, beforeEach } from "vitest";
import { storedString, storedJson } from "../src/lib/persist.js";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  get size() {
    return this.map.size;
  }
  keys() {
    return [...this.map.keys()];
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  (globalThis as { window?: unknown }).window = { localStorage: storage };
});

describe("persist", () => {
  it("falls back when nothing is stored, and round-trips after a write", () => {
    const value = storedString("theme", "dark");
    expect(value.read()).toBe("dark");
    value.write("light");
    expect(value.read()).toBe("light");
    expect(storage.keys()).toEqual(["ml.theme"]);
  });

  it("adopts a legacy key once and then drops it", () => {
    storage.setItem("tcl-theme", "light");
    const value = storedString("theme", "dark", "tcl-theme");

    expect(value.read()).toBe("light");
    expect(storage.getItem("tcl-theme")).toBeNull();
    expect(storage.getItem("ml.theme")).toBe("light");
  });

  it("prefers the current key over a stale legacy one", () => {
    storage.setItem("ml.lang", "en");
    storage.setItem("tcl-lang", "zh");
    expect(storedString("lang", "zh", "tcl-lang").read()).toBe("en");
  });

  it("revives structured values and survives corrupt JSON", () => {
    const value = storedJson(
      "metronome",
      () => ({ bpm: 120 }),
      (raw, base) => {
        const saved = raw as { bpm?: unknown };
        return typeof saved.bpm === "number" ? { bpm: saved.bpm } : base;
      }
    );

    value.write({ bpm: 88 });
    expect(value.read()).toEqual({ bpm: 88 });

    storage.setItem("ml.metronome", "{not json");
    expect(value.read()).toEqual({ bpm: 120 });

    storage.setItem("ml.metronome", '{"bpm":"fast"}');
    expect(value.read()).toEqual({ bpm: 120 });
  });

  it("never throws when storage itself is unavailable", () => {
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem() {
          throw new Error("blocked");
        },
        setItem() {
          throw new Error("blocked");
        },
        removeItem() {
          throw new Error("blocked");
        }
      }
    };
    const value = storedString("theme", "dark");
    expect(value.read()).toBe("dark");
    expect(() => value.write("light")).not.toThrow();
  });
});
