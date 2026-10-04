import { describe, expect, test } from 'vitest';

import type { CliResult } from './cli.result.js';
import { ContainerAccessor } from './container.js';

function unread(): CliResult {
    throw new Error('no command runs in these tests');
}

function captured(
    containerId: null | string,
    inspectData: unknown,
    transform?: (text: string) => string,
): ContainerAccessor {
    return new ContainerAccessor({
        containerId,
        inspectData,
        resultOf: unread,
        testDir: '/spec',
        transform,
    });
}

/** What a test reads first of a container: whether it exists, runs, and its status. */
function stateOf(container: ContainerAccessor): unknown {
    return {
        exists: container.exists,
        id: container.id,
        running: container.running,
        status: container.status,
    };
}

describe('ContainerAccessor', () => {
    test('container — the state a run captured — read from docker inspect in either casing, unknown when inspect holds none, absent when no container was captured', () => {
        // Given - a running container, a restarting one inspected in lowercase, ones inspected with no state, and none
        // Then - each state
        expect([
            stateOf(captured('c1', { State: { Running: true, Status: 'running' } })),
            stateOf(captured('c2', { state: { running: true, status: 'restarting' } })),
            stateOf(captured('c3', { State: { Status: 7 } })),
            stateOf(captured('c4', {})),
            stateOf(captured('c5', { State: null })),
            stateOf(captured(null, null)),
        ]).toStrictEqual([
            { exists: true, id: 'c1', running: true, status: 'running' },
            { exists: true, id: 'c2', running: true, status: 'restarting' },
            { exists: true, id: 'c3', running: false, status: 'unknown' },
            { exists: true, id: 'c4', running: false, status: 'unknown' },
            { exists: true, id: 'c5', running: false, status: 'unknown' },
            { exists: false, id: null, running: false, status: 'absent' },
        ]);
    });

    test('container — the state a run captured — answers its inspect object through the transform, and refuses it for a container never captured', () => {
        // Given - a captured container read plainly, through a transform, and through one that breaks it, and none
        const inspected = { Id: 'c1', State: { Running: true } };
        const masked = captured('c1', inspected, (text) => text.replace('"c1"', '"<id>"'));
        const broken = captured('c1', inspected, () => 'c1');

        // Then - the inspect object, masked, the refusal naming the stream, and the refusal naming what was read
        expect([captured('c1', inspected).inspect.value, masked.inspect.value]).toStrictEqual([
            inspected,
            { Id: '<id>', State: { Running: true } },
        ]);
        expect(() => broken.inspect.value).toThrow('found: inspect is not valid JSON: c1');
        expect(() => captured(null, null).inspect).toThrow(
            new Error(
                [
                    'found: ContainerAccessor.inspect, and the container does not exist',
                    'why: A container is read only once the run spawned it.',
                    'fix: assert `.exists` first, or name a container the run spawned',
                    'read: docs/reference/assertions.md#container-subjects-docker-aware-cli',
                ].join('\n'),
            ),
        );
    });
});
