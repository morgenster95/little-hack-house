import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WAYPOINTS } from '../../../config/layout';
import type { CharacterModel, Facing, Pose } from '../../character/CharacterController';
import { FaceCanvas } from '../face';
import { mix } from '../iso';
import { FLOOR_M, TILE_M } from '../space';

const SKIN = 0xffd9bd;
/** Barvy materiálů podle jmen z tools/blender/avatar.py. */
const COLORS: Record<string, number> = {
  skin: SKIN,
  hair: 0x5a3a2b,
  sweater: 0x4fb3a5,
  sweater_rib: 0x43a294,
  pants: 0x4a4e69,
  shoe: 0xf5f5f2,
  sole: 0xdcdcd8,
  blanket: 0xf2c46d,
  book: 0xe27d60,
  paper: 0xfff2dc,
  towel: 0xffffff,
  cap: 0xf7a8c4,
};
/**
 * Podklad je „zapečený“ z Cycles, živá světla scény jsou slabá (jsou jen pro displeje).
 * Postava proto dostane část barvy jako vlastní svit, aby měla jas jako zbytek domu.
 */
const SELF_LIT = 0.55;
/** Oblečení, které se ve sprše „svleče“ (přebarví na kůži). */
const CLOTHES = ['sweater', 'sweater_rib', 'pants', 'shoe', 'sole'];

const SEATED = new Set<Pose>(['sit', 'sleep', 'blanket', 'read']);
const CLIP: Record<Pose, string> = {
  stand: 'idle',
  sit: 'sit',
  shower: 'shower',
  sleep: 'sleep',
  warm: 'warm',
  blanket: 'blanket',
  dance: 'dance',
  read: 'read',
  press: 'press',
};
/** Kam se dívá (směr v mřížce) – „back“ míří ke zdi y = 0, kde jsou radiátor, okno, vypínač i umyvadlo. */
const FACING_DIR: Record<Facing, [number, number]> = {
  front: [1, 1],
  back: [0, -1],
  left: [-1, 1],
  right: [1, -1],
};
/** Gauč i křeslo jsou natočené do +gy. Gauč má hlubší sedák, tak si na něm postava sedne víc dopředu (m). */
const SEAT_DIR: [number, number] = [0, 1];
const SEATS = [
  { at: WAYPOINTS.sofaSeat, fwd: 0.13 },
  { at: WAYPOINTS.armchair, fwd: 0 },
];
const seatFwd = (x: number, y: number) => SEATS.find((s) => Math.hypot(s.at.x - x, s.at.y - y) < 0.5)?.fwd ?? 0;
/** Kolik metrů ujde jeden cyklus animace walk (24 snímků při 24 fps). */
const STRIDE_M = 0.98;

type PartGroup = 'blanket' | 'book' | 'towel' | 'cap' | 'arms' | 'tufts';
const PART_PREFIX: [string, PartGroup][] = [
  ['blanket', 'blanket'],
  ['book', 'book'],
  ['towel', 'towel'],
  ['shower_cap', 'cap'],
  ['m_sleeve', 'arms'],
  ['m_hand', 'arms'],
  ['m_thumb', 'arms'],
  ['hair_tuft', 'tufts'],
];

/**
 * 3D postavička Toník: model z Blenderu (public/assets/character/avatar.glb) s kostrou a akcemi pro všechny pózy.
 * Hloubku řeší depth buffer podkladu, takže se sama schová za nábytek. Výraz obličeje je textura z plátna.
 */
export class Avatar3D {
  root = new THREE.Group();
  shadow: THREE.Mesh;
  private mixer?: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = '';
  private mats = new Map<string, THREE.MeshLambertMaterial>();
  private face = new FaceCanvas();
  private parts: Record<PartGroup, THREE.Object3D[]> = { blanket: [], book: [], towel: [], cap: [], arms: [], tufts: [] };
  private yaw = Math.atan2(...SEAT_DIR);
  private light = 1;
  private last: { x: number; y: number } | null = null;

  constructor() {
    const sc = document.createElement('canvas');
    sc.width = sc.height = 64;
    const ctx = sc.getContext('2d')!;
    const grd = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    grd.addColorStop(0, 'rgba(40,30,25,1)');
    grd.addColorStop(1, 'rgba(40,30,25,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.62),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, opacity: 0.3 }),
    );
    this.shadow.renderOrder = 5;
  }

