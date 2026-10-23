import { Container, Graphics, Text } from 'pixi.js';
import type { DeviceId, DeviceStatus } from '../../../config/devices';
import { GRID } from '../../../config/layout';
import type { SceneObject } from '../house';
import { box, cylinder, iso, OUTLINE, pts, quadX, quadY, shade } from '../iso';
import { P } from '../palette';

export interface Layers {
  glow: Container;
  overlay: Container;
  fx: Container;
  add: (o: SceneObject) => void;
}

export interface DeviceFrame {
  t: number;
  dt: number;
  smart: boolean;
  status: DeviceStatus;
  attack: string | null;
  attacked: boolean;
}

export interface DeviceViewOptions {
  onTap: (id: DeviceId) => void;
  canTap: () => boolean;
}

function label(text: string, size = 9, color = 0xffffff) {
  const t = new Text({ text, style: { fontFamily: 'Fredoka, Nunito, sans-serif', fontSize: size, fontWeight: '700', fill: color } });
  t.resolution = 4;
  t.anchor.set(0.5);
  return t;
}

/**
 * Společný základ vizuálu chytrého zařízení: odznak stavu, zvýraznění,
 * animace zablokování. Konkrétní grafika je v potomcích – lze ji vyměnit
 * za sprity bez zásahu do herní logiky.
 */
export abstract class DeviceView {
  hover = false;
  selected = false;
  smart = false;
  status: DeviceStatus = 'normal';
  badge = new Container();
  private badgeG = new Graphics();
  private ring = new Graphics();
  private shieldFx = new Graphics();
  private blockT = -1;
  private popT = -1;
  private badgeAnchor: { x: number; y: number };

  constructor(
    public id: DeviceId,
    protected L: Layers,
    badgePos: [number, number, number],
    private footprint: [number, number, number, number],
    protected opts: DeviceViewOptions,
  ) {
    this.badgeAnchor = iso(...badgePos);
    this.badge.addChild(this.badgeG);
    this.badge.position.set(this.badgeAnchor.x, this.badgeAnchor.y);
    L.fx.addChild(this.badge);
    L.fx.addChild(this.shieldFx);
    L.glow.addChild(this.ring);
  }

  protected interactive(node: Container) {
    node.eventMode = 'static';
    node.on('pointerover', () => (this.hover = true));
    node.on('pointerout', () => (this.hover = false));
    node.on('pointertap', () => {
      if (this.opts.canTap()) this.opts.onTap(this.id);
    });
  }

  protected setCursor(nodes: Container[], on: boolean) {
    nodes.forEach((n) => (n.cursor = on ? 'pointer' : 'default'));
  }

  playBlocked(t: number) {
    this.blockT = t;
  }

  frame(f: DeviceFrame) {
    if (f.smart !== this.smart) {
      this.smart = f.smart;
      this.popT = f.t;
      this.onSmartChange(f.smart);
    }
    this.status = f.status;
    this.drawBadge(f);
    this.drawRing(f);
    this.drawShield(f);
    this.draw(f);
  }

  protected abstract onSmartChange(smart: boolean): void;
  protected abstract draw(f: DeviceFrame): void;

