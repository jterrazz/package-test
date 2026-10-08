import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { scratchDirectory } from '../../chain/paths/scratch.js';
import { installedPackage } from '../installed-package.js';

type Project = { readonly root: string; readonly testDir: string };

function project(): Project {
    const root = realpathSync(scratchDirectory('installed-'));
    const testDir = resolve(root, 'specs/cli/feature');
    const installed = resolve(root, 'node_modules/@acme/greeter');
    mkdirSync(installed, { recursive: true });
    mkdirSync(testDir, { recursive: true });
    writeFileSync(resolve(installed, 'package.json'), '{"name":"@acme/greeter"}');
    return { root, testDir };
}

describe('installedPackage', () => {
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
});
