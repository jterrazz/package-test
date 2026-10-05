import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';
import { describe, expect, test } from 'vitest';

import { readerOf } from '../../chain/state.js';
import type { LintPort, LintRun } from './lint.port.js';
import { run } from './run.action.js';

/** Linters that record each tree and run they are handed, and report nothing. */
function recording(asked: [string, LintRun][]): { linters: LintPort } {
    return {
        linters: {
            lint: async (tree, lintRun) => {
                asked.push([tree, lintRun]);
                return await Promise.resolve([]);
            },
        },
    };
}

const READ = readerOf({ slices: { rules: { 'no-console': 'error' } }, testDir: null });

describe('run', () => {
    test('run.action — linting — the working directory with the options stated, the spec folder with none laid, no args and no fix by default', async () => {
        // Given - a recording linter
        const asked: [string, LintRun][] = [];
        const linters = recording(asked);

        // When - a laid tree is linted with options, and a spec folder with none
        await run.perform([{ args: '--member web', fix: true }], READ, linters, {
            config: {},
            testDir: '/spec',
            workDir: '/work',
        });
        const result = await run.perform([], READ, linters, {
            config: {},
            testDir: '/spec',
            workDir: null,
        });

        // Then - each tree, what each run carried, and a clean tree's report, read in the result's scope
        expect([result.report.text, result.report.streamName]).toStrictEqual(['', 'report']);
        expect(result.report.captures).toBe(result.captures);
        expect(asked).toStrictEqual([
            ['/work', { args: '--member web', fix: true, rules: { 'no-console': 'error' } }],
            ['/spec', { args: '', fix: false, rules: { 'no-console': 'error' } }],
        ]);
    });

    test('run.action — preparing — lays the tree in a scratch directory of its own', async () => {
        // Given - the action about to run
        const { workDir } = (await run.prepare?.([], READ)) ?? { workDir: null };

        // Then - a fresh directory under the temp root, named for the lint specification
        expect([
            workDir === null ? '' : realpathSync(dirname(workDir)),
            basename(workDir ?? '').startsWith('spec-lint-'),
        ]).toStrictEqual([realpathSync(tmpdir()), true]);
    });
});
