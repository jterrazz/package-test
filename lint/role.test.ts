import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { FileRole, LegacyDir } from './role.js';
import { isTestFile, isTestRole, projectRootOf, projectSegments, roleOf } from './role.js';
import { checkoutUnder, repositoryUnder } from './rule-tester.fixtures.js';

const REPO_ROOT = resolve(import.meta.dirname, '..');

const legacyOf = (path: string): LegacyDir => roleOf(path).legacyDir;

describe('role', () => {
    test('roleOf — the kind a path states — tells a rendered unit from a plain one by the suffix alone', () => {
        // Given - the two test suffixes, beside the code each covers
        // Then - `.tsx` is the component role: the project that collects it opens a browser
        expect(roleOf('/repo/src/ui/post-table.test.tsx').role).toBe('component');
        expect(roleOf('/repo/src/matching/match.test.ts').role).toBe('module');
    });

    test('roleOf — the kind a path states — `.spec.ts` is the assembled product, `.test.ts` the unit', () => {
        // Given - the two suffixes the fork spends
        // Then - the suffix says the kind, and the folder only says whether it is where it belongs
        expect(roleOf('/repo/specs/api/users/creation.spec.ts').role).toBe('spec');
        expect(roleOf('/repo/src/matching/match.test.ts').role).toBe('module');
    });

    test('roleOf — the kind a path states — a literate document is its own role', () => {
        // Given - a `.spec.yaml` case
        // Then - `document`, never a spec: the grammar runs it, no runner file imports it
        expect(roleOf('/repo/specs/cli/help/help.spec.yaml').role).toBe('document');
    });

    test('roleOf — the kind a path states — a specification file is one wherever it sits', () => {
        // Given - the runner file at a facet root
        // Then - the suffix decides, not the folder
        expect(roleOf('/repo/specs/api/api.specification.ts').role).toBe('specification');
    });

    test('roleOf — the kind a path states — names the config a project helper is called from', () => {
        // Given - the file vitest reads
        // Then - the config role is what the E-family rules reach
        expect(roleOf('/repo/vitest.config.ts').role).toBe('config');
        expect(roleOf('/repo/vitest.config.mts').role).toBe('config');
    });

    test('roleOf — the kind a path states — ground is what a spec stands on, and it swallows what sits inside it', () => {
        // Given - a fixture project's own source file
        // Then - it is ground, never a member of the row
        expect(roleOf('/repo/specs/fixtures/app/server.ts').role).toBe('ground');
        expect(roleOf('/repo/specs/api/users/expected/user.http').role).toBe('ground');
    });

    test("roleOf — the kind a path states — a ground module's own test keeps its kind — I2's one pairing", () => {
        // Given - a `<module>.test.ts` inside ground
        // Then - the suffix wins: it is a module test, not inert material
        expect(roleOf('/repo/specs/fixtures/app/server.test.ts').role).toBe('module');
    });

    test('roleOf — the kind a path states — a stubs/ unit is its own role — the half C10 keeps internal', () => {
        // Given - a file under a feature's stubs/ folder
        // Then - `stub`: the boundary rule asks the identity, not the path
        expect(roleOf('/repo/specs/api/news/stubs/http/latest.ts').role).toBe('stub');
        expect(roleOf('/repo/specs/api/news/stubs/latest.stubs.ts').role).toBe('stub');
    });

    test('roleOf — the kind a path states — says whether the path sits under a specs tree, whatever its kind', () => {
        // Given - the same suffix inside and outside `specs/`
        // Then - `inSpecs` is the second field a rule reads, never the first
        expect(roleOf('/repo/specs/api/users/create.test.ts').inSpecs).toBeTruthy();
        expect(roleOf('/repo/src/matching/match.test.ts').inSpecs).toBeFalsy();
    });

    test('roleOf — the kind a path states — names the retired test roots, in both of their spellings', () => {
        // Given - the three shapes I2 refuses, each anchored on a real package root
        // Then - `legacyDir` is the third field a rule reads
        expect([
            legacyOf('/repo/src/matching/__tests__/match.test.ts'),
            legacyOf(`${REPO_ROOT}/tests/smoke.test.ts`),
            legacyOf(`${REPO_ROOT}/test/corpus.test.ts`),
        ]).toStrictEqual(['__tests__', 'tests', 'test']);
    });

    test('roleOf — the kind a path states — names nothing that merely spells one', () => {
        // Given - a `tests` or `test` segment with no package above it, and a specs tree
        // Then - the clause is anchored on a package root, so a checkout under `~/tests/` is nobody's business
        expect([
            legacyOf('/no-such-root-xyz/tests/smoke.test.ts'),
            legacyOf('/no-such-root-xyz/test/smoke.test.ts'),
            legacyOf('/repo/specs/api/users/create.test.ts'),
        ]).toStrictEqual([null, null, null]);
    });

    test('roleOf — read below the project root — a checkout under a folder named like ground, a stub or a retired root is none of them', () => {
        // Given - three packages checked out under `fixtures/`, `stubs/` and `__tests__/`
        const under = ['fixtures', 'stubs', '__tests__'].map((folder) => checkoutUnder(folder));

        // Then - a module of each is the project's own code, and its test sits under no retired root
        expect(under.map((root) => roleOf(join(root, 'src/widget.ts')).role)).toStrictEqual([
            'other',
            'other',
            'other',
        ]);
        expect(under.map((root) => legacyOf(join(root, 'src/widget.test.ts')))).toStrictEqual([
            null,
            null,
            null,
        ]);
    });

    test('roleOf — read below the project root — the folders inside the project still say what they are', () => {
        // Given - the same checkout under `fixtures/`, with its own ground, stubs and retired root
        const root = checkoutUnder('fixtures');

        // Then - ground, stub and `__tests__` are read where the project names them
        expect(roleOf(join(root, 'specs/api/orders/fixtures/app.ts')).role).toBe('ground');
        expect(roleOf(join(root, 'specs/api/orders/stubs/http/latest.ts')).role).toBe('stub');
        expect(legacyOf(join(root, 'src/__tests__/widget.test.ts'))).toBe('__tests__');
        expect(legacyOf(join(root, 'tests/widget.test.ts'))).toBe('tests');
    });

    test('roleOf — read below the project root — a file outside every package is read below its repository root', () => {
        // Given - two repositories holding no package.json, checked out under `fixtures/` and `specs/`, one a worktree
        const underGround = repositoryUnder('fixtures');
        const underSpecs = repositoryUnder('specs', [], 'file');

        // Then - the segments start at the repository, and no folder above it answers
        expect(projectSegments(join(underGround, 'src/widget.ts'))).toStrictEqual([
            'src',
            'widget.ts',
        ]);
        expect(roleOf(join(underGround, 'src/widget.ts')).role).toBe('other');
        expect(roleOf(join(underSpecs, 'src/widget.test.ts')).inSpecs).toBe(false);
        expect(legacyOf(join(underGround, 'tests/widget.test.ts'))).toBe('tests');
    });

    test('roleOf — read below the project root — a path no package and no repository holds is read whole', () => {
        // Given - a rule case written against a root that is not on disk, under no repository
        // Then - every segment answers, as the case spells it
        expect(projectSegments('/no-such-root-xyz/specs/api/x.spec.ts')).toStrictEqual([
            'no-such-root-xyz',
            'specs',
            'api',
            'x.spec.ts',
        ]);
    });

    test('projectRootOf — remembered per folder — a package.json written at a folder already answered is seen the next time it is asked', () => {
        // Given - a repository with no package below its app folder, answered once
        const root = repositoryUnder('memo', ['src/app']);
        const before = projectRootOf(join(root, 'src/app'));

        // When - a package.json is written right there
        writeFileSync(join(root, 'src/app/package.json'), '{}\n');

        // Then - the memo is not kept past what its own folder now says
        expect(before).toBe(root);
        expect(projectRootOf(join(root, 'src/app'))).toBe(join(root, 'src/app'));
    });

    test('isTestRole — the three kinds that DECLARE tests — covers the module, the rendered unit and the spec, and nothing else', () => {
        // Given - the role vocabulary, split into the kinds that declare tests and the rest
        const declaring: FileRole[] = ['component', 'module', 'spec'];
        const rest: FileRole[] = ['config', 'stub', 'document', 'ground', 'other', 'specification'];

        // Then - a rule reaching "every test file" means exactly the first three
        expect(declaring.every(isTestRole)).toBe(true);
        expect(rest.some(isTestRole)).toBe(false);
    });

    test('isTestFile — what the test conventions reach — covers every test suffix, the specification file, and the specs tree', () => {
        // Given - one of each
        const covered = [
            '/repo/src/ui/post-table.test.tsx',
            '/repo/src/matching/match.test.ts',
            '/repo/specs/api/users/creation.spec.ts',
            '/repo/specs/api/api.specification.ts',
            '/repo/specs/api/users/stubs/newsroom.stubs.ts',
        ];

        // Then - the conventions bind every test file of a repository
        expect(covered.every((file) => isTestFile(file))).toBeTruthy();
    });

    test('isTestFile — what the test conventions reach — leaves production source alone', () => {
        // Given - a module of the app
        // Then - nothing about it is a test
        expect(isTestFile('/repo/src/matching/match.ts')).toBeFalsy();
    });
});
