import { describe, expect, test } from 'vitest';

import { http } from '../../../stubs/kinds/http.js';
import type { DeviceOpenOptions, DeviceScreen, MobileScenario } from '../device/device.port.js';
import { mobileDefinition } from '../mobile.composition.js';

const SCREEN: DeviceScreen = {
    texts: ['Orders', 'Pay'],
    tree: { children: [{ label: 'Pay', type: 'Button' }], label: 'App', type: 'Application' },
};

const scenario: MobileScenario = async () => {
    await Promise.resolve();
};

describe('mobileDefinition', () => {
    test('mobile specification — open — relaunches the app at the deep link with its scenario, and reads the screen as its texts and its tree', async () => {
        // Given - a chain over a device that answers one screen
        const opened: DeviceOpenOptions[] = [];
        const mobile = mobileDefinition.open({
            backend: undefined,
            backendUrl: undefined,
            bundleId: 'com.example.app',
            device: async () =>
                await Promise.resolve({
                    close: async () => {
                        await Promise.resolve();
                    },
                    open: async (options: DeviceOpenOptions) => {
                        opened.push(options);
                        return await Promise.resolve(SCREEN);
                    },
                }),
        });

        // When - it opens a deep link
        const result = await mobile.open('app://orders', scenario);

        // Then - the device was asked for the app, the link and the scenario, and the result reads the screen through one capture scope
        expect([
            opened,
            [result.content.streamName, result.content.text],
            result.screen.value,
            result.content.captures === result.screen.captures,
        ]).toStrictEqual([
            [{ bundleId: 'com.example.app', deepLink: 'app://orders', scenario }],
            ['content', 'Orders\nPay'],
            SCREEN.tree,
            true,
        ]);
    });

    test('mobile specification — intercept — a runner without a backend refuses a stub, naming the mobile option', () => {
        // Given - a chain over no backend
        const mobile = mobileDefinition.open({
            backend: undefined,
            backendUrl: undefined,
            bundleId: 'com.example.app',
            device: async () => await Promise.reject(new Error('no device')),
        });

        // Then - the stub is refused before anything opens
        expect(() =>
            mobile.intercept({ request: http.get('/events'), response: http.json([]) }),
        ).toThrow(
            new Error(
                [
                    'found: .intercept(), and this runner has no declared backend',
                    'why: A site, an app or a binary is served its stubs by a declared stub backend, the URL it reads in place of its API.',
                    "fix: add `backend` to the specification options: specification.mobile({ …, backend: { env: 'API_URL' } })",
                    'read: docs/guides/mobile-specs.md#declared-backend',
                ].join('\n'),
            ),
        );
    });
});
