import { Container, Graphics, Text } from 'pixi.js';
import type { EmoteId } from '../character/CharacterController';
import { P } from './palette';

type Kind = 'drop' | 'puff' | 'spark' | 'snow';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: Kind;
  size: number;
  color: number;
  floorY?: number;
}

/** Jednoduchý částicový systém kreslený jednou Graphics na snímek. */
export class Particles {
  g = new Graphics();
  private list: Particle[] = [];

  spawn(p: Partial<Particle> & { x: number; y: number; kind: Kind }) {
    if (this.list.length > 260) return;
    this.list.push({ vx: 0, vy: 0, life: 0, max: 800, size: 2, color: 0xffffff, ...p });
  }

  update(dt: number) {
    const g = this.g;
    g.clear();
    const s = dt / 1000;
    this.list = this.list.filter((p) => {
      p.life += dt;
      if (p.life > p.max) return false;
      p.x += p.vx * s;
      p.y += p.vy * s;
      if (p.kind === 'drop') p.vy += 500 * s;
      if (p.kind === 'puff') {
        p.vx *= 0.98;
        p.size += 8 * s;
      }
      if (p.floorY !== undefined && p.y > p.floorY) return false;
      const k = p.life / p.max;
      const a = p.kind === 'puff' ? Math.sin(k * Math.PI) * 0.55 : 1 - k * 0.6;
      switch (p.kind) {
        case 'drop':
          g.ellipse(p.x, p.y, p.size * 0.6, p.size * 1.5).fill({ color: p.color, alpha: a });
          break;
        case 'puff':
          g.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: a });
          break;
        case 'snow':
          g.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: a });
          break;
        case 'spark': {
          const r = p.size * (1 - k * 0.5);
          g.moveTo(p.x - r, p.y).lineTo(p.x + r, p.y).moveTo(p.x, p.y - r).lineTo(p.x, p.y + r);
          g.stroke({ width: 1.6, color: p.color, alpha: a, cap: 'round' });
          break;
        }
      }
      return true;
    });
  }
}

function star(g: Graphics, x: number, y: number, r: number, color: number) {
  const pts: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.4;
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.poly(pts).fill(color);
}

/** Ikonky emocí v bublině – čitelné i bez textu. */
export class EmoteBubble {
  container = new Container();
  private g = new Graphics();
  private icon = new Graphics();
  private glyph: Text;

  constructor() {
    this.glyph = new Text({ text: '', style: { fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: '700', fill: P.outline } });
    this.glyph.resolution = 4;
    this.glyph.anchor.set(0.5);
    this.container.addChild(this.g, this.icon, this.glyph);
  }

