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
  { id: 'vacuum-derby', title: 'Autodrom v obýváku', emoji: '🤖', text: 'Vysavač jezdil jako šílený a Toník o něj zakopl.' },
  { id: 'vacuum-chase', title: 'Honička s vysavačem', emoji: '🏃', text: 'Robot pronásledoval Toníka, až se schoval na gauč.' },
  { id: 'house-map', title: 'Plánek bytu na prodej', emoji: '🗺️', text: 'Vysavač zmapoval byt a poslal plánek neznámo kam.' },
  { id: 'tv-blast', title: 'Koncert pro celý dům', emoji: '📢', text: 'Televize řvala naplno a nešla vypnout.' },
  { id: 'ad-storm', title: 'Reklamní smršť', emoji: '🛍️', text: 'Na televizi běžely jen reklamy. Pořád dokola.' },
  { id: 'tv-spy', title: 'Televize poslouchá', emoji: '👂', text: 'Mikrofon v televizi zachytil soukromý hovor.' },
  { id: 'pizza-party', title: 'Padesát pizz', emoji: '🍕', text: 'Hlasový asistent objednával jídlo na Toníkův účet.' },
  { id: 'ghost-voice', title: 'Hlas odnikud', emoji: '👻', text: 'Asistent začal mluvit sám od sebe. Strašidelně.' },
  { id: 'watched', title: 'Velký bratr', emoji: '👁️', text: 'Kamera natáčela každý Toníkův krok – a nebyl to on, kdo se díval.' },
  { id: 'blind-spot', title: 'Slepá kamera', emoji: '🙈', text: 'Kamera přestala nahrávat a nikdo si toho hned nevšiml.' },
  { id: 'washer-quake', title: 'Pračka na útěku', emoji: '🌀', text: 'Odstřeďování naplno rozdrnčelo celou koupelnu.' },
  { id: 'flood', title: 'Koupelna jako bazén', emoji: '🌊', text: 'Pračka vypustila vodu na podlahu a Toník uklouzl.' },
  { id: 'open-door', title: 'Dveře dokořán', emoji: '🚪', text: 'Zámek se sám odemkl a dveře se otevřely.' },
  { id: 'locked-in', title: 'Zamčený doma', emoji: '🔒', text: 'Zámek se zasekl a Toník nemohl ven.' },
  { id: 'open-house', title: 'Pozvánka pro zloděje', emoji: '🕵️', text: 'Odemčené dveře a k tomu vypnutá kamera. Ideální kombinace… pro zloděje.' },
  { id: 'blocked', title: 'Útok zablokován', emoji: '🛡️', text: 'Ochrana zachytila podezřelý příkaz dřív, než něco pokazil.' },
];

export const OUTCOME_MAP = Object.fromEntries(OUTCOMES.map((o) => [o.id, o]));
