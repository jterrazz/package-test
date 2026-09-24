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
    test('long-running (exec with waitFor/timeout — CONVENTIONS D11(b)) — resolves when the waitFor pattern is matched in stderr', async () => {
        // Given - a process whose readiness banner goes to stderr
        const result = await cli
            .fixture(directory('../../shared/fixtures/cli-app/'))
            .exec('dev-stderr', { timeout: 10_000, waitFor: 'Listening on stderr' });

        // Then - resolved at the stderr pattern with the output captured so far
        expect(result.exitCode).toBe(0);
        expect(result.stderr.text).toContain('Listening on stderr');
    });
});
