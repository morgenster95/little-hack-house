import { BRAND } from '../config/brand';
import { audio } from '../game/engine/audio';
import { useGameStore } from '../stores/gameStore';

export function IntroOverlay() {
  const setPhase = useGameStore((s) => s.setPhase);
  const music = useGameStore((s) => s.music);

  const start = () => {
    audio.unlock();
    audio.setMusic(music);
    audio.play('select');
    setPhase('config');
  };

  return (
    <div className="intro">
      <div className="intro-card">
        <div className="intro-kicker">interaktivní simulace</div>
        <h1>
          Jak bezpečná je <span className="hl">tvoje chytrá</span> domácnost?
        </h1>
        <p>
          Vyber zařízení, která používáš, a pak se na chvíli staň hackerem. Uvidíš, co by se stalo, kdyby je ovládl někdo cizí –
          a {BRAND.residentName} to pocítí na vlastní kůži.
        </p>
        <ol className="intro-steps">
          <li>
            <span>1</span>Sestav domácnost
          </li>
          <li>
            <span>2</span>Hackni ji
          </li>
          <li>
            <span>3</span>Ochraň ji
          </li>
        </ol>
        <button className="btn btn-primary btn-big" onClick={start}>
          Začít hrát
        </button>
        <p className="fineprint">{BRAND.disclaimer}</p>
      </div>
    </div>
  );
}
