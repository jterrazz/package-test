import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from '../../chain/paths/scratch.js';
import { manifestAt } from '../package-manifest.js';

const BROKEN = '{ "name": ';

function packageWith(manifest: unknown): string {
    const directory = join(realpathSync(scratchDirectory('manifest-')), 'lib');
    mkdirSync(directory);
    writeFileSync(
        join(directory, 'package.json'),
        typeof manifest === 'string' ? manifest : JSON.stringify(manifest),
    );
    return directory;
}

function errorOf(work: () => unknown): unknown {
    try {
        work();
        return undefined;
    } catch (error) {
        return error;
    }
}

describe('manifestAt', () => {
    test("package manifest — manifestAt — what packed() reads — names a string bin after the package without its scope, keeps a map bin's commands, and requires every peer not marked optional", () => {
        // Given - a scoped package with a string bin, one with a map bin, and one naming no package
        const read = [
            {
                bin: 'cli.cjs',
                dependencies: { 'dep-a': '*' },
                name: '@acme/lib',
                optionalDependencies: { 'opt-c': '*' },
                peerDependencies: { 'peer-b': '*', 'peer-opt': '*' },
                peerDependenciesMeta: {
                    'peer-b': { optional: false },
                    'peer-opt': { optional: true },
                },
            },
            { bin: { broken: 42, run: 'run.cjs' }, name: 'plain' },
            { bin: 'cli.cjs', name: 42 },
        ].map((manifest) => manifestAt(packageWith(manifest)));

        // Then - each as a consumer's install reads it
        expect(read).toStrictEqual([
            { bin: { lib: 'cli.cjs' }, name: '@acme/lib', runtime: ['dep-a', 'opt-c', 'peer-b'] },
            { bin: { run: 'run.cjs' }, name: 'plain', runtime: [] },
            { bin: {}, name: undefined, runtime: [] },
        ]);
    });

    test('package manifest — manifestAt — a manifest that is no JSON: is refused whole, its parse error kept as the cause', () => {
        // Given - a package whose manifest breaks off
        const directory = packageWith(BROKEN);

        // When - its manifest is read
        const error = errorOf(() => manifestAt(directory));
        const parsing = errorOf(() => JSON.parse(BROKEN) as unknown);

        // Then - the refusal names the file and npm's reader, and carries the parse error
        expect([
            error instanceof Error ? error.message : error,
            error instanceof Error ? error.cause instanceof SyntaxError : false,
        ]).toStrictEqual([
            [
                `found: packed(): ${join(directory, 'package.json')} is no JSON: ${parsing instanceof Error ? parsing.message : ''}`,
                'why: packed() reads the name, the bin and the runtime closure the package declares in its package.json.',
                `fix: correct ${join(directory, 'package.json')}, so npm and Node read the package it describes`,
                'read: docs/guides/cli-specs.md#a-package-specified-from-its-artefact',
            ].join('\n'),
            true,
        ]);
    });
});
