import { rmSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { EVIDENCE_DIR } from '../../../../lint/kit/project/artifacts.js';
import { PlaywrightAdapter } from './playwright.adapter.js';

/** A stub launcher: no chromium starts. */

type Browser = Awaited<
    ReturnType<
        NonNullable<NonNullable<ConstructorParameters<typeof PlaywrightAdapter>[0]>['launch']>
    >
>;
function isBrowser(value: object): value is Browser {
    return 'newContext' in value && 'on' in value;
}
/** `hold` makes a visit that never finishes loading; `shots` records every screenshot path asked for. */
type StubContext = { closed: boolean };
function stubChromium(hold = false): {
    browser: { closed: boolean; contexts: StubContext[] };
    launch: () => Promise<Browser>;
    launches: () => number;
    loading: (count: number) => Promise<void>;
    shots: string[];
} {
    const contexts: StubContext[] = [];
    const state = { closed: false, contexts };
    const never = Promise.withResolvers<never>().promise;
    const waiters: { count: number; resolve: () => void }[] = [];
    const shots: string[] = [];
    let launches = 0;
    let loads = 0;
    const goto = async (): Promise<null> => {
        if (!hold) {
            return null;
        }
        loads += 1;
        for (const waiter of waiters.filter((entry) => entry.count <= loads)) {
            waiter.resolve();
        }
        return await never;
    };
    const page = {
        evaluate: async () => ({
            html: '<html></html>',
            jsonLdBlocks: [],
            links: [],
            metas: [],
            text: '',
            title: '',
        }),
        goto,
        locator: () => ({ ariaSnapshot: async () => '' }),
        on: () => {},
        screenshot: async ({ path }: { path: string }) => {
            shots.push(path);
        },
        url: () => 'http://site.test/',
    };
    const browser = {
        close: async () => {
            state.closed = true;
        },
        newContext: async () => {
            const context = { closed: false };
            contexts.push(context);
            return {
                close: async () => {
                    context.closed = true;
                },
                newPage: async () => page,
            };
        },
        on: () => {},
    };
    const launch = async (): Promise<Browser> => {
        launches += 1;
        if (!isBrowser(browser)) {
            throw new Error('the stub browser opens no context');
        }
        return browser;
    };
    const loading = async (count: number): Promise<void> => {
        const waiter = Promise.withResolvers<true>();
        const resolve = (): void => {
            waiter.resolve(true);
        };
        waiters.push({ count, resolve });
        if (loads >= count) {
            resolve();
        }
        await waiter.promise;
    };
    return { browser: state, launch, launches: () => launches, loading, shots };
}
const VISIT = { baseUrl: 'http://site.test', external: 'allow' } as const;
async function failingScenario(): Promise<void> {
    await Promise.reject(new Error('the button is gone'));
}
describe('PlaywrightAdapter', () => {
    test('the PlaywrightAdapter — the runners of a worker share its browser — two runners visiting pages launch the one browser once', async () => {
        // Given - two runners of one worker, over the same launcher
        const chromium = stubChromium();
        const first = new PlaywrightAdapter({ launch: chromium.launch });
        const second = new PlaywrightAdapter({ launch: chromium.launch });

        // When - each visits twice, all at once
        await Promise.all(
            [first, second, first, second].map(
                async (adapter) => await adapter.open('http://site.test/', VISIT),
            ),
        );

        // Then - one launch, one fresh context per visit, each closed when its visit ended
        expect(chromium.launches()).toBe(1);
        expect(chromium.browser.contexts.map((context) => context.closed)).toStrictEqual([
            true,
            true,
            true,
            true,
        ]);
    });

    test("the PlaywrightAdapter — the runners of a worker share its browser — close() ends the runner's open visits only, and leaves the browser to the worker", async () => {
        // Given - two runners, each with a visit still loading
        const chromium = stubChromium(true);
        const closing = new PlaywrightAdapter({ launch: chromium.launch });
        const other = new PlaywrightAdapter({ launch: chromium.launch });
        void closing.open('http://site.test/', VISIT);
        void other.open('http://site.test/', VISIT);
        await chromium.loading(2);

        // When - the first runner closes
        await closing.close();

        // Then - its context is closed, the other runner's is not, and the browser lives on
        expect(chromium.browser.contexts.map((context) => context.closed)).toStrictEqual([
            true,
            false,
        ]);
        expect(chromium.browser.closed).toBe(false);
    });

    test('the PlaywrightAdapter — the runners of a worker share its browser — close() does not close again a visit that already ended', async () => {
        // Given - a runner whose visit ended normally, its context closed
        const chromium = stubChromium();
        const adapter = new PlaywrightAdapter({ launch: chromium.launch });
        await adapter.open('http://site.test/', VISIT);
        const [context] = chromium.browser.contexts;
        if (context === undefined) {
            throw new Error('the visit opened no context');
        }
        context.closed = false;

        // When - the runner closes
        await adapter.close();

        // Then - the ended visit's context was no longer held
        expect(context.closed).toBe(false);
    });

    test("the PlaywrightAdapter — a failed scenario leaves its evidence — screenshots into the project's evidence folder, which outlives the run's temp root", async () => {
        // Given - a runner whose scenario fails, and the evidence folder removed after the test
        const chromium = stubChromium();
        const adapter = new PlaywrightAdapter({ launch: chromium.launch });
        onTestFinished(() => {
            for (const shot of chromium.shots) {
                rmSync(dirname(shot), { force: true, recursive: true });
            }
        });

        // When - the visit runs it
        const visit = adapter.open('http://site.test/', { ...VISIT, scenario: failingScenario });

        // Then - the error names the one screenshot, taken under the evidence folder
        await expect(visit).rejects.toThrow(/the button is gone\nEvidence: .*failure\.png\n/u);
        const evidence = join(process.cwd(), EVIDENCE_DIR);
        expect(chromium.shots).toHaveLength(1);
        expect(chromium.shots[0]?.startsWith(`${evidence}${sep}website-`)).toBe(true);
    });
});
