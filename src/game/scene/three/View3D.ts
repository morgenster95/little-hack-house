import * as THREE from 'three';
import { FLOOR_M, PX_PER_M, TILE_M, ZPX_PER_M } from '../space';
import { Props3D } from './props';

THREE.ColorManagement.enabled = false;

/** Popis podkladu vyrenderovaného v Blenderu (public/assets/scene/scene.json). */
export interface SceneInfo {
  width: number;
  height: number;
  /** obdélník obrázku v souřadnicích kamery (m) */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  depthMin: number;
  depthRange: number;
  /** P·view = hloubka z Cycles + depthOffset */
  depthOffset: number;
}

const CAM_DIST = 60;
const NEAR = 1;
const FAR = 140;

const overlayUniforms = () => ({
  overlayColor: { value: new THREE.Color(0x1a1540) },
  overlayAlpha: { value: 0 },
});

const OVERLAY_GLSL = /* glsl */ `
uniform vec3 overlayColor;
uniform float overlayAlpha;
vec3 applyOverlay(vec3 c) { return mix(c, overlayColor, overlayAlpha); }
`;

const backdropVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** Podklad zapisuje do depth bufferu hloubku z Blenderu – postava se tak schová za nábytek. */
const backdropFrag = /* glsl */ `
uniform sampler2D map;
uniform sampler2D depthMap;
uniform float depthMin;
uniform float depthRange;
uniform float depthOffset;
uniform float camDist;
uniform float near;
uniform float far;
${OVERLAY_GLSL}
varying vec2 vUv;
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.004) discard;
  vec3 d = texture2D(depthMap, vUv).rgb;
  float zn = (d.r * 65280.0 + d.g * 255.0) / 65535.0;
  float z = depthMin + zn * depthRange + depthOffset + camDist;
  gl_FragDepth = clamp((z - near) / (far - near), 0.0, 1.0);
  gl_FragColor = vec4(applyOverlay(c.rgb), c.a);
}`;

const spriteFrag = /* glsl */ `
uniform sampler2D map;
${OVERLAY_GLSL}
varying vec2 vUv;
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.01) discard;
  gl_FragColor = vec4(applyOverlay(c.rgb), c.a);
}`;

function loadTexture(url: string) {
  return new Promise<THREE.Texture>((resolve, reject) => new THREE.TextureLoader().load(url, resolve, undefined, reject));
}

/**
 * 3D vrstva scény: předrenderovaný dům z Blenderu + hloubka, živé displeje zařízení
 * a postavička jako svislý billboard (textura z Pixi plátna).
 * Kamera je sladěná s izometrickými pixely Pixi vrstvy, takže efekty nad scénou sedí.
 */
