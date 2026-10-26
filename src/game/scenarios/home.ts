import { BRAND } from '../../config/brand';
import type { Scenario, ScenarioContext } from './types';

/**
 * Reakce na útoky na druhou vlnu zařízení: vysavač, televize, hlasový asistent,
 * kamera, pračka a zámek. Každý scénář jen řídí postavičku – vizuál zařízení
 * se odvozuje ze stavu hry (src/game/scene/assets).
 */

const N = BRAND.residentName;

async function pressTimes(ctx: ScenarioContext, times: number, sfx: 'click' | 'buzz' = 'click') {
  for (let i = 0; i < times; i++) {
    ctx.pose('press');
    ctx.sfx(sfx);
    await ctx.wait(420);
    ctx.pose('stand');
    await ctx.wait(280);
  }
}

/* ------------------------------------------------------------------ */
/* Robotický vysavač                                                    */
/* ------------------------------------------------------------------ */

export const vacuumChaos: Scenario = {
  id: 'vacuum-chaos',
  triggers: [{ device: 'vacuum', attack: 'chaos' }],
  async run(ctx) {
    ctx.activity('Vysavač se utrhl ze řetězu');
    ctx.expression('surprised');
    ctx.emote('exclaim', 1200);
    ctx.say('Co to vyvádí?!');
    await ctx.wait(1600);
    await ctx.walkTo('livingMid', 3);
    ctx.face('front');
    ctx.expression('scared');
    await ctx.wait(1200);
    ctx.hop();
    await ctx.wait(400);
    // zakopne o robota
    ctx.sfx('slip');
    ctx.pose('slip');
    ctx.expression('dizzy');
    ctx.emote('dizzy', 2200);
    ctx.comfort(-8);
    ctx.outcome('vacuum-derby');
    await ctx.wait(2600);
    ctx.pose('stand');
    ctx.expression('angry');
    ctx.emote('anger', 1800);
    ctx.say('Kdo tě naprogramoval?!');
    await ctx.wait(2400);
  },
};

export const vacuumChase: Scenario = {
  id: 'vacuum-chase',
  triggers: [{ device: 'vacuum', attack: 'chase' }],
  async run(ctx) {
    ctx.activity(`Vysavač honí ${N}a`);
    ctx.expression('confused');
    ctx.emote('question', 1300);
    ctx.say('Proč jedeš za mnou?');
    await ctx.wait(1500);
    ctx.expression('scared');
    ctx.emote('exclaim', 1000);
    ctx.sfx('yelp');
    await ctx.walkTo('front', 3.6);
    await ctx.walkTo('tvFront', 3.6);
    await ctx.walkTo('livingMid', 3.6);
    await ctx.walkTo('sofaSeat', 3.6);
    ctx.face('front');
    ctx.pose('tuck');
    ctx.say('Nech mě být!');
    ctx.outcome('vacuum-chase');
    ctx.comfort(-7);
    for (let i = 0; i < 3; i++) {
      await ctx.wait(1800);
      ctx.emote(i === 1 ? 'anger' : 'exclaim', 1200);
    }
    await ctx.wait(1500);
  },
};

export const vacuumMap: Scenario = {
  id: 'vacuum-map',
  triggers: [{ device: 'vacuum', attack: 'map' }],
  async run(ctx) {
    ctx.activity('Vysavač pečlivě mapuje byt');
    await ctx.walkTo('livingMid');
    ctx.face('front');
    ctx.expression('confused');
    ctx.emote('question', 1600);
    ctx.say('Dneska uklízí nějak důkladně…');
    await ctx.wait(4000);
    ctx.pose('phone');
    ctx.sfx('data');
    await ctx.wait(1500);
    ctx.expression('surprised');
    ctx.emote('exclaim', 1400);
    ctx.say('„Mapa bytu odeslána“? Komu?!');
    ctx.outcome('house-map');
    ctx.comfort(-5);
    await ctx.wait(3200);
    ctx.pose('stand');
  },
};

/* ------------------------------------------------------------------ */
/* Chytrá televize                                                      */
/* ------------------------------------------------------------------ */

export const tvLoud: Scenario = {
  id: 'tv-loud',
  triggers: [{ device: 'tv', attack: 'loud' }],
  async run(ctx) {
    ctx.activity('Televize řve na celý dům');
    ctx.hop();
    ctx.sfx('yelp');
    ctx.expression('scared');
    ctx.emote('exclaim', 1100);
    ctx.pose('ears');
    ctx.say('Moje uši!');
    await ctx.wait(2200);
    ctx.pose('stand');
    await ctx.walkTo('tvFront', 3);
    ctx.face('sw');
    ctx.expression('angry');
    await pressTimes(ctx, 3);
    ctx.pose('ears');
    ctx.emote('anger', 1800);
    ctx.say('Nejde to vypnout!');
    ctx.outcome('tv-blast');
    ctx.comfort(-8);
    await ctx.wait(2800);
  },
};

