import { describe, expect, test } from 'vitest';

import { readerOf } from '../../chain/state.js';
import { trigger } from './trigger.action.js';

const WHY = 'why: A job is triggered by the name it is registered under.';

const READS = 'read: docs/guides/job-specs.md#options';

const READ = readerOf({ slices: {}, testDir: null });
const RUN = { config: {}, testDir: '/spec', workDir: null };

async function refusalOf(work: Promise<unknown>): Promise<string> {
    try {
        await work;
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

describe('trigger', () => {
    test('trigger.action — a job run by its name — runs the one registered under it, and refuses a name no job has, or a runner with none', async () => {
        // Given - two registered jobs, one of which records its run
        const ran: string[] = [];
        const jobs = [
            {
                execute: async () => {
                    await Promise.resolve();
                },
                name: 'digest',
            },
            {
                execute: async () => {
                    ran.push('cleanup');
                    await Promise.resolve();
                },
                name: 'cleanup',
            },
        ];

        // When - each name is triggered, and a runner with no job asked
        const result = await trigger.perform(['cleanup'], READ, { jobs }, RUN);
        const refusals = await Promise.all([
            refusalOf(trigger.perform(['reindex'], READ, { jobs }, RUN)),
            refusalOf(trigger.perform(['cleanup'], READ, { jobs: [] }, RUN)),
        ]);

        // Then - the named job ran, its result reads the spec's folder, and each refusal names what is missing
        expect([ran, result.directory().root, refusals]).toStrictEqual([
            ['cleanup'],
            '/spec',
            [
                [
                    'found: .trigger("reindex"), and no job is registered under that name',
                    WHY,
                    'fix: trigger a registered job: digest, cleanup',
                    READS,
                ].join('\n'),
                [
                    'found: .trigger("cleanup"), and no job is registered',
                    WHY,
                    'fix: register the jobs with the `jobs` option of specification.job()',
                    READS,
                ].join('\n'),
            ],
        ]);
    });
});
