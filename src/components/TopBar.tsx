import { useGameStore } from '../stores/gameStore';
import { getEngine } from './GameCanvas';
import { Icon, Logo } from './Icon';

function comfortLabel(c: number) {
  if (c > 75) return 'v pohodě';
  if (c > 50) return 'v klidu';
  if (c > 30) return 'nervózní';
  if (c > 12) return 've stresu';
  return 'zoufalý';
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
        <span className="brand-mark">
          <Logo size={32} />
        </span>
        <span className="brand-name">
          Little <b>Hack</b> House
        </span>
      </div>

      {phase === 'play' && (
        <div className="status-strip">
          <div className="comfort" title="Pohoda obyvatele">
            <Icon name="pulse" size={16} className="comfort-icon" />
            <div className="comfort-text">
              <span>Pohoda</span>
              <b>{comfortLabel(comfort)}</b>
            </div>
            <div className="comfort-bar">
              <div className="comfort-fill" style={{ width: `${comfort}%`, background: comfort > 50 ? 'var(--protect)' : comfort > 25 ? 'var(--warn)' : 'var(--danger)' }} />
            </div>
          </div>
          <div className="activity" key={activity}>
            {activity}
          </div>
        </div>
      )}

      <div className="tools">
        <button className="icon-btn hide-mobile" onClick={() => getEngine()?.renderer.zoomBy(1.2)} aria-label="Přiblížit">
          <Icon name="plus" size={18} />
        </button>
        <button className="icon-btn hide-mobile" onClick={() => getEngine()?.renderer.zoomBy(1 / 1.2)} aria-label="Oddálit">
          <Icon name="minus" size={18} />
        </button>
        <button className="icon-btn" onClick={() => getEngine()?.renderer.resetView()} aria-label="Vycentrovat scénu" title="Vycentrovat">
          <Icon name="target" size={18} />
        </button>
        <button className={`icon-btn ${sfx ? '' : 'off'}`} onClick={() => setSfx(!sfx)} aria-label="Zvuky" title="Zvuky">
          <Icon name={sfx ? 'volume' : 'mute'} size={18} />
        </button>
        <button className={`icon-btn ${music ? '' : 'off'}`} onClick={() => setMusic(!music)} aria-label="Hudba" title="Hudba">
          <Icon name="music" size={18} />
        </button>
      </div>
    </header>
  );
}
