import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

import { processAlive } from '../process-alive.js';

const refusing = (code: string) => (): void => {
    throw Object.assign(new Error(code), { code });
};

describe('processAlive', () => {
    test('processAlive — only a pid no process holds is dead — this process and a process another user owns run, a reaped child does not', () => {
        // Given - a child that ran and was reaped
        const { pid: reaped } = spawnSync(process.execPath, ['-e', '']);

        // Then - alive for this process and for pid 1, dead for the reaped child
        expect([processAlive(process.pid), processAlive(1), processAlive(reaped)]).toStrictEqual([
            true,
            true,
            false,
        ]);
    });

    test('processAlive — only a pid no process holds is dead — a probe answering EPERM or any other code reads as alive, ESRCH alone as dead', () => {
        // Given - probes answering each code signal 0 can throw, and one answering nothing
        // Then - each probe's answer
        expect([
            processAlive(7, refusing('EPERM')),
            processAlive(7, refusing('EINVAL')),
            processAlive(7, refusing('ESRCH')),
            processAlive(7, () => undefined),
        ]).toStrictEqual([true, true, false, true]);
    });
});
