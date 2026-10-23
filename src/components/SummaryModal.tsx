import { BRAND } from '../config/brand';
import { DEVICES } from '../config/devices';
import { OUTCOMES } from '../config/outcomes';
import { enterConfig, restoreAll } from '../game/interactions/actions';
import { useGameStore } from '../stores/gameStore';

export function SummaryModal() {
  const { smart, stats, setSummaryOpen, pushToast, resetRun } = useGameStore();
  const selected = DEVICES.filter((d) => d.available && smart[d.id]);
  const found = new Set(stats.outcomes);

  const share = async () => {
    const text = `V Little Hack House jsem objevil(a) ${stats.outcomes.length}/${OUTCOMES.length} scénářů a spustil(a) ${stats.attacks} simulovaných útoků na chytrou domácnost. Zvládneš víc?`;
    const url = window.location.href.split('#')[0];
    try {
      if (navigator.share) await navigator.share({ title: 'Little Hack House', text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        pushToast('Odkaz zkopírován do schránky', 'good');
      }
    } catch {
      /* zrušeno uživatelem */
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => setSummaryOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Vyhodnocení">
        <button className="modal-close" onClick={() => setSummaryOpen(false)} aria-label="Zavřít">
          ×
        </button>
        <div className="eyebrow">Vyhodnocení</div>
        <h2>Tvoje chytrá domácnost</h2>

        <div className="stats">
          <div className="stat">
            <b>{selected.length}</b>
            <span>chytrých zařízení</span>
          </div>
          <div className="stat">
            <b>{stats.attacks}</b>
            <span>simulovaných útoků</span>
          </div>
          <div className="stat">
            <b>{stats.blocked}</b>
            <span>zablokováno ochranou</span>
          </div>
          <div className="stat">
            <b>
              {stats.outcomes.length}/{OUTCOMES.length}
            </b>
            <span>objevených scénářů</span>
          </div>
        </div>

        <h3>Objevené situace</h3>
        <div className="outcomes">
          {OUTCOMES.map((o) =>
            found.has(o.id) ? (
              <div key={o.id} className="outcome found">
                <span className="oc-emoji">{o.emoji}</span>
                <div>
                  <b>{o.title}</b>
                  <span>{o.text}</span>
                </div>
              </div>
            ) : (
              <div key={o.id} className="outcome">
                <span className="oc-emoji">❔</span>
                <div>
                  <b>???</b>
                  <span>Zkus jinou kombinaci útoků.</span>
                </div>
              </div>
            ),
          )}
        </div>

        <h3>Co ti hrozí ve skutečnosti</h3>
        <ul className="risks">
          {selected.map((d) => (
            <li key={d.id}>
              <span>{d.icon}</span>
              <div>
                <b>{d.name}</b>
                <p>{d.risk}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="cta">
          <div>
            <b>🛡️ {BRAND.productName}</b>
            <p>{BRAND.productTagline}</p>
          </div>
          <a className="btn btn-green" href={BRAND.productUrl} target="_blank" rel="noopener">
            Zjistit víc
          </a>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={share}>
            Sdílet výsledek
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              restoreAll();
              resetRun();
              enterConfig();
            }}
          >
            Začít znovu
          </button>
          <button className="btn btn-dark" onClick={() => setSummaryOpen(false)}>
            Hrát dál
          </button>
        </div>
        <p className="fineprint">{BRAND.disclaimer}</p>
      </div>
    </div>
  );
}
