import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { groupEnded, signalGroup } from './process-group.js';

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
});
