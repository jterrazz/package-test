import {
    existsSync,
    mkdirSync,
    readFileSync,
    realpathSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from '../../chain/paths/scratch.js';
import { fsLinks } from '../fs-links.adapter.js';

type Project = { readonly root: string; readonly testDir: string };

function packageAt(dir: string, version: string): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: '@acme/greeter', version }));
}

function project(): Project {
    const root = realpathSync(scratchDirectory('links-'));
    const testDir = resolve(root, 'specs/cli/feature');
    packageAt(resolve(root, 'node_modules/@acme/greeter'), '2.0.0');
    packageAt(resolve(testDir, '__fixtures__/greeter'), '1.0.0');
    writeFileSync(resolve(testDir, '__fixtures__/readme.md'), '# readme\n');
    return { root, testDir };
}

function workDirectory(): string {
    return scratchDirectory('links-work-');
}

function manifestIn(workDir: string): unknown {
    const manifest = resolve(workDir, 'node_modules/@acme/greeter/package.json');
    return JSON.parse(readFileSync(manifest, 'utf8'));
}

const LINK_CHAPTER =
    'read: docs/guides/cli-specs.md#link--a-package-the-working-directory-resolves';

const DISK_CHAPTER = 'read: docs/reference/linting.md#disk-named-by-relative-path-at-runtime';

const DISK_WHY =
    'why: A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.';

function refusalOf(work: () => void): string {
    try {
        work();
        return '';
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

function symlinkRefusal(ancestor: string): string {
    return [
        `found: link('@acme/greeter'): ${ancestor} is a symlink, so the link would replace @acme/greeter wherever it points`,
        'why: A link is laid inside the working directory only; through a symlinked folder it would delete a real install outside it.',
        `fix: drop the symlink at ${ancestor} from the fixture or the command that lays it, so the working directory holds its own node_modules`,
        LINK_CHAPTER,
    ].join('\n');
}

describe('fsLinks', () => {
    test('fsLinks — a symlinked node_modules or scope folder — is refused, and the install it points to is kept', () => {
        // Given - one working directory whose node_modules links to the project's install, and one whose scope folder does
        const { root, testDir } = project();
        const [whole, scoped] = [workDirectory(), workDirectory()];
        symlinkSync(resolve(root, 'node_modules'), resolve(whole, 'node_modules'), 'dir');
        mkdirSync(resolve(scoped, 'node_modules'));
        symlinkSync(
            resolve(root, 'node_modules/@acme'),
            resolve(scoped, 'node_modules/@acme'),
            'dir',
        );

        // Then - each link refused, naming the symlink, and the real package untouched
        expect([
            refusalOf(() => {
                fsLinks.link('@acme/greeter', './__fixtures__/greeter/', testDir, whole);
            }),
            refusalOf(() => {
                fsLinks.link('@acme/greeter', './__fixtures__/greeter/', testDir, scoped);
            }),
            existsSync(resolve(root, 'node_modules/@acme/greeter/package.json')),
        ]).toStrictEqual([
            symlinkRefusal(resolve(whole, 'node_modules')),
            symlinkRefusal(resolve(scoped, 'node_modules/@acme')),
            true,
        ]);
    });

    test('fsLinks — a file where a folder goes — is refused, naming the file', () => {
        // Given - a working directory a fixture laid with node_modules as a file
        const { testDir } = project();
        const workDir = workDirectory();
        writeFileSync(resolve(workDir, 'node_modules'), '');
        const file = resolve(workDir, 'node_modules');

        // Then - the link is refused, naming the file
        expect(
            refusalOf(() => {
                fsLinks.link('@acme/greeter', './__fixtures__/greeter/', testDir, workDir);
            }),
        ).toBe(
            [
                `found: link('@acme/greeter'): ${file} is a file, not a folder`,
                'why: A link is laid at node_modules/<name> inside the working directory, and a file on that path leaves it no folder to lay it in.',
                `fix: drop the file at ${file} from the fixture or the command that lays it, so the link can lay its folder there`,
                LINK_CHAPTER,
            ].join('\n'),
        );
    });

    test('fsLinks — a bare name — links the package the spec’s project resolves', () => {
        // Given - an empty working directory
        const { testDir } = project();
        const workDir = workDirectory();
        fsLinks.link('@acme/greeter', null, testDir, workDir);

        // Then - the working directory resolves the project's install
        expect(manifestIn(workDir)).toStrictEqual({ name: '@acme/greeter', version: '2.0.0' });
    });

    test('fsLinks — a named directory — replaces the package a fixture already laid under the name', () => {
        // Given - a working directory whose own node_modules holds an older @acme/greeter
        const { testDir } = project();
        const workDir = workDirectory();
        packageAt(resolve(workDir, 'node_modules/@acme/greeter'), '0.0.1');
        fsLinks.link('@acme/greeter', './__fixtures__/greeter/', testDir, workDir);

        // Then - the linked directory is what resolves
        expect(manifestIn(workDir)).toStrictEqual({ name: '@acme/greeter', version: '1.0.0' });
    });

    test('fsLinks — what it is handed — refuses a name nothing installed, a path naming nothing, one naming a file, and one not relative', () => {
        // Given - a project and its spec folder
        const { root, testDir } = project();
        const linked = (name: string, path: null | string): string =>
            refusalOf(() => {
                fsLinks.link(name, path, testDir, workDirectory());
            }).replaceAll(root, '<root>');

        // Then - each refusal whole
        expect([
            linked('@acme/absent', null),
            linked('@acme/greeter', './__fixtures__/absent/'),
            linked('@acme/greeter', './__fixtures__/readme.md/'),
            linked('@acme/greeter', '/abs/greeter/'),
        ]).toStrictEqual([
            [
                "found: link('@acme/absent'): no node_modules from <root>/specs/cli/feature up holds @acme/absent",
                'why: A bare name links the package the spec’s own project resolves, found as Node finds it.',
                "fix: install @acme/absent in the project the spec belongs to, or name the package's directory: link('@acme/absent', directory('./__fixtures__/…/'))",
                LINK_CHAPTER,
            ].join('\n'),
            [
                `found: link('@acme/greeter', directory("./__fixtures__/absent/")) names nothing — <root>/specs/cli/feature/__fixtures__/absent does not exist`,
                DISK_WHY,
                'fix: create <root>/specs/cli/feature/__fixtures__/absent, or correct the path',
                DISK_CHAPTER,
            ].join('\n'),
            [
                `found: link('@acme/greeter', directory("./__fixtures__/readme.md/")) names a file`,
                DISK_WHY,
                "fix: name the directory that holds the package's package.json: directory('./__fixtures__/')",
                DISK_CHAPTER,
            ].join('\n'),
            [
                'found: link("/abs/greeter/"), a path that is not relative to the spec file',
                DISK_WHY,
                "fix: start it with ./ or ../, from the spec file: link('./abs/greeter/')",
                DISK_CHAPTER,
            ].join('\n'),
        ]);
    });
});
