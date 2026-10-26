import { WaypointId } from '../../config/layout';
import { AbortedError, sleep } from '../engine/events';
import { findPath, wp } from './navigation';

export type Pose =
  | 'stand'
  | 'sit'
  | 'shower'
  | 'sleep'
  | 'warm'
  | 'blanket'
  | 'dance'
  | 'read'
  | 'press'
  | 'slip'
  | 'ears'
  | 'tuck'
  | 'phone';
export type Expression =
  | 'neutral'
  | 'happy'
  | 'surprised'
  | 'scared'
  | 'cold'
  | 'hot'
  | 'angry'
  | 'confused'
  | 'tired'
  | 'relieved'
  | 'sad'
  | 'dizzy'
  | 'sleepy';
export type EmoteId =
  | 'question'
  | 'exclaim'
  | 'heart'
  | 'snow'
  | 'sweat'
  | 'anger'
  | 'zzz'
  | 'note'
  | 'sparkle'
  | 'dizzy'
  | 'fire'
  | 'shield';
export type CharFlag = 'wet' | 'shiver' | 'sweat' | 'flashlight' | 'warmGlow' | 'showerCap';
/**
 * Kam se postava dívá: left/right/front/back podle obrazovky (back = ke zdi y = 0),
 * sw/se/nw/ne přesně podél os mřížky (sw = +y, k televizi a ke dveřím; nw = −x, k pračce).
 */
export type Facing = 'left' | 'right' | 'front' | 'back' | 'sw' | 'se' | 'nw' | 'ne';

/** Čistý model postavičky – nic nevykresluje, jen drží stav. */
export class CharacterModel {
  x = 8.5;
  y = 0.7;
  pose: Pose = 'sit';
  expression: Expression = 'neutral';
  facing: Facing = 'front';
  flags = new Set<CharFlag>();
  emote: { id: EmoteId; until: number; born: number } | null = null;
  speech: { text: string; until: number; born: number } | null = null;
  moving = false;
  walkPhase = 0;
  hopStart = -1;
  depthBias = 0;
}

interface Walk {
  queue: { x: number; y: number; id: WaypointId }[];
  resolve: () => void;
  reject: (e: Error) => void;
  speed: number;
}

export class CharacterController {
  model = new CharacterModel();
  private lastNode: WaypointId = 'sofaSeat';
  private heading: WaypointId | null = null;
  private walk: Walk | null = null;
  time = 0;

  get node() {
    return this.heading ?? this.lastNode;
  }

  /** Okamžitě postaví postavu na waypoint. */
  place(id: WaypointId) {
    const p = wp(id);
    this.model.x = p.x;
    this.model.y = p.y;
    this.lastNode = id;
    this.heading = null;
  }

  walkTo(target: WaypointId, signal: AbortSignal, speed = 2.5): Promise<void> {
    if (signal.aborted) return Promise.reject(new AbortedError());
    const path = findPath(this.node, target);
    const queue = path.map((id) => ({ ...wp(id), id }));
    // když stojíme přesně na startovním uzlu, přeskočíme ho
    if (queue.length && Math.hypot(queue[0].x - this.model.x, queue[0].y - this.model.y) < 0.01) queue.shift();
    if (!queue.length) return Promise.resolve();
    this.model.pose = 'stand';
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        if (this.walk) {
          this.walk = null;
          this.model.moving = false;
        }
        reject(new AbortedError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.walk = {
        queue,
        speed,
        resolve: () => {
          signal.removeEventListener('abort', onAbort);
          resolve();
        },
        reject,
      };
      this.model.moving = true;
      this.heading = queue[0].id;
    });
  }

  emote(id: EmoteId, ms = 1800) {
    this.model.emote = { id, until: this.time + ms, born: this.time };
  }

  say(text: string, ms = 2200) {
    this.model.speech = { text, until: this.time + ms, born: this.time };
  }

  hop() {
    this.model.hopStart = this.time;
  }

  async wait(ms: number, signal: AbortSignal) {
    await sleep(ms, signal);
  }

  update(dtMs: number) {
    this.time += dtMs;
    const m = this.model;
    if (m.emote && this.time > m.emote.until) m.emote = null;
    if (m.speech && this.time > m.speech.until) m.speech = null;
    if (m.hopStart >= 0 && this.time - m.hopStart > 450) m.hopStart = -1;

    const w = this.walk;
    if (!w) return;
    let remaining = (w.speed * dtMs) / 1000;
    while (remaining > 0 && w.queue.length) {
      const t = w.queue[0];
      const dx = t.x - m.x;
      const dy = t.y - m.y;
      const dist = Math.hypot(dx, dy);
      // směr na obrazovce: sx = dx - dy, sy = dx + dy
      const sx = dx - dy;
      const sy = dx + dy;
      if (dist > 0.001) {
        if (Math.abs(sx) > Math.abs(sy) * 0.35) m.facing = sx > 0 ? 'right' : 'left';
        else m.facing = sy > 0 ? 'front' : 'back';
        if (sy < -0.05 && Math.abs(sx) < Math.abs(sy) * 1.6) m.facing = 'back';
      }
      if (dist <= remaining) {
        m.x = t.x;
        m.y = t.y;
        remaining -= dist;
        this.lastNode = t.id;
        w.queue.shift();
        this.heading = w.queue[0]?.id ?? null;
      } else {
        m.x += (dx / dist) * remaining;
        m.y += (dy / dist) * remaining;
        remaining = 0;
      }
    }
    m.walkPhase += dtMs * 0.014 * (w.speed / 2.5);
    if (!w.queue.length) {
      this.walk = null;
      m.moving = false;
      w.resolve();
    }
  }
}
