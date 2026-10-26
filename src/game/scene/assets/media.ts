import { Container, Graphics, Text } from 'pixi.js';
import * as THREE from 'three';
import { audio } from '../../engine/audio';
import { Particles, SpeechBubble } from '../effects';
import { box, iso, isoHull, pts } from '../iso';
import { P } from '../palette';
import { zpx } from '../space';
import { at } from '../three/props';
import { glowMaterial } from '../three/toon';
import { DeviceFrame, DeviceView, DeviceViewOptions, Layers } from './devices';

/** Kužel světla obrazovky směrem ke gauči (televize je k divákovi zády). */
const TV_GLOW = pts([
  [7.85, 5.62, zpx(1.1)],
  [9.35, 5.62, zpx(1.1)],
  [9.8, 1.4, 0],
  [7.2, 1.4, 0],
]);
const TV_TOP = { x: 8.6, y: 5.72, z: 1.18 };
const ADS = ['AKCE!', '−90 %', 'KUP TEĎ!', 'JEN DNES', 'ZDARMA*', '1+1'];

/** Malý štítek s textem v překryvné vrstvě. */
class Tag {
  container = new Container();
  private g = new Graphics();
  private text: Text;

  constructor(size = 10) {
    this.text = new Text({ text: '', style: { fontFamily: 'Nunito, sans-serif', fontSize: size, fontWeight: '900', fill: 0xffffff } });
    this.text.resolution = 4;
    this.text.anchor.set(0.5);
    this.container.addChild(this.g, this.text);
  }

  draw(text: string, bg: number, fg = 0xffffff, alpha = 1) {
    if (this.text.text !== text) this.text.text = text;
    this.text.style.fill = fg;
    const w = this.text.width + 12;
    this.g.clear();
    this.g.roundRect(-w / 2, -9, w, 18, 6).fill({ color: bg, alpha: 0.92 });
    this.container.alpha = alpha;
  }
}

/* ------------------------------------------------------------------ */
/* Chytrá televize                                                      */
/* ------------------------------------------------------------------ */

export class TvView extends DeviceView {
  private glow = new Graphics();
  private waves = new Graphics();
  private particles = new Particles();
  private tags: { tag: Tag; born: number; x: number; text: string; col: number }[] = [];
  private label = new Tag(11);
  private rec: THREE.Mesh;
  private recMat = glowMaterial(0xff2d55);
  private nextTag = 0;
  private packetT = 0;
  private blareT = 0;

  constructor(L: Layers, opts: DeviceViewOptions) {
    super(
      'tv',
      L,
      [8.6, 5.72, zpx(1.5)],
      [7.5, 5.4, 9.7, 6.1],
      [isoHull(7.75, 5.6, zpx(0.5), 9.45, 5.8, zpx(1.2)), isoHull(7.5, 5.45, 0, 9.7, 6.05, zpx(0.5))],
      opts,
    );
    this.rec = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), this.recMat);
    this.rec.position.copy(at(TV_TOP.x + 0.55, TV_TOP.y, TV_TOP.z + 0.012));
    L.view.scene.add(this.rec);
    L.glow.addChild(this.glow);
    L.fx.addChild(this.waves, this.particles.g, this.label.container);
  }

  protected draw(f: DeviceFrame) {
    const mode = f.attacked ? f.attack : 'normal';
    const g = this.glow;
    const w = this.waves;
    g.clear();
    w.clear();
    this.rec.visible = mode === 'spy' && Math.floor(f.t / 500) % 2 === 0;
    this.label.container.visible = false;

    if (mode === 'loud') {
      const flash = Math.random() < 0.15 ? 0.35 : 0.18;
      g.poly(TV_GLOW).fill({ color: 0xfff1e0, alpha: flash });
      // vlny hluku z televize
      const c = iso(TV_TOP.x, TV_TOP.y - 0.2, zpx(0.9));
      for (let i = 0; i < 4; i++) {
        const k = (f.t / 700 + i / 4) % 1;
        w.ellipse(c.x, c.y, 30 + k * 150, 14 + k * 70).stroke({ width: 4 * (1 - k), color: 0xff6b4d, alpha: 0.75 * (1 - k) });
      }
      this.showLabel('🔊 VOL 100', P.danger);
      this.blareT -= f.dt;
      if (this.blareT <= 0) {
        audio.play('blare');
        this.blareT = 1300;
      }
    } else if (mode === 'ads') {
      const hues = [0xff5d9e, 0xffd23f, 0x5db8ff, 0x8cff6b];
      g.poly(TV_GLOW).fill({ color: hues[Math.floor(f.t / 260) % hues.length], alpha: 0.2 });
      if (f.t > this.nextTag) {
        this.nextTag = f.t + 650;
        const tag = this.tags.find((t) => f.t - t.born > 2200) ?? this.newTag();
        tag.born = f.t;
        tag.x = (Math.random() - 0.5) * 120;
        tag.text = ADS[Math.floor(Math.random() * ADS.length)];
        tag.col = hues[Math.floor(Math.random() * hues.length)];
      }
    } else if (mode === 'spy') {
      // mikrofon „nasává“ zvuk z místnosti a posílá ho ven
      const m = this.L.char;
      const src = iso(m.x, m.y, zpx(1.5));
      const dst = iso(TV_TOP.x, TV_TOP.y, zpx(TV_TOP.z));
      for (let i = 0; i < 3; i++) {
        const k = (f.t / 900 + i / 3) % 1;
        const x = src.x + (dst.x - src.x) * k;
        const y = src.y + (dst.y - src.y) * k;
        w.arc(x, y, 8 + 6 * (1 - k), -0.9, 0.9).stroke({ width: 2.2, color: P.hack, alpha: 0.8 * Math.sin(k * Math.PI) });
      }
      this.packetT -= f.dt;
      if (this.packetT <= 0) {
        this.packetT = 220;
        this.particles.spawn({ kind: 'spark', x: dst.x + (Math.random() - 0.5) * 30, y: dst.y - 10, vx: (Math.random() - 0.5) * 20, vy: -130, max: 1400, size: 3.5, color: P.hack });
      }
      this.showLabel('● REC  mikrofon', 0xd61f4a);
    }

    // reklamní štítky stoupají z televize
    const base = iso(TV_TOP.x, TV_TOP.y, zpx(TV_TOP.z));
    for (const t of this.tags) {
      const age = f.t - t.born;
      const on = mode === 'ads' && age < 2200;
      t.tag.container.visible = on;
      if (!on) continue;
      const k = age / 2200;
      t.tag.draw(t.text, t.col, 0x2b1a3a, Math.sin(k * Math.PI));
      t.tag.container.position.set(base.x + t.x * k, base.y - 20 - k * 90);
      t.tag.container.scale.set(0.8 + Math.sin(Math.min(1, k * 6) * Math.PI * 0.5) * 0.4);
    }
    this.particles.update(f.dt);
  }

  private showLabel(text: string, bg: number) {
    const p = iso(TV_TOP.x, TV_TOP.y, zpx(TV_TOP.z + 0.25));
    this.label.container.visible = true;
    this.label.draw(text, bg);
    this.label.container.position.set(p.x, p.y);
  }

  private newTag() {
    const t = { tag: new Tag(11), born: -1e9, x: 0, text: '', col: 0 };
    this.L.fx.addChild(t.tag.container);
    this.tags.push(t);
    return t;
  }
}

