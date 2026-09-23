import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { file, text } from '../../../src/index.js';
import type { DiskFile, RelativePath } from '../../../src/index.js';
import { api } from '../api.specification.js';

/** The message a run that must fail failed with. */
async function failureOf(run: Promise<unknown>): Promise<string> {
    try {
        await run;
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
    throw new Error('expected the document to fail, but it passed');
}

// The bridge door: `api.run(file(…))` runs a `kind: api` document from code,
// So a spec can add what the document cannot say — and prove what the runner
// Refuses, on documents no glob collects (the inputs under fixtures/).

describe('api documents — the bridge door', () => {
    test('a document run from code hands back its last response', async () => {
        // Given - a two-step journey, run through the bridge
        const result = await api.run(file('./read-back.spec.yaml'));

        // Then - the result is the last step's: the listing the first step changed
        expect(result.response).toMatch(file('./expected/users-listed.http'));
    });

    test('setup chained before the document lays underneath it', async () => {
        // Given - a seed chained before a document that seeds nothing
        const message = await failureOf(
            api
                .seed(file('../../seeds/one-user.sql'), { database: 'db' })
                .run(file('./read-back.spec.yaml'), { frozen: true }),
        );

        // Then - the chained user is listed too, so the document's listing no longer holds
        expect(text(message)).toMatch(file('./expected/chained-seed-error.txt'));
    });
});

describe('api documents — what the runner refuses', () => {
    test.each([
        [
            'unknown-key',
            'fixtures/unknown-key.spec.yaml:3: unknown key "cases:" in an api document',
        ],
        [
            'seed-outside-seeds',
            'fixtures/seed-outside-seeds.spec.yaml:3: seed: reads seeds/, and "./expected/users.sql" names expected/',
        ],
        [
            'seed-in-the-fixtures-pool',
            'fixtures/seed-in-the-fixtures-pool.spec.yaml:3: seed: reads seeds/, and "../../../fixtures/seeds/catalog.sql" names fixtures/ — put the file in ./seeds/ beside the document, or in specs/seeds/ if several leaves share it (C24)',
        ],
        [
            'capture-before-it-exists',
            'fixtures/capture-before-it-exists.spec.yaml:6: "{{sessionId}}" is referenced before it exists',
        ],
        [
            'missing-seed',
            'fixtures/missing-seed.spec.yaml:4: seed: "./seeds/nowhere.sql" names nothing',
        ],
        [
            'a-jobs-case',
            "fixtures/a-jobs-case.spec.yaml:1: a kind: jobs document is run by jobs.run(), and this runner is specification.api()'s",
        ],
    ])('%s: refused before any request, on the line that says it', async (name, message) => {
        // Given - a document the grammar or its ground refuses
        const run = api.run(file(`./fixtures/${name}.spec.yaml`));

        // Then - the refusal names the file, the line and what the key reads
        await expect(run).rejects.toThrow(message);
    });

    test('a response that disagrees fails naming the step, the mismatch and the line', async () => {
        // Given - a document expecting a user that was never seeded
        const message = await failureOf(
            api.run(file('./fixtures/wrong-status.spec.yaml'), { frozen: true }),
        );

        // Then - the whole rendering: the description, the request, the mismatch, the line
        expect(text(message)).toMatch(file('./expected/wrong-status-error.txt'));
    });

    test('a table that disagrees fails with the rows it holds', async () => {
        // Given - a document expecting a row the request never wrote
        const message = await failureOf(
            api.run(file('./fixtures/wrong-table.spec.yaml'), { frozen: true }),
        );

        // Then - the table diff, on the table's line
        expect(text(message)).toMatch(file('./expected/wrong-table-error.txt'));
    });

    test('a capture that finds nothing stops the journey where it was read', async () => {
        // Given - a step capturing a field the response lacks
        const failure = api.run(file('./fixtures/capture-finds-nothing.spec.yaml'));

        // Then - the path and the body it searched, before the next step is sent
        await expect(failure).rejects.toThrow(
            'capture: orderId — $.order.id found nothing in the response body',
        );
    });
});

/** A scratch leaf holding one document that names `./expected/echo.http`, named the one way `api.run()` accepts. */
function leafWithGolden(golden: null | string): {
    document: DiskFile<'.spec.yaml'>;
    golden: string;
} {
    const dir = mkdtempSync(resolve(tmpdir(), 'api-document-'));
    onTestFinished(() => {
        rmSync(dir, { force: true, recursive: true });
    });
    const path = resolve(dir, 'case.spec.yaml');
    writeFileSync(
        path,
        [
            'kind: api',
            'description: records the echo it got back',
            'request: GET /echo/recorded',
            'response: ./expected/echo.http',
            '',
        ].join('\n'),
    );
    const goldenPath = resolve(dir, 'expected', 'echo.http');
    if (golden !== null) {
        mkdirSync(resolve(dir, 'expected'));
        writeFileSync(goldenPath, golden);
    }
    return {
        document: file(relative(import.meta.dirname, path) as RelativePath<'.spec.yaml'>),
        golden: goldenPath,
    };
}

describe('api documents — update mode records the golden a response: names', () => {
    test.each([
        ['a missing golden is created', null],
        ['an empty golden is filled', ''],
    ])('%s, and the next run passes on it', async (_name, golden) => {
        // Given - a document whose response: golden does not exist yet, or holds nothing
        const leaf = leafWithGolden(golden);

        // Given - one update run
        vi.stubEnv('TEST_UPDATE', '1');
        await api.run(leaf.document);
        vi.unstubAllEnvs();

        // Then - the golden holds what came back, and a normal run passes on it
        expect(existsSync(leaf.golden)).toBe(true);
        expect(readFileSync(leaf.golden, 'utf8')).toContain('HTTP/1.1 200');
        await api.run(leaf.document);
    });

    test('outside update mode, a missing golden is still refused on its line', async () => {
        // Given - the same document, its golden never recorded
        const leaf = leafWithGolden(null);

        // Then - refused before any request, naming the path
        await expect(api.run(leaf.document)).rejects.toThrow(
            'case.spec.yaml:4: response: "./expected/echo.http" names nothing',
        );
    });
});
