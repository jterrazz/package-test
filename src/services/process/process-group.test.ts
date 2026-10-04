import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { pause } from '../../chain/pause.js';
import { groupEnded, reaped, signalGroup } from './process-group.js';

async function outwaited(): Promise<string> {
    await pause(200);
    return 'pending';
}

async function settledFirst(child: ChildProcess): Promise<string> {
    const answered = async (): Promise<string> => {
        await reaped(child);
        return 'reaped';
    };
    return await Promise.race([answered(), outwaited()]);
}

describe('process-group', () => {
    test('process group — the wait for it to end — is false while the group outlives the deadline, and true once it is gone', async () => {
        // Given - a sleeper leading a group of its own
        const sleeper = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
        const group = -Number(sleeper.pid);

        // When - the wait runs out before the group ends, then the group is killed
        const outlived = await groupEnded(group, 100);
        process.kill(group, 'SIGKILL');
        await once(sleeper, 'exit');

        // Then - the first wait reports the group running, the second reports it gone
        expect(outlived).toBe(false);
        await expect(groupEnded(group, 1000)).resolves.toBe(true);
    });

    test('signalGroup — signals the whole group of a child, and the child alone when it has no group', async () => {
        // Given - a sleeper leading a group with a sleeper of its own, and a child that never started, its folder missing
        const leader = spawn('sh', ['-c', 'sleep 30 & sleep 30'], {
            detached: true,
            stdio: 'ignore',
        });
        const missing = spawn(process.execPath, [], {
            cwd: join(tmpdir(), 'process-group-no-such-folder'),
            stdio: 'ignore',
        });
        missing.on('error', () => {});

        // When - each is signalled, the leader's group by the default signal
        const signalled = [signalGroup(leader), signalGroup(missing)];
        const exit: unknown[] = await once(leader, 'exit');
        const [, signal] = exit;

        // Then - the group was terminated, the missing child had nothing to kill, and the group is gone
        expect([signalled, signal]).toStrictEqual([[true, false], 'SIGTERM']);
        await expect(groupEnded(-Number(leader.pid), 5000)).resolves.toBe(true);
    });

    test('reaped — waits for a running child to be reaped, and answers at once for one reaped already, by a code or a signal', async () => {
        // Given - a sleeper, and two children reaped before anyone asks, one by its code and one by a signal
        const sleeper = spawn('sleep', ['30'], { stdio: 'ignore' });
        const exitedByCode = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
        const killed = spawn('sleep', ['30'], { stdio: 'ignore' });
        killed.kill('SIGKILL');
        await Promise.all([once(exitedByCode, 'exit'), once(killed, 'exit')]);

        // When - each is awaited, the sleeper killed only once its wait was read
        const whileRunning = await settledFirst(sleeper);
        sleeper.kill('SIGKILL');
        const settled = [
            whileRunning,
            await settledFirst(sleeper),
            await settledFirst(exitedByCode),
            await settledFirst(killed),
        ];

        // Then - the running child was still awaited, and every reaped one answers before any deadline
        expect(settled).toStrictEqual(['pending', 'reaped', 'reaped', 'reaped']);
    });
});
