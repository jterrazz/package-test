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
    test('long-running (exec with waitFor/timeout — CONVENTIONS D11(b)) — terminates the whole process group, not just the direct child', async () => {
        // Given - a command that spawns a looping background grandchild (like a tsdown --watch under a dev command) and records its pid
        const result = await cli
            .fixture(directory('../../fixtures/cli-app/'))
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
