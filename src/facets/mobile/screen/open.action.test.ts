import { describe, expect, test } from 'vitest';

import type { DeviceScreen, MobileScenario } from '../device/device.port.js';
import { open } from './open.action.js';

/** Where the action runs: no databases, no working directory. */
const RUN = { config: {}, testDir: '/specs/mobile', workDir: null };

/** A reader no setup of these runs is asked through. */
const unread = <Slice>(capability: { readonly initial: Slice }): Slice => capability.initial;

/** The screen the app double captures, whatever it is asked. */
const SCREEN: DeviceScreen = {
    texts: ['Notes', 'Water the plants'],
    tree: {
        children: [{ label: 'Notes', type: 'StaticText' }],
        label: 'Specimen',
        type: 'Application',
    },
};

/** A scenario the app is handed, and does nothing. */
const scenario: MobileScenario = async () => {
    await Promise.resolve();
};

describe('open', () => {
    test('.open() — the screen a chain captures — relaunches through the app with the deep link and the scenario, and reads the screen it captured', async () => {
        // Given - an app double recording what each open is handed
        const opened: [string | undefined, MobileScenario | undefined][] = [];
        const app = {
            open: async (deepLink: string | undefined, handed: MobileScenario | undefined) => {
                opened.push([deepLink, handed]);
                return await Promise.resolve(SCREEN);
            },
        };

        // When - the chain opens a deep link with a scenario
        const result = await open.perform(['specimen://notes', scenario], unread, { app }, RUN);

        // Then - the app was handed both, and the result reads the tree and the texts in order
        expect(opened).toStrictEqual([['specimen://notes', scenario]]);
        expect(result.screen.value).toStrictEqual(SCREEN.tree);
        expect(result.content.text).toBe('Notes\nWater the plants');
    });
});
