import { readManifest } from '@jterrazz/typescript/rules';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { runMember } from '../../kit/checker/member-run.js';
import { teacherOf } from '../../kit/checker/teacher.js';
import { packageWith } from '../../kit/testing/package-tree.fixtures.js';
import { CHECKER } from './checker.js';
import type { Spotted } from './checker.js';
import {
    CARRIED,
    CARRIED_IN_DEV,
    checkNoRedundantTestDependency,
} from './no-redundant-test-dependency.js';

const LINT_PLUGIN_RUNTIME = new Set(['@oxlint/plugins', 'oxc-parser']);

const WORKSPACE = resolve(import.meta.dirname, '../../../specs/_shared/_fixtures/member-workspace');
const memberAt = (name: string): string => resolve(WORKSPACE, 'packages', name);

const RN = '@testing-library/react-native';

const LIB = 'packages/lib';

const REACHES_LIB = "module.exports = { roots: ['<rootDir>/../../packages/lib'] };\n";

function spottedIn(files: Record<string, string>, folders: string[] = []): Spotted[] {
    const root = packageWith(files);
    for (const folder of folders) {
        mkdirSync(join(root, folder), { recursive: true });
    }
    const memberDir = join(root, LIB);
    return checkNoRedundantTestDependency({
        label: LIB,
        manifest: readManifest(memberDir) ?? {},
        memberDir,
        subject: 'lib',
    });
}

function namedIn(files: Record<string, string>, folders: string[] = []): string[] {
    return spottedIn(files, folders).map(({ found }) => found);
}

const manifestText = (fields: object): string => `${JSON.stringify(fields, null, 4)}\n`;

const libWith = (fields: object): Record<string, string> => ({
    [`${LIB}/package.json`]: manifestText({ name: 'lib', ...fields }),
});

const rnLibReachedBy = (files: Record<string, string>): Record<string, string> => ({
    ...libWith({ devDependencies: { [RN]: '1' } }),
    ...files,
});

const RN_REFUSED = [`lib: \`${RN}\` is a seam \`@jterrazz/test\` replaced`];

function codes(dir: string, root = WORKSPACE): string[] {
    return runMember(dir, root, CHECKER).map((violation) => violation.rule);
}

