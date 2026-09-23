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
    test('captures non-zero exit code', async () => {
        // Given - a command that exits 2
        const result = await cli.fixture(directory('../../fixtures/cli-app/')).exec('fail');

        // Then - the exit code is preserved
        expect(result.exitCode).toBe(2);
    });

    test('multi-exec — stops on first failure', async () => {
        // Given - fail then build (fail exits non-zero, build should not run)
        const result = await cli
            .fixture(directory('../../fixtures/cli-app/'))
            .exec(['fail', 'build']);

        // Then - stopped at fail
        expect(result.exitCode).toBe(2);
        expect(result.stderr.text).toContain('Fatal: something went wrong');
    });
});
