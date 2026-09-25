import { describe, expect, test } from 'vitest';

import { orphans, sweepOrphans } from './orphans.js';
import type { ListedContainer } from './orphans.js';

/** A listed container: its id, its state, and the session and reaper labels it carries. */
function listed(
    id: string,
    state: string,
    labels: { reaper?: boolean; session?: string } = {},
): ListedContainer {
    return {
        Id: id,
        Labels: {
            ...(labels.session === undefined
                ? {}
                : { 'org.testcontainers.session-id': labels.session }),
            ...(labels.reaper === true ? { 'org.testcontainers.ryuk': 'true' } : {}),
        },
        State: state,
    };
}

describe('orphans — what a dead reaper session left behind', () => {
    test('names the ended containers of a session no running reaper holds, and nothing else', () => {
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
        expect(orphans(containers)).toStrictEqual(['dead-exited', 'dead-dead']);
    });

    test('removes every orphan with its volumes, and answers the ones it removed', async () => {
        // Given - a runtime listing two orphans, one of which refuses removal
        const asked: unknown[] = [];
        const removed: string[] = [];
        const runtime = {
            getContainer: (id: string) => ({
                remove: async (options: unknown) => {
                    await Promise.resolve();
                    if (id === 'stuck') {
                        throw new Error('removal already in progress');
                    }
                    removed.push(id);
                    return options;
                },
            }),
            listContainers: async (options: unknown) => {
                asked.push(options);
                await Promise.resolve();
                return [
                    listed('orphan', 'exited', { session: 'gone' }),
                    listed('stuck', 'exited', { session: 'gone' }),
                ];
            },
        };

        // When - the sweep runs
        const answered = await sweepOrphans(runtime);

        // Then - it listed every session container, removed the orphan, and skipped the refusal
        expect({ answered, asked, removed }).toStrictEqual({
            answered: ['orphan'],
            asked: [{ all: true, filters: { label: ['org.testcontainers.session-id'] } }],
            removed: ['orphan'],
        });
    });
});
