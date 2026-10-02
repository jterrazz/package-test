import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli as vitestCli } from '../../cli/vitest-cli.specification.js';

function alive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

describe('killed-run', () => {
    test('a run killed with SIGKILL leaves no process() server behind', async () => {
        // Given - a scratch run whose process() server answers it, then SIGKILLs its own vitest and worker, teardown never reached
        const result = await vitestCli
            .fixture(directory('./_fixtures/killed-run/'))
            .exec('run', { timeout: 60_000 });
        expect(result.exitCode).not.toBe(0);
        const servedPid = Number(result.file('served.pid').content);
        expect(servedPid).toBeGreaterThan(0);
        expect(Number(result.file('answered.pid').content)).toBe(servedPid);

        // Then - the server dies with the run, within the stop grace and a poll
        await expect.poll(() => alive(servedPid), { timeout: 5000 }).toBe(false);
    });
});