export class View3D {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, NEAR, FAR);
  props!: Props3D;
  info!: SceneInfo;
  /** jednotka „dopředu" od kamery do scény */
  view = new THREE.Vector3();
  private overlay = overlayUniforms();
  private ambient = new THREE.AmbientLight(0xffffff, 0.8);
  private sun = new THREE.DirectionalLight(0xfff1de, 0.9);
  private sprite?: { mesh: THREE.Mesh; shadow: THREE.Mesh; tex: THREE.CanvasTexture; w: number; h: number; footY: number };

  constructor(el: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    const c = this.renderer.domElement;
    c.style.position = 'absolute';
    c.style.inset = '0';
    c.style.pointerEvents = 'none';
    el.prepend(c);

    this.camera.quaternion.setFromEuler(new THREE.Euler(Math.PI / 3, 0, Math.PI / 4, 'ZYX'));
    this.view.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.camera.position.copy(this.view).multiplyScalar(-CAM_DIST);
    this.scene.add(this.camera);

    // světla jen pro drobné živé prvky (displeje, knoflíky) – podklad je „zapečený"
    this.sun.position.set(-0.24, -0.6, 0.77).multiplyScalar(10);
    this.scene.add(this.ambient, this.sun);
  }

  async load(baseUrl: string) {
    const [info, map, depth] = await Promise.all([
      fetch(`${baseUrl}scene.json`).then((r) => r.json() as Promise<SceneInfo>),
      loadTexture(`${baseUrl}scene.webp`),
      loadTexture(`${baseUrl}scene_depth.png`),
    ]);
    this.info = info;
    map.colorSpace = THREE.NoColorSpace;
    map.anisotropy = 4;
    depth.colorSpace = THREE.NoColorSpace;
    depth.magFilter = THREE.NearestFilter;
    depth.minFilter = THREE.NearestFilter;
    depth.generateMipmaps = false;

    const mat = new THREE.ShaderMaterial({
      vertexShader: backdropVert,
      fragmentShader: backdropFrag,
      transparent: true,
      uniforms: {
        map: { value: map },
        depthMap: { value: depth },
        depthMin: { value: info.depthMin },
        depthRange: { value: info.depthRange },
        depthOffset: { value: info.depthOffset },
        camDist: { value: CAM_DIST },
        near: { value: NEAR },
        far: { value: FAR },
        ...this.overlay,
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(info.x1 - info.x0, info.y1 - info.y0), mat);
    quad.position.set((info.x0 + info.x1) / 2, (info.y0 + info.y1) / 2, -CAM_DIST);
    quad.frustumCulled = false;
    quad.renderOrder = -10;
    this.camera.add(quad);

    this.props = new Props3D(this.scene);
  }

  /** Obdélník podkladu v izometrických pixelech Pixi vrstvy. */
  isoBounds() {
    const i = this.info;
    return { x: i.x0 * PX_PER_M, y: -i.y1 * PX_PER_M, w: (i.x1 - i.x0) * PX_PER_M, h: (i.y1 - i.y0) * PX_PER_M };
  }

  /** Sladí ortografickou kameru s transformací Pixi kamery (měřítko s, posun tx/ty). */
  setFrame(width: number, height: number, s: number, tx: number, ty: number) {
    this.renderer.setSize(width, height);
    const k = s * PX_PER_M;
    this.camera.left = -tx / k;
    this.camera.right = (width - tx) / k;
    this.camera.top = ty / k;
    this.camera.bottom = (ty - height) / k;
    this.camera.updateProjectionMatrix();
  }

  /** Barevný závoj přes celou scénu (tma, párty). Displeje svítí dál. */
  setOverlay(color: number, alpha: number) {
    this.overlay.overlayColor.value.setHex(color);
    this.overlay.overlayAlpha.value = alpha;
    const light = 1 - alpha * 0.85;
    this.ambient.intensity = 0.8 * light;
    this.sun.intensity = 0.9 * light;
  }

  /**
   * Billboard postavičky. Plátno má šířku w a výšku h (izometrické px),
   * chodidla jsou ve středu šířky na řádku footY.
   */
  attachSprite(canvas: HTMLCanvasElement, w: number, h: number, footY: number) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.ShaderMaterial({
      vertexShader: backdropVert,
      fragmentShader: spriteFrag,
      transparent: true,
      depthWrite: false,
      uniforms: { map: { value: tex }, ...this.overlay },
    });
    // svislá rovina natočená k divákovi; svislý metr = ZPX_PER_M px na obrazovce
    const geo = new THREE.PlaneGeometry(w / PX_PER_M, h / ZPX_PER_M);
    const mesh = new THREE.Mesh(geo, mat);
    const right = new THREE.Vector3(Math.SQRT1_2, Math.SQRT1_2, 0);
    const up = new THREE.Vector3(0, 0, 1);
    const normal = new THREE.Vector3().crossVectors(right, up);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
    mesh.renderOrder = 10;
    mesh.frustumCulled = false;
    // měkký stín na podlaze
    const sc = document.createElement('canvas');
    sc.width = sc.height = 64;
    const ctx = sc.getContext('2d')!;
    const grd = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    grd.addColorStop(0, 'rgba(40,30,25,1)');
    grd.addColorStop(1, 'rgba(40,30,25,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
    const shadowTex = new THREE.CanvasTexture(sc);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.62),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.2 }),
    );
    shadow.renderOrder = 5;
    this.scene.add(mesh, shadow);
    this.sprite = { mesh, shadow, tex, w, h, footY };
  }

  /** Postaví billboard na pozici v mřížce; bias (m) ho posune ke kameře, aby ho nezakryl např. sedák. */
  placeSprite(gx: number, gy: number, bias: number, shadowAlpha: number) {
    const s = this.sprite;
    if (!s) return;
    s.shadow.position.set(gx * TILE_M, -gy * TILE_M, FLOOR_M + 0.004);
    (s.shadow.material as THREE.MeshBasicMaterial).opacity = shadowAlpha * 1.6;
    const lift = (s.footY - s.h / 2) / ZPX_PER_M;
    s.mesh.position.set(gx * TILE_M, -gy * TILE_M, FLOOR_M + lift).addScaledVector(this.view, -bias);
    s.tex.needsUpdate = true;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material as THREE.Material & { uniforms?: Record<string, { value: unknown }> };
        for (const u of Object.values(m.uniforms ?? {})) if (u.value instanceof THREE.Texture) u.value.dispose();
        (m as THREE.MeshBasicMaterial).map?.dispose();
        m.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
