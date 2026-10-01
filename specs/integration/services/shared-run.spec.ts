import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli as vitestCli } from '../../cli/vitest-cli.specification.js';

type WorkerRun = { end: number; pool: string; start: number };

describe('shared-run', () => {
    test('two service-bearing projects of one run are served by the one run services', async () => {
        // Given - a scratch run of an integration() and a job() project, each worker recording the address it was provided
        const result = await vitestCli
            .fixture(directory('./_fixtures/shared-run/'))
            .exec('run --configLoader runner');
        expect(result.exitCode).toBe(0);
        const integrationUrl = result.file('integration.url').content;

        // Then - both projects' workers were handed the same address
        expect(integrationUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
        expect(result.file('job.url').content).toBe(integrationUrl);
    });

    test('workers of two projects running at once never share a pool id, the band each isolates its data by', async () => {
        // Given - a scratch run of two service-bearing projects, three slow files each, each file recording its pool id and when it ran
        const result = await vitestCli
            .fixture(directory('./_fixtures/shared-run/'))
            .exec('run --configLoader runner');
        expect(result.exitCode).toBe(0);
        const runs = (project: string): WorkerRun[] =>
            [1, 2, 3].map((n): WorkerRun => {
                const [pool = '', start, end] = result
                    .file(`${project}-${n}.run`)
                    .content.split(' ');
                return { end: Number(end), pool, start: Number(start) };
            });
        const overlapping = runs('integration').flatMap((ran) =>
            runs('job')
                .filter((other) => ran.start < other.end && other.start < ran.end)
                .map((other) => [ran.pool, other.pool]),
        );

        // Then - the projects did run at once, and no two overlapping workers held one pool id
        expect(overlapping.length).toBeGreaterThan(0);
        expect(overlapping.filter(([one, other]) => one === other)).toStrictEqual([]);
    });
});
