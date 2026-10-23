/**
 * Pevné rozvržení domácnosti v izometrické mřížce (jednotky = dlaždice).
 * x roste doprava-dolů, y doleva-dolů. Výška z je v pixelech.
 */

export const GRID = { w: 12, d: 7, wallH: 150, partitionX: 4.5 };

export const ROOMS = {
  bathroom: { x0: 0, x1: 4.5, y0: 0, y1: 7 },
  living: { x0: 4.7, x1: 12, y0: 0, y1: 7 },
};

export type WaypointId =
  | 'shower'
  | 'bathMat'
  | 'sink'
  | 'bathCenter'
  | 'towel'
  | 'door'
  | 'livingEntry'
  | 'switch'
  | 'radiator'
  | 'sofaFront'
  | 'sofaSeat'
  | 'window'
  | 'armchairFront'
  | 'armchair'
  | 'livingMid'
  | 'front'
  | 'plant';

export const WAYPOINTS: Record<WaypointId, { x: number; y: number }> = {
  shower: { x: 0.9, y: 0.9 },
  bathMat: { x: 1.5, y: 2.5 },
  sink: { x: 3.55, y: 1.05 },
  bathCenter: { x: 2.6, y: 3.2 },
  towel: { x: 1.0, y: 5.4 },
  door: { x: 4.6, y: 3.1 },
  livingEntry: { x: 5.5, y: 3.1 },
  switch: { x: 4.98, y: 0.72 },
  radiator: { x: 5.75, y: 1.05 },
  sofaFront: { x: 8.5, y: 1.75 },
  sofaSeat: { x: 8.5, y: 0.7 },
  window: { x: 10.9, y: 1.1 },
  armchairFront: { x: 10.4, y: 4.0 },
  armchair: { x: 11.25, y: 3.0 },
  livingMid: { x: 6.3, y: 4.2 },
  front: { x: 9.0, y: 4.55 },
  plant: { x: 11.0, y: 5.7 },
};

export const EDGES: [WaypointId, WaypointId][] = [
  ['shower', 'bathMat'],
  ['bathMat', 'bathCenter'],
  ['sink', 'bathCenter'],
  ['towel', 'bathCenter'],
  ['bathCenter', 'door'],
  ['door', 'livingEntry'],
  ['livingEntry', 'switch'],
  ['switch', 'radiator'],
  ['livingEntry', 'livingMid'],
  ['radiator', 'sofaFront'],
  ['sofaFront', 'sofaSeat'],
  ['sofaFront', 'window'],
  ['livingMid', 'front'],
  ['front', 'armchairFront'],
  ['armchairFront', 'armchair'],
  ['front', 'plant'],
  ['armchairFront', 'window'],
];
