import { useGameStore } from '../stores/gameStore';
import { Icon, IconName } from './Icon';

const ICON: Record<string, IconName> = { attack: 'terminal', blocked: 'shieldCheck', good: 'shieldCheck', info: 'info' };

export function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  const dismiss = useGameStore((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast toast-${t.kind}`} onClick={() => dismiss(t.id)}>
          <Icon name={ICON[t.kind]} size={16} />
          <span>{t.text}</span>
        </button>
      ))}
    </div>
  );
}
