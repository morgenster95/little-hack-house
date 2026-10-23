import { useGameStore } from '../stores/gameStore';
import { getEngine } from './GameCanvas';

function comfortFace(c: number) {
  if (c > 75) return '😊';
  if (c > 50) return '🙂';
  if (c > 30) return '😕';
  if (c > 12) return '😣';
  return '😫';
}

export function TopBar() {
  const phase = useGameStore((s) => s.phase);
  const comfort = useGameStore((s) => s.comfort);
  const activity = useGameStore((s) => s.activity);
  const sfx = useGameStore((s) => s.sfx);
  const music = useGameStore((s) => s.music);
  const setSfx = useGameStore((s) => s.setSfx);
  const setMusic = useGameStore((s) => s.setMusic);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          <svg viewBox="0 0 64 64" width="30" height="30">
            <polygon points="32,6 58,19 58,45 32,58 6,45 6,19" fill="#f8dfcb" stroke="#5b4335" strokeWidth="3" strokeLinejoin="round" />
            <polygon points="32,32 58,19 58,45 32,58" fill="#eebba3" />
            <polygon points="32,32 6,19 6,45 32,58" fill="#d3ece5" />
            <polygon points="32,6 58,19 32,32 6,19" fill="#ebc193" stroke="#5b4335" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="32" cy="19" r="7" fill="#4fb3a5" stroke="#fff" strokeWidth="2" />
          </svg>
        </span>
        <span className="brand-name">
          Little <b>Hack</b> House
        </span>
      </div>

      {phase === 'play' && (
        <div className="status-strip">
          <div className="comfort" title="Pohoda obyvatele">
            <span className="comfort-face">{comfortFace(comfort)}</span>
            <div className="comfort-bar">
              <div className="comfort-fill" style={{ width: `${comfort}%`, background: comfort > 50 ? 'var(--mint)' : comfort > 25 ? 'var(--sun)' : 'var(--coral)' }} />
            </div>
          </div>
          <div className="activity" key={activity}>
            {activity}
          </div>
        </div>
      )}

      <div className="tools">
        <button className="icon-btn hide-mobile" onClick={() => getEngine()?.renderer.zoomBy(1.2)} aria-label="Přiblížit">
          ＋
        </button>
        <button className="icon-btn hide-mobile" onClick={() => getEngine()?.renderer.zoomBy(1 / 1.2)} aria-label="Oddálit">
          －
        </button>
        <button className="icon-btn" onClick={() => getEngine()?.renderer.resetView()} aria-label="Vycentrovat scénu" title="Vycentrovat">
          ⌖
        </button>
        <button className={`icon-btn ${sfx ? '' : 'off'}`} onClick={() => setSfx(!sfx)} aria-label="Zvuky" title="Zvuky">
          {sfx ? '🔊' : '🔈'}
        </button>
        <button className={`icon-btn ${music ? '' : 'off'}`} onClick={() => setMusic(!music)} aria-label="Hudba" title="Hudba">
          ♫
        </button>
      </div>
    </header>
  );
}
