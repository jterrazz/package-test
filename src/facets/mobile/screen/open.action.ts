import { DRAWN_DESCRIPTORS, DRAWN_VERBS, WITHIN } from '../../../elements/vocabulary-rows.js';
import { defineAction } from '../../../kernel/chain/action.js';
import type { ChainSignature, MatrixRow } from '../../../kernel/chain/capability.js';
import type { MobileScenario } from '../device/device.port.js';
import type { AppPort } from './app.port.js';
import { ScreenResult } from './screen.result.js';

/** The verb only a device's visitor hands out. */
const TAP: MatrixRow = { group: 'Verb', name: 'tap', probe: '.tap(' };

/** What `.open()` puts on a chain. */
export type OpenSignature = ChainSignature & {
    readonly chain: {
        /**
         * Relaunch the app and resolve with the captured screen. With a deep
         * link, the app opens on it; with a scenario, the visitor interacts
         * first (the When) and the capture reflects the FINAL screen state.
         */
        open: (deepLink?: string, scenario?: MobileScenario) => Promise<ScreenResult>;
    };
};

/**
 * `.open(deepLink?, scenario?)`: relaunch the app from a fresh state, apply
 * the deep link, run the scenario (the When), and resolve with the FINAL
 * screen — its projected tree and its visible texts.
 */
export const open = defineAction<
    'open',
    [deepLink?: string, scenario?: MobileScenario],
    ScreenResult,
    OpenSignature,
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
    verbs: [...DRAWN_VERBS, TAP],
});
