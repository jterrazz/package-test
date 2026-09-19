import { describe, expect, test } from 'vitest';

import { isTestFile, roleOf } from './role.js';

describe('roleOf — the kind a path states', () => {
    test('tells a rendered unit from a plain one by the suffix alone', () => {
        // Given - the two test suffixes, beside the code each covers
        // Then - `.tsx` is the component role: the project that collects it opens a browser
        expect(roleOf('/repo/src/ui/post-table.test.tsx').role).toBe('component');
        expect(roleOf('/repo/src/matching/match.test.ts').role).toBe('module');
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

    test('says whether the path sits under a specs tree, whatever its kind', () => {
        // Given - the same suffix inside and outside `specs/`
        // Then - `inSpecs` is the second field a rule reads, never the first
        expect(roleOf('/repo/specs/api/users/create.test.ts').inSpecs).toBeTruthy();
        expect(roleOf('/repo/src/matching/match.test.ts').inSpecs).toBeFalsy();
    });
});

describe('isTestFile — what the test conventions reach', () => {
    test('covers both test suffixes, the specification file, and the specs tree', () => {
        // Given - one of each
        const covered = [
            '/repo/src/ui/post-table.test.tsx',
            '/repo/src/matching/match.test.ts',
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
