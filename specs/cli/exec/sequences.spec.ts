import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/* Capability probes of stream capture and lifecycle, not of the fixture CLI's output (`output-asserted-as-a-golden` scalpel). */

describe('sequences', () => {
    test('runs a command successfully', async () => {
        // Given - the cli-app fixture project
        const result = await cli.fixture(directory('../_fixtures/specimen-cli/')).exec('build');

        // Then - clean exit
        expect(result.exitCode).toBe(0);
    });

    test('multi-exec — runs commands sequentially in same directory', async () => {
        // Given - build then start (start needs dist/ from build)
        const result = await cli
            .fixture(directory('../_fixtures/specimen-cli/'))
            .exec(['build', 'start']);

        // Then - the last command's whole output is surfaced
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            Hello from CLI app
        `);
    });

    test('multi-exec — preserves files between commands', async () => {
        // Given - build creates dist/, then we check it still exists
        const result = await cli
            .fixture(directory('../_fixtures/specimen-cli/'))
            .exec(['build', 'check']);

        // Then - the sequence shares one working directory
        expect(result.exitCode).toBe(0);
        expect(result.file('dist/index.js').exists).toBe(true);
    });

    test('long-running (exec with waitFor/timeout — rule `output-asserted-as-a-golden`(b)) — rejects waitFor options on a command sequence', async () => {
        // Given - an array of commands plus long-running options
        // Then - the combination is refused: `.exec()` answers a promise, so the refusal arrives as a rejection
        await expect(
            cli
                .fixture(directory('../_fixtures/specimen-cli/'))
                .exec(['build', 'start'], { waitFor: 'x' }),
        ).rejects.toThrow(
            [
                'found: .exec([…], { waitFor/timeout }), options on a command sequence',
                'why: `waitFor` and `timeout` wait on one long-running process.',
                'fix: wait on one long-running command: .exec(args, { waitFor, timeout }), or drop the options',
                'read: docs/12-cli.md#long-running-processes-waitfor--timeout',
            ].join('\n'),
        );
    });

    test('an empty sequence is refused, naming the form that runs one command at least', async () => {
        // Given - a sequence of no command
        // Then - refused rather than run as a binary called bare
        await expect(cli.fixture(directory('../_fixtures/specimen-cli/')).exec([])).rejects.toThrow(
            [
                'found: .exec([]), a sequence of no command',
                'why: A sequence runs its commands in order, and runs at least one.',
                "fix: name at least one command: .exec(['build', 'test'])",
                'read: docs/12-cli.md#sequences-array-form',
            ].join('\n'),
        );
    });
});
