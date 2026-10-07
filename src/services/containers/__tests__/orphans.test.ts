import { describe, expect, test } from 'vitest';

import { orphans, ownerAlive, sweepOrphans } from '../orphans.js';
import type { ListedContainer } from '../orphans.js';

function listed(
    id: string,
    state: string,
    labels: { owner?: string; reaper?: boolean; reused?: boolean; session?: string } = {},
): ListedContainer {
    return {
        Id: id,
        Labels: {
            ...(labels.owner === undefined ? {} : { 'com.jterrazz.test.owner': labels.owner }),
            ...(labels.reused === true ? { 'com.jterrazz.test.reuse': 'true' } : {}),
            ...(labels.session === undefined
                ? {}
                : { 'org.testcontainers.session-id': labels.session }),
            ...(labels.reaper === true ? { 'org.testcontainers.ryuk': 'true' } : {}),
        },
        State: state,
    };
}

/** Answers as `kill(pid, 0)` would: 6 runs, 8 is another user's, every other pid is gone. */
function probe(pid: number): void {
    if (pid === 8) {
        throw Object.assign(new Error('not permitted'), { code: 'EPERM' });
    }
    if (pid !== 6) {
        throw Object.assign(new Error('no such process'), { code: 'ESRCH' });
    }
}
describe('orphans', () => {
    test('orphans — what a dead reaper session left behind — names the ended containers of a session no running reaper holds, and nothing else', () => {
        // Given - a live session (its reaper running) and a dead one, each with ended and running containers
        const containers = [
            listed('live-reaper', 'running', { reaper: true, session: 'live' }),
            listed('live-ended', 'exited', { session: 'live' }),
            listed('live-running', 'running', { session: 'live' }),
            listed('dead-exited', 'exited', { session: 'dead' }),
            listed('dead-dead', 'dead', { session: 'dead' }),
            listed('dead-created', 'created', { session: 'dead' }),
            listed('dead-running', 'running', { session: 'dead' }),
            listed('dead-reaper', 'exited', { reaper: true, session: 'dead' }),
            listed('no-session', 'exited'),
            listed('blank-session', 'exited', { session: '' }),
        ];

        // Then - only the dead session's ended containers: never a live session's, a running or starting one, a reaper, or one of no session
        expect(orphans(containers, () => true)).toStrictEqual(['dead-exited', 'dead-dead']);
    });

    test('orphans — what a dead reaper session left behind — names every container whose owner is dead, whatever its state and session, and nothing else', () => {
        // Given - one live session shared by two owners, one of them dead, and a reused container naming the dead one
        const containers = [
            listed('shared-reaper', 'running', { reaper: true, session: 'shared' }),
            listed('alive-running', 'running', { owner: 'host:1', session: 'shared' }),
            listed('killed-running', 'running', { owner: 'host:2', session: 'shared' }),
            listed('killed-created', 'created', { owner: 'host:2', session: 'shared' }),
            listed('killed-reused', 'running', { owner: 'host:2', reused: true }),
            listed('unowned-running', 'running', { session: 'shared' }),
        ];

        // Then - the dead owner's containers go, the live one's, the reused one and the unowned one stay
        expect(orphans(containers, (owner) => owner === 'host:1')).toStrictEqual([
            'killed-running',
            'killed-created',
        ]);
    });

    test('ownerAlive — whether the process a container names still runs — is dead only for a pid of this host no process answers', () => {
        // Given - owners of this host and of another, and labels that name no pid, a process group, or no host
        const answered = {
            gone: ownerAlive('here:7', 'here', probe),
            group: ownerAlive('here:0', 'here', probe),
            malformed: ownerAlive('here', 'here', probe),
            negative: ownerAlive('here:-3', 'here', probe),
            noHost: ownerAlive('7', '', probe),
            notANumber: ownerAlive('here:x', 'here', probe),
            otherHost: ownerAlive('there:7', 'here', probe),
            running: ownerAlive('here:6', 'here', probe),
            someoneElses: ownerAlive('here:8', 'here', probe),
        };

        // Then - only the gone pid is dead; a process another user owns still runs
        expect(answered).toStrictEqual({
            gone: false,
            group: true,
            malformed: true,
            negative: true,
            noHost: true,
            notANumber: true,
            otherHost: true,
            running: true,
            someoneElses: true,
        });
    });

    test('ownerAlive — whether the process a container names still runs — removes every orphan with its volumes, and answers the ones it removed', async () => {
        // Given - a runtime listing two orphans, one of which refuses removal
        const asked: unknown[] = [];
        const removed: [string, unknown][] = [];
        const runtime = {
            getContainer: (id: string) => ({
                remove: async (options: unknown) => {
                    if (id === 'stuck') {
                        throw new Error('removal already in progress');
                    }
                    removed.push([id, options]);
                    return options;
                },
            }),
            listContainers: async (options: unknown) => {
                asked.push(options);
                return [
                    listed('orphan', 'exited', { owner: 'host:2', session: 'gone' }),
                    listed('stuck', 'exited', { session: 'gone' }),
                ];
            },
        };

        // When - the sweep runs
        const answered = await sweepOrphans(runtime, () => true);

        // Then - it listed every session container and every owned one, removed the orphan once, running or not and with its volumes, and skipped the refusal
        expect({ answered, asked, removed }).toStrictEqual({
            answered: ['orphan'],
            asked: [
                { all: true, filters: { label: ['org.testcontainers.session-id'] } },
                { all: true, filters: { label: ['com.jterrazz.test.owner'] } },
            ],
            removed: [['orphan', { force: true, v: true }]],
        });
    });
});
