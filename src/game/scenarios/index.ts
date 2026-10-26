import type { DeviceId } from '../../config/devices';
import { BRAND } from '../../config/brand';
import { boilerShower } from './boilerShower';
import { heatingMax, heatingOff } from './heating';
import { homeReactions } from './home';
import { idleActivities } from './idle';
import { lightsFlicker, lightsOff, lightsParty } from './lights';
import type { Scenario } from './types';

/** Registr scénářů. Nový příběh = nový soubor + přidání sem. */
export const reactionScenarios: Scenario[] = [boilerShower, heatingOff, heatingMax, lightsFlicker, lightsOff, lightsParty, ...homeReactions];
export { idleActivities };

export function findReaction(device: DeviceId, attack: string): Scenario | undefined {
  return reactionScenarios.find((s) => s.triggers?.some((t) => t.device === device && (!t.attack || t.attack === attack)));
}

/** Krátká reakce na obnovení / ochranu. */
export const reliefScenario: Scenario = {
  id: 'relief',
  async run(ctx) {
    ctx.activity(`${BRAND.residentName} si oddychl`);
    ctx.pose('stand');
    ctx.face('front');
    ctx.expression('relieved');
    ctx.emote('heart', 2000);
    ctx.say('Konečně zase klid!', 2000);
    ctx.sfx('relief');
    ctx.comfort(10);
    await ctx.wait(2200);
  },
};
