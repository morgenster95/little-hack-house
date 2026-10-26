import { Container, Graphics, Polygon } from 'pixi.js';
import type { DeviceId, DeviceStatus } from '../../../config/devices';
import type { CharacterModel } from '../../character/CharacterController';
import type { SceneFlag } from '../../scenarios/types';
import { iso, isoHull, pts, quadY } from '../iso';
import { P } from '../palette';
import { zpx } from '../space';
import type { DisplayState } from '../three/props';
import type { View3D } from '../three/View3D';

export interface Layers {
  glow: Container;
  fx: Container;
  /** neviditelné oblasti pro klepnutí na zařízení */
  hit: Container;
  view: View3D;
  /** postava – zařízení na ni můžou reagovat (vysavač ji honí, kamera ji sleduje) */
  char: CharacterModel;
  /** příznaky scény nastavované scénáři */
  flags: Set<SceneFlag>;
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

/**
 * Společný základ vizuálu chytrého zařízení: odznak stavu, zvýraznění,
 * animace zablokování a oblast pro klepnutí. Samotná zařízení jsou
 * v předrenderovaném podkladu, potomci řídí jen živé 3D prvky a efekty.
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
  protected badgeAnchor: { x: number; y: number };
  private hits: Container[] = [];

  constructor(
    public id: DeviceId,
    protected L: Layers,
    badgePos: [number, number, number],
    protected footprint: [number, number, number, number],
    hitAreas: number[][],
    protected opts: DeviceViewOptions,
  ) {
    this.badgeAnchor = iso(...badgePos);
    this.badge.addChild(this.badgeG);
    this.badge.position.set(this.badgeAnchor.x, this.badgeAnchor.y);
    L.fx.addChild(this.badge);
    L.fx.addChild(this.shieldFx);
    L.glow.addChild(this.ring);
    for (const pts of hitAreas) {
      const node = new Container();
      node.hitArea = new Polygon(pts);
      node.eventMode = 'static';
      node.on('pointerover', () => (this.hover = true));
      node.on('pointerout', () => (this.hover = false));
      node.on('pointertap', () => {
        if (this.opts.canTap()) this.opts.onTap(this.id);
      });
      L.hit.addChild(node);
      this.hits.push(node);
    }
  }

  /** Pro pohyblivá zařízení: nové oblasti pro klepnutí (izometrické px). */
  protected setHitAreas(areas: number[][]) {
    this.hits.forEach((n, i) => {
      if (areas[i]) n.hitArea = new Polygon(areas[i]);
    });
  }