  private drawBadge(f: DeviceFrame) {
    const g = this.badgeG;
    g.clear();
    this.badge.visible = this.smart;
    if (!this.smart) return;
    const pop = this.popT >= 0 ? Math.min(1, (f.t - this.popT) / 350) : 1;
    const popScale = pop < 1 ? 0.3 + Math.sin(pop * Math.PI * 0.75) * 1.0 : 1;
    const emph = this.selected ? 1.3 : this.hover ? 1.18 : 1;
    this.badge.scale.set(popScale * emph);
    let bob = Math.sin(f.t / 500 + this.badgeAnchor.x) * 2;
    let jx = 0;
    const st = f.status;
    let fill = 0xffffff;
    if (f.attacked) {
      fill = P.hack;
      jx = Math.random() < 0.3 ? (Math.random() - 0.5) * 3 : 0;
      bob = 0;
    } else if (st === 'protected') fill = P.protect;
    else if (st === 'recovering') fill = P.warn;
    this.badge.position.set(this.badgeAnchor.x + jx, this.badgeAnchor.y + bob);

    g.circle(0, 2, 11).fill({ color: 0x000000, alpha: 0.12 });
    g.circle(0, 0, 11).fill(fill).stroke({ width: 2, color: 0xffffff });
    const ink = fill === 0xffffff ? P.smart : 0xffffff;
    if (f.attacked) {
      // „glitch" oči – znak napadení
      g.roundRect(-6, -4, 4, 4, 1).fill(ink);
      g.roundRect(2, -4, 4, 4, 1).fill(ink);
      g.moveTo(-5, 4).lineTo(-2.5, 2).lineTo(0, 4).lineTo(2.5, 2).lineTo(5, 4).stroke({ width: 1.8, color: ink, cap: 'round' });
    } else if (st === 'protected') {
      g.moveTo(0, -6).lineTo(5.5, -3.5).lineTo(4.5, 2.5).lineTo(0, 6).lineTo(-4.5, 2.5).lineTo(-5.5, -3.5).closePath().fill(ink);
      g.moveTo(-2.4, 0).lineTo(-0.6, 2).lineTo(2.8, -2.2).stroke({ width: 1.6, color: P.protect, cap: 'round' });
    } else if (st === 'recovering') {
      const a = f.t / 150;
      g.arc(0, 0, 5.5, a, a + 4.2).stroke({ width: 2.2, color: ink, cap: 'round' });
    } else {
      // wifi
      g.circle(0, 4, 1.8).fill(ink);
      g.arc(0, 4, 5, -Math.PI * 0.78, -Math.PI * 0.22).stroke({ width: 1.8, color: ink, cap: 'round' });
      g.arc(0, 4, 8.5, -Math.PI * 0.75, -Math.PI * 0.25).stroke({ width: 1.8, color: ink, cap: 'round' });
    }
  }

  private drawRing(f: DeviceFrame) {
    const g = this.ring;
    g.clear();
    if (!this.smart || !(this.hover || this.selected)) return;
    const [x0, y0, x1, y1] = this.footprint;
    const pulse = 0.5 + Math.sin(f.t / 220) * 0.25;
    const col = f.attacked ? P.hack : P.smart;
    g.poly(pts([[x0, y0, 1], [x1, y0, 1], [x1, y1, 1], [x0, y1, 1]])).fill({ color: col, alpha: this.selected ? 0.22 * pulse + 0.1 : 0.12 });
    g.stroke({ width: 2, color: col, alpha: this.selected ? 0.9 : 0.5 });
  }

  private drawShield(f: DeviceFrame) {
    const g = this.shieldFx;
    g.clear();
    if (this.blockT < 0) return;
    const k = (f.t - this.blockT) / 1300;
    if (k > 1) {
      this.blockT = -1;
      return;
    }
    const { x, y } = this.badgeAnchor;
    const r = 20 + k * 30;
    const a = 1 - k;
    g.circle(x, y + 30, r).fill({ color: P.protect, alpha: 0.18 * a }).stroke({ width: 3, color: P.protect, alpha: a });
    // štít
    const s = 1 + Math.sin(Math.min(1, k * 3) * Math.PI) * 0.3;
    const sy = y - 26 - k * 10;
    g.moveTo(x, sy - 14 * s)
      .lineTo(x + 12 * s, sy - 8 * s)
      .lineTo(x + 10 * s, sy + 6 * s)
      .lineTo(x, sy + 14 * s)
      .lineTo(x - 10 * s, sy + 6 * s)
      .lineTo(x - 12 * s, sy - 8 * s)
      .closePath()
      .fill({ color: P.protect, alpha: a })
      .stroke({ width: 2.5, color: 0xffffff, alpha: a });
    g.moveTo(x - 5 * s, sy).lineTo(x - 1 * s, sy + 4 * s).lineTo(x + 6 * s, sy - 5 * s).stroke({ width: 2.5, color: 0xffffff, alpha: a, cap: 'round' });
  }
}

