import { directory, file } from '@jterrazz/test';
/* oxlint-disable typescript/no-unsafe-type-assertion -- every path here is one the types refuse: its refusal at run time, for a caller they do not reach, is the subject */
import { describe, expect, test } from 'vitest';

import { cli } from '../cli.specification.js';

const WHY =
    'why: A verb that reads the disk takes a `file()` or a `directory()`, whose path starts with `./` or `../` and ends in `/` exactly when it names a directory.';
const READ = 'read: docs/19-linting.md#disk-named-by-relative-path-at-runtime';

describe('refused', () => {
    test('a path that is not relative to the spec file is refused before the chain holds it, naming the form to write', () => {
        // Given - a bare name where the spec names its fixture
        // Then - refused where it is written, with the relative form of the same path
        expect(() => cli.fixture(file('invalid.ts' as never))).toThrow(
            [
                'found: file("invalid.ts"), a path that is not relative to the spec file',
                WHY,
                "fix: start it with ./ or ../, from the spec file: file('./invalid.ts')",
                READ,
            ].join('\n'),
        );
    });

    test('a directory named without its slash, and a file named with one, are each refused naming the other', () => {
        // Given - each wrapper handed the other's path
        // Then - each names the call to write instead
        expect(() => cli.fixture(directory('./_fixtures/chain-ground' as never))).toThrow(
            [
                'found: directory("./_fixtures/chain-ground"), a path that does not end in /',
                WHY,
                'fix: end it in /: directory("./_fixtures/chain-ground/"), or name a file with file("./_fixtures/chain-ground")',
                READ,
            ].join('\n'),
        );
        // checker-disable-next-line named-path-exists -- the refusal under test: a file() naming a directory is refused before the disk is read
        expect(() => cli.fixture(file('./_fixtures/chain-ground/' as never))).toThrow(
            [
                'found: file("./_fixtures/chain-ground/"), a path ending in / — a directory\'s',
                WHY,
                'fix: name the directory with directory("./_fixtures/chain-ground/"), or the file without its /: file("./_fixtures/chain-ground")',
                READ,
            ].join('\n'),
        );
    });

    test('a path handed as a plain string is refused as a value, not read as the disk', () => {
        // Given - the fixture's path without the wrapper that says what it names
        // Then - the verb names the wrappers that read the disk
        expect(() => cli.fixture('./_fixtures/chain-ground/' as never)).toThrow(
            [
                'found: fixture("./_fixtures/chain-ground/"), a value where the disk is read',
                WHY,
                "fix: name the disk: fixture(file('./…')) for a file, fixture(directory('./…/')) for a directory",
                READ,
            ].join('\n'),
        );
    });
});
