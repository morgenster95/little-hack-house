import { Graphics, Text } from 'pixi.js';
import * as THREE from 'three';
import { audio } from '../../engine/audio';
import { VACUUM_R, VacuumAttack, VacuumController } from '../../robots/VacuumController';
import { Particles } from '../effects';
import { iso, isoHull, pts } from '../iso';
import { P } from '../palette';
import { FLOOR_M, zpx } from '../space';
import { at } from '../three/props';
import { blobShadow, glowMaterial, toon } from '../three/toon';
import { DeviceFrame, DeviceView, DeviceViewOptions, Layers } from './devices';

const H = 0.085;
const LED: Record<string, number> = { normal: 0x4d86ff, hacked: 0xff3d6e, protected: 0x3ccf8e, recovering: 0xffb347, off: 0x9aa3ad };
/** obrysy nábytku, které se objevují na „ukradené“ mapě (mřížka) */
const MAP_SHAPES: [number, number, number, number][] = [
  [4.7, 0, 12, 7],
  [7.05, 0.05, 10.0, 1.3],
  [7.8, 2.2, 9.2, 3.0],
  [10.85, 2.35, 11.85, 3.45],
  [7.5, 5.45, 9.7, 6.05],
  [0, 0, 4.5, 7],
];

/** Displej na víku robota – oči podle nálady. */
class TopFace {
  canvas = document.createElement('canvas');
  tex = new THREE.CanvasTexture(this.canvas);
  private ctx = this.canvas.getContext('2d')!;
  private key = '';

  constructor() {
    this.canvas.width = this.canvas.height = 128;
    this.tex.colorSpace = THREE.NoColorSpace;
  }

  draw(mode: string, t: number) {
    const blink = mode === 'normal' && Math.floor(t / 2600) !== Math.floor((t - 140) / 2600);
    const phase = mode === 'map' ? Math.floor(t / 90) % 16 : mode === 'chaos' ? Math.floor(t / 120) % 8 : 0;
    const key = `${mode}|${blink}|${phase}`;
    if (key === this.key) return;
    this.key = key;
    const c = this.ctx;
    c.clearRect(0, 0, 128, 128);
    c.beginPath();
    c.arc(64, 64, 62, 0, Math.PI * 2);
    c.fillStyle = '#20252c';
    c.fill();
    const col = mode === 'off' ? '#55606b' : mode === 'normal' ? '#8ff5d9' : mode === 'protected' ? '#9ff5bf' : '#ff5d8a';
    c.strokeStyle = col;
    c.fillStyle = col;
    c.lineWidth = 9;
    c.lineCap = 'round';
    // oči jsou „vpředu“ = dole na textuře
    const ey = 78;
    if (mode === 'chase') {
      // naštvané oči
      c.beginPath();
      c.moveTo(36, ey - 14);
      c.lineTo(56, ey - 4);
      c.moveTo(92, ey - 14);
      c.lineTo(72, ey - 4);
      c.stroke();
      c.beginPath();
      c.arc(46, ey + 6, 8, 0, Math.PI * 2);
      c.arc(82, ey + 6, 8, 0, Math.PI * 2);
      c.fill();
    } else if (mode === 'chaos') {
      // točící se spirály
      for (const ex of [46, 82]) {
        c.beginPath();
        for (let i = 0; i < 24; i++) {
          const a = i * 0.55 + phase * 0.8;
          const r = i * 0.55;
          if (i === 0) c.moveTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
          else c.lineTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
        }
        c.lineWidth = 4;
        c.stroke();
      }
    } else if (mode === 'map') {
      // skenovací pruh
      c.lineWidth = 5;
      const x = 24 + (phase / 15) * 80;
      c.beginPath();
      c.moveTo(x, 34);
      c.lineTo(x, 94);
      c.stroke();
      c.font = '700 22px Nunito, sans-serif';
      c.textAlign = 'center';
      c.fillText('REC', 64, 112);
    } else if (blink) {
      c.beginPath();
      c.moveTo(38, ey);
      c.lineTo(54, ey);
      c.moveTo(74, ey);
      c.lineTo(90, ey);
      c.stroke();
    } else {
      c.beginPath();
      c.arc(46, ey, 8, 0, Math.PI * 2);
      c.arc(82, ey, 8, 0, Math.PI * 2);
      c.fill();
    }
    this.tex.needsUpdate = true;
  }
}

/**
 * Robotický vysavač: živý 3D model řízený VacuumController.
 * Odznak, zvýraznění i oblast pro klepnutí jezdí s ním.
 */
