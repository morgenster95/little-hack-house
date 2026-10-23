import { DEVICES } from '../config/devices';
import { audio } from '../game/engine/audio';
import { toggleSmart } from '../game/interactions/actions';
import { useGameStore } from '../stores/gameStore';

export function ConfigPanel() {
  const smart = useGameStore((s) => s.smart);
  const setPhase = useGameStore((s) => s.setPhase);
  const count = DEVICES.filter((d) => d.available && smart[d.id]).length;

  return (
    <div className="panel-body">
      <div className="panel-head">
        <div className="eyebrow">Krok 1 ze 3</div>
        <h2>Sestav si chytrou domácnost</h2>
        <p className="muted">Zapni zařízení, která máš doma. Můžeš klepat i přímo na předměty ve scéně.</p>
      </div>

      <div className="device-grid">
        {DEVICES.map((d) => {
          const on = d.available && smart[d.id];
          return (
            <button
              key={d.id}
              className={`device-card ${on ? 'on' : ''} ${d.available ? '' : 'locked'}`}
              onClick={() => d.available && toggleSmart(d.id)}
              disabled={!d.available}
              aria-pressed={on}
            >
              <span className="dc-icon">{d.icon}</span>
              <span className="dc-text">
                <span className="dc-name">{d.name}</span>
                <span className="dc-room">{d.available ? d.room : 'Již brzy'}</span>
              </span>
              {d.available && <span className={`switch ${on ? 'on' : ''}`} aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="panel-foot">
        <span className="muted small">
          Vybráno <b>{count}</b> chytrých zařízení
        </span>
        <button
          className="btn btn-dark"
          disabled={count === 0}
          onClick={() => {
            audio.play('attack');
            setPhase('play');
          }}
        >
          Převzít kontrolu 💻
        </button>
      </div>
    </div>
  );
}
