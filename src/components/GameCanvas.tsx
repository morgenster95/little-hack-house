import { useEffect, useRef } from 'react';
import { GameEngine } from '../game/engine/GameEngine';

let engine: GameEngine | null = null;
export const getEngine = () => engine;

/** Hostitel Pixi scény – engine vzniká jednou a žije po celou dobu běhu stránky. */
export function GameCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const e = new GameEngine();
    engine = e;
    e.mount(ref.current);
    return () => {
      e.destroy();
      if (engine === e) engine = null;
    };
  }, []);
  return <div className="game-canvas" ref={ref} />;
}
