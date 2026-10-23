import { Application, Container, FederatedPointerEvent, Graphics } from 'pixi.js';
import type { DeviceId } from '../../config/devices';
import { GRID } from '../../config/layout';
import { isAttacked, useGameStore } from '../../stores/gameStore';
import type { CharacterController } from '../character/CharacterController';
import type { SceneFlag } from '../scenarios/types';
import { BoilerView, DeviceView, HeatingView, Layers, LightsView } from './assets/devices';
import { CharacterView } from './CharacterView';
import { Particles } from './effects';
import { buildHouse, HouseRefs, SceneObject } from './house';
import { iso, pts } from './iso';
import { P } from './palette';

export interface SceneHost {
  char: CharacterController;
  sceneFlags: Set<SceneFlag>;
  onDeviceTap: (id: DeviceId) => void;
}

const BOUNDS = { x: -250, y: -180, w: 660, h: 515 };

export class SceneRenderer {
  app = new Application();
  private camera = new Container();
  private world = new Container();
  private bg = new Container();
  private glow = new Container();
  private objects = new Container();
  private overlay = new Container();
  private fx = new Container();
  private dome = new Graphics();
  private devices: Partial<Record<DeviceId, DeviceView>> = {};
  private charView = new CharacterView();
  private refs!: HouseRefs;
  private shower = new Particles();
  private showerSpawn = 0;
  private t = 0;
  private domeT = -1;
  private wasProtected = false;
  private occluders: { node: Container; b: { x: number; y: number; w: number; h: number } | null }[] = [];

  // kamera
  private insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private zoom = 1;
  private pan = { x: 0, y: 0 };
  private pointers = new Map<number, { x: number; y: number }>();
  private dragDist = 0;
  private pinchStart = 0;
  private zoomStart = 1;
  private destroyed = false;

  constructor(private host: SceneHost) {}

