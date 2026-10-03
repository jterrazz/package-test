import { directory } from '@jterrazz/test';
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
        // Given - a consumer declaring test() in its settings file, whose specs tree breaks a convention
        const result = await cli
            .fixture(directory('./_fixtures/declaring-test/'))
            .exec('typescript check');

        // Then - the check fails, and the conventions name each finding with the page that explains it
        expect(result.exitCode).toBe(1);
        expect(conventionsOf(result.stdout.text)).toBe(
            [
                LABEL,
                '',
                'specs/api/users/creation.test.ts:1:1: error jterrazz-check(file-suffix-matches-place): found: a `.test.ts` under `specs/api/`, where a file specifies the assembled product · why: The suffix says the kind, and the tree agrees with it. · fix: rename it `api/users/creation.spec.ts` — `make fix` does it with `git mv` · read: docs/24-linting.md#file-suffix-matches-place',
                "found: every finding above, and .jterrazz/baseline.json records no `jterrazz-check/` entry in its `test` section to hold one · why: a project that recorded no debt is held at zero, so each finding fails the run as new debt · fix: fix them, or run 'typescript baseline' to record where the project stands · read: docs/24-linting.md#the-ratchet-the-test-section-of-jterrazzbaselinejson",
                '✗ Failed with exit code 1',
            ].join('\n'),
        );
    });

    test("the installed toolchain passes a consumer's tree that keeps the conventions", async () => {
        // Given - a consumer declaring test() in its settings file, whose specs tree is in order
        const result = await cli
            .fixture(directory('./_fixtures/declaring-test-kept/'))
            .exec('typescript check');

        // Then - the conventions pass, and say what the ratchet holds
        expect(conventionsOf(result.stdout.text)).toBe(
            [LABEL, '', '.jterrazz/baseline.json › test: nothing held', '✓ Passed'].join('\n'),
        );
    });
});
