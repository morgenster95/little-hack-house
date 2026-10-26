import type { DeviceId } from '../../config/devices';
import { deviceLogic, useGameStore } from '../../stores/gameStore';
import { CharacterController } from '../character/CharacterController';
import { selectDevice } from '../interactions/actions';
import { findReaction, idleActivities, reliefScenario } from '../scenarios';
import type { Scenario, ScenarioContext, SceneFlag } from '../scenarios/types';
import { SceneRenderer } from '../scene/SceneRenderer';
import { audio } from './audio';
import { AbortedError, bus, sleep } from './events';

type Kind = 'idle' | 'reaction' | 'relief';

/**
 * Režisér: propojuje herní stav (store), události útoků, scénáře a vykreslování.
 * Scénáře běží jako přerušitelné async funkce nad ScenarioContext.
 */
export class GameEngine {
  char = new CharacterController();
  sceneFlags = new Set<SceneFlag>();
  renderer: SceneRenderer;
  private running = false;
  private current: { ac: AbortController; scenario: Scenario; kind: Kind } | null = null;
  private queued: { scenario: Scenario; kind: Kind; info?: { device: DeviceId; attack: string } } | null = null;
  private unsubs: (() => void)[] = [];
  private lastIdle = '';

  constructor() {
    this.char.place('sofaSeat');
    this.renderer = new SceneRenderer({
      char: this.char,
      sceneFlags: this.sceneFlags,
      onDeviceTap: (id) => this.onDeviceTap(id),
    });
  }

  async mount(el: HTMLElement) {
    await this.renderer.init(el);
    this.unsubs.push(bus.on((e) => this.onEvent(e)));
    this.unsubs.push(
      useGameStore.subscribe((s, prev) => {
        if (s.sfx !== prev.sfx) audio.sfxOn = s.sfx;
        if (s.music !== prev.music) audio.setMusic(s.music);
      }),
    );
    const s = useGameStore.getState();
    audio.sfxOn = s.sfx;
    this.running = true;
    this.loop();
  }

  destroy() {
    this.running = false;
    this.current?.ac.abort();
    this.unsubs.forEach((u) => u());
    this.renderer.destroy();
  }

  private onDeviceTap(id: DeviceId) {
    const s = useGameStore.getState();
    if (s.phase === 'config') {
      audio.unlock();
      audio.play('pop');
      s.toggleSmart(id);
    } else if (s.phase === 'play') {
      selectDevice(s.selectedDevice === id ? null : id);
    }
  }

  private onEvent(e: Parameters<Parameters<typeof bus.on>[0]>[0]) {
    if (e.type === 'attack') {
      const sc = findReaction(e.device, e.attack);
      if (sc) this.interrupt(sc, 'reaction', { device: e.device, attack: e.attack });
    } else if (e.type === 'blocked') {
      this.renderer.playBlocked(e.device);
    } else if (e.type === 'restored') {
      if (e.device === 'heating' && deviceLogic.heating() !== 'max') this.sceneFlags.delete('windowOpen');
      // úleva jen tehdy, když už není napadené nic jiného (jinak by přerušila reakci na další útok)
      if (deviceLogic.anyAttack()) return;
      if (this.current?.kind === 'reaction' || (this.current?.kind === 'idle' && this.current.scenario.idle?.when)) {
        if (this.queued?.kind !== 'relief') this.interrupt(reliefScenario, 'relief');
      }
    }
  }

  private interrupt(scenario: Scenario, kind: Kind, info?: { device: DeviceId; attack: string }) {
    this.queued = { scenario, kind, info };
    this.current?.ac.abort();
  }

  private pickIdle(ctx: ScenarioContext): Scenario {
    const options = idleActivities.filter((a) => a.id !== this.lastIdle && (!a.idle?.when || a.idle.when(ctx)));
    const total = options.reduce((s, a) => s + (a.idle?.weight ?? 1), 0);
    let r = Math.random() * total;
    for (const a of options) {
      r -= a.idle?.weight ?? 1;
      if (r <= 0) return a;
    }
    return options[0] ?? idleActivities[0];
  }

  private makeContext(signal: AbortSignal): ScenarioContext {
    const c = this.char;
    const store = useGameStore.getState;
    return {
      signal,
      walkTo: (node, speed) => c.walkTo(node, signal, speed),
      wait: (ms) => sleep(ms, signal),
      pose: (p) => (c.model.pose = p),
      face: (f) => (c.model.facing = f),
      expression: (e) => (c.model.expression = e),
      emote: (e, ms) => {
        c.emote(e, ms);
        if (e === 'exclaim' || e === 'heart') audio.play('pop');
      },
      say: (t, ms) => c.say(t, ms),
      hop: () => c.hop(),
      flag: (f, on) => (on ? c.model.flags.add(f) : c.model.flags.delete(f)),
      scene: (f, on) => (on ? this.sceneFlags.add(f) : this.sceneFlags.delete(f)),
      sfx: (n) => audio.play(n),
      activity: (a) => store().setActivity(a),
      comfort: (d) => store().addComfort(d),
      outcome: (id) => store().addOutcome(id),
      hotWater: () => deviceLogic.hotWater(),
      heating: () => deviceLogic.heating(),
      lights: () => deviceLogic.lights(),
      mode: (id) => deviceLogic.mode(id),
      isSmart: (id) => store().smart[id],
    };
  }

  private resetForScenario() {
    const m = this.char.model;
    m.pose = 'stand';
    m.expression = 'neutral';
    const keepWet = m.flags.has('wet');
    m.flags.clear();
    if (keepWet) m.flags.add('wet');
    this.sceneFlags.delete('showerHot');
    this.sceneFlags.delete('showerCold');
    this.sceneFlags.delete('tv');
    this.sceneFlags.delete('doorHeld');
    this.sceneFlags.delete('washing');
    if (deviceLogic.heating() !== 'max') this.sceneFlags.delete('windowOpen');
    if (deviceLogic.lights() === 'off') m.flags.add('flashlight');
    if (deviceLogic.heating() === 'off') m.flags.add('shiver');
    if (deviceLogic.heating() === 'max') m.flags.add('sweat');
  }

  private async loop() {
    // krátká pauza na začátku
    await new Promise((r) => setTimeout(r, 600));
    while (this.running) {
      const ac = new AbortController();
      const ctx = this.makeContext(ac.signal);
      let next = this.queued;
      this.queued = null;
      if (!next) {
        const sc = this.pickIdle(ctx);
        this.lastIdle = sc.id;
        next = { scenario: sc, kind: 'idle' };
      }
      this.current = { ac, scenario: next.scenario, kind: next.kind };
      this.resetForScenario();
      try {
        await next.scenario.run(ctx, next.info);
        if (next.kind === 'idle') {
          const s = useGameStore.getState();
          if (!deviceLogic.anyAttack() && s.comfort < 90) s.addComfort(4);
        }
        await sleep(500, ac.signal);
      } catch (err) {
        if (!(err instanceof AbortedError)) console.error(err);
      }
      this.current = null;
      if (!this.running) break;
    }
  }
}
