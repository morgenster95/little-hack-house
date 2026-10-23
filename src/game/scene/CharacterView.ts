import { Container, Graphics } from 'pixi.js';
import type { CharacterModel, Expression } from '../character/CharacterController';
import { EmoteBubble, Particles, SpeechBubble } from './effects';
import { iso, mix, OUTLINE } from './iso';

const SKIN = 0xffd9bd;
const HAIR = 0x7a4b33;
const SWEATER = 0x4fb3a5;
const SWEATER_DARK = 0x3f9a8d;
const PANTS = 0x4a4e69;
const BLANKET = 0xf2c46d;
const INK = 0x3b2a26;

const SEATED = new Set(['sit', 'sleep', 'blanket', 'read']);

/** Vykreslení postavičky z modelu. Celá grafika je procedurální (vektorová). */
export class CharacterView {
  node = new Container();
  private body = new Graphics();
  private particles = new Particles();
  fx = new Container();
  private glow = new Graphics();
  private emote = new EmoteBubble();
  private speech = new SpeechBubble();
  private dripT = 0;

  constructor() {
    this.node.addChild(this.body, this.particles.g);
    this.glow.blendMode = 'add';
    this.fx.addChild(this.glow, this.emote.container, this.speech.container);
  }

  update(m: CharacterModel, now: number, dt: number) {
    const p = iso(m.x, m.y, 0);
    const seated = SEATED.has(m.pose);
    const seat = seated ? 21 : 0;
    let hop = 0;
    if (m.hopStart >= 0) {
      const k = Math.min(1, (now - m.hopStart) / 450);
      hop = Math.sin(k * Math.PI) * 16;
    }
    const bob = m.moving ? Math.abs(Math.sin(m.walkPhase)) * 2.2 : m.pose === 'dance' ? Math.abs(Math.sin(now / 160)) * 5 : 0;
    const shiver = m.flags.has('shiver') ? Math.sin(now / 22) * 1.3 : 0;
    this.node.position.set(p.x + shiver, p.y);
    this.glow.position.set(p.x + shiver, p.y);
    const bias = seated ? (m.pose === 'read' ? 0.6 : 0.35) : m.depthBias;
    this.node.zIndex = (m.x + m.y + bias) * 100;

    this.draw(m, now, seat + hop + bob);
    this.drawGlow(m, now, seat);

    // částice
    this.dripT += dt;
    if (m.flags.has('wet') && this.dripT > 140) {
      this.dripT = 0;
      this.particles.spawn({ kind: 'drop', x: (Math.random() - 0.5) * 22, y: -seat - 20 - Math.random() * 30, vy: 20, max: 500, size: 1.8, color: 0x7cc7f2, floorY: 2 });
    }
    if (m.flags.has('sweat') && this.dripT > 260) {
      this.dripT = 0;
      this.particles.spawn({ kind: 'drop', x: (Math.random() < 0.5 ? -1 : 1) * 14, y: -seat - 54, vx: (Math.random() - 0.5) * 30, vy: -40, max: 600, size: 1.8, color: 0x8fd3f5, floorY: 4 });
    }
    if (m.flags.has('shiver') && Math.random() < dt / 600) {
      this.particles.spawn({ kind: 'snow', x: (Math.random() - 0.5) * 30, y: -seat - 30 - Math.random() * 40, vy: 14, max: 900, size: 1.6, color: 0xdff1ff });
    }
    if (m.flags.has('warmGlow') && Math.random() < dt / 250) {
      this.particles.spawn({ kind: 'spark', x: (Math.random() - 0.5) * 30, y: -seat - 10 - Math.random() * 40, vy: -26, max: 900, size: 3, color: 0xffb36b });
    }
    this.particles.update(dt);

    // bubliny
    const headY = p.y - seat - hop - 74;
    this.emote.container.position.set(p.x + 20, headY - 4);
    this.emote.draw(m.emote?.id ?? null, m.emote ? now - m.emote.born : 0, now);
    this.speech.container.position.set(p.x, headY - (m.emote ? 34 : 6));
    this.speech.draw(m.speech?.text ?? null, m.speech ? now - m.speech.born : 0);
  }

  private drawGlow(m: CharacterModel, now: number, seat: number) {
    const g = this.glow;
    g.clear();
    if (m.flags.has('warmGlow')) {
      const a = 0.25 + Math.sin(now / 200) * 0.08;
      g.ellipse(0, -seat - 26, 34, 36).fill({ color: 0xffa25c, alpha: a });
    }
    if (m.flags.has('flashlight')) {
      const dir = m.facing === 'left' ? -1 : 1;
      g.poly([dir * 10, -seat - 24, dir * 70, -seat - 46, dir * 70, -seat + 6]).fill({ color: 0xfff3b0, alpha: 0.35 });
      g.ellipse(0, -seat - 30, 30, 36).fill({ color: 0xfff3b0, alpha: 0.18 });
    }
  }

