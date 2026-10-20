import { directory, packed } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

describe('compile-cache', () => {
    test("every process a consumer's run starts compiles through the one cache under its .artifacts", async () => {
        // Given - a consumer's test spawning a process from another folder, run with no cache of the caller's
        const result = await cli
            .link('@jterrazz/test', packed())
            .fixture(directory('./__fixtures__/compile-cache/'))
            .exec('run.mjs');

        // Then - the child was handed the project's cache, and the run left compiled code in it
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            the child read the cache
            cache written: true
        `);
    });
});
