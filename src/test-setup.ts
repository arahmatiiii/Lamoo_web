/**
 * The store persists to localStorage, which Node has no notion of. Give it an
 * in-memory stand-in so persistence is exercised rather than warned about.
 */
import { vi } from 'vitest';

const store = new Map<string, string>();

const localStorageStub = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, String(value)),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

// zustand's persist middleware looks for `window.localStorage`, so both have to
// exist. stubGlobal also copes with Node's own read-only `localStorage`.
vi.stubGlobal('localStorage', localStorageStub);
vi.stubGlobal('window', { localStorage: localStorageStub });
