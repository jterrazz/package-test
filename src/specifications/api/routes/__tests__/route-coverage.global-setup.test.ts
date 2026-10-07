import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { ROUTES_DIR, shardLedgersDir, writeLedger } from '../ledger.js';
import type { Shard } from '../ledger.js';
import { routeCoverageSetup, setupRoutes } from '../route-coverage.global-setup.js';
import type { RouteProject } from '../route-coverage.global-setup.js';
import { PARTIAL_UNJUDGED, SHARD_UNJUDGED } from '../route-judge.js';
import { judgeSplit, partialSplitUnjudged } from '../route-split.js';

describe('setup', () => {
    test('route coverage — the global setup — is this module, from a checkout', () => {
        // Given - the source tree
        // Then - the setup a project registers is this very file
        expect(routeCoverageSetup()).toBe(
            join(import.meta.dirname, '../route-coverage.global-setup.ts'),
        );
    });

    test('route coverage — the global setup reads the run — a whole run starts from no ledger, and says nothing when no specification reached the api', async () => {
        // Given - a ledger a previous run left
        const { project, root } = stubProject({ ran: ['a.spec.ts', 'b.spec.ts'] });
        writeLedger(join(root, ROUTES_DIR), { declared: [], reached: [] });
        const lines = recordedLines();

        // When - the run starts, and ends with no specification writing a ledger
        const teardown = setupRoutes(project);
        await teardown();

        // Then - the old ledger cleared, and no line printed
        expect([existsSync(join(root, ROUTES_DIR)), lines]).toStrictEqual([false, []]);
    });

    test('route coverage — the global setup reads the run — the shards of an unfiltered split are judged once merged', async () => {
        // Given - both shards of a split set up with no filter, each reaching one route of three
        recordedLines();
        let root = '';
        for (const index of [1, 2]) {
            const run = stubProject({ ran: ['a.spec.ts'], root, shard: { count: 2, index } });
            ({ root } = run);
            const teardown = setupRoutes(run.project);
            writeOneOfThree(String(run.provided.get('routesLedger')));
            await teardown();
        }

        // When - the split is merged
        const verdict = await judgeSplit(root, { failed: 0, update: false });

        // Then - judged: the ratchet fails it
        expect(verdict.failure?.found).toMatch(
            /^api routes: 2 declared route\(s\) no test reached/u,
        );
    });

    test("route coverage — the global setup reads the run — a shard's ledgers go to its own folder, a whole run's are left, and its teardown judges nothing", async () => {
        // Given - a whole run's ledger at the root of the run's folder, and the setup of shard 1/2 over every file
        const { project, provided, root } = stubProject({
            ran: ['a.spec.ts', 'b.spec.ts'],
            shard: { count: 2, index: 1 },
        });
        writeLedger(join(root, ROUTES_DIR), { declared: [], reached: [] });
        const teardown = setupRoutes(project);

        // When - the shard's one specification reaches one route of three, and the run ends
        const directory = String(provided.get('routesLedger'));
        const lines = recordedLines();
        writeOneOfThree(directory);

        // Then - the shard's own folder, the whole run's ledger kept, and no verdict
        expect(directory).toBe(join(root, shardLedgersDir({ count: 2, index: 1 })));
        await expect(teardown()).resolves.toBeUndefined();
        expect(
            readdirSync(join(root, ROUTES_DIR)).filter((name) => name.endsWith('.json')),
        ).toHaveLength(1);
        expect(lines).toStrictEqual([`${SHARD_UNJUDGED}\n`]);
    });

    test('route coverage — the global setup reads the run — a run one of whose project files did not run judges nothing', async () => {
        // Given - the setup of a run that ran one file of the project's two
        const { project, provided } = stubProject({ ran: ['a.spec.ts'] });
        const teardown = setupRoutes(project);

        // When - its one specification reaches one route of three, and the run ends
        const lines = recordedLines();
        writeOneOfThree(String(provided.get('routesLedger')));

        // Then - no verdict
        await expect(teardown()).resolves.toBeUndefined();
        expect(lines).toStrictEqual([`${PARTIAL_UNJUDGED}\n`]);
    });

    test('route coverage — the global setup reads the run — a run whose tests a name filters judges nothing', async () => {
        // Given - the setup of a run of every file, filtered by -t
        const { project, provided } = stubProject({
            ran: ['a.spec.ts', 'b.spec.ts'],
            testNamePattern: /users/u,
        });
        const teardown = setupRoutes(project);

        // When - its one specification reaches one route of three, and the run ends
        const lines = recordedLines();
        const directory = String(provided.get('routesLedger'));
        writeOneOfThree(directory);

        // Then - no verdict, and no partial mark: only a shard's is ever read
        await expect(teardown()).resolves.toBeUndefined();
        expect([lines, existsSync(join(directory, 'partial'))]).toStrictEqual([
            [`${PARTIAL_UNJUDGED}\n`],
            false,
        ]);
    });

    test('route coverage — the global setup reads the run — a shard a test name filters leaves its merge unjudged, not judged as a whole run', async () => {
        // Given - shard 1/2 of a split filtered by -t, and shard 2/2 unfiltered, each reaching one route of three
        const { project, provided, root } = stubProject({
            ran: ['a.spec.ts'],
            shard: { count: 2, index: 1 },
            testNamePattern: /users/u,
        });
        recordedLines();
        const teardown = setupRoutes(project);
        writeOneOfThree(String(provided.get('routesLedger')));
        await teardown();
        writeOneOfThree(join(root, shardLedgersDir({ count: 2, index: 2 })));

        // When - the split is merged
        const verdict = await judgeSplit(root, { failed: 0, update: false });

        // Then - the merge names the filtered shard and judges nothing
        expect(verdict).toStrictEqual({ line: partialSplitUnjudged(['shard-1-2']) });
    });

    test('route coverage — the global setup reads the run — a run of every project file is judged', async () => {
        // Given - the setup of a run that ran the project's two files
        const { project, provided } = stubProject({ ran: ['a.spec.ts', 'b.spec.ts'] });
        const teardown = setupRoutes(project);

        // When - its one specification reaches one route of three, and the run ends
        writeOneOfThree(String(provided.get('routesLedger')));

        // Then - the ratchet fails the run
        await expect(teardown()).rejects.toThrow(
            'found: api routes: 2 declared route(s) no test reached, and the ratchet holds 0:',
        );
    });
});