export class VacuumView extends DeviceView {
  ctl = new VacuumController({
    bump: () => {
      this.bumpT = this.t;
      audio.play('bump');
      this.dust(6, 0xffffff);
    },
  });
  private group = new THREE.Group();
  private brush = new THREE.Group();
  private turret = new THREE.Group();
  private ledMat = glowMaterial(LED.normal);
  private face = new TopFace();
  private shadow = blobShadow(0.55, 0.35);
  private fx = new Graphics();
  private particles = new Particles();
  private label: Text;
  private t = 0;
  private bumpT = -1;
  private humT = 0;
  private dustT = 0;
  private packetT = 0;

  constructor(L: Layers, opts: DeviceViewOptions) {
    super('vacuum', L, [5.1, 5.0, zpx(0.5)], [4.8, 4.7, 5.4, 5.3], [isoHull(4.8, 4.7, 0, 5.4, 5.3, zpx(0.12))], opts);
    const white = toon(0xf7f6f3);
    const grey = toon(0xd9dcdf);
    const dark = toon(0x2f343b);
    const r = 0.17;

    const up = (g: THREE.BufferGeometry) => g.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(up(new THREE.CylinderGeometry(r, r * 0.97, H - 0.01, 40)), white);
    body.position.z = 0.01 + (H - 0.01) / 2;
    const lid = new THREE.Mesh(up(new THREE.CylinderGeometry(r * 0.94, r * 0.97, 0.008, 40)), grey);
    lid.position.z = H + 0.002;
    // nárazník vpředu (−Y)
    const bumper = new THREE.Mesh(up(new THREE.CylinderGeometry(r + 0.004, r + 0.004, 0.04, 32, 1, true, -1.25, 2.5)), dark);
    bumper.position.z = 0.04;
    // displej na víku
    const screen = new THREE.Mesh(new THREE.CircleGeometry(0.085, 40), new THREE.MeshBasicMaterial({ map: this.face.tex }));
    screen.position.set(0, -0.02, H + 0.0075);
    // LED kroužek
    const led = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.005, 8, 48), this.ledMat);
    led.position.z = H + 0.007;
    // lidar vzadu
    const tur = new THREE.Mesh(up(new THREE.CylinderGeometry(0.038, 0.04, 0.026, 24)), dark);
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.012), glowMaterial(0x7fd8ff));
    notch.position.set(0, -0.034, 0.004);
    this.turret.add(tur, notch);
    this.turret.position.set(0, 0.095, H + 0.02);
    // boční kartáček
    const hub = new THREE.Mesh(up(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12)), dark);
    this.brush.add(hub);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.07, 0.003), dark);
      b.position.set(Math.sin((i * 2 * Math.PI) / 3) * 0.035, -Math.cos((i * 2 * Math.PI) / 3) * 0.035, 0);
      b.rotation.z = (i * 2 * Math.PI) / 3;
      this.brush.add(b);
    }
    this.brush.position.set(0.12, -0.12, 0.012);
    this.group.add(body, lid, bumper, screen, led, this.turret, this.brush);
    this.group.traverse((o) => (o.frustumCulled = false));
    L.view.scene.add(this.group, this.shadow);

    this.label = new Text({ text: '', style: { fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: '700', fill: 0xffffff } });
    this.label.resolution = 4;
    this.label.anchor.set(0.5);
    L.fx.addChild(this.fx, this.particles.g, this.label);
  }

  protected draw(f: DeviceFrame) {
    this.t = f.t;
    const attack: VacuumAttack = f.attacked ? ((f.attack as VacuumAttack) ?? 'normal') : 'normal';
    const c = this.ctl;
    c.update(f.dt, attack, this.smart, this.L.char);

    // 3D model
    const shake = this.bumpT >= 0 && f.t - this.bumpT < 200 ? Math.sin(f.t / 12) * 0.006 : 0;
    this.group.position.copy(at(c.x, c.y, FLOOR_M)).add(new THREE.Vector3(shake, shake, 0));
    this.group.rotation.z = c.heading;
    this.shadow.position.copy(at(c.x, c.y, FLOOR_M + 0.003));
    const moving = Math.abs(c.speed) > 0.05;
    this.brush.rotation.z += (moving ? 18 : 0) * (f.dt / 1000);
    this.turret.rotation.z += (this.smart && !c.docked ? (attack === 'map' ? 14 : 6) : 0) * (f.dt / 1000);
    const st = f.attacked ? 'hacked' : !this.smart ? 'off' : f.status === 'protected' ? 'protected' : f.status === 'recovering' ? 'recovering' : 'normal';
    const pulse = attack !== 'normal' ? 0.6 + Math.sin(f.t / 120) * 0.4 : 1;
    this.ledMat.color.setHex(LED[st]).multiplyScalar(pulse);
    this.face.draw(!this.smart ? 'off' : f.attacked ? attack : f.status === 'protected' ? 'protected' : 'normal', f.t);

    // odznak a klepnutí jezdí s robotem
    const b = iso(c.x, c.y, zpx(0.5));
    this.badgeAnchor.x = b.x;
    this.badgeAnchor.y = b.y;
    const rr = VACUUM_R + 0.08;
    this.footprint = [c.x - rr, c.y - rr, c.x + rr, c.y + rr];
    this.setHitAreas([isoHull(c.x - rr, c.y - rr, 0, c.x + rr, c.y + rr, zpx(0.14))]);

    // zvuk motoru
    this.humT -= f.dt;
    if (moving && this.humT <= 0) {
      audio.play('vacuum');
      this.humT = attack === 'chaos' ? 1200 : 1700;
    }
    // prach za robotem při zběsilé jízdě
    this.dustT -= f.dt;
    if (attack === 'chaos' && moving && this.dustT <= 0) {
      this.dustT = 90;
      this.dust(1, 0xe9dccb);
    }
    this.particles.update(f.dt);
    this.drawMap(f, attack);
  }

  private dust(n: number, color: number) {
    const c = this.ctl;
    const p = iso(c.x, c.y, zpx(0.05));
    for (let i = 0; i < n; i++) {
      this.particles.spawn({ kind: 'puff', x: p.x + (Math.random() - 0.5) * 16, y: p.y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 30, vy: -12 - Math.random() * 10, max: 700, size: 2.5 + Math.random() * 2, color });
    }
  }

  /** Útok „mapa“: trasa, odhalovaný půdorys a odesílaná data. */
  private drawMap(f: DeviceFrame, attack: VacuumAttack) {
    const g = this.fx;
    g.clear();
    this.label.visible = false;
    if (attack !== 'map') return;
    const c = this.ctl;
    const k = c.mapped;
    // naskenovaná stopa
    if (c.trail.length > 1) {
      const p0 = iso(c.trail[0].x, c.trail[0].y, 2);
      g.moveTo(p0.x, p0.y);
      for (const q of c.trail.slice(1)) {
        const p = iso(q.x, q.y, 2);
        g.lineTo(p.x, p.y);
      }
      const p = iso(c.x, c.y, 2);
      g.lineTo(p.x, p.y);
      g.stroke({ width: 7, color: P.hack, alpha: 0.12, cap: 'round', join: 'round' });
    }
    // lidarové paprsky
    const o = iso(c.x, c.y, zpx(0.11));
    for (let i = 0; i < 7; i++) {
      const a = f.t / 260 + (i / 7) * Math.PI * 2;
      const e = iso(c.x + Math.cos(a) * 1.8, c.y + Math.sin(a) * 1.8, zpx(0.11));
      g.moveTo(o.x, o.y).lineTo(e.x, e.y);
    }
    g.stroke({ width: 1.2, color: 0xff5d8a, alpha: 0.35 });
    // půdorys – obrysy se kreslí postupně
    MAP_SHAPES.forEach(([x0, y0, x1, y1], i) => {
      const kk = Math.max(0, Math.min(1, k * MAP_SHAPES.length - i * 0.6));
      if (kk <= 0) return;
      const corners: [number, number, number][] = [
        [x0, y0, 3],
        [x1, y0, 3],
        [x1, y1, 3],
        [x0, y1, 3],
        [x0, y0, 3],
      ];
      const P4 = pts(corners);
      const total = 4 * kk;
      g.moveTo(P4[0], P4[1]);
      for (let s = 0; s < 4; s++) {
        const t = Math.max(0, Math.min(1, total - s));
        if (t <= 0) break;
        g.lineTo(P4[s * 2] + (P4[s * 2 + 2] - P4[s * 2]) * t, P4[s * 2 + 1] + (P4[s * 2 + 3] - P4[s * 2 + 1]) * t);
      }
      g.stroke({ width: i === 0 || i === 5 ? 2.5 : 1.8, color: P.hack, alpha: 0.8 });
    });
    // odesílaná data
    this.packetT -= f.dt;
    if (this.packetT <= 0) {
      this.packetT = 160;
      const p = iso(c.x, c.y, zpx(0.3));
      this.particles.spawn({ kind: 'spark', x: p.x + (Math.random() - 0.5) * 10, y: p.y, vx: (Math.random() - 0.5) * 20, vy: -140, max: 1300, size: 3.5, color: P.hack });
    }
    const pct = Math.round(k * 100);
    this.label.visible = true;
    this.label.text = k < 1 ? `UPLOAD mapa_bytu.png ${pct} %` : 'mapa_bytu.png ✓ odesláno';
    const lp = iso(c.x, c.y, zpx(0.95));
    this.label.position.set(lp.x, lp.y);
    g.roundRect(lp.x - this.label.width / 2 - 6, lp.y - 9, this.label.width + 12, 18, 6).fill({ color: 0x1d1530, alpha: 0.85 });
  }
}

