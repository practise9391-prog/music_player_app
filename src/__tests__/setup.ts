import 'fake-indexeddb/auto';

// In-memory localStorage mock for Node environment compatibility
const storage = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, String(value)),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  get length() {
    return storage.size;
  },
  key: (i: number) => Array.from(storage.keys())[i] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

if (typeof (globalThis as any).Audio === 'undefined') {
  class MockAudio {
    src = '';
    currentTime = 0;
    duration = 100;
    volume = 1;
    playbackRate = 1;
    paused = true;
    crossOrigin = '';
    preload = '';
    preservesPitch = true;
    listeners: Record<string, Function[]> = {};

    addEventListener(event: string, cb: Function) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(cb);
    }
    removeEventListener(event: string, cb: Function) {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter((f) => f !== cb);
      }
    }
    async play() {
      this.paused = false;
      this.listeners['play']?.forEach((cb) => cb());
    }
    pause() {
      this.paused = true;
      this.listeners['pause']?.forEach((cb) => cb());
    }
    load() {}
  }
  (globalThis as any).Audio = MockAudio;
}
