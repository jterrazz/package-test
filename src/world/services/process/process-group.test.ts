import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { describe, expect, test } from 'vitest';

import { groupEnded } from './process-group.js';

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
});