  async init(el: HTMLElement) {
    await this.app.init({
      resizeTo: el,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    el.appendChild(this.app.canvas);

    this.objects.sortableChildren = true;
    this.world.addChild(this.bg, this.glow, this.objects, this.overlay, this.dome, this.fx);
    this.camera.addChild(this.world);
    this.app.stage.addChild(this.camera);

    const add = (o: SceneObject) => {
      o.node.zIndex = o.depth * 100;
      this.objects.addChild(o.node);
      this.occluders.push({ node: o.node, b: null });
    };
    this.refs = buildHouse(this.bg, add);
    this.glow.blendMode = 'add';

    const layers: Layers = { glow: this.glow, overlay: this.overlay, fx: this.fx, add };
    const opts = { onTap: (id: DeviceId) => this.host.onDeviceTap(id), canTap: () => this.dragDist < 8 };
    this.devices.boiler = new BoilerView(layers, opts);
    this.devices.heating = new HeatingView(layers, opts);
    this.devices.lights = new LightsView(layers, opts);

    this.objects.addChild(this.charView.node);
    this.fx.addChild(this.charView.fx);
    this.shower.g.zIndex = 1.86 * 100;
    this.objects.addChild(this.shower.g);

    this.setupInput();
    this.layout();
    this.app.renderer.on('resize', () => this.layout());
    this.app.ticker.add((tk) => this.update(Math.min(tk.deltaMS, 50)));
  }

  setInsets(i: Partial<SceneRenderer['insets']>) {
    this.insets = { ...this.insets, ...i };
    this.layout();
  }

  resetView() {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.layout();
  }

  zoomBy(f: number) {
    this.zoom = Math.max(0.7, Math.min(2.6, this.zoom * f));
    this.layout();
  }

  playBlocked(id: DeviceId) {
    this.devices[id]?.playBlocked(this.t);
  }

  destroy() {
    this.destroyed = true;
    try {
      if (this.app.renderer) this.app.destroy(true, { children: true });
    } catch {
      /* ignore */
    }
  }

  private layout() {
    if (!this.app.renderer) return;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const { top, right, bottom, left } = this.insets;
    const aw = Math.max(100, sw - left - right);
    const ah = Math.max(100, sh - top - bottom);
    const base = Math.min(aw / BOUNDS.w, ah / BOUNDS.h, 1.9) * 0.96;
    const s = base * this.zoom;
    // omezení posunu
    const lim = (v: number, m: number) => Math.max(-m, Math.min(m, v));
    this.pan.x = lim(this.pan.x, (BOUNDS.w * s) / 2);
    this.pan.y = lim(this.pan.y, (BOUNDS.h * s) / 2);
    const cx = left + aw / 2 + this.pan.x;
    const cy = top + ah / 2 + this.pan.y;
    this.camera.scale.set(s);
    this.camera.position.set(cx - (BOUNDS.x + BOUNDS.w / 2) * s, cy - (BOUNDS.y + BOUNDS.h / 2) * s);
  }

  private setupInput() {
    const stage = this.app.stage;
    stage.eventMode = 'static';
    stage.hitArea = this.app.screen;
    stage.on('pointerdown', (e: FederatedPointerEvent) => {
      this.pointers.set(e.pointerId, { x: e.global.x, y: e.global.y });
      if (this.pointers.size === 1) this.dragDist = 0;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomStart = this.zoom;
        this.dragDist = 99;
      }
    });
    stage.on('globalpointermove', (e: FederatedPointerEvent) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const nx = e.global.x;
      const ny = e.global.y;
      if (this.pointers.size === 1) {
        const dx = nx - prev.x;
        const dy = ny - prev.y;
        this.dragDist += Math.abs(dx) + Math.abs(dy);
        if (this.dragDist > 8) {
          this.pan.x += dx;
          this.pan.y += dy;
          this.layout();
        }
      }
      this.pointers.set(e.pointerId, { x: nx, y: ny });
      if (this.pointers.size === 2 && this.pinchStart > 0) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoom = Math.max(0.7, Math.min(2.6, this.zoomStart * (d / this.pinchStart)));
        this.layout();
      }
    });
    const up = (e: FederatedPointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchStart = 0;
    };
    stage.on('pointerup', up);
    stage.on('pointerupoutside', up);
    this.app.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
      },
      { passive: false },
    );
    // zabránit posunu stránky při dotyku na scéně
    this.app.canvas.style.touchAction = 'none';
  }

  private update(dt: number) {
    this.t += dt;
    const s = useGameStore.getState();
    const t = this.t;

    for (const id of Object.keys(this.devices) as DeviceId[]) {
      const dv = this.devices[id]!;
      dv.selected = s.phase === 'play' && s.selectedDevice === id;
      dv.frame({ t, dt, smart: s.smart[id], status: s.devices[id].status, attack: s.devices[id].attack, attacked: isAttacked(id, s) });
    }

    // postava
    this.host.char.update(dt);
    this.charView.update(this.host.char.model, this.host.char.time, dt);

    // scénické efekty
    const flags = this.host.sceneFlags;
    const tv = this.refs.tvGlow;
    tv.visible = flags.has('tv');
    if (tv.visible) {
      tv.alpha = 0.75 + Math.sin(t / 90) * 0.15 + (Math.random() < 0.05 ? 0.3 : 0);
      tv.tint = [0xffffff, 0xffe0f0, 0xe0fff4, 0xfff4cc][Math.floor(t / 1600) % 4];
    }
    this.refs.windowOpen.visible = flags.has('windowOpen');
    this.refs.windowClosed.visible = !flags.has('windowOpen');
    this.refs.breeze.visible = flags.has('windowOpen');
    if (this.refs.breeze.visible) {
      this.refs.breeze.alpha = 0.4 + Math.sin(t / 300) * 0.4;
      this.refs.breeze.x = Math.sin(t / 500) * 6;
    }

    const hot = flags.has('showerHot');
    const cold = flags.has('showerCold');
    this.showerSpawn += dt;
    if ((hot || cold) && this.showerSpawn > 18) {
      this.showerSpawn = 0;
      const head = iso(0.45, 0.9, 124);
      const floorY = iso(0.9, 0.9, 6).y;
      for (let i = 0; i < 2; i++) {
        this.shower.spawn({
          kind: 'drop',
          x: head.x + (Math.random() - 0.5) * 16,
          y: head.y + 4,
          vx: (Math.random() - 0.5) * 30 + 10,
          vy: 120,
          max: 900,
          size: 1.5,
          color: cold ? 0x7fc4ff : 0xbfe8ff,
          floorY: floorY + Math.random() * 6,
        });
      }
      if (hot && Math.random() < 0.35) {
        const fl = iso(0.9 + Math.random() * 0.6, 0.9 + Math.random() * 0.6, 20 + Math.random() * 60);
        this.shower.spawn({ kind: 'puff', x: fl.x, y: fl.y, vx: (Math.random() - 0.5) * 12, vy: -18, max: 2200, size: 6 + Math.random() * 5, color: 0xffffff });
      }
      if (cold && Math.random() < 0.08) {
        const fl = iso(0.7 + Math.random() * 0.8, 0.7 + Math.random() * 0.8, 40 + Math.random() * 60);
        this.shower.spawn({ kind: 'snow', x: fl.x, y: fl.y, vy: 10, max: 1200, size: 1.8, color: 0xe6f6ff });
      }
    }
    this.shower.update(dt);

    this.fadeOccluders(dt);
    this.drawDome(s.protection.active, t);
  }

  /** Předměty, které stojí před postavičkou a překrývají ji, zprůhlední. */
  private fadeOccluders(dt: number) {
    const cv = this.charView.node;
    const cz = cv.zIndex;
    const cx = cv.x;
    const cy = cv.y;
    const k = Math.min(1, dt / 120);
    for (const o of this.occluders) {
      if (!o.b) {
        const lb = o.node.getLocalBounds();
        o.b = { x: lb.x, y: lb.y, w: lb.width, h: lb.height };
      }
      const b = o.b;
      const hit = o.node.zIndex > cz && cx + 12 > b.x && cx - 12 < b.x + b.w && cy - 12 > b.y && cy - 70 < b.y + b.h;
      const target = hit ? 0.42 : 1;
      o.node.alpha += (target - o.node.alpha) * k;
    }
  }

  private drawDome(active: boolean, t: number) {
    if (active && !this.wasProtected) this.domeT = t;
    this.wasProtected = active;
    const g = this.dome;
    g.clear();
    if (!active) return;
    const W = GRID.w;
    const D = GRID.d;
    const H = GRID.wallH + 30;
    const e = 0.22;
    const hex = pts([[-0.25 - e, D + e, -24], [-0.25 - e, D + e, H], [-0.25 - e, -0.25 - e, H], [W + e, -0.25 - e, H], [W + e, -0.25 - e, -24], [W + e, D + e, -24]]);
    const pulse = 0.5 + Math.sin(t / 700) * 0.5;
    g.poly(hex).fill({ color: P.protect, alpha: 0.03 + pulse * 0.02 });
    g.poly(hex).stroke({ width: 2.5, color: P.protect, alpha: 0.35 + pulse * 0.2, join: 'round' });
    // putující lesk po obrysu
    const k = (t / 2600) % 1;
    const n = hex.length / 2;
    const i = Math.floor(k * n);
    const j = (i + 1) % n;
    const f = k * n - i;
    const x = hex[i * 2] + (hex[j * 2] - hex[i * 2]) * f;
    const y = hex[i * 2 + 1] + (hex[j * 2 + 1] - hex[i * 2 + 1]) * f;
    g.circle(x, y, 5).fill({ color: 0xffffff, alpha: 0.9 });
    g.circle(x, y, 12).fill({ color: P.protect, alpha: 0.3 });
    // aktivační vlna
    if (this.domeT >= 0) {
      const kk = (t - this.domeT) / 1400;
      if (kk > 1) this.domeT = -1;
      else {
        const c = iso(W / 2, D / 2, 60);
        g.ellipse(c.x, c.y, 80 + kk * 420, 40 + kk * 210).stroke({ width: 6 * (1 - kk), color: P.protect, alpha: 1 - kk });
      }
    }
  }
}
