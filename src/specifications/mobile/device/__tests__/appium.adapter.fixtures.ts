import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sessionLedger } from '../../session/session-ledger.js';
import { AppiumAdapter } from '../appium.adapter.js';
import type { DeviceTimeouts, MobileDevice, MobileVisitor } from '../device.port.js';

export const BUNDLE_ID = 'com.example.app';

type Session = { capabilities: Record<string, unknown> };

type Query = (selector: string) => FakeElement[];

export type FakeElement = {
    $$: (selector: string) => Promise<FakeElement[]>;
    click: () => Promise<void>;
    elementId: string;
    getAttribute: (name: string) => Promise<null | string>;
    setValue: (value: string) => Promise<void>;
};

export type FakeScreen = {
    /** The elements each `$$` selector answers on the whole screen. */
    query?: Query;
    /** The scripts that throw, by name: `mobile: terminateApp` for an app not running. */
    refusing?: string[];
    screenshot?: string;
    source?: string;
};

/** Every call a session receives, in order, as one line each. */
export type DeviceLog = string[];

// invariant: cast at the seam: only the handful of calls below are exercised.
function asSeam(stub: unknown): never {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a stub implements the handful of calls these tests drive, never webdriverio's whole session type
    return stub as never;
}

export function element(
    log: DeviceLog,
    id: string,
    attributes: Record<string, string> = {},
    inside: Query = () => [],
): FakeElement {
    return {
        $$: async (selector) => await Promise.resolve(inside(selector)),
        click: async () => {
            log.push(`click ${id}`);
            await Promise.resolve();
        },
        elementId: id,
        getAttribute: async (name) => await Promise.resolve(attributes[name] ?? null),
        setValue: async (value) => {
            log.push(`setValue ${id} ${value}`);
            await Promise.resolve();
        },
    };
}

export function fakeDevice(
    log: DeviceLog,
    screen: FakeScreen = {},
): { sessions: Session[]; webdriverio: never } {
    const sessions: Session[] = [];
    const { query = () => [], refusing = [], screenshot, source = '<App />' } = screen;
    const remote = async (options: Session) => {
        sessions.push(options);
        return await Promise.resolve({
            $$: async (selector: string) => await Promise.resolve(query(selector)),
            capabilities: options.capabilities,
            deleteSession: async () => {
                log.push('deleteSession');
                await Promise.resolve();
            },
            executeScript: async (script: string, [argument]: unknown[]) => {
                log.push(`${script} ${JSON.stringify(argument)}`);
                if (refusing.includes(script)) {
                    throw new Error(`${script} refused`);
                }
                await Promise.resolve();
            },
            getPageSource: async () => await Promise.resolve(source),
            sessionId: `session-${sessions.length}`,
            takeScreenshot: async () =>
                await (screenshot === undefined
                    ? Promise.reject(new Error('no screenshot'))
                    : Promise.resolve(screenshot)),
        });
    };
    return { sessions, webdriverio: asSeam({ attach: remote, remote }) };
}

export function adapterOver(
    webdriverio: never,
    options: { device?: MobileDevice; shared?: boolean; timeouts?: DeviceTimeouts } = {},
): AppiumAdapter {
    const { device = { name: 'iPhone 17', udid: 'SIM-UDID' }, shared = false, timeouts } = options;
    const ledgerDirectory = join(tmpdir(), 'ledger-');
    return new AppiumAdapter({
        device,
        ledger: shared ? sessionLedger(mkdtempSync(ledgerDirectory)) : undefined,
        serverUrl: 'http://127.0.0.1:4723',
        timeouts,
        webdriverio,
    });
}

export const SOURCE =
    '<XCUIElementTypeApplication name="App" label="App" visible="true"><XCUIElementTypeStaticText label="Welcome" visible="true"/><XCUIElementTypeButton label="Pay" visible="true"/></XCUIElementTypeApplication>';

/** What a scenario on a fresh device left behind: the error it ended on, and every call the session saw. */
export async function scenarioOn(
    screen: (log: DeviceLog) => FakeScreen,
    scenario: (visitor: MobileVisitor) => Promise<void>,
    action = 30_000,
): Promise<{ error: Error | undefined; log: DeviceLog }> {
    const log: DeviceLog = [];
    const adapter = adapterOver(fakeDevice(log, screen(log)).webdriverio, { timeouts: { action } });
    const outcome: Outcome = {};
    await settleInto(outcome, adapter.open({ bundleId: BUNDLE_ID, scenario }));
    return {
        error: outcome.error,
        log: log.filter((line) => !line.startsWith('mobile: ') || line.includes('scroll')),
    };
}

export type Outcome = { error?: Error };

/** Waits for the work and keeps the error it ends on, so a test can read it before and after it settles. */
export async function settleInto(outcome: Outcome, work: Promise<unknown>): Promise<void> {
    try {
        await work;
    } catch (error) {
        outcome.error = error instanceof Error ? error : new Error(String(error));
    }
}

/** Two Pay buttons, answered for the button and for a card alike. */
export function twoPays(log: DeviceLog): FakeScreen {
    return {
        query: (selector) =>
            [
                element(log, 'one', { label: 'Pay', type: 'XCUIElementTypeButton' }),
                element(log, 'two', {
                    label: 'Pay',
                    name: 'pay-later',
                    type: 'XCUIElementTypeButton',
                }),
            ].filter(() => selector.includes("'Pay'") || selector.includes("'card'")),
    };
}

/** A Pay button found only beyond the visible screen, on a screen that refuses to scroll. */
export function unscrollable(log: DeviceLog): FakeScreen {
    return {
        query: (selector) => (selector.includes('1 == 1') ? [element(log, 'pay')] : []),
        refusing: ['mobile: scrollToElement'],
        source: SOURCE,
    };
}

export function capabilityOf(sessions: Session[], key: string): unknown {
    return sessions[0]?.capabilities[key];
}

export const TIMEOUT_LESSON = [
    'why: A mobile verb waits for one visible match, within the declared action budget.',
    'fix: designate what this screen shows, or raise `timeouts.action` for a slow build',
    'read: docs/guides/mobile-specs.md#declared-timeouts',
];

export const SCENARIO_LESSON = [
    'why: An open scenario drives the screen step by step, and the first step that fails ends it.',
    'fix: correct the step that failed, or the screen it drives',
    'read: docs/guides/mobile-specs.md#open-scenarios--the-when',
];

/** The refusal of a target matching both Pay buttons of a screen. */
export function ambiguousPay(target: string): string {
    return [
        `found: Ambiguous element: ${target} matched 2 elements on the screen:`,
        '  1. Button "Pay"',
        '  2. Button "Pay"  [testId: pay-later]',
        'why: A verb acts on exactly ONE element: a target that matches several is refused, never settled by the first.',
        'fix: designate one of them:',
        `  • scope it       within(testId('...'), ${target}): a screen has no landmarks, and any target works as the scope`,
        '  • other element  a button() or field() may name one thing where this does not',
        'read: docs/reference/linting.md#target-matches-one-element',
    ].join('\n');
}
