import { EDGES, WAYPOINTS, WaypointId } from '../../config/layout';

const adj = new Map<WaypointId, WaypointId[]>();
for (const [a, b] of EDGES) {
  if (!adj.has(a)) adj.set(a, []);
  if (!adj.has(b)) adj.set(b, []);
  adj.get(a)!.push(b);
  adj.get(b)!.push(a);
}

/** Nejkratší cesta po navigačním grafu (BFS – graf je malý). */
export function findPath(from: WaypointId, to: WaypointId): WaypointId[] {
  if (from === to) return [from];
  const prev = new Map<WaypointId, WaypointId>();
  const queue: WaypointId[] = [from];
  const seen = new Set<WaypointId>([from]);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const n of adj.get(cur) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        prev.set(n, cur);
        queue.push(n);
      }
    }
  }
  if (!prev.has(to)) return [from, to];
  const path: WaypointId[] = [to];
  let c = to;
  while (c !== from) {
    c = prev.get(c)!;
    path.unshift(c);
  }
  return path;
}

export function wp(id: WaypointId) {
  return WAYPOINTS[id];
}