  protected onSmartChange(smart: boolean) {
    this.hits.forEach((n) => (n.cursor = smart ? 'pointer' : 'default'));
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

/** displej bojleru – na plášti válce natočený k divákovi (mřížka) */
const BOILER = { x: 2.55 + 0.25, y: 0.42 + 0.25, z: 1.72 };

export class BoilerView extends DeviceView {
  private glitch = new Graphics();

  constructor(L: Layers, opts: DeviceViewOptions) {
    super('boiler', L, [2.55, 0.42, zpx(2.75)], [2.1, 0.0, 3.0, 0.9], [isoHull(2.17, 0.05, zpx(1.05), 2.93, 0.8, zpx(2.45))], opts);
    L.fx.addChild(this.glitch);
  }

  protected draw(f: DeviceFrame) {
    const props = this.L.view.props;
    props.boilerSmart.visible = this.smart;
    props.boilerPlain.visible = !this.smart;
    const gl = this.glitch;
    gl.clear();
    if (!this.smart) return;

    const d: DisplayState = { text: '55°', color: 0x8ff5d9, bg: 0x1d2530, led: P.smart };
    const blink = Math.floor(f.t / 400) % 2 === 0;
    if (f.attacked) {
      if (f.attack === 'fault') {
        d.text = 'E-13';
        d.color = blink ? 0xff7b8f : 0x7a3141;
      } else if (f.attack === 'cold') {
        d.text = '10°';
        d.color = 0x9fd3ff;
      } else {
        d.text = 'OFF';
        d.color = 0x9fd3ff;
      }
      d.led = P.hack;
    } else if (f.status === 'recovering') {
      d.text = '…';
      d.color = 0xffd27a;
      d.bg = 0x3a3424;
      d.led = P.warn;
    } else if (f.status === 'protected') {
      d.color = 0x9ff5bf;
      d.led = P.protect;
    }
    props.setBoilerDisplay(d);

    // jemný efekt napadení
    if (f.attacked) {
      const p = iso(BOILER.x, BOILER.y, zpx(BOILER.z));
      for (let i = 0; i < 5; i++) {
        if (Math.random() < 0.45) {
          const gx = p.x + (Math.random() - 0.5) * 40;
          const gy = p.y - 40 + Math.random() * 70;
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
  private waves = new Graphics();
  private frost = new Graphics();

  constructor(L: Layers, opts: DeviceViewOptions) {
    super(
      'heating',
      L,
      [5.15, 0.1, zpx(1.85)],
      [4.9, 0.0, 6.6, 0.9],
      [
        isoHull(5.0, 0.0, zpx(0.15), 6.5, 0.25, zpx(0.8)),
        isoHull(0.0, 5.15, zpx(0.4), 0.25, 6.0, zpx(1.9)),
        isoHull(5.53, 0.0, zpx(1.28), 5.91, 0.06, zpx(1.52)),
      ],
      opts,
    );
    L.glow.addChild(this.waves);
    L.fx.addChild(this.frost);
  }

  protected draw(f: DeviceFrame) {
    const mode = f.attacked ? (f.attack === 'overheat' ? 'max' : 'off') : 'normal';
    const props = this.L.view.props;
    props.thermoSmart.visible = this.smart;
    props.thermoPlain.visible = !this.smart;
    if (this.smart) {
      props.setThermostatDisplay({
        text: mode === 'off' ? '12°' : mode === 'max' ? '30°' : f.status === 'recovering' ? '…' : '22°',
        color: mode === 'off' ? 0x9fd3ff : mode === 'max' ? 0xff8b6b : 0x8ff5d9,
        bg: 0x1d2530,
        led: f.attacked ? P.hack : f.status === 'protected' ? P.protect : P.smart,
      });
    }

    // vlny tepla / námraza
    const w = this.waves;
    w.clear();
    const fr = this.frost;
    fr.clear();
    if (mode === 'off') {
      quadY(fr, 0.22, 5.02, 6.38, zpx(0.2), zpx(0.76), 0xbfe3ff, 0.35);
      for (let i = 0; i < 4; i++) {
        const p = iso(5.2 + i * 0.33, 0.23, zpx(0.3) + ((i * 13 + f.t / 60) % 24));
        fr.circle(p.x, p.y, 1.4).fill({ color: 0xffffff, alpha: 0.9 });
      }
      return;
    }
    const strong = mode === 'max';
    const col = strong ? 0xff7a4d : 0xffb38a;
    const sources: [number, number, number][] = [
      [5.15, 0.35, zpx(0.82)],
      [5.7, 0.35, zpx(0.82)],
      [6.25, 0.35, zpx(0.82)],
      [0.25, 5.4, zpx(1.9)],
      [0.25, 5.8, zpx(1.9)],
    ];
    for (const [x, y, z] of sources) {
      const k = (f.t / (strong ? 900 : 1600) + x * 0.37 + y * 0.21) % 1;
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
/* Osvětlení: stojací lampa, stolní lampa, zrcadlo + tma/párty závoj    */
/* ------------------------------------------------------------------ */

/** světla v domě (mřížka) – pro světelné skvrny v režimu párty */
const LAMPS = [
  { x: 6.75, y: 0.45 },
  { x: 11.45, y: 1.75 },
  { x: 3.6, y: 0.4 },
];

export class LightsView extends DeviceView {
  private glows = new Graphics();
  private flickerOn = true;
  private nextFlicker = 0;
  darkness = 0;

  constructor(L: Layers, opts: DeviceViewOptions) {
    super(
      'lights',
      L,
      [6.75, 0.45, zpx(2.05)],
      [6.35, 0.05, 7.15, 0.85],
      [
        isoHull(6.5, 0.2, 0, 7.0, 0.7, zpx(1.65)),
        isoHull(11.2, 1.5, 0, 11.7, 2.0, zpx(0.92)),
        isoHull(3.18, 0.0, zpx(1.2), 4.02, 0.06, zpx(2.0)),
      ],
      opts,
    );
    L.glow.addChild(this.glows);
  }

  protected draw(f: DeviceFrame) {
    this.L.view.props.lampSmart.visible = this.smart;
    const mode = f.attacked ? (f.attack as 'off' | 'flicker' | 'party') : 'normal';
    let on = true;
    let lightCol = 0xffd28a;
    let overlayAlpha = 0;
    let overlayCol = 0x1a1540;

    if (mode === 'off') {
      on = false;
      overlayAlpha = 0.6;
    } else if (mode === 'flicker') {
      if (f.t > this.nextFlicker) {
        this.flickerOn = !this.flickerOn;
        this.nextFlicker = f.t + (this.flickerOn ? 40 + Math.random() * 160 : 50 + Math.random() * 220);
      }
      on = this.flickerOn;
      overlayAlpha = on ? 0 : 0.52;
    } else if (mode === 'party') {
      const hues = [0xff5d9e, 0x5db8ff, 0x8cff6b, 0xffd23f, 0xb86bff];
      const i = Math.floor(f.t / 450) % hues.length;
      lightCol = hues[i];
      overlayCol = hues[(i + 2) % hues.length];
      overlayAlpha = 0.16;
    }
    this.darkness = mode === 'off' ? 1 : mode === 'flicker' && !on ? 0.85 : 0;
    this.L.view.setOverlay(overlayCol, overlayAlpha);

    // barevné skvrny světla na podlaze (párty)
    const gl = this.glows;
    gl.clear();
    if (mode === 'party') {
      for (const l of LAMPS) {
        const c = iso(l.x, l.y + 0.3, 0);
        const k = (f.t / 600 + l.x) % (Math.PI * 2);
        gl.ellipse(c.x + Math.cos(k) * 50, c.y + Math.sin(k) * 20, 40, 18).fill({ color: lightCol, alpha: 0.22 });
      }
    }
  }
}

/** Obrys celého domu v izometrických px (pro štít ochrany). */
export function houseOutline(e: number, zTop: number) {
  return pts([
    [-0.3 - e, 7.3 + e, -24],
    [-0.3 - e, 7.3 + e, zTop],
    [-0.3 - e, -0.3 - e, zTop],
    [12.3 + e, -0.3 - e, zTop],
    [12.3 + e, -0.3 - e, -24],
    [12.3 + e, 7.3 + e, -24],
  ]);
}
