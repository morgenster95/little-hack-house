import * as THREE from 'three';
import { PX_PER_M } from '../space';
import { Avatar3D } from './Avatar3D';
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

function loadTexture(url: string) {
  return new Promise<THREE.Texture>((resolve, reject) => new THREE.TextureLoader().load(url, resolve, undefined, reject));
}

/**
 * 3D vrstva scény: předrenderovaný dům z Blenderu + hloubka, živé displeje zařízení
 * a 3D postavička (Avatar3D).
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
  avatar = new Avatar3D();

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

  async load(baseUrl: string, avatarUrl: string) {
    const [info, map, depth] = await Promise.all([
      fetch(`${baseUrl}scene.json`).then((r) => r.json() as Promise<SceneInfo>),
      loadTexture(`${baseUrl}scene.webp`),
      loadTexture(`${baseUrl}scene_depth.png`),
      this.avatar.load(avatarUrl),
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
    this.scene.add(this.avatar.root, this.avatar.shadow);
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
    this.avatar.setLight(light);
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
