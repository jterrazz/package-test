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

describe('unknown-command', () => {
    test('captures unknown command failure', async () => {
        // Given - a command the fixture does not know
        const result = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .exec('nonexistent');

        // Then - non-zero exit with a useful stderr
        expect(result.exitCode).toBe(1);
        expect(result.stderr.text).toContain('Unknown command');
    });
});