export const tvAds: Scenario = {
  id: 'tv-ads',
  triggers: [{ device: 'tv', attack: 'ads' }],
  async run(ctx) {
    ctx.activity('Na televizi běží reklamy');
    await ctx.walkTo('sofaSeat');
    ctx.face('front');
    ctx.pose('sit');
    ctx.expression('confused');
    ctx.emote('question', 1500);
    ctx.sfx('jingle');
    ctx.say('Zase reklama?');
    await ctx.wait(3200);
    ctx.sfx('jingle');
    ctx.expression('tired');
    ctx.say('Ovladač vůbec nereaguje…');
    await ctx.wait(2600);
    ctx.expression('sad');
    ctx.outcome('ad-storm');
    ctx.comfort(-5);
    await ctx.wait(2000);
  },
};

export const tvSpy: Scenario = {
  id: 'tv-spy',
  triggers: [{ device: 'tv', attack: 'spy' }],
  async run(ctx) {
    ctx.activity(`${N} telefonuje`);
    await ctx.walkTo('livingMid');
    ctx.face('front');
    ctx.pose('phone');
    ctx.expression('happy');
    ctx.say('Ahoj mami! Jo, všechno v pohodě.');
    await ctx.wait(2600);
    ctx.say('Klíč nechám zase pod rohožkou.');
    await ctx.wait(2600);
    ctx.say('Odjíždím v pátek na týden.');
    ctx.outcome('tv-spy');
    ctx.comfort(-2);
    await ctx.wait(2600);
    ctx.pose('stand');
    ctx.face('se');
    ctx.expression('confused');
    ctx.emote('question', 1800);
    ctx.say('Proč na televizi svítí červená tečka?');
    await ctx.wait(2600);
  },
};

/* ------------------------------------------------------------------ */
/* Hlasový asistent                                                     */
/* ------------------------------------------------------------------ */

export const speakerOrder: Scenario = {
  id: 'speaker-order',
  triggers: [{ device: 'speaker', attack: 'order' }],
  async run(ctx) {
    ctx.activity('Asistent nakupuje');
    ctx.expression('surprised');
    ctx.emote('exclaim', 1200);
    await ctx.wait(1400);
    ctx.say('Cože? Padesát pizz?!');
    await ctx.walkTo('tvFront', 3);
    ctx.face('front');
    ctx.expression('angry');
    ctx.say('Zruš tu objednávku!');
    await pressTimes(ctx, 2);
    await ctx.wait(1600);
    ctx.emote('anger', 1500);
    await ctx.walkTo('entry');
    ctx.face('sw');
    ctx.expression('surprised');
    ctx.emote('exclaim', 1200);
    ctx.say('Už to vozí…');
    ctx.outcome('pizza-party');
    ctx.comfort(-5);
    await ctx.wait(2400);
    ctx.expression('confused');
    ctx.say('Tak aspoň večeře je.');
    await ctx.wait(2200);
  },
};

export const speakerCreepy: Scenario = {
  id: 'speaker-creepy',
  triggers: [{ device: 'speaker', attack: 'creepy' }],
  async run(ctx) {
    ctx.activity('Asistent mluví sám od sebe');
    ctx.hop();
    ctx.sfx('yelp');
    ctx.expression('scared');
    ctx.emote('exclaim', 1200);
    ctx.say('Kdo to řekl?!');
    await ctx.wait(1800);
    ctx.face('left');
    await ctx.wait(700);
    ctx.face('right');
    await ctx.wait(700);
    ctx.face('front');
    ctx.emote('question', 1400);
    await ctx.wait(1200);
    await ctx.walkTo('sofaSeat', 3.4);
    ctx.face('front');
    ctx.pose('blanket');
    ctx.flag('shiver', true);
    ctx.say('Já tu nejsem…');
    ctx.outcome('ghost-voice');
    ctx.comfort(-8);
    await ctx.wait(4500);
  },
};

/* ------------------------------------------------------------------ */
/* Bezpečnostní kamera                                                  */
/* ------------------------------------------------------------------ */

export const cameraPeek: Scenario = {
  id: 'camera-peek',
  triggers: [{ device: 'camera', attack: 'peek' }],
  async run(ctx) {
    ctx.activity('Kamera sleduje každý krok');
    await ctx.walkTo('window');
    ctx.face('right');
    ctx.expression('confused');
    ctx.emote('question', 1500);
    ctx.say('Proč se kamera otáčí za mnou?');
    await ctx.wait(2400);
    await ctx.walkTo('livingMid');
    ctx.face('right');
    await ctx.wait(800);
    await ctx.walkTo('front');
    ctx.face('right');
    ctx.expression('scared');
    ctx.emote('exclaim', 1400);
    ctx.say('Někdo se na mě dívá!');
    ctx.outcome('watched');
    ctx.comfort(-6);
    await ctx.wait(2400);
    ctx.pose('phone');
    ctx.expression('sad');
    ctx.say('A já nevím kdo…');
    await ctx.wait(2600);
  },
};

