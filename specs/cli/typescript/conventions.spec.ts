import { directory, packed } from '@jterrazz/test';
import { stripVTControlCharacters } from 'node:util';
import { describe, expect, test } from 'vitest';

import { cli } from '../packed-cli.specification.js';

const LABEL = 'Test Conventions (@jterrazz/test)';

function conventionsOf(stdout: string): string {
    const plain = stripVTControlCharacters(stdout);
    const from = plain.indexOf(LABEL);
    const to = plain.slice(from).search(/\n (?:RUN|DRIFT|END) /u);

    return plain.slice(from, from + to).trim();
}

describe('conventions', () => {
    test("the installed toolchain runs the conventions a consumer's declared preset brings", async () => {
        // Given - a consumer declaring test() in its settings file, whose specs tree breaks one convention and nothing else
        const result = await cli
            .link('@jterrazz/test', packed())
            .link('@types/node')
            .fixture(directory('./__fixtures__/declaring-test/'))
            .exec('node_modules/@jterrazz/typescript/dist/typescript.js check');

        // Then - the check fails on the conventions, which name the finding with the page that explains it
        expect(result.exitCode).toBe(1);
        expect(conventionsOf(result.stdout.text)).toBe(
            [
                LABEL,
                '',
                'specs/cli/widget/version.test.ts:1:1: error jterrazz-check(file-suffix-matches-place): found: a `.test.ts` under `specs/cli/`, where a file specifies the assembled product · why: The suffix says the kind, and the tree agrees with it. · fix: rename it `cli/widget/version.spec.ts` — `typescript fix` does it with `git mv` · read: docs/reference/linting.md#file-suffix-matches-place',
                "found: every finding above, and .jterrazz/baseline.json records no `jterrazz-check/` entry in its `test` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'typescript baseline' to record where the project stands · read: docs/reference/linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson",
                '✗ Failed with exit code 1',
            ].join('\n'),
        );
    });

    test("the installed toolchain's fix applies the conventions' own fixes", async () => {
        // Given - the consumer whose spec wears the unit's suffix under a specification folder

        // When - the fixes run
        const result = await cli
            .link('@jterrazz/test', packed())
            .link('@types/node')
            .fixture(directory('./__fixtures__/declaring-test/'))
            .exec('node_modules/@jterrazz/typescript/dist/typescript.js fix');

        // Then - the spec is renamed for its place, and the conventions have nothing left to hold
        expect(result.exitCode).toBe(0);
        expect(result.file('specs/cli/widget/version.spec.ts').exists).toBe(true);
        expect(result.file('specs/cli/widget/version.test.ts').exists).toBe(false);
        expect(conventionsOf(result.stdout.text)).toBe(
            [LABEL, '', '.jterrazz/baseline.json › test: nothing held', '✓ Passed'].join('\n'),
        );
    });

    test("the installed toolchain's baseline records the conventions' findings in the test section", async () => {
        // Given - the same consumer, its finding not yet recorded

        // When - the baseline is recorded
        const result = await cli
            .link('@jterrazz/test', packed())
            .link('@types/node')
            .fixture(directory('./__fixtures__/declaring-test/'))
            .exec('node_modules/@jterrazz/typescript/dist/typescript.js baseline');

        // Then - the test section holds the convention's key at the count it stands at
        expect(result.exitCode).toBe(0);
        expect(JSON.parse(result.file('.jterrazz/baseline.json').content)).toStrictEqual({
            test: { 'jterrazz-check/file-suffix-matches-place': 1 },
        });
    });

    test("the installed toolchain passes a consumer's tree that keeps the conventions", async () => {
        // Given - a consumer declaring test() in its settings file, every file in order
        const result = await cli
            .link('@jterrazz/test', packed())
            .link('@types/node')
            .fixture(directory('./__fixtures__/declaring-test-kept/'))
            .exec('node_modules/@jterrazz/typescript/dist/typescript.js check');

        // Then - the whole check passes, and the conventions say what the ratchet holds
        expect(result.exitCode).toBe(0);
        expect(conventionsOf(result.stdout.text)).toBe(
            [LABEL, '', '.jterrazz/baseline.json › test: nothing held', '✓ Passed'].join('\n'),
        );
    });
});
