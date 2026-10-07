import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';
import { describe, expect, onTestFinished, test } from 'vitest';

import { EVIDENCE_DIR } from '../../../../../lint/kit/project/artifacts.js';
import { PlaywrightAdapter } from '../playwright.adapter.js';
import { stubChromium } from './playwright.adapter.fixtures.js';

const VISIT = { baseUrl: 'http://site.test', external: 'allow' } as const;

const REQUESTS = ['http://site.test/app.js', 'http://127.0.0.1:4100/api', 'https://cdn.test/x.js'];

async function messageOf(work: Promise<unknown>): Promise<string> {
    try {
        await work;
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

/** Goes to a second page, then fails there. */
async function failingScenario(visitor: { goto: (path: string) => Promise<void> }): Promise<void> {
    await visitor.goto('/about');
    throw new Error('the button is gone');
}

describe('PlaywrightAdapter', () => {
    test('the PlaywrightAdapter — a visit — opens a context with the chain’s headers, pins the clock before loading, and answers what the page holds', async () => {
        // Given - a page answering 201, a visit carrying headers and a clock, and one carrying neither
        const chromium = stubChromium({ status: 201 });
        const adapter = new PlaywrightAdapter({ launch: chromium.launch });

        // When - each visits
        const page = await adapter.open('http://site.test/home', {
            ...VISIT,
            clock: '2026-01-01T00:00:00.000Z',
            headers: { 'x-a': '1' },
        });
        await adapter.open('http://site.test/home', VISIT);

        // Then - the page as captured, and each call in its order
        expect([page, chromium.log]).toStrictEqual([
            {
                consoleMessages: [
                    { text: 'hello', type: 'warning' },
                    { text: 'Uncaught TypeError: boom', type: 'error' },
                ],
                html: '<html></html>',
                jsonLdBlocks: [],
                links: [],
                metas: [],
                status: 201,
                text: 'Welcome',
                title: 'Home',
                tree: '- snapshot of body',
                url: 'http://site.test/home',
            },
            [
                'newContext {"extraHTTPHeaders":{"x-a":"1"}}',
                'clock 2026-01-01T00:00:00.000Z',
                'goto http://site.test/home {"waitUntil":"load"}',
                'newContext {"extraHTTPHeaders":{}}',
                'goto http://site.test/home {"waitUntil":"load"}',
            ],
        ]);
    });

    test('the PlaywrightAdapter — a visit — a navigation answering no response is status 0', async () => {
        // Given - a page whose navigation answers none
        const chromium = stubChromium();

        // Then - the status is 0
        await expect(
            new PlaywrightAdapter({ launch: chromium.launch }).open('http://site.test/', VISIT),
        ).resolves.toHaveProperty('status', 0);
    });

    test('the PlaywrightAdapter — a visit — blocking external requests lets through the site and the allowed origins alone, and allowing them routes nothing', async () => {
        // Given - a page requesting the site, the backend and a CDN
        const chromium = stubChromium({ requests: REQUESTS });
        const adapter = new PlaywrightAdapter({ launch: chromium.launch });

        // When - one visit blocks with the backend allowed, one blocks with none allowed, one allows
        await adapter.open('http://site.test/', {
            ...VISIT,
            allowedOrigins: ['http://127.0.0.1:4100'],
            external: 'block',
        });
        await adapter.open('http://site.test/', { ...VISIT, external: 'block' });
        await adapter.open('http://site.test/', VISIT);

        // Then - each request continued or aborted by its origin, and nothing routed when allowed
        expect(chromium.log.filter((line) => !line.startsWith('newContext'))).toStrictEqual([
            'route **/*',
            'goto http://site.test/ {"waitUntil":"load"}',
            'continue http://site.test/app.js',
            'continue http://127.0.0.1:4100/api',
            'abort https://cdn.test/x.js',
            'route **/*',
            'goto http://site.test/ {"waitUntil":"load"}',
            'continue http://site.test/app.js',
            'abort http://127.0.0.1:4100/api',
            'abort https://cdn.test/x.js',
            'goto http://site.test/ {"waitUntil":"load"}',
        ]);
    });

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

        // Then - one launch, one fresh context per visit, each closed once when its visit ended
        expect([chromium.launches(), chromium.closes]).toStrictEqual([1, [1, 1, 1, 1]]);
    });

    test("the PlaywrightAdapter — the runners of a worker share its browser — close() ends the runner's open visits once, and leaves the browser to the worker", async () => {
        // Given - two runners, each with a visit still loading
        const chromium = stubChromium({ hold: true });
        const closing = new PlaywrightAdapter({ launch: chromium.launch });
        const other = new PlaywrightAdapter({ launch: chromium.launch });
        void closing.open('http://site.test/', VISIT);
        void other.open('http://site.test/', VISIT);
        await chromium.loading(2);

        // When - the first runner closes, twice
        await closing.close();
        await closing.close();

        // Then - its context is closed once, the other runner's is not, and the browser lives on
        expect([chromium.closes, chromium.log.includes('browser close')]).toStrictEqual([
            [1, 0],
            false,
        ]);
    });

    test('the PlaywrightAdapter — the runners of a worker share its browser — close() does not close again a visit that already ended', async () => {
        // Given - a runner whose visit ended normally, its context closed
        const chromium = stubChromium();
        const adapter = new PlaywrightAdapter({ launch: chromium.launch });
        await adapter.open('http://site.test/', VISIT);

        // When - the runner closes
        await adapter.close();

        // Then - the ended visit's context was closed once, by the visit
        expect(chromium.closes).toStrictEqual([1]);
    });

    test("the PlaywrightAdapter — a failed scenario leaves its evidence — a full-page screenshot into the project's evidence folder, which outlives the run's temp root", async () => {
        // Given - a runner whose scenario fails, and the evidence folder removed after the test
        const chromium = stubChromium();
        const adapter = new PlaywrightAdapter({ launch: chromium.launch });
        onTestFinished(() => {
            for (const shot of chromium.shots) {
                rmSync(dirname(shot), { force: true, recursive: true });
            }
        });

        // When - the visit runs it
        const failure = await messageOf(
            adapter.open('http://site.test/', { ...VISIT, scenario: failingScenario }),
        );

        // Then - the visit's refusal names the one screenshot, taken whole under the run's folder of the evidence folder
        const [shot = ''] = chromium.shots;
        const evidence = join(process.cwd(), EVIDENCE_DIR, basename(tmpdir()));
        expect([
            failure.replace(shot, '<shot>'),
            shot.startsWith(`${evidence}${sep}website-`) && shot.endsWith(`${sep}failure.png`),
            chromium.log.slice(-2),
        ]).toStrictEqual([
            [
                'found: the visit scenario failed:',
                '  the button is gone',
                'Evidence: <shot>',
                'why: A visit scenario drives the page step by step, and the first step that fails ends it.',
                'fix: correct the step that failed, or the page it drives',
                'read: docs/guides/website-specs.md#visit-scenarios--the-when',
            ].join('\n'),
            true,
            ['goto http://site.test/about {"waitUntil":"load"}', 'screenshot fullPage=true'],
        ]);
    });
});
