import { describe, expect, test } from 'vitest';

import { directory } from '../../../src/index.js';
import { cli } from '../cli.specification.js';

/* Capability probes of stream capture and lifecycle, not of the fixture CLI's output (`output-asserted-as-a-golden` scalpel). */

describe('exit-zero', () => {
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
