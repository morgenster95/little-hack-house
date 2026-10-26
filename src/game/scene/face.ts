import * as THREE from 'three';
import type { Expression } from '../character/CharacterController';

const INK = 0x3b2a26;

type FillStyle = number | { color: number; alpha?: number };
interface StrokeStyle {
  width?: number;
  color?: number;
  alpha?: number;
  cap?: CanvasLineCap;
  join?: CanvasLineJoin;
}

const css = (color: number, alpha = 1) => `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;

/**
 * Tenká obálka nad Canvas 2D s API jako Pixi Graphics (tvary se sbírají do cesty,
 * fill/stroke ji vykreslí). Díky tomu zůstala kresba výrazů stejná jako u vektorové postavičky.
 */
class Pen {
  private fresh = true;
  constructor(private ctx: CanvasRenderingContext2D) {}

  private path() {
    if (this.fresh) {
      this.ctx.beginPath();
      this.fresh = false;
    }
    return this.ctx;
  }

  moveTo(x: number, y: number) {
    this.path().moveTo(x, y);
    return this;
  }
  lineTo(x: number, y: number) {
    this.path().lineTo(x, y);
    return this;
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    this.path().quadraticCurveTo(cx, cy, x, y);
    return this;
  }
  closePath() {
    this.path().closePath();
    return this;
  }
  circle(x: number, y: number, r: number) {
    const c = this.path();
    c.moveTo(x + r, y);
    c.arc(x, y, r, 0, Math.PI * 2);
    return this;
  }
  ellipse(x: number, y: number, rx: number, ry: number) {
    const c = this.path();
    c.moveTo(x + rx, y);
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    return this;
  }
  roundRect(x: number, y: number, w: number, h: number, r: number) {
    this.path().roundRect(x, y, w, h, r);
    return this;
  }
  fill(s: FillStyle) {
    this.ctx.fillStyle = typeof s === 'number' ? css(s) : css(s.color, s.alpha);
    this.ctx.fill();
    this.fresh = true;
    return this;
  }
  stroke(s: StrokeStyle) {
    const c = this.ctx;
    c.lineWidth = s.width ?? 1;
    c.strokeStyle = css(s.color ?? 0, s.alpha);
    c.lineCap = s.cap ?? 'butt';
    c.lineJoin = s.join ?? 'miter';
    c.stroke();
    this.fresh = true;
    return this;
  }
}

/** Plátno pokrývá ±FACE_U jednotek kresby kolem středu obličeje (shodně s tools/blender/avatar.py). */
const FACE_U = 20;

/**
 * Výraz obličeje jako textura pro rovinu „face“ na hlavě 3D postavičky.
 * Překresluje se jen při změně výrazu, mrknutí nebo cvakání zubů.
 */
export class FaceCanvas {
  canvas = document.createElement('canvas');
  tex: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private pen: Pen;
  private key = '';

  constructor(px = 256) {
    this.canvas.width = this.canvas.height = px;
    this.ctx = this.canvas.getContext('2d')!;
    this.pen = new Pen(this.ctx);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.NoColorSpace;
    this.tex.flipY = false;
    this.tex.anisotropy = 4;
  }

  update(e: Expression, now: number) {
    const blink = Math.floor(now / 3300) !== Math.floor((now - 120) / 3300);
    const chatter = e === 'cold' && Math.sin(now / 40) > 0;
    const key = `${e}|${blink}|${chatter}`;
    if (key === this.key) return;
    this.key = key;
    const c = this.ctx;
    const k = this.canvas.width / (2 * FACE_U);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(k, 0, 0, k, this.canvas.width / 2, this.canvas.height / 2);
    drawFace(this.pen, e, 0, 0, blink, chatter);
    this.tex.needsUpdate = true;
  }
}

function drawFace(g: Pen, e: Expression, x: number, y: number, blink: boolean, chatter: boolean) {
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
      const ch = chatter ? 0.6 : -0.6;
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
