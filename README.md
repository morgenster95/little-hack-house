# Little Hack House 🏠💻🛡️

Interaktivní izometrická webová hra o bezpečnosti chytré domácnosti.
Hráč si sestaví vlastní chytrou domácnost, v roli hackera ji simulovaně napadne,
sleduje, jak to obyvatel **Toník** odnese, a nakonec zapne ochranu a zkusí útok znovu.

> Všechny útoky jsou **pouze simulované** v herním stavu. Hra nepřistupuje k žádným reálným zařízením.

**Hra běží na:** https://morgenster95.github.io/little-hack-house/

---

## Co umí MVP

| Oblast | Stav |
|---|---|
| Izometrický dům – koupelna + obývák, nábytek, dekorace | ✅ procedurální vektorová grafika (PixiJS) |
| Konfigurátor (bojler, topení, osvětlení + 7 zařízení „již brzy") | ✅ karty i klepnutí přímo do scény, ukládání do localStorage |
| Běžná vs. chytrá varianta zařízení | ✅ chytrá má displej, LED a odznak stavu |
| Simulované útoky (8 útoků na 3 zařízení) | ✅ |
| Animovaná postavička s autonomním chováním | ✅ 12 běžných aktivit, 13 výrazů, 12 emoji bublin |
| Hlavní scénář bojler → studená sprcha → radiátor | ✅ výsledek se liší podle stavu topení |
| Kombinace útoků | ✅ např. tma + zima, studená sprcha potmě, nefunkční topení |
| Ochranný režim produktu | ✅ obnovení zařízení, štít kolem domu, blokace útoků |
| Závěrečné vyhodnocení | ✅ statistiky, 11 objevitelných situací, rizika, CTA, sdílení |
| Zvuky + hudba | ✅ syntetizované přes WebAudio (bez souborů), lze vypnout |
| Mobil | ✅ spodní panel, posun a přiblížení scény prsty |
| Nasazení | ✅ GitHub Actions → GitHub Pages |

## Spuštění lokálně

```bash
npm install
npm run dev       # vývojový server
npm run build     # produkční build do dist/
npm run preview   # náhled buildu
```

## Nasazení

Každý push do větve `main` spustí workflow `.github/workflows/deploy.yml`, který hru sestaví a nasadí na GitHub Pages.
Při prvním nasazení je potřeba v repozitáři nastavit **Settings → Pages → Source: GitHub Actions**.

## Architektura

```
src/
├── config/            # DATA: zařízení, útoky, rozvržení domu, výsledky, značka klienta
│   ├── devices.ts     #   definice zařízení a útoků (datově řízený konfigurátor)
│   ├── layout.ts      #   mřížka, navigační body a cesty postavičky
│   ├── outcomes.ts    #   objevitelné situace pro vyhodnocení
│   └── brand.ts       #   název produktu, URL, texty ochrany  ← upravit pro klienta
├── stores/gameStore.ts        # Zustand: fáze hry, konfigurace, stavy zařízení, statistiky
├── game/
│   ├── engine/                # GameEngine (režisér), event bus, audio
│   ├── interactions/actions.ts# útok, obnovení, ochrana – mění jen herní stav
│   ├── character/             # model postavy + navigace po grafu (bez grafiky)
│   ├── scenarios/             # PŘÍBĚHY: reakce na útoky + volné aktivity
│   └── scene/                 # VYKRESLOVÁNÍ (PixiJS): dům, zařízení, postava, efekty
└── components/                # React UI: úvod, konfigurátor, hackerský panel, vyhodnocení
```

### Hlavní principy

- **Logika odděleně od grafiky.** Scénáře ovládají postavičku jen přes rozhraní `ScenarioContext`
  (`walkTo`, `emote`, `say`, `hotWater()`, `heating()`…). O vykreslování nevědí nic.
- **Stavy zařízení:** `normal`, `compromised`, `disabled`, `protected`, `recovering`.
  Funkční důsledky (je teplá voda? topí se?) odvozuje `deviceLogic` v `gameStore.ts`.
- **Izometrické řazení:** objekty mají hloubku `x + y`, postava se řadí dynamicky.
  Předměty, které ji zakrývají, se zprůhlední.
- **Statické nasazení:** žádný backend, vše běží v prohlížeči.

### Jak přidat nový scénář

```ts
// src/game/scenarios/tvGlitch.ts
export const tvGlitch: Scenario = {
  id: 'tv-glitch',
  triggers: [{ device: 'tv', attack: 'channel' }],
  async run(ctx) {
    await ctx.walkTo('sofaSeat');
    ctx.expression('confused');
    ctx.emote('question');
    ctx.say('Kdo mi přepnul program?');
    ctx.outcome('tv-glitch');
    await ctx.wait(2000);
  },
};
```

Pak ho přidat do `reactionScenarios` v `src/game/scenarios/index.ts` (a případně výsledek do `config/outcomes.ts`).

### Jak přidat nové zařízení

1. Záznam v `src/config/devices.ts` (nastavit `available: true` a doplnit `attacks`).
2. Vizuál v `src/game/scene/assets/devices.ts` – potomek `DeviceView` (odznak, zvýraznění a animace blokace jsou zděděné).
3. Zaregistrovat ho v `SceneRenderer.init()`.
4. Funkční důsledek do `deviceLogic` a scénáře do `src/game/scenarios/`.

### Grafika

MVP kreslí všechny assety procedurálně (vektorově) přes PixiJS – nic se nestahuje a vše je ostré při každém přiblížení.
Třídy v `scene/assets` a `scene/house.ts` lze kdykoli nahradit sprity / spritesheety (`public/assets/…`) bez zásahu do herní logiky.

## Před ostrým spuštěním

- [ ] Doplnit skutečný název, logo a URL produktu v `src/config/brand.ts`.
- [ ] Ověřit, že texty ochranného režimu odpovídají **reálným schopnostem produktu** (hra nesmí slibovat víc).
- [ ] Případně doplnit GA4 měření (fáze 4).
