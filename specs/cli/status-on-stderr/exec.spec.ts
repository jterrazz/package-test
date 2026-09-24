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
    test('captures stderr on exit zero (Unix-style status banners)', async () => {
        // Given - a command that prints to stderr and exits 0, mirroring the unix convention where status banners go to stderr while data goes to stdout. spwn, gh, git, npm and many others follow this pattern.
        const result = await cli
            .fixture(directory('../../shared/fixtures/specimen-cli/'))
            .exec('status-on-stderr');

        // Then - exit code is zero AND stderr is preserved (regression guard: an earlier execSync-based adapter discarded stderr on exit zero, leaving CLI consumers unable to snapshot status output).
        expect(result.exitCode).toBe(0);
        expect(result.stderr.text).toBe('Operation succeeded\n');
        expect(result.stdout.text).toBe('');
    });
});
