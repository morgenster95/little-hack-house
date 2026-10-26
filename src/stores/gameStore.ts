import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEVICE_IDS, DeviceId, DeviceStatus, PLAYABLE_DEVICES } from '../config/devices';

export type Phase = 'intro' | 'config' | 'play';

export interface DeviceRuntime {
  status: DeviceStatus;
  attack: string | null;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'attack' | 'blocked' | 'info' | 'good';
}

export interface Stats {
  attacks: number;
  blocked: number;
  outcomes: string[];
  attackedDevices: DeviceId[];
}

interface GameState {
  phase: Phase;
  smart: Record<DeviceId, boolean>;
  devices: Record<DeviceId, DeviceRuntime>;
  selectedDevice: DeviceId | null;
  protection: { unlocked: boolean; active: boolean };
  stats: Stats;
  comfort: number;
  activity: string;
  toasts: Toast[];
  sfx: boolean;
  music: boolean;
  summaryOpen: boolean;

  setPhase: (p: Phase) => void;
  toggleSmart: (id: DeviceId) => void;
  selectDevice: (id: DeviceId | null) => void;
  setDevice: (id: DeviceId, rt: Partial<DeviceRuntime>) => void;
  setProtection: (p: Partial<GameState['protection']>) => void;
  addComfort: (delta: number) => void;
  setActivity: (a: string) => void;
  addOutcome: (id: string) => void;
  countAttack: (id: DeviceId) => void;
  countBlocked: () => void;
  pushToast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  setSfx: (on: boolean) => void;
  setMusic: (on: boolean) => void;
  setSummaryOpen: (on: boolean) => void;
  resetRun: () => void;
}

const initialDevices = (): Record<DeviceId, DeviceRuntime> => {
  const out = {} as Record<DeviceId, DeviceRuntime>;
  DEVICE_IDS.forEach((id) => (out[id] = { status: 'normal', attack: null }));
  return out;
};

const initialSmart = (): Record<DeviceId, boolean> => {
  const out = {} as Record<DeviceId, boolean>;
  Object.keys(initialDevices()).forEach((id) => (out[id as DeviceId] = PLAYABLE_DEVICES.includes(id as DeviceId)));
  return out;
};

let toastId = 1;

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      phase: 'intro',
      smart: initialSmart(),
      devices: initialDevices(),
      selectedDevice: null,
      protection: { unlocked: false, active: false },
      stats: { attacks: 0, blocked: 0, outcomes: [], attackedDevices: [] },
      comfort: 80,
      activity: '',
      toasts: [],
      sfx: true,
      music: false,
      summaryOpen: false,

      setPhase: (phase) => set({ phase }),
      toggleSmart: (id) => set((s) => ({ smart: { ...s.smart, [id]: !s.smart[id] } })),
      selectDevice: (selectedDevice) => set({ selectedDevice }),
      setDevice: (id, rt) => set((s) => ({ devices: { ...s.devices, [id]: { ...s.devices[id], ...rt } } })),
      setProtection: (p) => set((s) => ({ protection: { ...s.protection, ...p } })),
      addComfort: (d) => set((s) => ({ comfort: Math.max(0, Math.min(100, s.comfort + d)) })),
      setActivity: (activity) => set({ activity }),
      addOutcome: (id) =>
        set((s) => (s.stats.outcomes.includes(id) ? s : { stats: { ...s.stats, outcomes: [...s.stats.outcomes, id] } })),
      countAttack: (id) =>
        set((s) => ({
          stats: {
            ...s.stats,
            attacks: s.stats.attacks + 1,
            attackedDevices: s.stats.attackedDevices.includes(id) ? s.stats.attackedDevices : [...s.stats.attackedDevices, id],
          },
        })),
      countBlocked: () => set((s) => ({ stats: { ...s.stats, blocked: s.stats.blocked + 1 } })),
      pushToast: (text, kind = 'info') => {
        const id = toastId++;
        set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind }] }));
        setTimeout(() => get().dismissToast(id), 3800);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      setSfx: (sfx) => set({ sfx }),
      setMusic: (music) => set({ music }),
      setSummaryOpen: (summaryOpen) => set({ summaryOpen }),
      resetRun: () =>
        set({
          devices: initialDevices(),
          protection: { unlocked: false, active: false },
          stats: { attacks: 0, blocked: 0, outcomes: [], attackedDevices: [] },
          comfort: 80,
          selectedDevice: null,
          summaryOpen: false,
        }),
    }),
    {
      name: 'little-hack-house',
      version: 2,
      partialize: (s) => ({ smart: s.smart, sfx: s.sfx, music: s.music }),
      // v2 přibyla nová zařízení – zapnout je i hráčům s uloženou konfigurací
      migrate: (persisted, version) => {
        const p = persisted as Partial<Pick<GameState, 'smart' | 'sfx' | 'music'>>;
        const smart = initialSmart();
        if (p.smart) for (const id of DEVICE_IDS) if (version >= 2 || ['boiler', 'heating', 'lights'].includes(id)) smart[id] = p.smart[id] ?? smart[id];
        return { ...p, smart } as GameState;
      },
    },
  ),
);

/** Funkční stav zařízení odvozený z konfigurace a útoků – čistá logika bez grafiky. */
export type HeatMode = 'normal' | 'off' | 'max';
export type LightMode = 'normal' | 'off' | 'flicker' | 'party';

export function isAttacked(id: DeviceId, s = useGameStore.getState()) {
  const d = s.devices[id];
  return s.smart[id] && (d.status === 'compromised' || d.status === 'disabled');
}

export const deviceLogic = {
  /** Aktivní útok na zařízení ('normal', když není napadené). */
  mode: (id: DeviceId, s = useGameStore.getState()): string => (isAttacked(id, s) ? (s.devices[id].attack ?? 'normal') : 'normal'),
  anyAttack: (s = useGameStore.getState()) => DEVICE_IDS.some((id) => isAttacked(id, s)),
  hotWater: (s = useGameStore.getState()) => !isAttacked('boiler', s),
  heating: (s = useGameStore.getState()): HeatMode => {
    if (!isAttacked('heating', s)) return 'normal';
    return s.devices.heating.attack === 'overheat' ? 'max' : 'off';
  },
  lights: (s = useGameStore.getState()): LightMode => {
    if (!isAttacked('lights', s)) return 'normal';
    return (s.devices.lights.attack as LightMode) ?? 'normal';
  },
};
