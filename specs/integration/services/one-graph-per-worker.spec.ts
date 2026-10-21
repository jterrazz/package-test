import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli as vitestCli } from '../../cli/vitest-cli.specification.js';

const RUNNER = './subject.specification.mjs';

describe('one-graph-per-worker', () => {
    test('a project naming its runner shares one module graph per worker, and boots a subject for every file', async () => {
        // Given - two spec files on one worker, both importing the specification and a module it counts its loads in
        const result = await vitestCli
            .fixture(directory('./__fixtures__/one-graph/'))
            .env({ RUNNER })
            .exec('run --configLoader runner');

        // Then - the counting module was loaded once and the specification ran once per file
        expect(result.exitCode).toBe(0);
        expect(
            [result.file('first.run').content, result.file('second.run').content].toSorted(),
        ).toStrictEqual(['boot 1 of 1 loads', 'boot 2 of 2 loads']);
    });

    test.each(['cli', 'website'])(
        'a %s project naming its runner shares one module graph per worker too, and boots a subject for every file',
        async (helper) => {
            // Given - the same two files on one worker, collected by a project whose subject runs in a process of its own
            const result = await vitestCli
                .fixture(directory('./__fixtures__/one-graph/'))
                .env({ HELPER: helper, RUNNER })
                .exec('run --configLoader runner');

            // Then - one graph for the worker, the specification ran once per file, and each file cleaned up the subject it booted
            expect(result.exitCode).toBe(0);
            expect(
                [result.file('first.run').content, result.file('second.run').content].toSorted(),
            ).toStrictEqual(['boot 1 of 1 loads', 'boot 2 of 2 loads']);
            expect(result.file('cleanups').content.split('\n').toSorted()).toStrictEqual([
                '',
                'boot 1',
                'boot 2',
            ]);
        },
    );

    test('a project naming two runners runs both before each file over one module graph, and each file cleans up what both booted', async () => {
        // Given - two files on one worker, each importing a different specification module of the two the project names
        const result = await vitestCli
            .fixture(directory('./__fixtures__/one-graph/'))
            .env({ OTHER: '1', RUNNER: `${RUNNER},./other.specification.mjs` })
            .exec('run --configLoader runner');

        // Then - one graph whose loads count both files, and a cleanup of each module for each file
        expect(result.exitCode).toBe(0);
        expect(
            [result.file('first.run').content, result.file('other.run').content]
                .map((run) => run.replace(/^boot (?<boot>\d+) of \d+ loads$/u, '$<boot>'))
                .toSorted(),
        ).toStrictEqual(['1', '2']);
        expect(result.file('cleanups').content.split('\n').toSorted()).toStrictEqual([
            '',
            'boot 1',
            'boot 2',
            'other 1',
            'other 2',
        ]);
    });

    test('a project naming no runner isolates every file', async () => {
        // Given - the same two files, the project stated with no runner
        const result = await vitestCli
            .fixture(directory('./__fixtures__/one-graph/'))
            .exec('run --configLoader runner');

        // Then - each file loaded its own graph, and booted the subject once in it
        expect(result.exitCode).toBe(0);
        expect([result.file('first.run').content, result.file('second.run').content]).toStrictEqual(
            ['boot 1 of 1 loads', 'boot 1 of 1 loads'],
        );
    });
});
