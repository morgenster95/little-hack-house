import { Application, Container, FederatedPointerEvent, Graphics } from 'pixi.js';
import type { DeviceId } from '../../config/devices';
import { GRID } from '../../config/layout';
import { isAttacked, useGameStore } from '../../stores/gameStore';
import type { CharacterController } from '../character/CharacterController';
import type { SceneFlag } from '../scenarios/types';
import { CameraView } from './assets/camera';
import { BoilerView, DeviceView, HeatingView, houseOutline, Layers, LightsView } from './assets/devices';
import { LockView } from './assets/lock';
import { SpeakerView, TvView } from './assets/media';
import { VacuumView } from './assets/vacuum';
import { WasherView } from './assets/washer';
import { CharacterView } from './CharacterView';
import { Particles } from './effects';
import { iso, pts } from './iso';
import { P } from './palette';
import { zpx } from './space';
import { View3D } from './three/View3D';

/** Výřez jen na dům (izometrické px) – pro úzké obrazovky na výšku. */
const HOUSE_BOUNDS = { x: -245, y: -175, w: 650, h: 495 };

export interface SceneHost {
  char: CharacterController;
  sceneFlags: Set<SceneFlag>;
  onDeviceTap: (id: DeviceId) => void;
}

/**
 * Scéna má tři vrstvy nad sebou:
 *  1. View3D (three.js) – dům předrenderovaný v Blenderu s hloubkou, displeje zařízení, 3D postavička,
 *  2. překryvná Pixi vrstva – efekty, odznaky, bubliny, štít a ovládání (posun, zoom, klepnutí).
 * 3D kamera kopíruje transformaci Pixi kamery, takže obě vrstvy sdílejí izometrické souřadnice.
 */
export class SceneRenderer {
  app = new Application();
  private view3d!: View3D;
  private camera = new Container();
  private world = new Container();
  private glow = new Container();
  private effects = new Container();
  private hit = new Container();
  private fx = new Container();
  private dome = new Graphics();
  private tvGlow = new Graphics();
  private breeze = new Graphics();
  private devices: Partial<Record<DeviceId, DeviceView>> = {};
  private charView = new CharacterView();
  private shower = new Particles();
  private showerSpawn = 0;
  private t = 0;
  private domeT = -1;
  private wasProtected = false;
  private bounds = { x: -250, y: -180, w: 660, h: 515 };

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
    this.view3d = new View3D(el);
    await Promise.all([
      this.app.init({
        resizeTo: el,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      }),
      this.view3d.load(`${import.meta.env.BASE_URL}assets/scene/`, `${import.meta.env.BASE_URL}assets/character/avatar.glb`),
    ]);
    if (this.destroyed) {
      this.disposeAll();
      return;
    }
    const canvas = this.app.canvas;
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    el.appendChild(canvas);

    // výřez kamery: celý pozemek, okraje zahrady se mohou mírně oříznout
    const b = this.view3d.isoBounds();
    this.bounds = { x: b.x + b.w * 0.05, y: b.y + b.h * 0.04, w: b.w * 0.9, h: b.h * 0.92 };

    this.glow.blendMode = 'add';
    this.world.addChild(this.glow, this.effects, this.hit, this.dome, this.fx);
    this.camera.addChild(this.world);
    this.app.stage.addChild(this.camera);

    this.buildSceneFx();
    const layers: Layers = { glow: this.glow, fx: this.fx, hit: this.hit, view: this.view3d, char: this.host.char.model, flags: this.host.sceneFlags };
    const opts = { onTap: (id: DeviceId) => this.host.onDeviceTap(id), canTap: () => this.dragDist < 8 };
    this.devices.boiler = new BoilerView(layers, opts);
    this.devices.heating = new HeatingView(layers, opts);
    this.devices.lights = new LightsView(layers, opts);
    this.devices.vacuum = new VacuumView(layers, opts);
    this.devices.tv = new TvView(layers, opts);
    this.devices.speaker = new SpeakerView(layers, opts);
    this.devices.camera = new CameraView(layers, opts);
    this.devices.washer = new WasherView(layers, opts);
    this.devices.lock = new LockView(layers, opts);

