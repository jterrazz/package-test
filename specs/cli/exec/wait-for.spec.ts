import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/* invariant: capability probes: a `waitFor` block is cut at an arbitrary instant (`output-asserted-as-a-golden`(b)). */

describe('wait-for', () => {
    test('long-running (exec with waitFor/timeout — rule `output-asserted-as-a-golden`(b)) — resolves when the waitFor pattern is matched in stdout', async () => {
        // Given - a watch-mode process that prints then keeps running
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .exec('dev', { timeout: 10_000, waitFor: 'Hello from CLI app' });

        // Then - resolved at the pattern with the output captured so far
        expect(result.exitCode).toBe(0);
        expect(result.stdout.text).toContain('Starting dev mode');
        expect(result.stdout.text).toContain('Hello from CLI app');
    });

    test('long-running (exec with waitFor/timeout — rule `output-asserted-as-a-golden`(b)) — waitFor without timeout defaults to 10s', async () => {
        // Given - only waitFor is set
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .exec('dev', { waitFor: 'Hello from CLI app' });

        // Then - the pattern resolved well before the default timeout
        expect(result.exitCode).toBe(0);
    });

    test('long-running (exec with waitFor/timeout — rule `output-asserted-as-a-golden`(b)) — kills a long-running process at the timeout', async () => {
        // Given - dev runs forever but the pattern never appears
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .exec('dev', { timeout: 2000, waitFor: 'NONEXISTENT_PATTERN' });

        // Then - exit code 124 (timeout)
        expect(result.exitCode).toBe(124);
    });
});
