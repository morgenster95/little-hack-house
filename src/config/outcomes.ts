/** Objevitelné výsledky scénářů – motivují k opakovanému hraní. */
export interface OutcomeDef {
  id: string;
  title: string;
  emoji: string;
  text: string;
}

export const OUTCOMES: OutcomeDef[] = [
  { id: 'cold-shower', title: 'Ledová sprcha', emoji: '🥶', text: 'Bojler nehřál a sprcha byla pořádně osvěžující.' },
  { id: 'boiler-fault', title: 'Bojler v poruše', emoji: '⚠️', text: 'Bojler začal hlásit chybu, kterou nikdo nezpůsobil.' },
  { id: 'warmed-up', title: 'Záchrana u topení', emoji: '♨️', text: 'Po studené sprše se aspoň šlo zahřát k radiátoru.' },
  { id: 'double-trouble', title: 'Dvojitá smůla', emoji: '🧊', text: 'Studená sprcha a k tomu studený radiátor.' },
  { id: 'cold-living', title: 'Zima v obýváku', emoji: '🧣', text: 'Topení se vypnulo a nezbyla než deka.' },
  { id: 'heatwave', title: 'Sauna zdarma', emoji: '🥵', text: 'Topení jelo naplno a okno se muselo otevřít dokořán.' },
  { id: 'disco', title: 'Nechtěná diskotéka', emoji: '🪩', text: 'Světla blikala a vypínač nepomáhal.' },
  { id: 'darkness', title: 'Tma jak v pytli', emoji: '🔦', text: 'Všechna světla zhasla a zbyla jen baterka v mobilu.' },
  { id: 'party', title: 'Duhová párty', emoji: '🌈', text: 'Světla hrála všemi barvami. Aspoň se tančilo.' },
  { id: 'cozy-apocalypse', title: 'Tma a zima', emoji: '🕯️', text: 'Bez světla a bez topení. Domov, sladký domov.' },
  { id: 'blocked', title: 'Útok zablokován', emoji: '🛡️', text: 'Ochrana zachytila podezřelý příkaz dřív, než něco pokazil.' },
];

export const OUTCOME_MAP = Object.fromEntries(OUTCOMES.map((o) => [o.id, o]));
