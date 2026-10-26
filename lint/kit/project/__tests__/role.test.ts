import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { checkoutUnder, repositoryUnder } from '../../../__tests__/package-tree.fixtures.js';
import { materialAt } from '../material.js';
import type { FileRole, StrayTestRoot } from '../role.js';
import {
    isNodeTestFileName,
    isTestFile,
    isTestFileName,
    isTestRole,
    projectRootOf,
    projectSegments,
    roleOf,
} from '../role.js';

const REPO_ROOT = resolve(import.meta.dirname, '../../../..');

const strayTestRootOf = (path: string): StrayTestRoot => roleOf(path).strayTestRoot;

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
        // Given - the runner file at a specification root
        // Then - the suffix decides, not the folder
        expect(roleOf('/repo/specs/api/api.specification.ts').role).toBe('specification');
    });

    test('roleOf — the kind a path states — names the settings file the test projects are declared in', () => {
        // Given - the file the derived vitest config reads
        // Then - the config role is what the setup rules reach, and the derived vitest config is not
        expect(roleOf('/repo/studio.config.ts').role).toBe('config');
        expect(roleOf('/repo/vitest.config.ts').role).toBe('other');
    });

    test('roleOf — the kind a path states — ground is what a spec stands on, and it swallows what sits inside it', () => {
        // Given - a fixture project's own source file
        // Then - it is ground, never a member of the row
        expect(roleOf('/repo/specs/__fixtures__/app/server.ts').role).toBe('ground');
        expect(roleOf('/repo/specs/api/users/__expected__/user.http').role).toBe('ground');
    });

    test("roleOf — the kind a path states — a ground module's own test keeps its kind — `test-in-its-tests-folder`'s one pairing", () => {
        // Given - a `<module>.test.ts` inside ground
        // Then - the suffix wins: it is a module test, not inert material
        expect(roleOf('/repo/specs/__fixtures__/app/server.test.ts').role).toBe('module');
    });

    test('roleOf — the kind a path states — a stubs/ unit is its own role — the half `stubs-imported-through-facade` keeps internal', () => {
        // Given - a file under a feature's stubs/ folder
        // Then - `stub`: the boundary rule asks the identity, not the path
        expect(roleOf('/repo/specs/api/news/stubs/http/latest.ts').role).toBe('stub');
        expect(roleOf('/repo/specs/api/news/stubs/latest.stubs.ts').role).toBe('stub');
    });

    test('roleOf — the kind a path states — says whether the path sits under a specs tree, whatever its kind', () => {
        // Given - the same suffix inside and outside `specs/`
        // Then - `inSpecs` is the second field a rule reads, never the first
        expect(roleOf('/repo/specs/api/users/create.test.ts').inSpecs).toBe(true);
        expect(roleOf('/repo/src/matching/match.test.ts').inSpecs).toBe(false);
    });

    test('roleOf — the kind a path states — names the separate test roots, in both of their spellings', () => {
        // Given - the two shapes `test-in-its-tests-folder` refuses, each anchored on a real package root, and a module's tests folder
        // Then - `strayTestRoot` is the third field a rule reads, and a `__tests__/` is a module's own: in tests, never stray
        expect([
            strayTestRootOf('/repo/src/matching/__tests__/match.test.ts'),
            strayTestRootOf(`${REPO_ROOT}/tests/smoke.test.ts`),
            strayTestRootOf(`${REPO_ROOT}/test/corpus.test.ts`),
        ]).toStrictEqual([null, 'tests', 'test']);
        expect(roleOf('/repo/src/matching/__tests__/match.test.ts').inTests).toBe(true);
        expect(roleOf('/repo/src/matching/match.ts').inTests).toBe(false);
    });

    test('roleOf — the kind a path states — names nothing that merely spells one', () => {
        // Given - a `tests` or `test` segment with no package above it, and a specs tree
        // Then - the clause is anchored on a package root, so a checkout under `~/tests/` is nobody's business
        expect([
            strayTestRootOf('/no-such-root-xyz/tests/smoke.test.ts'),
            strayTestRootOf('/no-such-root-xyz/test/smoke.test.ts'),
            strayTestRootOf('/repo/specs/api/users/create.test.ts'),
        ]).toStrictEqual([null, null, null]);
    });

    test('roleOf — read below the project root — a checkout under a folder named like ground, a stub or a stray test root is none of them', () => {
        // Given - three packages checked out under `__fixtures__/`, `stubs/` and `__tests__/`
        const under = ['__fixtures__', 'stubs', '__tests__'].map((folder) => checkoutUnder(folder));

        // Then - a module of each is the project's own code, and its test sits under no stray test root
        expect(under.map((root) => roleOf(join(root, 'src/widget.ts')).role)).toStrictEqual([
            'other',
            'other',
            'other',
        ]);
        expect(
            under.map((root) => strayTestRootOf(join(root, 'src/widget.test.ts'))),
        ).toStrictEqual([null, null, null]);
    });

    test('roleOf — read below the project root — the folders inside the project still say what they are', () => {
        // Given - the same checkout under `__fixtures__/`, with its own ground, stubs, tests folder and stray test root
        const root = checkoutUnder('__fixtures__');

        // Then - ground, stub and `__tests__` are read where the project names them
        expect(roleOf(join(root, 'specs/api/orders/__fixtures__/app.ts')).role).toBe('ground');
        expect(roleOf(join(root, 'specs/api/orders/stubs/http/latest.ts')).role).toBe('stub');
        expect(roleOf(join(root, 'src/__tests__/widget.test.ts')).inTests).toBe(true);
        expect(strayTestRootOf(join(root, 'tests/widget.test.ts'))).toBe('tests');
    });

    test('roleOf — read below the project root — a file outside every package is read below its repository root', () => {
        // Given - two repositories holding no package.json, checked out under `__fixtures__/` and `specs/`, one a worktree
        const underGround = repositoryUnder('__fixtures__');
        const underSpecs = repositoryUnder('specs', [], 'file');

        // Then - the segments start at the repository, and no folder above it answers
        expect(projectSegments(join(underGround, 'src/widget.ts'))).toStrictEqual([
            'src',
            'widget.ts',
        ]);
        expect(roleOf(join(underGround, 'src/widget.ts')).role).toBe('other');
        expect(roleOf(join(underSpecs, 'src/widget.test.ts')).inSpecs).toBe(false);
        expect(strayTestRootOf(join(underGround, 'tests/widget.test.ts'))).toBe('tests');
    });

    test('roleOf — read below the project root — a workspace member named specs keeps its folder as the first segment, so what it holds is the specs tree', () => {
        // Given - a repository whose `specs/` is a workspace member of its own, and a package of another name beside it
        const repository = mkdtempSync(join(tmpdir(), 'specs-member-'));
        for (const member of ['specs', 'app']) {
            mkdirSync(join(repository, member, '__setup__'), { recursive: true });
            writeFileSync(join(repository, member, 'package.json'), '{}\n');
        }
        const inSpecs = join(repository, 'specs/__setup__/helper.ts');
        const inApp = join(repository, 'app/__setup__/helper.ts');

        // Then - the member's folder leads its segments and the other package's does not, and the member's helper is the specs tree, which production may not reach, where the other package's is nothing of the sort
        expect([projectSegments(inSpecs), projectSegments(inApp)]).toStrictEqual([
            ['specs', '__setup__', 'helper.ts'],
            ['__setup__', 'helper.ts'],
        ]);
        expect([materialAt(inSpecs), materialAt(inApp)]).toStrictEqual([
            'the specs tree',
            undefined,
        ]);
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
        expect(covered.every((file) => isTestFile(file))).toBe(true);
    });

    test('isTestFile — what the test conventions reach — leaves production source alone', () => {
        // Given - a module of the app
        // Then - nothing about it is a test
        expect(isTestFile('/repo/src/matching/match.ts')).toBe(false);
    });

    test('the names a walk holds tell a test, a node test and a rendered one apart, and a test file is any test role, specification or document', () => {
        // Given - names of each kind, and paths no project holds
        const names = ['a.test.ts', 'a.test.tsx', 'a.spec.ts', 'a.ts', 'a.specification.tsx'];

        // Then - each verdict
        expect([
            names.map((name) => isTestFileName(name)),
            names.map((name) => isNodeTestFileName(name)),
            ['/repo/x/a.specification.tsx', '/repo/x/a.spec.yaml', '/repo/x/a.ts'].map((path) => [
                roleOf(path).role,
                isTestFile(path),
            ]),
            roleOf('/tests/a.ts').strayTestRoot,
        ]).toStrictEqual([
            [true, true, true, false, false],
            [true, false, true, false, false],
            [
                ['specification', true],
                ['document', true],
                ['other', false],
            ],
            null,
        ]);
    });
});