/* ------------------------------------------------------------------ */
/* Hlasový asistent                                                     */
/* ------------------------------------------------------------------ */

const SPEAKER = { x: 9.45, y: 5.75, z: 0.668 };
const LINES: Record<string, string[]> = {
  order: ['Objednávám 50× pizza 🍕', 'Platba schválena ✔', 'Kurýr je na cestě 🛵', 'Přidávám dalších 20 kusů'],
  creepy: ['Vidím tě…', 'Hehehe…', 'Jsi doma sám?', 'Otoč se…'],
};

export class SpeakerView extends DeviceView {
  private ledRing: THREE.Mesh;
  private ringMat = glowMaterial(0x4d86ff);
  private bubble = new SpeechBubble();
  private boxes = new Graphics();
  private line = -1;
  private lineT = 0;
  private orderStart = -1;
  private delivered = 0;

  constructor(L: Layers, opts: DeviceViewOptions) {
    super('speaker', L, [9.45, 5.75, zpx(1.05)], [9.25, 5.55, 9.65, 5.95], [isoHull(9.33, 5.63, zpx(0.46), 9.57, 5.87, zpx(0.7))], opts);
    this.ledRing = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 10, 40), this.ringMat);
    this.ledRing.position.copy(at(SPEAKER.x, SPEAKER.y, SPEAKER.z));
    L.view.scene.add(this.ledRing);
    L.fx.addChild(this.boxes, this.bubble.container);
  }

  protected draw(f: DeviceFrame) {
    const mode = f.attacked ? f.attack ?? 'normal' : 'normal';
    this.ledRing.visible = this.smart;
    const talking = mode === 'order' || mode === 'creepy';
    const pulse = 0.55 + Math.sin(f.t / (talking ? 90 : 900)) * 0.45;
    const col = mode === 'creepy' ? 0xff2d55 : mode === 'order' ? P.hack : f.status === 'protected' ? P.protect : 0x4d86ff;
    this.ringMat.color.setHex(col).multiplyScalar(talking ? pulse : 0.5 + pulse * 0.3);

    // co asistent říká
    const lines = LINES[mode];
    if (lines) {
      this.lineT -= f.dt;
      if (this.lineT <= 0) {
        this.line = (this.line + 1) % lines.length;
        this.lineT = 2600;
        audio.play(lines[this.line].startsWith('Hehe') ? 'laugh' : 'chime');
      }
      const age = 2600 - this.lineT;
      this.bubble.draw(lines[this.line], age);
      const p = iso(SPEAKER.x, SPEAKER.y, zpx(SPEAKER.z + 0.35));
      this.bubble.container.position.set(p.x, p.y);
    } else {
      this.line = -1;
      this.lineT = 0;
      this.bubble.draw(null, 0);
    }

    // objednané pizzy se kupí přede dveřmi
    if (mode === 'order') {
      if (this.orderStart < 0) this.orderStart = f.t;
      this.delivered = Math.min(7, Math.floor((f.t - this.orderStart - 3500) / 1600) + 1);
    } else if (!f.attacked) {
      this.orderStart = -1;
      this.delivered = 0;
    }
    const g = this.boxes;
    g.clear();
    for (let i = 0; i < this.delivered; i++) {
      const sx = i % 2 === 0 ? 0 : 0.05;
      box(g, 6.75 + sx, 7.55 + (i % 3) * 0.02, i * 5, 0.5, 0.5, 5, { top: 0xf3d9a6, left: 0xd9b57c, right: 0xc49c63 });
      const c = iso(7.0 + sx, 7.8, i * 5 + 5);
      g.circle(c.x, c.y, 3).fill({ color: 0xe0533d, alpha: 0.85 });
    }
  }
}
