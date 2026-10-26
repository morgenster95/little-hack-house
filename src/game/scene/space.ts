/**
 * Převody mezi herní mřížkou, izometrickými pixely (Pixi vrstva) a metry (3D scéna z Blenderu).
 * 1 dlaždice = TILE_M metrů; izometrie 2:1 odpovídá ortografické kameře
 * natočené o 60° kolem X a 45° kolem Z (stejně jako kamera v tools/blender/house.py).
 */
export const TILE_M = 0.65;
/** Izometrických pixelů na metr ve vodorovném směru kamery. */
export const PX_PER_M = 32 / (Math.SQRT1_2 * TILE_M);
/** Izometrických pixelů na metr výšky (svislá úsečka se zkrátí o cos 30°). */
export const ZPX_PER_M = PX_PER_M * Math.cos(Math.PI / 6);
/** Výška podlahy domu nad terénem (m). */
export const FLOOR_M = 0.06;

/** Metry výšky → z v izometrických pixelech (pro iso()). */
export const zpx = (m: number) => m * ZPX_PER_M;
