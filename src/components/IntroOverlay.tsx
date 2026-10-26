import { BRAND } from '../config/brand';
import { DEVICES } from '../config/devices';
import { OUTCOMES } from '../config/outcomes';
import { audio } from '../game/engine/audio';
import { useGameStore } from '../stores/gameStore';
import { Icon, IconName } from './Icon';

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'home', title: 'Sestav domácnost', text: 'Vyber chytrá zařízení, která máš doma i ty.' },
  { icon: 'terminal', title: 'Simuluj útok', text: 'Převezmi kontrolu jako útočník a sleduj dopady.' },
  { icon: 'shieldCheck', title: 'Zapni ochranu', text: `Zkus to znovu s ochranou ${BRAND.productName}.` },
];

/**
 * Úvodní obrazovka: vlevo text a výzva, vpravo živá scéna domu (bez rozmazání),
 * nad ní pár „bezpečnostních“ stavových štítků.
 */
export function IntroOverlay() {
  const setPhase = useGameStore((s) => s.setPhase);
  const music = useGameStore((s) => s.music);
  const playable = DEVICES.filter((d) => d.available);
  const attacks = playable.reduce((n, d) => n + d.attacks.length, 0);

  const start = () => {
    audio.unlock();
    audio.setMusic(music);
    audio.play('select');
    setPhase('config');
  };

  return (
    <div className="intro">
      <section className="intro-panel">
        <div className="intro-badge">
          <span className="live-dot" /> Interaktivní bezpečnostní simulace
        </div>
        <h1>
          Jak bezpečná je <span className="grad">tvoje chytrá domácnost</span>?
        </h1>
        <p className="lead">
          Sestav si domácnost z chytrých zařízení, převezmi nad nimi kontrolu jako útočník a sleduj, co to udělá s obyvatelem.
          Pak zapni ochranu a zkus to znovu.
        </p>

        <div className="intro-actions">
          <button className="btn btn-primary btn-big" onClick={start}>
            Spustit simulaci <Icon name="arrow" size={18} stroke={2.2} />
          </button>
          <span className="intro-meta">Bez registrace · zhruba 5 minut</span>
        </div>

        <ol className="intro-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="step-icon">
                <Icon name={s.icon} size={20} />
              </span>
              <div>
                <b>
                  <span className="step-no">0{i + 1}</span> {s.title}
                </b>
                <span>{s.text}</span>
              </div>
            </li>
          ))}
        </ol>

        <dl className="intro-stats">
          <div>
            <dt>{playable.length}</dt>
            <dd>chytrých zařízení</dd>
          </div>
          <div>
            <dt>{attacks}</dt>
            <dd>simulovaných útoků</dd>
          </div>
          <div>
            <dt>{OUTCOMES.length}</dt>
            <dd>situací k objevení</dd>
          </div>
        </dl>

        <p className="fineprint">{BRAND.disclaimer}</p>
      </section>

      <div className="intro-hud" aria-hidden>
        <div className="hud-card hud-net">
          <Icon name="wifi" size={18} />
          <div>
            <b>Domácí síť</b>
            <span>{playable.length} zařízení připojeno</span>
          </div>
          <span className="live-dot" />
        </div>
        <div className="hud-card hud-alert">
          <Icon name="bolt" size={18} />
          <div>
            <b>Neznámý příkaz</b>
            <span className="mono">boiler.heating = OFF</span>
          </div>
        </div>
        <div className="hud-card hud-guard">
          <Icon name="shieldCheck" size={18} />
          <div>
            <b>{BRAND.productName}</b>
            <span>připraveno k ochraně</span>
          </div>
        </div>
      </div>
    </div>
  );
}
