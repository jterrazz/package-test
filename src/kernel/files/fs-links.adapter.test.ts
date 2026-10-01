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

import { fsLinks, installedPackage } from './fs-links.adapter.js';
import { scratchDirectory } from './scratch.js';

type Project = { readonly root: string; readonly testDir: string };

function packageAt(dir: string, version: string): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: '@acme/greeter', version }));
}

function project(): Project {
    const root = realpathSync(scratchDirectory('links-'));
    const testDir = resolve(root, 'specs/cli/feature');
    packageAt(resolve(root, 'node_modules/@acme/greeter'), '2.0.0');
    packageAt(resolve(testDir, '_fixtures/greeter'), '1.0.0');
    writeFileSync(resolve(testDir, '_fixtures/readme.md'), '# readme\n');
    return { root, testDir };
}

function workDirectory(): string {
    return scratchDirectory('links-work-');
}

function manifestIn(workDir: string): unknown {
    const manifest = resolve(workDir, 'node_modules/@acme/greeter/package.json');
    return JSON.parse(readFileSync(manifest, 'utf8'));
}

describe('fsLinks', () => {
    test('installedPackage — a bare name — is found in the first node_modules above the spec that holds it', () => {
        // Given - the spec's own folder holds no node_modules
        const { root, testDir } = project();

        // Then - the walk climbs to the project root's
        expect(installedPackage('@acme/greeter', testDir)).toBe(
            resolve(root, 'node_modules/@acme/greeter'),
        );
    });

    test('installedPackage — a bare name — is null when no node_modules above the spec holds it', () => {
        // Given - a name nothing installed
        const { testDir } = project();

        // Then - the walk ends at the filesystem root empty-handed
        expect(installedPackage('@acme/absent', testDir)).toBeNull();
    });

    test('fsLinks — a symlinked node_modules — is refused, and the install it points to is kept', () => {
        // Given - a working directory whose node_modules is a symlink to the project's own install
        const { root, testDir } = project();
        const workDir = workDirectory();
        symlinkSync(resolve(root, 'node_modules'), resolve(workDir, 'node_modules'), 'dir');

        // Then - the link is refused, naming the symlink, and the real package is untouched
        expect(() => {
            fsLinks.link('@acme/greeter', './_fixtures/greeter/', testDir, workDir);
        }).toThrow(
            `found: link('@acme/greeter'): ${resolve(workDir, 'node_modules')} is a symlink`,
        );
        expect(existsSync(resolve(root, 'node_modules/@acme/greeter/package.json'))).toBe(true);
    });

    test('fsLinks — a bare name — links the package the spec’s project resolves', () => {
        // Given - an empty working directory
        const { testDir } = project();
        const workDir = workDirectory();
        fsLinks.link('@acme/greeter', null, testDir, workDir);

        // Then - the working directory resolves the project's install
        expect(manifestIn(workDir)).toStrictEqual({ name: '@acme/greeter', version: '2.0.0' });
    });

    test('fsLinks — a bare name — refuses a name no node_modules above the spec holds, naming where it looked', () => {
        // Given - a name nothing installed
        const { testDir } = project();

        // Then - the refusal names the walk's start
        expect(() => {
            fsLinks.link('@acme/absent', null, testDir, workDirectory());
        }).toThrow(
            `found: link('@acme/absent'): no node_modules from ${testDir} up holds @acme/absent`,
        );
    });

    test('fsLinks — a named directory — replaces the package a fixture already laid under the name', () => {
        // Given - a working directory whose own node_modules holds an older @acme/greeter
        const { testDir } = project();
        const workDir = workDirectory();
        packageAt(resolve(workDir, 'node_modules/@acme/greeter'), '0.0.1');
        fsLinks.link('@acme/greeter', './_fixtures/greeter/', testDir, workDir);

        // Then - the linked directory is what resolves
        expect(manifestIn(workDir)).toStrictEqual({ name: '@acme/greeter', version: '1.0.0' });
    });

    test('fsLinks — a named directory — refuses a path naming nothing, with the path it resolved to', () => {
        // Given - a directory the leaf does not carry
        const { testDir } = project();

        // Then - the refusal carries the absolute path it looked at
        expect(() => {
            fsLinks.link('@acme/greeter', './_fixtures/absent/', testDir, workDirectory());
        }).toThrow(`${resolve(testDir, '_fixtures/absent')} does not exist`);
    });

    test('fsLinks — a named directory — refuses a path naming a file', () => {
        // Given - a file named in directory form
        const { testDir } = project();

        // Then - the refusal names the directory holding it
        expect(() => {
            fsLinks.link('@acme/greeter', './_fixtures/readme.md/', testDir, workDirectory());
        }).toThrow(
            /names a file\n.*\nfix: name the directory that holds the package's package\.json: directory\('\.\/_fixtures\/'\)/u,
        );
    });
});
