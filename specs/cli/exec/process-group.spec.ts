import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/* invariant: capability probes of stream capture and lifecycle, not of the fixture CLI's output (`output-asserted-as-a-golden` scalpel). */

describe('process-group', () => {
    test('long-running (exec with waitFor/timeout — rule `output-asserted-as-a-golden`(b)) — terminates the whole process group, not just the direct child', async () => {
        // Given - a command that spawns a looping background grandchild (like a tsdown --watch under a dev command) and records its pid
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .exec('spawn-daemon', { timeout: 10_000, waitFor: 'daemon ready' });
        expect(result.exitCode).toBe(0);
        const daemonPid = Number(result.file('daemon.pid').content.trim());
        expect(daemonPid).toBeGreaterThan(0);

        // Then - the grandchild is dead too: killing only the shell child would orphan it (signal 0 probes liveness without signalling)
        await expect
            .poll(
                () => {
                    try {
                        process.kill(daemonPid, 0);
                        return true;
                    } catch {
                        return false;
                    }
                },
                { timeout: 5000 },
            )
            .toBe(false);
    });
});