export const cameraOff: Scenario = {
  id: 'camera-off',
  triggers: [{ device: 'camera', attack: 'off' }],
  async run(ctx) {
    ctx.activity(`${N} kontroluje kameru`);
    ctx.pose('phone');
    ctx.sfx('beep');
    ctx.expression('confused');
    ctx.emote('question', 1600);
    ctx.say('Kamera je offline?');
    await ctx.wait(2500);
    ctx.pose('stand');
    await ctx.walkTo('window');
    ctx.face('right');
    ctx.say('Vždyť tu visí…');
    ctx.outcome('blind-spot');
    ctx.comfort(-2);
    await ctx.wait(2400);
    if (ctx.mode('lock') === 'unlock') {
      ctx.expression('scared');
      ctx.emote('exclaim', 1600);
      ctx.say('A dveře jsou otevřené!');
      ctx.outcome('open-house');
      ctx.comfort(-6);
      await ctx.wait(2400);
    }
  },
};

/* ------------------------------------------------------------------ */
/* Chytrá pračka                                                        */
/* ------------------------------------------------------------------ */

export const washerSpin: Scenario = {
  id: 'washer-spin',
  triggers: [{ device: 'washer', attack: 'spin' }],
  async run(ctx) {
    ctx.activity('Pračka se utrhla');
    ctx.expression('surprised');
    ctx.emote('exclaim', 1200);
    ctx.say('Co tam tak duní?');
    await ctx.wait(1500);
    await ctx.walkTo('washer', 3);
    ctx.face('nw');
    ctx.expression('scared');
    await pressTimes(ctx, 2);
    ctx.pose('ears');
    ctx.say('Nejde zastavit!');
    ctx.emote('anger', 1600);
    ctx.outcome('washer-quake');
    ctx.comfort(-5);
    await ctx.wait(3000);
    ctx.pose('stand');
  },
};

export const washerFlood: Scenario = {
  id: 'washer-flood',
  triggers: [{ device: 'washer', attack: 'flood' }],
  async run(ctx) {
    ctx.activity('Pračka vypouští vodu');
    ctx.expression('confused');
    ctx.emote('question', 1300);
    ctx.say('Neteče tam něco?');
    await ctx.wait(2600);
    ctx.sfx('splash');
    await ctx.walkTo('bathCenter', 3);
    await ctx.walkTo('washer', 2.4);
    ctx.sfx('slip');
    ctx.pose('slip');
    ctx.flag('wet', true);
    ctx.expression('dizzy');
    ctx.emote('dizzy', 2200);
    ctx.say('Au! Všude voda!');
    ctx.outcome('flood');
    ctx.comfort(-10);
    await ctx.wait(2800);
    ctx.pose('stand');
    ctx.expression('sad');
    await ctx.walkTo('bathMat');
    ctx.face('front');
    await ctx.wait(1500);
  },
};

/* ------------------------------------------------------------------ */
/* Chytrý zámek                                                         */
/* ------------------------------------------------------------------ */

export const lockUnlock: Scenario = {
  id: 'lock-unlock',
  triggers: [{ device: 'lock', attack: 'unlock' }],
  async run(ctx) {
    ctx.activity('Dveře se samy otevřely');
    ctx.expression('surprised');
    ctx.emote('exclaim', 1200);
    await ctx.wait(1300);
    ctx.say('Dveře se otevřely?');
    await ctx.walkTo('entry', 3);
    ctx.face('sw');
    ctx.pose('press');
    ctx.scene('doorHeld', true);
    ctx.sfx('click');
    await ctx.wait(700);
    ctx.pose('stand');
    ctx.expression('neutral');
    ctx.say('Tak. Zavřeno.');
    await ctx.wait(1800);
    ctx.face('front');
    await ctx.wait(500);
    ctx.scene('doorHeld', false);
    await ctx.wait(700);
    ctx.face('sw');
    ctx.hop();
    ctx.expression('scared');
    ctx.emote('exclaim', 1400);
    ctx.say('Zase?!');
    ctx.outcome('open-door');
    ctx.comfort(-6);
    if (ctx.mode('camera') === 'off') ctx.outcome('open-house');
    await ctx.wait(1800);
    ctx.pose('press');
    ctx.scene('doorHeld', true);
    ctx.say('Budu je radši hlídat.');
    await ctx.wait(3500);
  },
};

export const lockJam: Scenario = {
  id: 'lock-jam',
  triggers: [{ device: 'lock', attack: 'jam' }],
  async run(ctx) {
    ctx.activity(`${N} chce jít ven`);
    ctx.expression('happy');
    ctx.say('Jdu se projít!');
    await ctx.walkTo('entry');
    ctx.face('sw');
    ctx.expression('confused');
    await pressTimes(ctx, 3, 'buzz');
    ctx.expression('angry');
    ctx.emote('anger', 1600);
    ctx.say('Nejde otevřít!');
    await ctx.wait(1800);
    ctx.pose('phone');
    ctx.say('„Chyba zámku“… a co teď?');
    ctx.outcome('locked-in');
    ctx.comfort(-6);
    await ctx.wait(2800);
    ctx.pose('stand');
  },
};

export const homeReactions: Scenario[] = [
  vacuumChaos,
  vacuumChase,
  vacuumMap,
  tvLoud,
  tvAds,
  tvSpy,
  speakerOrder,
  speakerCreepy,
  cameraPeek,
  cameraOff,
  washerSpin,
  washerFlood,
  lockUnlock,
  lockJam,
];
