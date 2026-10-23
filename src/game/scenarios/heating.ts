import { BRAND } from '../../config/brand';
import type { Scenario, ScenarioContext } from './types';

const N = BRAND.residentName;

export async function darkAndCold(ctx: ScenarioContext) {
  ctx.activity(`${N} přežívá ve tmě a zimě`);
  await ctx.walkTo('sofaSeat');
  ctx.face('front');
  ctx.pose('blanket');
  ctx.flag('flashlight', true);
  ctx.expression('sad');
  ctx.say('Tma a zima. Paráda.', 2400);
  ctx.outcome('cozy-apocalypse');
  ctx.comfort(-10);
  await ctx.wait(2600);
  ctx.emote('snow', 2000);
  await ctx.wait(3000);
}

export const heatingOff: Scenario = {
  id: 'heating-off',
  triggers: [{ device: 'heating', attack: 'off' }],
  async run(ctx) {
    ctx.activity('V bytě se ochlazuje');
    await ctx.wait(1400);
    ctx.expression('cold');
    ctx.emote('snow', 1800);
    ctx.flag('shiver', true);
    ctx.say('Nějak tu táhne…');
    await ctx.wait(1500);
    ctx.activity(`${N} kontroluje topení`);
    await ctx.walkTo('radiator');
    ctx.face('back');
    ctx.pose('warm');
    await ctx.wait(1300);
    ctx.face('front');
    ctx.pose('stand');
    ctx.expression('confused');
    ctx.emote('question', 1600);
    ctx.say('Studený radiátor?');
    ctx.comfort(-10);
    ctx.outcome('cold-living');
    await ctx.wait(1900);
    if (ctx.lights() === 'off') {
      await darkAndCold(ctx);
      return;
    }
    ctx.activity(`${N} se balí do deky`);
    await ctx.walkTo('sofaSeat');
    ctx.face('front');
    ctx.pose('blanket');
    ctx.expression('cold');
    await ctx.wait(4500);
  },
};

export const heatingMax: Scenario = {
  id: 'heating-max',
  triggers: [{ device: 'heating', attack: 'overheat' }],
  async run(ctx) {
    ctx.activity('V bytě se otepluje… hodně');
    await ctx.wait(1500);
    ctx.flag('sweat', true);
    ctx.expression('hot');
    ctx.emote('sweat', 1800);
    ctx.say('Uff, to je vedro!');
    ctx.sfx('angry');
    await ctx.wait(1600);
    ctx.activity(`${N} jde otevřít okno`);
    await ctx.walkTo('window');
    ctx.face('back');
    ctx.pose('press');
    await ctx.wait(500);
    ctx.scene('windowOpen', true);
    ctx.sfx('click');
    ctx.pose('stand');
    await ctx.wait(1300);
    ctx.face('front');
    ctx.expression('tired');
    ctx.say('Kdo topí na plný pecky?');
    ctx.comfort(-8);
    ctx.outcome('heatwave');
    await ctx.wait(3200);
  },
};
