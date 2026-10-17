import { describe, expect, test } from 'vitest';

import { cli } from '../go-cli.specification.js';

describe('go binary', () => {
    test('meets a Go program as any binary: its stdout, its exit code and the file it left', async () => {
        // Given - a Go program built before the run, a name for argv
        const result = await cli.exec('Ada');

        // Then - the greeting is on stdout, the run exited clean and the file the program wrote is in its directory
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            Hello, Ada.
        `);
        expect(result.file('greeting.txt').content).toBe('Hello, Ada.\n');
    });

    test('reads the exit code and the stderr of a Go program that refuses its argv', async () => {
        // Given - the same program with no name
        const result = await cli.exec();

        // Then - the refusal is its exit code and its stderr, and it wrote no file
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toMatch(`
            usage: greet <name>
        `);
        expect(result.file('greeting.txt').exists).toBe(false);
    });
});
