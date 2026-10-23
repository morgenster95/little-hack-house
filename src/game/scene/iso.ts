import { Graphics } from 'pixi.js';

/** Izometrická projekce 2:1. */
export const TW = 64;
export const TH = 32;

export function iso(x: number, y: number, z = 0) {
  return { x: ((x - y) * TW) / 2, y: ((x + y) * TH) / 2 - z };
}

export function pts(list: [number, number, number][]) {
  const out: number[] = [];
  for (const [x, y, z] of list) {
    const p = iso(x, y, z);
    out.push(p.x, p.y);
  }
  return out;
}

export function shade(color: number, f: number) {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * f));
  const b = Math.min(255, Math.round((color & 255) * f));
  return (r << 16) | (g << 8) | b;
}

export function mix(a: number, b: number, t: number) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export const OUTLINE = { width: 1.2, color: 0x5b4335, alpha: 0.45, join: 'round' as const };

export interface BoxColors {
  top: number;
  left?: number;
  right?: number;
}

/** Kvádr – kreslí horní, levou-přední (y+d) a pravou-přední (x+w) stěnu. */
export function box(
  g: Graphics,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  c: BoxColors,
  outline = true,
  alpha = 1,
) {
  const left = c.left ?? shade(c.top, 0.86);
  const right = c.right ?? shade(c.top, 0.72);
  g.poly(pts([[x, y + d, z + h], [x + w, y + d, z + h], [x + w, y + d, z], [x, y + d, z]])).fill({ color: left, alpha });
  if (outline) g.stroke(OUTLINE);
  g.poly(pts([[x + w, y, z + h], [x + w, y + d, z + h], [x + w, y + d, z], [x + w, y, z]])).fill({ color: right, alpha });
  if (outline) g.stroke(OUTLINE);
  g.poly(pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]])).fill({ color: c.top, alpha });
  if (outline) g.stroke(OUTLINE);
}

/** Obdélník na rovině y = konst (zadní stěna). */
export function quadY(g: Graphics, y: number, x0: number, x1: number, z0: number, z1: number, color: number, alpha = 1, outline = false) {
  g.poly(pts([[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]])).fill({ color, alpha });
  if (outline) g.stroke(OUTLINE);
}

/** Obdélník na rovině x = konst (levá stěna). */
export function quadX(g: Graphics, x: number, y0: number, y1: number, z0: number, z1: number, color: number, alpha = 1, outline = false) {
  g.poly(pts([[x, y0, z1], [x, y1, z1], [x, y1, z0], [x, y0, z0]])).fill({ color, alpha });
  if (outline) g.stroke(OUTLINE);
}

/** Vodorovný obdélník (podlaha, koberec). */
export function quadZ(g: Graphics, x0: number, y0: number, x1: number, y1: number, z: number, color: number, alpha = 1, outline = false) {
  g.poly(pts([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]])).fill({ color, alpha });
  if (outline) g.stroke(OUTLINE);
}

/** Kruh ležící na svislé rovině x = konst (r v jednotkách mřížky). */
export function circleOnX(g: Graphics, x: number, cy: number, cz: number, r: number) {
  const out: [number, number, number][] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    out.push([x, cy + Math.cos(a) * r, cz + Math.sin(a) * r * 35.8]);
  }
  return g.poly(pts(out));
}

/** Kruh ležící na svislé rovině y = konst. */
export function circleOnY(g: Graphics, y: number, cx: number, cz: number, r: number) {
  const out: [number, number, number][] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r * 35.8]);
  }
  return g.poly(pts(out));
}

/** Kruh na podlaze. */
export function circleOnZ(g: Graphics, cx: number, cy: number, z: number, r: number) {
  const c = iso(cx, cy, z);
  return g.ellipse(c.x, c.y, r * 45.25, r * 22.63);
}

/** Svislý válec. */
export function cylinder(g: Graphics, cx: number, cy: number, r: number, z0: number, z1: number, color: number, outline = true) {
  const rx = r * 45.25;
  const ry = r * 22.63;
  const b = iso(cx, cy, z0);
  const t = iso(cx, cy, z1);
  g.ellipse(b.x, b.y, rx, ry).fill(shade(color, 0.8));
  g.rect(b.x - rx, t.y, rx * 2, b.y - t.y).fill(shade(color, 0.9));
  // světlý pruh pro dojem oblosti
  g.rect(b.x - rx * 0.55, t.y, rx * 0.35, b.y - t.y).fill({ color: 0xffffff, alpha: 0.25 });
  g.rect(b.x + rx * 0.5, t.y, rx * 0.5, b.y - t.y).fill({ color: 0x000000, alpha: 0.06 });
  if (outline) {
    g.moveTo(b.x - rx, t.y).lineTo(b.x - rx, b.y).stroke(OUTLINE);
    g.moveTo(b.x + rx, t.y).lineTo(b.x + rx, b.y).stroke(OUTLINE);
    g.moveTo(b.x - rx, b.y);
    for (let i = 1; i <= 16; i++) {
      const a = Math.PI - (Math.PI * i) / 16;
      g.lineTo(b.x + Math.cos(a) * rx, b.y + Math.sin(a) * ry);
    }
    g.stroke(OUTLINE);
  }
  g.ellipse(t.x, t.y, rx, ry).fill(color);
  if (outline) g.stroke(OUTLINE);
}
