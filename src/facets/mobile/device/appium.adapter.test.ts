/* oxlint-disable vitest/no-restricted-vi-methods -- this file tests the ADAPTER's own deadline: `clock` pins the calendar, and what has to move here is the timer queue the adapter waits on, which only vitest's fake timers hold */
import { describe, expect, test, vi } from 'vitest';

import { button, testId, within } from '../../../elements/elements.js';
import { AppiumAdapter } from './appium.adapter.js';

/** A stub driver that resolves no element: every verb runs to its deadline, the value under test. */

const BUNDLE_ID = 'com.example.app';
const SERVER_URL = 'http://127.0.0.1:4723';

type Session = { capabilities: Record<string, unknown> };

/** Cast at the seam: only the handful of calls below are exercised. */
function asRemote(stub: unknown): never {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a stub implements the handful of calls these tests drive, never webdriverio's whole session type
    return stub as never;
}

function stubDriver(): { remote: never; sessions: Session[] } {
    const sessions: Session[] = [];
    const remote = async (options: Session) => {
        sessions.push(options);
        return {
            $$: async () => await Promise.resolve([]),
            deleteSession: async () => {
                await Promise.resolve();
            },
            executeScript: async () => {
                await Promise.resolve();
            },
            getPageSource: async () =>
                await Promise.resolve('<XCUIElementTypeApplication name="App" />'),
            takeScreenshot: async () =>
                await Promise.reject(new Error('no screenshots in the stub')),
        };
    };
    return { remote: asRemote(remote), sessions };
}

/** Opened before a fake clock takes over: a faked timer cannot advance a real await. */
async function openedAdapter(timeouts?: { action?: number; launch?: number }): Promise<{
    adapter: AppiumAdapter;
    sessions: Session[];
}> {
    const { remote, sessions } = stubDriver();
    const adapter = new AppiumAdapter({
        remote,
        serverUrl: SERVER_URL,
        timeouts,
        device: { name: 'iPhone 17', udid: 'SIM-UDID' },
    });
    await adapter.open({ bundleId: BUNDLE_ID });
    return { adapter, sessions };
}

function tapTheAbsent(adapter: AppiumAdapter): { error?: Error; settled: Promise<void> } {
    const outcome: { error?: Error; settled: Promise<void> } = { settled: Promise.resolve() };
    outcome.settled = adapter
        .open({
            bundleId: BUNDLE_ID,
            scenario: async (visitor) => {
                await visitor.tap(button('Absent'));
            },
        })
        .then(
            () => {
                throw new Error('the tap resolved, though nothing was ever on screen');
            },
            (error: Error) => {
                outcome.error = error;
            },
        );
    return outcome;
}

