import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

/*
 * These are exec()-capability probes: the subject under test is stream capture,
 * routing and lifecycle (stdout/stderr, exit codes, waitFor, process-group kill),
 * not the fixture CLI's output correctness. Targeted toContain probes are the right
 * level; the waitFor block is cut at an arbitrary instant (CONVENTIONS D11(b)), unstable
 * to snapshot by nature. Whole-output correctness IS a golden — see help.txt/start.txt.
 */

describe('sequences', () => {
    test('runs a command successfully', async () => {
        // Given - the cli-app fixture project
        const result = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .exec('build');

        // Then - clean exit
        expect(result.exitCode).toBe(0);
    });

    test('multi-exec — runs commands sequentially in same directory', async () => {
        // Given - build then start (start needs dist/ from build)
        const result = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .exec(['build', 'start']);

        // Then - the last command's whole output is surfaced
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            Hello from CLI app
        `);
    });

    test('multi-exec — preserves files between commands', async () => {
        // Given - build creates dist/, then we check it still exists
        const result = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .exec(['build', 'check']);

        // Then - the sequence shares one working directory
        expect(result.exitCode).toBe(0);
        expect(result.file('dist/index.js').exists).toBeTruthy();
    });

    test('long-running (exec with waitFor/timeout — CONVENTIONS D11(b)) — rejects waitFor options on a command sequence', async () => {
        // Given - an array of commands plus long-running options
        // Then - the combination is refused: `.exec()` answers a promise, so the refusal arrives as a rejection
        await expect(
            cli
                .fixture(directory('../../shared/fixtures/specimen-cli/'))
                .exec(['build', 'start'], { waitFor: 'x' }),
        ).rejects.toThrow('not supported with a command sequence');
    });
});
