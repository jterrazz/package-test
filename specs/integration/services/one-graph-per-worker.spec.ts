import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli as vitestCli } from '../../cli/vitest-cli.specification.js';

const SPECIFICATION = './subject.specification.mjs';

describe('one-graph-per-worker', () => {
    test('a project naming its specification shares one module graph per worker, and boots a subject for every file', async () => {
        // Given - two spec files on one worker, both importing the specification and a module it counts its loads in
        const result = await vitestCli
            .fixture(directory('./_fixtures/one-graph/'))
            .env({ SPECIFICATION })
            .exec('run --configLoader runner');

        // Then - the counting module was loaded once and the specification ran once per file
        expect(result.exitCode).toBe(0);
        expect(
            [result.file('first.run').content, result.file('second.run').content].toSorted(),
        ).toStrictEqual(['boot 1 of 1 loads', 'boot 2 of 2 loads']);
    });

    test('a project naming no specification isolates every file', async () => {
        // Given - the same two files, the project stated with no specification
        const result = await vitestCli
            .fixture(directory('./_fixtures/one-graph/'))
            .exec('run --configLoader runner');

        // Then - each file loaded its own graph, and booted the subject once in it
        expect(result.exitCode).toBe(0);
        expect([result.file('first.run').content, result.file('second.run').content]).toStrictEqual(
            ['boot 1 of 1 loads', 'boot 1 of 1 loads'],
        );
    });
});
