import type { DeviceId } from '../../config/devices';

export type GameEvent =
  | { type: 'attack'; device: DeviceId; attack: string }
  | { type: 'blocked'; device: DeviceId; attack: string }
  | { type: 'restored'; device: DeviceId }
  | { type: 'protection'; active: boolean };

type Listener = (e: GameEvent) => void;

class EventBus {
  private listeners = new Set<Listener>();
  on(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  emit(e: GameEvent) {
    this.listeners.forEach((l) => l(e));
  }
}

export const bus = new EventBus();

export class AbortedError extends Error {
  constructor() {
    super('aborted');
  }
}

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortedError());
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new AbortedError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
