/**
 * Datově řízená definice chytrých zařízení.
 * Nové zařízení = nový záznam zde + vizuál v src/game/scene/assets + případný scénář.
 */

export type DeviceId =
  | 'boiler'
  | 'heating'
  | 'lights'
  | 'thermostat'
  | 'tv'
  | 'camera'
  | 'washer'
  | 'lock'
  | 'coffee'
  | 'fridge';

export type DeviceStatus = 'normal' | 'compromised' | 'disabled' | 'protected' | 'recovering';

export interface AttackDef {
  id: string;
  label: string;
  /** Krátký "hackerský" příkaz zobrazený v konzoli – čistě dekorativní, nic nedělá. */
  command: string;
  /** Výsledný stav zařízení po útoku. */
  resultStatus: 'compromised' | 'disabled';
  hint: string;
}

export interface DeviceDef {
  id: DeviceId;
  name: string;
  room: string;
  icon: string;
  /** Je zařízení v MVP hratelné? */
  available: boolean;
  tagline: string;
  /** Vysvětlení rizika pro závěrečné vyhodnocení (bez návodu ke zneužití). */
  risk: string;
  attacks: AttackDef[];
}

export const DEVICES: DeviceDef[] = [
  {
    id: 'boiler',
    name: 'Chytrý bojler',
    room: 'Koupelna',
    icon: '🔥',
    available: true,
    tagline: 'Teplá voda na povel z mobilu.',
    risk:
      'Ovládání ohřevu na dálku je pohodlné, ale kdo převezme aplikaci nebo zařízení, může vám vzít teplou vodu – nebo zařízení nechat běžet zbytečně a za drahé peníze.',
    attacks: [
      { id: 'heat_off', label: 'Vypnout ohřev vody', command: 'boiler.heating = OFF', resultStatus: 'compromised', hint: 'Voda pomalu vychladne…' },
      { id: 'cold', label: 'Nastavit ledovou vodu', command: 'boiler.target = 10°C', resultStatus: 'compromised', hint: 'Příští sprcha bude osvěžující.' },
      { id: 'fault', label: 'Vyvolat poruchu', command: 'boiler.raise(E-13)', resultStatus: 'disabled', hint: 'Bojler začne hlásit chybu.' },
    ],
  },
  {
    id: 'heating',
    name: 'Chytré topení',
    room: 'Obývák + koupelna',
    icon: '♨️',
    available: true,
    tagline: 'Radiátory řízené chytrým termostatem.',
    risk:
      'Napadené vytápění může dům vychladit nebo přetopit. Kromě nepohodlí to znamená i vyšší účty a v extrémech riziko pro zdraví nebo zamrznutí rozvodů.',
    attacks: [
      { id: 'off', label: 'Vypnout topení', command: 'heating.mode = OFF', resultStatus: 'compromised', hint: 'Radiátory začnou chladnout.' },
      { id: 'overheat', label: 'Roztopit na maximum', command: 'heating.target = 30°C', resultStatus: 'compromised', hint: 'Bude tu jako v sauně.' },
    ],
  },
  {
    id: 'lights',
    name: 'Chytré osvětlení',
    room: 'Celý byt',
    icon: '💡',
    available: true,
    tagline: 'Žárovky ovládané aplikací a hlasem.',
    risk:
      'Ovládnuté osvětlení umí obyvatele obtěžovat a strašit. Navíc podle toho, kdy se svítí, lze odhadnout, kdy doma nikdo není.',
    attacks: [
      { id: 'flicker', label: 'Rozblikat světla', command: 'lights.blink(rate=8Hz)', resultStatus: 'compromised', hint: 'Diskotéka, o kterou nikdo nežádal.' },
      { id: 'off', label: 'Zhasnout všude', command: 'lights.all = OFF', resultStatus: 'disabled', hint: 'Tma jak v pytli.' },
      { id: 'party', label: 'Party barvy', command: 'lights.color = RAINBOW', resultStatus: 'compromised', hint: 'Duhová nálada.' },
    ],
  },
  // --- Fáze 2: připraveno v konfigurátoru, zatím zamčeno ---
  { id: 'tv', name: 'Chytrá televize', room: 'Obývák', icon: '📺', available: false, tagline: 'Streamování a hlasové ovládání.', risk: 'Televize s mikrofonem a kamerou může sloužit jako odposlech.', attacks: [] },
  { id: 'thermostat', name: 'Chytrý termostat', room: 'Obývák', icon: '🌡️', available: false, tagline: 'Plánování teploty.', risk: 'Termostat prozradí váš denní režim.', attacks: [] },
  { id: 'camera', name: 'Bezpečnostní kamera', room: 'Obývák', icon: '📷', available: false, tagline: 'Dohled nad domovem.', risk: 'Kompromitovaná kamera znamená zásah do soukromí.', attacks: [] },
  { id: 'washer', name: 'Chytrá pračka', room: 'Koupelna', icon: '🫧', available: false, tagline: 'Praní na dálku.', risk: 'I pračka může být vstupní branou do domácí sítě.', attacks: [] },
  { id: 'lock', name: 'Chytrý zámek', room: 'Vstup', icon: '🔐', available: false, tagline: 'Klíče v telefonu.', risk: 'U zámku jde o fyzickou bezpečnost domova.', attacks: [] },
  { id: 'coffee', name: 'Chytrý kávovar', room: 'Kuchyň', icon: '☕', available: false, tagline: 'Káva připravená, než vstanete.', risk: 'Nezabezpečený spotřebič může posloužit jako odrazový můstek.', attacks: [] },
  { id: 'fridge', name: 'Chytrá lednice', room: 'Kuchyň', icon: '🧊', available: false, tagline: 'Hlídá nákupní seznam.', risk: 'Výpadek lednice = zkažené jídlo.', attacks: [] },
];

export const DEVICE_MAP = Object.fromEntries(DEVICES.map((d) => [d.id, d])) as Record<DeviceId, DeviceDef>;
export const PLAYABLE_DEVICES = DEVICES.filter((d) => d.available).map((d) => d.id);
