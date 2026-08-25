type SaveCallback = () => void;

const callbacks = new Set<SaveCallback>();

export function registerSaveCallback(fn: SaveCallback): void {
  callbacks.add(fn);
}

export function unregisterSaveCallback(fn: SaveCallback): void {
  callbacks.delete(fn);
}

export function runAllSaveCallbacks(): void {
  callbacks.forEach((fn) => {
    try { fn(); } catch { /* ignore errors during emergency save */ }
  });
}