  private draw(m: CharacterModel, now: number, lift: number) {
    const g = this.body;
    g.clear();
    const back = m.facing === 'back';
    const dir = m.facing === 'left' ? -1 : 1;
    const ox = m.facing === 'left' || m.facing === 'right' ? 3 * dir : 0;
    const pose = m.pose;
    const shower = pose === 'shower';
    let skin = SKIN;
    if (m.flags.has('shiver') || m.expression === 'cold') skin = mix(SKIN, 0xc4dcff, 0.4);
    if (m.flags.has('sweat') || m.expression === 'hot') skin = mix(SKIN, 0xff9c8a, 0.3);
    const hair = m.flags.has('wet') ? 0x5a3524 : HAIR;
    const sweater = shower ? skin : SWEATER;
    const sweaterDark = shower ? mix(skin, 0x000000, 0.08) : SWEATER_DARK;

    // stín
    g.ellipse(0, 0, 13, 5).fill({ color: 0x3b2a26, alpha: lift > 18 ? 0.1 : 0.18 });

    const y0 = -lift;

    if (pose === 'blanket') {
      // zabalený v dece
      g.roundRect(-18, y0 - 40, 36, 42, 15).fill(BLANKET).stroke(OUTLINE);
      for (let i = 0; i < 3; i++) g.moveTo(-15, y0 - 30 + i * 10).lineTo(15, y0 - 30 + i * 10);
      g.stroke({ width: 2, color: 0xe5a94a, alpha: 0.8 });
      this.head(g, m, y0, ox, back, skin, hair, now);
      g.roundRect(-14, y0 - 46, 28, 9, 4.5).fill(BLANKET).stroke(OUTLINE);
      return;
    }

    // nohy
    const seated = SEATED.has(pose);
    if (seated) {
      g.roundRect(-9, y0 - 6, 7, 9, 3).fill(shower ? skin : PANTS);
      g.roundRect(2, y0 - 6, 7, 9, 3).fill(shower ? skin : PANTS);
      g.ellipse(-5.5, y0 + 3, 4.5, 2.5).fill(0xe27d60);
      g.ellipse(5.5, y0 + 3, 4.5, 2.5).fill(0xe27d60);
    } else {
      const ph = m.walkPhase;
      const l = m.moving ? Math.max(0, Math.sin(ph)) * 3 : 0;
      const r = m.moving ? Math.max(0, -Math.sin(ph)) * 3 : 0;
      g.roundRect(-8, y0 - 13 - l, 6, 13, 3).fill(shower ? skin : PANTS);
      g.roundRect(2, y0 - 13 - r, 6, 13, 3).fill(shower ? skin : PANTS);
      g.ellipse(-5, y0 - l, 4.5, 2.6).fill(0xe27d60);
      g.ellipse(5, y0 - r, 4.5, 2.6).fill(0xe27d60);
    }

    // ruce za tělem (při pohledu zezadu nebo „hřeje se")
    const arms = this.armPose(m, now);
    if (back) this.drawArms(g, arms, y0, sweaterDark, skin);

    // tělo
    g.roundRect(-12.5, y0 - 36, 25, 26, 11).fill(sweater).stroke(OUTLINE);
    if (!shower) {
      g.roundRect(-12.5, y0 - 22, 25, 4, 2).fill({ color: 0xffffff, alpha: 0.35 });
      if (!back) g.ellipse(0, y0 - 35, 7, 3).fill(sweaterDark);
    } else {
      // ručník kolem pasu
      g.roundRect(-13, y0 - 18, 26, 10, 4).fill(0xffffff).stroke(OUTLINE);
    }

    if (!back) this.drawArms(g, arms, y0, sweaterDark, skin);

    if (pose === 'read') {
      g.roundRect(-11, y0 - 32, 22, 14, 2).fill(0xe27d60).stroke(OUTLINE);
      g.rect(-0.75, y0 - 32, 1.5, 14).fill(0xfff2dc);
    }

    this.head(g, m, y0, ox, back, skin, hair, now);
  }

  private armPose(m: CharacterModel, now: number): [number, number, number, number] {
    // [lx, ly, rx, ry] pozice dlaní relativně k y0
    const e = m.expression;
    if (m.pose === 'dance') {
      const s = Math.sin(now / 160);
      return [-16, -30 - s * 10, 16, -30 + s * 10];
    }
    if (m.pose === 'press') return [-14, -18, 13, -44];
    if (m.pose === 'warm') return [-9, -27, 9, -27];
    if (m.pose === 'read') return [-10, -24, 10, -24];
    if (m.pose === 'shower') return [-15, -38, 15, -38];
    if (m.flags.has('flashlight')) return [-14, -18, 13, -28];
    if (e === 'surprised' || e === 'scared') return [-17, -38, 17, -38];
    if (e === 'cold' || m.flags.has('shiver')) return [-6, -25, 6, -27];
    if (e === 'angry') return [-15, -20, 15, -20];
    if (e === 'hot') return [-12, -42, 15, -18];
    return [-14, -16, 14, -16];
  }

