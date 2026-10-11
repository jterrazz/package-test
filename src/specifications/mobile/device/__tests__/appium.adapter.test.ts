/* oxlint-disable vitest/no-restricted-vi-methods -- this file tests the ADAPTER's own deadline: `clock` pins the calendar, and what has to move here is the timer queue the adapter waits on, which only vitest's fake timers hold */
import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';

import { within } from '../../../../visitor/targets/landmarks.js';
import { button, field, testId } from '../../../../visitor/targets/roles.js';
import type { Target } from '../../../../visitor/targets/target.js';
import {
    adapterOver,
    ambiguousPay,
    BUNDLE_ID,
    capabilityOf,
    element,
    fakeDevice,
    SCENARIO_LESSON,
    scenarioOn,
    settleInto,
    SOURCE,
    TIMEOUT_LESSON,
    twoPays,
    unscrollable,
} from './appium.adapter.fixtures.js';
import type { DeviceLog, Outcome } from './appium.adapter.fixtures.js';

const inCard = (target: Target): Target => within(testId('card'), target);

const failing = async (): Promise<void> => {
    await Promise.reject(new Error('boom'));
};

describe('AppiumAdapter', () => {
    test('appium adapter — opening — relaunches the app over one session it reuses, a deep link followed, and answers the projected screen', async () => {
        // Given - a device whose app is not running at first
        const log: DeviceLog = [];
        const { sessions, webdriverio } = fakeDevice(log, {
            refusing: ['mobile: terminateApp'],
            source: SOURCE,
        });
        const adapter = adapterOver(webdriverio);

        // When - it opens plainly, then on a deep link, then closes twice
        const screen = await adapter.open({ bundleId: BUNDLE_ID });
        await adapter.open({ bundleId: BUNDLE_ID, deepLink: 'app://orders' });
        await adapter.close();
        await adapter.close();

        // Then - one session, each open a terminate before a launch, the session ended once
        expect([sessions.length, log, screen]).toStrictEqual([
            1,
            [
                'mobile: terminateApp {"bundleId":"com.example.app"}',
                'mobile: activateApp {"bundleId":"com.example.app"}',
                'mobile: terminateApp {"bundleId":"com.example.app"}',
                'mobile: deepLink {"bundleId":"com.example.app","url":"app://orders"}',
                'deleteSession',
            ],
            {
                texts: ['Welcome', 'Pay'],
                tree: {
                    children: [
                        { label: 'Welcome', type: 'StaticText' },
                        { label: 'Pay', type: 'Button' },
                    ],
                    label: 'App',
                    type: 'Application',
                },
            },
        ]);
    });

    test('appium adapter — opening — a session the run shares is the run’s to end, and close leaves it open', async () => {
        // Given - an adapter whose session the run's ledger records
        const log: DeviceLog = [];
        const adapter = adapterOver(fakeDevice(log).webdriverio, { shared: true });
        await adapter.open({ bundleId: BUNDLE_ID });

        // When - it closes
        await adapter.close();

        // Then - nothing ended the session
        expect(log).not.toContain('deleteSession');
    });

    test('appium adapter — the verbs — fill and tap act on their one match, see takes any of several, inside a scope', async () => {
        // Given - a card holding an email field, a Pay button and two Total texts
        const outcome = await scenarioOn(
            (log) => ({
                query: (selector) =>
                    selector.includes("'card'")
                        ? [
                              element(log, 'card', {}, (inner) =>
                                  [
                                      ['Email', 'email'],
                                      ['Pay', 'pay'],
                                      ['Total', 'total-1'],
                                      ['Total', 'total-2'],
                                  ]
                                      .filter(([name]) => inner.includes(`'${name}'`))
                                      .map(([, id]) => element(log, id ?? '')),
                              ),
                          ]
                        : [],
            }),
            async (visitor) => {
                await visitor.fill(inCard(field('Email')), 'a@b.c');
                await visitor.see(inCard(button('Total')));
                await visitor.tap(inCard(button('Pay')));
            },
        );

        // Then - the field took the value, the button the click
        expect(outcome).toStrictEqual({
            error: undefined,
            log: ['setValue email a@b.c', 'click pay'],
        });
    });

    test('appium adapter — the verbs — more than one match is refused for an action, and for a scope even under see', async () => {
        // Given - two Pay buttons, answered for a card as well
        // When - a tap names the button, a see names the Pay inside a card
        const tapped = await scenarioOn(twoPays, async (visitor) => {
            await visitor.tap(button('Pay'));
        });
        const seen = await scenarioOn(twoPays, async (visitor) => {
            await visitor.see(within(testId('card'), button('Total')));
        });

        // Then - both refused, naming the matches; nothing clicked
        expect([tapped.error?.message, seen.error?.message, tapped.log, seen.log]).toStrictEqual([
            ambiguousPay('button("Pay")'),
            ambiguousPay('testId("card")'),
            [],
            [],
        ]);
    });

    test('appium adapter — the verbs — an element off screen is scrolled to once, on the first miss, and then acted on', async () => {
        // Given - a Pay button visible only once scrolled to
        const outcome = await scenarioOn(
            (log) => ({
                query: (selector) =>
                    selector.includes('1 == 1') ||
                    log.some((line) => line.includes('scrollToElement'))
                        ? [element(log, 'pay')]
                        : [],
            }),
            async (visitor) => {
                await visitor.tap(button('Pay'));
            },
        );

        // Then - one scroll to its id, then the click
        expect(outcome).toStrictEqual({
            error: undefined,
            log: ['mobile: scrollToElement {"elementId":"pay"}', 'click pay'],
        });
    });

    test('appium adapter — the verbs — a timeout on a screen showing only the launch label says the app is stalled on its splash', async () => {
        // Given - a screen that shows the app's name and nothing else
        const stalled = await scenarioOn(
            () => ({ source: '<XCUIElementTypeApplication label="SigNews" />' }),
            async (visitor) => {
                await visitor.tap(button('Pay'));
            },
            1,
        );

        // Then - the timeout names the one label and says why the screen is empty
        expect(stalled.error?.message).toBe(
            [
                'found: tap(button("Pay")) timed out after 1ms — no visible match.',
                'Currently on screen: SigNews',
                'The app is stalled on the splash: nothing but its launch screen is up.',
                ...TIMEOUT_LESSON,
            ].join('\n'),
        );
    });

    test('appium adapter — the verbs — a verb with no visible match times out naming what the screen shows, having scrolled once', async () => {
        // Given - a Pay button that never becomes visible, on a screen that cannot scroll, and an empty screen
        // When - each runs past a short action budget
        const labelled = await scenarioOn(
            unscrollable,
            async (visitor) => {
                await visitor.tap(button('Pay'));
            },
            600,
        );
        const bare = await scenarioOn(
            () => ({}),
            async (visitor) => {
                await visitor.fill(field('Email'), 'a@b.c');
            },
            1,
        );

        // Then - each timeout, the labels in sight named when there are some
        expect([labelled.error?.message, labelled.log, bare.error?.message]).toStrictEqual([
            [
                'found: tap(button("Pay")) timed out after 600ms — no visible match.',
                'Currently on screen: App | Welcome | Pay',
                ...TIMEOUT_LESSON,
            ].join('\n'),
            ['mobile: scrollToElement {"elementId":"pay"}'],
            [
                'found: fill(field("Email")) timed out after 1ms — no visible match.',
                ...TIMEOUT_LESSON,
            ].join('\n'),
        ]);
    });

    test('appium adapter — a failed scenario — carries a screenshot of the screen it failed on, when the device gives one', async () => {
        // Given - a scenario that fails, on a device with a screenshot and one without
        // When - each fails
        const shot = await scenarioOn(
            () => ({ screenshot: Buffer.from('png').toString('base64') }),
            failing,
        );
        const none = await scenarioOn(() => ({}), failing);

        // Then - the evidence path names a file holding the screenshot
        const evidence =
            /Evidence: (?<path>\S+)/u.exec(shot.error?.message ?? '')?.groups?.path ?? '';
        expect([
            shot.error?.message.replace(evidence, '<evidence>'),
            /\/\.artifacts\/vitest\/evidence\/\d+-\w+\/mobile-\w+\/failure\.png$/u.test(evidence),
            readFileSync(evidence, 'utf8'),
            none.error?.message,
        ]).toStrictEqual([
            [
                'found: the open scenario failed:',
                '  boom',
                'Evidence: <evidence>',
                ...SCENARIO_LESSON,
            ].join('\n'),
            true,
            'png',
            ['found: the open scenario failed:', '  boom', ...SCENARIO_LESSON].join('\n'),
        ]);
    });

    test('appium adapter — the declared timeouts — the session takes the declared launch budget or the 240s default, and the device by name and bare version', async () => {
        // Given - an adapter declaring a launch budget, one declaring none, and one over a device named with its OS
        const declared = fakeDevice([]);
        const fallback = fakeDevice([]);
        const named = fakeDevice([]);
        await adapterOver(declared.webdriverio, { timeouts: { launch: 90_000 } }).open({
            bundleId: BUNDLE_ID,
        });
        await adapterOver(fallback.webdriverio).open({ bundleId: BUNDLE_ID });
        await adapterOver(named.webdriverio, {
            device: { name: 'iPhone 17', os: 'iOS 26.5' },
        }).open({
            bundleId: BUNDLE_ID,
        });

        // Then - each session's capabilities
        expect([
            capabilityOf(declared.sessions, 'appium:wdaLaunchTimeout'),
            capabilityOf(fallback.sessions, 'appium:wdaLaunchTimeout'),
            capabilityOf(named.sessions, 'appium:deviceName'),
            capabilityOf(named.sessions, 'appium:platformVersion'),
            capabilityOf(named.sessions, 'appium:udid'),
        ]).toStrictEqual([90_000, 240_000, 'iPhone 17', '26.5', undefined]);
    });

    test.each([
        { action: 45_000, early: 31_000 },
        { action: undefined, early: 29_000 },
    ])(
        'appium adapter — the declared timeouts — a verb waits the declared action budget or the 30s default: $action',
        async ({ action, early }) => {
            // Given - an adapter opened before the fake clock takes over: a faked timer cannot advance a real await
            const adapter = adapterOver(fakeDevice([]).webdriverio, { timeouts: { action } });
            await adapter.open({ bundleId: BUNDLE_ID });
            vi.useFakeTimers();
            try {
                const outcome: Outcome = {};
                const settled = settleInto(
                    outcome,
                    adapter.open({
                        bundleId: BUNDLE_ID,
                        scenario: async (visitor) => {
                            await visitor.tap(button('Absent'));
                        },
                    }),
                );

                // Then - the wait outlives an earlier deadline, and ends at the budget
                await vi.advanceTimersByTimeAsync(early);
                const before = outcome.error;
                await vi.advanceTimersByTimeAsync(16_000);
                await settled;
                expect([
                    before,
                    outcome.error?.message.includes(`timed out after ${action ?? 30_000}ms`),
                ]).toStrictEqual([undefined, true]);
            } finally {
                vi.useRealTimers();
            }
        },
    );
});
