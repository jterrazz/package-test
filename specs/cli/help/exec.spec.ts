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

describe('exec', () => {
    test('surfaces the whole usage banner on stdout', async () => {
        // Given - the help command
        const result = await cli.fixture(directory('../../shared/fixtures/cli-app/')).exec('help');

        // Then - the whole usage banner is surfaced on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            Usage: cli <command>

            Commands:
              build   Build the project
              check   Check code quality
        `);
    });

    test('long-running (exec with waitFor/timeout — CONVENTIONS D11(b)) — returns non-zero when the process exits without matching', async () => {
        // Given - help exits immediately without matching pattern
        const result = await cli
            .fixture(directory('../../shared/fixtures/cli-app/'))
            .exec('help', { timeout: 5000, waitFor: 'NONEXISTENT_PATTERN' });

        // Then - exit code 1 (pattern not matched before process exited)
        expect(result.exitCode).toBe(1);
    });
});
