import { directory } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

/* invariant: capability probes of stream capture and lifecycle, not of the fixture CLI's output (`output-asserted-as-a-golden` scalpel). */

describe('usage', () => {
    test('surfaces the whole usage banner on stdout', async () => {
        // Given - the help command
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec('help');

        // Then - the whole usage banner is surfaced on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            Usage: cli <command>

            Commands:
              build   Build the project
              check   Check code quality
        `);
    });

    test('exec with no arguments runs the bare command', async () => {
        // Given - the specimen run with no word, which prints its usage
        const result = await cli.fixture(directory('../__fixtures__/specimen-cli/')).exec();

        // Then - the bare command ran, and its whole usage banner is surfaced on stdout
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            Usage: cli <command>

            Commands:
              build   Build the project
              check   Check code quality
        `);
    });

    test('long-running (exec with waitFor/timeout — rule `output-asserted-as-a-golden`(b)) — returns non-zero when the process exits without matching', async () => {
        // Given - help exits immediately without matching pattern
        const result = await cli
            .fixture(directory('../__fixtures__/specimen-cli/'))
            .exec('help', { timeout: 5000, waitFor: 'NONEXISTENT_PATTERN' });

        // Then - exit code 1 (pattern not matched before process exited)
        expect(result.exitCode).toBe(1);
    });
});
