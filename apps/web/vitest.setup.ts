import "@testing-library/jest-dom/vitest";

/**
 * Node 26 ships an experimental Web Storage API that stays disabled unless the
 * process is started with `--localstorage-file`. Under this runtime jsdom 25
 * defines the `Storage` class but never installs a working `window.localStorage`
 * / `window.sessionStorage` instance, so anything touching them (auth session,
 * onboarding form, etc.) blows up with "Cannot read properties of undefined".
 * Provide a minimal in-memory Storage so the test environment behaves like a
 * browser. Remove this once the toolchain gives us real Web Storage in tests.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function ensureStorage(name: "localStorage" | "sessionStorage"): void {
  for (const target of [globalThis, globalThis.window] as const) {
    if (!target) continue;
    const existing = (target as Record<string, unknown>)[name];
    if (!existing) {
      Object.defineProperty(target, name, {
        value: new MemoryStorage(),
        configurable: true,
        writable: false,
      });
    }
  }
}

ensureStorage("localStorage");
ensureStorage("sessionStorage");
