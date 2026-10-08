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
        'package.json': { name: '@acme/dev', private: true },
        ...files,
    });
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
                "fix: link it under the name its package.json declares: link('@acme/lib', packed(…))",
                READ,
            ].join('\n'),
            [
                "found: link('@acme/lib', packed()) packs nameless, whose package.json names no package",
                'why: A consumer imports a package by the name it is published under, so the install lays it there.',
                "fix: link it under the name its package.json declares: link('<no name>', packed(…))",
                READ,
            ].join('\n'),
            [
                `found: packed(): no package.json from ${nowhere} up`,
                'why: packed() packs the project the spec belongs to, which its nearest package.json names.',
                "fix: run the spec inside the package it specifies, or name the package: packed(directory('./…/'))",
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
                    'read: docs/guides/cli-specs.md#link--a-package-the-working-directory-resolves',
                ].join('\n'),
                true,
            ],
        );
    });
});
