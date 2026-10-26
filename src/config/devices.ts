/**
 * Datově řízená definice chytrých zařízení.
 * Nové zařízení = nový záznam zde + vizuál v src/game/scene/assets + případný scénář.
 */

export type DeviceId =
  | 'boiler'
  | 'heating'
  | 'lights'
  | 'vacuum'
  | 'tv'
  | 'speaker'
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
  {
    id: 'vacuum',
    name: 'Robotický vysavač',
    room: 'Obývák',
    icon: '🤖',
    available: true,
    tagline: 'Uklízí sám a zná každý kout bytu.',
    risk:
      'Robotický vysavač si při úklidu kreslí přesnou mapu bytu a některé modely mají i kameru. Kdo ho ovládne, ví, jak to u vás vypadá – a může s ním po bytě jezdit, kdy se mu zachce.',
    attacks: [
      { id: 'chaos', label: 'Zběsilá jízda', command: 'vacuum.mode = TURBO_CHAOS', resultStatus: 'compromised', hint: 'Úklid ve stylu autodromu.' },
      { id: 'chase', label: 'Pronásledovat obyvatele', command: 'vacuum.follow(target=RESIDENT)', resultStatus: 'compromised', hint: 'Vysavač si našel nového kamaráda.' },
      { id: 'map', label: 'Odeslat mapu bytu', command: 'vacuum.map.upload()', resultStatus: 'compromised', hint: 'Půdorys bytu míří ven z domu.' },
    ],
  },
  {
    id: 'tv',
    name: 'Chytrá televize',
    room: 'Obývák',
    icon: '📺',
    available: true,
    tagline: 'Streamování a hlasové ovládání.',
    risk:
      'Televize s mikrofonem a připojením k internetu může poslouchat, co se doma říká. Napadená televize také umí obtěžovat hlukem nebo reklamou, kterou nejde vypnout.',
    attacks: [
      { id: 'loud', label: 'Hlasitost na maximum', command: 'tv.volume = 100', resultStatus: 'compromised', hint: 'Sousedé budou nadšení.' },
      { id: 'ads', label: 'Pustit nekonečné reklamy', command: 'tv.channel = ADS_24_7', resultStatus: 'compromised', hint: 'Nejlepší nabídka. Jen dnes. Navždy.' },
      { id: 'spy', label: 'Zapnout mikrofon', command: 'tv.mic.stream = ON', resultStatus: 'compromised', hint: 'Kdo poslouchá, ten se dozví.' },
    ],
  },
  {
    id: 'speaker',
    name: 'Hlasový asistent',
    room: 'Obývák',
    icon: '🔊',
    available: true,
    tagline: 'Odpoví, pustí hudbu, nakoupí.',
    risk:
      'Hlasový asistent má mikrofon, přístup k účtům a často i k platbám. Útočník přes něj může nakupovat, ovládat další zařízení nebo obyvatele vystrašit.',
    attacks: [
      { id: 'order', label: 'Objednat nákup', command: 'assistant.order(pizza, qty=50)', resultStatus: 'compromised', hint: 'Dobrou chuť!' },
      { id: 'creepy', label: 'Strašidelný hlas', command: 'assistant.say("Vidím tě…")', resultStatus: 'compromised', hint: 'Mrazení v zádech zdarma.' },
    ],
  },
  {
    id: 'camera',
    name: 'Bezpečnostní kamera',
    room: 'Obývák',
    icon: '📷',
    available: true,
    tagline: 'Dohled nad domovem odkudkoli.',
    risk:
      'Kamera, která má chránit, se po napadení může stát oknem do vašeho soukromí. Útočník ji také může vypnout přesně ve chvíli, kdy by měla nahrávat.',
    attacks: [
      { id: 'peek', label: 'Sledovat obyvatele', command: 'camera.track(RESIDENT)', resultStatus: 'compromised', hint: 'Usmívejte se, jste natáčeni.' },
      { id: 'off', label: 'Vypnout záznam', command: 'camera.rec = OFF', resultStatus: 'disabled', hint: 'Nikdo nic neviděl.' },
    ],
  },
  {
    id: 'washer',
    name: 'Chytrá pračka',
    room: 'Koupelna',
    icon: '🫧',
    available: true,
    tagline: 'Praní na dálku a hlášení do mobilu.',
    risk:
      'I pračka může být vstupní branou do domácí sítě. Napadená pračka může běžet nesmyslné programy, plýtvat energií – nebo vytopit koupelnu.',
    attacks: [
      { id: 'spin', label: 'Odstřeďování naplno', command: 'washer.spin = 2000 rpm', resultStatus: 'compromised', hint: 'Pračka vyráží na procházku.' },
      { id: 'flood', label: 'Vypustit vodu', command: 'washer.drain(target=FLOOR)', resultStatus: 'compromised', hint: 'Koupelna se mění v bazén.' },
    ],
  },
  {
    id: 'lock',
    name: 'Chytrý zámek',
    room: 'Vstup',
    icon: '🔐',
    available: true,
    tagline: 'Klíče v telefonu.',
    risk:
      'U zámku jde o fyzickou bezpečnost domova. Kdo ovládne chytrý zámek, může dveře otevřít cizím lidem – nebo vás zamknout venku či uvnitř.',
    attacks: [
      { id: 'unlock', label: 'Odemknout dveře', command: 'lock.state = OPEN', resultStatus: 'compromised', hint: 'Dveře dokořán. Kdo přijde?' },
      { id: 'jam', label: 'Zablokovat zámek', command: 'lock.state = JAMMED', resultStatus: 'disabled', hint: 'Ven se dnes nepůjde.' },
    ],
  },
  // --- další fáze: v domě zatím není kuchyň ---
  { id: 'coffee', name: 'Chytrý kávovar', room: 'Kuchyň', icon: '☕', available: false, tagline: 'Káva připravená, než vstanete.', risk: 'Nezabezpečený spotřebič může posloužit jako odrazový můstek.', attacks: [] },
  { id: 'fridge', name: 'Chytrá lednice', room: 'Kuchyň', icon: '🧊', available: false, tagline: 'Hlídá nákupní seznam.', risk: 'Výpadek lednice = zkažené jídlo.', attacks: [] },
];

export const DEVICE_MAP = Object.fromEntries(DEVICES.map((d) => [d.id, d])) as Record<DeviceId, DeviceDef>;
export const PLAYABLE_DEVICES = DEVICES.filter((d) => d.available).map((d) => d.id);
export const DEVICE_IDS = DEVICES.map((d) => d.id);
