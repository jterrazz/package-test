import { defineAction } from '../../model/chain/action.js';
import type { MobileScenario } from '../../model/ports/device.port.js';
import { ScreenResult } from '../../results/screen.result.js';
import type { AppPort } from './open.port.js';

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
    name: 'open',
    perform: async ([deepLink, scenario], _read, { app }, { config, testDir }) =>
        new ScreenResult({ config, screen: await app.open(deepLink, scenario), testDir }),
    row: { group: 'Terminal action', name: '.open()', probe: '.open(' },
});
