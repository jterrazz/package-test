import { describe, expect, test } from 'vitest';

import { createSharedBrowser } from './shared-browser.js';

type StubBrowser = {
    disconnect: () => void;
    id: number;
    on: (event: 'disconnected', listener: () => void) => void;
};

function stubBrowser(id: number): StubBrowser {
    const listeners: (() => void)[] = [];
    return {
        disconnect: () => {
            for (const listener of listeners) {
                listener();
            }
        },
        id,
        on: (_event, listener) => {
            listeners.push(listener);
        },
    };
}

function stubLauncher(failures = 0): {
    launch: () => Promise<StubBrowser>;
    launched: StubBrowser[];
} {
    const launched: StubBrowser[] = [];
    let failing = failures;
    const launch = async (): Promise<StubBrowser> => {
        if (failing > 0) {
            failing -= 1;
            throw new Error('chromium did not start');
        }
        const browser = stubBrowser(launched.length + 1);
        launched.push(browser);
        return browser;
    };
    return { launch, launched };
}

describe('createSharedBrowser', () => {
    test('launches once, however many runners ask, even at the same time', async () => {
        // Given - one worker's launcher
        const { launch, launched } = stubLauncher();
        const shared = createSharedBrowser(launch);

        // When - three runners ask, two of them together
        const [first, second] = await Promise.all([shared(), shared()]);
        const third = await shared();

        // Then - one browser, handed to all three
        expect(launched).toHaveLength(1);
        expect([second, third]).toStrictEqual([first, first]);
    });

    test('launches again once the browser has disconnected', async () => {
        // Given - a browser the worker shared, then lost
        const { launch, launched } = stubLauncher();
        const shared = createSharedBrowser(launch);
        const lost = await shared();
        lost.disconnect();

        // When - a runner asks after the loss
        await shared();

        // Then - a second browser replaced the lost one
        expect(launched.map((browser) => browser.id)).toStrictEqual([1, 2]);
    });

    test('keeps no failed launch: the next ask tries again', async () => {
        // Given - a launcher whose first launch fails
        const { launch, launched } = stubLauncher(1);
        const shared = createSharedBrowser(launch);

        // When - a runner asks, is refused, and asks again
        const refused = shared();
        await expect(refused).rejects.toThrow('chromium did not start');
        await shared();

        // Then - the second ask launched the one browser
        expect(launched).toHaveLength(1);
    });
});
