import { DRAWN_DESCRIPTORS, DRAWN_VERBS, OWN_VERBS, WITHIN } from '../../../elements/rows.js';
import { defineAction } from '../../../kernel/chain/action.js';
import type { MobileScenario } from '../device/device.port.js';
import type { AppPort } from './open.port.js';
import { ScreenResult } from './screen.result.js';

/**
 * `.open(deepLink?, scenario?)`: relaunch the app from a fresh state, apply
 * the deep link, run the scenario (the When), and resolve with the FINAL
 * screen — its projected tree and its visible texts.
 */
export const open = defineAction<
    'open',
    [deepLink?: string, scenario?: MobileScenario],
    ScreenResult,
    { app: AppPort }
>({
    accessors: [
        { group: 'Result accessor', name: '.content', probe: 'result.content' },
        { group: 'Result accessor', name: '.screen', probe: 'result.screen' },
    ],
    descriptors: [...DRAWN_DESCRIPTORS, WITHIN],
    name: 'open',
    perform: async ([deepLink, scenario], _read, { app }, { config, testDir }) =>
        new ScreenResult({ config, screen: await app.open(deepLink, scenario), testDir }),
    row: { group: 'Terminal action', name: '.open()', probe: '.open(' },
    verbs: [...DRAWN_VERBS, OWN_VERBS.tap],
});
