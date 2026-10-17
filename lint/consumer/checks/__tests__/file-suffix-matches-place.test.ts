import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { packageWith } from '../../../__tests__/package-tree.fixtures.js';
import {
    checkFileSuffixMatchesPlace,
    checkFileSuffixMatchesPlaceInMember,
    checkFileSuffixMatchesPlaceOfDocument,
    fixFileSuffixMatchesPlace,
} from '../file-suffix-matches-place.js';

const RUNS = "import { api } from '../api.specification.js';\n";

const SPECIFIES = "import { api } from '../../api.specification.js';\n";

function foundIn(specsRoot: string): string[] {
    return checkFileSuffixMatchesPlace(specsRoot).map(
        ({ fix, found, line, path, rule }) => `${path}:${line} ${found} — ${fix} (${rule})`,
    );
}

describe('file-suffix-matches-place', () => {
    test("a spec at a project's root is named, and a module test or a folder there is not", () => {
        // Given - a spec, a module test, and a folder spelled as a spec, at the root
        const root = packageWith({ 'a.spec.ts': '', 'b.test.ts': '' });
        mkdirSync(join(root, 'c.spec.ts'));

        // Then - only the spec file is out of place
        expect(checkFileSuffixMatchesPlaceInMember(root)).toStrictEqual([
            {
                fix: 'move it under `specs/<specification>/`, or rename it `a.test.ts` in the `__tests__/` of the folder of the module it covers',
                found: "a `.spec.ts` at the project's root, outside every `specs/` tree",
                line: 1,
                path: 'a.spec.ts',
                rule: 'file-suffix-matches-place',
            },
        ]);
        expect(checkFileSuffixMatchesPlaceInMember(join(root, 'missing'))).toStrictEqual([]);
    });

    test('a test reaching a runner under a specification is to be renamed a spec, and nothing else is', () => {
        // Given - one such test, beside tests that are ground, reach no runner, sit loose, under no specification, or in a pruned folder
        const root = packageWith({
            'specs/api/users/__fixtures__/app/x.test.ts': SPECIFIES,
            'specs/api/users/helper.test.ts': 'export {};\n',
            'specs/api/users/list.spec.ts': SPECIFIES,
            'specs/api/users/list.test.ts': SPECIFIES,
            'specs/api/users/node_modules/x.test.ts': SPECIFIES,
            'specs/loose.test.ts': RUNS,
            'specs/tools/x.test.ts': RUNS,
        });

        // Then - the one is named, from the specs root
        expect(foundIn(join(root, 'specs'))).toStrictEqual([
            'api/users/list.test.ts:1 a `.test.ts` under `specs/api/`, where a file specifies the assembled product — rename it `api/users/list.spec.ts`; `typescript fix` does it with `git mv` (file-suffix-matches-place)',
        ]);
    });

    test("a tree that is one specification's whole judges every test in it, a loose one and a folder of no specification's name alike", () => {
        // Given - a mirror tree, its specification at its root
        const root = packageWith({
            'tests/api.specification.ts': '',
            'tests/loose.test.ts': RUNS,
            'tests/tools/x.test.ts': SPECIFIES,
        });

        // Then - both are named, under the plain specs wording
        expect(foundIn(join(root, 'tests'))).toStrictEqual([
            'loose.test.ts:1 a `.test.ts` under `specs/`, where a file specifies the assembled product — rename it `loose.spec.ts`; `typescript fix` does it with `git mv` (file-suffix-matches-place)',
            'tools/x.test.ts:1 a `.test.ts` under `specs/`, where a file specifies the assembled product — rename it `tools/x.spec.ts`; `typescript fix` does it with `git mv` (file-suffix-matches-place)',
        ]);
        expect(foundIn(join(root, 'missing'))).toStrictEqual([]);
    });

    test.each([
        ['users/lists-all.spec.yaml', []],
        ['users/Lists_All.spec.yaml', ['"Lists_All.spec.yaml" is not kebab-case']],
        [
            'users/lists-cli.spec.yaml',
            ['"lists-cli.spec.yaml" repeats "cli", which the `.spec.yaml` suffix already says'],
        ],
        ['users/users.spec.yaml', ['"users.spec.yaml" repeats its directory "users/"']],
        [
            'test/test.spec.yaml',
            [
                '"test.spec.yaml" repeats "test", which the `.spec.yaml` suffix already says',
                '"test.spec.yaml" repeats its directory "test/"',
            ],
        ],
    ])('the document %s is named %j', (rel, found) => {
        // Given - a document's path under its specification
        // Then - what its name repeats or misspells
        expect(checkFileSuffixMatchesPlaceOfDocument(rel).map((one) => one.found)).toStrictEqual(
            found,
        );
    });

    test('each document finding teaches its fix', () => {
        // Given - a misspelled, a redundant and a placed name
        // Then - each fix names the remedy
        expect(
            ['a/Bad.spec.yaml', 'a/spec-x.spec.yaml', 'x/x.spec.yaml'].flatMap((rel) =>
                checkFileSuffixMatchesPlaceOfDocument(rel).map(
                    ({ fix, line, rule }) => `${rule}:${line} ${fix}`,
                ),
            ),
        ).toStrictEqual([
            'file-suffix-matches-place:1 rename it in kebab-case, lowercase words joined by single hyphens: `<case>.spec.yaml`',
            'file-suffix-matches-place:1 drop "spec" from the name and name the case it proves',
            'file-suffix-matches-place:1 name it for what this case proves, not where it sits',
        ]);
    });

    test('the fix renames each test to a spec, unless the spec is taken', () => {
        // Given - two such tests, the second's spec name taken
        const root = packageWith({
            'specs/api/users/list.test.ts': SPECIFIES,
            'specs/api/users/show.spec.ts': 'kept\n',
            'specs/api/users/show.test.ts': SPECIFIES,
        });
        const specsRoot = join(root, 'specs');

        // When - the fix runs
        const done = fixFileSuffixMatchesPlace(specsRoot);

        // Then - the first is renamed, the second kept
        expect([
            done,
            existsSync(join(specsRoot, 'api/users/list.spec.ts')),
            existsSync(join(specsRoot, 'api/users/show.test.ts')),
        ]).toStrictEqual([
            ['renamed api/users/list.test.ts → api/users/list.spec.ts (file-suffix-matches-place)'],
            true,
            true,
        ]);
    });
});
