import { directory, packed } from '@jterrazz/test';
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

describe('packed', () => {
    test('a packed package is what npm pack ships, laid beside what it requires at runtime', async () => {
        // Given - a package shipping one module that requires yaml, packed and linked under its name
        const result = await cli
            .link('@acme/shipped', packed(directory('./__fixtures__/shipped/')))
            .exec('load @acme/shipped');

        // Then - the module loads its dependency from the install, and the file its `files` leaves out is not there
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            shipped: true
        `);
        expect(result.file('node_modules/@acme/shipped/index.cjs').exists).toBe(true);
        expect(result.file('node_modules/@acme/shipped/notes.txt').exists).toBe(false);
    });

    test('a packed package linked under another name than its own is refused before the binary runs', async () => {
        // Given - the same package, linked under a name it does not declare
        const run = cli
            .link('@acme/other', packed(directory('./__fixtures__/shipped/')))
            .exec('load @acme/other');

        // Then - the install names the package's own name
        await expect(run).rejects.toThrow(
            [
                "found: link('@acme/other', packed()) packs __fixtures__/shipped, whose package.json names @acme/shipped",
                'why: A consumer imports a package by the name it is published under, so the install lays it there.',
                "fix: link it under the name its package.json declares: link('@acme/shipped', packed(…))",
                'read: docs/guides/cli-specs.md#a-package-specified-from-its-artefact',
            ].join('\n'),
        );
    });
});
