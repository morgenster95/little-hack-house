import { Graphics } from 'pixi.js';
import * as THREE from 'three';
import { audio } from '../../engine/audio';
import { Particles } from '../effects';
import { iso, isoHull } from '../iso';
import { P } from '../palette';
import { FLOOR_M, TILE_M, zpx } from '../space';
import { at, facingRoom, Screen } from '../three/props';
import { glowMaterial, toon } from '../three/toon';
import { DeviceFrame, DeviceView, DeviceViewOptions, Layers } from './devices';

/** Dveře v přední (uříznuté) stěně: pant u gx 5.4, šířka do 6.6, stěna gy 7.0–7.3. */
const DOOR = { x0: 5.4, x1: 6.6, y: 7.15, h: 0.42 - FLOOR_M };
const OPEN = 1.45;

/**
 * Chytrý zámek: živé křídlo dveří (ve stejném řezu jako stěny) a klávesnice na fasádě.
 * Při útoku „odemknout“ se dveře samy otevřou; když je postavička zavře (příznak scény doorHeld), drží zavřené.
 */
export class LockView extends DeviceView {
  private hinge = new THREE.Group();
  private ledMat = glowMaterial(0x3ccf8e);
  private keypad = new Screen(0.1, 0.14, 100, 140);
  private angle = 0;
  private wasOpening = false;
  private particles = new Particles();
  private breeze = new Graphics();
  private leafT = 0;

  constructor(L: Layers, opts: DeviceViewOptions) {
    super(
      'lock',
      L,
      [6.0, 7.15, zpx(0.95)],
      [5.3, 6.9, 6.7, 7.4],
      [isoHull(5.4, 6.95, 0, 6.6, 7.35, zpx(0.45)), isoHull(6.65, 7.28, zpx(0.15), 6.9, 7.34, zpx(0.4))],
      opts,
    );
    const w = (DOOR.x1 - DOOR.x0) * TILE_M;
    const wood = toon(0xd2ab83);
    const edge = toon(0xb98c62);
    const dark = toon(0x2f343b);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.01, 0.045, DOOR.h), wood);
    leaf.position.set(w / 2, 0, DOOR.h / 2);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w - 0.01, 0.047, 0.012), edge);
    top.position.set(w / 2, 0, DOOR.h - 0.006);
    // chytrý zámek + klika na vnitřní straně
    const lockBox = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.09), dark);
    lockBox.position.set(w - 0.09, 0.035, DOOR.h * 0.55);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), this.ledMat);
    led.position.set(w - 0.09, 0.052, DOOR.h * 0.55 + 0.025);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.015), dark);
    handle.position.set(w - 0.08, -0.035, DOOR.h * 0.5);
    this.hinge.add(leaf, top, lockBox, led, handle);
    this.hinge.position.copy(at(DOOR.x0 + 0.01, DOOR.y, FLOOR_M));
    this.hinge.traverse((o) => (o.frustumCulled = false));

    // klávesnice na fasádě vpravo od dveří (venkovní strana stěny)
    // rovina natočená ven z domu (normála −Y = +gy)
    const pad = facingRoom(this.keypad.mesh);
    pad.position.copy(at(6.78, 7.3, 0.27)).setY(-7.3 * TILE_M - 0.004);
    L.view.scene.add(this.hinge, pad);
    L.glow.addChild(this.breeze);
    L.fx.addChild(this.particles.g);
  }

  /** Jsou dveře (skoro) otevřené? */
  get isOpen() {
    return this.angle > 0.4;
  }

  protected draw(f: DeviceFrame) {
    const mode = f.attacked ? f.attack : 'normal';
    const target = mode === 'unlock' && !this.L.flags.has('doorHeld') ? OPEN : 0;
    const opening = target > this.angle + 0.01;
    if (opening && !this.wasOpening) audio.play('creak');
    this.wasOpening = opening;
    this.angle += (target - this.angle) * Math.min(1, f.dt / (opening ? 900 : 250));
    this.hinge.rotation.z = this.angle;

    const blink = Math.floor(f.t / 400) % 2 === 0;
    const led = !this.smart ? 0x55606b : mode === 'unlock' ? (blink ? 0xffb347 : 0x5a4010) : mode === 'jam' ? (blink ? 0xff2d55 : 0x5a1020) : f.status === 'protected' ? P.protect : 0x3ccf8e;
    this.ledMat.color.setHex(led);
    const state = mode === 'unlock' ? 'OPEN' : mode === 'jam' ? 'ERR' : '🔒';
    this.keypad.draw(`${state}|${this.smart}|${blink}`, (ctx, w, h) => {
      ctx.fillStyle = '#20252c';
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 14);
      ctx.fill();
      ctx.fillStyle = mode === 'jam' ? '#ff5d8a' : mode === 'unlock' ? '#ffd27a' : '#8ff5d9';
      ctx.font = '800 26px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.smart ? state : '', w / 2, 34);
      ctx.fillStyle = '#4a525c';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ctx.fillRect(16 + c * 26, 54 + r * 26, 16, 16);
    });

    // průvan a listí, když jsou dveře otevřené
    const g = this.breeze;
    g.clear();
    if (this.isOpen) {
      for (let i = 0; i < 3; i++) {
        const k = (f.t / 1400 + i / 3) % 1;
        const a = iso(5.7 + i * 0.35, 7.1 - k * 2.2, zpx(0.25 + i * 0.1));
        g.moveTo(a.x - 14, a.y).bezierCurveTo(a.x - 4, a.y - 6, a.x + 6, a.y + 6, a.x + 16, a.y);
        g.stroke({ width: 2, color: 0xffffff, alpha: Math.sin(k * Math.PI) * 0.8, cap: 'round' });
      }
      this.leafT -= f.dt;
      if (this.leafT <= 0) {
        this.leafT = 320;
        const s = iso(5.6 + Math.random() * 0.9, 7.3, zpx(0.3));
        this.particles.spawn({ kind: 'snow', x: s.x, y: s.y, vx: 16 + Math.random() * 22, vy: -12 - Math.random() * 10, max: 2200, size: 2.6, color: Math.random() < 0.5 ? 0xe39a4f : 0x9cbf5d });
      }
    }
    this.particles.update(f.dt);
  }
}
