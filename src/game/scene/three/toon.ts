import * as THREE from 'three';

/**
 * Materiály živých 3D objektů (vysavač, kamera, dveře…). Podklad je „zapečený“ z Cycles a světla scény
 * jsou slabá, proto má každý materiál část barvy jako vlastní svit. Při setmění scény se svit ztlumí.
 */
const SELF_LIT = 0.55;
const registry: { m: THREE.MeshLambertMaterial; color: number; k: number }[] = [];
let light = 1;

export function toon(color: number, selfLit = SELF_LIT) {
  const m = new THREE.MeshLambertMaterial({ color });
  m.emissive.setHex(color).multiplyScalar(selfLit * light);
  registry.push({ m, color, k: selfLit });
  return m;
}

/** Změna barvy materiálu z toon() i s jeho svitem. */
export function retint(m: THREE.MeshLambertMaterial, color: number) {
  const r = registry.find((e) => e.m === m);
  m.color.setHex(color);
  if (r) {
    r.color = color;
    m.emissive.setHex(color).multiplyScalar(r.k * light);
  }
}

/** Svítící prvek (LED, displej) – nezávislý na světle scény. */
export function glowMaterial(color: number) {
  return new THREE.MeshBasicMaterial({ color });
}

export function setToonLight(k: number) {
  light = k;
  for (const e of registry) e.m.emissive.setHex(e.color).multiplyScalar(e.k * k);
}

/** Měkký kruhový stín na podlahu. */
export function blobShadow(size: number, opacity = 0.3) {
  const sc = document.createElement('canvas');
  sc.width = sc.height = 64;
  const ctx = sc.getContext('2d')!;
  const grd = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  grd.addColorStop(0, 'rgba(40,30,25,1)');
  grd.addColorStop(1, 'rgba(40,30,25,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, opacity }),
  );
  mesh.renderOrder = 5;
  return mesh;
}
