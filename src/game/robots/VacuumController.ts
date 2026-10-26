/**
 * Logika robotického vysavače v herní mřížce – nic nevykresluje.
 * Pozice (x, y) je střed robota, heading je směr jízdy (atan2(dx, dy), stejně jako natočení postavičky).
 */

export type VacuumAttack = 'normal' | 'chaos' | 'chase' | 'map';
type Phase = 'docked' | 'leave' | 'route' | 'free' | 'home';

/** Poloměr robota v dlaždicích (0,17 m). */
export const VACUUM_R = 0.26;
/** Nabíjecí stanice u příčky – robot k ní couvá čelem do −x. */
export const DOCK = { x: 5.1, y: 5.0 };
/** Volná podlaha obýváku pro volnou jízdu (středy robota). Pod konferenčním stolkem projede. */
const FLOOR = { x0: 5.0, x1: 10.4, y0: 1.62, y1: 5.15 };
/** Úklidové kolečko po obýváku (kolem gauče, křesla a televize). */
const ROUTE: [number, number][] = [
  [5.65, 5.0],
  [6.0, 5.9],
  [6.6, 5.0],
  [10.2, 5.1],
  [10.3, 3.6],
  [10.3, 1.75],
  [7.0, 1.75],
  [6.1, 1.7],
  [5.3, 2.6],
  [5.4, 4.2],
  [5.65, 5.0],
];
/** Jak dlouho stojí v doku mezi úklidy (ms). */
const DOCK_TIME = 26000;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export interface VacuumEvents {
  bump(): void;
}

export class VacuumController {
  x = DOCK.x;
  y = DOCK.y;
  heading = -Math.PI / 2;
  /** rychlost v dlaždicích za sekundu (pro animaci kartáčů) */
  speed = 0;
  phase: Phase = 'docked';
  /** 0…1 – kolik bytu už je zmapováno (útok map) */
  mapped = 0;
  /** stopa jízdy při mapování (body v mřížce) */
  trail: { x: number; y: number }[] = [];
  private attack: VacuumAttack = 'normal';
  private routeI = 0;
  private dockT = DOCK_TIME * 0.6;
  private turnT = 0;
  private goal = { x: 0, y: 0 };
  private orbit = 0;
  private lawnRow = 0;
  private lawnDir = 1;
  private approached = false;

  constructor(private ev: VacuumEvents) {}

  get docked() {
    return this.phase === 'docked';
  }

  update(dtMs: number, attack: VacuumAttack, smart: boolean, char: { x: number; y: number }) {
    const dt = Math.min(dtMs, 50) / 1000;
    if (attack !== this.attack) this.onAttack(attack);

    switch (this.phase) {
      case 'docked':
        this.speed = 0;
        this.dockT += dtMs;
        if (attack !== 'normal' || (smart && this.dockT > DOCK_TIME)) this.phase = 'leave';
        return;
      case 'leave':
        // vycouvat z doku
        if (this.drive(DOCK.x + 0.55, DOCK.y, 0.7, dt, true)) {
          this.phase = attack === 'normal' ? 'route' : 'free';
          this.routeI = 1;
          this.pickGoal(attack, char);
        }
        return;
      case 'route':
        if (attack !== 'normal') {
          this.phase = 'free';
          this.pickGoal(attack, char);
          return;
        }
        if (this.drive(ROUTE[this.routeI][0], ROUTE[this.routeI][1], 0.85, dt)) {
          this.routeI++;
          if (this.routeI >= ROUTE.length) this.goHome();
        }
        return;
      case 'home':
        if (attack !== 'normal') {
          this.phase = 'free';
          return;
        }
        // nájezd před dok, pak rovně dovnitř
        if (!this.approached) this.approached = this.drive(DOCK.x + 0.55, DOCK.y, 0.8, dt);
        else if (this.drive(DOCK.x, DOCK.y, 0.45, dt)) {
          this.phase = 'docked';
          this.dockT = 0;
          this.approached = false;
          this.heading = -Math.PI / 2;
        }
        return;
      case 'free':
        if (attack === 'normal') {
          this.goHome();
          return;
        }
        this.free(attack, dt, char);
    }
  }

