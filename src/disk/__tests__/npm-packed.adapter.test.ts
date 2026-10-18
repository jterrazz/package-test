import { existsSync, mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from '../../chain/paths/scratch.js';
import { installPacked } from '../npm-packed.adapter.js';

// invariant: every case here is refused before `npm pack` runs, so the test starts nothing; what a pack lays is specs/cli/link/'s.

function write(root: string, files: Readonly<Record<string, unknown>>): void {
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(
            join(root, path),
            typeof content === 'string' ? content : JSON.stringify(content),
        );
    }
}

function checkout(files: Readonly<Record<string, unknown>> = {}): string {
    const root = realpathSync(scratchDirectory('packed-checkout-'));
    write(root, {
        'lib/package.json': { name: '@acme/lib', version: '1.0.0' },
        'nameless/package.json': { name: 42 },
        'notes.txt': 'a file, not a package\n',
        'package.json': { name: '@acme/dev', private: true },
        ...files,
    });
    mkdirSync(join(root, 'bare'));
    return root;
}

const refusalOf = (work: () => void): string => {
    try {
        work();
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
};

const READ = 'read: docs/guides/cli-specs.md#a-package-specified-from-its-artefact';

const DISK_WHY =
    'why: A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.';

describe('installPacked', () => {
    test('npm-packed — installPacked — what it cannot pack — refuses another name, a nameless manifest and a spec under no package', () => {
        // Given - a checkout holding a library and a manifest naming nothing
        const root = checkout();
        const work = realpathSync(scratchDirectory('packed-work-'));
        const nowhere = realpathSync(scratchDirectory('packed-nowhere-'));
        const call = (name: string, path: null | string, testDir = root) =>
            refusalOf(() => {
                installPacked(name, path, testDir, work);
            });

        // Then - each refusal, whole, and nothing laid
        expect([
            call('@acme/other', './lib/'),
            call('@acme/lib', './nameless/'),
            call('@acme/lib', null, nowhere),
            existsSync(join(work, 'node_modules')),
        ]).toStrictEqual([
            [
                "found: link('@acme/other', packed()) packs lib, whose package.json names @acme/lib",
                'why: A consumer imports a package by the name it is published under, so the install lays it there.',
                "fix: link it under the name its package.json declares: link('@acme/lib', packed(...))",
                READ,
            ].join('\n'),
            [
                "found: link('@acme/lib', packed()) packs nameless, whose package.json names no package",
                'why: A consumer imports a package by the name it is published under, so the install lays it there.',
                "fix: link it under the name its package.json declares: link('<no name>', packed(...))",
                READ,
            ].join('\n'),
            [
                `found: packed(): no package.json from ${nowhere} up`,
                'why: packed() packs the project the spec belongs to, which its nearest package.json names.',
                "fix: run the spec inside the package it specifies, or name the package: packed(directory('./<path>/'))",
                READ,
            ].join('\n'),
            false,
        ]);
    });

    test('npm-packed — installPacked — a directory it cannot read — refuses one naming nothing, a file, and a folder with no manifest', () => {
        // Given - a checkout holding a file and a folder with no manifest
        const root = checkout();
        const work = realpathSync(scratchDirectory('packed-work-'));
        const call = (path: string) =>
            refusalOf(() => {
                installPacked('@acme/lib', path, root, work);
            });

        // Then - each refusal, whole, and nothing laid
        expect([
            call('./missing/'),
            call('./notes.txt/'),
            call('./bare/'),
            existsSync(join(work, 'node_modules')),
        ]).toStrictEqual([
            [
                `found: link('@acme/lib', packed(directory("./missing/"))) names nothing: ${join(root, 'missing')} does not exist`,
                DISK_WHY,
                `fix: create ${join(root, 'missing')}, or correct the path`,
                'read: docs/reference/linting.md#disk-named-by-relative-path-at-runtime',
            ].join('\n'),
            [
                `found: link('@acme/lib', packed(directory("./notes.txt/"))) names a file`,
                DISK_WHY,
                "fix: name the directory that holds the package's package.json: directory('./')",
                'read: docs/reference/linting.md#disk-named-by-relative-path-at-runtime',
            ].join('\n'),
            [
                `found: link('@acme/lib', packed(directory("./bare/"))): ${join(root, 'bare')} holds no package.json`,
                'why: packed() packs a package, and a package is the directory its package.json describes.',
                `fix: name the directory that holds the package's package.json, or give ${join(root, 'bare')} one`,
                READ,
            ].join('\n'),
            false,
        ]);
    });

    test('npm-packed — installPacked — a working directory whose node_modules is a symlink — is refused, and the install it points at is left as it was', () => {
        // Given - a working directory whose node_modules points at a real install holding the package
        const root = checkout({
            'elsewhere/@acme/lib/package.json': { name: '@acme/lib', version: '0.1.0' },
        });
        const work = realpathSync(scratchDirectory('packed-work-'));
        symlinkSync(join(root, 'elsewhere'), join(work, 'node_modules'), 'dir');

        // When - the spec links the library packed
        const refused = refusalOf(() => {
            installPacked('@acme/lib', './lib/', root, work);
        });

        // Then - the install is refused before anything is deleted, and the real install keeps its package
        expect([refused, existsSync(join(root, 'elsewhere/@acme/lib/package.json'))]).toStrictEqual(
            [
                [
                    `found: link('@acme/lib'): ${join(work, 'node_modules')} is a symlink, so the link would replace @acme/lib wherever it points`,
                    'why: A link is laid inside the working directory only; through a symlinked folder it would delete a real install outside it.',
                    `fix: drop the symlink at ${join(work, 'node_modules')} from the fixture or the command that lays it, so the working directory holds its own node_modules`,
                    'read: docs/guides/cli-specs.md#link-a-package-the-working-directory-resolves',
                ].join('\n'),
                true,
            ],
        );
    });

    test('npm-packed — installPacked — a symlinked folder only a required package or a command crosses — is refused before anything is packed', () => {
        // Given - a library requiring a scoped package and laying a command, in working directories whose scope folder or .bin points elsewhere
        const root = checkout({
            'tool/package.json': {
                bin: { tool: 'cli.cjs' },
                dependencies: { '@dep/one': '*' },
                name: '@acme/tool',
                version: '1.0.0',
            },
        });
        const elsewhere = realpathSync(scratchDirectory('packed-elsewhere-'));
        const crossing = (folder: string): string => {
            const work = realpathSync(scratchDirectory('packed-work-'));
            mkdirSync(join(work, 'node_modules'));
            symlinkSync(elsewhere, join(work, 'node_modules', folder), 'dir');
            return (
                refusalOf(() => {
                    installPacked('@acme/tool', './tool/', root, work);
                })
                    .split('\n')[0]
                    ?.replace(work, '<work>') ?? ''
            );
        };

        // Then - each is refused at the folder it would reach through, with nothing laid
        expect([crossing('@dep'), crossing('.bin')]).toStrictEqual([
            "found: link('@acme/tool'): <work>/node_modules/@dep is a symlink, so the link would replace @acme/tool wherever it points",
            "found: link('@acme/tool'): <work>/node_modules/.bin is a symlink, so the link would replace @acme/tool wherever it points",
        ]);
    });

    test('npm-packed — installPacked — a required package no checkout above it installed — is refused before anything is packed or laid', () => {
        // Given - a library requiring a package never installed where it is developed, and an install of it left by an earlier run
        const root = checkout({
            'needy/package.json': {
                dependencies: { '@dep/never': '*' },
                name: '@acme/needy',
                version: '1.0.0',
            },
        });
        const work = realpathSync(scratchDirectory('packed-work-'));
        write(work, { 'node_modules/@acme/needy/kept.txt': 'an earlier install\n' });

        // When - the install is asked
        const refused = refusalOf(() => {
            installPacked('@acme/needy', './needy/', root, work);
        });

        const fromItself = refusalOf(() => {
            installPacked('@acme/needy', './', join(root, 'needy'), work);
        });

        // Then - the dependency is named, from the package's own folder too, and the earlier install stands as it was
        expect(fromItself.split('\n')[0]).toBe(
            "found: link('@acme/needy', packed()): @acme/needy requires @dep/never, which no node_modules above . holds",
        );
        expect([
            refused,
            existsSync(join(work, 'node_modules/@acme/needy/kept.txt')),
        ]).toStrictEqual([
            [
                "found: link('@acme/needy', packed()): @acme/needy requires @dep/never, which no node_modules above needy holds",
                'why: The packed package is laid beside what its manifest requires at runtime, taken from where it is developed.',
                "fix: install @dep/never where @acme/needy is developed, as its consumers' install would",
                READ,
            ].join('\n'),
            true,
        ]);
    });
});