  private drawArms(g: Graphics, a: [number, number, number, number], y0: number, sleeve: number, skin: number) {
    const [lx, ly, rx, ry] = a;
    g.moveTo(-10, y0 - 30).lineTo(lx, y0 + ly).stroke({ width: 6, color: sleeve, cap: 'round' });
    g.moveTo(10, y0 - 30).lineTo(rx, y0 + ry).stroke({ width: 6, color: sleeve, cap: 'round' });
    g.circle(lx, y0 + ly, 3.6).fill(skin).stroke({ ...OUTLINE, alpha: 0.3 });
    g.circle(rx, y0 + ry, 3.6).fill(skin).stroke({ ...OUTLINE, alpha: 0.3 });
  }

  private head(g: Graphics, m: CharacterModel, y0: number, ox: number, back: boolean, skin: number, hair: number, now: number) {
    const hy = y0 - 50;
    const tilt = m.pose === 'sleep' ? 3 : 0;
    // hlava
    g.circle(tilt, hy, 16).fill(skin).stroke(OUTLINE);
    if (m.flags.has('showerCap')) {
      g.ellipse(tilt, hy - 7, 18, 12).fill(0xf7a8c4).stroke(OUTLINE);
      for (const [dx, dy] of [[-8, -10], [2, -14], [9, -6], [-2, -5]]) g.circle(tilt + dx, hy + dy, 1.8).fill(0xffffff);
    } else if (back) {
      g.circle(tilt, hy, 16).fill(hair).stroke(OUTLINE);
      g.ellipse(tilt + 2, hy - 15, 5, 4).fill(hair);
    } else {
      // vlasy s ofinou
      g.moveTo(tilt - 16, hy + 1)
        .arc(tilt, hy, 16, Math.PI, Math.PI * 2)
        .lineTo(tilt + 16, hy + 1)
        .quadraticCurveTo(tilt + 12, hy - 8, tilt + ox + 6, hy - 6)
        .quadraticCurveTo(tilt + ox, hy - 10, tilt + ox - 5, hy - 5)
        .quadraticCurveTo(tilt - 11, hy - 8, tilt - 16, hy + 1)
        .fill(hair);
      const tuft = m.flags.has('wet') ? 0 : Math.sin(now / 400) * 1.5;
      g.ellipse(tilt + 3 + tuft, hy - 17, 4, 6).fill(hair);
    }
    if (back) return;
    this.face(g, m.expression, tilt + ox, hy + 2, now);
  }

