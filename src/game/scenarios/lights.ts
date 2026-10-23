import { BRAND } from '../../config/brand';
import { darkAndCold } from './heating';
import type { Scenario, ScenarioContext } from './types';

const N = BRAND.residentName;

async function pressSwitch(ctx: ScenarioContext, times: number) {
  await ctx.walkTo('switch');
  ctx.face('back');
  for (let i = 0; i < times; i++) {
    ctx.pose('press');
    ctx.sfx('click');
    await ctx.wait(380);
    ctx.pose('stand');
    await ctx.wait(260);
  }
  ctx.face('front');
}

export const lightsFlicker: Scenario = {
  id: 'lights-flicker',
  triggers: [{ device: 'lights', attack: 'flicker' }],
  async run(ctx) {
    ctx.activity('Světla zlobí');
    ctx.expression('surprised');
    ctx.emote('exclaim', 1100);
    await ctx.wait(1000);
    ctx.expression('confused');
    ctx.emote('question', 1500);
    ctx.say('Co to blbne?');
    await ctx.wait(1200);
    ctx.activity(`${N} zkouší vypínač`);
    await pressSwitch(ctx, 3);
    ctx.expression('dizzy');
    ctx.emote('dizzy', 2200);
    ctx.say('Točí se mi hlava…');
    ctx.comfort(-8);
    ctx.outcome('disco');
    await ctx.wait(2600);
  },
};

export const lightsOff: Scenario = {
  id: 'lights-off',
  triggers: [{ device: 'lights', attack: 'off' }],
  async run(ctx) {
    ctx.activity('Zhasla světla');
    ctx.expression('scared');
    ctx.emote('exclaim', 1200);
    ctx.sfx('yelp');
    ctx.hop();
    ctx.say('Kdo zhasnul?!');
    await ctx.wait(1300);
    ctx.flag('flashlight', true);
    ctx.activity(`${N} hledá vypínač`);
    await pressSwitch(ctx, 2);
    ctx.expression('sad');
    ctx.emote('question', 1600);
    ctx.say('Vypínač nefunguje…');
    ctx.comfort(-10);
    ctx.outcome('darkness');
    await ctx.wait(2200);
    if (ctx.heating() === 'off') await darkAndCold(ctx);
  },
};

export const lightsParty: Scenario = {
  id: 'lights-party',
  triggers: [{ device: 'lights', attack: 'party' }],
  async run(ctx) {
    ctx.activity('Duhová světla!');
    ctx.expression('surprised');
    ctx.emote('exclaim', 1000);
    await ctx.wait(1000);
    ctx.expression('confused');
    ctx.emote('question', 1300);
    await ctx.wait(1300);
    ctx.say('No… tak jo!');
    await ctx.walkTo('front');
    ctx.face('front');
    ctx.pose('dance');
    ctx.expression('happy');
    ctx.outcome('party');
    ctx.activity(`${N} tancuje`);
    for (let i = 0; i < 3; i++) {
      ctx.emote('note', 1200);
      await ctx.wait(1400);
    }
    ctx.pose('stand');
    ctx.expression('confused');
    ctx.say('Ale kdo to vlastně ovládá?');
    ctx.emote('question', 1800);
    ctx.comfort(-3);
    await ctx.wait(2400);
  },
};
