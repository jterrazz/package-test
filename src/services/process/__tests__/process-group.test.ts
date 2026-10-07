import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { pause } from '../../../chain/pause.js';
import { groupEnded, reaped, REAPER, signalGroup, WATCHDOG } from '../process-group.js';
import { alive, programNamed } from './serve.fixtures.js';

/** Keeps the process up until it is signalled, a minute at most: a test that fails before its cleanup leaves it no longer. */
const KEEP = 'setTimeout(() => {}, 60000)';

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

    test('the watchdog ends the group it guards once its parent closes its stdin', async () => {
        // Given - a sleeper leading a group of its own, guarded by a watchdog reading its parent's pipe
        const sleeper = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
        const group = -Number(sleeper.pid);
        const watchdog = spawn(process.execPath, ['-e', WATCHDOG, '[]', String(sleeper.pid)], {
            stdio: ['pipe', 'ignore', 'ignore'],
        });

        // When - the parent's end of the pipe closes, as when the parent dies
        watchdog.stdin.end();
        const ended = await groupEnded(group, 3000);
        if (!ended) {
            process.kill(group, 'SIGKILL');
        }

        // Then - the group is gone, ended by the watchdog alone
        expect(ended).toBe(true);
    });

    test('the watchdog reaps the strays it is handed once its parent closes its stdin, their group gone already', async () => {
        // Given - a stray xcodebuild naming a simulator in a group of its own, two bystanders each missing one of its marks, and a watchdog over a group already gone
        const udid = 'PROCESS-GROUP-WATCHDOG-SIM';
        const xcodebuild = programNamed('xcodebuild');
        const stray = spawn(xcodebuild, ['-e', KEEP, 'WebDriverAgent', `id=${udid}`], {
            detached: true,
            stdio: 'ignore',
        });
        const bystanders = [
            spawn(process.execPath, ['-e', KEEP, 'WebDriverAgent', `id=${udid}`], {
                stdio: 'ignore',
            }),
            spawn(xcodebuild, ['-e', KEEP, 'WebDriverAgent'], { stdio: 'ignore' }),
        ];
        const gone = spawn('true', [], { detached: true, stdio: 'ignore' });
        await once(gone, 'exit');
        const strays = [{ holds: ['WebDriverAgent', `id=${udid}`], program: 'xcodebuild' }];
        const watchdog = spawn(
            process.execPath,
            ['-e', WATCHDOG, JSON.stringify(strays), String(gone.pid)],
            { stdio: ['pipe', 'ignore', 'ignore'] },
        );
        await pause(1500);
        const watching = alive(Number(watchdog.pid));

        // When - the parent's end of the pipe closes, as when the parent dies
        watchdog.stdin.end();
        await reaped(stray);
        const survivors = bystanders.map((bystander) => alive(Number(bystander.pid)));
        for (const bystander of bystanders) {
            bystander.kill('SIGKILL');
        }

        // Then - the watchdog outlived the group to reap the stray, and only the stray
        expect([watching, stray.signalCode, survivors]).toStrictEqual([
            true,
            'SIGTERM',
            [true, true],
        ]);
    });

    test('the reaper ends every stray it is handed, and only those', async () => {
        // Given - a stray runner app inside a simulator, and a bystander of the same name inside another
        const runner = 'WebDriverAgentRunner-Runner';
        const stray = spawn(programNamed(runner), ['-e', KEEP, '/Devices/REAPER-SIM/'], {
            stdio: 'ignore',
        });
        const bystander = spawn(programNamed(runner), ['-e', KEEP, '/Devices/OTHER-SIM/'], {
            stdio: 'ignore',
        });
        await pause(300);

        // When - the reaper runs over the strays of that simulator
        const strays = [{ holds: ['/Devices/REAPER-SIM/'], program: runner }];
        const reaper = spawn(process.execPath, ['-e', REAPER, JSON.stringify(strays)], {
            stdio: 'ignore',
        });
        await reaped(reaper);
        await reaped(stray);
        const survived = alive(Number(bystander.pid));
        bystander.kill('SIGKILL');

        // Then - the stray was terminated, the bystander left alone
        expect([stray.signalCode, survived]).toStrictEqual(['SIGTERM', true]);
    });
});
