export const isIOSPlatform = () => globalThis.Capacitor?.getPlatform?.() === 'ios' ||
  globalThis.location?.protocol === 'capacitor:';

const memory = new Map();
let queue = Promise.resolve();
const preferences = () => globalThis.Capacitor?.Plugins?.Preferences;

function write(action) {
  queue = queue.then(() => action(preferences())).catch(error => {
    console.error('Could not save to Preferences', error);
  });
}

export const nativeStorage = {
  async load() {
    const plugin = preferences();
    if (!plugin) return;
    try {
      const {keys} = await plugin.keys();
      const records = await Promise.all(keys.filter(key => key.startsWith('sengoku-')).map(async key => {
        const {value} = await plugin.get({key});
        return [key, value];
      }));
      for (const [key, value] of records) if (value !== null) memory.set(key, value);
    } catch (error) {
      console.error('Could not load Preferences', error);
    }
  },
  keys: () => [...memory.keys()],
  getItem: key => memory.get(key) ?? null,
  setItem(key, value) {
    value = String(value);
    if (memory.get(key) === value) return;
    memory.set(key, value);
    write(plugin => plugin.set({key, value}));
  },
  removeItem(key) {
    memory.delete(key);
    write(plugin => plugin.remove({key}));
  },
  flush: () => queue
};

export function haptic(kind, enabled) {
  if (!enabled) return;
  try {
    const plugin = globalThis.Capacitor?.Plugins?.Haptics;
    const style = kind === 'match' ? 'LIGHT' : 'MEDIUM';
    Promise.resolve(plugin?.impact({style})).catch(() => {});
  } catch {}
}