/** It answers `CONTAINS` and refuses `==`: a name that only begins the label designates nothing. */
function partialLabelDriver(): { remote: never; state: { taps: number } } {
    const state = { taps: 0 };
    const element = {
        click: async () => {
            state.taps += 1;
            await Promise.resolve();
        },
        elementId: 'button-1',
        getAttribute: async (name: string) =>
            await Promise.resolve(
                name === 'label' ? 'Continue to payment' : `XCUIElementType${name}`,
            ),
        setValue: async () => {
            await Promise.resolve();
        },
    };
    const remote = async () =>
        await Promise.resolve({
            $$: async (selector: string) =>
                await Promise.resolve(selector.includes('CONTAINS') ? [element] : []),
            deleteSession: async () => {
                await Promise.resolve();
            },
            executeScript: async () => {
                await Promise.resolve();
            },
            getPageSource: async () =>
                await Promise.resolve('<XCUIElementTypeApplication name="App" />'),
            takeScreenshot: async () =>
                await Promise.reject(new Error('no screenshots in the stub')),
        });
    return { remote: asRemote(remote), state };
}
function scopedDriver(): { remote: never; tapped: string[] } {
    const tapped: string[] = [];
    const buy = (id: string) => ({
        click: async () => {
            tapped.push(id);
            await Promise.resolve();
        },
        elementId: id,
    });
    const card = {
        $$: async (selector: string) =>
            await Promise.resolve(selector.includes('Buy') ? [buy('inside')] : []),
        elementId: 'card',
    };
    const remote = async () =>
        await Promise.resolve({
            $$: async (selector: string) =>
                await Promise.resolve(selector.includes("'card'") ? [card] : [buy('outside')]),
            deleteSession: async () => {
                await Promise.resolve();
            },
            executeScript: async () => {
                await Promise.resolve();
            },
            getPageSource: async () =>
                await Promise.resolve('<XCUIElementTypeApplication name="App" />'),
            takeScreenshot: async () =>
                await Promise.reject(new Error('no screenshots in the stub')),
        });
    return { remote: asRemote(remote), tapped };
}
describe('AppiumAdapter', () => {
    test('appium adapter — the declared timeouts — waits the declared action timeout, not the framework default', async () => {
        // Given - a runner declaring 45s, because its dev-mode cold boot outlasts the 30s default
        const { adapter } = await openedAdapter({ action: 45_000 });
        vi.useFakeTimers();
        try {
            const outcome = tapTheAbsent(adapter);

            // Then - the default deadline passes without a refusal
            await vi.advanceTimersByTimeAsync(31_000);
            expect(outcome.error).toBeUndefined();

            // Then - the DECLARED deadline is the one that ends the wait
            await vi.advanceTimersByTimeAsync(15_000);
            await outcome.settled;
            expect(outcome.error?.message).toContain('timed out after 45000ms');
        } finally {
            vi.useRealTimers();
        }
    });

    test('appium adapter — the declared timeouts — falls back to the 30s action default when none is declared', async () => {
        // Given - a runner that declares no timeouts at all
        const { adapter } = await openedAdapter();
        vi.useFakeTimers();
        try {
            const outcome = tapTheAbsent(adapter);

            // Then - the framework's own default is what the verb waits
            await vi.advanceTimersByTimeAsync(29_000);
            expect(outcome.error).toBeUndefined();
            await vi.advanceTimersByTimeAsync(2000);
            await outcome.settled;
            expect(outcome.error?.message).toContain('timed out after 30000ms');
        } finally {
            vi.useRealTimers();
        }
    });

    test('appium adapter — the declared timeouts — hands the declared launch timeout to the session capabilities', async () => {
        // Given - a runner shortening the WebDriverAgent launch budget
        const { sessions } = await openedAdapter({ launch: 90_000 });

        // Then - the session was created with that budget
        expect(sessions[0]?.capabilities['appium:wdaLaunchTimeout']).toBe(90_000);
    });

    test('appium adapter — the declared timeouts — asks the server for the device by name and platform version', async () => {
        // Given - an adapter over a device named with its OS, and no udid
        const { remote, sessions } = stubDriver();
        const adapter = new AppiumAdapter({
            device: { name: 'iPhone 17', os: 'iOS 26.5' },
            remote,
            serverUrl: SERVER_URL,
        });
        await adapter.open({ bundleId: BUNDLE_ID });

        // Then - the capabilities carry the name and the bare version, and no udid
        expect(sessions[0]?.capabilities).toMatchObject({
            'appium:deviceName': 'iPhone 17',
            'appium:platformVersion': '26.5',
        });
        expect(sessions[0]?.capabilities).not.toHaveProperty('appium:udid');
    });

    test('appium adapter — the declared timeouts — falls back to the 240s launch default when none is declared', async () => {
        // Given - a runner that declares no timeouts at all
        const { sessions } = await openedAdapter();

        // Then - the session carries the framework's own default
        expect(sessions[0]?.capabilities['appium:wdaLaunchTimeout']).toBe(240_000);
    });

    test('appium adapter — names are exact — a name that only begins the label designates nothing, and nothing is tapped', async () => {
        // Given - a screen whose only button is labelled "Continue to payment", and a scenario naming part of it
        const { remote, state } = partialLabelDriver();
        const adapter = new AppiumAdapter({
            remote,
            serverUrl: SERVER_URL,
            timeouts: { action: 1 },
            device: { name: 'iPhone 17', udid: 'SIM-UDID' },
        });

        // When - the scenario taps the partial name
        const opened = adapter.open({
            bundleId: BUNDLE_ID,
            scenario: async (visitor) => {
                await visitor.tap(button('Continue'));
            },
        });

        // Then - the verb runs to its deadline on an exact name, and no substring is widened to
        await expect(opened).rejects.toThrow(/timed out/u);
        expect(state.taps).toBe(0);
    });

    test('appium adapter — a scope is translated on the device — within() resolves its target inside the scope, not on the whole screen', async () => {
        // Given - a screen with a Buy button outside the card and one inside it
        const { remote, tapped } = scopedDriver();
        const adapter = new AppiumAdapter({
            remote,
            serverUrl: SERVER_URL,
            device: { name: 'iPhone 17', udid: 'SIM-UDID' },
        });

        // When - the scenario taps the card's Buy
        await adapter.open({
            bundleId: BUNDLE_ID,
            scenario: async (visitor) => {
                await visitor.tap(within(testId('card'), button('Buy')));
            },
        });

        // Then - the one inside the card is tapped
        expect(tapped).toStrictEqual(['inside']);
    });
});
