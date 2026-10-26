import type { DeviceId } from '../config/devices';

/** Jednoduché čárové ikony 24×24 (stroke = currentColor). */
const PATHS: Record<string, string[]> = {
  // zařízení
  boiler: ['M8 2.5h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2z', 'M12 16c-1.6 0-2.6-1-2.6-2.4 0-1.6 1.4-2.2 1.8-3.6 1 .9 3.4 2.2 3.4 3.8 0 1.2-1.1 2.2-2.6 2.2z', 'M9 6h6'],
  heating: ['M4 6.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z', 'M7.5 6.5v11', 'M12 6.5v11', 'M16.5 6.5v11', 'M5 17.5v2', 'M19 17.5v2'],
  lights: ['M9 18h6', 'M10 21h4', 'M12 3a6 6 0 0 0-3.9 10.6c.6.5.9 1.3.9 2.1V16h6v-.3c0-.8.3-1.6.9-2.1A6 6 0 0 0 12 3z'],
  vacuum: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 7.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z', 'M6.8 15.2a7 7 0 0 0 10.4 0'],
  tv: ['M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M8 21h8', 'M12 17v4'],
  speaker: ['M12 3a4.5 4.5 0 0 1 4.5 4.5v9a4.5 4.5 0 0 1-9 0v-9A4.5 4.5 0 0 1 12 3z', 'M12 12.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', 'M11 7.5h2'],
  camera: ['M3.5 8.5 15 5l2.5 6L6 14.5z', 'M17 9.5l3.5-1v4l-3 .5', 'M7 14.5V19H3.5', 'M10 8.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z'],
  washer: ['M6 2.5h12a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z', 'M4 7h16', 'M12 9.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z', 'M7 4.8h.01', 'M10 4.8h.01'],
  lock: ['M6 10.5h12a1.5 1.5 0 0 1 1.5 1.5v7.5A1.5 1.5 0 0 1 18 21H6a1.5 1.5 0 0 1-1.5-1.5V12A1.5 1.5 0 0 1 6 10.5z', 'M8 10.5V7a4 4 0 0 1 8 0v3.5', 'M12 14.5v2.5'],
  coffee: ['M4 8.5h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z', 'M16 10h1.5a2.2 2.2 0 0 1 0 4.4H16', 'M8 3.5v2', 'M12 3.5v2', 'M3 21h14'],
  fridge: ['M7 2.5h10a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z', 'M5 10h14', 'M8.5 5.5v2', 'M8.5 12.5v3.5'],
  // rozhraní
  shield: ['M12 2.8l7.5 3v6.1c0 4.6-3.1 7.9-7.5 9.4-4.4-1.5-7.5-4.8-7.5-9.4V5.8z'],
  shieldCheck: ['M12 2.8l7.5 3v6.1c0 4.6-3.1 7.9-7.5 9.4-4.4-1.5-7.5-4.8-7.5-9.4V5.8z', 'M8.8 12l2.2 2.2 4.3-4.4'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  target: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 2v4', 'M12 18v4', 'M2 12h4', 'M18 12h4'],
  volume: ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M15.5 9a4 4 0 0 1 0 6', 'M18.5 6.5a7.5 7.5 0 0 1 0 11'],
  mute: ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M16 9.5l5 5', 'M21 9.5l-5 5'],
  music: ['M9 18V5.5l11-2v12', 'M6.5 15.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', 'M17.5 13a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  terminal: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M7 10l3 2.5L7 15', 'M12.5 15H17'],
  home: ['M3.5 11 12 4l8.5 7', 'M5.5 9.5V20h13V9.5', 'M10 20v-5.5h4V20'],
  pulse: ['M3 12h4l2-5 4 10 2-5h6'],
  bolt: ['M13 2.5 5 13.5h6l-1 8 8-11h-6z'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v5.5', 'M12 7.8h.01'],
  restore: ['M4 12a8 8 0 1 0 2.4-5.7', 'M4 4.5v4.5h4.5'],
  share: ['M12 15V3.5', 'M7.5 8 12 3.5 16.5 8', 'M5 13v6.5h14V13'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  wifi: ['M5 12.5a10 10 0 0 1 14 0', 'M8.2 15.6a5.5 5.5 0 0 1 7.6 0', 'M12 19h.01'],
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, stroke = 1.8, className }: { name: IconName | DeviceId; size?: number; stroke?: number; className?: string }) {
  const paths = PATHS[name] ?? PATHS.info;
  return (
    <svg
      className={`icon ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** Logo hry: dům ve štítu. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="lhh-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d7bff" />
          <stop offset="1" stopColor="#1d3fd1" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#lhh-g)" />
      <path d="M20 8.5l9.5 3.8v7.4c0 5.6-3.9 9.7-9.5 11.6-5.6-1.9-9.5-6-9.5-11.6v-7.4z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M15.2 20.5 20 16.6l4.8 3.9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.8 19.3v5.4h6.4v-5.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}
