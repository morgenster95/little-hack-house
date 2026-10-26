import { BRAND } from '../../config/brand';
import { DEVICE_MAP, DeviceId } from '../../config/devices';
import { useGameStore } from '../../stores/gameStore';
import { audio } from '../engine/audio';
import { bus } from '../engine/events';

const store = () => useGameStore.getState();
const recoverTimers = new Map<DeviceId, number>();

/** Simulovaný útok – mění pouze herní stav. */
export function attack(id: DeviceId, attackId: string) {
  const s = store();
  const def = DEVICE_MAP[id];
  const atk = def.attacks.find((a) => a.id === attackId);
  if (!atk || !s.smart[id]) return;
  audio.unlock();

  if (s.protection.active) {
    s.countBlocked();
    s.addOutcome('blocked');
    s.pushToast(`🛡️ ${BRAND.blockedMessage}: ${def.name.toLowerCase()}`, 'blocked');
    audio.play('blocked');
    bus.emit({ type: 'blocked', device: id, attack: attackId });
    return;
  }

  s.countAttack(id);
  s.setDevice(id, { status: atk.resultStatus, attack: attackId });
  s.pushToast(`💻 ${atk.label} – ${def.name.toLowerCase()} napaden`, 'attack');
  audio.play('attack');
  if (!s.protection.unlocked) setTimeout(() => store().setProtection({ unlocked: true }), 2500);
  bus.emit({ type: 'attack', device: id, attack: attackId });
}

/** Obnova zařízení; výsledný stav (chráněno / v pořádku) se určí až na konci – ochrana se mezitím mohla zapnout. */
function recover(id: DeviceId, delay = 1600) {
  const s = store();
  const prev = recoverTimers.get(id);
  if (prev) clearTimeout(prev);
  s.setDevice(id, { status: 'recovering' });
  const t = window.setTimeout(() => {
    store().setDevice(id, { status: store().protection.active ? 'protected' : 'normal', attack: null });
    recoverTimers.delete(id);
    bus.emit({ type: 'restored', device: id });
  }, delay);
  recoverTimers.set(id, t);
}

export function restore(id: DeviceId) {
  audio.play('restore');
  recover(id);
}

export function restoreAll() {
  const s = store();
  (Object.keys(s.devices) as DeviceId[]).forEach((id) => {
    const st = s.devices[id].status;
    if (st === 'compromised' || st === 'disabled') recover(id, 1200);
  });
}

export function setProtection(active: boolean) {
  const s = store();
  s.setProtection({ active, unlocked: true });
  audio.unlock();
  (Object.keys(s.devices) as DeviceId[]).forEach((id) => {
    if (!s.smart[id]) return;
    const st = s.devices[id].status;
    if (active) {
      if (st === 'compromised' || st === 'disabled') recover(id, 2200);
      else if (st === 'normal') s.setDevice(id, { status: 'protected' });
    } else if (st === 'protected') {
      s.setDevice(id, { status: 'normal' });
    }
  });
  if (active) {
    audio.play('shield');
    s.pushToast(`🛡️ ${BRAND.productName} je aktivní`, 'good');
  } else {
    s.pushToast('Ochrana vypnuta – zkus útok znovu', 'info');
  }
  bus.emit({ type: 'protection', active });
}

/** Návrat do konfigurátoru: všechna zařízení zpět do normálu, ochrana vypnuta. */
export function enterConfig() {
  const s = store();
  recoverTimers.forEach((t) => clearTimeout(t));
  recoverTimers.clear();
  (Object.keys(s.devices) as DeviceId[]).forEach((id) => s.setDevice(id, { status: 'normal', attack: null }));
  s.setProtection({ active: false });
  s.selectDevice(null);
  s.setPhase('config');
  bus.emit({ type: 'protection', active: false });
}

export function toggleSmart(id: DeviceId) {
  const s = store();
  audio.unlock();
  audio.play('pop');
  s.toggleSmart(id);
}

export function selectDevice(id: DeviceId | null) {
  const s = store();
  if (id && !s.smart[id]) return;
  audio.unlock();
  if (id) audio.play('select');
  s.selectDevice(id);
}
