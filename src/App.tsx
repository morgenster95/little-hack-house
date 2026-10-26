import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { GameCanvas, getEngine } from './components/GameCanvas';
import { HackerPanel } from './components/HackerPanel';
import { IntroOverlay } from './components/IntroOverlay';
import { SummaryModal } from './components/SummaryModal';
import { Toasts } from './components/Toasts';
import { TopBar } from './components/TopBar';
import { useGameStore } from './stores/gameStore';

const DESKTOP = 900;

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const summaryOpen = useGameStore((s) => s.summaryOpen);
  const selectedDevice = useGameStore((s) => s.selectedDevice);
  const panelRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // na mobilu po výběru zařízení panel rozbalíme
  useEffect(() => {
    if (selectedDevice) setCollapsed(false);
  }, [selectedDevice]);

  // volný prostor pro scénu podle panelu
  useLayoutEffect(() => {
    const update = () => {
      const r = getEngine()?.renderer;
      if (!r) return;
      const el = panelRef.current;
      const top = 64;
      if (phase === 'intro') {
        // úvod: text vlevo (desktop) / dole (mobil), živá scéna v uvolněném prostoru
        const intro = document.querySelector('.intro-panel');
        const ir = intro?.getBoundingClientRect();
        if (window.innerWidth >= DESKTOP) r.setInsets({ top, right: 24, bottom: 24, left: ir ? ir.right + 8 : 0 });
        else r.setInsets({ top: 58, right: 0, bottom: ir ? Math.max(0, window.innerHeight - ir.top) : 0, left: 0 });
        return;
      }
      if (!el) {
        r.setInsets({ top, right: 0, bottom: 0, left: 0 });
        return;
      }
      const rect = el.getBoundingClientRect();
      if (window.innerWidth >= DESKTOP) r.setInsets({ top, right: window.innerWidth - rect.left + 12, bottom: 0, left: 0 });
      else r.setInsets({ top: 58, right: 0, bottom: Math.max(0, window.innerHeight - rect.top), left: 0 });
    };
    update();
    const ro = new ResizeObserver(update);
    if (panelRef.current) ro.observe(panelRef.current);
    window.addEventListener('resize', update);
    const t = setTimeout(update, 300);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      clearTimeout(t);
    };
  }, [phase, collapsed]);

  return (
    <div className={`app phase-${phase}`}>
      <GameCanvas />
      <TopBar />
      <Toasts />
      {phase === 'intro' && <IntroOverlay />}
      {phase !== 'intro' && (
        <aside className={`panel ${phase === 'play' ? 'panel-dark' : ''} ${collapsed ? 'collapsed' : ''}`} ref={panelRef}>
          <button className="sheet-handle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Rozbalit panel' : 'Sbalit panel'}>
            <span />
          </button>
          {phase === 'config' ? <ConfigPanel /> : <HackerPanel />}
        </aside>
      )}
      {summaryOpen && <SummaryModal />}
    </div>
  );
}