  private onAttack(a: VacuumAttack) {
    this.attack = a;
    if (a === 'map') {
      this.mapped = 0;
      this.trail = [];
      this.lawnRow = 0;
      this.lawnDir = 1;
    }
    if (this.phase === 'free' && a === 'normal') this.goHome();
  }

  private goHome() {
    this.phase = 'home';
    this.approached = false;
  }

  private pickGoal(a: VacuumAttack, char: { x: number; y: number }) {
    if (a === 'chaos') {
      this.goal = { x: FLOOR.x0 + Math.random() * (FLOOR.x1 - FLOOR.x0), y: FLOOR.y0 + Math.random() * (FLOOR.y1 - FLOOR.y0) };
      this.turnT = 400 + Math.random() * 900;
    } else if (a === 'chase') {
      this.goal = { x: clamp(char.x, FLOOR.x0, FLOOR.x1), y: clamp(char.y, FLOOR.y0, FLOOR.y1) };
    } else if (a === 'map') {
      this.goal = this.lawnGoal();
    }
  }

  /** Systematické „sekání trávníku“ po řádcích – takhle robot kreslí mapu. */
  private lawnGoal() {
    const rows = 6;
    const y = FLOOR.y0 + ((FLOOR.y1 - FLOOR.y0) * this.lawnRow) / (rows - 1);
    return { x: this.lawnDir > 0 ? FLOOR.x1 : FLOOR.x0, y };
  }

  private free(a: VacuumAttack, dt: number, char: { x: number; y: number }) {
    if (a === 'chaos') {
      this.turnT -= dt * 1000;
      const arrived = this.drive(this.goal.x, this.goal.y, 2.6, dt, false, 9);
      if (arrived || this.turnT <= 0) {
        if (arrived) this.ev.bump();
        this.pickGoal(a, char);
      }
    } else if (a === 'chase') {
      const tx = clamp(char.x, FLOOR.x0, FLOOR.x1);
      const ty = clamp(char.y, FLOOR.y0, FLOOR.y1);
      const d = Math.hypot(tx - this.x, ty - this.y);
      if (d < 0.75) {
        // u cíle krouží a ťuká
        this.orbit += dt * 1.6;
        const ox = tx + Math.cos(this.orbit) * 0.55;
        const oy = clamp(ty + Math.sin(this.orbit) * 0.55, FLOOR.y0, FLOOR.y1);
        this.drive(ox, oy, 1.3, dt);
        if (Math.random() < dt * 0.6) this.ev.bump();
      } else this.drive(tx, ty, 1.7, dt);
    } else if (a === 'map') {
      if (this.drive(this.goal.x, this.goal.y, 0.75, dt)) {
        this.lawnDir *= -1;
        this.lawnRow = (this.lawnRow + 1) % 6;
        this.goal = this.lawnGoal();
      }
      this.mapped = Math.min(1, this.mapped + dt / 22);
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(last.x - this.x, last.y - this.y) > 0.2) {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 400) this.trail.shift();
      }
    }
  }

  /** Natočí se a dojede k bodu; vrací true po příjezdu. reverse = couvá. */
  private drive(tx: number, ty: number, speed: number, dt: number, reverse = false, turnRate = 4.5) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.04) {
      this.speed = 0;
      return true;
    }
    const want = Math.atan2(dx, dy) + (reverse ? Math.PI : 0);
    const diff = wrap(want - this.heading);
    this.heading = wrap(this.heading + clamp(diff, -turnRate * dt, turnRate * dt));
    // na místě se nejdřív natočí, pak jede
    const go = Math.abs(diff) < 0.6 ? 1 : Math.abs(diff) < 1.4 ? 0.35 : 0;
    const step = Math.min(d, speed * go * dt);
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
    this.speed = (step / Math.max(dt, 1e-3)) * (reverse ? -1 : 1);
    return d - step < 0.04;
  }
}