  async load(url: string) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;
    // glTF je Y-up, scéna je Z-up jako Blender
    model.rotation.x = Math.PI / 2;
    this.root.add(model);
    model.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const name = (o.material as THREE.Material).name;
      o.material = name === 'face' ? this.faceMaterial() : this.material(name);
      o.frustumCulled = false;
      const group = PART_PREFIX.find(([p]) => o.name.startsWith(p))?.[1];
      if (group) this.parts[group].push(o);
    });
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
  }

  private material(name: string) {
    let m = this.mats.get(name);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color: COLORS[name] ?? 0xff00ff });
      this.mats.set(name, m);
    }
    return m;
  }

  private tint(name: string, hex: number) {
    const m = this.material(name);
    m.color.setHex(hex);
    m.emissive.setHex(hex).multiplyScalar(SELF_LIT * this.light);
  }

  /** Ztlumení vlastního svitu při setmění scény (1 = plné světlo). */
  setLight(k: number) {
    this.light = k;
  }

  private faceMaterial() {
    return new THREE.MeshBasicMaterial({
      map: this.face.tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  }

  private play(name: string) {
    if (name === this.current) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.actions.get(this.current);
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (prev) prev.crossFadeTo(next, 0.25, false);
    this.current = name;
  }

  update(m: CharacterModel, now: number, dt: number) {
    if (!this.mixer) return;
    const seated = SEATED.has(m.pose);

    // rychlost a směr pohybu z posunu v mřížce
    let dx = 0;
    let dy = 0;
    if (this.last) {
      dx = m.x - this.last.x;
      dy = m.y - this.last.y;
    }
    this.last = { x: m.x, y: m.y };
    const speed = (Math.hypot(dx, dy) * TILE_M) / Math.max(dt / 1000, 1e-3);

    this.play(m.moving ? 'walk' : CLIP[m.pose]);
    const walk = this.actions.get('walk');
    if (walk && m.moving) walk.setEffectiveTimeScale(Math.min(3, Math.max(0.6, speed / STRIDE_M)));
    this.mixer.update(dt / 1000);

    const dir = m.moving && Math.hypot(dx, dy) > 1e-5 ? [dx, dy] : seated ? SEAT_DIR : FACING_DIR[m.facing];
    const target = Math.atan2(dir[0], dir[1]);
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt / 70);

    let hop = 0;
    if (m.hopStart >= 0) hop = Math.sin(Math.min(1, (now - m.hopStart) / 450) * Math.PI) * 0.26;
    const shiver = m.flags.has('shiver') ? Math.sin(now / 22) * 0.012 : 0;
    const fwd = seated ? seatFwd(m.x, m.y) / TILE_M : 0;
    const gx = m.x + SEAT_DIR[0] * fwd;
    const gy = m.y + SEAT_DIR[1] * fwd;
    this.root.position.set(gx * TILE_M + shiver, -gy * TILE_M + shiver, FLOOR_M + hop);
    this.root.rotation.z = this.yaw;

    this.shadow.position.set(gx * TILE_M, -gy * TILE_M, FLOOR_M + 0.004);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = hop > 0.2 ? 0.13 : seated ? 0.2 : 0.32;

    this.dress(m);
    this.face.update(m.expression, now);
  }

  /** Barvy a doplňky podle pózy, výrazu a příznaků. */
  private dress(m: CharacterModel) {
    let skin = SKIN;
    if (m.flags.has('shiver') || m.expression === 'cold') skin = mix(SKIN, 0xc4dcff, 0.4);
    if (m.flags.has('sweat') || m.expression === 'hot') skin = mix(SKIN, 0xff9c8a, 0.3);
    this.tint('skin', skin);
    this.tint('hair', m.flags.has('wet') ? mix(COLORS.hair, 0x000000, 0.35) : COLORS.hair);
    const shower = m.pose === 'shower';
    for (const c of CLOTHES) this.tint(c, shower ? skin : COLORS[c]);
    for (const c of ['blanket', 'book', 'paper', 'towel', 'cap']) this.tint(c, COLORS[c]);

    const cap = m.flags.has('showerCap');
    const show = (g: PartGroup, on: boolean) => this.parts[g].forEach((o) => (o.visible = on));
    show('blanket', m.pose === 'blanket');
    show('arms', m.pose !== 'blanket');
    show('book', m.pose === 'read');
    show('towel', shower);
    show('cap', cap);
    show('tufts', !cap);
  }
}
