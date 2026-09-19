import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { FileRole } from './role.js';
import { isTestFile, isTestRole, roleOf } from './role.js';

/** This package's own root — the one `tests/` guard reads a real package.json at. */
const REPO_ROOT = resolve(import.meta.dirname, '../..');

describe('roleOf — the kind a path states', () => {
    test('tells a rendered unit from a plain one by the suffix alone', () => {
        // Given - the two test suffixes, beside the code each covers
        // Then - `.tsx` is the component role: the project that collects it opens a browser
        expect(roleOf('/repo/src/ui/post-table.test.tsx').role).toBe('component');
        expect(roleOf('/repo/src/matching/match.test.ts').role).toBe('module');
    });

    test('`.spec.ts` is the assembled product, `.test.ts` the unit', () => {
        // Given - the two suffixes the fork spends
        // Then - the suffix says the kind, and the folder only says whether it is where it belongs
        expect(roleOf('/repo/specs/api/users/creation.spec.ts').role).toBe('spec');
        expect(roleOf('/repo/src/matching/match.test.ts').role).toBe('module');
    });

    test('a literate document is its own role', () => {
        // Given - a `.spec.yaml` case
        // Then - `document`, never a spec: the grammar runs it, no runner file imports it
        expect(roleOf('/repo/specs/cli/help/help.spec.yaml').role).toBe('document');
    });

    test('a specification file is one wherever it sits', () => {
        // Given - the runner file at a facet root
        // Then - the suffix decides, not the folder
        expect(roleOf('/repo/specs/api/api.specification.ts').role).toBe('specification');
    });

    test('names the config a project helper is called from', () => {
        // Given - the file vitest reads
        // Then - the config role is what the E-family rules reach
        expect(roleOf('/repo/vitest.config.ts').role).toBe('config');
        expect(roleOf('/repo/vitest.config.mts').role).toBe('config');
    });

    test('ground is what a spec stands on, and it swallows what sits inside it', () => {
        // Given - a fixture project's own source file
        // Then - it is ground, never a member of the row
        expect(roleOf('/repo/specs/_fixtures/app/server.ts').role).toBe('ground');
        expect(roleOf('/repo/specs/api/users/_expected/user.http').role).toBe('ground');
    });

    test("a ground module's own test keeps its kind — I2's one pairing", () => {
        // Given - a `<module>.test.ts` inside ground
        // Then - the suffix wins: it is a module test, not inert material
        expect(roleOf('/repo/specs/_fixtures/app/server.test.ts').role).toBe('module');
    });

    test('a contracts/ unit is its own role — the half C10 keeps internal', () => {
        // Given - a file under a feature's contracts/ folder
        // Then - `contract`: the boundary rule asks the identity, not the path
        expect(roleOf('/repo/specs/api/news/contracts/http/latest.ts').role).toBe('contract');
        expect(roleOf('/repo/specs/api/news/contracts/latest.contracts.ts').role).toBe('contract');
    });

    test('says whether the path sits under a specs tree, whatever its kind', () => {
        // Given - the same suffix inside and outside `specs/`
        // Then - `inSpecs` is the second field a rule reads, never the first
        expect(roleOf('/repo/specs/api/users/create.test.ts').inSpecs).toBeTruthy();
        expect(roleOf('/repo/src/matching/match.test.ts').inSpecs).toBeFalsy();
    });

    test('names the retired test roots, and nothing that merely spells one', () => {
        // Given - the two shapes I2 refuses, and a `tests` segment with no package above it
        // Then - `legacyDir` is the third field, and the `tests` clause is anchored on a package root
        expect(roleOf('/repo/src/matching/__tests__/match.test.ts').legacyDir).toBe('__tests__');
        expect(roleOf(`${REPO_ROOT}/tests/smoke.test.ts`).legacyDir).toBe('tests');
        expect(roleOf('/no-such-root-xyz/tests/smoke.test.ts').legacyDir).toBeNull();
        expect(roleOf('/repo/specs/api/users/create.test.ts').legacyDir).toBeNull();
    });
});

describe('isTestRole — the three kinds that DECLARE tests', () => {
    test('covers the module, the rendered unit and the spec, and nothing else', () => {
        // Given - the role vocabulary, split into the kinds that declare tests and the rest
        const declaring: FileRole[] = ['component', 'module', 'spec'];
        const rest: FileRole[] = [
            'config',
            'contract',
            'document',
            'ground',
            'other',
            'specification',
        ];

        // Then - a rule reaching "every test file" means exactly the first three
        expect(declaring.every(isTestRole)).toBe(true);
        expect(rest.some(isTestRole)).toBe(false);
    });
});

describe('isTestFile — what the test conventions reach', () => {
    test('covers every test suffix, the specification file, and the specs tree', () => {
        // Given - one of each
        const covered = [
            '/repo/src/ui/post-table.test.tsx',
            '/repo/src/matching/match.test.ts',
            '/repo/specs/api/users/creation.spec.ts',
            '/repo/specs/api/api.specification.ts',
            '/repo/specs/api/users/contracts/newsroom.contracts.ts',
        ];

        // Then - the conventions bind every test file of a repository
        expect(covered.every((file) => isTestFile(file))).toBeTruthy();
    });

    test('leaves production source alone', () => {
        // Given - a module of the app
        // Then - nothing about it is a test
        expect(isTestFile('/repo/src/matching/match.ts')).toBeFalsy();
    });
});