  draw(id: EmoteId | null, age: number, t: number) {
    const c = this.container;
    if (!id) {
      c.visible = false;
      return;
    }
    c.visible = true;
    const k = Math.min(1, age / 220);
    c.scale.set(0.4 + 0.6 * (k < 1 ? Math.sin(k * Math.PI * 0.7) * 1.15 : 1));
    const g = this.g;
    g.clear();
    g.circle(0, 2, 16).fill({ color: 0x000000, alpha: 0.1 });
    g.circle(0, 0, 16).fill(0xffffff).stroke({ width: 2, color: P.outline, alpha: 0.35 });
    g.circle(-9, 15, 4).fill(0xffffff).stroke({ width: 1.5, color: P.outline, alpha: 0.3 });
    g.circle(-14, 21, 2.2).fill(0xffffff).stroke({ width: 1.2, color: P.outline, alpha: 0.3 });

    const ic = this.icon;
    ic.clear();
    this.glyph.text = '';
    const wob = Math.sin(t / 120) * 1.5;
    switch (id) {
      case 'question':
        this.glyph.text = '?';
        this.glyph.style.fill = 0x7a5cff;
        break;
      case 'exclaim':
        this.glyph.text = '!';
        this.glyph.style.fill = P.danger;
        break;
      case 'zzz':
        this.glyph.text = 'z';
        this.glyph.style.fill = 0x6c8fd9;
        this.glyph.position.set(4 + wob, -2);
        break;
      case 'note':
        ic.circle(-3, 5 + wob, 3.5).fill(0xe27d60);
        ic.rect(0, -8 + wob, 2, 13).fill(0xe27d60);
        ic.poly([0, -8 + wob, 7, -5 + wob, 7, -2 + wob, 2, -4 + wob]).fill(0xe27d60);
        break;
      case 'heart':
        ic.moveTo(0, 8)
          .bezierCurveTo(-12, 0, -8, -10, 0, -4)
          .bezierCurveTo(8, -10, 12, 0, 0, 8)
          .fill(0xff6b8b);
        break;
      case 'snow':
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI + t / 900;
          ic.moveTo(Math.cos(a) * -9, Math.sin(a) * -9).lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
        }
        ic.stroke({ width: 2.5, color: 0x5ab0f0, cap: 'round' });
        ic.circle(0, 0, 2.5).fill(0x5ab0f0);
        break;
      case 'sweat':
        ic.moveTo(0, -9).bezierCurveTo(7, 0, 6, 8, 0, 8).bezierCurveTo(-6, 8, -7, 0, 0, -9).fill(0x6fc3f0);
        ic.circle(-2, 3, 1.6).fill(0xffffff);
        break;
      case 'anger': {
        const col = 0xff4d6a;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          ic.moveTo(sx * 2.5, sy * 8).quadraticCurveTo(sx * 2.5, sy * 2.5, sx * 8, sy * 2.5);
        }
        ic.stroke({ width: 3, color: col, cap: 'round' });
        break;
      }
      case 'sparkle':
        star(ic, -3, 1, 9, 0xf5c542);
        star(ic, 7, -6, 4, 0xf5c542);
        break;
      case 'dizzy':
        ic.moveTo(0, 0);
        for (let i = 0; i < 30; i++) {
          const a = i * 0.45 + t / 150;
          const r = i * 0.32;
          ic.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ic.stroke({ width: 2, color: 0x9b5cff, cap: 'round' });
        break;
      case 'fire':
        ic.moveTo(0, -10).bezierCurveTo(8, -2, 8, 8, 0, 9).bezierCurveTo(-8, 8, -8, -2, 0, -10).fill(0xff7a4d);
        ic.moveTo(0, -2).bezierCurveTo(4, 2, 4, 7, 0, 7).bezierCurveTo(-4, 7, -4, 2, 0, -2).fill(0xffd23f);
        break;
      case 'shield':
        ic.moveTo(0, -9).lineTo(8, -5).lineTo(6, 4).lineTo(0, 9).lineTo(-6, 4).lineTo(-8, -5).closePath().fill(P.protect);
        break;
    }
    if (id !== 'zzz') this.glyph.position.set(0, -1);
  }
}

/** Krátká bublina s textem. */
export class SpeechBubble {
  container = new Container();
  private g = new Graphics();
  private text: Text;

  constructor() {
    this.text = new Text({
      text: '',
      style: { fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: '700', fill: P.outline, align: 'center' },
    });
    this.text.resolution = 4;
    this.text.anchor.set(0.5);
    this.container.addChild(this.g, this.text);
  }

  draw(text: string | null, age: number) {
    if (!text) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;
    if (this.text.text !== text) this.text.text = text;
    const k = Math.min(1, age / 180);
    this.container.alpha = k;
    this.container.scale.set(0.85 + 0.15 * k);
    const w = this.text.width + 16;
    const h = 22;
    const g = this.g;
    g.clear();
    g.roundRect(-w / 2, -h / 2 + 2, w, h, 11).fill({ color: 0x000000, alpha: 0.08 });
    g.roundRect(-w / 2, -h / 2, w, h, 11).fill(0xffffff).stroke({ width: 1.5, color: P.outline, alpha: 0.3 });
    g.poly([-4, h / 2 - 1, 4, h / 2 - 1, 0, h / 2 + 6]).fill(0xffffff);
  }
}
