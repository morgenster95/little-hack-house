import type { DeviceId } from '../../config/devices';
import type { WaypointId } from '../../config/layout';
import type { HeatMode, LightMode } from '../../stores/gameStore';
import type { CharFlag, EmoteId, Expression, Facing, Pose } from '../character/CharacterController';
import type { SfxName } from '../engine/audio';

/** doorHeld – postavička drží dveře zavřené; washing – pračka běží (běžné praní). */
export type SceneFlag = 'showerHot' | 'showerCold' | 'tv' | 'windowOpen' | 'doorHeld' | 'washing';

/**
 * API, přes které scénáře řídí postavičku a scénu.
 * Scénáře nevědí nic o vykreslování – jen volají tyto funkce.
 */
export interface ScenarioContext {
  signal: AbortSignal;
  walkTo(node: WaypointId, speed?: number): Promise<void>;
  wait(ms: number): Promise<void>;
  pose(p: Pose): void;
  face(f: Facing): void;
  expression(e: Expression): void;
  emote(e: EmoteId, ms?: number): void;
  say(text: string, ms?: number): void;
  hop(): void;
  flag(f: CharFlag, on: boolean): void;
  scene(f: SceneFlag, on: boolean): void;
  sfx(name: SfxName): void;
  activity(label: string): void;
  comfort(delta: number): void;
  outcome(id: string): void;
  // stav zařízení
  hotWater(): boolean;
  heating(): HeatMode;
  lights(): LightMode;
  /** Aktivní útok na zařízení, nebo 'normal'. */
  mode(id: DeviceId): string;
  isSmart(id: DeviceId): boolean;
}

export interface Scenario {
  id: string;
  /** Spustí se po útoku na dané zařízení (případně konkrétní útok). */
  triggers?: { device: DeviceId; attack?: string }[];
  /** Volné aktivity: váha a podmínka. */
  idle?: { weight: number; when?: (ctx: ScenarioContext) => boolean };
  run(ctx: ScenarioContext, info?: { device: DeviceId; attack: string }): Promise<void>;
}