/* ------------------------------------------------------------------ */
/* Bojler                                                               */
/* ------------------------------------------------------------------ */

export class BoilerView extends DeviceView {
  private body = new Graphics();
  private panel = new Graphics();
  private glitch = new Graphics();
  private display = label('55°', 8);
  private node = new Container();
  private cx = 2.55;
  private cy = 0.42;

  constructor(L: Layers, opts: DeviceViewOptions) {
    super('boiler', L, [2.55, 0.42, 168], [2.1, 0.0, 3.0, 0.9], opts);
    const g = this.body;
    // trubky
    const a = iso(2.42, 0.25, 66);
    const b = iso(2.42, 0.25, 30);
    const c2 = iso(2.68, 0.25, 66);
    const d = iso(2.68, 0.25, 36);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 3, color: P.metal });
    g.moveTo(c2.x, c2.y).lineTo(d.x, d.y).stroke({ width: 3, color: 0xe58f6f });
    cylinder(g, this.cx, this.cy, 0.36, 66, 146, P.white);
    const top = iso(this.cx, this.cy, 146);
    g.ellipse(top.x, top.y - 2, 12, 5).fill(shade(P.white, 0.95));
    // nožky/úchyty
    quadY(g, 0.01, 2.3, 2.8, 120, 124, P.metal);
    this.node.addChild(this.body, this.panel, this.display, this.glitch);
    const p = iso(this.cx, this.cy, 112);
    this.display.position.set(p.x, p.y + 9);
    this.interactive(this.node);
    L.add({ node: this.node, depth: 3.2 });
  }

  protected onSmartChange(smart: boolean) {
    this.setCursor([this.node], smart);
  }

  protected draw(f: DeviceFrame) {
    const g = this.panel;
    g.clear();
    const p = iso(this.cx, this.cy, 112);
    const px = p.x;
    const py = p.y + 9;
    if (!this.smart) {
      // běžný bojler – analogový budík
      this.display.visible = false;
      g.circle(px, py, 6.5).fill(0xffffff).stroke(OUTLINE);
      g.moveTo(px, py).lineTo(px + 3.5, py - 3.5).stroke({ width: 1.5, color: P.danger });
      this.glitch.clear();
      return;
    }
    this.display.visible = true;
    let bg = 0x2f3a4a;
    let txt = '55°';
    let col = 0x8ff5d9;
    const blink = Math.floor(f.t / 400) % 2 === 0;
    if (f.attacked) {
      if (f.attack === 'fault') {
        txt = 'E-13';
        col = blink ? 0xff7b8f : 0x7a3141;
      } else if (f.attack === 'cold') {
        txt = '10°';
        col = 0x9fd3ff;
      } else {
        txt = 'OFF';
        col = 0x9fd3ff;
      }
    } else if (f.status === 'recovering') {
      txt = '…';
      col = 0xffd27a;
    } else if (f.status === 'protected') {
      col = 0x9ff5bf;
    }
    if (f.status === 'recovering') bg = 0x3a3424;
    g.roundRect(px - 11, py - 6.5, 22, 13, 3).fill(bg).stroke({ width: 1.5, color: 0xd9d3cb });
    // LED
    const led = f.attacked ? P.hack : f.status === 'protected' ? P.protect : P.smart;
    g.circle(px + 13.5, py - 4, 1.8).fill(led);
    if (this.display.text !== txt) this.display.text = txt;
    this.display.style.fill = col;

    // jemný efekt napadení
    const gl = this.glitch;
    gl.clear();
    if (f.attacked) {
      for (let i = 0; i < 5; i++) {
        if (Math.random() < 0.45) {
          const gx = px + (Math.random() - 0.5) * 34;
          const gy = py - 30 + Math.random() * 60;
          gl.rect(gx, gy, 2 + Math.random() * 5, 2).fill({ color: Math.random() < 0.5 ? P.hack : 0x5cf2ff, alpha: 0.8 });
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Topení: radiátor v obýváku + žebřík v koupelně + termostat           */
/* ------------------------------------------------------------------ */

export class HeatingView extends DeviceView {
  private radiator = new Container();
  private towel = new Container();
  private radG = new Graphics();
  private towelG = new Graphics();
  private waves = new Graphics();
  private thermo = new Graphics();
  private thermoText = label('22°', 7.5);
  private frost = new Graphics();

  constructor(L: Layers, opts: DeviceViewOptions) {
    super('heating', L, [5.15, 0.1, 108], [4.9, 0.0, 6.6, 0.9], opts);
    const g = this.radG;
    // radiátor
    box(g, 5.0, 0, 14, 1.4, 0.22, 46, { top: P.white });
    for (let x = 5.1; x < 6.38; x += 0.14) {
      const a = iso(x, 0.22, 17);
      const b = iso(x, 0.22, 57);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y);
    }
    g.stroke({ width: 1, color: 0xcfc8c0 });
    box(g, 6.38, 0.05, 14, 0.1, 0.1, 10, { top: 0xd9d3cb });
    box(g, 5.05, 0.05, 6, 0.08, 0.08, 8, { top: 0xd9d3cb }, false);
    box(g, 6.27, 0.05, 6, 0.08, 0.08, 8, { top: 0xd9d3cb }, false);
    this.radiator.addChild(g, this.frost);
    this.interactive(this.radiator);
    L.add({ node: this.radiator, depth: 5.8 });

    // termostat na stěně
    const tc = new Container();
    tc.addChild(this.thermo, this.thermoText);
    const tp = iso(5.72, 0, 83);
    this.thermoText.position.set(tp.x, tp.y);
    this.radiator.addChild(tc);

    // žebříkový radiátor v koupelně
    const t = this.towelG;
    box(t, 0, 5.2, 26, 0.12, 0.08, 84, { top: P.white });
    box(t, 0, 5.95, 26, 0.12, 0.08, 84, { top: P.white });
    for (let z = 36; z < 110; z += 15) box(t, 0, 5.24, z, 0.1, 0.75, 4, { top: P.white });
    quadX(t, 0.13, 5.36, 5.82, 56, 99, 0xf3a6a0, 1, true);
    quadX(t, 0.13, 5.36, 5.82, 60, 63, 0xffffff, 0.6);
    this.towel.addChild(t);
    this.interactive(this.towel);
    L.add({ node: this.towel, depth: 5.6 });

    L.glow.addChild(this.waves);
  }

  protected onSmartChange(smart: boolean) {
    this.setCursor([this.radiator, this.towel], smart);
  }

  protected draw(f: DeviceFrame) {
    const mode = f.attacked ? (f.attack === 'overheat' ? 'max' : 'off') : 'normal';
    // termostat
    const th = this.thermo;
    th.clear();
    if (this.smart) {
      quadY(th, 0.01, 5.52, 5.92, 72, 94, P.white, 1, true);
      const tp = iso(5.72, 0, 83);
      th.roundRect(tp.x - 7, tp.y - 5, 14, 10, 2).fill(0x2f3a4a);
      this.thermoText.visible = true;
      const txt = mode === 'off' ? '12°' : mode === 'max' ? '30°' : f.status === 'recovering' ? '…' : '22°';
      if (this.thermoText.text !== txt) this.thermoText.text = txt;
      this.thermoText.style.fill = mode === 'off' ? 0x9fd3ff : mode === 'max' ? 0xff8b6b : 0x8ff5d9;
    } else {
      this.thermoText.visible = false;
      const tp = iso(6.45, 0.12, 30);
      th.circle(tp.x, tp.y, 3.5).fill(0xffffff).stroke(OUTLINE);
    }

    // vlny tepla
    const w = this.waves;
    w.clear();
    const fr = this.frost;
    fr.clear();
    if (mode === 'off') {
      quadY(fr, 0.225, 5.02, 6.38, 16, 58, 0xbfe3ff, 0.35);
      for (let i = 0; i < 4; i++) {
        const p = iso(5.2 + i * 0.33, 0.23, 30 + ((i * 13 + f.t / 60) % 24));
        fr.circle(p.x, p.y, 1.4).fill({ color: 0xffffff, alpha: 0.9 });
      }
      return;
    }
    const strong = mode === 'max';
    const col = strong ? 0xff7a4d : 0xffb38a;
    const sources: [number, number, number][] = [
      [5.15, 0.35, 62],
      [5.7, 0.35, 62],
      [6.25, 0.35, 62],
      [0.25, 5.4, 110],
      [0.25, 5.8, 110],
    ];
    for (const [x, y, z] of sources) {
      const k = ((f.t / (strong ? 900 : 1600)) + x * 0.37 + y * 0.21) % 1;
      const base = iso(x, y, z + k * (strong ? 46 : 30));
      const a = Math.sin(k * Math.PI) * (strong ? 0.75 : 0.35);
      w.moveTo(base.x, base.y + 8);
      w.bezierCurveTo(base.x - 4, base.y + 4, base.x + 4, base.y, base.x, base.y - 6);
      w.stroke({ width: strong ? 2.4 : 1.8, color: col, alpha: a, cap: 'round' });
    }
    if (strong) {
      const p = iso(5.7, 0.4, 20);
      w.ellipse(p.x, p.y, 60, 22).fill({ color: 0xff8a5c, alpha: 0.12 + Math.sin(f.t / 300) * 0.04 });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Osvětlení: stojací lampa + 2 lustry + tma/párty overlay              */
/* ------------------------------------------------------------------ */

interface Lamp {
  node: Container;
  g: Graphics;
  bulb: { x: number; y: number };
  floor: { x: number; y: number };
  kind: 'floor' | 'pendant';
}

export class LightsView extends DeviceView {
  private lamps: Lamp[] = [];
  private glows = new Graphics();
  private dark = new Graphics();
  private flickerOn = true;
  private nextFlicker = 0;
  darkness = 0;

  constructor(L: Layers, opts: DeviceViewOptions) {
    super('lights', L, [9.3, 2.4, 162], [7.9, 2.0, 9.1, 3.2], opts);
    this.addFloorLamp(6.75, 0.45);
    this.addPendant(8.5, 2.6, 118, P.smart);
    this.addPendant(2.4, 2.7, 124, 0xf2a6a0);
    L.glow.addChild(this.glows);
    L.overlay.addChild(this.dark);
  }

  private addFloorLamp(x: number, y: number) {
    const node = new Container();
    const g = new Graphics();
    const b = iso(x, y, 0);
    g.ellipse(b.x, b.y, 9, 4.5).fill(0x5b5160).stroke(OUTLINE);
    const top = iso(x, y, 88);
    g.moveTo(b.x, b.y).lineTo(top.x, top.y).stroke({ width: 2.5, color: 0x5b5160 });
    const lg = new Graphics();
    node.addChild(g, lg);
    this.interactive(node);
    this.L.add({ node, depth: x + y + 0.1 });
    this.lamps.push({ node, g: lg, bulb: iso(x, y, 96), floor: iso(x, y + 0.3, 0), kind: 'floor' });
  }

  private addPendant(x: number, y: number, z: number, accent: number) {
    const node = new Container();
    const g = new Graphics();
    const top = iso(x, y, GRID.wallH + 40);
    const end = iso(x, y, z + 14);
    g.moveTo(top.x, top.y).lineTo(end.x, end.y).stroke({ width: 1.5, color: 0x5b4335, alpha: 0.7 });
    const lg = new Graphics();
    node.addChild(g, lg);
    (node as Container & { accent?: number }).accent = accent;
    this.interactive(node);
    this.L.add({ node, depth: x + y + 0.5 });
    this.lamps.push({ node, g: lg, bulb: iso(x, y, z), floor: iso(x, y, 0), kind: 'pendant' });
  }

  protected onSmartChange(smart: boolean) {
    this.setCursor(this.lamps.map((l) => l.node), smart);
  }

  protected draw(f: DeviceFrame) {
    const mode = f.attacked ? (f.attack as 'off' | 'flicker' | 'party') : 'normal';
    let on = true;
    let lightCol = 0xffd28a;
    let overlayAlpha = 0;
    let overlayCol = 0x1a1540;

    if (mode === 'off') {
      on = false;
      overlayAlpha = 0.58;
    } else if (mode === 'flicker') {
      if (f.t > this.nextFlicker) {
        this.flickerOn = !this.flickerOn;
        this.nextFlicker = f.t + (this.flickerOn ? 40 + Math.random() * 160 : 50 + Math.random() * 220);
      }
      on = this.flickerOn;
      overlayAlpha = on ? 0 : 0.5;
    } else if (mode === 'party') {
      const hues = [0xff5d9e, 0x5db8ff, 0x8cff6b, 0xffd23f, 0xb86bff];
      const i = Math.floor(f.t / 450) % hues.length;
      lightCol = hues[i];
      overlayCol = hues[(i + 2) % hues.length];
      overlayAlpha = 0.16;
    }
    this.darkness = mode === 'off' ? 1 : mode === 'flicker' && !on ? 0.85 : 0;

    // lampy
    for (const l of this.lamps) {
      const g = l.g;
      g.clear();
      const { x, y } = l.bulb;
      const accent = (l.node as Container & { accent?: number }).accent ?? P.cushion;
      if (l.kind === 'floor') {
        if (on) g.circle(x, y + 2, 12).fill({ color: lightCol, alpha: 0.5 });
        g.poly([x - 8, y - 12, x + 8, y - 12, x + 13, y + 6, x - 13, y + 6]).fill(0xfdf0d5).stroke(OUTLINE);
        if (this.smart) g.rect(x - 12, y + 2, 24, 3).fill(P.smart);
        if (on) g.ellipse(x, y + 6, 10, 3).fill({ color: lightCol, alpha: 0.9 });
      } else {
        g.poly([x - 5, y - 14, x + 5, y - 14, x + 15, y, x - 15, y]).fill(accent).stroke(OUTLINE);
        if (this.smart) g.rect(x - 13, y - 3, 26, 2.5).fill(0xffffff);
        g.circle(x, y + 2, 4.5).fill(on ? 0xfff4d6 : 0x9a96a6);
        if (on) g.circle(x, y + 3, 10).fill({ color: lightCol, alpha: 0.35 });
      }
    }

    // záře na podlaze
    const gl = this.glows;
    gl.clear();
    if (on) {
      for (const l of this.lamps) {
        const a = l.kind === 'floor' ? 0.16 : 0.1;
        gl.ellipse(l.floor.x, l.floor.y, 70, 32).fill({ color: lightCol, alpha: a * 0.5 });
        gl.ellipse(l.floor.x, l.floor.y, 40, 18).fill({ color: lightCol, alpha: a });
      }
      const fl = this.lamps[0].bulb;
      gl.ellipse(fl.x, fl.y - 6, 34, 40).fill({ color: lightCol, alpha: 0.12 });
    }

    // tma / barevný nádech přes celý dům
    const d = this.dark;
    d.clear();
    if (overlayAlpha > 0) {
      const W = GRID.w;
      const D = GRID.d;
      const H = GRID.wallH;
      d.poly(pts([[-0.25, D, -18], [-0.25, D, H], [-0.25, -0.25, H], [W, -0.25, H], [W, -0.25, -18], [W, D, -18]])).fill({
        color: overlayCol,
        alpha: overlayAlpha,
      });
      if (mode === 'party') {
        for (const l of this.lamps) {
          const k = (f.t / 600 + l.bulb.x) % (Math.PI * 2);
          d.circle(l.floor.x + Math.cos(k) * 50, l.floor.y + Math.sin(k) * 20, 14).fill({ color: lightCol, alpha: 0.25 });
        }
      }
    }
  }
}

