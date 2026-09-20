/* oxlint-disable vitest/no-restricted-vi-methods -- this file tests the ADAPTER's own deadline: `clock` pins the calendar, and what has to move here is the timer queue the adapter waits on, which only vitest's fake timers hold */
import { describe, expect, test, vi } from 'vitest';

import { button } from '../../model/elements/elements.js';
import { resetSubstringWarnings } from '../../model/elements/substring-warning.js';
import { AppiumAdapter } from './appium.adapter.js';

/**
 * The declared waits (`specification.mobile({ timeouts })`), driven over a
 * STUB driver: no simulator, no appium server. The stub resolves no element
 * ever, so every verb runs to its deadline — which is the value under test.
 */

const BUNDLE_ID = 'com.example.app';
const SERVER_URL = 'http://127.0.0.1:4723';

/** Capabilities of every session opened, in order — what the launch budget rides in. */
type Session = { capabilities: Record<string, unknown> };

/**
 * A driver that shows nothing and records the session it was created for.
 * Cast at the seam: the port surface exercised here is the handful of calls
 * below, not webdriverio's full session type.
 */
function asRemote(stub: unknown): never {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a stub implements the handful of calls these tests drive, never webdriverio's whole session type
    return stub as never;
}

function stubDriver(): { remote: never; sessions: Session[] } {
    const sessions: Session[] = [];
    const remote = async (options: Session) => {
        sessions.push(options);
        return {
            // Nothing ever matches — the polling loop always reaches its deadline.
            $$: async () => await Promise.resolve([]),
            deleteSession: async () => {
                await Promise.resolve();
            },
            executeScript: async () => {
                await Promise.resolve();
            },
            getPageSource: async () =>
                await Promise.resolve('<XCUIElementTypeApplication name="App" />'),
            // Evidence capture is best-effort — refusing it keeps the refusal clean.
            takeScreenshot: async () =>
                await Promise.reject(new Error('no screenshots in the stub')),
        };
    };
    return { remote: asRemote(remote), sessions };
}

/**
 * An adapter whose session is already open, so the stub is in hand before a
 * fake clock takes over — a faked timer cannot advance a real await.
 */
async function openedAdapter(timeouts?: { action?: number; launch?: number }): Promise<{
    adapter: AppiumAdapter;
    sessions: Session[];
}> {
    const { remote, sessions } = stubDriver();
    const adapter = new AppiumAdapter({
        remote,
        serverUrl: SERVER_URL,
        timeouts,
        udid: 'SIM-UDID',
    });
    await adapter.open({ bundleId: BUNDLE_ID });
    return { adapter, sessions };
}

/** Tap something the stub will never show, capturing the eventual refusal. */
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

describe('appium adapter — the declared timeouts', () => {
    test('waits the declared action timeout, not the framework default', async () => {
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

    test('falls back to the 30s action default when none is declared', async () => {
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

    test('hands the declared launch timeout to the session capabilities', async () => {
        // Given - a runner shortening the WebDriverAgent launch budget
        const { sessions } = await openedAdapter({ launch: 90_000 });

        // Then - the session was created with that budget
        expect(sessions[0]?.capabilities['appium:wdaLaunchTimeout']).toBe(90_000);
    });

    test('falls back to the 240s launch default when none is declared', async () => {
        // Given - a runner that declares no timeouts at all
        const { sessions } = await openedAdapter();

        // Then - the session carries the framework's own default
        expect(sessions[0]?.capabilities['appium:wdaLaunchTimeout']).toBe(240_000);
    });
});

/**
 * A driver whose one button is labelled "Continue to payment" — it answers a
 * `CONTAINS` predicate and refuses an `==` one, which is exactly the shape the
 * exact-name default made unreachable.
 */
function substringDriver(): { remote: never; state: { taps: number } } {
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

describe('appium adapter — the transitional window for a name matched in part', () => {
    test('taps the element the label CONTAINS, and names the label to write', async () => {
        // Given - a screen whose only button is labelled "Continue to payment", and a scenario naming part of it
        resetSubstringWarnings();
        const printed = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
        const { remote, state } = substringDriver();
        const adapter = new AppiumAdapter({
            remote,
            serverUrl: SERVER_URL,
            timeouts: { action: 1 },
            udid: 'SIM-UDID',
        });

        // When - the whole-label match answers nothing and the deadline passes
        await adapter.open({
            bundleId: BUNDLE_ID,
            scenario: async (visitor) => {
                await visitor.tap(button('Continue'));
            },
        });

        // Then - the tap reached the button through the window, and the line went where a plain run shows it
        expect(state.taps).toBe(1);
        expect(String(printed.mock.calls[0]?.[0])).toContain(
            "The name to write is 'Continue to payment'",
        );
    });
});
