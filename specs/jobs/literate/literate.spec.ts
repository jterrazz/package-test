import { describe, expect, test } from 'vitest';

import { file, text } from '../../../src/index.js';
import { jobs } from '../jobs.specification.js';

// The bridge door of a `kind: jobs` document, and what its runner refuses —
// Run on the inputs under fixtures/, which no glob collects.

/** The message a run that must fail failed with. */
async function failureOf(run: Promise<unknown>): Promise<string> {
    try {
        await run;
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
    throw new Error('expected the document to fail, but it passed');
}

describe('jobs documents — what the runner refuses', () => {
    test('a job nobody registered is refused on the trigger line, naming the jobs that are', async () => {
        // Given - a document triggering an unknown name
        const run = jobs.run(file('./fixtures/unknown-job.spec.yaml'));

        // Then - refused before any setup, naming the registry
        await expect(run).rejects.toThrow(
            'fixtures/unknown-job.spec.yaml:3: trigger: "nope" is not a registered job — registered: sync-events, crash-after-insert, enrich-from-api, stamp-now',
        );
    });

    test('an error that disagrees names both', async () => {
        // Given - the crash golden stating another message
        const message = await failureOf(jobs.run(file('./fixtures/wrong-error.spec.yaml')));

        // Then - the rendering, on the error line
        expect(text(message)).toMatch(file('./expected/wrong-error.txt'));
    });

    test.each([
        [
            'unexpected-crash',
            'the job rejected, and the document states no error:\n  crash-after-insert: boom',
        ],
        ['expected-crash', 'the job succeeded, and the document states it rejects with:\n  boom'],
        ['extra-row', 'Table "events" mismatch'],
    ])('%s: the outcome the document states is the one judged', async (name, detail) => {
        // Given - a document whose outcome the job does not deliver
        const run = jobs.run(file(`./fixtures/${name}.spec.yaml`));

        // Then - the run fails naming what it saw
        await expect(run).rejects.toThrow(detail);
    });

    test('a document run after a chained seed stands on it', async () => {
        // Given - a seed chained before a document triggering the sync
        const result = await jobs
            .seed(file('./seeds/one-user.sql'), { database: 'db' })
            .run(file('./fixtures/extra-row.spec.yaml'));

        // Then - the chained user was synced, so the document's one row holds
        await expect(result.table('events', { database: 'analyticsDb' })).toMatchRows({
            columns: ['payload'],
            rows: [['{"name":"Alice"}']],
        });
    });
});
