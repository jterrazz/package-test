import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/* invariant: capability probes: a `waitFor` block is cut at an arbitrary instant (`output-asserted-as-a-golden`(b)). */

describe('wait-for-stderr', () => {
    test('long-running (exec with waitFor/timeout — rule `output-asserted-as-a-golden`(b)) — resolves when the waitFor pattern is matched in stderr', async () => {
        // Given - a process whose readiness banner goes to stderr
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .exec('dev-stderr', { timeout: 10_000, waitFor: 'Listening on stderr' });

        // Then - resolved at the stderr pattern with the output captured so far
        expect(result.exitCode).toBe(0);
        expect(result.stderr.text).toContain('Listening on stderr');
    });
});
