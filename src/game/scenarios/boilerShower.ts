import { BRAND } from '../../config/brand';
import type { Scenario, ScenarioContext } from './types';

const N = BRAND.residentName;

/** Po studené sprše: pokus o zahřátí u radiátoru – výsledek závisí na stavu topení. */
export async function warmUpAtRadiator(ctx: ScenarioContext) {
  ctx.activity(`${N} se jde zahřát k topení`);
  ctx.say('Musím se zahřát…', 1800);
  await ctx.walkTo('radiator', 2.9);
  ctx.face('back');
  ctx.pose('warm');
  await ctx.wait(1500);
  const heat = ctx.heating();
  if (heat !== 'off') {
    ctx.flag('shiver', false);
    ctx.flag('warmGlow', true);
    ctx.expression('relieved');
    ctx.face('front');
    ctx.emote('heart', 2200);
    ctx.say(heat === 'max' ? 'Teplo! Možná až moc…' : 'Áách, teplíčko.');
    ctx.sfx('relief');
    ctx.comfort(12);
    ctx.outcome('warmed-up');
    await ctx.wait(2600);
    ctx.flag('wet', false);
    ctx.flag('warmGlow', false);
    ctx.expression('happy');
    await ctx.wait(800);
  } else {
    ctx.face('front');
    ctx.expression('surprised');
    ctx.emote('question', 1200);
    await ctx.wait(1100);
    ctx.expression('angry');
    ctx.emote('anger', 2000);
    ctx.hop();
    ctx.sfx('angry');
    ctx.say('Cože?! Ani topení?!', 2200);
    ctx.comfort(-15);
    ctx.outcome('double-trouble');
    await ctx.wait(2100);
    ctx.activity(`${N} se balí do deky`);
    await ctx.walkTo('sofaSeat');
    ctx.face('front');
    ctx.flag('wet', false);
    ctx.pose('blanket');
    ctx.expression('cold');
    ctx.emote('snow', 2500);
    await ctx.wait(4500);
  }
}

export const boilerShower: Scenario = {
  id: 'boiler-shower',
  triggers: [{ device: 'boiler' }],
  async run(ctx, info) {
    ctx.activity(`${N} jde do sprchy`);
    ctx.expression('happy');
    ctx.say('Čas na sprchu!', 1600);
    await ctx.walkTo('shower');
    ctx.face('front');
    ctx.flag('showerCap', true);
    ctx.pose('shower');
    const hot = ctx.hotWater();
    ctx.scene(hot ? 'showerHot' : 'showerCold', true);
    ctx.sfx('water');
    ctx.emote('note', 1400);
    await ctx.wait(1500);

    if (hot) {
      ctx.expression('relieved');
      ctx.emote('sparkle', 2000);
      await ctx.wait(2600);
      ctx.scene('showerHot', false);
      ctx.pose('stand');
      ctx.flag('showerCap', false);
      ctx.say('Teplá voda, paráda.');
      await ctx.walkTo('bathMat');
      ctx.comfort(5);
      await ctx.wait(1200);
      return;
    }

    // Studená voda!
    ctx.expression('surprised');
    ctx.emote('exclaim', 1200);
    ctx.sfx('yelp');
    ctx.hop();
    await ctx.wait(450);
    ctx.scene('showerCold', false);
    ctx.flag('showerCap', false);
    ctx.flag('wet', true);
    ctx.pose('stand');
    await ctx.walkTo('bathMat', 3.6);
    ctx.face('front');
    ctx.flag('shiver', true);
    ctx.expression('cold');
    ctx.emote('snow', 2200);
    ctx.sfx('shiver');
    const fault = info?.attack === 'fault';
    ctx.say(fault ? 'Bojler hlásí chybu?!' : 'Brrr! Ledová!', 2200);
    ctx.comfort(-20);
    ctx.outcome(fault ? 'boiler-fault' : 'cold-shower');
    if (fault) ctx.outcome('cold-shower');
    await ctx.wait(2300);
    if (ctx.lights() === 'off') {
      ctx.expression('sad');
      ctx.say('A ještě potmě…', 1700);
      await ctx.wait(1700);
      ctx.expression('cold');
    }
    await warmUpAtRadiator(ctx);
  },
};
