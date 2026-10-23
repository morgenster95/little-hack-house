import { Container, Graphics } from 'pixi.js';
import { GRID } from '../../config/layout';
import { box, circleOnX, circleOnZ, cylinder, iso, OUTLINE, pts, quadX, quadY, quadZ, shade } from './iso';
import { P } from './palette';

export interface SceneObject {
  node: Container;
  /** Hloubka pro izometrické řazení (≈ x + y předního bodu). */
  depth: number;
}

export interface HouseRefs {
  tvGlow: Graphics;
  windowClosed: Graphics;
  windowOpen: Graphics;
  breeze: Graphics;
}

const W = GRID.w;
const D = GRID.d;
const H = GRID.wallH;
const PX = GRID.partitionX;

function g() {
  return new Graphics();
}

/** Statické prostředí: podlahy, stěny, nábytek. Chytrá zařízení jsou v assets/devices. */
export function buildHouse(bg: Container, add: (o: SceneObject) => void): HouseRefs {
  // --- stín pod dioramatem ---
  const shadow = g();
  const c = iso(W / 2, D / 2, -30);
  shadow.ellipse(c.x, c.y + 24, 470, 150).fill({ color: 0x6b4b5e, alpha: 0.08 });
  shadow.ellipse(c.x, c.y + 14, 400, 120).fill({ color: 0x6b4b5e, alpha: 0.08 });
  bg.addChild(shadow);

  // --- deska ---
  const slab = g();
  box(slab, -0.25, -0.25, -18, W + 0.25, D + 0.25, 18, { top: P.slabTop, left: P.slabLeft, right: P.slabRight });
  // drobné kamínky / tráva na hraně
  for (let i = 0; i < 14; i++) {
    const x = 0.4 + i * 0.85;
    const p = iso(x, D, -6);
    slab.circle(p.x, p.y, 1.6).fill({ color: 0xffffff, alpha: 0.25 });
  }
  bg.addChild(slab);

  // --- podlahy ---
  const floor = g();
  quadZ(floor, 0, 0, PX, D, 0, P.tile);
  for (let x = 0.5; x < PX; x += 0.5) floor.moveTo(iso(x, 0).x, iso(x, 0).y).lineTo(iso(x, D).x, iso(x, D).y);
  for (let y = 0.5; y < D; y += 0.5) floor.moveTo(iso(0, y).x, iso(0, y).y).lineTo(iso(PX, y).x, iso(PX, y).y);
  floor.stroke({ width: 1, color: P.tileLine, alpha: 0.9 });
  quadZ(floor, PX, 0, W, D, 0, P.wood);
  for (let y = 0.5; y < D; y += 0.5) floor.moveTo(iso(PX, y).x, iso(PX, y).y).lineTo(iso(W, y).x, iso(W, y).y);
  floor.stroke({ width: 1, color: P.woodLine, alpha: 0.8 });
  // spáry prken
  for (let row = 0; row < D * 2; row++) {
    const y0 = row * 0.5;
    for (let x = PX + ((row * 1.37) % 2.2) + 0.3; x < W; x += 2.2) {
      floor.moveTo(iso(x, y0).x, iso(x, y0).y).lineTo(iso(x, y0 + 0.5).x, iso(x, y0 + 0.5).y);
    }
  }
  floor.stroke({ width: 1, color: P.woodLine, alpha: 0.7 });
  // práh
  quadZ(floor, PX, 2.55, PX + 0.2, 3.65, 0.5, shade(P.wood, 0.85));
  bg.addChild(floor);

  // --- stěny ---
  const walls = g();
  // levá stěna (koupelna)
  quadX(walls, 0, 0, D, 0, H, P.wallBath);
  quadX(walls, 0, 0, D, 0, 56, P.wallBathLow);
  for (let y = 0.45; y < D; y += 0.45) walls.moveTo(iso(0, y, 0).x, iso(0, y, 0).y).lineTo(iso(0, y, 56).x, iso(0, y, 56).y);
  for (let z = 14; z < 56; z += 14) walls.moveTo(iso(0, 0, z).x, iso(0, 0, z).y).lineTo(iso(0, D, z).x, iso(0, D, z).y);
  walls.stroke({ width: 1, color: shade(P.wallBathLow, 0.9), alpha: 0.8 });
  // zadní stěna – koupelna
  quadY(walls, 0, 0, PX, 0, H, P.wallBath);
  quadY(walls, 0, 0, PX, 0, 56, P.wallBathLow);
  for (let x = 0.45; x < PX; x += 0.45) walls.moveTo(iso(x, 0, 0).x, iso(x, 0, 0).y).lineTo(iso(x, 0, 56).x, iso(x, 0, 56).y);
  for (let z = 14; z < 56; z += 14) walls.moveTo(iso(0, 0, z).x, iso(0, 0, z).y).lineTo(iso(PX, 0, z).x, iso(PX, 0, z).y);
  walls.stroke({ width: 1, color: shade(P.wallBathLow, 0.9), alpha: 0.8 });
  // zadní stěna – obývák
  quadY(walls, 0, PX, W, 0, H, P.wallLiving);
  quadY(walls, 0, PX, W, 0, 44, P.wallLivingLow);
  quadY(walls, 0, PX, W, 44, 48, P.trim);
  // jemné tapetové tečky
  for (let x = PX + 0.35; x < W; x += 0.55) {
    for (let z = 62; z < H - 6; z += 22) {
      const p = iso(x + ((z / 22) % 2) * 0.27, 0, z);
      walls.circle(p.x, p.y, 1.4).fill({ color: 0xffffff, alpha: 0.55 });
    }
  }
  // lišty
  quadX(walls, 0.001, 0, D, 0, 5, P.trim);
  quadY(walls, 0.001, 0, W, 0, 5, P.trim);
  // koruna stěn
  quadZ(walls, -0.25, -0.25, W, 0, H, P.wallTop, 1, true);
  quadZ(walls, -0.25, 0, 0, D, H, P.wallTop, 1, true);
  quadX(walls, W, -0.25, 0, 0, H, P.wallSide, 1, true);
  quadY(walls, D, -0.25, 0, 0, H, P.wallSide, 1, true);
  // spoj místností
  walls.moveTo(iso(PX + 0.1, 0, 0).x, iso(PX + 0.1, 0, 0).y).lineTo(iso(PX + 0.1, 0, H).x, iso(PX + 0.1, 0, H).y);
  walls.stroke({ width: 2, color: P.trim, alpha: 0.9 });
  // vnitřní obrys
  walls.moveTo(iso(0, D, 0).x, iso(0, D, 0).y).lineTo(iso(0, 0, 0).x, iso(0, 0, 0).y).lineTo(iso(W, 0, 0).x, iso(W, 0, 0).y);
  walls.stroke({ ...OUTLINE, alpha: 0.3 });
  bg.addChild(walls);

  // --- dekorace na stěnách (stále v pozadí) ---
  const wallDeco = g();
  // obraz nad gaučem
  quadY(wallDeco, 0, 7.75, 9.25, 78, 124, P.woodDark, 1, true);
  quadY(wallDeco, 0, 7.82, 9.18, 82, 120, 0xfdf2e0);
  wallDeco.poly(pts([[7.85, 0, 84], [8.35, 0, 108], [8.7, 0, 94], [9.0, 0, 112], [9.15, 0, 84]])).fill(0x8fbfa3);
  const sun = iso(8.25, 0, 110);
  wallDeco.circle(sun.x, sun.y, 5).fill(0xf2a65a);
  // poličky v koupelně
  box(wallDeco, 0, 3.1, 96, 0.3, 1.1, 4, { top: P.woodMid });
  box(wallDeco, 0.05, 3.25, 100, 0.18, 0.18, 16, { top: 0xf2a6a0 });
  box(wallDeco, 0.05, 3.6, 100, 0.18, 0.15, 11, { top: 0x9fd3e6 });
  box(wallDeco, 0.05, 3.9, 100, 0.18, 0.18, 14, { top: 0xf5cf8e });
  // zrcadlo nad umyvadlem
  quadY(wallDeco, 0, 3.12, 4.08, 70, 120, P.white, 1, true);
  quadY(wallDeco, 0, 3.2, 4.0, 74, 116, 0xcbe9f2);
  wallDeco.poly(pts([[3.3, 0, 110], [3.45, 0, 110], [3.25, 0, 86], [3.2, 0, 86]])).fill({ color: 0xffffff, alpha: 0.7 });
  // vypínač
  quadY(wallDeco, 0, 4.82, 5.02, 66, 82, P.white, 1, true);
  quadY(wallDeco, 0, 4.88, 4.96, 71, 77, 0xd8cfc4);
  bg.addChild(wallDeco);

  // --- okno (dva stavy) ---
  const win = g();
  quadY(win, 0, 9.85, 11.55, 50, 126, P.white, 1, true);
  quadY(win, 0, 9.95, 11.45, 56, 120, P.sky);
  const cl = iso(10.4, 0, 104);
  win.ellipse(cl.x, cl.y, 12, 5).fill(P.cloud);
  win.ellipse(cl.x + 9, cl.y - 3, 9, 5).fill(P.cloud);
  const hill = pts([[9.95, 0, 56], [10.5, 0, 70], [11.0, 0, 64], [11.45, 0, 74], [11.45, 0, 56]]);
  win.poly(hill).fill(0x9ccc8f);
  bg.addChild(win);
  const windowClosed = g();
  quadY(windowClosed, 0, 9.95, 11.45, 56, 120, 0xffffff, 0.18);
  quadY(windowClosed, 0, 10.67, 10.73, 56, 120, P.white);
  quadY(windowClosed, 0, 9.95, 11.45, 86, 90, P.white);
  windowClosed.poly(pts([[10.05, 0, 112], [10.2, 0, 112], [10.1, 0, 94], [9.98, 0, 94]])).fill({ color: 0xffffff, alpha: 0.6 });
  bg.addChild(windowClosed);
  const windowOpen = g();
  quadX(windowOpen, 9.95, 0, 0.62, 56, 120, P.white, 1, true);
  quadX(windowOpen, 9.95, 0.05, 0.57, 60, 116, 0xdff3fa, 0.9);
  quadX(windowOpen, 11.45, 0, 0.62, 56, 120, P.white, 1, true);
  quadX(windowOpen, 11.45, 0.05, 0.57, 60, 116, 0xdff3fa, 0.9);
  windowOpen.visible = false;
  const breeze = g();
  for (let i = 0; i < 3; i++) {
    const a = iso(10.2 + i * 0.35, 0.4 + i * 0.2, 100 - i * 14);
    breeze.moveTo(a.x, a.y).bezierCurveTo(a.x + 10, a.y + 6, a.x + 20, a.y - 4, a.x + 32, a.y + 4);
  }
  breeze.stroke({ width: 2, color: 0xffffff, alpha: 0.85, cap: 'round' });
  breeze.visible = false;
  // parapet + závěsy
  const sill = g();
  box(sill, 9.8, 0, 46, 1.8, 0.18, 5, { top: P.white });
  quadY(sill, 0.02, 9.55, 9.92, 36, 132, P.curtain, 1, true);
  quadY(sill, 0.02, 11.48, 11.85, 36, 132, P.curtain, 1, true);
  for (const x of [9.67, 9.8, 11.6, 11.73]) sill.moveTo(iso(x, 0.02, 132).x, iso(x, 0.02, 132).y).lineTo(iso(x, 0.02, 36).x, iso(x, 0.02, 36).y);
  sill.stroke({ width: 1, color: shade(P.curtain, 0.85) });
  box(sill, 9.45, 0, 134, 2.5, 0.06, 3, { top: P.woodDark }, false);
  add({ node: windowOpen, depth: 10.5 });
  add({ node: sill, depth: 10.6 });
  add({ node: breeze, depth: 12 });

  // --- koupelna ---
  // sprchový kout: vanička + baterie
  const showerBase = g();
  box(showerBase, 0, 0, 0, 1.8, 1.8, 7, { top: P.white });
  quadZ(showerBase, 0.15, 0.15, 1.65, 1.65, 7.2, 0xe9f4f6);
  circleOnZ(showerBase, 0.9, 0.9, 7.3, 0.07).fill(0x9aa6ad);
  // trubka + hlavice
  const pipeB = iso(0, 0.9, 20);
  const pipeT = iso(0, 0.9, 128);
  showerBase.moveTo(pipeB.x, pipeB.y).lineTo(pipeT.x, pipeT.y).stroke({ width: 3, color: P.metal });
  const arm = iso(0.45, 0.9, 128);
  showerBase.moveTo(pipeT.x, pipeT.y).lineTo(arm.x, arm.y).stroke({ width: 3, color: P.metal });
  showerBase.ellipse(arm.x, arm.y + 2, 9, 4).fill(0xb7c0c5).stroke(OUTLINE);
  const tap = iso(0, 0.9, 62);
  showerBase.roundRect(tap.x - 5, tap.y - 3, 10, 6, 3).fill(0xb7c0c5);
  add({ node: showerBase, depth: 0.5 });
  // sklo
  const glass = g();
  quadY(glass, 1.8, 0, 0.75, 7, 128, P.glass, 0.25);
  quadX(glass, 1.8, 0, 1.8, 7, 128, P.glass, 0.25);
  {
    const a = iso(0, 1.8, 128);
    const b = iso(1.8, 1.8, 128);
    const c = iso(1.8, 0, 128);
    glass.moveTo(a.x, a.y).lineTo(b.x, b.y).lineTo(c.x, c.y).stroke({ width: 2.5, color: P.metal, join: 'round' });
  }
  for (const [x, y] of [[0.75, 1.8], [1.8, 1.8], [1.8, 0]] as [number, number][]) {
    glass.moveTo(iso(x, y, 7).x, iso(x, y, 7).y).lineTo(iso(x, y, 128).x, iso(x, y, 128).y);
  }
  glass.stroke({ width: 2.5, color: P.metal });
  glass.poly(pts([[1.8, 0.3, 110], [1.8, 0.5, 110], [1.8, 1.0, 40], [1.8, 0.8, 40]])).fill({ color: 0xffffff, alpha: 0.35 });
  add({ node: glass, depth: 3.6 });

  // umyvadlo
  const sink = g();
  box(sink, 3.45, 0.1, 0, 0.3, 0.3, 44, { top: P.white });
  box(sink, 3.1, 0, 44, 1.0, 0.6, 12, { top: P.white });
  quadZ(sink, 3.22, 0.1, 3.98, 0.5, 56.2, 0xd8ecf0);
  const fa = iso(3.6, 0.05, 66);
  sink.roundRect(fa.x - 2, fa.y - 2, 4, 10, 2).fill(P.metal);
  add({ node: sink, depth: 3.8 });

  // pračka (zatím běžná)
  const washer = g();
  box(washer, 0.05, 3.05, 0, 0.9, 0.95, 60, { top: P.white });
  quadZ(washer, 0.1, 3.1, 0.9, 3.35, 60.2, 0xe2ddd6);
  circleOnX(washer, 0.95, 3.52, 30, 0.3).fill(0xdfe6ea).stroke(OUTLINE);
  circleOnX(washer, 0.95, 3.52, 30, 0.21).fill(0x9fc7d8);
  const knob = iso(0.95, 3.85, 52);
  washer.circle(knob.x, knob.y, 2.5).fill(0xbfb8ae);
  add({ node: washer, depth: 3.6 });

  // koupelnová předložka
  const mat = g();
  quadZ(mat, 1.0, 2.1, 2.2, 2.95, 0.6, 0xf3b3ac, 1, true);
  quadZ(mat, 1.12, 2.2, 2.08, 2.85, 0.7, 0xf7cbc5);
  bg.addChild(mat);

  // koš na prádlo
  const basket = g();
  cylinder(basket, 3.9, 6.2, 0.32, 0, 34, 0xdcb78a);
  const bt = iso(3.9, 6.2, 34);
  basket.ellipse(bt.x, bt.y - 3, 10, 5).fill(0xfef6ea);
  add({ node: basket, depth: 10.1 });

  // --- přepážka s průchodem (nízká, aby bylo vidět do koupelny) ---
  const segs: [number, number][] = [[0, 1], [1, 2], [2, 2.55], [3.65, 4.65], [4.65, 5.65], [5.65, 6.4], [6.4, 7]];
  for (const [y0, y1] of segs) {
    const s = g();
    box(s, PX, y0, 0, 0.2, y1 - y0, 34, { top: P.wallTop, left: P.wallSide, right: P.wallLivingLow }, false);
    s.poly(pts([[PX, y0, 34], [PX + 0.2, y0, 34], [PX + 0.2, y1, 34], [PX, y1, 34]])).stroke({ ...OUTLINE, alpha: 0.3 });
    add({ node: s, depth: PX + y0 });
  }
  for (const y of [2.5, 3.65]) {
    const post = g();
    box(post, PX - 0.02, y, 0, 0.24, 0.1, 42, { top: P.woodMid });
    add({ node: post, depth: PX + y + 0.05 });
  }

  // --- obývák ---
  // koberec
  const rug = g();
  quadZ(rug, 6.9, 1.55, 10.4, 4.95, 0.5, P.rug, 1, true);
  quadZ(rug, 7.15, 1.8, 10.15, 4.7, 0.6, P.rugInner);
  for (let x = 7.4; x < 10.1; x += 0.5) {
    for (let y = 2.0; y < 4.6; y += 0.5) {
      const p = iso(x, y, 0.7);
      rug.ellipse(p.x, p.y, 2.2, 1.1).fill({ color: P.rugDots, alpha: 0.9 });
    }
  }
  bg.addChild(rug);

  // gauč
  const sofa = g();
  box(sofa, 7.25, 0, 0, 2.5, 0.32, 48, { top: P.sofa });
  box(sofa, 7.25, 0.3, 0, 2.5, 0.75, 20, { top: P.sofa });
  box(sofa, 7.4, 0.32, 20, 1.05, 0.68, 8, { top: P.cushion });
  box(sofa, 8.55, 0.32, 20, 1.05, 0.68, 8, { top: P.cushion });
  box(sofa, 7.05, 0, 0, 0.3, 1.1, 32, { top: P.sofaDark });
  box(sofa, 9.7, 0, 0, 0.3, 1.1, 32, { top: P.sofaDark });
  box(sofa, 7.42, 0.32, 26, 0.45, 0.14, 22, { top: 0x86b59b });
  box(sofa, 9.15, 0.32, 26, 0.45, 0.14, 22, { top: 0xf2a6a0 });
  add({ node: sofa, depth: 8.9 });

  // konferenční stolek
  const table = g();
  for (const [x, y] of [[7.9, 2.3], [9.05, 2.3], [7.9, 2.85], [9.05, 2.85]] as [number, number][]) {
    box(table, x, y, 0, 0.08, 0.08, 20, { top: P.woodDark }, false);
  }
  box(table, 7.8, 2.2, 20, 1.4, 0.8, 5, { top: P.woodMid });
  cylinder(table, 8.2, 2.5, 0.09, 25, 37, 0xf7f3ee);
  box(table, 8.6, 2.45, 25, 0.45, 0.32, 3, { top: 0x7aa6c9 });
  add({ node: table, depth: 11 });

  // TV skříňka + televize (zezadu)
  const tv = g();
  box(tv, 7.6, 5.4, 0, 2.0, 0.6, 26, { top: P.woodDark });
  quadY(tv, 6.0, 7.75, 8.55, 6, 20, shade(P.woodDark, 0.75), 1, true);
  quadY(tv, 6.0, 8.65, 9.45, 6, 20, shade(P.woodDark, 0.75), 1, true);
  box(tv, 8.4, 5.6, 26, 0.4, 0.2, 6, { top: 0x4a4658 });
  box(tv, 7.85, 5.62, 32, 1.5, 0.12, 52, { top: 0x4a4658, left: 0x3b3848, right: 0x2f2d3a });
  const tvGlow = g();
  tvGlow.poly(pts([[7.85, 5.62, 34], [9.35, 5.62, 34], [9.8, 1.4, 0], [7.2, 1.4, 0]])).fill({ color: 0x9fd8ff, alpha: 0.13 });
  tvGlow.visible = false;
  bg.addChild(tvGlow);
  // květina na skříňce
  cylinder(tv, 9.4, 5.75, 0.08, 26, 36, P.pot);
  const fl = iso(9.4, 5.75, 44);
  tv.circle(fl.x - 3, fl.y, 4).fill(P.plant);
  tv.circle(fl.x + 3, fl.y - 2, 4).fill(P.plantDark);
  add({ node: tv, depth: 14.3 });

  // křeslo
  const chair = g();
  box(chair, 10.8, 2.4, 0, 1.0, 1.0, 18, { top: P.mustard });
  box(chair, 10.8, 2.4, 0, 1.0, 0.25, 46, { top: shade(P.mustard, 0.95) });
  box(chair, 10.8, 2.4, 0, 0.18, 1.0, 30, { top: shade(P.mustard, 0.9) });
  box(chair, 11.62, 2.4, 0, 0.18, 1.0, 30, { top: shade(P.mustard, 0.9) });
  box(chair, 11.0, 2.65, 18, 0.6, 0.65, 6, { top: 0xf9dfa6 });
  add({ node: chair, depth: 14.0 });

  // velká květina
  const plant = g();
  cylinder(plant, 11.45, 6.35, 0.28, 0, 30, P.pot);
  const pc = iso(11.45, 6.35, 26);
  plant.moveTo(pc.x, pc.y).lineTo(pc.x - 4, pc.y - 30).moveTo(pc.x, pc.y).lineTo(pc.x + 6, pc.y - 34).moveTo(pc.x, pc.y).lineTo(pc.x, pc.y - 46);
  plant.stroke({ width: 2.5, color: P.plantDark, cap: 'round' });
  const leaves: [number, number, number, number][] = [
    [-12, -14, 8, 0x5f9a62], [11, -16, 8, 0x6fa36e], [-3, -30, 9, 0x7db37b], [-15, -32, 7, 0x5f9a62], [12, -36, 7, 0x4f8350], [2, -48, 7, 0x7db37b],
  ];
  for (const [dx, dy, r, col] of leaves) plant.ellipse(pc.x + dx, pc.y + dy, r, r * 1.35).fill(col).stroke({ ...OUTLINE, alpha: 0.25 });
  add({ node: plant, depth: 17.7 });

  // malá stolička s rostlinkou v koupelně
  const bplant = g();
  cylinder(bplant, 4.28, 0.32, 0.13, 0, 18, 0xf7f3ee);
  const bp = iso(4.28, 0.32, 18);
  bplant.ellipse(bp.x - 4, bp.y - 8, 4, 8).fill(P.plant);
  bplant.ellipse(bp.x + 4, bp.y - 9, 4, 9).fill(P.plantDark);
  add({ node: bplant, depth: 4.6 });

  return { tvGlow, windowClosed, windowOpen, breeze };
}
