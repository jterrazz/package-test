import {
    existsSync,
    lstatSync,
    mkdirSync,
    readlinkSync,
    realpathSync,
    writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from '../../chain/paths/scratch.js';
import { installPacked } from '../npm-packed.adapter.js';

function write(root: string, files: Readonly<Record<string, unknown>>): void {
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(
            join(root, path),
            typeof content === 'string' ? content : JSON.stringify(content),
        );
    }
}

function checkout(manifest: Readonly<Record<string, unknown>>): string {
    const root = realpathSync(scratchDirectory('packed-checkout-'));
    write(root, {
        'lib/bin.cjs': '#!/usr/bin/env node\n',
        'lib/index.cjs': 'module.exports = 1;\n',
        'lib/notes.txt': 'kept out of the tarball\n',
        'lib/package.json': {
            files: ['index.cjs', 'bin.cjs'],
            name: '@acme/lib',
            version: '1.0.0',
            ...manifest,
        },
        'node_modules/dep-a/package.json': { name: 'dep-a' },
        'node_modules/opt-c/package.json': { name: 'opt-c' },
        'node_modules/peer-b/package.json': { name: 'peer-b' },
        'package.json': { name: '@acme/dev', private: true },
    });
    return root;
}

function laid(work: string): string[] {
    const modules = join(work, 'node_modules');
    const entry = (path: string): string => {
        const at = join(modules, path);
        if (!existsSync(at) && !lstatSync(at, { throwIfNoEntry: false })) {
            return `${path} absent`;
        }
        return lstatSync(at).isSymbolicLink() ? `${path} -> ${readlinkSync(at)}` : `${path} copied`;
    };
    return [
        '@acme/lib',
        '@acme/lib/index.cjs',
        '@acme/lib/notes.txt',
        'dep-a',
        'opt-c',
        'peer-b',
        'peer-opt',
        '.bin/lib',
        '.bin/run',
        '.bin/broken',
    ].map(entry);
}

const refusalOf = (work: () => void): string => {
    try {
        work();
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
};

describe('installPacked', () => {
    test('npm-packed — installPacked — the tarball a consumer installs — is copied under its name beside a link to each package it requires at runtime, and its bin', () => {
        // Given - a library requiring a dependency, an optional one and a peer, an optional peer it can go without, and a bin named by a string
        const root = checkout({
            bin: 'bin.cjs',
            dependencies: { 'dep-a': '*' },
            optionalDependencies: { 'opt-c': '*' },
            peerDependencies: { 'peer-b': '*', 'peer-opt': '*' },
            peerDependenciesMeta: { 'peer-opt': { optional: true } },
        });
        const work = realpathSync(scratchDirectory('packed-work-'));

        // When - the spec beside the library links it packed
        installPacked('@acme/lib', './lib/', root, work);

        // Then - the tarball's files are copied, what `files` leaves out is absent, the runtime closure is linked from the checkout, and the bin points into the copy
        expect(laid(work)).toStrictEqual([
            '@acme/lib copied',
            '@acme/lib/index.cjs copied',
            '@acme/lib/notes.txt absent',
            `dep-a -> ${join(root, 'node_modules/dep-a')}`,
            `opt-c -> ${join(root, 'node_modules/opt-c')}`,
            `peer-b -> ${join(root, 'node_modules/peer-b')}`,
            'peer-opt absent',
            '.bin/lib -> ../@acme/lib/bin.cjs',
            '.bin/run absent',
            '.bin/broken absent',
        ]);
    });

    test("npm-packed — installPacked — the spec's own project — is the nearest package.json above the spec, and a bin map keeps its named commands", () => {
        // Given - a library whose bin is a map holding one command and one value that is no path, and a spec folder inside it
        const root = checkout({
            bin: { broken: 42, run: 'bin.cjs' },
            dependencies: { 'dep-a': '*' },
            peerDependencies: { 'peer-b': '*' },
            peerDependenciesMeta: { 'peer-b': { optional: false } },
        });
        const spec = join(root, 'lib/specs/cli');
        mkdirSync(spec, { recursive: true });
        const work = realpathSync(scratchDirectory('packed-work-'));

        // When - the spec links its own project, twice, the second over the first
        installPacked('@acme/lib', null, spec, work);
        installPacked('@acme/lib', null, spec, work);

        // Then - the library is laid once, its dependency and its peer no manifest marks optional linked, with the named command alone
        expect(laid(work)).toStrictEqual([
            '@acme/lib copied',
            '@acme/lib/index.cjs copied',
            '@acme/lib/notes.txt absent',
            `dep-a -> ${join(root, 'node_modules/dep-a')}`,
            'opt-c absent',
            `peer-b -> ${join(root, 'node_modules/peer-b')}`,
            'peer-opt absent',
            '.bin/lib absent',
            '.bin/run -> ../@acme/lib/bin.cjs',
            '.bin/broken absent',
        ]);
    });

    test('npm-packed — installPacked — what it cannot lay — refuses another name, a dependency the checkout lacks, and a spec under no package', () => {
        // Given - a library requiring a package its checkout never installed, and one whose manifest names nothing
        const root = checkout({ dependencies: { 'dep-absent': '*' } });
        const nameless = checkout({ name: 42 });
        const work = realpathSync(scratchDirectory('packed-work-'));
        const nowhere = realpathSync(scratchDirectory('packed-nowhere-'));
        const read = 'read: docs/guides/cli-specs.md#a-package-specified-from-its-artefact';

        // Then - each refusal, whole
        expect([
            refusalOf(() => {
                installPacked('@acme/other', './lib/', root, work);
            }),
            refusalOf(() => {
                installPacked('@acme/lib', './lib/', root, work);
            }),
            refusalOf(() => {
                installPacked('@acme/lib', null, nowhere, work);
            }),
            refusalOf(() => {
                installPacked('@acme/lib', './lib/', nameless, work);
            }),
        ]).toStrictEqual([
            [
                "found: link('@acme/other', packed()) packs lib, whose package.json names @acme/lib",
                'why: A consumer imports a package by the name it is published under, so the install lays it there.',
                "fix: link it under the name its package.json declares: link('@acme/lib', packed(…))",
                read,
            ].join('\n'),
            [
                "found: link('@acme/lib', packed()): @acme/lib requires dep-absent, which no node_modules above lib holds",
                'why: The packed package is laid beside what its manifest requires at runtime, taken from where it is developed.',
                "fix: install dep-absent where @acme/lib is developed, as its consumers' install would",
                read,
            ].join('\n'),
            [
                `found: packed(): no package.json from ${nowhere} up`,
                'why: packed() packs the project the spec belongs to, which its nearest package.json names.',
                "fix: run the spec inside the package it specifies, or name the package: packed(directory('./…/'))",
                read,
            ].join('\n'),
            [
                "found: link('@acme/lib', packed()) packs lib, whose package.json names no package",
                'why: A consumer imports a package by the name it is published under, so the install lays it there.',
                "fix: link it under the name its package.json declares: link('<no name>', packed(…))",
                read,
            ].join('\n'),
        ]);
    });
});
