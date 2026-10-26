import { Container, Graphics, Text } from 'pixi.js';
import * as THREE from 'three';
import { iso, isoHull } from '../iso';
import { P } from '../palette';
import { FLOOR_M, zpx } from '../space';
import { at } from '../three/props';
import { glowMaterial, toon } from '../three/toon';
import { DeviceFrame, DeviceView, DeviceViewOptions, Layers } from './devices';

/** Držák kamery v rohu obýváku (zapečený v podkladu), hlava je živá. */
const MOUNT = { x: 11.85, y: 0.12, z: 2.25 };

/**
 * Bezpečnostní kamera: hlava se plynule natáčí – normálně pomalu prohlíží místnost,
 * při útoku „sledovat“ míří na postavičku, při vypnutí svěsí hlavu a zhasne.
 */
export class CameraView extends DeviceView {
  private pivot = new THREE.Object3D();
  private led = glowMaterial(0x4d86ff);
  private aim = new THREE.Object3D();
  private cone = new Graphics();
  private tag = new Container();
  private tagG = new Graphics();
  private tagText: Text;
  private mount = new THREE.Group();
  protected optional = true;

  constructor(L: Layers, opts: DeviceViewOptions) {
    super('camera', L, [11.85, 0.2, zpx(2.75)], [11.4, 0.0, 12.0, 0.6], [isoHull(11.7, 0.0, zpx(2.08), 12.0, 0.42, zpx(2.36))], opts);
    const white = toon(0xf7f6f3);
    const dark = toon(0x2a2f36);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), white);
    body.scale.set(0.058, 0.058, 0.085);
    body.position.z = 0.07;
    const lensRing = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.02, 28).rotateX(Math.PI / 2), dark);
    lensRing.position.z = 0.148;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 28), glowMaterial(0x1a2a3a));
    lens.position.z = 0.1585;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 8), this.led);
    led.position.set(0.032, 0.03, 0.135);
    this.pivot.add(body, lensRing, lens, led);
    this.pivot.up.set(0, 0, 1);
    this.pivot.position.copy(at(MOUNT.x, MOUNT.y, MOUNT.z));
    this.pivot.traverse((o) => (o.frustumCulled = false));
    this.aim.up.set(0, 0, 1);
    this.aim.position.copy(this.pivot.position);
    // držák na stěně
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.2 * 0.65, 0.04, 0.1), white);
    plate.position.copy(at(MOUNT.x, 0, 2.25)).setY(-0.02);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.075, 16), white);
    arm.position.copy(at(MOUNT.x, 0, MOUNT.z)).setY(-0.055);
    this.mount.add(plate, arm);
    this.mount.traverse((o) => (o.frustumCulled = false));
    L.view.scene.add(this.pivot, this.mount);

    this.tagText = new Text({ text: '', style: { fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: '700', fill: 0xffffff } });
    this.tagText.resolution = 4;
    this.tagText.anchor.set(0.5);
    this.tag.addChild(this.tagG, this.tagText);
    L.glow.addChild(this.cone);
    L.fx.addChild(this.tag);
  }

  protected draw(f: DeviceFrame) {
    const mode = f.attacked ? f.attack : 'normal';
    const m = this.L.char;
    // kameru nemá každý – bez zapnutí ve scéně vůbec není
    this.pivot.visible = this.mount.visible = this.smart;
    if (!this.smart) {
      this.cone.clear();
      this.tag.visible = false;
      return;
    }
    let target: THREE.Vector3;
    if (mode === 'peek') target = at(m.x, m.y, FLOOR_M + 1.35);
    else if (mode === 'off') target = at(11.4, 0.5, 0.2);
    else target = at(8.2 + Math.sin(f.t / 4200) * 2.6, 3.4 + Math.cos(f.t / 5100) * 1.2, 0.6);
    this.aim.lookAt(target);
    this.pivot.quaternion.slerp(this.aim.quaternion, Math.min(1, f.dt / (mode === 'peek' ? 140 : 400)));

    const blink = Math.floor(f.t / 450) % 2 === 0;
    const col = !this.smart || mode === 'off' ? 0x000000 : mode === 'peek' ? (blink ? 0xff2d55 : 0x5a1020) : f.status === 'protected' ? P.protect : 0x4d86ff;
    this.led.color.setHex(col);

    // zorný kužel a štítek
    const g = this.cone;
    g.clear();
    this.tag.visible = false;
    if (mode === 'peek') {
      const o = iso(MOUNT.x, MOUNT.y + 0.2, zpx(MOUNT.z));
      const c = iso(m.x, m.y, zpx(FLOOR_M + 0.9));
      const nx = -(c.y - o.y);
      const ny = c.x - o.x;
      const len = Math.hypot(nx, ny) || 1;
      const s = 34;
      g.poly([o.x, o.y, c.x + (nx / len) * s, c.y + (ny / len) * s, c.x - (nx / len) * s, c.y - (ny / len) * s]).fill({ color: P.hack, alpha: 0.13 });
      g.ellipse(c.x, c.y + 18, 30, 12).fill({ color: P.hack, alpha: 0.16 });
      this.showTag(blink ? '● REC  živý přenos' : '○ REC  živý přenos', 0xd61f4a);
    } else if (mode === 'off') {
      this.showTag('✕ záznam vypnut', 0x4a4f57);
    }
  }

  private showTag(text: string, bg: number) {
    this.tag.visible = true;
    if (this.tagText.text !== text) this.tagText.text = text;
    const w = this.tagText.width + 12;
    this.tagG.clear().roundRect(-w / 2, -9, w, 18, 6).fill({ color: bg, alpha: 0.9 });
    const p = iso(MOUNT.x - 0.2, MOUNT.y + 0.35, zpx(MOUNT.z - 0.35));
    this.tag.position.set(p.x - 30, p.y);
  }
}