function stubProject({
    ran,
    root: shared = '',
    shard,
    testNamePattern,
}: {
    ran: readonly string[];
    root?: string;
    shard?: Shard;
    testNamePattern?: RegExp;
}): { project: RouteProject; provided: Map<string, unknown>; root: string } {
    const root = shared === '' ? mkdtempSync(join(tmpdir(), 'route-coverage-')) : shared;
    onTestFinished(() => {
        rmSync(root, { force: true, recursive: true });
    });
    vi.stubEnv('TEST_UPDATE', '');
    onTestFinished(() => {
        vi.unstubAllEnvs();
    });
    const provided = new Map<string, unknown>();
    const project: RouteProject = {
        config: { root },
        globTestFiles: async () => ({
            testFiles: ['a.spec.ts', 'b.spec.ts'].map((file) => join(root, file)),
        }),
        name: 'api',
        provide: (key, value) => {
            provided.set(key, value);
        },
        vitest: {
            config: { shard, testNamePattern },
            state: {
                getFailedFilepaths: () => [],
                getFiles: () => [
                    ...ran.map((file) => ({ filepath: join(root, file), projectName: 'api' })),
                    { filepath: join(root, 'b.spec.ts'), projectName: 'unit' },
                ],
            },
        },
    };
    return { project, provided, root };
}

function writeOneOfThree(directory: string): void {
    writeLedger(directory, {
        declared: [
            { method: 'GET', path: '/users' },
            { method: 'GET', path: '/users/:id' },
            { method: 'DELETE', path: '/users/:id' },
        ],
        reached: [{ method: 'GET', path: '/users/7' }],
    });
}

function recordedLines(): string[] {
    const lines: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        lines.push(String(chunk));
        return true;
    });
    onTestFinished(() => {
        write.mockRestore();
    });
    return lines;
}