describe('no-redundant-test-dependency', () => {
    test('members — members — the member pass — what a workspace member owes — a dependency the framework carries, and a seam it replaced (`no-redundant-test-dependency`)', () => {
        // Given - a member declaring msw, a testing-library package, and the optional peer a consumer declares on purpose
        const found = runMember(memberAt('seam-dependency'), WORKSPACE, CHECKER);

        // Then - the two are named, each by what it actually is, and playwright - an optional peer a consumer declares - is not
        expect(found.map((violation) => violation.rule)).toStrictEqual([
            'no-redundant-test-dependency',
            'no-redundant-test-dependency',
        ]);
        expect(
            found[0] === undefined ? '' : (teacherOf(CHECKER)([found[0]])[0]?.message ?? ''),
        ).toContain('@testing-library/react');
        expect(
            found[0] === undefined ? '' : (teacherOf(CHECKER)([found[0]])[0]?.message ?? ''),
        ).toContain('is a seam `@jterrazz/test` replaced');
        expect(
            found[1] === undefined ? '' : (teacherOf(CHECKER)([found[1]])[0]?.message ?? ''),
        ).toContain('`msw` is a transitive of `@jterrazz/test`');
        expect(found.every((violation) => !violation.found.includes('playwright'))).toBe(true);
    });

    test('members — members — the member pass — what a workspace member owes — a finding points at the line the declaration is written on (`no-redundant-test-dependency`)', () => {
        // Given - the same member, whose manifest spells msw on its own line
        const found = runMember(memberAt('seam-dependency'), WORKSPACE, CHECKER);

        // Then - the anchor is the declaration, not the opening brace
        expect(found.map((violation) => violation.line)).toStrictEqual([4, 5]);
    });

    test("members — members — the member pass — what a workspace member owes — a runtime `yaml` is the product's, a dev one is the seam's (`no-redundant-test-dependency`)", () => {
        // Given - `clean` declares yaml as a RUNTIME dependency
        // Then - nothing fires: the framework never ships its yaml to a product
        expect(codes(memberAt('clean'))).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — the RN testing library stands where jest is the runner (`no-redundant-test-dependency`)', () => {
        // Given - a member whose test script is jest and whose vocabulary is the React Native one
        // Then - nothing fires: the facet that would replace it does not reach that runtime yet
        expect(codes(memberAt('rn-jest'))).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — the RN testing library stands where jest runs it from ONE MEMBER AWAY (`no-redundant-test-dependency`)', () => {
        // Given - a library whose own script is `vitest --run`, whose render tests are co-located in its `src/`, and an app beside it whose jest config roots into exactly that folder
        // Then - nothing fires: jest runs those tests, and where it runs them from is not the library's business
        expect(codes(memberAt('rn-library'))).toStrictEqual([]);
    });

    test('members — members — the member pass — what a workspace member owes — the allowance reads the same from INSIDE the member as from the root (`no-redundant-test-dependency`)', () => {
        // Given - the run that member's own gate makes: anchored at the member, where the app that runs its tests is above the anchor, never below it
        const anchored = codes(memberAt('rn-library'), memberAt('rn-library'));

        // Then - the two directions agree, which is the contract the path-less run rests on
        expect(anchored).toStrictEqual([]);
        expect(anchored).toStrictEqual(codes(memberAt('rn-library')));
    });

    test('members — members — the member pass — what a workspace member owes — a jest config that reaches ANOTHER member clears nothing here (`no-redundant-test-dependency`)', () => {
        // Given - the same workspace, read from the member the playground does NOT root into
        // Then - the seam is still refused: the allowance follows the tests, not the workspace
        expect(codes(memberAt('seam-dependency'))).toStrictEqual([
            'no-redundant-test-dependency',
            'no-redundant-test-dependency',
        ]);
    });

    test('what the framework carries — the rule reads exactly the dependencies this package ships (ADR-008)', () => {
        // Given - the dependencies of the published manifest, the lint plugin's own runtime set aside
        const manifest: unknown = JSON.parse(
            readFileSync(resolve(import.meta.dirname, '../../../package.json'), 'utf8'),
        );
        const dependencies: unknown =
            typeof manifest === 'object' && manifest !== null && 'dependencies' in manifest
                ? manifest.dependencies
                : undefined;
        const shipped =
            typeof dependencies === 'object' && dependencies !== null
                ? Object.keys(dependencies)
                : [];

        // Then - a seam added to or dropped from `dependencies` moves the rule with it
        expect([...CARRIED, ...CARRIED_IN_DEV].toSorted()).toStrictEqual(
            shipped.filter((name) => !LINT_PLUGIN_RUNTIME.has(name)).toSorted(),
        );
    });

    test('a carried dependency and a replaced seam are each named at their line, with what to do about it', () => {
        // Given - runtime and dev declarations of carried, replaced and unrelated packages
        const found = spottedIn(
            libWith({
                dependencies: { msw: '1', '@testing-library/react': '1', zod: '1' },
                devDependencies: { yaml: '1', 'happy-dom': '1', vitest: '1' },
            }),
        );

        // Then - the four the framework answers for, sorted, each at the line that declares it
        const path = join(LIB, 'package.json');
        const rewrite = 'write its tests on `component()`, `website()`, `clock` or `intercept()`';
        expect([
            found.map(({ line, found: what, fix }) => `${line} ${what} — ${fix}`),
            found.every((one) => one.path === path && one.rule === 'no-redundant-test-dependency'),
        ]).toStrictEqual([
            [
                `5 lib: \`@testing-library/react\` is a seam \`@jterrazz/test\` replaced — remove \`@testing-library/react\` from ${path}, and ${rewrite}`,
                `10 lib: \`happy-dom\` is a seam \`@jterrazz/test\` replaced — remove \`happy-dom\` from ${path}, and ${rewrite}`,
                `4 lib: \`msw\` is a transitive of \`@jterrazz/test\` — remove \`msw\` from ${path}`,
                `9 lib: \`yaml\` is a transitive of \`@jterrazz/test\` — remove \`yaml\` from ${path}`,
            ],
            true,
        ]);
    });

    test('the framework itself declares what it carries', () => {
        // Given - the manifest of @jterrazz/test, which ships msw
        // Then - nothing is redundant there
        expect(
            namedIn({
                [`${LIB}/package.json`]: manifestText({
                    dependencies: { msw: '1' },
                    name: '@jterrazz/test',
                }),
            }),
        ).toStrictEqual([]);
    });

    test.each([
        ['no jest at all', {}, RN_REFUSED],
        ['jest at runtime', { dependencies: { jest: '1' } }, []],
        ['jest in dev', { devDependencies: { [RN]: '1', jest: '1' } }, []],
        ['jest-expo', { devDependencies: { [RN]: '1', 'jest-expo': '1' } }, []],
        ['a jest config key', { jest: {} }, []],
        ['a test script that is jest', { scripts: { test: 'jest' } }, []],
        ['a test script that runs jest', { scripts: { test: 'npx jest --ci' } }, []],
        ['a test script running jest by path', { scripts: { test: 'node_modules/.bin/jest' } }, []],
        ['a test script of a jest plugin', { scripts: { test: 'jest-runner x' } }, RN_REFUSED],
        ['a test script of a name ending in jest', { scripts: { test: 'myjest' } }, RN_REFUSED],
        ['a test script of vitest', { scripts: { test: 'vitest --run' } }, RN_REFUSED],
    ])(
        'the React Native testing library, with %s, is refused only where jest does not run',
        (_, fields, named) => {
            // Given - a member declaring the React Native testing library beside the jest declaration
            const files = libWith({ devDependencies: { [RN]: '1' }, ...fields });

            // Then - jest declared in any form is the runner the library needs
            expect(namedIn(files)).toStrictEqual(named);
        },
    );

    test('jest running the member allows the React Native library alone, never another seam', () => {
        // Given - a jest member declaring the web testing library
        // Then - that seam is still replaced
        expect(
            namedIn(libWith({ devDependencies: { '@testing-library/react': '1', jest: '1' } })),
        ).toStrictEqual(['lib: `@testing-library/react` is a seam `@jterrazz/test` replaced']);
    });

    test.each([
        ['a pnpm-workspace.yaml', { 'pnpm-workspace.yaml': '' }, []],
        ['a pnpm-workspace.yml', { 'pnpm-workspace.yml': '' }, []],
        [
            'a manifest declaring workspaces',
            { 'package.json': manifestText({ workspaces: ['packages/*'] }) },
            [],
        ],
        ['no workspace declaration', {}, RN_REFUSED],
    ])('a jest config beside the member is read from the root %s marks', (_, root, named) => {
        // Given - an app whose jest config roots into the library
        const files = rnLibReachedBy({ ...root, 'apps/app/jest.config.js': REACHES_LIB });

        // Then - it reaches the library only from a declared workspace root
        expect(namedIn(files)).toStrictEqual(named);
    });

    test('a git checkout bounds the workspace as a declaration does', () => {
        // Given - a checkout with no workspace declaration, and the app's jest config
        // Then - the checkout's top is the root the config is read from
        expect(
            namedIn(rnLibReachedBy({ 'apps/app/jest.config.js': REACHES_LIB }), ['.git']),
        ).toStrictEqual([]);
    });

    test.each([
        ['into the member', "roots: ['<rootDir>/../../packages/lib/src']", []],
        ['by a path relative to the config', "roots: ['../../packages/lib']", []],
        ['by a later path', "roots: ['<rootDir>/src', '<rootDir>/../../packages/lib']", []],
        [
            'by a later list',
            "testPathIgnorePatterns: ['x'], roots: ['<rootDir>/../../packages/lib']",
            [],
        ],
        [
            'to a sibling sharing its prefix',
            "roots: ['<rootDir>/../../packages/lib-two']",
            RN_REFUSED,
        ],
    ])('a jest config reaching %s', (_, reach, named) => {
        // Given - a pnpm workspace and an app config with that reach
        const files = rnLibReachedBy({
            'apps/app/jest.config.js': `module.exports = { ${reach} };\n`,
            'pnpm-workspace.yaml': '',
        });

        // Then - only a path inside the member reaches it
        expect(namedIn(files)).toStrictEqual(named);
    });

    test.each([
        ['a second config', 'apps/b/jest.config.ts', []],
        ['a config six folders down', 'a/b/c/d/e/f/jest.config.js', []],
        ['a config seven folders down', 'a/b/c/d/e/f/g/jest.config.js', RN_REFUSED],
        ['a config under node_modules', 'node_modules/b/jest.config.js', RN_REFUSED],
        ['a config under a dot folder', '.cache/b/jest.config.js', RN_REFUSED],
        ['a file that is no jest config', 'apps/b/other.config.js', RN_REFUSED],
    ])('the reaching config found as %s', (_, path, named) => {
        // Given - a config reaching nothing, and the reaching one at that place
        const climb = '../'.repeat(path.split('/').length - 1);
        const files = rnLibReachedBy({
            'apps/a/jest.config.js': "module.exports = { roots: ['<rootDir>'] };\n",
            [path]: `module.exports = { roots: ['<rootDir>/${climb}packages/lib'] };\n`,
            'pnpm-workspace.yaml': '',
        });

        // Then - only a jest config the walk reaches counts
        expect(namedIn(files)).toStrictEqual(named);
    });
});
