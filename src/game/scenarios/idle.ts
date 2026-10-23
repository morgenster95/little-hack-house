import { BRAND } from '../../config/brand';
import type { Scenario } from './types';

const N = BRAND.residentName;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Běžné autonomní aktivity postavičky. Podmínky reagují na aktuální stav zařízení. */
export const idleActivities: Scenario[] = [
  {
    id: 'watch-tv',
    idle: { weight: 4, when: (c) => c.lights() !== 'off' && c.heating() !== 'off' },
    async run(ctx) {
      ctx.activity(`${N} sleduje televizi`);
      await ctx.walkTo('sofaSeat');
      ctx.face('front');
      ctx.pose('sit');
      ctx.scene('tv', true);
      ctx.expression('happy');
      for (let i = 0; i < 3; i++) {
        await ctx.wait(rnd(2200, 3400));
        ctx.emote(Math.random() < 0.5 ? 'note' : 'heart', 1400);
      }
      await ctx.wait(1500);
      ctx.scene('tv', false);
    },
  },
  {
    id: 'read',
    idle: { weight: 3, when: (c) => c.lights() === 'normal' },
    async run(ctx) {
      ctx.activity(`${N} si čte v křesle`);
      await ctx.walkTo('armchair');
      ctx.face('front');
      ctx.pose('read');
      ctx.expression('neutral');
      await ctx.wait(rnd(5000, 8000));
      ctx.emote('sparkle', 1500);
      await ctx.wait(1500);
    },
  },
  {
    id: 'window',
    idle: { weight: 2 },
    async run(ctx) {
      ctx.activity(`${N} kouká z okna`);
      await ctx.walkTo('window');
      ctx.face('back');
      await ctx.wait(rnd(3000, 4500));
      ctx.face('front');
      ctx.expression('happy');
      ctx.emote('heart', 1400);
      await ctx.wait(1400);
    },
  },
  {
    id: 'plant',
    idle: { weight: 2 },
    async run(ctx) {
      ctx.activity(`${N} zalévá kytku`);
      await ctx.walkTo('plant');
      ctx.face('front');
      ctx.pose('press');
      await ctx.wait(1800);
      ctx.pose('stand');
      ctx.expression('happy');
      ctx.emote('sparkle', 1400);
      await ctx.wait(1500);
    },
  },
  {
    id: 'wash-hands',
    idle: { weight: 1.5 },
    async run(ctx) {
      ctx.activity(`${N} si myje ruce`);
      await ctx.walkTo('sink');
      ctx.face('back');
      ctx.pose('press');
      ctx.sfx('water');
      await ctx.wait(2200);
      ctx.pose('stand');
      ctx.face('front');
      await ctx.wait(600);
    },
  },
  {
    id: 'nap',
    idle: { weight: 1.5, when: (c) => c.heating() !== 'off' },
    async run(ctx) {
      ctx.activity(`${N} dáchá na gauči`);
      await ctx.walkTo('sofaSeat');
      ctx.face('front');
      ctx.pose('sleep');
      ctx.expression('sleepy');
      for (let i = 0; i < 3; i++) {
        ctx.emote('zzz', 2200);
        await ctx.wait(2400);
      }
      ctx.pose('sit');
      ctx.expression('happy');
      await ctx.wait(900);
    },
  },
  {
    id: 'shower-normal',
    idle: { weight: 1.2 },
    async run(ctx) {
      ctx.activity(`${N} se sprchuje`);
      await ctx.walkTo('shower');
      ctx.face('front');
      ctx.flag('showerCap', true);
      ctx.pose('shower');
      const hot = ctx.hotWater();
      ctx.scene(hot ? 'showerHot' : 'showerCold', true);
      ctx.sfx('water');
      if (!hot) {
        await ctx.wait(1200);
        ctx.scene('showerCold', false);
        ctx.flag('showerCap', false);
        ctx.pose('stand');
        ctx.expression('cold');
        ctx.emote('snow');
        ctx.say('Pořád ledová…');
        ctx.comfort(-5);
        await ctx.walkTo('bathMat');
        await ctx.wait(1500);
        return;
      }
      ctx.expression('relieved');
      ctx.emote('note', 1600);
      await ctx.wait(3500);
      ctx.scene('showerHot', false);
      ctx.flag('showerCap', false);
      ctx.pose('stand');
      ctx.expression('happy');
      await ctx.walkTo('bathMat');
      await ctx.wait(700);
    },
  },
  {
    id: 'stretch',
    idle: { weight: 1 },
    async run(ctx) {
      ctx.activity(`${N} se protahuje`);
      await ctx.walkTo('front');
      ctx.face('front');
      ctx.pose('dance');
      ctx.expression('happy');
      await ctx.wait(1500);
      ctx.pose('stand');
      ctx.hop();
      await ctx.wait(900);
    },
  },
  // --- aktivity podmíněné útoky ---
  {
    id: 'cold-blanket',
    idle: { weight: 6, when: (c) => c.heating() === 'off' },
    async run(ctx) {
      ctx.activity(`${N} mrzne pod dekou`);
      await ctx.walkTo('sofaSeat');
      ctx.face('front');
      ctx.pose('blanket');
      ctx.expression('cold');
      ctx.flag('shiver', true);
      await ctx.wait(2500);
      ctx.emote('snow', 2000);
      ctx.comfort(-2);
      await ctx.wait(3500);
    },
  },
  {
    id: 'hot-window',
    idle: { weight: 6, when: (c) => c.heating() === 'max' },
    async run(ctx) {
      ctx.activity(`${N} se ovívá u okna`);
      ctx.flag('sweat', true);
      await ctx.walkTo('window');
      ctx.scene('windowOpen', true);
      ctx.face('front');
      ctx.expression('hot');
      ctx.emote('sweat', 2000);
      ctx.comfort(-2);
      await ctx.wait(4500);
    },
  },
  {
    id: 'dark-sad',
    idle: { weight: 6, when: (c) => c.lights() === 'off' },
    async run(ctx) {
      ctx.activity(`${N} sedí potmě`);
      ctx.flag('flashlight', true);
      await ctx.walkTo('sofaSeat');
      ctx.face('front');
      ctx.pose('sit');
      ctx.expression('sad');
      await ctx.wait(3000);
      ctx.emote('question', 1600);
      ctx.comfort(-2);
      await ctx.wait(3000);
    },
  },
  {
    id: 'disco-annoyed',
    idle: { weight: 5, when: (c) => c.lights() === 'flicker' },
    async run(ctx) {
      ctx.activity(`${N} je z blikání nervózní`);
      await ctx.walkTo('livingMid');
      ctx.face('front');
      ctx.expression('angry');
      ctx.emote('anger', 1800);
      ctx.comfort(-2);
      await ctx.wait(3500);
    },
  },
];
