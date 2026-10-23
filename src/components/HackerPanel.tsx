import { BRAND } from '../config/brand';
import { DEVICE_MAP, DEVICES, DeviceStatus } from '../config/devices';
import { OUTCOMES } from '../config/outcomes';
import { attack, enterConfig, restore, selectDevice, setProtection } from '../game/interactions/actions';
import { isAttacked, useGameStore } from '../stores/gameStore';

const STATUS_LABEL: Record<DeviceStatus, string> = {
  normal: 'v pořádku',
  compromised: 'napadeno',
  disabled: 'vyřazeno',
  protected: 'chráněno',
  recovering: 'obnovuje se',
};

export function HackerPanel() {
  const state = useGameStore();
  const { smart, devices, selectedDevice, protection, stats, setSummaryOpen } = state;
  const list = DEVICES.filter((d) => d.available && smart[d.id]);
  const sel = selectedDevice ? DEVICE_MAP[selectedDevice] : null;
  const selRt = selectedDevice ? devices[selectedDevice] : null;
  const selAttacked = selectedDevice ? isAttacked(selectedDevice, state) : false;

  return (
    <div className="panel-body hacker">
      <div className="panel-head">
        <div className="eyebrow mono">
          <span className="blink">▮</span> hacker_mode
        </div>
        <h2>Převezmi kontrolu</h2>
        <p className="muted">Vyber zařízení v domě nebo v seznamu a spusť simulovaný útok.</p>
      </div>

      <div className="dev-list">
        {list.map((d) => {
          const rt = devices[d.id];
          const attacked = isAttacked(d.id, state);
          return (
            <button
              key={d.id}
              className={`dev-chip ${selectedDevice === d.id ? 'sel' : ''} st-${attacked ? 'hacked' : rt.status}`}
              onClick={() => selectDevice(selectedDevice === d.id ? null : d.id)}
            >
              <span className="dc-icon">{d.icon}</span>
              <span className="dev-name">{d.name}</span>
              <span className="pill">{STATUS_LABEL[rt.status]}</span>
            </button>
          );
        })}
      </div>

      {sel && selRt && (
        <div className="attack-box" key={sel.id}>
          <div className="attack-title mono">
            ~/{sel.id} <span className="muted">$ vyber příkaz</span>
          </div>
          <div className="attack-list">
            {sel.attacks.map((a) => {
              const active = selAttacked && selRt.attack === a.id;
              return (
                <button key={a.id} className={`attack-btn ${active ? 'active' : ''}`} onClick={() => attack(sel.id, a.id)} disabled={selRt.status === 'recovering'}>
                  <span className="atk-label">{a.label}</span>
                  <span className="atk-cmd mono">&gt; {a.command}</span>
                  <span className="atk-hint">{active ? '✓ právě probíhá' : a.hint}</span>
                </button>
              );
            })}
          </div>
          {selAttacked && (
            <button className="btn btn-ghost restore" onClick={() => restore(sel.id)}>
              ↺ Obnovit zařízení
            </button>
          )}
        </div>
      )}

      {!sel && <div className="hint-box">👆 Klepni na zařízení s ikonkou wifi přímo v domě.</div>}

      {protection.unlocked && (
        <div className={`protect-card ${protection.active ? 'active' : 'pulse'}`}>
          <div className="protect-top">
            <span className="shield">🛡️</span>
            <div>
              <div className="protect-name">{BRAND.productName}</div>
              <div className="small">{protection.active ? 'Ochrana aktivní – zkus útok zopakovat.' : 'Zjisti, jak by to dopadlo s ochranou.'}</div>
            </div>
          </div>
          {!protection.active && <p className="small protect-pitch">{BRAND.protectionPitch}</p>}
          <button className={`btn ${protection.active ? 'btn-ghost' : 'btn-green'}`} onClick={() => setProtection(!protection.active)}>
            {protection.active ? 'Vypnout ochranu' : 'Aktivovat ochranu'}
          </button>
          {protection.active && stats.blocked > 0 && (
            <div className="small blocked-count">
              Zablokováno útoků: <b>{stats.blocked}</b>
            </div>
          )}
        </div>
      )}

      <div className="panel-foot">
        <button className="link-btn" onClick={() => enterConfig()}>
          ← Upravit domácnost
        </button>
        <button className="btn btn-dark" onClick={() => setSummaryOpen(true)} disabled={stats.attacks + stats.blocked === 0}>
          Vyhodnocení · {stats.outcomes.length}/{OUTCOMES.length}
        </button>
      </div>
    </div>
  );
}
