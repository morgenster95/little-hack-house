import * as THREE from 'three';
import { TILE_M } from '../space';

/** Pozice v mřížce + výška v metrech → bod ve 3D scéně. */
export const at = (gx: number, gy: number, z: number) => new THREE.Vector3(gx * TILE_M, -gy * TILE_M, z);

/** Rovina natočená do místnosti (normála −Y), tj. na zadní stěnu nebo čelo zařízení. */
export function facingRoom(o: THREE.Object3D) {
  o.rotation.x = Math.PI / 2;
  return o;
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Svítící displej: plátno → textura na rovině. Překresluje se jen při změně obsahu. */
export class Screen {
  canvas = document.createElement('canvas');
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  mesh: THREE.Mesh;
  private key = '';

  constructor(w: number, h: number, pxW: number, pxH: number, lit = true) {
    this.canvas.width = pxW;
    this.canvas.height = pxH;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.NoColorSpace;
    this.tex.anisotropy = 4;
    const mat = lit
      ? new THREE.MeshBasicMaterial({ map: this.tex, transparent: true })
      : new THREE.MeshLambertMaterial({ map: this.tex, transparent: true });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  }

  draw(key: string, fn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
    if (key === this.key) return;
    this.key = key;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    fn(this.ctx, this.canvas.width, this.canvas.height);
    this.tex.needsUpdate = true;
  }
}

export interface DisplayState {
  text: string;
  color: number;
  bg: number;
  led: number;
}

export function drawDisplay(s: DisplayState) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    rounded(ctx, 0, 0, w, h, 22);
    ctx.fillStyle = hex(s.bg);
    ctx.fill();
    ctx.fillStyle = hex(s.color);
    ctx.font = `800 ${Math.round(h * 0.56)}px Nunito, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = hex(s.color);
    ctx.shadowBlur = 14;
    ctx.fillText(s.text, w / 2 - 10, h / 2 + 4);
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(w - 24, 24, 9, 0, Math.PI * 2);
    ctx.fillStyle = hex(s.led);
    ctx.fill();
  };
}

/**
 * Živé 3D prvky zařízení, které se mění podle stavu hry
 * (chytrá vs. běžná varianta, displeje). Zbytek domu je v předrenderovaném podkladu.
 */
export class Props3D {
  boilerSmart = new THREE.Group();
  boilerPlain = new THREE.Group();
  thermoSmart = new THREE.Group();
  thermoPlain = new THREE.Group();
  lampSmart = new THREE.Group();
  private boilerScreen = new Screen(0.23, 0.13, 256, 148);
  private thermoScreen = new Screen(0.17, 0.095, 256, 144);

  constructor(private scene: THREE.Scene) {
    const white = new THREE.MeshLambertMaterial({ color: 0xf7f6f3 });
    const graphite = new THREE.MeshLambertMaterial({ color: 0x3b3e44 });
    const led = new THREE.MeshBasicMaterial({ color: 0x4d86ff, side: THREE.DoubleSide });

    // bojler – chytrý: panel s displejem na plášti válce, natočený k divákovi
    const R = 0.23;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.16), graphite);
    panel.position.set(0, -R + 0.006, 0);
    const bs = facingRoom(this.boilerScreen.mesh);
    bs.position.set(0, -R - 0.0145, 0);
    this.boilerSmart.add(panel, bs);
    this.boilerSmart.position.copy(at(2.55, 0.42, 1.72));
    this.boilerSmart.rotation.z = Math.PI / 4;

    // bojler – běžný: analogový budík
    const gauge = new Screen(0.1, 0.1, 128, 128, false);
    gauge.draw('g', (ctx, w) => {
      const c = w / 2;
      ctx.beginPath();
      ctx.arc(c, c, c - 2, 0, Math.PI * 2);
      ctx.fillStyle = '#c9ced3';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c, c, c - 12, 0, Math.PI * 2);
      ctx.fillStyle = '#fbfbfa';
      ctx.fill();
      ctx.strokeStyle = '#7b8088';
      ctx.lineWidth = 4;
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * (c - 20), c + Math.sin(a) * (c - 20));
        ctx.lineTo(c + Math.cos(a) * (c - 30), c + Math.sin(a) * (c - 30));
        ctx.stroke();
      }
      ctx.strokeStyle = '#e0533d';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c + 30, c - 30);
      ctx.stroke();
    });
    const gm = facingRoom(gauge.mesh);
    gm.position.set(0, -R - 0.012, 0);
    this.boilerPlain.add(gm);
    this.boilerPlain.position.copy(this.boilerSmart.position);
    this.boilerPlain.rotation.z = Math.PI / 4;

    // termostat na stěně u radiátoru
    const tBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.14), white);
    tBody.position.copy(at(5.72, 0, 1.4)).setY(-0.0125);
    const ts = facingRoom(this.thermoScreen.mesh);
    ts.position.copy(at(5.72, 0, 1.4)).setY(-0.027);
    this.thermoSmart.add(tBody, ts);

    // běžné topení – jen ruční hlavice na radiátoru
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.075, 24), white);
    valve.rotation.x = Math.PI / 2;
    valve.position.copy(at(6.47, 0.11, 0.7));
    this.thermoPlain.add(valve);

    // chytré žárovky – modrý proužek pod stínidly
    const ring = (r: number, gx: number, gy: number, z: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.016, 48, 1, true), led);
      m.rotation.x = Math.PI / 2;
      m.position.copy(at(gx, gy, z));
      return m;
    };
    this.lampSmart.add(ring(0.213, 6.75, 0.45, 1.335), ring(0.132, 11.45, 1.75, 0.73));

    scene.add(this.boilerSmart, this.boilerPlain, this.thermoSmart, this.thermoPlain, this.lampSmart);
  }

  setBoilerDisplay(s: DisplayState) {
    this.boilerScreen.draw(JSON.stringify(s), drawDisplay(s));
  }

  setThermostatDisplay(s: DisplayState) {
    this.thermoScreen.draw(JSON.stringify(s), drawDisplay(s));
  }

  dispose() {
    this.scene.remove(this.boilerSmart, this.boilerPlain, this.thermoSmart, this.thermoPlain, this.lampSmart);
  }
}
