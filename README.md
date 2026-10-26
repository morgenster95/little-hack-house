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
| Izometrický dům – koupelna + obývák, nábytek, dekorace | ✅ 3D render z Blenderu (three.js), postavička jako živý 3D model s animacemi |
| Konfigurátor (9 zařízení: bojler, topení, osvětlení, robotický vysavač, televize, hlasový asistent, kamera, pračka, zámek + kávovar a lednice „již brzy") | ✅ karty i klepnutí přímo do scény, ukládání do localStorage |
| Běžná vs. chytrá varianta zařízení | ✅ chytrá má displej, LED a odznak stavu |
| Simulované útoky (22 útoků na 9 zařízení) | ✅ živé 3D prvky: jezdící vysavač, otočná kamera, buben pračky, louže, dveře |
| Animovaná postavička s autonomním chováním | ✅ 3D model se 14 animacemi, 20 aktivit, 13 výrazů, 12 emoji bublin |
| Hlavní scénář bojler → studená sprcha → radiátor | ✅ výsledek se liší podle stavu topení |
| Kombinace útoků | ✅ např. tma + zima, studená sprcha potmě, odemčené dveře + vypnutá kamera |
| Ochranný režim produktu | ✅ obnovení zařízení, štít kolem domu, blokace útoků |
| Závěrečné vyhodnocení | ✅ statistiky, 26 objevitelných situací, rizika, CTA, sdílení |
| Zvuky + hudba | ✅ syntetizované přes WebAudio (bez souborů), lze vypnout |
| Mobil | ✅ spodní panel, posun a přiblížení scény prsty |
| Nasazení | ✅ GitHub Actions → GitHub Pages |

## Grafika domu (Blender)

Dům je vymodelovaný skriptem `tools/blender/house.py` a vyrenderovaný v Blenderu (Cycles).
Hra zobrazuje hotový obrázek `public/assets/scene/scene.webp` a k němu hloubkovou mapu
`scene_depth.png`, díky které se postavička schová za nábytek a stěny. Živé prvky
(displeje bojleru a termostatu, chytré žárovky) jsou ve hře jako 3D objekty (`src/game/scene/three/`),
efekty, odznaky a bubliny kreslí Pixi vrstva nad scénou.

Přegenerování po úpravě `house.py` (Blender 5.x, Python s Pillow):

```bash
cd tools/blender
blender -b --factory-startup --python house.py -- <export_dir> export 3072   # barva + hloubka
python pack.py <export_dir> ../../public/assets/scene                       # ořez, WebP, zabalení hloubky
blender -b --factory-startup --python house.py -- <out_dir> final           # jen náhledový render
```

Rozmístění v `house.py` odpovídá mřížce v `src/config/layout.ts` (1 dlaždice = 0,65 m).

## Postavička Toník (Blender → three.js)

Toník je 3D model `public/assets/character/avatar.glb`, který vytváří skript `tools/blender/avatar.py`
(tvary, kostra a akce pro všechny pózy: `idle`, `walk`, `sit`, `sleep`, `blanket`, `read`, `warm`, `press`, `shower`, `dance`).
Ve hře ho přehrává `src/game/scene/three/Avatar3D.ts` – přepíná animace podle pózy, natáčí postavu ve směru chůze,
mění barvy (zima, horko, mokré vlasy, sprcha) a zapíná doplňky (deka, kniha, ručník, čepice).
Výraz obličeje se kreslí do plátna (`src/game/scene/face.ts`), které je texturou na obličeji modelu.
Za nábytek se postava schová sama díky hloubkové mapě podkladu.

```bash
cd tools/blender
blender -b --factory-startup --python avatar.py -- ../../public/assets/character glb        # model do hry
blender -b --factory-startup --python avatar.py -- <out_dir> preview [iso|side]            # .blend + náhled všech póz
```

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
│   ├── robots/                # logika robotického vysavače (úklid, dok, útoky) bez grafiky
│   ├── scenarios/             # PŘÍBĚHY: reakce na útoky + volné aktivity
│   └── scene/                 # VYKRESLOVÁNÍ: 3D vrstva (three.js) + efekty a UI ve scéně (PixiJS)
└── components/                # React UI: úvod, konfigurátor, hackerský panel, vyhodnocení
```

### Hlavní principy

- **Logika odděleně od grafiky.** Scénáře ovládají postavičku jen přes rozhraní `ScenarioContext`
  (`walkTo`, `emote`, `say`, `hotWater()`, `heating()`…). O vykreslování nevědí nic.
- **Stavy zařízení:** `normal`, `compromised`, `disabled`, `protected`, `recovering`.
  Funkční důsledky (je teplá voda? topí se?) odvozuje `deviceLogic` v `gameStore.ts`.
- **Hloubka z Blenderu:** podklad zapisuje do depth bufferu hloubku z renderu, takže živé 3D objekty
  (postava, vysavač, dveře…) se samy schovají za nábytek a stěny.
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
2. Vizuál v `src/game/scene/assets/` – potomek `DeviceView` (odznak, zvýraznění a animace blokace jsou zděděné).
   Živé 3D díly používají materiály z `scene/three/toon.ts`, aby jasem seděly k zapečenému podkladu.
   Pohyblivé zařízení může posouvat odznak (`badgeAnchor`) i oblast klepnutí (`setHitAreas`) – viz `vacuum.ts`.
3. Zaregistrovat ho v `SceneRenderer.init()`.
4. Scénáře do `src/game/scenarios/` – stav zařízení zjistí přes `ctx.mode(id)` (vrací aktivní útok nebo `normal`).

### Grafika

Dům je předrenderovaný v Blenderu (`tools/blender/house.py`), postavička je 3D model (`tools/blender/avatar.py`).
Živé prvky zařízení jsou malé 3D objekty v `scene/three` a `scene/assets`, efekty, bubliny a odznaky kreslí PixiJS nad scénou.
Zvuky se syntetizují přes WebAudio (`game/engine/audio.ts`), nic se nestahuje.

## Před ostrým spuštěním

- [ ] Doplnit skutečný název, logo a URL produktu v `src/config/brand.ts`.
- [ ] Ověřit, že texty ochranného režimu odpovídají **reálným schopnostem produktu** (hra nesmí slibovat víc).
- [ ] Případně doplnit GA4 měření (fáze 4).
