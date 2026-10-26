import { Graphics } from 'pixi.js';
import * as THREE from 'three';
import { audio } from '../../engine/audio';
import { Particles } from '../effects';
import { iso, isoHull } from '../iso';
import { P } from '../palette';
import { FLOOR_M, TILE_M, zpx } from '../space';
import { at } from '../three/props';
import { DeviceFrame, DeviceView, DeviceViewOptions, Layers } from './devices';

/** Dvířka pračky (střed, mřížka + výška v m) – kolmo na osu X, k divákovi. */
const DOOR = { x: 0.97, y: 3.52, z: 0.45, front: 0.97 * TILE_M + 0.019 };
/** Louže po vypuštění vody: střed a poloosy (mřížka). */
const PUDDLE = { x: 1.9, y: 3.6, rx: 1.15, ry: 1.25 };

function drumTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const grd = x.createRadialGradient(64, 64, 10, 64, 64, 64);
  grd.addColorStop(0, '#3d566a');
  grd.addColorStop(1, '#1d2733');
  x.fillStyle = grd;
  x.beginPath();
  x.arc(64, 64, 64, 0, Math.PI * 2);
  x.fill();
  // prádlo
  const cols = ['#e27d60', '#f2c46d', '#86b59b', '#7cc7f2', '#f0a6a0', '#ffffff'];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 26 + (i % 3) * 9;
    x.fillStyle = cols[i % cols.length];
    x.beginPath();
    x.ellipse(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 13, 8, a, 0, Math.PI * 2);
    x.fill();
  }
  // odlesk skla
  x.strokeStyle = 'rgba(255,255,255,0.35)';
  x.lineWidth = 6;
  x.beginPath();
  x.arc(64, 64, 48, -2.6, -1.7);
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function puddleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  // nepravidelný okraj louže
  x.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = 110 + Math.sin(a * 3) * 9 + Math.sin(a * 7 + 1) * 6;
    const px = 128 + Math.cos(a) * r;
    const py = 128 + Math.sin(a) * r;
    if (i === 0) x.moveTo(px, py);
    else x.lineTo(px, py);
  }
  x.closePath();
  const grd = x.createRadialGradient(128, 128, 20, 128, 128, 125);
  grd.addColorStop(0, 'rgba(150,210,245,0.75)');
  grd.addColorStop(1, 'rgba(120,190,235,0.55)');
  x.fillStyle = grd;
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.7)';
  x.lineWidth = 4;
  x.stroke();
  // odlesky
  x.strokeStyle = 'rgba(255,255,255,0.55)';
  x.lineWidth = 5;
  x.lineCap = 'round';
  for (const [sx, sy, l] of [[90, 80, 40], [150, 150, 30], [110, 170, 22]]) {
    x.beginPath();
    x.moveTo(sx, sy);
    x.lineTo(sx + l, sy - l * 0.3);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export class WasherView extends DeviceView {
  private drum: THREE.Mesh;
  private puddle: THREE.Mesh;
  private puddleMat: THREE.MeshBasicMaterial;
  private flood = 0;
  private lines = new Graphics();
  private particles = new Particles();
  private rumbleT = 0;
  private foamT = 0;

  constructor(L: Layers, opts: DeviceViewOptions) {
    super('washer', L, [0.5, 3.52, zpx(1.2)], [0.0, 3.0, 1.0, 4.05], [isoHull(0.05, 3.05, 0, 0.95, 4.0, zpx(0.9))], opts);
    this.drum = new THREE.Mesh(
      new THREE.CircleGeometry(0.128, 40).rotateY(Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: drumTexture(), transparent: true }),
    );
    this.drum.position.copy(at(0, DOOR.y, DOOR.z)).setX(DOOR.front);
    this.puddleMat = new THREE.MeshBasicMaterial({ map: puddleTexture(), transparent: true, depthWrite: false, opacity: 0 });
    this.puddle = new THREE.Mesh(new THREE.PlaneGeometry(PUDDLE.rx * 2 * TILE_M, PUDDLE.ry * 2 * TILE_M), this.puddleMat);
    this.puddle.position.copy(at(PUDDLE.x, PUDDLE.y, FLOOR_M + 0.004));
    this.puddle.renderOrder = 4;
    this.puddle.visible = false;
    L.view.scene.add(this.drum, this.puddle);
    L.fx.addChild(this.lines, this.particles.g);
  }

  /** 0…1 – jak moc je koupelna vytopená (pro scénáře). */
  get flooded() {
    return this.flood;
  }

  protected draw(f: DeviceFrame) {
    const mode = f.attacked ? f.attack : 'normal';
    const washing = this.L.flags.has('washing');
    const speed = mode === 'spin' ? 28 : mode === 'flood' ? 2 : washing ? 4 : 0;
    this.drum.rotation.x += speed * (f.dt / 1000);
    const shake = mode === 'spin' ? 0.004 : 0;
    this.drum.position.y = -DOOR.y * TILE_M + (Math.random() - 0.5) * shake;
    this.drum.position.z = DOOR.z + (Math.random() - 0.5) * shake;

    // louže roste, po obnovení vysychá
    this.flood = Math.max(0, Math.min(1, this.flood + (mode === 'flood' ? f.dt / 7000 : -f.dt / 5000)));
    this.puddle.visible = this.flood > 0.01;
    const s = 0.25 + this.flood * 0.75;
    this.puddle.scale.set(s, s, 1);
    this.puddle.position.copy(at(1.0 + (PUDDLE.x - 1.0) * s, PUDDLE.y, FLOOR_M + 0.004));
    this.puddleMat.opacity = Math.min(1, this.flood * 2);

    const g = this.lines;
    g.clear();
    if (mode === 'spin') {
      // čáry třesu kolem pračky
      for (const [x, y, z] of [[1.0, 3.0, 0.75], [1.0, 4.05, 0.75], [1.0, 3.0, 0.3], [1.0, 4.05, 0.3]]) {
        const p = iso(x, y, zpx(z));
        const j = Math.sin(f.t / 30 + y) * 3;
        const dir = y < 3.5 ? -1 : 1;
        g.moveTo(p.x + dir * 6 + j, p.y - 6).lineTo(p.x + dir * 14 + j, p.y - 10);
        g.moveTo(p.x + dir * 6 + j, p.y + 2).lineTo(p.x + dir * 16 + j, p.y + 2);
      }
      g.stroke({ width: 2.2, color: P.outline, alpha: 0.55, cap: 'round' });
      this.rumbleT -= f.dt;
      if (this.rumbleT <= 0) {
        audio.play('rumble');
        this.rumbleT = 2200;
      }
    }
    if (mode === 'spin' || mode === 'flood') {
      this.foamT -= f.dt;
      if (this.foamT <= 0) {
        this.foamT = mode === 'flood' ? 120 : 260;
        const p = iso(1.02, DOOR.y + (Math.random() - 0.5) * 0.3, zpx(DOOR.z - 0.1));
        this.particles.spawn({ kind: mode === 'flood' ? 'drop' : 'puff', x: p.x, y: p.y, vx: 20 + Math.random() * 40, vy: mode === 'flood' ? 10 : -20, max: 900, size: mode === 'flood' ? 2 : 4 + Math.random() * 3, color: mode === 'flood' ? 0x8fd3f5 : 0xffffff, floorY: p.y + 34 });
      }
    }
    this.particles.update(f.dt);
  }
}
