import { Container, Graphics } from 'pixi.js';
import type { CharacterModel } from '../character/CharacterController';
import { EmoteBubble, Particles, SpeechBubble } from './effects';
import { iso } from './iso';
import { FLOOR_M, zpx } from './space';

const SEATED = new Set(['sit', 'sleep', 'blanket', 'read']);

/** Efekty kolem postavičky jsou kreslené v původních jednotkách; v novém domě jsou o čtvrtinu větší. */
export const CHAR_SCALE = 1.25;

/**
 * Efekty kolem postavičky v překryvné Pixi vrstvě: záře, částice (kapky, pot, sníh, jiskry) a bubliny.
 * Samotnou postavičku kreslí 3D scéna (three/Avatar3D.ts).
 */
export class CharacterView {
  fx = new Container();
  private particles = new Particles();
  private glow = new Graphics();
  private emote = new EmoteBubble();
  private speech = new SpeechBubble();
  private dripT = 0;

  constructor() {
    this.glow.blendMode = 'add';
    this.fx.addChild(this.glow, this.particles.g, this.emote.container, this.speech.container);
  }

  update(m: CharacterModel, now: number, dt: number) {
    const p = iso(m.x, m.y, zpx(FLOOR_M));
    const seated = SEATED.has(m.pose);
    // 3D postava v sedu klesne asi o 0,2 m
    const seat = seated ? 10 : 0;
    let hop = 0;
    if (m.hopStart >= 0) {
      const k = Math.min(1, (now - m.hopStart) / 450);
      hop = Math.sin(k * Math.PI) * 16;
    }
    const shiver = m.flags.has('shiver') ? Math.sin(now / 22) * 1.3 : 0;
    this.glow.position.set(p.x + shiver * CHAR_SCALE, p.y);
    this.glow.scale.set(CHAR_SCALE);
    this.particles.g.position.set(p.x + shiver * CHAR_SCALE, p.y);
    this.particles.g.scale.set(CHAR_SCALE);

    this.drawGlow(m, now, seat);

    // částice
    this.dripT += dt;
    if (m.flags.has('wet') && this.dripT > 140) {
      this.dripT = 0;
      this.particles.spawn({ kind: 'drop', x: (Math.random() - 0.5) * 22, y: -seat - 30 - Math.random() * 45, vy: 20, max: 500, size: 1.8, color: 0x7cc7f2, floorY: 2 });
    }
    if (m.flags.has('sweat') && this.dripT > 260) {
      this.dripT = 0;
      this.particles.spawn({ kind: 'drop', x: (Math.random() < 0.5 ? -1 : 1) * 14, y: -seat - 80, vx: (Math.random() - 0.5) * 30, vy: -40, max: 600, size: 1.8, color: 0x8fd3f5, floorY: 4 });
    }
    if (m.flags.has('shiver') && Math.random() < dt / 600) {
      this.particles.spawn({ kind: 'snow', x: (Math.random() - 0.5) * 30, y: -seat - 45 - Math.random() * 60, vy: 14, max: 900, size: 1.6, color: 0xdff1ff });
    }
    if (m.flags.has('warmGlow') && Math.random() < dt / 250) {
      this.particles.spawn({ kind: 'spark', x: (Math.random() - 0.5) * 30, y: -seat - 15 - Math.random() * 60, vy: -26, max: 900, size: 3, color: 0xffb36b });
    }
    this.particles.update(dt);

    // bubliny
    const headY = p.y - (seat + hop + 80) * CHAR_SCALE;
    this.emote.container.position.set(p.x + 20 * CHAR_SCALE, headY - 4);
    this.emote.draw(m.emote?.id ?? null, m.emote ? now - m.emote.born : 0, now);
    this.speech.container.position.set(p.x, headY - (m.emote ? 34 : 6));
    this.speech.draw(m.speech?.text ?? null, m.speech ? now - m.speech.born : 0);
  }

  private drawGlow(m: CharacterModel, now: number, seat: number) {
    const g = this.glow;
    g.clear();
    if (m.flags.has('warmGlow')) {
      const a = 0.25 + Math.sin(now / 200) * 0.08;
      g.ellipse(0, -seat - 42, 34, 46).fill({ color: 0xffa25c, alpha: a });
    }
    if (m.flags.has('flashlight')) {
      const dir = m.facing === 'left' ? -1 : 1;
      g.poly([dir * 10, -seat - 36, dir * 70, -seat - 58, dir * 70, -seat - 6]).fill({ color: 0xfff3b0, alpha: 0.35 });
      g.ellipse(0, -seat - 44, 30, 46).fill({ color: 0xfff3b0, alpha: 0.18 });
    }
  }
}
