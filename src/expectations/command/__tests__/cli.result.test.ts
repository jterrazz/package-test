import { describe, expect, test } from 'vitest';

import { CliResult, createDockerReader } from '../cli.result.js';
import type { RunContainers, SentRequest } from '../cli.result.js';

const DOCKER = { envVar: 'TEST_RUN_ID', nameLabel: 'test.name', testRunLabel: 'test.run' };

// invariant: five containers carry the run's label: `c1` named api, `c2` named web in docker's lowercase, `c3` gone before it is inspected, `c4` with no labels, `c5` named nothing.
const INSPECTED: Record<string, unknown> = {
    c1: { Config: { Labels: { 'test.name': 'api' } } },
    c2: { config: { labels: { 'test.name': 'web' } } },
    c4: { Config: { Labels: null } },
    c5: { Config: { Labels: { 'test.name': '' } } },
};

function spawned(log: string[]): RunContainers {
    return {
        inspect: (id) => {
            log.push(`inspect ${id}`);
            if (id === 'c3') {
                throw new Error('no such container');
            }
            return INSPECTED[id];
        },
        labelled: (label, value) => {
            log.push(`find ${label}=${value}`);
            return ['c1', 'c2', 'c3', 'c4', 'c5'];
        },
        remove: (ids) => {
            log.push(`remove ${ids.join(',')}`);
        },
    };
}

function resultOf(
    stdout: string,
    options: {
        containers?: RunContainers;
        requests?: SentRequest[];
        testRunId?: string;
        transform?: (text: string) => string;
        withDocker?: boolean;
    } = {},
): CliResult {
    return new CliResult({
        commandOutput: { exitCode: 3, stderr: 'warned', stdout },
        config: {},
        containers: options.containers,
        dockerConfig: options.withDocker === true ? DOCKER : undefined,
        requests: options.requests,
        testDir: '/spec',
        testRunId: options.testRunId,
        transform: options.transform,
        workDir: '/work',
    });
}

function refusalOf(work: () => unknown): string {
    try {
        work();
        return '';
    } catch (error) {
        return error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);
    }
}

describe('CliResult', () => {
    test('requests — lists what the binary sent its backend, as copies, and none when no backend was declared', () => {
        // Given - a result of a run that sent one request, and one of a run with no backend
        const sent: SentRequest = {
            body: { report: 'daily' },
            headers: { 'content-type': 'application/json' },
            method: 'POST',
            url: '/ingest',
        };
        const result = resultOf('', { requests: [sent] });

        // When - a reader empties what it was handed
        result.requests.length = 0;
        for (const request of result.requests) {
            request.headers['content-type'] = 'text/plain';
        }

        // Then - the result still lists the request whole, and a run without a backend lists none
        expect([result.requests, resultOf('').requests]).toStrictEqual([[sent], []]);
    });

    test("cli.result — what a command left — its exit, each stream named for itself, its working directory, all in the result's one capture scope", () => {
        // Given - a command that exited 3, printing on both streams
        const result = resultOf('{"id": 7}');

        // Then - each part read back
        expect([
            result.exitCode,
            result.stdout.text,
            result.stdout.streamName,
            result.stderr.text,
            result.stderr.streamName,
            result.json.value,
            result.filesystem.cwd,
            [result.stdout, result.stderr, result.json, result.filesystem].every(
                (accessor) => accessor.captures === result.captures,
            ),
        ]).toStrictEqual([3, '{"id": 7}', 'stdout', 'warned', 'stderr', { id: 7 }, '/work', true]);
    });

    test('cli.result — what a command left — its JSON read through the transform, refused by the stream it read', () => {
        // Given - output a transform masks, and output that is no JSON
        const masked = resultOf('{"id": 7}', {
            transform: (text) => text.replace('7', '"<id>"'),
        });
        const plain = resultOf('done');

        // Then - the masked value, and the refusal naming stdout
        expect(masked.json.value).toStrictEqual({ id: '<id>' });
        expect(() => plain.json.value).toThrow('found: stdout is not valid JSON: done');
    });

    test('cli.result — the containers it spawned — each by its name label, else its id, read once, one docker cannot inspect left out', () => {
        // Given - a run whose label five containers carry: named in either casing, gone before inspection, labelled with nothing, and named nothing
        const log: string[] = [];
        const result = resultOf('', {
            containers: spawned(log),
            testRunId: 'run-1',
            withDocker: true,
        });

        // Then - the named ones by their names, the others by their ids, and the run's label queried once
        expect([
            result.container('api').id,
            result.container('web').id,
            result.container('c4').id,
            result.container('c5').id,
            result.container('c3').exists,
            result.containerIds,
            log,
        ]).toStrictEqual([
            'c1',
            'c2',
            'c4',
            'c5',
            false,
            ['c1', 'c2', 'c4', 'c5'],
            [
                'find test.run=run-1',
                'inspect c1',
                'inspect c2',
                'inspect c3',
                'inspect c4',
                'inspect c5',
            ],
        ]);
    });

    test('cli.result — the containers it spawned — removed on dispose: the ones read, else every one the run labelled, and none without docker', async () => {
        // Given - a result whose containers were read, one whose were not, one with no docker option, and one with no run id
        const log: string[] = [];
        const read = resultOf('', {
            containers: spawned(log),
            testRunId: 'run-1',
            withDocker: true,
        });
        const unread = resultOf('', {
            containers: spawned(log),
            testRunId: 'run-2',
            withDocker: true,
        });
        const plain = resultOf('', { containers: spawned(log), testRunId: 'run-3' });
        const unidentified = resultOf('', { containers: spawned(log), withDocker: true });
        void read.containerIds;
        log.length = 0;

        // When - each is disposed
        for (const result of [read, unread, plain, unidentified]) {
            await result[Symbol.asyncDispose]();
        }

        // Then - the read ones removed as read, the others found and removed
        expect(log).toStrictEqual([
            'remove c1,c2,c4,c5',
            'find test.run=run-2',
            'remove c1,c2,c3,c4,c5',
        ]);
    });

    test('cli.result — the containers it spawned — read only under Docker-aware mode, with a run id', () => {
        // Given - results with no docker option, with one but no run id, and with an empty one
        const results = [
            resultOf('', { testRunId: 'run-1' }),
            resultOf('', { withDocker: true }),
            resultOf('', { testRunId: '', withDocker: true }),
        ];
        const result = resultOf('');

        // Then - each refused
        expect([
            ...results.map((each) => refusalOf(() => each.containerIds)),
            refusalOf(() => result.container('api')),
        ]).toStrictEqual([
            ...results.map(
                () =>
                    'found: CliResult.containerIds, and the runner was not configured with a docker option',
            ),
            'found: CliResult.container, and the runner was not configured with a docker option',
        ]);

        // Then - the refusal says how to ask for them
        expect(() => result.containerIds).toThrow(
            new Error(
                [
                    'found: CliResult.containerIds, and the runner was not configured with a docker option',
                    'why: A CLI result reads the containers its run spawned only under Docker-aware mode.',
                    'fix: pass `docker: { envVar, nameLabel, testRunLabel }` in the specification.cli() options',
                    'read: docs/guides/cli-specs.md#docker-aware-mode',
                ].join('\n'),
            ),
        );
    });

    test('cli.result — a container read by its id — one docker inspects is present, one it cannot inspect is absent', () => {
        // Given - a docker that knows c1 and refuses c3
        const read = createDockerReader('/spec', spawned([]).inspect);

        // Then - c1 is read, c3 is absent rather than thrown
        expect([read('c1').exists, read('c3').exists]).toStrictEqual([true, false]);
    });
});