  private face(g: Graphics, e: Expression, x: number, y: number, now: number) {
    const blink = Math.floor(now / 3300) !== Math.floor((now - 120) / 3300);
    const eyeY = y - 1;
    const L = x - 6;
    const R = x + 6;
    const blushAlpha = e === 'hot' || e === 'angry' ? 0.8 : 0.45;
    const blushCol = e === 'cold' ? 0x9cc9f5 : 0xff9aa2;
    g.ellipse(x - 10, y + 4, 3.5, 2.2).fill({ color: blushCol, alpha: blushAlpha });
    g.ellipse(x + 10, y + 4, 3.5, 2.2).fill({ color: blushCol, alpha: blushAlpha });
    const line = (pts: number[], w = 1.8) => {
      g.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.stroke({ width: w, color: INK, cap: 'round', join: 'round' });
    };
    const dotEyes = (r = 2.2) => {
      if (blink) {
        line([L - 2, eyeY, L + 2, eyeY]);
        line([R - 2, eyeY, R + 2, eyeY]);
      } else {
        g.circle(L, eyeY, r).fill(INK);
        g.circle(R, eyeY, r).fill(INK);
        g.circle(L + 0.8, eyeY - 0.8, r * 0.35).fill(0xffffff);
        g.circle(R + 0.8, eyeY - 0.8, r * 0.35).fill(0xffffff);
      }
    };
    const happyEyes = () => {
      g.moveTo(L - 2.5, eyeY + 1).quadraticCurveTo(L, eyeY - 3, L + 2.5, eyeY + 1);
      g.moveTo(R - 2.5, eyeY + 1).quadraticCurveTo(R, eyeY - 3, R + 2.5, eyeY + 1);
      g.stroke({ width: 1.8, color: INK, cap: 'round' });
    };
    const my = y + 6;
    switch (e) {
      case 'happy':
        happyEyes();
        g.moveTo(x - 3.5, my - 1).quadraticCurveTo(x, my + 4, x + 3.5, my - 1).closePath().fill(0xc4524e);
        break;
      case 'relieved':
        happyEyes();
        g.moveTo(x - 3, my).quadraticCurveTo(x, my + 2.5, x + 3, my).stroke({ width: 1.6, color: INK, cap: 'round' });
        break;
      case 'surprised':
        g.circle(L, eyeY, 3.3).fill(0xffffff).stroke({ width: 1.2, color: INK });
        g.circle(R, eyeY, 3.3).fill(0xffffff).stroke({ width: 1.2, color: INK });
        g.circle(L, eyeY, 1.5).fill(INK);
        g.circle(R, eyeY, 1.5).fill(INK);
        g.ellipse(x, my + 1, 2.4, 3).fill(0xc4524e);
        break;
      case 'scared':
        g.circle(L, eyeY, 3.3).fill(0xffffff).stroke({ width: 1.2, color: INK });
        g.circle(R, eyeY, 3.3).fill(0xffffff).stroke({ width: 1.2, color: INK });
        g.circle(L, eyeY + 0.5, 1).fill(INK);
        g.circle(R, eyeY + 0.5, 1).fill(INK);
        line([x - 4, my + 1, x - 2, my - 0.5, x, my + 1, x + 2, my - 0.5, x + 4, my + 1], 1.5);
        break;
      case 'cold': {
        line([L - 2.5, eyeY - 2, L + 1.5, eyeY, L - 2.5, eyeY + 2]);
        line([R + 2.5, eyeY - 2, R - 1.5, eyeY, R + 2.5, eyeY + 2]);
        const ch = Math.sin(now / 40) > 0 ? 0.6 : -0.6;
        g.roundRect(x - 4, my - 2 + ch, 8, 4, 1.5).fill(0xffffff).stroke({ width: 1.2, color: INK });
        line([x - 4, my + ch, x + 4, my + ch], 0.9);
        break;
      }
      case 'hot':
        line([L - 2.5, eyeY, L + 2.5, eyeY]);
        line([R - 2.5, eyeY, R + 2.5, eyeY]);
        g.moveTo(x - 3.5, my - 1).quadraticCurveTo(x, my + 3, x + 3.5, my - 1).closePath().fill(0xc4524e);
        g.ellipse(x + 1, my + 2.5, 2, 2.6).fill(0xff8fa3);
        break;
      case 'angry':
        line([L - 3, eyeY - 4.5, L + 2.5, eyeY - 2.5]);
        line([R + 3, eyeY - 4.5, R - 2.5, eyeY - 2.5]);
        dotEyes(2);
        g.moveTo(x - 3.5, my + 2).quadraticCurveTo(x, my - 2, x + 3.5, my + 2).stroke({ width: 1.8, color: INK, cap: 'round' });
        break;
      case 'confused':
        g.circle(L, eyeY, 2.6).fill(INK);
        g.circle(R, eyeY, 1.6).fill(INK);
        line([R - 2.5, eyeY - 4.5, R + 2.5, eyeY - 3.5]);
        line([x - 3.5, my, x - 1.5, my - 1, x + 0.5, my + 1, x + 2.5, my - 0.5, x + 3.5, my]);
        break;
      case 'tired':
      case 'sleepy':
        line([L - 2.5, eyeY + 0.5, L + 2.5, eyeY + 0.5]);
        line([R - 2.5, eyeY + 0.5, R + 2.5, eyeY + 0.5]);
        if (e === 'sleepy') g.ellipse(x, my + 0.5, 1.6, 1.3).fill(0xc4524e);
        else line([x - 2.5, my + 0.5, x + 2.5, my + 0.5], 1.5);
        break;
      case 'sad':
        line([L - 3, eyeY - 2.5, L + 2.5, eyeY - 4]);
        line([R + 3, eyeY - 2.5, R - 2.5, eyeY - 4]);
        dotEyes(2);
        g.moveTo(x - 3, my + 2).quadraticCurveTo(x, my - 1, x + 3, my + 2).stroke({ width: 1.6, color: INK, cap: 'round' });
        break;
      case 'dizzy':
        for (const ex of [L, R]) {
          line([ex - 2.2, eyeY - 2.2, ex + 2.2, eyeY + 2.2]);
          line([ex + 2.2, eyeY - 2.2, ex - 2.2, eyeY + 2.2]);
        }
        line([x - 3.5, my, x - 1.5, my + 1.5, x + 0.5, my, x + 2.5, my + 1.5], 1.5);
        break;
      default:
        dotEyes();
        g.moveTo(x - 3, my).quadraticCurveTo(x, my + 2.5, x + 3, my).stroke({ width: 1.6, color: INK, cap: 'round' });
    }
  }
}