    this.fx.addChild(this.charView.fx);
    this.effects.addChild(this.shower.g);

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
    if (this.app.renderer) this.disposeAll();
  }

  private disposeAll() {
    try {
      this.app.destroy(true, { children: true });
      this.view3d.dispose();
    } catch {
      /* ignore */
    }
  }

  /** Efekty vázané na místa v domě: záře televize, průvan u okna. */
  private buildSceneFx() {
    const tv = this.tvGlow;
    tv.poly(pts([[7.85, 5.62, zpx(1.1)], [9.35, 5.62, zpx(1.1)], [9.8, 1.4, 0], [7.2, 1.4, 0]])).fill({ color: 0x9fd8ff, alpha: 0.13 });
    tv.visible = false;
    const br = this.breeze;
    for (let i = 0; i < 3; i++) {
      const a = iso(10.2 + i * 0.35, 0.4 + i * 0.2, zpx(1.75) - i * 14);
      br.moveTo(a.x, a.y).bezierCurveTo(a.x + 10, a.y - 6, a.x + 20, a.y + 6, a.x + 32, a.y);
    }
    br.stroke({ width: 2, color: 0xffffff, alpha: 0.9, cap: 'round' });
    br.visible = false;
    this.glow.addChild(tv);
    this.effects.addChild(br);
  }

  private layout() {
    if (!this.app.renderer || !this.view3d) return;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const { top, right, bottom, left } = this.insets;
    const aw = Math.max(100, sw - left - right);
    const ah = Math.max(100, sh - top - bottom);
    const B = aw < ah ? HOUSE_BOUNDS : this.bounds;
    const base = Math.min(aw / B.w, ah / B.h, 1.9) * 0.98;
    const s = base * this.zoom;
    // omezení posunu
    const lim = (v: number, m: number) => Math.max(-m, Math.min(m, v));
    this.pan.x = lim(this.pan.x, (B.w * s) / 2);
    this.pan.y = lim(this.pan.y, (B.h * s) / 2);
    const cx = left + aw / 2 + this.pan.x;
    const cy = top + ah / 2 + this.pan.y;
    const tx = cx - (B.x + B.w / 2) * s;
    const ty = cy - (B.y + B.h / 2) * s;
    this.camera.scale.set(s);
    this.camera.position.set(tx, ty);
    this.view3d.setFrame(sw, sh, s, tx, ty);
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

    // postava: 3D model + efekty kolem ní
    const m = this.host.char.model;
    this.host.char.update(dt);
    this.charView.update(m, this.host.char.time, dt);
    this.view3d.avatar.update(m, this.host.char.time, dt);

    // scénické efekty
    const flags = this.host.sceneFlags;
    const tv = this.tvGlow;
    tv.visible = flags.has('tv');
    if (tv.visible) {
      tv.alpha = 0.75 + Math.sin(t / 90) * 0.15 + (Math.random() < 0.05 ? 0.3 : 0);
      tv.tint = [0xffffff, 0xffe0f0, 0xe0fff4, 0xfff4cc][Math.floor(t / 1600) % 4];
    }
    const br = this.breeze;
    br.visible = flags.has('windowOpen');
    if (br.visible) {
      br.alpha = 0.4 + Math.sin(t / 300) * 0.4;
      br.x = Math.sin(t / 500) * 6;
    }

    const hot = flags.has('showerHot');
    const cold = flags.has('showerCold');
    this.showerSpawn += dt;
    if ((hot || cold) && this.showerSpawn > 18) {
      this.showerSpawn = 0;
      const head = iso(0.5, 0.9, zpx(2.05));
      const floorY = iso(0.9, 0.9, zpx(0.1)).y;
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

    this.drawDome(s.protection.active, t);
    this.view3d.render();
  }

  private drawDome(active: boolean, t: number) {
    if (active && !this.wasProtected) this.domeT = t;
    this.wasProtected = active;
    const g = this.dome;
    g.clear();
    if (!active) return;
    const hex = houseOutline(0.22, zpx(2.5) + 30);
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
        const c = iso(GRID.w / 2, GRID.d / 2, 60);
        g.ellipse(c.x, c.y, 80 + kk * 420, 40 + kk * 210).stroke({ width: 6 * (1 - kk), color: P.protect, alpha: 1 - kk });
      }
    }
  }
}
