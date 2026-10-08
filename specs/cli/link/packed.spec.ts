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

    test('a packed package lays its bin and the runtime closure its manifest names, from where it is developed', async () => {
        // Given - a package naming a string bin, a dependency, an optional one, a peer and an optional peer no checkout installed
        const result = await cli
            .link('@acme/commanded', packed(directory('./__fixtures__/commanded/')))
            .exec('command commanded');

        // Then - the bin runs under the name without its scope, and every package it requires is beside it but the optional peer
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(`
            commanded: true
        `);
        expect(
            ['yaml', 'typescript', 'vitest', '@acme/absent-peer'].map(
                (name) => result.file(`node_modules/${name}/package.json`).exists,
            ),
        ).toStrictEqual([true, true, true, false]);
    });

    test('a packed package requiring what no checkout above it installed is refused before the binary runs', async () => {
        // Given - a package whose dependency was never installed where it is developed
        const run = cli
            .link('@acme/unresolved', packed(directory('./__fixtures__/unresolved/')))
            .exec('load @acme/unresolved');

        // Then - the refusal names the dependency and where it looked
        await expect(run).rejects.toThrow(
            [
                "found: link('@acme/unresolved', packed()): @acme/unresolved requires @acme/never-installed, which no node_modules above __fixtures__/unresolved holds",
                'why: The packed package is laid beside what its manifest requires at runtime, taken from where it is developed.',
                "fix: install @acme/never-installed where @acme/unresolved is developed, as its consumers' install would",
                'read: docs/guides/cli-specs.md#a-package-specified-from-its-artefact',
            ].join('\n'),
        );
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
